import dbConnect from "../../lib/dbConnect";
import Expense from "../../lib/Expense";
import { requireRole } from "../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Require admin role
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "GET") {
    try {
      const expenses = await Expense.find({}).sort({ dateTime: -1 });
      return res.status(200).json(expenses);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch expenses." });
    }
  }

  if (req.method === "POST") {
    try {
      const { description, amount, category, dateTime } = req.body;
      if (!description || amount === undefined || !category) {
        return res.status(400).json({ error: "All fields are required." });
      }
      const expense = await Expense.create({
        description,
        amount: Number(amount),
        category,
        dateTime: dateTime ? new Date(dateTime) : new Date(),
      });
      return res.status(201).json(expense);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create expense." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
