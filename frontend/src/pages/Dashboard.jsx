import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { Users, HandHeart, Boxes, Loader2, Clock, UserRound } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

const cards = [
  { key: "total_families", label: "إجمالي العائلات", icon: Users, color: "from-blue-500 to-blue-700", bg: "bg-blue-50" },
  { key: "total_individual_members", label: "الأفراد المسجّلون", icon: UserRound, color: "from-purple-500 to-purple-700", bg: "bg-purple-50" },
  { key: "total_aid_records", label: "عمليات التوزيع", icon: HandHeart, color: "from-green-500 to-emerald-700", bg: "bg-green-50" },
  { key: "total_aid_types", label: "أنواع المساعدات", icon: Boxes, color: "from-amber-500 to-orange-600", bg: "bg-amber-50" },
];

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

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="animate-fade-up">
        <h1 className="text-3xl sm:text-4xl font-cairo font-extrabold text-slate-900">لوحة التحكم</h1>
        <p className="text-slate-500 font-tajawal mt-1">نظرة عامة على المخيم والمساعدات الموزّعة</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 animate-fade-up">
          <h3 className="text-xl font-cairo font-bold text-slate-800 mb-6">المساعدات حسب النوع</h3>
          {data?.aid_by_type?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.aid_by_type}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontFamily: "Tajawal", fontSize: 12, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontFamily: "Tajawal", fontSize: 12, fill: "#64748b" }} />
                <Tooltip contentStyle={{ fontFamily: "Tajawal", borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} name="عدد" />
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
