import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { ThemeProvider } from "./theme";
import { FollowProvider } from "./FollowContext";
import { PostsProvider } from "./PostsContext";
import { NotificationsProvider } from "./NotificationsContext";
import SignIn from "./SignIn";
import AdminDashboard from "./AdminDashboard";
import PanTweet from "./PanTweet";
import Profile from "./Profile";
import Mutuals from "./Mutuals";
import Bookmarks from "./Bookmarks";
import Notifications from "./Notifications";
import UserView from "./UserView";
import MediaPage from "./MediaPage";
import PanVibes from "./PanVibes";
import InstallBanner from "./InstallBanner";
import UpdateBanner from "./UpdateBanner";
import { isStandalone } from "./installPrompt";
import { PostOverlays } from "./PostOverlays";

function AppInner() {
  const { currentUser, loading } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  // simple page stack: [{page:'home'}, {page:'profile'}, {page:'user', userId}, ...]
  const [stack, setStack] = useState([{ page: "home" }]);
  const top = stack[stack.length - 1];

  useEffect(() => { setStack([{ page: "home" }]); }, [currentUser?.id]);

  // installed app: always show the logo for a moment while it opens (the browser shows it while loading)
  const [splash, setSplash] = useState(() => isStandalone());
  useEffect(() => {
    if (!splash) return;
    const id = setTimeout(() => setSplash(false), 900);
    return () => clearTimeout(id);
  }, [splash]);

  const nav = (page, params = {}) =>
    setStack((s) => (page === "home" ? [{ page: "home" }] : [...s, { page, ...params }]));
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  if (loading || splash) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/panda.png" alt="" className="w-12 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (showAdmin) return <AdminDashboard onBack={() => setShowAdmin(false)} />;
    return <SignIn onGoToAdmin={() => setShowAdmin(true)} />;
  }

  return (
    <NotificationsProvider>
      <FollowProvider>
        <PostsProvider>
          {/* the feed stays mounted: on desktop it shows blurred behind the 60% panels */}
          <PanTweet nav={nav} />
          {top.page === "profile" && <Profile onBack={back} nav={nav} />}
          {top.page === "mutuals" && <Mutuals key={top.tab} tab={top.tab} onBack={back} nav={nav} />}
          {top.page === "bookmarks" && <Bookmarks onBack={back} />}
          {top.page === "notifications" && <Notifications onBack={back} nav={nav} />}
          {top.page === "user" && <UserView key={top.userId} userId={top.userId} onBack={back} />}
          {top.page === "media" && <MediaPage onBack={back} />}
          {top.page === "vibes" && <PanVibes onBack={back} nav={nav} />}
          <PostOverlays nav={nav} />
        </PostsProvider>
      </FollowProvider>
    </NotificationsProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
        <InstallBanner />
        <UpdateBanner />
      </AuthProvider>
    </ThemeProvider>
  );
}