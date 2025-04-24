const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET || "your_shopify_secret";

let latestOrders = []; // In-memory storage

app.use(bodyParser.raw({ type: "application/json" }));

function verifyShopifyWebhook(req, res, buf) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const generatedHash = crypto
    .createHmac("sha256", shopifySecret)
    .update(buf, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(generatedHash),
    Buffer.from(hmacHeader || "")
  );
}

app.post("/webhook", (req, res) => {
  if (!verifyShopifyWebhook(req, res, req.body)) {
    console.log("Webhook signature verification failed.");
    return res.status(401).send("Unauthorized");
  }

  const payload = JSON.parse(req.body.toString("utf8"));
  console.log("Received Shopify Webhook Order Payload:", payload);

  latestOrders.unshift(payload); // Add to top
  if (latestOrders.length > 20) latestOrders.pop(); // Keep only 20 entries

  res.status(200).send("Webhook received");
});

app.get("/orders", (req, res) => {
  const html = `
    <html>
      <head>
        <title>Shopify Orders</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h2>Latest Shopify Orders</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Order Number</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Address 1</th>
              <th>Address 2</th>
              <th>Country</th>
              <th>ZIP</th>
              <th>Province</th>
              <th>City</th>
              <th>Email</th>
              <th>Requires Shipping</th>
              <th>Shipping Code</th>
              <th>Line Item IDs</th>
            </tr>
          </thead>
          <tbody>
            ${latestOrders
              .map((order) => {
                const sa = order.shipping_address || {};
                const customer = order.customer || {};
                const shippingLine = (order.shipping_lines && order.shipping_lines[0]) || {};
                const lineItemIds = (order.line_items || [])
                  .map((item) => item.id)
                  .join(", ");

                return `
                  <tr>
                    <td>${order.id || ""}</td>
                    <td>${order.order_number || ""}</td>
                    <td>${sa.name || ""}</td>
                    <td>${sa.phone || ""}</td>
                    <td>${sa.address1 || ""}</td>
                    <td>${sa.address2 || ""}</td>
                    <td>${sa.country_code || ""}</td>
                    <td>${sa.zip || ""}</td>
                    <td>${sa.province || ""}</td>
                    <td>${sa.city || ""}</td>
                    <td>${customer.email || ""}</td>
                    <td>${order.requires_shipping}</td>
                    <td>${shippingLine.code || ""}</td>
                    <td>${lineItemIds}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
