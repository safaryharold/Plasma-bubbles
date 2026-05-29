import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Copy, Plus, Prohibit } from "@phosphor-icons/react";
import { CardSkeleton } from "../components/Skeleton";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("default");
  const [created, setCreated] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.get("/keys");
      setKeys(data);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(null); setCreated(null);
    try {
      const { data } = await api.post("/keys", { name });
      setCreated(data);
      load();
    } catch (e) { setErr(formatApiError(e)); }
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this API key?")) return;
    try { await api.post(`/keys/${id}/revoke`); load(); }
    catch (e) { setErr(formatApiError(e)); }
  };

  const copy = (text) => { navigator.clipboard?.writeText(text); };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="apikeys-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— programmatic access</div>
        <h1 className="text-3xl font-black tracking-tight">API Keys</h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          Use an API key in the <span className="text-white">x-api-key</span> header to call any endpoint from a pipeline.
        </p>
      </div>

      <div className="border border-[#2A2D35] p-6 flex items-end gap-4" data-testid="apikeys-create">
        <div className="flex-1">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D] mb-2">Key name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} data-testid="key-name-input"
            className="w-full bg-[#090A0C] border border-[#2A2D35] focus:border-[#0047FF] outline-none px-3 h-11 mono text-sm" />
        </div>
        <button onClick={create} data-testid="create-key-btn"
          className="h-11 px-5 bg-[#0047FF] hover:bg-[#336DFF] text-white mono text-xs uppercase tracking-[0.25em] flex items-center gap-2 transition-colors">
          <Plus size={14} weight="bold" /> Generate
        </button>
      </div>

      {created && (
        <div className="border border-[#00E599]/50 bg-[#00E599]/5 p-4" data-testid="apikey-revealed">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#00E599] mb-2">— key created • save this now, it is shown only once</div>
          <div className="flex items-center gap-2">
            <code className="mono text-xs bg-[#090A0C] border border-[#2A2D35] px-3 py-2 flex-1 break-all">{created.raw_key}</code>
            <button onClick={() => copy(created.raw_key)} data-testid="copy-key-btn"
              className="h-10 px-3 border border-[#2A2D35] hover:bg-[#121418] mono text-[10px] uppercase tracking-widest text-white flex items-center gap-2"><Copy size={12} /> Copy</button>
          </div>
        </div>
      )}

      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2">{err}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, idx) => <CardSkeleton key={idx} />)}
        </div>
      ) : (
        <div className="border border-[#2A2D35]">
          <div className="grid grid-cols-12 px-6 h-10 items-center border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Prefix</div>
            <div className="col-span-2">Calls</div>
            <div className="col-span-2">Last used</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {keys.length === 0 ? (
            <div className="p-8 text-center mono text-xs text-[#565D6D]">No API keys yet.</div>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="grid grid-cols-12 items-center px-6 py-4 border-b last:border-b-0 border-[#2A2D35] mono text-xs" data-testid={`key-row-${k.id}`}>
                <div className="col-span-3 font-bold">{k.name}</div>
                <div className="col-span-3 text-[#0047FF]">{k.key_prefix}…</div>
                <div className="col-span-2">{k.call_count}</div>
                <div className="col-span-2 text-[#565D6D]">{k.last_used ? new Date(k.last_used).toLocaleString() : "—"}</div>
                <div className="col-span-2 flex justify-end items-center gap-3">
                  {k.revoked ? (
                    <span className="text-[#FF3333] uppercase tracking-widest text-[10px]">revoked</span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <span className="text-[#00E599] uppercase tracking-widest text-[10px]">active</span>
                      <button onClick={() => revoke(k.id)} data-testid={`revoke-${k.id}`} className="text-[#8B93A5] hover:text-[#FF3333] transition-colors" title="Revoke">
                        <Prohibit size={14} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
