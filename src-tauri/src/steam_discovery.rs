use crate::folder_access::{open_read_file, DirectoryGuard};
use serde::Serialize;
use std::{
    fs,
    io::Read,
    path::{Component, Path},
};

#[derive(Debug, Serialize)]
pub struct Entry {
    pub appid: String,
    pub name: String,
    pub install_dir: String,
    pub manifest: String,
    pub state: String,
}

#[derive(Debug, Serialize)]
pub struct Report {
    pub source: String,
    pub root: String,
    pub state: String,
    pub games: Vec<Entry>,
    pub errors: Vec<String>,
}

impl Report {
    pub fn new(root: &str, state: &str) -> Self {
        Self {
            source: "Steam".into(),
            root: root.into(),
            state: state.into(),
            games: vec![],
            errors: vec![],
        }
    }
}

// ACF is Valve KeyValues, not JSON: quoted tokens, braces and // comments.
fn tokens(text: &str) -> Result<Vec<String>, String> {
    let mut chars = text.trim_start_matches('\u{feff}').chars().peekable();
    let mut result = vec![];
    while let Some(ch) = chars.next() {
        if ch.is_whitespace() {
            continue;
        }
        if ch == '/' && chars.peek() == Some(&'/') {
            for ch in chars.by_ref() {
                if ch == '\n' {
                    break;
                }
            }
            continue;
        }
        if ch == '{' || ch == '}' {
            result.push(ch.to_string());
            continue;
        }
        if ch != '"' {
            return Err("Token ACF inválido".into());
        }
        let mut value = String::new();
        let mut closed = false;
        while let Some(ch) = chars.next() {
            if ch == '"' {
                closed = true;
                break;
            }
            if ch == '\\' {
                match chars.peek() {
                    Some('"' | '\\') => value.push(chars.next().unwrap()),
                    _ => value.push(ch),
                }
            } else {
                value.push(ch);
            }
        }
        if !closed {
            return Err("String ACF incompleta".into());
        }
        result.push(format!("s{value}"));
        if result.len() > 50000 {
            return Err("Manifesto excede limite de tokens".into());
        }
    }
    Ok(result)
}

fn object(
    tokens: &[String],
    cursor: &mut usize,
    depth: usize,
) -> Result<Vec<(String, String)>, String> {
    if depth > 32 || tokens.get(*cursor).map(String::as_str) != Some("{") {
        return Err("Objeto ACF inválido".into());
    }
    *cursor += 1;
    let mut values = vec![];
    while tokens.get(*cursor).map(String::as_str) != Some("}") {
        let key = tokens
            .get(*cursor)
            .and_then(|token| token.strip_prefix('s'))
            .ok_or("Chave ACF inválida")?
            .to_lowercase();
        *cursor += 1;
        if tokens.get(*cursor).map(String::as_str) == Some("{") {
            object(tokens, cursor, depth + 1)?;
        } else {
            let value = tokens
                .get(*cursor)
                .and_then(|token| token.strip_prefix('s'))
                .ok_or("Valor ACF inválido")?
                .to_string();
            *cursor += 1;
            if values.iter().any(|(existing, _)| existing == &key) {
                return Err("Chave ACF duplicada".into());
            }
            values.push((key, value));
        }
    }
    *cursor += 1;
    Ok(values)
}

pub fn app_id(value: &str) -> Result<u32, String> {
    let parsed = value
        .parse::<u32>()
        .ok()
        .filter(|id| *id > 0)
        .ok_or("Steam AppID inválido")?;
    if parsed.to_string() != value {
        return Err("Steam AppID inválido".into());
    }
    Ok(parsed)
}

