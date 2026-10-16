//! Read-only, bounded Steam librarycache lookup. No registry/path supplied by JavaScript.
use crate::{
    folder_access::{open_read_file, DirectoryGuard, FolderAccess, Registry},
    game_launch::GameLaunch,
    music_artwork::{validate, Image},
};
use std::{
    collections::HashMap,
    io::Read,
    path::Path,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::http::{Request, Response};
#[derive(Default)]
pub struct SteamArtwork {
    cache: Mutex<HashMap<String, (Instant, Option<Image>)>>,
}
impl SteamArtwork {
    pub fn clear(&self) {
        self.cache.lock().unwrap().clear();
    }
    pub fn respond(
        &self,
        access: &FolderAccess,
        games: &GameLaunch,
        request: Request<Vec<u8>>,
    ) -> Response<Vec<u8>> {
        let reply = |status, image: Option<Image>| {
            let (mime, bytes) = image.unwrap_or(("application/octet-stream".into(), Vec::new()));
            Response::builder()
                .status(status)
                .header("Content-Type", mime)
                .header("X-Content-Type-Options", "nosniff")
                .header("Cache-Control", "no-store")
                .header("Access-Control-Allow-Origin", "http://tauri.localhost")
                .body(if request.method() == "HEAD" {
                    Vec::new()
                } else {
                    bytes
                })
                .unwrap()
        };
        if !matches!(request.method().as_str(), "GET" | "HEAD") {
            return reply(405, None);
        }
        if request.uri().query().is_some()
            || request
                .headers()
                .get("origin")
                .is_some_and(|o| o != "http://tauri.localhost")
        {
            return reply(403, None);
        }
        let Some(key) = request.uri().path().strip_prefix("/steam-art-") else {
            return reply(403, None);
        };
        let parts: Vec<_> = key.split('-').collect();
        if parts.len() < 2
            || parts.len() > 3
            || (parts.len() == 3 && !matches!(parts[2], "background" | "vertical"))
        {
            return reply(403, None);
        }
        let (id, revision) = (parts[0], parts[1]);
        let kind = parts.get(2).copied().unwrap_or("cover");
        if revision.is_empty()
            || !revision.bytes().all(|b| b.is_ascii_digit())
            || !games.artwork_allowed(access, id)
        {
            return reply(403, None);
        }
        let Ok(registry) = Registry::load(&access.file) else {
            return reply(403, None);
        };
        let deadline = Instant::now() + Duration::from_secs(2);
        for grant in registry
            .folders
            .iter()
            .filter(|g| matches!(g.category.as_str(), "games" | "steam-artwork"))
            .take(128)
        {
            let Ok(_root) = grant.open() else { continue };
            let directory = if grant.category == "steam-artwork" {
                grant.path.clone()
            } else {
                grant.path.join("appcache/librarycache")
            };
            let Ok(_cache_root) = DirectoryGuard::open(&directory) else {
                continue;
            };
            let cache_key = format!("{}:{id}:{revision}:{kind}", grant.id);
            let mut cache = self.cache.lock().unwrap();
            if cache
                .get(&cache_key)
                .is_some_and(|(time, _)| time.elapsed() > Duration::from_secs(30))
            {
                cache.remove(&cache_key);
            }
            if !cache.contains_key(&cache_key) {
                if cache.len() >= 16 {
                    let key = cache.keys().next().unwrap().clone();
                    cache.remove(&key);
                }
                cache.insert(
                    cache_key.clone(),
                    (Instant::now(), lookup(&directory, id, deadline, kind)),
                );
            }
            if let Some((_, Some(image))) = cache.get(&cache_key) {
                return reply(200, Some(image.clone()));
            }
            if Instant::now() >= deadline {
                break;
            }
        }
        reply(404, None)
    }
}
fn read(directory: &Path, name: &str, budget: &mut usize) -> Option<Image> {
    let _guard = DirectoryGuard::open(directory).ok()?;
    let file = open_read_file(&directory.join(name)).ok()?;
    let size = file.metadata().ok()?.len();
    if size == 0 || size > 2 * 1024 * 1024 || size > *budget as u64 {
        return None;
    }
    let mut bytes = Vec::new();
    file.take(size + 1).read_to_end(&mut bytes).ok()?;
    *budget = budget.saturating_sub(bytes.len());
    validate(bytes)
}
fn lookup(root: &Path, id: &str, deadline: Instant, kind: &str) -> Option<Image> {
    // Prefer landscape artwork for the existing XMB pill, then portrait. Never guess opaque images.
    let names: &[&str] = if kind == "background" {
        &[
            "library_hero.jpg",
            "library_hero.png",
            "library_header.jpg",
            "header.jpg",
            "library_header.png",
            "header.png",
        ]
    } else if kind == "vertical" {
        &["library_600x900.jpg", "library_600x900.png"]
    } else {
        &[
            "library_header.jpg",
            "header.jpg",
            "library_header.png",
            "header.png",
            "library_600x900.jpg",
            "library_capsule.jpg",
            "library_600x900.png",
            "library_capsule.png",
        ]
    };
    let mut budget = 8 * 1024 * 1024;
    let app = root.join(id);
    let mut directories = vec![app.clone()];
    if let Ok(_app) = DirectoryGuard::open(&app) {
        if let Ok(entries) = std::fs::read_dir(&app) {
            let mut hashes = entries
                .take(128)
                .filter_map(Result::ok)
                .filter_map(|entry| {
                    let name = entry.file_name().to_string_lossy().into_owned();
                    ((8..=64).contains(&name.len()) && name.bytes().all(|c| c.is_ascii_hexdigit()))
                        .then_some(entry.path())
                })
                .collect::<Vec<_>>();
            hashes.sort();
            directories.extend(hashes.into_iter().take(32));
        }
    }
    for name in names {
        if Instant::now() >= deadline || budget == 0 {
            return None;
        }
        if let Some(image) = read(root, &format!("{id}_{name}"), &mut budget) {
            return Some(image);
        }
        for directory in &directories {
            if Instant::now() >= deadline || budget == 0 {
                return None;
            }
            if let Some(image) = read(directory, name, &mut budget) {
                return Some(image);
            }
        }
    }
    None
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::steam_discovery::{Entry, Report};
    use std::fs;
    fn fixture() -> (std::path::PathBuf, FolderAccess, GameLaunch, String, String) {
        let root = std::env::temp_dir().join(format!("myspace-steam-art-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("games")).unwrap();
        fs::create_dir_all(root.join("cache")).unwrap();
        let access = FolderAccess {
            file: root.join("registry.json"),
            lock: Mutex::new(()),
        };
        let mut registry = Registry::load(&access.file).unwrap();
        registry.authorize("games", &[root.join("games")]).unwrap();
        registry
            .authorize("steam-artwork", &[root.join("cache")])
            .unwrap();
        registry.save(&access.file).unwrap();
        let game = registry.folders[0].id.clone();
        let cache = registry.folders[1].id.clone();
        let games = GameLaunch::default();
        let mut report = Report::new("fixture", "complete");
        report.games.push(Entry {
            appid: "42".into(),
            name: "Fixture".into(),
            install_dir: String::new(),
            manifest: String::new(),
            state: "present".into(),
        });
        games.discovered(&game, &report);
        (root, access, games, game, cache)
    }
    fn request(key: &str) -> Request<Vec<u8>> {
        Request::builder()
            .uri(format!("myspace-music://localhost/steam-art-{key}-1"))
            .body(Vec::new())
            .unwrap()
    }
    #[test]
    fn cache_requires_separate_persisted_authorization_and_rechecks_revocation() {
        let (root, access, games, game, grant) = fixture();
        let art = SteamArtwork::default();
        let png = crate::music_artwork::png_fixture();
        fs::write(root.join("cache/42_library_header.jpg"), &png).unwrap();
        assert_eq!(art.respond(&access, &games, request("999")).status(), 403);
        assert_eq!(art.respond(&access, &games, request("0")).status(), 403);
        let result = art.respond(&access, &games, request("42"));
        assert_eq!(result.status(), 200);
        assert_eq!(result.body(), &png);
        assert_eq!(result.headers()["Content-Type"], "image/png");
        let mut foreign = request("42");
        foreign
            .headers_mut()
            .insert("Origin", "https://evil.invalid".parse().unwrap());
        assert_eq!(art.respond(&access, &games, foreign).status(), 403);
        let mut registry = Registry::load(&access.file).unwrap();
        registry.revoke(&grant).unwrap();
        registry.save(&access.file).unwrap();
        assert_eq!(
            art.respond(&access, &games, request("42")).status(),
            404,
            "no cache hit after revoke"
        );
        assert_eq!(
            fs::read(root.join("cache/42_library_header.jpg")).unwrap(),
            png
        );
        registry
            .authorize("steam-artwork", &[root.join("cache")])
            .unwrap();
        registry.save(&access.file).unwrap();
        assert_eq!(art.respond(&access, &games, request("42")).status(), 200);
        registry.revoke(&game).unwrap();
        registry.save(&access.file).unwrap();
        assert_eq!(
            art.respond(&access, &games, request("42")).status(),
            403,
            "cached images require discovered game authorization too"
        );
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn legacy_direct_hash_layouts_invalid_missing_and_refresh() {
        let (root, access, games, _, _) = fixture();
        let cache = root.join("cache");
        let png = crate::music_artwork::png_fixture();
        fs::create_dir_all(cache.join("42/abcdef0123456789")).unwrap();
        let image = cache.join("42/abcdef0123456789/library_600x900.jpg");
        fs::write(&image, &png).unwrap();
        let art = SteamArtwork::default();
        assert_eq!(art.respond(&access, &games, request("42")).body(), &png);
        fs::remove_file(&image).unwrap();
        art.clear();
        assert_eq!(art.respond(&access, &games, request("42")).status(), 404);
        fs::write(cache.join("42/library_header.png"), &png).unwrap();
        art.clear();
        assert_eq!(art.respond(&access, &games, request("42")).status(), 200);
        fs::write(cache.join("42/library_header.png"), b"invalid image").unwrap();
        art.clear();
        assert_eq!(art.respond(&access, &games, request("42")).status(), 404);
        fs::write(cache.join("42_header.jpg"), &png).unwrap();
        art.clear();
        assert_eq!(art.respond(&access, &games, request("42")).status(), 200);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn wallpaper_prefers_hero_and_vertical_never_uses_header() {
        let (root, access, games, _, _) = fixture();
        let cache = root.join("cache");
        let png = crate::music_artwork::png_fixture();
        std::fs::write(cache.join("42_library_600x900.jpg"), &png).unwrap();
        std::fs::write(cache.join("42_library_hero.jpg"), &png).unwrap();
        let artwork = SteamArtwork::default();
        let wallpaper = || {
            Request::builder()
                .uri("myspace-music://localhost/steam-art-42-1-background")
                .body(Vec::new())
                .unwrap()
        };
        assert_eq!(
            artwork.respond(&access, &games, request("42")).status(),
            200
        );
        assert_eq!(artwork.respond(&access, &games, wallpaper()).status(), 200);
        std::fs::remove_file(cache.join("42_library_hero.jpg")).unwrap();
        artwork.clear();
        assert_eq!(artwork.respond(&access, &games, wallpaper()).status(), 404);
        std::fs::write(cache.join("42_header.jpg"), &png).unwrap();
        artwork.clear();
        assert_eq!(artwork.respond(&access, &games, wallpaper()).body(), &png);
        let vertical = || {
            Request::builder()
                .uri("myspace-music://localhost/steam-art-42-1-vertical")
                .body(Vec::new())
                .unwrap()
        };
        assert_eq!(artwork.respond(&access, &games, vertical()).status(), 200);
        std::fs::remove_file(cache.join("42_library_600x900.jpg")).unwrap();
        artwork.clear();
        assert_eq!(artwork.respond(&access, &games, vertical()).status(), 404);
        let mut registry = Registry::load(&access.file).unwrap();
        let id = registry
            .folders
            .iter()
            .find(|g| g.category == "steam-artwork")
            .unwrap()
            .id
            .clone();
        registry.revoke(&id).unwrap();
        registry.save(&access.file).unwrap();
        assert_eq!(artwork.respond(&access, &games, wallpaper()).status(), 404);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn junctions_never_escape_the_authorized_cache() {
        let (root, access, games, _, _) = fixture();
        fs::create_dir_all(root.join("outside")).unwrap();
        fs::write(
            root.join("outside/library_header.jpg"),
            crate::music_artwork::png_fixture(),
        )
        .unwrap();
        let link = root.join("cache").join("42");
        let status = std::process::Command::new("cmd")
            .args(["/c", "mklink", "/J"])
            .arg(&link)
            .arg(root.join("outside"))
            .output()
            .unwrap();
        assert!(
            status.status.success(),
            "junction fixture creation: {} {}",
            String::from_utf8_lossy(&status.stdout),
            String::from_utf8_lossy(&status.stderr)
        );
        assert_eq!(
            SteamArtwork::default()
                .respond(&access, &games, request("42"))
                .status(),
            404
        );
        fs::remove_dir(&link).unwrap();
        fs::remove_dir_all(root).unwrap();
    }
}
