import express from "express";
import {
  loginAdmin,
  loginStudent,
  getProfile,
  changePassword,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Login routes
router.post("/admin/login", loginAdmin);
router.post("/student/login", loginStudent);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.post("/change-password", authenticate, changePassword);

export default router;
