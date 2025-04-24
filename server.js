const express = require("express");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

// Parse raw body for signature validation
app.use(
  "/webhook",
  bodyParser.raw({ type: "application/json" })
);

// Basic logger for debugging
app.use((req, res, next) => {
  console.log(`📥 Received ${req.method} request on ${req.url}`);
  next();
});

// Webhook endpoint
app.post("/webhook", (req, res) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const topic = req.headers["x-shopify-topic"];
  const shop = req.headers["x-shopify-shop-domain"];

  // Validate signature
  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(req.body, "utf8")
    .digest("base64");

  if (digest !== hmac) {
    console.log("❌ Invalid webhook signature.");
    return res.status(401).send("Invalid signature");
  }

  const payload = JSON.parse(req.body.toString());
  console.log(`✅ Webhook received from ${shop} for ${topic}`);
  console.log(payload);

  // Optional: Save to file or database
  fs.writeFileSync("latest-webhook.json", JSON.stringify(payload, null, 2));

  res.status(200).send("Webhook received");
});

// Test endpoint
app.get("/api/orders", (req, res) => {
  if (fs.existsSync("latest-webhook.json")) {
    const data = fs.readFileSync("latest-webhook.json");
    res.type("json").send(data);
  } else {
    res.json({ message: "No orders yet" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
