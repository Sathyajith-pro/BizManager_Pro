import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "biz-secret-key-12345-fortress";

export function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

export function requireRole(req, roles = []) {
  const user = verifyToken(req);
  if (!user) {
    return { authenticated: false, authorized: false, user: null };
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    return { authenticated: true, authorized: false, user };
  }
  return { authenticated: true, authorized: true, user };
}
