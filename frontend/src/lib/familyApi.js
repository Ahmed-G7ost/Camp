import { db, auth } from "./firebase";
import { ref as dbRef, get as dbGet } from "firebase/database";
import { signInAnonymously } from "firebase/auth";

// تسجيل دخول العائلة باستخدام رقم الهوية
export async function loginFamily(nationalId) {
  // تسجيل دخول مجهول في Firebase للحصول على صلاحيات القراءة
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("خطأ في المصادقة:", error);
  }
  
  const familiesRef = dbRef(db, "families");
  const snap = await dbGet(familiesRef);
  
  if (!snap.exists()) {
    throw new Error("لا توجد عائلات مسجلة");
  }

  const families = snap.val();
  
  // البحث عن العائلة برقم الهوية في جميع الحقول
  for (const [id, family] of Object.entries(families)) {
    if (family.data) {
      // البحث في جميع حقول العائلة عن رقم الهوية
      const foundId = Object.values(family.data).find(
        val => String(val).trim() === String(nationalId).trim()
      );
      
      if (foundId) {
        return {
          id,
          email: `family_${id}@camp.local`,
          name: family.data[Object.keys(family.data)[0]] || "عائلة",
          role: "family",
          family_id: id,
          family_data: family.data
        };
      }
    }
  }
  
  throw new Error("رقم الهوية غير موجود");
}
// تطبيع النص العربي البسيط (توحيد الهمزات) لمطابقة تسميات الحقول
function normLabel(s) {
  return String(s || "").replace(/[أإآٱ]/g, "ا");
}

// البحث عن العائلة برقم الهوية + تجهيز أسئلة التحقق المتاحة لها
// يرجع: { familyUser, questions: [{ type, label, answer }] }
export async function lookupFamilyAuth(nationalId) {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
  } catch (error) {
    console.error("خطأ في المصادقة:", error);
  }

  const [famSnap, fieldSnap] = await Promise.all([
    dbGet(dbRef(db, "families")),
    dbGet(dbRef(db, "family_fields")),
  ]);

  if (!famSnap.exists()) throw new Error("لا توجد عائلات مسجلة");

  const families = famSnap.val();
  const fields = Object.values(fieldSnap.val() || {});

  const findKey = (pred) => (fields.find(pred) || {}).key;
  const headIdKey = findKey(
    (f) => normLabel(f.label).includes("هوية") && normLabel(f.label).includes("رب")
  );
  const birthKey = findKey((f) => normLabel(f.label).includes("ميلاد"));
  const wifeIdKey = findKey(
    (f) => normLabel(f.label).includes("هوية") && normLabel(f.label).includes("زوج")
  );
  const headNameKey = findKey(
    (f) => normLabel(f.label).includes("اسم") && normLabel(f.label).includes("رب")
  );

  const q = String(nationalId).trim();
  let matchId = null;
  let matchFam = null;
  for (const [id, fam] of Object.entries(families)) {
    const d = fam.data || {};
    const hit = headIdKey
      ? String(d[headIdKey] ?? "").trim() === q
      : Object.values(d).some((v) => String(v).trim() === q);
    if (hit) {
      matchId = id;
      matchFam = fam;
      break;
    }
  }

  if (!matchFam) throw new Error("رقم الهوية غير موجود");

  const d = matchFam.data || {};
  const wifeIdVal = wifeIdKey ? String(d[wifeIdKey] ?? "").trim() : "";
  const birthVal = birthKey ? String(d[birthKey] ?? "").trim() : "";
  // رقم هوية الزوجة يكون صالحاً فقط إذا كان رقماً حقيقياً (وليس "أرملة/مطلقة/أنسة")
  const wifeIsValid = /^\d{3,}$/.test(wifeIdVal.replace(/\s/g, ""));

  const questions = [];
  if (wifeIsValid) questions.push({ type: "wife_id", label: "رقم هوية الزوجة", answer: wifeIdVal });
  if (birthVal) questions.push({ type: "birth_date", label: "تاريخ ميلاد رب الأسرة", answer: birthVal });

  const familyUser = {
    id: matchId,
    email: `family_${matchId}@camp.local`,
    name: (headNameKey && d[headNameKey]) || d[Object.keys(d)[0]] || "عائلة",
    role: "family",
    family_id: matchId,
    family_data: d,
  };

  return { familyUser, questions };
}

// الحصول على بيانات عائلة معينة
export async function getFamilyById(familyId) {
  // تسجيل دخول مجهول في Firebase للحصول على صلاحيات القراءة
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (error) {
    console.error("خطأ في المصادقة:", error);
  }
  
  const familyRef = dbRef(db, `families/${familyId}`);
  const snap = await dbGet(familyRef);
  
  if (!snap.exists()) {
    throw new Error("العائلة غير موجودة");
  }
  
  return { id: familyId, ...snap.val() };
}
