import express from "express";
import {
  getMyClubs,
  getClubApplications,
  processApplication,
  markAttendance,
  getAttendanceHistory,
  updateAttendance,
  addTelegramPost,
  getTutorDashboard,
} from "../controllers/tutorController.js";
import { authenticate } from "../middleware/auth.js";
import { isTutor } from "../middleware/roleCheck.js";

const router = express.Router();

// Barcha routelar authentication va tutor role tekshiruvidan o'tadi
router.use(authenticate, isTutor);

// Dashboard
router.get("/dashboard", getTutorDashboard);

// My clubs
router.get("/clubs", getMyClubs);

// Applications
router.get("/applications", getClubApplications);
router.post("/application/:id/process", processApplication);

// Attendance
router.post("/attendance", markAttendance);
router.get("/attendance/:clubId", getAttendanceHistory);
router.put("/attendance/:id", updateAttendance);

// Telegram posts
router.post("/attendance/:id/telegram-post", addTelegramPost);

export default router;
