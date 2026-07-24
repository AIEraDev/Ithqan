use crate::reciters::{self, Reciter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

const BASE_EVERYAYAH_URL: &str = "https://everyayah.com/data";

static CANCEL_TOKENS: std::sync::OnceLock<Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>> =
    std::sync::OnceLock::new();

fn get_cancel_tokens() -> &'static Arc<Mutex<HashMap<String, Arc<AtomicBool>>>> {
    CANCEL_TOKENS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

pub fn cancel_download_job(job_id: &str) -> bool {
    let tokens = get_cancel_tokens();
    if let Ok(mut guard) = tokens.lock() {
        if let Some(flag) = guard.remove(job_id) {
            flag.store(true, Ordering::SeqCst);
            return true;
        }
    }
    false
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_files: usize,
    pub total_bytes: u64,
    pub human_readable_size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub job_id: String,
    pub reciter_id: String,
    pub surah: u8,
    pub current_ayah: u16,
    pub total_ayahs: u16,
    pub cached_count: u16,
    pub bytes_downloaded_current: u64,
    pub total_bytes_downloaded: u64,
    pub speed_bytes_per_sec: f64,
    pub status: String, // "queued" | "downloading" | "paused" | "completed" | "cancelled" | "error"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurahDownloadStatus {
    pub surah: u8,
    pub total_ayahs: u16,
    pub cached_ayahs: u16,
    pub is_fully_cached: bool,
    pub total_bytes: u64,
}

pub fn get_everyayah_filename(surah: u8, ayah: u16) -> String {
    format!("{:03}{:03}.mp3", surah, ayah)
}

pub fn get_everyayah_url(subfolder: &str, surah: u8, ayah: u16) -> String {
    format!(
        "{}/{}/{}",
        BASE_EVERYAYAH_URL,
        subfolder,
        get_everyayah_filename(surah, ayah)
    )
}

pub fn get_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("audio_cache"))
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

pub fn get_local_audio_path(
    cache_dir: &Path,
    subfolder: &str,
    surah: u8,
    ayah: u16,
) -> PathBuf {
    cache_dir
        .join(subfolder)
        .join(get_everyayah_filename(surah, ayah))
}

pub fn is_ayah_cached_at_path(path: &Path) -> bool {
    if let Ok(metadata) = fs::metadata(path) {
        metadata.is_file() && metadata.len() > 0
    } else {
        false
    }
}

pub async fn ensure_ayah_cached(
    app: &AppHandle,
    reciter_id: &str,
    surah: u8,
    ayah: u16,
) -> Result<String, String> {
    let reciter: Reciter = reciters::get_reciter_by_id(reciter_id)
        .ok_or_else(|| format!("Unknown reciter ID: {}", reciter_id))?;

    let cache_dir = get_cache_dir(app)?;
    let target_path = get_local_audio_path(&cache_dir, &reciter.subfolder, surah, ayah);

    // If already cached and non-empty, return path immediately
    if is_ayah_cached_at_path(&target_path) {
        return target_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Failed to convert path to string".to_string());
    }

    // Ensure directory exists
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create audio cache directory: {}", e))?;
    }

    // Download from EveryAyah.com
    let url = get_everyayah_url(&reciter.subfolder, surah, ayah);
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("HTTP request failed for {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download audio from {}: status {}",
            url,
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    if bytes.len() < 512 {
        return Err(format!(
            "Downloaded invalid or corrupted audio ({} bytes) from {}",
            bytes.len(),
            url
        ));
    }

    // Write to target file atomically
    let temp_path = target_path.with_extension("tmp");
    fs::write(&temp_path, &bytes)
        .map_err(|e| format!("Failed to write temporary audio file: {}", e))?;

    fs::rename(&temp_path, &target_path)
        .map_err(|e| format!("Failed to move audio file to cache target: {}", e))?;

    target_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid UTF-8 in target path".to_string())
}

pub fn is_ayah_cached(
    app: &AppHandle,
    reciter_id: &str,
    surah: u8,
    ayah: u16,
) -> Result<bool, String> {
    let reciter = reciters::get_reciter_by_id(reciter_id)
        .ok_or_else(|| format!("Unknown reciter ID: {}", reciter_id))?;
    let cache_dir = get_cache_dir(app)?;
    let target_path = get_local_audio_path(&cache_dir, &reciter.subfolder, surah, ayah);
    Ok(is_ayah_cached_at_path(&target_path))
}

