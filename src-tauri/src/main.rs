#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
        .invoke_handler(tauri::generate_handler![check_folders])
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar o MySpace Desktop");
}
