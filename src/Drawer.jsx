import { User, Users, Bookmark, Globe, Briefcase, MessageCircle, Palette, Settings, HelpCircle, Moon, MoreVertical } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useFollows } from "./FollowContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { displayName } from "./utils";

// The menu behind the feed (opens when the user taps their profile picture)
export default function Drawer({ close, nav, onSettings, onRules, onTheme }) {
  const { currentUser } = useAuth();
  const { mutuals, followers, following } = useFollows();
  const { toggleDark, darkOn } = useTheme();
  const go = (page, params) => { close(); nav(page, params); };

  // items without an action are display only
  const items = [
    [User, "Profile", () => go("profile")],
    [Users, "Mutuals", () => go("mutuals", { tab: "mutuals" })],
    [Bookmark, "Saved Bookmarks", () => go("bookmarks")],
    [Globe, "Language"],
    [Users, "Communities"],
    [Briefcase, "Business"],
    [MessageCircle, "Chat"],
    [Palette, "Theme", onTheme],
  ];

  return (
    <div className="md:hidden absolute inset-0 text-white flex flex-col pl-5 pr-4 pt-10 pb-6" style={{ width: "66%" }}>
      <div className="flex items-start gap-3">
        <button onClick={() => go("profile")}><Avatar user={currentUser} size={56} className="border-2 border-white/40" /></button>
        <button onClick={() => go("profile")} className="flex-1 text-left min-w-0">
          <p className="font-black text-lg truncate">{displayName(currentUser)}</p>
          <p className="text-sm opacity-80 truncate">@{currentUser.username}</p>
        </button>
        <button className="p-1"><MoreVertical size={20} /></button>
      </div>

      <div className="flex gap-4 mt-4 text-center text-sm">
        {[["Mutuals", mutuals.length, "mutuals"], ["Followers", followers.length, "followers"], ["Following", following.length, "following"]].map(([label, n, tab]) => (
          <button key={label} onClick={() => go("mutuals", { tab })}>
            <p className="font-black text-base">{n}</p>
            <p className="text-xs font-semibold opacity-90">{label}</p>
          </button>
        ))}
      </div>

      <div className="mt-7 rounded-4xl bg-white/20 backdrop-blur-md border border-white/20 p-5 space-y-6 overflow-hidden">
        {items.map(([Icon, label, action]) => {
          const inner = (<><Icon size={20} /><span className="font-bold text-[17px]">{label}</span></>);
          return action
            ? <button key={label} onClick={action} className="flex items-center gap-4 w-full">{inner}</button>
            : <div key={label} className="flex items-center gap-4">{inner}</div>;
        })}
      </div>

      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <button onClick={onSettings} title="Settings"><Settings size={30} /></button>
        <button onClick={onRules} title="Rules & version"><HelpCircle size={30} /></button>
        <div className="flex-1" />
        <button onClick={toggleDark} title="Dark mode"><Moon size={30} fill={darkOn ? "currentColor" : "none"} /></button>
      </div>
    </div>
  );
}
