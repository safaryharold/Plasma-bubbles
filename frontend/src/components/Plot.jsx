import React from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-geo-dist-min";
const Plot = createPlotlyComponent(Plotly);

const AXIS = {
  showgrid: true, gridcolor: "#2A2D35", zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  linecolor: "#2A2D35",
};

export function Heatmap({ lons, lts, matrix, title, diff = false, height = 460 }) {
  const colorscale = diff
    ? [[0, "#FF3333"], [0.5, "#121418"], [1, "#00E599"]]
    : [[0, "#0047FF"], [0.5, "#FFDD00"], [1, "#FF3333"]];
  const z = lts.map((_, j) => lons.map((_, i) => matrix[i][j]));
  return (
    <div className="bg-[#090A0C] border border-[#2A2D35]" data-testid="plot-heatmap">
      <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">
        {title}
      </div>
      <Plot
        data={[{
          z, x: lons, y: lts,
          type: "heatmap", colorscale,
          zmin: diff ? -1 : 0, zmax: 1, zmid: diff ? 0 : undefined,
          colorbar: {
            thickness: 8, outlinewidth: 0,
            tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
            title: { text: diff ? "Δ IBP" : "IBP", font: { color: "#8B93A5", family: "JetBrains Mono", size: 10 } },
          },
        }]}
        layout={{
          paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
          margin: { l: 56, r: 30, t: 10, b: 46 },
          height,
          xaxis: { ...AXIS, title: "Longitude (°)" },
          yaxis: { ...AXIS, title: "Local Time (h)" },
        }}
        config={{ displaylogo: false, responsive: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] }}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </div>
  );
}

export function HotspotBars({ hotspots }) {
  if (!hotspots || !hotspots.length) return null;
  return (
    <Plot
      data={[{
        type: "bar", orientation: "h",
        x: hotspots.map((h) => h.IBP),
        y: hotspots.map((h) => `Lon ${h.Lon}° / LT ${h.LT}h`),
        marker: { color: "#0047FF" },
      }]}
      layout={{
        paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
        margin: { l: 120, r: 20, t: 10, b: 30 }, height: 220,
        xaxis: { ...AXIS, range: [0, 1] }, yaxis: { ...AXIS, automargin: true },
      }}
      config={{ displaylogo: false, responsive: true, displayModeBar: false }}
      style={{ width: "100%", height: 220 }}
    />
  );
}

export default Heatmap;
