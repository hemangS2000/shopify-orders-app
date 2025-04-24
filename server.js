const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON body normally
app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("📬 Webhook received!");
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  res.status(200).send("✅ Webhook received");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
