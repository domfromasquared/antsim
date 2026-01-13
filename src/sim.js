// src/sim.js
const SAVE_KEY = "antsim_save_v5";
let _saveTimer = 0;

const TECH = {
  scouts: { name: "Scout Division", costBiomass: 8, req: (s) => (s.wave?.n ?? 0) >= 2 },
  sentry: { name: "Sentry Pylons", costBiomass: 12, req: (s) => (s.milestones?.totalBiomass ?? 0) >= 10 }
};

const BUILD = {
  nursery:    { baseCost: 6,  time: 1.5, radiusCss: 90,  maxAssigned: 6 },
  hatchery:   { baseCost: 10, time: 2.5, radiusCss: 100, maxAssigned: 6 },
  storehouse: { baseCost: 8,  time: 0,   radiusCss: 0,   maxAssigned: 0 }
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

function blendDir(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function diffuseField(front, back, gw, gh, k) {
  for (let y = 0; y < gh; y++) {
    const yOff = y * gw;
    const yUp = (y > 0) ? (y - 1) * gw : yOff;
    const yDn = (y < gh - 1) ? (y + 1) * gw : yOff;

    for (let x = 0; x < gw; x++) {
      const i = yOff + x;
      const c = front[i];

      const l = front[yOff + (x > 0 ? x - 1 : x)];
      const r = front[yOff + (x < gw - 1 ? x + 1 : x)];
      const u = front[yUp + x];
      const d = front[yDn + x];

      const avg4 = (l + r + u + d) * 0.25;
      back[i] = c + (avg4 - c) * k;
    }
  }
}

function decayField(arr, decay) {
  for (let i = 0; i < arr.length; i++) arr[i] *= decay;
}

function deposit(field, gw, gh, cellSize, dpr, px, py, amount) {
  if (!field) return;

  const cssX = px / dpr;
  const cssY = py / dpr;
  const cx = Math.floor(cssX / cellSize);
  const cy = Math.floor(cssY / cellSize);

  const r = 2;
  for (let yy = cy - r; yy <= cy + r; yy++) {
    if (yy < 0 || yy >= gh) continue;
    for (let xx = cx - r; xx <= cx + r; xx++) {
      if (xx < 0 || xx >= gw) continue;

      const dx = xx - cx;
      const dy = yy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;

      const falloff = 1 - d2 / (r * r + 0.0001);
      field[yy * gw + xx] += amount * falloff;
    }
  }
}

function sampleBestDir(field, gw, gh, cellSize, dpr, x, y) {
  const cssX = x / dpr;
  const cssY = y / dpr;
  const cx = Math.floor(cssX / cellSize);
  const cy = Math.floor(cssY / cellSize);

  let bestDx = 0, bestDy = 0, bestVal = -Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const gx = cx + dx;
      const gy = cy + dy;
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;

      const v = field[gy * gw + gx];
      if (v > bestVal) {
        bestVal = v;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { bestVal, dir: Math.atan2(bestDy, bestDx) };
}

function sampleWorstDir(field, gw, gh, cellSize, dpr, x, y) {
  const cssX = x / dpr;
  const cssY = y / dpr;
  const cx = Math.floor(cssX / cellSize);
  const cy = Math.floor(cssY / cellSize);

  let worstDx = 0, worstDy = 0, worstVal = Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const gx = cx + dx;
      const gy = cy + dy;
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;

      const v = field[gy * gw + gx];
      if (v < worstVal) {
        worstVal = v;
        worstDx = dx;
        worstDy = dy;
      }
    }
  }
  return { worstVal, dir: Math.atan2(worstDy, worstDx) };
}

function sampleCommand(field, gw, gh, cellSize, dpr, x, y) {
  // Signed field: positive = attract, negative = repel.
  const best = sampleBestDir(field, gw, gh, cellSize, dpr, x, y);
  const worst = sampleWorstDir(field, gw, gh, cellSize, dpr, x, y);

  const bestMag = Math.max(0, best.bestVal);
  const worstMag = Math.max(0, -worst.worstVal);

  if (worstMag > bestMag) {
    // Repel: move away from the most-negative neighbor
    return { strength: worstMag, dir: worst.dir + Math.PI };
  }
  return { strength: bestMag, dir: best.dir };
}

function ensureSystems(state) {
  state.world ??= { w: state.view.w * 3, h: state.view.h * 3 };
  state.camera ??= { x: 0, y: 0 };

  state.wave ??= { n: 0, inProgress: false, nextIn: 6, predatorsAlive: 0, bannerTimer: 0 };
  state.predators ??= [];
  state.tuning ??= { soldierFraction: 0.22, threatRise: 25, threatFall: 14 };
  state.game ??= { over: false, message: "" };

  state.brood ??= { timer: 0, intervalBase: 2.5, cost: 8, costGrowth: 1.06, maxAnts: 140 };
  state.upgrades ??= { brood: 0, dps: 0, nest: 0 };

  state.tech ??= { unlocked: {}, purchased: {} };
  state.buildings ??= { list: [], nextId: 1 };
  state.build ??= { mode: null, ghostX: 0, ghostY: 0, dragging: false };

  state.ui ??= { food: 0, biomass: 0, larvae: 0, threat: 0, maxFood: 200 };

  state.milestones ??= { bestWave: 0, totalBiomass: 0, peakAnts: 0 };
  state.uiHit ??= {};
  if (state.selectedBuildingId === undefined) state.selectedBuildingId = null;

  // Player control layer
  state.command ??= { mode: "none", clear: false };
}

function applyNestUpgrade(state) {
  const lvl = state.upgrades?.nest ?? 0;
  const maxHp = 100 + lvl * 40;
  state.nest.maxHp = maxHp;
  state.nest.hp = Math.min(state.nest.hp, maxHp);
}

function resetPheromones(state) {
  const p = state.pheromone;
  for (const f of [p.home, p.food, p.danger, p.command]) {
    if (!f?.values || !f?.values2) continue;
    f.values.fill(0);
    f.values2.fill(0);
  }
}

function recalcCivPassives(state) {
  const stores = buildingCount(state, "storehouse");
  state.ui.maxFood = 200 + stores * 120;

  const eff = 1.06 - stores * 0.005;
  state.brood.costGrowth = Math.max(1.02, eff);

  state.ui.food = Math.min(state.ui.food ?? 0, state.ui.maxFood ?? 200);
}

function resetRunState(state) {
  state.ui.food = 0;
  state.ui.larvae = 0;
  state.ui.threat = 0;

  state.predators = [];
  state.wave.inProgress = false;
  state.wave.nextIn = 6;
  state.wave.predatorsAlive = 0;
  state.wave.bannerTimer = 0;

  state.game.over = false;
  state.game.message = "";

  applyNestUpgrade(state);
  state.nest.hp = state.nest.maxHp;

  recalcCivPassives(state);
  for (const b of state.buildings.list) b.progress = 0;

  resetPheromones(state);
}

function waveStats(waveN) {
  return {
    hp: 70 + waveN * 14,
    speed: 48 + waveN * 2.2,
    emitStrength: 9 + waveN * 0.7,
    count: 1 + Math.floor((waveN - 1) / 3)
  };
}

function spawnPredatorAtEdge(state, stats) {
  const pr = { active: true, x: 0, y: 0, hp: stats.hp, maxHp: stats.hp, emitStrength: stats.emitStrength, speed: stats.speed };
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) { pr.x = 0; pr.y = Math.random() * state.world.h; }
  if (edge === 1) { pr.x = state.world.w; pr.y = Math.random() * state.world.h; }
  if (edge === 2) { pr.x = Math.random() * state.world.w; pr.y = 0; }
  if (edge === 3) { pr.x = Math.random() * state.world.w; pr.y = state.world.h; }
  state.predators.push(pr);
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function buildingCount(state, type) {
  let n = 0;
  for (const b of state.buildings.list) if (b.type === type) n++;
  return n;
}

function buildingUpgradeCost(b) {
  const lvl = b.lvl ?? 1;
  const base = (b.type === "nursery") ? 8 : (b.type === "hatchery" ? 12 : 10);
  return Math.floor(base + lvl * 6 + lvl * lvl * 1.8);
}

function snapWorld(state, wx, wy) {
  const dpr = state.view.dpr;
  const cellCss = 24;
  const cell = cellCss * dpr;
  return { x: Math.round(wx / cell) * cell, y: Math.round(wy / cell) * cell };
}

function placeBuilding(state, type, wx, wy) {
  const cost = 999999; // buildings paused for now
  if ((state.ui.biomass ?? 0) < cost) return false;
  return false;
}

function selectBuildingAt(state, wx, wy) {
  state.selectedBuildingId = null;
  return null;
}

function countAssignedWorkers() { return 0; }
function buildingSpeedMultiplier() { return 1; }

function chooseHatchRole(state) {
  const threat = state.ui.threat ?? 0;
  if (threat >= 60) return "soldier";
  return "worker";
}

export function stepSim(state, dt) {
  ensureSystems(state);

  const tapped = !!(state.input?.justReleased && state.input?.wasTap);
  const released = !!state.input?.justReleased;

  if (state.input) {
    state.input.justPressed = false;
    state.input.justReleased = false;
  }

  if (state.game?.over) {
    if (tapped) resetRunState(state);
    return;
  }

  state.time += dt;

  const p = state.pheromone;
  if (!p?.imgData || !p.home?.values || !p.food?.values || !p.danger?.values || !p.command?.values) return;

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

  applyNestUpgrade(state);

  // Clear command field on request (double-tap on mode button)
  if (state.command?.clear) {
    state.command.clear = false;
    p.command.values.fill(0);
    p.command.values2.fill(0);
  }

  const nest = state.nest;
  const foodNodes = state.foodNodes ?? [];

  // ---------- Pheromones ----------
  const decay = Math.pow(p.decayPerSecond ?? 0.92, dt);
  const k = p.diffuseRate ?? 0.22;

  // Command persists longer than natural pheromones
  const cmdDecay = Math.pow(0.985, dt);
  const cmdDiffuse = Math.min(0.18, k * 0.75);

  decayField(p.home.values, decay);
  decayField(p.food.values, decay);
  decayField(p.danger.values, decay);
  decayField(p.command.values, cmdDecay);

  diffuseField(p.home.values, p.home.values2, gw, gh, k);
  diffuseField(p.food.values, p.food.values2, gw, gh, k);
  diffuseField(p.danger.values, p.danger.values2, gw, gh, k);
  diffuseField(p.command.values, p.command.values2, gw, gh, cmdDiffuse);

  [p.home.values, p.home.values2] = [p.home.values2, p.home.values];
  [p.food.values, p.food.values2] = [p.food.values2, p.food.values];
  [p.danger.values, p.danger.values2] = [p.danger.values2, p.danger.values];
  [p.command.values, p.command.values2] = [p.command.values2, p.command.values];

  // emitters
  deposit(p.home.values, gw, gh, p.cellSize, dpr, nest.x, nest.y, 7.0);

  for (const node of foodNodes) {
    if (node.amount <= 0) continue;
    const strength = 7.0 * Math.min(1, node.amount / 200);
    deposit(p.food.values, gw, gh, p.cellSize, dpr, node.x, node.y, strength);
  }

  // touch paints FOOD pheromone
  if (state.input?.pointerDown) {
    deposit(p.food.values, gw, gh, p.cellSize, dpr, state.input.wx, state.input.wy, 4.0);
  }

  // NEW: player command paint (drag)
  if (state.command?.mode && state.command.mode !== "none" && state.input?.pointerDown) {
    const mode = state.command.mode;
    const amt =
      (mode === "rally") ? 4.2 :
      (mode === "harvest") ? 3.6 :
      -5.2; // avoid = negative (repel)

    deposit(p.command.values, gw, gh, p.cellSize, dpr, state.input.wx, state.input.wy, amt);
  }

  // ---------- Wave manager ----------
  const wave = state.wave;

  if (!wave.inProgress) {
    wave.nextIn -= dt;
    if (wave.nextIn <= 0) {
      wave.n += 1;
      wave.inProgress = true;
      wave.bannerTimer = 2.0;

      const stats = waveStats(wave.n);
      for (let i = 0; i < stats.count; i++) spawnPredatorAtEdge(state, stats);
      wave.predatorsAlive = stats.count;
    }
  } else {
    let alive = 0;
    for (const pr of state.predators) if (pr.active) alive++;
    wave.predatorsAlive = alive;

    if (alive === 0) {
      wave.inProgress = false;
      wave.nextIn = 7 + wave.n * 0.6;
    }
  }
  if (wave.bannerTimer > 0) wave.bannerTimer -= dt;

  // ---------- Predators ----------
  let anyPredatorActive = false;
  for (const pr of state.predators) {
    if (!pr.active) continue;
    anyPredatorActive = true;

    const dx = nest.x - pr.x;
    const dy = nest.y - pr.y;
    const len = Math.hypot(dx, dy) || 1;

    pr.x += (dx / len) * pr.speed * dt * dpr;
    pr.y += (dy / len) * pr.speed * dt * dpr;

    deposit(p.danger.values, gw, gh, p.cellSize, dpr, pr.x, pr.y, pr.emitStrength);

    const reachR = (nest.r * 1.1) * dpr;
    if (dist2(pr.x, pr.y, nest.x, nest.y) < reachR * reachR) {
      const dps = 18 + wave.n * 1.5;
      nest.hp -= dps * dt;

      if (nest.hp <= 0) {
        nest.hp = 0;
        state.game.over = true;
        state.game.message = "Colony Collapsed";
      }
    }
  }

  // threat meter
  if (anyPredatorActive) state.ui.threat = Math.min(100, state.ui.threat + state.tuning.threatRise * dt);
  else state.ui.threat = Math.max(0, state.ui.threat - state.tuning.threatFall * dt);

  // ---------- Soldier promotion (emergency defense) ----------
  const ants = state.ants ?? [];
  const threat01 = (state.ui.threat ?? 0) / 100;
  const frac = Math.min(0.35, state.tuning.soldierFraction ?? 0.22);

  let desiredSoldiers = Math.floor(ants.length * frac * threat01);

  let predatorNearNest = false;
  const defendR = (nest.r * 6) * dpr;
  for (const pr of state.predators) {
    if (!pr.active) continue;
    if (dist2(pr.x, pr.y, nest.x, nest.y) < defendR * defendR) { predatorNearNest = true; break; }
  }
  if (predatorNearNest) desiredSoldiers = Math.max(desiredSoldiers, 5);

  let currentSoldiers = 0;
  for (const a of ants) {
    if (!a.role) a.role = "worker";
    if (a.role === "soldier") currentSoldiers++;
  }

  if (currentSoldiers < desiredSoldiers) {
    for (const a of ants) {
      if (currentSoldiers >= desiredSoldiers) break;
      if (a.role === "worker") { a.role = "soldier"; a.carrying = false; currentSoldiers++; }
    }
  } else if (currentSoldiers > desiredSoldiers) {
    for (const a of ants) {
      if (currentSoldiers <= desiredSoldiers) break;
      if (a.role === "soldier") { a.role = "worker"; currentSoldiers--; }
    }
  }

  // ---------- Ant logic ----------
  for (const ant of ants) {
    const role = ant.role || "worker";

    // pickup / dropoff
    if (role === "worker" || role === "scout") {
      if (!ant.carrying) {
        for (const node of foodNodes) {
          if (node.amount <= 0) continue;
          const pickupR = 20 * dpr;
          if (dist2(node.x, node.y, ant.x, ant.y) < pickupR * pickupR) {
            ant.carrying = true;
            node.amount -= 1;
            break;
          }
        }
      } else {
        const dropR = (nest.r * 1.25) * dpr;
        if (dist2(nest.x, nest.y, ant.x, ant.y) < dropR * dropR) {
          ant.carrying = false;
          state.ui.food = Math.min((state.ui.food ?? 0) + 1, state.ui.maxFood ?? 200);
        }
      }
    }

    // command influence
    const cmd = sampleCommand(p.command.values, gw, gh, p.cellSize, dpr, ant.x, ant.y);
    const cmdT = clamp(cmd.strength * 0.18, 0, 1);

    const dangerHere = sampleBestDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y).bestVal;

    if ((role === "worker" || role === "scout") && dangerHere > 0.02) {
      const flee = sampleWorstDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      ant.dir = blendDir(ant.dir, flee.dir, 0.85);
      ant.dir += (Math.random() - 0.5) * 0.15;
    } else if (role === "soldier") {
      // target predator nearest to nest
      let target = null;
      let bestNestD2 = Infinity;
      for (const pr of state.predators) {
        if (!pr.active) continue;
        const dn2 = dist2(pr.x, pr.y, nest.x, nest.y);
        if (dn2 < bestNestD2) { bestNestD2 = dn2; target = pr; }
      }

      if (target) {
        const dx = target.x - ant.x;
        const dy = target.y - ant.y;
        ant.dir = Math.atan2(dy, dx);

        const attackR = 16 * dpr;
        if (dx * dx + dy * dy < attackR * attackR) {
          const baseDps = 22;
          const dpsBonus = (state.upgrades?.dps ?? 0) * 6;
          target.hp -= (baseDps + dpsBonus) * dt;

          if (target.hp <= 0) {
            target.hp = 0;
            target.active = false;
            state.ui.biomass = (state.ui.biomass ?? 0) + 1;
            state.milestones.totalBiomass = (state.milestones.totalBiomass ?? 0) + 1;
          }
        }

        deposit(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
      } else {
        ant.dir = Math.atan2(nest.y - ant.y, nest.x - ant.x);
      }

      if (cmdT > 0.001) ant.dir = blendDir(ant.dir, cmd.dir, clamp(cmdT * 1.35, 0, 1));
    } else {
      const followField = ant.carrying ? p.home.values : p.food.values;
      const depositField = ant.carrying ? p.food.values : p.home.values;

      const sampled = sampleBestDir(followField, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      const threshold = (role === "scout") ? 0.003 : 0.006;

      if (sampled.bestVal > threshold) ant.dir = sampled.dir;
      else ant.dir += (Math.random() - 0.5) * 0.35;

      if (cmdT > 0.001) {
        const weight = (role === "scout") ? 1.05 : 0.9;
        ant.dir = blendDir(ant.dir, cmd.dir, clamp(cmdT * weight, 0, 1));
      }

      deposit(depositField, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
    }

    // move
    const speedMult = (role === "soldier") ? 1.15 : (role === "scout" ? 1.25 : 1.0);
    ant.x += Math.cos(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;
    ant.y += Math.sin(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;

    // world bounds bounce
    if (ant.x < 0) { ant.x = 0; ant.dir = Math.PI - ant.dir; }
    if (ant.x > state.world.w) { ant.x = state.world.w; ant.dir = Math.PI - ant.dir; }
    if (ant.y < 0) { ant.y = 0; ant.dir = -ant.dir; }
    if (ant.y > state.world.h) { ant.y = state.world.h; ant.dir = -ant.dir; }
  }
}
