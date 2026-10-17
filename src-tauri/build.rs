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
            "open_external_url",
            "media_download_settings",
            "choose_ytdlp",
            "choose_ffmpeg",
            "save_media_download_settings",
            "download_music_offline",
            "media_download_progress",
            "cancel_media_download",
        ]),
    ))
    .expect("Falha ao preparar permissões desktop");
}
