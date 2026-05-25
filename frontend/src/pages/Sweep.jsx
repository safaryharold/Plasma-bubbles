import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "../lib/api";
import { Surface3D, HotspotBars } from "../components/Plot";
import { Lightning, DownloadSimple, FloppyDisk, ArrowClockwise } from "@phosphor-icons/react";

export default function Sweep() {
  const [form, setForm] = useState({
    name: "Post-sunset equatorial sweep",
    day_month: 3, f107: 150,
    lon_min: -180, lon_max: 180, lon_step: 10,
    lt_min: 18, lt_max: 24, lt_step: 0.5,
  });
  const [job, setJob] = useState(null);
  const [viz, setViz] = useState(null);
  const [err, setErr] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  const cells = Math.max(0, Math.floor((form.lon_max - form.lon_min) / form.lon_step + 1))
              * Math.max(0, Math.floor((form.lt_max - form.lt_min) / form.lt_step + 1));

  const submit = async () => {
    setErr(null); setViz(null); setJob(null);
    try {
      const { data } = await api.post("/ibp/batch", form);
      setJob(data);
    } catch (e) { setErr(formatApiError(e)); }
  };

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

  const saveExperiment = async () => {
    try {
      await api.post("/experiments", {
        name: form.name || "Untitled sweep", description: null,
        params: form,
      });
      setSaveMsg("Experiment saved ✓");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) { setErr(formatApiError(e)); }
  };

  const download = (format = "csv") => {
    if (!job || job.status !== "COMPLETED") return;
    const token = localStorage.getItem("ibp_token");
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/ibp/download/${job.id}?format=${format}`;
    const ext = { csv: "csv", netcdf: "nc", parquet: "parquet" }[format];
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `ibp_${job.id.slice(0,8)}.${ext}`;
        a.click();
      });
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="sweep-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— parameter sweep</div>
          <h1 className="text-3xl font-black tracking-tight">Longitude × Local-Time Grid</h1>
          <p className="mono text-xs text-[#8B93A5] mt-2">
            Each job produces a reproducible IBP heatmap. Config hash = SHA-256 of parameters.
          </p>
        </div>
        <div className="mono text-xs flex items-center gap-3">
          <span className="text-[#565D6D] uppercase tracking-widest text-[10px]">Grid:</span>
          <span className={`font-bold ${cells > 10000 ? 'text-[#FF3333]' : 'text-white'}`} data-testid="grid-cells-indicator">
            {cells.toLocaleString()} cells
          </span>
          <span className="text-[#565D6D]">/ cap 10,000</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Form */}
        <div className="border border-[#2A2D35] p-6 space-y-5" data-testid="sweep-form">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="sweep-name"
              className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-11 mono text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Num label="Day / Month" v={form.day_month} min={1} max={366} step={1} k="day_month" form={form} setForm={setForm} tid="sweep-daymonth" />
            <Num label="F10.7" v={form.f107} min={60} max={300} step={1} k="f107" form={form} setForm={setForm} tid="sweep-f107" />
          </div>
          <div className="border-t border-[#2A2D35] pt-4">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-3">— longitude axis (°)</div>
            <div className="grid grid-cols-3 gap-3">
              <Num label="min" v={form.lon_min} min={-180} max={180} step={1} k="lon_min" form={form} setForm={setForm} tid="sweep-lon-min" />
              <Num label="max" v={form.lon_max} min={-180} max={180} step={1} k="lon_max" form={form} setForm={setForm} tid="sweep-lon-max" />
              <Num label="step" v={form.lon_step} min={1} max={180} step={1} k="lon_step" form={form} setForm={setForm} tid="sweep-lon-step" />
            </div>
          </div>
          <div className="border-t border-[#2A2D35] pt-4">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-3">— local time axis (h)</div>
            <div className="grid grid-cols-3 gap-3">
              <Num label="min" v={form.lt_min} min={0} max={24} step={0.5} k="lt_min" form={form} setForm={setForm} tid="sweep-lt-min" />
              <Num label="max" v={form.lt_max} min={0} max={24} step={0.5} k="lt_max" form={form} setForm={setForm} tid="sweep-lt-max" />
              <Num label="step" v={form.lt_step} min={0.1} max={12} step={0.1} k="lt_step" form={form} setForm={setForm} tid="sweep-lt-step" />
            </div>
          </div>
          {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="sweep-error">{err}</div>}
          {saveMsg && <div className="mono text-xs text-[#00E599]" data-testid="sweep-save-ok">{saveMsg}</div>}
          <div className="flex gap-3">
            <button onClick={submit} disabled={cells > 10000 || cells === 0} data-testid="run-sweep-btn"
              className="flex-1 h-12 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
              <Lightning size={14} weight="fill" /> Run sweep
            </button>
            <button onClick={saveExperiment} data-testid="save-experiment-btn"
              className="h-12 px-5 border border-[#2A2D35] hover:bg-[#121418] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
              <FloppyDisk size={14} /> Save
            </button>
          </div>
        </div>

        {/* Result panel */}
        <div className="border border-[#2A2D35] bg-[#121418] min-h-[600px] flex flex-col" data-testid="sweep-result">
          <div className="flex items-center justify-between px-4 h-10 border-b border-[#2A2D35]">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">— result</div>
            {job && (
              <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-[0.25em]" data-testid="sweep-job-status">
                <span className="text-[#565D6D]">id {job.id.slice(0,8)}</span>
                <span className={
                  job.status === "COMPLETED" ? "text-[#00E599]" :
                  job.status === "FAILED" ? "text-[#FF3333]" :
                  "text-[#0047FF]"}>
                  {job.status}
                </span>
              </div>
            )}
          </div>
          {!job ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center mono text-xs text-[#565D6D] p-8">
                Configure and run a sweep. Heatmap renders here once the background worker completes.
              </div>
            </div>
          ) : job.status !== "COMPLETED" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <ArrowClockwise size={28} className="text-[#0047FF] animate-spin" />
              <div className="mono text-xs text-[#8B93A5] uppercase tracking-widest">Computing {job.cells} cells...</div>
              <div className="mono text-[10px] text-[#565D6D]">Config hash: {job.config_hash}</div>
            </div>
          ) : viz ? (
            <div className="flex-1 flex flex-col">
              <Surface3D
                lons={viz.smooth?.lons || viz.lons}
                lts={viz.smooth?.lts || viz.lts}
                matrix={viz.smooth?.matrix || viz.matrix}
                doy={viz.doy}
                f107={viz.params?.f107}
                height={480}
                meta={{
                  configHash: job.config_hash,
                  jobId: job.id,
                  modelSource: viz.model_source || viz.method || "ibpmodel surrogate-v1",
                }}
              />
              <div className="grid grid-cols-2 gap-0 border-t border-[#2A2D35]">
                <div className="p-4 border-r border-[#2A2D35]">
                  <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">— summary stats</div>
                  <div className="grid grid-cols-2 gap-2 mono text-xs">
                    <Stat label="min" v={viz.summary.ibp_min.toFixed(3)} />
                    <Stat label="max" v={viz.summary.ibp_max.toFixed(3)} tint="text-[#FF3333]" />
                    <Stat label="mean" v={viz.summary.ibp_mean.toFixed(3)} />
                    <Stat label="p95" v={viz.summary.ibp_p95.toFixed(3)} tint="text-[#FFDD00]" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">— top hotspots</div>
                  <HotspotBars hotspots={viz.summary.hotspots} />
                </div>
              </div>
              <div className="p-4 border-t border-[#2A2D35] flex gap-3 flex-wrap">
                <button onClick={() => download("csv")} data-testid="download-csv-btn"
                  className="h-10 px-4 bg-white hover:bg-[#0047FF] hover:text-white text-[#090A0C] mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
                  <DownloadSimple size={14} /> CSV
                </button>
                <button onClick={() => download("netcdf")} data-testid="download-nc-btn"
                  className="h-10 px-4 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
                  <DownloadSimple size={14} /> NetCDF
                </button>
                <button onClick={() => download("parquet")} data-testid="download-parquet-btn"
                  className="h-10 px-4 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
                  <DownloadSimple size={14} /> Parquet
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
function Num({ label, v, min, max, step, k, form, setForm, tid }) {
  return (
    <div>
      <div className="mono text-[10px] text-[#565D6D] uppercase tracking-[0.2em] mb-1">{label}</div>
      <input type="number" value={v} min={min} max={max} step={step}
        data-testid={tid}
        onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
        className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-10 mono text-sm" />
    </div>
  );
}
function Stat({ label, v, tint = "text-white" }) {
  return (
    <div>
      <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">{label}: </span>
      <span className={`mono text-sm ${tint}`}>{v}</span>
    </div>
  );
}
