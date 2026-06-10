// Firebase-backed drop-in replacement for the old axios `api` client.
// Mirrors the REST surface the pages expect (get/post/put/delete -> { data }),
// but talks DIRECTLY to Firebase Realtime Database (no backend) so the app
// can be deployed on Vercel as a static site.
import * as XLSX from "xlsx";
import { ref, get, set, push, update, remove } from "firebase/database";
import { db, firebaseConfig } from "./firebase";

// ─── Current user (set by AuthContext) ───────────────────────────────────────
let currentUser = null;
export function setCurrentUser(u) {
  currentUser = u;
}
const userName = () => currentUser?.name || "غير معروف";
const isAdmin = () => currentUser?.role === "admin";

// ─── Error helper (kept identical to old api) ────────────────────────────────
export function apiError(detail) {
  if (detail == null) return "حدث خطأ ما. حاول مجدداً";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

function httpError(detail, status = 400) {
  const err = new Error(typeof detail === "string" ? detail : "خطأ");
  err.response = { data: { detail }, status };
  return err;
}

const nowIso = () => new Date().toISOString();

// ─── Low-level Firebase helpers ──────────────────────────────────────────────
async function listRecords(col) {
  const snap = await get(ref(db, col));
  const val = snap.val();
  if (!val || typeof val !== "object") return [];
  return Object.entries(val)
    .filter(([, v]) => v && typeof v === "object")
    .map(([k, v]) => ({ ...v, id: v.id || k }));
}

async function getRecord(col, id) {
  const snap = await get(ref(db, `${col}/${id}`));
  if (!snap.exists()) return null;
  return { ...snap.val(), id };
}

async function pushRecord(col, data) {
  const node = push(ref(db, col));
  const record = { ...data, id: node.key };
  await set(node, record);
  return record;
}

async function patchRecord(col, id, patch) {
  await update(ref(db, `${col}/${id}`), patch);
  return getRecord(col, id);
}

async function deleteRecord(col, id) {
  await remove(ref(db, `${col}/${id}`));
}

async function deleteCollection(col) {
  await remove(ref(db, col));
}

// ─── Arabic fuzzy-matching (ported from the old Python backend) ──────────────
function normalizeArabic(text) {
  if (!text && text !== 0) return "";
  let t = String(text).trim();
  t = t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  t = t.replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627"); // alef variants -> ا
  t = t.replace(/\u0629/g, "\u0647"); // ة -> ه
  t = t.replace(/\u0649/g, "\u064A"); // ى -> ي
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function matchScore(a0, b0) {
  const a = normalizeArabic(a0);
  const b = normalizeArabic(b0);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  const common = [...wa].filter((w) => wb.has(w)).length;
  if (common === 0) return 0;
  const total = Math.max(wa.size, wb.size);
  let score = common / total;
  const [shorter, longer] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  if ([...shorter].every((w) => longer.has(w))) score = Math.min(1, score + 0.15);
  return score;
}

function findBestFamily(families, fieldKey, query, threshold = 0.6) {
  let best = 0;
  let bestFam = null;
  for (const fam of families) {
    const val = String(fam.data?.[fieldKey] || "").trim();
    if (!val) continue;
    const s = matchScore(query, val);
    if (s > best) {
      best = s;
      bestFam = fam;
    }
  }
  return best >= threshold ? bestFam : null;
}

// ─── Excel helpers (xlsx / SheetJS) ──────────────────────────────────────────
async function fileToAOA(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: false });
}

function aoaToBlob(aoa, sheetName = "Sheet1") {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildPreview(aoa) {
  if (!aoa.length) return { preview: [], suggested_header: 0, total_rows: 0 };
  const preview = aoa.slice(0, 15).map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
  const width = Math.max(0, ...preview.map((r) => r.length));
  const padded = preview.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill("")]);
  let suggested = 0;
  let best = -1;
  padded.forEach((r, i) => {
    const cnt = r.filter((c) => c).length;
    if (cnt > best) {
      best = cnt;
      suggested = i;
    }
  });
  return { preview: padded, suggested_header: suggested, total_rows: aoa.length };
}

// ─── Sorters ─────────────────────────────────────────────────────────────────
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const byCreatedDesc = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
const byDateDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));

