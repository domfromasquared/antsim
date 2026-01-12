export function render(ctx, state) {
  const { w, h, dpr } = state.view;

  // background
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  // draw pheromone heatmap
  const p = state.pheromone;
  if (p.values && p.imgData) {
    const gw = p.gw, gh = p.gh;
    const data = p.imgData.data;
    const vals = p.values;

    // Find a soft max for normalization (cheap)
    let max = 0.0001;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] > max) max = vals[i];
    }

    // Map to grayscale with alpha
    // You can later color-code pheromone types; for now: white = strong
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i] / max; // 0..1
      const a = Math.max(0, Math.min(1, v)); // clamp
      const idx = i * 4;

      data[idx + 0] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(a * 180); // alpha (0..255)
    }

    // Draw image scaled to screen in DPR pixels
    // Since grid is in CSS pixels, scale by cellSize * dpr
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.globalCompositeOperation = "screen"; // makes it glow-ish over dark bg

    const scaleX = (p.cellSize * dpr);
    const scaleY = (p.cellSize * dpr);

    // Put as an image, then scale up
    // Use an in-memory bitmap via putImageData + drawImage pattern:
    // Create a temp canvas once? For MVP, simplest is fine:
    const tmp = getTmpCanvas(gw, gh);
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.putImageData(p.imgData, 0, 0);

    ctx.drawImage(tmp, 0, 0, gw * scaleX, gh * scaleY);

    ctx.restore();
  }

  // pointer indicator (optional)
  if (state.input.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Simple singleton temp canvas (avoid reallocs every frame)
let _tmpCanvas = null;
function getTmpCanvas(w, h) {
  if (!_tmpCanvas) _tmpCanvas = document.createElement("canvas");
  if (_tmpCanvas.width !== w) _tmpCanvas.width = w;
  if (_tmpCanvas.height !== h) _tmpCanvas.height = h;
  return _tmpCanvas;
}
