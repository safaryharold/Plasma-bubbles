import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// withCredentials sends the httpOnly `access_token` cookie set by /auth/login.
// We no longer read the JWT from localStorage — see lib/tokenStore.js.
export const api = axios.create({ baseURL: API, withCredentials: true });

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join("; ");
  if (d?.msg) return d.msg;
  return String(d);
}
