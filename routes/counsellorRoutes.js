import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { getAllActiveCounsellors, getMyProfile, updateMyProfile, getAllCounsellors, getCounsellorById, getCounsellorPerformance, deleteCounsellor } from "../controllers/counsellorController.js";

const router = express.Router();


router.get("/me", protect, authorize("counsellor"), getMyProfile);
router.put("/me", protect, authorize("counsellor"), updateMyProfile);
router.get("/all", getAllCounsellors);
router.get("/all-active", getAllActiveCounsellors);

router.use(protect);
router.get("/performance", authorize("admin", "counsellor"), getCounsellorPerformance);
router.get("/:id", getCounsellorById);

router.delete("/:id", authorize("admin"), deleteCounsellor);    

export default router;
