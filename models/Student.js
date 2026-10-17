import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const documentSchema = new mongoose.Schema({
  documentName: { type: String, required: true, trim: true },
  documentUrl: { type: String, required: true },
  public_id: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true, default: "" },
  phone: { type: String, required: true, trim: true },
  alternativePhone: { type: String, default: "" },
  address: { type: String, default: "" },
  age: { type: Number, min: 0, default: null },
  enrolledCourse: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  gender: { type: String, enum: ["male", "female", "other", "prefer_not_to_say"], default: "prefer_not_to_say" },
  isActive: { type: Boolean, default: true },
  documents: [documentSchema],
  dateOfAdmission: { type: Date, default: Date.now },
  assignedCounsellor: { type: mongoose.Schema.Types.ObjectId, ref: "Counsellor", required: true },
  totalFees: { type: Number, required: true, min: 0 },
  s_id: { type: String, unique: true, required: true },
  paymentStatus: { type: String, enum: ["pending", "partial", "paid", "overdue"], default: "pending" },
  password: { type: String, required: true, select: false },
  convertedFromLead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null }
}, { timestamps: true });

schema.index(
  { convertedFromLead: 1 },
  { unique: true, partialFilterExpression: { convertedFromLead: { $type: "objectId" } } }
);
schema.index({ phone: 1 });
schema.index({ dateOfAdmission: 1 });
schema.index({ paymentStatus: 1 });
schema.index({ assignedCounsellor: 1 });
schema.index({ enrolledCourses: 1 });

schema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12);
  if (this.enrolledCourses && this.enrolledCourses.length > 0) {
    if (!this.enrolledCourse) this.enrolledCourse = this.enrolledCourses[0];
  } else if (this.enrolledCourse) {
    this.enrolledCourses = [this.enrolledCourse];
  }
});


schema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("Student", schema);
