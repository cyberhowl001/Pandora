import { useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../supabaseClient";
import { Eye, EyeOff, Upload, Lock, Phone, AtSign, ChevronRight, CheckCircle, Shield } from "lucide-react";

export default function SignIn({ onSuccess, onGoToAdmin }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef(null);

  // Login form
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  // Register form
  const [regData, setRegData] = useState({
    surname: "",
    other_name: "",
    username: "",
    password: "",
    phone: "",
    avatar: null,
    avatarPreview: null,
  });

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setRegData((p) => ({ ...p, avatar: file, avatarPreview: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: err } = await login(loginData.username, loginData.password);
    setLoading(false);
    if (err) { setError(err); return; }
    onSuccess?.();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!regData.surname || !regData.other_name || !regData.username || !regData.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (regData.username.includes(" ")) {
      setError("Username cannot contain spaces.");
      return;
    }
    setLoading(true);

    // Check username uniqueness
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", regData.username)
      .single();

    if (existing) {
      setError("Username already taken. Choose another.");
      setLoading(false);
      return;
    }

    // Convert avatar to base64 if provided
    let avatarUrl = null;
    if (regData.avatar) {
      avatarUrl = regData.avatarPreview; // base64 string
    }

    // Insert pending user
    const { error: insertErr } = await supabase.from("users").insert([{
      surname: regData.surname,
      other_name: regData.other_name,
      username: regData.username,
      password_hash: regData.password, // In production: hash via Edge Fn
      phone: regData.phone,
      avatar_url: avatarUrl,
      status: "pending",
    }]);

    if (insertErr) {
      setError("Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    // Notify admin
    const { data: newUser } = await supabase
      .from("users")
      .select("id")
      .eq("username", regData.username)
      .single();

    if (newUser) {
      await supabase.from("admin_notifications").insert([{
        type: "new_user",
        ref_id: newUser.id,
        message: `New registration request from @${regData.username}`,
      }]);
    }

    setLoading(false);
    setSuccess(
      "Registration submitted! Please wait for admin approval before logging in."
    );
    setMode("login");
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0d0d0d] font-sans">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center bg-gradient-to-br from-amber-500/10 via-[#0d0d0d] to-amber-900/10 border-r border-white/5 p-12">
        <img src="panda.png" alt="Pandora" className="w-24 mb-6 drop-shadow-2xl" />
        <h1 className="text-5xl font-black text-white tracking-tight mb-3">
          Pan<span className="text-amber-400">dora</span>
        </h1>
        <p className="text-gray-400 text-center text-sm leading-relaxed max-w-xs">
          Connect. Chat. Share moments that matter — before they fade.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-xs">
          {["Group Chat", "PanTweet", "Direct DMs", "Following"].map((f) => (
            <div key={f} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-gray-300 font-medium text-center">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="panda.png" alt="" className="w-8" />
            <span className="text-white font-black text-2xl">
              Pan<span className="text-amber-400">dora</span>
            </span>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/10 gap-1">
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                mode === "login" ? "bg-amber-400 text-black shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                mode === "register" ? "bg-amber-400 text-black shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Register
            </button>
            <button
              onClick={() => onGoToAdmin?.()}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20"
              title="Admin Portal"
            >
              <Shield size={14} />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-start gap-2">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field
                icon={<AtSign size={15} />}
                placeholder="Username"
                value={loginData.username}
                onChange={(v) => setLoginData((p) => ({ ...p, username: v }))}
              />
              <PasswordField
                value={loginData.password}
                onChange={(v) => setLoginData((p) => ({ ...p, password: v }))}
                show={showPassword}
                toggle={() => setShowPassword((p) => !p)}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Signing in…" : <>Sign In <ChevronRight size={16} /></>}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              {/* Avatar picker */}
              <div className="flex flex-col items-center mb-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-amber-400/40 flex items-center justify-center cursor-pointer overflow-hidden hover:border-amber-400 transition-all"
                >
                  {regData.avatarPreview ? (
                    <img src={regData.avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-amber-400/60" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                <p className="text-xs text-gray-500 mt-1">Profile picture (optional)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field placeholder="Surname *" value={regData.surname} onChange={(v) => setRegData((p) => ({ ...p, surname: v }))} />
                <Field placeholder="Other name *" value={regData.other_name} onChange={(v) => setRegData((p) => ({ ...p, other_name: v }))} />
              </div>
              <Field
                icon={<AtSign size={15} />}
                placeholder="Username * (no spaces)"
                value={regData.username}
                onChange={(v) => setRegData((p) => ({ ...p, username: v.replace(/\s/g, "") }))}
              />
              <Field
                icon={<Phone size={15} />}
                placeholder="Phone number"
                value={regData.phone}
                onChange={(v) => setRegData((p) => ({ ...p, phone: v }))}
                type="tel"
              />
              <PasswordField
                value={regData.password}
                onChange={(v) => setRegData((p) => ({ ...p, password: v }))}
                show={showPassword}
                toggle={() => setShowPassword((p) => !p)}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Request Account"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                After registering, your account needs admin approval before you can sign in.
              </p>
            </form>
          )}

          <p className="text-xs text-gray-600 text-center mt-8">
            Created by Cyberhowl (Alkali Jesse Uchubiyojo)
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange, type = "text" }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-amber-400/50 transition-all">
      {icon && <span className="text-gray-500 shrink-0">{icon}</span>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
      />
    </div>
  );
}

function PasswordField({ value, onChange, show, toggle }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-amber-400/50 transition-all">
      <Lock size={15} className="text-gray-500 shrink-0" />
      <input
        type={show ? "text" : "password"}
        placeholder="Password *"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
      />
      <button type="button" onClick={toggle} className="text-gray-500 hover:text-amber-400 transition-colors">
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}