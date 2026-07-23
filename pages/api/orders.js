import dbConnect from "../../lib/dbConnect";
import Order from "../../lib/Order";
import Product from "../../lib/Product";
import { requireRole } from "../../lib/auth";
import { adjustStockForOrder } from "../../lib/stockHelper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    // Both Admin, Packer, and Agent can view orders
    const auth = requireRole(req, ["admin", "packer", "agent"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      let query = {};
      if (auth.user.role === "agent") {
        query = { agent: auth.user.id };
      }
      const orders = await Order.find(query)
        .populate("agent", "name username")
        .sort({ dateTime: -1 });
      return res.status(200).json(orders);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
  }

  if (req.method === "POST") {
    // Both Admin and Agent can add orders
    const auth = requireRole(req, ["admin", "agent"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin or Agent role required." });
    }

    try {
      const { name, address, phoneNumber, items, totalPrice, trackingNumber, courier, deliveryStatus, cashReceived, note, agent } = req.body;
      
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

      // Determine agent
      let finalAgentId = null;
      if (auth.user.role === "agent") {
        finalAgentId = auth.user.id;
      } else if (auth.user.role === "admin" && agent) {
        finalAgentId = agent;
      }

      // Fetch commissions per product and attach to order items
      const finalItems = await Promise.all(
        items.map(async (item) => {
          const product = await Product.findOne({ name: item.itemName });
          const commPerUnit = product ? (product.commission || 0) : 0;
          return {
            itemName: item.itemName,
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            commission: commPerUnit * (Number(item.quantity) || 1),
          };
        })
      );

      const totalCommission = finalItems.reduce((sum, it) => sum + it.commission, 0);

      const order = await Order.create({
        orderId,
        name,
        address,
        phoneNumber,
        items: finalItems,
        totalPrice: finalTotalPrice,
        agent: finalAgentId,
        totalCommission,
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
