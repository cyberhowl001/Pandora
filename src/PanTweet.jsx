import { useState } from "react";
import {
  Plus, Home, Search, Box, Bell, MessageCircle, Rss, User, Users, Bookmark, Globe,
  Briefcase, Palette, Settings, HelpCircle, Moon,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useNotifications } from "./NotificationsContext";
import { useTheme } from "./theme";
import { Avatar, Sheet } from "./ui";
import Feed from "./Feed";
import CreatePost from "./CreatePost";
import Drawer from "./Drawer";
import SearchTab from "./SearchTab";
import { SettingsSheet } from "./Settings";
import { RulesSheet, ThemeSheet } from "./info";
import { useIsDesktop } from "./utils";

const ICON = "text-violet-500"; // icons stay purple in every theme
const PURPLE_BTN = "bg-gradient-to-br from-violet-600 to-blue-600 text-white";

// red bubble with the number of unread notifications
const Badge = ({ n }) =>
  n > 0 && (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
      {n > 99 ? "99+" : n}
    </span>
  );

export default function PanTweet({ nav }) {
  const { currentUser } = useAuth();
  const { t, darkOn, toggleDark } = useTheme();
  const { error } = usePosts();
  const { count } = useNotifications();
  const desktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState("home"); // mobile: home | search
  const [sheet, setSheet] = useState(null); // create | settings | rules | theme | search (desktop)
  const open = menuOpen && !desktop;

  const onSearch = () => (desktop ? setSheet("search") : setTab("search"));
  const onAvatar = () => (desktop ? nav("profile") : setMenuOpen(true));

  // Desktop right-hand rail: [icon, label, action, active]. No action = display only.
  const groups = [
    [[Home, "Home", () => setTab("home"), tab === "home"], [Search, "Search", onSearch, sheet === "search"], [Plus, "New post", () => setSheet("create")]],
    [[Box, "Box", () => nav("vibes")], [Bell, "Notifications", () => nav("notifications")], [MessageCircle, "Chat"]],
    [[User, "Profile", () => nav("profile")], [Users, "Mutuals", () => nav("mutuals", { tab: "mutuals" })], [Bookmark, "Saved Bookmarks", () => nav("bookmarks")]],
    [[Globe, "Language"], [Users, "Communities"], [Briefcase, "Business"]],
    [[Palette, "Theme", () => setSheet("theme")], [Settings, "Settings", () => setSheet("settings")], [HelpCircle, "Rules & version", () => setSheet("rules")], [Moon, "Dark mode", toggleDark, darkOn]],
  ];

  const navIcon = (active) => `p-2 rounded-2xl ${ICON} ${active ? "bg-violet-500/20" : ""}`;

  return (
    <div className={`w-full h-[100dvh] ${t.menuBg} overflow-hidden`}>
      <div className="relative w-full h-full overflow-hidden">
        <style>{`.pandora-hide-scroll::-webkit-scrollbar{display:none}`}</style>
        {/* mobile menu (profile details) behind the PanTweet page */}
        <Drawer
          close={() => setMenuOpen(false)}
          nav={nav}
          onSettings={() => setSheet("settings")}
          onRules={() => setSheet("rules")}
          onTheme={() => setSheet("theme")}
        />
        {/* decorative layered card, like the design */}
        {open && (
          <div
            className="absolute inset-0 bg-white/25 transition-all duration-300"
            style={{ transformOrigin: "left center", transform: "translateX(70%) scale(0.82)", borderRadius: 36 }}
          />
        )}

        {/* PanTweet page */}
        <div
          className={`absolute inset-0 overflow-hidden transition-all duration-300 ${t.page} ${t.text}`}
          style={{
            transformOrigin: "left center",
            transform: open ? "translateX(77%) scale(0.88)" : "none",
            borderRadius: open ? 36 : 0,
            boxShadow: open ? "-12px 0 40px rgba(0,0,0,.35)" : "none",
          }}
        >
          {open && <div className="absolute inset-0 z-50 cursor-pointer" onClick={() => setMenuOpen(false)} />}

          {/* soft color so the glass has something to blur */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-fuchsia-400/20 blur-3xl" />

          {/* scrolling content runs underneath the glass header / navigation */}
          <main style={{ scrollbarWidth: "none" }} className="pandora-hide-scroll absolute inset-0 z-10 overflow-y-auto overflow-x-hidden pt-[68px] pb-28 md:pb-8 md:pr-[20%]">
            <div className="mx-auto w-full max-w-xl">
              {tab === "home" || desktop ? (
                <Feed error={error} />
              ) : (
                <SearchTab nav={nav} />
              )}
            </div>
          </main>

          {/* glass header */}
          <header className={`absolute top-0 inset-x-0 md:right-[20%] z-20 flex items-center gap-3 px-4 py-3 border-b backdrop-blur-xl ${t.glass}`}>
            <button onClick={onAvatar} title="Profile"><Avatar user={currentUser} size={36} /></button>
            <Rss size={18} className={ICON} />
            <span className="font-black text-lg flex-1">{tab === "search" && !desktop ? "Search" : "Stream"}</span>
            <button onClick={() => setSheet("create")} className={`md:hidden p-2 rounded-xl ${PURPLE_BTN}`}><Plus size={18} /></button>
          </header>

          {/* mobile glass navigation */}
          <nav className={`md:hidden absolute bottom-0 w-full z-20 h-14 backdrop-blur-xl flex items-center justify-around ${t.glass}`}>
            <button onClick={() => setTab("home")} className={navIcon(tab === "home")}><Home size={24} /></button>
            <button onClick={() => setTab("search")} className={navIcon(tab === "search")}><Search size={24} /></button>
            {/* middle button: opens PanVibes (short videos) */}
            <button onClick={() => nav("vibes")} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${PURPLE_BTN}`}><Box size={26} /></button>
            <button onClick={() => nav("notifications")} className={`relative ${navIcon(false)}`}>
              <Bell size={24} />
              <Badge n={count} />
            </button>
            <button className={navIcon(false)}><MessageCircle size={24} /></button>
          </nav>

          {/* desktop: right 20%, glass, buttons in a centered flex column */}
          <aside className={`hidden md:flex absolute right-0 top-0 bottom-0 w-[20%] z-20 border-l backdrop-blur-xl overflow-y-auto ${t.glass}`}>
            <div className="flex flex-col items-center gap-5 my-auto w-full px-3 py-6">
              {groups.map((g, gi) => (
                <div key={gi} className="flex flex-col items-center gap-2 w-full">
                  {g.map(([Icon, label, action, active]) => (
                    <button
                      key={label}
                      onClick={action}
                      className={`w-full max-w-[210px] flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-md transition-all ${t.glass} ${action ? "hover:bg-violet-500/20" : "cursor-default"} ${active ? "ring-2 ring-violet-500/60" : ""}`}
                    >
                      <span className="relative">
                        <Icon size={20} className={ICON} fill={label === "Dark mode" && darkOn ? "currentColor" : "none"} />
                        {label === "Notifications" && <Badge n={count} />}
                      </span>
                      <span className="text-sm font-bold truncate">{label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {sheet === "create" && <CreatePost onClose={() => setSheet(null)} />}
      {sheet === "search" && (
        <Sheet title="Search" onClose={() => setSheet(null)}>
          <SearchTab nav={(p, params) => { setSheet(null); nav(p, params); }} />
        </Sheet>
      )}
      {sheet === "settings" && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === "rules" && <RulesSheet onClose={() => setSheet(null)} />}
      {sheet === "theme" && <ThemeSheet onClose={() => setSheet(null)} />}
    </div>
  );
}