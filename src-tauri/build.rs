fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["check_folders"]),
    )).expect("Falha ao preparar permissões desktop");
}
