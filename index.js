import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/database.js";

// Routes
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import facultyRoutes from "./routes/faculty.js";
import tutorRoutes from "./routes/tutor.js";
import studentRoutes from "./routes/student.js";
import clubRoutes from "./routes/club.js";
import attendanceRoutes from "./routes/attendance.js";

// Utils
import { syncHemisData } from "./utils/syncHemisData.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/attendance", attendanceRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Dogerek API is running" });
});

// Hemis data sync endpoint (faqat admin uchun)
app.get("/api/sync-hemis", async (req, res) => {
  try {
    const result = await syncHemisData();
    res.json({ success: true, message: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
