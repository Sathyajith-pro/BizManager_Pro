import dbConnect from "../../lib/dbConnect";
import Product from "../../lib/Product";
import { requireRole } from "../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    // Both Admin and Packer can view products (dropdown populated on client)
    const auth = requireRole(req, ["admin", "packer"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Login required." });
    }

    try {
      const products = await Product.find({}).sort({ name: 1 });
      return res.status(200).json(products);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch products." });
    }
  }

  if (req.method === "POST") {
    // Only Admin can add products
    const auth = requireRole(req, ["admin"]);
    if (!auth.authorized) {
      return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
    }

    try {
      const { name, stock, price, warranty } = req.body;
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Product name is required." });
      }

      // Check duplicates
      const existingProduct = await Product.findOne({ name: name.trim() });
      if (existingProduct) {
        return res.status(400).json({ error: "Product name already exists." });
      }

      const product = await Product.create({
        name: name.trim(),
        stock: Number(stock) || 0,
        price: Number(price) || 0,
        warranty: (warranty || "").trim(),
      });

      return res.status(201).json(product);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create product." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
