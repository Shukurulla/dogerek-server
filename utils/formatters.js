// Telefon raqamni formatlash
export function formatPhoneNumber(phone) {
  // Input: +998901234567 yoki 901234567
  // Output DB: +998901234567
  // Output UI: +998 90 123-45-67

  if (!phone) return "";

  // Faqat raqamlarni qoldirish
  let cleaned = phone.replace(/\D/g, "");

  // Agar 998 bilan boshlanmasa, qo'shish
  if (!cleaned.startsWith("998")) {
    cleaned = "998" + cleaned;
  }

  // DB uchun format
  const dbFormat = "+" + cleaned;

  // UI uchun format
  const uiFormat = `+${cleaned.slice(0, 3)} ${cleaned.slice(
    3,
    5
  )} ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;

  return {
    db: dbFormat,
    ui: uiFormat,
  };
}

// Sana formatlash
export function formatDate(date, format = "DD.MM.YYYY") {
  if (!date) return "";

  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  switch (format) {
    case "DD.MM.YYYY":
      return `${day}.${month}.${year}`;
    case "DD.MM.YYYY HH:mm":
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return `${day}.${month}.${year}`;
  }
}

// Hafta kunlarini formatlash
export function formatWeekDays(days) {
  const weekDays = {
    1: "Dushanba",
    2: "Seshanba",
    3: "Chorshanba",
    4: "Payshanba",
    5: "Juma",
    6: "Shanba",
    7: "Yakshanba",
  };

  if (!days || !Array.isArray(days)) return "";

  return days.map((day) => weekDays[day]).join(", ");
}

// Hafta turini formatlash
export function formatWeekType(type) {
  const types = {
    odd: "Toq haftalar",
    even: "Juft haftalar",
    both: "Har hafta",
  };

  return types[type] || type;
}

// Vaqt oralig'ini formatlash
export function formatTimeRange(start, end) {
  if (!start || !end) return "";
  return `${start} - ${end}`;
}

// Status ranglarini olish
export function getStatusColor(status) {
  const colors = {
    pending: "orange",
    approved: "green",
    rejected: "red",
    active: "green",
    inactive: "gray",
    present: "green",
    absent: "red",
  };

  return colors[status] || "default";
}

// Pagination uchun offset hisoblash
export function calculatePagination(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return { skip, limit };
}

// Response formatter
export function formatResponse(
  success = true,
  data = null,
  message = "",
  error = null
) {
  return {
    success,
    data,
    message,
    error,
    timestamp: new Date().toISOString(),
  };
}
