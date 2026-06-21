import dbConnect from "../../../lib/dbConnect";
import User from "../../../lib/User";
import { requireRole } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  await dbConnect();

  // Validate admin auth
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const { username, password, role, name } = req.body;
      if (!username || !role || !name) {
        return res.status(400).json({ error: "Username, role, and name are required." });
      }

      // Check duplicates (excluding current user)
      const existingUser = await User.findOne({ 
        username: username.toLowerCase().trim(), 
        _id: { $ne: id } 
      });
      if (existingUser) {
        return res.status(400).json({ error: "Username is already taken." });
      }

      const updateData = {
        username: username.toLowerCase().trim(),
        role,
        name,
      };

      if (password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
      }

      const user = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).select("-password");

      if (!user) return res.status(404).json({ error: "User not found." });
      return res.status(200).json(user);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update user." });
    }
  }

  if (req.method === "DELETE") {
    try {
      // Prevent deleting the default admin to avoid lockouts
      const userToDelete = await User.findById(id);
      if (userToDelete && userToDelete.username === "admin") {
        return res.status(400).json({ error: "Cannot delete the default admin account." });
      }

      const user = await User.findByIdAndDelete(id);
      if (!user) return res.status(404).json({ error: "User not found." });
      return res.status(200).json({ message: "User deleted." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete user." });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
