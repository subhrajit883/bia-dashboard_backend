import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Counsellor from "../models/Counsellor.js";
import Account from "../models/Account.js";
import Student from "../models/Student.js";
import LoginHistory from "../models/LoginHistory.js";

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : req.cookies?.token;

  if (!token) {
    const error = new Error("Authentication is required. Please log in to continue.");
    error.statusCode = 401;
    error.code = "AUTH_REQUIRED";
    return next(error);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const models = { admin: Admin, counsellor: Counsellor, accounts: Account, student: Student };
  const Model = models[decoded.role];

  if (!Model) {
    const error = new Error("The account role in this session is not recognized.");
    error.statusCode = 401;
    return next(error);
  }

  const user = await Model.findById(decoded.id).select("-password");
  if (!user) {
    const error = new Error("The account associated with this session no longer exists.");
    error.statusCode = 401;
    return next(error);
  }

  if (user.isActive === false || (decoded.role === "counsellor" && user.status !== "active")) {
    const error = new Error("Your account is inactive. Please contact the administrator.");
    error.statusCode = 403;
    error.code = "ACCOUNT_INACTIVE";
    return next(error);
  }

  if (decoded.sessionId) {
    const session = await LoginHistory.findOne({
      _id: decoded.sessionId,
      userId: user._id,
      isActiveSession: true
    });
    if (!session) {
      const error = new Error("This login session is no longer active. Please log in again.");
      error.statusCode = 401;
      error.code = "SESSION_REVOKED";
      return next(error);
    }
    req.loginSession = session;
  }

  req.user = { ...user.toObject(), role: decoded.role };
  next();
};

export default protect;
