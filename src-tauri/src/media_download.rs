use crate::folder_access::{open_read_file, DirectoryGuard, FolderAccess, Grant, Registry};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, Command, ExitStatus, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use url::{Host, Url};

const MAX_MEDIA_BYTES: u64 = 200 * 1024 * 1024;
const MAX_COVER_BYTES: usize = 768 * 1024;
const MAX_HOSTS: usize = 32;
const PROCESS_TIMEOUT: Duration = Duration::from_secs(20 * 60);
const BLOCKED_DOMAINS: [&str; 1] = ["peido.com"];

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
struct Settings {
    version: u32,
    yt_dlp: Option<PathBuf>,
    ffmpeg: Option<PathBuf>,
    allowed_hosts: Vec<String>,
    destination_id: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 1,
            yt_dlp: None,
            ffmpeg: None,
            allowed_hosts: vec![],
            destination_id: None,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub yt_dlp_configured: bool,
    pub ffmpeg_configured: bool,
    pub allowed_hosts: Vec<String>,
    pub destination_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub phase: String,
    pub percent: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub folder_id: String,
    pub file_name: String,
    pub bytes: u64,
}

#[derive(Deserialize, Default)]
pub struct Metadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub date: Option<String>,
    pub track: Option<String>,
    #[serde(rename = "coverData")]
    pub cover_data: Option<String>,
}

#[derive(Default)]
struct ActiveJob {
    id: String,
    folder_id: String,
    url: String,
    phase: String,
    percent: Option<f64>,
    cancelled: bool,
    child: Option<Child>,
    #[cfg(windows)]
    process_job: Option<ProcessJob>,
}

#[cfg(windows)]
struct ProcessJob(std::os::windows::io::OwnedHandle);

#[cfg(windows)]
impl ProcessJob {
    fn assign(child: &Child) -> Result<Self, String> {
        use std::os::windows::io::{AsRawHandle, FromRawHandle};
        use windows_sys::Win32::{
            Foundation::HANDLE,
            System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
        };
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err("Não foi possível controlar o processo de download.".into());
        }
        let handle = unsafe { std::os::windows::io::OwnedHandle::from_raw_handle(handle) };
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if unsafe {
            SetInformationJobObject(
                handle.as_raw_handle() as HANDLE,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        } == 0
            || unsafe {
                AssignProcessToJobObject(
                    handle.as_raw_handle() as HANDLE,
                    child.as_raw_handle() as HANDLE,
                )
            } == 0
        {
            return Err("Não foi possível controlar o processo de download.".into());
        }
        Ok(Self(handle))
    }

    fn terminate(&self) {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::TerminateJobObject;
        unsafe {
            TerminateJobObject(self.0.as_raw_handle(), 1);
        }
    }
}

#[derive(Default)]
struct Inner {
    settings: Settings,
    active: Option<ActiveJob>,
    last_attempt: Option<Instant>,
}

#[derive(Clone)]
pub struct MediaDownloads {
    file: PathBuf,
    inner: Arc<Mutex<Inner>>,
}

impl MediaDownloads {
    pub fn new(file: PathBuf) -> Result<Self, String> {
        let settings = load_settings(&file)?;
        Ok(Self {
            file,
            inner: Arc::new(Mutex::new(Inner {
                settings,
                ..Inner::default()
            })),
        })
    }

    pub fn settings(&self) -> Result<SettingsView, String> {
        let settings = self
            .inner
            .lock()
            .map_err(|_| "Configuração de downloads indisponível.")?
            .settings
            .clone();
        Ok(SettingsView {
            yt_dlp_configured: resolve_tool(settings.yt_dlp.as_deref(), "yt-dlp.exe").is_some(),
            ffmpeg_configured: resolve_ffmpeg(&settings).is_some(),
            allowed_hosts: settings.allowed_hosts,
            destination_id: settings.destination_id,
        })
    }

    pub fn set_ytdlp(&self, path: PathBuf) -> Result<(), String> {
        let path = selected_tool(path, "yt-dlp.exe")?;
        self.update_settings(|settings| settings.yt_dlp = Some(path))
    }

    pub fn set_ffmpeg(&self, path: PathBuf) -> Result<(), String> {
        let path = selected_tool(path, "ffmpeg.exe")?;
        self.update_settings(|settings| settings.ffmpeg = Some(path))
    }

    pub fn save_preferences(
        &self,
        allowed_hosts: Vec<String>,
        destination_id: Option<String>,
    ) -> Result<(), String> {
        let hosts = normalize_hosts(allowed_hosts)?;
        if destination_id
            .as_ref()
            .is_some_and(|id| uuid::Uuid::parse_str(id).is_err())
        {
            return Err("Pasta de destino inválida.".into());
        }
        self.update_settings(|settings| {
            settings.allowed_hosts = hosts;
            settings.destination_id = destination_id;
        })
    }

