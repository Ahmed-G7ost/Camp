import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  UserRound, Plus, Trash2, Pencil, Loader2, X, Search,
  Phone, Users, Calendar, CreditCard, User,
} from "lucide-react";

function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function FamilyMembers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // {mode:'add'|'edit', member}
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["family-members"],
    queryFn: async () => (await api.get("/family-members")).data,
  });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/family-members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-members"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم حذف السجل بنجاح");
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const filtered = members.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (m.head_name || "").toLowerCase().includes(s) ||
      (m.head_id || "").toLowerCase().includes(s) ||
      (m.wife_name || "").toLowerCase().includes(s) ||
      (m.phone || "").toLowerCase().includes(s)
    );
  });

  if (isLoading)
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="family-members-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">أفراد العائلة</h1>
          <p className="text-slate-500 font-tajawal mt-1">{members.length} سجل مسجّل</p>
        </div>
        <button onClick={() => setModal({ mode: "add" })} data-testid="add-family-member-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all shadow-md shadow-purple-600/25">
          <Plus className="w-5 h-5" /> إضافة عائلة
        </button>
      </div>

      <div className="relative animate-fade-up">
        <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="family-members-search"
          placeholder="بحث بالاسم أو رقم الهوية أو الهاتف..."
          className="w-full bg-white border border-slate-200 rounded-xl ps-12 pe-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <UserRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-cairo font-bold text-slate-700 text-lg mb-2">لا توجد سجلات</h3>
          <p className="font-tajawal text-slate-500">ابدأ بإضافة أول سجل عائلة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
          {filtered.map((m) => (
            <FamilyMemberCard
              key={m.id}
              member={m}
              onEdit={() => setModal({ mode: "edit", member: m })}
              onDelete={() => setConfirmDelete(m.id)}
            />
          ))}
        </div>
      )}

      {modal && <FamilyMemberModal modal={modal} onClose={() => setModal(null)} />}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف سجل العائلة"
        message="هل تريد حذف هذا السجل وجميع الأفراد المرتبطين به نهائياً؟"
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function FamilyMemberCard({ member: m, onEdit, onDelete }) {
  const headAge = m.head_age || calcAgeLabel(m.head_birth_date);
  const wifeAge = m.wife_age || calcAgeLabel(m.wife_birth_date);

  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-up" data-testid={`family-member-card-${m.id}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-md shadow-purple-500/30">
            <UserRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-cairo font-extrabold text-slate-900 text-base">{m.head_name}</h3>
            <div className="flex items-center gap-1 text-xs text-slate-400 font-tajawal mt-0.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>{m.head_id}</span>
              {headAge && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-bold mr-1">{headAge}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} data-testid={`edit-family-member-${m.id}`}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} data-testid={`delete-family-member-${m.id}`}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {m.wife_name && (
          <div className="bg-pink-50/60 rounded-xl px-3 py-2.5 border border-pink-100">
            <div className="text-xs font-tajawal font-bold text-pink-400 mb-0.5 flex items-center gap-1">
              <User className="w-3 h-3" /> الزوجة
            </div>
            <div className="font-tajawal font-semibold text-slate-800 text-sm">{m.wife_name}</div>
            {m.wife_id && <div className="text-xs text-slate-500 font-tajawal">{m.wife_id}</div>}
            {wifeAge && <div className="text-xs text-pink-500 font-tajawal font-bold mt-0.5">{wifeAge}</div>}
          </div>
        )}
        <div className="bg-blue-50/60 rounded-xl px-3 py-2.5 border border-blue-100">
          <div className="text-xs font-tajawal font-bold text-blue-400 mb-0.5 flex items-center gap-1">
            <Phone className="w-3 h-3" /> الهاتف
          </div>
          <div className="font-tajawal font-semibold text-slate-800 text-sm">{m.phone}</div>
        </div>
        <div className="bg-green-50/60 rounded-xl px-3 py-2.5 border border-green-100">
          <div className="text-xs font-tajawal font-bold text-green-400 mb-0.5 flex items-center gap-1">
            <Users className="w-3 h-3" /> عدد الأفراد
          </div>
          <div className="font-cairo font-extrabold text-slate-900 text-xl">{m.members_count}</div>
        </div>
        {m.head_birth_date && (
          <div className="bg-slate-50/60 rounded-xl px-3 py-2.5 border border-slate-100">
            <div className="text-xs font-tajawal font-bold text-slate-400 mb-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> ميلاد رب الأسرة
            </div>
            <div className="font-tajawal text-slate-700 text-sm">{formatDateDMY(m.head_birth_date)}</div>
          </div>
        )}
      </div>

      {m.notes && (
        <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <div className="text-xs font-tajawal text-slate-500">{m.notes}</div>
        </div>
      )}
    </div>
  );
}

