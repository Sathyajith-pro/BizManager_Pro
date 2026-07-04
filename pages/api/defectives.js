import dbConnect from "../../lib/dbConnect";
import Defective from "../../lib/Defective";
import Product from "../../lib/Product";
import { requireRole } from "../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const auth = requireRole(req, ["admin", "packer"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      const logs = await Defective.find({}).sort({ dateTime: -1 });
      return res.status(200).json(logs);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch defective logs." });
    }
  }

  if (req.method === "POST") {
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const { productName, quantity, reason } = req.body;
      if (!productName || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ error: "Product name and positive quantity are required." });
      }

      // Verify product exists
      const product = await Product.findOne({ name: productName.trim() });
      if (!product) {
        return res.status(404).json({ error: "Product not found in inventory." });
      }

      // Decrement the product stock
      product.stock = product.stock - Number(quantity);
      await product.save();

      const log = await Defective.create({
        productName: productName.trim(),
        quantity: Number(quantity),
        reason: (reason || "").trim(),
      });

      return res.status(201).json(log);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create defective log." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
