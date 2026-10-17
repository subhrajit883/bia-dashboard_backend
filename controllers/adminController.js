import Counsellor from "../models/Counsellor.js";
import Account from "../models/Account.js";
import LoginHistory from "../models/LoginHistory.js";

export const listCounsellors = async (req, res) => {
  const data = await Counsellor.find().select("-password").sort({ createdAt: -1 });
  res.json({ success: true, count: data.length, data });
};

export const updateCounsellorStatus = async (req, res) => {
  let { status } = req.body;
  if (status === true || status === "true") {
    status = "active";
  } else if (status === false || status === "false") {
    status = "inactive";
  }
  if (!["active", "inactive"].includes(status)) {
    const error = new Error("Status must be active, inactive, or boolean (true/false).");
    error.statusCode = 400;
    throw error;
  }
  const data = await Counsellor.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).select("-password");
  
  if (!data) {
    const error = new Error("Counsellor not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ success: true, message: `Counsellor ${status === "active" ? "approved/activated" : "deactivated"} successfully.`, data });
};

export const createAccountUser = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    const error = new Error("Name, email and a password of at least 8 characters are required.");
    error.statusCode = 400;
    throw error;
  }
  const data = await Account.create({ name, email, phone, password });
  res.status(201).json({ success: true, message: "Accounts user created successfully.", data: { id: data._id, name: data.name, email: data.email } });
};

export const listAccountsUsers = async (req, res) => {
  const data = await Account.find().select("-password").sort({ createdAt: -1 });
  res.json({ success: true, count: data.length, data });
};

export const loginHistory = async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.from || req.query.to) {
    filter.loginAt = {};
    if (req.query.from) filter.loginAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.loginAt.$lte = new Date(req.query.to);
  }
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
  const [data, total] = await Promise.all([
    LoginHistory.find(filter).sort({ loginAt: -1 }).skip((page - 1) * limit).limit(limit),
    LoginHistory.countDocuments(filter)
  ]);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), data });
};
