import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // stored as bcrypt hash
  role: { type: String, enum: ["admin", "packer", "agent"], default: "packer" },
  name: { type: String, required: true },
});

delete mongoose.models.User;
export default mongoose.model("User", UserSchema);
