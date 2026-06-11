import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { calcAgeYears as calcAge, calcAgeLabel, formatDateDMY, toISO } from "../lib/age";
import {
  UserRoundSearch, Plus, Trash2, Pencil, Loader2, X, Search,
  Calendar, CreditCard, Users, ArrowDownAZ, ArrowUpAZ, SlidersHorizontal, Trash,
} from "lucide-react";

const RELATIONS = ["ابن", "ابنة", "أب", "أم", "أخ", "أخت", "زوجة", "زوج", "حفيد", "حفيدة", "أخرى"];
const GENDERS = ["ذكر", "أنثى"];

// Auto-fetch count for a given family_id
function useFamilyMemberCount(familyId) {
  return useQuery({
    queryKey: ["individual-members-count", familyId],
    queryFn: async () => {
      if (!familyId) return { count: 0 };
      return (await api.get(`/individual-members/count?family_id=${familyId}`)).data;
    },
    enabled: !!familyId,
  });
}

export default function IndividualMembers() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterRelation, setFilterRelation] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Load families from /families endpoint (dynamic families)
  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: async () => (await api.get("/families")).data,
  });

  // Load family fields to show family name
  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: async () => (await api.get("/family-fields")).data,
  });

  const nameKey = fields[0]?.key;
  const getFamilyName = (fid) => {
    const f = families.find((x) => x.id === fid);
    return f?.data?.[nameKey] || "—";
  };

  const sortedFamilies = [...families].sort((a, b) =>
    String(a.data?.[nameKey] || "").localeCompare(String(b.data?.[nameKey] || ""), "ar")
  );

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["individual-members", selectedFamilyId],
    queryFn: async () => {
      const url = selectedFamilyId
        ? `/individual-members?family_id=${selectedFamilyId}`
        : "/individual-members";
      return (await api.get(url)).data;
    },
  });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/individual-members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["individual-members"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم حذف الفرد بنجاح");
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const delAllMut = useMutation({
    mutationFn: () => api.delete("/individual-members/all"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["individual-members"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`تم حذف ${r.data.deleted} فرد`);
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const ageFilterActive = minAge !== "" || maxAge !== "";
  const filtered = members
    .filter((m) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (m.name || "").toLowerCase().includes(s) ||
        (m.id_number || "").toLowerCase().includes(s) ||
        (m.relation || "").toLowerCase().includes(s) ||
        getFamilyName(m.family_id).toLowerCase().includes(s)
      );
    })
    .filter((m) => (filterGender ? m.gender === filterGender : true))
    .filter((m) => (filterRelation ? m.relation === filterRelation : true))
    .filter((m) => {
      if (!ageFilterActive) return true;
      const age = calcAge(m.birth_date);
      if (age == null) return false;
      if (minAge !== "" && age < Number(minAge)) return false;
      if (maxAge !== "" && age > Number(maxAge)) return false;
      return true;
    })
    .sort((a, b) => {
      const cmp = String(a.name || "").localeCompare(String(b.name || ""), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (isLoading)
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="individual-members-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">أفراد مفصّل</h1>
          <p className="text-slate-500 font-tajawal mt-1">{members.length} فرد مسجّل</p>
        </div>
        <button onClick={() => { if (!families.length) return toast.error("لا توجد عائلات مسجّلة. أضف عائلات أولاً."); setModal({ mode: "add" }); }}
          data-testid="add-individual-member-button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md shadow-indigo-600/25">
          <Plus className="w-5 h-5" /> إضافة فرد
        </button>
      </div>

      {isAdmin && members.length > 0 && (
        <div className="flex justify-end animate-fade-up">
          <button onClick={() => setConfirmDeleteAll(true)} data-testid="delete-all-individuals-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-600/25">
            <Trash className="w-5 h-5" /> حذف الكل
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 animate-fade-up">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="individual-members-search"
            placeholder="بحث بالاسم أو رقم الهوية أو صلة القرابة..."
            className="w-full bg-white border border-slate-200 rounded-xl ps-12 pe-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
        <select value={selectedFamilyId} onChange={(e) => setSelectedFamilyId(e.target.value)} data-testid="filter-family-select"
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50 sm:w-64">
          <option value="">جميع العائلات</option>
          {sortedFamilies.map((f) => (
            <option key={f.id} value={f.id}>
              {f.data?.[nameKey] || f.id}
            </option>
          ))}
        </select>
        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          data-testid="individual-sort-toggle" title="ترتيب الأسماء"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all whitespace-nowrap">
          {sortDir === "asc" ? <ArrowDownAZ className="w-5 h-5" /> : <ArrowUpAZ className="w-5 h-5" />}
          {sortDir === "asc" ? "أ → ي" : "ي → أ"}
        </button>
      </div>

      {/* Advanced filters */}
      <div className="glass-card rounded-2xl p-4 animate-fade-up space-y-3" data-testid="individual-advanced-filters">
        <div className="flex items-center gap-2 text-slate-700 font-tajawal font-bold">
          <SlidersHorizontal className="w-5 h-5 text-indigo-600" /> فلترة متقدمة
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">الجنس</label>
            <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} data-testid="filter-gender-select"
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              <option value="">الكل</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">صلة القرابة</label>
            <select value={filterRelation} onChange={(e) => setFilterRelation(e.target.value)} data-testid="filter-relation-select"
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              <option value="">الكل</option>
              {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">العمر من (سنة)</label>
            <input type="number" min="0" value={minAge} onChange={(e) => setMinAge(e.target.value)} data-testid="filter-min-age"
              placeholder="0" className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">إلى (سنة)</label>
            <input type="number" min="0" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} data-testid="filter-max-age"
              placeholder="99" className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          {(filterGender || filterRelation || ageFilterActive) && (
            <>
              <span className="text-xs font-tajawal text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full font-bold">{filtered.length} نتيجة</span>
              <button onClick={() => { setFilterGender(""); setFilterRelation(""); setMinAge(""); setMaxAge(""); }} data-testid="individual-clear-filters"
                className="flex items-center gap-1 px-3 py-2 rounded-lg font-tajawal font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                <X className="w-4 h-4" /> إلغاء الفلاتر
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <UserRoundSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-cairo font-bold text-slate-700 text-lg mb-2">لا توجد سجلات</h3>
          <p className="font-tajawal text-slate-500">ابدأ بإضافة أفراد للعائلات المسجّلة</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["الاسم", "رقم الهوية", "العائلة", "صلة القرابة", "الجنس", "تاريخ الميلاد", "العمر", "إجراءات"].map((h) => (
                    <th key={h} className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => {
                  const age = m.age || calcAgeLabel(m.birth_date);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`individual-member-row-${m.id}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${m.gender === "أنثى" ? "bg-gradient-to-br from-pink-400 to-rose-500" : "bg-gradient-to-br from-blue-400 to-blue-600"}`}>
                            {m.name?.[0] || "؟"}
                          </div>
                          <span className="font-tajawal font-semibold text-slate-800 text-sm whitespace-nowrap">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-tajawal text-slate-600 text-sm whitespace-nowrap">
                        <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-slate-400" />{m.id_number}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-tajawal font-bold bg-blue-50 text-blue-700">
                          <Users className="w-3 h-3" />
                          {getFamilyName(m.family_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-tajawal font-bold bg-indigo-50 text-indigo-700">{m.relation}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-tajawal font-bold ${m.gender === "أنثى" ? "bg-pink-50 text-pink-700" : "bg-blue-50 text-blue-700"}`}>{m.gender}</span>
                      </td>
                      <td className="px-4 py-3.5 font-tajawal text-slate-600 text-sm whitespace-nowrap">
                        {m.birth_date ? <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDateDMY(m.birth_date)}</span> : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {age ? <span className="font-tajawal font-bold text-slate-700 text-sm">{age}</span> : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setModal({ mode: "edit", member: m })} data-testid={`edit-individual-${m.id}`}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmDelete(m.id)} data-testid={`delete-individual-${m.id}`}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <IndividualMemberModal
          modal={modal}
          families={sortedFamilies}
          nameKey={nameKey}
          fields={fields}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف الفرد"
        message="هل تريد حذف هذا الفرد نهائياً من السجل؟"
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        isOpen={confirmDeleteAll}
        title="حذف جميع الأفراد"
        message={`ستُحذف جميع سجلات الأفراد (${members.length} فرد) نهائياً. لا يمكن التراجع.`}
        confirmLabel="نعم، احذف الكل"
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={() => { delAllMut.mutate(); setConfirmDeleteAll(false); }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}

function IndividualMemberModal({ modal, families, nameKey, fields, onClose }) {
  const qc = useQueryClient();
  const init = modal.member || {};
  const [form, setForm] = useState({
    family_id: init.family_id || families[0]?.id || "",
    name: init.name || "",
    id_number: init.id_number || "",
    birth_date: init.birth_date || "",
    age: init.age || calcAgeLabel(init.birth_date),
    relation: init.relation || RELATIONS[0],
    gender: init.gender || GENDERS[0],
    notes: init.notes || "",
  });

  // Auto fetch expected count and already-added count
  const selectedFamily = families.find((f) => f.id === form.family_id);

  // Find expected member count from family's dynamic fields
  const expectedCount = (() => {
    if (!selectedFamily) return null;
    // Look for a numeric field whose label contains "عدد" or "افراد"
    const countField = fields?.find((f) =>
      /عدد|افراد|أفراد/.test(f.label) && f.type === "number"
    );
    if (countField) {
      const val = parseInt(selectedFamily.data?.[countField.key], 10);
      return isNaN(val) ? null : val;
    }
    return null;
  })();

  const { data: countData } = useFamilyMemberCount(form.family_id);
  const alreadyAdded = countData?.count ?? 0;
  // Subtract 2 for head + wife (already registered outside this form)
  const remaining = expectedCount != null ? Math.max(0, expectedCount - 2 - alreadyAdded) : null;

  const mut = useMutation({
    mutationFn: () =>
      modal.mode === "add"
        ? api.post("/individual-members", form)
        : api.put(`/individual-members/${modal.member.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["individual-members"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(modal.mode === "add" ? "تمت إضافة الفرد بنجاح" : "تم تحديث بيانات الفرد");
      onClose();
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative rounded-3xl p-7 w-full max-w-lg max-h-[88vh] overflow-y-auto animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="individual-member-modal"
      >
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-indigo-600 to-indigo-400" />
        <div className="flex items-center justify-between mb-5 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <UserRoundSearch className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-cairo font-bold text-slate-900">
              {modal.mode === "add" ? "إضافة فرد" : "تعديل بيانات الفرد"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          {/* العائلة */}
          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">
              العائلة <span className="text-red-500">*</span>
            </label>
            <select required value={form.family_id} onChange={(e) => setForm({ ...form, family_id: e.target.value })}
              data-testid="im-family-select"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              <option value="">— اختر العائلة —</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.data?.[nameKey] || f.id}</option>
              ))}
            </select>
            {/* Member count progress */}
            {form.family_id && (
              <div className="mt-2 flex flex-wrap gap-2">
                {expectedCount != null ? (
                  <>
                    <span className="text-xs font-tajawal bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                      إجمالي الأفراد المتوقع: {expectedCount}
                    </span>
                    <span className="text-xs font-tajawal bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-bold">
                      مُضاف: {alreadyAdded} فرد
                    </span>
                    {remaining > 0 && (
                      <span className="text-xs font-tajawal bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-bold">
                        متبقي: {remaining} فرد (دون رب الأسرة والزوجة)
                      </span>
                    )}
                    {remaining === 0 && (
                      <span className="text-xs font-tajawal bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-bold">
                        اكتملت الأسرة
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs font-tajawal bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                    مُضاف: {alreadyAdded} فرد • رب الأسرة والزوجة مسجّلان خارج هذا القسم
                  </span>
                )}
              </div>
            )}
          </div>

          {/* الاسم ورقم الهوية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الاسم الكامل <span className="text-red-500">*</span></label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="im-name-input" placeholder="الاسم الثلاثي"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">رقم الهوية <span className="text-red-500">*</span></label>
              <input required value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                data-testid="im-id-input"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
          </div>

          {/* تاريخ الميلاد مع حساب العمر */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">تاريخ الميلاد</label>
              <input type="date" value={toISO(form.birth_date)}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value, age: calcAgeLabel(e.target.value) })}
                data-testid="im-birth-date-input"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">العمر</label>
              <input type="text" value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="يُحسب تلقائياً"
                data-testid="im-age-input"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
          </div>

          {/* صلة القرابة والجنس */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">صلة القرابة <span className="text-red-500">*</span></label>
              <select required value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}
                data-testid="im-relation-select"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الجنس <span className="text-red-500">*</span></label>
              <select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                data-testid="im-gender-select"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              data-testid="im-notes-input"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>

          <button type="submit" disabled={mut.isPending} data-testid="save-individual-member-button"
            className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-indigo-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ
          </button>
        </form>
      </div>
    </div>
  );
}