    pub fn progress(&self, id: &str) -> Result<Option<Progress>, String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "Estado de download indisponível.")?;
        Ok(inner
            .active
            .as_ref()
            .filter(|job| job.id == id)
            .map(|job| Progress {
                phase: if job.cancelled {
                    "cancelling".into()
                } else {
                    job.phase.clone()
                },
                percent: job.percent,
            }))
    }

    pub fn cancel(&self, id: &str) -> Result<bool, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "Estado de download indisponível.")?;
        let Some(job) = inner.active.as_mut().filter(|job| job.id == id) else {
            return Ok(false);
        };
        job.cancelled = true;
        #[cfg(windows)]
        if let Some(process_job) = job.process_job.as_ref() {
            process_job.terminate();
        }
        if let Some(child) = job.child.as_mut() {
            let _ = child.kill();
        }
        Ok(true)
    }

    pub fn cancel_folder(&self, folder_id: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(job) = inner
                .active
                .as_mut()
                .filter(|job| job.folder_id == folder_id)
            {
                job.cancelled = true;
                #[cfg(windows)]
                if let Some(process_job) = job.process_job.as_ref() {
                    process_job.terminate();
                }
                if let Some(child) = job.child.as_mut() {
                    let _ = child.kill();
                }
            }
        }
    }

    pub fn download(
        &self,
        access: &FolderAccess,
        grant: Grant,
        job_id: String,
        source_url: String,
        source_identity: String,
        cooldown_seconds: u64,
        metadata: Metadata,
    ) -> Result<DownloadResult, String> {
        let url = Url::parse(&source_url).map_err(|_| "Endereço de mídia inválido.")?;
        let settings = self.snapshot()?;
        validate_url(&url, &settings.allowed_hosts)?;
        if grant.category != "music" || settings.destination_id.as_deref() != Some(&grant.id) {
            return Err("Selecione uma pasta de músicas autorizada como destino.".into());
        }
        if uuid::Uuid::parse_str(&job_id).is_err() {
            return Err("Identificador de download inválido.".into());
        }
        let cooldown = cooldown_seconds.clamp(60, 3600);
        {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "Estado de download indisponível.")?;
            if inner.active.is_some() {
                if inner
                    .active
                    .as_ref()
                    .is_some_and(|job| job.url == url.as_str())
                {
                    return Err("Esta fonte já está sendo baixada.".into());
                }
                return Err("Já existe um download em andamento.".into());
            }
            if let Some(last) = inner.last_attempt {
                let elapsed = last.elapsed().as_secs();
                if elapsed < cooldown {
                    return Err(format!(
                        "Aguarde {} segundos antes de iniciar outro download.",
                        cooldown - elapsed
                    ));
                }
            }
            inner.last_attempt = Some(Instant::now());
            inner.active = Some(ActiveJob {
                id: job_id.clone(),
                folder_id: grant.id.clone(),
                url: url.to_string(),
                phase: "download".into(),
                ..ActiveJob::default()
            });
        }

        let result = self.download_inner(
            access,
            &grant,
            &job_id,
            &url,
            &source_identity,
            &settings,
            metadata,
        );
        self.finish(&job_id);
        result
    }

    fn download_inner(
        &self,
        access: &FolderAccess,
        grant: &Grant,
        job_id: &str,
        url: &Url,
        source_identity: &str,
        settings: &Settings,
        metadata: Metadata,
    ) -> Result<DownloadResult, String> {
        let ytdlp = resolve_tool(settings.yt_dlp.as_deref(), "yt-dlp.exe")
            .ok_or("Selecione um arquivo yt-dlp.exe em Configurações Desktop.")?;
        let ffmpeg = resolve_ffmpeg(settings).ok_or(
            "Selecione ffmpeg.exe com ffprobe.exe ao lado, ou disponibilize ambos no PATH.",
        )?;
        let cover = decode_cover(metadata.cover_data.as_deref())?;
        let metadata = sanitize_metadata(metadata);
        let _destination_guard = grant
            .open_for_writes()
            .map_err(|_| "A pasta de destino não está disponível ou mudou de identidade.")?;
        let temporary = grant.path.join(format!(".myspace-download-{job_id}"));
        fs::create_dir(&temporary)
            .map_err(|_| "Não foi possível criar a área temporária do download.")?;
        let result = (|| {
            let _temporary_guard = DirectoryGuard::open_for_writes(&temporary)
                .map_err(|_| "A área temporária do download ficou indisponível.")?;
            if let Some(bytes) = cover.as_ref() {
                let mut file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(temporary.join("cover.jpg"))
                    .map_err(|_| "Não foi possível preparar a capa local.")?;
                file.write_all(bytes)
                    .map_err(|_| "Não foi possível preparar a capa local.")?;
            }
            let args = vec![
                "--ignore-config".to_string(),
                "--no-plugin-dirs".to_string(),
                "--no-update".to_string(),
                "--no-playlist".to_string(),
                "--no-overwrites".to_string(),
                "--no-continue".to_string(),
                "--newline".to_string(),
                "--progress".to_string(),
                "--progress-delta".to_string(),
                "1".to_string(),
                "--progress-template".to_string(),
                "download:myspace-progress:%(progress._percent_str)s".to_string(),
                "--no-warnings".to_string(),
                "--no-colors".to_string(),
                "--max-filesize".to_string(),
                "200M".to_string(),
                "--format".to_string(),
                "bestaudio/best".to_string(),
                "--extract-audio".to_string(),
                "--audio-format".to_string(),
                "mp3".to_string(),
                "--audio-quality".to_string(),
                "320K".to_string(),
                "--embed-metadata".to_string(),
                "--ffmpeg-location".to_string(),
                ffmpeg.to_string_lossy().into_owned(),
                "--output".to_string(),
                "source.%(ext)s".to_string(),
                url.as_str().to_string(),
            ];
            self.run_process(job_id, &ytdlp, &args, &temporary, "download")?;
            self.check_cancelled(job_id)?;
            self.set_phase(job_id, "processing");
            let source = single_audio_output(&temporary)?;
            let mut ffmpeg_args = vec![
                "-nostdin".to_string(),
                "-n".to_string(),
                "-i".to_string(),
                source.to_string_lossy().into_owned(),
            ];
            if cover.is_some() {
                ffmpeg_args.extend([
                    "-i".into(),
                    temporary.join("cover.jpg").to_string_lossy().into_owned(),
                ]);
                ffmpeg_args.extend(["-map".into(), "0:a:0".into(), "-map".into(), "1:v:0".into()]);
                ffmpeg_args.extend(["-disposition:v:0".into(), "attached_pic".into()]);
                ffmpeg_args.extend(["-metadata:s:v:0".into(), "title=Album cover".into()]);
                ffmpeg_args.extend(["-metadata:s:v:0".into(), "comment=Cover (front)".into()]);
            } else {
                ffmpeg_args.extend(["-map".into(), "0".into()]);
            }
            ffmpeg_args.extend([
                "-map_metadata".into(),
                "0".into(),
                "-c".into(),
                "copy".into(),
                "-id3v2_version".into(),
                "3".into(),
            ]);
            for (key, value) in metadata.iter() {
                ffmpeg_args.push("-metadata".into());
                ffmpeg_args.push(format!("{key}={value}"));
            }
            ffmpeg_args.extend(["-metadata".into(), "genre=".into()]);
            ffmpeg_args.push(temporary.join("tagged.mp3").to_string_lossy().into_owned());
            self.run_process(job_id, &ffmpeg, &ffmpeg_args, &temporary, "processing")?;
            self.check_cancelled(job_id)?;
            let tagged = temporary.join("tagged.mp3");
            let file = open_read_file(&tagged).map_err(|_| "FFmpeg não produziu um MP3 válido.")?;
            let bytes = file
                .metadata()
                .map_err(|_| "Não foi possível validar o MP3.")?
                .len();
            if bytes == 0 || bytes > MAX_MEDIA_BYTES {
                return Err("O MP3 final está vazio ou excede 200 MB.".into());
            }
            drop(file);
            cleanup_except(&temporary, "tagged.mp3")?;
            let file_name = output_name(&metadata, source_identity, url.as_str());

            // Commit only after rechecking the persistent native grant; cache/UI IDs are not access.
            let _lock = access
                .lock
                .lock()
                .map_err(|_| "Registro de pastas indisponível.")?;
            let _disk_lock = access.disk_lock()?;
            let registry = Registry::load(&access.file)?;
            let current = registry.get(&grant.id, Some("music"))?;
            if current.identity != grant.identity || current.path != grant.path {
                return Err("A autorização da pasta mudou durante o download.".into());
            }
            self.check_cancelled(job_id)?;
            move_without_overwrite(&tagged, &grant.path.join(&file_name))?;
            self.set_phase(job_id, "complete");
            Ok(DownloadResult {
                folder_id: grant.id.clone(),
                file_name,
                bytes,
            })
        })();
        let cleanup_result = cleanup_temp_dir(&temporary);
        drop(_destination_guard);
        match cleanup_result {
            Ok(()) => result,
            Err(_) => match result {
                Ok(_) => {
                    Err("O download terminou, mas a área temporária não pôde ser limpa.".into())
                }
                Err(error) => Err(format!(
                    "{error} A área temporária também não pôde ser limpa."
                )),
            },
        }
    }

    fn run_process(
        &self,
        job_id: &str,
        executable: &Path,
        args: &[String],
        working_directory: &Path,
        phase: &str,
    ) -> Result<ExitStatus, String> {
        self.check_cancelled(job_id)?;
        let mut command = Command::new(executable);
        command
            .args(args)
            .current_dir(working_directory)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn().map_err(|_| {
            "Não foi possível iniciar yt-dlp/FFmpeg; verifique o executável selecionado."
        })?;
        #[cfg(windows)]
        let process_job = match ProcessJob::assign(&child) {
            Ok(process_job) => process_job,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let stdout = child
            .stdout
            .take()
            .ok_or("Saída de processo indisponível.")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("Saída de processo indisponível.")?;
        let (sender, receiver) = mpsc::sync_channel::<String>(16);
        let stderr_sender = sender.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) => break,
                    Ok(_) => {
                        line.truncate(4096);
                        if sender.send(line.clone()).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) if line.contains("myspace-progress:") => {
                        line.truncate(4096);
                        if stderr_sender.send(line.clone()).is_err() {
                            break;
                        }
                    }
                    Ok(_) => {}
                }
            }
        });
        {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "Estado de download indisponível.")?;
            let Some(job) = inner.active.as_mut().filter(|job| job.id == job_id) else {
                let _ = child.kill();
                return Err("Download cancelado.".into());
            };
            job.phase = phase.into();
            job.child = Some(child);
            #[cfg(windows)]
            {
                job.process_job = Some(process_job);
            }
        }
        let deadline = Instant::now() + PROCESS_TIMEOUT;
        let status = loop {
            if Instant::now() >= deadline {
                self.kill_process(job_id);
                self.take_child(job_id)?
                    .wait()
                    .map_err(|_| "O processo não encerrou corretamente.")?;
                return Err("Download interrompido após exceder o tempo limite.".into());
            }
            if self.is_cancelled(job_id)? {
                self.kill_process(job_id);
                let _ = self.take_child(job_id)?.wait();
                return Err("Download cancelado.".into());
            }
            match receiver.recv_timeout(Duration::from_millis(250)) {
                Ok(line) => {
                    if phase == "download" {
                        if let Some(percent) = parse_progress(&line) {
                            self.set_percent(job_id, percent);
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    if self.try_wait(job_id)?.is_none() {
                        thread::sleep(Duration::from_millis(250));
                        continue;
                    }
                    let mut child = self.take_child(job_id)?;
                    break child
                        .wait()
                        .map_err(|_| "O processo não encerrou corretamente.")?;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if self.try_wait(job_id)?.is_some() {
                        let mut child = self.take_child(job_id)?;
                        break child
                            .wait()
                            .map_err(|_| "O processo não encerrou corretamente.")?;
                    }
                }
            }
        };
        if status.success() {
            Ok(status)
        } else {
            Err(if phase == "download" {
                "yt-dlp não conseguiu obter um áudio compatível dessa fonte autorizada.".into()
            } else {
                "FFmpeg não conseguiu preparar o MP3 e seus metadados.".into()
            })
        }
    }

    fn snapshot(&self) -> Result<Settings, String> {
        self.inner
            .lock()
            .map(|inner| inner.settings.clone())
            .map_err(|_| "Configuração de downloads indisponível.".into())
    }

    fn update_settings(&self, update: impl FnOnce(&mut Settings)) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "Configuração de downloads indisponível.")?;
        let previous = inner.settings.clone();
        update(&mut inner.settings);
        if let Err(error) = save_settings(&self.file, &inner.settings) {
            inner.settings = previous;
            return Err(error);
        }
        Ok(())
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            if inner.active.as_ref().is_some_and(|job| job.id == job_id) {
                inner.active = None;
            }
        }
    }

    fn is_cancelled(&self, job_id: &str) -> Result<bool, String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "Estado de download indisponível.")?;
        Ok(inner
            .active
            .as_ref()
            .filter(|job| job.id == job_id)
            .is_none_or(|job| job.cancelled))
    }

    fn check_cancelled(&self, job_id: &str) -> Result<(), String> {
        if self.is_cancelled(job_id)? {
            Err("Download cancelado.".into())
        } else {
            Ok(())
        }
    }

    fn set_phase(&self, job_id: &str, phase: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(job) = inner.active.as_mut().filter(|job| job.id == job_id) {
                job.phase = phase.into();
                job.percent = None;
            }
        }
    }

    fn set_percent(&self, job_id: &str, percent: f64) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(job) = inner.active.as_mut().filter(|job| job.id == job_id) {
                job.percent = Some(percent);
            }
        }
    }

    fn kill_process(&self, job_id: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(job) = inner.active.as_mut().filter(|job| job.id == job_id) {
                #[cfg(windows)]
                if let Some(process_job) = job.process_job.as_ref() {
                    process_job.terminate();
                }
                if let Some(child) = job.child.as_mut() {
                    let _ = child.kill();
                }
            }
        }
    }

    fn take_child(&self, job_id: &str) -> Result<Child, String> {
        self.inner
            .lock()
            .map_err(|_| "Estado de download indisponível.")?
            .active
            .as_mut()
            .filter(|job| job.id == job_id)
            .and_then(|job| job.child.take())
            .ok_or_else(|| "Processo de download indisponível.".into())
    }

    fn try_wait(&self, job_id: &str) -> Result<Option<ExitStatus>, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "Estado de download indisponível.")?;
        let child = inner
            .active
            .as_mut()
            .filter(|job| job.id == job_id)
            .and_then(|job| job.child.as_mut())
            .ok_or("Processo de download indisponível.")?;
        child
            .try_wait()
            .map_err(|_| "Não foi possível consultar o processo de download.".into())
    }
}

