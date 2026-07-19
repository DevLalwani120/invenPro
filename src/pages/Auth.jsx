import { useState } from "react";
import { Package, Eye, EyeOff } from "lucide-react";
import { login, forgotPassword } from "../firebase/auth";

export default function Auth() {
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found"     ||
        err.code === "auth/wrong-password"
          ? "Invalid email or password"
          : err.code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : err.message
      );
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess("Password reset email sent! Check your inbox.");
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center mb-4 shadow-xl">
            <Package size={32} className="text-teal-300"/>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{fontFamily:"'Syne',sans-serif"}}>InvenPro</h1>
          <p className="text-slate-400 text-sm mt-1">Inventory Management System</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 shadow-2xl p-8">

          {mode === "login" && (
            <>
              <h2 className="text-white font-bold text-xl mb-6" style={{fontFamily:"'Syne',sans-serif"}}>Sign In</h2>
              {error   && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}
              {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{success}</div>}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Email</label>
                  <input required type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="your@email.com" autoComplete="email" className={inputCls}/>
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Password</label>
                  <div className="relative">
                    <input required type={showPwd?"text":"password"} value={password}
                      onChange={e=>setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password"
                      className={`${inputCls} pr-12`}/>
                    <button type="button" onClick={()=>setShowPwd(v=>!v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                      {showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:shadow-lg hover:shadow-teal-500/20"
                  style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <button onClick={()=>{ setMode("forgot"); setError(""); setSuccess(""); }}
                className="w-full text-center mt-4 text-slate-400 hover:text-teal-300 text-sm transition-colors">
                Forgot password?
              </button>
            </>
          )}

          {mode === "forgot" && (
            <>
              <h2 className="text-white font-bold text-xl mb-2" style={{fontFamily:"'Syne',sans-serif"}}>Reset Password</h2>
              <p className="text-slate-400 text-sm mb-6">Enter your email and we'll send a reset link.</p>
              {error   && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}
              {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{success}</div>}

              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Email</label>
                  <input required type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="your@email.com" className={inputCls}/>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60"
                  style={{background:"linear-gradient(135deg,#0f766e,#0d9488)"}}>
                  {loading ? "Sending…" : "Send Reset Email"}
                </button>
              </form>

              <button onClick={()=>{ setMode("login"); setError(""); setSuccess(""); }}
                className="w-full text-center mt-4 text-slate-400 hover:text-teal-300 text-sm transition-colors">
                ← Back to Sign In
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Don't have an account? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
