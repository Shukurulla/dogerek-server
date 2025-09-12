import Attendance from "../models/Attendance.js";
import Club from "../models/Club.js";
import Student from "../models/Student.js";
import { formatResponse, formatDate } from "../utils/formatters.js";

// Get general attendance report
export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, facultyId } = req.query;

    let clubFilter = {};

    // If faculty admin, filter by their faculty
    if (req.user.role === "faculty_admin") {
      clubFilter["faculty.id"] = req.user.user.faculty.id;
    } else if (facultyId) {
      clubFilter["faculty.id"] = parseInt(facultyId);
    }

    // Get relevant clubs
    const clubs = await Club.find(clubFilter).distinct("_id");

    const filter = {
      club: { $in: clubs },
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Aggregate attendance data
    const report = await Attendance.aggregate([
      { $match: filter },
      { $unwind: "$students" },
      {
        $group: {
          _id: "$club",
          totalSessions: { $addToSet: "$_id" },
          totalAttendances: { $sum: 1 },
          presentCount: {
            $sum: { $cond: ["$students.present", 1, 0] },
          },
          absentCount: {
            $sum: { $cond: ["$students.present", 0, 1] },
          },
        },
      },
      {
        $lookup: {
          from: "clubs",
          localField: "_id",
          foreignField: "_id",
          as: "clubInfo",
        },
      },
      { $unwind: "$clubInfo" },
      {
        $project: {
          club: {
            id: "$clubInfo._id",
            name: "$clubInfo.name",
            faculty: "$clubInfo.faculty",
          },
          totalSessions: { $size: "$totalSessions" },
          totalAttendances: 1,
          presentCount: 1,
          absentCount: 1,
          attendanceRate: {
            $multiply: [
              { $divide: ["$presentCount", "$totalAttendances"] },
              100,
            ],
          },
        },
      },
      { $sort: { "club.name": 1 } },
    ]);

    // Calculate overall statistics
    const overallStats = report.reduce(
      (acc, club) => {
        acc.totalSessions += club.totalSessions;
        acc.totalPresent += club.presentCount;
        acc.totalAbsent += club.absentCount;
        acc.totalAttendances += club.totalAttendances;
        return acc;
      },
      { totalSessions: 0, totalPresent: 0, totalAbsent: 0, totalAttendances: 0 }
    );

    overallStats.averageAttendanceRate =
      overallStats.totalAttendances > 0
        ? (
            (overallStats.totalPresent / overallStats.totalAttendances) *
            100
          ).toFixed(1)
        : 0;

    res.json(
      formatResponse(
        true,
        {
          report,
          overallStatistics: overallStats,
          period: {
            startDate: startDate || "Belgilanmagan",
            endDate: endDate || "Belgilanmagan",
          },
        },
        "Davomat hisoboti"
      )
    );
  } catch (error) {
    console.error("Get attendance report error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get student attendance
export const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { clubId, startDate, endDate } = req.query;

    // Check if student can view this data
    if (req.user.role === "student" && req.user.id !== studentId) {
      return res
        .status(403)
        .json(formatResponse(false, null, "Ruxsat berilmagan"));
    }

    // Get student info
    const student = await Student.findById(studentId);

    if (!student) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Student topilmadi"));
    }

    // Get student's enrolled clubs
    const enrolledClubIds = student.enrolledClubs
      .filter((e) => e.status === "approved")
      .map((e) => e.club);

    const filter = {
      club: clubId ? clubId : { $in: enrolledClubIds },
      "students.student": studentId,
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter)
      .populate("club", "name")
      .sort("-date");

    // Format and calculate statistics
    const formattedAttendance = attendance.map((a) => {
      const studentAttendance = a.students.find(
        (s) => s.student.toString() === studentId
      );

      return {
        id: a._id,
        club: a.club,
        date: formatDate(a.date),
        present: studentAttendance?.present || false,
        reason: studentAttendance?.reason || null,
      };
    });

    const stats = {
      totalClasses: formattedAttendance.length,
      presentCount: formattedAttendance.filter((a) => a.present).length,
      absentCount: formattedAttendance.filter((a) => !a.present).length,
      attendancePercentage:
        formattedAttendance.length > 0
          ? (
              (formattedAttendance.filter((a) => a.present).length /
                formattedAttendance.length) *
              100
            ).toFixed(1)
          : 0,
    };

    res.json(
      formatResponse(
        true,
        {
          student: {
            id: student._id,
            full_name: student.full_name,
            student_id_number: student.student_id_number,
            department: student.department,
            group: student.group,
          },
          attendance: formattedAttendance,
          statistics: stats,
        },
        "Student davomati"
      )
    );
  } catch (error) {
    console.error("Get student attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club attendance report
export const getClubAttendanceReport = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { startDate, endDate } = req.query;

    const club = await Club.findById(clubId);

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // Check permissions
    if (
      req.user.role === "faculty_admin" &&
      club.faculty.id !== req.user.user.faculty.id
    ) {
      return res
        .status(403)
        .json(formatResponse(false, null, "Ruxsat berilmagan"));
    }

    const filter = { club: clubId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter)
      .populate("students.student", "full_name student_id_number")
      .sort("-date");

    // Calculate per-student statistics
    const studentStats = {};

    attendance.forEach((session) => {
      session.students.forEach((record) => {
        const studentId = record.student._id.toString();

        if (!studentStats[studentId]) {
          studentStats[studentId] = {
            student: record.student,
            totalClasses: 0,
            presentCount: 0,
            absentCount: 0,
          };
        }

        studentStats[studentId].totalClasses++;
        if (record.present) {
          studentStats[studentId].presentCount++;
        } else {
          studentStats[studentId].absentCount++;
        }
      });
    });

    // Convert to array and calculate percentages
    const studentReport = Object.values(studentStats).map((stat) => ({
      ...stat,
      attendancePercentage:
        stat.totalClasses > 0
          ? ((stat.presentCount / stat.totalClasses) * 100).toFixed(1)
          : 0,
    }));

    // Sort by attendance percentage
    studentReport.sort(
      (a, b) => b.attendancePercentage - a.attendancePercentage
    );

    // Overall statistics
    const overallStats = {
      totalSessions: attendance.length,
      averageAttendance: 0,
      bestAttendance: null,
      worstAttendance: null,
    };

    if (attendance.length > 0) {
      const totalPresent = attendance.reduce((sum, a) => {
        return sum + a.students.filter((s) => s.present).length;
      }, 0);
      const totalPossible = attendance.reduce((sum, a) => {
        return sum + a.students.length;
      }, 0);

      overallStats.averageAttendance =
        totalPossible > 0
          ? ((totalPresent / totalPossible) * 100).toFixed(1)
          : 0;

      // Find best and worst attendance dates
      const sessionStats = attendance.map((a) => {
        const presentCount = a.students.filter((s) => s.present).length;
        const totalCount = a.students.length;
        return {
          date: formatDate(a.date),
          percentage:
            totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0,
        };
      });

      sessionStats.sort((a, b) => b.percentage - a.percentage);
      overallStats.bestAttendance = sessionStats[0];
      overallStats.worstAttendance = sessionStats[sessionStats.length - 1];
    }

    res.json(
      formatResponse(
        true,
        {
          club: {
            id: club._id,
            name: club.name,
            faculty: club.faculty,
          },
          studentReport,
          overallStatistics: overallStats,
          period: {
            startDate: startDate || "Belgilanmagan",
            endDate: endDate || "Belgilanmagan",
          },
        },
        "To'garak davomat hisoboti"
      )
    );
  } catch (error) {
    console.error("Get club attendance report error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
