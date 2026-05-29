import React from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { Gear, ShieldCheck, ArrowsClockwise, MoonStars, Sun } from "@phosphor-icons/react";

export default function Settings() {
  const { theme, toggle, isDark } = useTheme();
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in" data-testid="settings-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— account settings</div>
        <h1 className="text-3xl font-black tracking-tight">Preferences & session</h1>
        <p className="mono text-xs text-[#8B93A5] mt-2 max-w-2xl">
          Customize your console theme, inspect session details, and manage your persisted research settings.
        </p>
      </div>

      <section className="border border-[#2A2D35] p-6" aria-labelledby="theme-settings-heading">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 id="theme-settings-heading" className="font-bold text-lg">Theme</h2>
            <p className="mono text-xs text-[#8B93A5]">Toggle between light and dark mode, persisted for future visits.</p>
          </div>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-2 rounded-md border border-[#2A2D35] bg-[#090A0C] px-4 py-3 text-sm text-white hover:border-[#0047FF] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="settings-theme-toggle"
          >
            {isDark ? <Sun size={18} aria-hidden="true" /> : <MoonStars size={18} aria-hidden="true" />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-[#2A2D35] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Gear size={20} className="text-[#0047FF]" aria-hidden="true" />
              <div className="font-semibold">Theme preference</div>
            </div>
            <p className="mono text-xs text-[#8B93A5]">Current preference: <span className="text-white">{theme}</span></p>
          </div>
          <div className="border border-[#2A2D35] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={20} className="text-[#00E599]" aria-hidden="true" />
              <div className="font-semibold">Session persistency</div>
            </div>
            <p className="mono text-xs text-[#8B93A5]">Your session is persisted with secure httpOnly cookies and automatic refresh tokens for seamless browsing.</p>
          </div>
        </div>
      </section>

      <section className="border border-[#2A2D35] p-6" aria-labelledby="account-session-heading">
        <h2 id="account-session-heading" className="font-bold text-lg mb-3">Session details</h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#2A2D35] p-4">
            <dt className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">Signed in as</dt>
            <dd className="mt-2 text-white">{user?.email || "Unknown"}</dd>
          </div>
          <div className="rounded-xl border border-[#2A2D35] p-4">
            <dt className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">Role</dt>
            <dd className="mt-2 text-white">{user?.role || "researcher"}</dd>
          </div>
          <div className="rounded-xl border border-[#2A2D35] p-4 md:col-span-2">
            <dt className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">Session refresh</dt>
            <dd className="mt-2 text-[#8B93A5]">The application automatically refreshes your access token in the background to keep your session alive while you work.</dd>
          </div>
        </dl>
      </section>

      <section className="border border-[#2A2D35] p-6 bg-[#090A0C] rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <ArrowsClockwise size={18} className="text-[#0047FF]" aria-hidden="true" />
          <div className="font-semibold">Session health</div>
        </div>
        <p className="mono text-xs text-[#8B93A5]">Keep this page open while running long sweeps. The platform uses refresh tokens and secure cookies for session persistence.</p>
      </section>
    </div>
  );
}
