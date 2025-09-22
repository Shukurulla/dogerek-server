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
  getAttendanceByDate,
  removeStudentFromClub,
  restoreStudentToClub,
  getRemovedStudents,
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
router.put("/attendance/:id", updateAttendance);

// Get attendance by specific date
router.get("/attendance/by-date", getAttendanceByDate);

router.get("/attendance/:clubId", getAttendanceHistory);
// Telegram posts
router.post("/attendance/:id/telegram-post", addTelegramPost);

router.post("/club/:clubId/remove-student", removeStudentFromClub);
router.post("/club/:clubId/restore-student", restoreStudentToClub);
router.get("/club/:clubId/removed-students", getRemovedStudents);

export default router;
