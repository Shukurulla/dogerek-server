import User from "../models/User.js";
import Student from "../models/Student.js";
import Club from "../models/Club.js";
import Attendance from "../models/Attendance.js";
import { formatResponse, formatPhoneNumber } from "../utils/formatters.js";
import {
  syncHemisData,
  getFacultiesFromStudents,
} from "../utils/syncHemisData.js";

// Create faculty admin
export const createFacultyAdmin = async (req, res) => {
  try {
    const { username, password, fullName, phone, email, facultyId } = req.body;

    // Validation
    if (!username || !password || !fullName || !facultyId) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Barcha majburiy maydonlar to'ldirilishi kerak"
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

    // Get faculty info from students
    const faculties = await getFacultiesFromStudents();
    const faculty = faculties.find((f) => f.id === parseInt(facultyId));

    if (!faculty) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Fakultet topilmadi"));
    }

    // Format phone number
    const formattedPhone = phone ? formatPhoneNumber(phone).db : null;

    // Create new faculty admin
    const newAdmin = new User({
      username,
      password,
      role: "faculty_admin",
      profile: {
        fullName,
        phone: formattedPhone,
        email,
      },
      faculty: {
        id: faculty.id,
        name: faculty.name,
        code: faculty.code,
      },
      createdBy: req.user.id,
    });

    await newAdmin.save();

    res
      .status(201)
      .json(
        formatResponse(
          true,
          newAdmin,
          "Fakultet admin muvaffaqiyatli yaratildi"
        )
      );
  } catch (error) {
    console.error("Create faculty admin error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get all faculty admins
export const getAllFacultyAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "faculty_admin", isActive: true })
      .select("-password")
      .sort("-createdAt");

    res.json(formatResponse(true, admins, "Fakultet adminlar ro'yxati"));
  } catch (error) {
    console.error("Get faculty admins error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update faculty admin
export const updateFacultyAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, isActive } = req.body;

    const admin = await User.findById(id);

    if (!admin || admin.role !== "faculty_admin") {
      return res
        .status(404)
        .json(formatResponse(false, null, "Fakultet admin topilmadi"));
    }

    // Update fields
    if (fullName) admin.profile.fullName = fullName;
    if (email) admin.profile.email = email;
    if (phone) admin.profile.phone = formatPhoneNumber(phone).db;
    if (typeof isActive === "boolean") admin.isActive = isActive;

    admin.updatedAt = new Date();
    await admin.save();

    res.json(
      formatResponse(true, admin, "Fakultet admin ma'lumotlari yangilandi")
    );
  } catch (error) {
    console.error("Update faculty admin error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete faculty admin
export const deleteFacultyAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await User.findById(id);

    if (!admin || admin.role !== "faculty_admin") {
      return res
        .status(404)
        .json(formatResponse(false, null, "Fakultet admin topilmadi"));
    }

    // Soft delete
    admin.isActive = false;
    admin.updatedAt = new Date();
    await admin.save();

    res.json(formatResponse(true, null, "Fakultet admin o'chirildi"));
  } catch (error) {
    console.error("Delete faculty admin error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalStudents,
      totalClubs,
      totalFacultyAdmins,
      totalTutors,
      activeClubs,
      todayAttendance,
      enrolledStudents,
      externalCourseStudents,
    ] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Club.countDocuments({ isActive: true }),
      User.countDocuments({ role: "faculty_admin", isActive: true }),
      User.countDocuments({ role: "tutor", isActive: true }),
      Club.countDocuments({ isActive: true }),
      Attendance.countDocuments({
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
      Student.countDocuments({ "enrolledClubs.0": { $exists: true } }),
      Student.countDocuments({ "externalCourses.0": { $exists: true } }),
    ]);

    // Band bo'lmagan studentlar
    const notBusyStudents =
      totalStudents - enrolledStudents - externalCourseStudents;

    const stats = {
      totalStudents,
      totalClubs,
      totalFacultyAdmins,
      totalTutors,
      activeClubs,
      todayAttendance,
      enrolledStudents,
      externalCourseStudents,
      notBusyStudents,
      busyPercentage:
        totalStudents > 0
          ? (
              ((enrolledStudents + externalCourseStudents) / totalStudents) *
              100
            ).toFixed(1)
          : 0,
    };

    res.json(formatResponse(true, stats, "Dashboard statistikasi"));
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get all clubs
export const getAllClubs = async (req, res) => {
  try {
    const { facultyId, tutorId, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (facultyId) filter["faculty.id"] = parseInt(facultyId);
    if (tutorId) filter.tutor = tutorId;

    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      Club.find(filter)
        .populate("tutor", "profile.fullName profile.phone")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-createdAt"),
      Club.countDocuments(filter),
    ]);

    res.json(
      formatResponse(
        true,
        {
          clubs,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
        "To'garaklar ro'yxati"
      )
    );
  } catch (error) {
    console.error("Get clubs error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get all students
export const getAllStudents = async (req, res) => {
  try {
    const { facultyId, groupId, busy, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (facultyId) filter["department.id"] = parseInt(facultyId);
    if (groupId) filter["group.id"] = parseInt(groupId);

    if (busy === "true") {
      filter.$or = [
        { "enrolledClubs.0": { $exists: true } },
        { "externalCourses.0": { $exists: true } },
      ];
    } else if (busy === "false") {
      filter.$and = [
        { "enrolledClubs.0": { $exists: false } },
        { "externalCourses.0": { $exists: false } },
      ];
    }

    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate("enrolledClubs.club", "name")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("full_name"),
      Student.countDocuments(filter),
    ]);

    res.json(
      formatResponse(
        true,
        {
          students,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
        "Studentlar ro'yxati"
      )
    );
  } catch (error) {
    console.error("Get students error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get all attendance
export const getAllAttendance = async (req, res) => {
  try {
    const { clubId, date, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (clubId) filter.club = clubId;
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("club", "name")
        .populate("markedBy", "profile.fullName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-date"),
      Attendance.countDocuments(filter),
    ]);

    res.json(
      formatResponse(
        true,
        {
          attendance,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
        "Davomatlar ro'yxati"
      )
    );
  } catch (error) {
    console.error("Get attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Sync Hemis data
export const syncHemisDataController = async (req, res) => {
  try {
    const result = await syncHemisData();
    res.json(
      formatResponse(
        true,
        { message: result },
        "Hemis ma'lumotlari sinxronlandi"
      )
    );
  } catch (error) {
    console.error("Sync Hemis data error:", error);
    res
      .status(500)
      .json(
        formatResponse(false, null, "Sinxronlashda xatolik", error.message)
      );
  }
};
