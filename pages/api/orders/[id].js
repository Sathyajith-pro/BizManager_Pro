import dbConnect from "../../../lib/dbConnect";
import Order from "../../../lib/Order";
import { requireRole } from "../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();
  const { id } = req.query;

  if (req.method === "PATCH") {
    // Both Admin and Packer can PATCH
    const auth = requireRole(req, ["admin", "packer"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      const { deliveryStatus, cashReceived, trackingNumber, courier } = req.body;
      const updateData = {};

      // Role check: Only admin can toggle cash status
      if (cashReceived !== undefined) {
        if (auth.user.role !== "admin") {
          return res.status(403).json({ error: "Only admins can change cash status." });
        }
        updateData.cashReceived = cashReceived;
      }

      if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (courier !== undefined) updateData.courier = courier;

      const order = await Order.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      if (!order) return res.status(404).json({ error: "Order not found." });
      return res.status(200).json(order);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update order status." });
    }
  }

  if (req.method === "PUT") {
    // Only Admin can PUT
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const { name, address, phoneNumber, items, trackingNumber, courier, deliveryStatus, cashReceived, note } = req.body;
      
      if (!name || !address || !phoneNumber || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Customer details and at least one item are required." });
      }

      // Re-calculate total price
      const totalPrice = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

      const order = await Order.findByIdAndUpdate(
        id,
        { name, address, phoneNumber, items, totalPrice, trackingNumber, courier, deliveryStatus, cashReceived, note },
        { new: true, runValidators: true }
      );
      if (!order) return res.status(404).json({ error: "Order not found." });
      return res.status(200).json(order);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update order details." });
    }
  }

  if (req.method === "DELETE") {
    // Only Admin can DELETE
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const order = await Order.findByIdAndDelete(id);
      if (!order) return res.status(404).json({ error: "Order not found." });
      return res.status(200).json({ message: "Order deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete order." });
    }
  }

  res.setHeader("Allow", ["PATCH", "PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
