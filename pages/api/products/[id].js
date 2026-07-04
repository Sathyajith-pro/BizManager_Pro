import dbConnect from "../../../lib/dbConnect";
import Product from "../../../lib/Product";
import { requireRole } from "../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();
  const { id } = req.query;

  // Only Admin can modify/delete products
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "PUT") {
    try {
      const { name, stock, price, warranty } = req.body;
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Product name is required." });
      }

      // Check duplicates (excluding this product)
      const existingProduct = await Product.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });
      if (existingProduct) {
        return res.status(400).json({ error: "Product name already exists." });
      }

      const product = await Product.findByIdAndUpdate(
        id,
        {
          name: name.trim(),
          stock: Number(stock) || 0,
          price: Number(price) || 0,
          warranty: (warranty || "").trim(),
        },
        { new: true, runValidators: true }
      );

      if (!product) return res.status(404).json({ error: "Product not found." });
      return res.status(200).json(product);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update product details." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const product = await Product.findByIdAndDelete(id);
      if (!product) return res.status(404).json({ error: "Product not found." });
      return res.status(200).json({ message: "Product deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete product." });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
