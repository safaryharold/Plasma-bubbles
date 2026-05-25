import React, { useEffect, useMemo, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { Sun, Play, Pause, Globe, ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const Plot = createPlotlyComponent(Plotly);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Same 8-band Viridis discretisation as /worldmap
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
const DISCRETE = (() => {
  const s = [];
  BAND_STOPS.forEach((b) => { s.push([b.lo, b.color]); s.push([Math.min(b.hi, 1), b.color]); });
  return s;
})();

function ltToHHMM(t) {
  const h = Math.floor(t) % 24;
  const m = Math.round((t - Math.floor(t)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function subsolarLonDeg(utcHour) {
  let lon = (12 - utcHour) * 15;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}
function solarDeclinationDeg(doy) {
  return 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365.0);
}
function terminatorLine(subLon, declDeg) {
  const decl = (declDeg * Math.PI) / 180.0;
  const tanDecl = Math.tan(decl) === 0 ? 1e-6 : Math.tan(decl);
  const lons = []; const lats = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    const dlon = ((lon - subLon) * Math.PI) / 180.0;
    const lat = Math.atan(-Math.cos(dlon) / tanDecl) * (180.0 / Math.PI);
    lons.push(lon); lats.push(lat);
  }
  return { lons, lats };
}

/**
 * Public, no-auth, embedded preview of the IBP world map.
 * Hits GET /api/public/worldmap-demo (server-cached) and runs the same animated
 * terminator + sun + discrete-band rendering as /worldmap.
 */
export default function LandingDemo() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [ltIndex, setLtIndex] = useState(42); // LT 21:00 — peak bubble time
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/public/worldmap-demo`)
      .then((r) => (r.ok ? r.json() : r.json().then((b) => { throw new Error(b.detail || "load failed"); })))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  // Animated play loop (~4× speed for an engaging preview)
  const rafRef = useRef(null);
  useEffect(() => {
    if (!playing || !data) return;
    let last = performance.now();
    const tick = (now) => {
      if (now - last >= 160) {
        last = now;
        setLtIndex((i) => (i + 1) % data.lt_values.length);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, data]);

  const lt = data?.lt_values[ltIndex];

  const overlayTraces = useMemo(() => {
    if (!data) return [];
    const frame = data.frames[ltIndex];
    if (!frame) return [];
    const lats = []; const lons = []; const values = [];
    for (let i = 0; i < data.lats.length; i++) {
      for (let j = 0; j < data.lons.length; j++) {
        const v = frame.matrix[i][j];
        if (v < 0.025) continue;
        lats.push(data.lats[i]); lons.push(data.lons[j]); values.push(v);
      }
    }
    return [{
      type: "scattergeo", lon: lons, lat: lats, mode: "markers",
      marker: { color: values, colorscale: DISCRETE, cmin: 0, cmax: 1, size: 6, symbol: "square", opacity: 0.92, line: { width: 0 } },
      hoverinfo: "skip", showlegend: false,
    }];
  }, [data, ltIndex]);

  const solarTraces = useMemo(() => {
    if (!data || lt == null) return [];
    const subLon = subsolarLonDeg(lt);
    const decl = solarDeclinationDeg(data.doy);
    const term = terminatorLine(subLon, decl);
    return [
      { type: "scattergeo", mode: "lines", lon: term.lons, lat: term.lats,
        line: { color: "#FDCA26", width: 1.4, dash: "dot" }, hoverinfo: "skip", showlegend: false },
      { type: "scattergeo", mode: "markers", lon: [subLon], lat: [decl],
        marker: { symbol: "circle", size: 18, color: "#FDCA26", line: { color: "#FFFFFF", width: 2 } },
        hoverinfo: "skip", showlegend: false },
    ];
  }, [data, lt]);

  return (
    <section className="border-y border-[#2A2D35] bg-[#06070A]" data-testid="landing-demo">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#0047FF] mb-3 flex items-center gap-3">
              <span className="w-8 h-px bg-[#0047FF]" />
              live preview · no login required
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
              <Globe size={28} className="text-[#0047FF]" /> See the equatorial ionosphere in motion
            </h2>
            <p className="mono text-xs md:text-sm text-[#8B93A5] mt-3 max-w-2xl leading-relaxed">
              Animated post-sunset bubble forecast for March equinox at moderate solar activity (F10.7=150).
              The dotted line traces the day/night terminator; the gold marker is the subsolar point.
              <span className="text-white"> Sign in for custom parameters, 3D smoothing, NetCDF/Parquet exports, and the butterfly diagram.</span>
            </p>
          </div>
          <Link to="/register"
            data-testid="demo-cta"
            className="mono text-xs uppercase tracking-widest bg-[#0047FF] hover:bg-[#336DFF] text-white px-5 h-11 flex items-center gap-2 transition-colors">
            Run your own sweep <ArrowRight size={14} />
          </Link>
        </div>

        <div className="border border-[#2A2D35] bg-[#090A0C]" data-testid="demo-plot">
          <div className="flex items-center justify-between px-4 h-10 border-b border-[#2A2D35]">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">
              {err ? "— preview unavailable" : data ? `— march equinox · doy ${data.doy} · f10.7 ${data.f107}` : "— loading…"}
            </div>
            {data && (
              <div className="mono text-xs text-[#FDCA26] flex items-center gap-2" data-testid="demo-lt">
                <Sun size={14} weight="fill" /> UTC {ltToHHMM(lt ?? 0)}
              </div>
            )}
          </div>

          {!data && !err && (
            <div className="h-[440px] flex flex-col items-center justify-center gap-3 mono text-xs text-[#565D6D]">
              <SpinnerGap size={28} className="animate-spin text-[#0047FF]" />
              <span>Warming up the model — first hit takes a few seconds…</span>
            </div>
          )}
          {err && (
            <div className="h-[440px] flex items-center justify-center mono text-xs text-[#FF3333] text-center px-8" data-testid="demo-error">
              {err}
            </div>
          )}
          {data && (
            <Plot
              data={[...overlayTraces, ...solarTraces]}
              layout={{
                paper_bgcolor: "#090A0C", plot_bgcolor: "#090A0C",
                margin: { l: 0, r: 0, t: 6, b: 6 },
                height: 460, showlegend: false,
                geo: {
                  projection: { type: "equirectangular" },
                  showland: true, landcolor: "#13161C",
                  showocean: true, oceancolor: "#0B0D11",
                  showcountries: true, countrycolor: "#262A33",
                  showcoastlines: true, coastlinecolor: "#2F3540",
                  showframe: false,
                  lataxis: { range: [-50, 50], showgrid: true, gridcolor: "#1A1D24", dtick: 30 },
                  lonaxis: { range: [-180, 180], showgrid: true, gridcolor: "#1A1D24", dtick: 30 },
                  bgcolor: "#090A0C",
                },
              }}
              config={{ displaylogo: false, responsive: true, staticPlot: true }}
              style={{ width: "100%", height: 460 }}
              useResizeHandler
            />
          )}

          {data && (
            <div className="px-4 py-3 border-t border-[#2A2D35] flex items-center gap-4">
              <button onClick={() => setPlaying((p) => !p)} data-testid="demo-play"
                className="w-9 h-9 border border-[#2A2D35] hover:border-[#FDCA26] flex items-center justify-center text-white transition-colors">
                {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
              </button>
              <input type="range" min={0} max={data.lt_values.length - 1} value={ltIndex}
                onChange={(e) => { setLtIndex(Number(e.target.value)); setPlaying(false); }}
                className="flex-1 accent-[#0047FF]"
                data-testid="demo-slider" />
              <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] flex flex-wrap gap-3 items-center">
                {BAND_STOPS.filter((_, i) => i % 2 === 0).map((b) => (
                  <span key={b.lo} className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3" style={{ background: b.color }} />
                    {b.lo.toFixed(2)}
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3" style={{ background: BAND_STOPS[BAND_STOPS.length - 1].color }} />
                  1.00
                </span>
              </div>
            </div>
          )}
        </div>

        {data?.caption && (
          <p className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mt-3" data-testid="demo-caption">
            {data.caption}
          </p>
        )}
      </div>
    </section>
  );
}
