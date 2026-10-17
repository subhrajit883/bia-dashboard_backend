import mongoose from "mongoose";

const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentDate: { type: Date, default: Date.now },
  paymentMode: { type: String, enum: ["cash", "upi", "bank_transfer", "card", "cheque", "other"], required: true },
  transactionId: { type: String, trim: true, default: "" },
  receiptUrl: { type: String, default: "" },
  receiptPublicId: { type: String, default: "" },
  remarks: { type: String, default: "" },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  receivedByRole: { type: String, enum: ["admin", "accounts"], required: true }
}, { timestamps: true });

export default mongoose.model("Payment", schema);
