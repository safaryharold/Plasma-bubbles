import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { Copy, Trash, ArrowsClockwise } from "@phosphor-icons/react";
import { CardSkeleton } from "../components/Skeleton";

export default function Experiments() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.get("/experiments");
      setItems(data);
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clone = async (id) => {
    try { await api.post(`/experiments/${id}/clone`); load(); }
    catch (e) { setErr(formatApiError(e)); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this experiment?")) return;
    try { await api.delete(`/experiments/${id}`); load(); }
    catch (e) { setErr(formatApiError(e)); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="experiments-page">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-[#565D6D] mb-3">— saved configurations</div>
        <h1 className="text-3xl font-black tracking-tight">Experiments Library</h1>
        <p className="mono text-xs text-[#8B93A5] mt-2">
          Save and reload sweep configurations. Each experiment carries a reproducibility hash.
        </p>
      </div>

      {err && <div className="mono text-xs text-[#FF3333] border border-[#FF3333]/40 bg-[#FF3333]/5 px-3 py-2">{err}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, idx) => <CardSkeleton key={idx} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-[#2A2D35] p-12 text-center mono text-xs text-[#565D6D]">
          No experiments yet. Save a sweep configuration to populate this library.
        </div>
      ) : (
        <div className="border border-[#2A2D35]">
          <div className="grid grid-cols-12 px-6 h-10 items-center border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#565D6D]">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Config hash</div>
            <div className="col-span-3">Parameters</div>
            <div className="col-span-2">Saved</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-12 items-center px-6 py-4 border-b last:border-b-0 border-[#2A2D35] mono text-xs hover:bg-[#121418] transition-colors" data-testid={`exp-row-${it.id}`}>
              <div className="col-span-3 font-bold truncate">{it.name}</div>
              <div className="col-span-2 text-[#00E599]">{it.config_hash}</div>
              <div className="col-span-3 text-[#8B93A5] truncate">
                day={it.params.day_month} · f107={it.params.f107} · lon[{it.params.lon_min}..{it.params.lon_max}/{it.params.lon_step}] · lt[{it.params.lt_min}..{it.params.lt_max}/{it.params.lt_step}]
              </div>
              <div className="col-span-2 text-[#565D6D]">{new Date(it.created_at).toLocaleDateString()}</div>
              <div className="col-span-2 flex items-center gap-2 justify-end">
                <button onClick={() => clone(it.id)} data-testid={`clone-${it.id}`} className="text-[#8B93A5] hover:text-[#0047FF] transition-colors" title="Clone">
                  <Copy size={16} />
                </button>
                <button onClick={() => remove(it.id)} data-testid={`delete-${it.id}`} className="text-[#8B93A5] hover:text-[#FF3333] transition-colors" title="Delete">
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={load} data-testid="reload-experiments" className="mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] hover:text-white flex items-center gap-2 transition-colors">
        <ArrowsClockwise size={12} /> Reload
      </button>
    </div>
  );
}
