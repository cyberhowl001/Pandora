import { useState, useEffect, useRef } from "react";
import "./style.css"
import { supabase } from "../supabaseClient";
import UsersContainer from "./Users";
import { Send, Mic, Square, FileUp, Play, Pause, Download, X, File, Trash2, Trash, Search, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import SearchUsers from "./SearchUser";

// rate limit config
const RATE_LIMIT_CONFIG = {
  MESSAGE_SEND: { maxRequests: 5, timeWindow: 10000 },
  VOICE_SEND: { maxRequests: 5, timeWindow: 10000 },
  FILE_SEND: { maxRequests: 5, timeWindow: 10000 },
  PRESENCE_UPDATE: { maxRequests: 1, timeWindow: 5000 },
};

class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.timeWindow);
    if (this.requests.length < this.maxRequests) { this.requests.push(now); return true; }
    return false;
  }
  getTimeUntileReset() {
    if (this.requests.length === 0) return 0;
    const oldest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (Date.now() - oldest));
  }
}

class RetryManager {
  static async retryWithExponentialBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try { return await fn(); } catch (error) {
        lastError = error;
        if (error.status !== 429 && !error.status?.toString().startsWith("5")) throw error;
        if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, initialDelay * Math.pow(2, i)));
      }
    }
    throw lastError;
  }
}

