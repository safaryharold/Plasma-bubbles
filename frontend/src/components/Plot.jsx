import React from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
const Plot = createPlotlyComponent(Plotly);

const AXIS = {
  showgrid: false, zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 12, color: "#FFFFFF" },
  linecolor: "#2A2D35",
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
  // Prefer whole-hour labels inside the range; if the range is < 3h use half-hour
  const step = (hi - lo) >= 3 ? 1 : 0.5;
  const first = Math.ceil(lo / step) * step;
  const tickvals = [];
  const ticktext = [];
  for (let t = first; t <= hi + 1e-6; t += step) {
    const rounded = Math.round(t * 2) / 2;
    tickvals.push(rounded);
    ticktext.push(ltToHHMM(rounded));
  }
  return { tickvals, ticktext };
}

/**
 * Smooth 2-D filled-contour heatmap of IBP over Longitude × Local-Time.
 *
 * Uses the sklearn-smoothed grid coming from the backend (/visualization-data?smooth=1)
 * so the bands look continuous and publication-ready, matching the style of the
 * upstream `ibpmodel` plotIBPindex() reference.
 */
export function ContourHeatmap({ lons, lts, matrix, doy, f107, title, diff = false, height = 560, compact = false }) {
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

  return (
    <div className="bg-[#090A0C] border border-[#2A2D35]" data-testid="plot-surface">
      <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] flex items-center justify-between">
        <span>— {headline}</span>
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
            size: 0.04,
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
        config={{ displaylogo: false, responsive: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
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
