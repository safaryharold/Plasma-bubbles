import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-geo-dist-min";
import { Slider } from "../components/ui/slider";
import { Globe, Lightning, Play, Pause } from "@phosphor-icons/react";

const Plot = createPlotlyComponent(Plotly);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function WorldMap() {
  const [params, setParams] = useState({ day_month: 3, f107: 150, lon_step: 10 });
  const [data, setData] = useState(null);
  const [ltIndex, setLtIndex] = useState(42); // LT 21:00
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setErr(null); setLoading(true); setData(null);
    try {
      const { data } = await api.get("/ibp/worldmap", { params });
      setData(data);
    } catch (e) { setErr(formatApiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // auto-play
  useEffect(() => {
    if (!playing || !data) return;
    const id = setInterval(() => {
      setLtIndex((i) => (i + 1) % data.lt_values.length);
    }, 220);
    return () => clearInterval(id);
  }, [playing, data]);

  const frame = data?.frames[ltIndex];
  const lt = data?.lt_values[ltIndex];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="worldmap-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— global ibp overlay</div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Globe size={28} className="text-[#0047FF]" /> World Map
        </h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          Global IBP distribution with local-time slider. Each frame = 30min LT step along the equatorial belt.
        </p>
      </div>

      <div className="border border-[#2A2D35] p-5 grid md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end" data-testid="worldmap-form">
        <Field label="Day / Month (1-12 month, 13-366 DOY)">
          <input type="number" min={1} max={366} value={params.day_month}
            data-testid="wm-daymonth"
            onChange={(e) => setParams({ ...params, day_month: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <Field label="F10.7 solar flux">
          <input type="number" min={60} max={300} value={params.f107}
            data-testid="wm-f107"
            onChange={(e) => setParams({ ...params, f107: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <Field label="Longitude step (°)">
          <input type="number" min={2} max={60} value={params.lon_step}
            data-testid="wm-lonstep"
            onChange={(e) => setParams({ ...params, lon_step: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <button onClick={load} disabled={loading} data-testid="wm-run"
          className="h-11 px-5 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors disabled:opacity-40">
          <Lightning size={14} weight="fill" /> {loading ? "Loading..." : "Compute"}
        </button>
      </div>

      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="wm-error">{err}</div>}

      {data && frame && (
        <div className="border border-[#2A2D35] bg-[#090A0C]">
          <div className="flex items-center justify-between px-4 h-10 border-b border-[#2A2D35]">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">
              — global ibp • {MONTHS[data.month - 1]} · doy {data.doy} · f10.7 {data.f107}
            </div>
            <div className="mono text-xs text-[#0047FF]" data-testid="wm-lt-display">
              LT {lt?.toFixed(1)}h
            </div>
          </div>
          <Plot
            data={[{
              type: "scattergeo",
              lon: frame.lons,
              lat: frame.lons.map(() => 0),  // equatorial belt
              mode: "markers",
              marker: {
                color: frame.ibp,
                colorscale: [[0, "#0047FF"], [0.5, "#FFDD00"], [1, "#FF3333"]],
                cmin: 0, cmax: 1,
                size: 14,
                line: { width: 0.5, color: "#090A0C" },
                colorbar: {
                  thickness: 8, outlinewidth: 0,
                  tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
                  title: { text: "IBP", font: { color: "#8B93A5", family: "JetBrains Mono", size: 10 } },
                },
              },
              hovertext: frame.lons.map((lo, i) => `Lon ${lo}° • IBP ${frame.ibp[i].toFixed(3)}`),
              hoverinfo: "text",
            }]}
            layout={{
              paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
              margin: { l: 0, r: 0, t: 10, b: 10 },
              height: 520,
              geo: {
                projection: { type: "equirectangular" },
                showland: true, landcolor: "#121418",
                showocean: true, oceancolor: "#090A0C",
                showcountries: true, countrycolor: "#2A2D35",
                showcoastlines: true, coastlinecolor: "#2A2D35",
                showframe: false,
                lataxis: { range: [-40, 40] },
                bgcolor: "#090A0C",
              },
            }}
            config={{ displaylogo: false, responsive: true,
              modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
            style={{ width: "100%", height: 520 }}
            useResizeHandler
          />
          <div className="p-4 border-t border-[#2A2D35] space-y-3" data-testid="wm-slider-container">
            <div className="flex items-center gap-4">
              <button onClick={() => setPlaying((p) => !p)} data-testid="wm-play"
                className="w-10 h-10 border border-[#2A2D35] hover:border-[#0047FF] flex items-center justify-center text-white transition-colors">
                {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
              </button>
              <div className="flex-1">
                <Slider value={[ltIndex]} min={0} max={data.lt_values.length - 1} step={1}
                  onValueChange={(v) => { setLtIndex(v[0]); setPlaying(false); }}
                  data-testid="wm-slider" />
              </div>
              <div className="mono text-xs text-[#8B93A5] w-20 text-right">
                {ltIndex + 1} / {data.lt_values.length}
              </div>
            </div>
            <div className="flex justify-between mono text-[10px] text-[#565D6D] uppercase tracking-widest">
              <span>LT 00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:30</span>
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