pub fn normalize_hosts(values: Vec<String>) -> Result<Vec<String>, String> {
    if values.len() > MAX_HOSTS {
        return Err("Limite de 32 domínios autorizados.".into());
    }
    let mut hosts = Vec::new();
    for value in values {
        let value = value.trim().trim_end_matches('.').to_ascii_lowercase();
        if value.is_empty() {
            continue;
        }
        if value.len() > 253 || value.contains('*') || value.contains('/') || value.contains(':') {
            return Err("Use somente nomes de host exatos, sem curingas ou portas.".into());
        }
        let url =
            Url::parse(&format!("https://{value}/")).map_err(|_| "Domínio autorizado inválido.")?;
        let host = match url.host().ok_or("Domínio autorizado inválido.")? {
            Host::Domain(domain) => domain.to_string(),
            Host::Ipv4(_) | Host::Ipv6(_) => {
                return Err("Endereços IP não podem ser autorizados.".into())
            }
        };
        if is_local_host(&host) || is_blocked_host(&host) {
            return Err(
                "Esse domínio local ou de serviço bloqueado não pode ser autorizado.".into(),
            );
        }
        if !hosts.contains(&host) {
            hosts.push(host);
        }
    }
    Ok(hosts)
}

pub fn validate_url(url: &Url, allowed_hosts: &[String]) -> Result<(), String> {
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
        || url.as_str().len() > 4096
    {
        return Err(
            "Somente links HTTPS públicos sem credenciais ou portas alternativas são aceitos."
                .into(),
        );
    }
    let host = url
        .host_str()
        .ok_or("Destino de mídia inválido.")?
        .to_ascii_lowercase();
    if is_local_host(&host) || is_blocked_host(&host) {
        return Err("Essa fonte não permite download offline pelo MySpace.".into());
    }
    if !allowed_hosts.iter().any(|allowed| allowed == &host) {
        return Err("O domínio exato da fonte não está autorizado para download offline.".into());
    }
    Ok(())
}

