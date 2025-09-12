import express from "express";
import {
  getAllClubs,
  getClubDetails,
  applyToClub,
  getMyApplications,
  getMyClubs,
  addExternalCourse,
  getMyExternalCourses,
  updateExternalCourse,
  deleteExternalCourse,
  getMyAttendance,
  getStudentDashboard,
  updateProfile,
} from "../controllers/studentController.js";
import { authenticate } from "../middleware/auth.js";
import { isStudent } from "../middleware/roleCheck.js";

const router = express.Router();

// Barcha routelar authentication va student role tekshiruvidan o'tadi
router.use(authenticate, isStudent);

// Dashboard
router.get("/dashboard", getStudentDashboard);

// Profile
router.put("/profile", updateProfile);

// Clubs
router.get("/clubs", getAllClubs);
router.get("/club/:id", getClubDetails);
router.post("/club/:id/apply", applyToClub);

// Applications
router.get("/applications", getMyApplications);

// My clubs
router.get("/my-clubs", getMyClubs);

// External courses
router.post("/external-course", addExternalCourse);
router.get("/external-courses", getMyExternalCourses);
router.put("/external-course/:id", updateExternalCourse);
router.delete("/external-course/:id", deleteExternalCourse);

// Attendance
router.get("/attendance", getMyAttendance);

export default router;
