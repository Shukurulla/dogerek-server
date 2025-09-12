import express from "express";
import {
  getAllClubs,
  getClubById,
  getClubStudents,
  getClubAttendance,
} from "../controllers/clubController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public routes (authenticated users)
router.use(authenticate);

router.get("/", getAllClubs);
router.get("/:id", getClubById);
router.get("/:id/students", getClubStudents);
router.get("/:id/attendance", getClubAttendance);

export default router;
