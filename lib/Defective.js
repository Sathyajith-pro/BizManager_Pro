import mongoose from "mongoose";

const DefectiveSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  reason: { type: String, default: "" },
  dateTime: { type: Date, default: Date.now },
});

delete mongoose.models.Defective;
export default mongoose.model("Defective", DefectiveSchema);
