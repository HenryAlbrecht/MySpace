fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "authorize_folders",
            "list_folders",
            "revoke_folder",
            "discover_steam",
        ]),
    ))
    .expect("Falha ao preparar permissões desktop");
}
