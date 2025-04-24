require('dotenv').config();
const express  = require('express');
const crypto   = require('crypto');
const Database = require('better-sqlite3');
const path     = require('path');

const app = express();

// —————— MIDDLEWARE ——————

// 1) RAW parser for Shopify webhooks ONLY
app.use('/webhook', express.raw({ type: 'application/json' }));

// 2) JSON parser for everything else
app.use(express.json());

// 3) Serve static files from /public
app.use(express.static('public'));


// —————— DATABASE SETUP ——————

const dbPath = process.env.NODE_ENV === 'production'
  ? '/tmp/orders.db'
  : path.resolve(__dirname, 'orders.db');
const db = new Database(dbPath);

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


// —————— SHOPIFY HMAC VERIFICATION ——————

function verifyWebhook(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.body)              // raw Buffer from express.raw()
    .digest('base64');

  if (hash !== hmacHeader) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).send('Bad signature');
  }

  // parse the verified raw body into JSON for your handlers
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    console.error('❌ JSON parse error:', e);
    return res.status(400).send('Bad JSON');
  }

  next();
}


// —————— WEBHOOK ENDPOINT ——————

app.post('/webhook', verifyWebhook, (req, res) => {
  try {
    const order = req.body;

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

    db.prepare(`
      INSERT OR REPLACE INTO orders 
      (id, order_number, customer_name, email, phone, address, products, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderData.id,
      orderData.order_number,
      orderData.customer_name,
      orderData.email,
      orderData.phone,
      orderData.address,
      orderData.products,
      orderData.raw_json
    );

    console.log(`✅ Order ${orderData.order_number} saved`);
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).send('Error processing order');
  }
});


// —————— API ENDPOINTS ——————

app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json(orders);
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).send('Database error');
  }
});


// —————— START SERVER ——————

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database: ${dbPath}`);
});
