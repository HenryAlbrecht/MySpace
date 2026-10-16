use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

// All access decisions belong to this native registry, never frontend storage.
pub struct FolderAccess {
    pub file: PathBuf,
    pub lock: Mutex<()>,
}

impl FolderAccess {
    // File lock also serializes separate application processes using this profile.
    pub fn disk_lock(&self) -> Result<fs::File, String> {
        let parent = self.file.parent().ok_or("Registro sem diretório")?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let lock = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(parent.join("authorized-folders.lock"))
            .map_err(|error| error.to_string())?;
        lock.lock().map_err(|error| error.to_string())?;
        Ok(lock)
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Grant {
    pub id: String,
    pub category: String,
    pub path: PathBuf,
    pub identity: String,
}

#[derive(Serialize, Deserialize)]
pub struct Registry {
    version: u32,
    pub folders: Vec<Grant>,
}

#[derive(Serialize)]
pub struct FolderView {
    id: String,
    category: String,
    path: String,
    state: String,
}

pub fn category(value: &str) -> Result<(), String> {
    if !matches!(value, "music" | "games" | "steam-artwork") {
        return Err("Categoria inválida".into());
    }
    Ok(())
}

// Handles remain open with no write/delete sharing until the caller finishes.
// Refuse every reparse point, including ancestors, instead of following links.
pub struct DirectoryGuard {
    pub path: PathBuf,
    handles: Vec<fs::File>,
}

// Caller must retain a DirectoryGuard for the parent while this file is used.
#[cfg(windows)]
pub fn open_read_file(path: &Path) -> Result<fs::File, String> {
    use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
    use windows_sys::Win32::Storage::FileSystem::*;
    let file = fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(|error| error.to_string())?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err("Arquivo inválido ou reparse point recusado".into());
    }
    Ok(file)
}

#[cfg(not(windows))]
pub fn open_read_file(_path: &Path) -> Result<fs::File, String> {
    Err("Windows necessário".into())
}

#[cfg(windows)]
fn open_component(path: &Path) -> Result<fs::File, String> {
    use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
    use windows_sys::Win32::Storage::FileSystem::*;
    let file = fs::OpenOptions::new()
        .access_mode(FILE_GENERIC_READ)
        .share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(|error| error.to_string())?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if !metadata.is_dir() || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err("Diretório inválido ou reparse point recusado".into());
    }
    Ok(file)
}

#[cfg(not(windows))]
fn open_component(_path: &Path) -> Result<fs::File, String> {
    Err("Autorização de pastas disponível somente no Windows".into())
}

impl DirectoryGuard {
    pub fn open(path: &Path) -> Result<Self, String> {
        if !path.is_absolute() || path.as_os_str().len() > 32767 {
            return Err("Caminho absoluto inválido".into());
        }
        let mut current = PathBuf::new();
        let mut handles = vec![];
        for component in path.components() {
            match component {
                Component::ParentDir | Component::CurDir => return Err("Traversal recusado".into()),
                Component::Normal(name) => {
                    let name = name.to_string_lossy();
                    if name.contains(':')
                        || name.ends_with(['.', ' '])
                        || name.chars().any(char::is_control)
                    {
                        return Err("Componente de caminho inválido".into());
                    }
                    current.push(component);
                    handles.push(open_component(&current)?);
                }
                Component::Prefix(_) | Component::RootDir => current.push(component),
            }
        }
        // Volume roots have no normal component.
        if handles.is_empty() {
            handles.push(open_component(&current)?);
        }
        Ok(Self {
            path: path.to_path_buf(),
            handles,
        })
    }

    #[cfg(windows)]
    pub fn identity(&self) -> Result<String, String> {
        file_identity(self.handles.last().ok_or("Diretório sem handle")?)
    }

    #[cfg(not(windows))]
    pub fn identity(&self) -> Result<String, String> {
        Err("Windows necessário".into())
    }
}

#[cfg(windows)]
pub fn file_identity(file: &fs::File) -> Result<String, String> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) } == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok(format!(
        "{}:{}:{}",
        info.dwVolumeSerialNumber, info.nFileIndexHigh, info.nFileIndexLow
    ))
}

#[cfg(not(windows))]
pub fn file_identity(_file: &fs::File) -> Result<String, String> {
    Err("Windows necessário".into())
}

