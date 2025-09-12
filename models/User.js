import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["university_admin", "faculty_admin", "tutor"],
    required: true,
  },

  profile: {
    fullName: { type: String, required: true },
    image: String,
    phone: String, // +998XXXXXXXXX formatda saqlanadi
    email: String,
  },

  // Faculty admin uchun
  faculty: {
    id: Number,
    name: String,
    code: String,
  },

  // Tutor uchun
  assignedClubs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
  ],

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
