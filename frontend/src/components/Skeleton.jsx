/**
 * Skeleton loader primitives — use these in place of content while async
 * data is loading to give the page a polished, non-janky feel.
 */
import React from "react";

/** Generic shimmer block */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse bg-[#1A1D24] ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Stat strip skeleton (matches Dashboard stat-strip layout) */
export function StatStripSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-[#2A2D35]">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-6 border-r last:border-r-0 border-[#2A2D35] space-y-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Job table row skeleton */
export function JobRowSkeleton() {
  return (
    <div className="grid grid-cols-12 items-center px-6 py-3">
      <Skeleton className="col-span-2 h-3 w-14" />
      <Skeleton className="col-span-3 h-3 w-24" />
      <Skeleton className="col-span-2 h-3 w-12" />
      <Skeleton className="col-span-3 h-3 w-28" />
      <Skeleton className="col-span-2 h-3 w-16" />
    </div>
  );
}

/** Card skeleton for quick-action cards */
export function CardSkeleton() {
  return (
    <div className="border border-[#2A2D35] p-6 space-y-4">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

/** Full-page loading overlay (use for initial auth check) */
export function PageLoader({ label = "Loading…" }) {
  return (
    <div
      className="min-h-screen bg-[#090A0C] flex items-center justify-center"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
        <span className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D]">{label}</span>
      </div>
    </div>
  );
}

/** Inline spinner — drop into buttons or beside text */
export function Spinner({ size = 16, className = "" }) {
  return (
    <span
      className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
