import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { useFollows } from "./FollowContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar, PageShell } from "./ui";
import { displayName } from "./utils";

// People you follow and people who follow you
export default function Mutuals({ onBack, nav, tab: initial = "mutuals" }) {
  const { t } = useTheme();
  const { users } = usePosts();
  const { mutuals, followers, following, isFollowing, toggleFollow } = useFollows();
  const [tab, setTab] = useState(initial);

  const lists = { mutuals, followers, following };
  const tabs = [["mutuals", "Mutuals"], ["followers", "Followers"], ["following", "Following"]];
  const people = lists[tab].map((id) => users[id]).filter(Boolean);

  return (
    <PageShell title="Mutuals" onBack={onBack}>
      <div className={`flex p-1 rounded-2xl ${t.chip.split(" ")[0]}`}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === k ? t.accent : t.sub}`}>
            {label} ({lists[k].length})
          </button>
        ))}
      </div>
      {people.length === 0 && <p className={`text-center text-sm py-12 ${t.sub}`}>No one here yet</p>}
      {people.map((u) => (
        <div key={u.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${t.card}`}>
          <button onClick={() => nav("user", { userId: u.id })} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <Avatar user={u} size={42} />
            <span className="min-w-0">
              <span className="block font-bold text-sm truncate">{displayName(u)}</span>
              <span className={`block text-xs truncate ${t.sub}`}>@{u.username}</span>
            </span>
          </button>
          <button
            onClick={() => toggleFollow(u.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border ${isFollowing(u.id) ? `${t.chip} ${t.sub} border-transparent` : t.accentSoft}`}
          >
            {isFollowing(u.id) ? <><UserMinus size={12} /> Unfollow</> : <><UserPlus size={12} /> Follow</>}
          </button>
        </div>
      ))}
    </PageShell>
  );
}
