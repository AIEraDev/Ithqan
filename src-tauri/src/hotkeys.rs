use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn setup_hotkeys(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let play_pause_sc = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    let replay_sc = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyR);
    let next_sc = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::ArrowRight);
    let prev_sc = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::ArrowLeft);

    let app_handle_play = app.clone();
    let _ = app.global_shortcut().on_shortcut(play_pause_sc, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app_handle_play.emit("tray-action", "play_pause");
        }
    });

    let app_handle_replay = app.clone();
    let _ = app.global_shortcut().on_shortcut(replay_sc, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app_handle_replay.emit("tray-action", "replay_unit");
        }
    });

    let app_handle_next = app.clone();
    let _ = app.global_shortcut().on_shortcut(next_sc, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app_handle_next.emit("tray-action", "next_unit");
        }
    });

    let app_handle_prev = app.clone();
    let _ = app.global_shortcut().on_shortcut(prev_sc, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app_handle_prev.emit("tray-action", "prev_unit");
        }
    });

    Ok(())
}
