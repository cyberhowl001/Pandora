import { useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../supabaseClient";
import { Eye, EyeOff, Lock, Phone, AtSign, ChevronRight, CheckCircle, Shield } from "lucide-react";

// "+234 801 234 5678", "0801-234-5678" and "2348012345678" all count as the same number
const normalizePhone = (p) => {
  let d = p.trim().replace(/[^\d+]/g, "");
  if (d.startsWith("+234")) d = "0" + d.slice(4);
  else if (d.startsWith("234")) d = "0" + d.slice(3);
  return d.replace(/\D/g, "");
};

export default function SignIn({ onGoToAdmin }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  // Register form
  const [regData, setRegData] = useState({
    surname: "",
    other_name: "",
    username: "",
    password: "",
    phone: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await login(loginData.username, loginData.password);
    setLoading(false);
    if (err) setError(err);
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
    const phone = normalizePhone(regData.phone);
    if (phone.length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);

    // One account per phone number
    const { data: phoneUsed } = await supabase
      .from("users")
      .select("id")
      .in("phone", [phone, regData.phone.trim()])
      .limit(1);
    if (phoneUsed && phoneUsed.length > 0) {
      setError("This number has already been used.");
      setLoading(false);
      return;
    }

    // Check username uniqueness
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", regData.username)
      .maybeSingle();

    if (existing) {
      setError("Username already taken. Choose another.");
      setLoading(false);
      return;
    }

    // Create the account: active immediately, no admin approval needed
    const { error: insertErr } = await supabase.from("users").insert([{
      surname: regData.surname,
      other_name: regData.other_name,
      username: regData.username,
      password_hash: regData.password, // In production: hash via Edge Fn
      phone,
      status: "accepted",
    }]);

    if (insertErr) {
      setError(insertErr.code === "23505" && /phone/i.test(insertErr.message || "") ? "This number has already been used." : "Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    // Notify admin
    const { data: newUser } = await supabase
      .from("users")
      .select("id")
      .eq("username", regData.username)
      .maybeSingle();

    if (newUser) {
      await supabase.from("admin_notifications").insert([{
        type: "new_user",
        ref_id: newUser.id,
        message: `New account created: @${regData.username}`,
      }]);
    }

    setLoading(false);
    setSuccess(
      "Account created! You can log in now."
    );
    setLoginData({ username: regData.username, password: "" });
    setMode("login");
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
                icon={<Phone size={15} />}
                placeholder="Phone number *"
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
                {loading ? "Creating account…" : "Create Account"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Your account is ready as soon as you register. You can sign in right away.
              </p>
            </form>
          )}

          <p className="text-xs text-gray-600 text-center mt-8">
               Created by Cyberhowl (Explore $Update)
            {/* Created by Cyberhowl (Alkali Jesse Uchubiyojo) */}
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