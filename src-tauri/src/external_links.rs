use std::net::IpAddr;
use url::Url;

#[cfg(windows)]
pub fn open(url: &Url) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use std::{ffi::OsStr, ptr};
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = OsStr::new(url.as_str())
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            target.as_ptr(),
            ptr::null(),
            ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        Err("Não foi possível abrir o link no navegador padrão.".into())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
pub fn open(_url: &Url) -> Result<(), String> {
    Err("A abertura externa está disponível no Desktop Windows.".into())
}

pub fn validate(value: &str) -> Result<Url, String> {
    if value.is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        return Err("Endereço externo inválido.".into());
    }
    let url = Url::parse(value).map_err(|_| "Endereço externo inválido.")?;
    let host = url.host_str().ok_or("Destino externo inválido.")?;
    let normalized_host = host.trim_end_matches('.').to_ascii_lowercase();
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
        || normalized_host.is_empty()
        || normalized_host.parse::<IpAddr>().is_ok()
        || !normalized_host.contains('.')
        || normalized_host == "localhost"
        || normalized_host.ends_with(".localhost")
        || normalized_host.ends_with(".local")
        || normalized_host.ends_with(".internal")
        || host.ends_with('.')
    {
        return Err("Somente links HTTPS públicos podem ser abertos.".into());
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::validate;

    #[test]
    fn accepts_public_https_links_used_by_music_and_catalog_pages() {
        for value in [
            "https://music.youtube.com/watch?v=abcdefghijk",
            "https://www.youtube.com/results?search_query=artist",
            "https://www.last.fm/music/artist",
            "https://anilist.co/anime/1",
        ] {
            assert!(validate(value).is_ok(), "{value}");
        }
    }

    #[test]
    fn rejects_unsafe_schemes_local_destinations_and_ambiguous_hosts() {
        for value in [
            "javascript:alert(1)",
            "file:///C:/Users/Halourt/secret.txt",
            "http://example.com",
            "https://user@example.com/path",
            "https://localhost/path",
            "https://127.0.0.1/path",
            "https://example.local/path",
            "https://example.com:8443/path",
            "https://example.com./path",
        ] {
            assert!(validate(value).is_err(), "{value}");
        }
    }
}
