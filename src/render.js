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

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawHeatmap(ctx, state) {
  const p = state.pheromone;
  if (!p || !p.imgData) return;

  const gw = p.gw, gh = p.gh;
  if (!gw || !gh) return;

  const data = p.imgData.data;

  const hasHomeFood = !!(p.home?.values && p.food?.values);
  const hasDanger = !!(p.danger?.values);
  if (!hasHomeFood) return;

  const home = p.home.values;
  const food = p.food.values;
  const danger = hasDanger ? p.danger.values : null;
  const command = p.command?.values || null;

  // smoothed max for stable normalization
  let maxNow = 0.0001;
  for (let i = 0; i < home.length; i++) {
    const h = home[i];
    const f = food[i];
    if (h > maxNow) maxNow = h;
    if (f > maxNow) maxNow = f;
    if (danger && danger[i] > maxNow) maxNow = danger[i];
    if (command) {
      const cabs = Math.abs(command[i]);
      if (cabs > maxNow) maxNow = cabs;
    }
  }

  _maxSmooth = _maxSmooth * 0.92 + maxNow * 0.08;
  const max = Math.max(0.0001, _maxSmooth);

  for (let i = 0; i < home.length; i++) {
    const h = Math.min(1, home[i] / max);
    const f = Math.min(1, food[i] / max);
    const d = danger ? Math.min(1, danger[i] / max) : 0;

    // Player command (signed): positive = attract (cyan), negative = repel (magenta)
    let cPos = 0, cNeg = 0;
    if (command) {
      const cv = command[i] / max;
      if (cv > 0) cPos = Math.min(1, cv);
      else cNeg = Math.min(1, -cv);
    }

    const idx = i * 4;

    // boost a little so trails are visible early
    const dBoost = Math.pow(d, 0.55);
    const fBoost = Math.pow(f, 0.55);
    const hBoost = Math.pow(h, 0.55);

    // base channels: danger->R, food->G, home->B
    // command: positive -> add to G+B (cyan), negative -> add to R+B (magenta)
    const rOut = Math.min(1, dBoost + cNeg * 0.9);
    const gOut = Math.min(1, fBoost + cPos * 0.9);
    const bOut = Math.min(1, hBoost + cPos * 0.6 + cNeg * 0.9);

    data[idx + 0] = Math.floor(rOut * 255);
    data[idx + 1] = Math.floor(gOut * 255);
    data[idx + 2] = Math.floor(bOut * 255);

    const a = Math.min(1, dBoost * 1.0 + fBoost * 0.8 + hBoost * 0.6 + (cPos + cNeg) * 0.6);
    data[idx + 3] = Math.floor(a * 230);
  }

  const tctx = getTmpCtx(gw, gh);
  tctx.putImageData(p.imgData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.imageSmoothingEnabled = true;

  // draw scaled to world (not screen)
  const sx = -state.camera.x;
  const sy = -state.camera.y;

  ctx.drawImage(_tmpCanvas, sx, sy, state.world.w, state.world.h);

  ctx.restore();
}

function drawNestAndFood(ctx, state) {
  if (state.nest && typeof state.nest.x === "number") {
    const r = (state.nest.r ?? 18) * state.view.dpr;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(state.nest.x - state.camera.x, state.nest.y - state.camera.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (Array.isArray(state.foodNodes)) {
    for (const node of state.foodNodes) {
      if (node.amount <= 0) continue;
      ctx.fillStyle = "rgba(0,255,120,0.25)";
      ctx.beginPath();
      ctx.arc(node.x - state.camera.x, node.y - state.camera.y, 10 * state.view.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPredators(ctx, state) {
  if (!Array.isArray(state.predators)) return;

  for (const pr of state.predators) {
    if (!pr.active) continue;

    const x = pr.x - state.camera.x;
    const y = pr.y - state.camera.y;

    ctx.fillStyle = "rgba(255,80,80,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, 14 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    const hp01 = Math.max(0, Math.min(1, pr.hp / Math.max(1, pr.maxHp || pr.hp || 1)));
    const w = 36 * state.view.dpr;
    const h = 6 * state.view.dpr;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - w * 0.5, y - 22 * state.view.dpr, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(x - w * 0.5, y - 22 * state.view.dpr, w * hp01, h);
  }
}

function drawAnts(ctx, state) {
  if (!Array.isArray(state.ants)) return;

  for (const a of state.ants) {
    const x = a.x - state.camera.x;
    const y = a.y - state.camera.y;

    const role = a.role || "worker";
    ctx.fillStyle =
      role === "soldier" ? "rgba(255,255,255,0.85)" :
      role === "scout" ? "rgba(180,220,255,0.8)" :
      "rgba(220,220,220,0.6)";

    ctx.beginPath();
    ctx.arc(x, y, 3.2 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNestHp(ctx, state) {
  const dpr = state.view.dpr;
  const pad = 10 * dpr;
  const w = 140 * dpr;
  const h = 10 * dpr;

  const hp01 = Math.max(0, Math.min(1, state.nest.hp / Math.max(1, state.nest.maxHp)));

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(pad, pad, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(pad, pad, w * hp01, h);
}

function drawWaveUi(ctx, state) {
  const dpr = state.view.dpr;
  const pad = 10 * dpr;

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textBaseline = "top";
  ctx.fillText(`Wave ${state.wave?.n ?? 0}  Threat ${Math.floor(state.ui?.threat ?? 0)}`, pad, (pad + 14 * dpr));
}

function drawCommandUi(ctx, state) {
  const dpr = state.view.dpr || 1;
  const pad = 10 * dpr;
  const bw = 150 * dpr;
  const bh = 34 * dpr;
  const x = state.view.w - pad - bw;
  const y = pad;

  const mode = state.command?.mode || "none";
  const label =
    mode === "rally" ? "CMD: RALLY" :
    mode === "harvest" ? "CMD: HARVEST" :
    mode === "avoid" ? "CMD: AVOID" :
    "CMD: NONE";

  // pill
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, x, y, bw, bh, 10 * dpr);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1 * dpr;
  roundRect(ctx, x, y, bw, bh, 10 * dpr);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 10 * dpr, y + bh * 0.5);

  ctx.globalAlpha = 0.7;
  ctx.font = `${Math.floor(10 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText("tap=cycle • dbl=clear", x + 10 * dpr, y + bh - 9 * dpr);

  ctx.restore();
}

function drawGameOver(ctx, state) {
  if (!state.game?.over) return;

  const dpr = state.view.dpr;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, state.view.w, state.view.h);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `${Math.floor(22 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.game.message || "Game Over", state.view.w * 0.5, state.view.h * 0.5);

  ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillText("Tap to restart", state.view.w * 0.5, state.view.h * 0.5 + 26 * dpr);
  ctx.restore();
}

export function render(ctx, state) {
  const { w, h } = state.view;

  // background
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  // heatmap
  drawHeatmap(ctx, state);

  // world draws
  drawNestAndFood(ctx, state);
  drawPredators(ctx, state);
  drawAnts(ctx, state);

  // UI
  drawNestHp(ctx, state);
  drawWaveUi(ctx, state);
  drawCommandUi(ctx, state);
  drawGameOver(ctx, state);

  // pointer indicator
  if (state.input?.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
