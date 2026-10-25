use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Row};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

/// One link from the old YouTube Organizer database.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LegacyItem {
    url: String,
    #[serde(rename = "type")]
    kind: String,
    watched: bool,
    /// Milliseconds since the Unix epoch.
    date_added: i64,
}

/// Reads links, types, watched flags and dates from the old app's .sqlite file,
/// opened read-only so the original is never changed.
#[tauri::command]
async fn read_legacy_db(path: String) -> Result<Vec<LegacyItem>, String> {
    let mut conn = SqliteConnectOptions::new()
        .filename(&path)
        .read_only(true)
        .connect()
        .await
        .map_err(|e| format!("Could not open {path}: {e}"))?;
    let rows = sqlx::query("SELECT url, type, watched, dateAdded FROM items ORDER BY dateAdded, id")
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("This doesn't look like a YouTube Organizer database: {e}"))?;
    Ok(rows
        .iter()
        .map(|r| LegacyItem {
            url: r.try_get("url").unwrap_or_default(),
            kind: r.try_get("type").unwrap_or_default(),
            watched: r.try_get::<i64, _>("watched").unwrap_or(0) != 0,
            date_added: r.try_get("dateAdded").unwrap_or(0),
        })
        .collect())
}

/// Reads a text file the user picked in an open dialog (used by Import).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Could not read {path}: {e}"))
}

/// Writes a text file to a path the user picked in a save dialog (used by Export).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("Could not write {path}: {e}"))
}

/// Opens a YouTube page (a channel) in the app's own browser window, reusing it if it's open.
/// YouTube pages refuse to load inside the main window's page, but a separate webview works.
/// That window gets no app permissions: the capabilities file only covers "main".
#[tauri::command]
async fn open_youtube_window(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|_| format!("Not a valid link: {url}"))?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || !(host == "youtube.com" || host.ends_with(".youtube.com")) {
        return Err("Only YouTube pages open inside the app.".into());
    }
    if let Some(w) = app.get_webview_window("youtube") {
        w.navigate(parsed).map_err(|e| e.to_string())?;
        let _ = w.set_title(&title);
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "youtube", WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1280.0, 860.0)
        .min_inner_size(640.0, 480.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn migrations() -> Vec<Migration> {
    vec![
    Migration {
        version: 1,
        description: "create library tables",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add channel link",
        sql: include_str!("../migrations/0002_channel_url.sql"),
        kind: MigrationKind::Up,
    }]
}

/// Brings the main window back from the tray (or from behind other windows).
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Tray icon: left click shows the window; the menu has Show and Quit.
/// The window hides itself to the tray from the title bar's minimize button.
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show TubeMarks", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("TubeMarks")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tubemarks.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        // Closing the main window quits, even if a channel window is still open.
        .on_window_event(|w, e| {
            if w.label() == "main" && matches!(e, WindowEvent::Destroyed) {
                w.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file, read_legacy_db, open_youtube_window])
        .run(tauri::generate_context!())
        .expect("error while running TubeMarks");
}

#[cfg(test)]
mod tests {
    /// Run with LEGACY_DB=/path/to/youtube-organizer.sqlite to check against a real file.
    #[test]
    fn reads_legacy_db_when_given() {
        let Ok(path) = std::env::var("LEGACY_DB") else { return };
        let items = tauri::async_runtime::block_on(super::read_legacy_db(path)).unwrap();
        assert!(!items.is_empty());
        assert!(items.iter().all(|i| i.url.contains("youtu") && !i.kind.is_empty() && i.date_added > 0));
        println!("{} items, {} watched", items.len(), items.iter().filter(|i| i.watched).count());
    }
}
