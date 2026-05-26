/**
 * JobProgressBar — real-time batch job progress indicator.
 *
 * Renders a pulsing animated bar while a job is PENDING or RUNNING,
 * transitions to a solid fill when COMPLETED, or shows an error state on FAILED.
 */
import React, { useEffect, useState } from "react";

const STATUS_CONFIG = {
  PENDING:   { color: "bg-[#8B93A5]", label: "Queued",    animate: true  },
  RUNNING:   { color: "bg-[#0047FF]", label: "Computing", animate: true  },
  COMPLETED: { color: "bg-[#00E599]", label: "Complete",  animate: false },
  FAILED:    { color: "bg-[#FF3333]", label: "Failed",    animate: false },
};

export default function JobProgressBar({ job }) {
  const [displayPct, setDisplayPct] = useState(0);

  const cfg = STATUS_CONFIG[job?.status] || STATUS_CONFIG.PENDING;
  const targetPct =
    job?.status === "COMPLETED" ? 100 :
    job?.status === "FAILED"    ? 100 :
    job?.status === "RUNNING"   ? 70  : 15;

  // Smoothly animate percentage
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayPct((prev) => {
        if (prev >= targetPct) return prev;
        return Math.min(prev + 2, targetPct);
      });
    }, 40);
    return () => clearInterval(interval);
  }, [targetPct]);

  // Reset on new job
  useEffect(() => {
    if (job?.status === "PENDING") setDisplayPct(0);
  }, [job?.id, job?.status]);

  if (!job) return null;

  return (
    <div className="space-y-2" role="progressbar" aria-valuenow={displayPct} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex justify-between items-center mono text-[10px] uppercase tracking-widest">
        <span className="text-[#8B93A5]">{cfg.label}</span>
        <span className={cfg.color.replace("bg-", "text-")}>
          {job.status === "RUNNING" ? "in progress…" : `${displayPct}%`}
        </span>
      </div>
      <div className="h-1 bg-[#2A2D35] overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${cfg.color} ${cfg.animate ? "animate-pulse" : ""}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      {job.status === "FAILED" && job.error && (
        <p className="mono text-[10px] text-[#FF3333] mt-1" role="alert">{job.error}</p>
      )}
    </div>
  );
}
