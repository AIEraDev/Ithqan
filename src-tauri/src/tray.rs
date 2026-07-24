use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, LogicalPosition, Position,
};

/// Set the NSWindow level above fullscreen apps and make the window
/// background fully transparent to eliminate white corner bleed.
#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs)]
pub fn configure_macos_window(window: &tauri::WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::{id, NO};

    if let Ok(raw) = window.ns_window() {
        let ns_win: id = raw as id;
        unsafe {
            // Level 25 = NSStatusWindowLevel — renders above fullscreen apps
            ns_win.setLevel_(25);

            // Disable opaque so rounded corners don't bleed white
            let _: () = msg_send![ns_win, setOpaque: NO];

            // Set window background to fully transparent
            let clear_color: id = msg_send![class!(NSColor), clearColor];
            ns_win.setBackgroundColor_(clear_color);

            // Disable native window shadow completely
            ns_win.setHasShadow_(NO);

            // Collection behavior: canJoinAllSpaces (1<<0) + fullScreenAuxiliary (1<<4)
            let _: () = msg_send![ns_win, setCollectionBehavior: (1u64 << 0) | (1u64 << 4)];
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn configure_macos_window(_window: &tauri::WebviewWindow) {
    // No-op on non-macOS platforms
}

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let play_pause_i = MenuItemBuilder::with_id("play_pause", "Play / Pause").build(app)?;
    let replay_unit_i = MenuItemBuilder::with_id("replay_unit", "Replay Unit").build(app)?;
    let next_unit_i = MenuItemBuilder::with_id("next_unit", "Next Unit").build(app)?;
    let prev_unit_i = MenuItemBuilder::with_id("prev_unit", "Previous Unit").build(app)?;
    let show_hide_i = MenuItemBuilder::with_id("show_hide", "Toggle Ithqan Panel").build(app)?;
    let quit_i = MenuItemBuilder::with_id("quit", "Quit Ithqan").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide_i)
        .separator()
        .item(&play_pause_i)
        .item(&replay_unit_i)
        .item(&next_unit_i)
        .item(&prev_unit_i)
        .separator()
        .item(&quit_i)
        .build()?;

    let mut tray_builder = TrayIconBuilder::with_id("ithqan-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon_as_template(true);

    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
        .ok()
        .or_else(|| app.default_window_icon().cloned());

    if let Some(icon) = tray_icon {
        tray_builder = tray_builder.icon(icon);
    }

    let _tray = tray_builder
        .on_menu_event(move |app_handle, event| match event.id.as_ref() {
            "play_pause" => {
                let _ = app_handle.emit("tray-action", "play_pause");
            }
            "replay_unit" => {
                let _ = app_handle.emit("tray-action", "replay_unit");
            }
            "next_unit" => {
                let _ = app_handle.emit("tray-action", "next_unit");
            }
            "prev_unit" => {
                let _ = app_handle.emit("tray-action", "prev_unit");
            }
            "show_hide" => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        configure_macos_window(&window);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            "quit" => {
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app_handle = tray.app_handle();
                if let Some(window) = app_handle.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        // Position window directly under the tray icon
                        let scale_factor = window.scale_factor().unwrap_or(1.0);
                        let pos = rect.position.to_logical::<f64>(scale_factor);
                        let size = rect.size.to_logical::<f64>(scale_factor);

                        let win_width = 380.0;
                        let x = pos.x - (win_width / 2.0) + (size.width / 2.0);
                        let y = pos.y + size.height + 0.0;

                        let _ = window.set_position(Position::Logical(LogicalPosition::new(x, y)));

                        // Apply macOS window transparency + level above fullscreen
                        configure_macos_window(&window);

                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
