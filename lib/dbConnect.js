import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in your .env file"
  );
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m);
  }

  cached.conn = await cached.promise;

  // Seeding default accounts if database is empty
  try {
    const User = mongoose.models.User || (await import("./User")).default;
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("Seeding default accounts...");
      const salt = await bcrypt.genSalt(10);
      const hashedAdminPassword = await bcrypt.hash("admin123", salt);
      const hashedPackerPassword = await bcrypt.hash("packer123", salt);

      await User.create([
        {
          username: "admin",
          password: hashedAdminPassword,
          role: "admin",
          name: "Default Admin",
        },
        {
          username: "packer",
          password: hashedPackerPassword,
          role: "packer",
          name: "Default Packer",
        },
      ]);
      console.log("Seeding complete! Admin: admin/admin123, Packer: packer/packer123");
    }
  } catch (err) {
    console.error("Database seeding error:", err);
  }

  return cached.conn;
}

export default dbConnect;
