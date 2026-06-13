import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("camp_token");
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("camp_token");
        setUser(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("camp_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithToken = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    const dest = user && user.role === "family" ? "/family-login" : "/login";
    localStorage.removeItem("camp_token");
    setUser(false);
    window.location.href = dest;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, loginWithToken, logout, loading, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
