import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import Source from "../models/Source.js";
import Course from "../models/Course.js";
import Counsellor from "../models/Counsellor.js";
import { checkPendingFollowUpReminders } from "../utils/followUpScheduler.js";

const escapeRegex = (string = "") => {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};


export const createLead = async (req, res) => {
  const { candidateType, source, date, name, phone, alternativePhone, gender, email, dob, fullAddress, enrolledCourses, assignedCounsellor } = req.body;

  let courseIds = [];
  if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
    courseIds = enrolledCourses;
  } 

  if (!candidateType || !source || !name || !phone || courseIds.length === 0) {
    const error = new Error("Candidate type, source, name, phone number and enrolled course(s) are required.");
    error.statusCode = 400;
    throw error;
  }
  const [sourceDoc, coursesDoc] = await Promise.all([
    Source.findOne({ _id: source, isActive: true }),
    Course.find({ _id: { $in: courseIds }, isActive: true })
  ]);
  if (!sourceDoc) {
    const error = new Error("Selected lead source does not exist or is inactive.");
    error.statusCode = 400;
    throw error;
  }
  if (!coursesDoc || coursesDoc.length === 0) {
    const error = new Error("Selected course(s) do not exist or are inactive.");
    error.statusCode = 400;
    throw error;
  }

  let counsellorId = assignedCounsellor || req.user._id;

  const activeCounsellor = await Counsellor.findOne({ _id: counsellorId, status: "active", isActive: true });
  if (!activeCounsellor) {
    const error = new Error("The selected counsellor is not active.");
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await Lead.findOne({
    isActive: true,
    $or: [
      { phone },
      ...(alternativePhone ? [{ phone: alternativePhone }, { alternativePhone }] : []),
      ...(phone ? [{ alternativePhone: phone }] : [])
    ]
  });
  if (duplicate) {
    const error = new Error("A lead already exists with this phone number or alternative phone number.");
    error.statusCode = 409;
    error.code = "DUPLICATE_PHONE";
    throw error;
  }

  const data = await Lead.create({
    candidateType, source, date, name, phone, alternativePhone, gender, email, dob,
    fullAddress, enrolledCourse: courseIds[0], enrolledCourses: courseIds, assignedCounsellor: counsellorId, createdBy: req.user._id,
    statusChangedBy: req.user._id, statusChangedAt: new Date()
  });
  res.status(201).json({ success: true, message: "Candidate created successfully.", data });
};