// ─── Default categories (seeded once, but also ensured here) ─────────────────
const DEFAULT_CATEGORIES = [
  { name: "أرامل", key: "widows", icon: "HeartHandshake", order: 1 },
  { name: "حوامل", key: "pregnant", icon: "Baby", order: 2 },
  { name: "مرضعات", key: "nursing", icon: "Milk", order: 3 },
  { name: "أطفال", key: "children", icon: "ToyBrick", order: 4 },
  { name: "مرضى", key: "patients", icon: "Stethoscope", order: 5 },
  { name: "كبار السن", key: "elderly", icon: "Accessibility", order: 6 },
  { name: "إصابات", key: "injuries", icon: "Bandage", order: 7 },
];

async function ensureCategoriesSeeded() {
  const cats = await listRecords("categories");
  if (cats.length > 0) return cats;
  for (const c of DEFAULT_CATEGORIES) {
    await pushRecord("categories", { ...c, system: true, created_at: nowIso() });
  }
  return listRecords("categories");
}

// ─── Create a Firebase Auth user (admin action) via a secondary app ──────────
async function createAuthUser(email, password, name, role) {
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } = await import("firebase/auth");
  const secondary =
    getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  const secondaryAuth = getAuth(secondary);
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } catch (e) {
    let msg = "فشل إنشاء الحساب";
    if (e?.code === "auth/email-already-in-use") msg = "البريد الإلكتروني مستخدم بالفعل";
    else if (e?.code === "auth/invalid-email") msg = "صيغة البريد الإلكتروني غير صحيحة";
    else if (e?.code === "auth/weak-password") msg = "كلمة المرور ضعيفة (6 أحرف على الأقل)";
    throw httpError(msg);
  }
  const uid = cred.user.uid;
  if (name) await updateProfile(cred.user, { displayName: name });
  await signOut(secondaryAuth);
  const record = {
    id: uid,
    email: email.trim().toLowerCase(),
    name,
    role,
    created_at: nowIso(),
  };
  await set(ref(db, `users/${uid}`), record);
  // make sure the user is not on the deleted list (re-creation)
  await remove(ref(db, `deletedUsers/${uid}`));
  return record;
}

// ─── Stats ───────────────────────────────────────────────────────────────────
async function buildStats() {
  const [families, individual_members, records, aid_types] = await Promise.all([
    listRecords("families"),
    listRecords("individual_members"),
    listRecords("aid_records"),
    listRecords("aid_types"),
  ]);
  const byType = {};
  records.forEach((r) => {
    const name = r.aid_type_name || "غير محدد";
    byType[name] = (byType[name] || 0) + 1;
  });
  const recent = [...records].sort(byCreatedDesc).slice(0, 5);
  return {
    total_families: families.length,
    total_individual_members: individual_members.length,
    total_aid_records: records.length,
    total_aid_types: aid_types.length,
    aid_by_type: Object.entries(byType).map(([name, count]) => ({ name, count })),
    recent_records: recent,
  };
}

// ─── Excel export builders ───────────────────────────────────────────────────
async function exportFamiliesBlob() {
  const fields = (await listRecords("family_fields")).sort(byOrder);
  const families = await listRecords("families");
  const aoa = [fields.map((f) => f.label)];
  families.forEach((fam) => aoa.push(fields.map((f) => fam.data?.[f.key] ?? "")));
  return aoaToBlob(aoa, "Families");
}

async function familiesTemplateBlob() {
  const fields = (await listRecords("family_fields")).sort(byOrder);
  return aoaToBlob([fields.map((f) => f.label)], "Families");
}

async function exportAidRecordsBlob() {
  const fields = (await listRecords("family_fields")).sort(byOrder);
  const nameField = fields[0]?.key;
  const famMap = {};
  (await listRecords("families")).forEach((f) => (famMap[f.id] = f.data || {}));
  const records = await listRecords("aid_records");
  const aoa = [["العائلة", "نوع المساعدة", "التاريخ", "الكمية", "ملاحظات", "أُضيف بواسطة"]];
  records.forEach((r) => {
    const famData = famMap[r.family_id] || {};
    const famName = nameField ? famData[nameField] || r.family_id : r.family_id;
    aoa.push([famName, r.aid_type_name, r.date, r.quantity, r.notes, r.created_by]);
  });
  return aoaToBlob(aoa, "AidRecords");
}