pub fn get_surah_download_status(
    app: &AppHandle,
    reciter_id: &str,
    surah: u8,
) -> Result<SurahDownloadStatus, String> {
    let surah_info = crate::quran_data::get_surah(surah)
        .ok_or_else(|| format!("Invalid Surah number {}", surah))?;
    let reciter = reciters::get_reciter_by_id(reciter_id)
        .ok_or_else(|| format!("Unknown reciter ID: {}", reciter_id))?;
    let cache_dir = get_cache_dir(app)?;

    let mut cached_ayahs = 0;
    let mut total_bytes = 0;

    for ayah in 1..=surah_info.ayah_count {
        let path = get_local_audio_path(&cache_dir, &reciter.subfolder, surah, ayah);
        if is_ayah_cached_at_path(&path) {
            cached_ayahs += 1;
            if let Ok(meta) = fs::metadata(&path) {
                total_bytes += meta.len();
            }
        }
    }

    Ok(SurahDownloadStatus {
        surah,
        total_ayahs: surah_info.ayah_count,
        cached_ayahs,
        is_fully_cached: cached_ayahs == surah_info.ayah_count,
        total_bytes,
    })
}

pub async fn download_surah_batch(
    app: AppHandle,
    reciter_id: String,
    surah: u8,
    job_id: String,
) -> Result<(), String> {
    let surah_info = crate::quran_data::get_surah(surah)
        .ok_or_else(|| format!("Invalid Surah number {}", surah))?;
    let reciter = reciters::get_reciter_by_id(&reciter_id)
        .ok_or_else(|| format!("Unknown reciter ID: {}", reciter_id))?;
    let cache_dir = get_cache_dir(&app)?;

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let tokens = get_cancel_tokens();
        if let Ok(mut guard) = tokens.lock() {
            guard.insert(job_id.clone(), cancel_flag.clone());
        }
    }

    let mut cached_count: u16 = 0;
    let mut total_bytes_downloaded: u64 = 0;

    for ayah in 1..=surah_info.ayah_count {
        let path = get_local_audio_path(&cache_dir, &reciter.subfolder, surah, ayah);
        if is_ayah_cached_at_path(&path) {
            cached_count += 1;
            if let Ok(meta) = fs::metadata(&path) {
                total_bytes_downloaded += meta.len();
            }
        }
    }

    let mut payload = DownloadProgressPayload {
        job_id: job_id.clone(),
        reciter_id: reciter_id.clone(),
        surah,
        current_ayah: 0,
        total_ayahs: surah_info.ayah_count,
        cached_count,
        bytes_downloaded_current: 0,
        total_bytes_downloaded,
        speed_bytes_per_sec: 0.0,
        status: "downloading".to_string(),
        error: None,
    };

    let _ = app.emit("download-progress", &payload);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create reqwest client: {}", e))?;

    let start_time = Instant::now();

    for ayah in 1..=surah_info.ayah_count {
        if cancel_flag.load(Ordering::SeqCst) {
            payload.status = "cancelled".to_string();
            let _ = app.emit("download-progress", &payload);
            let tokens = get_cancel_tokens();
            if let Ok(mut guard) = tokens.lock() {
                guard.remove(&job_id);
            }
            return Ok(());
        }

        payload.current_ayah = ayah;
        let target_path = get_local_audio_path(&cache_dir, &reciter.subfolder, surah, ayah);

        if is_ayah_cached_at_path(&target_path) {
            let _ = app.emit("download-progress", &payload);
            continue;
        }

        if let Some(parent) = target_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let url = get_everyayah_url(&reciter.subfolder, surah, ayah);
        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                payload.error = Some(format!("Network error Ayah {}: {}", ayah, e));
                let _ = app.emit("download-progress", &payload);
                continue;
            }
        };

        if !resp.status().is_success() {
            payload.error = Some(format!("HTTP status {} for Ayah {}", resp.status(), ayah));
            let _ = app.emit("download-progress", &payload);
            continue;
        }

        let bytes = match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                payload.error = Some(format!("Read error Ayah {}: {}", ayah, e));
                let _ = app.emit("download-progress", &payload);
                continue;
            }
        };

        if bytes.len() >= 512 {
            let temp_path = target_path.with_extension("tmp");
            if fs::write(&temp_path, &bytes).is_ok() {
                let _ = fs::rename(&temp_path, &target_path);
                cached_count += 1;
                total_bytes_downloaded += bytes.len() as u64;
            }
        }

        let elapsed_secs = start_time.elapsed().as_secs_f64();
        let speed = if elapsed_secs > 0.0 {
            total_bytes_downloaded as f64 / elapsed_secs
        } else {
            0.0
        };

        payload.cached_count = cached_count;
        payload.total_bytes_downloaded = total_bytes_downloaded;
        payload.speed_bytes_per_sec = speed;
        payload.status = "downloading".to_string();
        payload.error = None;
        let _ = app.emit("download-progress", &payload);
    }

    payload.status = "completed".to_string();
    payload.speed_bytes_per_sec = 0.0;
    let _ = app.emit("download-progress", &payload);

    let tokens = get_cancel_tokens();
    if let Ok(mut guard) = tokens.lock() {
        guard.remove(&job_id);
    }

    Ok(())
}

