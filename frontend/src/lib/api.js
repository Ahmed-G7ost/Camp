// ─────────────────────────────────────────────────────────────────────────────
// Frontend-only API layer backed by Firebase Realtime Database + Firebase Auth.
// Replaces the old FastAPI backend entirely (same routes, same responses),
// so all pages keep working without any change.
// ─────────────────────────────────────────────────────────────────────────────
import appFb, { auth, db, signInWithEmailAndPassword } from "./firebase";
import {
  ref as dbRef,
  get as dbGet,
  push as dbPushRef,
  set as dbSet,
  update as dbUpdate,
  remove as dbRemove,
} from "firebase/database";
import * as XLSX from "xlsx";

const nowIso = () => new Date().toISOString();

function httpError(status, detail) {
  const err = new Error(typeof detail === "string" ? detail : "حدث خطأ ما");
  err.response = { status, data: { detail } };
  return err;
}

// ── Realtime Database helpers ────────────────────────────────────────────────
async function listRecords(coll) {
  const snap = await dbGet(dbRef(db, coll));
  const val = snap.val() || {};
  return Object.entries(val).map(([id, v]) => ({ id, ...(v && typeof v === "object" ? v : {}) }));
}

async function getRecord(coll, id) {
  const snap = await dbGet(dbRef(db, `${coll}/${id}`));
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}

async function pushRecord(coll, data) {
  const r = dbPushRef(dbRef(db, coll));
  await dbSet(r, data);
  return { id: r.key, ...data };
}

async function updateRecord(coll, id, data) {
  await dbUpdate(dbRef(db, `${coll}/${id}`), data);
}

async function deleteRecord(coll, id) {
  await dbRemove(dbRef(db, `${coll}/${id}`));
}

async function deleteCollection(coll) {
  await dbRemove(dbRef(db, coll));
}

// ── Session (kept compatible with old token-based flow) ─────────────────────
function currentUser() {
  const token = localStorage.getItem("camp_token");
  const raw = localStorage.getItem("camp_user");
  if (!token || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireAuth() {
  const u = currentUser();
  if (!u) throw httpError(401, "غير مصرح. الرجاء تسجيل الدخول");
  return u;
}

function requireAdmin() {
  const u = requireAuth();
  if (u.role !== "admin") throw httpError(403, "هذه العملية تتطلب صلاحية المدير");
  return u;
}

async function findUserByEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  const users = await listRecords("users");
  return users.find((u) => String(u.email || "").toLowerCase() === e) || null;
}

async function ensureUser(email, displayName) {
  let user = await findUserByEmail(email);
  if (!user) {
    user = await pushRecord("users", {
      email: String(email).trim().toLowerCase(),
      password_hash: "",
      name: displayName || String(email).split("@")[0],
      role: "admin",
      created_at: nowIso(),
    });
  }
  return user;
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name || null, role: u.role || "staff" };
}

async function doLogin(email, password) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw httpError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }
  const user = await ensureUser(cred.user.email, cred.user.displayName);
  const pub = publicUser(user);
  localStorage.setItem("camp_user", JSON.stringify(pub));
  return { token: `fb-${cred.user.uid}`, user: pub };
}

async function doFirebaseLogin() {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email) throw httpError(401, "رمز Firebase غير صالح");
  const user = await ensureUser(fbUser.email, fbUser.displayName);
  const pub = publicUser(user);
  localStorage.setItem("camp_user", JSON.stringify(pub));
  return { token: `fb-${fbUser.uid}`, user: pub };
}

