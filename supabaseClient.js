import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonkey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonkey);


// import { useState, useEffect, useRef } from "react";
// import { supabase } from "../supabaseClient";
// import { useAuth } from "./AuthContext";
// import {
//   ArrowLeft, Send, Mic, Square, Play, Pause,
//   FileUp, File, Download, X, Trash2, Rss
// } from "lucide-react";

// export default function DirectChat({ targetUser, onClose, onGoToPantweet, newPantweetCount, isDarkMode = false }) {
//   const { currentUser } = useAuth();
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState("");
//   const [isRecording, setIsRecording] = useState(false);
//   const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
//   const [recordingTime, setRecordingTime] = useState(0);
//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [filePreview, setFilePreview] = useState(null);
//   const [fileCaption, setFileCaption] = useState("");
//   const [playingId, setPlayingId] = useState(null);
//   const [revealedDelete, setRevealedDelete] = useState({});

//   const messagesEndRef = useRef(null);
//   const mediaRecRef = useRef(null);
//   const audioChunksRef = useRef([]);
//   const recordingTimer = useRef(null);
//   const fileInputRef = useRef(null);
//   const holdTimers = useRef({});
//   const audioBlobCache = useRef({});

//   const me = currentUser?.id;
//   const them = targetUser?.id;
//   const storageKey = `pandora_dm_${[me, them].sort().join("_")}`;

//   // Scroll to bottom on new messages
//   useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

//   // Load device-local messages from localStorage
//   useEffect(() => {
//     if (!me || !them) return;
//     const stored = localStorage.getItem(storageKey);
//     if (stored) { try { setMessages(JSON.parse(stored)); } catch { /* ignore */ } }
//   }, [me, them]);

//   // Real-time subscription — only RECEIVES incoming messages, never inserts
//   useEffect(() => {
//     if (!me || !them) return;
//     const loginTime = new Date().toISOString();
//     const channel = supabase
//       .channel(`dm-${[me, them].sort().join("-")}`)
//       .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, ({ new: row }) => {
//         // Only handle messages sent BY the other person TO me
//         if (row.sender_id !== them || row.receiver_id !== me) return;
//         if (row.created_at < loginTime) return;
//         setMessages((prev) => {
//           if (prev.some((m) => m.id === row.id)) return prev;
//           const next = [...prev, rowToMsg(row)];
//           localStorage.setItem(storageKey, JSON.stringify(next));
//           return next;
//         });
//       })
//       .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, ({ old }) => {
//         setMessages((prev) => {
//           const next = prev.filter((m) => m.id !== old.id);
//           localStorage.setItem(storageKey, JSON.stringify(next));
//           return next;
//         });
//       })
//       .subscribe();

//     return () => supabase.removeChannel(channel);
//   }, [me, them]);

//   // Map a DB row → message object (for incoming messages only)
//   const rowToMsg = (row) => ({
//     id: row.id,
//     type: row.type,
//     message: row.message,
//     senderId: row.sender_id,
//     timestamp: row.created_at,
//     caption: null,
//     audioData: null,
//     fileName: null,
//     fileSize: null,
//     fileType: null,
//     fileData: null,
//   });

//   // Generate a local-only message object (no DB insert)
//   const makeLocalMsg = (type, extras = {}) => ({
//     id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
//     type,
//     message: extras.message ?? null,
//     senderId: me,
//     timestamp: new Date().toISOString(),
//     caption: extras.caption ?? null,
//     audioData: extras.audioData ?? null,
//     fileName: extras.fileName ?? null,
//     fileSize: extras.fileSize ?? null,
//     fileType: extras.fileType ?? null,
//     fileData: extras.fileData ?? null,
//   });

//   const saveMessages = (next) => {
//     localStorage.setItem(storageKey, JSON.stringify(next));
//     return next;
//   };

//   const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

//   // ── Recording ──
//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       const rec = new MediaRecorder(stream);
//       mediaRecRef.current = rec; audioChunksRef.current = [];
//       rec.ondataavailable = (e) => audioChunksRef.current.push(e.data);
//       rec.onstop = () => {
//         setRecordedAudioUrl(URL.createObjectURL(new Blob(audioChunksRef.current, { type: "audio/wav" })));
//         stream.getTracks().forEach((t) => t.stop());
//       };
//       rec.start(); setIsRecording(true); setRecordingTime(0);
//       recordingTimer.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
//     } catch { alert("Microphone access denied."); }
//   };

