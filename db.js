const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open a database file
const db = new sqlite3.Database(path.resolve(__dirname, 'orders.db'), (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('✅ Connected to SQLite database.');
  }
});

// Create the orders table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      json_data TEXT
    )
  `);
});

module.exports = db;
