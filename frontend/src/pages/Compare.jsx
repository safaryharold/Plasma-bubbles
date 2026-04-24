import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Heatmap } from "../components/Plot";
import { ArrowsLeftRight, Lightning } from "@phosphor-icons/react";

export default function Compare() {
  const [jobs, setJobs] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/ibp/jobs").then((r) => setJobs(r.data.filter((j) => j.status === "COMPLETED")));
  }, []);

  const run = async () => {
    setErr(null); setResult(null); setLoading(true);
    try {
      const { data } = await api.post("/ibp/compare", { job_a: a, job_b: b });
      setResult(data);
    } catch (e) { setErr(formatApiError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="compare-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— A/B scenario comparison</div>
        <h1 className="text-3xl font-black tracking-tight">Compare Jobs</h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          Diff two completed sweeps that share the same lon/lt grid.
        </p>
      </div>

      <div className="border border-[#2A2D35] p-6 grid md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">Scenario A</div>
          <select value={a} onChange={(e) => setA(e.target.value)} data-testid="compare-a"
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm">
            <option value="">Select a completed job…</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.id.slice(0,8)} · {j.name || 'unnamed'} · {j.cells} cells</option>)}
          </select>
        </div>
        <ArrowsLeftRight size={20} className="text-[#0047FF] mb-3 hidden md:block" />
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">Scenario B</div>
          <select value={b} onChange={(e) => setB(e.target.value)} data-testid="compare-b"
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm">
            <option value="">Select a completed job…</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.id.slice(0,8)} · {j.name || 'unnamed'} · {j.cells} cells</option>)}
          </select>
        </div>
        <button onClick={run} disabled={!a || !b || a === b || loading} data-testid="compare-run"
          className="h-11 px-5 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors disabled:opacity-40">
          <Lightning size={14} weight="fill" /> Diff
        </button>
      </div>
      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="compare-error">{err}</div>}

      {result && (
        <div className="grid lg:grid-cols-3 gap-4" data-testid="compare-result">
          <Heatmap lons={result.lons} lts={result.lts} matrix={result.job_a.matrix} title={`A • ${result.job_a.id.slice(0,8)}`} height={400} />
          <Heatmap lons={result.lons} lts={result.lts} matrix={result.job_b.matrix} title={`B • ${result.job_b.id.slice(0,8)}`} height={400} />
          <Heatmap lons={result.lons} lts={result.lts} matrix={result.diff} title="A − B  (diff)" diff height={400} />
          <div className="lg:col-span-3 border border-[#2A2D35] p-4 grid grid-cols-2 md:grid-cols-4 gap-4 mono text-xs">
            <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">Max |Δ|:</span> <span className="text-[#FF3333]" data-testid="compare-max-diff">{result.stats.max_abs_diff.toFixed(4)}</span></div>
            <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">Mean |Δ|:</span> <span>{result.stats.mean_abs_diff.toFixed(4)}</span></div>
            <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">A mean:</span> <span>{result.job_a.summary?.ibp_mean?.toFixed(3)}</span></div>
            <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">B mean:</span> <span>{result.job_b.summary?.ibp_mean?.toFixed(3)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
