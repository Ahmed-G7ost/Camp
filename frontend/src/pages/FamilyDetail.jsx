import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { namePalette, GenderBadge, isGenderField } from "../components/Colorize";
import { isBirthDateField, calcAgeLabel, formatDateDMY, ageKeyOf } from "../lib/age";
import {
  ArrowRight, Loader2, HandHeart, Plus, Trash2, Calendar, X, AlertTriangle,
} from "lucide-react";

export default function FamilyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: families = [] } = useQuery({ queryKey: ["families"], queryFn: async () => (await api.get("/families")).data });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: async () => (await api.get("/family-fields")).data });
  const { data: aidTypes = [] } = useQuery({ queryKey: ["aid-types"], queryFn: async () => (await api.get("/aid-types")).data });
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["aid-records", id],
    queryFn: async () => (await api.get(`/aid-records?family_id=${id}`)).data,
  });

  const family = families.find((f) => f.id === id);

  const delMut = useMutation({
    mutationFn: (rid) => api.delete(`/aid-records/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aid-records", id] }); toast.success("تم حذف السجل"); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!family) return <div className="text-center py-20 font-tajawal text-slate-500">العائلة غير موجودة</div>;

  const familyName = family.data?.[fields[0]?.key] || "عائلة";
  const p = namePalette(familyName);

  return (
    <div className="space-y-6" data-testid="family-detail-page">
      <button onClick={() => navigate("/families")} data-testid="back-button"
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-tajawal font-semibold transition-colors">
        <ArrowRight className="w-5 h-5" /> رجوع للعائلات
      </button>

      <div className="glass-card rounded-2xl p-6 animate-fade-up">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-cairo font-extrabold text-2xl"
            style={{ background: p.grad, boxShadow: `0 8px 20px ${p.ring}` }}>
            {String(familyName).trim().charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-cairo font-extrabold" style={{ color: p.text }}>{familyName}</h1>
            <p className="text-slate-500 font-tajawal text-sm">{records.length} عملية مساعدة</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fields.map((f) => (
            <div key={f.id} className="bg-white/60 rounded-xl px-4 py-3 border border-slate-100">
              <div className="text-xs font-tajawal font-bold text-slate-400">{f.label}</div>
              <div className="font-tajawal font-semibold text-slate-800 mt-0.5">
                {isGenderField(f.label) ? (
                  <GenderBadge value={family.data?.[f.key]} />
                ) : f.type === "date" ? (formatDateDMY(family.data?.[f.key]) || "—") : (family.data?.[f.key] || "—")}
                {isBirthDateField(f) && (family.data?.[ageKeyOf(f.key)] || calcAgeLabel(family.data?.[f.key])) && (
                  <span className="mr-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold" data-testid={`family-detail-age-${f.key}`}>
                    العمر: {family.data?.[ageKeyOf(f.key)] || calcAgeLabel(family.data?.[f.key])}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="text-xl font-cairo font-bold text-slate-800">سجل المساعدات</h2>
        <button onClick={() => { if (!aidTypes.length) return toast.error("أضف أنواع المساعدات أولاً"); setShowAdd(true); }}
          data-testid="add-aid-record-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-600/25">
          <Plus className="w-5 h-5" /> تسجيل مساعدة
        </button>
      </div>

      {records.length === 0 ? (
        <div className="glass-card rounded-2xl p-14 text-center animate-fade-up">
          <HandHeart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لم يتم تسجيل أي مساعدة لهذه العائلة بعد</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up">
          {records.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between" data-testid={`aid-record-${r.id}`}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
                  <HandHeart className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-cairo font-bold text-slate-800">{r.aid_type_name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-tajawal mt-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {r.date}</span>
                    {r.quantity && <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">الكمية: {r.quantity}</span>}
                  </div>
                  {r.notes && <div className="text-sm text-slate-500 font-tajawal mt-1">{r.notes}</div>}
                </div>
              </div>
              <button onClick={() => setConfirmDelete(r.id)}
                data-testid={`delete-aid-record-${r.id}`} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAidModal familyId={id} aidTypes={aidTypes} records={records} onClose={() => setShowAdd(false)} />}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف سجل المساعدة"
        message="هل تريد حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AddAidModal({ familyId, aidTypes, records, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    aid_type_id: aidTypes[0]?.id || "",
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    notes: "",
  });

  // ── Duplicate check ────────────────────────────────────────────────────────
  const dupWarning = useMemo(() => {
    if (!form.aid_type_id || !form.date) return null;
    const selDate = new Date(form.date);
    const matching = (records || [])
      .filter((r) => r.family_id === familyId && r.aid_type_id === form.aid_type_id && r.date)
      .map((r) => {
        const diffDays = Math.floor((selDate - new Date(r.date)) / 86400000);
        return { ...r, diffDays };
      })
      .filter((r) => r.diffDays >= 0 && r.diffDays <= 7)
      .sort((a, b) => a.diffDays - b.diffDays);
    if (!matching.length) return null;
    const rec = matching[0];
    return { daysAgo: rec.diffDays, date: rec.date, aidTypeName: rec.aid_type_name };
  }, [records, familyId, form.aid_type_id, form.date]);

  const mut = useMutation({
    mutationFn: () => api.post("/aid-records", { family_id: familyId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aid-records", familyId] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم تسجيل المساعدة بنجاح");
      onClose();
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-7 w-full max-w-lg animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="aid-record-modal">
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-green-500 to-emerald-500" />
        <div className="flex items-center justify-between mb-5 mt-2">
          <h3 className="text-xl font-cairo font-bold text-slate-900">تسجيل مساعدة</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">نوع المساعدة</label>
            <select value={form.aid_type_id} onChange={(e) => setForm({ ...form, aid_type_id: e.target.value })}
              data-testid="aid-type-select"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50">
              {aidTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">التاريخ</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              data-testid="aid-date-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الكمية (اختياري)</label>
            <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              data-testid="aid-quantity-input" placeholder="مثال: 2 سلة غذائية"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              data-testid="aid-notes-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
          </div>
          {dupWarning && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" data-testid="duplicate-aid-warning">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-tajawal font-bold text-amber-800 text-sm">تنبيه: تكرار محتمل</p>
                <p className="font-tajawal text-amber-700 text-sm mt-0.5">
                  هذه العائلة استلمت <span className="font-bold">{dupWarning.aidTypeName}</span>{" "}
                  {dupWarning.daysAgo === 0
                    ? "في نفس اليوم"
                    : `قبل ${dupWarning.daysAgo} ${dupWarning.daysAgo === 1 ? "يوم" : "أيام"}`}
                  {" "}({dupWarning.date})
                </p>
              </div>
            </div>
          )}
          <button type="submit" disabled={mut.isPending} data-testid="save-aid-record-button"
            className="w-full bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-green-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ المساعدة
          </button>
        </form>
      </div>
    </div>
  );
}
