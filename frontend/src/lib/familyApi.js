import { db } from "./firebase";
import { ref as dbRef, get as dbGet } from "firebase/database";

// تسجيل دخول العائلة باستخدام رقم الهوية
export async function loginFamily(nationalId) {
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

// الحصول على بيانات عائلة معينة
export async function getFamilyById(familyId) {
  const familyRef = dbRef(db, `families/${familyId}`);
  const snap = await dbGet(familyRef);
  
  if (!snap.exists()) {
    throw new Error("العائلة غير موجودة");
  }
  
  return { id: familyId, ...snap.val() };
}
