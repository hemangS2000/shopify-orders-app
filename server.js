const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET || "your_shopify_secret";

app.use(bodyParser.raw({ type: "application/json" }));
app.use(express.static("public")); // Serve static files

// Webhook verification middleware
const verifyShopifyWebhook = (req, res, buf) => {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const generatedHash = crypto
    .createHmac("sha256", shopifySecret)
    .update(buf, "utf8")
    .digest("base64");

  if (!crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader || ""))) {
    throw new Error("Invalid signature");
  }
};

// Webhook handler
app.post("/webhook", (req, res) => {
  try {
    verifyShopifyWebhook(req, res, req.body);
    const payload = JSON.parse(req.body.toString("utf8"));
    
    // Store in database
    const stmt = db.prepare("INSERT OR REPLACE INTO orders (id, data) VALUES (?, ?)");
    stmt.run(payload.id, JSON.stringify(payload));
    
    // Notify SSE clients
    notifyClients();
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(401).send("Unauthorized");
  }
});

// API endpoints
app.get("/api/orders", (req, res) => {
  const orders = db.prepare("SELECT data FROM orders ORDER BY created_at DESC LIMIT 20").all();
  res.json(orders.map(o => JSON.parse(o.data)));
});

app.get("/api/orders/:id", (req, res) => {
  const order = db.prepare("SELECT data FROM orders WHERE id = ?")
    .get(req.params.id);
  
  if (order) {
    res.json(JSON.parse(order.data));
  } else {
    res.status(404).send("Order not found");
  }
});


// SSE setup
const clients = new Set();
function notifyClients() {
  clients.forEach(client => client.res.write(`data: update\n\n`));
}

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  const client = { id: Date.now(), res };
  clients.add(client);
  
  req.on("close", () => clients.delete(client));
});

// Serve UI from public directory
app.get("/orders", (req, res) => {
  res.sendFile("orders.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});