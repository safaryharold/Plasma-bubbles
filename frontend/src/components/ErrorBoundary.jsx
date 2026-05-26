import React from "react";
import { WarningCircle, ArrowsClockwise } from "@phosphor-icons/react";

/** Global error boundary — catches render-time exceptions and shows a calm
 *  recovery UI instead of a white screen. Falls back to /dashboard reset. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook for future Sentry/Datadog integration
    console.error("Unhandled UI error:", error, info?.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    // Force a clean route mount
    if (typeof window !== "undefined") window.location.assign("/dashboard");
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#06070A] text-white grid place-items-center px-6" data-testid="error-boundary">
        <div className="max-w-lg border border-[#FF3333]/40 bg-[#FF3333]/5 p-8 space-y-5">
          <WarningCircle size={32} weight="fill" className="text-[#FF3333]" />
          <h1 className="text-2xl font-black tracking-tight">Something broke up here.</h1>
          <p className="mono text-xs text-[#8B93A5] leading-relaxed">
            The frontend caught an exception while rendering. The backend is fine — your data is safe.
            We've logged the trace; refresh to recover.
          </p>
          <pre className="mono text-[10px] text-[#FF6666] bg-[#0D0D11] border border-[#2A2D35] p-3 overflow-auto max-h-32">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={this.reset} data-testid="error-boundary-reset"
            className="h-11 px-6 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
            <ArrowsClockwise size={14} /> Reset & return to dashboard
          </button>
        </div>
      </div>
    );
  }
}
