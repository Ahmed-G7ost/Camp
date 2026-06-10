import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { Boxes, Plus, Trash2, Loader2, X } from "lucide-react";

export default function AidTypes() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: types = [], isLoading } = useQuery({ queryKey: ["aid-types"], queryFn: async () => (await api.get("/aid-types")).data });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/aid-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aid-types"] }); toast.success("تم حذف النوع بنجاح"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="aid-types-page">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">أنواع المساعدات</h1>
          <p className="text-slate-500 font-tajawal mt-1">عرّف تصنيفات المساعدات الخاصة بمخيمك</p>
        </div>
        <button onClick={() => setShowAdd(true)} data-testid="add-aid-type-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md shadow-blue-600/25">
          <Plus className="w-5 h-5" /> إضافة نوع
        </button>
      </div>

      {types.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد أنواع مساعدات. أضف أول نوع (مثل: غذائية، طبية...)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
          {types.map((t) => (
            <div key={t.id} className="glass-card rounded-2xl p-5 flex items-start justify-between" data-testid={`aid-type-${t.id}`}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
                  <Boxes className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-cairo font-bold text-slate-800">{t.name}</div>
                  {t.description && <div className="text-sm text-slate-500 font-tajawal mt-0.5">{t.description}</div>}
                </div>
              </div>
              <button onClick={() => setConfirmDelete(t.id)}
                data-testid={`delete-aid-type-${t.id}`} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddTypeModal onClose={() => setShowAdd(false)} />}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف نوع المساعدة"
        message="هل تريد حذف هذا النوع نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AddTypeModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "" });
  const mut = useMutation({
    mutationFn: () => api.post("/aid-types", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aid-types"] }); toast.success("تمت إضافة النوع بنجاح"); onClose(); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-7 w-full max-w-md animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="aid-type-modal">
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-amber-500 to-orange-500" />
        <div className="flex items-center justify-between mb-5 mt-2">
          <h3 className="text-xl font-cairo font-bold text-slate-900">إضافة نوع مساعدة</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">اسم النوع</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="aid-type-name-input" placeholder="مثال: سلة غذائية"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">وصف (اختياري)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              data-testid="aid-type-desc-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <button type="submit" disabled={mut.isPending} data-testid="save-aid-type-button"
            className="w-full bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-amber-500/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ
          </button>
        </form>
      </div>
    </div>
  );
}
