import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import {
  Users, HandHeart, Boxes, Loader2, Clock, Tent,
  HeartHandshake, Baby, Milk, ToyBrick, Stethoscope, Accessibility, Bandage, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from "recharts";

const cards = [
  { key: "total_families", label: "إجمالي العائلات", icon: Users, color: "from-blue-500 to-blue-700" },
  { key: "total_camp_individuals", label: "إجمالي أفراد المخيم", icon: Tent, color: "from-purple-500 to-purple-700" },
  { key: "total_aid_records", label: "عمليات التوزيع", icon: HandHeart, color: "from-green-500 to-emerald-700" },
  { key: "total_aid_types", label: "أنواع المساعدات", icon: Boxes, color: "from-amber-500 to-orange-600" },
];

// أيقونات الفئات الخاصة (lucide)
const CATEGORY_ICONS = {
  HeartHandshake, Baby, Milk, ToyBrick, Stethoscope, Accessibility, Bandage, Layers,
};

// أيقونات SVG مخصّصة تعبّر بدقّة عن: الأطفال، الحوامل، المرضعات
const ChildIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="14.5" cy="10.5" r="1.25" />
    <circle cx="9.5" cy="10.5" r="1.25" />
    <path d="M22.94 12.66c.04-.21.06-.43.06-.66s-.02-.45-.06-.66a4.008 4.008 0 0 0-2.81-3.17a9.114 9.114 0 0 0-2.19-2.91C16.36 3.85 14.28 3 12 3s-4.36.85-5.94 2.26c-.92.81-1.67 1.8-2.19 2.91a3.994 3.994 0 0 0-2.81 3.17c-.04.21-.06.43-.06.66s.02.45.06.66a4.008 4.008 0 0 0 2.81 3.17a8.977 8.977 0 0 0 2.17 2.89C7.62 20.14 9.71 21 12 21s4.38-.86 5.97-2.28c.9-.8 1.65-1.79 2.17-2.89a3.998 3.998 0 0 0 2.8-3.17zM19 14c-.1 0-.19-.02-.29-.03c-.2.67-.49 1.29-.86 1.86C16.6 17.74 14.45 19 12 19s-4.6-1.26-5.85-3.17c-.37-.57-.66-1.19-.86-1.86c-.1.01-.19.03-.29.03c-1.1 0-2-.9-2-2s.9-2 2-2c.1 0 .19.02.29.03c.2-.67.49-1.29.86-1.86C7.4 6.26 9.55 5 12 5s4.6 1.26 5.85 3.17c.37.57.66 1.19.86 1.86c.1-.01.19-.03.29-.03c1.1 0 2 .9 2 2s-.9 2-2 2zM7.5 14c.76 1.77 2.49 3 4.5 3s3.74-1.23 4.5-3h-9z" />
  </svg>
);
const PregnantIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M9 4c0-1.11.89-2 2-2s2 .89 2 2s-.89 2-2 2s-2-.89-2-2zm7 9a3.285 3.285 0 0 0-2-3c0-1.66-1.34-3-3-3s-3 1.34-3 3v7h2v5h3v-5h3v-4z" />
  </svg>
);
const NursingIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11.925 22q-1.05 0-2.037-.225T8.1 21.2q-1.15-.5-1.875-1.212T5.5 18.4v-5.775q0-.775.588-1.425T7.6 10.05q.95-.5 2.088-.775T12 9t2.313.275t2.087.775t1.525 1.15t.575 1.425V18.4q0 .425-.188.825t-.537.75t-.812.663t-1.038.562q.025-.125.075-.7q0-1.45-1.025-2.475T12.5 17q-1.075 0-1.9.575T9.35 19.05q.8.2 1.463.275t1.162.075q.425 0 .688-.025T13 19.35v2.6q-.275.025-.537.038t-.538.012M15 16.5q.825 0 1.413-.587T17 14.5t-.587-1.412T15 12.5t-1.412.588T13 14.5t.588 1.413T15 16.5M12 8q1.25 0 2.125-.862T15 5q0-1.25-.875-2.125T12 2q-1.275 0-2.137.875T9 5q0 1.275.863 2.138T12 8" />
  </svg>
);

// ربط أيقونة دقيقة بكل فئة حسب مفتاحها (تُقدَّم على أيقونة الـ DB)
const CATEGORY_KEY_ICONS = {
  children: ChildIcon,
  pregnant: PregnantIcon,
  nursing: NursingIcon,
};

