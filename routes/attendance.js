import express from "express";
import {
  getAttendanceReport,
  getStudentAttendance,
  getClubAttendanceReport,
} from "../controllers/attendanceController.js";
import { authenticate } from "../middleware/auth.js";
import { isAdminOrFaculty, isTutor } from "../middleware/roleCheck.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin and faculty admin routes
router.get("/report", isAdminOrFaculty, getAttendanceReport);
router.get("/club/:clubId/report", isAdminOrFaculty, getClubAttendanceReport);

// Student attendance (student can view their own)
router.get("/student/:studentId", getStudentAttendance);

// Get attendance by date (for tutors)
router.get("/by-date", isTutor, async (req, res) => {
  try {
    const { date, clubId } = req.query;

    if (!date || !clubId) {
      return res.status(400).json({
        success: false,
        message: "Sana va to'garak ID kerak",
      });
    }

    const Club = (await import("../models/Club.js")).default;
    const Attendance = (await import("../models/Attendance.js")).default;

    // Check if club belongs to tutor
    const club = await Club.findOne({
      _id: clubId,
      tutor: req.user.id,
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: "To'garak topilmadi",
      });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      club: clubId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).populate("students.student", "full_name student_id_number image");

    res.json({
      success: true,
      data: attendance,
      message: attendance
        ? "Davomat topildi"
        : "Bu sana uchun davomat mavjud emas",
    });
  } catch (error) {
    console.error("Get attendance by date error:", error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: error.message,
    });
  }
});

// Get attendance statistics
router.get("/statistics", isTutor, async (req, res) => {
  try {
    const { clubId, startDate, endDate, groupBy = "day" } = req.query;

    const Club = (await import("../models/Club.js")).default;
    const Attendance = (await import("../models/Attendance.js")).default;

    let clubFilter = {};

    if (clubId) {
      // Check if club belongs to tutor
      const club = await Club.findOne({
        _id: clubId,
        tutor: req.user.id,
      });

      if (!club) {
        return res.status(404).json({
          success: false,
          message: "To'garak topilmadi",
        });
      }

      clubFilter = { club: clubId };
    } else {
      // Get all tutor's clubs
      const myClubs = await Club.find({
        tutor: req.user.id,
        isActive: true,
      }).distinct("_id");

      clubFilter = { club: { $in: myClubs } };
    }

    const filter = { ...clubFilter };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Generate weekly data for chart
    const weeklyData = [];
    const dayNames = ["Yak", "Du", "Se", "Ch", "Pa", "Ju", "Sha"];

    for (let i = 0; i < 7; i++) {
      const dayAttendance = await Attendance.aggregate([
        {
          $match: {
            ...filter,
            $expr: { $eq: [{ $dayOfWeek: "$date" }, i + 1] },
          },
        },
        { $unwind: "$students" },
        {
          $group: {
            _id: null,
            totalPresent: { $sum: { $cond: ["$students.present", 1, 0] } },
            totalPossible: { $sum: 1 },
          },
        },
      ]);

      const percentage =
        dayAttendance.length > 0 && dayAttendance[0].totalPossible > 0
          ? (dayAttendance[0].totalPresent / dayAttendance[0].totalPossible) *
            100
          : 0;

      weeklyData.push({
        day: dayNames[i],
        attendance: percentage.toFixed(1),
      });
    }

    // Generate monthly data if needed
    const monthlyData = [];

    // If month view is requested
    if (groupBy === "month") {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(year, month, day, 0, 0, 0);
        const dayEnd = new Date(year, month, day, 23, 59, 59);

        const dayData = await Attendance.aggregate([
          {
            $match: {
              ...filter,
              date: { $gte: dayStart, $lte: dayEnd },
            },
          },
          { $unwind: "$students" },
          {
            $group: {
              _id: null,
              totalPresent: { $sum: { $cond: ["$students.present", 1, 0] } },
              totalPossible: { $sum: 1 },
            },
          },
        ]);

        if (dayData.length > 0) {
          const percentage =
            dayData[0].totalPossible > 0
              ? (dayData[0].totalPresent / dayData[0].totalPossible) * 100
              : 0;

          monthlyData.push({
            date: day,
            attendance: percentage.toFixed(1),
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        weeklyData,
        monthlyData,
      },
      message: "Statistika ma'lumotlari",
    });
  } catch (error) {
    console.error("Get attendance statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
      error: error.message,
    });
  }
});

export default router;
