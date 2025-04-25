require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
defaults and JSON parsing
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint
timeout handling, error catching
app.post('/proxy', async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  const query = `query($id: ID!) { product(id: $id) { images(first:1){edges{node{originalSrc}}} metafields(first:10){edges{node{id namespace key value}}}}}`;
  const variables = { id: `gid://shopify/Product/${productId}` };

  try {
    const response = await fetch(
      `${process.env.SHOPIFY_STORE_URL}/admin/api/2025-04/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({ query, variables })
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Shopify' });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));