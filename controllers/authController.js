import bcrypt from "bcrypt";
import User from "../models/User.js";
import Student from "../models/Student.js";
import { generateToken } from "../middleware/auth.js";
import { formatResponse } from "../utils/formatters.js";

// Create initial university admin (faqat birinchi admin uchun yoki mavjud admin tomonidan)
export const createUniversityAdmin = async (req, res) => {
  try {
    const { username, password, fullName, phone, email } = req.body;

    // Validation
    if (!username || !password || !fullName) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Username, parol va F.I.O kiritilishi shart"
          )
        );
    }

    // Check if any admin exists (agar admin yo'q bo'lsa, birinchi admin yaratiladi)
    const adminCount = await User.countDocuments({ role: "university_admin" });

    // Agar admin mavjud bo'lsa, faqat university_admin yarata oladi
    if (adminCount > 0 && (!req.user || req.user.role !== "university_admin")) {
      return res
        .status(403)
        .json(
          formatResponse(
            false,
            null,
            "Faqat mavjud admin yangi admin yarata oladi"
          )
        );
    }

    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Bu username allaqachon mavjud"));
    }

    // Create new university admin
    const newAdmin = new User({
      username,
      password,
      role: "university_admin",
      profile: {
        fullName,
        phone: phone ? `+998${phone.replace(/\D/g, "")}` : null,
        email,
      },
      createdBy: req.user?.id || null,
    });

    await newAdmin.save();

    // Parolni response'dan olib tashlash
    const adminData = newAdmin.toObject();
    delete adminData.password;

    res
      .status(201)
      .json(
        formatResponse(
          true,
          adminData,
          "Universitet admin muvaffaqiyatli yaratildi"
        )
      );
  } catch (error) {
    console.error("Create university admin error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Admin login (university_admin, faculty_admin, tutor)
export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json(
          formatResponse(false, null, "Username va parol kiritilishi shart")
        );
    }

    const user = await User.findOne({ username, isActive: true });

    if (!user) {
      return res
        .status(401)
        .json(formatResponse(false, null, "Login yoki parol xato"));
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json(formatResponse(false, null, "Login yoki parol xato"));
    }

    const token = generateToken(user._id, user.role);

    // Update last login
    user.updatedAt = new Date();
    await user.save();

    const userData = {
      id: user._id,
      username: user.username,
      role: user.role,
      profile: user.profile,
      faculty: user.faculty,
      assignedClubs: user.assignedClubs,
    };

    res.json(
      formatResponse(true, { user: userData, token }, "Muvaffaqiyatli kirish")
    );
  } catch (error) {
    console.error("Admin login error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Student login (Hemis login/parol orqali)
export const loginStudent = async (req, res) => {
  try {
    const { student_id } = req.body;

    // Endi faqat student_id talab qilinadi — parol tekshirilmaydi
    if (!student_id) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Student ID kiritilishi shart"));
    }

    const student = await Student.findOne({
      student_id_number: student_id,
      isActive: true,
    });

    if (!student) {
      return res
        .status(401)
        .json(formatResponse(false, null, "Student topilmadi"));
    }

    // Parol bilan ishlash yoki hash qilish OLIB TASHLANDI

    // lastLogin yangilash (xohlasangiz olib tashlashingiz mumkin)
    student.lastLogin = new Date();
    await student.save();

    const token = generateToken(student._id, "student");

    const studentData = {
      id: student._id,
      student_id_number: student.student_id_number,
      full_name: student.full_name,
      department: student.department,
      group: student.group,
      image: student.image,
      enrolledClubs: student.enrolledClubs,
      externalCourses: student.externalCourses,
    };

    return res.json(
      formatResponse(
        true,
        { student: studentData, token },
        "Muvaffaqiyatli kirish (parol tekshirilmagan)"
      )
    );
  } catch (error) {
    console.error("Student login error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get profile
export const getProfile = async (req, res) => {
  try {
    let profileData;

    if (req.user.role === "student") {
      const student = await Student.findById(req.user.id)
        .populate("enrolledClubs.club")
        .populate("externalCourses");

      profileData = {
        role: "student",
        data: student,
      };
    } else {
      const user = await User.findById(req.user.id).populate("assignedClubs");

      profileData = {
        role: user.role,
        data: user,
      };
    }

    res.json(formatResponse(true, profileData, "Profil ma'lumotlari"));
  } catch (error) {
    console.error("Get profile error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json(
          formatResponse(false, null, "Eski va yangi parol kiritilishi shart")
        );
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak"
          )
        );
    }

    if (req.user.role === "student") {
      const student = await Student.findById(req.user.id);

      const isPasswordValid = await bcrypt.compare(
        oldPassword,
        student.password
      );
      if (!isPasswordValid) {
        return res
          .status(401)
          .json(formatResponse(false, null, "Eski parol xato"));
      }

      const salt = await bcrypt.genSalt(10);
      student.password = await bcrypt.hash(newPassword, salt);
      await student.save();
    } else {
      const user = await User.findById(req.user.id);

      const isPasswordValid = await user.comparePassword(oldPassword);
      if (!isPasswordValid) {
        return res
          .status(401)
          .json(formatResponse(false, null, "Eski parol xato"));
      }

      user.password = newPassword;
      await user.save();
    }

    res.json(formatResponse(true, null, "Parol muvaffaqiyatli o'zgartirildi"));
  } catch (error) {
    console.error("Change password error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
