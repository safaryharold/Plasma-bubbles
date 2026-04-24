import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null while checking, object or false
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ibp_token");
    if (!token) { setUser(false); setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("ibp_token"); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ibp_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const signUp = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("ibp_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const signOut = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("ibp_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
