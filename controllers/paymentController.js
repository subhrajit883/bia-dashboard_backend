import Student from "../models/Student.js";
import Payment from "../models/Payment.js";

const refreshPaymentStatus = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) return;
  const result = await Payment.aggregate([
    { $match: { student: student._id } },
    { $group: { _id: null, paid: { $sum: "$amount" } } }
  ]);
  const paid = result[0]?.paid || 0;
  student.paymentStatus = paid >= student.totalFees ? "paid" : paid > 0 ? "partial" : "pending";
  await student.save();
};

export const createPayment = async (req, res) => {
  const { student, course, amount, paymentDate, paymentMode, transactionId, remarks } = req.body;
  if (!student || !amount || !paymentMode) {
    const error = new Error("Student, payment amount and payment mode are required.");
    error.statusCode = 400;
    throw error;
  }
  const studentDoc = await Student.findById(student);
  if (!studentDoc) {
    const error = new Error("Student not found. Payment cannot be recorded.");
    error.statusCode = 404;
    throw error;
  }
  const payment = await Payment.create({
    student,
    course: course || null,
    amount,
    paymentDate,
    paymentMode,
    transactionId,
    remarks,
    receivedBy: req.user._id,
    receivedByRole: req.user.role
  });
  await refreshPaymentStatus(student);
  res.status(201).json({ success: true, message: "Payment recorded successfully.", data: payment });
};

export const getPayments = async (req, res) => {
  const filter = {};
  const targetStudent = req.query.student || req.query.studentId;
  const targetCourse = req.query.course || req.query.courseId;
  const fromDate = req.query.from || req.query.startDate;
  const toDate = req.query.to || req.query.endDate;

  if (targetStudent) filter.student = targetStudent;
  if (targetCourse) filter.course = targetCourse;
  if (fromDate || toDate) {
    filter.paymentDate = {};
    if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === "string" && toDate.length === 10) end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }
  const data = await Payment.find(filter)
    .populate("student", "name s_id phone totalFees paymentStatus")
    .populate("course", "name courseCode")
    .sort({ paymentDate: -1 });
  res.json({ success: true, count: data.length, data });
};

export const getPaymentById = async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("student", "name s_id phone totalFees paymentStatus enrolledCourse enrolledCourses")
    .populate("course", "name courseCode");
  if (!payment) {
    const error = new Error("Payment record not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, data: payment });
};

export const updatePayment = async (req, res) => {
  const { id } = req.params;
  const { student, course, amount, paymentDate, paymentMode, transactionId, remarks, receiptUrl, receiptPublicId } = req.body;

  const payment = await Payment.findById(id);
  if (!payment) {
    const error = new Error("Payment record not found.");
    error.statusCode = 404;
    throw error;
  }

  const oldStudentId = payment.student.toString();

  if (student) {
    const studentDoc = await Student.findById(student);
    if (!studentDoc) {
      const error = new Error("Student not found.");
      error.statusCode = 404;
      throw error;
    }
    payment.student = student;
  }

  if (course !== undefined) payment.course = course || null;

  if (amount !== undefined) {
    if (amount <= 0) {
      const error = new Error("Payment amount must be greater than 0.");
      error.statusCode = 400;
      throw error;
    }
    payment.amount = amount;
  }

  if (paymentDate) payment.paymentDate = paymentDate;
  if (paymentMode) payment.paymentMode = paymentMode;
  if (transactionId !== undefined) payment.transactionId = transactionId;
  if (remarks !== undefined) payment.remarks = remarks;
  if (receiptUrl !== undefined) payment.receiptUrl = receiptUrl;
  if (receiptPublicId !== undefined) payment.receiptPublicId = receiptPublicId;

  await payment.save();

  await refreshPaymentStatus(payment.student);

  if (student && student.toString() !== oldStudentId) {
    await refreshPaymentStatus(oldStudentId);
  }

  res.json({ success: true, message: "Payment updated successfully.", data: payment });
};

export const deletePayment = async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment) {
    const error = new Error("Payment record not found.");
    error.statusCode = 404;
    throw error;
  }
  await refreshPaymentStatus(payment.student);
  res.json({ success: true, message: "Payment record deleted and student payment status recalculated." });
};


