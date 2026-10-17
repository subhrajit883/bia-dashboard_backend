import express from "express";
import { registerCounsellor, registerAccount, login, logout, forgotPassword, resetPassword, changePassword, me } from "../controllers/authController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/register-counsellor", registerCounsellor);
router.post("/register-account", registerAccount);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", protect, changePassword);
router.get("/me", protect, me);

export default router;
