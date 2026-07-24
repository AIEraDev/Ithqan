use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionState {
    pub surah: u8,
    pub ayah: u16,
    pub page: u16,
    pub reciter_id: String,
    pub unit_type: String,
    pub start_page: u16,
    pub end_page: u16,
    pub repeat_count: u8,
    pub current_repetition: u8,
    #[serde(default)]
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Bookmark {
    pub id: i64,
    pub title: String,
    pub surah: u8,
    pub ayah: u16,
    pub page: u16,
    pub reciter_id: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PageReview {
    pub page: u16,
    pub last_reviewed_at: u64,
    pub review_count: u32,
}

fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    Ok(dir.join("ithqan.db"))
}

pub fn get_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = get_db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open SQLite database: {}", e))?;
    let _ = conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        ",
    );
    Ok(conn)
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let conn = get_connection(app)?;
    create_tables(&conn)
}

pub fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS session_state (
            id INTEGER PRIMARY KEY DEFAULT 1,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            page INTEGER NOT NULL,
            reciter_id TEXT NOT NULL,
            unit_type TEXT NOT NULL,
            start_page INTEGER NOT NULL,
            end_page INTEGER NOT NULL,
            repeat_count INTEGER NOT NULL,
            current_repetition INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            page INTEGER NOT NULL,
            reciter_id TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS review_history (
            page INTEGER PRIMARY KEY,
            last_reviewed_at INTEGER NOT NULL,
            review_count INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| format!("Failed to initialize database tables: {}", e))?;

    Ok(())
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn save_session(app: &AppHandle, session: SessionState) -> Result<(), String> {
    let conn = get_connection(app)?;
    let now = current_timestamp();

    conn.execute(
        "INSERT INTO session_state (id, surah, ayah, page, reciter_id, unit_type, start_page, end_page, repeat_count, current_repetition, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
            surah = excluded.surah,
            ayah = excluded.ayah,
            page = excluded.page,
            reciter_id = excluded.reciter_id,
            unit_type = excluded.unit_type,
            start_page = excluded.start_page,
            end_page = excluded.end_page,
            repeat_count = excluded.repeat_count,
            current_repetition = excluded.current_repetition,
            updated_at = excluded.updated_at;",
        params![
            session.surah,
            session.ayah,
            session.page,
            session.reciter_id,
            session.unit_type,
            session.start_page,
            session.end_page,
            session.repeat_count,
            session.current_repetition,
            now
        ],
    )
    .map_err(|e| format!("Failed to save session state: {}", e))?;

    Ok(())
}

pub fn get_last_session(app: &AppHandle) -> Result<Option<SessionState>, String> {
    let conn = get_connection(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT surah, ayah, page, reciter_id, unit_type, start_page, end_page, repeat_count, current_repetition, updated_at
             FROM session_state WHERE id = 1",
        )
        .map_err(|e| format!("Failed to prepare session query: {}", e))?;

    let session_res: SqlResult<SessionState> = stmt.query_row([], |row| {
        Ok(SessionState {
            surah: row.get(0)?,
            ayah: row.get(1)?,
            page: row.get(2)?,
            reciter_id: row.get(3)?,
            unit_type: row.get(4)?,
            start_page: row.get(5)?,
            end_page: row.get(6)?,
            repeat_count: row.get(7)?,
            current_repetition: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match session_res {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Error retrieving last session: {}", e)),
    }
}

pub fn add_bookmark(
    app: &AppHandle,
    title: String,
    surah: u8,
    ayah: u16,
    page: u16,
    reciter_id: String,
) -> Result<Bookmark, String> {
    let conn = get_connection(app)?;
    let now = current_timestamp();

    conn.execute(
        "INSERT INTO bookmarks (title, surah, ayah, page, reciter_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![title, surah, ayah, page, reciter_id, now],
    )
    .map_err(|e| format!("Failed to insert bookmark: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Bookmark {
        id,
        title,
        surah,
        ayah,
        page,
        reciter_id,
        created_at: now,
    })
}

pub fn get_bookmarks(app: &AppHandle) -> Result<Vec<Bookmark>, String> {
    let conn = get_connection(app)?;
    let mut stmt = conn
        .prepare("SELECT id, title, surah, ayah, page, reciter_id, created_at FROM bookmarks ORDER BY created_at DESC")
        .map_err(|e| format!("Failed to prepare bookmarks query: {}", e))?;

    let bookmark_iter = stmt
        .query_map([], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                title: row.get(1)?,
                surah: row.get(2)?,
                ayah: row.get(3)?,
                page: row.get(4)?,
                reciter_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Error querying bookmarks: {}", e))?;

    let mut result = Vec::new();
    for b in bookmark_iter {
        result.push(b.map_err(|e| format!("Error reading bookmark row: {}", e))?);
    }
    Ok(result)
}

pub fn delete_bookmark(app: &AppHandle, id: i64) -> Result<(), String> {
    let conn = get_connection(app)?;
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete bookmark {}: {}", id, e))?;
    Ok(())
}

pub fn record_page_review(app: &AppHandle, page: u16) -> Result<(), String> {
    let conn = get_connection(app)?;
    let now = current_timestamp();

    conn.execute(
        "INSERT INTO review_history (page, last_reviewed_at, review_count)
         VALUES (?1, ?2, 1)
         ON CONFLICT(page) DO UPDATE SET
            last_reviewed_at = excluded.last_reviewed_at,
            review_count = review_history.review_count + 1;",
        params![page, now],
    )
    .map_err(|e| format!("Failed to record page review for page {}: {}", page, e))?;

    Ok(())
}

pub fn get_all_page_reviews(app: &AppHandle) -> Result<Vec<PageReview>, String> {
    let conn = get_connection(app)?;
    let mut stmt = conn
        .prepare("SELECT page, last_reviewed_at, review_count FROM review_history ORDER BY page ASC")
        .map_err(|e| format!("Failed to prepare page reviews query: {}", e))?;

    let review_iter = stmt
        .query_map([], |row| {
            Ok(PageReview {
                page: row.get(0)?,
                last_reviewed_at: row.get(1)?,
                review_count: row.get(2)?,
            })
        })
        .map_err(|e| format!("Error querying review history: {}", e))?;

    let mut result = Vec::new();
    for r in review_iter {
        result.push(r.map_err(|e| format!("Error reading review row: {}", e))?);
    }
    Ok(result)
}

pub fn save_setting(app: &AppHandle, key: String, value: String) -> Result<(), String> {
    let conn = get_connection(app)?;
    conn.execute(
        "INSERT INTO user_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
        params![key, value],
    )
    .map_err(|e| format!("Failed to save setting {}: {}", key, e))?;
    Ok(())
}

pub fn get_all_settings(app: &AppHandle) -> Result<Vec<(String, String)>, String> {
    let conn = get_connection(app)?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM user_settings")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;

    let iter = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Error querying settings: {}", e))?;

    let mut result = Vec::new();
    for item in iter {
        result.push(item.map_err(|e| format!("Error reading setting row: {}", e))?);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_schema_and_operations() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        // Test Session Upsert
        conn.execute(
            "INSERT INTO session_state (id, surah, ayah, page, reciter_id, unit_type, start_page, end_page, repeat_count, current_repetition, updated_at)
             VALUES (1, 2, 255, 42, 'alafasy', 'page', 42, 42, 2, 1, 1000)
             ON CONFLICT(id) DO UPDATE SET surah=excluded.surah, ayah=excluded.ayah;",
            [],
        )
        .unwrap();

        let session: SessionState = conn
            .query_row("SELECT surah, ayah, page, reciter_id, unit_type, start_page, end_page, repeat_count, current_repetition, updated_at FROM session_state WHERE id=1", [], |row| {
                Ok(SessionState {
                    surah: row.get(0)?,
                    ayah: row.get(1)?,
                    page: row.get(2)?,
                    reciter_id: row.get(3)?,
                    unit_type: row.get(4)?,
                    start_page: row.get(5)?,
                    end_page: row.get(6)?,
                    repeat_count: row.get(7)?,
                    current_repetition: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .unwrap();

        assert_eq!(session.surah, 2);
        assert_eq!(session.ayah, 255);
        assert_eq!(session.page, 42);

        // Test Bookmarks CRUD
        conn.execute(
            "INSERT INTO bookmarks (title, surah, ayah, page, reciter_id, created_at) VALUES ('Test Bookmark', 1, 1, 1, 'alafasy', 12345)",
            [],
        )
        .unwrap();

        let b_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM bookmarks", [], |r| r.get(0))
            .unwrap();
        assert_eq!(b_count, 1);

        // Test Page Review History
        conn.execute(
            "INSERT INTO review_history (page, last_reviewed_at, review_count) VALUES (42, 1000, 1)
             ON CONFLICT(page) DO UPDATE SET review_count = review_history.review_count + 1;",
            [],
        )
        .unwrap();

        let rev_count: u32 = conn
            .query_row("SELECT review_count FROM review_history WHERE page=42", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rev_count, 1);
    }
}
