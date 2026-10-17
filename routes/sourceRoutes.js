import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { createSource, getSources, updateSource, deleteSource } from "../controllers/sourceController.js";

const router = express.Router();

router.get("/", getSources);

router.use(protect);

router.post("/", authorize("admin"), createSource);
router.put("/:id", authorize("admin"), updateSource);
router.delete("/:id", authorize("admin"), deleteSource);

export default router;
