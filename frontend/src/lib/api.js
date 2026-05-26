import axios from "axios";
import { tokenStore } from "./tokenStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

<<<<<<< HEAD
// withCredentials sends the httpOnly `access_token` cookie set by /auth/login.
export const api = axios.create({ baseURL: API, withCredentials: true });

// ── Token refresh interceptor ─────────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue = [];   // pending requests waiting for the new token

function processQueue(error) {
  _refreshQueue.forEach((cb) => (error ? cb.reject(error) : cb.resolve()));
  _refreshQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // Only retry on 401, and only once, and not on the refresh endpoint itself
    if (
      err.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes("/auth/refresh") &&
      !original.url?.includes("/auth/login")
    ) {
      if (_isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retried = true;
      _isRefreshing = true;

      try {
        await api.post("/auth/refresh");
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Refresh failed — clear local session flag and redirect to login
        try { sessionStorage.removeItem("ibp_session"); } catch (_) {}
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        import axios from "axios";
        import { tokenStore } from "./tokenStore";

        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
        export const API = `${BACKEND_URL}/api`;

        export const api = axios.create({ baseURL: API, withCredentials: true });

        /** Auto-refresh interceptor: on a 401 from any *non-auth* endpoint, try to
         *  silently refresh the token once and retry. Falls through to /login if the
         *  refresh itself returns 401. */
        let refreshing = null;
        api.interceptors.response.use(
          (r) => r,
          async (err) => {
            const status = err?.response?.status;
            const cfg = err?.config || {};
            const url = cfg.url || "";
            const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register")
              || url.includes("/auth/refresh") || url.includes("/auth/me");
            if (status !== 401 || cfg._retried || isAuthCall) return Promise.reject(err);
            cfg._retried = true;
            if (!refreshing) {
              refreshing = api.post("/auth/refresh")
                .then(() => { tokenStore.markActive(); })
                .catch((e) => {
                  tokenStore.clear();
                  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                    window.location.assign("/login");
                  }
                  throw e;
                })
                .finally(() => { refreshing = null; });
            }
            try {
              await refreshing;
              return api(cfg);
            } catch {
              return Promise.reject(err);
            }
          },
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
