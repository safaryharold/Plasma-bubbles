/**
 * Centralised auth-token storage.
 *
 * Strategy:
 *   - Primary: httpOnly cookie set by the backend on /auth/login + /auth/register.
 *     The cookie is invisible to JavaScript (mitigates XSS exfiltration) and is
 *     attached to API requests automatically when `axios.withCredentials=true`.
 *   - Secondary: sessionStorage stub so we still know "are we logged in?" client
 *     side without an extra /auth/me round-trip on every page load.
 *     sessionStorage is wiped on tab close (smaller XSS surface than localStorage)
 *     and intentionally NEVER holds the actual JWT — only a sentinel "1" flag.
 *
 * Migrating away from localStorage in one place keeps the rest of the app
 * unchanged when we later drop the sentinel entirely.
 */
const SESSION_KEY = "ibp_session";

export const tokenStore = {
  /** Mark the session as active (does NOT store the JWT). */
  markActive() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (_) { /* private mode */ }
  },
  /** True if we previously logged in within this tab. */
  isActive() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (_) { return false; }
  },
  /** Clear the session sentinel. The httpOnly cookie is cleared by the server. */
  clear() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* noop */ }
    // One-time migration: purge legacy localStorage token from older builds.
    try { localStorage.removeItem("ibp_token"); } catch (_) { /* noop */ }
  },
  /** Check if token should be refreshed */
  shouldRefresh() {
    const lastRefresh = sessionStorage.getItem("ibp_last_refresh");
    if (!lastRefresh) return true;
    // Refresh if more than 30 minutes since last refresh
    const now = Date.now();
    const timeSinceRefresh = now - parseInt(lastRefresh, 10);
    return timeSinceRefresh > 30 * 60 * 1000;
  },

  /** Mark token as refreshed */
  markRefreshed() {
    try { sessionStorage.setItem("ibp_last_refresh", Date.now().toString()); } catch (_) { /* noop */ }
  },
};
