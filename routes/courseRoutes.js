import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { createCourse, getCourses, updateCourse, deleteCourse } from "../controllers/courseController.js";

const router = express.Router();
router.get("/", getCourses);
router.use(protect);

router.post("/", authorize("admin"), createCourse);
router.put("/:id", authorize("admin"), updateCourse);
router.delete("/:id", authorize("admin"), deleteCourse);

export default router;
