/**
 * SQLite schema and migration entry for offline financial records.
 *
 * Owns the only direct expo-sqlite access in the foundation. Other modules
 * read/write offline records through LocalRecordsRepository, not the database
 * handle. Constitution Principle V and research Decision 3.
 */

import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'masarifi.db';
const CURRENT_SCHEMA_VERSION = 1;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = createAndMigrate();
  }
  return databasePromise;
}

/**
 * Reset the cached connection. Test-only seam; production code never calls it.
 */
export function resetDatabaseForTests(): void {
  databasePromise = null;
}

async function createAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await runMigrations(db);
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_entries (
      local_id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency_code TEXT NOT NULL,
      category_key TEXT NOT NULL,
      note TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_error_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_offline_entries_sync_status
      ON offline_entries(sync_status);
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  if (!appliedVersions.has(CURRENT_SCHEMA_VERSION)) {
    await db.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      CURRENT_SCHEMA_VERSION,
      Date.now()
    );
  }
}