export const getLeads = async (req, res) => {
  const filter = {};
  const andConditions = [];

  // Filter by candidateStatus
  const candidateStatusVal = req.query.candidateStatus || req.query.status;
  if (candidateStatusVal) {
    if (Array.isArray(candidateStatusVal)) {
      filter.candidateStatus = { $in: candidateStatusVal.map(s => String(s).trim().toLowerCase()) };
    } else if (typeof candidateStatusVal === "string" && candidateStatusVal.trim()) {
      const statuses = candidateStatusVal.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      filter.candidateStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
  }

  // Filter by candidateType
  if (req.query.type || req.query.candidateType) {
    filter.candidateType = req.query.type || req.query.candidateType;
  }

  // Filter by source.name or source ID
  const sourceNameVal =
    req.query["source.name"] ||
    (typeof req.query.source === "object" ? req.query.source?.name : null) ||
    req.query.sourceName ||
    req.query.source_name ||
    (req.query.source && !mongoose.Types.ObjectId.isValid(req.query.source) ? req.query.source : null);

  const sourceIdVal =
    req.query.sourceId ||
    (req.query.source && mongoose.Types.ObjectId.isValid(req.query.source) ? req.query.source : null);

  if (sourceNameVal && typeof sourceNameVal === "string" && sourceNameVal.trim()) {
    const sourceQuery = {
      name: new RegExp(escapeRegex(sourceNameVal.trim()), "i")
    };
    if (sourceIdVal) {
      sourceQuery._id = sourceIdVal;
    }
    const matchingSources = await Source.find(sourceQuery).select("_id");
    const sourceIds = matchingSources.map(s => s._id);
    filter.source = { $in: sourceIds };
  } else if (sourceIdVal) {
    filter.source = sourceIdVal;
  }

  // Filter by enrolledCourses.name (enrolledCourses is an array) or course ID
  const courseNameVal =
    req.query["enrolledCourses.name"] ||
    (typeof req.query.enrolledCourses === "object" && !Array.isArray(req.query.enrolledCourses) ? req.query.enrolledCourses?.name : null) ||
    req.query.courseName ||
    req.query.courseNames ||
    req.query.course_name ||
    req.query.enrolledCourseName ||
    (req.query.course && !mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  const courseIdVal =
    (req.query.courseId && mongoose.Types.ObjectId.isValid(req.query.courseId) ? req.query.courseId : null) ||
    (req.query.course && mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  if (courseNameVal) {
    let names = [];
    if (Array.isArray(courseNameVal)) {
      names = courseNameVal.map(n => String(n).trim()).filter(Boolean);
    } else if (typeof courseNameVal === "string") {
      names = courseNameVal.split(",").map(n => n.trim()).filter(Boolean);
    }
    if (names.length > 0) {
      const courseRegexes = names.map(n => new RegExp(escapeRegex(n), "i"));
      const courseQuery = {
        $or: [
          { name: { $in: courseRegexes } },
          { courseCode: { $in: courseRegexes } }
        ]
      };
      if (courseIdVal) courseQuery._id = courseIdVal;
      const matchingCourses = await Course.find(courseQuery).select("_id");
      const courseIds = matchingCourses.map(c => c._id);
      andConditions.push({
        $or: [
          { enrolledCourses: { $in: courseIds } },
          { enrolledCourse: { $in: courseIds } }
        ]
      });
    }
  } else if (courseIdVal) {
    andConditions.push({
      $or: [
        { enrolledCourses: courseIdVal },
        { enrolledCourse: courseIdVal }
      ]
    });
  }

  // Filter by assignedCounsellor.name or counsellor ID
  const counsellorNameVal =
    req.query["assignedCounsellor.name"] ||
    (typeof req.query.assignedCounsellor === "object" ? req.query.assignedCounsellor?.name : null) ||
    req.query.assignedCounsellorName ||
    req.query.counsellorName ||
    req.query.counsellor_name ||
    (req.query.counsellor && !mongoose.Types.ObjectId.isValid(req.query.counsellor) ? req.query.counsellor : null) ||
    (req.query.assignedCounsellor && !mongoose.Types.ObjectId.isValid(req.query.assignedCounsellor) ? req.query.assignedCounsellor : null);

  const counsellorIdVal =
    (req.query.counsellor && mongoose.Types.ObjectId.isValid(req.query.counsellor) ? req.query.counsellor : null) ||
    (req.query.assignedCounsellor && mongoose.Types.ObjectId.isValid(req.query.assignedCounsellor) ? req.query.assignedCounsellor : null) ||
    (req.query.counsellorId && mongoose.Types.ObjectId.isValid(req.query.counsellorId) ? req.query.counsellorId : null);

  if (counsellorNameVal && typeof counsellorNameVal === "string" && counsellorNameVal.trim()) {
    const counsellorQuery = {
      name: new RegExp(escapeRegex(counsellorNameVal.trim()), "i")
    };
    if (counsellorIdVal) {
      counsellorQuery._id = counsellorIdVal;
    }
    const matchingCounsellors = await Counsellor.find(counsellorQuery).select("_id");
    const counsellorIds = matchingCounsellors.map(c => c._id);
    filter.assignedCounsellor = { $in: counsellorIds };
  } else if (counsellorIdVal) {
    filter.assignedCounsellor = counsellorIdVal;
  }

  // Filter by conversionStatus
  if (req.query.conversionStatus) {
    if (Array.isArray(req.query.conversionStatus)) {
      filter.conversionStatus = { $in: req.query.conversionStatus.map(s => String(s).trim().toLowerCase()) };
    } else if (typeof req.query.conversionStatus === "string" && req.query.conversionStatus.trim()) {
      const statuses = req.query.conversionStatus.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      filter.conversionStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
  }

  if (req.query.unapprovedClosed === "true") {
    filter.candidateStatus = "closed";
    filter.conversionStatus = { $ne: "approved" };
  }

  // Date range for "date"
  const leadDateFrom =
    req.query.dateFrom ||
    req.query.leadDateFrom ||
    req.query["date.from"] ||
    (typeof req.query.date === "object" ? (req.query.date?.from || req.query.date?.startDate) : null) ||
    req.query.startDate ||
    req.query.from;

  const leadDateTo =
    req.query.dateTo ||
    req.query.leadDateTo ||
    req.query["date.to"] ||
    (typeof req.query.date === "object" ? (req.query.date?.to || req.query.date?.endDate) : null) ||
    req.query.endDate ||
    req.query.to;

  if (leadDateFrom || leadDateTo) {
    filter.date = {};
    if (leadDateFrom) filter.date.$gte = new Date(leadDateFrom);
    if (leadDateTo) {
      const end = new Date(leadDateTo);
      if (typeof leadDateTo === "string" && leadDateTo.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      filter.date.$lte = end;
    }
  } else if (typeof req.query.date === "string" && req.query.date.trim()) {
    const start = new Date(req.query.date);
    const end = new Date(req.query.date);
    if (req.query.date.length === 10) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    filter.date = { $gte: start, $lte: end };
  }

  // Backwards-compatible createdAt date range if specifically queried
  if (req.query.createdAtFrom || req.query.createdAtTo || req.query.createdFrom || req.query.createdTo) {
    const cFrom = req.query.createdAtFrom || req.query.createdFrom;
    const cTo = req.query.createdAtTo || req.query.createdTo;
    filter.createdAt = {};
    if (cFrom) filter.createdAt.$gte = new Date(cFrom);
    if (cTo) {
      const end = new Date(cTo);
      if (typeof cTo === "string" && cTo.length === 10) end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  // Search by name, phone, alternativePhone, email
  if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
    const regex = new RegExp(escapeRegex(req.query.search.trim()), "i");
    andConditions.push({
      $or: [
        { name: regex },
        { phone: regex },
        { alternativePhone: regex },
        { email: regex }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const [data, total] = await Promise.all([
    Lead.find(filter).populate("source enrolledCourse enrolledCourses assignedCounsellor statusChangedBy", "name email phone username role courseCode")
      .populate("remarks.calledBy", "name")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Lead.countDocuments(filter)
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), data });
};

export const getLeadById = async (req, res) => {
  const data = await Lead.findById(req.params.id)
    .populate("source enrolledCourse enrolledCourses assignedCounsellor statusChangedBy", "name email phone username role courseCode")
    .populate("remarks.calledBy", "name");
  if (!data) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, data });
};


export const updateLead = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }

  if (req.body.candidateStatus !== undefined && req.body.candidateStatus !== lead.candidateStatus) {
    if (lead.conversionStatus === "approved" && req.user.role !== "admin") {
      const error = new Error("Once a lead is closed and approved as a student, its candidate status can only be changed by an admin.");
      error.statusCode = 403;
      throw error;
    }
    lead.candidateStatus = req.body.candidateStatus;
    lead.statusChangedBy = req.user._id;
    lead.statusChangedAt = new Date();
  }

  if (req.body.assignedCounsellor) {
    const counsellor = await Counsellor.findOne({ _id: req.body.assignedCounsellor, status: "active", isActive: true });
    if (!counsellor) {
      const error = new Error("Selected counsellor is not active.");
      error.statusCode = 400;
      throw error;
    }
  }

  const allowed = ["candidateType", "source", "date", "name", "phone", "alternativePhone", "gender", "email", "dob", "fullAddress", "enrolledCourse", "enrolledCourses", "isActive", "assignedCounsellor"];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "enrolledCourses" && Array.isArray(req.body.enrolledCourses)) {
        lead.enrolledCourses = req.body.enrolledCourses;
        if (req.body.enrolledCourses.length > 0) lead.enrolledCourse = req.body.enrolledCourses[0];
      } else if (key === "enrolledCourse") {
        if (Array.isArray(req.body.enrolledCourse)) {
          lead.enrolledCourses = req.body.enrolledCourse;
          lead.enrolledCourse = req.body.enrolledCourse[0];
        } else {
          lead.enrolledCourse = req.body.enrolledCourse;
          lead.enrolledCourses = [req.body.enrolledCourse];
        }
      } else {
        lead[key] = req.body[key];
      }
    }
  }
  lead.updatedBy = req.user._id;
  await lead.save();
  res.json({ success: true, message: "Candidate updated successfully.", data: await Lead.findById(lead._id).populate("source enrolledCourse enrolledCourses assignedCounsellor", "name email phone username role courseCode") });
};


export const addFollowUp = async (req, res) => {
  const { description, nextCallDate, date } = req.body;
  if (!description?.trim()) {
    const error = new Error("Follow-up description is required.");
    error.statusCode = 400;
    throw error;
  }
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }
  lead.remarks.push({
    calledBy: req.user._id,
    description,
    date: date || new Date(),
    nextCallDate: nextCallDate || null,
    reminderSent: false
  });
  lead.updatedBy = req.user._id;
  await lead.save();

  if (nextCallDate && new Date(nextCallDate) <= new Date()) {
    try {
      await checkPendingFollowUpReminders();
    } catch (err) {
      console.error("Error executing immediate follow-up reminder check:", err.message);
    }
  }

  const updatedLead = await Lead.findById(lead._id);
  const latestRemark = updatedLead?.remarks?.at(-1) || lead.remarks.at(-1);

  res.status(201).json({ success: true, message: "Follow-up added successfully.", data: latestRemark });
};

export const triggerFollowUpReminders = async (req, res) => {
  try {
    await checkPendingFollowUpReminders();
    res.json({ success: true, message: "Follow-up reminders checked and processed successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const requestConversion = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }
  if (lead.candidateStatus !== "closed") {
    const error = new Error("Only candidates with status 'closed' can be submitted for student conversion.");
    error.statusCode = 400;
    throw error;
  }
  if (lead.conversionStatus === "approved") {
    const error = new Error("This candidate has already been converted into a student.");
    error.statusCode = 409;
    throw error;
  }
  if (lead.conversionStatus === "pending") {
    const error = new Error("A conversion request for this candidate is already awaiting admin approval.");
    error.statusCode = 409;
    throw error;
  }
  lead.conversionStatus = "pending";
  lead.conversionRemarks = req.body.remarks || "";
  await lead.save();
  res.json({ success: true, message: "Student conversion request submitted to admin.", data: lead });
};

export const assignLead = async (req, res) => {
  const { assignedCounsellor } = req.body;
  const counsellor = await Counsellor.findOne({ _id: assignedCounsellor, status: "active", isActive: true });
  if (!counsellor) {
    const error = new Error("Choose an active counsellor. Inactive counsellors cannot receive lead assignments.");
    error.statusCode = 400;
    throw error;
  }
  const lead = await Lead.findByIdAndUpdate(req.params.id, { assignedCounsellor, updatedBy: req.user._id }, { new: true });
  if (!lead) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Lead assigned successfully.", data: lead });
};

export const deleteLead = async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) {
    const error = new Error("Candidate not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Candidate deleted successfully.", data: null });
};

export const getUnapprovedClosedLeads = async (req, res) => {
  const filter = {
    candidateStatus: "closed",
    conversionStatus: req.query.conversionStatus ? req.query.conversionStatus : { $ne: "approved" }
  };

  const andConditions = [];

  // Filter by assignedCounsellor.name or counsellor ID
  const counsellorNameVal =
    req.query["assignedCounsellor.name"] ||
    (typeof req.query.assignedCounsellor === "object" ? req.query.assignedCounsellor?.name : null) ||
    req.query.assignedCounsellorName ||
    req.query.counsellorName ||
    req.query.counsellor_name ||
    (req.query.counsellor && !mongoose.Types.ObjectId.isValid(req.query.counsellor) ? req.query.counsellor : null) ||
    (req.query.assignedCounsellor && !mongoose.Types.ObjectId.isValid(req.query.assignedCounsellor) ? req.query.assignedCounsellor : null);

  let counsellorIdVal = null;
  if (req.user.role === "counsellor") {
    counsellorIdVal = req.user._id;
  } else {
    counsellorIdVal =
      (req.query.counsellor && mongoose.Types.ObjectId.isValid(req.query.counsellor) ? req.query.counsellor : null) ||
      (req.query.assignedCounsellor && mongoose.Types.ObjectId.isValid(req.query.assignedCounsellor) ? req.query.assignedCounsellor : null) ||
      (req.query.counsellorId && mongoose.Types.ObjectId.isValid(req.query.counsellorId) ? req.query.counsellorId : null);
  }

  if (counsellorNameVal && typeof counsellorNameVal === "string" && counsellorNameVal.trim()) {
    const counsellorQuery = {
      name: new RegExp(escapeRegex(counsellorNameVal.trim()), "i")
    };
    if (counsellorIdVal) {
      counsellorQuery._id = counsellorIdVal;
    }
    const matchingCounsellors = await Counsellor.find(counsellorQuery).select("_id");
    const counsellorIds = matchingCounsellors.map(c => c._id);
    filter.assignedCounsellor = { $in: counsellorIds };
  } else if (counsellorIdVal) {
    filter.assignedCounsellor = counsellorIdVal;
  }

  // Filter by enrolledCourses.name or course ID
  const courseNameVal =
    req.query["enrolledCourses.name"] ||
    (typeof req.query.enrolledCourses === "object" && !Array.isArray(req.query.enrolledCourses) ? req.query.enrolledCourses?.name : null) ||
    req.query.courseName ||
    req.query.courseNames ||
    req.query.course_name ||
    req.query.enrolledCourseName ||
    (req.query.course && !mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  const courseIdVal =
    (req.query.courseId && mongoose.Types.ObjectId.isValid(req.query.courseId) ? req.query.courseId : null) ||
    (req.query.course && mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  if (courseNameVal) {
    let names = [];
    if (Array.isArray(courseNameVal)) {
      names = courseNameVal.map(n => String(n).trim()).filter(Boolean);
    } else if (typeof courseNameVal === "string") {
      names = courseNameVal.split(",").map(n => n.trim()).filter(Boolean);
    }
    if (names.length > 0) {
      const courseRegexes = names.map(n => new RegExp(escapeRegex(n), "i"));
      const courseQuery = {
        $or: [
          { name: { $in: courseRegexes } },
          { courseCode: { $in: courseRegexes } }
        ]
      };
      if (courseIdVal) courseQuery._id = courseIdVal;
      const matchingCourses = await Course.find(courseQuery).select("_id");
      const courseIds = matchingCourses.map(c => c._id);
      andConditions.push({
        $or: [
          { enrolledCourses: { $in: courseIds } },
          { enrolledCourse: { $in: courseIds } }
        ]
      });
    }
  } else if (courseIdVal) {
    andConditions.push({
      $or: [
        { enrolledCourses: courseIdVal },
        { enrolledCourse: courseIdVal }
      ]
    });
  }

  // Filter by source.name or source ID
  const sourceNameVal =
    req.query["source.name"] ||
    (typeof req.query.source === "object" ? req.query.source?.name : null) ||
    req.query.sourceName ||
    req.query.source_name ||
    (req.query.source && !mongoose.Types.ObjectId.isValid(req.query.source) ? req.query.source : null);

  const sourceIdVal =
    req.query.sourceId ||
    (req.query.source && mongoose.Types.ObjectId.isValid(req.query.source) ? req.query.source : null);

  if (sourceNameVal && typeof sourceNameVal === "string" && sourceNameVal.trim()) {
    const sourceQuery = {
      name: new RegExp(escapeRegex(sourceNameVal.trim()), "i")
    };
    if (sourceIdVal) {
      sourceQuery._id = sourceIdVal;
    }
    const matchingSources = await Source.find(sourceQuery).select("_id");
    const sourceIds = matchingSources.map(s => s._id);
    filter.source = { $in: sourceIds };
  } else if (sourceIdVal) {
    filter.source = sourceIdVal;
  }

  if (req.query.type || req.query.candidateType) filter.candidateType = req.query.type || req.query.candidateType;

  // Date range for "date"
  const leadDateFrom =
    req.query.dateFrom ||
    req.query.leadDateFrom ||
    req.query["date.from"] ||
    (typeof req.query.date === "object" ? (req.query.date?.from || req.query.date?.startDate) : null) ||
    req.query.startDate ||
    req.query.from;

  const leadDateTo =
    req.query.dateTo ||
    req.query.leadDateTo ||
    req.query["date.to"] ||
    (typeof req.query.date === "object" ? (req.query.date?.to || req.query.date?.endDate) : null) ||
    req.query.endDate ||
    req.query.to;

  if (leadDateFrom || leadDateTo) {
    filter.date = {};
    if (leadDateFrom) filter.date.$gte = new Date(leadDateFrom);
    if (leadDateTo) {
      const end = new Date(leadDateTo);
      if (typeof leadDateTo === "string" && leadDateTo.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      filter.date.$lte = end;
    }
  } else if (typeof req.query.date === "string" && req.query.date.trim()) {
    const start = new Date(req.query.date);
    const end = new Date(req.query.date);
    if (req.query.date.length === 10) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    filter.date = { $gte: start, $lte: end };
  }

  if (req.query.createdAtFrom || req.query.createdAtTo || req.query.createdFrom || req.query.createdTo) {
    const cFrom = req.query.createdAtFrom || req.query.createdFrom;
    const cTo = req.query.createdAtTo || req.query.createdTo;
    filter.createdAt = {};
    if (cFrom) filter.createdAt.$gte = new Date(cFrom);
    if (cTo) {
      const end = new Date(cTo);
      if (typeof cTo === "string" && cTo.length === 10) end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Search by name, phone, alternativePhone, email
  if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
    const regex = new RegExp(escapeRegex(req.query.search.trim()), "i");
    andConditions.push({
      $or: [
        { name: regex },
        { phone: regex },
        { alternativePhone: regex },
        { email: regex }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

  const baseCountFilter = { ...filter };
  delete baseCountFilter.conversionStatus;

  const [data, totalCount, pendingCount, notRequestedCount, rejectedCount] = await Promise.all([
    Lead.find(filter)
      .populate("source enrolledCourse assignedCounsellor statusChangedBy", "name email phone username role")
      .populate("remarks.calledBy", "name")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Lead.countDocuments(filter),
    Lead.countDocuments({ ...baseCountFilter, candidateStatus: "closed", conversionStatus: "pending" }),
    Lead.countDocuments({ ...baseCountFilter, candidateStatus: "closed", conversionStatus: "not_requested" }),
    Lead.countDocuments({ ...baseCountFilter, candidateStatus: "closed", conversionStatus: "rejected" })
  ]);

  res.json({
    success: true,
    counts: {
      totalUnapprovedClosed: totalCount,
      pendingApproval: pendingCount,
      notRequested: notRequestedCount,
      rejected: rejectedCount
    },
    total: totalCount,
    page,
    pages: Math.ceil(totalCount / limit),
    data
  });
};

