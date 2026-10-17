import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { listCounsellors, updateCounsellorStatus, createAccountUser, listAccountsUsers, loginHistory } from "../controllers/adminController.js";

const router = express.Router();
router.use(protect, authorize("admin"));
router.get("/counsellors", listCounsellors);
router.patch("/counsellors/:id/status", updateCounsellorStatus);
router.post("/accounts-users", createAccountUser);
router.get("/accounts-users", listAccountsUsers);
router.get("/login-history", loginHistory);

export default router;
