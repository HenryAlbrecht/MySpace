//! Bounded offline covers. Paths are supplied only by the authorized native lookup.
use crate::{folder_access::open_read_file, music_discovery::artwork_reader};
use lofty::{
    config::{apply_global_options, GlobalOptions, ParseOptions},
    file::TaggedFileExt,
    picture::PictureType,
    probe::Probe,
};
use std::{fs::File, io::Read, path::Path};
const MAX_BYTES: usize = 2 * 1024 * 1024;
pub type Image = (String, Vec<u8>);

// Only raster PNG/JPEG; the existing browser Artwork decoder rejects corrupt payloads.
pub(crate) fn validate(bytes: Vec<u8>) -> Option<Image> {
    if bytes.len() > MAX_BYTES {
        return None;
    }
    let (mime, w, h) = if bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        && bytes.len() >= 45
        && &bytes[8..16] == b"\0\0\0\rIHDR"
        && bytes.ends_with(b"IEND\xaeB`\x82")
    {
        (
            "image/png",
            u32::from_be_bytes(bytes[16..20].try_into().ok()?),
            u32::from_be_bytes(bytes[20..24].try_into().ok()?),
        )
    } else if bytes.starts_with(&[0xff, 0xd8]) {
        let mut i = 2;
        let mut dimensions = None;
        while i + 4 <= bytes.len() {
            if bytes[i] != 0xff {
                return None;
            }
            while i < bytes.len() && bytes[i] == 0xff {
                i += 1;
            }
            let marker = *bytes.get(i)?;
            i += 1;
            if marker == 0xda || marker == 0xd9 {
                break;
            }
            let len = u16::from_be_bytes(bytes.get(i..i + 2)?.try_into().ok()?) as usize;
            if len < 2 || i + len > bytes.len() {
                return None;
            }
            if matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf) && len >= 8 {
                dimensions = Some((
                    u16::from_be_bytes([bytes[i + 5], bytes[i + 6]]) as u32,
                    u16::from_be_bytes([bytes[i + 3], bytes[i + 4]]) as u32,
                ));
                break;
            }
            i += len;
        }
        let (w, h) = dimensions?;
        ("image/jpeg", w, h)
    } else {
        return None;
    };
    if w == 0 || h == 0 || w > 4096 || h > 4096 || u64::from(w) * u64::from(h) > 16_000_000 {
        return None;
    }
    Some((mime.into(), bytes))
}

