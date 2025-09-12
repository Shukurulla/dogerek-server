import Club from "../models/Club.js";
import Student from "../models/Student.js";
import Enrollment from "../models/Enrollment.js";
import Attendance from "../models/Attendance.js";
import { formatResponse, formatDate } from "../utils/formatters.js";

// Get my assigned clubs
export const getMyClubs = async (req, res) => {
  try {
    const clubs = await Club.find({
      tutor: req.user.id,
      isActive: true,
    })
      .populate("enrolledStudents.student", "full_name student_id_number")
      .sort("-createdAt");

    const clubsWithStats = clubs.map((club) => ({
      ...club.toObject(),
      totalStudents: club.enrolledStudents.filter((e) => e.status === "active")
        .length,
    }));

    res.json(formatResponse(true, clubsWithStats, "Mening to'garaklarim"));
  } catch (error) {
    console.error("Get my clubs error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club applications
export const getClubApplications = async (req, res) => {
  try {
    const { status = "pending" } = req.query;

    // Get tutor's clubs
    const myClubs = await Club.find({ tutor: req.user.id }).distinct("_id");

    const applications = await Enrollment.find({
      club: { $in: myClubs },
      status: status,
    })
      .populate("student", "full_name student_id_number department group image")
      .populate("club", "name")
      .sort("-applicationDate");

    res.json(formatResponse(true, applications, "Arizalar ro'yxati"));
  } catch (error) {
    console.error("Get applications error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Process application (approve/reject)
export const processApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Noto'g'ri amal"));
    }

    const enrollment = await Enrollment.findById(id)
      .populate("club")
      .populate("student");

    if (!enrollment) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Ariza topilmadi"));
    }

    // Check if tutor owns the club
    if (enrollment.club.tutor.toString() !== req.user.id) {
      return res
        .status(403)
        .json(formatResponse(false, null, "Ruxsat berilmagan"));
    }

    if (enrollment.status !== "pending") {
      return res
        .status(400)
        .json(formatResponse(false, null, "Ariza allaqachon ko'rib chiqilgan"));
    }

    enrollment.status = action === "approve" ? "approved" : "rejected";
    enrollment.processedDate = new Date();
    enrollment.processedBy = req.user.id;

    if (action === "reject" && rejectionReason) {
      enrollment.rejectionReason = rejectionReason;
    }

    await enrollment.save();

    // If approved, add student to club
    if (action === "approve") {
      const club = await Club.findById(enrollment.club._id);
      club.enrolledStudents.push({
        student: enrollment.student._id,
        enrolledAt: new Date(),
      });
      await club.save();

      // Update student's enrolled clubs
      const student = await Student.findById(enrollment.student._id);
      student.enrolledClubs.push({
        club: enrollment.club._id,
        status: "approved",
        enrolledAt: new Date(),
        approvedAt: new Date(),
        approvedBy: req.user.id,
      });
      await student.save();
    }

    res.json(
      formatResponse(
        true,
        enrollment,
        action === "approve" ? "Ariza qabul qilindi" : "Ariza rad etildi"
      )
    );
  } catch (error) {
    console.error("Process application error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Mark attendance
export const markAttendance = async (req, res) => {
  try {
    const { clubId, date, students, notes, telegramPostLink } = req.body;

    if (!clubId || !date || !students) {
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

    // Check if club belongs to tutor
    const club = await Club.findOne({
      _id: clubId,
      tutor: req.user.id,
    });

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // Check if attendance already exists for this date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      club: clubId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (existingAttendance) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Bu sana uchun davomat allaqachon kiritilgan"
          )
        );
    }

    // Create new attendance
    const attendance = new Attendance({
      club: clubId,
      date: attendanceDate,
      students: students,
      markedBy: req.user.id,
      notes,
      telegramPostLink,
    });

    await attendance.save();

    res
      .status(201)
      .json(
        formatResponse(true, attendance, "Davomat muvaffaqiyatli kiritildi")
      );
  } catch (error) {
    console.error("Mark attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get attendance history
export const getAttendanceHistory = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    // Check if club belongs to tutor
    const club = await Club.findOne({
      _id: clubId,
      tutor: req.user.id,
    });

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    const filter = { club: clubId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("students.student", "full_name student_id_number")
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
        "Davomat tarixi"
      )
    );
  } catch (error) {
    console.error("Get attendance history error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update attendance
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { students, notes } = req.body;

    const attendance = await Attendance.findById(id).populate("club");

    if (!attendance) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Davomat topilmadi"));
    }

    // Check if tutor owns the club
    if (attendance.club.tutor.toString() !== req.user.id) {
      return res
        .status(403)
        .json(formatResponse(false, null, "Ruxsat berilmagan"));
    }

    // Update fields
    if (students) attendance.students = students;
    if (notes !== undefined) attendance.notes = notes;

    attendance.updatedAt = new Date();
    await attendance.save();

    res.json(formatResponse(true, attendance, "Davomat yangilandi"));
  } catch (error) {
    console.error("Update attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Add telegram post link
export const addTelegramPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { telegramPostLink } = req.body;

    if (!telegramPostLink) {
      return res
        .status(400)
        .json(
          formatResponse(false, null, "Telegram post linki kiritilishi kerak")
        );
    }

    const attendance = await Attendance.findById(id).populate("club");

    if (!attendance) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Davomat topilmadi"));
    }

    // Check if tutor owns the club
    if (attendance.club.tutor.toString() !== req.user.id) {
      return res
        .status(403)
        .json(formatResponse(false, null, "Ruxsat berilmagan"));
    }

    attendance.telegramPostLink = telegramPostLink;
    attendance.updatedAt = new Date();
    await attendance.save();

    res.json(formatResponse(true, attendance, "Telegram post linki qo'shildi"));
  } catch (error) {
    console.error("Add telegram post error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Tutor dashboard
export const getTutorDashboard = async (req, res) => {
  try {
    // Get tutor's clubs
    const myClubs = await Club.find({
      tutor: req.user.id,
      isActive: true,
    });

    const clubIds = myClubs.map((c) => c._id);

    const [
      totalStudents,
      pendingApplications,
      todayAttendance,
      thisMonthAttendance,
    ] = await Promise.all([
      // Total enrolled students across all clubs
      Club.aggregate([
        { $match: { _id: { $in: clubIds } } },
        { $unwind: "$enrolledStudents" },
        { $match: { "enrolledStudents.status": "active" } },
        { $count: "total" },
      ]).then((result) => result[0]?.total || 0),

      // Pending applications
      Enrollment.countDocuments({
        club: { $in: clubIds },
        status: "pending",
      }),

      // Today's attendance
      Attendance.countDocuments({
        club: { $in: clubIds },
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),

      // This month's attendance
      Attendance.countDocuments({
        club: { $in: clubIds },
        date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      }),
    ]);

    const stats = {
      totalClubs: myClubs.length,
      totalStudents,
      pendingApplications,
      todayAttendance,
      thisMonthAttendance,
      clubs: myClubs.map((club) => ({
        id: club._id,
        name: club.name,
        studentCount: club.enrolledStudents.filter((e) => e.status === "active")
          .length,
      })),
    };

    res.json(formatResponse(true, stats, "Tutor statistikasi"));
  } catch (error) {
    console.error("Tutor dashboard error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
