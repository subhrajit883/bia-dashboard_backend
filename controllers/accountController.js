import mongoose from "mongoose";
import Student from "../models/Student.js";
import Payment from "../models/Payment.js";

export const getFinancialSummary = async (req, res) => {
  const { from, to, startDate, endDate, courseId, course, studentId, student } = req.query;
  const fromDate = startDate || from;
  const toDate = endDate || to;
  const targetCourse = courseId || course;
  const targetStudent = studentId || student;

  const paymentMatch = {};
  if (fromDate || toDate) {
    paymentMatch.paymentDate = {};
    if (fromDate) paymentMatch.paymentDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === "string" && toDate.length === 10) end.setHours(23, 59, 59, 999);
      paymentMatch.paymentDate.$lte = end;
    }
  }

  if (targetStudent && mongoose.Types.ObjectId.isValid(targetStudent)) {
    paymentMatch.student = new mongoose.Types.ObjectId(targetStudent);
  }

  const studentMatch = {};
  if (targetStudent && mongoose.Types.ObjectId.isValid(targetStudent)) {
    studentMatch._id = new mongoose.Types.ObjectId(targetStudent);
  }

  if (targetCourse && mongoose.Types.ObjectId.isValid(targetCourse)) {
    const courseObjId = new mongoose.Types.ObjectId(targetCourse);
    studentMatch.$or = [
      { enrolledCourses: courseObjId },
      { enrolledCourse: courseObjId }
    ];

    const studentsInCourse = await Student.find(studentMatch).distinct("_id");
    
    if (paymentMatch.student) {
      paymentMatch.$or = [
        { course: courseObjId },
        { student: paymentMatch.student }
      ];
    } else {
      paymentMatch.$or = [
        { course: courseObjId },
        { student: { $in: studentsInCourse } }
      ];
    }
  }

  const [studentStats, paymentStats] = await Promise.all([
    Student.aggregate([
      { $match: studentMatch },
      { $group: { _id: null, count: { $sum: 1 }, totalFees: { $sum: "$totalFees" } } }
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, totalCollected: { $sum: "$amount" }, transactionCount: { $sum: 1 } } }
    ])
  ]);

  const studentsCount = studentStats[0]?.count || 0;
  const totalFees = studentStats[0]?.totalFees || 0;
  const totalCollected = paymentStats[0]?.totalCollected || 0;
  const transactionCount = paymentStats[0]?.transactionCount || 0;
  const outstanding = Math.max(0, totalFees - totalCollected);

  res.json({
    success: true,
    filters: {
      from: fromDate || null,
      to: toDate || null,
      courseId: targetCourse || null,
      studentId: targetStudent || null
    },
    data: {
      students: studentsCount,
      totalFees,
      totalCollected,
      outstanding,
      transactionCount
    }
  });
};

export const getStudentLedger = async (req, res) => {
  const student = await Student.findById(req.params.studentId)
    .select("-password")
    .populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode totalFees");
  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }
  const payments = await Payment.find({ student: student._id })
    .populate("course", "name courseCode")
    .sort({ paymentDate: -1 });
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  res.json({ success: true, data: { student, payments, totalPaid: paid, outstanding: Math.max(0, student.totalFees - paid) } });
};

