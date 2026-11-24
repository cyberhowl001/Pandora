import { useEffect } from "react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet, Avatar } from "./ui";
import { useLowData } from "./lowData";
import { displayName } from "./utils";

// Settings > Blocked & muted accounts
export function BlockedSheet({ onClose }) {
  const { t } = useTheme();
  const { blocks, loadBlocks, unblockUser } = usePosts();
  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  return (
    <Sheet title="Blocked & muted" onClose={onClose}>
      <p className={`mb-3 text-xs ${t.sub}`}>
        Muted accounts disappear from your feed and comments without being told. Blocked accounts cannot see your profile or posts, follow you, or comment on your posts.
      </p>
      {blocks.length === 0 && <p className={`py-10 text-center text-sm ${t.sub}`}>You have not blocked or muted anyone.</p>}
      <div className="space-y-2">
        {blocks.map((b) => (
          <div key={b.user_id} className={`flex items-center gap-3 rounded-2xl border p-3 ${t.card}`}>
            <Avatar user={b} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{b.username ? displayName(b) : "Account removed"}</p>
              <p className={`truncate text-xs ${t.sub}`}>{b.username ? `@${b.username} · ` : ""}{b.kind === "block" ? "Blocked" : "Muted"}</p>
            </div>
            <button onClick={() => unblockUser(b.user_id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${t.chip}`}>
              {b.kind === "block" ? "Unblock" : "Unmute"}
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

const OPTIONS = [
  ["auto", "Automatic", "On when your phone's Data Saver is on or the connection is slow."],
  ["on", "Always on", "Always save data."],
  ["off", "Off", "Always load everything."],
];

// Settings > Data saver
export function DataSaverSheet({ onClose }) {
  const { t } = useTheme();
  const { mode, setMode, low, autoDetected } = useLowData();
  return (
    <Sheet title="Data saver" onClose={onClose} full={false}>
      <p className={`mb-3 text-xs ${t.sub}`}>
        When on, photos and videos load only when you tap them, videos never play by themselves, and the Media page does not preload videos.
      </p>
      <div className="space-y-2">
        {OPTIONS.map(([k, label, text]) => (
          <button key={k} onClick={() => setMode(k)} className={`w-full rounded-2xl border p-3 text-left ${mode === k ? t.accent : t.card}`}>
            <p className="text-sm font-bold">{label}</p>
            <p className="text-xs opacity-80">{text}</p>
          </button>
        ))}
      </div>
      <p className={`mt-3 text-center text-xs ${t.sub}`}>
        Data saver is currently <b>{low ? "ON" : "OFF"}</b>{autoDetected ? " (detected automatically)" : ""}.
      </p>
    </Sheet>
  );
}
