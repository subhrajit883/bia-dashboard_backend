import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import counsellorRoutes from "./routes/counsellorRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import sourceRoutes from "./routes/sourceRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { initFollowUpScheduler } from "./utils/followUpScheduler.js";

const app = express();


app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(",") || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Academy Management API is running.", timestamp: new Date().toISOString() });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again after 15 minutes.", error: { code: "RATE_LIMITED" } }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/counsellors", counsellorRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/sources", sourceRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  initFollowUpScheduler(5);

  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${port}`));
};


startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
