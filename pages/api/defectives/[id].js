import dbConnect from "../../../lib/dbConnect";
import Defective from "../../../lib/Defective";
import Product from "../../../lib/Product";
import { requireRole } from "../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();
  const { id } = req.query;

  // Only Admin can delete/resolve defective logs
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "PUT") {
    try {
      const { productName, quantity, reason } = req.body;
      if (!productName || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ error: "Product name and positive quantity are required." });
      }

      const log = await Defective.findById(id);
      if (!log) return res.status(404).json({ error: "Defective log not found." });

      // If product name changed, restore old product stock and deduct new product stock
      if (log.productName !== productName.trim()) {
        const oldProd = await Product.findOne({ name: log.productName });
        if (oldProd) {
          oldProd.stock = oldProd.stock + log.quantity;
          await oldProd.save();
        }

        const newProd = await Product.findOne({ name: productName.trim() });
        if (newProd) {
          newProd.stock = newProd.stock - Number(quantity);
          await newProd.save();
        }
      } else {
        // Adjust stock on the same product
        const qtyDiff = Number(quantity) - log.quantity;
        const product = await Product.findOne({ name: productName.trim() });
        if (product) {
          product.stock = product.stock - qtyDiff;
          await product.save();
        }
      }

      log.productName = productName.trim();
      log.quantity = Number(quantity);
      log.reason = (reason || "").trim();
      await log.save();

      return res.status(200).json(log);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update defective log." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { restore } = req.query;
      const log = await Defective.findById(id);
      if (!log) return res.status(404).json({ error: "Defective log not found." });

      if (restore === "true") {
        // Restore the product stock by adding the quantity back
        const product = await Product.findOne({ name: log.productName });
        if (product) {
          product.stock = product.stock + log.quantity;
          await product.save();
        }
      }

      await Defective.findByIdAndDelete(id);
      return res.status(200).json({ message: "Defective log deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete defective log." });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
