const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('orders.db', { verbose: console.log }); // Optional verbose logging for debugging

// Create the 'orders' table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    json_data TEXT
  )
`).run();

// Insert a test order only if the table is empty
const row = db.prepare('SELECT COUNT(*) as count FROM orders').get();
if (row.count === 0) {
  db.prepare('INSERT INTO orders (id, json_data) VALUES (?, ?)').run('order_123', JSON.stringify({ customer: "John Doe", total: 49.99 }));
  console.log("Test order inserted.");
}

// Only start the server after the table is ready
app.use(express.static(path.join(__dirname, 'public')));

app.get('/orders', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM orders').all();
    res.json(rows);
  } catch (err) {
    console.error('Error reading orders:', err);
    res.status(500).send("Error reading orders.");
  }
});

app.listen(3000, () => {
  console.log('App running at http://localhost:3000');
});
