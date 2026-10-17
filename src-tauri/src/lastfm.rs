use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};

pub struct Lastfm {
    pub file: PathBuf,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    cache: HashMap<String, (Instant, Value)>,
    next: Option<Instant>,
}

impl Lastfm {
    pub fn new(file: PathBuf) -> Self {
        Self {
            file,
            state: Mutex::new(State::default()),
        }
    }

    fn key(&self) -> Result<String, String> {
        let metadata = match fs::metadata(&self.file) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(String::new()),
            Err(_) => return Err("Não foi possível ler a configuração Last.fm.".into()),
        };
        if metadata.len() > 4096 {
            return Err("Configuração Last.fm inválida.".into());
        }
        let bytes =
            fs::read(&self.file).map_err(|_| "Não foi possível ler a configuração Last.fm.")?;
        let value: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Configuração Last.fm inválida.")?;
        let key = value["lastfmApiKey"].as_str().unwrap_or_default();
        validate_key(key)?;
        Ok(key.to_owned())
    }

    pub fn configured(&self) -> Result<bool, String> {
        Ok(!self.key()?.is_empty())
    }

    pub fn save_key(&self, key: &str) -> Result<bool, String> {
        let key = key.trim();
        validate_key(key)?;
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Configuração Last.fm ocupada.")?;
        if key.is_empty() {
            let _ = fs::remove_file(self.file.with_extension("tmp"));
            match fs::remove_file(&self.file) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => return Err("Não foi possível remover a chave Last.fm.".into()),
            }
        } else {
            let parent = self.file.parent().ok_or("Perfil Desktop inválido.")?;
            fs::create_dir_all(parent).map_err(|_| "Não foi possível salvar a chave Last.fm.")?;
            let temporary = self.file.with_extension("tmp");
            fs::write(
                &temporary,
                json!({ "version": 1, "lastfmApiKey": key }).to_string(),
            )
            .map_err(|_| "Não foi possível salvar a chave Last.fm.")?;
            if fs::rename(&temporary, &self.file).is_err() {
                let _ = fs::remove_file(&temporary);
                return Err("Não foi possível salvar a chave Last.fm.".into());
            }
        }
        state.cache.clear();
        state.next = None;
        Ok(!key.is_empty())
    }

    pub fn request(&self, method: &str, params: &Value) -> Result<Value, String> {
        let expected = validate_request(method, params)?;
        let mut state = self.state.lock().map_err(|_| "Last.fm ocupado.")?;
        let key = self.key()?;
        if key.is_empty() {
            return Err(
                "Last.fm opcional: configure uma API Key pessoal nas configurações Desktop.".into(),
            );
        }
        let cache_key = format!("{method}:{params}");
        if let Some((expires, value)) = state.cache.get(&cache_key) {
            if *expires > Instant::now() {
                return Ok(value.clone());
            }
        }
        if let Some(next) = state.next {
            let delay = next.saturating_duration_since(Instant::now());
            if delay > Duration::from_secs(1) {
                return Err(
                    "Last.fm limitou as consultas. Aguarde antes de tentar novamente.".into(),
                );
            }
            std::thread::sleep(delay);
        }
        state.next = Some(Instant::now() + Duration::from_millis(350));
        let mut query = format!(
            "/2.0/?method={}&api_key={}&format=json",
            encode(method),
            encode(&key)
        );
        for (name, value) in params.as_object().unwrap() {
            let text = value
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| value.to_string());
            query.push_str(&format!("&{}={}", encode(name), encode(&text)));
        }
        let (status, bytes, control) = crate::youtube_music::lastfm_request(&query)?;
        if status == 429 {
            state.next = Some(Instant::now() + Duration::from_secs(60));
            return Err("Last.fm limitou as consultas. Aguarde antes de tentar novamente.".into());
        }
        if status != 200 || bytes.len() > 1024 * 1024 {
            return Err("Last.fm indisponível agora.".into());
        }
        let payload: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Resposta Last.fm inválida.")?;
        if let Some(error) = payload["error"].as_u64() {
            if error == 29 {
                state.next = Some(Instant::now() + Duration::from_secs(60));
            }
            return Err(match error {
                10 | 26 => "A chave Last.fm não foi aceita. Confira as configurações Desktop.",
                29 => "Last.fm limitou as consultas. Aguarde antes de tentar novamente.",
                _ => "O Last.fm não disponibilizou esses dados.",
            }
            .into());
        }
        if !payload[expected].is_object() {
            return Err("Resposta Last.fm inválida.".into());
        }
        let ttl = cache_ttl(&control);
        if ttl > 0 {
            // Bounded metadata only; no artwork/audio or key in cache entries.
            if state.cache.len() >= 100
                || state
                    .cache
                    .values()
                    .map(|(_, value)| value.to_string().len())
                    .sum::<usize>()
                    + bytes.len()
                    > 4 * 1024 * 1024
            {
                state.cache.clear();
            }
            state.cache.insert(
                cache_key,
                (Instant::now() + Duration::from_secs(ttl), payload.clone()),
            );
        }
        Ok(payload)
    }
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty() || (key.len() == 32 && key.bytes().all(|byte| byte.is_ascii_hexdigit())) {
        Ok(())
    } else {
        Err(
            "API Key Last.fm inválida: informe os 32 caracteres hexadecimais, sem Shared Secret."
                .into(),
        )
    }
}

