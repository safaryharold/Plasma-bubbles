import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, formatApiError } from "../lib/api";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { Slider } from "../components/ui/slider";
import { Globe, Lightning, Play, Pause, Sun } from "@phosphor-icons/react";

const Plot = createPlotlyComponent(Plotly);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Discrete IBP probability bands (Viridis) — matches sweep/compare aesthetic
// Each band repeats start/end stop to render as a hard step (no gradient inside).
const BAND_STOPS = [
  { lo: 0.00, hi: 0.05, color: "#0d0887" },
  { lo: 0.05, hi: 0.15, color: "#46039f" },
  { lo: 0.15, hi: 0.30, color: "#7201a8" },
  { lo: 0.30, hi: 0.45, color: "#9c179e" },
  { lo: 0.45, hi: 0.60, color: "#bd3786" },
  { lo: 0.60, hi: 0.75, color: "#d8576b" },
  { lo: 0.75, hi: 0.90, color: "#ed7953" },
  { lo: 0.90, hi: 1.01, color: "#fdca26" },
];

const DISCRETE_COLORSCALE = (() => {
  const stops = [];
  for (const b of BAND_STOPS) {
    stops.push([b.lo, b.color]);
    stops.push([Math.min(b.hi, 1), b.color]);
  }
  return stops;
})();

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

// Solar geometry helpers ----------------------------------------------------
function solarDeclinationDeg(doy) {
  return 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365.0);
}

// At a given UTC hour, the subsolar longitude is where the sun is overhead.
// Treating the slider value as a global UTC time (LT at lon 0).
function subsolarLonDeg(utcHour) {
  let lon = (12 - utcHour) * 15;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

// Day/night terminator latitude for each longitude given subsolar lon & decl.
function terminatorLine(subLon, declDeg) {
  const decl = (declDeg * Math.PI) / 180.0;
  const lons = [];
  const lats = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    const dlon = ((lon - subLon) * Math.PI) / 180.0;
    // Terminator equation: tan(lat) = -cos(dlon) / tan(decl)
    const lat = Math.atan2(-Math.cos(dlon), Math.tan(decl)) * (180.0 / Math.PI);
    lons.push(lon);
    lats.push(lat);
  }
  return { lons, lats };
}

