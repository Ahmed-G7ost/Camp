import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { ensureUserProfile, setActiveUser } from "../lib/db";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setActiveUser(null);
        setUser(false);
        setLoading(false);
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setActiveUser(profile);
        setUser(profile);
      } catch (e) {
        console.error("Failed to load user profile", e);
        setUser(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const profile = await ensureUserProfile(cred.user);
    setActiveUser(profile);
    setUser(profile);
    return profile;
  };

  const loginWithToken = (userData) => {
    setUser(userData);
    setActiveUser(userData);
  };

  const logout = async () => {
    try { await signOut(auth); } catch {}
    setActiveUser(null);
    setUser(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, loginWithToken, logout, loading, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