async function createUserAccount(body) {
  requireAdmin();
  if (!["admin", "staff"].includes(body.role)) throw httpError(400, "صلاحية غير صالحة");
  if (await findUserByEmail(body.email)) throw httpError(400, "البريد الإلكتروني مستخدم بالفعل");

  // Create the Firebase Auth account on a secondary app so the admin stays logged in
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, createUserWithEmailAndPassword, signOut } = await import("firebase/auth");
    const secondaryApp =
      getApps().find((a) => a.name === "secondary") || initializeApp(appFb.options, "secondary");
    const secondaryAuth = getAuth(secondaryApp);
    await createUserWithEmailAndPassword(secondaryAuth, body.email.trim().toLowerCase(), body.password);
    await signOut(secondaryAuth);
  } catch (e) {
    const code = e?.code || "";
    if (code.includes("weak-password")) throw httpError(400, "كلمة المرور ضعيفة (6 أحرف على الأقل)");
    if (code.includes("invalid-email")) throw httpError(400, "البريد الإلكتروني غير صالح");
    if (!code.includes("email-already-in-use")) throw httpError(400, e?.message || "تعذّر إنشاء الحساب");
    // email exists in Firebase Auth but not in DB → just create the DB record
  }

  const rec = await pushRecord("users", {
    email: body.email.trim().toLowerCase(),
    password_hash: "",
    name: body.name,
    role: body.role,
    created_at: nowIso(),
  });
  return { id: rec.id, email: rec.email, name: rec.name, role: rec.role };
}

// ── Arabic fuzzy-matching helpers (ported from old backend) ──────────────────
function normalizeArabic(text) {
  if (!text) return "";
  let t = String(text).trim();
  t = t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  t = t.replace(/[أإآٱ]/g, "ا");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/\s+/g, " ").trim();
  // توحيد الأسماء المركبة: "عبد الله" = "عبدالله"، "ابو احمد" = "ابواحمد"
  t = t.replace(/(^| )عبد /g, "$1عبد").replace(/(^| )ابو /g, "$1ابو");
  // إزالة "ال" التعريف من بداية الكلمات (الديب = ديب) مع استثناء لفظ الجلالة
  t = t
    .split(" ")
    .map((w) => (w !== "الله" && w.startsWith("ال") && w.length > 3 ? w.slice(2) : w))
    .join(" ");
  return t;
}

