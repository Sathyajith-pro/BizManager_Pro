import dbConnect from "../../lib/dbConnect";
import Order from "../../lib/Order";
import { requireRole } from "../../lib/auth";

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
      const { name, address, phoneNumber, items, trackingNumber, courier, deliveryStatus, cashReceived, note } = req.body;
      
      if (!name || !address || !phoneNumber || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Customer details and at least one item are required." });
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

      const totalPrice = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

      const order = await Order.create({
        orderId,
        name,
        address,
        phoneNumber,
        items,
        totalPrice,
        trackingNumber: trackingNumber || "",
        courier: courier || "",
        deliveryStatus: deliveryStatus || "Pending",
        cashReceived: cashReceived || "No",
        note: note || "",
      });

      return res.status(201).json(order);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create order." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
