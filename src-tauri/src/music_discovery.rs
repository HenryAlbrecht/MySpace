use crate::folder_access::{open_read_file, DirectoryGuard};
use lofty::{
    config::{apply_global_options, GlobalOptions, ParseOptions},
    file::{AudioFile, FileType, TaggedFileExt},
    prelude::Accessor,
    probe::Probe,
};
use serde::Serialize;
use std::{
    fs,
    io::{self, BufReader, Read, Seek, SeekFrom},
    path::Path,
    time::{Duration, Instant},
};

const MAX_ENTRIES: usize = 20000;
const MAX_TRACKS: usize = 1000;
const MAX_DIRS: usize = 512;
const MAX_DEPTH: usize = 12;
const FILE_BYTES: usize = 1024 * 1024;
const SCAN_BYTES: usize = 64 * 1024 * 1024;
const SCAN_TIME: Duration = Duration::from_secs(15);

#[derive(Debug, Serialize)]
pub struct Track {
    pub file_name: String,
    pub relative_path: String,
    pub format: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_seconds: Option<f64>,
    pub state: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Report {
    pub root: String,
    pub state: String,
    pub tracks: Vec<Track>,
    pub warnings: Vec<String>,
    pub entries: usize,
    pub directories: usize,
    pub bytes_read: usize,
}

impl Report {
    pub fn unavailable(root: &Path, error: String) -> Self {
        Self {
            root: root.to_string_lossy().into_owned(),
            state: "unavailable".into(),
            tracks: vec![],
            warnings: vec![error],
            entries: 0,
            directories: 0,
            bytes_read: 0,
        }
    }
    fn warning(&mut self, text: String) {
        if self.warnings.len() < 100 {
            self.warnings.push(text);
        }
    }
}

// Budget is enforced below BufReader: includes seeks/reads performed by the parser.
struct BudgetReader<'a, R> {
    inner: R,
    remaining: usize,
    scan_remaining: &'a mut usize,
    operations: usize,
    deadline: Instant,
}
impl<R> BudgetReader<'_, R> {
    fn check(&mut self) -> io::Result<()> {
        if Instant::now() >= self.deadline || self.operations == 0 {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Limite de tempo/operações atingido",
            ));
        }
        self.operations -= 1;
        Ok(())
    }
}
impl<R: Read> Read for BudgetReader<'_, R> {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.check()?;
        if bytes.is_empty() {
            return Ok(0);
        }
        let available = bytes.len().min(self.remaining).min(*self.scan_remaining);
        if available == 0 {
            return Err(io::Error::other("Limite de bytes de metadata atingido"));
        }
        let read = self.inner.read(&mut bytes[..available])?;
        self.remaining -= read;
        *self.scan_remaining -= read;
        Ok(read)
    }
}
impl<R: Seek> Seek for BudgetReader<'_, R> {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        self.check()?;
        self.inner.seek(position)
    }
}

fn text(value: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    value
        .map(|value| value.trim().chars().take(512).collect::<String>())
        .filter(|value| !value.is_empty())
}

fn metadata(
    file: fs::File,
    expected: FileType,
    remaining: &mut usize,
    deadline: Instant,
    track: &mut Track,
) -> Result<(), String> {
    apply_global_options(
        GlobalOptions::new()
            .allocation_limit(256 * 1024)
            .preserve_format_specific_items(false)
            .use_custom_resolvers(false),
    );
    let reader = BudgetReader {
        inner: file,
        remaining: FILE_BYTES,
        scan_remaining: remaining,
        operations: 20000,
        deadline,
    };
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let probe = Probe::new(BufReader::new(reader))
            .options(
                ParseOptions::new()
                    .read_cover_art(false)
                    .max_junk_bytes(4096),
            )
            .guess_file_type()
            .map_err(|error| error.to_string())?;
        if probe.file_type() != Some(expected) {
            return Err("Conteúdo não corresponde ao formato MP3/FLAC esperado".into());
        }
        let tagged = probe.read().map_err(|error| error.to_string())?;
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            track.title = text(tag.title());
            track.artist = text(tag.artist());
            track.album = text(tag.album());
        }
        let duration = tagged.properties().duration().as_secs_f64();
        track.duration_seconds = (duration > 0.0 && duration.is_finite()).then_some(duration);
        Ok(())
    }));
    apply_global_options(GlobalOptions::default());
    result.map_err(|_| "Falha do leitor de metadata".to_string())?
}

struct Scan {
    report: Report,
    remaining: usize,
    deadline: Instant,
}
impl Scan {
    fn stop(&mut self) -> bool {
        if self.report.entries >= MAX_ENTRIES
            || self.report.tracks.len() >= MAX_TRACKS
            || self.report.directories >= MAX_DIRS
            || self.remaining == 0
            || Instant::now() >= self.deadline
        {
            if self.report.state != "partial" {
                self.report.warning("Descoberta parcial: limite de entradas, arquivos, diretórios, bytes ou tempo atingido".into());
            }
            self.report.state = "partial".into();
            return true;
        }
        false
    }

