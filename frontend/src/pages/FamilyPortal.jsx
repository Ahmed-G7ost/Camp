import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Tent, Users, Edit2, Save, X, Loader2 } from "lucide-react";

export default function FamilyPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!user || user.role !== "family") {
      navigate("/login");
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fieldsRes, familyRes, membersRes] = await Promise.all([
        api.get("/family-fields"),
        api.get(`/families/${user.family_id}`),
        api.get(`/individual-members?family_id=${user.family_id}`)
      ]);
      setFields(fieldsRes.data);
      setFamily(familyRes.data);
      setEditData(familyRes.data.data || {});
      setMembers(membersRes.data);
    } catch (err) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/families/${user.family_id}`, { data: editData });
      toast.success("تم حفظ التعديلات بنجاح");
      setFamily({ ...family, data: editData });
      setEditing(false);
    } catch (err) {
      toast.error("فشل حفظ التعديلات");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // الحقول التي يمكن للعائلة تعديلها (مثلا رقم الجوال، العنوان)
  const editableFieldKeys = ["phone", "mobile", "address", "location", "notes"];
  const editableFields = fields.filter(f => 
    editableFieldKeys.some(key => f.key.toLowerCase().includes(key) || f.label.includes("هاتف") || f.label.includes("عنوان") || f.label.includes("ملاحظ"))
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
              
              return (
                <div key={field.key} className="border-b pb-3">
                  <label className="block text-sm font-tajawal font-bold text-slate-600 mb-1">
                    {field.label}
                  </label>
                  {editing && isEditable ? (
                    <input
                      type="text"
                      value={editData[field.key] || ""}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid={`edit-${field.key}`}
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
          <h2 className="text-2xl font-cairo font-bold text-slate-900 mb-6">أفراد العائلة</h2>
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
