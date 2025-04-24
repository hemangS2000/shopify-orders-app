require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const app = express();

// Setup raw body capturing
const rawBodySaver = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
};

// Use middleware to capture raw body
app.use(express.json({ verify: rawBodySaver }));
app.use(express.static('public'));

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/orders.db' 
  : path.resolve(__dirname, 'orders.db');
const db = new Database(dbPath);

// Create table
db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    products TEXT,
    raw_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ✅ Shopify Webhook HMAC verification
const verifyWebhook = (req, res, next) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, 'utf8')
    .digest('base64');

  if (generatedHash !== hmacHeader) {
    console.error('❌ Invalid HMAC signature');
    return res.status(401).send('Invalid signature');
  }
  next();
};

// ✅ Webhook endpoint
app.post('/webhook', verifyWebhook, (req, res) => {
  try {
    const order = req.body;
    console.log(`📦 Webhook received for Order #${order.order_number}`);

    const orderData = {
      id: order.id,
      order_number: order.order_number,
      customer_name: `${order.shipping_address?.first_name} ${order.shipping_address?.last_name}`,
      email: order.email,
      phone: order.shipping_address?.phone,
      address: `${order.shipping_address?.address1}, ${order.shipping_address?.city}`,
      products: order.line_items.map(item => item.title).join(', '),
      raw_json: JSON.stringify(order),
    };

    db.prepare(`
      INSERT OR REPLACE INTO orders 
      (id, order_number, customer_name, email, phone, address, products, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...Object.values(orderData));

    console.log(`✅ Saved Order #${order.order_number}`);
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// API to view saved orders
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json(orders);
  } catch (err) {
    res.status(500).send('Database error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database path: ${dbPath}`);
});
