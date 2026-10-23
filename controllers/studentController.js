import mongoose from "mongoose";
import crypto from "crypto";
import Lead from "../models/Lead.js";
import Student from "../models/Student.js";
import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import Counsellor from "../models/Counsellor.js";
import generateStudentId from "../utils/generateStudentId.js";
import deleteFromCloudinary from "../utils/deleteFromCloudinary.js";

export const createStudent = async (req, res) => {
  const {
    name,
    email,
    phone,
    alternativePhone,
    address,
    dob,
    age,
    enrolledCourse,
    enrolledCourses,
    gender,
    assignedCounsellor,
    totalFees,
    dateOfAdmission,
    paymentStatus,
    isActive,
    password,
    convertedFromLead
  } = req.body;

  let courseIds = [];
  if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
    courseIds = enrolledCourses;
  } else if (enrolledCourse) {
    courseIds = Array.isArray(enrolledCourse) ? enrolledCourse : [enrolledCourse];
  }

  const counsellorId = assignedCounsellor || (req.user?.role === "counsellor" ? req.user._id : null);

  if (!name || !phone || courseIds.length === 0 || !counsellorId) {
    const error = new Error("Name, phone number, enrolled course(s), and assigned counsellor are required.");
    error.statusCode = 400;
    throw error;
  }

  const [courses, counsellor] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }),
    Counsellor.findOne({ _id: counsellorId, status: "active", isActive: true })
  ]);

  if (!courses || courses.length === 0) {
    const error = new Error("Selected course(s) do not exist or are inactive.");
    error.statusCode = 400;
    throw error;
  }
  if (!counsellor) {
    const error = new Error("Selected counsellor is not active.");
    error.statusCode = 400;
    throw error;
  }

  if (convertedFromLead) {
    const existingConversion = await Student.findOne({ convertedFromLead });
    if (existingConversion) {
      const error = new Error("A student has already been created from this lead.");
      error.statusCode = 409;
      throw error;
    }
  }

  const calculatedTotalFees = totalFees !== undefined
    ? Number(totalFees)
    : courses.reduce((sum, c) => sum + (c.totalFees || 0), 0);

  const s_id = await generateStudentId();
  const initialPassword = password || cryptoRandomPassword();
  const calculatedAge = age !== undefined
    ? Number(age)
    : (dob ? Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)) : null);

  const studentData = {
    name,
    email: email || "",
    phone,
    alternativePhone: alternativePhone || "",
    address: address || "",
    age: calculatedAge,
    enrolledCourse: courseIds[0],
    enrolledCourses: courseIds,
    gender: gender || "prefer_not_to_say",
    dateOfAdmission: dateOfAdmission || new Date(),
    assignedCounsellor: counsellorId,
    totalFees: calculatedTotalFees,
    s_id,
    paymentStatus: paymentStatus || "pending",
    isActive: isActive !== undefined ? (isActive === true || isActive === "true") : true,
    password: initialPassword
  };

  if (convertedFromLead) {
    studentData.convertedFromLead = convertedFromLead;
  }

  const student = new Student(studentData);
  await student.save();

  const populated = await Student.findById(student._id)
    .select("-password")
    .populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode email totalFees");

  res.status(201).json({
    success: true,
    message: "Student created successfully.",
    data: {
      id: student._id,
      s_id: student.s_id,
      initialPassword,
      student: populated
    }
  });
};