// لوحة ألوان متوافقة لكل فئة (gradient + لون ناعم للخلفية + لون نص)
const CATEGORY_ACCENTS = [
  { grad: "from-rose-500 to-pink-600", soft: "bg-rose-50", ring: "ring-rose-100", text: "text-rose-600", bar: "#f43f5e" },
  { grad: "from-violet-500 to-purple-600", soft: "bg-violet-50", ring: "ring-violet-100", text: "text-violet-600", bar: "#8b5cf6" },
  { grad: "from-sky-500 to-blue-600", soft: "bg-sky-50", ring: "ring-sky-100", text: "text-sky-600", bar: "#0ea5e9" },
  { grad: "from-amber-500 to-orange-600", soft: "bg-amber-50", ring: "ring-amber-100", text: "text-amber-600", bar: "#f59e0b" },
  { grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50", ring: "ring-emerald-100", text: "text-emerald-600", bar: "#10b981" },
  { grad: "from-indigo-500 to-blue-700", soft: "bg-indigo-50", ring: "ring-indigo-100", text: "text-indigo-600", bar: "#6366f1" },
  { grad: "from-red-500 to-rose-600", soft: "bg-red-50", ring: "ring-red-100", text: "text-red-600", bar: "#ef4444" },
];

// لون ثابت لكل فئة معروفة، ثم تدوير اللوحة للباقي
const FIXED_ACCENT = {
  widows: 0, pregnant: 1, nursing: 2, children: 3, patients: 4, elderly: 5, injuries: 6,
};
const accentFor = (key, i) =>
  CATEGORY_ACCENTS[FIXED_ACCENT[key] ?? (i % CATEGORY_ACCENTS.length)];

const BAR_COLORS = ["#2563eb", "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#6366f1", "#14b8a6"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2 shadow-lg backdrop-blur-sm">
      <div className="font-tajawal font-bold text-slate-800 text-sm">{label}</div>
      <div className="font-tajawal text-slate-500 text-xs mt-0.5">
        {payload[0].value} عملية توزيع
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => (await api.get("/stats")).data,
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );

  const categoryStats = data?.category_stats || [];

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="animate-fade-up">
        <h1 className="text-3xl sm:text-4xl font-cairo font-extrabold text-slate-900">لوحة التحكم</h1>
        <p className="text-slate-500 font-tajawal mt-1">نظرة عامة على المخيم والمساعدات الموزّعة</p>
      </div>

      {/* البطاقات الرئيسية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <div
            key={c.key}
            data-testid={`stat-${c.key}`}
            className="glass-card rounded-2xl p-6 animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-tajawal font-bold text-slate-500">{c.label}</div>
                <div className="text-4xl font-cairo font-extrabold text-slate-900 mt-2">{data?.[c.key] ?? 0}</div>
              </div>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                <c.icon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* إحصائيات الفئات الخاصة */}
      {categoryStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 animate-fade-up">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-blue-500 to-blue-700" />
            <h2 className="text-xl font-cairo font-extrabold text-slate-800">إحصائيات الفئات الخاصة</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {categoryStats.map((c, i) => {
              const Icon = CATEGORY_KEY_ICONS[c.key] || CATEGORY_ICONS[c.icon] || Layers;
              const a = accentFor(c.key, i);
              return (
                <div
                  key={c.id}
                  data-testid={`category-stat-${c.key || c.id}`}
                  className="glass-card rounded-2xl p-4 flex flex-col items-center text-center animate-fade-up hover:-translate-y-0.5 transition-transform duration-200"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-md mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`text-3xl font-cairo font-extrabold ${a.text}`}>{c.count}</div>
                  <div className="text-xs font-tajawal font-bold text-slate-500 mt-1 leading-tight">{c.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* الرسم البياني الاحترافي */}
        <div className="glass-card rounded-2xl p-6 animate-fade-up">
          <h3 className="text-xl font-cairo font-bold text-slate-800 mb-6">المساعدات حسب النوع</h3>
          {data?.aid_by_type?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.aid_by_type} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <defs>
                  {BAR_COLORS.map((color, i) => (
                    <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "Tajawal", fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "Tajawal", fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[10, 10, 0, 0]} maxBarSize={56} name="عدد">
                  {data.aid_by_type.map((entry, i) => (
                    <Cell key={i} fill={`url(#barGrad-${i % BAR_COLORS.length})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-400 font-tajawal">لا توجد بيانات بعد</div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6 animate-fade-up">
          <h3 className="text-xl font-cairo font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" /> آخر العمليات
          </h3>
          <div className="space-y-3">
            {data?.recent_records?.length ? (
              data.recent_records.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                      <HandHeart className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-tajawal font-bold text-slate-800 text-sm">{r.aid_type_name || "مساعدة"}</div>
                      <div className="text-xs text-slate-400 font-tajawal">{r.date}</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-tajawal">{r.created_by}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 font-tajawal">لا توجد عمليات بعد</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
