// src/render.js
let _maxSmooth = 1;
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

// Heatmap drawn in SCREEN coords by sampling camera window from WORLD grid
function drawHeatmap(ctx, state) {
  const p = state.pheromone;
  if (!p || !p.imgData) return;

  const gw = p.gw, gh = p.gh;
  if (!gw || !gh) return;

  const home = p.home?.values;
  const food = p.food?.values;
  const danger = p.danger?.values;
  if (!home || !food) return;

  const data = p.imgData.data;

  let maxNow = 0.0001;
  for (let i = 0; i < home.length; i++) {
    if (home[i] > maxNow) maxNow = home[i];
    if (food[i] > maxNow) maxNow = food[i];
    if (danger && danger[i] > maxNow) maxNow = danger[i];
  }

  _maxSmooth = _maxSmooth * 0.92 + maxNow * 0.08;
  const max = Math.max(0.0001, _maxSmooth);

  for (let i = 0; i < home.length; i++) {
    const h = Math.min(1, home[i] / max);
    const f = Math.min(1, food[i] / max);
    const d = danger ? Math.min(1, danger[i] / max) : 0;

    const idx = i * 4;

    const dBoost = Math.min(1, d * 2.2);
    const fBoost = Math.min(1, f * 3.0);
    const hBoost = Math.min(1, h * 1.15);

    data[idx + 0] = Math.floor(dBoost * 255);
    data[idx + 1] = Math.floor(fBoost * 255);
    data[idx + 2] = Math.floor(hBoost * 255);

    const a = Math.min(1, dBoost * 1.0 + fBoost * 0.85 + hBoost * 0.55);
    data[idx + 3] = Math.floor(a * 220);
  }

  const tctx = getTmpCtx(gw, gh);
  tctx.putImageData(p.imgData, 0, 0);

  const scale = (p.cellSize || 12) * state.view.dpr;
  const sx = (state.camera.x || 0) / scale;
  const sy = (state.camera.y || 0) / scale;
  const sw = state.view.w / scale;
  const sh = state.view.h / scale;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_tmpCanvas, sx, sy, sw, sh, 0, 0, state.view.w, state.view.h);
  ctx.restore();
}

