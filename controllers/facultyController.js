import User from "../models/User.js";
import Student from "../models/Student.js";
import Club from "../models/Club.js";
import Attendance from "../models/Attendance.js";
import { formatResponse, formatPhoneNumber } from "../utils/formatters.js";

// Create club
export const createClub = async (req, res) => {
  try {
    const {
      name,
      description,
      tutorId,
      schedule,
      location,
      capacity,
      telegramChannelLink,
    } = req.body;

    // Validation
    if (!name || !tutorId || !schedule) {
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

    // Check tutor
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
            "Tutor topilmadi yoki bu fakultetga tegishli emas"
          )
        );
    }

    // Create club
    const newClub = new Club({
      name,
      description,
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

// Get my faculty clubs
export const getMyClubs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      "faculty.id": req.user.user.faculty.id,
      isActive: true,
    };

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

// Update club
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
          .json(formatResponse(false, null, "Yangi tutor topilmadi"));
      }

      // Remove from old tutor
      const oldTutor = await User.findById(club.tutor);
      oldTutor.assignedClubs = oldTutor.assignedClubs.filter(
        (c) => c.toString() !== id
      );
      await oldTutor.save();

      // Add to new tutor
      newTutor.assignedClubs.push(club._id);
      await newTutor.save();

      club.tutor = updates.tutorId;
    }

    club.updatedAt = new Date();
    await club.save();

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

// Create tutor
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

    // Create new tutor
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

    res
      .status(201)
      .json(formatResponse(true, newTutor, "Tutor muvaffaqiyatli yaratildi"));
  } catch (error) {
    console.error("Create tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get my faculty tutors
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

    res.json(formatResponse(true, tutors, "Fakultet tutorlari"));
  } catch (error) {
    console.error("Get tutors error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update tutor
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
        .json(formatResponse(false, null, "Tutor topilmadi"));
    }

    // Update fields
    if (fullName) tutor.profile.fullName = fullName;
    if (email) tutor.profile.email = email;
    if (phone) tutor.profile.phone = formatPhoneNumber(phone).db;
    if (typeof isActive === "boolean") tutor.isActive = isActive;

    tutor.updatedAt = new Date();
    await tutor.save();

    res.json(formatResponse(true, tutor, "Tutor ma'lumotlari yangilandi"));
  } catch (error) {
    console.error("Update tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete tutor
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
        .json(formatResponse(false, null, "Tutor topilmadi"));
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
            "Bu tutorga biriktirilgan faol to'garaklar mavjud"
          )
        );
    }

    // Soft delete
    tutor.isActive = false;
    tutor.updatedAt = new Date();
    await tutor.save();

    res.json(formatResponse(true, null, "Tutor o'chirildi"));
  } catch (error) {
    console.error("Delete tutor error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Faculty dashboard
export const getFacultyDashboard = async (req, res) => {
  try {
    const facultyId = req.user.user.faculty.id;

    const [
      totalStudents,
      totalClubs,
      totalTutors,
      enrolledStudents,
      todayAttendance,
    ] = await Promise.all([
      Student.countDocuments({ "department.id": facultyId }),
      Club.countDocuments({ "faculty.id": facultyId, isActive: true }),
      User.countDocuments({
        role: "tutor",
        "faculty.id": facultyId,
        isActive: true,
      }),
      Student.countDocuments({
        "department.id": facultyId,
        "enrolledClubs.0": { $exists: true },
      }),
      Attendance.countDocuments({
        club: {
          $in: await Club.find({ "faculty.id": facultyId }).distinct("_id"),
        },
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
    ]);

    const stats = {
      totalStudents,
      totalClubs,
      totalTutors,
      enrolledStudents,
      todayAttendance,
      enrollmentPercentage: ((enrolledStudents / totalStudents) * 100).toFixed(
        1
      ),
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
    const { groupId, busy, page = 1, limit = 20 } = req.query;

    const filter = {
      "department.id": req.user.user.faculty.id,
      isActive: true,
    };

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
        "Fakultet studentlari"
      )
    );
  } catch (error) {
    console.error("Get faculty students error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get faculty attendance
export const getFacultyAttendance = async (req, res) => {
  try {
    const { clubId, date, page = 1, limit = 20 } = req.query;

    // Get faculty clubs
    const facultyClubs = await Club.find({
      "faculty.id": req.user.user.faculty.id,
    }).distinct("_id");

    const filter = {
      club: { $in: facultyClubs },
    };

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
