import mongoose from "mongoose";
import Counsellor from "../models/Counsellor.js";
import Lead from "../models/Lead.js";
import Course from "../models/Course.js";

export const getMyProfile = async (req, res) => {
  const data = await Counsellor.findById(req.user._id).select("-password");
  res.json({ success: true, data });
};

export const updateMyProfile = async (req, res) => {
  const allowed = ["name", "phone"];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const data = await Counsellor.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select("-password");
  res.json({ success: true, message: "Profile updated successfully.", data });
};

export const getAllActiveCounsellors = async (req, res) => {
  const counsellors = await Counsellor.find({ status: "active", isActive: true }).select("-password");
  res.json({ success: true, data: counsellors });
};

export const getCounsellorById = async (req, res) => {
  try {
    const counsellor = await Counsellor.findById(req.params.id).select("-password");
    if (!counsellor) return res.status(404).json({ success: false, message: "Counsellor not found" });
    res.json({ success: true, data: counsellor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllCounsellors = async (req, res) => {
  const counsellors = await Counsellor.find().sort({ createdAt: -1 }).select("-password");
  res.json({ success: true, data: counsellors });
};

export const getCounsellorPerformance = async (req, res) => {
  const { from, to, startDate, endDate, dateFrom, dateTo, counsellor, counsellorId, course, courseId } = req.query;

  const fromDateVal = startDate || from || dateFrom;
  const toDateVal = endDate || to || dateTo;
  let targetCounsellorId = counsellorId || counsellor || null;
  const targetCourseId = courseId || course || null;

  if (targetCounsellorId && req.user.role === "counsellor" && targetCounsellorId !== req.user._id.toString()) {
    targetCounsellorId = req.user._id.toString();
  }

  const match = {};

  if (fromDateVal || toDateVal) {
    match.createdAt = {};
    if (fromDateVal) match.createdAt.$gte = new Date(fromDateVal);
    if (toDateVal) {
      const end = new Date(toDateVal);
      if (typeof toDateVal === "string" && toDateVal.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      match.createdAt.$lte = end;
    }
  }

  if (targetCounsellorId && mongoose.Types.ObjectId.isValid(targetCounsellorId)) {
    match.assignedCounsellor = new mongoose.Types.ObjectId(targetCounsellorId);
  }

  if (targetCourseId && mongoose.Types.ObjectId.isValid(targetCourseId)) {
    match.enrolledCourse = new mongoose.Types.ObjectId(targetCourseId);
  }

  let courseInfo = null;
  if (targetCourseId && mongoose.Types.ObjectId.isValid(targetCourseId)) {
    courseInfo = await Course.findById(targetCourseId).select("name courseCode totalFees duration isActive");
  }

  const leads = await Lead.find(match)
    .populate("source", "name")
    .populate("enrolledCourse", "name courseCode totalFees duration")
    .populate("assignedCounsellor", "name email phone status")
    .populate("statusChangedBy", "name email role")
    .populate("remarks.calledBy", "name")
    .sort({ createdAt: -1 });

  const performanceData = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$assignedCounsellor",
        totalCandidates: { $sum: 1 },
        leadsCount: { $sum: { $cond: [{ $eq: ["$candidateType", "lead"] }, 1, 0] } },
        walkInsCount: { $sum: { $cond: [{ $eq: ["$candidateType", "walk-in"] }, 1, 0] } },
        ongoing: { $sum: { $cond: [{ $eq: ["$candidateStatus", "ongoing"] }, 1, 0] } },
        interested: { $sum: { $cond: [{ $eq: ["$candidateStatus", "interested"] }, 1, 0] } },
        notInterested: { $sum: { $cond: [{ $eq: ["$candidateStatus", "not interested"] }, 1, 0] } },
        notUseful: { $sum: { $cond: [{ $eq: ["$candidateStatus", "not useful"] }, 1, 0] } },
        notResponding: { $sum: { $cond: [{ $eq: ["$candidateStatus", "not responding"] }, 1, 0] } },
        disconnectCall: { $sum: { $cond: [{ $eq: ["$candidateStatus", "disconnect call"] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ["$candidateStatus", "closed"] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq: ["$conversionStatus", "approved"] }, 1, 0] } },
        pendingConversion: { $sum: { $cond: [{ $eq: ["$conversionStatus", "pending"] }, 1, 0] } },
        rejectedConversion: { $sum: { $cond: [{ $eq: ["$conversionStatus", "rejected"] }, 1, 0] } },
        totalFollowUps: { $sum: { $size: { $ifNull: ["$remarks", []] } } },
        coursesEnrolled: { $addToSet: "$enrolledCourse" }
      }
    },
    {
      $lookup: {
        from: "counsellors",
        localField: "_id",
        foreignField: "_id",
        as: "counsellorDetails"
      }
    },
    { $unwind: { path: "$counsellorDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "courses",
        localField: "coursesEnrolled",
        foreignField: "_id",
        as: "courseDetails"
      }
    },
    {
      $project: {
        _id: 0,
        counsellorId: "$_id",
        counsellorName: { $ifNull: ["$counsellorDetails.name", "Unassigned"] },
        counsellorEmail: { $ifNull: ["$counsellorDetails.email", ""] },
        counsellorPhone: { $ifNull: ["$counsellorDetails.phone", ""] },
        courses: {
          $map: {
            input: "$courseDetails",
            as: "c",
            in: {
              courseId: "$$c._id",
              courseName: "$$c.name",
              courseCode: "$$c.courseCode",
              totalFees: "$$c.totalFees"
            }
          }
        },
        totalCandidates: 1,
        leadsCount: 1,
        walkInsCount: 1,
        statusBreakdown: {
          ongoing: "$ongoing",
          interested: "$interested",
          notInterested: "$notInterested",
          notUseful: "$notUseful",
          notResponding: "$notResponding",
          disconnectCall: "$disconnectCall",
          closed: "$closed"
        },
        conversionMetrics: {
          converted: "$converted",
          pendingConversion: "$pendingConversion",
          rejectedConversion: "$rejectedConversion",
          conversionRate: {
            $cond: [
              { $gt: ["$totalCandidates", 0] },
              { $round: [{ $multiply: [{ $divide: ["$converted", "$totalCandidates"] }, 100] }, 2] },
              0
            ]
          },
          closedToStudentConversionRate: {
            $cond: [
              { $gt: ["$closed", 0] },
              { $round: [{ $multiply: [{ $divide: ["$converted", "$closed"] }, 100] }, 2] },
              0
            ]
          }
        },
        totalFollowUps: 1
      }
    },
    { $sort: { counsellorName: 1 } }
  ]);

  const performanceDataWithLeads = performanceData.map((item) => {
    const counsellorLeads = leads.filter(
      (l) => l.assignedCounsellor && l.assignedCounsellor._id.toString() === item.counsellorId?.toString()
    );
    return {
      ...item,
      leads: counsellorLeads
    };
  });

  const summary = performanceData.reduce(
    (acc, curr) => {
      acc.totalCandidates += curr.totalCandidates;
      acc.leadsCount += curr.leadsCount;
      acc.walkInsCount += curr.walkInsCount;
      acc.closedCount += curr.statusBreakdown.closed;
      acc.convertedCount += curr.conversionMetrics.converted;
      acc.pendingConversionCount += curr.conversionMetrics.pendingConversion;
      acc.totalFollowUps += curr.totalFollowUps;
      return acc;
    },
    {
      totalCandidates: 0,
      leadsCount: 0,
      walkInsCount: 0,
      closedCount: 0,
      convertedCount: 0,
      pendingConversionCount: 0,
      totalFollowUps: 0,
      overallConversionRate: 0,
      closedToStudentConversionRate: 0
    }
  );

  if (summary.totalCandidates > 0) {
    summary.overallConversionRate = Number(((summary.convertedCount / summary.totalCandidates) * 100).toFixed(2));
  }
  if (summary.closedCount > 0) {
    summary.closedToStudentConversionRate = Number(((summary.convertedCount / summary.closedCount) * 100).toFixed(2));
  }

  res.json({
    success: true,
    filters: {
      from: fromDateVal || null,
      to: toDateVal || null,
      counsellorId: targetCounsellorId || null,
      courseId: targetCourseId || null,
      course: courseInfo
    },
    summary,
    data: performanceDataWithLeads,
    leads
  });
};

export const deleteCounsellor = async (req, res) => {
  const counsellorId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(counsellorId)) {
    return res.status(400).json({ success: false, message: "Invalid counsellor ID" });
  }

  const counsellor = await Counsellor.findById(counsellorId);
  if (!counsellor) {
    return res.status(404).json({ success: false, message: "Counsellor not found" });
  }

  const assignedLeadsCount = await Lead.countDocuments({ assignedCounsellor: counsellorId });
  if (assignedLeadsCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete counsellor with assigned leads. Please reassign or unassign the leads first."
    });
  }

  await Counsellor.findByIdAndDelete(counsellorId);
  res.json({ success: true, message: "Counsellor deleted successfully." });
};  