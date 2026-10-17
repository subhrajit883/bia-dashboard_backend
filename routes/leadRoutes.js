import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { createLead, getLeads, getLeadById, updateLead, addFollowUp, requestConversion, assignLead, deleteLead, getUnapprovedClosedLeads, triggerFollowUpReminders } from "../controllers/leadController.js";
import { approveConversion } from "../controllers/studentController.js";

const router = express.Router();
router.get("/", getLeads);
router.use(protect, authorize("admin", "counsellor"));
router.post("/", authorize("admin", "counsellor"), createLead);
router.get("/unapproved-closed", getUnapprovedClosedLeads);
router.get("/closed-pending-approvals", getUnapprovedClosedLeads);
router.post("/trigger-reminders", triggerFollowUpReminders);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);
router.post("/:id/follow-ups", addFollowUp);
router.post("/:id/request-conversion", requestConversion);
router.post("/:id/convert", authorize("admin"), approveConversion);
router.patch("/:id/assign", assignLead);
router.delete("/:id", authorize("admin"), deleteLead);

export default router;