pub fn extract(file: File, directory: &Path) -> Option<Image> {
    let mut budget = 8 * 1024 * 1024;
    apply_global_options(
        GlobalOptions::new()
            .allocation_limit(MAX_BYTES)
            .preserve_format_specific_items(false)
            .use_custom_resolvers(false),
    );
    let embedded = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let tagged = Probe::new(artwork_reader(file, &mut budget))
            .options(
                ParseOptions::new()
                    .read_cover_art(true)
                    .read_properties(false)
                    .max_junk_bytes(4096),
            )
            .guess_file_type()
            .ok()?
            .read()
            .ok()?;
        let pictures: Vec<_> = tagged
            .tags()
            .iter()
            .flat_map(|tag| tag.pictures())
            .collect();
        pictures
            .iter()
            .filter(|p| p.pic_type() == PictureType::CoverFront)
            .chain(
                pictures
                    .iter()
                    .filter(|p| p.pic_type() != PictureType::CoverFront),
            )
            .find_map(|picture| validate(picture.data().to_vec()))
    }))
    .ok()
    .flatten();
    apply_global_options(GlobalOptions::default());
    if embedded.is_some() {
        return embedded;
    }
    for name in ["cover.jpg", "folder.jpg", "cover.png", "folder.png"] {
        // Caller retains the protected parent handle, preventing junction retargeting.
        let Ok(file) = open_read_file(&directory.join(name)) else {
            continue;
        };
        if file.metadata().ok()?.len() > MAX_BYTES as u64 {
            continue;
        }
        let mut bytes = Vec::new();
        if file
            .take((MAX_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .is_ok()
        {
            if let Some(image) = validate(bytes) {
                return Some(image);
            }
        }
    }
    None
}

#[cfg(test)]
pub(crate) fn png_fixture() -> Vec<u8> {
    let hex = "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63304a99f61f000424022c5485b26b0000000049454e44ae426082";
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn embedded_mp3_flac_and_directory_fallback() {
        let root = std::env::temp_dir().join(format!("myspace-artwork-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let png = png_fixture();
        let path = root.join("song.mp3");
        let mut apic = b"\0image/png\0\x03\0".to_vec();
        apic.extend(&png);
        let mut frame = b"APIC".to_vec();
        frame.extend((apic.len() as u32).to_be_bytes());
        frame.extend([0, 0]);
        frame.extend(apic);
        let n = frame.len();
        let mut mp3 = vec![
            b'I',
            b'D',
            b'3',
            3,
            0,
            0,
            ((n >> 21) & 127) as u8,
            ((n >> 14) & 127) as u8,
            ((n >> 7) & 127) as u8,
            (n & 127) as u8,
        ];
        mp3.extend(frame);
        for _ in 0..10 {
            mp3.extend([0xff, 0xfb, 0x90, 0]);
            mp3.resize(mp3.len() + 413, 0);
        }
        std::fs::write(&path, &mp3).unwrap();
        assert_eq!(extract(File::open(&path).unwrap(), &root).unwrap().1, png);
        let mut picture = Vec::new();
        for bytes in [
            3u32.to_be_bytes().to_vec(),
            9u32.to_be_bytes().to_vec(),
            b"image/png".to_vec(),
            0u32.to_be_bytes().to_vec(),
            1u32.to_be_bytes().to_vec(),
            1u32.to_be_bytes().to_vec(),
            8u32.to_be_bytes().to_vec(),
            0u32.to_be_bytes().to_vec(),
            (png.len() as u32).to_be_bytes().to_vec(),
            png.clone(),
        ] {
            picture.extend(bytes);
        }
        let mut flac = b"fLaC\0\0\0\x22".to_vec();
        flac.extend([0u8; 34]);
        flac.push(0x86);
        flac.extend(&(picture.len() as u32).to_be_bytes()[1..]);
        flac.extend(picture);
        std::fs::write(&path, &flac).unwrap();
        assert_eq!(extract(File::open(&path).unwrap(), &root).unwrap().1, png);
        // Embedded art wins even if a broken cover is present.
        std::fs::write(root.join("cover.jpg"), b"invalid").unwrap();
        assert_eq!(extract(File::open(&path).unwrap(), &root).unwrap().1, png);
        std::fs::write(&path, b"invalid audio").unwrap();
        assert!(extract(File::open(&path).unwrap(), &root).is_none());
        std::fs::write(root.join("folder.jpg"), &png).unwrap();
        assert_eq!(extract(File::open(&path).unwrap(), &root).unwrap().1, png);
        std::fs::remove_file(root.join("folder.jpg")).unwrap();
        assert!(extract(File::open(&path).unwrap(), &root).is_none());
        assert_eq!(std::fs::read(&path).unwrap(), b"invalid audio");
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_invalid_types_sizes_and_dimensions() {
        assert!(validate(b"<svg/>".to_vec()).is_none());
        assert!(validate(vec![0; MAX_BYTES + 1]).is_none());
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        png.extend(5000u32.to_be_bytes());
        png.extend(1u32.to_be_bytes());
        png.resize(33, 0);
        assert!(validate(png.clone()).is_none());
        assert!(validate(png).is_none());
        assert_eq!(validate(png_fixture()).unwrap().0, "image/png");
        assert!(validate(vec![0xff, 0xd8, 0xff, 0xc0, 0, 20]).is_none());
    }
}
