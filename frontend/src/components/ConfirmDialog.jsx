import { useEffect } from "react";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";

/**
 * Professional glassmorphism confirmation dialog
 * type: "danger" | "warning" | "info"
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  type = "danger",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const iconBg = {
    danger: "from-red-500 to-rose-600",
    warning: "from-amber-500 to-orange-500",
    info: "from-blue-500 to-blue-600",
  }[type];

  const btnColor = {
    danger: "bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/30",
    warning: "bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30",
    info: "bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/30",
  }[type];

  const IconComp = type === "danger" ? Trash2 : type === "warning" ? AlertTriangle : ShieldAlert;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      data-testid="confirm-dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
        onClick={onCancel}
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm animate-fade-up"
        style={{ zIndex: 1000 }}
      >
        {/* Glass container */}
        <div className="relative overflow-hidden rounded-3xl border border-white/30 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.95) 100%)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
          }}
        >
          {/* Top accent */}
          <div className={`h-1 w-full bg-gradient-to-l ${iconBg}`} />

          <div className="p-7">
            {/* Close button */}
            <button
              onClick={onCancel}
              data-testid="confirm-dialog-cancel-x"
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>

            {/* Icon */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg mb-4`}>
                <IconComp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-cairo font-extrabold text-slate-900 mb-2">{title}</h3>
              <p className="font-tajawal text-slate-600 text-sm leading-relaxed">{message}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                data-testid="confirm-dialog-cancel"
                className="flex-1 px-4 py-3 rounded-2xl font-tajawal font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                data-testid="confirm-dialog-confirm"
                className={`flex-[1.5] px-4 py-3 rounded-2xl font-tajawal font-bold text-white shadow-lg transition-all duration-200 ${btnColor}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
