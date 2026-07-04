import dbConnect from "../../lib/dbConnect";
import Settlement from "../../lib/Settlement";
import Order from "../../lib/Order";
import { requireRole } from "../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const auth = requireRole(req, ["admin", "packer"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      const settlements = await Settlement.find({})
        .populate("orders", "orderId name totalPrice")
        .sort({ dateTime: -1 });
      return res.status(200).json(settlements);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch settlements." });
    }
  }

  if (req.method === "POST") {
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const { courier, orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "At least one order is required." });
      }

      // Fetch select orders to calculate total amount
      const orders = await Order.find({ _id: { $in: orderIds } });
      if (orders.length === 0) {
        return res.status(400).json({ error: "No valid orders found to settle." });
      }

      const totalAmount = orders.reduce((sum, o) => sum + (o.totalPrice || o.price || 0), 0);

      // Create settlement record
      const settlement = await Settlement.create({
        courier: (courier || "").trim(),
        orders: orderIds,
        totalAmount,
      });

      // Update cashReceived status of these orders to "Yes"
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { $set: { cashReceived: "Yes" } }
      );

      return res.status(201).json(settlement);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to record cash settlement." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
