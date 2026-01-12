// module-scope (persists between frames)
let _maxSmooth = 1;

// Simple singleton temp canvas (avoid reallocs every frame)
let _tmpCanvas = null;
let _tmpCtx = null;

function getTmpCtx(w, h) {
  if (!_tmpCanvas) {
    _tmpCanvas = document.createElement("canvas");
    _tmpCtx = _tmpCanvas.getContext("2d");
  }
  if (_tmpCanvas.width !== w) _tmpCanvas.width = w;
  if (_tmpCanvas.height !== h) _tmpCanvas.height = h;
  return _tmpCtx;
}

function drawHeatmap(ctx, state) {
  const p = state.pheromone;
  if (!p || !p.imgData) return;

  const gw = p.gw, gh = p.gh;
  if (!gw || !gh) return;

  const data = p.imgData.data;

  const hasTwoFields = !!(p.home?.values && p.food?.values);
  const hasSingleField = !!(p.values);

  if (!hasTwoFields && !hasSingleField) return;

  // pick fields
  const home = hasTwoFields ? p.home.values : null;
  const food = hasTwoFields ? p.food.values : null;
  const vals = hasSingleField ? p.values : null;

  // smoothed max for stable normalization
  let maxNow = 0.0001;
  if (hasTwoFields) {
    for (let i = 0; i < home.length; i++) {
      const h = home[i];
      const f = food[i];
      if (h > maxNow) maxNow = h;
      if (f > maxNow) maxNow = f;
    }
  } else {
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v > maxNow) maxNow = v;
    }
  }

  _maxSmooth = _maxSmooth * 0.92 + maxNow * 0.08;
  const max = Math.max(0.0001, _maxSmooth);

  // write pixels
  if (hasTwoFields) {
    for (let i = 0; i < home.length; i++) {
      const h = Math.min(1, home[i] / max); // 0..1
      const f = Math.min(1, food[i] / max); // 0..1

      const idx = i * 4;

      // low red base, food=green, home=blue
      data[idx + 0] = 40;
      const fBoost = Math.min(1, f * 2.2);
      const hBoost = Math.min(1, h * 1.2);

      data[idx + 1] = Math.floor(fBoost * 255); // FOOD stronger green
      data[idx + 2] = Math.floor(hBoost * 255); // HOME slightly boosted too

      data[idx + 3] = Math.floor(Math.min(1, (h + f) * 0.8) * 200);
    }
  } else {
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i] / max;
      const a = Math.max(0, Math.min(1, v));
      const idx = i * 4;

      data[idx + 0] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(a * 180);
    }
  }

  // push ImageData to temp canvas then scale to screen
  const tctx = getTmpCtx(gw, gh);
  tctx.putImageData(p.imgData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.imageSmoothingEnabled = true;

  const scale = (p.cellSize || 12) * state.view.dpr;
  ctx.drawImage(_tmpCanvas, 0, 0, gw * scale, gh * scale);

  ctx.restore();
}

function drawNestAndFood(ctx, state) {
  // nest
  if (state.nest && typeof state.nest.x === "number") {
    const r = (state.nest.r ?? 18) * state.view.dpr;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(state.nest.x, state.nest.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // food nodes
  if (Array.isArray(state.foodNodes)) {
    for (const node of state.foodNodes) {
      if (!node) continue;
      if (typeof node.amount === "number" && node.amount <= 0) continue;

      const rr = 10 * state.view.dpr;
      ctx.fillStyle = "rgba(120,255,120,0.30)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAnts(ctx, state) {
  if (!Array.isArray(state.ants)) return;

  for (const ant of state.ants) {
    const carrying = !!ant.carrying;
    ctx.fillStyle = carrying ? "#ffffff" : "#ffd966";

    ctx.beginPath();
    ctx.arc(ant.x, ant.y, 2.2 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function render(ctx, state) {
  const { w, h } = state.view;

  // background
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  // heatmap first
  drawHeatmap(ctx, state);

  // landmarks
  drawNestAndFood(ctx, state);

  // ants above heatmap
  drawAnts(ctx, state);

  // pointer indicator
  if (state.input?.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
