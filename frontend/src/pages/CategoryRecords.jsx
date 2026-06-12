import { useState, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { NameBadge, GenderBadge, isGenderField, isNameField, ColorName, genderOf } from "../components/Colorize";
import { isBirthDateField, calcAgeLabel, formatDateDMY, toISO, ageKeyOf, parseDate } from "../lib/age";
import {
  Plus, Search, Loader2, Pencil, Trash2, ArrowRight, User,
  Upload, Download, X, ArrowLeftRight, Settings,
  CheckCircle2, AlertTriangle, Layers, ArrowDownAZ, ArrowUpAZ, SlidersHorizontal, Trash,
} from "lucide-react";

async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// مسميات الحالة الاجتماعية المكتوبة مكان اسم الأب (أرملة، مطلقة، الزوج أسير...) — لا يُطبق عليها التجميع
const STATUS_NAME_RE = /^(?:ال)?زوج(?:ة|ها)?\s*(?:ال)?(?:أسير|اسير|شهيد|متوفي|متوفى|مفقود|سجين)(?:ة|ه)?$|^(?:ال)?(?:أرمل|ارمل|مطلق|أسير|اسير|شهيد|متوفي|متوفى|مفقود|سجين)(?:ة|ه)?$/;
export const isStatusName = (n) => STATUS_NAME_RE.test(String(n || "").trim().replace(/\s+/g, " "));

// Compute age (years) from a date-field value, or read a numeric age field directly.
function computeAge(field, value) {
  if (!value && value !== 0) return null;
  if (field?.type === "date") {
    const b = parseDate(value);
    if (!b) return null;
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

// Compute age in MONTHS from a date-field value (or convert a numeric years field to months).
function computeAgeMonths(field, value) {
  if (!value && value !== 0) return null;
  if (field?.type === "date") {
    const b = parseDate(value);
    if (!b) return null;
    const t = new Date();
    let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
    if (t.getDate() < b.getDate()) months--;
    return months < 0 ? null : months;
  }
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n * 12;
}

export default function CategoryRecords() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const fileRef = useRef();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [ageFieldKey, setAgeFieldKey] = useState("");
  const [minUnit, setMinUnit] = useState("months"); // وحدة الحد الأدنى: "years" | "months"
  const [maxUnit, setMaxUnit] = useState("years");  // وحدة الحد الأعلى: "years" | "months"
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [genderFilter, setGenderFilter] = useState(""); // "" | "male" | "female"
  const [filterFieldKey, setFilterFieldKey] = useState("");
  const [filterFieldVal, setFilterFieldVal] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const category = categories.find((c) => c.id === id);

  const { data: catFields = [] } = useQuery({
    queryKey: ["category-fields", id],
    queryFn: async () => (await api.get(`/category-fields?category_id=${id}`)).data,
  });
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["category-records", id],
    queryFn: async () => (await api.get(`/category-records?category_id=${id}`)).data,
  });
  const { data: families = [] } = useQuery({ queryKey: ["families"], queryFn: async () => (await api.get("/families")).data });
  const { data: famFields = [] } = useQuery({ queryKey: ["fields"], queryFn: async () => (await api.get("/family-fields")).data });

  const nameKey = famFields[0]?.key;
  const famName = (fid) => {
    const f = families.find((x) => x.id === fid);
    return f?.data?.[nameKey] || "—";
  };
  // اسم السجل: يؤخذ من السجل مباشرة (الكشف) وإلا من العائلة المرتبطة إن وُجدت
  const recName = (r) => r.name || famName(r.family_id);

  const delMut = useMutation({
    mutationFn: (rid) => api.delete(`/category-records/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["category-records", id] }); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("تم حذف السجل"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const delAllMut = useMutation({
    mutationFn: () => api.delete(`/category-records/all?category_id=${id}`),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["category-records", id] }); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success(`تم حذف ${r.data.deleted} سجل`); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const importMut = useMutation({
    mutationFn: ({ file, headerRow, matchColumn, mapping }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category_id", id);
      fd.append("header_row", String(headerRow));
      fd.append("match_column", String(matchColumn));
      fd.append("mapping", JSON.stringify(mapping));
      return api.post("/category-records/import", fd);
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["category-records", id] }); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail) || "فشل الاستيراد"),
  });

  const handleFileSelect = async (file) => {
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/families/import/columns", fd);
      if (!data.preview?.length) return toast.error("الملف فارغ أو غير مدعوم");
      setImportModal({ file, ...data });
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "تعذّر قراءة الملف");
    } finally {
      setPreviewing(false);
    }
  };

  // Fields usable as an age source: date fields (compute age) or numeric fields labelled عمر/سن
  const ageFields = catFields.filter((f) => f.type === "date" || (f.type === "number" && /(^|\s)(العمر|عمر|السن|سن)(\s|$)/.test(f.label)));
  const activeAgeField = ageFields.find((f) => f.key === ageFieldKey) || ageFields[0];
  const ageFilterActive = !!activeAgeField && (minAge !== "" || maxAge !== "");
  const fieldFilterActive = !!filterFieldKey && filterFieldVal.trim() !== "";
  

  // حقل الجنس (إن وُجد ضمن خانات الفئة) لتفعيل فلترة الجنس
  const genderField = catFields.find((f) => isGenderField(f.label));
  const genderFilterActive = !!genderField && genderFilter !== "";
  
  const filtered = records
    .filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      if (recName(r).toLowerCase().includes(s)) return true;
      return Object.values(r.data || {}).some((v) => String(v).toLowerCase().includes(s));
    })
    .filter((r) => {
      if (!fieldFilterActive) return true;
      return String(r.data?.[filterFieldKey] || "").toLowerCase().includes(filterFieldVal.trim().toLowerCase());
    })
    .filter((r) => {
      if (!genderFilterActive) return true;
      return genderOf(r.data?.[genderField.key]) === genderFilter;
    })
    
    .filter((r) => {
      if (!ageFilterActive) return true;
      const years = computeAge(activeAgeField, r.data?.[activeAgeField.key]);
      const months = computeAgeMonths(activeAgeField, r.data?.[activeAgeField.key]);
      if (years == null || months == null) return false;
      if (minAge !== "") {
        const ok = minUnit === "years" ? years >= Number(minAge) : months >= Number(minAge);
        if (!ok) return false;
      }
      if (maxAge !== "") {
        const ok = maxUnit === "years" ? years <= Number(maxAge) : months <= Number(maxAge);
        if (!ok) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const cmp = recName(a).localeCompare(recName(b), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });

  // قسم الأطفال: دمج خلية اسم الأب (rowspan) للأطفال الأشقّاء المتتاليين بنفس الاسم،
  // مع استثناء مسميات الحالة (أرملة، مطلقة، الزوج أسير...) فتبقى كما هي.
  const groupByFather = category?.key === "children";
  const rows = filtered.map((r) => ({ r, span: 1 }));
  if (groupByFather) {
    let i = 0;
    while (i < rows.length) {
      const name = recName(rows[i].r).trim();
      let j = i + 1;
      if (name && name !== "—" && !isStatusName(name)) {
        while (j < rows.length && recName(rows[j].r).trim() === name) j++;
      }
      rows[i].span = j - i;
      for (let k = i + 1; k < j; k++) rows[k].span = 0;
      i = j;
    }
  }

  if (isLoading)
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="category-records-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/categories")} data-testid="back-to-categories"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-cairo font-extrabold text-slate-900">{category?.name || "الفئة"}</h1>
            <p className="text-slate-500 font-tajawal mt-1">{records.length} سجل</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadFile(`/category-records/export?category_id=${id}`, `${category?.name || "fئة"}.xlsx`)}
            data-testid="export-category-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            <Download className="w-5 h-5" /> تصدير
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden data-testid="category-import-file-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={previewing} data-testid="import-category-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-60">
            {previewing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} استيراد
          </button>
          {isAdmin && records.length > 0 && (
            <button onClick={() => setConfirmDeleteAll(true)} data-testid="delete-all-category-button"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-600/25">
              <Trash className="w-5 h-5" /> حذف الكل
            </button>
          )}
          <button
            onClick={() => setModal({ mode: "add" })}
            data-testid="add-category-record-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md shadow-blue-600/25">
            <Plus className="w-5 h-5" /> إضافة سجل
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-up">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="category-search"
            placeholder="بحث بالاسم أو البيانات..."
            className="w-full bg-white border border-slate-200 rounded-xl ps-12 pe-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          data-testid="category-sort-toggle" title="ترتيب الأسماء"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all whitespace-nowrap">
          {sortDir === "asc" ? <ArrowDownAZ className="w-5 h-5" /> : <ArrowUpAZ className="w-5 h-5" />}
          {sortDir === "asc" ? "أ → ي" : "ي → أ"}
        </button>
      </div>

      {/* Advanced filters */}
      {catFields.length > 0 && (
        <div className="glass-card rounded-2xl p-4 animate-fade-up space-y-3" data-testid="advanced-filters">
          <div className="flex items-center gap-2 text-slate-700 font-tajawal font-bold">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" /> فلترة متقدمة
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            {/* field-value filter */}
            <div>
              <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">الخانة</label>
              <select value={filterFieldKey} onChange={(e) => setFilterFieldKey(e.target.value)} data-testid="filter-field-select"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="">— بدون —</option>
                {catFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">القيمة تحتوي</label>
              <input value={filterFieldVal} onChange={(e) => setFilterFieldVal(e.target.value)} data-testid="filter-field-value"
                disabled={!filterFieldKey} placeholder="اكتب قيمة..."
                className="w-40 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50" />
            </div>

            {/* gender filter */}
            {genderField && (
              <div>
                <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">الجنس</label>
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} data-testid="gender-filter-select"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  <option value="">— الكل —</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            )}
            
            {/* age filter */}
            {ageFields.length > 0 && (
              <>
                {ageFields.length > 1 && (
                  <div>
                    <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">حقل العمر</label>
                    <select value={activeAgeField?.key || ""} onChange={(e) => setAgeFieldKey(e.target.value)} data-testid="age-field-select"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                      {ageFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">العمر من</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" value={minAge} onChange={(e) => setMinAge(e.target.value)} data-testid="age-min-input"
                      placeholder="0" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <select value={minUnit} onChange={(e) => setMinUnit(e.target.value)} data-testid="age-min-unit-select"
                      className="bg-white border border-slate-200 rounded-lg px-2 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                      <option value="months">شهر</option>
                      <option value="years">سنة</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">إلى</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} data-testid="age-max-input"
                      placeholder="12" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <select value={maxUnit} onChange={(e) => setMaxUnit(e.target.value)} data-testid="age-max-unit-select"
                      className="bg-white border border-slate-200 rounded-lg px-2 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                      <option value="months">شهر</option>
                      <option value="years">سنة</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {(fieldFilterActive || ageFilterActive || genderFilterActive) && (
              <>
                <span className="text-xs font-tajawal text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-bold">
                  {filtered.length} نتيجة
                </span>
                <button onClick={() => { setMinAge(""); setMaxAge(""); setFilterFieldKey(""); setFilterFieldVal(""); setGenderFilter(""); }} data-testid="clear-filters-button"
                  className="flex items-center gap-1 px-3 py-2 rounded-lg font-tajawal font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                  <X className="w-4 h-4" /> إلغاء الفلاتر
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {records.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد سجلات في هذه الفئة بعد</p>
          {isAdmin && catFields.length === 0 && (
            <button onClick={() => navigate("/settings")} data-testid="goto-settings-fields"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all">
              <Settings className="w-5 h-5" /> تعريف خانات الفئة من الإعدادات
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد نتائج مطابقة</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">الاسم (العائلة)</th>
                  {catFields.map((f) => (
                    <Fragment key={f.id}>
                      <th className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">{f.label}</th>
                      {isBirthDateField(f) && (
                        <th className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">العمر</th>
                      )}
                    </Fragment>
                  ))}
                  <th className="px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ r, span }) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`category-row-${r.id}`}>
                    {span > 0 && (
                      <td rowSpan={span} className={`px-4 py-3.5 min-w-[160px] align-middle ${span > 1 ? "bg-white border-e border-slate-100" : ""}`}>
                      <NameBadge name={recName(r)} testId={`category-record-name-${r.id}`} />
                    </td>
                    )}
                    {catFields.map((f) => (
                      <Fragment key={f.id}>
                        <td className="px-4 py-3.5 font-tajawal text-slate-700 text-sm whitespace-nowrap">
                          {isGenderField(f.label) ? (
                            <GenderBadge value={r.data?.[f.key]} testId={`category-gender-${r.id}`} />
                          ) : isNameField(f.label) && f.type !== "date" && f.type !== "number" ? (
                            <ColorName name={r.data?.[f.key]} />
                          ) : f.type === "date" ? (formatDateDMY(r.data?.[f.key]) || "—") : (r.data?.[f.key] || "—")}
                        </td>
                        {isBirthDateField(f) && (
                          <td className="px-4 py-3.5 font-tajawal font-bold text-slate-700 text-sm whitespace-nowrap" data-testid={`category-age-${r.id}-${f.key}`}>
                            {r.data?.[ageKeyOf(f.key)] || calcAgeLabel(r.data?.[f.key]) || "—"}
                          </td>
                        )}
                      </Fragment>
                    ))}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModal({ mode: "edit", record: r })} data-testid={`edit-category-record-${r.id}`} title="تعديل"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete(r.id)} data-testid={`delete-category-record-${r.id}`} title="حذف"
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <RecordModal
          categoryId={id}
          catFields={catFields}
          families={families}
          famFields={famFields}
          modal={modal}
          onClose={() => setModal(null)}
        />
      )}

      {importModal && (
        <CategoryImportModal
          catFields={catFields}
          famFields={famFields}
          importData={importModal}
          importing={importMut.isPending}
          result={importMut.data?.data}
          onSubmit={(payload) => importMut.mutate({ file: importModal.file, ...payload })}
          onClose={() => { importMut.reset(); setImportModal(null); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف السجل"
        message="هل تريد حذف هذا السجل نهائياً؟"
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        isOpen={confirmDeleteAll}
        title="حذف جميع سجلات الفئة"
        message={`ستُحذف جميع سجلات هذه الفئة (${records.length} سجل) نهائياً. لا يمكن التراجع.`}
        confirmLabel="نعم، احذف الكل"
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={() => { delAllMut.mutate(); setConfirmDeleteAll(false); }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}

// ─── Add / Edit record modal ─────────────────────────────────────────────────
function RecordModal({ categoryId, catFields, families, famFields, modal, onClose }) {
  const qc = useQueryClient();
  const nameKey = famFields[0]?.key;
  const [famSearch, setFamSearch] = useState("");
  const [familyId, setFamilyId] = useState(modal.record?.family_id || "");
  const [name, setName] = useState(modal.record?.name || "");
  const [form, setForm] = useState(() => {
    const init = {};
    catFields.forEach((f) => {
      init[f.key] = modal.record?.data?.[f.key] || "";
      if (isBirthDateField(f)) init[ageKeyOf(f.key)] = modal.record?.data?.[ageKeyOf(f.key)] || calcAgeLabel(init[f.key]);
    });
    return init;
  });

  const filteredFams = families
    .filter((f) => {
      if (!famSearch) return true;
      const s = famSearch.toLowerCase();
      return Object.values(f.data || {}).some((v) => String(v).toLowerCase().includes(s));
    })
    .sort((a, b) =>
      String(a.data?.[nameKey] || "").localeCompare(String(b.data?.[nameKey] || ""), "ar")
    );
  const selectedFam = families.find((f) => f.id === familyId);

  const mut = useMutation({
    mutationFn: () =>
      modal.mode === "add"
        ? api.post("/category-records", { category_id: categoryId, family_id: familyId, name, data: form })
        : api.put(`/category-records/${modal.record.id}`, { category_id: categoryId, family_id: familyId, name, data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-records", categoryId] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(modal.mode === "add" ? "تمت إضافة السجل" : "تم تحديث السجل");
      onClose();
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-0 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="category-record-modal">
        <div className="h-1 bg-gradient-to-l from-blue-600 to-blue-400" />
        <div className="p-7 overflow-y-auto max-h-[88vh]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-cairo font-bold text-slate-900">
              {modal.mode === "add" ? "إضافة سجل جديد" : "تعديل السجل"}
            </h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">
              الاسم <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              data-testid="category-record-name"
              placeholder="اكتب الاسم (مثلاً: الاسم مع اسم الأب)"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Family selector */}
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">
                ربط بعائلة (اختياري)
                {selectedFam && (
                  <span className="mr-2 text-xs text-blue-600 font-normal bg-blue-50 px-2 py-0.5 rounded-full">
                    {selectedFam.data?.[nameKey] || "مختارة"}
                  </span>
                )}
              </label>
              <div className="relative mb-2">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400" />
                <input value={famSearch} onChange={(e) => setFamSearch(e.target.value)}
                  data-testid="category-family-search"
                  placeholder="بحث عن عائلة..."
                  className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {filteredFams.slice(0, 50).map((f) => (
                  <button key={f.id} type="button" onClick={() => setFamilyId(f.id)}
                    data-testid={`category-select-family-${f.id}`}
                    className={`w-full text-start px-4 py-2.5 font-tajawal text-sm transition-colors border-b border-slate-100 last:border-0 ${
                      familyId === f.id ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-700 hover:bg-slate-50"
                    }`}>
                    {famFields.map((fld) => f.data?.[fld.key]).filter(Boolean).join(" - ")}
                  </button>
                ))}
                {filteredFams.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400 font-tajawal">لا توجد نتائج</div>
                )}
              </div>
            </div>

            {/* Category fields */}
            <div className="space-y-4">
              {catFields.length === 0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm font-tajawal text-amber-700">
                  لا توجد خانات لهذه الفئة بعد. أضِفها من الإعدادات لتسجيل تفاصيل إضافية.
                </div>
              ) : (
                catFields.map((f) =>
                  isBirthDateField(f) ? (
                    <div key={f.id} className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">{f.label}</label>
                        <input
                          type="date"
                          value={toISO(form[f.key])}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value, [ageKeyOf(f.key)]: calcAgeLabel(e.target.value) })}
                          data-testid={`category-field-${f.key}`}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">العمر</label>
                        <input
                          type="text"
                          value={form[ageKeyOf(f.key)]}
                          onChange={(e) => setForm({ ...form, [ageKeyOf(f.key)]: e.target.value })}
                          placeholder="يُحسب تلقائياً"
                          data-testid={`category-field-${f.key}-age`}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>
                  ) : (
                    <div key={f.id}>
                      <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">{f.label}</label>
                      <input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "tel" ? "tel" : "text"}
                        value={f.type === "date" ? toISO(form[f.key]) : form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        data-testid={`category-field-${f.key}`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  )
                )
              )}
            </div>
          </div>

          <button type="button" disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}
            data-testid="save-category-record-button"
            className="w-full mt-5 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            {name.trim() ? "حفظ" : "أدخل الاسم أولاً"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import modal ────────────────────────────────────────────────────────────
function CategoryImportModal({ catFields, famFields, importData, importing, result, onSubmit, onClose }) {
  const { preview = [], suggested_header = 0, total_rows = 0 } = importData;
  const [headerRow, setHeaderRow] = useState(suggested_header);
  const [matchColumn, setMatchColumn] = useState("");
  const [mapping, setMapping] = useState({});

  const columns = (preview[headerRow] || [])
    .map((name, idx) => ({ idx, name: (name == null ? "" : String(name)).trim() }))
    .filter((c) => c.name !== "");
  const dataRowCount = Math.max(0, total_rows - (headerRow + 1));
  const rowLabel = (r, i) => `صف ${i + 1}: ${r.filter((c) => c != null && c !== "").slice(0, 4).map(String).join(" | ") || "(فارغ)"}`;

  const submit = () => {
    if (matchColumn === "" ) return toast.error("حدّد عمود الاسم");
    onSubmit({ headerRow, matchColumn, mapping });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-0 w-full max-w-xl max-h-[92vh] overflow-hidden animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="category-import-modal">
        <div className="h-1 bg-gradient-to-l from-green-500 to-emerald-500" />
        <div className="p-7 overflow-y-auto max-h-[88vh]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-cairo font-bold text-slate-900">استيراد سجلات من Excel</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
          </div>

          {result ? (
            <div className="py-2" data-testid="category-import-result">
              <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <div className="font-tajawal text-green-800 text-sm">
                  تم استيراد <span className="font-bold">{result.created}</span> سجل بنجاح.
                  {result.fuzzy_matched > 0 && <span className="block text-green-600 text-xs mt-1">منها {result.fuzzy_matched} جرى تطابقها بشكل تقريبي</span>}
                </div>
              </div>
              {result.unmatched_count > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
                  <div className="flex items-center gap-2 text-amber-800 font-tajawal font-bold mb-2 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" /> {result.unmatched_count} لم يتم العثور على عائلاتهم
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {result.unmatched.map((v, i) => (
                      <span key={i} className="text-xs font-tajawal bg-white border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onClose} data-testid="category-import-done-button"
                className="w-full mt-2 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 transition-all">
                تم
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-tajawal text-slate-500 mb-4">حدّد عمود الاسم في الملف، ثم اربط باقي الأعمدة بخانات الفئة.</p>

              <div className="bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-3 mb-3">
                <label className="block text-xs font-tajawal font-bold text-slate-600 mb-1.5">صف العناوين في الملف</label>
                <select value={headerRow} onChange={(e) => { setHeaderRow(Number(e.target.value)); setMatchColumn(""); setMapping({}); }}
                  data-testid="category-header-row-select"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none">
                  {preview.map((r, i) => <option key={i} value={i}>{rowLabel(r, i)}</option>)}
                </select>
              </div>

              <div className="space-y-3 mb-3">
                <div className="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 w-1/2 min-w-0">
                    <ArrowLeftRight className="w-4 h-4 text-slate-300 shrink-0" />
                    <span className="font-tajawal font-bold text-slate-800 text-sm">عمود الاسم في الملف</span>
                  </div>
                  <select value={matchColumn} onChange={(e) => setMatchColumn(e.target.value)} data-testid="category-match-column-select"
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="">— اختر العمود —</option>
                    {columns.map((c) => <option key={c.idx} value={c.idx}>{c.name || `عمود ${c.idx + 1}`}</option>)}
                  </select>
                </div>
              </div>

              {catFields.length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="text-xs font-tajawal font-bold text-slate-400">ربط خانات الفئة (اختياري):</div>
                  {catFields.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2">
                      <div className="flex items-center gap-2 w-1/2 min-w-0">
                        <span className="font-tajawal font-bold text-slate-800 truncate text-sm">{f.label}</span>
                      </div>
                      <ArrowLeftRight className="w-4 h-4 text-slate-300 shrink-0" />
                      <select value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                        data-testid={`category-map-field-${f.key}`}
                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                        <option value="">— تجاهل —</option>
                        {columns.map((c) => <option key={c.idx} value={String(c.idx)}>{c.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">إلغاء</button>
                <button onClick={submit} disabled={importing} data-testid="confirm-category-import-button"
                  className="flex-[2] bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-green-600/25">
                  {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  استيراد {dataRowCount} سجل
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
