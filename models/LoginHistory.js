import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ["admin", "counsellor", "accounts", "student"], required: true },
  email: { type: String, default: "" },
  ipAddress: { type: String, default: "" },
  deviceType: { type: String, default: "unknown" },
  browser: { type: String, default: "unknown" },
  operatingSystem: { type: String, default: "unknown" },
  userAgent: { type: String, default: "" },
  loginAt: { type: Date, default: Date.now },
  logoutAt: { type: Date, default: null },
  isActiveSession: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("LoginHistory", schema);
