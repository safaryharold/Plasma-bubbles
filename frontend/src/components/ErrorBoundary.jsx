/**
 * Global error boundary — catches unhandled React render errors and shows
 * a styled fallback UI instead of a blank/broken page.
 */
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;
    return (
      <div
        className="min-h-screen bg-[#090A0C] text-white flex items-center justify-center p-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-lg w-full border border-[#FF3333] p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#FF3333]" />
            <span className="mono text-[10px] uppercase tracking-[0.3em] text-[#FF3333]">
              — unexpected error
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
          <p className="mono text-xs text-[#8B93A5] leading-relaxed">
            An unhandled error occurred. Please try refreshing the page. If the problem
            persists, contact support.
          </p>
          {error?.message && (
            <pre className="bg-[#121418] border border-[#2A2D35] p-4 mono text-[10px] text-[#FF3333] overflow-auto rounded-none whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 h-10 bg-[#0047FF] mono text-xs uppercase tracking-widest hover:bg-[#003ACC] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
            >
              Reload page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 h-10 border border-[#2A2D35] mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white hover:border-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
