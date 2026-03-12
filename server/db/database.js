const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let SQL;
let db;

// Wrapper to provide better-sqlite3-like API over sql.js
class Database {
  constructor(dbInstance) {
    this._db = dbInstance;
    this.open = true;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        const changes = self._db.getRowsModified();
        // Get last insert rowid
        const result = self._db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
        save();
        return { changes, lastInsertRowid };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => { row[c] = vals[i]; });
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => { row[c] = vals[i]; });
          rows.push(row);
        }
        stmt.free();
        return rows;
      }
    };
  }

  exec(sql) {
    this._db.run(sql);
    save();
  }

  pragma() {
    // no-op for sql.js
  }

  close() {
    this.open = false;
    // Don't actually close the shared instance
  }
}

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(config.dbPath, buffer);
}

async function init() {
  if (db) return new Database(db);
  SQL = await initSqlJs();

  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return new Database(db);
}

function getSync() {
  if (!db) return null;
  return new Database(db);
}

module.exports = { init, getSync, save };
