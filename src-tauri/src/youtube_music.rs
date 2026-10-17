use serde_json::{json, Map, Value};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows_sys::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryDataAvailable,
    WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest,
    WinHttpSetOption, WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_FLAG_SECURE,
    WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
};

const HOST: &str = "music.youtube.com";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;
const CONFIG_LIFETIME: Duration = Duration::from_secs(4 * 60 * 60);
const REDIRECT_POLICY_OPTION: u32 = 88;
const REDIRECT_POLICY_NEVER: u32 = 0;

#[derive(Clone, Default)]
pub struct Search {
    config: Arc<Mutex<Option<CachedConfig>>>,
}

#[derive(Clone)]
struct CachedConfig {
    loaded_at: Instant,
    value: ClientConfig,
}

#[derive(Clone)]
struct ClientConfig {
    api_key: String,
    client_version: String,
    visitor_data: Option<String>,
}

struct InternetHandle(*mut std::ffi::c_void);

impl InternetHandle {
    fn new(handle: *mut std::ffi::c_void) -> Result<Self, String> {
        if handle.is_null() {
            return Err(format!("Falha na conexão com YouTube Music ({})", unsafe {
                windows_sys::Win32::Foundation::GetLastError()
            }));
        }
        Ok(Self(handle))
    }
}

impl Drop for InternetHandle {
    fn drop(&mut self) {
        unsafe { WinHttpCloseHandle(self.0) };
    }
}

impl Search {
    pub fn search(&self, kind: &str, query: &str, cursor: Option<&str>) -> Result<Value, String> {
        let (filter, query, cursor) = validate_search(kind, query, cursor)?;
        let body = match cursor {
            Some(continuation) => json!({ "continuation": continuation }),
            None => json!({ "query": query, "params": filter }),
        };
        self.api_request("search", body)
    }

    pub fn browse(&self, kind: &str, browse_id: &str) -> Result<Value, String> {
        if !valid_browse_identity(kind, browse_id) {
            return Err("Identidade de artista/álbum inválida.".into());
        }
        self.api_request("browse", json!({ "browseId": browse_id }))
    }

    pub fn radio(&self, video_id: &str) -> Result<Value, String> {
        if !valid_video_id(video_id) {
            return Err("Identidade de rádio inválida.".into());
        }
        self.api_request(
            "next",
            json!({
                "videoId": video_id,
                "playlistId": format!("RDAMVM{video_id}"),
                "isAudioOnly": true,
            }),
        )
    }

    pub fn artist_section(
        &self,
        section: &str,
        browse_id: Option<&str>,
        params: Option<&str>,
        continuation: Option<&str>,
    ) -> Result<Value, String> {
        let body = validate_artist_section(section, browse_id, params, continuation)?;
        self.api_request("browse", body)
    }

    fn api_request(&self, endpoint: &str, mut body: Value) -> Result<Value, String> {
        let config = self.client_config()?;
        let mut client = json!({
            "clientName": "WEB_REMIX",
            "clientVersion": config.client_version,
            "hl": "en",
            "gl": "US",
        });
        if let Some(visitor_data) = config.visitor_data {
            client["visitorData"] = json!(visitor_data);
        }
        let body = body
            .as_object_mut()
            .ok_or_else(|| "Requisição YouTube Music inválida.".to_owned())?;
        body.insert("context".into(), json!({ "client": client }));
        let body = Value::Object(body.clone()).to_string();
        let endpoint = match endpoint {
            "search" => "search",
            "browse" => "browse",
            "next" => "next",
            _ => return Err("Operação YouTube Music inválida.".into()),
        };
        let path = format!(
            "/youtubei/v1/{}?key={}&prettyPrint=false",
            endpoint, config.api_key
        );
        let (status, bytes) = request("POST", &path, Some(body.as_bytes()))?;
        if status == 400 || status == 403 {
            if let Ok(mut cached) = self.config.lock() {
                *cached = None;
            }
        }
        if status != 200 {
            return Err("O catálogo do YouTube Music não respondeu com sucesso.".into());
        }
        let payload: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Resposta do YouTube Music inválida.")?;
        if payload.get("error").is_some() {
            return Err("O catálogo do YouTube Music está indisponível.".into());
        }
        Ok(payload)
    }

