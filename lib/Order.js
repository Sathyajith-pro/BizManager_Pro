import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true }, // unit or total price for this item
  commission: { type: Number, required: true, default: 0 },
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  dateTime: { type: Date, default: Date.now },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, default: "" },
  items: [OrderItemSchema],
  totalPrice: { type: Number, required: true, default: 0 },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  totalCommission: { type: Number, required: true, default: 0 },
  trackingNumber: { type: String, default: "" },
  courier: { type: String, default: "" },
  deliveryStatus: { 
    type: String, 
    enum: ["Pending", "Delivered", "Return", "Completed"], 
    default: "Pending" 
  },
  cashReceived: { type: String, enum: ["Yes", "No"], default: "No" },
  note: { type: String, default: "" },
});

delete mongoose.models.Order;
export default mongoose.model("Order", OrderSchema);
