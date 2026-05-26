import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useJobSocket } from "../hooks/useJobSocket";
import { StatStripSkeleton, JobRowSkeleton, CardSkeleton } from "../components/Skeleton";
import JobProgressBar from "../components/JobProgressBar";
import { Calculator, GridFour, Flask, ArrowRight } from "@phosphor-icons/react";

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [usage, setUsage] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Merge live WS job updates into local state
  const { liveJobs } = useJobSocket();

  useEffect(() => {
    Promise.all([
      api.get("/ibp/jobs").then((r) => setJobs(r.data)),
      api.get("/ibp/usage").then((r) => setUsage(r.data)),
      api.get("/experiments").then((r) => setExperiments(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge real-time WS updates into the jobs list
  useEffect(() => {
    if (Object.keys(liveJobs).length === 0) return;
    setJobs((prev) =>
      prev.map((j) => (liveJobs[j.id] ? { ...j, ...liveJobs[j.id] } : j))
    );
  }, [liveJobs]);

  // Active jobs (show progress bar)
  const activeJob = jobs.find((j) => j.status === "RUNNING" || j.status === "PENDING");

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">
          — welcome back, {user?.name || user?.email}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Command Center <span className="text-[#8B93A5]">// operational</span>
        </h1>
      </div>

      {/* Active job progress */}
      {activeJob && (
        <div className="border border-[#0047FF] p-6" aria-live="polite" aria-atomic="false">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#0047FF] mb-4">
            — active job: {activeJob.name || activeJob.id.slice(0, 8)}
          </div>
          <JobProgressBar job={activeJob} />
        </div>
      )}

      {/* Stat strip */}
      {loading ? (
        <StatStripSkeleton />
      ) : (
        <div
          className="grid grid-cols-2 md:grid-cols-4 border border-[#2A2D35]"
          data-testid="stat-strip"
          aria-label="Usage statistics"
        >
          <Stat label="Total jobs" value={jobs.length} />
          <Stat label="Completed" value={jobs.filter((j) => j.status === "COMPLETED").length} tint="text-[#00E599]" />
          <Stat label="Experiments saved" value={experiments.length} />
          <Stat
            label="Today's usage"
            value={usage ? `${usage.day_used} / ${usage.day_limit}` : "—"}
            tint="text-[#0047FF]"
          />
        </div>
      )}

      {/* Quick actions */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <QuickAction to="/calculator" icon={Calculator} title="Single-point calculation"
            body="Compute IBP for one {day, lon, LT, F10.7} tuple with confidence & anomaly flag."
            test="qa-calculator" />
          <QuickAction to="/sweep" icon={GridFour} title="Parameter sweep"
            body="Generate a longitude × local-time heatmap up to 10,000 cells."
            test="qa-sweep" />
          <QuickAction to="/experiments" icon={Flask} title="Experiments"
            body="Save reproducible configurations and clone them across your team."
            test="qa-experiments" />
        </div>
      )}

      {/* Recent jobs */}
      <section aria-labelledby="recent-jobs-heading" className="border border-[#2A2D35]" data-testid="recent-jobs">
        <div className="flex items-center justify-between px-6 h-12 border-b border-[#2A2D35]">
          <h2 id="recent-jobs-heading" className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5]">
            — recent jobs
          </h2>
          <Link
            to="/sweep"
            className="mono text-[10px] uppercase tracking-[0.25em] text-[#0047FF] hover:text-white flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
          >
            New sweep <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-[#2A2D35]">
            {[...Array(5)].map((_, i) => <JobRowSkeleton key={i} />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-12 text-center mono text-xs text-[#565D6D]">
            No jobs yet. Run your first sweep.
          </div>
        ) : (
          <div className="divide-y divide-[#2A2D35]" role="list" aria-label="Job history">
            {jobs.slice(0, 8).map((j) => (
              <div
                key={j.id}
                className="grid grid-cols-12 items-center px-6 py-3 mono text-xs hover:bg-[#121418] transition-colors"
                data-testid={`job-row-${j.id}`}
                role="listitem"
              >
                <div className="col-span-2 text-[#8B93A5]" aria-label="Job ID">{j.id.slice(0, 8)}</div>
                <div className="col-span-3 truncate">{j.name || "(unnamed)"}</div>
                <div className="col-span-2 text-[#565D6D]">{j.cells} cells</div>
                <div className="col-span-3 text-[#565D6D]">{new Date(j.created_at).toLocaleString()}</div>
                <div className="col-span-2 flex items-center gap-2">
                  <StatusDot status={j.status} />
                  <span
                    className={
                      j.status === "COMPLETED" ? "text-[#00E599]" :
                      j.status === "FAILED"    ? "text-[#FF3333]" :
                      j.status === "RUNNING"   ? "text-[#0047FF]" : "text-[#8B93A5]"
                    }
                    aria-label={`Status: ${j.status}`}
                  >
                    {j.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Usage meter */}
      {usage && (
        <section
          className="border border-[#2A2D35] p-6"
          data-testid="usage-meter"
          aria-label="Rate limit usage"
        >
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] mb-4">
            — rate limit usage ({usage.role})
          </div>
          <Meter label="Per minute" used={usage.minute_used} limit={usage.minute_limit} />
          <div className="h-4" />
          <Meter label="Per day" used={usage.day_used} limit={usage.day_limit} />
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tint = "text-white" }) {
  return (
    <div className="p-6 border-r last:border-r-0 border-[#2A2D35]">
      <div className={`font-sans font-black text-3xl tracking-tight ${tint}`} aria-label={`${label}: ${value}`}>
        {value}
      </div>
      <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mt-2">{label}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, body, test }) {
  return (
    <Link
      to={to}
      data-testid={test}
      className="border border-[#2A2D35] p-6 hover:bg-[#121418] hover:border-[#0047FF] transition-all group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
    >
      <Icon size={22} className="text-[#0047FF] mb-4" aria-hidden="true" />
      <div className="font-sans font-bold text-base mb-2 flex items-center gap-2">
        {title} <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>
      <div className="mono text-xs text-[#8B93A5] leading-relaxed">{body}</div>
    </Link>
  );
}

function StatusDot({ status }) {
  const color = {
    COMPLETED: "bg-[#00E599]",
    FAILED:    "bg-[#FF3333]",
    RUNNING:   "bg-[#0047FF] animate-grid-pulse",
    PENDING:   "bg-[#8B93A5]",
  }[status] || "bg-[#8B93A5]";
  return <span className={`w-2 h-2 ${color}`} aria-hidden="true" />;
}

function Meter({ label, used, limit }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between mono text-xs mb-2">
        <span className="text-[#8B93A5] uppercase tracking-widest text-[10px]">{label}</span>
        <span aria-label={`${used} of ${limit}`}>{used} / {limit}</span>
      </div>
      <div className="h-1 bg-[#2A2D35]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} usage ${Math.round(pct)}%`}>
        <div className="h-full bg-[#0047FF] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
