import mongoose from "mongoose";

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  description: String,

  // Yangi category field
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  faculty: {
    id: Number,
    name: String,
    code: String,
  },

  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  schedule: {
    time: {
      start: String, // "10:00"
      end: String, // "11:30"
    },
    weekType: {
      type: String,
      enum: ["odd", "even", "both"], // toq, juft, har hafta
      default: "both",
    },
    days: [
      {
        type: Number,
        min: 1,
        max: 7,
      },
    ], // 1=Dushanba, 7=Yakshanba
  },

  location: String,

  capacity: Number,

  enrolledStudents: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      enrolledAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["active", "inactive"], default: "active" },
    },
  ],

  telegramChannelLink: String,

  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

clubSchema.index({ "faculty.id": 1 });
clubSchema.index({ tutor: 1 });
clubSchema.index({ category: 1 });

const Club = mongoose.model("Club", clubSchema);

export default Club;
