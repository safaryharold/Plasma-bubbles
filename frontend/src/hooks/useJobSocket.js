/**
 * useJobSocket — subscribe to real-time job updates via WebSocket.
 *
 * Returns { liveJobs } — a map of jobId -> latest job object pushed from the server.
 * Components can merge this into their local job list.
 */
import { useEffect, useRef, useState, useCallback } from "react";

const WS_BASE = (process.env.REACT_APP_BACKEND_URL || "")
  .replace(/^http/, "ws");

export function useJobSocket() {
  const [liveJobs, setLiveJobs] = useState({});   // { [jobId]: jobObject }
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/api/ws/jobs`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "job_update" && msg.job) {
          setLiveJobs((prev) => ({ ...prev, [msg.job.id]: msg.job }));
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      // Auto-reconnect with 5 s back-off
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { liveJobs };
}