    fn client_config(&self) -> Result<ClientConfig, String> {
        let mut cache = self
            .config
            .lock()
            .map_err(|_| "Configuração de busca indisponível")?;
        if let Some(cached) = cache.as_ref() {
            if cached.loaded_at.elapsed() < CONFIG_LIFETIME {
                return Ok(cached.value.clone());
            }
        }
        let (status, bytes) = request("GET", "/", None)?;
        if status != 200 {
            return Err("Não foi possível obter a configuração do YouTube Music.".into());
        }
        let html = String::from_utf8_lossy(&bytes);
        let value = parse_client_config(&html)?;
        *cache = Some(CachedConfig {
            loaded_at: Instant::now(),
            value: value.clone(),
        });
        Ok(value)
    }
}

fn valid_browse_identity(kind: &str, browse_id: &str) -> bool {
    match kind {
        "album" => {
            let rest = browse_id.strip_prefix("MPRE").unwrap_or_default();
            (4..=120).contains(&rest.len())
                && rest
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
        }
        "artist" => {
            let rest = browse_id.strip_prefix("UC").unwrap_or_default();
            (8..=80).contains(&rest.len())
                && rest
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
        }
        _ => false,
    }
}

fn valid_video_id(video_id: &str) -> bool {
    video_id.len() == 11
        && video_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn valid_section_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 4096
        && !value.bytes().any(|byte| byte < 0x20 || byte == 0x7f)
}

fn validate_artist_section(
    section: &str,
    browse_id: Option<&str>,
    params: Option<&str>,
    continuation: Option<&str>,
) -> Result<Value, String> {
    if !matches!(section, "albums" | "singles") {
        return Err("Seção de artista inválida.".into());
    }
    if let Some(continuation) = continuation {
        if browse_id.is_some() || params.is_some() || !valid_section_token(continuation) {
            return Err("Continuação de artista inválida.".into());
        }
        return Ok(json!({ "continuation": continuation }));
    }
    let browse_id =
        browse_id.ok_or_else(|| "Identidade de seção de artista inválida.".to_owned())?;
    if !matches!(browse_id.strip_prefix("MPADUC"), Some(rest) if (8..=80).contains(&rest.len()) && rest.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-'))
        || params.is_some_and(|value| !valid_section_token(value))
    {
        return Err("Identidade de seção de artista inválida.".into());
    }
    let mut body = json!({ "browseId": browse_id });
    if let Some(params) = params {
        body["params"] = json!(params);
    }
    Ok(body)
}

fn validate_search<'a>(
    kind: &str,
    query: &str,
    cursor: Option<&'a str>,
) -> Result<(&'static str, String, Option<&'a str>), String> {
    let filter = match kind {
        "music" => "EgWKAQIIAWoMEA4QChADEAQQCRAF",
        "album" => "EgWKAQIYAWoMEA4QChADEAQQCRAF",
        "artist" => "EgWKAQIgAWoMEA4QChADEAQQCRAF",
        _ => return Err("Tipo de busca musical inválido.".into()),
    };
    let query = query.trim();
    let length = query.chars().count();
    if length < 2 || length > 200 {
        return Err("Busca musical inválida.".into());
    }
    if let Some(cursor) = cursor {
        if cursor.is_empty()
            || cursor.len() > 4096
            || cursor.bytes().any(|byte| byte < 0x20 || byte == 0x7f)
        {
            return Err("Cursor de busca inválido.".into());
        }
    }
    Ok((filter, query.to_owned(), cursor))
}

