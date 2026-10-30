

import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { mongoose } from "mongoose";
import Lead from "../models/Lead.js";
import "../models/Counsellor.js";
import "../models/Course.js";
import sendEmail from "./sendEmail.js";

const FOLLOW_UP_REMINDER_JOB = "check pending follow-up reminders";
const SEND_FOLLOW_UP_REMINDER_JOB = "send follow-up reminder";

let agendaInstance;

const sendFollowUpReminder = async (lead, remark) => {
  const defaultCounsellor = lead.assignedCounsellor;
  const counsellor = (defaultCounsellor?.email && defaultCounsellor?.isActive && defaultCounsellor?.status === "active")
    ? defaultCounsellor
    : (remark.calledBy?.email && remark.calledBy?.isActive && remark.calledBy?.status === "active" ? remark.calledBy : null);

  if (!counsellor) {
    console.warn(`[FollowUpScheduler] Skipping reminder for lead "${lead.name}" (${lead._id}): No active counsellor email found.`);
    return false;
  }

  const courseNames = lead.enrolledCourses?.map((course) => course.name).filter(Boolean).join(", ") || lead.enrolledCourse?.name || "N/A";
  const scheduledDate = new Date(remark.nextCallDate).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short"
  });
  const subject = `[Reminder] Follow-up Scheduled: ${lead.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #2563eb; color: #ffffff; padding: 16px 24px;">
        <h2 style="margin: 0; font-size: 20px;">Follow-up Reminder</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${counsellor.name}</strong>,</p>
        <p>You have a follow-up scheduled for candidate <strong>${lead.name}</strong> on <strong>${scheduledDate}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="background-color: #f9fafb;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Candidate Name</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${lead.name}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Phone Number</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${lead.phone}</td></tr>
          <tr style="background-color: #f9fafb;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Email Address</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${lead.email || "N/A"}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Enrolled Course(s)</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${courseNames}</td></tr>
          <tr style="background-color: #f9fafb;"><td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Follow-up Note</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${remark.description}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #4b5563;">Please contact the candidate as per schedule.</p>
      </div>
    </div>
  `;

  await sendEmail({ to: counsellor.email, subject, html });
  remark.reminderSent = true;
  await lead.save();
  console.log(`[FollowUpScheduler] Successfully sent reminder email for lead "${lead.name}" to ${counsellor.email}`);
  return true;
};

const scheduleFollowUpReminder = async (leadId, remarkId, nextCallDate) => {
  if (!agendaInstance) {
    throw new Error("Cannot schedule a follow-up reminder before Agenda starts.");
  }

  const scheduledDate = new Date(nextCallDate);
  const runAt = scheduledDate <= new Date() ? new Date() : scheduledDate;
  await agendaInstance.create(SEND_FOLLOW_UP_REMINDER_JOB, {
    leadId: String(leadId),
    remarkId: String(remarkId)
  })
    .schedule(runAt)
    .unique({
      name: SEND_FOLLOW_UP_REMINDER_JOB,
      "data.leadId": String(leadId),
      "data.remarkId": String(remarkId)
    })
    .save();
};

const reconcileFollowUpReminderJobs = async () => {
  const leads = await Lead.find({
    isActive: true,
    remarks: {
      $elemMatch: {
        nextCallDate: { $ne: null },
        reminderSent: { $ne: true }
      }
    }
  }).select("remarks._id remarks.nextCallDate remarks.reminderSent");

  for (const lead of leads) {
    for (const remark of lead.remarks) {
      if (remark.nextCallDate && !remark.reminderSent) {
        await scheduleFollowUpReminder(lead._id, remark._id, remark.nextCallDate);
      }
    }
  }
};

export const checkPendingFollowUpReminders = async () => {
  try {
    const now = new Date();
    const leads = await Lead.find({
      isActive: true,
      remarks: {
        $elemMatch: {
          nextCallDate: { $lte: now, $ne: null },
          reminderSent: { $ne: true }
        }
      }
    }).populate("assignedCounsellor", "name email status isActive")
      .populate("remarks.calledBy", "name email status isActive")
      .populate("enrolledCourses enrolledCourse", "name courseCode");

    for (const lead of leads) {
      for (const remark of lead.remarks) {
        if (remark.nextCallDate && new Date(remark.nextCallDate) <= now && !remark.reminderSent) {
          try {
            await sendFollowUpReminder(lead, remark);
          } catch (error) {
            console.error(`[FollowUpScheduler] Failed to send follow-up reminder email for lead "${lead.name}": ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error running checkPendingFollowUpReminders:", error.message);
    throw error;
  }
};

export const initFollowUpScheduler = async (intervalMinutes = 5) => {
  const mongoDb = mongoose.connection.db;
  if (!mongoDb) {
    throw new Error("Cannot initialize follow-up scheduler before MongoDB connects.");
  }

  const agenda = new Agenda({
    backend: new MongoBackend({ mongo: mongoDb }),
  });
  agendaInstance = agenda;

  agenda.define(SEND_FOLLOW_UP_REMINDER_JOB, async (job) => {
    const { leadId, remarkId } = job.attrs.data;
    const lead = await Lead.findOne({
      _id: leadId,
      isActive: true,
      remarks: {
        $elemMatch: {
          _id: remarkId,
          nextCallDate: { $lte: new Date(), $ne: null },
          reminderSent: { $ne: true }
        }
      }
    }).populate("assignedCounsellor", "name email status isActive")
      .populate("remarks.calledBy", "name email status isActive")
      .populate("enrolledCourses enrolledCourse", "name courseCode");

    if (!lead) return;
    const remark = lead.remarks.id(remarkId);
    if (!remark) return;
    const sent = await sendFollowUpReminder(lead, remark);
    if (!sent) {
      throw new Error(`No active counsellor email found for follow-up reminder on lead ${leadId}.`);
    }
  });
  agenda.define(FOLLOW_UP_REMINDER_JOB, async () => {
    await reconcileFollowUpReminderJobs();
  });
  agenda.on("error", (error) => {
    console.error("[FollowUpScheduler] Agenda error:", error.message);
  });
  agenda.on("fail", (error, job) => {
    console.error(`[FollowUpScheduler] Job "${job.attrs.name}" failed:`, error.message);
  });

  await agenda.ready;
  await reconcileFollowUpReminderJobs();
  await agenda.every(`${intervalMinutes} minutes`, FOLLOW_UP_REMINDER_JOB);
  await agenda.start();
  console.log(`[FollowUpScheduler] Persistent follow-up jobs are active; pending reminders are reconciled every ${intervalMinutes} minutes.`);

  return agenda;
};

export { scheduleFollowUpReminder };
