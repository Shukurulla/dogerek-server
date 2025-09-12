export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Autentifikatsiya talab qilinadi",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Ruxsat berilmagan",
      });
    }

    next();
  };
};

// Specific role checks
export const isUniversityAdmin = checkRole("university_admin");
export const isFacultyAdmin = checkRole("faculty_admin");
export const isTutor = checkRole("tutor");
export const isStudent = checkRole("student");

// Combined role checks
export const isAdminOrFaculty = checkRole("university_admin", "faculty_admin");
export const isAdminOrTutor = checkRole(
  "university_admin",
  "faculty_admin",
  "tutor"
);
export const isAnyAdmin = checkRole("university_admin", "faculty_admin");
