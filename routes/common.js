import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getFacultiesFromStudents,
  getGroupsFromStudents,
} from "../utils/syncHemisData.js";
import { formatResponse } from "../utils/formatters.js";

const router = express.Router();

// Get all faculties (public for filters)
router.get("/faculties", authenticate, async (req, res) => {
  try {
    const faculties = await getFacultiesFromStudents();
    res.json(formatResponse(true, faculties, "Fakultetlar ro'yxati"));
  } catch (error) {
    console.error("Get faculties error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
});

// Get groups by faculty (public for filters)
router.get("/groups", authenticate, async (req, res) => {
  try {
    const { facultyId } = req.query;
    const groups = await getGroupsFromStudents(
      facultyId ? parseInt(facultyId) : null
    );
    res.json(formatResponse(true, groups, "Guruhlar ro'yxati"));
  } catch (error) {
    console.error("Get groups error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
});

export default router;
