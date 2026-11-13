const { DatabaseSync } = require('node:sqlite');

const ISSUE_TYPES = ['discoloration', 'odor', 'outage', 'broken_infrastructure', 'sanitation_gap', 'other'];
const STATUSES = ['open', 'verified', 'forwarded', 'rejected', 'resolved'];
const DURATIONS = ['today', 'few_days', 'week_plus'];
const USABLE = ['yes', 'no', 'unsure'];
const GRID = 0.001;

const coarse = (v) => Math.round(Math.round(v / GRID) * GRID * 1e6) / 1e6;

function openDb(file = process.env.DB_FILE || ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity INTEGER NOT NULL,
      duration TEXT NOT NULL,
      water_usable TEXT NOT NULL,
      contact_email TEXT NOT NULL DEFAULT '',
      has_photo INTEGER NOT NULL DEFAULT 0,
      precise_lat REAL NOT NULL,
      precise_lng REAL NOT NULL,
      public_lat REAL NOT NULL,
      public_lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      moderator_note TEXT NOT NULL DEFAULT '',
      submitter_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES reports(id),
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      changed_at TEXT NOT NULL
    );
  `);
  return db;
}

module.exports = { openDb, coarse, ISSUE_TYPES, STATUSES, DURATIONS, USABLE };
