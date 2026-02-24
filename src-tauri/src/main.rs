#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                #[cfg(target_os = "macos")]
                let edit_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyE);
                #[cfg(target_os = "macos")]
                let preview_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyR);
                #[cfg(target_os = "macos")]
                let split_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::Backslash);
                #[cfg(not(target_os = "macos"))]
                let edit_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyE);
                #[cfg(not(target_os = "macos"))]
                let preview_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyR);
                #[cfg(not(target_os = "macos"))]
                let split_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Backslash);

                let edit_shortcut_for_handler = edit_shortcut.clone();
                let preview_shortcut_for_handler = preview_shortcut.clone();
                let split_shortcut_for_handler = split_shortcut.clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }

                            if shortcut == &edit_shortcut_for_handler {
                                let _ = app.emit("blinkmd://shortcut-edit-mode", ());
                            } else if shortcut == &preview_shortcut_for_handler {
                                let _ = app.emit("blinkmd://shortcut-preview-mode", ());
                            } else if shortcut == &split_shortcut_for_handler {
                                let _ = app.emit("blinkmd://shortcut-split-mode", ());
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(edit_shortcut)?;
                app.global_shortcut().register(preview_shortcut)?;
                app.global_shortcut().register(split_shortcut)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health::ping,
            commands::file::open_file,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
