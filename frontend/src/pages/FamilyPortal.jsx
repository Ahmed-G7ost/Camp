import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Tent,
  Users,
  Edit2,
  Save,
  X,
  Loader2,
  UserPlus,
  Trash2,
  LogOut,
  Inbox,
  ShieldAlert,
} from "lucide-react";

const EMPTY_MEMBER = {
  name: "",
  id_number: "",
  birth_date: "",
  age: "",
  relation: "",
  gender: "",
  notes: "",
};

export default function FamilyPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [fields, setFields] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [newMember, setNewMember] = useState(EMPTY_MEMBER);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fieldsRes, familyRes, membersRes] = await Promise.all([
        api.get("/family-fields"),
        api.get(`/families/${user?.family_id}`),
        api.get(`/individual-members?family_id=${user?.family_id}`),
      ]);
      setFields(fieldsRes.data || []);
      setFamily(familyRes.data || {});
      setEditData(familyRes.data?.data || {});
      setMembers(membersRes.data || []);
      // أول دخول للعائلة: افتح وضع التعديل الكامل تلقائياً
      if (familyRes.data && !familyRes.data.profile_completed) setEditing(true);
    } catch (err) {
      console.error("خطأ في تحميل البيانات:", err);
      toast.error(err.message || "فشل تحميل البيانات");
      setFields([]);
      setFamily(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "family") {
      navigate("/family-login");
      return;
    }
    loadData();
  }, [user, navigate, loadData]);

  const handleSave = async () => {
    try {
      setSaving(true);
            const wasFirstEdit = family && !family.profile_completed;
      await api.put(`/families/${user.family_id}`, {
        data: editData,
        ...(wasFirstEdit ? { profile_completed: true } : {}),
      });
      toast.success(
        wasFirstEdit
          ? "تم حفظ بياناتك بنجاح. أصبح التعديل الآن محدوداً."
          : "تم حفظ التعديلات بنجاح"
      );
      setFamily({ ...family, data: editData, ...(wasFirstEdit ? { profile_completed: true } : {}) });
      setEditing(false);
      await loadData();
    } catch (err) {
      console.error("خطأ في حفظ التعديلات:", err);
      toast.error("فشل حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) {
      toast.error("الرجاء إدخال اسم الفرد");
      return;
    }
    try {
      setSavingMember(true);
      const response = await api.post("/individual-members", {
        family_id: user.family_id,
        ...newMember,
      });
      toast.success("تمت إضافة الفرد بنجاح");
      setMembers([...members, response.data]);
      setShowAddMember(false);
      setNewMember(EMPTY_MEMBER);
      await loadData();
    } catch (err) {
      console.error("خطأ في إضافة الفرد:", err);
      toast.error("فشل إضافة الفرد");
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (memberId) => {
    try {
      await api.delete(`/individual-members/${memberId}`);
      toast.success("تم حذف الفرد بنجاح");
      setMembers(members.filter((m) => m.id !== memberId));
      await loadData();
    } catch (err) {
      console.error("خطأ في حذف الفرد:", err);
      toast.error("فشل حذف الفرد");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const PortalHeader = () => (
    <header className="glass-card border-x-0 border-t-0 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-600/30">
            <Tent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-cairo font-extrabold text-slate-900 leading-tight">
              مخيم العائدين
            </h1>
            <p className="text-xs text-slate-500 font-tajawal">بوابة العائلات</p>
          </div>
        </div>
        <button
          onClick={logout}
          data-testid="family-logout-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">تسجيل خروج</span>
        </button>
      </div>
    </header>
  );

  if (!family) {
    return (
      <div className="min-h-screen">
        <PortalHeader />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="glass-card rounded-3xl p-12 text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-tajawal text-lg">
              لا توجد بيانات لعرضها. الرجاء التواصل مع الإدارة.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const editableFieldKeys = [
    "phone", "mobile", "address", "location", "notes", "birth", "age",
    "تاريخ", "ميلاد", "جوال", "هاتف", "عنوان",
  ];
  const editableFields = fields.filter((f) =>
    editableFieldKeys.some(
      (key) =>
        f.key.toLowerCase().includes(key.toLowerCase()) ||
        f.label.includes("هاتف") ||
        f.label.includes("عنوان") ||
        f.label.includes("ملاحظ") ||
        f.label.includes("جوال") ||
        f.label.includes("تاريخ") ||
        f.label.includes("ميلاد") ||
        f.label.includes("عمر")
    )
  );

  const familyName = family?.data?.[fields[0]?.key] || "عائلتي";
  const isFirstEdit = !family?.profile_completed;

  return (
    <div className="min-h-screen pb-12">
      <PortalHeader />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome banner */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 animate-fade-up bg-gradient-to-l from-green-600 to-emerald-700 shadow-xl shadow-green-700/20">
          <div className="absolute -left-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -left-2 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-50 font-tajawal text-sm">مرحباً بك في بوابتك الخاصة</p>
              <h2 className="text-xl sm:text-2xl font-cairo font-extrabold text-white truncate">
                {familyName}
              </h2>
            </div>
          </div>
        </div>

        {/* تنبيه أول دخول — تعديل كامل لمرة واحدة */}
        {isFirstEdit && (
          <div
            data-testid="first-edit-banner"
            className="relative overflow-hidden rounded-3xl p-5 sm:p-6 animate-fade-up border border-amber-300/70 shadow-xl shadow-amber-500/15"
            style={{ background: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 55%,#fde68a 100%)" }}
          >
            <div className="absolute -left-6 -top-10 w-36 h-36 rounded-full bg-amber-400/20" />
            <div className="absolute left-12 -bottom-12 w-28 h-28 rounded-full bg-orange-400/10" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-600/30">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-cairo font-extrabold text-amber-900 mb-1.5">
                  تنبيه هام — هذه هي المرة الأولى لدخولك
                </h3>
                <p className="text-amber-800/90 font-tajawal leading-relaxed text-sm sm:text-[15px]">
                  يمكنك الآن تعديل{" "}
                  <span className="font-extrabold text-amber-900">جميع معلوماتك بالكامل</span>.
                  بعد الحفظ لأول مرة ستُقفل أغلب الحقول ويصبح التعديل{" "}
                  <span className="font-extrabold text-amber-900">محدوداً</span>، لذا يُرجى إدخال
                  بياناتك{" "}
                  <span className="font-extrabold text-amber-900">بدقّة</span> والتأكد من صحتها قبل
                  الحفظ.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* بيانات العائلة */}
        <section className="glass-card rounded-3xl p-6 animate-fade-up" data-testid="family-data-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h3 className="text-xl font-cairo font-bold text-slate-900 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </span>
              بيانات العائلة
            </h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 font-tajawal font-semibold rounded-xl hover:bg-blue-100 transition-all"
                data-testid="edit-family-button"
              >
                <Edit2 className="w-4 h-4" />
                تعديل البيانات
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-green-600 to-emerald-600 text-white font-tajawal font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 shadow-md shadow-green-600/25 transition-all disabled:opacity-60"
                  data-testid="save-family-button"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditData(family.data || {});
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 font-tajawal font-semibold rounded-xl hover:bg-slate-200 transition-all"
                >
                  <X className="w-4 h-4" />
                  إلغاء
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            {fields.map((field) => {
              const value = family?.data?.[field.key] || "—";
              const isEditable = isFirstEdit || editableFields.some((f) => f.key === field.key);
              const isDateField =
                field.label.includes("تاريخ") ||
                field.label.includes("ميلاد") ||
                field.key.toLowerCase().includes("birth") ||
                field.key.toLowerCase().includes("date");

              return (
                <div
                  key={field.key}
                  className={`rounded-2xl px-4 py-3 transition-colors ${
                    editing && isEditable ? "bg-blue-50/40" : "bg-slate-50/60"
                  }`}
                >
                  <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1.5">
                    {field.label}
                  </label>
                  {editing && isEditable ? (
                    <input
                      type={isDateField ? "date" : "text"}
                      value={editData[field.key] || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, [field.key]: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-tajawal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      data-testid={`edit-${field.key}`}
                      placeholder={isDateField ? "dd/mm/yyyy" : ""}
                    />
                  ) : (
                    <p className="text-slate-900 font-tajawal font-semibold">{value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* أفراد العائلة */}
        <section className="glass-card rounded-3xl p-6 animate-fade-up" data-testid="family-members-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h3 className="text-xl font-cairo font-bold text-slate-900 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-600" />
              </span>
              أفراد العائلة
              <span className="text-sm font-tajawal font-bold text-slate-400">
                ({members.length})
              </span>
            </h3>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-green-600 to-emerald-600 text-white font-tajawal font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 shadow-md shadow-green-600/25 transition-all"
              data-testid="add-member-button"
            >
              <UserPlus className="w-4 h-4" />
              إضافة فرد جديد
            </button>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-tajawal">لا توجد بيانات لأفراد العائلة</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-right py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">الاسم</th>
                      <th className="text-right py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">رقم الهوية</th>
                      <th className="text-right py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">العمر</th>
                      <th className="text-right py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">الجنس</th>
                      <th className="text-right py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">القرابة</th>
                      <th className="text-center py-3.5 px-4 font-cairo font-bold text-sm text-slate-600">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors"
                        data-testid={`member-row-${member.id}`}
                      >
                        <td className="py-3.5 px-4 font-tajawal font-semibold text-slate-900">{member.name}</td>
                        <td className="py-3.5 px-4 font-tajawal text-slate-600">{member.id_number || "—"}</td>
                        <td className="py-3.5 px-4 font-tajawal text-slate-600">{member.age || "—"}</td>
                        <td className="py-3.5 px-4 font-tajawal text-slate-600">{member.gender || "—"}</td>
                        <td className="py-3.5 px-4 font-tajawal text-slate-600">{member.relation || "—"}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setConfirmDelete(member.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                            data-testid={`delete-member-${member.id}`}
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* نافذة إضافة فرد جديد */}
      {showAddMember && (
        <AddMemberModal
          member={newMember}
          setMember={setNewMember}
          saving={savingMember}
          onSave={handleAddMember}
          onClose={() => {
            setShowAddMember(false);
            setNewMember(EMPTY_MEMBER);
          }}
        />
      )}

      {/* نافذة تأكيد الحذف */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف الفرد"
        message="هل أنت متأكد من حذف هذا الفرد من العائلة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="نعم، احذف"
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={() => {
          handleDeleteMember(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AddMemberModal({ member, setMember, saving, onSave, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const inputClass =
    "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" data-testid="add-member-modal">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
        onClick={onClose}
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl border border-white/30 shadow-2xl animate-fade-up"
        style={{
          background:
            "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
        }}
      >
        <div className="h-1 w-full bg-gradient-to-l from-green-600 to-emerald-400" />
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-md shadow-green-500/30">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-cairo font-extrabold text-slate-900">إضافة فرد جديد</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              data-testid="add-member-close"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">
                الاسم <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => setMember({ ...member, name: e.target.value })}
                  className={inputClass}
                  placeholder="اسم الفرد الكامل"
                  data-testid="new-member-name"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">رقم الهوية</label>
              <input
                type="text"
                value={member.id_number}
                onChange={(e) => setMember({ ...member, id_number: e.target.value })}
                className={inputClass}
                placeholder="رقم الهوية"
                data-testid="new-member-id"
              />
            </div>

            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">تاريخ الميلاد</label>
              <input
                type="date"
                value={member.birth_date}
                onChange={(e) => setMember({ ...member, birth_date: e.target.value })}
                className={inputClass}
                data-testid="new-member-birth-date"
              />
            </div>

            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">العمر</label>
              <input
                type="text"
                value={member.age}
                onChange={(e) => setMember({ ...member, age: e.target.value })}
                className={inputClass}
                placeholder="العمر"
                data-testid="new-member-age"
              />
            </div>

            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الجنس</label>
              <select
                value={member.gender}
                onChange={(e) => setMember({ ...member, gender: e.target.value })}
                className={inputClass}
                data-testid="new-member-gender"
              >
                <option value="">اختر الجنس</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">صلة القرابة</label>
              <input
                type="text"
                value={member.relation}
                onChange={(e) => setMember({ ...member, relation: e.target.value })}
                className={inputClass}
                placeholder="مثل: ابن، ابنة، زوجة"
                data-testid="new-member-relation"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">ملاحظات</label>
              <textarea
                value={member.notes}
                onChange={(e) => setMember({ ...member, notes: e.target.value })}
                className={inputClass}
                placeholder="ملاحظات إضافية"
                rows="2"
                data-testid="new-member-notes"
              ></textarea>
            </div>

            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-2xl font-tajawal font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[1.5] px-4 py-3 rounded-2xl font-tajawal font-bold text-white bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                data-testid="save-new-member-button"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                حفظ الفرد
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
