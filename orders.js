const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: String,
  order_number: String,
  shipping_address: Object,
  customer: Object,
  shipping_lines: Array,
  line_items: Array,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);