//   const stopRecording = () => {
//     mediaRecRef.current?.stop();
//     setIsRecording(false);
//     clearInterval(recordingTimer.current);
//   };

//   // Send voice — local only, no Supabase insert
//   const sendVoice = () => {
//     if (!recordedAudioUrl) return;
//     const msg = makeLocalMsg("voice", { audioData: recordedAudioUrl });
//     audioBlobCache.current[msg.id] = recordedAudioUrl;
//     setMessages((p) => saveMessages([...p, msg]));
//     setRecordedAudioUrl(null); setRecordingTime(0);
//   };

//   // ── Files ──
//   const handleFileSelect = (e) => {
//     const files = Array.from(e.target.files || []);
//     setSelectedFiles(files);
//     if (files[0]) setFilePreview({ name: files[0].name, size: (files[0].size / 1024 / 1024).toFixed(2), type: files[0].type });
//   };

//   // Send files — local only, no Supabase insert
//   const sendFiles = () => {
//     for (const file of selectedFiles) {
//       const reader = new FileReader();
//       reader.onload = () => {
//         const msg = makeLocalMsg("file", {
//           fileName: file.name,
//           fileSize: file.size,
//           fileType: file.type,
//           fileData: reader.result.split(",")[1],
//           caption: fileCaption || null,
//         });
//         setMessages((p) => saveMessages([...p, msg]));
//       };
//       reader.readAsDataURL(file);
//     }
//     setSelectedFiles([]); setFilePreview(null); setFileCaption("");
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   const downloadFile = (msg) => {
//     const a = document.createElement("a");
//     a.href = `data:${msg.fileType};base64,${msg.fileData}`;
//     a.download = msg.fileName;
//     document.body.appendChild(a); a.click(); document.body.removeChild(a);
//   };

//   // ── Text — local only, no Supabase insert ──
//   const sendMessage = (e) => {
//     if (e) e.preventDefault();
//     if (!input.trim()) return;
//     const msg = makeLocalMsg("text", { message: input });
//     setMessages((p) => saveMessages([...p, msg]));
//     setInput("");
//   };

//   // ── Delete — only removes from local state/localStorage ──
//   const deleteMsg = (id) => {
//     setMessages((p) => saveMessages(p.filter((m) => m.id !== id)));
//     setRevealedDelete((p) => { const n = { ...p }; delete n[id]; return n; });
//   };

//   const holdStart = (id) => { holdTimers.current[id] = setTimeout(() => setRevealedDelete((p) => ({ ...p, [id]: true })), 2000); };
//   const holdEnd = (id) => { clearTimeout(holdTimers.current[id]); delete holdTimers.current[id]; };

//   const dark = isDarkMode;
//   const bg = dark ? "bg-[#0d0d0d]" : "bg-[#f5f0ea]";
//   const chatBg = dark ? "bg-[#111]" : "bg-white";
//   const inputCls = dark
//     ? "bg-[#111] border-white/10 text-white placeholder-gray-600 focus:border-amber-400/50"
//     : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400";
//   const textCls = dark ? "text-white" : "text-gray-900";
//   const subCls = dark ? "text-gray-400" : "text-gray-500";

//   const Bubble = ({ msg }) => {
//     const isOwn = msg.senderId === me;
//     const key = msg.id;
//     const showDel = revealedDelete[key];
//     const holdProps = {
//       onMouseDown: () => holdStart(key), onMouseUp: () => holdEnd(key), onMouseLeave: () => holdEnd(key),
//       onTouchStart: () => holdStart(key), onTouchEnd: () => holdEnd(key),
//     };
//     const bubbleCls = `max-w-xs lg:max-w-md rounded-2xl px-4 py-3 text-sm shadow select-none cursor-pointer ${
//       isOwn ? "bg-amber-400 text-black" : dark ? "bg-[#1e1e1e] text-white" : "bg-gray-100 text-gray-900"
//     }`;
//     const audioSrc = audioBlobCache.current[key] || msg.audioData || null;

//     return (
//       <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
//         <div className="flex flex-col" style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
//           <div {...holdProps}>
//             {msg.type === "text" && (
//               <div className={bubbleCls}>
//                 <p className="break-words">{msg.message}</p>
//                 <p className="text-xs opacity-60 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
//               </div>
//             )}
//             {msg.type === "voice" && (
//               <div className={bubbleCls}>
//                 <div className="flex items-center gap-3">
//                   <button
//                     onClick={() => {
//                       if (!audioSrc) return;
//                       const audio = new Audio(audioSrc);
//                       if (playingId === key) { setPlayingId(null); }
//                       else { setPlayingId(key); audio.play(); audio.onended = () => setPlayingId(null); }
//                     }}
//                     className="p-2 rounded-full bg-black/10 hover:bg-black/20 transition"
//                   >
//                     {playingId === key ? <Pause size={14} /> : <Play size={14} />}
//                   </button>
//                   <div className="flex-1 h-1.5 bg-black/10 rounded-full" />
//                   {!audioSrc && <span className="text-xs opacity-50">Audio unavailable</span>}
//                 </div>
//                 <p className="text-xs opacity-60 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
//               </div>
//             )}
//             {msg.type === "file" && (
//               <div className={bubbleCls}>
//                 {msg.fileType?.startsWith("image/") && msg.fileData && (
//                   <img src={`data:${msg.fileType};base64,${msg.fileData}`} alt={msg.fileName} className="w-full rounded-xl mb-2 max-h-56 object-cover" />
//                 )}
//                 {msg.fileType?.startsWith("video/") && msg.fileData && (
//                   <video src={`data:${msg.fileType};base64,${msg.fileData}`} controls className="w-full rounded-xl mb-2 max-h-56" />
//                 )}
//                 {!msg.fileType?.startsWith("image/") && !msg.fileType?.startsWith("video/") && (
//                   <div className="flex items-center gap-2 mb-2">
//                     <File size={20} />
//                     <div className="flex-1 min-w-0">
//                       <p className="text-xs font-semibold truncate">{msg.fileName}</p>
//                       <p className="text-xs opacity-70">{(msg.fileSize / 1024 / 1024).toFixed(2)} MB</p>
//                     </div>
//                     <button onClick={() => downloadFile(msg)} className="p-1 rounded-lg bg-black/10"><Download size={14} /></button>
//                   </div>
//                 )}
//                 {msg.caption && <p className="text-sm">{msg.caption}</p>}
//                 <p className="text-xs opacity-60 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
//               </div>
//             )}
//           </div>
//           {showDel && (
//             <button onClick={() => deleteMsg(key)} className="mt-1 flex items-center gap-1 px-3 py-1 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all">
//               <Trash2 size={11} /> Delete
//             </button>
//           )}
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className={`w-full h-screen flex flex-col ${bg}`}>
//       {/* Header */}
//       <header className={`h-14 flex items-center gap-3 px-4 border-b ${dark ? "bg-[#0d0d0d] border-white/5" : "bg-white border-gray-200"}`}>
//         <button onClick={onClose} className={`p-2 rounded-xl ${dark ? "hover:bg-white/5" : "hover:bg-gray-100"} transition-all`}>
//           <ArrowLeft size={18} className={textCls} />
//         </button>
//         <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-sm shrink-0">
//           {targetUser?.avatar_url
//             ? <img src={targetUser.avatar_url} alt="" className="w-full h-full object-cover" />
//             : targetUser?.username?.[0]?.toUpperCase()
//           }
//         </div>
//         <div className="flex-1 min-w-0">
//           <p className={`font-bold text-sm ${textCls} truncate`}>@{targetUser?.username}</p>
//           <p className={`text-xs ${subCls} truncate`}>{targetUser?.surname} {targetUser?.other_name}</p>
//         </div>
//         <button
//           onClick={onGoToPantweet}
//           className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold transition-all hover:bg-amber-400/20"
//         >
//           <Rss size={12} />
//           <span className="hidden sm:inline">PanTweet</span>
//           {newPantweetCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />}
//         </button>
//       </header>

//       {/* Messages */}
//       <div className={`flex-1 overflow-y-auto p-4 ${chatBg}`}>
//         {messages.length === 0 && (
//           <div className={`text-center mt-20 ${subCls} text-sm`}>
//             <p>No messages yet.</p>
//             <p className="opacity-60">Say hello to @{targetUser?.username} 👋</p>
//           </div>
//         )}
//         {messages.map((msg, i) => <Bubble key={msg.id || i} msg={msg} />)}
//         <div ref={messagesEndRef} />
//       </div>

//       {/* File preview with caption */}
//       {filePreview && (
//         <div className={`px-4 py-2 border-t ${dark ? "bg-[#1a1a1a] border-white/5" : "bg-gray-50 border-gray-200"}`}>
//           <div className="flex items-center gap-2 mb-2">
//             {filePreview.type?.startsWith("image/") && selectedFiles[0] ? (
//               <img src={URL.createObjectURL(selectedFiles[0])} alt="" className="w-14 h-10 object-cover rounded-lg" />
//             ) : (
//               <File size={18} className="text-amber-400" />
//             )}
//             <div className="flex-1 min-w-0">
//               <p className={`text-xs font-semibold truncate ${textCls}`}>{filePreview.name}</p>
//               <p className={`text-xs ${subCls}`}>{filePreview.size} MB</p>
//             </div>
//             <button onClick={() => { setFilePreview(null); setSelectedFiles([]); setFileCaption(""); }} className={`${subCls} hover:text-red-400 transition-all`}>
//               <X size={14} />
//             </button>
//           </div>
//           <input
//             value={fileCaption}
//             onChange={(e) => setFileCaption(e.target.value)}
//             placeholder="Add a caption…"
//             className={`w-full border rounded-xl px-3 py-1.5 text-sm outline-none ${inputCls}`}
//           />
//         </div>
//       )}

//       {/* Recording indicator */}
//       {isRecording && (
//         <div className={`px-4 py-2 flex items-center gap-2 border-t ${dark ? "bg-[#1a1a1a] border-white/5" : "bg-amber-50 border-amber-100"}`}>
//           <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
//           <span className="text-xs font-bold text-amber-600">Recording: {fmtTime(recordingTime)}</span>
//         </div>
//       )}

//       {/* Voice preview */}
//       {recordedAudioUrl && (
//         <div className={`px-4 py-2 flex items-center justify-between border-t ${dark ? "bg-[#1a1a1a] border-white/5" : "bg-amber-50 border-amber-100"}`}>
//           <span className="text-xs font-bold text-amber-600">🎙 Voice ready</span>
//           <button onClick={() => setRecordedAudioUrl(null)} className={subCls}><X size={14} /></button>
//         </div>
//       )}

//       {/* Input bar */}
//       <div className={`px-4 py-3 border-t ${dark ? "bg-[#0d0d0d] border-white/5" : "bg-white border-gray-200"}`}>
//         <div className="flex gap-2 items-end">
//           <button
//             onClick={() => fileInputRef.current?.click()}
//             className={`p-2.5 rounded-xl border transition-all ${dark ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
//           >
//             <FileUp size={15} />
//           </button>
//           <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />

//           <textarea
//             value={input}
//             onChange={(e) => setInput(e.target.value)}
//             onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
//             placeholder="Message…"
//             rows={1}
//             className={`flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-all ${inputCls}`}
//           />

//           {!recordedAudioUrl && (
//             <button
//               onClick={isRecording ? stopRecording : startRecording}
//               className={`p-2.5 rounded-xl transition-all ${isRecording ? "bg-amber-400 text-black" : dark ? "border border-white/10 text-gray-400 hover:bg-white/5" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}
//             >
//               {isRecording ? <Square size={15} /> : <Mic size={15} />}
//             </button>
//           )}

//           {(recordedAudioUrl || selectedFiles.length > 0 || input.trim()) && (
//             <button
//               onClick={recordedAudioUrl ? sendVoice : selectedFiles.length > 0 ? sendFiles : sendMessage}
//               className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black transition-all"
//             >
//               <Send size={15} />
//             </button>
//           )}
//         </div>
//       </div>

//       <style>{`@keyframes dmFadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}`}</style>
//     </div>
//   );
// }