async function exportCategoryRecordsBlob(categoryId) {
  const catFields = (await listRecords("category_fields"))
    .filter((f) => f.category_id === categoryId)
    .sort(byOrder);
  const famFields = (await listRecords("family_fields")).sort(byOrder);
  const nameField = famFields[0]?.key;
  const famMap = {};
  (await listRecords("families")).forEach((f) => (famMap[f.id] = f.data || {}));
  const records = (await listRecords("category_records")).filter((r) => r.category_id === categoryId);
  const aoa = [["الاسم (العائلة)", ...catFields.map((f) => f.label)]];
  records.forEach((r) => {
    const famData = famMap[r.family_id] || {};
    const famName = nameField ? famData[nameField] || "" : "";
    aoa.push([famName, ...catFields.map((f) => r.data?.[f.key] ?? "")]);
  });
  return aoaToBlob(aoa, "Records");
}

// ─── Excel import handlers ───────────────────────────────────────────────────
async function importFamilies(fd) {
  const fields = (await listRecords("family_fields")).sort(byOrder);
  if (!fields.length) throw httpError("الرجاء إضافة حقول العائلة أولاً قبل الاستيراد");
  const aoa = await fileToAOA(fd.get("file"));
  const headerRow = Number(fd.get("header_row") || 0);
  if (!aoa.length || headerRow >= aoa.length) return { imported: 0 };

  const fieldCol = {};
  const mapping = fd.get("mapping");
  if (mapping) {
    let mp = {};
    try { mp = JSON.parse(mapping); } catch (_) { mp = {}; }
    Object.entries(mp).forEach(([k, idx]) => {
      if (idx === "" || idx == null) return;
      const i = parseInt(idx, 10);
      if (!Number.isNaN(i)) fieldCol[k] = i;
    });
  } else {
    const header = (aoa[headerRow] || []).map((c) => (c == null ? "" : String(c).trim()));
    const labelToKey = {};
    fields.forEach((f) => (labelToKey[f.label] = f.key));
    header.forEach((col, idx) => {
      if (labelToKey[col]) fieldCol[labelToKey[col]] = idx;
    });
  }
  if (!Object.keys(fieldCol).length) throw httpError("لم يتم ربط أي عمود بالحقول");

  let imported = 0;
  for (const row of aoa.slice(headerRow + 1)) {
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const data = {};
    Object.entries(fieldCol).forEach(([k, i]) => {
      const v = i < row.length ? row[i] : "";
      data[k] = v == null ? "" : String(v).trim();
    });
    if (Object.values(data).some((v) => String(v).trim())) {
      await pushRecord("families", {
        data,
        created_at: nowIso(),
        updated_at: nowIso(),
        created_by: userName(),
      });
      imported += 1;
    }
  }
  return { imported };
}

async function importAidRecords(fd) {
  const aidTypeId = fd.get("aid_type_id");
  const aidType = await getRecord("aid_types", aidTypeId);
  if (!aidType) throw httpError("نوع المساعدة غير موجود");
  const matchFieldKey = fd.get("match_field_key");
  const matchColumn = Number(fd.get("match_column"));
  const date = fd.get("date");
  const notes = fd.get("notes") || "";
  const fuzzy = String(fd.get("fuzzy")) !== "false";
  const headerRow = Number(fd.get("header_row") || 0);

  const families = await listRecords("families");
  const exact = {};
  families.forEach((fam) => {
    const val = String(fam.data?.[matchFieldKey] || "").trim();
    if (val) {
      const n = normalizeArabic(val);
      if (n && !(n in exact)) exact[n] = fam.id;
    }
  });

  const aoa = await fileToAOA(fd.get("file"));
  let created = 0;
  let fuzzyMatched = 0;
  const unmatched = [];

  for (const row of aoa.slice(headerRow + 1)) {
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    let ident = matchColumn < row.length ? row[matchColumn] : "";
    ident = ident == null ? "" : String(ident).trim();
    if (!ident) continue;
    let famId = exact[normalizeArabic(ident)];
    if (!famId && fuzzy) {
      const best = findBestFamily(families, matchFieldKey, ident, 0.6);
      if (best) { famId = best.id; fuzzyMatched += 1; }
    }
    if (!famId) { unmatched.push(ident); continue; }
    await pushRecord("aid_records", {
      family_id: famId,
      aid_type_id: aidTypeId,
      aid_type_name: aidType.name,
      date,
      quantity: "",
      notes,
      created_by: userName(),
      created_at: nowIso(),
    });
    created += 1;
  }
  return { created, fuzzy_matched: fuzzyMatched, unmatched_count: unmatched.length, unmatched: unmatched.slice(0, 50) };
}