function drawNestAndFood(ctx, state) {
  const dpr = state.view.dpr;

  const r = (state.nest.r ?? 18) * dpr;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(state.nest.x, state.nest.y, r, 0, Math.PI * 2);
  ctx.fill();

  for (const node of state.foodNodes) {
    if (node.amount <= 0) continue;
    const rr = 10 * dpr;
    ctx.fillStyle = "rgba(120,255,120,0.30)";
    ctx.beginPath();
    ctx.arc(node.x, node.y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, state) {
  const dpr = state.view.dpr;
  const list = state.buildings?.list ?? [];

  for (const b of list) {
    const r = 12 * dpr + (b.lvl || 1) * 1.5 * dpr;

    if (b.type === "nursery") ctx.fillStyle = "rgba(120,255,160,0.55)";
    else if (b.type === "hatchery") ctx.fillStyle = "rgba(255,255,255,0.45)";
    else if (b.type === "storehouse") ctx.fillStyle = "rgba(255,220,120,0.50)";
    else ctx.fillStyle = "rgba(200,200,200,0.35)";

    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();

    // progress ring (subtle)
    const prog = Math.max(0, Math.min(1, (b.progress || 0)));
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 4 * dpr, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 2);
    ctx.stroke();
  }
}

function drawGhostBuilding(ctx, state) {
  if (!state.build?.mode) return;

  const dpr = state.view.dpr;
  const type = state.build.mode;
  const r = 14 * dpr;

  let color = "rgba(255,255,255,0.18)";
  if (type === "nursery") color = "rgba(120,255,160,0.22)";
  if (type === "hatchery") color = "rgba(255,255,255,0.22)";
  if (type === "storehouse") color = "rgba(255,220,120,0.22)";

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(state.build.ghostX, state.build.ghostY, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.arc(state.build.ghostX, state.build.ghostY, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPredators(ctx, state) {
  const dpr = state.view.dpr;
  for (const pr of state.predators) {
    if (!pr.active) continue;

    const r = 10 * dpr;
    ctx.fillStyle = "rgba(255,80,80,0.9)";
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fill();

    const hp01 = Math.max(0, Math.min(1, pr.hp / (pr.maxHp || 80)));
    const w = 34 * dpr;
    const h = 5 * dpr;
    const x = pr.x - w * 0.5;
    const y = pr.y - r - 10 * dpr;

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,80,80,0.95)";
    ctx.fillRect(x, y, w * hp01, h);
  }
}

function drawAnts(ctx, state) {
  const dpr = state.view.dpr;
  for (const ant of state.ants) {
    const role = ant.role || "worker";
    const carrying = !!ant.carrying;

    if (role === "soldier") ctx.fillStyle = "#ffb3b3";
    else if (role === "scout") ctx.fillStyle = carrying ? "#e8fff9" : "#7ff0ff";
    else ctx.fillStyle = carrying ? "#ffffff" : "#ffd966";

    ctx.beginPath();
    ctx.arc(ant.x, ant.y, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNestHp(ctx, state) {
  const nest = state.nest;
  const hp01 = Math.max(0, Math.min(1, (nest.hp ?? 0) / (nest.maxHp ?? 100)));

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

function drawWaveUi(ctx, state) {
  const wave = state.wave;
  const dpr = state.view.dpr;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${14 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";

  const text = wave.inProgress
    ? `WAVE ${wave.n}  •  ENEMIES ${wave.predatorsAlive}`
    : `NEXT WAVE IN ${Math.max(0, Math.ceil(wave.nextIn))}s`;

  ctx.fillText(text, state.view.w * 0.5, 30 * dpr);

  if (wave.bannerTimer > 0) {
    ctx.font = `${22 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(`WAVE ${wave.n}`, state.view.w * 0.5, state.view.h * 0.12);
  }
  ctx.restore();
}

function drawTopStats(ctx, state) {
  const dpr = state.view.dpr;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${13 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fillText(
    `FOOD ${state.ui.food}/${state.ui.maxFood}  •  LARVAE ${state.ui.larvae}  •  BIOMASS ${state.ui.biomass}  •  POP ${state.ants.length}`,
    10 * dpr,
    10 * dpr
  );
  ctx.restore();
}

function drawBuildBar(ctx, state) {
  const dpr = state.view.dpr;

  const barH = 64 * dpr;
  const pad = 10 * dpr;
  const y = state.view.h - barH - pad;
  const w = state.view.w - pad * 2;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(pad, y, w, barH);

  const btnW = (w - pad * 2) / 3;
  const btnH = barH - pad * 2;
  const by = y + pad;
  const labels = [
    { key: "build_nursery", name: "NURSERY", cost: "6" },
    { key: "build_hatchery", name: "HATCHERY", cost: "10" },
    { key: "build_storehouse", name: "STORE", cost: "8" }
  ];

  state.uiHit.build_nursery = { x: pad + pad + 0 * btnW, y: by, w: btnW - pad, h: btnH };
  state.uiHit.build_hatchery = { x: pad + pad + 1 * btnW, y: by, w: btnW - pad, h: btnH };
  state.uiHit.build_storehouse = { x: pad + pad + 2 * btnW, y: by, w: btnW - pad, h: btnH };

  for (let i = 0; i < 3; i++) {
    const rect = labels[i].key === "build_nursery" ? state.uiHit.build_nursery
      : labels[i].key === "build_hatchery" ? state.uiHit.build_hatchery
      : state.uiHit.build_storehouse;

    const active =
      (state.build?.mode === "nursery" && labels[i].key === "build_nursery") ||
      (state.build?.mode === "hatchery" && labels[i].key === "build_hatchery") ||
      (state.build?.mode === "storehouse" && labels[i].key === "build_storehouse");

    ctx.fillStyle = active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${12 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText(labels[i].name, rect.x + rect.w * 0.5, rect.y + rect.h * 0.42);

    ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.fillText(`COST ${labels[i].cost}`, rect.x + rect.w * 0.5, rect.y + rect.h * 0.72);
    ctx.restore();
  }

  // hint while placing
  if (state.build?.mode) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = `${13 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("Drag to position • Release to place • Tap icon to cancel", state.view.w * 0.5, y - 8 * dpr);
    ctx.restore();
  }
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

  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  // heatmap in screen coords (camera window)
  drawHeatmap(ctx, state);

  // world objects (translated)
  ctx.save();
  ctx.translate(-(state.camera.x || 0), -(state.camera.y || 0));
  drawNestAndFood(ctx, state);
  drawBuildings(ctx, state);
  drawPredators(ctx, state);
  drawAnts(ctx, state);
  drawGhostBuilding(ctx, state);
  ctx.restore();

  // UI
  drawTopStats(ctx, state);
  drawNestHp(ctx, state);
  drawWaveUi(ctx, state);
  drawBuildBar(ctx, state);
  drawGameOver(ctx, state);
}
