import axios from "axios";
import Student from "../models/Student.js";

const HEMIS_API_URL =
  process.env.HEMIS_API_URL || "https://student.karsu.uz/rest/v1";
const HEMIS_TOKEN =
  process.env.HEMIS_TOKEN || "erkFR_9u2IOFoaGxYQPDmjmXVe6Oqv3s";
const PAGE_SIZE = 200;

// Hemis API dan ma'lumotlarni olish
async function fetchHemisData(page = 1) {
  try {
    const response = await axios.get(`${HEMIS_API_URL}/data/student-list`, {
      params: {
        limit: PAGE_SIZE,
        page: page,
      },
      headers: {
        Authorization: `Bearer ${HEMIS_TOKEN}`,
      },
      timeout: 30000, // 30 soniya timeout
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error.message);
    throw error;
  }
}

// Ma'lumotlarni formatlash
function formatStudentData(hemisStudent) {
  return {
    hemisId: hemisStudent.id,
    meta_id: hemisStudent.meta_id,
    student_id_number: hemisStudent.student_id_number,
    full_name: hemisStudent.full_name,
    short_name: hemisStudent.short_name,
    first_name: hemisStudent.first_name,
    second_name: hemisStudent.second_name,
    third_name: hemisStudent.third_name,
    gender: hemisStudent.gender,
    birth_date: hemisStudent.birth_date,
    image: hemisStudent.image,
    email: hemisStudent.email || "",

    department: hemisStudent.department
      ? {
          id: hemisStudent.department.id,
          name: hemisStudent.department.name,
          code: hemisStudent.department.code,
          structureType: hemisStudent.department.structureType,
        }
      : null,

    specialty: hemisStudent.specialty,
    group: hemisStudent.group,
    level: hemisStudent.level,
    semester: hemisStudent.semester,
    educationYear: hemisStudent.educationYear,
    educationType: hemisStudent.educationType,
    educationForm: hemisStudent.educationForm,
    paymentForm: hemisStudent.paymentForm,
    year_of_enter: hemisStudent.year_of_enter,
    studentStatus: hemisStudent.studentStatus,
  };
}

// Asosiy sync funksiyasi
export async function syncHemisData() {
  console.log("Starting Hemis data synchronization...");

  try {
    let allStudents = [];
    let currentPage = 1;
    let totalCount = 0;

    // Birinchi sahifani olib, umumiy sonni aniqlaymiz
    const firstPageData = await fetchHemisData(1);

    if (!firstPageData.success || !firstPageData.data) {
      throw new Error("Failed to fetch initial data from Hemis");
    }

    totalCount = firstPageData.data.pagination.totalCount;
    const pageCount = firstPageData.data.pagination.pageCount;

    console.log(`Total students to sync: ${totalCount}`);
    console.log(`Total pages: ${pageCount}`);

    // Birinchi sahifa ma'lumotlarini qo'shamiz
    allStudents = firstPageData.data.items.map(formatStudentData);

    // Qolgan sahifalarni yuklaymiz
    for (currentPage = 2; currentPage <= pageCount; currentPage++) {
      console.log(`Fetching page ${currentPage} of ${pageCount}...`);

      try {
        // Har 5 sahifadan keyin 2 soniya kutamiz (rate limiting uchun)
        if ((currentPage - 1) % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        const pageData = await fetchHemisData(currentPage);

        if (pageData.success && pageData.data && pageData.data.items) {
          const formattedStudents = pageData.data.items.map(formatStudentData);
          allStudents = allStudents.concat(formattedStudents);
          console.log(
            `Page ${currentPage} processed. Total collected: ${allStudents.length}`
          );
        }
      } catch (pageError) {
        console.error(`Failed to fetch page ${currentPage}, retrying...`);

        // Retry logic - 3 marta urinib ko'ramiz
        let retryCount = 0;
        let success = false;

        while (retryCount < 3 && !success) {
          retryCount++;
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 soniya kutamiz

          try {
            const pageData = await fetchHemisData(currentPage);
            if (pageData.success && pageData.data && pageData.data.items) {
              const formattedStudents =
                pageData.data.items.map(formatStudentData);
              allStudents = allStudents.concat(formattedStudents);
              success = true;
              console.log(
                `Page ${currentPage} processed after ${retryCount} retries`
              );
            }
          } catch (retryError) {
            console.error(`Retry ${retryCount} failed for page ${currentPage}`);
          }
        }

        if (!success) {
          console.error(
            `Failed to fetch page ${currentPage} after 3 retries, skipping...`
          );
        }
      }
    }

    console.log(`Total students collected: ${allStudents.length}`);

    // MongoDB ga saqlash
    if (allStudents.length > 0) {
      console.log("Clearing existing students...");
      await Student.deleteMany({});

      console.log("Inserting new students...");
      // Batch insert - har 500 ta studentni alohida saqlash
      const batchSize = 500;
      for (let i = 0; i < allStudents.length; i += batchSize) {
        const batch = allStudents.slice(i, i + batchSize);
        await Student.insertMany(batch, { ordered: false });
        console.log(
          `Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
            allStudents.length / batchSize
          )}`
        );
      }

      console.log(`Successfully synced ${allStudents.length} students`);
      return `Sync completed: ${allStudents.length} students updated`;
    } else {
      throw new Error("No students data received from Hemis");
    }
  } catch (error) {
    console.error("Sync error:", error);
    throw new Error(`Hemis sync failed: ${error.message}`);
  }
}

// Fakultetlar ro'yxatini olish
export async function getFacultiesFromStudents() {
  try {
    const faculties = await Student.aggregate([
      {
        $match: {
          department: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            id: "$department.id",
            name: "$department.name",
            code: "$department.code",
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          id: "$_id.id",
          name: "$_id.name",
          code: "$_id.code",
          studentCount: "$count",
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    return faculties;
  } catch (error) {
    console.error("Error getting faculties:", error);
    throw error;
  }
}

// Guruhlar ro'yxatini olish
export async function getGroupsFromStudents(facultyId = null) {
  try {
    const match = { group: { $exists: true, $ne: null } };
    if (facultyId) {
      match["department.id"] = facultyId;
    }

    const groups = await Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            id: "$group.id",
            name: "$group.name",
            facultyId: "$department.id",
            facultyName: "$department.name",
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          id: "$_id.id",
          name: "$_id.name",
          facultyId: "$_id.facultyId",
          facultyName: "$_id.facultyName",
          studentCount: "$count",
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    return groups;
  } catch (error) {
    console.error("Error getting groups:", error);
    throw error;
  }
}
