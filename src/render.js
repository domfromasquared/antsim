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

  const hasHomeFood = !!(p.home?.values && p.food?.values);
  const hasDanger = !!(p.danger?.values);
  const hasSingle = !!(p.values);

  if (!hasHomeFood && !hasSingle) return;

  // pick fields
  const home = hasHomeFood ? p.home.values : null;
  const food = hasHomeFood ? p.food.values : null;
  const danger = hasDanger ? p.danger.values : null;
  const vals = hasSingle ? p.values : null;

  // smoothed max for stable normalization
  let maxNow = 0.0001;

  if (hasHomeFood) {
    for (let i = 0; i < home.length; i++) {
      const h = home[i];
      const f = food[i];
      if (h > maxNow) maxNow = h;
      if (f > maxNow) maxNow = f;
      if (danger && danger[i] > maxNow) maxNow = danger[i];
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
  if (hasHomeFood) {
    for (let i = 0; i < home.length; i++) {
      const h = Math.min(1, home[i] / max);     // 0..1
      const f = Math.min(1, food[i] / max);     // 0..1
      const d = danger ? Math.min(1, danger[i] / max) : 0;

      const idx = i * 4;

      // Boost so channels are easy to see
      const dBoost = Math.min(1, d * 2.2);
      const fBoost = Math.min(1, f * 2.4);
      const hBoost = Math.min(1, h * 1.4);

      // danger=red, food=green, home=blue
      data[idx + 0] = Math.floor(dBoost * 255);
      data[idx + 1] = Math.floor(fBoost * 255);
      data[idx + 2] = Math.floor(hBoost * 255);

      const a = Math.min(1, dBoost * 1.0 + fBoost * 0.8 + hBoost * 0.6);
      data[idx + 3] = Math.floor(a * 230);
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

function drawPredator(ctx, state) {
  const predator = state.predator;
  if (!predator || !predator.active) return;

  const r = 10 * state.view.dpr;
  ctx.fillStyle = "rgba(255,80,80,0.9)";
  ctx.beginPath();
  ctx.arc(predator.x, predator.y, r, 0, Math.PI * 2);
  ctx.fill();

  // simple hp bar
  const hp01 = Math.max(0, Math.min(1, predator.hp / (predator.maxHp || 80)));
  const w = 34 * state.view.dpr;
  const h = 5 * state.view.dpr;
  const x = predator.x - w * 0.5;
  const y = predator.y - r - 10 * state.view.dpr;

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,80,80,0.95)";
  ctx.fillRect(x, y, w * hp01, h);
}

function drawAnts(ctx, state) {
  if (!Array.isArray(state.ants)) return;

  for (const ant of state.ants) {
    const role = ant.role || "worker";
    const carrying = !!ant.carrying;

    if (role === "soldier") ctx.fillStyle = "#ffb3b3";
    else ctx.fillStyle = carrying ? "#ffffff" : "#ffd966";

    ctx.beginPath();
    ctx.arc(ant.x, ant.y, 2.2 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNestHp(ctx, state) {
  const nest = state.nest;
  if (!nest) return;

  const hp = nest.hp ?? 0;
  const maxHp = nest.maxHp ?? 100;
  const hp01 = Math.max(0, Math.min(1, hp / maxHp));

  const dpr = state.view.dpr;
  const w = 120 * dpr;
  const h = 10 * dpr;
  const x = (state.view.w - w) * 0.5;
  const y = 14 * dpr;

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(x, y, w * hp01, h);
}

function drawGameOver(ctx, state) {
  if (!state.game?.over) return;

  const dpr = state.view.dpr;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, state.view.w, state.view.h);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `${22 * dpr}px system-ui`;
  ctx.fillText(state.game.message || "Game Over", state.view.w * 0.5, state.view.h * 0.45);

  ctx.font = `${14 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fillText("Tap to Restart", state.view.w * 0.5, state.view.h * 0.52);

  ctx.restore();
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

  // predator
  drawPredator(ctx, state);

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
