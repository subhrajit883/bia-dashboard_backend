import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { counsellorPerformance, exportCounsellorPerformance } from "../controllers/reportController.js";

const router = express.Router();
router.use(protect, authorize("admin"));
router.get("/counsellor-performance", counsellorPerformance);
router.get("/counsellor-performance/export", exportCounsellorPerformance);

export default router;
