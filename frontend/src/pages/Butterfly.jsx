import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { Butterfly as ButterflyIcon, Lightning, FileImage, FilePdf, DownloadSimple } from "@phosphor-icons/react";

const Plot = createPlotlyComponent(Plotly);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const AXIS = {
  showgrid: false, zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 12, color: "#FFFFFF" },
  linecolor: "#2A2D35",
};

export default function Butterfly() {
  const [params, setParams] = useState({ lt: 21.0, f107: 150, lon_step: 5 });
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const wrapperRef = React.useRef(null);

  const load = async () => {
    setErr(null); setLoading(true); setData(null);
    try {
      const { data } = await api.get("/ibp/butterfly", { params });
      setData(data);
    } catch (e) { setErr(formatApiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // matrix[i_lon][j_month]  →  Plotly z[row=month][col=lon]
  const z = data ? data.months.map((_, j) => data.lons.map((_, i) => data.matrix[i][j])) : [];

  const findGd = () => wrapperRef.current?.querySelector(".js-plotly-plot");
  const downloadFile = (url, name) => {
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const baseName = () => data ? `ibp_butterfly_lt${data.lt}_f107_${data.f107}` : "ibp_butterfly";

  const exportImage = async (format) => {
    const gd = findGd(); if (!gd) return;
    setBusy(format);
    try {
      const url = await Plotly.toImage(gd, {
        format, width: 1600, height: 900, scale: format === "svg" ? 1 : 2,
      });
      downloadFile(url, `${baseName()}.${format}`);
    } finally { setBusy(null); }
  };

  const exportPaper = async () => {
    const gd = findGd(); if (!gd || !data) return;
    setBusy("paper");
    try {
      const W = 2400, H = 1500, SCALE = 2;
      const url = await Plotly.toImage(gd, { format: "png", width: W, height: H, scale: SCALE });
      const img = new Image(); img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const captionH = 220;
      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE; canvas.height = H * SCALE + captionH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, H * SCALE);
      ctx.fillStyle = "#0B0D11"; ctx.font = "32px 'JetBrains Mono', monospace";
      let y = H * SCALE + 50;
      [
        `Butterfly diagram · LT ${data.lt.toFixed(1)} h · F10.7 = ${data.f107}`,
        `Model: ${data.method}`,
        "Reference: Rino & Carrano, ibpmodel — IBP Analytics Platform",
      ].forEach(line => { ctx.fillText(line, 50, y); y += 42; });
      downloadFile(canvas.toDataURL("image/png"), `${baseName()}_paper.png`);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="butterfly-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— climatology · butterfly diagram</div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <ButterflyIcon size={28} className="text-[#0047FF]" /> Butterfly Diagram
        </h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          Seasonal × longitudinal IBP climatology at a fixed local time. The classic post-sunset (LT 21:00)
          view exposes equinoctial peaks and the African / Pacific sector signatures.
        </p>
      </div>

      <div className="border border-[#2A2D35] p-5 grid md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end" data-testid="butterfly-form">
        <Field label="Local Time (h)">
          <input type="number" min={0} max={24} step={0.5} value={params.lt}
            data-testid="bf-lt"
            onChange={(e) => setParams({ ...params, lt: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <Field label="F10.7 solar flux">
          <input type="number" min={60} max={300} value={params.f107}
            data-testid="bf-f107"
            onChange={(e) => setParams({ ...params, f107: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <Field label="Longitude step (°)">
          <input type="number" min={1} max={60} value={params.lon_step}
            data-testid="bf-lonstep"
            onChange={(e) => setParams({ ...params, lon_step: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <button onClick={load} disabled={loading} data-testid="bf-run"
          className="h-11 px-5 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors disabled:opacity-40">
          <Lightning size={14} weight="fill" /> {loading ? "Computing..." : "Compute"}
        </button>
      </div>

      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="bf-error">{err}</div>}

      {data && (
        <div className="bg-[#090A0C] border border-[#2A2D35]" data-testid="butterfly-plot" ref={wrapperRef}>
          <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] flex items-center justify-between flex-wrap gap-2">
            <span>— ibp climatology · lt {data.lt}h · f10.7 {data.f107} · {data.method}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => exportImage("png")} disabled={busy != null}
                data-testid="bf-export-png"
                className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
                <FileImage size={12} /> {busy === "png" ? "..." : "png"}
              </button>
              <button onClick={() => exportImage("svg")} disabled={busy != null}
                data-testid="bf-export-svg"
                className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
                <DownloadSimple size={12} /> {busy === "svg" ? "..." : "svg"}
              </button>
              <button onClick={exportPaper} disabled={busy != null}
                data-testid="bf-export-paper"
                className="h-7 px-2 bg-[#FDCA26] hover:bg-[#FFE066] text-[#090A0C] font-bold flex items-center gap-1 transition-colors disabled:opacity-40">
                <FilePdf size={12} weight="fill" /> {busy === "paper" ? "rendering..." : "paper · 300dpi"}
              </button>
            </div>
          </div>
          <Plot
            data={[{
              type: "contour",
              z,
              x: data.lons,
              y: data.months,
              colorscale: "Viridis",
              zmin: 0, zmax: 1,
              contours: { coloring: "fill", showlines: true, start: 0, end: 1, size: 0.05 },
              line: { smoothing: 1, width: 0.4, color: "rgba(255,255,255,0.08)" },
              hovertemplate:
                "<b>Lon</b> %{x:.1f}°<br>" +
                "<b>Month</b> %{y}<br>" +
                "<b>IBP</b> %{z:.3f}<extra></extra>",
              colorbar: {
                thickness: 12, outlinewidth: 0, len: 0.92, x: 1.02,
                tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
                title: { text: "Ionospheric Bubble Probability", side: "right",
                  font: { color: "#8B93A5", family: "JetBrains Mono", size: 11 } },
              },
            }]}
            layout={{
              paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
              margin: { l: 74, r: 110, t: 30, b: 58 },
              height: 540,
              xaxis: {
                ...AXIS,
                title: { text: "Longitude (°)", font: AXIS.titlefont, standoff: 12 },
                linecolor: "#2A2D35", showline: true, mirror: true,
              },
              yaxis: {
                ...AXIS,
                title: { text: "Month", font: AXIS.titlefont, standoff: 12 },
                tickvals: data.months, ticktext: MONTHS,
                linecolor: "#2A2D35", showline: true, mirror: true,
              },
            }}
            config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
            style={{ width: "100%", height: 540 }}
            useResizeHandler
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-[#2A2D35]">
            <Stat label="min" v={data.summary.ibp_min.toFixed(3)} />
            <Stat label="max" v={data.summary.ibp_max.toFixed(3)} tint="text-[#FF3333]" />
            <Stat label="mean" v={data.summary.ibp_mean.toFixed(3)} />
            <Stat label="p95" v={data.summary.ibp_p95.toFixed(3)} tint="text-[#FFDD00]" />
          </div>
          <div className="p-4 border-t border-[#2A2D35]" data-testid="butterfly-hotspots">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">— top climatological hotspots</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mono text-xs">
              {data.summary.hotspots.map((h, i) => (
                <div key={i} className="text-[#8B93A5]">
                  <span className="text-white">{h.IBP.toFixed(3)}</span>
                  <span className="text-[#565D6D] ml-2">{MONTHS[h.Month - 1]}</span>
                  <span className="text-[#565D6D] ml-2">Lon {h.Lon}°</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">{label}</div>
      {children}
    </div>
  );
}
function Stat({ label, v, tint = "text-white" }) {
  return (
    <div className="p-4 border-r border-[#2A2D35] last:border-r-0">
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">{label}</div>
      <div className={`mono text-base ${tint}`}>{v}</div>
    </div>
  );
}
