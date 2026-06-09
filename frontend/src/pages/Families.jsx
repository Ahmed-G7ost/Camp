import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  Plus, Search, Loader2, Users, Pencil, Trash2, Eye,
  Upload, Download, FileSpreadsheet, X, Settings,
  ArrowLeftRight, ListChecks, HandHeart, Trash, ArrowDownAZ, ArrowUpAZ, SlidersHorizontal,
} from "lucide-react";

async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Families() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const fileRef = useRef();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [filterFieldKey, setFilterFieldKey] = useState("");
  const [filterFieldVal, setFilterFieldVal] = useState("");
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);   // single family id
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false); // bulk delete

  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: async () => (await api.get("/family-fields")).data,
  });
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families"],
    queryFn: async () => (await api.get("/families")).data,
  });
  const { data: aidRecords = [] } = useQuery({
    queryKey: ["aid-records-all"],
    queryFn: async () => (await api.get("/aid-records")).data,
  });

  const aidCountByFamily = aidRecords.reduce((acc, r) => {
    acc[r.family_id] = (acc[r.family_id] || 0) + 1;
    return acc;
  }, {});

  // Single delete
  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/families/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("تم حذف العائلة بنجاح");
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  // Bulk delete all
  const delAllMut = useMutation({
    mutationFn: () => api.delete("/families/all"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["families"] });
      qc.invalidateQueries({ queryKey: ["aid-records-all"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`تم حذف ${r.data.deleted} عائلة وجميع سجلاتها`);
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail)),
  });

  // Import
  const importMut = useMutation({
    mutationFn: ({ file, mapping, headerRow }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("header_row", String(headerRow));
      // Do NOT set Content-Type manually – let axios/browser set the boundary automatically
      return api.post("/families/import", fd);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["families"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`تم استيراد ${r.data.imported} عائلة بنجاح`);
      setImportModal(null);
    },
    onError: (e) => toast.error(apiError(e.response?.data?.detail) || "فشل الاستيراد"),
  });

  const handleFileSelect = async (file) => {
    if (!fields.length) {
      toast.error("أضف حقول العائلة أولاً من الإعدادات");
      return;
    }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/families/import/columns", fd);
      if (!data.preview?.length) {
        toast.error("الملف فارغ أو غير مدعوم");
        return;
      }
      setImportModal({ file, ...data });
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "تعذّر قراءة الملف");
    } finally {
      setPreviewing(false);
    }
  };

  const nameKey = fields[0]?.key;
  const filtered = families
    .filter((f) => {
      if (!search) return true;
      return Object.values(f.data || {}).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase())
      );
    })
    .filter((f) => {
      if (!filterFieldKey || !filterFieldVal.trim()) return true;
      return String(f.data?.[filterFieldKey] || "").toLowerCase().includes(filterFieldVal.trim().toLowerCase());
    })
    .sort((a, b) => {
      const cmp = String(a.data?.[nameKey] || "").localeCompare(String(b.data?.[nameKey] || ""), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className="space-y-6" data-testid="families-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">العائلات</h1>
          <p className="text-slate-500 font-tajawal mt-1">{families.length} عائلة مسجّلة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Template */}
          <button onClick={() => downloadFile("/families/template", "نموذج_العائلات.xlsx")}
            data-testid="download-template-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            <FileSpreadsheet className="w-5 h-5" /> نموذج
          </button>
          {/* Export */}
          <button onClick={() => downloadFile("/families/export", "العائلات.xlsx")}
            data-testid="export-families-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            <Download className="w-5 h-5" /> تصدير
          </button>
          {/* Import */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden data-testid="import-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={previewing || importMut.isPending}
            data-testid="import-families-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-60">
            {previewing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            استيراد
          </button>
          {/* Delete All (admin only) */}
          {isAdmin && families.length > 0 && (
            <button onClick={() => setConfirmDeleteAll(true)}
              data-testid="delete-all-families-button"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 transition-all shadow-md shadow-red-600/25">
              <Trash className="w-5 h-5" /> حذف الكل
            </button>
          )}
          {/* Add */}
          <button
            onClick={() => {
              if (!fields.length) {
                toast.error("أضف حقول العائلة أولاً من الإعدادات");
                return;
              }
              setModal({ mode: "add" });
            }}
            data-testid="add-family-button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md shadow-blue-600/25">
            <Plus className="w-5 h-5" /> إضافة عائلة
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-up">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="families-search"
            placeholder="بحث في العائلات..."
            className="w-full bg-white border border-slate-200 rounded-xl ps-12 pe-4 py-3 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          data-testid="families-sort-toggle" title="ترتيب الأسماء"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all whitespace-nowrap">
          {sortDir === "asc" ? <ArrowDownAZ className="w-5 h-5" /> : <ArrowUpAZ className="w-5 h-5" />}
          {sortDir === "asc" ? "أ → ي" : "ي → أ"}
        </button>
      </div>

      {/* Advanced filter */}
      {fields.length > 0 && (
        <div className="glass-card rounded-2xl p-4 animate-fade-up flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap" data-testid="families-advanced-filters">
          <div className="flex items-center gap-2 text-slate-700 font-tajawal font-bold">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" /> فلترة متقدمة
          </div>
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">الحقل</label>
            <select value={filterFieldKey} onChange={(e) => setFilterFieldKey(e.target.value)} data-testid="families-filter-field-select"
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">— بدون —</option>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-tajawal font-bold text-slate-500 mb-1">القيمة تحتوي</label>
            <input value={filterFieldVal} onChange={(e) => setFilterFieldVal(e.target.value)} data-testid="families-filter-field-value"
              disabled={!filterFieldKey} placeholder="اكتب قيمة..."
              className="w-44 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50" />
          </div>
          {filterFieldKey && filterFieldVal.trim() && (
            <>
              <span className="text-xs font-tajawal text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-bold">{filtered.length} نتيجة</span>
              <button onClick={() => { setFilterFieldKey(""); setFilterFieldVal(""); }} data-testid="families-clear-filters"
                className="flex items-center gap-1 px-3 py-2 rounded-lg font-tajawal font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                <X className="w-4 h-4" /> إلغاء الفلتر
              </button>
            </>
          )}
        </div>
      )}

      {/* Body */}
      {!fields.length ? (
        <EmptyFields isAdmin={isAdmin} navigate={navigate} />
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-tajawal text-slate-500">لا توجد عائلات مطابقة</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {fields.map((f) => (
                    <th key={f.id} className="text-start px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm text-start whitespace-nowrap">المساعدات</th>
                  <th className="px-4 py-3.5 font-cairo font-bold text-slate-600 text-sm text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((fam) => (
                  <tr key={fam.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`family-row-${fam.id}`}>
                    {fields.map((f) => (
                      <td key={f.id} className="px-4 py-3.5 font-tajawal text-slate-700 text-sm whitespace-nowrap">{fam.data?.[f.key] || "—"}</td>
                    ))}
                    <td className="px-4 py-3.5">
                      <button onClick={() => navigate(`/families/${fam.id}`)} data-testid={`family-aid-count-${fam.id}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-tajawal font-bold transition-colors ${
                          aidCountByFamily[fam.id] ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}>
                        <HandHeart className="w-3.5 h-3.5" /> {aidCountByFamily[fam.id] || 0}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/families/${fam.id}`)} data-testid={`view-family-${fam.id}`} title="عرض"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ mode: "edit", family: fam })} data-testid={`edit-family-${fam.id}`} title="تعديل"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete(fam.id)} data-testid={`delete-family-${fam.id}`} title="حذف"
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

      {/* Modals */}
      {modal && <FamilyModal fields={fields} modal={modal} onClose={() => setModal(null)} />}
      {importModal && (
        <ImportMappingModal
          fields={fields}
          importData={importModal}
          importing={importMut.isPending}
          onClose={() => setImportModal(null)}
          onConfirm={({ mapping, headerRow }) =>
            importMut.mutate({ file: importModal.file, mapping, headerRow })
          }
        />
      )}

      {/* Single delete confirm */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="حذف العائلة"
        message="هل أنت متأكد من حذف هذه العائلة وجميع مساعداتها؟ لا يمكن التراجع."
        confirmLabel="نعم، احذف"
        type="danger"
        onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        isOpen={confirmDeleteAll}
        title="حذف جميع العائلات"
        message={`ستُحذف ${families.length} عائلة وجميع سجلات مساعداتها نهائياً. هذا الإجراء لا يمكن التراجع عنه إطلاقاً.`}
        confirmLabel="نعم، احذف الكل"
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={() => { delAllMut.mutate(); setConfirmDeleteAll(false); }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}

// ─── Empty fields helper ────────────────────────────────────────────────────
function EmptyFields({ isAdmin, navigate }) {
  return (
    <div className="glass-card rounded-2xl p-16 text-center animate-fade-up">
      <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <h3 className="font-cairo font-bold text-slate-700 text-lg">لم يتم تعريف حقول العائلة بعد</h3>
      <p className="font-tajawal text-slate-500 mt-1 mb-4">قم بتعريف الحقول من الإعدادات أولاً</p>
      {isAdmin && (
        <button onClick={() => navigate("/settings")} data-testid="goto-settings-button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-tajawal font-bold text-white bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all">
          الذهاب للإعدادات
        </button>
      )}
    </div>
  );
}

// ─── Add / Edit family modal ─────────────────────────────────────────────────
function FamilyModal({ fields, modal, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => {
    const init = {};
    fields.forEach((f) => (init[f.key] = modal.family?.data?.[f.key] || ""));
    return init;
  });

  const mut = useMutation({
    mutationFn: () =>
      modal.mode === "add"
        ? api.post("/families", { data: form })
        : api.put(`/families/${modal.family.id}`, { data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(modal.mode === "add" ? "تمت إضافة العائلة" : "تم تحديث بيانات العائلة");
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
        data-testid="family-modal"
      >
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-blue-600 to-blue-400" />
        <div className="flex items-center justify-between mb-5 mt-2">
          <h3 className="text-xl font-cairo font-bold text-slate-900">
            {modal.mode === "add" ? "إضافة عائلة جديدة" : "تعديل بيانات العائلة"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          {fields.map((f) => (
            <div key={f.id}>
              <label className="block text-sm font-tajawal font-bold text-slate-700 mb-1.5">{f.label}</label>
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "tel" ? "tel" : "text"}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                data-testid={`family-field-${f.key}`}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-tajawal focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          ))}
          <button type="submit" disabled={mut.isPending} data-testid="save-family-button"
            className="w-full bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25">
            {mut.isPending && <Loader2 className="w-5 h-5 animate-spin" />} حفظ
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Import mapping modal ────────────────────────────────────────────────────
function ImportMappingModal({ fields, importData, importing, onClose, onConfirm }) {
  const { preview = [], suggested_header = 0, total_rows = 0 } = importData;
  const [headerRow, setHeaderRow] = useState(suggested_header);

  const getColumns = (row) =>
    (preview[row] || [])
      .map((name, idx) => ({ idx, name: (name == null ? "" : String(name)).trim() }))
      .filter((c) => c.name !== "");

  const buildAutoMapping = (cols) => {
    const init = {};
    fields.forEach((f) => {
      const hit = cols.find((c) => c.name === f.label.trim());
      init[f.key] = hit != null ? String(hit.idx) : "";
    });
    return init;
  };

  const [columns, setColumns] = useState(() => getColumns(suggested_header));
  const [mapping, setMapping] = useState(() => buildAutoMapping(getColumns(suggested_header)));

  const handleHeaderChange = (val) => {
    const row = Number(val);
    setHeaderRow(row);
    const cols = getColumns(row);
    setColumns(cols);
    setMapping(buildAutoMapping(cols));
  };

  const mappedCount = Object.values(mapping).filter((v) => v !== "").length;
  const dataRowCount = Math.max(0, total_rows - (headerRow + 1));
  const dataPreviewRows = preview.slice(headerRow + 1).filter((r) => r.some((c) => c != null && c !== "")).slice(0, 3);

  const submit = () => {
    if (mappedCount === 0) {
      toast.error("اربط عموداً واحداً على الأقل بالحقول");
      return;
    }
    onConfirm({ mapping, headerRow });
  };

  const rowLabel = (r, i) => {
    const cells = r.filter((c) => c != null && c !== "").slice(0, 4).map(String);
    return `صف ${i + 1}: ${cells.join(" | ") || "(فارغ)"}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative rounded-3xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-up border border-white/30 shadow-2xl"
        style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.95) 0%,rgba(248,250,252,0.97) 100%)", backdropFilter: "blur(30px)" }}
        data-testid="import-mapping-modal"
      >
        <div className="h-1 absolute top-0 left-0 right-0 rounded-t-3xl bg-gradient-to-l from-green-500 to-emerald-500" />
        <div className="flex items-center justify-between mb-2 mt-2">
          <h3 className="text-xl font-cairo font-bold text-slate-900">استيراد العائلات من Excel</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <p className="text-sm font-tajawal text-slate-500 mb-4">
          حدّد صف العناوين ثم اربط أعمدة الملف بالحقول المطلوبة.
        </p>

        {/* Header row selector */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <label className="block text-xs font-tajawal font-bold text-blue-700 mb-1.5">
            صف العناوين (السطر الذي يحتوي أسماء الأعمدة)
          </label>
          <select value={headerRow} onChange={(e) => handleHeaderChange(e.target.value)}
            data-testid="header-row-select"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            {preview.map((r, i) => (
              <option key={i} value={i}>{rowLabel(r, i)}</option>
            ))}
          </select>
          <p className="text-xs font-tajawal text-slate-500 mt-2">
            أعمدة مُكتشفة: <span className="font-bold text-slate-700">{columns.length}</span>
            {" — "}سيتم استيراد: <span className="font-bold text-slate-700">{dataRowCount}</span> صف
          </p>
        </div>

        {/* Field–column mapping */}
        <div className="space-y-3 mb-5">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-white/70 border border-slate-100 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2 w-1/2 min-w-0">
                <ListChecks className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="font-tajawal font-bold text-slate-800 truncate text-sm">{f.label}</span>
              </div>
              <ArrowLeftRight className="w-4 h-4 text-slate-300 shrink-0" />
              <select
                value={mapping[f.key] ?? ""}
                onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                data-testid={`map-field-${f.key}`}
                className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-tajawal text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">— تجاهل —</option>
                {columns.map((c) => (
                  <option key={c.idx} value={String(c.idx)}>{c.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Data preview */}
        {dataPreviewRows.length > 0 && columns.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-tajawal font-bold text-slate-400 mb-2">معاينة أول البيانات:</div>
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.idx} className="text-start px-3 py-2 font-cairo font-bold text-slate-600 whitespace-nowrap">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataPreviewRows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c.idx} className="px-3 py-2 font-tajawal text-slate-600 whitespace-nowrap">
                          {row[c.idx] != null ? String(row[c.idx]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-tajawal font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
            إلغاء
          </button>
          <button onClick={submit} disabled={importing || mappedCount === 0}
            data-testid="confirm-import-button"
            className="flex-[2] bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25">
            {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            استيراد {dataRowCount} عائلة ({mappedCount} حقل)
          </button>
        </div>
      </div>
    </div>
  );
}
