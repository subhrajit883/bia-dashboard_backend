import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";
import { createStudent, getStudents, getStudentById, rejectConversion, updateStudent, uploadStudentDocuments, deleteStudentDocument } from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);
router.get("/:id", getStudentById);

router.use(protect);
router.post("/", authorize("admin", "counsellor"), createStudent);

// router.post("/conversion/:id/approve", authorize("admin"), approveConversion);
router.post("/conversion/:id/reject", authorize("admin"), rejectConversion);
router.put("/:id", authorize("admin", "counsellor"), updateStudent);
router.post("/:id/documents", authorize("admin", "accounts", "counsellor"), upload.array("documents", 20), uploadStudentDocuments);
router.delete("/:id/documents/:documentId", authorize("admin", "accounts"), deleteStudentDocument);

export default router;
