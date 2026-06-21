import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true }, // e.g. "Stock", "Courier", "Marketing", "Other"
  dateTime: { type: Date, default: Date.now },
});

delete mongoose.models.Expense;
export default mongoose.model("Expense", ExpenseSchema);
