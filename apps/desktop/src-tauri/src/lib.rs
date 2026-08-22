/*
    The desktop shell.

    Rust stays configuration. Every product decision lives in TypeScript and runs
    identically in the browser; this file exists to give that same bundle a menu bar
    icon, a global hotkey, and a transparent panel to draw the quick capture window in.

    The global shortcut is registered here rather than from JavaScript on purpose. The
    handler has to work whether or not a window is focused, and driving it from Rust
    means the webview never needs the plugin's IPC surface at all.
*/

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

/// Default quick capture hotkey. Ten seconds, keyboard only, from anywhere in macOS.
const QUICK_CAPTURE: &str = "quickcapture";

fn toggle_quick_capture(window: &WebviewWindow) {
    let visible = window.is_visible().unwrap_or(false);
    if visible {
        let _ = window.hide();
    } else {
        let _ = window.show();
        /*
            show() alone is not enough. WindowConfig.focus defaulted to false from Tauri
            2.10.0, so a window that used to steal focus on create no longer does. For a
            Spotlight style panel that is the right default and the wrong behaviour: we
            want it unfocused until summoned, then focused the instant it is.
        */
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    /*
                        The handler fires on both Pressed and Released. Without this gate
                        every keypress toggles the window twice and it looks like the
                        hotkey does nothing at all.
                    */
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if let Some(window) = app.get_webview_window(QUICK_CAPTURE) {
                        toggle_quick_capture(&window);
                    }
                })
                .build(),
        )
        .setup(|app| {
            /*
                Accessory policy makes this a menu bar app: no Dock icon, no menu bar
                takeover when it is frontmost. The App form returns unit; the AppHandle
                form returns a Result, which is a trap worth remembering.
            */
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            let open_item = MenuItem::with_id(app, "open", "Open Continuity", true, None::<&str>)?;
            let capture_item = MenuItem::with_id(
                app,
                "capture",
                "Quick capture    Cmd Shift Space",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &capture_item, &quit_item])?;

            /*
                A template image is black plus alpha and nothing else. macOS tints it for
                the current menu bar. Any colour in the PNG, or a missing image-png
                feature, and the tray renders as a white blob.
            */
            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;

            TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("Continuity")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "capture" => {
                        if let Some(window) = app.get_webview_window(QUICK_CAPTURE) {
                            toggle_quick_capture(&window);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    /*
                        Left click opens quick capture. This is the first rung of the
                        documented fallback ladder: if the global shortcut ever fails to
                        register, the tray still reaches the same window.
                    */
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window(QUICK_CAPTURE) {
                            toggle_quick_capture(&window);
                        }
                    }
                })
                .build(app)?;

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let shortcut = Shortcut::new(
                    Some(Modifiers::SUPER | Modifiers::SHIFT),
                    Code::Space,
                );
                /*
                    Registration can legitimately fail: another app may already own this
                    combination. Log it and carry on rather than refusing to start. The
                    tray click above is the fallback, and the in window capture mode is
                    the fallback after that.
                */
                if let Err(err) = app.global_shortcut().register(shortcut) {
                    eprintln!("quick capture hotkey unavailable: {err}");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Continuity");
}