fn parse_client_config(html: &str) -> Result<ClientConfig, String> {
    let bytes = html.as_bytes();
    let mut config = Map::new();
    let mut offset = 0;
    while let Some(found) = html[offset..].find("ytcfg.set(") {
        let call = offset + found;
        let Some(object_start) = html[call + 10..].find('{').map(|index| call + 10 + index) else {
            break;
        };
        let mut depth = 0i32;
        let mut quoted = false;
        let mut escape = false;
        let mut object_end = None;
        for (index, byte) in bytes[object_start..].iter().copied().enumerate() {
            if quoted {
                if escape {
                    escape = false;
                } else if byte == b'\\' {
                    escape = true;
                } else if byte == b'"' {
                    quoted = false;
                }
            } else if byte == b'"' {
                quoted = true;
            } else if byte == b'{' {
                depth += 1;
            } else if byte == b'}' {
                depth -= 1;
                if depth == 0 {
                    object_end = Some(object_start + index + 1);
                    break;
                }
            }
        }
        let Some(object_end) = object_end else {
            break;
        };
        if let Ok(Value::Object(values)) = serde_json::from_slice(&bytes[object_start..object_end])
        {
            config.extend(values);
        }
        offset = object_end.max(call + 10);
    }
    let api_key = config
        .get("INNERTUBE_API_KEY")
        .and_then(Value::as_str)
        .filter(|key| {
            !key.is_empty()
                && key.len() <= 256
                && key
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
        })
        .ok_or_else(|| "YouTube Music search configuration unavailable".to_owned())?;
    let client = config
        .get("INNERTUBE_CONTEXT")
        .and_then(|value| value.get("client"));
    let client_version = client
        .and_then(|value| value.get("clientVersion"))
        .and_then(Value::as_str)
        .or_else(|| {
            config
                .get("INNERTUBE_CLIENT_VERSION")
                .and_then(Value::as_str)
        })
        .filter(|version| !version.is_empty() && version.len() <= 128)
        .ok_or_else(|| "YouTube Music search configuration unavailable".to_owned())?;
    let visitor_data = client
        .and_then(|value| value.get("visitorData"))
        .or_else(|| config.get("VISITOR_DATA"))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty() && value.len() <= 4096)
        .map(str::to_owned);
    Ok(ClientConfig {
        api_key: api_key.to_owned(),
        client_version: client_version.to_owned(),
        visitor_data,
    })
}

