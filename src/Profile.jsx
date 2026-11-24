import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useFollows } from "./FollowContext";
import { useNotifications } from "./NotificationsContext";
import { useTheme } from "./theme";
import { Avatar, PageShell } from "./ui";
import { PostList } from "./PostCard";
import { StatsPanel } from "./UserStats";
import { BioBox } from "./Bio";
import { useUserPosts } from "./useUserPosts";
import { uploadAvatar } from "./storage";
import { compressImage, mediaSrc } from "./utils";

export default function Profile({ onBack, nav }) {
  const { t } = useTheme();
  const { currentUser, updateCurrentUser } = useAuth();
  const { notify } = useNotifications();
  const { mutuals, followers, following } = useFollows();
  const [tab, setTab] = useState("details"); // details | posts
  const [surname, setSurname] = useState(currentUser.surname || "");
  const [otherName, setOtherName] = useState(currentUser.other_name || "");
  const [avatar, setAvatar] = useState(currentUser.avatar || null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const { list: mine, hasMore, loadMore, loading: loadingPosts } = useUserPosts(currentUser.id);
  const changed =
    surname.trim() !== (currentUser.surname || "") ||
    otherName.trim() !== (currentUser.other_name || "") ||
    avatar !== (currentUser.avatar || null);

  const pickAvatar = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Please choose an image.");
    try {
      const m = await compressImage(f, 400, 0.85);
      setAvatar(mediaSrc(m));
    } catch { alert("Could not read that image."); }
  };

  const save = async () => {
    if (!surname.trim() && !otherName.trim()) return setMsg("Please enter a name.");
    setSaving(true);
    setMsg("");
    // a new photo is uploaded to Supabase Storage; the profile only keeps its URL
    let avatarUrl = avatar;
    try { avatarUrl = await uploadAvatar(avatar, currentUser.id); }
    catch (e) { console.error(e); setSaving(false); return setMsg("Could not upload the photo."); }
    const patch = { surname: surname.trim(), other_name: otherName.trim(), avatar: avatarUrl };
    const { error } = await supabase.from("users").update(patch).eq("id", currentUser.id);
    setSaving(false);
    if (error) { console.error(error); return setMsg("Could not save. Check your connection."); }
    updateCurrentUser(patch);
    setAvatar(patch.avatar);
    notify(currentUser.id, "profile");
    setMsg("Saved ✓");
  };

  const stat = (label, n, tabKey) => (
    <button onClick={() => nav("mutuals", { tab: tabKey })} className="text-center">
      <p className="font-black">{n}</p><p className={`text-xs ${t.sub}`}>{label}</p>
    </button>
  );

  return (
    <PageShell title="Profile" onBack={onBack}>
      <div className="flex flex-col items-center pt-2">
        <div className="relative">
          <Avatar user={{ ...currentUser, avatar }} size={96} />
          <button onClick={() => fileRef.current?.click()} className={`absolute bottom-0 right-0 p-2 rounded-full shadow ${t.accent}`}><Camera size={14} /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
        </div>
        <p className="font-black text-lg mt-2">{`${surname} ${otherName}`.trim() || currentUser.username}</p>
        <p className={`text-sm ${t.sub}`}>@{currentUser.username}</p>
        <BioBox />
        <div className="flex gap-8 mt-3">
          {stat("Mutuals", mutuals.length, "mutuals")}
          {stat("Followers", followers.length, "followers")}
          {stat("Following", following.length, "following")}
        </div>
      </div>

      {/* joined date + lifetime likes / comments / reshares / interactions (kept after posts expire) */}
      <StatsPanel userId={currentUser.id} />

      <div className={`flex p-1 rounded-2xl ${t.chip.split(" ")[0]}`}>
        {[["details", "User details"], ["posts", `PanTweets (${mine.length}${hasMore ? "+" : ""})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${tab === k ? t.accent : t.sub}`}>{label}</button>
        ))}
      </div>

      {tab === "details" ? (
        <div className={`rounded-2xl border p-4 space-y-3 ${t.card}`}>
          <label className="block">
            <span className={`text-xs font-bold ${t.sub}`}>Surname</span>
            <input value={surname} onChange={(e) => setSurname(e.target.value)} className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
          </label>
          <label className="block">
            <span className={`text-xs font-bold ${t.sub}`}>Other names</span>
            <input value={otherName} onChange={(e) => setOtherName(e.target.value)} className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
          </label>
          <label className="block">
            <span className={`text-xs font-bold ${t.sub}`}>Username (cannot be changed)</span>
            <input value={`@${currentUser.username}`} disabled className={`mt-1 w-full border rounded-xl px-3 py-2.5 text-sm opacity-60 ${t.input}`} />
          </label>
          <button onClick={save} disabled={!changed || saving} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${t.accent}`}>
            {saving ? "Saving…" : <><Check size={16} /> Save changes</>}
          </button>
          {msg && <p className={`text-xs text-center ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</p>}
        </div>
      ) : (
        <>
          <PostList posts={mine} empty={loadingPosts ? "Loading…" : "You have no active PanTweets"} />
          {hasMore && (
            <button onClick={loadMore} className={`w-full py-2.5 rounded-xl text-sm font-bold ${t.chip}`}>Load more</button>
          )}
        </>
      )}
    </PageShell>
  );
}
