use crate::audio_cache::{self, CacheStats};
use crate::db::{self, Bookmark, PageReview, SessionState};
use crate::quran_data::{self, AyahLocation, PageInfo, Surah};
use crate::reciters::{self, Reciter};

#[tauri::command]
pub fn get_surahs() -> Vec<Surah> {
    quran_data::get_surahs().to_vec()
}

#[tauri::command]
pub fn get_surah(surah_number: u8) -> Result<Surah, String> {
    quran_data::get_surah(surah_number)
        .ok_or_else(|| format!("Surah {} not found", surah_number))
}

#[tauri::command]
pub fn get_page_info(page_number: u16) -> Result<PageInfo, String> {
    quran_data::get_page_info(page_number)
        .ok_or_else(|| format!("Page {} not found", page_number))
}

#[tauri::command]
pub fn get_ayahs_for_page(page_number: u16) -> Vec<AyahLocation> {
    quran_data::get_ayahs_for_page(page_number)
}

#[tauri::command]
pub fn get_page_for_ayah(surah_number: u8, ayah_number: u16) -> Result<u16, String> {
    quran_data::get_page_for_ayah(surah_number, ayah_number)
        .ok_or_else(|| format!("Ayah {}:{} not found", surah_number, ayah_number))
}

#[tauri::command]
pub fn get_ayah_range(
    surah_number: u8,
    start_ayah: u16,
    end_ayah: u16,
) -> Result<Vec<AyahLocation>, String> {
    quran_data::get_ayah_range(surah_number, start_ayah, end_ayah)
}

#[tauri::command]
pub fn get_pages_for_range(start_page: u16, end_page: u16) -> Vec<PageInfo> {
    quran_data::get_pages_for_range(start_page, end_page)
}

// Reciter & Audio Cache Commands

#[tauri::command]
pub fn get_available_reciters() -> Vec<Reciter> {
    reciters::get_default_reciters()
}

#[tauri::command]
pub async fn ensure_ayah_audio(
    app: tauri::AppHandle,
    reciter_id: String,
    surah: u8,
    ayah: u16,
) -> Result<String, String> {
    audio_cache::ensure_ayah_cached(&app, &reciter_id, surah, ayah).await
}

#[tauri::command]
pub fn is_ayah_cached(
    app: tauri::AppHandle,
    reciter_id: String,
    surah: u8,
    ayah: u16,
) -> Result<bool, String> {
    audio_cache::is_ayah_cached(&app, &reciter_id, surah, ayah)
}

#[tauri::command]
pub fn get_cache_stats(app: tauri::AppHandle) -> Result<CacheStats, String> {
    audio_cache::get_cache_stats(&app)
}

#[tauri::command]
pub fn clear_cache(
    app: tauri::AppHandle,
    reciter_id: Option<String>,
) -> Result<(), String> {
    audio_cache::clear_cache(&app, reciter_id.as_deref())?;
    Ok(())
}

// Database & Session Memory Commands

#[tauri::command]
pub fn save_current_session(
    app: tauri::AppHandle,
    session: SessionState,
) -> Result<(), String> {
    db::save_session(&app, session)
}

#[tauri::command]
pub fn get_last_session(
    app: tauri::AppHandle,
) -> Result<Option<SessionState>, String> {
    db::get_last_session(&app)
}

#[tauri::command]
pub fn add_bookmark(
    app: tauri::AppHandle,
    title: String,
    surah: u8,
    ayah: u16,
    page: u16,
    reciter_id: String,
) -> Result<Bookmark, String> {
    db::add_bookmark(&app, title, surah, ayah, page, reciter_id)
}

#[tauri::command]
pub fn get_bookmarks(app: tauri::AppHandle) -> Result<Vec<Bookmark>, String> {
    db::get_bookmarks(&app)
}

#[tauri::command]
pub fn delete_bookmark(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    db::delete_bookmark(&app, id)
}

#[tauri::command]
pub fn record_page_review(app: tauri::AppHandle, page: u16) -> Result<(), String> {
    db::record_page_review(&app, page)
}

#[tauri::command]
pub fn get_all_page_reviews(app: tauri::AppHandle) -> Result<Vec<PageReview>, String> {
    db::get_all_page_reviews(&app)
}

#[tauri::command]
pub fn save_user_setting(
    app: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    db::save_setting(&app, key, value)
}

#[tauri::command]
pub fn get_all_user_settings(
    app: tauri::AppHandle,
) -> Result<Vec<(String, String)>, String> {
    db::get_all_settings(&app)
}