fn is_local_host(host: &str) -> bool {
    host.parse::<std::net::IpAddr>().is_ok()
        || !host.contains('.')
        || host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
}

fn is_blocked_host(host: &str) -> bool {
    BLOCKED_DOMAINS
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

fn selected_tool(path: PathBuf, expected_name: &str) -> Result<PathBuf, String> {
    if !path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case(expected_name))
        || !path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
    {
        return Err(format!("Selecione o executável {expected_name}."));
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| "Executável não encontrado.")?;
    let file = open_read_file(&canonical).map_err(|_| "Executável inválido ou inacessível.")?;
    if file.metadata().map_err(|_| "Executável inválido.")?.len() == 0 {
        return Err("Executável inválido.".into());
    }
    Ok(canonical)
}

fn resolve_tool(path: Option<&Path>, expected_name: &str) -> Option<PathBuf> {
    if let Some(path) = path {
        return selected_tool(path.to_path_buf(), expected_name).ok();
    }
    find_in_path(expected_name)
}

fn resolve_ffmpeg(settings: &Settings) -> Option<PathBuf> {
    if let Some(path) = settings.ffmpeg.as_deref() {
        if let Some(path) = ffmpeg_with_probe(path.to_path_buf()) {
            return Some(path);
        }
    }
    if let Some(ytdlp) = settings.yt_dlp.as_deref() {
        if let Some(candidate) = ytdlp.parent().map(|parent| parent.join("ffmpeg.exe")) {
            if let Some(path) = ffmpeg_with_probe(candidate) {
                return Some(path);
            }
        }
    }
    env::split_paths(&env::var_os("PATH")?)
        .map(|directory| directory.join("ffmpeg.exe"))
        .find_map(ffmpeg_with_probe)
}