async function importCategoryRecords(fd) {
  const categoryId = fd.get("category_id");
  const matchFieldKey = fd.get("match_field_key");
  const matchColumn = Number(fd.get("match_column"));
  const fuzzy = String(fd.get("fuzzy")) !== "false";
  const headerRow = Number(fd.get("header_row") || 0);

  const families = await listRecords("families");
  const exact = {};
  families.forEach((fam) => {
    const val = String(fam.data?.[matchFieldKey] || "").trim();
    if (val) {
      const n = normalizeArabic(val);
      if (n && !(n in exact)) exact[n] = fam.id;
    }
  });

  const fieldCol = {};
  const mapping = fd.get("mapping");
  if (mapping) {
    let mp = {};
    try { mp = JSON.parse(mapping); } catch (_) { mp = {}; }
    Object.entries(mp).forEach(([k, idx]) => {
      if (idx === "" || idx == null) return;
      const i = parseInt(idx, 10);
      if (!Number.isNaN(i)) fieldCol[k] = i;
    });
  }

  const aoa = await fileToAOA(fd.get("file"));
  let created = 0;
  let fuzzyMatched = 0;
  const unmatched = [];

  for (const row of aoa.slice(headerRow + 1)) {
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    let ident = matchColumn < row.length ? row[matchColumn] : "";
    ident = ident == null ? "" : String(ident).trim();
    if (!ident) continue;
    let famId = exact[normalizeArabic(ident)];
    if (!famId && fuzzy) {
      const best = findBestFamily(families, matchFieldKey, ident, 0.6);
      if (best) { famId = best.id; fuzzyMatched += 1; }
    }
    if (!famId) { unmatched.push(ident); continue; }
    const data = {};
    Object.entries(fieldCol).forEach(([k, i]) => {
      const v = i < row.length ? row[i] : "";
      data[k] = v == null ? "" : String(v).trim();
    });
    await pushRecord("category_records", {
      category_id: categoryId,
      family_id: famId,
      data,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: userName(),
    });
    created += 1;
  }
  return { created, fuzzy_matched: fuzzyMatched, unmatched_count: unmatched.length, unmatched: unmatched.slice(0, 50) };
}

// ─── URL helpers ─────────────────────────────────────────────────────────────
function parseUrl(url) {
  const [path, queryStr] = url.split("?");
  const q = new URLSearchParams(queryStr || "");
  return { path, q };
}

// ─── GET router ──────────────────────────────────────────────────────────────
async function handleGet(url) {
  const { path, q } = parseUrl(url);

  if (path === "/stats") return buildStats();

  if (path === "/family-fields") return (await listRecords("family_fields")).sort(byOrder);
  if (path === "/families/export") return exportFamiliesBlob();
  if (path === "/families/template") return familiesTemplateBlob();
  if (path === "/families") return (await listRecords("families")).sort(byCreatedDesc);

  if (path === "/aid-records/export") return exportAidRecordsBlob();
  if (path === "/aid-records") {
    let records = await listRecords("aid_records");
    const fid = q.get("family_id");
    if (fid) records = records.filter((r) => r.family_id === fid);
    return records.sort(byDateDesc);
  }

  if (path === "/aid-types") return listRecords("aid_types");

  if (path === "/individual-members/count") {
    const fid = q.get("family_id");
    const members = await listRecords("individual_members");
    return { count: members.filter((m) => m.family_id === fid).length };
  }
  if (path === "/individual-members") {
    let members = await listRecords("individual_members");
    const fid = q.get("family_id");
    if (fid) members = members.filter((m) => m.family_id === fid);
    return members.sort(byCreatedDesc);
  }

  if (path === "/categories") {
    const cats = await ensureCategoriesSeeded();
    const records = await listRecords("category_records");
    const counts = {};
    records.forEach((r) => (counts[r.category_id] = (counts[r.category_id] || 0) + 1));
    return cats.map((c) => ({ ...c, count: counts[c.id] || 0 })).sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  if (path === "/category-fields") {
    const cid = q.get("category_id");
    return (await listRecords("category_fields")).filter((f) => f.category_id === cid).sort(byOrder);
  }
  if (path === "/category-records/export") return exportCategoryRecordsBlob(q.get("category_id"));
  if (path === "/category-records") {
    const cid = q.get("category_id");
    return (await listRecords("category_records")).filter((r) => r.category_id === cid).sort(byCreatedDesc);
  }

  if (path === "/users") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    return (await listRecords("users")).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      created_at: u.created_at,
    }));
  }

  throw httpError("غير موجود", 404);
}

