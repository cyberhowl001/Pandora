import { useState, useEffect, useRef } from "react";
import "./style.css"
import { supabase } from "../supabaseClient";
import AvatarComponent from "./useravatar";
import UsersContainer from "./Users";
import { Send, Mic, Square, FileUp, Play, Pause, Download, X, File, Trash2, Trash, Search } from "lucide-react";
import SearchUsers from "./SearchUser";

// rate limit config
const RATE_LIMIT_CONFIG = {
  MESSAGE_SEND: {
    maxRequests: 5,
    timeWindow: 10000,
  },
  VOICE_SEND: {
    maxRequests: 5,
    timeWindow: 10000,
  },
  FILE_SEND: {
    maxRequests: 5,
    timeWindow: 10000,
  },
  PRESENCE_UPDATE: {
    maxRequests: 1,
    timeWindow: 5000,
  },
};

// rate limiter utility
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.timeWindow
    );
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }
  getTimeUntileReset() {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    const timeSinceOldest = Date.now() - oldestRequest;
    return Math.max(0, this.timeWindow - timeSinceOldest);
  }
}

// retry utility
class RetryManager {
  static async retryWithExponentialBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (error.status !== 429 && error.status?.toString().startsWith("5")) {
          throw error;
        }
        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}


export default function Chat() {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setNewMessage] = useState("");
  const [usersOnline, setUsersOnline] = useState([]);
  const messagesEndRef = useRef(null);

  const [showSetting, setShowSetting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleClick = () => {
    setShowSetting(prevShowSetting => !prevShowSetting);
  }

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  }

  // appear and disappear
  const [isVisible, setIsVisible] = useState(false);
  const [itAppear, setItAppear] = useState(false);
  const [itVisible, setItVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible(prevState => !prevState)
  };

  const toggleAppear = () => {
    setItAppear(prevState => !prevState)
  };
  const toggleVisible = () => {
    setItVisible(prevState => !prevState)
  };

  const [rateLimiteError, setRateLimiterError] = useState(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [isThrottled, setIsThrpttled] = useState(false);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // File Sharing States
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Playing States
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioPlayersRef = useRef({});

  // hold-to-delete state
  const [revealedDeleteIds, setRevealedDeleteIds] = useState({});
  const holdTimerRef = useRef({});

  // confirm-delete-all dialog
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const RateLimitersRef = useRef({
    message: new RateLimiter(RATE_LIMIT_CONFIG.MESSAGE_SEND.maxRequests, RATE_LIMIT_CONFIG.MESSAGE_SEND.timeWindow),
    voice: new RateLimiter(RATE_LIMIT_CONFIG.VOICE_SEND.maxRequests, RATE_LIMIT_CONFIG.VOICE_SEND.timeWindow),
    file: new RateLimiter(RATE_LIMIT_CONFIG.FILE_SEND.maxRequests, RATE_LIMIT_CONFIG.FILE_SEND.timeWindow),
    presence: new RateLimiter(RATE_LIMIT_CONFIG.PRESENCE_UPDATE.maxRequests, RATE_LIMIT_CONFIG.PRESENCE_UPDATE.timeWindow),
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Rate limiter countdown
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        const newValue = Math.max(0, prev - 1);
        if (newValue === 0) {
          setIsThrpttled(false);
          setRateLimiterError(null);
        }
        return newValue;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  // Load persisted messages from Supabase on login
  useEffect(() => {
    if (!session?.user) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        return;
      }

      if (data) {
        const loaded = data.map((row) => ({
          id: row.id,
          type: row.type,
          message: row.message,
          audioData: row.audio_data,
          fileName: row.file_name,
          fileSize: row.file_size,
          fileType: row.file_type,
          fileData: row.file_data,
          user_name: row.user_name,
          user_id: row.user_id,
          timestamp: row.created_at,
        }));
        setMessages(loaded);
      }
    };

    loadMessages();
  }, [session]);

  // Real-time subscription for new DB rows
  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === row.id);
            if (exists) return prev;
            return [
              ...prev,
              {
                id: row.id,
                type: row.type,
                message: row.message,
                audioData: row.audio_data,
                fileName: row.file_name,
                fileSize: row.file_size,
                fileType: row.file_type,
                fileData: row.file_data,
                user_name: row.user_name,
                user_id: row.user_id,
                timestamp: row.created_at,
              },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // Setup real-time presence channel
  useEffect(() => {
    if (!session?.user) {
      setUsersOnline([]);
      return;
    }

    const roomOne = supabase.channel("room_one", {
      config: { presence: { key: session.user.id } },
    });

    roomOne.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        if (RateLimitersRef.current.presence.canMakeRequest()) {
          try {
            await RetryManager.retryWithExponentialBackoff(async () => {
              await roomOne.track({
                id: session.user.id,
                email: session.user.email,
              });
            });
          } catch (error) {
            console.error("Error tracking presence:", error);
          }
        }
      }
    });

    roomOne.on("presence", { event: "sync" }, () => {
      const state = roomOne.presenceState();
      setUsersOnline(Object.keys(state));
    });

    return () => {
      roomOne.unsubscribe();
    };
  }, [session]);

  // ✅ FIXED: Auth setup — removed getSession() and magic link handling
  // onAuthStateChange fires immediately with the current session on mount,
  // so getSession() was causing duplicate token refreshes → 429 errors
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  // ==================== VOICE RECORDING FUNCTIONS ====================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      alert("Microphone access denied. Please enable microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper to persist a message row to Supabase
  const persistMessage = async (payload) => {
    const { data, error } = await supabase.from("messages").insert([
      {
        type: payload.type,
        message: payload.message || null,
        audio_data: payload.audioData || null,
        file_name: payload.fileName || null,
        file_size: payload.fileSize || null,
        file_type: payload.fileType || null,
        file_data: payload.fileData || null,
        user_name: payload.user_name,
        user_id: payload.user_id,
      },
    ]).select().single();

    if (error) {
      console.error("Error persisting message:", error);
      return null;
    }
    return data;
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudioUrl) return;

    try {
      const audioBlob = await fetch(recordedAudioUrl).then((r) => r.blob());
      const reader = new FileReader();

      reader.onload = async () => {
        const base64Audio = reader.result.split(",")[1];

        const voiceMessage = {
          type: "voice",
          audioData: base64Audio,
          user_name: session?.user?.email,
          user_id: session?.user?.id,
          timestamp: new Date().toISOString(),
        };

        const row = await persistMessage(voiceMessage);
        const msgWithId = { ...voiceMessage, id: row?.id };

        setMessages((prevMessages) => [...prevMessages, msgWithId]);

        setRecordedAudioUrl(null);
        setRecordingTime(0);
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Error sending voice message:", error);
    }
  };

  // ==================== FILE SHARING FUNCTIONS ====================
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);

    if (files.length > 0) {
      const file = files[0];
      setFilePreview({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        type: file.type,
      });
    }
  };

  const sendFiles = async () => {
    if (selectedFiles.length === 0) return;

    try {
      for (const file of selectedFiles) {
        const reader = new FileReader();

        reader.onload = async () => {
          const base64File = reader.result.split(",")[1];

          const fileMessage = {
            type: "file",
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileData: base64File,
            user_name: session?.user?.email,
            user_id: session?.user?.id,
            timestamp: new Date().toISOString(),
          };

          const row = await persistMessage(fileMessage);
          const msgWithId = { ...fileMessage, id: row?.id };

          setMessages((prevMessages) => [...prevMessages, msgWithId]);
        };

        reader.readAsDataURL(file);
      }

      setSelectedFiles([]);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending files:", error);
    }
  };

  const downloadFile = (fileMessage) => {
    try {
      const link = document.createElement("a");
      link.href = `data:${fileMessage.fileType};base64,${fileMessage.fileData}`;
      link.download = fileMessage.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes("image")) return "🖼️";
    if (fileType.includes("video")) return "🎥";
    if (fileType.includes("audio")) return "🎵";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    return "📦";
  };

  // ==================== MESSAGE SENDING ====================
  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      const messagePayload = {
        type: "text",
        message: messageInput,
        user_name: session?.user?.email,
        avatar: session?.user?.user_metadata?.avatar_url,
        user_id: session?.user?.id,
        timestamp: new Date().toISOString(),
      };

      const row = await persistMessage(messagePayload);
      const msgWithId = { ...messagePayload, id: row?.id };

      setMessages((prevMessages) => [...prevMessages, msgWithId]);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Delete a single message
  const deleteMessage = async (msgId) => {
    if (!msgId) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", msgId);

    if (error) {
      console.error("Error deleting message:", error);
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setRevealedDeleteIds((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
  };

  // Delete ALL messages
  const deleteAllMessages = async () => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.error("Error deleting all messages:", error);
      return;
    }

    setMessages([]);
    setRevealedDeleteIds({});
    setShowDeleteAll(false);
  };

  // Hold-to-delete pointer handlers
  const handleHoldStart = (msgId) => {
    holdTimerRef.current[msgId] = setTimeout(() => {
      setRevealedDeleteIds((prev) => ({ ...prev, [msgId]: true }));
    }, 2000);
  };

  const handleHoldEnd = (msgId) => {
    if (holdTimerRef.current[msgId]) {
      clearTimeout(holdTimerRef.current[msgId]);
      delete holdTimerRef.current[msgId];
    }
  };

  // Google OAuth login
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  // Logout — messages stay in DB, only clear local UI
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setMessages([]);
  };

  // ==================== RENDER FUNCTIONS ====================

  // Message Renderer Component
  const MessageRenderer = ({ msg, isOwn }) => {
    const msgId = msg.id || msg.timestamp;
    const deleteVisible = revealedDeleteIds[msgId];

    const holdProps = {
      onMouseDown: () => handleHoldStart(msgId),
      onMouseUp: () => handleHoldEnd(msgId),
      onMouseLeave: () => handleHoldEnd(msgId),
      onTouchStart: () => handleHoldStart(msgId),
      onTouchEnd: () => handleHoldEnd(msgId),
    };

    const WithDeleteSupport = ({ children }) => (
      <div className="flex flex-col" style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
        <div {...holdProps} style={{ cursor: "pointer", userSelect: "none" }}>
          {children}
        </div>
        {deleteVisible && (
          <button
            onClick={() => deleteMessage(msgId)}
            style={{
              marginTop: "4px",
              padding: "4px 10px",
              borderRadius: "12px",
              background: "#ef4444",
              color: "white",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: "600",
              animation: "fadeInDown 0.18s ease",
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    );

    if (msg.type === "text") {
      return (
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
          <WithDeleteSupport>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow backdrop-blur-sm transition-all hover:shadow-lg ${
                isOwn ? "bg-amber-500" : "bg-gray-100"
              }`}
            >
              <p className="wrap-break-word">{msg.message}</p>
              <p className="text-xs opacity-75 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </WithDeleteSupport>
        </div>
      );
    }

    if (msg.type === "voice") {
      return (
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
          <WithDeleteSupport>
            <div
              className={`max-w-xs w-[80%] lg:max-w-md px-4 py-3 rounded-2xl shadow backdrop-blur-sm transition-all hover:shadow-lg ${
                isOwn ? "bg-amber-500" : "bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const audio = new Audio(`data:audio/wav;base64,${msg.audioData}`);
                    if (playingAudioId === msg.timestamp) {
                      audio.pause();
                      setPlayingAudioId(null);
                    } else {
                      setPlayingAudioId(msg.timestamp);
                      audio.play();
                    }
                  }}
                  className="shrink-0 p-2 hover:bg-white/20 rounded-full transition"
                >
                  {playingAudioId === msg.timestamp ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <div className="flex-1">
                  <div className="h-2 bg-white/20 rounded-full"></div>
                </div>
              </div>
              <p className="text-xs opacity-75 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </WithDeleteSupport>
        </div>
      );
    }

    if (msg.type === "file") {
      return (
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
          <WithDeleteSupport>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl bg-amber-500 shadow backdrop-blur-sm ${
                isOwn ? "from-amber-300 to-amber-500" : "bg-green-100 text-gray-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(msg.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{msg.fileName}</p>
                  <p className="text-xs opacity-75">
                    {(msg.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => downloadFile(msg)}
                  className="shrink-0 p-2 hover:bg-white/20 rounded-full transition"
                >
                  <Download size={18} />
                </button>
              </div>
              <p className="text-xs opacity-75 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </WithDeleteSupport>
        </div>
      );
    }

    return null;
  };

  // If user is logged in, show chat
  if (session) {
    return (
      <div className={isDarkMode ? 'w-full h-screen flex flex-col bg-[#252525] text-white' : 'w-full h-screen flex flex-col bg-[#EFEFEF] text-black'}>
        {/* Confirm Delete All Dialog */}
        {showDeleteAll && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              style={{
                background: isDarkMode ? "#1a1a1a" : "#fff",
                color: isDarkMode ? "#fff" : "#111",
                borderRadius: "16px",
                padding: "28px 32px",
                minWidth: "280px",
                textAlign: "center",
                boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                border: isDarkMode ? "1px solid #444" : "none",
              }}
            >
              <Trash size={32} color="#ef4444" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
                Delete all messages?
              </p>
              <p style={{ fontSize: "13px", opacity: 0.65, marginBottom: "20px" }}>
                This will permanently remove every message for everyone.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  onClick={() => setShowDeleteAll(false)}
                  style={{
                    padding: "8px 20px", borderRadius: "10px",
                    border: "1px solid #ccc", cursor: "pointer",
                    background: "transparent", color: "inherit",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAllMessages}
                  style={{
                    padding: "8px 20px", borderRadius: "10px",
                    border: "none", cursor: "pointer",
                    background: "#ef4444", color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="max-sm:h-[5%] h-[8%] flex justify-center items-center gap-2.5 ">
          <div className={isDarkMode ? 'border border-gray-500 rounded-br-[10px] w-[10%] h-[90%] flex justify-center items-center' : 'b rounded-br-[10px] w-[10%] h-[90%] flex justify-center items-center'}>
            <img className="w-9 max-sm:w-5" src="panda.png" alt="/" />
          </div>

          <div className={isDarkMode ? "w-[90%] h-full justify-center rounded-bl-[10px] border border-gray-500 items-center flex" : 'w-[90%] h-full justify-center rounded-bl-[10px] b items-center flex'}>
            <div className="w-[10%] h-full hidden max-sm:flex max-sm:justify-center max-sm:items-center "></div>
            <div className="w-[90%] h-full">
              <SearchUsers isDarkMode={isDarkMode} />
              {/* setting for mobile */}
              <div className="w-full h-[4.5%] hidden max-sm:block mt-[400px] max-sm:justify-center max-sm:items-center">
                <div className="w-[20%] h-full flex justify-center items-center"></div>
                <div className="w-[20%] h-full flex justify-center items-center bg-amber-300"></div>
                <div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center ">
                  <button className=" text-[3.5vw]  rounded-[50px] cursor-pointer" onClick={toggleVisibility}>
                    {isVisible ? '⚙' : '⚙'}
                  </button>
                  {isVisible && (
                    <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-34%] h-[67%] rounded-r-[20px] z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-34%] h-[67%] rounded-r-[20px] transition '}>
                      <div className="w-full h-[20%] flex justify-center items-center ">
                        <div className="gap-3 text-xs flex justify-center items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <p className={isDarkMode ? 'bg-black text-white' : ' text-black'}>{session?.user?.email}</p>
                        </div>
                      </div>
                      <div className="w-full h-[10%]">
                        <button className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold  rounded-2xl' : 'w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl '} onClick={handleLogout}>
                          Sign Out
                        </button>
                      </div>
                      <div className="w-full h-[10%]  ">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black  text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold  transition   text-black  w-[90%] h-[90%] rounded-[50px]  flex items-center justify-center '}>
                          <div className="w-full h-[10%]  flex justify-center items-center ">
                            <button onClick={toggleDarkMode} className={isDarkMode ? 'w-[20%] cursor-pointer mr-[5px] h-full fa fa-moon-o text-white rounded ' : 'w-[20%] cursor-pointer mr-[5px] h-full text-[#E3AD23] rounded fa fa-sun-o'}>
                         Theme {showSetting ? '' : ''}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-[10%] ">
                        <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl '}>
                          <span className="text-[#E3AD23] text-sm">You:</span>
                          <div className="text-[#E3AD23] font-bold ml-.5">{usersOnline.length + 1}</div>
                        </div>
                      </div>
                      <div className="w-full h-[10%] ">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black  text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold  transition   text-black  w-[90%] h-[90%] rounded-[50px]  flex items-center justify-center '}>
                          <div className="w-full h-[10%] flex justify-center items-center p-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 cursor-pointer rounded-xl bg-amber-500 hover:bg-[#E3AD23] text-white transition font-bold flex items-center gap-2">
                              <FileUp size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                     <div className="w-full h-[10%]">
                        <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black  text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold  transition   text-black  w-[90%] h-[90%] rounded-[50px]  flex items-center justify-center '}>
                          <div className="w-full h-[10%] flex justify-center items-center p-2">
                              <button
                  onClick={() => setShowDeleteAll(true)}
                  title="Delete all messages"
                  className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition cursor-pointer font-bold flex items-center gap-2"
                >
                  <Trash size={18} />
                </button>
                </div>
                </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* user online mobile */}
                <div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center ">
                  Setting <button className="butt text-[1.5vw]  rounded-[50px] cursor-pointer" onClick={toggleVisible}>
                    {itVisible ? '⚙' : '⚙'}
                  </button>
                  {itVisible && (
                    <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-50%] h-[67%] rounded-r-[20px] flex flex-col items-center z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-50%] h-[67%] rounded-r-[20px] transition flex flex-col items-center'}>
                      <UsersContainer />
                    </div>
                  )}
                </div>
         {/* small phone home */}
<div className="w-[20%] ml-[40%] mt-[10%] h-full flex justify-center items-center z-50">
  Setting <button className="butt text-[1.5vw]  rounded-[50px] cursor-pointer"
                        onClick={toggleAppear}>
                    {itAppear ? '⚙' : '⚙'}
                  </button>
      
{itAppear && (
 <div className={isDarkMode ? 'w-[50%] text-white transition bg-black border border-gray-500 absolute ml-[-70%] mt-[-67%] h-[67%] rounded-r-[20px] z-50' : 'w-[50%] z-50 text-black has absolute ml-[-70%] mt-[-67%] h-[67%] rounded-r-[20px] transition '}>

  </div>
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
              {/* notifications */}
              <div className={isDarkMode ? 'w-full text-white transition bg-black border border-gray-500 h-[65%] rounded-b-[20px]' : 'w-full rounded-b-[20px] text-black white h-[65%]'}>
                <div className="w-full h-[20%] flex justify-center items-center ">
                  <div className="max-sm:ml-[100px] max-sm:mr-10 gap-3 flex justify-center items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <p className={isDarkMode ? 'bg-black text-white' : 'bg-white text-black'}>{session?.user?.email}</p>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <button className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl' : 'w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl '} onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black  text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold  transition   text-black  w-[90%] h-[90%] rounded-[50px]  flex items-center justify-center '}>
                    Setting <button className="butt text-[3vw]  rounded-[50px] cursor-pointer fa fa-setting" onClick={toggleVisibility}>
                      {isVisible ? '⚙' : '⚙'}
                    </button>
                    {isVisible && (
                      <div className={isDarkMode ? 'fixed ha lg:mt-[30%] mt-[90%] border border-gray-500 bg-black ha text-white  w-[20%] rounded-[20px] flex flex-col gap-[5px]' : 'fixed has lg:mt-[30%] hash text-black  w-[20%] rounded-[20px] mt-[50%] flex flex-col gap-[5px]'}>
                        <div className="w-full h-[10%] flex justify-end items-center ">
                          <button className=" text-[2vw]  rounded-[50px] cursor-pointer " onClick={toggleVisibility}>
                            {isVisible ? '⚙' : '⚙'}
                          </button>
                        </div>
                        <div className="w-full h-[10%]  flex items-center">
                          <button onClick={toggleDarkMode} className={isDarkMode ? 'w-[20%] cursor-pointer mr-[5px] h-full fa fa-moon-o text-white rounded ' : 'w-[20%] cursor-pointer mr-[5px] h-full text-[#E3AD23] rounded fa fa-sun-o'}>
                            {showSetting ? '' : ''}
                          </button>
                        </div>
                        <div className="w-full h-[10%]  flex justify-end mr-[5px]  items-center"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl '}>
                    <span className="text-[#E3AD23] text-sm">You:</span>
                    <div className="text-[#E3AD23] font-bold ml-.5">{usersOnline.length + 1}</div>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'bg-black w-[90%] h-[90%] flex justify-center border-l-0 border rounded-l border-gray-500 cursor-pointer items-center font-bold rounded-2xl gap-2.5' : 'gap-2.5 w-[90%] h-[90%] flex justify-center cursor-pointer items-center font-bold rounded-2xl '}>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl bg-amber-500 hover:bg-[#E3AD23] text-white transition font-bold flex items-center gap-2">
                      <FileUp size={18} />
                    </button>
                  </div>
                </div>
                <div className="w-full h-[10%]">
                  <div className={isDarkMode ? 'ha transition border-l-0 border rounded-l gap-[7px] font-bold border-gray-500 bg-black  text-white w-[90%] h-[90%] rounded-[50px] flex items-center justify-center' : 'gap-[7px] font-bold  transition   text-black  w-[90%] h-[90%] rounded-[50px]  flex items-center justify-center '}>
                    <div className="w-full h-[10%] flex justify-center items-center p-2">
                      <button
                        onClick={() => setShowDeleteAll(true)}
                        title="Delete all messages"
                        className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition cursor-pointer font-bold flex items-center gap-2"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-full h-[10%] "></div>
              </div>

              <div className={isDarkMode ? 'w-full h-[35%] transition border border-gray-500 text-white rounded-[20px] bg-black' : 'w-full h-[35%] rounded-[20px] text-black white'}>
                {/* <AvatarComponent /> */}
              </div>
            </div>

            {/* holds other users */}
            <div className="w-[50%] h-full  flex justify-center items-center p-1">
              <div className={isDarkMode ? 'bg-black ha border transition border-gray-500 text-white w-full h-[90%] rounded-[20px] ' : ' text-black w-full h-[90%] rounded-[20px] has '}>
                <div className={isDarkMode ? 'bg-black ha text-white ha w-full h-[10%] gap-1.5 rounded-b-[20px] contai' : 'hash text-black w-full h-[10%] gap-1.5 rounded-b-[20px] '}>
                  Messages
                </div>
                <div className={isDarkMode ? 'bg-black ha text-white ha w-full h-[90%] gap-1.5 rounded-b-[20px] contai  flex flex-col items-center' : 'hash text-black w-full h-[90%] gap-1.5 rounded-b-[20px] containe  flex flex-col items-center'}>
                  <UsersContainer />
                </div>
              </div>
            </div>
          </div>

          {/* all container */}
          <div className="max-sm:w-full w-[70%] h-screen max-sm:p-0">

            {/* Chat body */}
            <div className={isDarkMode ? "cont flex-1 overflow-y-auto p-6 space-y-4 h-[88%] rounded-t-3xl border-gray-500 border text-white bg-black" : "cont has flex-1 overflow-y-auto p-6 space-y-4 h-[88%] rounded-t-3xl"}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-20">
                  <p className="text-lg">No messages yet. Start chatting! 💬</p>
                  <p className="text-lg flex justify-center items-center gap-1.5 ">Pandora... <img className="w-[30px]" src="./panda.png" alt="" /></p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <MessageRenderer
                    key={msg.id || idx}
                    msg={msg}
                    isOwn={msg.user_id === session?.user?.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* File Preview */}
            {filePreview && (
              <div className="px-4 py-3 bg-amber-400/5 border-t border-[#EFEFEF]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <File size={20} className="text-gray-00" />
                  <div>
                    <p className="text-white text-sm font-medium">{filePreview.name}</p>
                    <p className="text-gray-400 text-xs">{filePreview.size} MB</p>
                  </div>
                </div>
                <button onClick={() => { setFilePreview(null); setSelectedFiles([]); }} className="text-gray-900 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Recording Indicator */}
            {isRecording && (
              <div className="px-4 py-3 bg-amber-300/20 border-t border-[#EFEFEF]/40 flex items-center gap-3 -mt-[50px]">
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-red-300 font-semibold">
                  Recording: {formatRecordingTime(recordingTime)}
                </span>
              </div>
            )}

            {/* Voice Preview */}
            {recordedAudioUrl && (
              <div className="px-4 py-3 bg-amber-400 border-t rounded-2xl border-[#EFEFEF]/40 -mt-[50px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Play size={18} className="text-purple-400" />
                    <span className="text-purple-300 font-bold">Voice message ready</span>
                  </div>
                  <button onClick={() => setRecordedAudioUrl(null)} className="bg-amber-400 hover:bg-amber-500 text-gray-900 transition">
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* INPUT SECTION */}
            <div className={isDarkMode ? "p-4 h-[12%] cont rounded-b-3xl" : "cont has p-4 h-[12%] hash rounded-b-3xl"}>
              <div className="flex gap-2 flex-wrap ">

                {/* text input */}
                <textarea
                  value={messageInput}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="🙂Message..."
                  className={isDarkMode ? 'e bg-black border transition border-gray-500 text-white flex-1 px-4 py-3  rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none' : 'e flex-1 px-4 py-3 border border-amber-500  rounded-xl text-black focus:outline-none focus:ring-1 focus:ring-[#E3AD23] resize-none'}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                />

                {/* voice record button */}
                {!recordedAudioUrl && (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3  rounded-xl transition font-bold flex items-center gap-2 cursor-pointer ${
                      isRecording
                        ? "bg-amber-400 hover:bg-amber-500 text-gray-900"
                        : "bg-amber-200 hover:bg-amber-300 text-gray-500 "
                    }`}
                  >
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                )}

                {/* send voice message button */}
                {recordedAudioUrl && (
                  <button onClick={sendVoiceMessage} className="p-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-2">
                    <Send size={18} />
                  </button>
                )}

                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden absolute bg-amber-500 " accept="*/*" />

                {/* send file button */}
                {selectedFiles.length > 0 && (
                  <button onClick={sendFiles} className="p-3 cursor-pointer rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-5 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send size={18} />
                  </button>
                )}

                {/* send text message button */}
                {!recordedAudioUrl && selectedFiles.length === 0 && (
                  <button
                    onClick={(e) => sendMessage(e)}
                    disabled={!messageInput.trim()}
                    className="p-3 rounded-xl bg-amber-400 cursor-pointer  hover:bg-amber-500 text-gray-900 transition font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* mobile screen details */}
          <div className="w-full h-[5.5%] -mb-2 hidden max-sm:block max-sm:flex max-sm:justify-center max-sm:items-center">
            <div className="w-[30%] h-full flex justify-center items-center">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-home' : 'w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-home shadow-lg hash butto'} onClick={toggleAppear}>
                {itAppear ? '' : ''}
              </button>
            </div>
            <div className="w-[40%] h-full flex justify-center items-center">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[80%] -mt-3.5 text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-setting' : 'w-[50%] h-[80%] -mt-3.5 text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-setting shadow-lg hash butto'} onClick={toggleVisibility}>
                {isVisible ? '⚙' : '⚙'}
              </button>
            </div>
            <div className="w-[30%] h-full flex justify-center items-center ">
              <button className={isDarkMode ? 'bg-black border border-gray-500 w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-user' : 'w-[50%] h-[78%] text-[3.5vw] text-[#E3AD23] rounded-[50px] cursor-pointer fa fa-user shadow-lg hash butto'} onClick={toggleVisible}>
                {itVisible ? '' : ''}
              </button>
            </div>
          </div>

        </div>

        {/* Inline animation for delete button reveal */}
        <style>{`
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Login Screen — Google OAuth only
  return (
    <div className="hash w-full flex justify-center items-center max-sm:flex-col">
      {/* advertisement */}
      <div className="w-[50%] max-sm:w-full h-screen white justify-center items-center flex">
        <div className="w-[95%] h-[97%] hash ">
          <div className="w-full h-[50%]  flex justify-center items-center">
            <div className="w-[50%] h-full flex justify-end items-center ">
              <img className="w-[90%] max-sm:h-[70%]" src="chi2.png" alt="" />
            </div>
            <div className="w-[50%] h-full flex justify-start items-center ">
              <img className="w-[90%] max-sm:h-[70%]" src="chi3.png" alt="" />
            </div>
          </div>
          <div className="w-full h-[50%] flex justify-center items-center">
            <div className="w-[50%] h-full flex justify-end items-center ">
              <img className="w-[70%] max-sm:h-[71%] rounded-l-[50px]" src="chi5.jpg" alt="" />
            </div>
            <div className="w-[50%] h-full flex justify-start items-center  ">
              <img className="w-[70%] h-[65%] max-sm:h-[71%]  rounded-r-[50px]" src="chi4.jpg" alt="" />
            </div>
          </div>
        </div>
      </div>

      {/* login form */}
      <div className="w-[50%] max-sm:w-full h-screen">
        <div className="w-full h-[20%] flex justify-center items-center">
          <button
            type="button"
            className="w-[40%] text-[2vh] max-sm:w-[80%] h-10 cursor-pointer text-white font-bold rounded-3xl shadow-lg hash button"
            onClick={signIn}
          >
            Sign in with Google to Chat
          </button>
        </div>

        {/* details link */}
        <div className="w-full h-[20%] flex justify-center items-center">
          <button
            type="button"
            className="w-[40%] text-[2vh] max-sm:w-[80%] h-10 cursor-pointer text-white font-bold rounded-3xl shadow-lg hash button"
          >
            <a href="">
              Registration portal
            </a>
          </button>
        </div>

        <div className="w-full h-[20%] flex justify-center items-center max-sm:text-[10px] text-[#252525] text-[10px]">
          <h1 className="text-center px-4">
            This Application was created by Cyberhowl (Alkali Jesse Uchubiyojo)
            <br />
            meant to connect business and serve as general information platform
            <br />
            Note: Ensure you read our{" "}
            <a className="text-red-700 underline" href="#">
              Terms
            </a>{" "}
            and{" "}
            <a className="text-red-700 underline" href="#">
              Condition
            </a>{" "}
            before <u className="text-red-700">sign up.</u>
          </h1>
        </div>
      </div>
    </div>
  );
}