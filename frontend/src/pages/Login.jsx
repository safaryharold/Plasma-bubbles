import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { Planet, ArrowRight } from "@phosphor-icons/react";

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@ibp.dev");
  const [password, setPassword] = useState("admin123");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      await signIn(email, password, remember);
      nav("/dashboard");
    } catch (e2) {
      setErr(formatApiError(e2));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">
      {/* left hero */}
      <div className="relative hidden lg:block overflow-hidden border-r border-[#2A2D35]">
        <img
          src="https://images.pexels.com/photos/30596239/pexels-photo-30596239.jpeg"
          alt="Earth at night"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#090A0C] via-transparent to-[#090A0C]/80" />
        <div className="relative z-10 h-full p-12 flex flex-col justify-between">
          <Link to="/" className="flex items-center gap-3 w-fit">
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center"><Planet size={16} weight="fill" /></div>
            <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
          </Link>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#0047FF] mb-6">— command center</div>
            <div className="text-4xl font-black tracking-tighter leading-tight max-w-md">
              Forecast the <span className="text-[#0047FF]">unseen</span> turbulence of Earth's upper atmosphere.
            </div>
            <div className="mt-6 mono text-xs text-[#8B93A5] max-w-md leading-relaxed">
              Log in to run parameter sweeps, compare scenarios, and export reproducible datasets.
            </div>
          </div>
        </div>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center px-6 md:px-12 py-16 bg-[#090A0C]">
        <div className="w-full max-w-md">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— sign in</div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Access the console.</h1>
          <p className="mono text-xs text-[#8B93A5] mb-10">
            Use the seeded admin account or <Link className="text-white underline underline-offset-4" to="/register" data-testid="switch-to-register">create a researcher account</Link>.
          </p>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="mt-2 w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-12 mono text-sm"
                required
              />
            </div>
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="mt-2 w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-12 mono text-sm"
                required
              />
            </div>
            {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="login-error">{err}</div>}

            <label className="flex items-center gap-3 cursor-pointer select-none group" data-testid="login-remember-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                data-testid="login-remember"
                className="peer sr-only"
              />
              <span className="w-4 h-4 border border-[#2A2D35] bg-[#090A0C] peer-checked:bg-[#0047FF] peer-checked:border-[#0047FF] grid place-items-center transition-colors">
                <span className="w-1.5 h-1.5 bg-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] group-hover:text-white transition-colors">
                Remember me for 7 days
              </span>
            </label>

            <button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-12 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              {loading ? "Authenticating..." : <>Sign in <ArrowRight size={14} /></>}
            </button>
          </form>
          <div className="mt-10 border-t border-[#2A2D35] pt-6 mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">
            Seeded admin: admin@ibp.dev / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