// ─── POST router ─────────────────────────────────────────────────────────────
async function handlePost(url, body) {
  const { path } = parseUrl(url);
  const isFD = typeof FormData !== "undefined" && body instanceof FormData;

  if (path === "/families/import/columns") return buildPreview(await fileToAOA(body.get("file")));
  if (path === "/families/import") return importFamilies(body);
  if (path === "/aid-records/import") return importAidRecords(body);
  if (path === "/category-records/import") return importCategoryRecords(body);

  if (isFD) throw httpError("طلب غير مدعوم", 400);

  if (path === "/families")
    return pushRecord("families", {
      data: body.data,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: userName(),
    });

  if (path === "/family-fields") {
    const key = body.key || `f_${Date.now()}`;
    return pushRecord("family_fields", {
      label: body.label,
      key,
      type: body.type || "text",
      order: body.order || 0,
      created_at: nowIso(),
    });
  }

  if (path === "/aid-types")
    return pushRecord("aid_types", {
      name: body.name,
      description: body.description || "",
      created_at: nowIso(),
    });

  if (path === "/aid-records") {
    const aidType = await getRecord("aid_types", body.aid_type_id);
    return pushRecord("aid_records", {
      family_id: body.family_id,
      aid_type_id: body.aid_type_id,
      aid_type_name: aidType?.name || "",
      date: body.date,
      quantity: body.quantity || "",
      notes: body.notes || "",
      created_by: userName(),
      created_at: nowIso(),
    });
  }

  if (path === "/individual-members")
    return pushRecord("individual_members", {
      family_id: body.family_id,
      name: body.name,
      id_number: body.id_number,
      birth_date: body.birth_date,
      relation: body.relation,
      gender: body.gender,
      notes: body.notes || "",
      created_at: nowIso(),
      created_by: userName(),
    });

  if (path === "/categories") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    const existing = await listRecords("categories");
    const order = Math.max(0, ...existing.map((c) => c.order || 0)) + 1;
    return pushRecord("categories", {
      name: body.name,
      key: `cat_${Date.now()}`,
      icon: body.icon || "Layers",
      order,
      system: false,
      created_at: nowIso(),
    });
  }

  if (path === "/category-fields") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    return pushRecord("category_fields", {
      category_id: body.category_id,
      label: body.label,
      key: body.key || `cf_${Date.now()}`,
      type: body.type || "text",
      order: body.order || 0,
      created_at: nowIso(),
    });
  }

  if (path === "/category-records")
    return pushRecord("category_records", {
      category_id: body.category_id,
      family_id: body.family_id || "",
      data: body.data || {},
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: userName(),
    });

  if (path === "/users") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    if (!["admin", "staff"].includes(body.role)) throw httpError("صلاحية غير صالحة");
    const existing = (await listRecords("users")).find(
      (u) => (u.email || "").toLowerCase() === body.email.trim().toLowerCase()
    );
    if (existing) throw httpError("البريد الإلكتروني مستخدم بالفعل");
    const rec = await createAuthUser(body.email, body.password, body.name, body.role);
    return { id: rec.id, email: rec.email, name: rec.name, role: rec.role };
  }

  throw httpError("غير موجود", 404);
}

