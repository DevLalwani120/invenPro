import { useState } from "react";
import { Package, Eye, EyeOff, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { login, signup, forgotPassword } from "../firebase/auth";

export default function Auth() {
  const [mode,     setMode]     = useState("login"); // login | signup | forgot
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const reset = () => { setError(""); setSuccess(""); };

  const friendlyError = (code) => {
    switch (code) {
      case "auth/user-not-found":       return "No account found with this email.";
      case "auth/wrong-password":       return "Incorrect password. Try again.";
      case "auth/email-already-in-use": return "This email is already registered. Please login.";
      case "auth/weak-password":        return "Password must be at least 6 characters.";
      case "auth/invalid-email":        return "Please enter a valid email address.";
      case "auth/too-many-requests":    return "Too many attempts. Please try again later.";
      case "auth/invalid-credential":   return "Incorrect email or password.";
      default:                          return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        // App.jsx will detect auth change and redirect automatically
      } else if (mode === "signup") {
        await signup(email, password, name);
      } else if (mode === "forgot") {
        await forgotPassword(email);
        setSuccess("Password reset email sent! Check your inbox.");
        setEmail("");
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white transition-colors";

  return (
    <div className="min-h-screen flex" style={{fontFamily:"'DM Sans',sans-serif"}}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{background:"linear-gradient(160deg,#0f2027,#203a43,#0f766e)"}}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-400/20 flex items-center justify-center">
            <Package size={20} className="text-teal-300"/>
          </div>
          <span className="text-white font-bold text-2xl" style={{fontFamily:"'Syne',sans-serif"}}>InvenPro</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{fontFamily:"'Syne',sans-serif"}}>
            Manage your inventory<br/>with confidence.
          </h1>
          <p className="text-teal-200/70 text-base leading-relaxed">
            Track items, batches, expiry dates and get automatic email alerts every morning.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label:"Items Tracked",  value:"∞" },
              { label:"Daily Alerts",   value:"9 AM" },
              { label:"Always Free",    value:"₹0" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/8 rounded-2xl p-4 border border-white/10">
                <p className="text-white font-bold text-2xl">{value}</p>
                <p className="text-teal-300/70 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">© 2025 InvenPro. Built with Firebase + React.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Logo on mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
              <Package size={16} className="text-white"/>
            </div>
            <span className="font-bold text-xl text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>InvenPro</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

            {/* Back button for forgot password */}
            {mode === "forgot" && (
              <button onClick={()=>{ setMode("login"); reset(); }}
                className="flex items-center gap-1.5 text-slate-500 text-sm hover:text-slate-700 mb-5 transition-colors">
                <ArrowLeft size={15}/> Back to login
              </button>
            )}

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800" style={{fontFamily:"'Syne',sans-serif"}}>
                {mode === "login"  ? "Welcome back"      :
                 mode === "signup" ? "Create account"    :
                                    "Reset password"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {mode === "login"  ? "Sign in to your InvenPro account"       :
                 mode === "signup" ? "Set up your inventory management system" :
                                    "We'll send a reset link to your email"}
              </p>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                {success}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name — signup only */}
              {mode === "signup" && (
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input required value={name} onChange={e=>setName(e.target.value)}
                    placeholder="Full name" className={inputCls}/>
                </div>
              )}

              {/* Email */}
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input required type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="Email address" className={inputCls}/>
              </div>

              {/* Password — not on forgot */}
              {mode !== "forgot" && (
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input required type={showPass?"text":"password"}
                    value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder={mode==="signup" ? "Create password (min 6 chars)" : "Password"}
                    className={`${inputCls} pr-10`}/>
                  <button type="button" onClick={()=>setShowPass(s=>!s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              )}

              {/* Forgot password link */}
              {mode === "login" && (
                <div className="flex justify-end">
                  <button type="button" onClick={()=>{ setMode("forgot"); reset(); }}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold shadow-lg
                  hover:shadow-xl transition-all hover:-translate-y-0.5
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
                {loading ? "Please wait…" :
                 mode === "login"  ? "Sign In"         :
                 mode === "signup" ? "Create Account"  :
                                    "Send Reset Email"}
              </button>
            </form>

            {/* Switch mode */}
            {mode !== "forgot" && (
              <p className="text-center text-sm text-slate-500 mt-5">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={()=>{ setMode(mode==="login"?"signup":"login"); reset(); }}
                  className="text-teal-600 font-semibold hover:text-teal-700 transition-colors">
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}