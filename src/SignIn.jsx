import { useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../supabaseClient";
import { normalizePhone } from "./phone";
import { GuidelinesSheet, GUIDELINES_VERSION } from "./Guidelines";
import { Eye, EyeOff, Lock, Phone, AtSign, ChevronRight, CheckCircle, Shield } from "lucide-react";

export default function SignIn({ onGoToAdmin }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealMsg, setAppealMsg] = useState("");

  // Login form
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  // Register form
  const [regData, setRegData] = useState({
    surname: "",
    other_name: "",
    username: "",
    password: "",
    phone: "",
    display_name: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(loginData.username, loginData.password);
    setLoading(false);
    setSuspended(!!res.suspended);
    setAppealMsg("");
    if (res.error) setError(res.error);
    // On success AuthContext sets currentUser and App routes to PanTweet.
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!regData.surname || !regData.other_name || !regData.username || !regData.password || !regData.phone.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (regData.username.includes(" ")) {
      setError("Username cannot contain spaces.");
      return;
    }
    if (regData.username.length > 30) {
      setError("Username can be at most 30 characters.");
      return;
    }
    if (regData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const phoneRes = normalizePhone(regData.phone);
    if (phoneRes.error) {
      setError(phoneRes.error);
      return;
    }
    const phone = phoneRes.value;
    if (regData.display_name.trim() && regData.display_name.trim().length < 2) {
      setError("Display name needs at least 2 characters.");
      return;
    }
    if (!agree) {
      setError("Please confirm that you are 18 or older and agree to the Community Guidelines.");
      return;
    }
    setLoading(true);

    // AuthContext checks the username / phone, creates the account and signs the user in.
    const { error: err } = await register({ ...regData, phone, phoneRaw: regData.phone.trim(), guidelines_version: GUIDELINES_VERSION });
    setLoading(false);
    if (err) setError(err);
    // On success AuthContext sets currentUser and App routes to PanTweet.
  };

  return (
    <div className="h-screen w-full flex bg-[#0d0d0d] font-sans">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center bg-linear-to-br from-amber-500/10 via-[#0d0d0d] to-amber-900/10 border-r border-white/5 p-12">
        <img src="/panda.png" alt="Pandora" className="w-24 mb-6 drop-shadow-2xl" />
        <h1 className="text-5xl font-black text-white tracking-tight mb-3">
          Pan<span className="text-amber-400">dora</span>
        </h1>
        <p className="text-gray-400 text-center text-sm leading-relaxed max-w-xs">
          Share moments that matter — before they fade.
        </p>
             <p className="text-gray-400 text-center text-sm leading-relaxed max-w-xs">
          Be connected — share.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-xs">
          {["PanTweet", "Following"].map((f) => (
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
            <img src="/panda.png" alt="" className="w-8" />
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
          {suspended && (
            <div className="mb-4 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 space-y-2">
              <p className="font-bold text-white">Think this is a mistake? Send an appeal.</p>
              <textarea
                value={appealText} onChange={(e) => setAppealText(e.target.value)} rows={3}
                placeholder="Explain why your account should be restored…"
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600"
              />
              <button
                type="button"
                disabled={appealText.trim().length < 5}
                onClick={async () => {
                  const { error: e } = await supabase.rpc("public_appeal", { p_username: loginData.username.trim(), p_message: appealText.trim() });
                  setAppealMsg(e ? e.message : "Appeal sent. We will review it.");
                }}
                className="w-full py-2 bg-amber-400 text-black font-bold rounded-xl disabled:opacity-50"
              >
                Send appeal
              </button>
              {appealMsg && <p className="text-xs text-amber-400">{appealMsg}</p>}
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
                placeholder="Display name (optional, shown instead of your real name)"
                value={regData.display_name}
                onChange={(v) => setRegData((p) => ({ ...p, display_name: v.slice(0, 30) }))}
              />
              <Field
                icon={<Phone size={15} />}
                placeholder="Phone with country code, e.g. +1 555 010 9999 *"
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
              <label className="flex items-start gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                <span>
                  I am 18 or older and I agree to the{" "}
                  <button type="button" onClick={() => setShowGuidelines(true)} className="text-amber-400 underline">Community Guidelines</button>.
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Your account is ready as soon as you register. You will be signed in right away.
              </p>
            </form>
          )}

          <p className="text-xs text-gray-600 text-center mt-8">
               Created by Cyberhowl (Explore $Update)
            {/* Created by Cyberhowl (Alkali Jesse Uchubiyojo) */}
          </p>
          <p className="text-center mt-2">
            <button type="button" onClick={() => setShowGuidelines(true)} className="text-xs text-gray-500 underline">Community Guidelines</button>
          </p>
        </div>
      </div>
      {showGuidelines && <GuidelinesSheet onClose={() => setShowGuidelines(false)} />}
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
