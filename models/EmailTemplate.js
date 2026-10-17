import mongoose from "mongoose";

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  isDraft: { type: Boolean, default: false },
  targetType: { type: String, enum: ["lead", "student", "all"], default: "all" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });


export default mongoose.model("EmailTemplate", schema);
