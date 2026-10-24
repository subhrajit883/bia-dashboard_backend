import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { getAllActiveCounsellors, getMyProfile, updateMyProfile, getAllCounsellors, getCounsellorById, getCounsellorPerformance, deleteCounsellor } from "../controllers/counsellorController.js";

const router = express.Router();


router.get("/me", getMyProfile);
router.get("/all", getAllCounsellors);
router.get("/all-active", getAllActiveCounsellors);

router.use(protect);
router.get("/performance", authorize("admin", "counsellor"), getCounsellorPerformance);
router.get("/:id", getCounsellorById);

router.delete("/:id", authorize("admin"), deleteCounsellor);    



router.put("/me", authorize("counsellor"), updateMyProfile);


export default router;
