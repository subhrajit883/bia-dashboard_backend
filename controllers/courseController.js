import Course from "../models/Course.js";

export const createCourse = async (req, res) => {
  const { name, courseCode, description, totalFees, duration } = req.body;
  if (!name || totalFees === undefined) {
    const error = new Error("Course name and total fees are required.");
    error.statusCode = 400;
    throw error;
  }
  const data = await Course.create({ name, courseCode, description, totalFees, duration, createdBy: req.user._id });
  res.status(201).json({ success: true, message: "Course created successfully.", data });
};

export const getCourses = async (req, res) => {
  // const filter = req.user.role === "admin" ? {} : { isActive: true };
  // if (req.user.role === "admin" && req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
  const data = await Course.find({}).sort({ createdAt: -1 });
  res.json({ success: true, count: data.length, data });
};

export const updateCourse = async (req, res) => {
  const data = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) {
    const error = new Error("Course not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Course updated successfully.", data });
};

export const deleteCourse = async (req, res) => {
  const data = await Course.findByIdAndDelete(req.params.id);
  if (!data) {
    const error = new Error("Course not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Course deleted successfully.", data: null });
};
