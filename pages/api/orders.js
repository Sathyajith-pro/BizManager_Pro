import dbConnect from "../../lib/dbConnect";
import Order from "../../lib/Order";
import { requireRole } from "../../lib/auth";
import { adjustStockForOrder } from "../../lib/stockHelper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    // Both Admin and Packer can view orders
    const auth = requireRole(req, ["admin", "packer"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      const orders = await Order.find({}).sort({ dateTime: -1 });
      return res.status(200).json(orders);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
  }

  if (req.method === "POST") {
    // Only Admin can add orders
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const { name, address, phoneNumber, items, totalPrice, trackingNumber, courier, deliveryStatus, cashReceived, note } = req.body;
      
      if (!name || !address || !items || !Array.isArray(items) || items.length === 0 || totalPrice === undefined || totalPrice === "" || isNaN(Number(totalPrice))) {
        return res.status(400).json({ error: "Customer name, address, at least one item, and Total Price (Rs.) are required." });
      }

      // Generate sequential orderId
      const lastOrder = await Order.findOne({}).sort({ dateTime: -1 });
      let newIdNum = 1001;
      if (lastOrder && lastOrder.orderId) {
        const match = lastOrder.orderId.match(/ORD-(\d+)/);
        if (match) {
          newIdNum = parseInt(match[1], 10) + 1;
        }
      }
      const orderId = `ORD-${newIdNum}`;

      const finalTotalPrice = Number(totalPrice);

      const order = await Order.create({
        orderId,
        name,
        address,
        phoneNumber,
        items,
        totalPrice: finalTotalPrice,
        trackingNumber: trackingNumber || "",
        courier: courier || "",
        deliveryStatus: deliveryStatus || "Pending",
        cashReceived: cashReceived || "No",
        note: note || "",
      });

      // Deduct stock for the new order
      await adjustStockForOrder(null, order);

      return res.status(201).json(order);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create order." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
