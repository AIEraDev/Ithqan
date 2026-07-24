use crate::reciters::{self, Reciter};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const BASE_EVERYAYAH_URL: &str = "https://everyayah.com/data";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_files: usize,
    pub total_bytes: u64,
    pub human_readable_size: String,
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
