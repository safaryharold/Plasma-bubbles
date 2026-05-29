import React from "react";

/** Subtle skeleton placeholder — uses the dark Command-Center palette. */
export function Skeleton({ className = "", testId }) {
  return (
    <div data-testid={testId}
      className={`bg-[#1A1D24] animate-pulse ${className}`} />
  );
}

/** Full-page loading state used between code-split chunks. */
export function PageLoader({ label = "Loading…" }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" data-testid="page-loader">
      <div className="space-y-3 text-center">
        <div className="mx-auto w-10 h-10 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D]">{label}</div>
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

export function StatStripSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-[#2A2D35]">
      {Array.from({ length: 4 }).map((index) => (
        <div key={index} className="p-6 border-r last:border-r-0 border-[#2A2D35]">
          <Skeleton className="h-12 w-24 mb-4" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-[#2A2D35] p-6 animate-pulse">
      <Skeleton className="h-8 w-12 mb-5" />
      <Skeleton className="h-6 w-40 mb-4" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function JobRowSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#2A2D35]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/** Small spinner used inline in buttons and compact UIs. */
export function Spinner({ size = 4, className = "" }) {
  const px = `${size}rem`;
  return (
    <div className={`inline-block rounded-full border-2 border-t-transparent animate-spin ${className}`} style={{ width: px, height: px }} />
  );
}

/** Button that shows a spinner while `loading` is true. */
export function LoadingButton({ loading = false, children, className = "", ...props }) {
  return (
    <button disabled={loading} className={`inline-flex items-center gap-2 px-4 py-2 ${className}`} {...props}>
      {loading ? <Spinner size={0.75} className="border-white/60" /> : null}
      <span>{children}</span>
    </button>
  );
}
