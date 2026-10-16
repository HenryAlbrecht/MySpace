use crate::{
    folder_access::{FolderAccess, Registry},
    steam_discovery::{self, Report},
};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Default)]
pub struct GameLaunch {
    origins: Mutex<HashMap<String, HashSet<String>>>,
    last: Mutex<Option<Instant>>,
}
#[derive(Debug, Serialize)]
pub struct LaunchResult {
    pub state: &'static str,
    pub simulated: bool,
}
impl GameLaunch {
    pub fn discovered(&self, grant: &str, report: &Report) {
        if !matches!(report.state.as_str(), "complete" | "limited") {
            return;
        }
        let mut origins = self.origins.lock().unwrap();
        let rows = origins.entry(grant.into()).or_default();
        if report.state == "complete" && report.errors.is_empty() {
            rows.clear();
        }
        for game in &report.games {
            if steam_discovery::app_id(&game.appid).is_ok() {
                rows.insert(game.appid.clone());
            }
        }
    }
    pub fn revoke(&self, grant: &str) {
        self.origins.lock().unwrap().remove(grant);
    }

    // The command holds the registry mutex + disk lock until delegation returns.
    pub fn launch(
        &self,
        access: &FolderAccess,
        appid: &str,
        dispatch: impl FnOnce(&str) -> Result<(), String>,
    ) -> Result<LaunchResult, String> {
        let id = steam_discovery::app_id(appid)?;
        let candidates: Vec<String> = self
            .origins
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, rows)| rows.contains(appid))
            .map(|(grant, _)| grant.clone())
            .collect();
        if candidates.is_empty() {
            return Err(
                "Jogo não descoberto em uma biblioteca Steam autorizada. Atualize a descoberta."
                    .into(),
            );
        }
        let registry = Registry::load(&access.file)?;
        for grant_id in candidates {
            let Ok(grant) = registry.get(&grant_id, Some("games")) else {
                continue;
            };
            let Ok(_root) = grant.open() else { continue };
            let Ok(_installation) = steam_discovery::validate_launch(&grant.path, appid) else {
                continue;
            };
            let mut last = self.last.lock().map_err(|_| "Inicialização indisponível")?;
            if last.is_some_and(|time| time.elapsed() < Duration::from_secs(2)) {
                return Err("Aguarde antes de enviar outro pedido ao Steam.".into());
            }
            // Construct the only permitted URI from the validated numeric ID, with no arguments.
            dispatch(&format!("steam://rungameid/{id}"))?;
            *last = Some(Instant::now());
            return Ok(LaunchResult {
                state: "delegated",
                simulated: cfg!(feature = "game-launch-test"),
            });
        }
        Err("Jogo removido, biblioteca indisponível ou autorização revogada. Atualize a descoberta.".into())
    }
}

// This adapter has no OS launch code in the native test binary. Never enabled by default.
#[cfg(feature = "game-launch-test")]
pub fn dispatch(_uri: &str) -> Result<(), String> {
    match std::env::var("MYSPACE_STEAM_TEST_RESULT").as_deref() {
        Ok("success") => Ok(()),
        Ok("unavailable") => {
            Err("Steam indisponível: protocolo steam:// não registrado ou cliente ausente.".into())
        }
        _ => Err("Falha simulada ao enviar o pedido ao Steam.".into()),
    }
}

