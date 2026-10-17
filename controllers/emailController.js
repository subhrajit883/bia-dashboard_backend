import EmailTemplate from "../models/EmailTemplate.js";
import EmailLog from "../models/EmailLog.js";
import Lead from "../models/Lead.js";
import Student from "../models/Student.js";
import sendEmail from "../utils/sendEmail.js";

export const createTemplate = async (req, res) => {
  const { title, subject, body, isDraft, targetType } = req.body;
  if ( !title || !subject || !body) {
    const error = new Error("Template title, email subject and email body are required.");
    error.statusCode = 400;
    throw error;
  }
  const data = await EmailTemplate.create({
    title,
    subject,
    body,
    isDraft: isDraft === true || isDraft === "true",
    targetType: targetType || "all",
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, message: isDraft ? "Email draft saved." : "Email template created.", data });
};

export const getTemplates = async (req, res) => {
  const filter = req.user.role === "admin"
    ? {}
    : { $or: [{ createdBy: req.user._id }, { isActive: true, isDraft: false }] };
  const data = await EmailTemplate.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: data.length, data });
};

export const updateTemplate = async (req, res) => {
  
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) {
    const error = new Error("Email template not found.");
    error.statusCode = 404;
    throw error;
  }
  if (req.user.role === "counsellor" && String(template.createdBy) !== String(req.user._id)) {
    const error = new Error("You can only modify email templates or drafts created by your account.");
    error.statusCode = 403;
    throw error;
  }
  Object.assign(template, req.body, { updatedBy: req.user._id });
  await template.save();
  res.json({ success: true, message: "Email template updated.", data: template });
};

export const deleteTemplate = async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) {
    const error = new Error("Email template not found.");
    error.statusCode = 404;
    throw error;
  }
  if (req.user.role === "counsellor" && String(template.createdBy) !== String(req.user._id)) {
    const error = new Error("You can only delete email templates or drafts created by your account.");
    error.statusCode = 403;
    throw error;
  }
  await template.deleteOne();
  res.json({ success: true, message: "Email template deleted." });
};

export const sendCandidateEmail = async (req, res) => {
  const { leadIds, studentIds, templateId, subject: customSubject, body: customBody } = req.body;
  const lIds = Array.isArray(leadIds) ? leadIds : [];
  const sIds = Array.isArray(studentIds) ? studentIds : [];

  if (lIds.length === 0 && sIds.length === 0) {
    const error = new Error("Select at least one lead or student to send email.");
    error.statusCode = 400;
    throw error;
  }
  if (!templateId && (!customSubject || !customBody)) {
    const error = new Error("Please select an email template or provide custom subject and body.");
    error.statusCode = 400;
    throw error;
  }

  const template = templateId ? await EmailTemplate.findById(templateId) : null;
  if (templateId && !template) {
    const error = new Error("Selected email template does not exist.");
    error.statusCode = 400;
    throw error;
  }

  const subject = customSubject || template.subject;
  const body = customBody || template.body;

  const targets = [];

  if (lIds.length > 0) {
    const leads = await Lead.find({ _id: { $in: lIds } }).populate("enrolledCourses enrolledCourse", "name");
    for (const lead of leads) {
      if (!lead.email) continue;
      if (req.user.role === "counsellor" && String(lead.assignedCounsellor) !== String(req.user._id)) {
        const error = new Error(`Access denied. Candidate '${lead.name}' is assigned to another counsellor.`);
        error.statusCode = 403;
        throw error;
      }
      const courseName = lead.enrolledCourses?.map((c) => c.name).filter(Boolean).join(", ") || lead.enrolledCourse?.name || "";
      targets.push({
        type: "lead",
        id: lead._id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        course: courseName,
        s_id: ""
      });
    }
  }

  if (sIds.length > 0) {
    const students = await Student.find({ _id: { $in: sIds } }).populate("enrolledCourses enrolledCourse", "name");
    for (const student of students) {
      if (!student.email) continue;
      if (req.user.role === "counsellor" && String(student.assignedCounsellor) !== String(req.user._id)) {
        const error = new Error(`Access denied. Student '${student.name}' is assigned to another counsellor.`);
        error.statusCode = 403;
        throw error;
      }
      const courseName = student.enrolledCourses?.map((c) => c.name).filter(Boolean).join(", ") || student.enrolledCourse?.name || "";
      targets.push({
        type: "student",
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        course: courseName,
        s_id: student.s_id || ""
      });
    }
  }

  if (targets.length === 0) {
    const error = new Error("None of the selected leads or students have a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  const results = [];
  for (const target of targets) {
    const values = {
      name: target.name,
      email: target.email,
      phone: target.phone,
      course: target.course,
      s_id: target.s_id,
      counsellorName: req.user.name || ""
    };
    const personalizedSubject = subject.replace(/{{(\w+)}}/g, (_, key) => values[key] || "");
    const personalizedBody = body.replace(/{{(\w+)}}/g, (_, key) => values[key] || "");

    try {
      const info = await sendEmail({ to: target.email, subject: personalizedSubject, html: personalizedBody });
      const log = await EmailLog.create({
        recipients: [target.email],
        subject: personalizedSubject,
        template: template?._id || null,
        sentBy: req.user._id,
        status: "sent",
        providerMessageId: info.messageId
      });
      results.push({ id: target.id, type: target.type, email: target.email, status: "sent", logId: log._id });
    } catch (error) {
      await EmailLog.create({
        recipients: [target.email],
        subject: personalizedSubject,
        template: template?._id || null,
        sentBy: req.user._id,
        status: "failed",
        errorMessage: error.message
      });
      results.push({ id: target.id, type: target.type, email: target.email, status: "failed", message: error.message });
    }
  }

  res.json({ success: true, message: "Email process completed.", count: results.length, data: results });
};