pub fn get_cache_stats(app: &AppHandle) -> Result<CacheStats, String> {
    let cache_dir = get_cache_dir(app)?;
    if !cache_dir.exists() {
        return Ok(CacheStats {
            total_files: 0,
            total_bytes: 0,
            human_readable_size: "0 MB".to_string(),
        });
    }

    let mut total_files = 0;
    let mut total_bytes = 0;

    fn visit_dir(dir: &Path, files: &mut usize, bytes: &mut u64) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dir(&path, files, bytes);
                } else if path.is_file() {
                    if let Ok(meta) = fs::metadata(&path) {
                        *files += 1;
                        *bytes += meta.len();
                    }
                }
            }
        }
    }

    visit_dir(&cache_dir, &mut total_files, &mut total_bytes);

    let mb = total_bytes as f64 / (1024.0 * 1024.0);
    let human_readable = if mb >= 1024.0 {
        format!("{:.2} GB", mb / 1024.0)
    } else {
        format!("{:.1} MB", mb)
    };

    Ok(CacheStats {
        total_files,
        total_bytes,
        human_readable_size: human_readable,
    })
}

pub fn clear_cache(app: &AppHandle, reciter_id: Option<&str>) -> Result<u64, String> {
    let cache_dir = get_cache_dir(app)?;
    if !cache_dir.exists() {
        return Ok(0);
    }

    let target_dir = if let Some(r_id) = reciter_id {
        let reciter = reciters::get_reciter_by_id(r_id)
            .ok_or_else(|| format!("Unknown reciter ID: {}", r_id))?;
        cache_dir.join(reciter.subfolder)
    } else {
        cache_dir
    };

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Failed to clear audio cache: {}", e))?;
    }

    Ok(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_everyayah_url_formatting() {
        assert_eq!(get_everyayah_filename(1, 1), "001001.mp3");
        assert_eq!(get_everyayah_filename(2, 255), "002255.mp3");
        assert_eq!(get_everyayah_filename(114, 6), "114006.mp3");

        let url = get_everyayah_url("Alafasy_128kbps", 1, 1);
        assert_eq!(url, "https://everyayah.com/data/Alafasy_128kbps/001001.mp3");

        let url2 = get_everyayah_url("Husary_128kbps", 2, 255);
        assert_eq!(url2, "https://everyayah.com/data/Husary_128kbps/002255.mp3");
    }

    #[tokio::test]
    async fn test_download_and_cache_ayah() {
        let temp_dir = std::env::temp_dir().join("ithqan_test_audio_cache");
        let subfolder = "Alafasy_128kbps";
        let surah = 1;
        let ayah = 1;

        let target_path = get_local_audio_path(&temp_dir, subfolder, surah, ayah);
        let _ = fs::remove_file(&target_path);
        assert!(!is_ayah_cached_at_path(&target_path));

        // Create parent dir
        fs::create_dir_all(target_path.parent().unwrap()).unwrap();

        // Download Surah 1 Ayah 1
        let url = get_everyayah_url(subfolder, surah, ayah);
        let bytes = reqwest::get(&url).await.unwrap().bytes().await.unwrap();
        assert!(!bytes.is_empty());

        fs::write(&target_path, &bytes).unwrap();
        assert!(is_ayah_cached_at_path(&target_path));
        assert!(target_path.metadata().unwrap().len() > 1000); // MP3 is several KB

        let _ = fs::remove_file(&target_path);
    }
}

