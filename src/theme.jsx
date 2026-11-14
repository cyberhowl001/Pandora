import { createContext, useContext, useState, useEffect } from "react";

// Three themes: light = your existing yellow & white, dark = your existing dark, purple = new purple & blue
export const THEMES = {
  light: {
    label: "Yellow & White", dark: false,
    page: "bg-[#f5f0ea]", card: "bg-white border-gray-200", sheet: "bg-[#fbf8f3]",
    text: "text-gray-900", sub: "text-gray-500", line: "border-gray-100",
    input: "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400",
    chip: "bg-gray-100 hover:bg-gray-200",
    accent: "bg-amber-400 hover:bg-amber-500 text-black",
    accentText: "text-amber-500",
    accentSoft: "bg-amber-400/10 border-amber-400/30 text-amber-500",
    nav: "bg-white/90 border-gray-200",
    glass: "bg-white/30 border-white/60 shadow-[0_8px_32px_rgba(31,38,135,0.15)]",
    menuBg: "bg-gradient-to-b from-amber-400 via-orange-400 to-orange-500",
    swatch: "linear-gradient(135deg,#fbbf24 50%,#ffffff 50%)",
  },
  dark: {
    label: "Dark", dark: true,
    page: "bg-[#0d0d0d]", card: "bg-[#1a1a1a] border-white/5", sheet: "bg-[#141414]",
    text: "text-white", sub: "text-gray-400", line: "border-white/5",
    input: "bg-white/5 border-white/10 text-white placeholder-gray-600",
    chip: "bg-white/5 hover:bg-white/10",
    accent: "bg-amber-400 hover:bg-amber-500 text-black",
    accentText: "text-amber-400",
    accentSoft: "bg-amber-400/10 border-amber-400/30 text-amber-400",
    nav: "bg-[#0d0d0d]/90 border-white/5",
    glass: "bg-white/10 border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
    menuBg: "bg-gradient-to-b from-[#232323] via-[#111] to-black",
    swatch: "linear-gradient(135deg,#0d0d0d 50%,#fbbf24 50%)",
  },
  purple: {
    label: "Purple & Blue", dark: false,
    page: "bg-[#f6f3ff]", card: "bg-white border-violet-100", sheet: "bg-[#fbfaff]",
    text: "text-slate-900", sub: "text-slate-500", line: "border-violet-100",
    input: "bg-violet-50/60 border-violet-100 text-slate-900 placeholder-slate-400",
    chip: "bg-violet-100/70 hover:bg-violet-100",
    accent: "bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-90 text-white",
    accentText: "text-violet-600",
    accentSoft: "bg-violet-500/10 border-violet-500/30 text-violet-600",
    nav: "bg-white/90 border-violet-100",
    glass: "bg-violet-500/10 border-white/60 shadow-[0_8px_32px_rgba(91,33,182,0.2)]",
    menuBg: "bg-gradient-to-b from-[#4f2bf5] via-[#9333ea] to-[#e02ee8]",
    swatch: "linear-gradient(135deg,#7c3aed 50%,#2563eb 50%)",
  },
};

const ThemeContext = createContext(null);

// Theme one = yellow & white, theme two = purple & blue. The moon only switches dark mode on/off.
export function ThemeProvider({ children }) {
  const [base, setBase] = useState(() => {
    try { return localStorage.getItem("pandora_theme_base") === "purple" ? "purple" : "light"; } catch { return "light"; }
  });
  const [darkOn, setDarkOn] = useState(() => {
    try { return localStorage.getItem("pandora_dark") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem("pandora_theme_base", base);
      localStorage.setItem("pandora_dark", darkOn ? "1" : "0");
    } catch { /* ignore */ }
  }, [base, darkOn]);

  const key = darkOn ? "dark" : base;
  const toggleDark = () => setDarkOn((d) => !d);
  const chooseTheme = (k) => { setBase(k); setDarkOn(false); };
  return (
    <ThemeContext.Provider value={{ key, t: THEMES[key], base, darkOn, toggleDark, chooseTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
