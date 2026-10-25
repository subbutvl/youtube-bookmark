use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Row};
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
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file, read_legacy_db])
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
