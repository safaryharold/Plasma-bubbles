import React from "react";

/** Subtle skeleton placeholder — uses the dark Command-Center palette. */
export function Skeleton({ className = "", testId }) {
  return (
    <div data-testid={testId}
      className={`bg-[#1A1D24] animate-pulse ${className}`} />
  );
}

/** Full-page loading state used between code-split chunks. */
export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" data-testid="page-loader">
      <div className="space-y-3 text-center">
        <div className="mx-auto w-10 h-10 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D]">loading…</div>
      </div>
    </div>
  );
}

/** Skeleton row used by lists (jobs, experiments, keys, webhooks). */
export function RowSkeleton({ cols = 4 }) {
  return (
    <div className="flex gap-4 py-3 border-b border-[#1A1D24]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
  );
}
