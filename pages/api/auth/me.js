import dbConnect from "../../../lib/dbConnect";
import { verifyToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  await dbConnect();

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Invalid token." });
  }

  return res.status(200).json({ user });
}