// ─── PUT router ──────────────────────────────────────────────────────────────
async function handlePut(url, body) {
  const { path } = parseUrl(url);

  let m;
  if ((m = path.match(/^\/families\/([^/]+)$/))) {
    if (!(await getRecord("families", m[1]))) throw httpError("العائلة غير موجودة", 404);
    return patchRecord("families", m[1], { data: body.data, updated_at: nowIso() });
  }
  if ((m = path.match(/^\/individual-members\/([^/]+)$/))) {
    if (!(await getRecord("individual_members", m[1]))) throw httpError("الفرد غير موجود", 404);
    return patchRecord("individual_members", m[1], {
      family_id: body.family_id,
      name: body.name,
      id_number: body.id_number,
      birth_date: body.birth_date,
      relation: body.relation,
      gender: body.gender,
      notes: body.notes || "",
      updated_at: nowIso(),
    });
  }
  if ((m = path.match(/^\/category-records\/([^/]+)$/))) {
    if (!(await getRecord("category_records", m[1]))) throw httpError("السجل غير موجود", 404);
    return patchRecord("category_records", m[1], {
      family_id: body.family_id || "",
      data: body.data || {},
      updated_at: nowIso(),
    });
  }
  if ((m = path.match(/^\/users\/([^/]+)\/role$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    if (!["admin", "staff"].includes(body.role)) throw httpError("صلاحية غير صالحة");
    if (m[1] === currentUser?.id) throw httpError("لا يمكنك تغيير صلاحية حسابك الخاص");
    const target = await getRecord("users", m[1]);
    if (!target) throw httpError("المستخدم غير موجود", 404);
    const updated = await patchRecord("users", m[1], { role: body.role });
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role };
  }

  throw httpError("غير موجود", 404);
}

// ─── DELETE router ───────────────────────────────────────────────────────────
async function handleDelete(url) {
  const { path, q } = parseUrl(url);

  if (path === "/families/all") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    const count = (await listRecords("families")).length;
    await deleteCollection("families");
    await deleteCollection("aid_records");
    return { ok: true, deleted: count };
  }
  if (path === "/aid-records/all") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    const count = (await listRecords("aid_records")).length;
    await deleteCollection("aid_records");
    return { ok: true, deleted: count };
  }
  if (path === "/individual-members/all") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    const count = (await listRecords("individual_members")).length;
    await deleteCollection("individual_members");
    return { ok: true, deleted: count };
  }
  if (path === "/category-records/all") {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    const cid = q.get("category_id");
    const records = (await listRecords("category_records")).filter((r) => r.category_id === cid);
    for (const r of records) await deleteRecord("category_records", r.id);
    return { ok: true, deleted: records.length };
  }

  let m;
  if ((m = path.match(/^\/families\/([^/]+)$/))) {
    await deleteRecord("families", m[1]);
    for (const r of (await listRecords("aid_records")).filter((x) => x.family_id === m[1])) {
      await deleteRecord("aid_records", r.id);
    }
    return { ok: true };
  }
  if ((m = path.match(/^\/aid-records\/([^/]+)$/))) {
    await deleteRecord("aid_records", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/aid-types\/([^/]+)$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    await deleteRecord("aid_types", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/individual-members\/([^/]+)$/))) {
    await deleteRecord("individual_members", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/family-fields\/([^/]+)$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    await deleteRecord("family_fields", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/categories\/([^/]+)$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    await deleteRecord("categories", m[1]);
    for (const f of (await listRecords("category_fields")).filter((x) => x.category_id === m[1]))
      await deleteRecord("category_fields", f.id);
    for (const r of (await listRecords("category_records")).filter((x) => x.category_id === m[1]))
      await deleteRecord("category_records", r.id);
    return { ok: true };
  }
  if ((m = path.match(/^\/category-fields\/([^/]+)$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    await deleteRecord("category_fields", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/category-records\/([^/]+)$/))) {
    await deleteRecord("category_records", m[1]);
    return { ok: true };
  }
  if ((m = path.match(/^\/users\/([^/]+)$/))) {
    if (!isAdmin()) throw httpError("هذه العملية متاحة للمدير فقط", 403);
    if (m[1] === currentUser?.id) throw httpError("لا يمكنك حذف حسابك الخاص");
    await deleteRecord("users", m[1]);
    await set(ref(db, `deletedUsers/${m[1]}`), true);
    return { ok: true };
  }

  throw httpError("غير موجود", 404);
}

// ─── Public axios-like client ────────────────────────────────────────────────
const api = {
  async get(url) {
    return { data: await handleGet(url) };
  },
  async post(url, body) {
    return { data: await handlePost(url, body) };
  },
  async put(url, body) {
    return { data: await handlePut(url, body) };
  },
  async delete(url) {
    return { data: await handleDelete(url) };
  },
};

export default api;