// ==================== AUTH TABS ====================
// "tab" can be: "google" | "email" | "magic"
function LoginScreen({ onGoogleSignIn }) {
  const [tab, setTab] = useState("google");
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success"|"error", text }

  const resetForm = () => {
    setEmail(""); setPassword(""); setConfirmPassword("");
    setMessage(null); setShowPassword(false);
  };

  const handleTabChange = (t) => { setTab(t); resetForm(); setMode("signin"); };
  const handleModeChange = (m) => { setMode(m); resetForm(); };

  // --- Email/Password Auth ---
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) return setMessage({ type: "error", text: "Please enter your email." });

    if (mode === "signup") {
      if (password.length < 6) return setMessage({ type: "error", text: "Password must be at least 6 characters." });
      if (password !== confirmPassword) return setMessage({ type: "error", text: "Passwords do not match." });
      setLoading(true);
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) return setMessage({ type: "error", text: error.message });
      setMessage({ type: "success", text: "Account created! Check your email to confirm, then sign in." });
      setMode("signin"); setPassword(""); setConfirmPassword("");
    } else {
      if (!password) return setMessage({ type: "error", text: "Please enter your password." });
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setMessage({ type: "error", text: error.message });
    }
  };

  // --- Magic Link Auth ---
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!email.trim()) return setMessage({ type: "error", text: "Please enter your email." });
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return setMessage({ type: "error", text: error.message });
    setMessage({ type: "success", text: `Magic link sent to ${email}! Check your inbox and click the link to sign in.` });
    setEmail("");
  };

  const tabStyle = (t) => ({
    padding: "8px 18px",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
    transition: "all 0.2s",
    background: tab === t ? "#f59e0b" : "transparent",
    color: tab === t ? "#1a1a1a" : "#888",
  });

  return (
    <div className="hash w-full flex justify-center items-center max-sm:flex-col">
      {/* advertisement */}
      <div className="w-[50%] max-sm:w-full h-screen white justify-center items-center flex">
        <div className="w-[95%] h-[97%] hash">
          <div className="w-full h-[50%] flex justify-center items-center">
            <div className="w-[50%] h-full flex justify-end items-center">
              <img className="w-[90%] max-sm:h-[70%]" src="chi2.png" alt="" />
            </div>
            <div className="w-[50%] h-full flex justify-start items-center">
              <img className="w-[90%] max-sm:h-[70%]" src="chi3.png" alt="" />
            </div>
          </div>
          <div className="w-full h-[50%] flex justify-center items-center">
            <div className="w-[50%] h-full flex justify-end items-center">
              <img className="w-[70%] max-sm:h-[71%] rounded-l-[50px]" src="chi5.jpg" alt="" />
            </div>
            <div className="w-[50%] h-full flex justify-start items-center">
              <img className="w-[70%] h-[65%] max-sm:h-[71%] rounded-r-[50px]" src="chi4.jpg" alt="" />
            </div>
          </div>
        </div>
      </div>

      {/* login panel */}
      <div className="w-[50%] max-sm:w-full h-screen flex flex-col justify-center items-center gap-4 px-6">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-2">
          <img className="w-8" src="panda.png" alt="Pandora" />
          <span style={{ fontWeight: 800, fontSize: "20px", color: "#f59e0b", letterSpacing: "-0.5px" }}>Pandora</span>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: "6px", background: "rgba(0,0,0,0.06)",
          borderRadius: "24px", padding: "4px", marginBottom: "4px",
        }}>
          <button style={tabStyle("google")} onClick={() => handleTabChange("google")}>Google</button>
          <button style={tabStyle("email")} onClick={() => handleTabChange("email")}>Email</button>
          <button style={tabStyle("magic")} onClick={() => handleTabChange("magic")}>Magic Link</button>
        </div>

        {/* ---- GOOGLE TAB ---- */}
        {tab === "google" && (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={onGoogleSignIn}
              className="w-full h-11 cursor-pointer text-white font-bold rounded-3xl shadow-lg hash button flex items-center justify-center gap-2"
              style={{ fontSize: "14px" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </div>
        )}

        {/* ---- EMAIL TAB ---- */}
        {tab === "email" && (
          <div style={{ width: "100%", maxWidth: "320px" }}>
            {/* Sign in / Sign up toggle */}
            <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #f59e0b" }}>
              <button
                onClick={() => handleModeChange("signin")}
                style={{ flex: 1, padding: "8px", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", background: mode === "signin" ? "#f59e0b" : "transparent", color: mode === "signin" ? "#1a1a1a" : "#888", transition: "all 0.2s" }}
              >Sign In</button>
              <button
                onClick={() => handleModeChange("signup")}
                style={{ flex: 1, padding: "8px", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", background: mode === "signup" ? "#f59e0b" : "transparent", color: mode === "signup" ? "#1a1a1a" : "#888", transition: "all 0.2s" }}
              >Sign Up</button>
            </div>

            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Email */}
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address" required
                  style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "12px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.85)" }}
                />
              </div>

              {/* Password */}
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" required
                  style={{ width: "100%", padding: "10px 36px 10px 36px", borderRadius: "12px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.85)" }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0 }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Confirm Password (signup only) */}
              {mode === "signup" && (
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
                  <input
                    type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password" required
                    style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "12px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.85)" }}
                  />
                </div>
              )}

              {/* Feedback message */}
              {message && (
                <div style={{ padding: "8px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, background: message.type === "error" ? "#fee2e2" : "#d1fae5", color: message.type === "error" ? "#b91c1c" : "#065f46" }}>
                  {message.text}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ padding: "10px", borderRadius: "12px", background: "#f59e0b", border: "none", color: "#1a1a1a", fontWeight: 800, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
              </button>
            </form>

            {mode === "signin" && (
              <p style={{ textAlign: "center", fontSize: "12px", marginTop: "10px", color: "#888" }}>
                No account?{" "}
                <button onClick={() => handleModeChange("signup")} style={{ background: "none", border: "none", color: "#f59e0b", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                  Sign up free
                </button>
              </p>
            )}
          </div>
        )}

        {/* ---- MAGIC LINK TAB ---- */}
        {tab === "magic" && (
          <div style={{ width: "100%", maxWidth: "320px" }}>
            <p style={{ fontSize: "13px", color: "#888", textAlign: "center", marginBottom: "12px", lineHeight: "1.5" }}>
              Enter your email and we'll send you a secure sign-in link — no password needed.
            </p>
            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address" required
                  style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "12px", border: "1.5px solid #e5e7eb", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.85)" }}
                />
              </div>

              {message && (
                <div style={{ padding: "8px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, background: message.type === "error" ? "#fee2e2" : "#d1fae5", color: message.type === "error" ? "#b91c1c" : "#065f46" }}>
                  {message.text}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ padding: "10px", borderRadius: "12px", background: "#f59e0b", border: "none", color: "#1a1a1a", fontWeight: 800, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                {loading ? "Sending..." : "Send Magic Link ✨"}
              </button>
            </form>
          </div>
        )}

        {/* footer note */}
        <div className="text-center max-sm:text-[10px] text-[#252525] text-[10px] mt-2 px-4">
          <h1>
            This Application was created by Cyberhowl (Alkali Jesse Uchubiyojo)
            <br />
            meant to connect business and serve as general information platform
            <br />
            Note: Ensure you read our{" "}
            <a className="text-red-700 underline" href="#">Terms</a>{" "}
            and{" "}
            <a className="text-red-700 underline" href="#">Condition</a>{" "}
            before <u className="text-red-700">sign up.</u>
          </h1>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


// ==================== MAIN CHAT COMPONENT ====================
export default function Chat() {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setNewMessage] = useState("");
  const [usersOnline, setUsersOnline] = useState([]);
  const messagesEndRef = useRef(null);

  const [showSetting, setShowSetting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleClick = () => setShowSetting(p => !p);
  const toggleDarkMode = () => setIsDarkMode(p => !p);

  const [isVisible, setIsVisible] = useState(false);
  const [itAppear, setItAppear] = useState(false);
  const [itVisible, setItVisible] = useState(false);

  const toggleVisibility = () => setIsVisible(p => !p);
  const toggleAppear = () => setItAppear(p => !p);
  const toggleVisible = () => setItVisible(p => !p);

  const [rateLimiteError, setRateLimiterError] = useState(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [isThrottled, setIsThrpttled] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioPlayersRef = useRef({});

  const [revealedDeleteIds, setRevealedDeleteIds] = useState({});
  const holdTimerRef = useRef({});
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const RateLimitersRef = useRef({
    message: new RateLimiter(RATE_LIMIT_CONFIG.MESSAGE_SEND.maxRequests, RATE_LIMIT_CONFIG.MESSAGE_SEND.timeWindow),
    voice: new RateLimiter(RATE_LIMIT_CONFIG.VOICE_SEND.maxRequests, RATE_LIMIT_CONFIG.VOICE_SEND.timeWindow),
    file: new RateLimiter(RATE_LIMIT_CONFIG.FILE_SEND.maxRequests, RATE_LIMIT_CONFIG.FILE_SEND.timeWindow),
    presence: new RateLimiter(RATE_LIMIT_CONFIG.PRESENCE_UPDATE.maxRequests, RATE_LIMIT_CONFIG.PRESENCE_UPDATE.timeWindow),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        const v = Math.max(0, prev - 1);
        if (v === 0) { setIsThrpttled(false); setRateLimiterError(null); }
        return v;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  useEffect(() => {
    if (!session?.user) return;
    const loadMessages = async () => {
      const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (error) { console.error("Error loading messages:", error); return; }
      if (data) {
        setMessages(data.map((row) => ({
          id: row.id, type: row.type, message: row.message, audioData: row.audio_data,
          fileName: row.file_name, fileSize: row.file_size, fileType: row.file_type,
          fileData: row.file_data, user_name: row.user_name, user_id: row.user_id, timestamp: row.created_at,
        })));
      }
    };
    loadMessages();
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase.channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, { id: row.id, type: row.type, message: row.message, audioData: row.audio_data, fileName: row.file_name, fileSize: row.file_size, fileType: row.file_type, fileData: row.file_data, user_name: row.user_name, user_id: row.user_id, timestamp: row.created_at }];
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session]);

  useEffect(() => {
    if (!session?.user) { setUsersOnline([]); return; }
    const roomOne = supabase.channel("room_one", { config: { presence: { key: session.user.id } } });
    roomOne.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && RateLimitersRef.current.presence.canMakeRequest()) {
        try { await RetryManager.retryWithExponentialBackoff(async () => { await roomOne.track({ id: session.user.id, email: session.user.email }); }); }
        catch (error) { console.error("Error tracking presence:", error); }
      }
    });
    roomOne.on("presence", { event: "sync" }, () => { setUsersOnline(Object.keys(roomOne.presenceState())); });
    return () => roomOne.unsubscribe();
  }, [session]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setRecordedAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true); setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch { alert("Microphone access denied. Please enable microphone permissions."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); }
  };

  const formatRecordingTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const persistMessage = async (payload) => {
    const { data, error } = await supabase.from("messages").insert([{
      type: payload.type, message: payload.message || null, audio_data: payload.audioData || null,
      file_name: payload.fileName || null, file_size: payload.fileSize || null,
      file_type: payload.fileType || null, file_data: payload.fileData || null,
      user_name: payload.user_name, user_id: payload.user_id,
    }]).select().single();
    if (error) { console.error("Error persisting message:", error); return null; }
    return data;
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudioUrl) return;
    try {
      const blob = await fetch(recordedAudioUrl).then((r) => r.blob());
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(",")[1];
        const vm = { type: "voice", audioData: base64Audio, user_name: session?.user?.email, user_id: session?.user?.id, timestamp: new Date().toISOString() };
        const row = await persistMessage(vm);
        setMessages((p) => [...p, { ...vm, id: row?.id }]);
        setRecordedAudioUrl(null); setRecordingTime(0);
      };
      reader.readAsDataURL(blob);
    } catch (error) { console.error("Error sending voice message:", error); }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    if (files.length > 0) setFilePreview({ name: files[0].name, size: (files[0].size / 1024 / 1024).toFixed(2), type: files[0].type });
  };

  const sendFiles = async () => {
    if (selectedFiles.length === 0) return;
    try {
      for (const file of selectedFiles) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64File = reader.result.split(",")[1];
          const fm = { type: "file", fileName: file.name, fileSize: file.size, fileType: file.type, fileData: base64File, user_name: session?.user?.email, user_id: session?.user?.id, timestamp: new Date().toISOString() };
          const row = await persistMessage(fm);
          setMessages((p) => [...p, { ...fm, id: row?.id }]);
        };
        reader.readAsDataURL(file);
      }
      setSelectedFiles([]); setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) { console.error("Error sending files:", error); }
  };

  const downloadFile = (fileMessage) => {
    try {
      const link = document.createElement("a");
      link.href = `data:${fileMessage.fileType};base64,${fileMessage.fileData}`;
      link.download = fileMessage.fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { console.error("Error downloading file:", error); }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes("image")) return "🖼️";
    if (fileType.includes("video")) return "🎥";
    if (fileType.includes("audio")) return "🎵";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    return "📦";
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim()) return;
    try {
      const payload = { type: "text", message: messageInput, user_name: session?.user?.email, avatar: session?.user?.user_metadata?.avatar_url, user_id: session?.user?.id, timestamp: new Date().toISOString() };
      const row = await persistMessage(payload);
      setMessages((p) => [...p, { ...payload, id: row?.id }]);
      setNewMessage("");
    } catch (error) { console.error("Error sending message:", error); }
  };

  const deleteMessage = async (msgId) => {
    if (!msgId) return;
    const { error } = await supabase.from("messages").delete().eq("id", msgId);
    if (error) { console.error("Error deleting message:", error); return; }
    setMessages((p) => p.filter((m) => m.id !== msgId));
    setRevealedDeleteIds((p) => { const n = { ...p }; delete n[msgId]; return n; });
  };

  const deleteAllMessages = async () => {
    const { error } = await supabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { console.error("Error deleting all messages:", error); return; }
    setMessages([]); setRevealedDeleteIds({}); setShowDeleteAll(false);
  };

  const handleHoldStart = (msgId) => { holdTimerRef.current[msgId] = setTimeout(() => setRevealedDeleteIds((p) => ({ ...p, [msgId]: true })), 2000); };
  const handleHoldEnd = (msgId) => { if (holdTimerRef.current[msgId]) { clearTimeout(holdTimerRef.current[msgId]); delete holdTimerRef.current[msgId]; } };

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setMessages([]);
  };

  const MessageRenderer = ({ msg, isOwn }) => {
    const msgId = msg.id || msg.timestamp;
    const deleteVisible = revealedDeleteIds[msgId];
    const holdProps = {
      onMouseDown: () => handleHoldStart(msgId), onMouseUp: () => handleHoldEnd(msgId),
      onMouseLeave: () => handleHoldEnd(msgId), onTouchStart: () => handleHoldStart(msgId), onTouchEnd: () => handleHoldEnd(msgId),
    };

    const WithDeleteSupport = ({ children }) => (
      <div className="flex flex-col" style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
        <div {...holdProps} style={{ cursor: "pointer", userSelect: "none" }}>{children}</div>
        {deleteVisible && (
          <button onClick={() => deleteMessage(msgId)} style={{ marginTop: "4px", padding: "4px 10px", borderRadius: "12px", background: "#ef4444", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "600", animation: "fadeInDown 0.18s ease" }}>
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    );

    if (msg.type === "text") return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <WithDeleteSupport>
          <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow backdrop-blur-sm transition-all hover:shadow-lg ${isOwn ? "bg-amber-500" : "bg-gray-100"}`}>
            <p className="wrap-break-word">{msg.message}</p>
            <p className="text-xs opacity-75 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
          </div>
        </WithDeleteSupport>
      </div>
    );

    if (msg.type === "voice") return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <WithDeleteSupport>
          <div className={`max-w-xs w-[80%] lg:max-w-md px-4 py-3 rounded-2xl shadow backdrop-blur-sm transition-all hover:shadow-lg ${isOwn ? "bg-amber-500" : "bg-gray-100"}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => { const audio = new Audio(`data:audio/wav;base64,${msg.audioData}`); if (playingAudioId === msg.timestamp) { audio.pause(); setPlayingAudioId(null); } else { setPlayingAudioId(msg.timestamp); audio.play(); } }} className="shrink-0 p-2 hover:bg-white/20 rounded-full transition">
                {playingAudioId === msg.timestamp ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="flex-1"><div className="h-2 bg-white/20 rounded-full"></div></div>
            </div>
            <p className="text-xs opacity-75 mt-2">{new Date(msg.timestamp).toLocaleTimeString()}</p>
          </div>
        </WithDeleteSupport>
      </div>
    );

    if (msg.type === "file") return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <WithDeleteSupport>
          <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl bg-amber-500 shadow backdrop-blur-sm ${isOwn ? "from-amber-300 to-amber-500" : "bg-green-100 text-gray-800"}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(msg.fileType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{msg.fileName}</p>
                <p className="text-xs opacity-75">{(msg.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={() => downloadFile(msg)} className="shrink-0 p-2 hover:bg-white/20 rounded-full transition"><Download size={18} /></button>
            </div>
            <p className="text-xs opacity-75 mt-2">{new Date(msg.timestamp).toLocaleTimeString()}</p>
          </div>
        </WithDeleteSupport>
      </div>
    );

    return null;
  };

  // ==================== CHAT UI (logged in) ====================
  if (session) {
    return (
      <div className={isDarkMode ? 'w-full h-screen flex flex-col bg-[#252525] text-white' : 'w-full h-screen flex flex-col bg-[#EFEFEF] text-black'}>
        {showDeleteAll && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: isDarkMode ? "#1a1a1a" : "#fff", color: isDarkMode ? "#fff" : "#111", borderRadius: "16px", padding: "28px 32px", minWidth: "280px", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", border: isDarkMode ? "1px solid #444" : "none" }}>
              <Trash size={32} color="#ef4444" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Delete all messages?</p>
              <p style={{ fontSize: "13px", opacity: 0.65, marginBottom: "20px" }}>This will permanently remove every message for everyone.</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button onClick={() => setShowDeleteAll(false)} style={{ padding: "8px 20px", borderRadius: "10px", border: "1px solid #ccc", cursor: "pointer", background: "transparent", color: "inherit", fontWeight: 600 }}>Cancel</button>
                <button onClick={deleteAllMessages} style={{ padding: "8px 20px", borderRadius: "10px", border: "none", cursor: "pointer", background: "#ef4444", color: "#fff", fontWeight: 700 }}>Delete All</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="max-sm:h-[5%] h-[8%] flex justify-center items-center gap-2.5">
          <div className={isDarkMode ? 'border border-gray-500 rounded-br-[10px] w-[10%] h-[90%] flex justify-center items-center' : 'b rounded-br-[10px] w-[10%] h-[90%] flex justify-center items-center'}>
            <img className="w-9 max-sm:w-5" src="panda.png" alt="/" />
          </div>
          <div className={isDarkMode ? "w-[90%] h-full justify-center rounded-bl-[10px] border border-gray-500 items-center flex" : 'w-[90%] h-full justify-center rounded-bl-[10px] b items-center flex'}>
            <div className="w-[10%] h-full hidden max-sm:flex max-sm:justify-center max-sm:items-center"></div>
            <div className="w-[90%] h-full">
              <SearchUsers isDarkMode={isDarkMode} />
              <div className="w-full h-[4.5%] hidden max-sm:block mt-[400px] max-sm:justify-center max-sm:items-center">
                <div className="w-[20%] h-full flex justify-center items-center"></div>
                <div className="w-[20%] h-full flex justify-center items-center bg-amber-300"></div>
                <div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center">
                  <button className="text-[3.5vw] rounded-[50px] cursor-pointer" onClick={toggleVisibility}>{isVisible ? '⚙' : '⚙'}</button>
                  {isVisible && (
                    <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-34%] h-[67%] rounded-r-[20px] z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-34%] h-[67%] rounded-r-[20px] transition'}>
                      <div className="w-full h-[20%] flex justify-center items-center">
                        <div className="gap-3 text-xs flex justify-center items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <p className={isDarkMode ? 'bg-black text-white' : 'text-black'}>{session?.user?.email}</p>
                        </div>
                      </div>
                      <div className="w-full h-[10%]">
                        <button className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl' : 'w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl'} onClick={handleLogout}>Sign Out</button>
                      </div>
                      <div className="w-full h-[10%]">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold transition text-black w-[90%] h-[90%] rounded-[50px] flex items-center justify-center'}>
                          <div className="w-full h-[10%] flex justify-center items-center">
                            <button onClick={toggleDarkMode} className={isDarkMode ? 'w-[20%] cursor-pointer mr-[5px] h-full fa fa-moon-o text-white rounded' : 'w-[20%] cursor-pointer mr-[5px] h-full text-[#E3AD23] rounded fa fa-sun-o'}>Theme {showSetting ? '' : ''}</button>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-[10%]">
                        <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl'}>
                          <span className="text-[#E3AD23] text-sm">You:</span>
                          <div className="text-[#E3AD23] font-bold ml-.5">{usersOnline.length + 1}</div>
                        </div>
                      </div>
                      <div className="w-full h-[10%]">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold transition text-black w-[90%] h-[90%] rounded-[50px] flex items-center justify-center'}>
                          <div className="w-full h-[10%] flex justify-center items-center p-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 cursor-pointer rounded-xl bg-amber-500 hover:bg-[#E3AD23] text-white transition font-bold flex items-center gap-2"><FileUp size={18} /></button>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-[10%]">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold transition text-black w-[90%] h-[90%] rounded-[50px] flex items-center justify-center'}>
                          <div className="w-full h-[10%] flex justify-center items-center p-2">
                            <button onClick={() => setShowDeleteAll(true)} title="Delete all messages" className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition cursor-pointer font-bold flex items-center gap-2"><Trash size={18} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center">
                  Setting <button className="butt text-[1.5vw] rounded-[50px] cursor-pointer" onClick={toggleVisible}>{itVisible ? '⚙' : '⚙'}</button>
                  {itVisible && (
                    <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-50%] h-[67%] rounded-r-[20px] flex flex-col items-center z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-50%] h-[67%] rounded-r-[20px] transition flex flex-col items-center'}>
                      <UsersContainer />
                    </div>
                  )}
                </div>
                <div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center z-50">
                  Setting <button className="butt text-[1.5vw] rounded-[50px] cursor-pointer" onClick={toggleAppear}>{itAppear ? '⚙' : '⚙'}</button>
                  {itAppear && (
                    <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-67%] h-[67%] rounded-r-[20px] z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-67%] h-[67%] rounded-r-[20px] transition'}></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Container */}
        <div className={isDarkMode ? 'w-full bg-[#252525] text-white h-screen overflow-hidden gap-2.5 flex justify-center items-center max-sm:flex-col p-2' : 'w-full bg-[#EFEFEF] text-black h-screen overflow-hidden gap-2.5 flex justify-center items-center max-sm:flex-col p-2'}>
          <div className="w-[40%] h-screen max-sm:hidden flex justify-center items-center gap-2.5">
            <div className="w-[50%] h-[90%] flex flex-col gap-2.5">
              <div className={isDarkMode ? 'w-full text-white transition bg-black border border-gray-500 h-[65%] rounded-b-[20px]' : 'w-full rounded-b-[20px] text-black white h-[65%]'}>
                <div className="w-full h-[20%] flex justify-center items-center">
                  <div className="max-sm:ml-[100px] max-sm:mr-10 gap-3 flex justify-center items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <p className={isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}>{session?.user?.email}</p>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <button className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl' : 'w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl'} onClick={handleLogout}>Sign Out</button>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold transition text-black w-[90%] h-[90%] rounded-[50px] flex items-center justify-center'}>
                    Setting <button className="butt text-[3vw] rounded-[50px] cursor-pointer fa fa-setting" onClick={toggleVisibility}>{isVisible ? '⚙' : '⚙'}</button>
                    {isVisible && (
                      <div className={isDarkMode ? 'fixed ha lg:mt-[30%] mt-[90%] border border-gray-500 bg-black ha text-white w-[20%] rounded-[20px] flex flex-col gap-[5px]' : 'fixed has lg:mt-[30%] hash text-black w-[20%] rounded-[20px] mt-[50%] flex flex-col gap-[5px]'}>
                        <div className="w-full h-[10%] flex justify-end items-center">
                          <button className="text-[2vw] rounded-[50px] cursor-pointer" onClick={toggleVisibility}>{isVisible ? '⚙' : '⚙'}</button>
                        </div>
                        <div className="w-full h-[10%] flex items-center">
                          <button onClick={toggleDarkMode} className={isDarkMode ? 'w-[20%] cursor-pointer mr-[5px] h-full fa fa-moon-o text-white rounded' : 'w-[20%] cursor-pointer mr-[5px] h-full text-[#E3AD23] rounded fa fa-sun-o'}>{showSetting ? '' : ''}</button>
                        </div>
                        <div className="w-full h-[10%] flex justify-end mr-[5px] items-center"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl'}>
                    <span className="text-[#E3AD23] text-sm">You:</span>
                    <div className="text-[#E3AD23] font-bold ml-.5">{usersOnline.length + 1}</div>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl'}>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl bg-amber-500 hover:bg-[#E3AD23] text-white transition font-bold flex items-center gap-2"><FileUp size={18} /></button>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold transition text-black w-[90%] h-[90%] rounded-[50px] flex items-center justify-center'}>
                    <div className="w-full h-[10%] flex justify-center items-center p-2">
                      <button onClick={() => setShowDeleteAll(true)} title="Delete all messages" className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition cursor-pointer font-bold flex items-center gap-2"><Trash size={18} /></button>
                    </div>
                  </div>
                </div>
                <div className="w-full h-[10%]"></div>
              </div>
              <div className={isDarkMode ? 'w-full h-[35%] transition border border-gray-500 text-white rounded-[20px] bg-black' : 'w-full h-[35%] rounded-[20px] text-black white'}></div>
            </div>
            <div className="w-[50%] h-full flex justify-center items-center p-1">
              <div className={isDarkMode ? 'bg-black ha border transition border-gray-500 text-white w-full h-[90%] rounded-[20px]' : 'text-black w-full h-[90%] rounded-[20px] has'}>
                <div className={isDarkMode ? 'bg-black ha text-white ha w-full h-[10%] gap-1.5 rounded-b-[20px] contai' : 'hash text-black w-full h-[10%] gap-1.5 rounded-b-[20px]'}>Messages</div>
                <div className={isDarkMode ? 'bg-black ha text-white ha w-full h-[90%] gap-1.5 rounded-b-[20px] contai flex flex-col items-center' : 'hash text-black w-full h-[90%] gap-1.5 rounded-b-[20px] containe flex flex-col items-center'}><UsersContainer /></div>
              </div>
            </div>
          </div>

          {/* Chat body */}
          <div className="max-sm:w-full w-[70%] h-screen max-sm:p-0">
            <div className={isDarkMode ? "cont flex-1 overflow-y-auto p-6 space-y-4 h-[88%] rounded-t-3xl border-gray-500 border text-white bg-black" : "cont has flex-1 overflow-y-auto p-6 space-y-4 h-[88%] rounded-t-3xl"}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <p className="text-lg">No messages yet. Start chatting! 💬</p>
                  <p className="text-lg flex justify-center items-center gap-1.5">Pandora... <img className="w-[30px]" src="./panda.png" alt="" /></p>
                </div>
              ) : (
                messages.map((msg, idx) => <MessageRenderer key={msg.id || idx} msg={msg} isOwn={msg.user_id === session?.user?.id} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {filePreview && (
              <div className="px-4 py-3 bg-amber-400/5 border-t border-[#EFEFEF]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <File size={20} className="text-gray-00" />
                  <div>
                    <p className="text-white text-sm font-medium">{filePreview.name}</p>
                    <p className="text-gray-400 text-xs">{filePreview.size} MB</p>
                  </div>
                </div>
                <button onClick={() => { setFilePreview(null); setSelectedFiles([]); }} className="text-gray-900 hover:text-white transition"><X size={18} /></button>
              </div>
            )}

            {isRecording && (
              <div className="px-4 py-3 bg-amber-300/20 border-t border-[#EFEFEF]/40 flex items-center gap-3 -mt-[50px]">
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-red-300 font-semibold">Recording: {formatRecordingTime(recordingTime)}</span>
              </div>
            )}

            {recordedAudioUrl && (
              <div className="px-4 py-3 bg-amber-400 border-t rounded-2xl border-[#EFEFEF]/40 -mt-[50px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Play size={18} className="text-purple-400" />
                    <span className="text-purple-300 font-bold">Voice message ready</span>
                  </div>
                  <button onClick={() => setRecordedAudioUrl(null)} className="bg-amber-400 hover:bg-amber-500 text-gray-900 transition"><X size={18} /></button>
                </div>
              </div>
            )}

            <div className={isDarkMode ? "p-4 h-[12%] cont rounded-b-3xl" : "cont has p-4 h-[12%] hash rounded-b-3xl"}>
              <div className="flex gap-2 flex-wrap">
                <textarea
                  value={messageInput} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="🙂Message..."
                  className={isDarkMode ? 'e bg-black border transition border-gray-500 text-white flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none' : 'e flex-1 px-4 py-3 border border-amber-500 rounded-xl text-black focus:outline-none focus:ring-1 focus:ring-[#E3AD23] resize-none'}
                  rows={1}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                />
                {!recordedAudioUrl && (
                  <button onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-xl transition font-bold flex items-center gap-2 cursor-pointer ${isRecording ? "bg-amber-400 hover:bg-amber-500 text-gray-900" : "bg-amber-200 hover:bg-amber-300 text-gray-500"}`}>
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                )}
                {recordedAudioUrl && (
                  <button onClick={sendVoiceMessage} className="p-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-2"><Send size={18} /></button>
                )}
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden absolute bg-amber-500" accept="*/*" />
                {selectedFiles.length > 0 && (
                  <button onClick={sendFiles} className="p-3 cursor-pointer rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-5 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={18} /></button>
                )}
                {!recordedAudioUrl && selectedFiles.length === 0 && (
                  <button onClick={(e) => sendMessage(e)} disabled={!messageInput.trim()} className="p-3 rounded-xl bg-amber-400 cursor-pointer hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={18} /></button>
                )}
              </div>
            </div>
          </div>

          {/* mobile bottom nav */}
          <div className="w-full h-[5.5%] -mb-2 hidden max-sm:block max-sm:flex max-sm:justify-center max-sm:items-center">
            <div className="w-[30%] h-full flex justify-center items-center">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-home' : 'w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-home shadow-lg hash butto'} onClick={toggleAppear}>{itAppear ? '' : ''}</button>
            </div>
            <div className="w-[40%] h-full flex justify-center items-center">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[80%] -mt-3.5 text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-setting' : 'w-[50%] h-[80%] -mt-3.5 text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-setting shadow-lg hash butto'} onClick={toggleVisibility}>{isVisible ? '⚙' : '⚙'}</button>
            </div>
            <div className="w-[30%] h-full flex justify-center items-center">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-user' : 'w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-user shadow-lg hash butto'} onClick={toggleVisible}>{itVisible ? '' : ''}</button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes fadeInDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ==================== LOGIN SCREEN ====================
  return <LoginScreen onGoogleSignIn={signIn} />;
}