const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: { type: String, index: true, unique: true },
  order_number: String,
  shipping_address: Object,
  customer: Object,
  shipping_lines: Array,
  line_items: Array,
  source_name: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);