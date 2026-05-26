/**
 * Dark / light mode theme context.
 *
 * Persists the preference in localStorage. Default is "dark" to match the
 * existing design. When "light" is active, a `data-theme="light"` attribute
 * is set on <html> and Tailwind's `dark:` utilities are inverted via a CSS
 * layer defined in index.css.
 */
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("ibp_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // Add/remove a class for Tailwind dark-mode class strategy
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try { localStorage.setItem("ibp_theme", theme); } catch (_) {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