fn parse(text: &str, expected: &str) -> Result<(String, String, String), String> {
    let tokens = tokens(text)?;
    if tokens.first().map(|token| token.to_lowercase()) != Some("sappstate".into()) {
        return Err("AppState ausente".into());
    }
    let mut cursor = 1;
    let values = object(&tokens, &mut cursor, 0)?;
    if cursor != tokens.len() {
        return Err("Conteúdo extra no ACF".into());
    }
    let get = |key: &str| {
        values
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.clone())
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| format!("Campo ausente: {key}"))
    };
    let appid = get("appid")?;
    if appid != expected || app_id(&appid).is_err() {
        return Err("AppID inválido ou diferente do nome do manifesto".into());
    }
    let name = get("name")?;
    let dir = get("installdir")?;
    // Steam installdir must be a single folder below steamapps/common.
    if dir.contains(['/', '\\', ':'])
        || dir.chars().any(char::is_control)
        || dir.ends_with(['.', ' '])
        || Path::new(&dir).components().count() != 1
        || !matches!(
            Path::new(&dir).components().next(),
            Some(Component::Normal(_))
        )
    {
        return Err("Diretório de instalação inseguro".into());
    }
    Ok((appid, name, dir))
}

fn contained(root: &Path, path: &Path) -> Result<DirectoryGuard, String> {
    if !path.starts_with(root) {
        return Err("Caminho fora da pasta autorizada".into());
    }
    DirectoryGuard::open(path)
}

// Retain all guards and the manifest through handoff; never accept an install path from IPC.
pub struct LaunchGuard {
    _directories: Vec<DirectoryGuard>,
    _manifest: fs::File,
}

fn read_manifest(path: &Path, expected: &str) -> Result<(fs::File, (String, String, String)), String> {
    let mut file = open_read_file(path)?;
    let mut text = String::new();
    (&mut file)
        .take(1024 * 1024 + 1)
        .read_to_string(&mut text)
        .map_err(|error| error.to_string())?;
    if text.len() > 1024 * 1024 {
        return Err("Manifesto excede 1 MiB".into());
    }
    Ok((file, parse(&text, expected)?))
}

fn steamapps_path(root: &Path) -> std::path::PathBuf {
    if root.file_name().is_some_and(|name| name.eq_ignore_ascii_case("steamapps")) {
        root.to_path_buf()
    } else {
        root.join("steamapps")
    }
}

pub fn validate_launch(root: &Path, appid: &str) -> Result<LaunchGuard, String> {
    app_id(appid)?;
    let root_guard = DirectoryGuard::open(root)?;
    let steamapps = steamapps_path(root);
    let steamapps_guard = contained(root, &steamapps)?;
    let (manifest, (_, _, dir)) =
        read_manifest(&steamapps.join(format!("appmanifest_{appid}.acf")), appid)?;
    let common = steamapps.join("common");
    let common_guard = contained(root, &common)?;
    let install_guard = contained(root, &common.join(dir))?;
    Ok(LaunchGuard {
        _directories: vec![root_guard, steamapps_guard, common_guard, install_guard],
        _manifest: manifest,
    })
}

