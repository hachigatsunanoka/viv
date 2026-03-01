mod commands;

#[derive(Default)]
pub struct AppState {
    pub current_board_path: std::sync::Mutex<Option<std::path::PathBuf>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::download_video,
            commands::get_config,
            commands::save_config,
            commands::save_board_archive,
            commands::load_board_archive,
            commands::save_current_board,
            commands::get_current_file_path,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- System Tray ---
            #[cfg(desktop)]
            {
                use tauri::{
                    menu::{Menu, MenuItem},
                    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
                    Manager,
                };

                let show_hide_i =
                    MenuItem::with_id(app, "show_hide", "Show / Hide", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_hide_i, &quit_i])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            // --- Global Shortcut: Right Alt to toggle visibility ---
            // Windows RegisterHotKey cannot register modifier keys alone,
            // so we use GetAsyncKeyState polling for VK_RMENU (Right Alt).
            #[cfg(windows)]
            {
                use tauri::Manager;

                extern "system" {
                    fn GetAsyncKeyState(v_key: i32) -> i16;
                }
                const VK_RMENU: i32 = 0xA5; // Right Alt

                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut was_pressed = false;
                    loop {
                        let pressed =
                            unsafe { GetAsyncKeyState(VK_RMENU) & (0x8000u16 as i16) != 0 };

                        if pressed && !was_pressed {
                            if let Some(window) = handle.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        was_pressed = pressed;
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }
                });
            }

            Ok(())
        })
        // Hide to tray on window close instead of quitting
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
