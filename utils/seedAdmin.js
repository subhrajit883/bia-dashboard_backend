import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";

const seed = async () => {
  await connectDB();
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env before running the admin seed.");
  }
  const existing = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    existing.name = ADMIN_NAME;
    existing.password = ADMIN_PASSWORD;
    await existing.save();
    console.log("Existing admin account updated with credentials from .env.");
  } else {
    await Admin.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    console.log("Initial admin account created successfully.");
  }
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
