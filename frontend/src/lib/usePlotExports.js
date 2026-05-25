import { useCallback, useState } from "react";
import Plotly from "plotly.js-dist-min";

/** PNG / SVG / 300-DPI-paper export hook shared by every chart in the app. */
export function usePlotExports({ wrapperRef, baseName, captionLines }) {
  const [busy, setBusy] = useState(null);

  const findGd = useCallback(() => {
    return wrapperRef.current?.querySelector(".js-plotly-plot");
  }, [wrapperRef]);

  const _download = (url, name) => {
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const exportImage = useCallback(async (format) => {
    const gd = findGd(); if (!gd) return;
    setBusy(format);
    try {
      const url = await Plotly.toImage(gd, {
        format,
        width: 1400, height: 900,
        scale: format === "svg" ? 1 : 2,
      });
      _download(url, `${baseName()}.${format}`);
    } finally { setBusy(null); }
  }, [findGd, baseName]);

  const exportPaper = useCallback(async () => {
    const gd = findGd(); if (!gd) return;
    setBusy("paper");
    try {
      const W = 2400, H = 1500, SCALE = 2;
      const url = await Plotly.toImage(gd, { format: "png", width: W, height: H, scale: SCALE });
      const img = new Image(); img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const captionH = 220;
      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE; canvas.height = H * SCALE + captionH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, H * SCALE);
      ctx.fillStyle = "#0B0D11"; ctx.font = "32px 'JetBrains Mono', monospace";
      let y = H * SCALE + 50;
      for (const line of captionLines()) {
        ctx.fillText(line, 50, y); y += 42;
      }
      _download(canvas.toDataURL("image/png"), `${baseName()}_paper.png`);
    } finally { setBusy(null); }
  }, [findGd, baseName, captionLines]);

  return { busy, exportImage, exportPaper };
}
