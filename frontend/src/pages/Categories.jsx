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
          const Icon = CATEGORY_KEY_ICONS[c.key] || ICONS[c.icon] || Layers;
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