fn ffmpeg_with_probe(path: PathBuf) -> Option<PathBuf> {
    let ffmpeg = selected_tool(path, "ffmpeg.exe").ok()?;
    let ffprobe = ffmpeg.parent()?.join("ffprobe.exe");
    selected_tool(ffprobe, "ffprobe.exe").ok()?;
    Some(ffmpeg)
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    env::split_paths(&env::var_os("PATH")?)
        .map(|directory| directory.join(name))
        .find_map(|path| selected_tool(path, name).ok())
}

fn sanitize_metadata(metadata: Metadata) -> Vec<(&'static str, String)> {
    [
        ("title", metadata.title),
        ("artist", metadata.artist),
        ("album", metadata.album),
        ("album_artist", metadata.album_artist),
        ("date", metadata.date),
        ("track", metadata.track),
    ]
    .into_iter()
    .filter_map(|(key, value)| {
        let value = value?
            .chars()
            .filter(|character| !character.is_control())
            .take(300)
            .collect::<String>()
            .trim()
            .to_string();
        (!value.is_empty()).then_some((key, value))
    })
    .collect()
}

fn decode_cover(data: Option<&str>) -> Result<Option<Vec<u8>>, String> {
    let Some(data) = data else { return Ok(None) };
    let encoded = data
        .strip_prefix("data:image/jpeg;base64,")
        .ok_or("A capa do álbum precisa estar em JPEG.")?;
    if encoded.len() > MAX_COVER_BYTES * 2 {
        return Err("A capa do álbum excede 768 KB.".into());
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| "A capa do álbum não está em base64 válido.")?;
    if bytes.len() < 3 || bytes.len() > MAX_COVER_BYTES || bytes[..3] != [0xff, 0xd8, 0xff] {
        return Err("A capa do álbum excede 768 KB ou não é JPEG válido.".into());
    }
    Ok(Some(bytes))
}

