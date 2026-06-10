import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, signInWithEmailAndPassword, fbSignOut } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { setCurrentUser } from "../lib/api";

const AuthContext = createContext(null);

function authMessage(code) {
  if (!code) return "تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (code.includes("too-many-requests")) return "محاولات كثيرة، يرجى المحاولة لاحقاً";
  if (code.includes("network")) return "تحقق من اتصال الإنترنت";
  if (code.includes("invalid-email")) return "صيغة البريد الإلكتروني غير صحيحة";
  return "تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=guest, object=signed-in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // account disabled by admin?
          const delSnap = await get(ref(db, `deletedUsers/${fbUser.uid}`));
          if (delSnap.exists()) {
            await fbSignOut(auth);
            setCurrentUser(null);
            setUser(false);
            setLoading(false);
            return;
          }
        } catch (_) {}

        let role = "staff";
        let name = fbUser.displayName || fbUser.email?.split("@")[0] || "مستخدم";
        try {
          const snap = await get(ref(db, `users/${fbUser.uid}`));
          if (snap.exists()) {
            const u = snap.val();
            role = u.role || "staff";
            name = u.name || name;
          }
        } catch (_) {}

        const userObj = { id: fbUser.uid, uid: fbUser.uid, email: fbUser.email, name, role };
        setCurrentUser(userObj);
        setUser(userObj);
      } else {
        setCurrentUser(null);
        setUser(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw new Error(authMessage(err?.code));
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (_) {}
    setCurrentUser(null);
    setUser(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, logout, loading, isAdmin: user?.role === "admin" }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
