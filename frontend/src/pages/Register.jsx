import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { Planet, ArrowRight } from "@phosphor-icons/react";

export default function Register() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      await signUp(form);
      nav("/dashboard");
    } catch (e2) { setErr(formatApiError(e2)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="register-page">
      <div className="relative hidden lg:block overflow-hidden border-r border-[#2A2D35]">
        <img src="https://images.unsplash.com/photo-1762279388979-6a430989284c" alt="abstract data" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-[#090A0C]/70" />
        <div className="relative z-10 h-full p-12 flex flex-col justify-between">
          <Link to="/" className="flex items-center gap-3 w-fit">
            <div className="w-7 h-7 bg-[#0047FF] flex items-center justify-center"><Planet size={16} weight="fill" /></div>
            <div className="font-sans font-black text-sm tracking-tight">IBP ANALYTICS</div>
          </Link>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#0047FF] mb-6">— new account</div>
            <div className="text-4xl font-black tracking-tighter leading-tight max-w-md">
              Join the <span className="text-[#0047FF]">space-weather</span> operators building the next generation of GNSS tooling.
            </div>
            <div className="mt-6 mono text-xs text-[#8B93A5] max-w-md leading-relaxed">
              All features — sweeps, experiments, world-map, share links, API keys — are free for every logged-in user.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 md:px-12 py-16 bg-[#090A0C]">
        <div className="w-full max-w-md">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— register</div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Create your research account.</h1>
          <p className="mono text-xs text-[#8B93A5] mb-10">
            Already have one? <Link className="text-white underline underline-offset-4" to="/login" data-testid="switch-to-login">Sign in instead.</Link> All features are free while logged in.
          </p>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Name">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="register-name"
                className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-12 mono text-sm" />
            </Field>
            <Field label="Email">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="register-email"
                className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-12 mono text-sm" />
            </Field>
            <Field label="Password (min 6)">
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                data-testid="register-password"
                className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-4 h-12 mono text-sm" />
            </Field>
            {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2" data-testid="register-error">{err}</div>}
            <button type="submit" disabled={loading} data-testid="register-submit" className="w-full h-12 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              {loading ? "Creating..." : <>Create account <ArrowRight size={14} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