fn parse_progress(line: &str) -> Option<f64> {
    let value = line.split("myspace-progress:").nth(1)?;
    let percent = value
        .trim()
        .trim_end_matches('%')
        .trim()
        .parse::<f64>()
        .ok()?;
    percent.is_finite().then_some(percent.clamp(0.0, 100.0))
}

fn single_audio_output(directory: &Path) -> Result<PathBuf, String> {
    let mut found = None;
    for entry in
        fs::read_dir(directory).map_err(|_| "Não foi possível ler o resultado do download.")?
    {
        let entry = entry.map_err(|_| "Não foi possível ler o resultado do download.")?;
        if entry.file_name().to_string_lossy().starts_with("source.") {
            if found.is_some()
                || !entry
                    .file_type()
                    .map_err(|_| "Arquivo de áudio inválido.")?
                    .is_file()
            {
                return Err("A fonte não retornou um único arquivo de áudio.".into());
            }
            found = Some(entry.path());
        }
    }
    let path = found.ok_or("A fonte não retornou um arquivo de áudio.")?;
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("mp3"))
    {
        return Err("A fonte não retornou um MP3 compatível.".into());
    }
    let file = open_read_file(&path).map_err(|_| "Arquivo de áudio inválido.")?;
    let metadata = file.metadata().map_err(|_| "Arquivo de áudio inválido.")?;
    if metadata.len() == 0 || metadata.len() > MAX_MEDIA_BYTES {
        return Err("O áudio está vazio ou excede 200 MB.".into());
    }
    Ok(path)
}

fn output_name(metadata: &[(&str, String)], identity: &str, source_url: &str) -> String {
    let title = metadata
        .iter()
        .find(|(key, _)| *key == "title")
        .map(|(_, value)| value.as_str())
        .unwrap_or("Faixa");
    let artist = metadata
        .iter()
        .find(|(key, _)| *key == "artist")
        .map(|(_, value)| value.as_str())
        .unwrap_or("");
    let stem = [artist, title]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" - ");
    let mut safe = stem
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim_matches([' ', '.'])
        .chars()
        .take(120)
        .collect::<String>();
    if safe.is_empty()
        || ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1"]
            .contains(&safe.to_ascii_uppercase().as_str())
    {
        safe = "Faixa".into();
    }
    format!(
        "{}-{:08x}.mp3",
        safe,
        stable_hash(if identity.is_empty() {
            source_url
        } else {
            identity
        })
    )
}

