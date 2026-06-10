import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Tent, Loader2, LogIn, ShieldCheck, AlertTriangle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.18),transparent_60%),radial-gradient(ellipse_at_bottom_left,_rgba(22,163,74,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(217,119,6,0.12),transparent_55%)]" />

      <div className="w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
            <Tent className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-cairo font-extrabold text-slate-900">مخيم العائدين</h1>
          <p className="text-slate-500 font-tajawal mt-1">نظام إدارة وتوزيع المساعدات</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="glass-card rounded-3xl p-8 space-y-5" data-testid="login-form">
          <div className="flex items-center gap-2 text-xs font-tajawal text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            تسجيل الدخول عبر Firebase Authentication
          </div>

          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email-input"
              placeholder="admin@camp.com"
              className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 font-tajawal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password-input"
              placeholder="••••••••"
              className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 font-tajawal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {error && (
            <div data-testid="login-error" className="flex items-start gap-2 text-sm font-tajawal text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 shadow-lg shadow-blue-600/25"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            تسجيل الدخول
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-tajawal">
          <ShieldCheck className="w-4 h-4" />
          دخول آمن — للموظفين المصرّح لهم فقط
        </div>
      </div>
    </div>
  );
}
