import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import SignIn from "./SignIn";
import Dashboard from "./Dashboard";
import GroupChat from "./GroupChat";
import DirectChat from "./DirectChat";
import PanTweet from "./PanTweet";
import AdminDashboard from "./AdminDashboard"
import { supabase } from "../supabaseClient";

// ── Page names ──
const PAGES = {
  SIGNIN:       "signin",
  DASHBOARD:    "dashboard",
  GROUP_CHAT:   "group_chat",
  CREATE_GROUP: "create_group",
  DIRECT_CHAT:  "direct_chat",
  PANTWEET:     "pantweet",
  ADMIN:        "admin",
};

function AppInner() {
  const { currentUser, loading } = useAuth();
  const [page, setPage] = useState(PAGES.SIGNIN);
  const [directTarget, setDirectTarget] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [newPantweetCount, setNewPantweetCount] = useState(0);
  const [lastVisitedPantweet, setLastVisitedPantweet] = useState(Date.now());

  // Route on auth state change
  useEffect(() => {
    if (!loading) {
      setPage(currentUser ? PAGES.DASHBOARD : PAGES.SIGNIN);
    }
  }, [currentUser, loading]);

  // Track new pantweet posts
  useEffect(() => {
    const channel = supabase
      .channel("pantweet-new-count")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pantweets" }, () => {
        if (page !== PAGES.PANTWEET) {
          setNewPantweetCount((p) => p + 1);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [page]);

  const goToPantweet = () => {
    setNewPantweetCount(0);
    setLastVisitedPantweet(Date.now());
    setPage(PAGES.PANTWEET);
  };

  const goToDirect = (user) => {
    setDirectTarget(user);
    setPage(PAGES.DIRECT_CHAT);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="panda.png" alt="" className="w-12 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!currentUser) {
    if (page === PAGES.ADMIN) return <AdminDashboard onBack={() => setPage(PAGES.SIGNIN)} />;
    return <SignIn onSuccess={() => setPage(PAGES.DASHBOARD)} onGoToAdmin={() => setPage(PAGES.ADMIN)} />;
  }

  const commonProps = {
    isDarkMode,
    setIsDarkMode,
    newPantweetCount,
    onGoToPantweet: goToPantweet,
  };

  switch (page) {
    case PAGES.DASHBOARD:
      return (
        <Dashboard
          {...commonProps}
          onGoToGroupChat={() => setPage(PAGES.GROUP_CHAT)}
          onGoToDirect={goToDirect}
          onCreateGroup={() => setPage(PAGES.CREATE_GROUP)}
        />
      );

    case PAGES.GROUP_CHAT:
    case PAGES.CREATE_GROUP:
      return (
        <GroupChat
          {...commonProps}
          startOnCreate={page === PAGES.CREATE_GROUP}
          onBack={() => setPage(PAGES.DASHBOARD)}
        />
      );

    case PAGES.DIRECT_CHAT:
      return (
        <DirectChat
          {...commonProps}
          targetUser={directTarget}
          onClose={() => setPage(PAGES.DASHBOARD)}
        />
      );

    case PAGES.PANTWEET:
      return (
        <PanTweet
          {...commonProps}
          onBack={() => setPage(PAGES.DASHBOARD)}
        />
      );

    default:
      return (
        <Dashboard
          {...commonProps}
          onGoToGroupChat={() => setPage(PAGES.GROUP_CHAT)}
          onGoToDirect={goToDirect}
          onCreateGroup={() => setPage(PAGES.CREATE_GROUP)}
        />
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}