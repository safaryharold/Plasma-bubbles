import React from "react";
import { DownloadSimple, FileImage, FilePdf } from "@phosphor-icons/react";

/** Toolbar with density selector + PNG / SVG / 300-DPI paper export buttons.
 *  Shared by ContourHeatmap (Sweep/Compare) and Butterfly.
 */
export default function PlotToolbar({
  title, density, onDensityChange, showDensity = true,
  busy, onExport, onExportPaper, testIdPrefix = "plot",
}) {
  return (
    <div className="px-4 py-2 border-b border-[#2A2D35] mono text-[10px] uppercase tracking-[0.25em] text-[#8B93A5] flex items-center justify-between gap-3 flex-wrap">
      <span>— {title}</span>
      <div className="flex items-center gap-2">
        {showDensity && (
          <>
            <label className="text-[#565D6D] mr-1">density</label>
            <select value={density} onChange={(e) => onDensityChange(e.target.value)}
              data-testid={`${testIdPrefix}-density-select`}
              className="bg-[#090A0C] border border-[#2A2D35] text-white px-2 h-7 mono text-[10px] uppercase tracking-[0.2em]">
              <option value="coarse">coarse</option>
              <option value="standard">standard</option>
              <option value="fine">fine</option>
              <option value="ultra">ultra</option>
            </select>
          </>
        )}
        <button onClick={() => onExport("png")} disabled={busy != null}
          data-testid={`${testIdPrefix}-export-png`}
          className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
          <FileImage size={12} /> {busy === "png" ? "..." : "png"}
        </button>
        <button onClick={() => onExport("svg")} disabled={busy != null}
          data-testid={`${testIdPrefix}-export-svg`}
          className="h-7 px-2 border border-[#2A2D35] hover:border-[#0047FF] hover:text-[#0047FF] text-white flex items-center gap-1 transition-colors disabled:opacity-40">
          <DownloadSimple size={12} /> {busy === "svg" ? "..." : "svg"}
        </button>
        <button onClick={onExportPaper} disabled={busy != null}
          data-testid={`${testIdPrefix}-export-paper`}
          className="h-7 px-2 bg-[#FDCA26] hover:bg-[#FFE066] text-[#090A0C] font-bold flex items-center gap-1 transition-colors disabled:opacity-40">
          <FilePdf size={12} weight="fill" /> {busy === "paper" ? "rendering..." : "paper · 300dpi"}
        </button>
      </div>
    </div>
  );
}
