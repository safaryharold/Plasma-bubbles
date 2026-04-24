import React, { useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Slider } from "../components/ui/slider";
import { WarningCircle, CheckCircle, Lightning, Sparkle } from "@phosphor-icons/react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Calculator() {
  const [day_month, setDM] = useState(3);
  const [lon, setLon] = useState(0);
  const [lt, setLt] = useState(21);
  const [f107, setF107] = useState(150);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const compute = async () => {
    setErr(null); setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/ibp/calculate", { day_month, lon, lt, f107 });
      setResult(data);
    } catch (e) { setErr(formatApiError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="calculator-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— single-point calculation</div>
        <h1 className="text-3xl font-black tracking-tight">IBP Calculator</h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">Compute bubble occurrence probability for a single atmospheric condition.</p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <div className="border border-[#2A2D35] p-6 space-y-6" data-testid="calculator-form">
          <ParamSlider label="Day / Month" value={day_month} min={1} max={366} step={1} onChange={setDM}
            hint={day_month <= 12 ? `Month: ${MONTHS[day_month-1]}` : `Day-of-year ${day_month}`} testid="param-daymonth" />
          <ParamSlider label="Longitude" value={lon} min={-180} max={180} step={1} onChange={setLon} unit="°" testid="param-lon" />
          <ParamSlider label="Local Time" value={lt} min={0} max={24} step={0.5} onChange={setLt} unit="h" testid="param-lt" />
          <ParamSlider label="F10.7 solar flux" value={f107} min={60} max={300} step={1} onChange={setF107} unit="sfu" testid="param-f107" />

          <button onClick={compute} disabled={loading} data-testid="calculate-btn"
            className="w-full h-12 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <Lightning size={14} weight="fill" /> {loading ? "Computing..." : "Compute IBP"}
          </button>
          {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="calculate-error">{err}</div>}
        </div>

        <div className="border border-[#2A2D35] bg-[#121418]" data-testid="result-card">
          <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">— output</div>
          {!result ? (
            <div className="p-8 text-center mono text-xs text-[#565D6D]">Set parameters and hit compute.</div>
          ) : (
            <div className="p-6 space-y-5">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">IBP PROBABILITY</div>
                <div className="flex items-baseline gap-3 mt-1">
                  <div className="font-sans font-black text-6xl tracking-tighter" data-testid="result-ibp"
                    style={{ color: result.ibp > 0.6 ? '#FF3333' : result.ibp > 0.3 ? '#FFDD00' : '#0047FF' }}>
                    {result.ibp.toFixed(3)}
                  </div>
                  <div className="mono text-xs text-[#8B93A5]">/ 1.000</div>
                </div>
                <div className="h-1 bg-[#2A2D35] mt-4">
                  <div className="h-full transition-all"
                    style={{ width: `${result.ibp*100}%`,
                      background: result.ibp > 0.6 ? '#FF3333' : result.ibp > 0.3 ? '#FFDD00' : '#0047FF' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Kv k="Confidence" v={result.confidence.toFixed(3)} icon={<Sparkle size={12} className="text-[#0047FF]" />} testid="result-confidence" />
                <Kv k="Anomaly"
                  v={result.anomaly_flag ? "FLAGGED" : "normal"}
                  icon={result.anomaly_flag ? <WarningCircle size={12} className="text-[#FFDD00]" /> : <CheckCircle size={12} className="text-[#00E599]" />}
                  testid="result-anomaly" />
                <Kv k="DOY / Month" v={`${result.doy} / ${MONTHS[result.month-1]}`} />
                <Kv k="Longitude" v={`${result.lon}°`} />
                <Kv k="Local time" v={`${result.lt}h`} />
                <Kv k="F10.7" v={`${result.f107} sfu`} />
              </div>

              <div className="border-t border-[#2A2D35] pt-4" data-testid="result-explanation">
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">— explanation</div>
                <div className="mono text-xs text-white leading-relaxed">{result.explanation}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ParamSlider({ label, value, min, max, step, onChange, unit = "", hint, testid }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">{label}</span>
        <div className="flex items-center gap-2">
          <input type="number" min={min} max={max} step={step} value={value}
            data-testid={`${testid}-input`}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-24 bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-8 mono text-sm text-right" />
          {unit && <span className="mono text-xs text-[#8B93A5]">{unit}</span>}
        </div>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])}
        data-testid={`${testid}-slider`}
        className="mt-1" />
      {hint && <div className="mono text-[10px] text-[#565D6D] mt-2">{hint}</div>}
    </div>
  );
}

function Kv({ k, v, icon, testid }) {
  return (
    <div data-testid={testid}>
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] flex items-center gap-1">
        {icon} {k}
      </div>
      <div className="mono text-sm text-white mt-1">{v}</div>
    </div>
  );
}
