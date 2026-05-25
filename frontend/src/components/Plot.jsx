import React, { useCallback, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import PlotToolbar from "./PlotToolbar";
import { usePlotExports } from "../lib/usePlotExports";

const Plot = createPlotlyComponent(Plotly);

const AXIS = {
  showgrid: false, zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 12, color: "#FFFFFF" },
  linecolor: "#2A2D35",
};

const DENSITY_TO_STEP = {
  coarse: 0.10, standard: 0.05, fine: 0.025, ultra: 0.0125,
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
 * Slim wrapper around Plotly — the export toolbar and Plotly.toImage
 * plumbing live in `PlotToolbar` and `usePlotExports`.
 */
export function ContourHeatmap({
  lons, lts, matrix,
  doy, f107, title,
  diff = false,
  height = 560,
  compact = false,
  meta = null,
  defaultDensity = "standard",
}) {
  const wrapperRef = useRef(null);
  const [density, setDensity] = useState(defaultDensity);

  const baseName = useCallback(() => {
    const parts = ["ibp"];
    if (doy != null) parts.push(`doy${doy}`);
    if (f107 != null) parts.push(`f107_${f107}`);
    if (meta?.jobId) parts.push(meta.jobId.slice(0, 8));
    return parts.join("_");
  }, [doy, f107, meta]);

  const captionLines = useCallback(() => {
    const lines = [];
    const tag = [];
    if (doy != null) tag.push(`DOY ${doy}`);
    if (f107 != null) tag.push(`F10.7 = ${f107}`);
    if (tag.length) lines.push(tag.join("  ·  "));
    if (meta?.modelSource) lines.push(`Model: ${meta.modelSource}`);
    if (meta?.configHash) lines.push(`Config hash: ${meta.configHash}`);
    lines.push("Reference: Rino & Carrano, ibpmodel — IBP Analytics Platform");
    return lines;
  }, [doy, f107, meta]);

  const { busy, exportImage, exportPaper } = usePlotExports({
    wrapperRef, baseName, captionLines,
  });

  const z = lts.map((_, j) => lons.map((_, i) => matrix[i][j]));
  const customdata = z.map((row) => row.map((v) => classify(v)));
  const colorscale = diff
    ? [[0, "#B2182B"], [0.5, "#FFFFFF"], [1, "#2166AC"]]
    : "Viridis";
  const { tickvals, ticktext } = timeTicks(lts);

  const headline = title
    || (doy != null && f107 != null
      ? `IBP index at DOY ${doy} with F10.7 = ${f107}`
      : "IBP index");

  const contourSize = DENSITY_TO_STEP[density] || 0.05;

  return (
    <div className="bg-[#090A0C] border border-[#2A2D35]" data-testid="plot-surface" ref={wrapperRef}>
      <PlotToolbar
        title={headline}
        density={density} onDensityChange={setDensity}
        busy={busy} onExport={exportImage} onExportPaper={exportPaper}
        testIdPrefix="plot"
      />
      <Plot
        data={[{
          type: "contour",
          z, x: lons, y: lts,
          customdata,
          colorscale,
          zmin: diff ? -1 : 0, zmax: 1, zmid: diff ? 0 : undefined,
          contours: {
            coloring: "fill", showlines: true,
            start: diff ? -1 : 0, end: 1, size: contourSize,
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
          displaylogo: false, responsive: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          toImageButtonOptions: {
            format: "png", filename: baseName(),
            width: 1400, height: 900, scale: 2,
          },
        }}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </div>
  );
}

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
