import Source from "../models/Source.js";

export const createSource = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    const error = new Error("Source name is required.");
    error.statusCode = 400;
    throw error;
  }
  const data = await Source.create({ name: name.trim(), createdBy: req.user._id });
  res.status(201).json({ success: true, message: "Lead source created successfully.", data });
};

export const getSources = async (req, res) => {
  // const filter = req.user.role === "admin" ? {} : { isActive: true };
  // if (req.user.role === "admin" && req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
  const data = await Source.find().sort({ createdAt: -1 });
  res.json({ success: true, count: data.length, data });
};

export const updateSource = async (req, res) => {
  const data = await Source.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) {
    const error = new Error("Lead source not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Lead source updated successfully.", data });
};

export const deleteSource = async (req, res) => {
  const data = await Source.findByIdAndDelete(req.params.id);
  if (!data) {
    const error = new Error("Lead source not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Lead source deleted successfully.", data: null });
};
