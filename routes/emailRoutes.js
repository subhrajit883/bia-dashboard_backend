import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { createTemplate, getTemplates, updateTemplate, deleteTemplate, sendCandidateEmail, getEmailLogs } from "../controllers/emailController.js";

const router = express.Router();
router.use(protect, authorize("admin", "counsellor"));
router.get("/templates", getTemplates);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/send", sendCandidateEmail);
router.get("/logs", getEmailLogs);


export default router;
