use crate::folder_access::{file_identity, open_read_file, DirectoryGuard, FolderAccess, Registry};
use crate::music_discovery::Report;
use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Component, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::http::{Request, Response};

const CHUNK: u64 = 1024 * 1024;
#[derive(Clone)]
struct Location {
    grant: String,
    relative: PathBuf,
    file_id: String,
    mime: &'static str,
}
struct Ticket {
    location: Location,
    touched: Instant,
}
#[derive(Default)]
pub struct MusicStreams {
    locations: Mutex<HashMap<String, HashMap<String, Location>>>,
    tickets: Mutex<HashMap<String, Ticket>>,
    artwork: Mutex<HashMap<String, Option<crate::music_artwork::Image>>>,
}
impl MusicStreams {
    // Only the Rust discovery result may populate this lookup. IPC never supplies paths.
    pub fn discovered(&self, grant: &str, report: &Report) {
        self.artwork.lock().unwrap().clear();
        let mut all = self.locations.lock().unwrap();
        let rows = all.entry(grant.into()).or_default();
        if report.state == "complete" {
            rows.clear();
        }
        for track in &report.tracks {
            let Some(id) = &track.file_id else { continue };
            if track.state == "invalid-or-limited" {
                continue;
            }
            let relative = PathBuf::from(&track.relative_path);
            if relative.as_os_str().is_empty()
                || !relative
                    .components()
                    .all(|c| matches!(c, Component::Normal(_)))
            {
                continue;
            }
            let mime = match track.format.as_str() {
                "MP3" => "audio/mpeg",
                "FLAC" => "audio/flac",
                _ => continue,
            };
            rows.insert(
                id.clone(),
                Location {
                    grant: grant.into(),
                    relative,
                    file_id: id.clone(),
                    mime,
                },
            );
        }
    }
    pub fn revoke(&self, grant: &str) {
        self.artwork.lock().unwrap().clear();
        self.locations.lock().unwrap().remove(grant);
        self.tickets
            .lock()
            .unwrap()
            .retain(|_, ticket| ticket.location.grant != grant);
    }
    pub fn open(&self, access: &FolderAccess, file_id: &str) -> Result<String, String> {
        let candidates: Vec<_> = self
            .locations
            .lock()
            .unwrap()
            .values()
            .filter_map(|rows| rows.get(file_id).cloned())
            .collect();
        for location in candidates {
            if open_location(access, &location).is_err() {
                continue;
            }
            let mut tickets = self.tickets.lock().unwrap();
            tickets.retain(|_, ticket| ticket.touched.elapsed() < Duration::from_secs(120));
            if tickets.len() >= 32 {
                return Err("Muitas sessões de áudio abertas".into());
            }
            let token = uuid::Uuid::new_v4().to_string();
            tickets.insert(
                token.clone(),
                Ticket {
                    location,
                    touched: Instant::now(),
                },
            );
            return Ok(token);
        }
        Err("Arquivo ausente ou acesso revogado; atualize a descoberta".into())
    }
    fn cover(&self, access: &FolderAccess, id: &str, head: bool) -> Response<Vec<u8>> {
        let candidates: Vec<_> = self
            .locations
            .lock()
            .unwrap()
            .values()
            .filter_map(|rows| rows.get(id).cloned())
            .collect();
        for location in candidates {
            let Ok((file, _root, _parent)) = open_location(access, &location) else {
                continue;
            };
            let registry = match Registry::load(&access.file) {
                Ok(value) => value,
                Err(_) => continue,
            };
            let Ok(grant) = registry.get(&location.grant, Some("music")) else {
                continue;
            };
            let path = grant.path.join(&location.relative);
            let mut cache = self.artwork.lock().unwrap();
            if !cache.contains_key(id) {
                // Bounded to 128 entries / 32 MiB, including negative entries. Refresh invalidates.
                while cache.len() >= 128
                    || cache
                        .values()
                        .flatten()
                        .map(|(_, bytes)| bytes.len())
                        .sum::<usize>()
                        > 30 * 1024 * 1024
                {
                    let key = cache.keys().next().unwrap().clone();
                    cache.remove(&key);
                }
                cache.insert(
                    id.into(),
                    crate::music_artwork::extract(file, path.parent().unwrap()),
                );
            }
            if let Some(Some((mime, bytes))) = cache.get(id) {
                let mut result = response(200, if head { Vec::new() } else { bytes.clone() });
                result
                    .headers_mut()
                    .insert("Content-Type", mime.parse().unwrap());
                result
                    .headers_mut()
                    .insert("X-Content-Type-Options", "nosniff".parse().unwrap());
                return result;
            }
            return response(404, Vec::new());
        }
        response(403, Vec::new())
    }
    fn location(&self, token: &str) -> Result<Location, String> {
        let mut tickets = self.tickets.lock().unwrap();
        let ticket = tickets.get_mut(token).ok_or("Sessão de áudio inválida")?;
        if ticket.touched.elapsed() >= Duration::from_secs(120) {
            return Err("Sessão expirada".into());
        }
        ticket.touched = Instant::now();
        Ok(ticket.location.clone())
    }
    pub fn check(&self, access: &FolderAccess, token: &str) -> Result<(), String> {
        open_location(access, &self.location(token)?)?;
        Ok(())
    }
    pub fn close(&self, token: &str) {
        self.tickets.lock().unwrap().remove(token);
    }
    pub fn respond(&self, access: &FolderAccess, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
        let denied = || response(403, Vec::new());
        if !matches!(request.method().as_str(), "GET" | "HEAD") {
            return response(405, Vec::new());
        }
        if request.uri().query().is_some() {
            return denied();
        }
        if let Some(origin) = request.headers().get("origin") {
            if origin != "http://tauri.localhost" {
                return denied();
            }
        }
        if let Some(key) = request.uri().path().strip_prefix("/artwork-") {
            let parts: Vec<_> = key.split('-').collect();
            if parts.len() != 4
                || parts
                    .iter()
                    .any(|part| part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()))
            {
                return denied();
            }
            let id = parts[..3].join(":");
            return self.cover(access, &id, request.method().as_str() == "HEAD");
        }
        let token = request.uri().path().trim_start_matches('/');
        if uuid::Uuid::parse_str(token).is_err() {
            return denied();
        }
        let Ok(location) = self.location(token) else {
            return denied();
        };
        let Ok((mut file, _root, _parent)) = open_location(access, &location) else {
            return denied();
        };
        let Ok(info) = file.metadata() else {
            return denied();
        };
        let size = info.len();
        let range = request.headers().get("range").and_then(|v| v.to_str().ok());
        let Ok((start, end)) = byte_range(range, size) else {
            return Response::builder()
                .status(416)
                .header("Content-Range", format!("bytes */{size}"))
                .header("Access-Control-Allow-Origin", "http://tauri.localhost")
                .body(Vec::new())
                .unwrap();
        };
        let mut body = Vec::new();
        if request.method() != "HEAD" {
            if file.seek(SeekFrom::Start(start)).is_err()
                || file.take(end - start + 1).read_to_end(&mut body).is_err()
                || body.len() as u64 != end - start + 1
            {
                return denied();
            }
        }
        Response::builder()
            .status(206)
            .header("Content-Type", location.mime)
            .header("Accept-Ranges", "bytes")
            .header("Content-Range", format!("bytes {start}-{end}/{size}"))
            .header("Content-Length", end - start + 1)
            .header("Cache-Control", "no-store")
            .header("Access-Control-Allow-Origin", "http://tauri.localhost")
            .header(
                "Access-Control-Expose-Headers",
                "Content-Range, Accept-Ranges, Content-Length",
            )
            .body(body)
            .unwrap()
    }
}
fn response(status: u16, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Cache-Control", "no-store")
        .header("Access-Control-Allow-Origin", "http://tauri.localhost")
        .body(body)
        .unwrap()
}
// Caller serializes registry access with FolderAccess.lock + disk_lock throughout the read.
fn open_location(
    access: &FolderAccess,
    location: &Location,
) -> Result<(File, DirectoryGuard, DirectoryGuard), String> {
    let registry = Registry::load(&access.file)?;
    let grant = registry.get(&location.grant, Some("music"))?;
    let root = grant.open()?;
    if !location
        .relative
        .components()
        .all(|c| matches!(c, Component::Normal(_)))
    {
        return Err("Referência inválida".into());
    }
    let path = grant.path.join(&location.relative);
    let parent = DirectoryGuard::open(path.parent().ok_or("Arquivo sem diretório")?)?;
    let file = open_read_file(&path)?;
    if file_identity(&file)? != location.file_id {
        return Err("O arquivo foi substituído".into());
    }
    Ok((file, root, parent))
}
fn byte_range(range: Option<&str>, size: u64) -> Result<(u64, u64), ()> {
    if size == 0 {
        return Err(());
    }
    let (start, end) = if let Some(value) = range {
        let value = value.strip_prefix("bytes=").ok_or(())?;
        if value.contains(',') {
            return Err(());
        }
        let (a, b) = value.split_once('-').ok_or(())?;
        if a.is_empty() {
            let suffix = b.parse::<u64>().map_err(|_| ())?;
            if suffix == 0 {
                return Err(());
            }
            (size.saturating_sub(suffix), size - 1)
        } else {
            (
                a.parse::<u64>().map_err(|_| ())?,
                if b.is_empty() {
                    size - 1
                } else {
                    b.parse::<u64>().map_err(|_| ())?.min(size - 1)
                },
            )
        }
    } else {
        (0, size - 1)
    };
    if start >= size || end < start {
        return Err(());
    }
    Ok((start, end.min(start.saturating_add(CHUNK - 1))))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    // Native WebView2 harness only. This is not compiled into the application.
    #[test]
    #[ignore]
    fn seed_webview_playback_fixture() {
        let root = PathBuf::from(std::env::var("MYSPACE_PLAYBACK_FIXTURE").expect("fixture root"));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("myspace-playback-"));
        let profile = std::env::var("MYSPACE_PLAYBACK_PROFILE").expect("isolated profile");
        assert!(profile.starts_with("local.myspace.desktop.playback-test-"));
        assert!(profile
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-'));
        let destination = PathBuf::from(std::env::var("LOCALAPPDATA").unwrap()).join(profile);
        assert!(!destination.exists(), "never overwrite an existing profile");
        assert!(root.join("music/01.mp3").is_file());
        assert!(root.join("music/02.flac").is_file());
        fs::create_dir(&destination).unwrap();
        let path = destination.join("authorized-folders-v1.json");
        let mut registry = Registry::load(&path).unwrap();
        registry.authorize("music", &[root.join("music")]).unwrap();
        registry.save(&path).unwrap();
    }
    #[test]
    fn ranges_are_bounded_and_invalid_ranges_fail() {
        assert_eq!(byte_range(None, 3 * CHUNK), Ok((0, CHUNK - 1)));
        assert_eq!(
            byte_range(Some("bytes=42-"), 3 * CHUNK),
            Ok((42, 42 + CHUNK - 1))
        );
        assert_eq!(byte_range(Some("bytes=-10"), 100), Ok((90, 99)));
        assert_eq!(byte_range(Some("bytes=8-1000"), 10), Ok((8, 9)));
        for range in [
            "bytes=100-",
            "bytes=4-2",
            "bytes=0-1,4-5",
            "bytes=-0",
            "bytes=../a-",
            "items=0-1",
        ] {
            assert!(byte_range(Some(range), 100).is_err(), "{range}");
        }
        assert!(byte_range(None, 0).is_err());
    }
    #[test]
    fn streaming_revalidates_grants_identity_and_ticket_without_writing_files() {
        let root = std::env::temp_dir().join(format!("myspace-stream-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("music")).unwrap();
        let access = FolderAccess {
            file: root.join("registry.json"),
            lock: Mutex::new(()),
        };
        let path = root.join("music/song.mp3");
        let bytes = vec![42; (CHUNK * 2 + 3) as usize];
        fs::write(&path, &bytes).unwrap();
        let mut registry = Registry::load(&access.file).unwrap();
        registry.authorize("music", &[root.join("music")]).unwrap();
        registry.save(&access.file).unwrap();
        let grant = registry.folders[0].id.clone();
        let id = file_identity(&File::open(&path).unwrap()).unwrap();
        let streams = MusicStreams::default();
        streams
            .locations
            .lock()
            .unwrap()
            .entry(grant.clone())
            .or_default()
            .insert(
                id.clone(),
                Location {
                    grant: grant.clone(),
                    relative: "song.mp3".into(),
                    file_id: id.clone(),
                    mime: "audio/mpeg",
                },
            );
        assert!(streams.open(&access, "C:\\Windows").is_err());
        let cover = root.join("music/cover.jpg");
        let png = crate::music_artwork::png_fixture();
        fs::write(&cover, &png).unwrap();
        let artwork = || {
            Request::builder()
                .uri(format!(
                    "myspace-music://localhost/artwork-{}-1",
                    id.replace(':', "-")
                ))
                .body(Vec::new())
                .unwrap()
        };
        let art = streams.respond(&access, artwork());
        assert_eq!(art.status(), 200);
        assert_eq!(art.body(), &png);
        assert_eq!(art.headers()["Content-Type"], "image/png");
        assert_eq!(fs::read(&cover).unwrap(), png);
        let token = streams.open(&access, &id).unwrap();
        let request = |range: &str| {
            Request::builder()
                .uri(format!("myspace-music://localhost/{token}"))
                .header("Range", range)
                .body(Vec::new())
                .unwrap()
        };
        let response = streams.respond(&access, request("bytes=0-"));
        assert_eq!(response.status(), 206);
        assert_eq!(response.body().len(), CHUNK as usize);
        assert_eq!(
            response.headers()["Content-Range"],
            format!("bytes 0-{}/{}", CHUNK - 1, bytes.len())
        );
        assert_eq!(
            streams.respond(&access, request("bytes=-3")).body(),
            &[42, 42, 42]
        );
        assert_eq!(
            streams
                .respond(&access, request("bytes=99999999-"))
                .status(),
            416
        );
        let mut foreign = request("bytes=0-4");
        foreign
            .headers_mut()
            .insert("Origin", "https://evil.invalid".parse().unwrap());
        assert_eq!(streams.respond(&access, foreign).status(), 403);
        assert_eq!(fs::read(&path).unwrap(), bytes);
        let moved = root.join("music/original.mp3");
        fs::rename(&path, &moved).unwrap();
        assert!(streams.check(&access, &token).is_err(), "missing file");
        fs::write(&path, b"replacement").unwrap();
        assert!(
            streams.check(&access, &token).is_err(),
            "different file identity"
        );
        fs::remove_file(&path).unwrap();
        fs::rename(&moved, &path).unwrap();
        assert!(streams.check(&access, &token).is_ok());
        // A different process removing the persisted grant must invalidate buffered sessions too.
        registry.revoke(&grant).unwrap();
        registry.save(&access.file).unwrap();
        assert!(streams.check(&access, &token).is_err());
        assert_eq!(
            streams.respond(&access, artwork()).status(),
            403,
            "cached artwork cannot bypass revocation"
        );
        assert_eq!(streams.respond(&access, request("bytes=0-4")).status(), 403);
        registry.authorize("music", &[root.join("music")]).unwrap();
        registry.save(&access.file).unwrap();
        assert!(
            streams.open(&access, &id).is_err(),
            "new grant cannot revive old discovery"
        );
        streams.close(&token);
        assert!(streams.location(&token).is_err());
        fs::remove_dir_all(&root).unwrap();
    }
}
