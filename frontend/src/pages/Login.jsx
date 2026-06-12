import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { auth as fbAuth, signInWithEmailAndPassword } from "../lib/firebase";
import api from "../lib/api";
import { lookupFamilyAuth } from "../lib/familyApi";
import { Tent, Loader2, LogIn, ShieldCheck, AlertTriangle, Users, ArrowRight, KeyRound } from "lucide-react";

// Firebase is now embedded directly in the frontend (config in lib/firebase.js)
const FIREBASE_ENABLED = true;

// ── إعدادات الحظر بعد المحاولات الخاطئة ──
const LOCK_KEY = "family_lockout";
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 5 * 60 * 1000; // 5 دقائق

function readLocks() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}");
  } catch {
    return {};
  }
}
function getLock(id) {
  return readLocks()[id] || { count: 0, blockedUntil: 0 };
}
function setLock(id, val) {
  const all = readLocks();
  all[id] = val;
  localStorage.setItem(LOCK_KEY, JSON.stringify(all));
}
function clearLock(id) {
  const all = readLocks();
  delete all[id];
  localStorage.setItem(LOCK_KEY, JSON.stringify(all));
}
function blockRemainingMs(id) {
  const l = getLock(id);
  const r = (l.blockedUntil || 0) - Date.now();
  return r > 0 ? r : 0;
}
// تسجيل محاولة خاطئة وإرجاع المدة المتبقية للحظر (إن وُجد)
function registerFail(id) {
  const l = getLock(id);
  let count = (l.count || 0) + 1;
  let blockedUntil = l.blockedUntil || 0;
  if (count >= MAX_ATTEMPTS) {
    blockedUntil = Date.now() + BLOCK_MS;
    count = 0;
  }
  setLock(id, { count, blockedUntil });
  return blockRemainingMs(id);
}
function blockMsg(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `تم حظر الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. الرجاء المحاولة بعد ${m}:${String(s).padStart(2, "0")} دقيقة.`;
}

// ── اختيار سؤال عشوائي مختلف عن السابق ما أمكن ──
function pickQuestion(pool, prevType) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const others = pool.filter((q) => q.type !== prevType);
  const arr = others.length ? others : pool;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── مطابقة الإجابة ──
function normalizeDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return s;
}
function matchAnswer(question, ans) {
  if (!question) return false;
  if (question.type === "wife_id") {
    return ans.replace(/\s/g, "") === String(question.answer).replace(/\s/g, "");
  }
  const a = normalizeDate(ans);
  const b = normalizeDate(question.answer);
  return !!a && a === b;
}

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("admin"); // "admin" or "family"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // حالة تسجيل دخول العائلات (خطوتان: الهوية ثم سؤال التحقق)
  const [familyStep, setFamilyStep] = useState("id"); // "id" | "verify"
  const [pendingFamily, setPendingFamily] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [, setTick] = useState(0); // لتحديث العدّاد التنازلي للحظر

  // عدّاد حي يحدّث رسالة الحظر كل ثانية
  useEffect(() => {
    const t = setInterval(() => {
      if (blockRemainingMs(nationalId.trim()) > 0) setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [nationalId]);

  const resetFamilyFlow = () => {
    setFamilyStep("id");
    setPendingFamily(null);
    setQuestions([]);
    setQuestion(null);
    setAnswer("");
  };

  // الخطوة 1: التحقق من رقم الهوية وتحديد سؤال التحقق
  const handleContinue = async () => {
    setError("");
    const id = nationalId.trim();
    if (!id) {
      setError("الرجاء إدخال رقم الهوية");
      return;
    }
    const rem = blockRemainingMs(id);
    if (rem > 0) {
      setError(blockMsg(rem));
      return;
    }
    setLoading(true);
    try {
      const { familyUser, questions: pool } = await lookupFamilyAuth(id);
      if (!pool.length) {
        // أرملة/مطلقة/أنسة بدون تاريخ ميلاد → لا توجد بيانات للتحقق → منع الدخول
        setError(
          "لا يمكن تسجيل الدخول حالياً: لا توجد بيانات تحقق (تاريخ الميلاد) مسجّلة لهذه العائلة. الرجاء مراجعة إدارة المخيم."
        );
        setLoading(false);
        return;
      }
      setPendingFamily(familyUser);
      setQuestions(pool);
      setQuestion(pickQuestion(pool, null));
      setAnswer("");
      setFamilyStep("verify");
    } catch (err) {
      const rem2 = registerFail(id);
      setError(rem2 > 0 ? blockMsg(rem2) : err.message || "رقم الهوية غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  // الخطوة 2: التحقق من إجابة سؤال الأمان
  const handleVerify = () => {
    setError("");
    const id = nationalId.trim();
    const rem = blockRemainingMs(id);
    if (rem > 0) {
      setError(blockMsg(rem));
      return;
    }
    const ans = answer.trim();
    if (!ans) {
      setError("الرجاء إدخال الإجابة");
      return;
    }

    if (matchAnswer(question, ans)) {
      clearLock(id);
      localStorage.setItem("camp_token", `family-${pendingFamily.id}`);
      localStorage.setItem("camp_user", JSON.stringify(pendingFamily));
      loginWithToken(pendingFamily);
      navigate("/family-portal");
      return;
    }

    const rem2 = registerFail(id);
    if (rem2 > 0) {
      setError(blockMsg(rem2));
      resetFamilyFlow();
    } else {
      const attemptsLeft = MAX_ATTEMPTS - getLock(id).count;
      setError(`إجابة غير صحيحة. المحاولات المتبقية قبل الحظر: ${attemptsLeft}`);
      setQuestion(pickQuestion(questions, question?.type)); // سؤال مختلف في المحاولة التالية
      setAnswer("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    // تسجيل دخول العائلات
    if (loginType === "family") {
      if (familyStep === "id") return handleContinue();
      return handleVerify();
    }

    // تسجيل دخول الموظفين (admin/staff)
    setError("");
    setLoading(true);
    try {
      if (FIREBASE_ENABLED) {
        try {
          const credential = await signInWithEmailAndPassword(fbAuth, email, password);
          const idToken = await credential.user.getIdToken();
          const { data } = await api.post("/auth/firebase-login", { id_token: idToken });
          localStorage.setItem("camp_token", data.token);
          loginWithToken(data.user);
          navigate("/");
          return;
        } catch (fbErr) {
          const code = fbErr.code || "";
          if (
            code.includes("user-not-found") ||
            code.includes("wrong-password") ||
            code.includes("invalid-credential")
          ) {
            // Fall through to password login
          } else if (code.includes("network") || code.includes("timeout")) {
            // Fall through to password login
          } else if (fbErr.response) {
            throw fbErr;
          }
        }
      }

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

  const switchType = (type) => {
    setLoginType(type);
    setError("");
    resetFamilyFlow();
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
          <p className="text-slate-500 font-tajawal mt-1" data-testid="login-subtitle">
            {loginType === "admin"
              ? "نظام إدارة وتوزيع المساعدات"
              : "بوابة العائلات — متابعة بياناتكم وخدماتكم"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="glass-card rounded-3xl p-8 space-y-5" data-testid="login-form">
          {/* Tabs للتبديل بين تسجيل دخول الموظفين والعائلات */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => switchType("admin")}
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
              onClick={() => switchType("family")}
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
          ) : familyStep === "id" ? (
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
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs font-tajawal text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                <KeyRound className="w-4 h-4 shrink-0" />
                سؤال التحقق للتأكد من هويتك
              </div>

              <div>
                <label className="block text-sm font-tajawal font-bold text-slate-700 mb-2" data-testid="verify-question-label">
                  {question?.type === "birth_date"
                    ? "ما هو تاريخ ميلاد رب الأسرة؟"
                    : "ما هو رقم هوية الزوجة؟"}
                </label>
                <input
                  type={question?.type === "birth_date" ? "date" : "text"}
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  data-testid="family-verify-answer-input"
                  placeholder={question?.type === "birth_date" ? "" : "رقم هوية الزوجة"}
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 font-tajawal text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  resetFamilyFlow();
                }}
                data-testid="family-back-button"
                className="flex items-center gap-1.5 text-sm font-tajawal font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                رجوع وتغيير رقم الهوية
              </button>
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
            {loginType === "family" && familyStep === "id" ? "متابعة" : "تسجيل الدخول"}
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