const escapeRegex = (string = "") => {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const getStudents = async (req, res) => {
  const filter = {};
  const andConditions = [];

  // Filter by s_id
  const sIdVal = req.query.s_id || req.query.sid || req.query.studentId;
  if (sIdVal) {
    if (Array.isArray(sIdVal)) {
      filter.s_id = { $in: sIdVal.map(id => new RegExp(escapeRegex(String(id).trim()), "i")) };
    } else if (typeof sIdVal === "string" && sIdVal.trim()) {
      if (sIdVal.includes(",")) {
        const ids = sIdVal.split(",").map(id => new RegExp(escapeRegex(id.trim()), "i")).filter(Boolean);
        filter.s_id = { $in: ids };
      } else {
        filter.s_id = new RegExp(escapeRegex(sIdVal.trim()), "i");
      }
    }
  }

  // Filter by paymentStatus
  const paymentStatusVal = req.query.paymentStatus || req.query.payment_status;
  if (paymentStatusVal) {
    if (Array.isArray(paymentStatusVal)) {
      filter.paymentStatus = { $in: paymentStatusVal.map(s => String(s).trim().toLowerCase()) };
    } else if (typeof paymentStatusVal === "string" && paymentStatusVal.trim()) {
      const statuses = paymentStatusVal.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      filter.paymentStatus = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
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

  // Filter by dateOfAdmission date range
  const admissionFrom =
    req.query.dateOfAdmissionFrom ||
    req.query.admissionFrom ||
    req.query.admissionStartDate ||
    req.query["dateOfAdmission.from"] ||
    (typeof req.query.dateOfAdmission === "object" ? (req.query.dateOfAdmission?.from || req.query.dateOfAdmission?.startDate) : null) ||
    req.query.startDate ||
    req.query.from ||
    req.query.dateFrom;

  const admissionTo =
    req.query.dateOfAdmissionTo ||
    req.query.admissionTo ||
    req.query.admissionEndDate ||
    req.query["dateOfAdmission.to"] ||
    (typeof req.query.dateOfAdmission === "object" ? (req.query.dateOfAdmission?.to || req.query.dateOfAdmission?.endDate) : null) ||
    req.query.endDate ||
    req.query.to ||
    req.query.dateTo;

  if (admissionFrom || admissionTo) {
    filter.dateOfAdmission = {};
    if (admissionFrom) filter.dateOfAdmission.$gte = new Date(admissionFrom);
    if (admissionTo) {
      const end = new Date(admissionTo);
      if (typeof admissionTo === "string" && admissionTo.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      filter.dateOfAdmission.$lte = end;
    }
  } else if (typeof req.query.dateOfAdmission === "string" && req.query.dateOfAdmission.trim()) {
    const start = new Date(req.query.dateOfAdmission);
    const end = new Date(req.query.dateOfAdmission);
    if (req.query.dateOfAdmission.length === 10) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    filter.dateOfAdmission = { $gte: start, $lte: end };
  }

  // Search in name, phone, email
  if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
    const searchRegex = new RegExp(escapeRegex(req.query.search.trim()), "i");
    andConditions.push({
      $or: [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ]
    });
  }

  // Filter by enrolledCourses / enrolledCourse (by ID or course name)
  const courseNameVal =
    req.query.courseName ||
    req.query["enrolledCourses.name"] ||
    req.query["enrolledCourse.name"] ||
    (req.query.course && !mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  const courseIdVal =
    (req.query.courseId && mongoose.Types.ObjectId.isValid(req.query.courseId) ? req.query.courseId : null) ||
    (req.query.course && mongoose.Types.ObjectId.isValid(req.query.course) ? req.query.course : null);

  if (courseNameVal && typeof courseNameVal === "string" && courseNameVal.trim()) {
    const courseRegex = new RegExp(escapeRegex(courseNameVal.trim()), "i");
    const courseQuery = {
      $or: [{ name: courseRegex }, { courseCode: courseRegex }]
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
  } else if (courseIdVal) {
    andConditions.push({
      $or: [
        { enrolledCourses: courseIdVal },
        { enrolledCourse: courseIdVal }
      ]
    });
  }

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const page = req.query.page ? Math.max(1, Number(req.query.page)) : null;
  const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : null;

  if (page && limit) {
    const [data, total] = await Promise.all([
      Student.find(filter)
        .select("-password")
        .populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode email totalFees")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Student.countDocuments(filter)
    ]);
    return res.json({
      success: true,
      total,
      count: data.length,
      page,
      pages: Math.ceil(total / limit),
      data
    });
  }

  const data = await Student.find(filter)
    .select("-password")
    .populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode email totalFees")
    .sort({ createdAt: -1 });

  res.json({ success: true, count: data.length, data });
};

export const getStudentById = async (req, res) => {
  const filter = { _id: req.params.id };
  // if (req.user.role === "student") filter._id = req.user._id;
  // if (req.user.role === "counsellor") filter.assignedCounsellor = req.user._id;
  const data = await Student.findOne(filter).select("-password")
    .populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode email totalFees");
  if (!data) {
    const error = new Error("Student not found or you do not have permission to view this student.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, data });
};

export const approveConversion = async (req, res) => {
  const session = await mongoose.startSession();
  let createdStudent;
  try {
    await session.withTransaction(async () => {
      const lead = await Lead.findById(req.params.id).session(session);
      if (!lead) {
        const error = new Error("Lead not found.");
        error.statusCode = 404;
        throw error;
      }
      if (lead.conversionStatus === "approved") {
        const error = new Error("This candidate has already been converted into a student.");
        error.statusCode = 409;
        throw error;
      }
      const courseIds = lead.enrolledCourses && lead.enrolledCourses.length > 0
        ? lead.enrolledCourses
        : (lead.enrolledCourse ? [lead.enrolledCourse] : []);
      const courses = await Course.find({ _id: { $in: courseIds } }).session(session);
      const counsellor = await Counsellor.findOne({ _id: lead.assignedCounsellor, status: "active" }).session(session);
      if (courses.length === 0 || !counsellor) {
        const error = new Error("The lead's course(s) or assigned counsellor is no longer available. Update the lead before approval.");
        error.statusCode = 400;
        throw error;
      }
      const totalCourseFees = courses.reduce((sum, c) => sum + (c.totalFees || 0), 0);
      const s_id = await generateStudentId();
      const initialPassword = cryptoRandomPassword();
      const age = lead.dob ? Math.max(0, Math.floor((Date.now() - new Date(lead.dob).getTime()) / 31557600000)) : null;
      const student = new Student({
        name: lead.name, email: lead.email, phone: lead.phone,
        alternativePhone: lead.alternativePhone, address: lead.fullAddress, age,
        enrolledCourse: courseIds[0], enrolledCourses: courseIds, gender: lead.gender, dateOfAdmission: new Date(),
        assignedCounsellor: lead.assignedCounsellor, totalFees: totalCourseFees,
        s_id, paymentStatus: "pending", password: initialPassword, convertedFromLead: lead._id
      });
      await student.save({ session });
      lead.candidateStatus = "closed";
      lead.conversionStatus = "approved";
      lead.convertedStudent = student._id;
      lead.conversionRemarks = req.body.remarks || lead.conversionRemarks || "Converted to student by admin";
      await lead.save({ session });
      createdStudent = { id: student._id, s_id: student.s_id, initialPassword };
    });
  } finally {
    await session.endSession();
  }
  res.json({ success: true, message: "Lead approved and converted into a student.", data: createdStudent });
};

const cryptoRandomPassword = () => {
  return `Bia@${crypto.randomBytes(9).toString("base64url")}`;
};

export const rejectConversion = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    const error = new Error("Lead not found.");
    error.statusCode = 404;
    throw error;
  }
  if (lead.conversionStatus !== "pending") {
    const error = new Error("Only pending conversion requests can be rejected.");
    error.statusCode = 400;
    throw error;
  }
  lead.conversionStatus = "rejected";
  lead.conversionRemarks = req.body.remarks || "Rejected by admin";
  await lead.save();
  res.json({ success: true, message: "Student conversion request rejected.", data: lead });
};

export const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }
  if (req.user.role === "counsellor" && String(student.assignedCounsellor) !== String(req.user._id)) {
    const error = new Error("You can only access students assigned to your counsellor account.");
    error.statusCode = 403;
    throw error;
  }
  // const allowed = req.user.role === "admin"
  //   ? ["name", "email", "phone", "alternativePhone", "address", "age", "enrolledCourse", "enrolledCourses", "gender", "isActive", "dateOfAdmission", "assignedCounsellor", "totalFees", "s_id", "password"]
  //   : ["email", "alternativePhone", "address"];

  
const allowed = [
  "name",
  "email",
  "phone",
  "alternativePhone",
  "address",
  "age",
  "enrolledCourse",
  "enrolledCourses",
  "gender",
  "isActive",
  "dateOfAdmission",
  "assignedCounsellor",
  "totalFees",
  "s_id",
  "password",
];


  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === "s_id") {
        if (typeof req.body.s_id !== "string" || !req.body.s_id.trim()) {
          const error = new Error("Student ID must be a non-empty string.");
          error.statusCode = 400;
          throw error;
        }
        student.s_id = req.body.s_id.trim().toUpperCase();
      } else if (key === "password") {
        if (typeof req.body.password !== "string" || req.body.password.length < 8) {
          const error = new Error("Student password must be at least 8 characters long.");
          error.statusCode = 400;
          throw error;
        }
        student.password = req.body.password;
      } else if (key === "enrolledCourses" && Array.isArray(req.body.enrolledCourses)) {
        student.enrolledCourses = req.body.enrolledCourses;
        if (req.body.enrolledCourses.length > 0) student.enrolledCourse = req.body.enrolledCourses[0];
      } else if (key === "enrolledCourse") {
        if (Array.isArray(req.body.enrolledCourse)) {
          student.enrolledCourses = req.body.enrolledCourse;
          student.enrolledCourse = req.body.enrolledCourse[0];
        } else {
          student.enrolledCourse = req.body.enrolledCourse;
          student.enrolledCourses = [req.body.enrolledCourse];
        }
      } else {
        student[key] = req.body[key];
      }
    }
  }
  await student.save();
  res.json({ success: true, message: "Student updated successfully.", data: await Student.findById(student._id).select("-password").populate("enrolledCourse enrolledCourses assignedCounsellor", "name courseCode email totalFees") });
};


