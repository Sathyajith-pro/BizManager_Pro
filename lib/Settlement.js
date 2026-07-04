import mongoose from "mongoose";

const SettlementSchema = new mongoose.Schema({
  courier: { type: String, default: "" },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  totalAmount: { type: Number, required: true },
  dateTime: { type: Date, default: Date.now },
});

delete mongoose.models.Settlement;
export default mongoose.model("Settlement", SettlementSchema);
