/**
 * useIbpJob — encapsulates the run/poll/viz lifecycle of a Sweep batch job.
 *
 * Usage:
 *   const { job, viz, err, run, saveExperiment } = useIbpJob(form);
 *   run();  // POSTs /ibp/batch and starts polling
 *
 * Pulled out of Sweep.jsx to reduce that component's cyclomatic complexity.
 */
import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "./api";

export function useIbpJob() {
  const [job, setJob] = useState(null);
  const [viz, setViz] = useState(null);
  const [err, setErr] = useState(null);

  const run = useCallback(async (form) => {
    setErr(null); setViz(null); setJob(null);
    try {
      const { data } = await api.post("/ibp/batch", form);
      setJob(data);
    } catch (e) { setErr(formatApiError(e)); }
  }, []);

  const poll = useCallback(async () => {
    if (!job || job.status === "COMPLETED" || job.status === "FAILED") return;
    try {
      const { data } = await api.get(`/ibp/job/${job.id}`);
      setJob(data);
      if (data.status === "COMPLETED") {
        const { data: v } = await api.get(`/ibp/visualization-data/${job.id}`);
        setViz(v);
      }
    } catch (e) { setErr(formatApiError(e)); }
  }, [job]);

  useEffect(() => {
    if (!job || job.status === "COMPLETED" || job.status === "FAILED") return;
    const id = setInterval(poll, 1200);
    return () => clearInterval(id);
  }, [job, poll]);

  const saveExperiment = useCallback(async (params, name) => {
    try {
      await api.post("/experiments", {
        name: name || "Untitled sweep",
        description: null,
        params,
      });
      return { ok: true };
    } catch (e) {
      const msg = formatApiError(e);
      setErr(msg);
      return { ok: false, msg };
    }
  }, []);

  return { job, viz, err, setErr, run, saveExperiment };
}


/** useFetch — declarative GET with loading/error state, used by Compare/Butterfly/PublicShare. */
export function useFetch(path, params = null, opts = {}) {
  const { enabled = true } = opts;
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setErr(null);
    try {
      const r = await api.get(path, params ? { params } : undefined);
      setData(r.data);
    } catch (e) {
      setErr(formatApiError(e));
    } finally { setLoading(false); }
  }, [path, JSON.stringify(params), enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refetch(); }, [refetch]);
  return { data, err, loading, refetch, setData };
}
