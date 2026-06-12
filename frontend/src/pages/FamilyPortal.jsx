import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Tent, Users, Edit2, Save, X, Loader2, UserPlus, Trash2 } from "lucide-react";

export default function FamilyPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [fields, setFields] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    id_number: "",
    birth_date: "",
    age: "",
    relation: "",
    gender: "",
    notes: ""
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fieldsRes, familyRes, membersRes] = await Promise.all([
        api.get("/family-fields"),
        api.get(`/families/${user?.family_id}`),
        api.get(`/individual-members?family_id=${user?.family_id}`)
      ]);
      setFields(fieldsRes.data || []);
      setFamily(familyRes.data || {});
      setEditData(familyRes.data?.data || {});
      setMembers(membersRes.data || []);
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
      navigate("/login");
      return;
    }
    loadData();
  }, [user, navigate, loadData]);
  const handleSave = async () => {
    try {
      await api.put(`/families/${user.family_id}`, { data: editData });
      toast.success("✅ تم حفظ التعديلات رسمياً في النظام");
      setFamily({ ...family, data: editData });
      setEditing(false);
      await loadData();
    } catch (err) {
      console.error("خطأ في حفظ التعديلات:", err);
      toast.error("❌ فشل حفظ التعديلات");
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim()) {
      toast.error("الرجاء إدخال اسم الفرد");
      return;
    }

    try {
      const response = await api.post("/individual-members", {
        family_id: user.family_id,
        ...newMember
      });
      toast.success("✅ تم إضافة الفرد رسمياً إلى النظام");
      setMembers([...members, response.data]);
      setShowAddMember(false);
      setNewMember({
        name: "",
        id_number: "",
        birth_date: "",
        age: "",
        relation: "",
        gender: "",
        notes: ""
      });
      await loadData();
    } catch (err) {
      console.error("خطأ في إضافة الفرد:", err);
      toast.error("❌ فشل إضافة الفرد");
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الفرد رسمياً من النظام؟")) {
      return;
    }

    try {
      await api.delete(`/individual-members/${memberId}`);
      toast.success("✅ تم حذف الفرد رسمياً من النظام");
      setMembers(members.filter(m => m.id !== memberId));
      await loadData();
    } catch (err) {
      console.error("خطأ في حذف الفرد:", err);
      toast.error("❌ فشل حذف الفرد");
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Tent className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-cairo font-bold text-slate-900">مخيم العائدين</h1>
                <p className="text-sm text-slate-500 font-tajawal">بوابة العائلات</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-50 text-red-600 font-tajawal rounded-lg hover:bg-red-100 transition-colors"
            >
              تسجيل خروج
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-slate-600 font-tajawal text-lg">لا توجد بيانات لعرضها. الرجاء التواصل مع الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const editableFieldKeys = ["phone", "mobile", "address", "location", "notes", "birth", "age", "تاريخ", "ميلاد", "جوال", "هاتف", "عنوان"];
  const editableFields = fields.filter(f => 
    editableFieldKeys.some(key => 
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Tent className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-cairo font-bold text-slate-900">مخيم العائدين</h1>
              <p className="text-sm text-slate-500 font-tajawal">بوابة العائلات</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-50 text-red-600 font-tajawal rounded-lg hover:bg-red-100 transition-colors"
          >
            تسجيل خروج
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* بيانات العائلة */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-cairo font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              بيانات العائلة
            </h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-tajawal rounded-lg hover:bg-blue-100 transition-colors"
                data-testid="edit-family-button"
              >
                <Edit2 className="w-4 h-4" />
                تعديل البيانات
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 font-tajawal rounded-lg hover:bg-green-100 transition-colors"
                  data-testid="save-family-button"
                >
                  <Save className="w-4 h-4" />
                  حفظ
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditData(family.data || {});
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 font-tajawal rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                  إلغاء
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              const value = family?.data?.[field.key] || "-";
              const isEditable = editableFields.some(f => f.key === field.key);
              
              const isDateField = field.label.includes("تاريخ") || 
                                  field.label.includes("ميلاد") || 
                                  field.key.toLowerCase().includes("birth") ||
                                  field.key.toLowerCase().includes("date");
              
              return (
                <div key={field.key} className="border-b pb-3">
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">
                    {field.label}
                  </label>
                  {editing && isEditable ? (
                    <input
                      type={isDateField ? "date" : "text"}
                      value={editData[field.key] || ""}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid={`edit-${field.key}`}
                      placeholder={isDateField ? "dd/mm/yyyy" : ""}
                    />
                  ) : (
                    <p className="text-slate-900 font-tajawal">{value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* أفراد العائلة */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-cairo font-bold text-slate-900">أفراد العائلة</h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 font-tajawal rounded-lg hover:bg-green-100 transition-colors"
              data-testid="add-member-button"
            >
              <UserPlus className="w-4 h-4" />
              إضافة فرد جديد
            </button>
          </div>

          {/* نموذج إضافة فرد جديد */}
          {showAddMember && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border-2 border-green-200">
              <h3 className="font-cairo font-bold text-lg mb-4 text-slate-800">إضافة فرد جديد</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">الاسم *</label>
                  <input
                    type="text"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="اسم الفرد"
                    data-testid="new-member-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">رقم الهوية</label>
                  <input
                    type="text"
                    value={newMember.id_number}
                    onChange={(e) => setNewMember({ ...newMember, id_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="رقم الهوية"
                    data-testid="new-member-id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={newMember.birth_date}
                    onChange={(e) => setNewMember({ ...newMember, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="new-member-birth-date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">العمر</label>
                  <input
                    type="text"
                    value={newMember.age}
                    onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="العمر"
                    data-testid="new-member-age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">الجنس</label>
                  <select
                    value={newMember.gender}
                    onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="new-member-gender"
                  >
                    <option value="">اختر الجنس</option>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">صلة القرابة</label>
                  <input
                    type="text"
                    value={newMember.relation}
                    onChange={(e) => setNewMember({ ...newMember, relation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="مثل: ابن، ابنة، زوجة"
                    data-testid="new-member-relation"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">ملاحظات</label>
                  <textarea
                    value={newMember.notes}
                    onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="ملاحظات إضافية"
                    rows="2"
                    data-testid="new-member-notes"
                  ></textarea>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddMember}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-tajawal rounded-lg hover:bg-green-700 transition-colors"
                  data-testid="save-new-member-button"
                >
                  <Save className="w-4 h-4" />
                  حفظ الفرد
                </button>
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember({
                      name: "",
                      id_number: "",
                      birth_date: "",
                      age: "",
                      relation: "",
                      gender: "",
                      notes: ""
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 font-tajawal rounded-lg hover:bg-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-center text-slate-500 py-8 font-tajawal">لا توجد بيانات لأفراد العائلة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">الاسم</th>
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">رقم الهوية</th>
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">العمر</th>
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">الجنس</th>
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">القرابة</th>
                    <th className="text-right py-3 px-4 font-cairo font-bold text-slate-700">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-slate-50" data-testid={`member-row-${member.id}`}>
                      <td className="py-3 px-4 font-tajawal text-slate-900">{member.name}</td>
                      <td className="py-3 px-4 font-tajawal text-slate-700">{member.id_number || "-"}</td>
                      <td className="py-3 px-4 font-tajawal text-slate-700">{member.age || "-"}</td>
                      <td className="py-3 px-4 font-tajawal text-slate-700">{member.gender || "-"}</td>
                      <td className="py-3 px-4 font-tajawal text-slate-700">{member.relation || "-"}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
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
          )}
        </div>
      </div>
    </div>
  );
}
