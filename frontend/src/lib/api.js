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
