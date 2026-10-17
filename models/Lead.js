import mongoose from "mongoose";

const followUpSchema = new mongoose.Schema({
  calledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Counsellor", required: true },
  date: { type: Date, default: Date.now },
  description: { type: String, required: true, trim: true },
  nextCallDate: { type: Date, default: null },
  reminderSent: { type: Boolean, default: false }
}, { _id: true });


const schema = new mongoose.Schema({
  candidateType: { type: String, enum: ["lead", "walk-in"], required: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: "Source", required: true },
  date: { type: Date, default: Date.now },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  alternativePhone: { type: String, trim: true, default: "" },
  gender: { type: String, enum: ["male", "female", "other", "prefer_not_to_say"], default: "prefer_not_to_say" },
  email: { type: String, lowercase: true, trim: true, default: "" },
  dob: { type: Date, default: null },
  fullAddress: { type: String, trim: true, default: "" },
  enrolledCourse: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  assignedCounsellor: { type: mongoose.Schema.Types.ObjectId, ref: "Counsellor", required: true },
  candidateStatus: {
    type: String,
    enum: ["ongoing", "interested", "not interested", "not useful", "not responding", "disconnect call", "closed"],
    default: "ongoing"
  },
  statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Counsellor", default: null },
  statusChangedAt: { type: Date, default: null },
  remarks: [followUpSchema],
  isActive: { type: Boolean, default: true },
  conversionStatus: { type: String, enum: ["not_requested", "pending", "approved", "rejected"], default: "not_requested" },
  conversionRemarks: { type: String, default: "" },
  convertedStudent: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

schema.pre("save", function () {
  if (this.enrolledCourses && this.enrolledCourses.length > 0) {
    if (!this.enrolledCourse) this.enrolledCourse = this.enrolledCourses[0];
  } else if (this.enrolledCourse) {
    this.enrolledCourses = [this.enrolledCourse];
  }
});

schema.index({ phone: 1 });
schema.index({ alternativePhone: 1 });
schema.index({ assignedCounsellor: 1, candidateStatus: 1 });
schema.index({ date: 1 });
schema.index({ source: 1 });
schema.index({ enrolledCourses: 1 });
schema.index({ conversionStatus: 1 });

export default mongoose.model("Lead", schema);

