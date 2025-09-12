import express from "express";
import {
  createFacultyAdmin,
  getAllFacultyAdmins,
  updateFacultyAdmin,
  deleteFacultyAdmin,
  getDashboardStats,
  getAllClubs,
  getAllStudents,
  getAllAttendance,
  syncHemisDataController,
} from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.js";
import { isUniversityAdmin } from "../middleware/roleCheck.js";

const router = express.Router();

// Barcha routelar authentication va university_admin role tekshiruvidan o'tadi
router.use(authenticate, isUniversityAdmin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// Faculty admin management
router.post("/faculty-admin", createFacultyAdmin);
router.get("/faculty-admins", getAllFacultyAdmins);
router.put("/faculty-admin/:id", updateFacultyAdmin);
router.delete("/faculty-admin/:id", deleteFacultyAdmin);

// Reports
router.get("/clubs", getAllClubs);
router.get("/students", getAllStudents);
router.get("/attendance", getAllAttendance);

// Hemis sync
router.post("/sync-hemis", syncHemisDataController);

export default router;