export const uploadStudentDocuments = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }
  // if (req.user.role === "counsellor" && String(student.assignedCounsellor) !== String(req.user._id)) {
  //   const error = new Error("You cannot upload documents for a student assigned to another counsellor.");
  //   error.statusCode = 403;
  //   throw error;
  // }
  const names = Array.isArray(req.body.documentNames) ? req.body.documentNames : [req.body.documentNames];
  if (!req.files?.length) {
    const error = new Error("Please attach at least one document.");
    error.statusCode = 400;
    throw error;
  }
  req.files.forEach((file, index) => {
    student.documents.push({
      documentName: names[index] || file.originalname,
      documentUrl: file.path,
      public_id: file.filename,
      uploadedAt: new Date()
    });
  });
  await student.save();
  res.status(201).json({ success: true, message: "Student documents uploaded successfully.", data: student.documents });
};

export const deleteStudentDocument = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }
  const document = student.documents.id(req.params.documentId);
  if (!document) {
    const error = new Error("The requested student document was not found.");
    error.statusCode = 404;
    throw error;
  }
  const resourceType = document.documentUrl.includes("/raw/upload/") ? "raw" : "image";
  await deleteFromCloudinary(document.public_id, resourceType).catch(() => null);
  document.deleteOne();
  await student.save();
  res.json({ success: true, message: "Student document deleted successfully." });
};
