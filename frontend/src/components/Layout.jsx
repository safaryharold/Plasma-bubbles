import React, { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Gauge, Calculator, GridFour, Flask, ArrowsLeftRight,
  Key, Users, SignOut, Planet, Globe, Butterfly, List, X, Sun, Moon,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/dashboard",   label: "Dashboard",       icon: Gauge,           test: "nav-dashboard"  },
  { to: "/calculator",  label: "Calculator",       icon: Calculator,      test: "nav-calculator" },
  { to: "/sweep",       label: "Parameter Sweep",  icon: GridFour,        test: "nav-sweep"      },
  { to: "/worldmap",    label: "World Map",         icon: Globe,           test: "nav-worldmap"   },
  { to: "/butterfly",   label: "Butterfly",         icon: Butterfly,       test: "nav-butterfly"  },
  { to: "/experiments", label: "Experiments",       icon: Flask,           test: "nav-experiments"},
  { to: "/compare",     label: "A/B Compare",       icon: ArrowsLeftRight, test: "nav-compare"   },
  { to: "/keys",        label: "API Keys",          icon: Key,             test: "nav-keys"       },
];

function NavItem({ to, label, icon: Icon, test, onClick }) {
  return (
    <NavLink
      key={to}
      to={to}
      data-testid={test}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-6 py-3 mono text-xs uppercase tracking-widest transition-colors border-l-2 ${
          isActive
            ? "border-[#0047FF] text-white bg-[#121418]"
            : "border-transparent text-[#8B93A5] hover:text-white hover:bg-[#121418]"
        }`
      }
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme, isDark } = useTheme();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#090A0C] text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 bg-[#090A0C] border-b border-[#2A2D35]"
        data-testid="app-header"
        role="banner"
      >
        <div className="flex items-center justify-between px-4 md:px-8 h-14">
          {/* Brand */}
          <Link
            to="/dashboard"
            className="flex items-center gap-3 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
            data-testid="brand-link"
            aria-label="IBP Analytics — go to dashboard"
          >
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center" aria-hidden="true">
              <Planet size={16} weight="fill" className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="mono text-[10px] text-[#565D6D] uppercase tracking-[0.25em]">Platform</div>
              <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
            </div>
          </Link>

          {/* Desktop controls */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 mono text-xs">
              <span className="text-[#565D6D] uppercase tracking-widest">User</span>
              <span className="text-white" data-testid="header-user-email">{user?.email}</span>
              <span
                className={`px-2 py-0.5 border ${
                  user?.role === "admin" ? "border-[#FF3333] text-[#FF3333]" :
                  user?.role === "pro"   ? "border-[#00E599] text-[#00E599]" :
                                           "border-[#0047FF] text-[#0047FF]"
                } uppercase tracking-widest`}
                data-testid="header-role-badge"
                aria-label={`Role: ${user?.role}`}
              >
                {user?.role}
              </span>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={!isDark}
              className="p-2 text-[#8B93A5] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
            >
              {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>

            {/* Logout — desktop */}
            <button
              onClick={async () => { await signOut(); nav("/"); }}
              className="hidden md:flex mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white items-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
              data-testid="logout-btn"
              aria-label="Log out"
            >
              <SignOut size={14} aria-hidden="true" /> Logout
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 text-[#8B93A5] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
              data-testid="mobile-menu-btn"
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down nav ───────────────────────────────────────── */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden bg-[#090A0C] border-b border-[#2A2D35] z-40"
          aria-label="Mobile navigation"
        >
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} onClick={closeMenu} />
          ))}
          {user?.role === "admin" && (
            <NavItem to="/admin" label="Admin" icon={Users} test="nav-admin-mobile" onClick={closeMenu} />
          )}
          <div className="px-6 py-4 border-t border-[#2A2D35]">
            <button
              onClick={async () => { closeMenu(); await signOut(); nav("/"); }}
              className="mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white flex items-center gap-2 transition-colors"
            >
              <SignOut size={14} aria-hidden="true" /> Logout
            </button>
          </div>
        </nav>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-[220px_1fr] min-h-[calc(100vh-56px)]">
        {/* Desktop sidebar */}
        <aside
          className="hidden md:block border-r border-[#2A2D35] bg-[#090A0C]"
          data-testid="sidebar"
          aria-label="Main navigation"
          role="navigation"
        >
          <nav className="flex flex-col py-4" aria-label="Site navigation">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
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
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]`
                }
              >
                <Users size={16} aria-hidden="true" />
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

        <main
          className="p-4 md:p-8 overflow-x-hidden"
          id="main-content"
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
