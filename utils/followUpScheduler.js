import Lead from "../models/Lead.js";
import "../models/Counsellor.js";
import "../models/Course.js";
import sendEmail from "./sendEmail.js";

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
      let updated = false;
      const defaultCounsellor = lead.assignedCounsellor;

      for (const remark of lead.remarks) {
        if (remark.nextCallDate && new Date(remark.nextCallDate) <= now && !remark.reminderSent) {
          const counsellor = (defaultCounsellor?.email && defaultCounsellor?.isActive && defaultCounsellor?.status === "active")
            ? defaultCounsellor
            : (remark.calledBy?.email && remark.calledBy?.isActive && remark.calledBy?.status === "active" ? remark.calledBy : null);

          if (!counsellor) {
            console.warn(`[FollowUpScheduler] Skipping reminder for lead "${lead.name}" (${lead._id}): No active counsellor email found.`);
            continue;
          }

          const courseNames = lead.enrolledCourses?.map((c) => c.name).filter(Boolean).join(", ") || lead.enrolledCourse?.name || "N/A";
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

          try {
            await sendEmail({ to: counsellor.email, subject, html });
            remark.reminderSent = true;
            updated = true;
            console.log(`[FollowUpScheduler] Successfully sent reminder email for lead "${lead.name}" to ${counsellor.email}`);
          } catch (err) {
            console.error(`[FollowUpScheduler] Failed to send follow-up reminder email to ${counsellor.email}: ${err.message}`);
          }
        }
      }

      if (updated) {
        await lead.save();
      }
    }
  } catch (error) {
    console.error("Error running checkPendingFollowUpReminders:", error.message);
  }
};

export const initFollowUpScheduler = (intervalMinutes = 5) => {
  setTimeout(() => {
    checkPendingFollowUpReminders().catch(() => null);
  }, 5000);

  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(() => {
    checkPendingFollowUpReminders().catch(() => null);
  }, intervalMs);
};
