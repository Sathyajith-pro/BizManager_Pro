import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  stock: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true, default: 0 },
  warranty: { type: String, default: "" },
  dateTime: { type: Date, default: Date.now },
});

delete mongoose.models.Product;
export default mongoose.model("Product", ProductSchema);
