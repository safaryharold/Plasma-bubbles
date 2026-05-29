import axios from "axios";
import { tokenStore } from "./tokenStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// withCredentials sends the httpOnly `access_token` cookie set by /auth/login.
export const api = axios.create({ baseURL: API, withCredentials: true });

let refreshPromise = null;

const isAuthRoute = (url = "") => ["/auth/login", "/auth/register", "/auth/refresh", "/auth/me"].some((path) => url.includes(path));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config || {};
    const url = config.url || "";

    if (status !== 401 || config._retried || isAuthRoute(url)) {
      return Promise.reject(error);
    }

    config._retried = true;

    if (!refreshPromise) {
      refreshPromise = api.post("/auth/refresh")
        .then(() => {
          tokenStore.markActive();
          tokenStore.markRefreshed();
        })
        .catch((refreshError) => {
          tokenStore.clear();
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.assign("/login");
          }
          throw refreshError;
        })
        .finally(() => { refreshPromise = null; });
    }

    try {
      await refreshPromise;
      return api(config);
    } catch {
      return Promise.reject(error);
    }
  }
);

// Proactively refresh access token if needed before sending requests.
api.interceptors.request.use(async (config) => {
  try {
    const url = config?.url || "";
    if (isAuthRoute(url) || !tokenStore.isActive()) return config;

    if (tokenStore.shouldRefresh()) {
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh")
          .then(() => { tokenStore.markActive(); tokenStore.markRefreshed(); })
          .catch((err) => {
            tokenStore.clear();
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
              window.location.assign("/login");
            }
            throw err;
          })
          .finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
    }
  } catch (err) {
    // If refresh failed, allow request to proceed — response interceptor will handle 401.
  }
  return config;
});

export function formatApiError(error) {
  if (!error) return "Unknown error";
  const data = error.response?.data;
  if (data?.detail) return String(data.detail);
  if (data?.message) return String(data.message);
  if (typeof error.message === "string") return error.message;
  return "An unexpected error occurred.";
}
