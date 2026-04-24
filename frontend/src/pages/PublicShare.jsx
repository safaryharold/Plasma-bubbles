import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-geo-dist-min";
import { Planet, ArrowRight } from "@phosphor-icons/react";

const Plot = createPlotlyComponent(Plotly);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AXIS = {
  showgrid: true, gridcolor: "#2A2D35", zeroline: false,
  tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
  titlefont: { family: "JetBrains Mono, monospace", size: 11, color: "#8B93A5" },
  linecolor: "#2A2D35",
};

function Heat({ lons, lts, matrix, title, diff }) {
  const z = lts.map((_, j) => lons.map((_, i) => matrix[i][j]));
  return (
    <div className="bg-[#090A0C] border border-[#2A2D35]">
      <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">{title}</div>
      <Plot
        data={[{
          z, x: lons, y: lts, type: "heatmap",
          colorscale: diff
            ? [[0, "#FF3333"], [0.5, "#121418"], [1, "#00E599"]]
            : [[0, "#0047FF"], [0.5, "#FFDD00"], [1, "#FF3333"]],
          zmin: diff ? -1 : 0, zmax: 1, zmid: diff ? 0 : undefined,
          colorbar: { thickness: 8, outlinewidth: 0,
            tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" } },
        }]}
        layout={{
          paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
          margin: { l: 54, r: 20, t: 10, b: 40 }, height: 380,
          xaxis: { ...AXIS, title: "Longitude (°)" },
          yaxis: { ...AXIS, title: "Local Time (h)" },
        }}
        config={{ displaylogo: false, responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: 380 }}
        useResizeHandler
      />
    </div>
  );
}

export default function PublicShare() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/public/share/${token}`)
      .then((r) => r.json().then((b) => r.ok ? setData(b) : setErr(b.detail || "not found")))
      .catch((e) => setErr(e.message));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#090A0C] text-white" data-testid="public-share-page">
      <header className="sticky top-0 z-50 bg-[#090A0C]/95 backdrop-blur border-b border-[#2A2D35]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-8 h-14">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center"><Planet size={16} weight="fill" /></div>
            <div className="leading-tight">
              <div className="mono text-[10px] text-[#565D6D] uppercase tracking-[0.25em]">Platform</div>
              <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
            </div>
          </Link>
          <Link to="/register" className="mono text-xs uppercase tracking-widest bg-[#0047FF] hover:bg-[#336DFF] text-white px-4 h-9 flex items-center gap-1 transition-colors" data-testid="public-cta">
            Run your own <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-10">
        {err && <div className="mono text-sm text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-4 py-3" data-testid="public-error">{err}</div>}
        {!data && !err && <div className="mono text-xs text-[#565D6D]" data-testid="public-loading">Loading shared comparison...</div>}
        {data && (
          <>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— public share · viewed {data.view_count} times</div>
            <h1 className="text-3xl font-black tracking-tight" data-testid="public-title">{data.title}</h1>
            <div className="mono text-xs text-[#8B93A5] mt-2">
              Shared by {data.owner_name} • {new Date(data.created_at).toLocaleDateString()}
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-8" data-testid="public-heatmaps">
              <Heat lons={data.payload.lons} lts={data.payload.lts} matrix={data.payload.matrix_a}
                title={`A • hash ${data.payload.config_hash_a}`} />
              <Heat lons={data.payload.lons} lts={data.payload.lts} matrix={data.payload.matrix_b}
                title={`B • hash ${data.payload.config_hash_b}`} />
              <Heat lons={data.payload.lons} lts={data.payload.lts} matrix={data.payload.diff}
                title="A − B (diff)" diff />
            </div>

            <div className="grid md:grid-cols-2 border border-[#2A2D35] mt-4">
              <div className="p-4 border-r border-[#2A2D35]">
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-3">— scenario a params</div>
                <pre className="mono text-xs text-[#8B93A5] whitespace-pre-wrap">{JSON.stringify(data.payload.params_a, null, 2)}</pre>
              </div>
              <div className="p-4">
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-3">— scenario b params</div>
                <pre className="mono text-xs text-[#8B93A5] whitespace-pre-wrap">{JSON.stringify(data.payload.params_b, null, 2)}</pre>
              </div>
            </div>

            <div className="border border-[#2A2D35] p-4 mt-4 grid grid-cols-2 md:grid-cols-4 mono text-xs gap-4">
              <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">Max |Δ|:</span> <span className="text-[#FF3333]">{data.payload.stats.max_abs_diff.toFixed(4)}</span></div>
              <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">Mean |Δ|:</span> <span>{data.payload.stats.mean_abs_diff.toFixed(4)}</span></div>
              <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">A mean:</span> <span>{data.payload.summary_a?.ibp_mean?.toFixed(3)}</span></div>
              <div><span className="text-[#565D6D] uppercase tracking-widest text-[10px]">B mean:</span> <span>{data.payload.summary_b?.ibp_mean?.toFixed(3)}</span></div>
            </div>

            <div className="mt-12 border-t border-[#2A2D35] pt-6 mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] flex items-center justify-between">
              <div>Generated by IBP Analytics Platform • reproducible via config hashes</div>
              <Link to="/register" className="text-[#0047FF] hover:text-white flex items-center gap-1">Run your own sweep <ArrowRight size={12} /></Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
