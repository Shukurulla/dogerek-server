import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Student from "../models/Student.js";

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token topilmadi",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // User yoki Student ni topish
    if (decoded.role === "student") {
      const student = await Student.findById(decoded.id);
      if (!student) {
        return res.status(401).json({
          success: false,
          error: "Student topilmadi",
        });
      }
      req.user = {
        id: student._id,
        role: "student",
        student: student,
      };
    } else {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Foydalanuvchi topilmadi",
        });
      }
      req.user = {
        id: user._id,
        role: user.role,
        user: user,
      };
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Token yaroqsiz",
    });
  }
};

// Token yaratish
export const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};
