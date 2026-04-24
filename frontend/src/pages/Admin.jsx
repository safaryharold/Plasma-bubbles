import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => {
    Promise.all([
      api.get("/admin/users").then((r) => setUsers(r.data)),
      api.get("/admin/stats").then((r) => setStats(r.data)),
    ]).catch((e) => setErr(formatApiError(e)));
  };
  useEffect(() => { load(); }, []);

  const setRole = async (id, role) => {
    try { await api.post(`/admin/users/${id}/role`, { role }); load(); }
    catch (e) { setErr(formatApiError(e)); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#FF3333] mb-3">— admin</div>
        <h1 className="text-3xl font-black tracking-tight">Platform Administration</h1>
      </div>
      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2">{err}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 border border-[#2A2D35]" data-testid="admin-stats">
          {[
            ["Users", stats.users], ["Jobs total", stats.jobs_total],
            ["Completed", stats.jobs_completed, "text-[#00E599]"],
            ["Failed", stats.jobs_failed, "text-[#FF3333]"],
            ["Experiments", stats.experiments], ["API keys", stats.api_keys],
          ].map((s, i) => (
            <div key={i} className="p-4 border-r last:border-r-0 border-[#2A2D35]">
              <div className={`font-sans font-black text-2xl tracking-tight ${s[2] || ''}`}>{s[1]}</div>
              <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mt-1">{s[0]}</div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-[#2A2D35]" data-testid="admin-users">
        <div className="grid grid-cols-12 px-6 h-10 items-center border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">
          <div className="col-span-3">Email</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1 text-center">Usage</div>
          <div className="col-span-3 text-right">Role</div>
        </div>
        {users.map((u) => (
          <div key={u.id} className="grid grid-cols-12 items-center px-6 py-3 border-b last:border-b-0 border-[#2A2D35] mono text-xs" data-testid={`admin-user-row-${u.id}`}>
            <div className="col-span-3 font-bold">{u.email}</div>
            <div className="col-span-3 text-[#8B93A5]">{u.name}</div>
            <div className="col-span-2 text-[#565D6D]">{new Date(u.created_at).toLocaleDateString()}</div>
            <div className="col-span-1 text-center">{u.usage_count}</div>
            <div className="col-span-3 flex justify-end">
              <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}
                data-testid={`role-select-${u.id}`}
                className="bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-2 h-8 mono text-xs">
                <option value="researcher">researcher</option>
                <option value="pro">pro</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
