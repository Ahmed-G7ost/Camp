import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { NameBadge } from "../components/Colorize";
import {
  HandHeart, Loader2, Search, Download, Calendar, ChevronLeft, Trash2,
  Upload, X, ArrowLeftRight, ListChecks, CheckCircle2, AlertTriangle,
  Plus, Trash, User, SlidersHorizontal,
} from "lucide-react";

async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AidRecords() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const fileRef = useRef();
  const [search, setSearch] = useState("");
  const [filterAidType, setFilterAidType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importModal, setImportModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const { data: records = [], isLoading } = useQuery({ queryKey: ["aid-records-all"], queryFn: async () => (await api.get("/aid-records")).data });
  const { data: families = [] } = useQuery({ queryKey: ["families"], queryFn: async () => (await api.get("/families")).data });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: async () => (await api.get("/family-fields")).data });
  const { data: aidTypes = [] } = useQuery({ queryKey: ["aid-types"], queryFn: async () => (await api.get("/aid-types")).data });

  const nameKey = fields[0]?.key;
  const famName = (fid) => {
    const f = families.find((x) => x.id === fid);
    return f?.data?.[nameKey] || "—";
  };

  // Assign a consistent color palette per aid type
  const AID_COLORS = [
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
    { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-400" },
    { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-400" },
    { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-400" },
    { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-400" },
    { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200",    dot: "bg-teal-400" },
    { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400" },
    { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",    dot: "bg-pink-400" },
    { bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",    dot: "bg-cyan-400" },
    { bg: "bg-lime-50",    text: "text-lime-700",    border: "border-lime-200",    dot: "bg-lime-400" },
  ];
  const aidColorMap = {};
  aidTypes.forEach((t, i) => { aidColorMap[t.id] = AID_COLORS[i % AID_COLORS.length]; });
  const aidColor = (aid_type_id) => aidColorMap[aid_type_id] || AID_COLORS[0];

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/aid-records/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aid-records-all"] }); qc.invalidateQueries({ queryKey: ["stats"] }); toast.success("تم حذف السجل"); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const delAllMut = useMutation({
    mutationFn: () => api.delete("/aid-records/all"),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["aid-records-all"] }); qc.invalidateQueries({ queryKey: ["stats"] }); toast.success(`تم حذف ${r.data.deleted} سجل`); },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const handleFileSelect = async (file) => {
    if (!fields.length) return toast.error("أضف حقول العائلة أولاً");
    if (!aidTypes.length) return toast.error("أضف أنواع المساعدات أولاً");
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/families/import/columns", fd);
      if (!data.preview?.length) return toast.error("الملف فارغ");
      setImportModal({ file, ...data });
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "تعذّر قراءة الملف");
    } finally {
      setPreviewing(false);
    }
  };

  const filtered = records
    .filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (r.aid_type_name || "").toLowerCase().includes(s) || famName(r.family_id).toLowerCase().includes(s);
    })
    .filter((r) => (filterAidType ? r.aid_type_id === filterAidType : true))
    .filter((r) => {
      if (dateFrom && (r.date || "") < dateFrom) return false;
      if (dateTo && (r.date || "") > dateTo) return false;
      return true;
    });
  const filterActive = !!filterAidType || !!dateFrom || !!dateTo;

  // Group records by family_id — each family appears ONCE
  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.family_id]) acc[r.family_id] = [];
    acc[r.family_id].push(r);
    return acc;
  }, {});
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) =>
    famName(a).localeCompare(famName(b), "ar")
  );
  const uniqueFamilyCount = groupedEntries.length;

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="aid-records-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">سجل المساعدات</h1>
          <p className="text-slate-500 font-tajawal mt-1">
            <span className="font-bold text-slate-700">{uniqueFamilyCount}</span> عائلة مستفيدة •{" "}
            <span className="font-bold text-slate-700">{records.length}</span> عملية توزيع
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Manual add */}
          <button onClick={() => { if (!families.length) return toast.error("لا توجد عائلات مسجّلة"); if (!aidTypes.length) return toast.error("أضف أنواع المساعدات أولاً"); setAddModal(true); }}
            data-testid="add-aid-record-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-600/25">
            <Plus className="w-5 h-5" /> إضافة يدوي
          </button>
          {/* Import */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden data-testid="aid-import-file-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={previewing} data-testid="import-aid-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-60">
            {previewing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} استيراد توزيع
          </button>
          {/* Export */}
          <button onClick={() => downloadFile("/aid-records/export", "سجل_المساعدات.xlsx")} data-testid="export-aid-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            <Download className="w-5 h-5" /> تصدير
          </button>
          {/* Delete all (admin) */}
          {isAdmin && records.length > 0 && (
            <button onClick={() => setConfirmDeleteAll(true)} data-testid="delete-all-aid-button"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-600/25">
              <Trash className="w-5 h-5" /> حذف الكل
            </button>
          )}
        </div>
      </div>

      <div className="relative animate-fade-up">
        <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="aid-search"
          placeholder="بحث بنوع المساعدة أو اسم العائلة..."
          className="w-full bg-white border border-slate-200 rounded-xl ps-12 pe-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
      </div>

      {/* Advanced filters */}
      <div className="glass-card rounded-2xl p-4 animate-fade-up flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap" data-testid="aid-advanced-filters">
        <div className="flex items-center gap-2 text-slate-700 font-tajawal font-bold">
          <SlidersHorizontal className="w-5 h-5 text-emerald-600" /> فلترة متقدمة
        </div>
        <div>
          <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">نوع المساعدة</label>
          <select value={filterAidType} onChange={(e) => setFilterAidType(e.target.value)} data-testid="aid-filter-type-select"
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
            <option value="">الكل</option>
            {aidTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">من تاريخ</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="aid-filter-date-from"
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
        </div>
        <div>
          <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="aid-filter-date-to"
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
        </div>
        {filterActive && (
          <>
            <span className="text-xs font-tajawal text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">{filtered.length} عملية</span>
            <button onClick={() => { setFilterAidType(""); setDateFrom(""); setDateTo(""); }} data-testid="aid-clear-filters"
              className="flex items-center gap-1 px-3 py-2 rounded-lg font-tajawal font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
              <X className="w-4 h-4" /> إلغاء الفلاتر
            </button>
          </>
        )}
      </div>

      {groupedEntries.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <HandHeart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد سجلات مساعدات</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["#", "العائلة", "المساعدات المُستلَمة", "المجموع", "إجراءات"].map((h) => (
                    <th key={h} className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedEntries.map(([familyId, fRecords], idx) => (
                  <tr key={familyId} className="hover:bg-slate-50/60 transition-colors" data-testid={`grouped-row-${familyId}`}>
                    {/* رقم */}
                    <td className="px-4 py-4 text-slate-400 font-tajawal text-sm">{idx + 1}</td>

                    {/* اسم العائلة */}
                    <td className="px-4 py-4 min-w-[160px]">
                      <NameBadge name={famName(familyId)} testId={`aid-family-name-${familyId}`} />
                    </td>

                    {/* Badges لكل مساعدة */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {fRecords
                          .slice()
                          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                          .map((r) => {
                            const c = aidColor(r.aid_type_id);
                            return (
                              <span
                                key={r.id}
                                data-testid={`aid-badge-${r.id}`}
                                className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-tajawal font-bold border ${c.bg} ${c.text} ${c.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                                {r.aid_type_name}
                                <span className="opacity-60 font-normal">·</span>
                                <span className="opacity-80 font-normal">{r.date}</span>
                                {/* زر حذف صغير على هوفر */}
                                <button
                                  onClick={() => setConfirmDelete(r.id)}
                                  data-testid={`delete-badge-${r.id}`}
                                  title="حذف هذا السجل"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity ms-0.5 hover:text-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                      </div>
                    </td>

                    {/* عدد المساعدات */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-cairo font-bold text-sm">
                        {fRecords.length}
                      </span>
                    </td>

                    {/* إجراءات */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => navigate(`/families/${familyId}`)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title="فتح ملف العائلة"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual add modal */}
      {addModal && (
        <ManualAidModal
          families={families}
          aidTypes={aidTypes}
          fields={fields}
          onClose={() => setAddModal(false)}
        />
      )}

      {/* Import modal */}
      {importModal && (
        <AidImportModal
          fields={fields}
          aidTypes={aidTypes}
          importData={importModal}
          onClose={() => setImportModal(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["aid-records-all"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            setImportModal(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف سجل المساعدة"
        message="هل تريد حذف هذا السجل نهائياً؟"
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        isOpen={confirmDeleteAll}
        title="حذف جميع سجلات المساعدات"
        message={`ستُحذف ${records.length} سجل مساعدة نهائياً. هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="نعم، احذف الكل"
        type="danger"
        onConfirm={() => { delAllMut.mutate(); setConfirmDeleteAll(false); }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}

// ─── Manual Aid Record Modal ──────────────────────────────────────────────────
function ManualAidModal({ families, aidTypes, fields, onClose }) {
  const qc = useQueryClient();
  const nameKey = fields[0]?.key;
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [form, setForm] = useState({
    aid_type_id: aidTypes[0]?.id || "",
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    notes: "",
  });

  const filtered = families
    .filter((f) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return Object.values(f.data || {}).some((v) => String(v).toLowerCase().includes(s));
    })
    .sort((a, b) =>
      String(a.data?.[nameKey] || "").localeCompare(String(b.data?.[nameKey] || ""), "ar")
    );

  const mut = useMutation({
    mutationFn: () => api.post("/aid-records", { family_id: selectedFamily.id, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aid-records-all"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم تسجيل المساعدة بنجاح");
      onClose();
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-0 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="manual-aid-modal">
        <div className="h-1 bg-gradient-to-l from-green-500 to-emerald-400" />
        <div className="p-7 overflow-y-auto max-h-[85vh]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-500/30">
                <HandHeart className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-cairo font-bold text-slate-900">تسجيل مساعدة يدوي</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Family selector */}
            <div>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">
                اختر العائلة <span className="text-red-500">*</span>
                {selectedFamily && (
                  <span className="mr-2 text-xs text-green-600 font-normal bg-green-50 px-2 py-0.5 rounded-full">
                    {selectedFamily.data?.[nameKey] || "مختارة"}
                  </span>
                )}
              </label>
              <div className="relative mb-2">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  data-testid="manual-aid-family-search"
                  placeholder="بحث عن عائلة..."
                  className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {filtered.slice(0, 50).map((f) => (
                  <button key={f.id} type="button"
                    onClick={() => setSelectedFamily(f)}
                    data-testid={`select-family-${f.id}`}
                    className={`w-full text-start px-4 py-2.5 font-tajawal text-sm transition-colors border-b border-slate-100 last:border-0 ${
                      selectedFamily?.id === f.id ? "bg-green-50 text-green-800 font-bold" : "text-slate-700 hover:bg-slate-50"
                    }`}>
                    {fields.map((fld) => f.data?.[fld.key]).filter(Boolean).join(" - ")}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400 font-tajawal">لا توجد نتائج</div>
                )}
              </div>
            </div>

            {/* Aid details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">نوع المساعدة <span className="text-red-500">*</span></label>
                <select value={form.aid_type_id} onChange={(e) => setForm({ ...form, aid_type_id: e.target.value })}
                  data-testid="manual-aid-type-select"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50">
                  {aidTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">التاريخ <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  data-testid="manual-aid-date-input"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">الكمية (اختياري)</label>
                <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  data-testid="manual-aid-quantity-input" placeholder="مثال: 2 سلة"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  data-testid="manual-aid-notes-input"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!selectedFamily || mut.isPending}
            onClick={() => mut.mutate()}
            data-testid="save-manual-aid-button"
            className="w-full mt-5 bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-green-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            {selectedFamily ? `تسجيل مساعدة لـ ${selectedFamily.data?.[fields[0]?.key] || "العائلة"}` : "اختر عائلة أولاً"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Aid Import Modal ──────────────────────────────────────────────────────────
function AidImportModal({ fields, aidTypes, importData, onClose, onDone }) {
  const { preview = [], suggested_header = 0, total_rows = 0 } = importData;
  const [headerRow, setHeaderRow] = useState(suggested_header);
  const [aidTypeId, setAidTypeId] = useState(aidTypes[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [matchFieldKey, setMatchFieldKey] = useState(fields[0]?.key || "");
  const [matchColumn, setMatchColumn] = useState("");
  const [fuzzy, setFuzzy] = useState(true);
  const [result, setResult] = useState(null);

  const columns = (preview[headerRow] || [])
    .map((name, idx) => ({ idx, name: (name == null ? "" : String(name)).trim() }))
    .filter((c) => c.name !== "");

  const dataRowCount = Math.max(0, total_rows - (headerRow + 1));

  const mut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", importData.file);
      fd.append("header_row", String(headerRow));
      fd.append("match_column", String(matchColumn));
      fd.append("match_field_key", matchFieldKey);
      fd.append("aid_type_id", aidTypeId);
      fd.append("date", date);
      fd.append("fuzzy", String(fuzzy));
      return api.post("/aid-records/import", fd);
    },
    onSuccess: (r) => {
      setResult(r.data);
      if (r.data.created > 0) toast.success(`تم تسجيل ${r.data.created} مساعدة`);
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  const rowLabel = (r, i) => `صف ${i + 1}: ${r.filter((c) => c != null && c !== "").slice(0, 4).map(String).join(" | ") || "(فارغ)"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative rounded-3xl p-0 w-full max-w-xl max-h-[92vh] overflow-hidden animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="aid-import-modal">
        <div className="h-1 bg-gradient-to-l from-green-500 to-emerald-500" />
        <div className="p-7 overflow-y-auto max-h-[88vh]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-cairo font-bold text-slate-900">استيراد توزيع مساعدات</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
          </div>

          {result ? (
            <div className="py-2" data-testid="aid-import-result">
              <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <div className="font-tajawal text-green-800 text-sm">
                  تم تسجيل <span className="font-bold">{result.created}</span> مساعدة بنجاح.
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
                  <p className="text-xs text-slate-500 font-tajawal mt-2">تأكد من صحة أسماء العائلات في الملف أو قلّل حد التطابق</p>
                </div>
              )}
              <button onClick={onDone} data-testid="aid-import-done-button"
                className="w-full mt-2 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 transition-all">
                تم
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-tajawal text-slate-500 mb-4">ارفع قائمة العائلات المستفيدة وحدّد نوع المساعدة وتاريخها.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-tajawal font-bold text-slate-600 mb-1.5">نوع المساعدة</label>
                  <select value={aidTypeId} onChange={(e) => setAidTypeId(e.target.value)} data-testid="aid-import-type-select"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    {aidTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-tajawal font-bold text-slate-600 mb-1.5">تاريخ التوزيع</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="aid-import-date-input"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>

              {/* Fuzzy matching toggle */}
              <label className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-2.5 mb-3 cursor-pointer">
                <input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)}
                  data-testid="fuzzy-toggle" className="w-4 h-4 accent-blue-600" />
                <div>
                  <div className="text-sm font-tajawal font-bold text-blue-800">تطابق تقريبي للأسماء العربية</div>
                  <div className="text-xs font-tajawal text-blue-600">يعالج اختلاف التشكيل، الهمزات، TA مربوطة، والأسماء المختصرة</div>
                </div>
              </label>

              <div className="bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-3 mb-3">
                <label className="block text-xs font-tajawal font-bold text-slate-600 mb-1.5">صف العناوين في الملف</label>
                <select value={headerRow} onChange={(e) => { setHeaderRow(Number(e.target.value)); setMatchColumn(""); }}
                  data-testid="aid-header-row-select"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none">
                  {preview.map((r, i) => <option key={i} value={i}>{rowLabel(r, i)}</option>)}
                </select>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 w-1/2 min-w-0">
                    <ListChecks className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-tajawal font-bold text-slate-800 text-sm">طابق العائلات حسب</span>
                  </div>
                  <select value={matchFieldKey} onChange={(e) => setMatchFieldKey(e.target.value)} data-testid="aid-match-field-select"
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 w-1/2 min-w-0">
                    <ArrowLeftRight className="w-4 h-4 text-slate-300 shrink-0" />
                    <span className="font-tajawal font-bold text-slate-800 text-sm">العمود المقابل في الملف</span>
                  </div>
                  <select value={matchColumn} onChange={(e) => setMatchColumn(e.target.value)} data-testid="aid-match-column-select"
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="">— اختر العمود —</option>
                    {columns.map((c) => <option key={c.idx} value={c.idx}>{c.name || `عمود ${c.idx + 1}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">إلغاء</button>
                <button onClick={() => { if (!matchColumn && matchColumn !== 0) return toast.error("حدّد عمود المطابقة"); mut.mutate(); }}
                  disabled={mut.isPending} data-testid="confirm-aid-import-button"
                  className="flex-[2] bg-gradient-to-l from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-green-600/25">
                  {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  تسجيل المساعدة لـ {dataRowCount} عائلة
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
