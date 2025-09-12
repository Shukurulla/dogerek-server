import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },

  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  applicationDate: {
    type: Date,
    default: Date.now,
  },

  processedDate: Date,

  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  rejectionReason: String,

  notification: {
    seen: { type: Boolean, default: false },
    seenAt: Date,
  },
});

// Bir student bir to'garakka faqat bir marta ariza topshira oladi
enrollmentSchema.index({ student: 1, club: 1 }, { unique: true });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

export default Enrollment;