pub fn discover(selected: &Path) -> Report {
    let mut report = Report::new(&selected.to_string_lossy(), "invalid-folder");
    let _root_guard = match DirectoryGuard::open(selected) {
        Ok(guard) => guard,
        _ => return report,
    };
    let root = match selected.canonicalize() {
        Ok(path) => path,
        Err(_) => return report,
    };
    let steamapps = steamapps_path(&root);
    let steamapps_guard = match contained(&root, &steamapps) {
        Ok(guard) => guard,
        _ => {
            report.state = "not-steam-library".into();
            return report;
        }
    };
    let steamapps = &steamapps_guard.path;
    let listing = match fs::read_dir(&steamapps) {
        Ok(entries) => entries,
        Err(error) => {
            report.state = "inaccessible".into();
            report.errors.push(error.to_string());
            return report;
        }
    };
    report.state = "complete".into();
    let mut manifests = vec![];
    for (index, entry) in listing.enumerate() {
        if index >= 10000 {
            report.state = "limited".into();
            report
                .errors
                .push("Limite de 10000 entradas atingido".into());
            break;
        }
        match entry {
            Ok(entry) => {
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.starts_with("appmanifest_") && name.ends_with(".acf") {
                    manifests.push((name, entry.path()));
                }
            }
            Err(error) => report.errors.push(error.to_string()),
        }
    }
    manifests.sort_by(|a, b| a.0.cmp(&b.0));
    for (filename, path) in manifests {
        let expected = &filename[12..filename.len() - 4];
        let result = (|| {
            if !path.starts_with(&root) {
                return Err("Manifesto fora do escopo".into());
            }
            read_manifest(&path, expected).map(|(_, values)| values)
        })();
        match result {
            Ok((appid, name, dir)) => {
                let common = steamapps.join("common");
                let install = common.join(&dir);
                let state = match contained(&root, &common) {
                    Ok(_common_guard) => match contained(&root, &install) {
                        Ok(_install_guard) => "present",
                        Err(_)
                            if fs::symlink_metadata(&install).is_err_and(|error| {
                                error.kind() == std::io::ErrorKind::NotFound
                            }) =>
                        {
                            "missing"
                        }
                        Err(_) => "unavailable-or-outside-scope",
                    },
                    Err(_)
                        if fs::symlink_metadata(&common)
                            .is_err_and(|error| error.kind() == std::io::ErrorKind::NotFound) =>
                    {
                        "missing"
                    }
                    Err(_) => "unavailable-or-outside-scope",
                };
                report.games.push(Entry {
                    appid,
                    name,
                    install_dir: install.to_string_lossy().into_owned(),
                    manifest: path.to_string_lossy().into_owned(),
                    state: state.into(),
                });
            }
            Err(error) => report.errors.push(format!("{filename}: {error}")),
        }
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn acf_validation() {
        let acf = "\"AppState\" { \"appid\" \"42\" \"name\" \"Jogo 日本\" \"installdir\" \"Game\" \"UserConfig\" { \"x\" \"y\" } }";
        assert_eq!(parse(acf, "42").unwrap().1, "Jogo 日本");
        assert!(parse(acf, "43").is_err());
        assert!(parse(&acf.replace("Game", "../secret"), "42").is_err());
        assert!(parse(&acf.replace("Game", "C:\\secret"), "42").is_err());
        assert!(parse(&acf[..acf.len() - 1], "42").is_err());
        assert!(parse("\"AppState\" { \"appid\" \"1\" }", "1").is_err());
        assert!(parse(&acf.replace("\"42\"", "\"42\" \"appid\" \"42\""), "42").is_err());
        assert!(parse(&acf.replace("Game", "Game. "), "42").is_err());
        assert!(parse(&format!("{acf} garbage"), "42").is_err());
        assert!(parse(&acf.replace("\"42\"", "\"0\""), "0").is_err());
        assert!(parse(&format!("// comment\n{acf}"), "42").is_ok());
    }

    #[test]
    fn discovers_fixture_without_changing_contents() {
        let root = std::env::temp_dir().join(format!("myspace-steam-test-{}", std::process::id()));
        fs::create_dir_all(root.join("steamapps/common/Game")).unwrap();
        let acf = "\"AppState\" { \"appid\" \"42\" \"name\" \"Example\" \"installdir\" \"Game\" }";
        let manifest = root.join("steamapps/appmanifest_42.acf");
        fs::write(&manifest, acf).unwrap();
        fs::write(
            root.join("steamapps/appmanifest_43.acf"),
            acf.replace("42", "43").replace("Game", "Absent"),
        )
        .unwrap();
        fs::write(root.join("steamapps/appmanifest_44.acf"), "bad").unwrap();
        let report = discover(&root);
        assert_eq!(report.games.len(), 2);
        assert_eq!(report.games[0].state, "present");
        assert_eq!(report.games[1].state, "missing");
        assert_eq!(report.errors.len(), 1);
        assert_eq!(fs::read_to_string(&manifest).unwrap(), acf);
        assert_eq!(discover(&root.join("steamapps")).games.len(), 2);
        assert_eq!(
            discover(&root.join("steamapps/common")).state,
            "not-steam-library"
        );
        assert_eq!(discover(&root.join("no-folder")).state, "invalid-folder");
        assert!(contained(&root.join("steamapps").canonicalize().unwrap(), &root).is_err());
        fs::write(
            root.join("steamapps/appmanifest_45.acf"),
            "x".repeat(1024 * 1024 + 1),
        )
        .unwrap();
        assert!(discover(&root)
            .errors
            .iter()
            .any(|error| error.contains("1 MiB")));
        fs::remove_dir_all(root).unwrap(); // Only the test-owned fixture.
    }
}
