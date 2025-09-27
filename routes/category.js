import express from "express";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  getCategoryById,
} from "../controllers/categoryController.js";
import { authenticate } from "../middleware/auth.js";
import { isUniversityAdmin } from "../middleware/roleCheck.js";

const router = express.Router();

// Public route for getting categories (for all authenticated users)
router.get("/", authenticate, getAllCategories);
router.get("/:id", authenticate, getCategoryById);

// Admin only routes
router.post("/", authenticate, isUniversityAdmin, createCategory);
router.put("/:id", authenticate, isUniversityAdmin, updateCategory);
router.delete("/:id", authenticate, isUniversityAdmin, deleteCategory);

export default router;
