use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Row};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl, WindowEvent};
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

const CHANNEL_VIEW: &str = "channel-view";

fn web_url(url: &str) -> Result<tauri::Url, String> {
    let parsed: tauri::Url = url.parse().map_err(|_| format!("Not a valid link: {url}"))?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Only web pages (http and https) open inside the app.".into());
    }
    Ok(parsed)
}

/// Shows a web page (a YouTube channel, or a saved link) inside the viewer drawer. Most sites
/// refuse to load in an iframe, so the page gets its own webview, placed over the drawer's body at the given
/// position and size (CSS pixels from the window's top-left). It has no app permissions:
/// the capabilities file only covers the main webview.
#[tauri::command]
async fn show_channel_view(app: tauri::AppHandle, url: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let parsed = web_url(&url)?;
    let (pos, size) = (LogicalPosition::new(x, y), LogicalSize::new(width, height));
    if let Some(view) = app.get_webview(CHANNEL_VIEW) {
        view.navigate(parsed).map_err(|e| e.to_string())?;
        view.set_position(pos).map_err(|e| e.to_string())?;
        view.set_size(size).map_err(|e| e.to_string())?;
        return view.show().map_err(|e| e.to_string());
    }
    let window = app.get_window("main").ok_or("The main window is gone.")?;
    window
        .add_child(WebviewBuilder::new(CHANNEL_VIEW, WebviewUrl::External(parsed)), pos, size)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Keeps the channel page lined up with the drawer when the window is resized.
#[tauri::command]
fn move_channel_view(app: tauri::AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    if let Some(view) = app.get_webview(CHANNEL_VIEW) {
        view.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        view.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Removes the channel page when the drawer closes.
#[tauri::command]
fn close_channel_view(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(view) = app.get_webview(CHANNEL_VIEW) {
        view.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Back, forward or reload in the drawer's web page.
#[tauri::command]
fn channel_view_nav(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let script = match action.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        _ => return Err(format!("Unknown action {action}")),
    };
    if let Some(view) = app.get_webview(CHANNEL_VIEW) {
        view.eval(script).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// A saved link's page, fetched once so the app can read its title, description and icons.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FetchedPage {
    final_url: String,
    html: String,
}

/// Only the start of a page is needed: the <head> holds everything the app reads.
const PAGE_LIMIT: usize = 768 * 1024;

#[tauri::command]
async fn fetch_page(url: String) -> Result<FetchedPage, String> {
    let parsed = web_url(&url)?;
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TubeMarks")
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .map_err(|e| e.to_string())?;
    let mut res = client
        .get(parsed)
        .header("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let final_url = res.url().to_string();
    if !res.status().is_success() {
        return Err(format!("The site answered {}", res.status()));
    }
    let is_html = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map_or(true, |ct| ct.contains("html"));
    if !is_html {
        return Ok(FetchedPage { final_url, html: String::new() });
    }
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        body.extend_from_slice(&chunk);
        if body.len() >= PAGE_LIMIT {
            break;
        }
    }
    Ok(FetchedPage { final_url, html: String::from_utf8_lossy(&body).into_owned() })
}

/// A feed (RSS or Atom) or a page that may point to one, as text.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FetchedText {
    final_url: String,
    content_type: String,
    body: String,
}

const FEED_LIMIT: usize = 4 * 1024 * 1024;

/// An error with its causes, so "error sending request" says why.
fn error_chain(e: &dyn std::error::Error) -> String {
    let mut out = e.to_string();
    let mut cur = e.source();
    while let Some(c) = cur {
        out.push_str(": ");
        out.push_str(&c.to_string());
        cur = c.source();
    }
    out
}

async fn get_feed(url: reqwest::Url, http1: bool) -> Result<reqwest::Response, reqwest::Error> {
    let mut builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(8));
    if http1 {
        builder = builder.http1_only();
    }
    builder
        .build()?
        .get(url)
        .header("Accept", "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.9,text/html;q=0.8,*/*;q=0.5")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
}

#[tauri::command]
async fn fetch_text(url: String) -> Result<FetchedText, String> {
    let parsed = web_url(&url)?;
    // Some servers drop HTTP/2 connections from non-browsers; retry once over HTTP/1.1.
    let mut res = match get_feed(parsed.clone(), false).await {
        Ok(r) => r,
        Err(_) => get_feed(parsed, true).await.map_err(|e| error_chain(&e))?,
    };
    let final_url = res.url().to_string();
    if !res.status().is_success() {
        return Err(format!("The site answered {}", res.status()));
    }
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        body.extend_from_slice(&chunk);
        if body.len() >= FEED_LIMIT {
            break;
        }
    }
    Ok(FetchedText { final_url, content_type, body: String::from_utf8_lossy(&body).into_owned() })
}

/// A browser's own bookmarks file (Chrome, Edge, Brave and other Chromium browsers).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserBookmarks {
    browser: String,
    profile: String,
    path: String,
}

/// Finds the Chromium bookmark files on this computer so they can be imported without
/// exporting them first. The files are only read later, never changed.
#[tauri::command]
fn browser_bookmark_files() -> Vec<BrowserBookmarks> {
    let mut roots: Vec<(&str, std::path::PathBuf)> = Vec::new();
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(std::path::PathBuf::from);
    if let Some(local) = std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from) {
        roots.push(("Chrome", local.join("Google/Chrome/User Data")));
        roots.push(("Edge", local.join("Microsoft/Edge/User Data")));
        roots.push(("Brave", local.join("BraveSoftware/Brave-Browser/User Data")));
    }
    if let Some(home) = home {
        roots.push(("Chrome", home.join("Library/Application Support/Google/Chrome")));
        roots.push(("Edge", home.join("Library/Application Support/Microsoft Edge")));
        roots.push(("Chrome", home.join(".config/google-chrome")));
        roots.push(("Chromium", home.join(".config/chromium")));
        roots.push(("Edge", home.join(".config/microsoft-edge")));
    }
    let mut out = Vec::new();
    for (browser, root) in roots {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        let mut found: Vec<_> = entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.join("Bookmarks").is_file())
            .collect();
        found.sort();
        for dir in found {
            let profile = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            out.push(BrowserBookmarks { browser: browser.into(), profile, path: dir.join("Bookmarks").to_string_lossy().into_owned() });
        }
    }
    out
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
    },
    Migration {
        version: 3,
        description: "add link bookmarks",
        sql: include_str!("../migrations/0003_links.sql"),
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "link tabs and manual groups",
        sql: include_str!("../migrations/0004_link_sections.sql"),
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "rss feeds",
        sql: include_str!("../migrations/0005_rss.sql"),
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
        // Closing the main window quits, even while a channel page is showing.
        .on_window_event(|w, e| {
            if w.label() == "main" && matches!(e, WindowEvent::Destroyed) {
                w.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file, read_legacy_db, show_channel_view, move_channel_view, close_channel_view, channel_view_nav, fetch_page, fetch_text, browser_bookmark_files])
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
