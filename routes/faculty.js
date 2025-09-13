import express from "express";
import {
  createClub,
  getMyClubs,
  updateClub,
  deleteClub,
  createTutor,
  getMyTutors,
  updateTutor,
  deleteTutor,
  getFacultyDashboard,
  getFacultyStudents,
  getFacultyAttendance,
  getClubEnrollments,
  processEnrollment,
} from "../controllers/facultyController.js";
import { authenticate } from "../middleware/auth.js";
import { isFacultyAdmin } from "../middleware/roleCheck.js";

const router = express.Router();

// Barcha routelar authentication va faculty_admin role tekshiruvidan o'tadi
router.use(authenticate, isFacultyAdmin);

// Dashboard
router.get("/dashboard", getFacultyDashboard);

// Club management
router.post("/club", createClub);
router.get("/clubs", getMyClubs);
router.put("/club/:id", updateClub);
router.delete("/club/:id", deleteClub);

// Tutor management
router.post("/tutor", createTutor);
router.get("/tutors", getMyTutors);
router.put("/tutor/:id", updateTutor);
router.delete("/tutor/:id", deleteTutor);

// Enrollment management
router.get("/enrollments", getClubEnrollments);
router.post("/enrollment/:id/process", processEnrollment);

// Reports
router.get("/students", getFacultyStudents);
router.get("/attendance", getFacultyAttendance);

export default router;