fn stable_hash(value: &str) -> u32 {
    value.bytes().fold(0x811c9dc5u32, |hash, byte| {
        (hash ^ u32::from(byte)).wrapping_mul(0x01000193)
    })
}

fn cleanup_temp_dir(directory: &Path) -> Result<(), String> {
    let guard = DirectoryGuard::open_for_writes(directory)
        .map_err(|_| "A área temporária não está mais na pasta autorizada; foi preservada.")?;
    for entry in
        fs::read_dir(directory).map_err(|_| "Não foi possível limpar a área temporária.")?
    {
        let entry = entry.map_err(|_| "Não foi possível limpar a área temporária.")?;
        let kind = entry
            .file_type()
            .map_err(|_| "Não foi possível limpar a área temporária.")?;
        if kind.is_dir() {
            return Err("A área temporária contém um diretório inesperado; ela foi preservada por segurança.".into());
        }
        fs::remove_file(entry.path()).map_err(|_| "Não foi possível limpar a área temporária.")?;
    }
    drop(guard);
    fs::remove_dir(directory).map_err(|_| "Não foi possível remover a área temporária.".to_string())
}

fn cleanup_except(directory: &Path, keep: &str) -> Result<(), String> {
    for entry in
        fs::read_dir(directory).map_err(|_| "Não foi possível limpar a área temporária.")?
    {
        let entry = entry.map_err(|_| "Não foi possível limpar a área temporária.")?;
        if entry.file_name() == keep {
            continue;
        }
        if entry
            .file_type()
            .map_err(|_| "Não foi possível limpar a área temporária.")?
            .is_dir()
        {
            return Err("A área temporária contém um diretório inesperado; ela foi preservada por segurança.".into());
        }
        fs::remove_file(entry.path()).map_err(|_| "Não foi possível limpar a área temporária.")?;
    }
    Ok(())
}

#[cfg(windows)]
fn move_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    if unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        let error = std::io::Error::last_os_error();
        return Err(if error.kind() == std::io::ErrorKind::AlreadyExists {
            "Esta faixa já existe na pasta autorizada; nenhum arquivo foi sobrescrito.".into()
        } else {
            "Não foi possível gravar a faixa na pasta autorizada.".into()
        });
    }
    Ok(())
}

#[cfg(not(windows))]
fn move_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    fs::hard_link(source, destination).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            "Esta faixa já existe na pasta autorizada; nenhum arquivo foi sobrescrito.".into()
        } else {
            "Não foi possível gravar a faixa na pasta autorizada.".into()
        }
    })?;
    fs::remove_file(source).map_err(|_| "Não foi possível finalizar o arquivo de áudio.".into())
}

fn load_settings(path: &Path) -> Result<Settings, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Settings::default())
        }
        Err(_) => return Err("Configuração local de downloads indisponível.".into()),
    };
    if bytes.len() > 64 * 1024 {
        return Err("Configuração local de downloads inválida.".into());
    }
    let settings: Settings =
        serde_json::from_slice(&bytes).map_err(|_| "Configuração local de downloads inválida.")?;
    if settings.version != 1
        || settings.allowed_hosts != normalize_hosts(settings.allowed_hosts.clone())?
    {
        return Err("Configuração local de downloads incompatível.".into());
    }
    Ok(settings)
}

