#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod folder_access;
mod steam_discovery;
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
        registry.save(&access.file)
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
        Ok(steam_discovery::discover(&grant.path))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn main() {
    tauri::Builder::default()
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
            discover_steam
        ])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar o MySpace Desktop");
}
