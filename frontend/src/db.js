// Firebase Realtime Database data layer (replaces the FastAPI backend)
import { db } from "./firebase";
import { ref, get, set, update, remove, push as fbPush } from "firebase/database";

// ─── Generic CRUD ────────────────────────────────────────────────
export async function listRecords(col) {
  const snap = await get(ref(db, col));
  const data = snap.val();
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([, v]) => v && typeof v === "object")
    .map(([k, v]) => ({ ...v, id: v.id || k }));
}

export async function pushRecord(col, data) {
  const node = fbPush(ref(db, col));
  const record = { ...data, id: node.key };
  await set(node, record);
  return record;
}

export async function getRecord(col, id) {
  const snap = await get(ref(db, `${col}/${id}`));
  return snap.val();
}

export async function updateRecord(col, id, data) {
  await update(ref(db, `${col}/${id}`), data);
  return getRecord(col, id);
}

export async function deleteRecord(col, id) {
  await remove(ref(db, `${col}/${id}`));
}

export async function deleteNode(col) {
  await remove(ref(db, col));
}

export const nowIso = () => new Date().toISOString();

// ─── Active user (for created_by fields) ────────────────────────
let activeUser = null;
export const setActiveUser = (u) => { activeUser = u; };
export const getActiveUser = () => activeUser;

// ─── User profile (Firebase Auth + RTDB users node) ─────────────
export async function findUserByEmail(email) {
  email = (email || "").trim().toLowerCase();
  const users = await listRecords("users");
  return users.find((u) => (u.email || "").toLowerCase() === email) || null;
}

export async function ensureUserProfile(fbUser) {
  const email = (fbUser.email || "").toLowerCase();
  let user = await findUserByEmail(email);
  if (!user) {
    user = await pushRecord("users", {
      email,
      name: fbUser.displayName || email.split("@")[0],
      role: "admin",
      created_at: nowIso(),
    });
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role || "staff" };
}

// ─── Arabic fuzzy matching (ported from backend) ─────────────────
export function normalizeArabic(text) {
  if (!text) return "";
  let t = String(text).trim();
  t = t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  t = t.replace(/[أإآٱ]/g, "ا");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function matchScore(valA, valB) {
  const a = normalizeArabic(valA);
  const b = normalizeArabic(valB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  const common = [...wa].filter((w) => wb.has(w)).length;
  if (common === 0) return 0;
  let score = common / Math.max(wa.size, wb.size);
  const [shorter, longer] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  if ([...shorter].every((w) => longer.has(w))) score = Math.min(1, score + 0.15);
  return score;
}

export function findBestFamily(families, fieldKey, query, threshold = 0.6) {
  let bestScore = 0;
  let bestFam = null;
  for (const fam of families) {
    const famVal = String(fam.data?.[fieldKey] || "").trim();
    if (!famVal) continue;
    const score = matchScore(query, famVal);
    if (score > bestScore) {
      bestScore = score;
      bestFam = fam;
    }
  }
  return bestScore >= threshold ? [bestFam, bestScore] : [null, bestScore];
}

// ─── Default categories seed ─────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "أرامل", key: "widows", icon: "HeartHandshake", order: 1 },
  { name: "حوامل", key: "pregnant", icon: "Baby", order: 2 },
  { name: "مرضعات", key: "nursing", icon: "Milk", order: 3 },
  { name: "أطفال", key: "children", icon: "ToyBrick", order: 4 },
  { name: "مرضى", key: "patients", icon: "Stethoscope", order: 5 },
  { name: "كبار السن", key: "elderly", icon: "Accessibility", order: 6 },
  { name: "إصابات", key: "injuries", icon: "Bandage", order: 7 },
];

export async function seedCategories() {
  const existing = await listRecords("categories");
  const keys = new Set(existing.map((c) => c.key));
  for (const c of DEFAULT_CATEGORIES) {
    if (!keys.has(c.key)) {
      await pushRecord("categories", { ...c, system: true, created_at: nowIso() });
    }
  }
}