#[cfg(all(windows, not(feature = "game-launch-test")))]
pub fn dispatch(uri: &str) -> Result<(), String> {
    use windows_sys::Win32::{
        System::Com::{
            CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
        },
        UI::{
            Shell::{ShellExecuteExW, SEE_MASK_FLAG_NO_UI, SEE_MASK_NOASYNC, SHELLEXECUTEINFOW},
            WindowsAndMessaging::SW_SHOWNORMAL,
        },
    };
    let initialized = unsafe {
        CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        )
    };
    if initialized < 0 {
        return Err("Não foi possível preparar a integração do Steam com o Windows.".into());
    }
    let verb: Vec<u16> = "open\0".encode_utf16().collect();
    let target: Vec<u16> = format!("{uri}\0").encode_utf16().collect();
    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_FLAG_NO_UI | SEE_MASK_NOASYNC;
    info.lpVerb = verb.as_ptr();
    info.lpFile = target.as_ptr();
    info.nShow = SW_SHOWNORMAL;
    let ok = unsafe { ShellExecuteExW(&mut info) } != 0;
    let error = std::io::Error::last_os_error();
    unsafe { CoUninitialize() };
    if ok {
        return Ok(());
    }
    match error.raw_os_error() {
        Some(2 | 3 | 1155) => {
            Err("Steam indisponível: protocolo steam:// não registrado ou cliente ausente.".into())
        }
        _ => Err(format!(
            "O Windows não conseguiu enviar o pedido ao Steam: {error}"
        )),
    }
}
#[cfg(all(not(windows), not(feature = "game-launch-test")))]
pub fn dispatch(_uri: &str) -> Result<(), String> {
    Err("Inicialização Steam disponível somente no Windows.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};
    struct Fixture {
        root: PathBuf,
        access: FolderAccess,
        grant: String,
    }
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("myspace-game-launch-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("games/steamapps/common/Game")).unwrap();
            fs::write(
                root.join("games/steamapps/appmanifest_42.acf"),
                manifest("42", "Game"),
            )
            .unwrap();
            let access = FolderAccess {
                file: root.join("registry.json"),
                lock: Mutex::new(()),
            };
            let mut registry = Registry::load(&access.file).unwrap();
            registry.authorize("games", &[root.join("games")]).unwrap();
            registry.save(&access.file).unwrap();
            let grant = registry.folders[0].id.clone();
            Self {
                root,
                access,
                grant,
            }
        }
        fn index(&self) -> GameLaunch {
            let launch = GameLaunch::default();
            launch.discovered(
                &self.grant,
                &steam_discovery::discover(&self.root.join("games")),
            );
            launch
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.root.parent(), Some(std::env::temp_dir().as_path()));
            let _ = fs::remove_dir_all(&self.root);
        }
    }
    fn manifest(appid: &str, dir: &str) -> String {
        format!("\"AppState\" {{ \"appid\" \"{appid}\" \"name\" \"Fixture Steam\" \"installdir\" \"{dir}\" }}")
    }
    fn forbidden(_: &str) -> Result<(), String> {
        panic!("OS dispatch must never occur")
    }

    #[test]
    fn validates_before_dispatch_and_only_constructs_numeric_steam_uri() {
        let fixture = Fixture::new();
        let launch = fixture.index();
        for id in [
            "",
            "0",
            "01",
            "-1",
            "4294967296",
            "../42",
            "42/args",
            "steam://rungameid/42",
            "42 --x",
        ] {
            assert!(launch.launch(&fixture.access, id, forbidden).is_err());
        }
        assert!(launch.launch(&fixture.access, "43", forbidden).is_err());
        let before = fs::read(fixture.root.join("games/steamapps/appmanifest_42.acf")).unwrap();
        let result = launch
            .launch(&fixture.access, "42", |uri| {
                assert_eq!(uri, "steam://rungameid/42");
                assert!(
                    fs::rename(
                        fixture.root.join("games/steamapps/common/Game"),
                        fixture.root.join("games/steamapps/common/Moved")
                    )
                    .is_err(),
                    "installation guard held through handoff"
                );
                Ok(())
            })
            .unwrap();
        assert_eq!(result.state, "delegated");
        assert!(launch
            .launch(&fixture.access, "42", forbidden)
            .unwrap_err()
            .contains("Aguarde"));
        *launch.last.lock().unwrap() = None;
        assert!(launch
            .launch(&fixture.access, "42", |_| Err("Steam indisponível".into()))
            .unwrap_err()
            .contains("Steam indisponível"));
        assert_eq!(
            fs::read(fixture.root.join("games/steamapps/appmanifest_42.acf")).unwrap(),
            before
        );
    }
    #[test]
    fn stale_discovery_does_not_authorize_removed_changed_or_revoked_games() {
        let fixture = Fixture::new();
        let launch = fixture.index();
        let file = fixture.root.join("games/steamapps/appmanifest_42.acf");
        for text in [
            manifest("43", "Game"),
            manifest("42", "../escape"),
            "malformed".into(),
        ] {
            fs::write(&file, text).unwrap();
            assert!(launch.launch(&fixture.access, "42", forbidden).is_err());
        }
        fs::remove_file(&file).unwrap();
        assert!(launch.launch(&fixture.access, "42", forbidden).is_err());
        fs::write(&file, manifest("42", "Game")).unwrap();
        fs::remove_dir(fixture.root.join("games/steamapps/common/Game")).unwrap();
        assert!(launch.launch(&fixture.access, "42", forbidden).is_err());
        fs::create_dir(fixture.root.join("games/steamapps/common/Game")).unwrap();
        let mut registry = Registry::load(&fixture.access.file).unwrap();
        registry.revoke(&fixture.grant).unwrap();
        registry.save(&fixture.access.file).unwrap();
        assert!(launch.launch(&fixture.access, "42", forbidden).is_err());
    }
    #[test]
    fn junction_installation_is_denied_after_successful_discovery() {
        let fixture = Fixture::new();
        let launch = fixture.index();
        let install = fixture.root.join("games/steamapps/common/Game");
        fs::remove_dir(&install).unwrap();
        let outside = fixture.root.join("outside");
        fs::create_dir(&outside).unwrap();
        let output = std::process::Command::new("cmd.exe")
            .args(["/c", "mklink", "/J"])
            .arg(install.to_string_lossy().replace('/', "\\"))
            .arg(outside.to_string_lossy().replace('/', "\\"))
            .output()
            .unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        assert!(launch.launch(&fixture.access, "42", forbidden).is_err());
        fs::remove_dir(&install).unwrap();
    }
    #[test]
    #[ignore]
    fn seed_webview_game_fixture() {
        let root = PathBuf::from(std::env::var("MYSPACE_PLAYBACK_FIXTURE").unwrap());
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("myspace-playback-"));
        let profile = std::env::var("MYSPACE_PLAYBACK_PROFILE").unwrap();
        assert!(profile.starts_with("local.myspace.desktop.playback-test-"));
        assert!(profile
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-'));
        let destination = PathBuf::from(std::env::var("LOCALAPPDATA").unwrap()).join(profile);
        assert!(!destination.exists());
        fs::create_dir(&destination).unwrap();
        fs::create_dir_all(root.join("games/steamapps/common/Game")).unwrap();
        fs::write(
            root.join("games/steamapps/appmanifest_42.acf"),
            manifest("42", "Game"),
        )
        .unwrap();
        let file = destination.join("authorized-folders-v1.json");
        let mut registry = Registry::load(&file).unwrap();
        registry.authorize("games", &[root.join("games")]).unwrap();
        registry.save(&file).unwrap();
    }
}
