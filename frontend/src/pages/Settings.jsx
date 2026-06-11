import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Tag, Plus, Trash2, Loader2, UserCog, Shield, User as UserIcon, X, GripVertical, Layers,
    DatabaseBackup, Download, Upload, RotateCcw,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "نص" },
  { value: "number", label: "رقم" },
  { value: "date", label: "تاريخ" },
  { value: "tel", label: "هاتف" },
];

export default function Settings() {
  return (
    <div className="space-y-8" data-testid="settings-page">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-cairo font-extrabold text-slate-900">الإعدادات</h1>
        <p className="text-slate-500 font-tajawal mt-1">تعريف حقول العائلة وإدارة المستخدمين</p>
      </div>
      <FieldsSection />
      <CategoryFieldsSection />
      <UsersSection />
      <BackupSection />
    </div>
  );
}

function BackupSection() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const fileRef = useRef();
  const [backingUp, setBackingUp] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null); // { payload, fileName, counts }

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { data } = await api.get("/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      link.href = URL.createObjectURL(blob);
      link.download = `camp-backup-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("تم إنشاء النسخة الاحتياطية وتحميلها");
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "تعذّر إنشاء النسخة الاحتياطية");
    } finally {
      setBackingUp(false);
    }
  };

  const handleFile = async (file) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.data || typeof payload.data !== "object") {
        return toast.error("ملف غير صالح. الرجاء اختيار ملف نسخة احتياطية صحيح (.json)");
      }
      const counts = Object.entries(payload.data).reduce((acc, [k, v]) => {
        acc[k] = v && typeof v === "object" ? Object.keys(v).length : 0;
        return acc;
      }, {});
      setPendingRestore({ payload, fileName: file.name, counts });
    } catch {
      toast.error("تعذّر قراءة الملف. تأكد أنه ملف نسخة احتياطية بصيغة JSON");
    }
  };

  const restoreMut = useMutation({
    mutationFn: () => api.post("/restore", pendingRestore.payload),
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast.success(`تمت استعادة البيانات بنجاح (${r.data.restored} قسم)`);
      setPendingRestore(null);
    },
    onError: (e) => { toast.error(apiError(e.response?.data?.detail) || "فشلت الاستعادة"); setPendingRestore(null); },
  });

  if (!isAdmin) return null;

  const totalRecords = pendingRestore
    ? Object.values(pendingRestore.counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <section className="glass-card rounded-2xl p-6 animate-fade-up" data-testid="backup-section">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/25">
          <DatabaseBackup className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-cairo font-bold text-slate-800">النسخ الاحتياطي والاستعادة</h2>
          <p className="text-sm text-slate-500 font-tajawal">احفظ نسخة كاملة من بيانات المخيم أو استعدها عند الحاجة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Backup */}
        <div className="bg-white/70 border border-slate-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <Download className="w-5 h-5 text-emerald-600" />
            <span className="font-cairo font-bold text-slate-800">نسخة احتياطية</span>
          </div>
          <p className="text-sm font-tajawal text-slate-500 mb-4 flex-1">
            تنزيل ملف يحتوي على جميع العائلات والمساعدات والفئات الخاصة وحقولها.
          </p>
          <button onClick={handleBackup} disabled={backingUp} data-testid="backup-button"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60 shadow-md shadow-emerald-600/25">
            {backingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            إنشاء نسخة احتياطية
          </button>
        </div>

        {/* Restore */}
        <div className="bg-white/70 border border-slate-100 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <span className="font-cairo font-bold text-slate-800">استعادة نسخة</span>
          </div>
          <p className="text-sm font-tajawal text-slate-500 mb-4 flex-1">
            رفع ملف نسخة احتياطية لاستعادة البيانات. <span className="font-bold text-amber-700">سيستبدل البيانات الحالية.</span>
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="restore-file-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} data-testid="restore-button"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all shadow-md shadow-amber-600/25">
            <Upload className="w-5 h-5" /> اختيار ملف واستعادة
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingRestore}
        title="استعادة نسخة احتياطية"
        message={`سيتم استبدال جميع البيانات الحالية ببيانات الملف "${pendingRestore?.fileName || ""}" (${totalRecords} سجل). لا يمكن التراجع عن هذه العملية. هل تريد المتابعة؟`}
        confirmLabel={restoreMut.isPending ? "جارٍ الاستعادة..." : "نعم، استعِد البيانات"}
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={() => restoreMut.mutate()}
        onCancel={() => setPendingRestore(null)}
      />
    </section>
  );
}

function FieldsSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ label: "", type: "text" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { data: fields = [], isLoading } = useQuery({ queryKey: ["fields"], queryFn: async () => (await api.get("/family-fields")).data });

  const addMut = useMutation({
    mutationFn: () => api.post("/family-fields", { label: form.label, type: form.type, order: fields.length }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fields"] }); setForm({ label: "", type: "text" }); toast.success("تمت إضافة الحقل"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/family-fields/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fields"] }); toast.success("تم حذف الحقل"); },
  });

  return (
    <section className="glass-card rounded-2xl p-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/25"><Tag className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="text-xl font-cairo font-bold text-slate-800">حقول العائلة</h2>
          <p className="text-sm text-slate-500 font-tajawal">أضف الحقول التي تريد تسجيلها لكل عائلة</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (form.label.trim()) addMut.mutate(); }} className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} data-testid="field-label-input"
          placeholder="اسم الحقل (مثال: اسم رب الأسرة)"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="field-type-select"
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50">
          {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="submit" disabled={addMut.isPending} data-testid="add-field-button"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25">
          {addMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} إضافة
        </button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 font-tajawal text-slate-400">لا توجد حقول بعد</div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-white/70 border border-slate-100 rounded-xl px-4 py-3" data-testid={`field-${f.id}`}>
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-300" />
                <span className="font-tajawal font-semibold text-slate-800">{f.label}</span>
                <span className="text-xs font-tajawal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{FIELD_TYPES.find((t) => t.value === f.type)?.label}</span>
              </div>
              <button onClick={() => setConfirmDelete(f.id)}
                data-testid={`delete-field-${f.id}`} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف الحقل"
        message="هل تريد حذف هذا الحقل نهائياً؟ سيؤثر ذلك على جميع العائلات المسجّلة."
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

function CategoryFieldsSection() {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [form, setForm] = useState({ label: "", type: "text" });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const activeId = categoryId || categories[0]?.id || "";

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["category-fields", activeId],
    queryFn: async () => (await api.get(`/category-fields?category_id=${activeId}`)).data,
    enabled: !!activeId,
  });

  const addMut = useMutation({
    mutationFn: () => api.post("/category-fields", { category_id: activeId, label: form.label, type: form.type, order: fields.length }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["category-fields", activeId] }); setForm({ label: "", type: "text" }); toast.success("تمت إضافة الخانة"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/category-fields/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["category-fields", activeId] }); toast.success("تم حذف الخانة"); },
  });

  return (
    <section className="glass-card rounded-2xl p-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md shadow-violet-500/25"><Layers className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="text-xl font-cairo font-bold text-slate-800">خانات الفئات الخاصة</h2>
          <p className="text-sm text-slate-500 font-tajawal">حدّد الخانات (الحقول) لكل فئة على حدة — أرامل، حوامل، مرضى، إصابات...</p>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">اختر الفئة</label>
        <select value={activeId} onChange={(e) => setCategoryId(e.target.value)} data-testid="category-select-settings"
          className="w-full sm:w-64 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-violet-500/50">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (form.label.trim() && activeId) addMut.mutate(); }} className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} data-testid="category-field-label-input"
          placeholder="اسم الخانة (مثال: نوع الإصابة، عمر الطفل، حالة المرض)"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="category-field-type-select"
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-violet-500/50">
          {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="submit" disabled={addMut.isPending || !activeId} data-testid="add-category-field-button"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-60 shadow-md shadow-violet-600/25">
          {addMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} إضافة
        </button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 font-tajawal text-slate-400">لا توجد خانات لهذه الفئة بعد</div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-white/70 border border-slate-100 rounded-xl px-4 py-3" data-testid={`category-field-${f.id}`}>
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-300" />
                <span className="font-tajawal font-semibold text-slate-800">{f.label}</span>
                <span className="text-xs font-tajawal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{FIELD_TYPES.find((t) => t.value === f.type)?.label}</span>
              </div>
              <button onClick={() => setConfirmDelete(f.id)}
                data-testid={`delete-category-field-${f.id}`} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف الخانة"
        message="هل تريد حذف هذه الخانة نهائياً؟ سيؤثر على سجلات هذه الفئة."
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("تم حذف المستخدم"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }) => api.put(`/users/${id}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("تم تحديث الصلاحية"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <section className="glass-card rounded-2xl p-6 animate-fade-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-md shadow-green-500/25"><UserCog className="w-5 h-5 text-white" /></div>
          <div>
            <h2 className="text-xl font-cairo font-bold text-slate-800">المستخدمون والصلاحيات</h2>
            <p className="text-sm text-slate-500 font-tajawal">أضف موظفين أو مدراء للنظام</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} data-testid="add-user-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md shadow-blue-600/25">
          <Plus className="w-5 h-5" /> مستخدم جديد
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-white/70 border border-slate-100 rounded-xl px-4 py-3" data-testid={`user-${u.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold font-cairo">{u.name?.[0] || "?"}</div>
                <div>
                  <div className="font-tajawal font-bold text-slate-800">{u.name}</div>
                  <div className="text-xs text-slate-400 font-tajawal">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.id === user.id ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-tajawal font-bold ${u.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {u.role === "admin" ? <Shield className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                    {u.role === "admin" ? "مدير" : "موظف"}
                  </span>
                ) : (
                  <>
                    <select
                      value={u.role}
                      disabled={roleMut.isPending}
                      onChange={(e) => roleMut.mutate({ id: u.id, role: e.target.value })}
                      data-testid={`role-select-${u.id}`}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-tajawal font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                    >
                      <option value="admin">مدير</option>
                      <option value="staff">موظف</option>
                    </select>
                    <button onClick={() => setConfirmDelete(u.id)}
                      data-testid={`delete-user-${u.id}`} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف المستخدم"
        message="هل تريد حذف هذا المستخدم نهائياً من النظام؟"
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

function AddUserModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const mut = useMutation({
    mutationFn: () => api.post("/users", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("تمت إضافة المستخدم بنجاح"); onClose(); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-7 w-full max-w-md animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="user-modal">
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-blue-600 to-indigo-600" />
        <div className="flex items-center justify-between mb-5 mt-2">
          <h3 className="text-xl font-cairo font-bold text-slate-900">مستخدم جديد</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الاسم</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">كلمة المرور</label>
            <input required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الصلاحية</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-role-select"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="staff">موظف</option>
              <option value="admin">مدير</option>
            </select>
          </div>
          <button type="submit" disabled={mut.isPending} data-testid="save-user-button"
            className="w-full bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ
          </button>
        </form>
      </div>
    </div>
  );
}
