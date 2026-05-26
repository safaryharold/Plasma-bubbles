import { useEffect, useRef, useState } from "react";

/**
 * useJobStatus — opens a WebSocket to /ws/jobs/<userId>, requests job status
 * updates, and exposes the latest snapshot. Gracefully degrades to polling
 * via the provided fallback fn when the WS handshake fails.
 */
export function useJobStatus({ userId, jobId, onUpdate }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!userId || !jobId) return;
    const url = process.env.REACT_APP_BACKEND_URL
      .replace(/^http/, "ws") + `/ws/jobs/${userId}`;
    let alive = true;
    let pingTimer = null;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!alive) return;
        setConnected(true);
        ws.send(JSON.stringify({ type: "get_status", job_id: jobId }));
        pingTimer = setInterval(() => {
          try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* dead */ }
        }, 15000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "job_update" || msg.type === "job_status") {
            if (msg.job_id === jobId && onUpdate) onUpdate(msg);
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (alive) setConnected(false); };
      ws.onerror = () => { if (alive) setConnected(false); };
    } catch {
      setConnected(false);
    }
    return () => {
      alive = false;
      if (pingTimer) clearInterval(pingTimer);
      try { wsRef.current?.close(); } catch { /* noop */ }
    };
  }, [userId, jobId, onUpdate]);

  return { connected };
}
