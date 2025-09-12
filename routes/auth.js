import express from "express";
import {
  createUniversityAdmin,
  loginAdmin,
  loginStudent,
  getProfile,
  changePassword,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Create university admin (birinchi admin yoki mavjud admin tomonidan)
router.post(
  "/admin/create",
  async (req, res, next) => {
    // Check if any admin exists
    const User = (await import("../models/User.js")).default;
    const adminCount = await User.countDocuments({ role: "university_admin" });

    // Agar admin mavjud bo'lsa, authenticate qilish kerak
    if (adminCount > 0) {
      return authenticate(req, res, () => {
        if (req.user.role !== "university_admin") {
          return res.status(403).json({
            success: false,
            error: "Faqat university admin yangi admin yarata oladi",
          });
        }
        next();
      });
    }

    // Agar admin yo'q bo'lsa, birinchi admin yaratiladi
    next();
  },
  createUniversityAdmin
);

// Login routes
router.post("/admin/login", loginAdmin);
router.post("/student/login", loginStudent);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.post("/change-password", authenticate, changePassword);

export default router;
