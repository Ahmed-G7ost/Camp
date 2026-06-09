import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Loader2, Layers, ChevronLeft,
  HeartHandshake, Baby, Milk, ToyBrick, Stethoscope, Accessibility, Bandage,
} from "lucide-react";

const ICONS = {
  HeartHandshake, Baby, Milk, ToyBrick, Stethoscope, Accessibility, Bandage, Layers,
};

const ACCENTS = [
  { from: "from-rose-500", to: "to-pink-600", soft: "bg-rose-50", text: "text-rose-700", shadow: "shadow-rose-500/25" },
  { from: "from-violet-500", to: "to-purple-600", soft: "bg-violet-50", text: "text-violet-700", shadow: "shadow-violet-500/25" },
  { from: "from-sky-500", to: "to-blue-600", soft: "bg-sky-50", text: "text-sky-700", shadow: "shadow-sky-500/25" },
  { from: "from-amber-500", to: "to-orange-600", soft: "bg-amber-50", text: "text-amber-700", shadow: "shadow-amber-500/25" },
  { from: "from-emerald-500", to: "to-teal-600", soft: "bg-emerald-50", text: "text-emerald-700", shadow: "shadow-emerald-500/25" },
  { from: "from-indigo-500", to: "to-blue-700", soft: "bg-indigo-50", text: "text-indigo-700", shadow: "shadow-indigo-500/25" },
  { from: "from-red-500", to: "to-rose-600", soft: "bg-red-50", text: "text-red-700", shadow: "shadow-red-500/25" },
];

export default function Categories() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className="space-y-6" data-testid="categories-page">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-cairo font-extrabold text-slate-900">الفئات الخاصة</h1>
        <p className="text-slate-500 font-tajawal mt-1">
          سجّل بيانات الأرامل والحوامل والمرضعات والأطفال والمرضى وكبار السن والإصابات
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c, i) => {
          const Icon = ICONS[c.icon] || Layers;
          const a = ACCENTS[i % ACCENTS.length];
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/categories/${c.id}`)}
              data-testid={`category-card-${c.id}`}
              className="group text-start glass-card rounded-2xl p-5 hover:shadow-lg transition-all duration-200 animate-fade-up flex items-center gap-4"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${a.from} ${a.to} flex items-center justify-center shadow-md ${a.shadow} shrink-0`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-cairo font-extrabold text-slate-900 text-lg truncate">{c.name}</div>
                <div className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-tajawal font-bold ${a.soft} ${a.text}`}>
                  {c.count || 0} سجل
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:-translate-x-1 transition-all shrink-0" />
            </button>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد فئات</p>
        </div>
      )}
    </div>
  );
}
