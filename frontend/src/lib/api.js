import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
        _isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join("; ");
  if (d?.msg) return d.msg;
  return String(d);
}
