import mongoose from "mongoose";

const schema = new mongoose.Schema({
  recipients: [{ type: String }],
  subject: String,
  template: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate", default: null },
  sentBy: { type: mongoose.Schema.Types.ObjectId, refPath: "sentByModel", required: true },
  sentByModel: { type: String, enum: ["Admin", "Counsellor"], required: true },
  status: { type: String, enum: ["sent", "failed"], required: true },
  providerMessageId: String,
  errorMessage: String
}, { timestamps: true });

export default mongoose.model("EmailLog", schema);
