import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  // Hemis dan kelgan ma'lumotlar
  hemisId: { type: Number, required: true },
  meta_id: Number,
  student_id_number: { type: String, unique: true, required: true },
  full_name: { type: String, required: true },
  short_name: String,
  first_name: String,
  second_name: String,
  third_name: String,

  gender: {
    code: String,
    name: String,
  },

  birth_date: Number,
  image: String,
  email: String,

  // Login uchun
  password: String,

  // Ta'lim ma'lumotlari
  department: {
    id: Number,
    name: String,
    code: String,
    structureType: {
      code: String,
      name: String,
    },
  },

  specialty: {
    id: Number,
    code: String,
    name: String,
  },

  group: {
    id: Number,
    name: String,
    educationLang: {
      code: String,
      name: String,
    },
  },

  level: {
    code: String,
    name: String,
  },

  semester: {
    id: Number,
    code: String,
    name: String,
  },

  educationYear: {
    code: String,
    name: String,
    current: Boolean,
  },

  educationType: {
    code: String,
    name: String,
  },

  educationForm: {
    code: String,
    name: String,
  },

  paymentForm: {
    code: String,
    name: String,
  },

  // Qo'shimcha ma'lumotlar
  year_of_enter: Number,
  studentStatus: {
    code: String,
    name: String,
  },

  // To'g'arak ma'lumotlari
  enrolledClubs: [
    {
      club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      enrolledAt: { type: Date, default: Date.now },
      approvedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  ],

  // Tashqi kurslar
  externalCourses: [
    { type: mongoose.Schema.Types.ObjectId, ref: "ExternalCourse" },
  ],

  // Tizim ma'lumotlari
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
});

studentSchema.index({ student_id_number: 1 });
studentSchema.index({ "department.id": 1 });
studentSchema.index({ "group.id": 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
