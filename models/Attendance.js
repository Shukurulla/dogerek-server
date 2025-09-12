import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true,
  },

  date: {
    type: Date,
    required: true,
  },

  students: [
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
      present: {
        type: Boolean,
        default: false,
      },
      reason: String, // Kelmaganligi uchun sabab
    },
  ],

  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  notes: String,

  telegramPostLink: String, // Kurs jarayoni haqidagi post linki

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Bir kunga bir to'garak uchun faqat bitta davomat
attendanceSchema.index({ club: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
