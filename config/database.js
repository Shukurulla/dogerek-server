import mongoose from "mongoose";
import User from "../models/User.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // const createInitialAdmin = async () => {
    //   try {
    //     await connectDB();

    //     // Check if admin already exists
    //     const adminCount = await User.countDocuments({
    //       role: "university_admin",
    //     });

    //     if (adminCount > 0) {
    //       console.log("Admin already exists!");
    //       process.exit(0);
    //     }
    //     // Create initial admin
    //     const admin = new User({
    //       username: "admin",
    //       password: "admin123", // Default parol - keyin o'zgartirish kerak!
    //       role: "university_admin",
    //       profile: {
    //         fullName: "System Administrator",
    //         email: "admin@dogerek.uz",
    //         phone: "+998901234567",
    //       },
    //     });

    //     await admin.save();

    //     console.log("✅ Initial admin created successfully!");
    //     console.log("📧 Username: admin");
    //     console.log("🔑 Password: admin123");
    //     console.log(
    //       "⚠️  IMPORTANT: Please change the password after first login!"
    //     );

    //     process.exit(0);
    //   } catch (error) {
    //     console.error("Error creating admin:", error);
    //     process.exit(1);
    //   }
    // };

    // Script ni ishga tushirish
    // createInitialAdmin();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
