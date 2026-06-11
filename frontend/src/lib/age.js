// أدوات موحّدة للتاريخ والعمر — صيغة العرض المعتمدة: dd/mm/yyyy

// تحليل مرن للتاريخ: yyyy-mm-dd أو dd/mm/yyyy
export function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// عرض التاريخ بصيغة dd/mm/yyyy
export function formatDateDMY(value) {
  const d = parseDate(value);
  if (!d) return value ? String(value) : "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// تحويل لأي صيغة إلى yyyy-mm-dd (لحقول <input type="date">)
export function toISO(value) {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// العمر بالسنوات (رقم) — للفلاتر
export function calcAgeYears(value) {
  const b = parseDate(value);
  if (!b) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a < 0 ? null : a;
}

// العمر كنص: بالسنوات، وإن كان أقل من سنة فبالأشهر
export function calcAgeLabel(value) {
  const b = parseDate(value);
  if (!b) return "";
  const t = new Date();
  let years = t.getFullYear() - b.getFullYear();
  let months = t.getMonth() - b.getMonth();
  if (t.getDate() < b.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return "";
  if (years < 1) return months < 1 ? "أقل من شهر" : `${months} شهر`;
  return `${years} سنة`;
}

// هل هذا الحقل حقل تاريخ ميلاد؟
export function isBirthDateField(f) {
  return f?.type === "date" && /ميلاد|ولاد/.test(f?.label || "");
}

// مفتاح تخزين العمر المرافق لحقل تاريخ الميلاد
export const ageKeyOf = (key) => `${key}__age`;