function FamilyMemberModal({ modal, onClose }) {
  const qc = useQueryClient();
  const init = modal.member || {};
  const [form, setForm] = useState({
    head_id: init.head_id || "",
    head_name: init.head_name || "",
    head_birth_date: init.head_birth_date || "",
    head_age: init.head_age || calcAgeLabel(init.head_birth_date),
    wife_id: init.wife_id || "",
    wife_name: init.wife_name || "",
    wife_birth_date: init.wife_birth_date || "",
    wife_age: init.wife_age || calcAgeLabel(init.wife_birth_date),
    phone: init.phone || "",
    members_count: init.members_count || "",
    notes: init.notes || "",
  });

  const mut = useMutation({
    mutationFn: () =>
      modal.mode === "add"
        ? api.post("/family-members", { ...form, members_count: Number(form.members_count) })
        : api.put(`/family-members/${modal.member.id}`, { ...form, members_count: Number(form.members_count) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-members"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(modal.mode === "add" ? "تمت إضافة السجل بنجاح" : "تم تحديث السجل بنجاح");
      onClose();
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const Field = ({ label, field, type = "text", required = false, hint }) => (
    <div>
      <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-xs text-slate-400 font-normal mr-1">({hint})</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[field]}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        data-testid={`fm-field-${field}`}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative rounded-3xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="family-member-modal"
      >
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-purple-600 to-purple-400" />
        <div className="flex items-center justify-between mb-6 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-md shadow-purple-500/30">
              <UserRound className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-cairo font-bold text-slate-900">
              {modal.mode === "add" ? "إضافة سجل عائلة" : "تعديل سجل العائلة"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-5">
          {/* رب الأسرة */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-cairo font-bold text-blue-800 text-sm">بيانات رب الأسرة</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="رقم الهوية" field="head_id" required />
              <Field label="الاسم الكامل" field="head_name" required />
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">
                  تاريخ الميلاد <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={toISO(form.head_birth_date)}
                  onChange={(e) => setForm({ ...form, head_birth_date: e.target.value, head_age: calcAgeLabel(e.target.value) })}
                  data-testid="fm-field-head_birth_date"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">العمر</label>
                <input
                  type="text"
                  value={form.head_age}
                  onChange={(e) => setForm({ ...form, head_age: e.target.value })}
                  placeholder="يُحسب تلقائياً"
                  data-testid="fm-field-head_age"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
          </div>

          {/* الزوجة */}
          <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-pink-500 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-cairo font-bold text-pink-800 text-sm">بيانات الزوجة (اختياري)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="رقم هوية الزوجة" field="wife_id" />
              <Field label="اسم الزوجة" field="wife_name" />
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">تاريخ الميلاد</label>
                <input
                  type="date"
                  value={toISO(form.wife_birth_date)}
                  onChange={(e) => setForm({ ...form, wife_birth_date: e.target.value, wife_age: calcAgeLabel(e.target.value) })}
                  data-testid="fm-field-wife_birth_date"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">العمر</label>
                <input
                  type="text"
                  value={form.wife_age}
                  onChange={(e) => setForm({ ...form, wife_age: e.target.value })}
                  placeholder="يُحسب تلقائياً"
                  data-testid="fm-field-wife_age"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="رقم الهاتف" field="phone" type="tel" required />
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">
                عدد أفراد العائلة <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.members_count}
                onChange={(e) => setForm({ ...form, members_count: e.target.value })}
                data-testid="fm-field-members_count"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              data-testid="fm-field-notes"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={mut.isPending}
            data-testid="save-family-member-button"
            className="w-full bg-gradient-to-l from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-purple-600/25"
          >
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ السجل
          </button>
        </form>
      </div>
    </div>
  );
}