fn request(method: &str, path: &str, body: Option<&[u8]>) -> Result<(u32, Vec<u8>), String> {
    if !path.starts_with('/')
        || path.starts_with("//")
        || path
            .chars()
            .any(|character| matches!(character, '\\' | '\r' | '\n'))
    {
        return Err("Destino de busca inválido.".into());
    }
    let agent = wide(USER_AGENT);
    let host = wide(HOST);
    let verb = wide(method);
    let path = wide(path);
    let headers = wide(if body.is_some() {
        "Accept-Language: en-US,en;q=0.9\r\nContent-Type: application/json\r\n"
    } else {
        "Accept-Language: en-US,en;q=0.9\r\n"
    });
    let session = InternetHandle::new(unsafe {
        WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
            std::ptr::null(),
            std::ptr::null(),
            0,
        )
    })?;
    if unsafe { WinHttpSetTimeouts(session.0, 8000, 8000, 8000, 8000) } == 0 {
        return Err("Tempo limite de conexão com YouTube Music indisponível.".into());
    }
    let connection =
        InternetHandle::new(unsafe { WinHttpConnect(session.0, host.as_ptr(), 443, 0) })?;
    let request = InternetHandle::new(unsafe {
        WinHttpOpenRequest(
            connection.0,
            verb.as_ptr(),
            path.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            WINHTTP_FLAG_SECURE,
        )
    })?;
    let redirect_policy = REDIRECT_POLICY_NEVER;
    if unsafe {
        WinHttpSetOption(
            request.0,
            REDIRECT_POLICY_OPTION,
            &redirect_policy as *const u32 as *const std::ffi::c_void,
            std::mem::size_of_val(&redirect_policy) as u32,
        )
    } == 0
    {
        return Err("Não foi possível restringir redirecionamentos da busca.".into());
    }
    let (body_ptr, body_len) = body
        .map(|body| (body.as_ptr() as *const std::ffi::c_void, body.len() as u32))
        .unwrap_or((std::ptr::null(), 0));
    let sent = unsafe {
        WinHttpSendRequest(
            request.0,
            headers.as_ptr(),
            u32::MAX,
            body_ptr,
            body_len,
            body_len,
            0,
        )
    };
    if sent == 0 || unsafe { WinHttpReceiveResponse(request.0, std::ptr::null_mut()) } == 0 {
        return Err(format!("Falha na conexão com YouTube Music ({})", unsafe {
            windows_sys::Win32::Foundation::GetLastError()
        }));
    }
    let mut status = 0u32;
    let mut status_bytes = std::mem::size_of::<u32>() as u32;
    if unsafe {
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            std::ptr::null(),
            &mut status as *mut u32 as *mut std::ffi::c_void,
            &mut status_bytes,
            std::ptr::null_mut(),
        )
    } == 0
    {
        return Err("Falha ao obter a resposta do YouTube Music.".into());
    }
    let mut output = Vec::new();
    loop {
        let mut available = 0u32;
        if unsafe { WinHttpQueryDataAvailable(request.0, &mut available) } == 0 {
            return Err("Falha ao ler a resposta do YouTube Music.".into());
        }
        if available == 0 {
            break;
        }
        let next_len = output.len().saturating_add(available as usize);
        if next_len > MAX_RESPONSE_BYTES {
            return Err("Resposta de busca do YouTube Music excede o limite.".into());
        }
        let start = output.len();
        output.resize(next_len, 0);
        let mut read = 0u32;
        if unsafe {
            WinHttpReadData(
                request.0,
                output[start..].as_mut_ptr() as *mut std::ffi::c_void,
                available,
                &mut read,
            )
        } == 0
        {
            return Err("Falha ao ler a resposta do YouTube Music.".into());
        }
        output.truncate(start + read as usize);
    }
    Ok((status, output))
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::{
        parse_client_config, valid_browse_identity, valid_video_id, validate_artist_section,
        validate_search,
    };

    #[test]
    fn search_accepts_only_supported_kinds_and_bounded_inputs() {
        assert_eq!(
            validate_search("music", "  Björk  ", None).unwrap().1,
            "Björk"
        );
        assert!(validate_search("video", "Björk", None).is_err());
        assert!(validate_search("music", "x", None).is_err());
        assert!(validate_search("music", &"x".repeat(201), None).is_err());
        for cursor in [
            "".to_owned(),
            "\0".to_owned(),
            "\u{7f}".to_owned(),
            "x".repeat(4097),
        ] {
            assert!(validate_search("artist", "Björk", Some(&cursor)).is_err());
        }
    }

    #[test]
    fn config_parser_keeps_provider_key_inside_the_native_layer() {
        let html = r#"ytcfg.set({"INNERTUBE_API_KEY":"fixture_key-1","INNERTUBE_CONTEXT":{"client":{"clientVersion":"1.2.3","visitorData":"visitor"}}});"#;
        let parsed = parse_client_config(html).unwrap();
        assert_eq!(parsed.api_key, "fixture_key-1");
        assert_eq!(parsed.client_version, "1.2.3");
        assert_eq!(parsed.visitor_data.as_deref(), Some("visitor"));
    }

    #[test]
    fn config_parser_rejects_missing_or_unbounded_keys() {
        assert!(parse_client_config("ytcfg.set({\"INNERTUBE_CLIENT_VERSION\":\"1\"});").is_err());
        let html = format!(
            "ytcfg.set({{\"INNERTUBE_API_KEY\":\"{}\",\"INNERTUBE_CLIENT_VERSION\":\"1\"}});",
            "x".repeat(257)
        );
        assert!(parse_client_config(&html).is_err());
    }

    #[test]
    fn browse_details_accept_only_exact_artist_and_album_ids() {
        assert!(valid_browse_identity("artist", "UCfixtureArtist123"));
        assert!(valid_browse_identity("album", "MPREfixtureAlbum123"));
        assert!(!valid_browse_identity("artist", "UCshort"));
        assert!(!valid_browse_identity("album", "MPRE"));
        assert!(!valid_browse_identity("artist", "https://example.test"));
        assert!(!valid_browse_identity("music", "10z6-vQm23w"));
    }

    #[test]
    fn radio_accepts_only_youtube_video_ids() {
        assert!(valid_video_id("10z6-vQm23w"));
        assert!(!valid_video_id("short"));
        assert!(!valid_video_id("https://example.test"));
        assert!(!valid_video_id("abcdefghij/"));
    }

    #[test]
    fn artist_browse_is_limited_to_album_sections_and_valid_handles() {
        let body = validate_artist_section(
            "albums",
            Some("MPADUCfixtureArtist123"),
            Some("albums%3D"),
            None,
        )
        .unwrap();
        assert_eq!(body["browseId"], "MPADUCfixtureArtist123");
        assert_eq!(body["params"], "albums%3D");
        assert_eq!(
            validate_artist_section("singles", None, None, Some("opaque-token")).unwrap()
                ["continuation"],
            "opaque-token"
        );
        assert!(
            validate_artist_section("songs", Some("MPADUCfixtureArtist123"), None, None).is_err()
        );
        assert!(
            validate_artist_section("albums", Some("https://example.test"), None, None).is_err()
        );
        assert!(validate_artist_section("albums", None, None, Some("\u{7f}")).is_err());
        assert!(validate_artist_section(
            "albums",
            Some("MPADUCfixtureArtist123"),
            Some(&"x".repeat(4097)),
            None
        )
        .is_err());
        assert!(validate_artist_section(
            "albums",
            Some("MPADUCfixtureArtist123"),
            None,
            Some("opaque-token")
        )
        .is_err());
    }
}
