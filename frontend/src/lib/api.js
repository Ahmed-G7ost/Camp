// Local "API" router — same axios-like interface (api.get/post/put/delete → {data}),
// but everything runs in the frontend directly against Firebase (no backend).
import {
  listRecords, pushRecord, getRecord, updateRecord, deleteRecord, deleteNode,
  nowIso, getActiveUser, normalizeArabic, findBestFamily, seedCategories,
} from "./db";
import { readRows, rowsToBlob } from "./excel";
import { firebaseConfig, auth as mainAuth } from "./firebase";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

class ApiError extends Error {
  constructor(detail, status = 400) {
    super(typeof detail === "string" ? detail : "API error");
    this.response = { status, data: { detail } };
  }
}

export function apiError(detail) {
  if (detail == null) return "حدث خطأ ما. حاول مجدداً";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

const userName = () => getActiveUser()?.name || "";
const requireAuth = () => {
  if (!mainAuth.currentUser) throw new ApiError("غير مصرّح. الرجاء تسجيل الدخول", 401);
};
const cellStr = (c) => (c == null ? "" : String(c).trim());

// ─── Excel helpers ────────────────────────────────────────────────
async function readRowsOr400(file) {
  try {
    return await readRows(file);
  } catch {
    throw new ApiError("ملف غير صالح. الرجاء رفع ملف Excel (.xlsx)");
  }
}

function parseMapping(mapping) {
  const fieldCol = {};
  if (!mapping) return fieldCol;
  let mp = {};
  try { mp = JSON.parse(mapping); } catch { mp = {}; }
  for (const [fkey, colIdx] of Object.entries(mp)) {
    if (colIdx === null || colIdx === "" || colIdx === undefined) continue;
    const idx = parseInt(colIdx, 10);
    if (!Number.isNaN(idx)) fieldCol[fkey] = idx;
  }
  return fieldCol;
}

const isEmptyRow = (row) => !row || row.every((c) => c == null || String(c).trim() === "");

async function sortedFamilyFields() {
  const fields = await listRecords("family_fields");
  return fields.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function buildExactIndex(families, matchFieldKey) {
  const idx = {};
  for (const fam of families) {
    const val = String(fam.data?.[matchFieldKey] || "").trim();
    if (val) {
      const norm = normalizeArabic(val);
      if (norm && !(norm in idx)) idx[norm] = fam.id;
    }
  }
  return idx;
}

// ─── GET handlers ─────────────────────────────────────────────────
async function handleGet(path, params) {
  // /stats
  if (path === "/stats") {
    const [families, members, records, aidTypes] = await Promise.all([
      listRecords("families"), listRecords("individual_members"),
      listRecords("aid_records"), listRecords("aid_types"),
    ]);
    const byType = {};
    for (const r of records) {
      const name = r.aid_type_name || "غير محدد";
      byType[name] = (byType[name] || 0) + 1;
    }
    const recent = [...records].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 5);
    return {
      total_families: families.length,
      total_individual_members: members.length,
      total_aid_records: records.length,
      total_aid_types: aidTypes.length,
      aid_by_type: Object.entries(byType).map(([name, count]) => ({ name, count })),
      recent_records: recent,
    };
  }

  if (path === "/families") {
    const fams = await listRecords("families");
    return fams.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  if (path === "/family-fields") return sortedFamilyFields();
  if (path === "/aid-types") return listRecords("aid_types");

  if (path === "/aid-records") {
    let records = await listRecords("aid_records");
    if (params.family_id) records = records.filter((r) => r.family_id === params.family_id);
    return records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  if (path === "/individual-members/count") {
    const members = await listRecords("individual_members");
    return { count: members.filter((m) => m.family_id === params.family_id).length };
  }
  if (path === "/individual-members") {
    let members = await listRecords("individual_members");
    if (params.family_id) members = members.filter((m) => m.family_id === params.family_id);
    return members.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }

  if (path === "/users") {
    const users = await listRecords("users");
    return users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at }));
  }

  if (path === "/categories") {
    let cats = await listRecords("categories");
    if (!cats.length) {
      await seedCategories();
      cats = await listRecords("categories");
    }
    const records = await listRecords("category_records");
    const counts = {};
    for (const r of records) counts[r.category_id] = (counts[r.category_id] || 0) + 1;
    return cats
      .map((c) => ({ ...c, count: counts[c.id] || 0 }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  if (path === "/category-fields") {
    const fields = (await listRecords("category_fields")).filter((f) => f.category_id === params.category_id);
    return fields.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  if (path === "/category-records") {
    const records = (await listRecords("category_records")).filter((r) => r.category_id === params.category_id);
    return records.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }

  if (path === "/family-members") {
    const members = await listRecords("family_members");
    return members.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }

  // ── Excel exports (blob) ──
  if (path === "/families/export") {
    const fields = await sortedFamilyFields();
    const families = await listRecords("families");
    const rows = [fields.map((f) => f.label)];
    for (const fam of families) rows.push(fields.map((f) => fam.data?.[f.key] ?? ""));
    return rowsToBlob(rows, "Families");
  }
  if (path === "/families/template") {
    const fields = await sortedFamilyFields();
    return rowsToBlob([fields.map((f) => f.label)], "Families");
  }
  if (path === "/aid-records/export") {
    const fields = await sortedFamilyFields();
    const nameField = fields[0]?.key;
    const familiesMap = {};
    for (const f of await listRecords("families")) familiesMap[f.id] = f.data || {};
    const records = await listRecords("aid_records");
    const rows = [["العائلة", "نوع المساعدة", "التاريخ", "الكمية", "ملاحظات", "أُضيف بواسطة"]];
    for (const r of records) {
      const famData = familiesMap[r.family_id] || {};
      const famName = nameField ? (famData[nameField] ?? r.family_id) : r.family_id;
      rows.push([famName, r.aid_type_name || "", r.date || "", r.quantity || "", r.notes || "", r.created_by || ""]);
    }
    return rowsToBlob(rows, "AidRecords");
  }
  if (path === "/category-records/export") {
    const catFields = (await listRecords("category_fields"))
      .filter((f) => f.category_id === params.category_id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const famFields = await sortedFamilyFields();
    const nameField = famFields[0]?.key;
    const familiesMap = {};
    for (const f of await listRecords("families")) familiesMap[f.id] = f.data || {};
    const records = (await listRecords("category_records")).filter((r) => r.category_id === params.category_id);
    const rows = [["الاسم (العائلة)", ...catFields.map((f) => f.label)]];
    for (const r of records) {
      const famName = nameField ? (familiesMap[r.family_id]?.[nameField] ?? "") : "";
      rows.push([famName, ...catFields.map((f) => r.data?.[f.key] ?? "")]);
    }
    return rowsToBlob(rows, "Records");
  }

  throw new ApiError(`مسار غير معروف: ${path}`, 404);
}

// ─── POST handlers ────────────────────────────────────────────────
async function handlePost(path, body) {
  // ── Auth user creation (admin panel) via secondary Firebase app ──
  if (path === "/users") {
    const { email, password, name, role = "staff" } = body;
    if (!["admin", "staff"].includes(role)) throw new ApiError("صلاحية غير صالحة");
    const users = await listRecords("users");
    const cleanEmail = email.trim().toLowerCase();
    if (users.some((u) => (u.email || "").toLowerCase() === cleanEmail))
      throw new ApiError("البريد الإلكتروني مستخدم بالفعل");
    // Create the Firebase Auth account on a secondary app so the admin session is kept
    const secApp = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
    const secAuth = getAuth(secApp);
    try {
      await createUserWithEmailAndPassword(secAuth, cleanEmail, password);
      await signOut(secAuth);
    } catch (e) {
      const code = e.code || "";
      if (code.includes("email-already-in-use")) {
        // Auth account exists but no profile → just create the profile below
      } else if (code.includes("weak-password")) {
        throw new ApiError("كلمة المرور ضعيفة (6 أحرف على الأقل)");
      } else if (code.includes("invalid-email")) {
        throw new ApiError("البريد الإلكتروني غير صالح");
      } else {
        throw new ApiError("تعذّر إنشاء الحساب: " + (e.message || code));
      }
    } finally {
      try { await deleteApp(secApp); } catch {}
    }
    const rec = await pushRecord("users", { email: cleanEmail, name, role, created_at: nowIso() });
    return { id: rec.id, email: rec.email, name: rec.name, role: rec.role };
  }

  if (path === "/families") {
    return pushRecord("families", {
      data: body.data, created_at: nowIso(), updated_at: nowIso(), created_by: userName(),
    });
  }

  if (path === "/family-fields") {
    const key = body.key || `f_${Date.now()}`;
    return pushRecord("family_fields", {
      label: body.label, key, type: body.type || "text", order: body.order || 0, created_at: nowIso(),
    });
  }

  if (path === "/aid-types") {
    return pushRecord("aid_types", { name: body.name, description: body.description || "", created_at: nowIso() });
  }

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

  if (path === "/individual-members") {
    return pushRecord("individual_members", { ...body, created_at: nowIso(), created_by: userName() });
  }

  if (path === "/categories") {
    const existing = await listRecords("categories");
    const order = Math.max(0, ...existing.map((c) => c.order || 0)) + 1;
    return pushRecord("categories", {
      name: body.name, key: `cat_${Date.now()}`, icon: body.icon || "Layers",
      order, system: false, created_at: nowIso(),
    });
  }

  if (path === "/category-fields") {
    const key = body.key || `cf_${Date.now()}`;
    return pushRecord("category_fields", {
      category_id: body.category_id, label: body.label, key,
      type: body.type || "text", order: body.order || 0, created_at: nowIso(),
    });
  }

  if (path === "/category-records") {
    return pushRecord("category_records", {
      category_id: body.category_id, family_id: body.family_id || "", data: body.data || {},
      created_at: nowIso(), updated_at: nowIso(), created_by: userName(),
    });
  }

  if (path === "/family-members") {
    return pushRecord("family_members", { ...body, created_at: nowIso(), created_by: userName() });
  }

  // ── Excel imports (FormData) ──
  if (path === "/families/import/columns") {
    const allRows = await readRowsOr400(body.get("file"));
    if (!allRows.length) return { preview: [], suggested_header: 0, total_rows: 0 };
    let preview = allRows.slice(0, 15).map((r) => (r || []).map(cellStr));
    const width = Math.max(0, ...preview.map((r) => r.length));
    preview = preview.map((r) => [...r, ...Array(width - r.length).fill("")]);
    let suggested = 0, best = -1;
    preview.forEach((r, i) => {
      const cnt = r.filter((c) => c).length;
      if (cnt > best) { best = cnt; suggested = i; }
    });
    return { preview, suggested_header: suggested, total_rows: allRows.length };
  }

  if (path === "/families/import") {
    const fields = await sortedFamilyFields();
    if (!fields.length) throw new ApiError("الرجاء إضافة حقول العائلة أولاً قبل الاستيراد");
    const headerRow = parseInt(body.get("header_row") || "0", 10);
    const allRows = await readRowsOr400(body.get("file"));
    if (!allRows.length || headerRow >= allRows.length) return { imported: 0 };

    const header = (allRows[headerRow] || []).map(cellStr);
    let fieldCol = parseMapping(body.get("mapping"));
    if (!Object.keys(fieldCol).length) {
      const labelToKey = Object.fromEntries(fields.map((f) => [f.label, f.key]));
      header.forEach((col, idx) => { if (col in labelToKey) fieldCol[labelToKey[col]] = idx; });
    }
    if (!Object.keys(fieldCol).length)
      throw new ApiError("لم يتم ربط أي عمود بالحقول. الرجاء تحديد الأعمدة المطلوبة");

    let imported = 0;
    for (const row of allRows.slice(headerRow + 1)) {
      if (isEmptyRow(row)) continue;
      const data = {};
      for (const [fkey, idx] of Object.entries(fieldCol)) data[fkey] = cellStr(row[idx]);
      if (Object.values(data).some((v) => String(v).trim())) {
        await pushRecord("families", {
          data, created_at: nowIso(), updated_at: nowIso(), created_by: userName(),
        });
        imported++;
      }
    }
    return { imported };
  }

  if (path === "/aid-records/import") {
    const aidTypeId = body.get("aid_type_id");
    const aidType = await getRecord("aid_types", aidTypeId);
    if (!aidType) throw new ApiError("نوع المساعدة غير موجود");
    const headerRow = parseInt(body.get("header_row") || "0", 10);
    const matchColumn = parseInt(body.get("match_column"), 10);
    const matchFieldKey = body.get("match_field_key");
    const date = body.get("date");
    const notes = body.get("notes") || "";
    const fuzzy = body.get("fuzzy") !== "false";
    const threshold = parseFloat(body.get("threshold") || "0.60");

    const families = await listRecords("families");
    const exactIndex = buildExactIndex(families, matchFieldKey);
    const allRows = await readRowsOr400(body.get("file"));

    let created = 0, fuzzyMatched = 0;
    const unmatched = [];
    for (const row of allRows.slice(headerRow + 1)) {
      if (isEmptyRow(row)) continue;
      const ident = cellStr(row[matchColumn]);
      if (!ident) continue;
      let famId = exactIndex[normalizeArabic(ident)];
      if (!famId && fuzzy) {
        const [bestFam] = findBestFamily(families, matchFieldKey, ident, threshold);
        if (bestFam) { famId = bestFam.id; fuzzyMatched++; }
      }
      if (!famId) { unmatched.push(ident); continue; }
      await pushRecord("aid_records", {
        family_id: famId, aid_type_id: aidTypeId, aid_type_name: aidType.name,
        date, quantity: "", notes, created_by: userName(), created_at: nowIso(),
      });
      created++;
    }
    return { created, fuzzy_matched: fuzzyMatched, unmatched_count: unmatched.length, unmatched: unmatched.slice(0, 50) };
  }

  if (path === "/category-records/import") {
    const categoryId = body.get("category_id");
    const headerRow = parseInt(body.get("header_row") || "0", 10);
    const matchColumn = parseInt(body.get("match_column"), 10);
    const matchFieldKey = body.get("match_field_key");
    const fuzzy = body.get("fuzzy") !== "false";
    const threshold = parseFloat(body.get("threshold") || "0.60");
    const fieldCol = parseMapping(body.get("mapping"));

    const families = await listRecords("families");
    const exactIndex = buildExactIndex(families, matchFieldKey);
    const allRows = await readRowsOr400(body.get("file"));

    let created = 0, fuzzyMatched = 0;
    const unmatched = [];
    for (const row of allRows.slice(headerRow + 1)) {
      if (isEmptyRow(row)) continue;
      const ident = cellStr(row[matchColumn]);
      if (!ident) continue;
      let famId = exactIndex[normalizeArabic(ident)];
      if (!famId && fuzzy) {
        const [bestFam] = findBestFamily(families, matchFieldKey, ident, threshold);
        if (bestFam) { famId = bestFam.id; fuzzyMatched++; }
      }
      if (!famId) { unmatched.push(ident); continue; }
      const data = {};
      for (const [fkey, idx] of Object.entries(fieldCol)) data[fkey] = cellStr(row[idx]);
      await pushRecord("category_records", {
        category_id: categoryId, family_id: famId, data,
        created_at: nowIso(), updated_at: nowIso(), created_by: userName(),
      });
      created++;
    }
    return { created, fuzzy_matched: fuzzyMatched, unmatched_count: unmatched.length, unmatched: unmatched.slice(0, 50) };
  }

  throw new ApiError(`مسار غير معروف: ${path}`, 404);
}

// ─── PUT handlers ─────────────────────────────────────────────────
async function handlePut(path, body) {
  let m;
  if ((m = path.match(/^\/families\/(.+)$/))) {
    if (!(await getRecord("families", m[1]))) throw new ApiError("العائلة غير موجودة", 404);
    return updateRecord("families", m[1], { data: body.data, updated_at: nowIso() });
  }
  if ((m = path.match(/^\/individual-members\/(.+)$/))) {
    if (!(await getRecord("individual_members", m[1]))) throw new ApiError("الفرد غير موجود", 404);
    return updateRecord("individual_members", m[1], { ...body, updated_at: nowIso() });
  }
  if ((m = path.match(/^\/category-records\/(.+)$/))) {
    if (!(await getRecord("category_records", m[1]))) throw new ApiError("السجل غير موجود", 404);
    return updateRecord("category_records", m[1], {
      family_id: body.family_id || "", data: body.data || {}, updated_at: nowIso(),
    });
  }
  if ((m = path.match(/^\/users\/(.+)\/role$/))) {
    if (!["admin", "staff"].includes(body.role)) throw new ApiError("صلاحية غير صالحة");
    if (m[1] === getActiveUser()?.id) throw new ApiError("لا يمكنك تغيير صلاحية حسابك الخاص");
    if (!(await getRecord("users", m[1]))) throw new ApiError("المستخدم غير موجود", 404);
    const u = await updateRecord("users", m[1], { role: body.role });
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
  if ((m = path.match(/^\/family-members\/(.+)$/))) {
    return updateRecord("family_members", m[1], { ...body, updated_at: nowIso() });
  }
  throw new ApiError(`مسار غير معروف: ${path}`, 404);
}

// ─── DELETE handlers ──────────────────────────────────────────────
async function handleDelete(path, params) {
  let m;
  if (path === "/families/all") {
    const count = (await listRecords("families")).length;
    await deleteNode("families");
    await deleteNode("aid_records");
    return { ok: true, deleted: count };
  }
  if (path === "/aid-records/all") {
    const count = (await listRecords("aid_records")).length;
    await deleteNode("aid_records");
    return { ok: true, deleted: count };
  }
  if (path === "/individual-members/all") {
    const count = (await listRecords("individual_members")).length;
    await deleteNode("individual_members");
    return { ok: true, deleted: count };
  }
  if (path === "/category-records/all") {
    const records = (await listRecords("category_records")).filter((r) => r.category_id === params.category_id);
    for (const r of records) await deleteRecord("category_records", r.id);
    return { ok: true, deleted: records.length };
  }
  if ((m = path.match(/^\/families\/(.+)$/))) {
    await deleteRecord("families", m[1]);
    const records = await listRecords("aid_records");
    for (const r of records) if (r.family_id === m[1]) await deleteRecord("aid_records", r.id);
    return { ok: true };
  }
  if ((m = path.match(/^\/categories\/(.+)$/))) {
    await deleteRecord("categories", m[1]);
    for (const f of await listRecords("category_fields"))
      if (f.category_id === m[1]) await deleteRecord("category_fields", f.id);
    for (const r of await listRecords("category_records"))
      if (r.category_id === m[1]) await deleteRecord("category_records", r.id);
    return { ok: true };
  }
  if ((m = path.match(/^\/users\/(.+)$/))) {
    if (m[1] === getActiveUser()?.id) throw new ApiError("لا يمكنك حذف حسابك الخاص");
    await deleteRecord("users", m[1]);
    return { ok: true };
  }
  const simple = {
    "aid-records": "aid_records",
    "aid-types": "aid_types",
    "family-fields": "family_fields",
    "category-fields": "category_fields",
    "category-records": "category_records",
    "individual-members": "individual_members",
    "family-members": "family_members",
  };
  if ((m = path.match(/^\/([a-z-]+)\/(.+)$/)) && simple[m[1]]) {
    await deleteRecord(simple[m[1]], m[2]);
    return { ok: true };
  }
  throw new ApiError(`مسار غير معروف: ${path}`, 404);
}

// ─── Axios-like facade ────────────────────────────────────────────
function parseUrl(url) {
  const [path, qs] = url.split("?");
  return [path, Object.fromEntries(new URLSearchParams(qs || ""))];
}

async function run(fn) {
  try {
    const data = await fn();
    return { data };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e?.code === "PERMISSION_DENIED" || /permission_denied/i.test(e?.message || ""))
      throw new ApiError("غير مصرّح. تحقق من تسجيل الدخول وصلاحيات قاعدة البيانات", 401);
    throw new ApiError(e?.message || "حدث خطأ ما. حاول مجدداً", 500);
  }
}

const api = {
  get(url, opts = {}) {
    requireAuth();
    const [path, params] = parseUrl(url);
    return run(() => handleGet(path, { ...params, ...(opts.params || {}) }));
  },
  post(url, body) {
    requireAuth();
    const [path] = parseUrl(url);
    return run(() => handlePost(path, body));
  },
  put(url, body) {
    requireAuth();
    const [path] = parseUrl(url);
    return run(() => handlePut(path, body));
  },
  delete(url, opts = {}) {
    requireAuth();
    const [path, params] = parseUrl(url);
    return run(() => handleDelete(path, { ...params, ...(opts.params || {}) }));
  },
};

export default api;
