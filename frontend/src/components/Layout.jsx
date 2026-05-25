import React from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Gauge, Calculator, GridFour, Flask, ArrowsLeftRight,
  Key, Users, SignOut, Planet, Globe, Butterfly,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, test: "nav-dashboard" },
  { to: "/calculator", label: "Calculator", icon: Calculator, test: "nav-calculator" },
  { to: "/sweep", label: "Parameter Sweep", icon: GridFour, test: "nav-sweep" },
  { to: "/worldmap", label: "World Map", icon: Globe, test: "nav-worldmap" },
  { to: "/butterfly", label: "Butterfly", icon: Butterfly, test: "nav-butterfly" },
  { to: "/experiments", label: "Experiments", icon: Flask, test: "nav-experiments" },
  { to: "/compare", label: "A/B Compare", icon: ArrowsLeftRight, test: "nav-compare" },
  { to: "/keys", label: "API Keys", icon: Key, test: "nav-keys" },
];

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-[#090A0C] text-white">
      <header className="sticky top-0 z-50 bg-[#090A0C] border-b border-[#2A2D35]" data-testid="app-header">
        <div className="flex items-center justify-between px-6 md:px-8 h-14">
          <Link to="/dashboard" className="flex items-center gap-3 group" data-testid="brand-link">
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center">
              <Planet size={16} weight="fill" className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="mono text-[10px] text-[#565D6D] uppercase tracking-[0.25em]">Platform</div>
              <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 mono text-xs">
              <span className="text-[#565D6D] uppercase tracking-widest">User</span>
              <span className="text-white" data-testid="header-user-email">{user?.email}</span>
              <span className={`px-2 py-0.5 border ${
                user?.role === 'admin' ? 'border-[#FF3333] text-[#FF3333]' :
                user?.role === 'pro' ? 'border-[#00E599] text-[#00E599]' :
                'border-[#0047FF] text-[#0047FF]'
              } uppercase tracking-widest`} data-testid="header-role-badge">
                {user?.role}
              </span>
            </div>
            <button
              onClick={async () => { await signOut(); nav("/"); }}
              className="mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white flex items-center gap-2 transition-colors"
              data-testid="logout-btn"
            >
              <SignOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[220px_1fr] min-h-[calc(100vh-56px)]">
        <aside className="border-r border-[#2A2D35] bg-[#090A0C]" data-testid="sidebar">
          <nav className="flex flex-col py-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.test}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 mono text-xs uppercase tracking-widest transition-colors border-l-2 ${
                    isActive
                      ? "border-[#0047FF] text-white bg-[#121418]"
                      : "border-transparent text-[#8B93A5] hover:text-white hover:bg-[#121418]"
                  }`
                }
              >
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                data-testid="nav-admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 mono text-xs uppercase tracking-widest transition-colors border-l-2 ${
                    isActive
                      ? "border-[#FF3333] text-white bg-[#121418]"
                      : "border-transparent text-[#8B93A5] hover:text-white hover:bg-[#121418]"
                  }`
                }
              >
                <Users size={16} />
                Admin
              </NavLink>
            )}
          </nav>
          <div className="px-6 pt-8 pb-6 border-t border-[#2A2D35] mt-6">
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">Model source</div>
            <div className="mono text-xs text-[#00E599]" data-testid="model-source-label">ibpmodel-2.x</div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mt-6 mb-2">Grid cap</div>
            <div className="mono text-xs text-white">10,000 cells</div>
          </div>
        </aside>
        <main className="p-6 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
