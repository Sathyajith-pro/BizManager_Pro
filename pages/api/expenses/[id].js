import dbConnect from "../../../lib/dbConnect";
import Expense from "../../../lib/Expense";
import { requireRole } from "../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Require admin role
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const { description, amount, category, dateTime } = req.body;
      if (!description || amount === undefined || !category) {
        return res.status(400).json({ error: "All fields are required." });
      }
      const expense = await Expense.findByIdAndUpdate(
        id,
        {
          description,
          amount: Number(amount),
          category,
          dateTime: dateTime ? new Date(dateTime) : new Date(),
        },
        { new: true, runValidators: true }
      );
      if (!expense) return res.status(404).json({ error: "Expense not found." });
      return res.status(200).json(expense);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update expense." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const expense = await Expense.findByIdAndDelete(id);
      if (!expense) return res.status(404).json({ error: "Expense not found." });
      return res.status(200).json({ message: "Expense deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete expense." });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
