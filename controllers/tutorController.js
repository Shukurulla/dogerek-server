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

      // Check if student is already in the club
      const existingStudent = club.enrolledStudents.find(
        (e) => e.student.toString() === enrollment.student._id.toString()
      );

      if (!existingStudent) {
        club.enrolledStudents.push({
          student: enrollment.student._id,
          enrolledAt: new Date(),
          status: "active",
        });
        await club.save();
      }

      // Update student's enrolled clubs
      const student = await Student.findById(enrollment.student._id);
      const existingClub = student.enrolledClubs.find(
        (c) => c.club.toString() === enrollment.club._id.toString()
      );

      if (existingClub) {
        existingClub.status = "approved";
        existingClub.approvedAt = new Date();
        existingClub.approvedBy = req.user.id;
      } else {
        student.enrolledClubs.push({
          club: enrollment.club._id,
          status: "approved",
          enrolledAt: new Date(),
          approvedAt: new Date(),
          approvedBy: req.user.id,
        });
      }
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

    // Parse and validate date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Don't allow future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (attendanceDate > today) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Kelajakdagi sanalar uchun davomat kiritib bo'lmaydi"
          )
        );
    }

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      club: clubId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.students = students;
      existingAttendance.notes = notes;
      existingAttendance.telegramPostLink = telegramPostLink;
      existingAttendance.updatedAt = new Date();

      await existingAttendance.save();

      return res.json(
        formatResponse(true, existingAttendance, "Davomat yangilandi")
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
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate("students.student", "full_name student_id_number image")
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
    const { students, notes, telegramPostLink } = req.body;

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
    if (telegramPostLink !== undefined)
      attendance.telegramPostLink = telegramPostLink;

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

// Get attendance by date
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date, clubId } = req.query;

    if (!date || !clubId) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Sana va to'garak ID kerak"));
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

    res.json(
      formatResponse(
        true,
        attendance,
        attendance ? "Davomat topildi" : "Bu sana uchun davomat mavjud emas"
      )
    );
  } catch (error) {
    console.error("Get attendance by date error:", error);
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
      approvedApplications,
      totalSessions,
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

      // Today's attendance sessions
      Attendance.countDocuments({
        club: { $in: clubIds },
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),

      // This month's attendance sessions
      Attendance.countDocuments({
        club: { $in: clubIds },
        date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      }),

      // Approved applications this month
      Enrollment.countDocuments({
        club: { $in: clubIds },
        status: "approved",
        processedDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      }),

      // Total sessions
      Attendance.countDocuments({
        club: { $in: clubIds },
      }),
    ]);

    // Calculate average attendance
    const attendanceStats = await Attendance.aggregate([
      { $match: { club: { $in: clubIds } } },
      { $unwind: "$students" },
      {
        $group: {
          _id: null,
          totalPresent: { $sum: { $cond: ["$students.present", 1, 0] } },
          totalPossible: { $sum: 1 },
        },
      },
    ]);

    const averageAttendance =
      attendanceStats.length > 0 && attendanceStats[0].totalPossible > 0
        ? (
            (attendanceStats[0].totalPresent /
              attendanceStats[0].totalPossible) *
            100
          ).toFixed(1)
        : 0;

    // Get top students by attendance
    const topStudents = await Attendance.aggregate([
      { $match: { club: { $in: clubIds } } },
      { $unwind: "$students" },
      {
        $group: {
          _id: "$students.student",
          totalClasses: { $sum: 1 },
          presentClasses: { $sum: { $cond: ["$students.present", 1, 0] } },
        },
      },
      {
        $match: { totalClasses: { $gte: 3 } }, // At least 3 classes
      },
      {
        $addFields: {
          attendancePercentage: {
            $multiply: [{ $divide: ["$presentClasses", "$totalClasses"] }, 100],
          },
        },
      },
      { $sort: { attendancePercentage: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "clubs",
          localField: "club",
          foreignField: "_id",
          as: "club",
        },
      },
      {
        $project: {
          student: {
            _id: "$student._id",
            full_name: "$student.full_name",
            image: "$student.image",
          },
          attendancePercentage: { $round: ["$attendancePercentage", 1] },
        },
      },
    ]);

    const stats = {
      userName: req.user.user?.profile?.fullName || "Tutor",
      totalClubs: myClubs.length,
      totalStudents,
      pendingApplications,
      todayAttendance,
      thisMonthAttendance,
      approvedApplications,
      totalSessions,
      averageAttendance,
      topStudents,
      clubs: myClubs.map((club) => ({
        id: club._id,
        name: club.name,
        studentCount: club.enrolledStudents.filter((e) => e.status === "active")
          .length,
      })),
    };

    res.json(formatResponse(true, stats, "Tutor dashboard"));
  } catch (error) {
    console.error("Tutor dashboard error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
