#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod folder_access;
mod game_launch;
mod music_discovery;
mod music_artwork;
mod music_stream;
mod steam_discovery;
mod steam_artwork;
mod youtube_music;
mod lastfm;
mod external_links;
mod media_download;
use folder_access::{FolderAccess, FolderView, Registry};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn authorize_folders(
    app: tauri::AppHandle,
    category: String,
) -> Result<Option<usize>, String> {
    folder_access::category(&category)?;
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("MySpace — autorizar pastas locais")
            .blocking_pick_folders();
        let Some(selected) = selected else {
            return Ok(None);
        };
        let paths = selected
            .into_iter()
            .map(|path| path.into_path().map_err(|error| error.to_string()))
            .collect::<Result<Vec<_>, _>>()?;
        let access = app.state::<FolderAccess>();
        let _lock = access
            .lock
            .lock()
            .map_err(|_| "Registro de pastas indisponível")?;
        let _disk_lock = access.disk_lock()?;
        let mut registry = Registry::load(&access.file)?;
        let added = registry.authorize(&category, &paths)?;
        app.state::<steam_artwork::SteamArtwork>().clear();
        registry.save(&access.file)?;
        Ok(Some(added))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_folders(app: tauri::AppHandle) -> Result<Vec<FolderView>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access
            .lock
            .lock()
            .map_err(|_| "Registro de pastas indisponível")?;
        let _disk_lock = access.disk_lock()?;
        Ok(Registry::load(&access.file)?
            .folders
            .iter()
            .map(|grant| grant.view())
            .collect())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn revoke_folder(app: tauri::AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access
            .lock
            .lock()
            .map_err(|_| "Registro de pastas indisponível")?;
        let _disk_lock = access.disk_lock()?;
        let mut registry = Registry::load(&access.file)?;
        registry.revoke(&id)?;
        registry.save(&access.file)?;
        app.state::<media_download::MediaDownloads>().cancel_folder(&id);
        app.state::<music_stream::MusicStreams>().revoke(&id);
        app.state::<game_launch::GameLaunch>().revoke(&id);
        app.state::<steam_artwork::SteamArtwork>().clear();
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn discover_steam(
    app: tauri::AppHandle,
    id: String,
) -> Result<steam_discovery::Report, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        // Revocation waits for active discovery; after it returns the ID is invalid.
        let _lock = access
            .lock
            .lock()
            .map_err(|_| "Registro de pastas indisponível")?;
        let _disk_lock = access.disk_lock()?;
        let registry = Registry::load(&access.file)?;
        let grant = registry.get(&id, Some("games"))?;
        let _guard = match grant.open() {
            Ok(guard) => guard,
            Err(error) => {
                let mut report =
                    steam_discovery::Report::new(&grant.path.to_string_lossy(), "invalid-folder");
                report.errors.push(error);
                return Ok(report);
            }
        };
        app.state::<steam_artwork::SteamArtwork>().clear();
        let report = steam_discovery::discover(&grant.path);
        app.state::<game_launch::GameLaunch>().discovered(&id, &report);
        Ok(report)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn discover_music(
    app: tauri::AppHandle,
    id: String,
) -> Result<music_discovery::Report, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access
            .lock
            .try_lock()
            .map_err(|_| "Outra operação de pastas está em andamento")?;
        let _disk_lock = access.disk_lock()?;
        let registry = Registry::load(&access.file)?;
        let grant = registry.get(&id, Some("music"))?;
        let _guard = match grant.open() {
            Ok(guard) => guard,
            Err(error) => return Ok(music_discovery::Report::unavailable(&grant.path, error)),
        };
        let report = music_discovery::discover(&grant.path);
        app.state::<music_stream::MusicStreams>().discovered(&id, &report);
        Ok(report)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn open_music(app: tauri::AppHandle, file_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access.lock.lock().map_err(|_| "Registro indisponível")?;
        let _disk = access.disk_lock()?;
        app.state::<music_stream::MusicStreams>().open(&access, &file_id)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn launch_steam(app: tauri::AppHandle, appid: String) -> Result<game_launch::LaunchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access
            .lock
            .try_lock()
            .map_err(|_| "Outra operação de pastas está em andamento. Tente novamente.")?;
        let _disk = access.disk_lock()?;
        app.state::<game_launch::GameLaunch>()
            .launch(&access, &appid, game_launch::dispatch)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn check_music(app: tauri::AppHandle, token: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access.lock.lock().map_err(|_| "Registro indisponível")?;
        let _disk = access.disk_lock()?;
        app.state::<music_stream::MusicStreams>().check(&access, &token)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn close_music(streams: tauri::State<'_, music_stream::MusicStreams>, token: String) {
    streams.close(&token);
}

#[tauri::command]
async fn search_youtube_music(
    app: tauri::AppHandle,
    kind: String,
    query: String,
    cursor: Option<String>,
) -> Result<serde_json::Value, String> {
    let search = (*app.state::<youtube_music::Search>()).clone();
    tauri::async_runtime::spawn_blocking(move || {
        search.search(&kind, &query, cursor.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn browse_youtube_music(
    app: tauri::AppHandle,
    kind: String,
    browse_id: String,
) -> Result<serde_json::Value, String> {
    let search = (*app.state::<youtube_music::Search>()).clone();
    tauri::async_runtime::spawn_blocking(move || search.browse(&kind, &browse_id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn radio_youtube_music(
    app: tauri::AppHandle,
    video_id: String,
) -> Result<serde_json::Value, String> {
    let search = (*app.state::<youtube_music::Search>()).clone();
    tauri::async_runtime::spawn_blocking(move || search.radio(&video_id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn browse_youtube_music_artist_section(
    app: tauri::AppHandle,
    section: String,
    browse_id: Option<String>,
    params: Option<String>,
    continuation: Option<String>,
) -> Result<serde_json::Value, String> {
    let search = (*app.state::<youtube_music::Search>()).clone();
    tauri::async_runtime::spawn_blocking(move || {
        search.artist_section(
            &section,
            browse_id.as_deref(),
            params.as_deref(),
            continuation.as_deref(),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn lastfm_configured(app: tauri::AppHandle) -> Result<bool, String> {
    app.state::<lastfm::Lastfm>().configured()
}

#[tauri::command]
async fn translate_desktop_summary(text: String, source: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || youtube_music::translation_request(&text, &source))
        .await.map_err(|_| "Tradução indisponível.".to_owned())?
}

#[tauri::command]
async fn save_lastfm_key(app: tauri::AppHandle, key: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || app.state::<lastfm::Lastfm>().save_key(&key))
        .await.map_err(|_| "Não foi possível salvar a configuração Last.fm.".to_owned())?
}

#[tauri::command]
async fn request_lastfm(app: tauri::AppHandle, method: String, params: serde_json::Value) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || app.state::<lastfm::Lastfm>().request(&method, &params))
        .await.map_err(|_| "Consulta Last.fm indisponível.".to_owned())?
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let url = external_links::validate(&url)?;
    external_links::open(&url)
}

#[tauri::command]
fn media_download_settings(app: tauri::AppHandle) -> Result<media_download::SettingsView, String> {
    app.state::<media_download::MediaDownloads>().settings()
}

#[tauri::command]
async fn choose_ytdlp(app: tauri::AppHandle) -> Result<Option<media_download::SettingsView>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("MySpace — selecionar yt-dlp.exe")
            .add_filter("yt-dlp.exe", &["exe"])
            .blocking_pick_file();
        let Some(selected) = selected else { return Ok(None) };
        let path = selected.into_path().map_err(|_| "Executável selecionado inválido.")?;
        app.state::<media_download::MediaDownloads>().set_ytdlp(path)?;
        Ok(Some(app.state::<media_download::MediaDownloads>().settings()?))
    })
    .await
    .map_err(|_| "Seletor de executável indisponível.")?
}

#[tauri::command]
async fn choose_ffmpeg(app: tauri::AppHandle) -> Result<Option<media_download::SettingsView>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("MySpace — selecionar ffmpeg.exe")
            .add_filter("ffmpeg.exe", &["exe"])
            .blocking_pick_file();
        let Some(selected) = selected else { return Ok(None) };
        let path = selected.into_path().map_err(|_| "Executável selecionado inválido.")?;
        app.state::<media_download::MediaDownloads>().set_ffmpeg(path)?;
        Ok(Some(app.state::<media_download::MediaDownloads>().settings()?))
    })
    .await
    .map_err(|_| "Seletor de executável indisponível.")?
}

#[tauri::command]
async fn save_media_download_settings(
    app: tauri::AppHandle,
    allowed_hosts: Vec<String>,
    destination_id: Option<String>,
) -> Result<media_download::SettingsView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let access = app.state::<FolderAccess>();
        let _lock = access.lock.lock().map_err(|_| "Registro de pastas indisponível.")?;
        let _disk_lock = access.disk_lock()?;
        if let Some(id) = destination_id.as_deref() {
            Registry::load(&access.file)?.get(id, Some("music"))?;
        }
        app.state::<media_download::MediaDownloads>()
            .save_preferences(allowed_hosts, destination_id)?;
        app.state::<media_download::MediaDownloads>().settings()
    })
    .await
    .map_err(|_| "Não foi possível salvar a configuração de downloads.")?
}

#[tauri::command]
async fn download_music_offline(
    app: tauri::AppHandle,
    download_id: String,
    source_url: String,
    source_identity: String,
    cooldown_seconds: u64,
    metadata: media_download::Metadata,
) -> Result<media_download::DownloadResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = (*app.state::<media_download::MediaDownloads>()).clone();
        let access = app.state::<FolderAccess>();
        let destination_id = manager
            .settings()?
            .destination_id
            .ok_or("Configure uma pasta de destino autorizada em Configurações Desktop.")?;
        let grant = {
            let _lock = access.lock.lock().map_err(|_| "Registro de pastas indisponível.")?;
            let _disk_lock = access.disk_lock()?;
            Registry::load(&access.file)?.get(&destination_id, Some("music"))?.clone()
        };
        manager.download(
            &access,
            grant,
            download_id,
            source_url,
            source_identity,
            cooldown_seconds,
            metadata,
        )
    })
    .await
    .map_err(|_| "Download interrompido.")?
}

#[tauri::command]
fn media_download_progress(
    app: tauri::AppHandle,
    download_id: String,
) -> Result<Option<media_download::Progress>, String> {
    app.state::<media_download::MediaDownloads>().progress(&download_id)
}

#[tauri::command]
fn cancel_media_download(app: tauri::AppHandle, download_id: String) -> Result<bool, String> {
    app.state::<media_download::MediaDownloads>().cancel(&download_id)
}

fn main() {
    tauri::Builder::default()
        .manage(game_launch::GameLaunch::default())
        .manage(steam_artwork::SteamArtwork::default())
        .manage(music_stream::MusicStreams::default())
        .manage(youtube_music::Search::default())
        .register_asynchronous_uri_scheme_protocol("myspace-music", |context, request, responder| {
            if context.webview_label() != "main" {
                responder.respond(
                    tauri::http::Response::builder()
                        .status(403)
                        .body(Vec::new())
                        .unwrap(),
                );
                return;
            }
            let app = context.app_handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let access = app.state::<FolderAccess>();
                let result = (|| {
                    let _lock = access.lock.lock().map_err(|_| ())?;
                    let _disk = access.disk_lock().map_err(|_| ())?;
                    if request.uri().path().starts_with("/steam-art-") {
                        return Ok(app.state::<steam_artwork::SteamArtwork>().respond(
                            &access, &app.state::<game_launch::GameLaunch>(), request));
                    }
                    Ok::<_, ()>(
                        app.state::<music_stream::MusicStreams>()
                            .respond(&access, request),
                    )
                })();
                responder.respond(result.unwrap_or_else(|_| {
                    tauri::http::Response::builder()
                        .status(503)
                        .body(Vec::new())
                        .unwrap()
                }));
            });
        })
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(lastfm::Lastfm::new(app.path().app_local_data_dir()?.join("online-keys-v1.json")));
            app.manage(
                media_download::MediaDownloads::new(
                    app.path().app_local_data_dir()?.join("media-download-tools-v1.json"),
                )
                .map_err(std::io::Error::other)?,
            );
            app.manage(FolderAccess {
                file: app
                    .path()
                    .app_local_data_dir()?
                    .join("authorized-folders-v1.json"),
                lock: std::sync::Mutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            authorize_folders,
            list_folders,
            revoke_folder,
            discover_steam,
            discover_music,
            open_music,
            check_music,
            close_music,
            launch_steam,
            search_youtube_music,
            browse_youtube_music,
            radio_youtube_music,
            lastfm_configured,
            save_lastfm_key,
            request_lastfm,
            translate_desktop_summary,
            open_external_url,
            media_download_settings,
            choose_ytdlp,
            choose_ffmpeg,
            save_media_download_settings,
            download_music_offline,
            media_download_progress,
            cancel_media_download,
            browse_youtube_music_artist_section
        ])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar o MySpace Desktop");
}
