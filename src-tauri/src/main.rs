#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod folder_access;
mod game_launch;
mod music_discovery;
mod music_artwork;
mod music_stream;
mod steam_discovery;
mod steam_artwork;
mod youtube_music;
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
            browse_youtube_music_artist_section
        ])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar o MySpace Desktop");
}
