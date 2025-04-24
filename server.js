const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const connectDB = require("./db");
const Order = require("./orders");

const app = express();
const PORT = process.env.PORT || 3000;
const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;

// Connect to MongoDB
connectDB();

app.use(bodyParser.raw({ type: "application/json" }));
app.use(express.static("public"));

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

// Updated Webhook handler (MongoDB version)
app.post("/webhook", async (req, res) => {
  try {
    verifyShopifyWebhook(req, res, req.body);
    const payload = JSON.parse(req.body.toString("utf8"));
    
    // Create new order document
    const order = new Order({
      ...payload,
      id: payload.id.toString()
    });
    
    await order.save();
    notifyClients();
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(401).send("Unauthorized");
  }
});

// Updated API endpoints
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(20);
    res.json(orders);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).send("Order not found");
    res.json(order);
  } catch (error) {
    res.status(500).send("Server error");
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