function matchScore(valA, valB) {
  const a = normalizeArabic(valA);
  const b = normalizeArabic(valB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;

  const aw = a.split(" ");
  const bw = b.split(" ");
  const wa = new Set(aw);
  const wb = new Set(bw);
  let common = 0;
  wa.forEach((w) => wb.has(w) && common++);
  if (common === 0) return 0;

  const minLen = Math.min(wa.size, wb.size);
  const maxLen = Math.max(wa.size, wb.size);
  const coverage = common / minLen; // كم من الاسم الأقصر موجود في الأطول
  const precision = common / maxLen;

  // الاسم الأقصر (ثنائي/ثلاثي) موجود بالكامل داخل الأطول (رباعي/خماسي) → مطابقة قوية
  if (coverage === 1) {
    let score = 0.8 + 0.2 * precision;
    // إذا الكلمات بنفس الترتيب من البداية (محمد احمد ⊂ محمد احمد علي العف) → أقوى
    const [shortArr, longArr] = aw.length <= bw.length ? [aw, bw] : [bw, aw];
    if (shortArr.every((w, i) => longArr[i] === w)) score = Math.min(1, score + 0.05);
    return score;
  }

  // تطابق جزئي: نعتمد على نسبة التغطية أكثر من طول الاسم
  return coverage * 0.75 + precision * 0.25;
}

function findBestFamily(families, fieldKey, query, threshold = 0.6) {
  let bestScore = 0;
  let bestFam = null;
  for (const fam of families) {
    const famVal = String(fam.data?.[fieldKey] ?? "").trim();
    if (!famVal) continue;
    const score = matchScore(query, famVal);
    if (score > bestScore) {
      bestScore = score;
      bestFam = fam;
    }
  }
  return bestScore >= threshold ? [bestFam, bestScore] : [null, bestScore];
}

// ── Excel helpers (client-side, replaces openpyxl) ───────────────────────────
function cellStr(c) {
  if (c == null) return "";
  if (c instanceof Date) {
    const y = c.getFullYear();
    const m = String(c.getMonth() + 1).padStart(2, "0");
    const d = String(c.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(c).trim();
}

async function readSheetRows(file) {
  if (!file) throw httpError(400, "ملف غير صالح. الرجاء رفع ملف Excel (.xlsx)");
  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { cellDates: true });
  } catch {
    throw httpError(400, "ملف غير صالح. الرجاء رفع ملف Excel (.xlsx)");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

function makeXlsxBlob(rows, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const rowIsEmpty = (row) => !row || row.every((c) => c == null || String(c).trim() === "");

// ── Default categories (seeded like the old backend) ────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "أرامل", key: "widows", icon: "HeartHandshake", order: 1 },
  { name: "حوامل", key: "pregnant", icon: "Baby", order: 2 },
  { name: "مرضعات", key: "nursing", icon: "Milk", order: 3 },
  { name: "أطفال", key: "children", icon: "ToyBrick", order: 4 },
  { name: "مرضى", key: "patients", icon: "Stethoscope", order: 5 },
  { name: "كبار السن", key: "elderly", icon: "Accessibility", order: 6 },
  { name: "إصابات", key: "injuries", icon: "Bandage", order: 7 },
];

async function seedCategories() {
  const existing = await listRecords("categories");
  const keys = new Set(existing.map((c) => c.key));
  for (const c of DEFAULT_CATEGORIES) {
    if (!keys.has(c.key)) await pushRecord("categories", { ...c, system: true, created_at: nowIso() });
  }
}

// ── Sorted field/family getters ──────────────────────────────────────────────
const sortedFields = async (coll = "family_fields") =>
  (await listRecords(coll)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// ── Import implementations ───────────────────────────────────────────────────
async function importColumns(fd) {
  requireAuth();
  const allRows = await readSheetRows(fd.get("file"));
  if (!allRows.length) return { preview: [], suggested_header: 0, total_rows: 0 };
  let preview = allRows.slice(0, 15).map((r) => r.map(cellStr));
  const width = Math.max(0, ...preview.map((r) => r.length));
  preview = preview.map((r) => [...r, ...Array(width - r.length).fill("")]);
  let suggested = 0;
  let best = -1;
  preview.forEach((r, i) => {
    const cnt = r.filter((c) => c).length;
    if (cnt > best) {
      best = cnt;
      suggested = i;
    }
  });
  return { preview, suggested_header: suggested, total_rows: allRows.length };
}

async function importFamilies(fd, user) {
  const fields = await sortedFields();
  if (!fields.length) throw httpError(400, "الرجاء إضافة حقول العائلة أولاً قبل الاستيراد");
  const headerRow = parseInt(fd.get("header_row") || "0", 10);
  const allRows = await readSheetRows(fd.get("file"));
  if (!allRows.length || headerRow >= allRows.length) return { imported: 0 };

  const header = (allRows[headerRow] || []).map(cellStr);
  const fieldCol = {};
  const mappingRaw = fd.get("mapping");
  if (mappingRaw) {
    let mp = {};
    try {
      mp = JSON.parse(mappingRaw);
    } catch {}
    for (const [fkey, colIdx] of Object.entries(mp)) {
      if (colIdx === null || colIdx === "") continue;
      const idx = parseInt(colIdx, 10);
      if (!Number.isNaN(idx)) fieldCol[fkey] = idx;
    }
  } else {
    const labelToKey = Object.fromEntries(fields.map((f) => [f.label, f.key]));
    header.forEach((col, idx) => {
      if (col in labelToKey) fieldCol[labelToKey[col]] = idx;
    });
  }
  if (!Object.keys(fieldCol).length)
    throw httpError(400, "لم يتم ربط أي عمود بالحقول. الرجاء تحديد الأعمدة المطلوبة");

  let imported = 0;
  for (const row of allRows.slice(headerRow + 1)) {
    if (rowIsEmpty(row)) continue;
    const data = {};
    for (const [fkey, idx] of Object.entries(fieldCol)) data[fkey] = cellStr(row[idx]);
    if (Object.values(data).some((v) => String(v).trim())) {
      await pushRecord("families", {
        data,
        created_at: nowIso(),
        updated_at: nowIso(),
        created_by: user.name || null,
      });
      imported++;
    }
  }
  return { imported };
}

async function importAidRecords(fd, user) {
  const aidTypeId = fd.get("aid_type_id");
  const aidType = await getRecord("aid_types", aidTypeId);
  if (!aidType) throw httpError(400, "نوع المساعدة غير موجود");

  const headerRow = parseInt(fd.get("header_row") || "0", 10);
  const matchColumn = parseInt(fd.get("match_column"), 10);
  const matchFieldKey = fd.get("match_field_key");
  const date = fd.get("date");
  const notes = fd.get("notes") || "";
  const fuzzy = (fd.get("fuzzy") ?? "true") !== "false";
  const threshold = parseFloat(fd.get("threshold") || "0.6");

  const families = await listRecords("families");
  const exactIndex = {};
  for (const fam of families) {
    const val = String(fam.data?.[matchFieldKey] ?? "").trim();
    if (val) {
      const norm = normalizeArabic(val);
      if (norm && !(norm in exactIndex)) exactIndex[norm] = fam.id;
    }
  }

  const allRows = await readSheetRows(fd.get("file"));
  let created = 0;
  let fuzzyMatched = 0;
  const unmatched = [];

  for (const row of allRows.slice(headerRow + 1)) {
    if (rowIsEmpty(row)) continue;
    const ident = cellStr(row[matchColumn]);
    if (!ident) continue;

    let famId = exactIndex[normalizeArabic(ident)];
    if (!famId && fuzzy) {
      const [bestFam] = findBestFamily(families, matchFieldKey, ident, threshold);
      if (bestFam) {
        famId = bestFam.id;
        fuzzyMatched++;
      }
    }
    if (!famId) {
      unmatched.push(ident);
      continue;
    }
    await pushRecord("aid_records", {
      family_id: famId,
      aid_type_id: aidTypeId,
      aid_type_name: aidType.name || "",
      date,
      quantity: "",
      notes,
      created_by: user.name || null,
      created_at: nowIso(),
    });
    created++;
  }
  return {
    created,
    fuzzy_matched: fuzzyMatched,
    unmatched_count: unmatched.length,
    unmatched: unmatched.slice(0, 50),
  };
}

async function importCategoryRecords(fd, user) {
  const categoryId = fd.get("category_id");
  const headerRow = parseInt(fd.get("header_row") || "0", 10);
  const matchColumn = parseInt(fd.get("match_column"), 10);
  const matchFieldKey = fd.get("match_field_key");
  const fuzzy = (fd.get("fuzzy") ?? "true") !== "false";
  const threshold = parseFloat(fd.get("threshold") || "0.6");

  const families = await listRecords("families");
  const exactIndex = {};
  for (const fam of families) {
    const val = String(fam.data?.[matchFieldKey] ?? "").trim();
    if (val) {
      const norm = normalizeArabic(val);
      if (norm && !(norm in exactIndex)) exactIndex[norm] = fam.id;
    }
  }

  const fieldCol = {};
  const mappingRaw = fd.get("mapping");
  if (mappingRaw) {
    let mp = {};
    try {
      mp = JSON.parse(mappingRaw);
    } catch {}
    for (const [fkey, colIdx] of Object.entries(mp)) {
      if (colIdx === null || colIdx === "") continue;
      const idx = parseInt(colIdx, 10);
      if (!Number.isNaN(idx)) fieldCol[fkey] = idx;
    }
  }

  const allRows = await readSheetRows(fd.get("file"));
  let created = 0;
  let fuzzyMatched = 0;
  const unmatched = [];

  for (const row of allRows.slice(headerRow + 1)) {
    if (rowIsEmpty(row)) continue;
    const ident = cellStr(row[matchColumn]);
    if (!ident) continue;

    let famId = exactIndex[normalizeArabic(ident)];
    if (!famId && fuzzy) {
      const [bestFam] = findBestFamily(families, matchFieldKey, ident, threshold);
      if (bestFam) {
        famId = bestFam.id;
        fuzzyMatched++;
      }
    }
    if (!famId) {
      unmatched.push(ident);
      continue;
    }

    const data = {};
    for (const [fkey, idx] of Object.entries(fieldCol)) data[fkey] = cellStr(row[idx]);

    await pushRecord("category_records", {
      category_id: categoryId,
      family_id: famId,
      data,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: user.name || null,
    });
    created++;
  }
  return {
    created,
    fuzzy_matched: fuzzyMatched,
    unmatched_count: unmatched.length,
    unmatched: unmatched.slice(0, 50),
  };
}

// ── Export implementations ───────────────────────────────────────────────────
async function exportFamilies() {
  requireAuth();
  const fields = await sortedFields();
  const families = await listRecords("families");
  const rows = [fields.map((f) => f.label)];
  for (const fam of families) rows.push(fields.map((f) => fam.data?.[f.key] ?? ""));
  return makeXlsxBlob(rows, "Families");
}

async function exportFamiliesTemplate() {
  requireAuth();
  const fields = await sortedFields();
  return makeXlsxBlob([fields.map((f) => f.label)], "Families");
}

async function exportAidRecords() {
  requireAuth();
  const fields = await sortedFields();
  const nameField = fields.length ? fields[0].key : null;
  const families = {};
  (await listRecords("families")).forEach((f) => (families[f.id] = f.data || {}));
  const records = await listRecords("aid_records");
  const rows = [["العائلة", "نوع المساعدة", "التاريخ", "الكمية", "ملاحظات", "أُضيف بواسطة"]];
  for (const r of records) {
    const famData = families[r.family_id] || {};
    const famName = nameField ? famData[nameField] ?? r.family_id : r.family_id;
    rows.push([famName ?? "", r.aid_type_name ?? "", r.date ?? "", r.quantity ?? "", r.notes ?? "", r.created_by ?? ""]);
  }
  return makeXlsxBlob(rows, "AidRecords");
}

async function exportCategoryRecords(categoryId) {
  requireAuth();
  const catFields = (await listRecords("category_fields"))
    .filter((f) => f.category_id === categoryId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const famFields = await sortedFields();
  const nameField = famFields.length ? famFields[0].key : null;
  const families = {};
  (await listRecords("families")).forEach((f) => (families[f.id] = f.data || {}));
  const records = (await listRecords("category_records")).filter((r) => r.category_id === categoryId);
  const rows = [["الاسم (العائلة)", ...catFields.map((f) => f.label)]];
  for (const r of records) {
    const famData = families[r.family_id] || {};
    const famName = nameField ? famData[nameField] ?? "" : "";
    rows.push([famName, ...catFields.map((f) => r.data?.[f.key] ?? "")]);
  }
  return makeXlsxBlob(rows, "Records");
}

// ── Router ───────────────────────────────────────────────────────────────────
function parseUrl(url) {
  const [rawPath, q] = url.split("?");
  const path = rawPath.replace(/\/+$/, "") || "/";
  const params = Object.fromEntries(new URLSearchParams(q || ""));
  return { path, params };
}

async function handle(method, path, params, body) {
  const seg = path.split("/").filter(Boolean); // e.g. ["families", "abc"]

  // ── Auth ──
  if (method === "POST" && path === "/auth/login") return doLogin(body.email, body.password);
  if (method === "POST" && path === "/auth/firebase-login") return doFirebaseLogin();
  if (method === "GET" && path === "/auth/me") return requireAuth();

  // ── Users ──
  if (path === "/users" && method === "GET") {
    requireAdmin();
    const users = await listRecords("users");
    return users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at }));
  }
  if (path === "/users" && method === "POST") return createUserAccount(body);
  if (seg[0] === "users" && seg.length === 2 && method === "DELETE") {
    const admin = requireAdmin();
    if (seg[1] === admin.id) throw httpError(400, "لا يمكنك حذف حسابك الخاص");
    await deleteRecord("users", seg[1]);
    return { ok: true };
  }
  if (seg[0] === "users" && seg[2] === "role" && method === "PUT") {
    const admin = requireAdmin();
    if (!["admin", "staff"].includes(body.role)) throw httpError(400, "صلاحية غير صالحة");
    if (seg[1] === admin.id) throw httpError(400, "لا يمكنك تغيير صلاحية حسابك الخاص");
    const target = await getRecord("users", seg[1]);
    if (!target) throw httpError(404, "المستخدم غير موجود");
    await updateRecord("users", seg[1], { role: body.role });
    const updated = await getRecord("users", seg[1]);
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role };
  }

  // ── Family fields ──
  if (path === "/family-fields" && method === "GET") {
    requireAuth();
    return sortedFields();
  }
  if (path === "/family-fields" && method === "POST") {
    requireAdmin();
    const key = body.key || `f_${Date.now()}`;
    return pushRecord("family_fields", {
      label: body.label,
      key,
      type: body.type || "text",
      order: body.order ?? 0,
      created_at: nowIso(),
    });
  }
  if (seg[0] === "family-fields" && seg.length === 2 && method === "DELETE") {
    requireAdmin();
    await deleteRecord("family_fields", seg[1]);
    return { ok: true };
  }

  // ── Families ──
  if (path === "/families" && method === "GET") {
    requireAuth();
    const fams = await listRecords("families");
    return fams.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  if (path === "/families" && method === "POST") {
    const user = requireAuth();
    return pushRecord("families", {
      data: body.data,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: user.name || null,
    });
  }
  if (path === "/families/export" && method === "GET") return exportFamilies();
  if (path === "/families/template" && method === "GET") return exportFamiliesTemplate();
  if (path === "/families/import/columns" && method === "POST") return importColumns(body);
  if (path === "/families/import" && method === "POST") return importFamilies(body, requireAuth());
  if (path === "/families/all" && method === "DELETE") {
    requireAdmin();
    const count = (await listRecords("families")).length;
    await deleteCollection("families");
    await deleteCollection("aid_records");
    return { ok: true, deleted: count };
  }
  if (seg[0] === "families" && seg.length === 2 && method === "PUT") {
    requireAuth();
    if (!(await getRecord("families", seg[1]))) throw httpError(404, "العائلة غير موجودة");
    await updateRecord("families", seg[1], { data: body.data, updated_at: nowIso() });
    return getRecord("families", seg[1]);
  }
  if (seg[0] === "families" && seg.length === 2 && method === "DELETE") {
    requireAuth();
    await deleteRecord("families", seg[1]);
    const records = await listRecords("aid_records");
    for (const r of records) if (r.family_id === seg[1]) await deleteRecord("aid_records", r.id);
    return { ok: true };
  }

  // ── Aid types ──
  if (path === "/aid-types" && method === "GET") {
    requireAuth();
    return listRecords("aid_types");
  }
  if (path === "/aid-types" && method === "POST") {
    requireAdmin();
    return pushRecord("aid_types", {
      name: body.name,
      description: body.description || "",
      created_at: nowIso(),
    });
  }
  if (seg[0] === "aid-types" && seg.length === 2 && method === "DELETE") {
    requireAdmin();
    await deleteRecord("aid_types", seg[1]);
    return { ok: true };
  }

  // ── Aid records ──
  if (path === "/aid-records" && method === "GET") {
    requireAuth();
    let records = await listRecords("aid_records");
    if (params.family_id) records = records.filter((r) => r.family_id === params.family_id);
    return records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
  if (path === "/aid-records" && method === "POST") {
    const user = requireAuth();
    const aidType = await getRecord("aid_types", body.aid_type_id);
    return pushRecord("aid_records", {
      family_id: body.family_id,
      aid_type_id: body.aid_type_id,
      aid_type_name: aidType ? aidType.name : "",
      date: body.date,
      quantity: body.quantity || "",
      notes: body.notes || "",
      created_by: user.name || null,
      created_at: nowIso(),
    });
  }
  if (path === "/aid-records/export" && method === "GET") return exportAidRecords();
  if (path === "/aid-records/import" && method === "POST") return importAidRecords(body, requireAuth());
  if (path === "/aid-records/all" && method === "DELETE") {
    requireAdmin();
    const count = (await listRecords("aid_records")).length;
    await deleteCollection("aid_records");
    return { ok: true, deleted: count };
  }
  if (seg[0] === "aid-records" && seg.length === 2 && method === "DELETE") {
    requireAuth();
    await deleteRecord("aid_records", seg[1]);
    return { ok: true };
  }

  // ── Individual members ──
  if (path === "/individual-members/count" && method === "GET") {
    requireAuth();
    const members = await listRecords("individual_members");
    return { count: members.filter((m) => m.family_id === params.family_id).length };
  }
  if (path === "/individual-members" && method === "GET") {
    requireAuth();
    let members = await listRecords("individual_members");
    if (params.family_id) members = members.filter((m) => m.family_id === params.family_id);
    return members.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  if (path === "/individual-members" && method === "POST") {
    const user = requireAuth();
    return pushRecord("individual_members", {
      family_id: body.family_id,
      name: body.name,
      id_number: body.id_number,
      birth_date: body.birth_date,
      relation: body.relation,
      gender: body.gender,
      notes: body.notes || "",
      created_at: nowIso(),
      created_by: user.name || null,
    });
  }
  if (path === "/individual-members/all" && method === "DELETE") {
    requireAdmin();
    const count = (await listRecords("individual_members")).length;
    await deleteCollection("individual_members");
    return { ok: true, deleted: count };
  }
  if (seg[0] === "individual-members" && seg.length === 2 && method === "PUT") {
    requireAuth();
    if (!(await getRecord("individual_members", seg[1]))) throw httpError(404, "الفرد غير موجود");
    await updateRecord("individual_members", seg[1], { ...body, updated_at: nowIso() });
    return getRecord("individual_members", seg[1]);
  }
  if (seg[0] === "individual-members" && seg.length === 2 && method === "DELETE") {
    requireAuth();
    await deleteRecord("individual_members", seg[1]);
    return { ok: true };
  }

  // ── Categories ──
  if (path === "/categories" && method === "GET") {
    requireAuth();
    await seedCategories();
    const cats = await listRecords("categories");
    const records = await listRecords("category_records");
    const counts = {};
    for (const r of records) counts[r.category_id] = (counts[r.category_id] || 0) + 1;
    cats.forEach((c) => (c.count = counts[c.id] || 0));
    return cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }
  if (path === "/categories" && method === "POST") {
    requireAdmin();
    const existing = await listRecords("categories");
    const order = Math.max(0, ...existing.map((c) => c.order ?? 0)) + 1;
    return pushRecord("categories", {
      name: body.name,
      key: `cat_${Date.now()}`,
      icon: body.icon || "Layers",
      order,
      system: false,
      created_at: nowIso(),
    });
  }
  if (seg[0] === "categories" && seg.length === 2 && method === "DELETE") {
    requireAdmin();
    await deleteRecord("categories", seg[1]);
    for (const f of await listRecords("category_fields"))
      if (f.category_id === seg[1]) await deleteRecord("category_fields", f.id);
    for (const r of await listRecords("category_records"))
      if (r.category_id === seg[1]) await deleteRecord("category_records", r.id);
    return { ok: true };
  }

  // ── Category fields ──
  if (path === "/category-fields" && method === "GET") {
    requireAuth();
    return (await listRecords("category_fields"))
      .filter((f) => f.category_id === params.category_id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  if (path === "/category-fields" && method === "POST") {
    requireAdmin();
    const key = body.key || `cf_${Date.now()}`;
    return pushRecord("category_fields", {
      category_id: body.category_id,
      label: body.label,
      key,
      type: body.type || "text",
      order: body.order ?? 0,
      created_at: nowIso(),
    });
  }
  if (seg[0] === "category-fields" && seg.length === 2 && method === "DELETE") {
    requireAdmin();
    await deleteRecord("category_fields", seg[1]);
    return { ok: true };
  }

  // ── Category records ──
  if (path === "/category-records" && method === "GET") {
    requireAuth();
    return (await listRecords("category_records"))
      .filter((r) => r.category_id === params.category_id)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  if (path === "/category-records" && method === "POST") {
    const user = requireAuth();
    return pushRecord("category_records", {
      category_id: body.category_id,
      family_id: body.family_id || "",
      data: body.data || {},
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: user.name || null,
    });
  }
  if (path === "/category-records/export" && method === "GET")
    return exportCategoryRecords(params.category_id);
  if (path === "/category-records/import" && method === "POST")
    return importCategoryRecords(body, requireAuth());
  if (path === "/category-records/all" && method === "DELETE") {
    requireAdmin();
    const records = (await listRecords("category_records")).filter(
      (r) => r.category_id === params.category_id
    );
    for (const r of records) await deleteRecord("category_records", r.id);
    return { ok: true, deleted: records.length };
  }
  if (seg[0] === "category-records" && seg.length === 2 && method === "PUT") {
    requireAuth();
    if (!(await getRecord("category_records", seg[1]))) throw httpError(404, "السجل غير موجود");
    await updateRecord("category_records", seg[1], {
      family_id: body.family_id || "",
      data: body.data || {},
      updated_at: nowIso(),
    });
    return getRecord("category_records", seg[1]);
  }
  if (seg[0] === "category-records" && seg.length === 2 && method === "DELETE") {
    requireAuth();
    await deleteRecord("category_records", seg[1]);
    return { ok: true };
  }

  // ── Family members (legacy) ──
  if (path === "/family-members" && method === "GET") {
    requireAuth();
    return (await listRecords("family_members")).sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || "")
    );
  }
  if (path === "/family-members" && method === "POST") {
    const user = requireAuth();
    return pushRecord("family_members", { ...body, created_at: nowIso(), created_by: user.name || null });
  }
  if (seg[0] === "family-members" && seg.length === 2 && method === "PUT") {
    requireAuth();
    await updateRecord("family_members", seg[1], { ...body, updated_at: nowIso() });
    return getRecord("family_members", seg[1]);
  }
  if (seg[0] === "family-members" && seg.length === 2 && method === "DELETE") {
    requireAuth();
    await deleteRecord("family_members", seg[1]);
    return { ok: true };
  }

  // ── Stats ──
  if (path === "/stats" && method === "GET") {
    requireAuth();
    await seedCategories();
    const [families, individualMembers, records, aidTypes, famFields, categories, catRecords] =
      await Promise.all([
        listRecords("families"),
        listRecords("individual_members"),
        listRecords("aid_records"),
        listRecords("aid_types"),
        sortedFields(),
        listRecords("categories"),
        listRecords("category_records"),
      ]);

    const byType = {};
    for (const r of records) {
      const name = r.aid_type_name || "غير محدد";
      byType[name] = (byType[name] || 0) + 1;
    }
    const recent = [...records]
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 5);

    // إجمالي أفراد المخيم: مجموع قيم حقل "عدد الأفراد" في العائلات
    const countField =
      famFields.find((f) => /عدد/.test(f.label || "") && /افراد|أفراد/.test(f.label || "")) ||
      famFields.find((f) => /عدد/.test(f.label || "") && f.type === "number");
    let totalCampIndividuals = 0;
    if (countField) {
      for (const fam of families) {
        const n = parseInt(fam.data?.[countField.key], 10);
        if (!isNaN(n)) totalCampIndividuals += n;
      }
    }

    // إحصائيات الفئات الخاصة (عدد سجلات كل فئة)
    const catCounts = {};
    for (const r of catRecords) catCounts[r.category_id] = (catCounts[r.category_id] || 0) + 1;
    const categoryStats = categories
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map((c) => ({
        id: c.id,
        name: c.name,
        key: c.key,
        icon: c.icon || "Layers",
        count: catCounts[c.id] || 0,
      }));

    return {
      total_families: families.length,
      total_individual_members: individualMembers.length,
      total_camp_individuals: totalCampIndividuals,
      total_aid_records: records.length,
      total_aid_types: aidTypes.length,
      aid_by_type: Object.entries(byType).map(([name, count]) => ({ name, count })),
      category_stats: categoryStats,
      recent_records: recent,
    };
  }

  throw httpError(404, `المسار غير موجود: ${method} ${path}`);
}

async function request(method, url, body) {
  try {
    const { path, params } = parseUrl(url);
    const data = await handle(method, path, params, body);
    return { data, status: 200 };
  } catch (err) {
    if (err && err.response) {
      if (err.response.status === 401) {
        localStorage.removeItem("camp_token");
        localStorage.removeItem("camp_user");
        if (window.location.pathname !== "/login") window.location.href = "/login";
      }
      throw err;
    }
    // Firebase / unexpected errors
    const msg = err?.code?.includes?.("PERMISSION_DENIED")
      ? "لا تملك صلاحية الوصول إلى قاعدة البيانات"
      : err?.message || "حدث خطأ ما. حاول مجدداً";
    throw httpError(500, msg);
  }
}

const api = {
  get: (url, config) => request("GET", url, null, config),
  post: (url, body, config) => request("POST", url, body, config),
  put: (url, body, config) => request("PUT", url, body, config),
  delete: (url, config) => request("DELETE", url, null, config),
};

export function apiError(detail) {
  if (detail == null) return "حدث خطأ ما. حاول مجدداً";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