fn validate_request<'a>(method: &str, params: &'a Value) -> Result<&'static str, String> {
    let (container, title, limits): (&str, Option<&str>, bool) = match method {
        "artist.getSimilar" => ("similarartists", None, true),
        "artist.getTopAlbums" => ("topalbums", None, true),
        "track.getSimilar" => ("similartracks", Some("track"), true),
        "artist.getInfo" => ("artist", None, false),
        "album.getInfo" => ("album", Some("album"), false),
        "track.getInfo" => ("track", Some("track"), false),
        _ => return Err("Operação Last.fm não permitida.".into()),
    };
    let object = params.as_object().ok_or("Consulta Last.fm inválida.")?;
    for field in std::iter::once("artist").chain(title) {
        let value = object
            .get(field)
            .and_then(Value::as_str)
            .ok_or("Consulta Last.fm inválida.")?;
        if value.trim().is_empty()
            || value.chars().count() > 200
            || value.chars().any(char::is_control)
        {
            return Err("Consulta Last.fm inválida.".into());
        }
    }
    for (name, value) in object {
        if name == "artist" || Some(name.as_str()) == title {
            continue;
        }
        let valid = match name.as_str() {
            "limit" if limits => value.as_u64().is_some_and(|n| (1..=48).contains(&n)),
            "autocorrect" => value.as_u64().is_some_and(|n| n <= 1),
            _ => false,
        };
        if !valid {
            return Err("Parâmetro Last.fm não permitido.".into());
        }
    }
    Ok(container)
}

pub(crate) fn encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-_.~".contains(&byte) {
                (byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn cache_ttl(control: &str) -> u64 {
    let control = control.to_ascii_lowercase();
    if control.contains("no-store") || control.contains("no-cache") {
        return 0;
    }
    control
        .split(',')
        .find_map(|part| {
            part.trim()
                .strip_prefix("max-age=")?
                .trim_matches('"')
                .parse::<u64>()
                .ok()
        })
        .unwrap_or(3600)
        .min(3600)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restricts_key_operations_and_parameters() {
        assert!(validate_key("abcdef0123456789abcdef0123456789").is_ok());
        assert!(validate_key("secret\n").is_err());
        assert!(validate_request(
            "track.getSimilar",
            &json!({"artist":"Artist", "track":"Song", "limit":48,"autocorrect":1})
        )
        .is_ok());
        assert!(validate_request("user.getInfo", &json!({"artist":"Artist"})).is_err());
        assert!(validate_request(
            "artist.getSimilar",
            &json!({"artist":"Artist", "api_key":"injected"})
        )
        .is_err());
        assert!(
            validate_request("artist.getSimilar", &json!({"artist":"Artist", "limit":49})).is_err()
        );
        assert!(validate_request("artist.getInfo", &json!({"artist":"\n"})).is_err());
        assert_eq!(encode("A&B 日本"), "A%26B%20%E6%97%A5%E6%9C%AC");
    }
    #[test]
    fn configuration_persists_and_removes_only_native_fixture() {
        let folder = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("myspace-lastfm-{}", uuid::Uuid::new_v4()));
        let client = Lastfm::new(folder.join("online-keys-v1.json"));
        assert!(!client.configured().unwrap());
        assert!(client.save_key("abcdef0123456789abcdef0123456789").unwrap());
        assert!(Lastfm::new(client.file.clone()).configured().unwrap());
        assert!(client.save_key("bad").is_err());
        assert!(client.configured().unwrap());
        assert!(!client.save_key("").unwrap());
        assert!(!client.configured().unwrap());
        fs::remove_dir(folder).unwrap();
    }
    #[test]
    fn honors_cache_directives() {
        assert_eq!(cache_ttl("no-store"), 0);
        assert_eq!(cache_ttl("public, max-age=30"), 30);
        assert_eq!(cache_ttl("max-age=86400"), 3600);
    }
}
