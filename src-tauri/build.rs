fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "authorize_folders",
            "list_folders",
            "revoke_folder",
            "discover_steam",
            "discover_music",
            "open_music",
            "check_music",
            "close_music",
            "launch_steam",
            "lastfm_configured",
            "save_lastfm_key",
            "request_lastfm",
            "translate_desktop_summary",
        ]),
    ))
    .expect("Falha ao preparar permissões desktop");
}
