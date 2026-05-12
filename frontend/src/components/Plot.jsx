import React, { useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { DownloadSimple, FileImage, FilePdf, CaretDown } from "@phosphor-icons/react";

const Plot = createPlotlyComponent(Plotly);

const AXIS = {
  showgrid: false, zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 12, color: "#FFFFFF" },
  linecolor: "#2A2D35",
};

// Publisher-safe palette (Viridis perceptually uniform & colorblind-friendly)
const PUB_COLORSCALE = "Viridis";

const DENSITY_TO_STEP = {
  coarse:   0.10,
  standard: 0.05,
  fine:     0.025,
  ultra:    0.0125,
};

function classify(ibp) {
  if (ibp >= 0.6) return "HIGH bubble risk";
  if (ibp >= 0.3) return "Moderate risk";
  if (ibp >= 0.1) return "Low risk";
  return "Negligible";
}

function ltToHHMM(t) {
  const h = Math.floor(t) % 24;
  const m = Math.round((t - Math.floor(t)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeTicks(lts) {
  if (!lts || !lts.length) return { tickvals: [], ticktext: [] };
  const lo = Math.min(...lts); const hi = Math.max(...lts);
  const step = (hi - lo) >= 3 ? 1 : 0.5;
  const first = Math.ceil(lo / step) * step;
  const tickvals = []; const ticktext = [];
  for (let t = first; t <= hi + 1e-6; t += step) {
    const rounded = Math.round(t * 2) / 2;
    tickvals.push(rounded);
    ticktext.push(ltToHHMM(rounded));
  }
  return { tickvals, ticktext };
}

/**
 * Smooth 2-D filled-contour heatmap of IBP over Longitude × Local-Time.
 * Includes a lightweight export toolbar (PNG / SVG / Paper) and configurable
 * contour-density.
 */
export function ContourHeatmap({
  lons, lts, matrix,
  doy, f107, title,
  diff = false,
  height = 560,
  compact = false,
  meta = null, // { configHash, modelSource, jobId }
  defaultDensity = "standard",
}) {
  const wrapperRef = useRef(null);
  const [density, setDensity] = useState(defaultDensity);
  const [busy, setBusy] = useState(null); // 'png' | 'svg' | 'paper'

  const z = lts.map((_, j) => lons.map((_, i) => matrix[i][j]));
  const customdata = z.map((row) => row.map((v) => classify(v)));
  const colorscale = diff
    ? [[0, "#B2182B"], [0.5, "#FFFFFF"], [1, "#2166AC"]]
    : "Viridis";
  const { tickvals, ticktext } = timeTicks(lts);

  const headline =
    title ||
    (doy != null && f107 != null
      ? `IBP index at DOY ${doy} with F10.7 = ${f107}`
      : "IBP index");

  const contourSize = DENSITY_TO_STEP[density] || 0.05;

  const findGd = () => {
    const gd = wrapperRef.current?.querySelector(".js-plotly-plot");
    return gd;
  };

  const downloadFile = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const baseFilename = () => {
    const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
    const parts = ["ibp"];
    if (doy != null) parts.push(`doy${doy}`);
    if (f107 != null) parts.push(`f107_${f107}`);
    if (meta?.jobId) parts.push(safe(meta.jobId).slice(0, 8));
    return parts.join("_");
  };

  const exportImage = async (format) => {
    const gd = findGd();
    if (!gd) return;
    setBusy(format);
    try {
      const url = await Plotly.toImage(gd, {
        format,
        width: 1400, height: 900,
        scale: format === "svg" ? 1 : 2,
      });
      downloadFile(url, `${baseFilename()}.${format}`);
    } finally { setBusy(null); }
  };

  // 300 DPI publication export with auto-caption
  const exportPaper = async () => {
    const gd = findGd();
    if (!gd) return;
    setBusy("paper");
    try {
      // Letter @ 300 DPI ≈ 2400 × 1500
      const W = 2400, H = 1500, SCALE = 2;
      const captionLines = [];
      const tag = [];
      if (doy != null) tag.push(`DOY ${doy}`);
      if (f107 != null) tag.push(`F10.7 = ${f107}`);
      if (tag.length) captionLines.push(tag.join("  ·  "));
      if (meta?.modelSource) captionLines.push(`Model: ${meta.modelSource}`);
      if (meta?.configHash) captionLines.push(`Config hash: ${meta.configHash}`);
      captionLines.push("Reference: Rino & Carrano, ibpmodel — IBP Analytics Platform");
      const caption = captionLines.join("\n");

      // Build a publication layout snapshot via toImage with overrides
      const url = await Plotly.toImage(gd, {
        format: "png",
        width: W, height: H, scale: SCALE,
      });

      // Composite caption underneath using a canvas
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const captionH = 220;
      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE;
      canvas.height = H * SCALE + captionH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, H * SCALE);

      // Caption block
      ctx.fillStyle = "#0B0D11";
      ctx.font = "32px 'JetBrains Mono', monospace";
      let y = H * SCALE + 50;
      for (const line of captionLines) {
        ctx.fillText(line, 50, y);
        y += 42;
      }

      const finalUrl = canvas.toDataURL("image/png");
      downloadFile(finalUrl, `${baseFilename()}_paper.png`);
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-[#090A0C] border border-[#2A2D35]" data-testid="plot-surface" ref={wrapperRef}>
      <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] flex items-center justify-between gap-3 flex-wrap">
        <span>— {headline}</span>
        <div className="flex items-center gap-2">
          <label className="text-[#565D6D] mr-1">density</label>
          <select value={density} onChange={(e) => setDensity(e.target.value)}
            data-testid="plot-density-select"
            className="bg-[#090A0C] border border-[#2A2D35] text-white px-2 h-7 mono text-[10px] uppercase tracking-[0.2em]">
            <option value="coarse">coarse</option>
            <option value="standard">standard</option>
            <option value="fine">fine</option>
            <option value="ultra">ultra</option>
          </select>
          <button onClick={() => exportImage("png")} disabled={busy != null}
            data-testid="plot-export-png"
            className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
            <FileImage size={12} /> {busy === "png" ? "..." : "png"}
          </button>
          <button onClick={() => exportImage("svg")} disabled={busy != null}
            data-testid="plot-export-svg"
            className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
            <DownloadSimple size={12} /> {busy === "svg" ? "..." : "svg"}
          </button>
          <button onClick={exportPaper} disabled={busy != null}
            data-testid="plot-export-paper"
            className="h-7 px-2 bg-[#FDCA26] hover:bg-[#FFE066] text-[#090A0C] font-bold flex items-center gap-1 transition-colors disabled:opacity-40">
            <FilePdf size={12} weight="fill" /> {busy === "paper" ? "rendering..." : "paper · 300dpi"}
          </button>
        </div>
      </div>
      <Plot
        data={[{
          type: "contour",
          z, x: lons, y: lts,
          customdata,
          colorscale,
          zmin: diff ? -1 : 0, zmax: 1, zmid: diff ? 0 : undefined,
          contours: {
            coloring: "fill",
            showlines: true,
            start: diff ? -1 : 0,
            end: 1,
            size: contourSize,
          },
          line: { smoothing: 1, width: 0.4, color: "rgba(255,255,255,0.08)" },
          connectgaps: true,
          hovertemplate:
            "<b>Lon</b> %{x:.1f}°<br>" +
            "<b>LT</b> %{y:.2f} h<br>" +
            "<b>IBP</b> %{z:.3f}<br>" +
            "%{customdata}<extra></extra>",
          colorbar: {
            thickness: 12, outlinewidth: 0, len: 0.92, x: 1.02,
            tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
            title: {
              text: diff ? "Δ IBP" : "Ionospheric Bubble Probability",
              side: "right",
              font: { color: "#8B93A5", family: "JetBrains Mono", size: 11 },
            },
          },
        }]}
        layout={{
          paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
          margin: { l: 74, r: 110, t: 36, b: 58 },
          height,
          title: compact
            ? undefined
            : { text: headline, x: 0.5, y: 0.97,
                font: { family: "Chivo, sans-serif", size: 14, color: "#FFFFFF" } },
          xaxis: {
            ...AXIS,
            title: { text: "Longitude (°)", font: AXIS.titlefont, standoff: 12 },
            linecolor: "#2A2D35", showline: true, mirror: true,
          },
          yaxis: {
            ...AXIS,
            title: { text: "Local Time", font: AXIS.titlefont, standoff: 12 },
            tickvals, ticktext, autorange: "reversed",
            linecolor: "#2A2D35", showline: true, mirror: true,
          },
        }}
        config={{
          displaylogo: false,
          responsive: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          toImageButtonOptions: {
            format: "png",
            filename: baseFilename(),
            width: 1400, height: 900, scale: 2,
          },
        }}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </div>
  );
}

// Backward-compat aliases — Sweep/Compare/PublicShare import these names.
export const Surface3D = ContourHeatmap;
export const Heatmap = ContourHeatmap;

export function HotspotBars({ hotspots }) {
  if (!hotspots || !hotspots.length) return null;
  return (
    <Plot
      data={[{
        type: "bar", orientation: "h",
        x: hotspots.map((h) => h.IBP),
        y: hotspots.map((h) => `Lon ${h.Lon}° / LT ${h.LT}h`),
        marker: { color: "#2E9FDF" },
        hovertemplate: "%{y}<br>IBP %{x:.3f}<extra></extra>",
      }]}
      layout={{
        paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
        margin: { l: 130, r: 20, t: 10, b: 30 }, height: 220,
        xaxis: { ...AXIS, range: [0, 1] }, yaxis: { ...AXIS, automargin: true },
      }}
      config={{ displaylogo: false, responsive: true, displayModeBar: false }}
      style={{ width: "100%", height: 220 }}
    />
  );
}

export default ContourHeatmap;
