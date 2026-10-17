import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  courseCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  description: { type: String, default: "" },
  totalFees: { type: Number, required: true, min: 0 },
  duration: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
}, { timestamps: true });

export default mongoose.model("Course", schema);
