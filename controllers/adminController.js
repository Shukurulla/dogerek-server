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

// Dashboard statistics - CORRECT calculation
export const getDashboardStats = async (req, res) => {
  try {
    // Get all necessary data
    const [
      totalStudents,
      totalClubs,
      totalFacultyAdmins,
      totalTutors,
      activeClubs,
      todayAttendance,
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
      getFacultiesFromStudents(),
    ]);

    // Get students with approved clubs
    const studentsInClubs = await Student.aggregate([
      {
        $match: {
          isActive: true,
          enrolledClubs: {
            $elemMatch: {
              status: "approved",
            },
          },
        },
      },
      {
        $count: "total",
      },
    ]);

    // Get students with external courses
    const studentsInExternal = await Student.aggregate([
      {
        $match: {
          isActive: true,
          externalCourses: { $exists: true, $not: { $size: 0 } },
        },
      },
      {
        $count: "total",
      },
    ]);

    // Get students who have BOTH clubs AND external courses (to avoid double counting)
    const studentsInBoth = await Student.aggregate([
      {
        $match: {
          isActive: true,
          $and: [
            {
              enrolledClubs: {
                $elemMatch: {
                  status: "approved",
                },
              },
            },
            {
              externalCourses: { $exists: true, $not: { $size: 0 } },
            },
          ],
        },
      },
      {
        $count: "total",
      },
    ]);

    const enrolledStudents = studentsInClubs[0]?.total || 0;
    const externalCourseStudents = studentsInExternal[0]?.total || 0;
    const studentsInBothCount = studentsInBoth[0]?.total || 0;

    // Calculate busy students correctly (avoid double counting)
    const busyStudents =
      enrolledStudents + externalCourseStudents - studentsInBothCount;
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
      busyStudents,
      notBusyStudents,
      busyPercentage:
        totalStudents > 0
          ? ((busyStudents / totalStudents) * 100).toFixed(1)
          : "0",
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
        isAnother: true,
        createdBy: req.user.id,
      });

      await newAdmin.save();

      // Remove password from response
      const adminData = newAdmin.toObject();
      delete adminData.password;

      return res
        .status(201)
        .json(
          formatResponse(
            true,
            adminData,
            "Fakultet admin muvaffaqiyatli yaratildi"
          )
        );
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
      admin.password = password;
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

    await User.findByIdAndDelete(id);

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

// Get all attendance - FIXED WITH PROPER POPULATION
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
        .populate({
          path: "students.student",
          select: "full_name student_id_number department group image email",
        })
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-date"),
      Attendance.countDocuments(filter),
    ]);

    // Debug log
    console.log(
      "Attendance data sample:",
      attendance[0]?.students?.slice(0, 2)
    );

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

// Get all students - WORKING VERSION
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

    console.log("Query params:", req.query);

    // Base filter
    let filter = { isActive: true };

    // Apply filters
    if (facultyId) filter["department.id"] = parseInt(facultyId);
    if (groupId) filter["group.id"] = parseInt(groupId);
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { student_id_number: { $regex: search, $options: "i" } },
      ];
    }

    // First get total count without busy filter for statistics
    const totalCount = await Student.countDocuments(filter);

    // Now apply busy filter if needed
    let studentsQuery;
    let actualTotal = totalCount;

    if (busy === "true") {
      // Get only busy students
      studentsQuery = Student.find({
        ...filter,
        $or: [
          { enrolledClubs: { $elemMatch: { status: "approved" } } },
          { "externalCourses.0": { $exists: true } },
        ],
      });

      // Get actual count for busy students
      actualTotal = await Student.countDocuments({
        ...filter,
        $or: [
          { enrolledClubs: { $elemMatch: { status: "approved" } } },
          { "externalCourses.0": { $exists: true } },
        ],
      });
    } else if (busy === "false") {
      // Get only not busy students
      studentsQuery = Student.find({
        ...filter,
        $and: [
          {
            $or: [
              { enrolledClubs: { $exists: false } },
              { enrolledClubs: { $size: 0 } },
              {
                enrolledClubs: { $not: { $elemMatch: { status: "approved" } } },
              },
            ],
          },
          {
            $or: [
              { externalCourses: { $exists: false } },
              { externalCourses: { $size: 0 } },
            ],
          },
        ],
      });

      // Get actual count for not busy students
      actualTotal = await Student.countDocuments({
        ...filter,
        $and: [
          {
            $or: [
              { enrolledClubs: { $exists: false } },
              { enrolledClubs: { $size: 0 } },
              {
                enrolledClubs: { $not: { $elemMatch: { status: "approved" } } },
              },
            ],
          },
          {
            $or: [
              { externalCourses: { $exists: false } },
              { externalCourses: { $size: 0 } },
            ],
          },
        ],
      });
    } else {
      // Get all students
      studentsQuery = Student.find(filter);
    }

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const students = await studentsQuery
      .populate("enrolledClubs.club", "name faculty")
      .populate("externalCourses", "courseName institutionName")
      .skip(skip)
      .limit(parseInt(limit))
      .sort("full_name");

    console.log(`Found ${students.length} students with busy=${busy}`);

    res.json(
      formatResponse(
        true,
        {
          students,
          pagination: {
            total: actualTotal,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(actualTotal / parseInt(limit)),
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

// Get all clubs - with real student counts and category
export const getAllClubs = async (req, res) => {
  try {
    const {
      facultyId,
      categoryId,
      tutorId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true };
    if (facultyId) filter["faculty.id"] = parseInt(facultyId);
    if (categoryId) filter.category = categoryId;
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
        .populate("category", "name color")
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
            ? Math.max(0, club.capacity - approvedStudents)
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
