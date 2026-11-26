import { createContext, useContext, useEffect, useState } from "react";

const KEY = "amihem_crm_theme";
const SOFT_KEY = "amihem_crm_soft_ui"; // soft (neumorphic) look — on by default, "off" restores the classic look
const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage unavailable — fall through to system preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialSoft() {
  try {
    return localStorage.getItem(SOFT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [soft, setSoft] = useState(getInitialSoft);

  useEffect(() => {
    document.documentElement.classList.toggle("neo", soft);
    try {
      localStorage.setItem(SOFT_KEY, soft ? "on" : "off");
    } catch {
      /* best-effort persistence only */
    }
  }, [soft]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* best-effort persistence only */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const toggleSoft = () => setSoft((v) => !v);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, soft, toggleSoft }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
