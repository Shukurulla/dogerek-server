import Club from "../models/Club.js";
import Student from "../models/Student.js";
import Enrollment from "../models/Enrollment.js";
import ExternalCourse from "../models/ExternalCourse.js";
import Attendance from "../models/Attendance.js";
import { formatResponse, formatPhoneNumber } from "../utils/formatters.js";

// Get all available clubs
export const getAllClubs = async (req, res) => {
  try {
    const { facultyId, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (facultyId) filter["faculty.id"] = parseInt(facultyId);

    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      Club.find(filter)
        .populate("tutor", "profile.fullName profile.phone")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-createdAt"),
      Club.countDocuments(filter),
    ]);

    // Add enrollment status for each club
    const student = await Student.findById(req.user.id);
    const clubsWithStatus = clubs.map((club) => {
      const enrollment = student.enrolledClubs.find(
        (e) => e.club.toString() === club._id.toString()
      );

      return {
        ...club.toObject(),
        enrollmentStatus: enrollment ? enrollment.status : null,
        currentStudents: club.enrolledStudents.filter(
          (e) => e.status === "active"
        ).length,
      };
    });

    res.json(
      formatResponse(
        true,
        {
          clubs: clubsWithStatus,
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

// Get club details
export const getClubDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(id)
      .populate("tutor", "profile.fullName profile.phone profile.image")
      .populate("enrolledStudents.student", "full_name student_id_number");

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // Check if student has applied
    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      club: id,
    });

    const clubData = {
      ...club.toObject(),
      enrollmentStatus: enrollment ? enrollment.status : null,
      currentStudents: club.enrolledStudents.filter(
        (e) => e.status === "active"
      ).length,
      availableSlots: club.capacity
        ? club.capacity -
          club.enrolledStudents.filter((e) => e.status === "active").length
        : null,
    };

    res.json(formatResponse(true, clubData, "To'garak ma'lumotlari"));
  } catch (error) {
    console.error("Get club details error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Apply to club
export const applyToClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findById(id);

    if (!club || !club.isActive) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // Check if already applied
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      club: id,
    });

    if (existingEnrollment) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Siz allaqachon ushbu to'garakka ariza topshirgansiz"
          )
        );
    }

    // Check capacity
    if (club.capacity) {
      const activeStudents = club.enrolledStudents.filter(
        (e) => e.status === "active"
      ).length;
      if (activeStudents >= club.capacity) {
        return res
          .status(400)
          .json(formatResponse(false, null, "To'garak to'lgan"));
      }
    }

    // Create enrollment application
    const enrollment = new Enrollment({
      student: req.user.id,
      club: id,
      status: "pending",
    });

    await enrollment.save();

    // Update student's enrolled clubs with pending status
    const student = await Student.findById(req.user.id);
    student.enrolledClubs.push({
      club: id,
      status: "pending",
      enrolledAt: new Date(),
    });
    await student.save();

    res
      .status(201)
      .json(
        formatResponse(true, enrollment, "Ariza muvaffaqiyatli topshirildi")
      );
  } catch (error) {
    console.error("Apply to club error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my applications
export const getMyApplications = async (req, res) => {
  try {
    const applications = await Enrollment.find({
      student: req.user.id,
    })
      .populate("club", "name schedule location")
      .populate("processedBy", "profile.fullName")
      .sort("-applicationDate");

    res.json(formatResponse(true, applications, "Mening arizalarim"));
  } catch (error) {
    console.error("Get my applications error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my enrolled clubs
export const getMyClubs = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).populate({
      path: "enrolledClubs.club",
      populate: {
        path: "tutor",
        select: "profile.fullName profile.phone",
      },
    });

    const activeClubs = student.enrolledClubs
      .filter((e) => e.status === "approved")
      .map((e) => ({
        ...e.club.toObject(),
        enrolledAt: e.enrolledAt,
        approvedAt: e.approvedAt,
      }));

    res.json(formatResponse(true, activeClubs, "Mening to'garaklarim"));
  } catch (error) {
    console.error("Get my clubs error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Add external course
export const addExternalCourse = async (req, res) => {
  try {
    const {
      courseName,
      institutionName,
      address,
      schedule,
      instructorName,
      instructorPhone,
      studentPhone,
      startDate,
      endDate,
    } = req.body;

    // Validation
    if (
      !courseName ||
      !institutionName ||
      !address ||
      !schedule ||
      !studentPhone
    ) {
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

    // Format phone numbers
    const formattedInstructorPhone = instructorPhone
      ? formatPhoneNumber(instructorPhone).db
      : null;
    const formattedStudentPhone = formatPhoneNumber(studentPhone).db;

    // Create external course
    const externalCourse = new ExternalCourse({
      student: req.user.id,
      courseName,
      institutionName,
      address,
      schedule,
      instructor: {
        name: instructorName,
        phone: formattedInstructorPhone,
      },
      studentPhone: formattedStudentPhone,
      startDate,
      endDate,
    });

    await externalCourse.save();

    // Add to student's external courses
    const student = await Student.findById(req.user.id);
    student.externalCourses.push(externalCourse._id);
    await student.save();

    res
      .status(201)
      .json(
        formatResponse(
          true,
          externalCourse,
          "Tashqi kurs muvaffaqiyatli qo'shildi"
        )
      );
  } catch (error) {
    console.error("Add external course error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my external courses
export const getMyExternalCourses = async (req, res) => {
  try {
    const courses = await ExternalCourse.find({
      student: req.user.id,
      isActive: true,
    }).sort("-createdAt");

    res.json(formatResponse(true, courses, "Tashqi kurslarim"));
  } catch (error) {
    console.error("Get external courses error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update external course
export const updateExternalCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const course = await ExternalCourse.findOne({
      _id: id,
      student: req.user.id,
    });

    if (!course) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Tashqi kurs topilmadi"));
    }

    // Update allowed fields
    const allowedUpdates = [
      "courseName",
      "institutionName",
      "address",
      "schedule",
      "startDate",
      "endDate",
      "isActive",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        course[field] = updates[field];
      }
    });

    // Update instructor info
    if (updates.instructorName) {
      course.instructor.name = updates.instructorName;
    }
    if (updates.instructorPhone) {
      course.instructor.phone = formatPhoneNumber(updates.instructorPhone).db;
    }
    if (updates.studentPhone) {
      course.studentPhone = formatPhoneNumber(updates.studentPhone).db;
    }

    course.updatedAt = new Date();
    await course.save();

    res.json(
      formatResponse(true, course, "Tashqi kurs ma'lumotlari yangilandi")
    );
  } catch (error) {
    console.error("Update external course error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete external course
export const deleteExternalCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await ExternalCourse.findOne({
      _id: id,
      student: req.user.id,
    });

    if (!course) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Tashqi kurs topilmadi"));
    }

    // Soft delete
    course.isActive = false;
    course.updatedAt = new Date();
    await course.save();

    // Remove from student's external courses
    const student = await Student.findById(req.user.id);
    student.externalCourses = student.externalCourses.filter(
      (c) => c.toString() !== id
    );
    await student.save();

    res.json(formatResponse(true, null, "Tashqi kurs o'chirildi"));
  } catch (error) {
    console.error("Delete external course error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my attendance
export const getMyAttendance = async (req, res) => {
  try {
    const { clubId, startDate, endDate } = req.query;

    // Get student's enrolled clubs
    const student = await Student.findById(req.user.id);
    const enrolledClubIds = student.enrolledClubs
      .filter((e) => e.status === "approved")
      .map((e) => e.club);

    const filter = {
      club: clubId ? clubId : { $in: enrolledClubIds },
      "students.student": req.user.id,
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(filter)
      .populate("club", "name")
      .sort("-date");

    // Format attendance data
    const formattedAttendance = attendance.map((a) => {
      const studentAttendance = a.students.find(
        (s) => s.student.toString() === req.user.id
      );

      return {
        id: a._id,
        club: a.club,
        date: a.date,
        present: studentAttendance?.present || false,
        reason: studentAttendance?.reason || null,
        telegramPostLink: a.telegramPostLink,
      };
    });

    res.json(formatResponse(true, formattedAttendance, "Mening davomatlarim"));
  } catch (error) {
    console.error("Get my attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Student dashboard
export const getStudentDashboard = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .populate("enrolledClubs.club", "name schedule")
      .populate("externalCourses");

    // Get attendance statistics
    const enrolledClubIds = student.enrolledClubs
      .filter((e) => e.status === "approved")
      .map((e) => e.club._id);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          club: { $in: enrolledClubIds },
          "students.student": student._id,
          date: { $gte: thisMonth },
        },
      },
      {
        $unwind: "$students",
      },
      {
        $match: {
          "students.student": student._id,
        },
      },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: ["$students.present", 1, 0] },
          },
        },
      },
    ]);

    const stats = attendanceStats[0] || { totalClasses: 0, presentCount: 0 };

    const dashboardData = {
      profile: {
        full_name: student.full_name,
        student_id_number: student.student_id_number,
        department: student.department,
        group: student.group,
        image: student.image,
      },
      statistics: {
        enrolledClubs: student.enrolledClubs.filter(
          (e) => e.status === "approved"
        ).length,
        pendingApplications: student.enrolledClubs.filter(
          (e) => e.status === "pending"
        ).length,
        externalCourses: student.externalCourses.length,
        thisMonthAttendance: stats.totalClasses,
        thisMonthPresent: stats.presentCount,
        attendancePercentage:
          stats.totalClasses > 0
            ? ((stats.presentCount / stats.totalClasses) * 100).toFixed(1)
            : 0,
      },
      activeClubs: student.enrolledClubs
        .filter((e) => e.status === "approved")
        .map((e) => ({
          id: e.club._id,
          name: e.club.name,
          schedule: e.club.schedule,
        })),
      externalCourses: student.externalCourses.map((c) => ({
        id: c._id,
        name: c.courseName,
        institution: c.institutionName,
      })),
    };

    res.json(formatResponse(true, dashboardData, "Student dashboard"));
  } catch (error) {
    console.error("Student dashboard error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findById(req.user.id);

    if (email) {
      student.email = email;
    }

    if (password) {
      if (password.length < 6) {
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

      const bcrypt = await import("bcrypt");
      const salt = await bcrypt.genSalt(10);
      student.password = await bcrypt.hash(password, salt);
    }

    student.updatedAt = new Date();
    await student.save();

    res.json(formatResponse(true, student, "Profil ma'lumotlari yangilandi"));
  } catch (error) {
    console.error("Update profile error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
export const getMyNotifications = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get all enrollments with notifications
    const enrollments = await Enrollment.find({
      student: studentId,
      "notification.seen": false,
      status: { $in: ["approved", "rejected", "removed"] },
    })
      .populate("club", "name")
      .populate("processedBy", "profile.fullName")
      .sort("-processedDate");

    // Format notifications
    const notifications = enrollments.map((enrollment) => {
      let message = "";
      let type = "info";

      switch (enrollment.status) {
        case "approved":
          message = `"${enrollment.club.name}" to'garagiga qabul qilindingiz!`;
          type = "success";
          break;
        case "rejected":
          message = `"${enrollment.club.name}" to'garagiga arizangiz rad etildi. Sabab: ${enrollment.rejectionReason}`;
          type = "error";
          break;
        case "removed":
          message = `"${
            enrollment.club.name
          }" to'garagidan chiqarildingiz. Sabab: ${
            enrollment.rejectionReason || "O'qituvchi qarori"
          }`;
          type = "warning";
          break;
      }

      return {
        _id: enrollment._id,
        type,
        message,
        club: enrollment.club,
        date: enrollment.processedDate,
        processedBy: enrollment.processedBy,
        seen: enrollment.notification.seen,
      };
    });

    res.json(formatResponse(true, notifications, "Bildirishnomalar ro'yxati"));
  } catch (error) {
    console.error("Get notifications error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Mark notification as seen
export const markNotificationAsSeen = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const studentId = req.user.id;

    const enrollment = await Enrollment.findOneAndUpdate(
      {
        _id: enrollmentId,
        student: studentId,
      },
      {
        "notification.seen": true,
        "notification.seenAt": new Date(),
      },
      { new: true }
    );

    if (!enrollment) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Bildirishnoma topilmadi"));
    }

    res.json(
      formatResponse(true, enrollment, "Bildirishnoma o'qildi deb belgilandi")
    );
  } catch (error) {
    console.error("Mark notification as seen error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get notifications count
export const getNotificationsCount = async (req, res) => {
  try {
    const studentId = req.user.id;

    const count = await Enrollment.countDocuments({
      student: studentId,
      "notification.seen": false,
      status: { $in: ["approved", "rejected", "removed"] },
    });

    res.json(formatResponse(true, { count }, "Bildirishnomalar soni"));
  } catch (error) {
    console.error("Get notifications count error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Mark all notifications as seen
export const markAllNotificationsAsSeen = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await Enrollment.updateMany(
      {
        student: studentId,
        "notification.seen": false,
      },
      {
        "notification.seen": true,
        "notification.seenAt": new Date(),
      }
    );

    res.json(
      formatResponse(
        true,
        { updated: result.modifiedCount },
        "Barcha bildirishnomalar o'qildi deb belgilandi"
      )
    );
  } catch (error) {
    console.error("Mark all notifications as seen error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
