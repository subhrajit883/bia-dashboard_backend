import crypto from "crypto";
import Admin from "../models/Admin.js";
import Counsellor from "../models/Counsellor.js";
import Account from "../models/Account.js";
import Student from "../models/Student.js";
import PasswordReset from "../models/PasswordReset.js";
import LoginHistory from "../models/LoginHistory.js";
import generateToken from "../utils/generateToken.js";
import generateResetToken from "../utils/generateResetToken.js";
import getDeviceInfo from "../utils/deviceInfo.js";
import sendEmail from "../utils/sendEmail.js";

const roleModels = { admin: Admin, counsellor: Counsellor, accounts: Account, student: Student };

export const registerCounsellor = async (req, res) => {
  const { name, email, phone, username, password } = req.body;
  if (!name || !email || !username || !password) {
    const error = new Error("Name, email, username and password are all required.");
    error.statusCode = 400;
    throw error;
  }
  if (password.length < 8) {
    const error = new Error("Password must contain at least 8 characters.");
    error.statusCode = 400;
    throw error;
  }
  const existing = await Counsellor.findOne({
    $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
  });
  if (existing) {
    const error = new Error("A counsellor already exists with this email or username.");
    error.statusCode = 409;
    throw error;
  }
  const counsellor = await Counsellor.create({ name, email, username, phone, password, status: "inactive" });
  res.status(201).json({ success: true, message: "Registration submitted. Your account will be available after admin approval.", data: { id: counsellor._id, name: counsellor.name, status: counsellor.status } });
};

export const registerAccount = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    const error = new Error("Name, email and password are required.");
    error.statusCode = 400;
    throw error;
  }
  if (password.length < 8) {
    const error = new Error("Password must contain at least 8 characters.");
    error.statusCode = 400;
    throw error;
  }
  const existing = await Account.findOne({ email: email.toLowerCase() });
  if (existing) {
    const error = new Error("An account user already exists with this email address.");
    error.statusCode = 409;
    throw error;
  }
  const accountUser = await Account.create({ name, email, phone, password });
  res.status(201).json({
    success: true,
    message: "Account user registered successfully.",
    data: { id: accountUser._id, name: accountUser.name, email: accountUser.email }
  });
};


export const login = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    const error = new Error("Email, password and role are required.");
    error.statusCode = 400;
    throw error;
  }
  const Model = roleModels[role];
  if (!Model) {
    const error = new Error("Invalid role. Choose admin, counsellor, accounts or student.");
    error.statusCode = 400;
    throw error;
  }
  const lookup = role === "student"
    ? { s_id: email.trim().toUpperCase() }
    : { email: email.toLowerCase() };
  const user = await Model.findOne(lookup).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    const error = new Error("The email or password you entered is incorrect.");
    error.statusCode = 401;
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }
  
  if (user.isActive === false || (role === "counsellor" && user.status !== "active")) {
    const error = new Error("Your account is inactive or awaiting admin approval. Please contact the administrator.");
    error.statusCode = 403;
    error.code = "ACCOUNT_INACTIVE";
    throw error;
  }

  const info = getDeviceInfo(req);
  const session = await LoginHistory.create({
    userId: user._id, role, email: user.email, ...info, isActiveSession: true
  });
  const token = generateToken(user._id, role, session._id);
  res.cookie("token", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", maxAge: 24 * 60 * 60 * 1000
  });
  res.json({
    success: true, message: "Login successful.",
    data: { token, role, user: { id: user._id, name: user.name, email: user.email, ...(role === "student" ? { s_id: user.s_id } : {}) } }
  });
};

export const logout = async (req, res) => {
  if (req.loginSession) {
    req.loginSession.isActiveSession = false;
    req.loginSession.logoutAt = new Date();
    await req.loginSession.save();
  }
  res.clearCookie("token");
  res.json({ success: true, message: "You have been logged out successfully." });
};

export const forgotPassword = async (req, res) => {
  const { email, role } = req.body;
  const Model = roleModels[role];
  if (!email || !Model) {
    const error = new Error("A valid email address and account role are required.");
    error.statusCode = 400;
    throw error;
  }
  const user = await Model.findOne({ email: email.toLowerCase() });
  // Do not disclose whether an account exists.
  if (user) {
    await PasswordReset.deleteMany({ userId: user._id, role, usedAt: null });
    const { rawToken, hashedToken } = generateResetToken();
    const minutes = Number(process.env.PASSWORD_RESET_MINUTES || 15);
    await PasswordReset.create({
      userId: user._id, role, tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + minutes * 60 * 1000)
    });
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}&role=${role}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your academy account password",
      html: `<p>Hello ${user.name || "User"},</p><p>Use the link below to reset your password. It expires in ${minutes} minutes.</p><p><a href="${link}">Reset password</a></p>`
    });
  }
  res.json({ success: true, message: "If an account exists for that email, password reset instructions have been sent." });
};

export const resetPassword = async (req, res) => {
  const { token, role, password } = req.body;
  if (!token || !role || !password || password.length < 8) {
    const error = new Error("A valid reset token, role and password of at least 8 characters are required.");
    error.statusCode = 400;
    throw error;
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = await PasswordReset.findOne({ tokenHash, role, usedAt: null, expiresAt: { $gt: new Date() } });
  if (!reset) {
    const error = new Error("This password reset link is invalid, expired or has already been used. Request a new link.");
    error.statusCode = 400;
    throw error;
  }
  const user = await roleModels[role].findById(reset.userId).select("+password");
  if (!user) {
    const error = new Error("The account for this reset request could not be found.");
    error.statusCode = 404;
    throw error;
  }
  user.password = password;
  await user.save();
  reset.usedAt = new Date();
  await reset.save();
  await LoginHistory.updateMany({ userId: user._id, isActiveSession: true }, { isActiveSession: false, logoutAt: new Date() });
  res.json({ success: true, message: "Password changed successfully. Please log in with your new password." });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    const error = new Error("Current password and a new password of at least 8 characters are required.");
    error.statusCode = 400;
    throw error;
  }
  const Model = roleModels[req.user.role];
  const user = await Model.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    const error = new Error("Your current password is incorrect.");
    error.statusCode = 400;
    throw error;
  }
  user.password = newPassword;
  await user.save();
  await LoginHistory.updateMany({ userId: user._id, isActiveSession: true }, { isActiveSession: false, logoutAt: new Date() });
  res.json({ success: true, message: "Password updated. Please log in again." });
};

export const me = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
