import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { tokenStore } from "../lib/tokenStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null while checking, object or false
  const [loading, setLoading] = useState(true);

  // Boot: ask the server who we are. The httpOnly cookie travels via
  // withCredentials; if it's expired or missing we fall through to "logged out".
  useEffect(() => {
    if (!tokenStore.isActive()) {
      // Optimistically still try /auth/me — the cookie might exist from another tab.
    }
    api.get("/auth/me")
      .then((r) => { tokenStore.markActive(); setUser(r.data); })
      .catch(() => { tokenStore.clear(); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.markActive();
    setUser(data.user);
    return data.user;
  }, []);

  const signUp = useCallback(async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    tokenStore.markActive();
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Network error or already-expired session — log and continue clearing local state.
      console.error("Logout request failed:", err);
    }
    tokenStore.clear();
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
