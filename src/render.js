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

// Draw heatmap in SCREEN coords by sampling the WORLD grid window under the camera
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

    // stronger food (green), visible danger (red), softer home (blue)
    const dBoost = Math.min(1, d * 2.2);
    const fBoost = Math.min(1, f * 3.0);
    const hBoost = Math.min(1, h * 1.2);

    data[idx + 0] = Math.floor(dBoost * 255);
    data[idx + 1] = Math.floor(fBoost * 255);
    data[idx + 2] = Math.floor(hBoost * 255);

    const a = Math.min(1, dBoost * 1.0 + fBoost * 0.85 + hBoost * 0.55);
    data[idx + 3] = Math.floor(a * 220);
  }

  const tctx = getTmpCtx(gw, gh);
  tctx.putImageData(p.imgData, 0, 0);

  // Map camera window (world px) -> grid px
  const scale = (p.cellSize || 12) * state.view.dpr; // world px per grid cell
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

  if (state.nest) {
    const r = (state.nest.r ?? 18) * dpr;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(state.nest.x, state.nest.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (Array.isArray(state.foodNodes)) {
    for (const node of state.foodNodes) {
      if (!node) continue;
      if (typeof node.amount === "number" && node.amount <= 0) continue;

      const rr = 10 * dpr;
      ctx.fillStyle = "rgba(120,255,120,0.30)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPylons(ctx, state) {
  const pylons = state.buildings?.pylons ?? 0;
  if (!state.nest || pylons <= 0) return;

  const dpr = state.view.dpr;
  const ringR = (state.nest.r + 32) * dpr;

  for (let i = 0; i < pylons; i++) {
    const ang = (i / pylons) * Math.PI * 2;
    const x = state.nest.x + Math.cos(ang) * ringR;
    const y = state.nest.y + Math.sin(ang) * ringR;

    ctx.fillStyle = "rgba(180,220,255,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, 3.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPredators(ctx, state) {
  const predators = Array.isArray(state.predators) ? state.predators : [];
  const dpr = state.view.dpr;

  for (const pr of predators) {
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
  if (!Array.isArray(state.ants)) return;
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

function drawWaveUi(ctx, state) {
  const wave = state.wave;
  if (!wave) return;

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

function upgradeCost(key, level) {
  if (key === "brood") return Math.floor(3 + level * 3 + level * level * 0.5);
  if (key === "dps") return Math.floor(4 + level * 4 + level * level * 0.6);
  if (key === "nest") return Math.floor(5 + level * 5 + level * level * 0.7);
  return 9999;
}

function drawUpgradeChips(ctx, state) {
  const dpr = state.view.dpr;
  const pad = 10 * dpr;
  const chipW = 118 * dpr;
  const chipH = 36 * dpr;
  const gap = 8 * dpr;

  const x = state.view.w - pad - chipW;
  let y = pad;

  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = `${13 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`BIOMASS ${state.ui.biomass ?? 0}`, state.view.w - pad, y);
  y += 18 * dpr;
  ctx.restore();

  const upgrades = state.upgrades ?? { brood: 0, dps: 0, nest: 0 };

  const chips = [
    { key: "brood", label: "BROOD", lvl: upgrades.brood ?? 0 },
    { key: "dps", label: "DPS", lvl: upgrades.dps ?? 0 },
    { key: "nest", label: "NEST", lvl: upgrades.nest ?? 0 }
  ];

  state.uiHit ??= {};
  for (const c of chips) {
    const cost = upgradeCost(c.key, c.lvl);
    state.uiHit[c.key] = { x, y, w: chipW, h: chipH };

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x, y, chipW, chipH);

    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = `${12 * dpr}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${c.label} L${c.lvl + 1}`, x + 10 * dpr, y + 7 * dpr);

    const canBuy = (state.ui.biomass ?? 0) >= cost;
    ctx.fillStyle = canBuy ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.35)";
    ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillText(`COST ${cost}`, x + 10 * dpr, y + 20 * dpr);

    y += chipH + gap;
  }

  return y;
}

function drawTechCards(ctx, state) {
  const dpr = state.view.dpr;
  const pad = 10 * dpr;
  const cardW = 240 * dpr;
  const cardH = 56 * dpr;
  const gap = 8 * dpr;

  const x = pad;
  let y = pad;

  const tech = state.tech ?? { unlocked: {} };
  const m = state.milestones ?? { totalBiomass: 0 };
  const waveN = state.wave?.n ?? 0;

  const cards = [
    {
      key: "scouts",
      title: "Scout Division",
      desc: "Unlock scout ants (faster food finding).",
      cost: 8,
      unlocked: !!tech.unlocked?.scouts,
      available: waveN >= 2
    },
    {
      key: "sentry",
      title: "Sentry Pylons",
      desc: "Add 1 nest pylon (zaps predators).",
      cost: 12,
      unlocked: !!tech.unlocked?.sentry,
      available: (m.totalBiomass ?? 0) >= 10
    }
  ];

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${13 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("TECH", x, y);
  y += 18 * dpr;
  ctx.restore();

  for (const c of cards) {
    const hitKey = c.key === "scouts" ? "tech_scouts" : "tech_sentry";
    state.uiHit[hitKey] = { x, y, w: cardW, h: cardH };

    let bg = "rgba(255,255,255,0.08)";
    if (c.unlocked) bg = "rgba(120,255,180,0.10)";
    else if (c.available) bg = "rgba(255,255,255,0.12)";

    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cardW, cardH);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = `${13 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(c.title, x + 10 * dpr, y + 7 * dpr);

    ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(c.desc, x + 10 * dpr, y + 24 * dpr);

    let rightText = "";
    if (c.unlocked) rightText = "OWNED";
    else if (!c.available) rightText = c.key === "scouts" ? "REQ: WAVE 2" : "REQ: TOTAL BIOMASS 10";
    else rightText = `BUY ${c.cost}`;

    const canBuy = c.available && !c.unlocked && (state.ui.biomass ?? 0) >= c.cost;
    ctx.textAlign = "right";
    ctx.fillStyle = c.unlocked
      ? "rgba(120,255,180,0.9)"
      : (canBuy ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)");

    ctx.font = `${12 * dpr}px system-ui`;
    ctx.fillText(rightText, x + cardW - 10 * dpr, y + 17 * dpr);

    ctx.restore();

    y += cardH + gap;
  }
}

function drawMilestones(ctx, state) {
  const dpr = state.view.dpr;
  const m = state.milestones ?? { bestWave: 0, totalBiomass: 0, peakAnts: 0 };

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.font = `${12 * dpr}px system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(
    `BEST WAVE ${m.bestWave}  •  TOTAL BIOMASS ${m.totalBiomass}  •  PEAK ANTS ${m.peakAnts}`,
    10 * dpr,
    state.view.h - 10 * dpr
  );
  ctx.restore();
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

  // world objects
  ctx.save();
  ctx.translate(-(state.camera.x || 0), -(state.camera.y || 0));
  drawNestAndFood(ctx, state);
  drawPylons(ctx, state);
  drawPredators(ctx, state);
  drawAnts(ctx, state);
  ctx.restore();

  // UI
  drawNestHp(ctx, state);
  drawWaveUi(ctx, state);
  drawUpgradeChips(ctx, state);
  drawTechCards(ctx, state);
  drawMilestones(ctx, state);
  drawGameOver(ctx, state);

  // pointer indicator (screen coords)
  if (state.input?.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 16 * state.view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}
