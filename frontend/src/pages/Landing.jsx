import React from "react";
import { Link } from "react-router-dom";
import { Planet, Lightning, GridFour, ChartLineUp, Atom, Rocket, ArrowRight, Waveform, CheckCircle, Database } from "@phosphor-icons/react";

const FEATURES = [
  { icon: Atom, title: "Research-grade core", body: "Backed by the peer-reviewed ibpmodel package. Deterministic, reproducible, scientifically rigorous." },
  { icon: GridFour, title: "Parameter sweeps at scale", body: "Longitude × local-time grids up to 10,000 cells computed in the background with config-hash reproducibility." },
  { icon: ChartLineUp, title: "Plotly visualizations", body: "Interactive heatmaps, butterfly diagrams, A/B comparison diffs — built for space-weather & GNSS ops." },
  { icon: Database, title: "Experiments & exports", body: "Save configurations, clone, re-run. Download CSV for Jupyter, MATLAB, or your pipeline." },
  { icon: Lightning, title: "API-first SaaS design", body: "Every action has a REST counterpart. API keys, rate limits, usage metering — ready for production." },
  { icon: Waveform, title: "Confidence + anomaly flags", body: "Every probability ships with a confidence score and anomaly detection for off-peak high-IBP events." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#090A0C] text-white" data-testid="landing-page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#090A0C]/95 backdrop-blur border-b border-[#2A2D35]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-8 h-14">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center">
              <Planet size={16} weight="fill" className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="mono text-[10px] text-[#565D6D] uppercase tracking-[0.25em]">Platform</div>
              <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white transition-colors px-3" data-testid="nav-login">Log in</Link>
            <Link to="/register" className="mono text-xs uppercase tracking-widest bg-[#0047FF] hover:bg-[#336DFF] text-white px-4 h-9 flex items-center transition-colors" data-testid="nav-register">
              Start free →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#2A2D35]">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#090A0C]/60 to-[#090A0C]" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 pt-20 pb-24">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#0047FF] mb-6 flex items-center gap-3" data-testid="hero-eyebrow">
            <span className="w-8 h-px bg-[#0047FF]" />
            v1.0 • Ionospheric Bubble Probability
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] max-w-4xl" data-testid="hero-title">
            The research-to-production platform for<br />
            <span className="text-[#0047FF]">equatorial plasma bubble</span> forecasting.
          </h1>
          <p className="mt-8 text-[#8B93A5] mono text-sm md:text-base max-w-2xl leading-relaxed" data-testid="hero-subtitle">
            Compute IBP probabilities at a point or over a full longitude × local-time grid.
            Save experiments, compare scenarios, share an API key with your pipeline.
            Built for space-weather researchers, GNSS engineers, and satellite operators.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/register" className="mono text-xs uppercase tracking-widest bg-white hover:bg-[#0047FF] hover:text-white text-[#090A0C] px-6 h-12 flex items-center gap-2 transition-colors" data-testid="hero-cta-primary">
              <Rocket size={14} weight="fill" /> Launch console
            </Link>
            <Link to="/login" className="mono text-xs uppercase tracking-widest border border-[#2A2D35] hover:border-white text-white px-6 h-12 flex items-center gap-2 transition-colors" data-testid="hero-cta-secondary">
              Sign in <ArrowRight size={14} />
            </Link>
          </div>

          {/* live stat strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 border border-[#2A2D35]">
            {[
              { k: "10,000", v: "MAX GRID CELLS / SWEEP" },
              { k: "< 2s", v: "P95 SINGLE-POINT LATENCY" },
              { k: "SHA-256", v: "REPRODUCIBILITY HASH" },
              { k: "0 – 1", v: "PROBABILITY OUTPUT" },
            ].map((s, i) => (
              <div key={i} className="p-6 border-r last:border-r-0 border-[#2A2D35]">
                <div className="font-sans font-black text-2xl md:text-3xl tracking-tight">{s.k}</div>
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mt-2">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 py-20 border-b border-[#2A2D35]">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— capabilities</div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-12 max-w-3xl">
          Science-grade numerics. <span className="text-[#8B93A5]">SaaS-grade workflow.</span>
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#2A2D35]">
          {FEATURES.map((f, i) => (
            <div key={i} className="border-r border-b border-[#2A2D35] p-8 hover:bg-[#121418] transition-colors" data-testid={`feature-${i}`}>
              <f.icon size={26} className="text-[#0047FF] mb-5" />
              <div className="font-sans font-bold text-base mb-3">{f.title}</div>
              <div className="mono text-xs text-[#8B93A5] leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 py-20">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— tiers</div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-12 max-w-3xl">Free for research. Pro for production.</h2>
        <div className="grid md:grid-cols-3 gap-0 border border-[#2A2D35]">
          {[
            { n: "Researcher", p: "$0", c: ["60 req/min", "500 runs/day", "CSV export", "10k-cell sweeps"], testid: "tier-researcher" },
            { n: "Pro", p: "$49", c: ["600 req/min", "50k runs/day", "API keys + webhooks", "Priority queue"], featured: true, testid: "tier-pro" },
            { n: "Enterprise", p: "Custom", c: ["Dedicated compute", "NetCDF, Parquet", "SLA + audit", "Ray cluster migration"], testid: "tier-enterprise" },
          ].map((t, i) => (
            <div key={i} className={`p-8 border-r last:border-r-0 border-[#2A2D35] ${t.featured ? 'bg-[#121418]' : ''}`} data-testid={t.testid}>
              {t.featured && (
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#0047FF] mb-4">— recommended</div>
              )}
              <div className="font-sans font-black text-xl tracking-tight">{t.n}</div>
              <div className="font-sans font-black text-4xl tracking-tighter mt-4">{t.p}<span className="text-sm text-[#8B93A5] font-normal mono ml-2">/ mo</span></div>
              <ul className="mt-6 space-y-3">
                {t.c.map((ci, j) => (
                  <li key={j} className="flex items-center gap-2 mono text-xs text-[#8B93A5]">
                    <CheckCircle size={14} weight="fill" className="text-[#0047FF]" /> {ci}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">
          Billing design hooks present; Stripe flow not live in this release.
        </div>
      </section>

      <footer className="border-t border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] px-6 md:px-8 py-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>IBP Analytics Platform © 2026 — research + production</div>
        <div>Powered by ibpmodel • FastAPI • Plotly</div>
      </footer>
    </div>
  );
}
