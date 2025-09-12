import Club from "../models/Club.js";
import Attendance from "../models/Attendance.js";
import { formatResponse } from "../utils/formatters.js";

// Get all clubs
export const getAllClubs = async (req, res) => {
  try {
    const { facultyId, search, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    if (facultyId) {
      filter["faculty.id"] = parseInt(facultyId);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      Club.find(filter)
        .populate("tutor", "profile.fullName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-createdAt"),
      Club.countDocuments(filter),
    ]);

    const clubsWithStats = clubs.map((club) => ({
      id: club._id,
      name: club.name,
      description: club.description,
      faculty: club.faculty,
      tutor: club.tutor,
      schedule: club.schedule,
      location: club.location,
      capacity: club.capacity,
      currentStudents: club.enrolledStudents.filter(
        (e) => e.status === "active"
      ).length,
      availableSlots: club.capacity
        ? club.capacity -
          club.enrolledStudents.filter((e) => e.status === "active").length
        : null,
    }));

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
    console.error("Get all clubs error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club by ID
export const getClubById = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(id)
      .populate("tutor", "profile.fullName profile.phone profile.email")
      .populate(
        "enrolledStudents.student",
        "full_name student_id_number department group"
      );

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    const clubData = {
      ...club.toObject(),
      statistics: {
        totalStudents: club.enrolledStudents.filter(
          (e) => e.status === "active"
        ).length,
        capacity: club.capacity,
        availableSlots: club.capacity
          ? club.capacity -
            club.enrolledStudents.filter((e) => e.status === "active").length
          : null,
      },
    };

    res.json(formatResponse(true, clubData, "To'garak ma'lumotlari"));
  } catch (error) {
    console.error("Get club by ID error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club students
export const getClubStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "active" } = req.query;

    const club = await Club.findById(id).populate({
      path: "enrolledStudents.student",
      select: "full_name student_id_number department group email image",
    });

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    const students = club.enrolledStudents
      .filter((e) => e.status === status)
      .map((e) => ({
        ...e.student.toObject(),
        enrolledAt: e.enrolledAt,
        status: e.status,
      }));

    res.json(formatResponse(true, students, "To'garak studentlari"));
  } catch (error) {
    console.error("Get club students error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club attendance
export const getClubAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    const club = await Club.findById(id);

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    const filter = { club: id };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("students.student", "full_name student_id_number")
        .populate("markedBy", "profile.fullName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-date"),
      Attendance.countDocuments(filter),
    ]);

    // Calculate statistics
    const stats = {
      totalSessions: total,
      averageAttendance: 0,
    };

    if (attendance.length > 0) {
      const totalPresent = attendance.reduce((sum, a) => {
        return sum + a.students.filter((s) => s.present).length;
      }, 0);
      const totalPossible = attendance.reduce((sum, a) => {
        return sum + a.students.length;
      }, 0);
      stats.averageAttendance =
        totalPossible > 0
          ? ((totalPresent / totalPossible) * 100).toFixed(1)
          : 0;
    }

    res.json(
      formatResponse(
        true,
        {
          attendance,
          statistics: stats,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
        "To'garak davomatlari"
      )
    );
  } catch (error) {
    console.error("Get club attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
