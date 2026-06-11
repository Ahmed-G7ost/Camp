// ─────────────────────────────────────────────────────────────────────────────
// أدوات تلوين البيانات: لون متدرج ثابت لكل اسم + شارات الجنس بأيقونات SVG
// ─────────────────────────────────────────────────────────────────────────────

const PALETTES = [
  { grad: "linear-gradient(135deg,#2563eb,#06b6d4)", text: "#1d4ed8", ring: "rgba(37,99,235,.30)" },
  { grad: "linear-gradient(135deg,#059669,#14b8a6)", text: "#047857", ring: "rgba(5,150,105,.30)" },
  { grad: "linear-gradient(135deg,#d97706,#f59e0b)", text: "#b45309", ring: "rgba(217,119,6,.30)" },
  { grad: "linear-gradient(135deg,#e11d48,#f472b6)", text: "#be123c", ring: "rgba(225,29,72,.28)" },
  { grad: "linear-gradient(135deg,#7c3aed,#a78bfa)", text: "#6d28d9", ring: "rgba(124,58,237,.28)" },
  { grad: "linear-gradient(135deg,#4f46e5,#3b82f6)", text: "#4338ca", ring: "rgba(79,70,229,.30)" },
  { grad: "linear-gradient(135deg,#0d9488,#22d3ee)", text: "#0f766e", ring: "rgba(13,148,136,.30)" },
  { grad: "linear-gradient(135deg,#ea580c,#fb923c)", text: "#c2410c", ring: "rgba(234,88,12,.30)" },
  { grad: "linear-gradient(135deg,#16a34a,#84cc16)", text: "#15803d", ring: "rgba(22,163,74,.30)" },
  { grad: "linear-gradient(135deg,#0284c7,#38bdf8)", text: "#0369a1", ring: "rgba(2,132,199,.30)" },
  { grad: "linear-gradient(135deg,#c026d3,#e879f9)", text: "#a21caf", ring: "rgba(192,38,211,.28)" },
  { grad: "linear-gradient(135deg,#dc2626,#f87171)", text: "#b91c1c", ring: "rgba(220,38,38,.28)" },
  { grad: "linear-gradient(135deg,#ca8a04,#facc15)", text: "#a16207", ring: "rgba(202,138,4,.30)" },
  { grad: "linear-gradient(135deg,#475569,#94a3b8)", text: "#334155", ring: "rgba(71,85,105,.30)" },
];

export function nameHash(str) {
  let h = 5381;
  for (const ch of String(str || "")) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h;
}

export function namePalette(name) {
  return PALETTES[nameHash(String(name || "").trim()) % PALETTES.length];
}

// ── أيقونات SVG احترافية للجنس (رمز المريخ / الزهرة) ─────────────────────────
export const MaleIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="10" cy="14" r="5.5" />
    <path d="M20.5 3.5L14 10" />
    <path d="M15 3.5h5.5V9" />
  </svg>
);

export const FemaleIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8.5" r="5.5" />
    <path d="M12 14v7.5" />
    <path d="M8.5 18h7" />
  </svg>
);

// ── كشف حقل / قيمة الجنس ──────────────────────────────────────────────────────
export function genderOf(v) {
  const s = String(v || "").trim();
  if (/^(ذكر|ولد|رجل|male|m)$/i.test(s)) return "male";
  if (/^(أنثى|انثى|انثي|بنت|امرأة|female|f)$/i.test(s)) return "female";
  return null;
}

export function isGenderField(label) {
  return /(^|\s)(الجنس|جنس)(\s|$)|gender/i.test(String(label || ""));
}

export function isNameField(label) {
  return /اسم|الإسم|name/i.test(String(label || ""));
}

// ── اسم ملوّن (نص فقط بدون دائرة) للأعمدة الثانوية ───────────────────────────
export function ColorName({ name }) {
  const clean = String(name || "").trim();
  if (!clean || clean === "—") return <span className="text-slate-400">—</span>;
  const p = namePalette(clean);
  return (
    <span className="font-tajawal font-bold text-sm whitespace-nowrap" style={{ color: p.text }}>
      {clean}
    </span>
  );
}

// ── شارة اسم: دائرة متدرجة بالحرف الأول + اسم ملوّن ──────────────────────────
export function NameBadge({ name, testId }) {
  const clean = String(name || "").trim();
  if (!clean || clean === "—") return <span className="text-slate-400">—</span>;
  const p = namePalette(clean);
  return (
    <div className="flex items-center gap-2.5" data-testid={testId}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-cairo font-extrabold text-sm shrink-0"
        style={{ background: p.grad, boxShadow: `0 4px 12px ${p.ring}` }}
      >
        {clean.charAt(0)}
      </div>
      <span className="font-tajawal font-bold text-sm whitespace-nowrap" style={{ color: p.text }}>
        {clean}
      </span>
    </div>
  );
}

// ── شارة الجنس: أزرق للذكر / وردي للأنثى مع أيقونة SVG ───────────────────────
export function GenderBadge({ value, testId }) {
  const g = genderOf(value);
  if (!g) return <span className="font-tajawal text-slate-700 text-sm">{value || "—"}</span>;
  const male = g === "male";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 ps-1 pe-2.5 py-1 rounded-full text-xs font-tajawal font-bold border ${
        male
          ? "bg-gradient-to-l from-blue-50 to-sky-50 text-blue-700 border-blue-200"
          : "bg-gradient-to-l from-pink-50 to-rose-50 text-pink-700 border-pink-200"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${
          male
            ? "bg-gradient-to-br from-blue-500 to-sky-600 shadow-sm shadow-blue-500/40"
            : "bg-gradient-to-br from-pink-500 to-rose-500 shadow-sm shadow-pink-500/40"
        }`}
      >
        {male ? <MaleIcon className="w-3 h-3" /> : <FemaleIcon className="w-3 h-3" />}
      </span>
      {String(value).trim()}
    </span>
  );
}
