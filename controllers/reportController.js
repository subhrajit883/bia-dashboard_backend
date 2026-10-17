import mongoose from "mongoose";
import ExcelJS from "exceljs";
import Lead from "../models/Lead.js";
import Counsellor from "../models/Counsellor.js";

export const counsellorPerformance = async (req, res) => {
  const { from, to, startDate, endDate, counsellor, counsellorId, course, courseId } = req.query;
  const fromDate = startDate || from;
  const toDate = endDate || to;
  const targetCounsellor = counsellorId || counsellor;
  const targetCourse = courseId || course;

  const match = {};
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === "string" && toDate.length === 10) end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }
  if (targetCounsellor && mongoose.Types.ObjectId.isValid(targetCounsellor)) {
    match.assignedCounsellor = new mongoose.Types.ObjectId(targetCounsellor);
  }
  if (targetCourse && mongoose.Types.ObjectId.isValid(targetCourse)) {
    match.enrolledCourse = new mongoose.Types.ObjectId(targetCourse);
  }

  const grouped = await Lead.aggregate([
    { $match: match },
    { $group: {
      _id: "$assignedCounsellor",
      totalLeads: { $sum: 1 },
      ongoing: { $sum: { $cond: [{ $eq: ["$candidateStatus", "ongoing"] }, 1, 0] } },
      interested: { $sum: { $cond: [{ $eq: ["$candidateStatus", "interested"] }, 1, 0] } },
      closed: { $sum: { $cond: [{ $eq: ["$candidateStatus", "closed"] }, 1, 0] } },
      converted: { $sum: { $cond: [{ $eq: ["$conversionStatus", "approved"] }, 1, 0] } },
      pendingApproval: { $sum: { $cond: [{ $eq: ["$conversionStatus", "pending"] }, 1, 0] } },
      followUps: { $sum: { $size: { $ifNull: ["$remarks", []] } } }
    } },
    { $lookup: { from: "counsellors", localField: "_id", foreignField: "_id", as: "counsellor" } },
    { $unwind: { path: "$counsellor", preserveNullAndEmptyArrays: true } },
    { $project: { counsellorId: "$_id", counsellorName: "$counsellor.name", totalLeads: 1, ongoing: 1, interested: 1, closed: 1, converted: 1, pendingApproval: 1, followUps: 1 } },
    { $sort: { counsellorName: 1 } }
  ]);
  res.json({ success: true, filters: { from: fromDate || null, to: toDate || null, counsellor: targetCounsellor || null, course: targetCourse || null }, data: grouped });
};

export const exportCounsellorPerformance = async (req, res) => {
  const { from, to, startDate, endDate, counsellor, counsellorId, course, courseId } = req.query;
  const fromDate = startDate || from;
  const toDate = endDate || to;
  const targetCounsellor = counsellorId || counsellor;
  const targetCourse = courseId || course;

  const match = {};
  if (fromDate || toDate) {
    match.createdAt = {};
    if (fromDate) match.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === "string" && toDate.length === 10) end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }
  if (targetCounsellor && mongoose.Types.ObjectId.isValid(targetCounsellor)) {
    match.assignedCounsellor = new mongoose.Types.ObjectId(targetCounsellor);
  }
  if (targetCourse && mongoose.Types.ObjectId.isValid(targetCourse)) {
    match.enrolledCourse = new mongoose.Types.ObjectId(targetCourse);
  }
  const grouped = await Lead.aggregate([
    { $match: match },
    { $group: { _id: "$assignedCounsellor", totalLeads: { $sum: 1 }, closed: { $sum: { $cond: [{ $eq: ["$candidateStatus", "closed"] }, 1, 0] } }, converted: { $sum: { $cond: [{ $eq: ["$conversionStatus", "approved"] }, 1, 0] } }, followUps: { $sum: { $size: "$remarks" } } } },
    { $lookup: { from: "counsellors", localField: "_id", foreignField: "_id", as: "c" } },
    { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } }
  ]);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Counsellor Performance");
  sheet.columns = [
    { header: "Counsellor", key: "name", width: 28 },
    { header: "Total Leads", key: "totalLeads", width: 15 },
    { header: "Closed", key: "closed", width: 15 },
    { header: "Converted", key: "converted", width: 15 },
    { header: "Follow-ups", key: "followUps", width: 15 }
  ];
  grouped.forEach((item) => sheet.addRow({ name: item.c?.name || "Unassigned", totalLeads: item.totalLeads, closed: item.closed, converted: item.converted, followUps: item.followUps }));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=counsellor-performance.xlsx");
  await workbook.xlsx.write(res);
  res.end();
};
