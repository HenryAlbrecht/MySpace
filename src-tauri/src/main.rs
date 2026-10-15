#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod steam_discovery;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn discover_steam(app: tauri::AppHandle, path: String) -> Result<steam_discovery::Report, String> {
    if path.len() > 32767 || !std::path::Path::new(&path).is_absolute() {
        return Err("Pasta inválida".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        // Stored frontend references cannot grant filesystem access. Reconfirm in native UI.
        let selected = app.dialog().file()
            .set_title("Autorizar descoberta Steam — confirme a pasta registrada")
            .set_directory(&path)
            .blocking_pick_folder();
        let Some(selected) = selected else { return Ok(steam_discovery::Report::new(&path, "cancelled")); };
        let selected = selected.into_path().map_err(|error| error.to_string())?;
        let identity = |value: &str| value.replace('/', "\\").trim_end_matches('\\').to_lowercase();
        if identity(&selected.to_string_lossy()) != identity(&path) {
            return Err("Selecione a mesma pasta registrada para autorizar a leitura".into());
        }
        Ok(steam_discovery::discover(&selected))
    }).await.map_err(|error| error.to_string())?
}

// Only checks directory metadata; never enumerates or reads files.
#[tauri::command]
async fn check_folders(paths: Vec<String>) -> Result<Vec<String>, String> {
    if paths.len() > 100 || paths.iter().any(|path| path.len() > 32767 || !std::path::Path::new(path).is_absolute()) {
        return Err("Lista de caminhos inválida".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        paths.iter().map(|path| {
            match std::fs::metadata(path) {
                Ok(metadata) if metadata.is_dir() => "available",
                Ok(_) => "not-directory",
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => "unavailable",
                Err(_) => "inaccessible",
            }.to_string()
        }).collect()
    }).await.map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![check_folders, discover_steam])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar o MySpace Desktop");
}
