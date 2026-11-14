import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useTheme } from "./theme";
import { mediaSrc } from "./utils";

export function Avatar({ user, size = 40, className = "" }) {
  const { t } = useTheme();
  const style = { width: size, height: size, minWidth: size };
  if (user?.avatar) {
    return <img src={user.avatar} alt="" style={style} className={`rounded-full object-cover ${className}`} />;
  }
  const letter = (user?.surname || user?.other_name || user?.username || "?").charAt(0).toUpperCase();
  return (
    <div style={{ ...style, fontSize: size * 0.4 }} className={`rounded-full flex items-center justify-center font-black ${t.accent} ${className}`}>
      {letter}
    </div>
  );
}

// Bottom sheet that takes 90% of the screen; the rest stays blurred
export function Sheet({ onClose, title, children, full = true, scroll = true }) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <style>{`@keyframes pandoraUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div
        className={`relative w-full max-w-md md:max-w-none md:w-[60vw] ${full ? "h-[90dvh]" : "max-h-[90dvh]"} rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden shadow-2xl ${t.sheet} ${t.text}`}
        style={{ animation: "pandoraUp .25s ease-out" }}
      >
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-400/50" />
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 shrink-0">
          <h3 className="font-black text-base flex-1">{title}</h3>
          <button onClick={onClose} className={`p-1.5 rounded-xl ${t.chip}`}><X size={16} /></button>
        </div>
        {scroll ? <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div> : children}
      </div>
    </div>
  );
}

// Mobile: full page. Desktop: a panel taking 60% of the screen, the rest stays blurred.
export function PageShell({ title, onBack, right, children }) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center">
      <div className="hidden md:block absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onBack} />
      <div className={`relative w-full h-[100dvh] md:h-[90dvh] md:w-[60vw] md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col ${t.page} ${t.text}`}>
        <header className={`shrink-0 flex items-center gap-2 px-3 py-3 border-b ${t.nav} backdrop-blur`}>
          <button onClick={onBack} className={`p-2 rounded-xl ${t.chip}`}><ArrowLeft size={18} /></button>
          <span className="font-black text-lg flex-1">{title}</span>
          {right}
        </header>
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3">{children}</div>
      </div>
    </div>
  );
}

// Text with colored #hashtags
export function RichText({ text, className = "" }) {
  const { t } = useTheme();
  if (!text) return null;
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {text.split(/(#\w+)/g).map((part, i) =>
        part.startsWith("#") ? <span key={i} className={`font-semibold ${t.accentText}`}>{part}</span> : part
      )}
    </p>
  );
}

export { mediaSrc };

// Content becomes visible only when it scrolls into view (fade + slide up)
export function useReveal(onShow) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); onShow?.(); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, shown];
}
export const revealClass = (shown) =>
  `transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-[0.97]"}`;
