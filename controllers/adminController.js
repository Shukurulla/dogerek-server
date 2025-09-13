import User from "../models/User.js";
import Student from "../models/Student.js";
import Club from "../models/Club.js";
import Attendance from "../models/Attendance.js";
import { formatResponse, formatPhoneNumber } from "../utils/formatters.js";
import {
  syncHemisData,
  getFacultiesFromStudents,
  getGroupsFromStudents,
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

    // Remove password from response
    const adminData = newAdmin.toObject();
    delete adminData.password;

    res
      .status(201)
      .json(
        formatResponse(
          true,
          adminData,
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
    const admins = await User.find({ role: "faculty_admin" })
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
    const { username, fullName, phone, email, password, facultyId, isActive } =
      req.body;

    const admin = await User.findById(id);

    if (!admin || admin.role !== "faculty_admin") {
      return res
        .status(404)
        .json(formatResponse(false, null, "Fakultet admin topilmadi"));
    }

    // Update username if provided and different
    if (username && username !== admin.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: id } });
      if (existingUser) {
        return res
          .status(400)
          .json(formatResponse(false, null, "Bu username allaqachon mavjud"));
      }
      admin.username = username;
    }

    // Update fields
    if (fullName) admin.profile.fullName = fullName;
    if (email !== undefined) admin.profile.email = email || null;
    if (phone !== undefined)
      admin.profile.phone = phone ? formatPhoneNumber(phone).db : null;
    if (typeof isActive === "boolean") admin.isActive = isActive;

    // Update password if provided
    if (password && password.length >= 6) {
      admin.password = password; // Schema pre-save hook will hash it
    } else if (password && password.length < 6) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Parol kamida 6 ta belgidan iborat bo'lishi kerak"
          )
        );
    }

    // Update faculty if provided
    if (facultyId && facultyId !== admin.faculty?.id) {
      const faculties = await getFacultiesFromStudents();
      const faculty = faculties.find((f) => f.id === parseInt(facultyId));

      if (!faculty) {
        return res
          .status(400)
          .json(formatResponse(false, null, "Fakultet topilmadi"));
      }

      admin.faculty = {
        id: faculty.id,
        name: faculty.name,
        code: faculty.code,
      };
    }

    admin.updatedAt = new Date();
    await admin.save();

    // Remove password from response
    const adminData = admin.toObject();
    delete adminData.password;

    res.json(
      formatResponse(true, adminData, "Fakultet admin ma'lumotlari yangilandi")
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

    // Check if admin has any active clubs under their faculty
    const activeClubs = await Club.countDocuments({
      "faculty.id": admin.faculty.id,
      isActive: true,
    });

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

// Get faculties list from students collection
export const getFacultiesList = async (req, res) => {
  try {
    const faculties = await getFacultiesFromStudents();
    res.json(formatResponse(true, faculties, "Fakultetlar ro'yxati"));
  } catch (error) {
    console.error("Get faculties error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get groups list
export const getGroupsList = async (req, res) => {
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
};

// Get all attendance
export const getAllAttendance = async (req, res) => {
  try {
    const { clubId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (clubId) filter.club = clubId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
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

// Get all students - barcha fakultetlardan
export const getAllStudents = async (req, res) => {
  try {
    const {
      facultyId,
      groupId,
      busy,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true };

    // Fakultet filtrini faqat tanlanganda qo'llash
    if (facultyId) filter["department.id"] = parseInt(facultyId);
    if (groupId) filter["group.id"] = parseInt(groupId);

    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { student_id_number: { $regex: search, $options: "i" } },
      ];
    }

    // Band studentlar filtri
    if (busy === "true") {
      filter.$or = [
        {
          "enrolledClubs.0": { $exists: true },
          "enrolledClubs.status": "approved",
        },
        { "externalCourses.0": { $exists: true } },
      ];
    } else if (busy === "false") {
      filter.$and = [
        {
          $or: [
            { "enrolledClubs.0": { $exists: false } },
            { "enrolledClubs.status": { $ne: "approved" } },
          ],
        },
        { "externalCourses.0": { $exists: false } },
      ];
    }

    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate("enrolledClubs.club", "name faculty")
        .populate("externalCourses", "courseName institutionName")
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

// Get all clubs - barcha fakultetlardan
export const getAllClubs = async (req, res) => {
  try {
    const { facultyId, tutorId, search, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (facultyId) filter["faculty.id"] = parseInt(facultyId);
    if (tutorId) filter.tutor = tutorId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      Club.find(filter)
        .populate("tutor", "profile.fullName profile.phone")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-createdAt"),
      Club.countDocuments(filter),
    ]);

    // Add real statistics for each club
    const clubsWithStats = await Promise.all(
      clubs.map(async (club) => {
        const approvedStudents = await Student.countDocuments({
          "enrolledClubs.club": club._id,
          "enrolledClubs.status": "approved",
          isActive: true,
        });

        return {
          ...club.toObject(),
          currentStudents: approvedStudents,
          availableSlots: club.capacity
            ? club.capacity - approvedStudents
            : null,
        };
      })
    );

    res.json(
      formatResponse(
        true,
        {
          clubs: clubsWithStats,
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

// Dashboard statistics - barcha fakultetlardan
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
      faculties,
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
      // Real enrolled students count
      Student.countDocuments({
        "enrolledClubs.status": "approved",
        isActive: true,
      }),
      Student.countDocuments({
        "externalCourses.0": { $exists: true },
        isActive: true,
      }),
      getFacultiesFromStudents(),
    ]);

    // Band bo'lmagan studentlar
    const busyStudents = enrolledStudents + externalCourseStudents;
    const notBusyStudents = totalStudents - busyStudents;

    // Cross-faculty enrollment statistics
    const crossFacultyStats = await Student.aggregate([
      {
        $match: {
          "enrolledClubs.status": "approved",
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "clubs",
          localField: "enrolledClubs.club",
          foreignField: "_id",
          as: "clubDetails",
        },
      },
      {
        $unwind: "$clubDetails",
      },
      {
        $group: {
          _id: {
            studentFaculty: "$department.id",
            clubFaculty: "$clubDetails.faculty.id",
          },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          $expr: { $ne: ["$_id.studentFaculty", "$_id.clubFaculty"] },
        },
      },
      {
        $count: "crossFacultyEnrollments",
      },
    ]);

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
      busyStudents,
      busyPercentage:
        totalStudents > 0
          ? ((busyStudents / totalStudents) * 100).toFixed(1)
          : 0,
      facultiesCount: faculties.length,
      crossFacultyEnrollments:
        crossFacultyStats[0]?.crossFacultyEnrollments || 0,
    };

    res.json(formatResponse(true, stats, "Dashboard statistikasi"));
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
