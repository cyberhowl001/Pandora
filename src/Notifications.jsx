import { useEffect } from "react";
import { Heart, MessageCircle, Repeat, Bookmark, UserPlus, UserMinus, User, Trash2, Bell, X } from "lucide-react";
import { useNotifications } from "./NotificationsContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { PageShell } from "./ui";
import { timeAgo, same } from "./utils";

const META = {
  like:         [Heart,         (n) => `${n.actor_name} liked your post`],
  comment:      [MessageCircle, (n) => `${n.actor_name} commented on your post`],
  share:        [Repeat,        (n) => `${n.actor_name} shared your post`],
  save:         [Bookmark,      (n) => `${n.actor_name} saved your post`],
  follow:       [UserPlus,      (n) => `${n.actor_name} started following you`],
  unfollow:     [UserMinus,     (n) => `${n.actor_name} unfollowed you`],
  profile:      [User,          () => "Your profile was updated"],
  post_deleted: [Trash2,        () => "Your post was deleted"],
};

export default function Notifications({ onBack, nav }) {
  const { t } = useTheme();
  const { saved, setViewing, removeOne, clearAll } = useNotifications();
  const { posts, openPost, now } = usePosts();

  // opening this page = viewing: unread ones move to the device and leave the database
  useEffect(() => {
    setViewing(true);
    return () => setViewing(false);
  }, [setViewing]);

  const open = (n) => {
    if (n.type === "follow" || n.type === "unfollow") return nav("user", { userId: n.actor_id });
    if (n.post_id && n.type !== "post_deleted") {
      const p = posts.find((x) => same(x.id, n.post_id));
      if (p) openPost(p);
    }
  };

  return (
    <PageShell title="Notifications" onBack={onBack}>
      {saved.length > 0 && (
        <button
          onClick={() => { if (window.confirm("Delete all notifications?")) clearAll(); }}
          className="text-xs font-bold text-red-400 ml-auto block"
        >
          Delete all
        </button>
      )}

      {saved.length === 0 && (
        <div className={`flex flex-col items-center gap-2 py-16 ${t.sub}`}>
          <Bell size={32} />
          <p className="text-sm">No notifications</p>
        </div>
      )}

      {saved.map((n) => {
        const [Icon, text] = META[n.type] || [Bell, () => "New notification"];
        return (
          <div
            key={n.id}
            onClick={() => open(n)}
            className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer ${t.card}`}
          >
            <span className="p-2 rounded-xl bg-violet-500/20 text-violet-500"><Icon size={18} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{text(n)}</p>
              {n.preview && <p className={`text-xs truncate ${t.sub}`}>“{n.preview}”</p>}
              <p className={`text-[11px] mt-0.5 ${t.sub}`}>{timeAgo(n.created_at, now)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeOne(n.id); }} className={`p-1 ${t.sub}`}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </PageShell>
  );
}