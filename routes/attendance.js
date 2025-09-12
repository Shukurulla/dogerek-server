import express from "express";
import {
  getAttendanceReport,
  getStudentAttendance,
  getClubAttendanceReport,
} from "../controllers/attendanceController.js";
import { authenticate } from "../middleware/auth.js";
import { isAdminOrFaculty } from "../middleware/roleCheck.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin and faculty admin routes
router.get("/report", isAdminOrFaculty, getAttendanceReport);
router.get("/club/:clubId/report", isAdminOrFaculty, getClubAttendanceReport);

// Student attendance (student can view their own)
router.get("/student/:studentId", getStudentAttendance);

export default router;