export default function WorldMap() {
  const [params, setParams] = useState({ day_month: 3, f107: 150, lon_step: 15, lat_step: 3 });
  const [data, setData] = useState(null);
  const [ltIndex, setLtIndex] = useState(42); // LT 21:00
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(220); // ms per frame
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const frameRef = useRef(null);

  const load = async () => {
    setErr(null); setLoading(true); setData(null);
    try {
      const { data } = await api.get("/ibp/worldmap", { params });
      setData(data);
    } catch (e) { setErr(formatApiError(e)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Animated play loop using requestAnimationFrame for smooth motion
  useEffect(() => {
    if (!playing || !data) return;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      if (now - last >= speed) {
        last = now;
        setLtIndex((i) => (i + 1) % data.lt_values.length);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, data, speed]);

  const lt = data?.lt_values[ltIndex];

  // Build IBP overlay scattergeo trace from the dense 2D matrix
  const overlayTraces = useMemo(() => {
    if (!data) return [];
    const frame = data.frames[ltIndex];
    if (!frame) return [];
    const lats = []; const lons = []; const values = []; const hover = [];
    for (let i = 0; i < data.lats.length; i++) {
      for (let j = 0; j < data.lons.length; j++) {
        const v = frame.matrix[i][j];
        if (v < 0.025) continue; // skip near-zero for cleaner band rendering
        lats.push(data.lats[i]);
        lons.push(data.lons[j]);
        values.push(v);
        hover.push(
          `Lat ${data.lats[i].toFixed(1)}°<br>` +
          `Lon ${data.lons[j]}°<br>` +
          `IBP ${v.toFixed(3)}<br>` +
          `${classify(v)}`
        );
      }
    }
    return [{
      type: "scattergeo",
      lon: lons, lat: lats,
      mode: "markers",
      marker: {
        color: values,
        colorscale: DISCRETE_COLORSCALE,
        cmin: 0, cmax: 1,
        size: 7,
        symbol: "square",
        opacity: 0.92,
        line: { width: 0 },
        colorbar: {
          thickness: 12, outlinewidth: 0, len: 0.85, x: 1.0,
          tickfont: { family: "JetBrains Mono, monospace", size: 10, color: "#8B93A5" },
          tickvals: [0.05, 0.20, 0.375, 0.525, 0.675, 0.825, 0.95],
          ticktext: ["0.0–0.1", "0.1–0.3", "0.3–0.45", "0.45–0.6", "0.6–0.75", "0.75–0.9", "0.9–1.0"],
          title: { text: "IBP", font: { color: "#8B93A5", family: "JetBrains Mono", size: 10 } },
        },
      },
      hovertext: hover,
      hoverinfo: "text",
      name: "IBP",
      showlegend: false,
    }];
  }, [data, ltIndex]);

  // Terminator + sun overlays
  const solarTraces = useMemo(() => {
    if (!data || lt == null) return [];
    const subLon = subsolarLonDeg(lt);
    const decl = solarDeclinationDeg(data.doy);
    const term = terminatorLine(subLon, decl);

    return [
      {
        type: "scattergeo",
        mode: "lines",
        lon: term.lons,
        lat: term.lats,
        line: { color: "#FDCA26", width: 1.4, dash: "dot" },
        hoverinfo: "skip",
        name: "terminator",
        showlegend: false,
      },
      {
        type: "scattergeo",
        mode: "markers",
        lon: [subLon],
        lat: [decl],
        marker: {
          symbol: "circle",
          size: 22,
          color: "#FDCA26",
          line: { color: "#FFFFFF", width: 2 },
          opacity: 1,
        },
        hovertext: [`Subsolar point<br>Lon ${subLon.toFixed(1)}°<br>Decl ${decl.toFixed(2)}°<br>UTC ${ltToHHMM(lt)}`],
        hoverinfo: "text",
        name: "sun",
        showlegend: false,
      },
      // halo around sun
      {
        type: "scattergeo",
        mode: "markers",
        lon: [subLon],
        lat: [decl],
        marker: {
          symbol: "circle-open",
          size: 38,
          color: "#FDCA26",
          line: { color: "#FDCA26", width: 1 },
          opacity: 0.55,
        },
        hoverinfo: "skip",
        showlegend: false,
      },
    ];
  }, [data, lt]);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="worldmap-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— global ibp · animated</div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Globe size={28} className="text-[#0047FF]" /> World Map
        </h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          IBP across the equatorial belt with discrete probability bands. The dotted line traces the day/night
          terminator and the gold marker is the subsolar point — drag the time slider or hit play to watch the
          ionosphere evolve over a 24-hour day.
        </p>
      </div>

      <div className="border border-[#2A2D35] p-5 grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-end" data-testid="worldmap-form">
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
        <Field label="Latitude step (°)">
          <input type="number" min={0.5} max={10} step={0.5} value={params.lat_step}
            data-testid="wm-latstep"
            onChange={(e) => setParams({ ...params, lat_step: Number(e.target.value) })}
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </Field>
        <button onClick={load} disabled={loading} data-testid="wm-run"
          className="h-11 px-5 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors disabled:opacity-40">
          <Lightning size={14} weight="fill" /> {loading ? "Computing..." : "Compute"}
        </button>
      </div>

      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="wm-error">{err}</div>}

      {data && (
        <div className="border border-[#2A2D35] bg-[#090A0C]" ref={frameRef}>
          <div className="flex items-center justify-between px-4 h-10 border-b border-[#2A2D35]">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">
              — global ibp • {MONTHS[data.month - 1]} · doy {data.doy} · f10.7 {data.f107} · extrapolation: {data.method}
            </div>
            <div className="mono text-xs text-[#FDCA26] flex items-center gap-2" data-testid="wm-lt-display">
              <Sun size={14} weight="fill" /> UTC {ltToHHMM(lt ?? 0)}
            </div>
          </div>
          <Plot
            data={[...overlayTraces, ...solarTraces]}
            layout={{
              paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
              margin: { l: 0, r: 0, t: 6, b: 6 },
              height: 580,
              showlegend: false,
              geo: {
                projection: { type: "equirectangular" },
                showland: true, landcolor: "#13161C",
                showocean: true, oceancolor: "#0B0D11",
                showcountries: true, countrycolor: "#262A33",
                showcoastlines: true, coastlinecolor: "#2F3540",
                showframe: false,
                lataxis: { range: [-60, 60], showgrid: true, gridcolor: "#1A1D24", dtick: 30 },
                lonaxis: { range: [-180, 180], showgrid: true, gridcolor: "#1A1D24", dtick: 30 },
                bgcolor: "#090A0C",
              },
            }}
            config={{
              displaylogo: false,
              responsive: true,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
              toImageButtonOptions: {
                format: "png",
                filename: `ibp_worldmap_doy${data.doy}_f107_${data.f107}_lt${ltToHHMM(lt ?? 0)}`,
                width: 1600, height: 900, scale: 2,
              },
            }}
            style={{ width: "100%", height: 580 }}
            useResizeHandler
          />

          {/* 24-h timeline + play controls */}
          <div className="p-4 border-t border-[#2A2D35] space-y-3" data-testid="wm-slider-container">
            <div className="flex items-center gap-4">
              <button onClick={() => setPlaying((p) => !p)} data-testid="wm-play"
                className="w-10 h-10 border border-[#2A2D35] hover:border-[#FDCA26] flex items-center justify-center text-white transition-colors">
                {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
              </button>
              <div className="flex-1 relative">
                <Slider value={[ltIndex]} min={0} max={data.lt_values.length - 1} step={1}
                  onValueChange={(v) => { setLtIndex(v[0]); }}
                  onValueCommit={() => {}}
                  data-testid="wm-slider" />
              </div>
              <div className="mono text-xs text-white w-24 text-right tabular-nums" data-testid="wm-utc-readout">
                {ltToHHMM(lt ?? 0)} UTC
              </div>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                data-testid="wm-speed"
                className="h-10 bg-[#090A0C] border border-[#2A2D35] text-white mono text-[10px] uppercase tracking-[0.2em] px-2">
                <option value={500}>0.5×</option>
                <option value={300}>1×</option>
                <option value={220}>1.5×</option>
                <option value={140}>2×</option>
                <option value={70}>4×</option>
              </select>
            </div>
            <div className="flex justify-between mono text-[10px] text-[#565D6D] uppercase tracking-widest select-none">
              <span>00:00</span><span>03:00</span><span>06:00</span><span>09:00</span>
              <span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span><span>23:30</span>
            </div>
          </div>

          {/* Discrete legend swatches */}
          <div className="px-4 pb-4" data-testid="wm-legend">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">— probability bands</div>
            <div className="flex flex-wrap gap-2">
              {BAND_STOPS.map((b) => (
                <div key={b.lo} className="flex items-center gap-2 mono text-[10px] text-[#8B93A5]">
                  <span className="inline-block w-4 h-4" style={{ background: b.color }} />
                  {b.lo.toFixed(2)} – {Math.min(b.hi, 1).toFixed(2)}
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
