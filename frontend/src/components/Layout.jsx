import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Gauge, Calculator, GridFour, Flask, ArrowsLeftRight,
  Key, Users, SignOut, Planet, Globe, Butterfly, Gear, List, X, Sun, MoonStars,
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
  { to: "/settings",    label: "Settings",          icon: Gear,            test: "nav-settings"   },
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
  const { toggle: toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#090A0C] text-white">
      <header className="sticky top-0 z-50 bg-[#090A0C] border-b border-[#2A2D35]" data-testid="app-header" role="banner">
        <div className="flex items-center justify-between px-4 md:px-8 h-14">
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

          <div className="flex items-center gap-3">
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

            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#2A2D35] bg-[#121418] text-[#8B93A5] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0047FF]"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={!isDark}
              data-testid="theme-toggle"
            >
              {isDark ? <Sun size={16} aria-hidden="true" /> : <MoonStars size={16} aria-hidden="true" />}
            </button>

            <button
              ref={menuButtonRef}
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#2A2D35] bg-[#121418] text-[#8B93A5] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0047FF] md:hidden"
              aria-label="Open navigation menu"
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              data-testid="mobile-menu-open"
            >
              <List size={20} aria-hidden="true" />
            </button>

            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className="hidden md:flex mono text-xs uppercase tracking-widest text-[#8B93A5] hover:text-white items-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0047FF]"
              data-testid="logout-btn"
              aria-label="Log out"
            >
              <SignOut size={14} aria-hidden="true" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="grid md:grid-cols-[220px_1fr] min-h-[calc(100vh-56px)]">
        <aside className="hidden md:block border-r border-[#2A2D35] bg-[#090A0C]" data-testid="sidebar" role="navigation" aria-label="Main navigation">
          <nav className="flex flex-col py-4" aria-label="Site navigation">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
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
                <Users size={16} aria-hidden="true" /> Admin
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

        <main className="p-6 md:p-8 overflow-x-hidden" id="main-content" role="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" aria-hidden="true" onClick={() => setMenuOpen(false)} />
      )}
      <aside
        id="mobile-navigation"
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[#090A0C] border-r border-[#2A2D35] shadow-xl transition-transform duration-200 md:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2A2D35]">
          <span className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D]">Menu</span>
          <button
            ref={closeButtonRef}
            onClick={() => setMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#2A2D35] bg-[#121418] text-[#8B93A5] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0047FF]"
            aria-label="Close navigation menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-col py-4" aria-label="Mobile main navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`mobile-${item.test}`}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mono text-xs uppercase tracking-widest transition-colors border-l-2 ${
                  isActive
                    ? "border-[#0047FF] text-white bg-[#121418]"
                    : "border-transparent text-[#8B93A5] hover:text-white hover:bg-[#121418]"
                }`
              }
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              data-testid="mobile-nav-admin"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mono text-xs uppercase tracking-widest transition-colors border-l-2 ${
                  isActive
                    ? "border-[#FF3333] text-white bg-[#121418]"
                    : "border-transparent text-[#8B93A5] hover:text-white hover:bg-[#121418]"
                }`
              }
            >
              <Users size={16} aria-hidden="true" /> Admin
            </NavLink>
          )}
        </nav>

        <div className="px-4 pb-6 pt-4 border-t border-[#2A2D35]">
          <button
            onClick={toggleTheme}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#2A2D35] bg-[#121418] text-[#8B93A5] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0047FF]"
            aria-label="Toggle light or dark theme"
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <MoonStars size={16} aria-hidden="true" />}
            {isDark ? "Switch to light" : "Switch to dark"}
          </button>
        </div>
      </aside>
    </div>
  );
}
