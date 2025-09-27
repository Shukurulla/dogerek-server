import User from "../models/User.js";
import Student from "../models/Student.js";
import Club from "../models/Club.js";
import Category from "../models/Category.js";
import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import { formatResponse, formatPhoneNumber } from "../utils/formatters.js";
import {
  getFacultiesFromStudents,
  getGroupsFromStudents,
} from "../utils/syncHemisData.js";

// Create club - CATEGORY SUPPORT ADDED
export const createClub = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId, // NEW: Category field
      tutorId,
      schedule,
      location,
      capacity,
      telegramChannelLink,
    } = req.body;

    // Validation
    if (!name || !categoryId || !tutorId || !schedule) {
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

    // Check category exists and is active
    const category = await Category.findById(categoryId);
    if (!category || !category.isActive) {
      return res
        .status(400)
        .json(
          formatResponse(false, null, "Kategoriya topilmadi yoki faol emas")
        );
    }

    // Check tutor - faqat shu fakultetdagi o'qituvchilar
    const tutor = await User.findOne({
      _id: tutorId,
      role: "tutor",
      "faculty.id": req.user.user.faculty.id,
    });

    if (!tutor) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "O'qituvchi topilmadi yoki bu fakultetga tegishli emas"
          )
        );
    }

    // Create club with category
    const newClub = new Club({
      name,
      description,
      category: categoryId, // NEW: Save category
      faculty: req.user.user.faculty,
      tutor: tutorId,
      schedule,
      location,
      capacity,
      telegramChannelLink,
      createdBy: req.user.id,
    });

    await newClub.save();

    // Add club to tutor's assigned clubs
    tutor.assignedClubs.push(newClub._id);
    await tutor.save();

    // Populate category before sending response
    await newClub.populate("category", "name color icon");

    res
      .status(201)
      .json(formatResponse(true, newClub, "To'garak muvaffaqiyatli yaratildi"));
  } catch (error) {
    console.error("Create club error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my faculty clubs - WITH CATEGORY FILTER
export const getMyClubs = async (req, res) => {
  try {
    const { page = 1, limit = 20, categoryId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      "faculty.id": req.user.user.faculty.id,
      isActive: true,
    };

    // Add category filter if provided
    if (categoryId) {
      filter.category = categoryId;
    }

    const [clubs, total] = await Promise.all([
      Club.find(filter)
        .populate("tutor", "profile.fullName profile.phone")
        .populate("category", "name color icon") // NEW: Populate category
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-createdAt"),
      Club.countDocuments(filter),
    ]);

    // Har bir klub uchun real statistika
    const clubsWithStats = await Promise.all(
      clubs.map(async (club) => {
        // Real enrolled students count from Student collection
        const enrolledCount = await Student.countDocuments({
          "enrolledClubs.club": club._id,
          "enrolledClubs.status": "approved",
          isActive: true,
        });

        return {
          ...club.toObject(),
          currentStudents: enrolledCount,
          availableSlots: club.capacity ? club.capacity - enrolledCount : null,
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
        "Fakultet to'garaklari"
      )
    );
  } catch (error) {
    console.error("Get clubs error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update club - WITH CATEGORY UPDATE
export const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const club = await Club.findOne({
      _id: id,
      "faculty.id": req.user.user.faculty.id,
    });

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // If changing category
    if (updates.categoryId) {
      const category = await Category.findById(updates.categoryId);
      if (!category || !category.isActive) {
        return res
          .status(400)
          .json(
            formatResponse(false, null, "Kategoriya topilmadi yoki faol emas")
          );
      }
      club.category = updates.categoryId;
    }

    // Update allowed fields
    const allowedUpdates = [
      "name",
      "description",
      "schedule",
      "location",
      "capacity",
      "telegramChannelLink",
      "isActive",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        club[field] = updates[field];
      }
    });

    // If changing tutor
    if (updates.tutorId && updates.tutorId !== club.tutor.toString()) {
      const newTutor = await User.findOne({
        _id: updates.tutorId,
        role: "tutor",
        "faculty.id": req.user.user.faculty.id,
      });

      if (!newTutor) {
        return res
          .status(400)
          .json(formatResponse(false, null, "Yangi o'qituvchi topilmadi"));
      }

      // Remove from old tutor
      const oldTutor = await User.findById(club.tutor);
      if (oldTutor) {
        oldTutor.assignedClubs = oldTutor.assignedClubs.filter(
          (c) => c.toString() !== id
        );
        await oldTutor.save();
      }

      // Add to new tutor
      newTutor.assignedClubs.push(club._id);
      await newTutor.save();

      club.tutor = updates.tutorId;
    }

    club.updatedAt = new Date();
    await club.save();

    // Populate category before sending response
    await club.populate("category", "name color icon");

    res.json(formatResponse(true, club, "To'garak ma'lumotlari yangilandi"));
  } catch (error) {
    console.error("Update club error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete club
export const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await Club.findOne({
      _id: id,
      "faculty.id": req.user.user.faculty.id,
    });

    if (!club) {
      return res
        .status(404)
        .json(formatResponse(false, null, "To'garak topilmadi"));
    }

    // Soft delete
    club.isActive = false;
    club.updatedAt = new Date();
    await club.save();

    res.json(formatResponse(true, null, "To'garak o'chirildi"));
  } catch (error) {
    console.error("Delete club error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Create tutor - RENAMED TO O'QITUVCHI
export const createTutor = async (req, res) => {
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

    // Format phone number
    const formattedPhone = phone ? formatPhoneNumber(phone).db : null;

    // Create new tutor (o'qituvchi)
    const newTutor = new User({
      username,
      password,
      role: "tutor",
      profile: {
        fullName,
        phone: formattedPhone,
        email,
      },
      faculty: req.user.user.faculty,
      createdBy: req.user.id,
    });

    await newTutor.save();

    // Remove password from response
    const tutorData = newTutor.toObject();
    delete tutorData.password;

    res
      .status(201)
      .json(
        formatResponse(true, tutorData, "O'qituvchi muvaffaqiyatli yaratildi")
      );
  } catch (error) {
    console.error("Create tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my faculty tutors - RENAMED TO O'QITUVCHILAR
export const getMyTutors = async (req, res) => {
  try {
    const tutors = await User.find({
      role: "tutor",
      "faculty.id": req.user.user.faculty.id,
      isActive: true,
    })
      .populate("assignedClubs", "name")
      .select("-password")
      .sort("-createdAt");

    res.json(formatResponse(true, tutors, "Fakultet o'qituvchilari"));
  } catch (error) {
    console.error("Get tutors error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update tutor - RENAMED TO O'QITUVCHI
export const updateTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, isActive } = req.body;

    const tutor = await User.findOne({
      _id: id,
      role: "tutor",
      "faculty.id": req.user.user.faculty.id,
    });

    if (!tutor) {
      return res
        .status(404)
        .json(formatResponse(false, null, "O'qituvchi topilmadi"));
    }

    // Update fields
    if (fullName) tutor.profile.fullName = fullName;
    if (email !== undefined) tutor.profile.email = email || null;
    if (phone !== undefined)
      tutor.profile.phone = phone ? formatPhoneNumber(phone).db : null;
    if (typeof isActive === "boolean") tutor.isActive = isActive;

    tutor.updatedAt = new Date();
    await tutor.save();

    // Remove password from response
    const tutorData = tutor.toObject();
    delete tutorData.password;

    res.json(
      formatResponse(true, tutorData, "O'qituvchi ma'lumotlari yangilandi")
    );
  } catch (error) {
    console.error("Update tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete tutor - RENAMED TO O'QITUVCHI
export const deleteTutor = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await User.findOne({
      _id: id,
      role: "tutor",
      "faculty.id": req.user.user.faculty.id,
    });

    if (!tutor) {
      return res
        .status(404)
        .json(formatResponse(false, null, "O'qituvchi topilmadi"));
    }

    // Check if tutor has active clubs
    const activeClubs = await Club.countDocuments({
      tutor: id,
      isActive: true,
    });

    if (activeClubs > 0) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            "Bu o'qituvchiga biriktirilgan faol to'garaklar mavjud"
          )
        );
    }

    // Soft delete
    tutor.isActive = false;
    tutor.updatedAt = new Date();
    await tutor.save();

    res.json(formatResponse(true, null, "O'qituvchi o'chirildi"));
  } catch (error) {
    console.error("Delete tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Faculty dashboard - WITH CATEGORIES
export const getFacultyDashboard = async (req, res) => {
  try {
    const facultyId = req.user.user.faculty.id;

    // Get all active categories for statistics
    const categories = await Category.find({ isActive: true }).select(
      "name color icon _id"
    );

    const [
      totalStudents,
      totalClubs,
      totalTutors,
      enrolledStudents,
      todayAttendance,
      pendingEnrollments,
    ] = await Promise.all([
      // Fakultetdagi barcha studentlar
      Student.countDocuments({
        "department.id": facultyId,
        isActive: true,
      }),
      // Fakultetdagi to'garaklar
      Club.countDocuments({
        "faculty.id": facultyId,
        isActive: true,
      }),
      // Fakultetdagi o'qituvchilar
      User.countDocuments({
        role: "tutor",
        "faculty.id": facultyId,
        isActive: true,
      }),
      // Fakultet to'garaklariga yozilgan studentlar
      Student.countDocuments({
        "enrolledClubs.club": {
          $in: await Club.find({ "faculty.id": facultyId }).distinct("_id"),
        },
        "enrolledClubs.status": "approved",
        isActive: true,
      }),
      // Bugungi davomatlar
      Attendance.countDocuments({
        club: {
          $in: await Club.find({ "faculty.id": facultyId }).distinct("_id"),
        },
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
      // Kutilayotgan arizalar
      Enrollment.countDocuments({
        club: {
          $in: await Club.find({ "faculty.id": facultyId }).distinct("_id"),
        },
        status: "pending",
      }),
    ]);

    // Category statistics
    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        const clubCount = await Club.countDocuments({
          "faculty.id": facultyId,
          category: category._id,
          isActive: true,
        });
        return {
          ...category.toObject(),
          clubCount,
        };
      })
    );

    const stats = {
      totalStudents,
      totalClubs,
      totalTutors,
      enrolledStudents,
      todayAttendance,
      pendingEnrollments,
      enrollmentPercentage:
        totalStudents > 0
          ? ((enrolledStudents / totalStudents) * 100).toFixed(1)
          : 0,
      facultyName: req.user.user.faculty.name,
      categories: categoryStats, // NEW: Categories with counts
    };

    res.json(formatResponse(true, stats, "Fakultet statistikasi"));
  } catch (error) {
    console.error("Faculty dashboard error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get faculty students
export const getFacultyStudents = async (req, res) => {
  try {
    const { groupId, busy, search, page = 1, limit = 20 } = req.query;

    const filter = {
      isActive: true,
    };

    // Agar search bo'lsa, barcha fakultetlardan qidirish
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { student_id_number: { $regex: search, $options: "i" } },
      ];
    } else {
      // Agar search yo'q bo'lsa, faqat fakultet studentlari
      filter["department.id"] = req.user.user.faculty.id;
    }

    // Fix: Check if groupId is valid before parsing
    if (groupId && groupId !== "null" && groupId !== "undefined") {
      const groupIdNum = parseInt(groupId);
      if (!isNaN(groupIdNum)) {
        filter["group.id"] = groupIdNum;
      }
    }

    // Fix: Check busy parameter properly
    if (busy === "true") {
      filter.$or = [
        { enrolledClubs: { $elemMatch: { status: "approved" } } },
        { "externalCourses.0": { $exists: true } },
      ];
    } else if (busy === "false") {
      filter.$and = [
        {
          $or: [
            { enrolledClubs: { $exists: false } },
            { enrolledClubs: { $size: 0 } },
            { enrolledClubs: { $not: { $elemMatch: { status: "approved" } } } },
          ],
        },
        {
          $or: [
            { externalCourses: { $exists: false } },
            { externalCourses: { $size: 0 } },
          ],
        },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

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
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
        "Studentlar"
      )
    );
  } catch (error) {
    console.error("Get faculty students error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get club enrollments
export const getClubEnrollments = async (req, res) => {
  try {
    const { status = "pending", clubId, page = 1, limit = 20 } = req.query;

    // Fakultet to'garaklarini olish
    const facultyClubs = await Club.find({
      "faculty.id": req.user.user.faculty.id,
      isActive: true,
    }).distinct("_id");

    const filter = {
      club: clubId ? clubId : { $in: facultyClubs },
      status: status,
    };

    const skip = (page - 1) * limit;

    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .populate(
          "student",
          "full_name student_id_number department group image"
        )
        .populate("club", "name")
        .populate("processedBy", "profile.fullName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort("-applicationDate"),
      Enrollment.countDocuments(filter),
    ]);

    res.json(
      formatResponse(
        true,
        {
          enrollments,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
          },
        },
        "Arizalar ro'yxati"
      )
    );
  } catch (error) {
    console.error("Get club enrollments error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Process enrollment
export const processEnrollment = async (req, res) => {
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

    // Faqat fakultet adminlari o'z to'garaklari uchun arizalarni ko'rib chiqishi mumkin
    if (enrollment.club.faculty.id !== req.user.user.faculty.id) {
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

    // If approved, update student's enrolled clubs
    if (action === "approve") {
      const student = await Student.findById(enrollment.student._id);

      // Update enrollment status in student's enrolledClubs array
      const clubEnrollment = student.enrolledClubs.find(
        (e) => e.club.toString() === enrollment.club._id.toString()
      );

      if (clubEnrollment) {
        clubEnrollment.status = "approved";
        clubEnrollment.approvedAt = new Date();
        clubEnrollment.approvedBy = req.user.id;
        await student.save();
      }
    }

    res.json(
      formatResponse(
        true,
        enrollment,
        action === "approve" ? "Ariza qabul qilindi" : "Ariza rad etildi"
      )
    );
  } catch (error) {
    console.error("Process enrollment error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get faculty attendance
export const getFacultyAttendance = async (req, res) => {
  try {
    const { clubId, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Get faculty clubs
    const facultyClubs = await Club.find({
      "faculty.id": req.user.user.faculty.id,
    }).distinct("_id");

    const filter = {
      club: { $in: facultyClubs },
    };

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
        "Fakultet davomatlari"
      )
    );
  } catch (error) {
    console.error("Get faculty attendance error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
