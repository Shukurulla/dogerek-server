import mongoose from "mongoose";

const externalCourseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },

  courseName: {
    type: String,
    required: true,
  },

  institutionName: {
    type: String,
    required: true,
  },

  address: {
    type: String,
    required: true,
  },

  schedule: {
    days: [
      {
        type: Number,
        min: 1,
        max: 7,
      },
    ], // 1=Dushanba, 7=Yakshanba

    time: {
      start: String, // "14:00"
      end: String, // "16:00"
    },
  },

  instructor: {
    name: String,
    phone: String, // +998XXXXXXXXX formatda
  },

  studentPhone: String, // +998XXXXXXXXX formatda

  startDate: Date,
  endDate: Date,

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

externalCourseSchema.index({ student: 1 });

const ExternalCourse = mongoose.model("ExternalCourse", externalCourseSchema);

export default ExternalCourse;
