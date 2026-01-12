// module-scope (persists between frames)
let _maxSmooth = 1;

// Simple singleton temp canvas (avoid reallocs every frame)
let _tmpCanvas = null;
function getTmpCanvas(w, h) {
  if (!_tmpCanvas) _tmpCanvas = document.createElement("canvas");
  if (_tmpCanvas.width !== w) _tmpCanvas.width = w;
  if (_tmpCanvas.height !== h) _tmpCanvas.height = h;
  return _tmpCanvas;
}

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

    // smoothed max for stable normalization
    let maxNow = 0.0001;
    for (let i = 0; i < vals.length; i++) if (vals[i] > maxNow) maxNow = vals[i];

    _maxSmooth = _maxSmooth * 0.92 + maxNow * 0.08;
    const max = Math.max(0.0001, _maxSmooth);

    // write pixels
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i] / max;           // 0..inf
      const a = Math.max(0, Math.min(1, v)); // clamp 0..1
      const idx = i * 4;

      data[idx + 0] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(a * 180);
    }

    // push ImageData to an offscreen canvas, then scale to screen
    const tmp = getTmpCanvas(gw, gh);
    const tctx = tmp.getContext("2d");
    tctx.putImageData(p.imgData, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.imageSmoothingEnabled = true;

    const scale = p.cellSize * dpr;
    ctx.drawImage(tmp, 0, 0, gw * scale, gh * scale);

    ctx.restore();
  }

  // draw ants
    ctx.fillStyle = "#ffd966";
    for (let ant of state.ants) {
    ctx.beginPath();
    ctx.arc(ant.x, ant.y, 2.2 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();
}

  // pointer indicator
  if (state.input.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
