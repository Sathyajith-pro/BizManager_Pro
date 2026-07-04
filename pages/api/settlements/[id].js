import dbConnect from "../../../lib/dbConnect";
import Settlement from "../../../lib/Settlement";
import Order from "../../../lib/Order";
import { requireRole } from "../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();
  const { id } = req.query;

  // Only Admin can delete/revert settlements
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "PUT") {
    try {
      const { courier, orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "At least one order is required to settle." });
      }

      const settlement = await Settlement.findById(id);
      if (!settlement) {
        return res.status(404).json({ error: "Settlement record not found." });
      }

      // Identify orderIds that are removed from this settlement
      const oldOrderIds = settlement.orders.map(o => o.toString());
      const newOrderIds = orderIds.map(o => o.toString());

      const removedOrderIds = oldOrderIds.filter(id => !newOrderIds.includes(id));
      const addedOrderIds = newOrderIds.filter(id => !oldOrderIds.includes(id));

      // Revert removed orders to cashReceived: "No"
      if (removedOrderIds.length > 0) {
        await Order.updateMany(
          { _id: { $in: removedOrderIds } },
          { $set: { cashReceived: "No" } }
        );
      }

      // Set added orders to cashReceived: "Yes"
      if (addedOrderIds.length > 0) {
        await Order.updateMany(
          { _id: { $in: addedOrderIds } },
          { $set: { cashReceived: "Yes" } }
        );
      }

      // Recalculate total amount from all selected orders (new list)
      const orders = await Order.find({ _id: { $in: newOrderIds } });
      const totalAmount = orders.reduce((sum, o) => sum + (o.totalPrice || o.price || 0), 0);

      settlement.courier = (courier || "").trim();
      settlement.orders = newOrderIds;
      settlement.totalAmount = totalAmount;
      await settlement.save();

      return res.status(200).json(settlement);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update settlement." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const settlement = await Settlement.findById(id);
      if (!settlement) {
        return res.status(404).json({ error: "Settlement record not found." });
      }

      // Revert cashReceived status of associated orders to "No"
      await Order.updateMany(
        { _id: { $in: settlement.orders } },
        { $set: { cashReceived: "No" } }
      );

      await Settlement.findByIdAndDelete(id);
      return res.status(200).json({ message: "Settlement deleted and order cash statuses reverted to pending." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete cash settlement." });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
