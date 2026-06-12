import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { auth as fbAuth, signInWithEmailAndPassword } from "../lib/firebase";
import api from "../lib/api";
import { loginFamily } from "../lib/familyApi";
import { Tent, Loader2, LogIn, ShieldCheck, AlertTriangle, Users } from "lucide-react";

// Firebase is now embedded directly in the frontend (config in lib/firebase.js)
const FIREBASE_ENABLED = true;

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("admin"); // "admin" or "family"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // تسجيل دخول العائلات برقم الهوية
      if (loginType === "family") {
        if (!nationalId.trim()) {
          setError("الرجاء إدخال رقم الهوية");
          setLoading(false);
          return;
        }
        
        try {
          const familyUser = await loginFamily(nationalId);
          localStorage.setItem("camp_token", `family-${familyUser.id}`);
          localStorage.setItem("camp_user", JSON.stringify(familyUser));
          loginWithToken(familyUser);
          navigate("/family-portal");
          return;
        } catch (err) {
          setError(err.message || "رقم الهوية غير صحيح");
          setLoading(false);
          return;
        }
      }

      // تسجيل دخول الموظفين (admin/staff)
      if (FIREBASE_ENABLED) {
        // ── Firebase Auth flow ───────────────────────────
        try {
          const credential = await signInWithEmailAndPassword(fbAuth, email, password);
          const idToken = await credential.user.getIdToken();
          const { data } = await api.post("/auth/firebase-login", { id_token: idToken });
          localStorage.setItem("camp_token", data.token);
          loginWithToken(data.user);
          navigate("/");
          return;
        } catch (fbErr) {
          // Firebase error codes
          const code = fbErr.code || "";
          if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
            // Fall through to password login
          } else if (code.includes("network") || code.includes("timeout")) {
            // Fall through to password login
          } else if (fbErr.response) {
            // Backend error
            throw fbErr;
          }
          // Fall through to classic login if Firebase fails
        }
      }

      // ── Classic password login (fallback / default) ──
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("camp_token", data.token);
      loginWithToken(data.user);
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.detail;
      setError(apiError(msg) || "تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.");
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
          {/* Tabs للتبديل بين تسجيل دخول الموظفين والعائلات */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginType("admin");
                setError("");
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-tajawal font-bold text-sm transition-all ${
                loginType === "admin"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="admin-login-tab"
            >
              <ShieldCheck className="w-4 h-4 inline-block ml-2" />
              الموظفين
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginType("family");
                setError("");
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-tajawal font-bold text-sm transition-all ${
                loginType === "family"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="family-login-tab"
            >
              <Users className="w-4 h-4 inline-block ml-2" />
              العائلات
            </button>
          </div>

          {loginType === "admin" ? (
            <>
              {FIREBASE_ENABLED && (
                <div className="flex items-center gap-2 text-xs font-tajawal text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  تسجيل الدخول عبر Firebase Authentication
                </div>
              )}

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
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs font-tajawal text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                <Users className="w-4 h-4 shrink-0" />
                دخول العائلات برقم الهوية
              </div>

              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2">رقم الهوية (رب الأسرة)</label>
                <input
                  type="text"
                  required
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  data-testid="family-national-id-input"
                  placeholder="123456789"
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 font-tajawal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>
            </>
          )}

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
            className={`w-full font-tajawal font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 shadow-lg ${
              loginType === "admin"
                ? "bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-600/25"
                : "bg-gradient-to-l from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-green-600/25"
            }`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            تسجيل الدخول
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-tajawal">
          <ShieldCheck className="w-4 h-4" />
          {loginType === "admin" ? "دخول آمن — للموظفين المصرّح لهم فقط" : "بوابة آمنة للعائلات"}
        </div>
      </div>
    </div>
  );
}