    fn walk(&mut self, root: &Path, directory: &Path, depth: usize) {
        if self.stop() {
            return;
        }
        if depth > MAX_DEPTH {
            self.report.state = "partial".into();
            self.report
                .warning(format!("Profundidade máxima: {}", directory.display()));
            return;
        }
        if !directory.starts_with(root) {
            return;
        }
        let _guard = match DirectoryGuard::open(directory) {
            Ok(guard) => guard,
            Err(error) => {
                self.report.state = "partial".into();
                self.report
                    .warning(format!("{}: {error}", directory.display()));
                return;
            }
        };
        self.report.directories += 1;
        let entries = match fs::read_dir(directory) {
            Ok(entries) => entries,
            Err(error) => {
                self.report.state = "partial".into();
                self.report
                    .warning(format!("{}: {error}", directory.display()));
                return;
            }
        };
        for entry in entries {
            if self.stop() {
                break;
            }
            self.report.entries += 1;
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    self.report.warning(error.to_string());
                    continue;
                }
            };
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(error) => {
                    self.report.warning(error.to_string());
                    continue;
                }
            };
            if file_type.is_symlink() {
                self.report.state = "partial".into();
                self.report
                    .warning(format!("Link/junction ignorado: {}", path.display()));
                continue;
            }
            if file_type.is_dir() {
                self.walk(root, &path, depth + 1);
                continue;
            }
            let extension = path
                .extension()
                .and_then(|extension| extension.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            let expected = match extension.as_str() {
                "mp3" => FileType::Mpeg,
                "flac" => FileType::Flac,
                _ => continue,
            };
            let mut track = Track {
                file_name: entry.file_name().to_string_lossy().into_owned(),
                relative_path: path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .into_owned(),
                format: extension.to_uppercase(),
                title: None,
                artist: None,
                album: None,
                duration_seconds: None,
                state: "ready".into(),
                error: None,
            };
            let result = open_read_file(&path).and_then(|file| {
                metadata(
                    file,
                    expected,
                    &mut self.remaining,
                    self.deadline,
                    &mut track,
                )
            });
            match result {
                Ok(())
                    if track.title.is_none()
                        || track.artist.is_none()
                        || track.album.is_none()
                        || track.duration_seconds.is_none() =>
                {
                    track.state = "missing-metadata".into()
                }
                Ok(()) => {}
                Err(error) => {
                    track.state = "invalid-or-limited".into();
                    track.error = Some(error.chars().take(512).collect());
                }
            }
            self.report.tracks.push(track);
        }
    }
}

