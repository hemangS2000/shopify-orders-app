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
app.use(express.json());
app.use(express.static("public"));

// Webhook verification middleware
const verifyShopifyWebhook = (req, res, buf) => {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const generatedHash = crypto
    .createHmac("sha256", shopifySecret)
    .update(buf, "utf8")
    .digest("base64");

  if (!hmacHeader || !crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader))) {
    throw new Error("Invalid signature");
  }
};

// Webhook handler
app.post("/webhook", async (req, res) => {
  try {
    verifyShopifyWebhook(req, res, req.body);
    const payload = JSON.parse(req.body.toString("utf8"));
    
    const existingOrder = await Order.findOne({ id: payload.id.toString() });
    if (existingOrder) return res.status(200).send("Order exists");

    const order = new Order({
      ...payload,
      id: payload.id.toString(),
      createdAt: new Date(payload.created_at)
    });
    
    await order.save();
    notifyClients();
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(401).send("Unauthorized");
  }
});

// Product details endpoint
app.post("/api/product-details", async (req, res) => {
  try {
    const { productIds } = req.body;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const storeUrl = process.env.SHOPIFY_STORE_URL;

    const results = await Promise.all(productIds.map(async (productId) => {
      const response = await fetch(`${storeUrl}/admin/api/2025-04/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query: `query ($id: ID!) {
            product(id: $id) {
              images(first: 1) {
                edges { node { originalSrc } }
              }
              metafields(first: 10) {
                edges { node { namespace, key, value } }
              }
            }
          }`,
          variables: { id: `gid://shopify/Product/${productId}` }
        })
      });
      return response.json();
    }));

    res.json(results);
  } catch (error) {
    console.error("Product details error:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

// API endpoints
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
  clients.forEach(client => {
    try {
      client.res.write(`data: update\n\n`);
    } catch (err) {
      console.error("Client connection error:", err);
    }
  });
}

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const client = { id: Date.now(), res };
  clients.add(client);

  req.on("close", () => {
    clients.delete(client);
    console.log(`Client ${client.id} disconnected`);
  });
});

// Serve UI
app.get("/orders", (req, res) => {
  res.sendFile("orders.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});