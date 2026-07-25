#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

pub mod audio_cache;
pub mod commands;
pub mod db;
pub mod hotkeys;
pub mod quran_data;
pub mod reciters;
pub mod tray;

use tauri::{Emitter, Manager};

use std::sync::atomic::{AtomicU64, Ordering};

pub static LAST_BLUR_TIME: AtomicU64 = AtomicU64::new(0);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle();

            if let Err(err) = db::init_db(app_handle) {
                eprintln!("Failed to initialize database: {}", err);
            }

            if let Err(err) = tray::setup_tray(app_handle) {
                eprintln!("Failed to setup system tray: {}", err);
            }

            if let Err(err) = hotkeys::setup_hotkeys(app_handle) {
                eprintln!("Failed to setup global hotkeys: {}", err);
            }

            if let Some(window) = app_handle.get_webview_window("main") {
                // macOS: configure as floating overlay panel (hidden until tray click)
                #[cfg(target_os = "macos")]
                tray::configure_macos_window(&window);

                // Windows/Linux: show the window immediately on launch so the
                // user sees the app. This is expected behavior on these platforms.
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // macOS: prevent close and just hide — standard for menu-bar apps.
                // Windows/Linux: allow the close to proceed normally (app quits).
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = api; // suppress unused warning
                    // Let the default close behavior proceed — app will quit
                }
            }
            #[cfg(target_os = "macos")]
            tauri::WindowEvent::Focused(false) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                LAST_BLUR_TIME.store(now, Ordering::Relaxed);
                
                let win = window.clone();
                let _ = win.emit("popover-close-request", ());
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(140)).await;
                    let _ = win.hide();
                });
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_surahs,
            commands::get_surah,
            commands::get_page_info,
            commands::get_ayahs_for_page,
            commands::get_page_for_ayah,
            commands::get_ayah_range,
            commands::get_pages_for_range,
            commands::get_available_reciters,
            commands::ensure_ayah_audio,
            commands::is_ayah_cached,
            commands::get_cache_stats,
            commands::clear_cache,
            commands::save_current_session,
            commands::get_last_session,
            commands::add_bookmark,
            commands::get_bookmarks,
            commands::delete_bookmark,
            commands::record_page_review,
            commands::get_all_page_reviews,
            commands::save_user_setting,
            commands::get_all_user_settings,
            commands::download_surah_batch,
            commands::cancel_download_job,
            commands::get_surah_download_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
