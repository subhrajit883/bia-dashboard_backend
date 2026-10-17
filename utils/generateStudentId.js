import Student from "../models/Student.js";

const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const latest = await Student.findOne({ s_id: new RegExp(`^BIA${year}`) })
    .sort({ s_id: -1 })
    .select("s_id")
    .lean();

  const lastNumber = latest?.s_id ? Number(latest.s_id.slice(-5)) : 0;
  return `BIA${year}${String(lastNumber + 1).padStart(5, "0")}`;
};

export default generateStudentId;