pub fn discover(root: &Path) -> Report {
    let _root_guard = match DirectoryGuard::open(root) {
        Ok(guard) => guard,
        Err(error) => return Report::unavailable(root, error),
    };
    let mut scan = Scan {
        report: Report {
            root: root.to_string_lossy().into_owned(),
            state: "complete".into(),
            tracks: vec![],
            warnings: vec![],
            entries: 0,
            directories: 0,
            bytes_read: 0,
        },
        remaining: SCAN_BYTES,
        deadline: Instant::now() + SCAN_TIME,
    };
    scan.walk(root, root, 0);
    scan.report.bytes_read = SCAN_BYTES - scan.remaining;
    scan.report
        .tracks
        .sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    scan.report
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::io::Cursor;

    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("myspace-music-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("music/album")).unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    fn flac(with_tags: bool, picture: bool) -> Vec<u8> {
        let mut data = b"fLaC".to_vec();
        data.extend_from_slice(&[if with_tags || picture { 0 } else { 128 }, 0, 0, 34]);
        let mut stream = [0u8; 34];
        stream[..4].copy_from_slice(&[0x10, 0, 0x10, 0]);
        let info: u64 = (44100 << 44) | (1 << 41) | (15 << 36) | 441000;
        stream[10..18].copy_from_slice(&info.to_be_bytes());
        data.extend_from_slice(&stream);
        if picture {
            data.extend_from_slice(&[if with_tags { 6 } else { 134 }, 0x20, 0, 0]);
            data.resize(data.len() + 2 * 1024 * 1024, 0);
        }
        if with_tags {
            let mut comments = vec![];
            comments.extend_from_slice(&0u32.to_le_bytes());
            comments.extend_from_slice(&3u32.to_le_bytes());
            for value in ["TITLE=Faixa 日本", "ARTIST=Artista", "ALBUM=Album"] {
                comments.extend_from_slice(&(value.len() as u32).to_le_bytes());
                comments.extend_from_slice(value.as_bytes());
            }
            data.push(0x84);
            data.extend_from_slice(&(comments.len() as u32).to_be_bytes()[1..]);
            data.extend(comments);
        }
        data.extend_from_slice(&[0xff, 0xf8, 0, 0]);
        data
    }

    fn mp3(tags: bool) -> Vec<u8> {
        let mut data = vec![];
        if tags {
            let mut frames = vec![];
            for (id, text) in [(b"TIT2", "Title"), (b"TPE1", "Artist"), (b"TALB", "Album")] {
                frames.extend_from_slice(id);
                frames.extend_from_slice(&[0, 0, 0, (text.len() + 1) as u8, 0, 0, 3]);
                frames.extend_from_slice(text.as_bytes());
            }
            data.extend_from_slice(&[b'I', b'D', b'3', 4, 0, 0, 0, 0, 0, frames.len() as u8]);
            data.extend(frames);
        }
        for _ in 0..100 {
            data.extend_from_slice(&[0xff, 0xfb, 0x90, 0]);
            data.resize(data.len() + 413, 0);
        }
        data
    }

    #[test]
    fn reads_formats_tags_duration_missing_and_invalid_without_writes() {
        let fixture = Fixture::new();
        let root = fixture.0.join("music");
        let flac = flac(true, true);
        let mp3 = mp3(true);
        fs::write(root.join("album/tagged.FLAC"), &flac).unwrap();
        fs::write(root.join("tagged.mp3"), &mp3).unwrap();
        fs::write(root.join("missing.mp3"), self::mp3(false)).unwrap();
        fs::write(root.join("invalid.flac"), b"bad").unwrap();
        fs::write(root.join("ignore.txt"), b"not music").unwrap();
        let report = discover(&root);
        assert_eq!(report.tracks.len(), 4);
        let flac_track = report
            .tracks
            .iter()
            .find(|track| track.format == "FLAC" && track.state == "ready")
            .unwrap();
        assert_eq!(flac_track.title.as_deref(), Some("Faixa 日本"));
        assert_eq!(flac_track.artist.as_deref(), Some("Artista"));
        assert_eq!(flac_track.album.as_deref(), Some("Album"));
        assert_eq!(flac_track.duration_seconds, Some(10.0));
        let mp3_track = report
            .tracks
            .iter()
            .find(|track| track.file_name == "tagged.mp3")
            .unwrap();
        assert_eq!(mp3_track.title.as_deref(), Some("Title"));
        assert!(mp3_track.duration_seconds.unwrap() > 2.0);
        assert_eq!(
            report
                .tracks
                .iter()
                .find(|track| track.file_name == "missing.mp3")
                .unwrap()
                .state,
            "missing-metadata"
        );
        assert_eq!(
            report
                .tracks
                .iter()
                .find(|track| track.file_name == "invalid.flac")
                .unwrap()
                .state,
            "invalid-or-limited"
        );
        assert!(
            report.bytes_read < 200000,
            "Artwork/audio must not be read in full"
        );
        assert_eq!(fs::read(root.join("album/tagged.FLAC")).unwrap(), flac);
        assert_eq!(fs::read(root.join("tagged.mp3")).unwrap(), mp3);
        assert_eq!(discover(&root).tracks.len(), 4);
        assert_eq!(discover(&root.join("absent")).state, "unavailable");
    }

    #[test]
    fn budgets_bound_reads_operations_time_and_depth() {
        let mut remaining = 10;
        let mut reader = BudgetReader {
            inner: Cursor::new(vec![0u8; 100]),
            remaining: 6,
            scan_remaining: &mut remaining,
            operations: 5,
            deadline: Instant::now() + Duration::from_secs(1),
        };
        let mut bytes = [0; 20];
        assert_eq!(reader.read(&mut bytes).unwrap(), 6);
        assert!(reader.read(&mut bytes).is_err());
        reader.operations = 0;
        assert!(reader.seek(SeekFrom::Start(0)).is_err());
        let fixture = Fixture::new();
        let root = fixture.0.join("music");
        let mut scan = Scan {
            report: Report::unavailable(&root, "fixture".into()),
            remaining: 10,
            deadline: Instant::now() - Duration::from_secs(1),
        };
        scan.walk(&root, &root, 0);
        assert_eq!(scan.report.state, "partial");
        assert_eq!(scan.report.entries, 0);
        scan.deadline = Instant::now() + Duration::from_secs(5);
        scan.walk(&root, &root, MAX_DEPTH + 1);
        assert_eq!(scan.report.directories, 0);
        scan.report.entries = MAX_ENTRIES;
        assert!(scan.stop());
    }

    #[test]
    fn junctions_and_invalid_ids_do_not_authorize_music() {
        use crate::folder_access::Registry;
        let fixture = Fixture::new();
        let root = fixture.0.join("music");
        let outside = fixture.0.join("outside");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("secret.mp3"), mp3(true)).unwrap();
        let junction = root.join("escape");
        let output = std::process::Command::new("cmd.exe")
            .args(["/c", "mklink", "/J"])
            .arg(junction.to_string_lossy().replace('/', "\\"))
            .arg(outside.to_string_lossy().replace('/', "\\"))
            .output()
            .unwrap();
        assert!(output.status.success());
        let report = discover(&root);
        fs::remove_dir(&junction).unwrap();
        assert!(report.tracks.is_empty());
        assert_eq!(report.state, "partial");
        let file = fixture.0.join("registry/grants.json");
        let mut registry = Registry::load(&file).unwrap();
        registry.authorize("music", &[root.clone()]).unwrap();
        let id = registry.folders[0].id.clone();
        assert!(registry.get(&id, Some("games")).is_err());
        assert!(registry.get("../outside", Some("music")).is_err());
        registry.revoke(&id).unwrap();
        assert!(registry.get(&id, Some("music")).is_err());
    }
}
