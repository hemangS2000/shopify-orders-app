const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./orders.db');

// Create the 'orders' table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    json_data TEXT
  )
`, (err) => {
  if (err) {
    console.error("Table creation error:", err);
    return;
  }

  // Insert a test order only if table creation was successful
  db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    if (row.count === 0) {
      db.run(`INSERT INTO orders (id, json_data) VALUES (?, ?)`, [
        'order_123',
        JSON.stringify({ customer: "John Doe", total: 49.99 })
      ]);
      console.log("Test order inserted.");
    }
  });

  // Only start the server after the table is ready
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/orders', (req, res) => {
    db.all('SELECT * FROM orders', (err, rows) => {
      if (err) {
        res.status(500).send("Error reading orders.");
        return;
      }
      res.json(rows);
    });
  });

  app.listen(3000, () => {
    console.log('App running at http://localhost:3000');
  });
});