impl Grant {
    pub fn open(&self) -> Result<DirectoryGuard, String> {
        let guard = DirectoryGuard::open(&self.path)?;
        if guard.identity()? != self.identity {
            return Err("A identidade da pasta mudou; autorize novamente".into());
        }
        Ok(guard)
    }

    pub fn view(&self) -> FolderView {
        FolderView {
            id: self.id.clone(),
            category: self.category.clone(),
            path: self.path.to_string_lossy().into_owned(),
            state: if self.open().is_ok() {
                "available"
            } else {
                "unavailable"
            }
            .into(),
        }
    }
}

impl Registry {
    pub fn load(file: &Path) -> Result<Self, String> {
        let file = match fs::File::open(file) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Self {
                    version: 1,
                    folders: vec![],
                })
            }
            Err(error) => return Err(error.to_string()),
        };
        let mut bytes = vec![];
        file.take(1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        if bytes.len() > 1024 * 1024 {
            return Err("Registro excede limite".into());
        }
        let registry: Self = serde_json::from_slice(&bytes)
            .map_err(|error| format!("Registro nativo inválido: {error}"))?;
        if registry.version != 1 || registry.folders.len() > 1000 {
            return Err("Registro nativo incompatível".into());
        }
        let mut ids = std::collections::HashSet::new();
        for grant in &registry.folders {
            category(&grant.category)?;
            if uuid::Uuid::parse_str(&grant.id).is_err()
                || !ids.insert(&grant.id)
                || !grant.path.is_absolute()
                || grant.identity.is_empty()
            {
                return Err("Autorização nativa inválida".into());
            }
        }
        Ok(registry)
    }

    // Called only with paths returned by the Rust dialog, never exposed as IPC.
    pub fn authorize(
        &mut self,
        category_name: &str,
        selected: &[PathBuf],
    ) -> Result<usize, String> {
        category(category_name)?;
        let mut next = self.folders.clone();
        let mut added = 0;
        for path in selected {
            let guard = DirectoryGuard::open(path)?;
            let identity = guard.identity()?;
            let canonical = path.canonicalize().map_err(|error| error.to_string())?;
            if next
                .iter()
                .any(|grant| grant.category == category_name && grant.identity == identity)
            {
                continue;
            }
            // Explicit reselection replaces a stale grant at the same path with a new ID.
            next.retain(|grant| !(grant.category == category_name && grant.path == canonical));
            next.push(Grant {
                id: uuid::Uuid::new_v4().to_string(),
                category: category_name.into(),
                path: canonical,
                identity,
            });
            added += 1;
        }
        if next.len() > 1000 {
            return Err("Limite de 1000 autorizações".into());
        }
        self.folders = next;
        Ok(added)
    }

    pub fn get(&self, id: &str, category_name: Option<&str>) -> Result<&Grant, String> {
        self.folders
            .iter()
            .find(|grant| {
                grant.id == id && category_name.is_none_or(|value| grant.category == value)
            })
            .ok_or_else(|| "Autorização inexistente ou revogada".into())
    }

    pub fn revoke(&mut self, id: &str) -> Result<(), String> {
        self.get(id, None)?;
        self.folders.retain(|grant| grant.id != id);
        Ok(())
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        let parent = path.parent().ok_or("Registro sem diretório")?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let temporary = parent.join(format!("folders-{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .map_err(|error| error.to_string())?;
            file.write_all(&serde_json::to_vec(self).map_err(|error| error.to_string())?)
                .map_err(|error| error.to_string())?;
            file.sync_all().map_err(|error| error.to_string())?;
            drop(file);
            #[cfg(windows)]
            {
                use std::os::windows::ffi::OsStrExt;
                use windows_sys::Win32::Storage::FileSystem::{
                    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
                };
                let from: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
                let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
                if unsafe {
                    MoveFileExW(
                        from.as_ptr(),
                        to.as_ptr(),
                        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
                    )
                } == 0
                {
                    return Err(std::io::Error::last_os_error().to_string());
                }
            }
            #[cfg(not(windows))]
            fs::rename(&temporary, path).map_err(|error| error.to_string())?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temporary);
        }
        result
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("myspace-grants-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(path.join("library/steamapps/common/Game")).unwrap();
            fs::write(
                path.join("library/steamapps/appmanifest_42.acf"),
                "\"AppState\" { \"appid\" \"42\" \"name\" \"Fixture\" \"installdir\" \"Game\" }",
            )
            .unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn persists_revokes_and_reuses_steam_without_dialog() {
        let fixture = Fixture::new();
        let file = fixture.0.join("config/grants.json");
        let library = fixture.0.join("library");
        let mut registry = Registry::load(&file).unwrap();
        assert_eq!(
            registry
                .authorize("games", &[library.clone(), library.clone()])
                .unwrap(),
            1
        );
        assert_eq!(registry.authorize("music", &[library.clone()]).unwrap(), 1);
        registry.save(&file).unwrap();
        let mut restarted = Registry::load(&file).unwrap();
        let id = restarted.folders[0].id.clone();
        let grant = restarted.get(&id, Some("games")).unwrap();
        let guard = grant.open().unwrap();
        let report = crate::steam_discovery::discover(&grant.path);
        assert_eq!(report.games[0].appid, "42");
        assert_eq!(report.games[0].state, "present");
        drop(guard);
        assert!(restarted.get("C:\\arbitrary", None).is_err());
        assert!(restarted.get("../outside", None).is_err());
        assert!(restarted
            .get(&restarted.folders[1].id, Some("games"))
            .is_err());
        restarted.revoke(&id).unwrap();
        restarted.save(&file).unwrap();
        assert!(Registry::load(&file).unwrap().get(&id, None).is_err());
        assert_eq!(Registry::load(&file).unwrap().folders.len(), 1);
        assert!(library.join("steamapps/appmanifest_42.acf").is_file());
    }

    #[test]
    fn unavailable_and_replaced_directories_do_not_expand_authorization() {
        let fixture = Fixture::new();
        let file = fixture.0.join("config/grants.json");
        let library = fixture.0.join("library");
        let mut registry = Registry::load(&file).unwrap();
        registry.authorize("games", &[library.clone()]).unwrap();
        registry.save(&file).unwrap();
        let guard = registry.folders[0].open().unwrap();
        assert!(fs::rename(&library, fixture.0.join("moved")).is_err());
        drop(guard);
        fs::rename(&library, fixture.0.join("moved")).unwrap();
        let registry = Registry::load(&file).unwrap();
        assert_eq!(registry.folders.len(), 1);
        assert_eq!(registry.folders[0].view().state, "unavailable");
        fs::create_dir(&library).unwrap();
        assert!(registry.folders[0].open().is_err());
        assert!(DirectoryGuard::open(Path::new("relative")).is_err());
        assert!(DirectoryGuard::open(&fixture.0.join("library/../moved")).is_err());
        fs::write(&file, "invalid").unwrap();
        assert!(Registry::load(&file).is_err());
    }

    #[test]
    fn junctions_are_refused_inside_and_at_authorized_roots() {
        let fixture = Fixture::new();
        let library = fixture.0.join("library");
        let outside = fixture.0.join("outside");
        fs::create_dir(&outside).unwrap();
        let link = library.join("steamapps/common/Escape");
        let junction = |link: &Path, target: &Path| {
            let output = std::process::Command::new("cmd.exe")
                .args(["/c", "mklink", "/J"])
                .arg(link.to_string_lossy().replace('/', "\\"))
                .arg(target.to_string_lossy().replace('/', "\\"))
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
        };
        junction(&link, &outside);
        let rejected = DirectoryGuard::open(&link).is_err();
        fs::write(
            library.join("steamapps/appmanifest_43.acf"),
            "\"AppState\" { \"appid\" \"43\" \"name\" \"Escape\" \"installdir\" \"Escape\" }",
        )
        .unwrap();
        let report = crate::steam_discovery::discover(&library);
        let state = report
            .games
            .iter()
            .find(|game| game.appid == "43")
            .unwrap()
            .state
            .clone();
        fs::remove_dir(&link).unwrap();
        assert!(rejected);
        assert_eq!(state, "unavailable-or-outside-scope");
        let root_link = fixture.0.join("root-link");
        junction(&root_link, &outside);
        let rejected = DirectoryGuard::open(&root_link).is_err();
        fs::remove_dir(&root_link).unwrap();
        assert!(rejected);
        assert_eq!(fs::read_dir(&outside).unwrap().count(), 0);
    }
}
