import { useEffect } from "react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet, Avatar } from "./ui";
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
