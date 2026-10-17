import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { getFinancialSummary, getStudentLedger } from "../controllers/accountController.js";

const router = express.Router();

router.use(protect, authorize("admin", "accounts"));
router.get("/summary", getFinancialSummary);
router.get("/ledger/:studentId", getStudentLedger);

export default router;