fn save_settings(path: &Path, settings: &Settings) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Diretório de configuração indisponível.")?;
    fs::create_dir_all(parent)
        .map_err(|_| "Não foi possível salvar as configurações de download.")?;
    let temporary = parent.join(format!("media-download-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "Não foi possível criar o arquivo local de configuração.")?;
        file.write_all(&serde_json::to_vec(settings).map_err(|_| "Configuração inválida.")?)
            .map_err(|_| "Não foi possível gravar a configuração local.")?;
        file.sync_all()
            .map_err(|_| "Não foi possível sincronizar a configuração local.")?;
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
                return Err("Não foi possível finalizar a configuração local.".into());
            }
        }
        #[cfg(not(windows))]
        fs::rename(&temporary, path)
            .map_err(|_| "Não foi possível finalizar a configuração local.")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn process_job_tracks_a_test_owned_child() {
        let mut child = Command::new("cmd.exe")
            .args(["/C", "exit", "0"])
            .spawn()
            .unwrap();
        let _process_job = ProcessJob::assign(&child).unwrap();
        assert!(child.wait().unwrap().success());
    }

    #[test]
    fn ffmpeg_configuration_requires_ffprobe_next_to_the_binary() {
        let root = env::temp_dir().join(format!("myspace-ffmpeg-tools-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let ffmpeg = root.join("ffmpeg.exe");
        fs::write(&ffmpeg, b"fixture").unwrap();
        assert!(ffmpeg_with_probe(ffmpeg.clone()).is_none());
        fs::write(root.join("ffprobe.exe"), b"fixture").unwrap();
        assert_eq!(
            ffmpeg_with_probe(ffmpeg.clone()),
            ffmpeg.canonicalize().ok()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn exact_host_allowlist_and_blocked_service_rules_are_enforced() {
        let hosts = normalize_hosts(vec![
            " Audio.Example.org ".into(),
            "audio.example.org".into(),
        ])
        .unwrap();
        assert_eq!(hosts, ["audio.example.org"]);
        assert!(validate_url(
            &Url::parse("https://audio.example.org/track.mp3").unwrap(),
            &hosts
        )
        .is_ok());
        assert!(validate_url(
            &Url::parse("https://sub.audio.example.org/track.mp3").unwrap(),
            &hosts
        )
        .is_err());
        for host in [
            "youtube.com",
            "youtu.be",
            "music.youtube.com",
            "googlevideo.com",
        ] {
            assert!(normalize_hosts(vec![host.into()]).is_err());
        }
        for value in [
            "http://audio.example.org/file",
            "https://user@audio.example.org/file",
            "https://audio.example.org:8443/file",
            "https://127.0.0.1/file",
            "https://youtube.com/watch?v=abcdefghijk",
        ] {
            assert!(validate_url(&Url::parse(value).unwrap(), &hosts).is_err());
        }
        assert!(normalize_hosts(vec!["*.example.org".into()]).is_err());
    }

    #[test]
    fn metadata_cover_progress_and_names_are_bounded_and_safe() {
        let metadata = sanitize_metadata(Metadata {
            title: Some("Track\nTitle".into()),
            artist: Some("Artist".into()),
            ..Metadata::default()
        });
        assert_eq!(metadata[0], ("title", "TrackTitle".into()));
        assert_eq!(metadata[1], ("artist", "Artist".into()));
        assert!(parse_progress("myspace-progress: 42.5%\n").is_some_and(|value| value == 42.5));
        assert_eq!(parse_progress("myspace-progress: 101%"), Some(100.0));
        assert_eq!(parse_progress("other output"), None);
        let name = output_name(
            &metadata,
            "ytmusic:video:abcdefghijk",
            "https://audio.example.org/file",
        );
        assert!(!name.contains('/') && !name.contains('\\'));
        assert!(name.ends_with(".mp3"));
        assert_eq!(
            output_name(&metadata, "same-id", "unused"),
            output_name(&metadata, "same-id", "https://other.example.org/")
        );
        assert!(decode_cover(Some("data:image/jpeg;base64,AA==")).is_err());
        assert_eq!(decode_cover(None).unwrap(), None);
    }

    #[test]
    fn temporary_files_are_cleaned_and_final_names_are_not_overwritten() {
        let root = env::temp_dir().join(format!("myspace-download-files-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let temporary = root.join("working");
        fs::create_dir(&temporary).unwrap();
        fs::write(temporary.join("source.mp3"), b"audio").unwrap();
        cleanup_temp_dir(&temporary).unwrap();
        assert!(!temporary.exists());

        let source = root.join("tagged.mp3");
        let destination = root.join("existing.mp3");
        fs::write(&source, b"new").unwrap();
        fs::write(&destination, b"existing").unwrap();
        assert!(move_without_overwrite(&source, &destination).is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"existing");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn config_is_persisted_without_source_media_or_credentials() {
        let root = env::temp_dir().join(format!(
            "myspace-download-settings-{}",
            uuid::Uuid::new_v4()
        ));
        let file = root.join("profile/media-tools.json");
        let manager = MediaDownloads::new(file.clone()).unwrap();
        manager
            .save_preferences(vec!["audio.example.org".into()], None)
            .unwrap();
        manager
            .save_preferences(vec!["music.example.net".into()], None)
            .unwrap();
        let persisted = fs::read_to_string(&file).unwrap();
        assert!(persisted.contains("music.example.net"));
        assert!(!persisted.contains("audio.example.org"));
        assert!(!persisted.contains("Shared Secret"));
        assert_eq!(
            MediaDownloads::new(file)
                .unwrap()
                .settings()
                .unwrap()
                .allowed_hosts,
            ["music.example.net"]
        );
        fs::remove_dir_all(root).unwrap();
    }
}
