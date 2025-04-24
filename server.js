require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto'); // For Shopify HMAC verification

const app = express();

// Database setup - uses Render's persistent /tmp directory
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/orders.db' 
  : path.resolve(__dirname, 'orders.db');

const db = new Database(dbPath);

// Create orders table
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

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Shopify Webhook Verification
const verifyWebhook = (req, res, next) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body)
    .digest('base64');

  if (hash !== hmac) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).send();
  }
  next();
};

// Webhook Endpoint
app.post('/webhook', verifyWebhook, (req, res) => {
  try {
    const order = req.body;
    
    // Extract key data
    const orderData = {
      id: order.id,
      order_number: order.order_number,
      customer_name: `${order.shipping_address?.first_name} ${order.shipping_address?.last_name}`,
      email: order.email,
      phone: order.shipping_address?.phone,
      address: `${order.shipping_address?.address1}, ${order.shipping_address?.city}`,
      products: order.line_items.map(item => item.title).join(', '),
      raw_json: JSON.stringify(order)
    };

    // Save to database
    db.prepare(`
      INSERT OR REPLACE INTO orders 
      (id, order_number, customer_name, email, phone, address, products, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...Object.values(orderData));

    console.log(`✅ Order ${order.order_number} saved`);
    res.status(200).send('Webhook processed');

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error processing order');
  }
});

// API Endpoints
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json(orders);
  } catch (err) {
    res.status(500).send('Database error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database: ${dbPath}`);
});