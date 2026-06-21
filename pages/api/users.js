import dbConnect from "../../lib/dbConnect";
import User from "../../lib/User";
import { requireRole } from "../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  await dbConnect();

  // Validate admin auth
  const auth = requireRole(req, ["admin"]);
  if (!auth.authorized) {
    return res.status(auth.authenticated ? 403 : 401).json({ error: "Access denied. Admin role required." });
  }

  if (req.method === "GET") {
    try {
      const users = await User.find({}, { password: 0 });
      return res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch users." });
    }
  }

  if (req.method === "POST") {
    try {
      const { username, password, role, name } = req.body;
      if (!username || !password || !role || !name) {
        return res.status(400).json({ error: "All fields are required." });
      }

      // Check duplicates
      const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
      if (existingUser) {
        return res.status(400).json({ error: "Username is already taken." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        role,
        name,
      });

      const userRes = {
        _id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
      };

      return res.status(201).json(userRes);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create user." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
