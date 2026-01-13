// src/sim.js
const SAVE_KEY = "antsim_save_v5";
let _saveTimer = 0;

const TECH = {
  scouts: { name: "Scout Division", costBiomass: 8, req: (s) => (s.wave?.n ?? 0) >= 2 },
  sentry: { name: "Sentry Pylons", costBiomass: 12, req: (s) => (s.milestones?.totalBiomass ?? 0) >= 10 }
};

// Civ building defs (lvl affects time + capacity)
const BUILD = {
  nursery:    { baseCost: 6,  time: 1.5, radiusCss: 90,  maxAssigned: 6 },
  hatchery:   { baseCost: 10, time: 2.5, radiusCss: 100, maxAssigned: 6 },
  storehouse: { baseCost: 8,  time: 0,   radiusCss: 0,   maxAssigned: 0 }
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

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

  // px/py are in world (DPR pixels). Convert to CSS pixels for grid mapping.
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

  let bestDx = 0, bestDy = 0, bestVal = 0;

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
}

function resetPheromones(state) {
  const p = state.pheromone;
  for (const f of [p.home, p.food, p.danger]) {
    if (!f?.values || !f?.values2) continue;
    f.values.fill(0);
    f.values2.fill(0);
  }
}

function applyNestUpgrade(state) {
  const lvl = state.upgrades?.nest ?? 0;
  const maxHp = 100 + lvl * 40;
  state.nest.maxHp = maxHp;
  state.nest.hp = Math.min(state.nest.hp, maxHp);
}

function recalcCivPassives(state) {
  const stores = buildingCount(state, "storehouse");
  state.ui.maxFood = 200 + stores * 120;

  // efficiency: reduce brood cost growth slightly
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
  const pr = {
    active: true,
    x: 0, y: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    emitStrength: stats.emitStrength,
    speed: stats.speed
  };

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

function buildingCost(state, type) {
  const base = BUILD[type].baseCost;
  const n = buildingCount(state, type);
  return Math.floor(base + n * 2 + n * n * 0.25);
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
  return {
    x: Math.round(wx / cell) * cell,
    y: Math.round(wy / cell) * cell
  };
}

function placeBuilding(state, type, wx, wy) {
  const cost = buildingCost(state, type);
  if ((state.ui.biomass ?? 0) < cost) return false;

  const s = snapWorld(state, wx, wy);
  const x = clamp(s.x, 0, state.world.w);
  const y = clamp(s.y, 0, state.world.h);

  // overlap guard
  for (const b of state.buildings.list) {
    if (dist2(b.x, b.y, x, y) < (40 * state.view.dpr) ** 2) return false;
  }
  // avoid placing on nest
  if (dist2(state.nest.x, state.nest.y, x, y) < (60 * state.view.dpr) ** 2) return false;

  state.ui.biomass -= cost;

  const newB = { id: state.buildings.nextId++, type, x, y, lvl: 1, progress: 0 };
  state.buildings.list.push(newB);

  state.selectedBuildingId = newB.id;
  recalcCivPassives(state);
  return true;
}

function findBuildingById(state, id) {
  if (id == null) return null;
  for (const b of state.buildings.list) if (b.id === id) return b;
  return null;
}

function selectBuildingAt(state, wx, wy) {
  const dpr = state.view.dpr;
  const pickR = 18 * dpr;

  let best = null;
  let bestD2 = pickR * pickR;

  for (const b of state.buildings.list) {
    const r = (12 * dpr) + (b.lvl || 1) * 1.5 * dpr + 6 * dpr;
    const rr = Math.max(pickR, r);
    const d2 = dist2(b.x, b.y, wx, wy);
    if (d2 <= rr * rr && d2 <= bestD2) {
      bestD2 = d2;
      best = b;
    }
  }

  if (!best) {
    state.selectedBuildingId = null;
    return null;
  }

  state.selectedBuildingId = (state.selectedBuildingId === best.id) ? null : best.id;
  return best;
}

function countAssignedWorkers(state, b) {
  const dpr = state.view.dpr;
  const def = BUILD[b.type];
  const lvl = b.lvl ?? 1;

  const maxAssigned = def.maxAssigned + Math.floor((lvl - 1) * 1.5);
  const radius = (def.radiusCss || 0) * dpr * (1 + (lvl - 1) * 0.08);
  if (radius <= 0) return 0;

  let count = 0;
  for (const a of state.ants) {
    const role = a.role || "worker";
    if (role !== "worker" && role !== "scout") continue;
    if (a.carrying) continue;

    if (dist2(a.x, a.y, b.x, b.y) < radius * radius) {
      count++;
      if (count >= maxAssigned) break;
    }
  }
  return count;
}

function buildingSpeedMultiplier(b, assigned) {
  const lvl = b.lvl ?? 1;
  const lvlBonus = 1 + (lvl - 1) * 0.22;
  return lvlBonus * (1 + assigned * 0.6);
}

function chooseHatchRole(state) {
  const threat = state.ui.threat ?? 0;
  if (threat >= 60) return "soldier";

  if (state.tech?.unlocked?.scouts) {
    let scouts = 0;
    for (const a of state.ants) if ((a.role || "worker") === "scout") scouts++;
    if (scouts / Math.max(1, state.ants.length) < 0.15) return "scout";
  }
  return "worker";
}

function saveGame(state) {
  try {
    const payload = {
      ui: {
        food: state.ui.food ?? 0,
        biomass: state.ui.biomass ?? 0,
        larvae: state.ui.larvae ?? 0,
        maxFood: state.ui.maxFood ?? 200
      },
      upgrades: state.upgrades ?? { brood: 0, dps: 0, nest: 0 },
      brood: {
        cost: state.brood.cost ?? 8,
        maxAnts: state.brood.maxAnts ?? 140,
        costGrowth: state.brood.costGrowth ?? 1.06
      },
      wave: { n: state.wave?.n ?? 0 },
      nest: { maxHp: state.nest.maxHp ?? 100, hp: state.nest.hp ?? 100 },
      tech: state.tech ?? { unlocked: {}, purchased: {} },
      buildings: state.buildings ?? { list: [], nextId: 1 },
      milestones: state.milestones ?? { bestWave: 0, totalBiomass: 0, peakAnts: 0 },
      antsCount: state.ants?.length ?? 0
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return;

    ensureSystems(state);

    if (s.upgrades) state.upgrades = { ...state.upgrades, ...s.upgrades };
    if (s.tech) state.tech = { ...state.tech, ...s.tech };
    if (s.milestones) state.milestones = { ...state.milestones, ...s.milestones };

    if (s.buildings?.list) state.buildings.list = s.buildings.list;
    if (s.buildings?.nextId != null) state.buildings.nextId = s.buildings.nextId;

    if (s.brood?.cost != null) state.brood.cost = s.brood.cost;
    if (s.brood?.maxAnts != null) state.brood.maxAnts = s.brood.maxAnts;
    if (s.brood?.costGrowth != null) state.brood.costGrowth = s.brood.costGrowth;

    if (s.ui) {
      state.ui.food = s.ui.food ?? state.ui.food;
      state.ui.biomass = s.ui.biomass ?? state.ui.biomass;
      state.ui.larvae = s.ui.larvae ?? state.ui.larvae;
      state.ui.maxFood = s.ui.maxFood ?? state.ui.maxFood;
    }

    if (s.wave?.n != null) state.wave.n = Math.max(0, s.wave.n);

    applyNestUpgrade(state);
    if (s.nest?.hp != null) state.nest.hp = Math.min(state.nest.maxHp, Math.max(0, s.nest.hp));

    recalcCivPassives(state);

    // rebuild ants
    const desired = Math.min(s.antsCount ?? 30, state.brood.maxAnts ?? 140);
    state.ants.length = 0;
    for (let i = 0; i < desired; i++) {
      state.ants.push({
        x: state.nest.x + (Math.random() - 0.5) * 60 * state.view.dpr,
        y: state.nest.y + (Math.random() - 0.5) * 60 * state.view.dpr,
        dir: Math.random() * Math.PI * 2,
        speed: 30 + Math.random() * 20,
        carrying: false,
        role: "worker"
      });
    }
  } catch {
    // ignore
  }
}

export function stepSim(state, dt) {
  ensureSystems(state);

  const tapped = !!(state.input?.justReleased && state.input?.wasTap);
  const released = !!state.input?.justReleased;

  // consume edge flags
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
  if (!p?.imgData || !p.home?.values || !p.food?.values || !p.danger?.values) return;

  // autosave
  _saveTimer += dt;
  if (_saveTimer > 3) {
    _saveTimer = 0;
    saveGame(state);
  }

  // milestones
  state.milestones.bestWave = Math.max(state.milestones.bestWave, state.wave?.n ?? 0);
  state.milestones.peakAnts = Math.max(state.milestones.peakAnts, state.ants?.length ?? 0);

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

  applyNestUpgrade(state);

  // ---------- UI taps ----------
  if (tapped) {
    const sx = state.input.x, sy = state.input.y;
    const hit = state.uiHit || {};

    // build bar toggles mode
    const tapNursery = pointInRect(sx, sy, hit.build_nursery);
    const tapHatchery = pointInRect(sx, sy, hit.build_hatchery);
    const tapStore = pointInRect(sx, sy, hit.build_storehouse);

    if (tapNursery || tapHatchery || tapStore) {
      const next = tapNursery ? "nursery" : tapHatchery ? "hatchery" : "storehouse";
      state.build.mode = (state.build.mode === next) ? null : next;

      if (state.build.mode) {
        state.build.ghostX = state.input.wx;
        state.build.ghostY = state.input.wy;
      }
    } else if (pointInRect(sx, sy, hit.buildpanel_upgrade)) {
      const b = findBuildingById(state, state.selectedBuildingId);
      if (b) {
        const cost = buildingUpgradeCost(b);
        if ((state.ui.biomass ?? 0) >= cost) {
          state.ui.biomass -= cost;
          b.lvl = (b.lvl ?? 1) + 1;
          recalcCivPassives(state);
        }
      }
    } else {
      // world tap selects a building (unless currently placing)
      if (!state.build?.mode) {
        selectBuildingAt(state, state.input.wx, state.input.wy);
      }
    }
  }

  // ghost snap while dragging
  if (state.build?.mode && state.build.dragging) {
    const s = snapWorld(state, state.input.wx, state.input.wy);
    state.build.ghostX = s.x;
    state.build.ghostY = s.y;
  }

  // on release: place building
  if (released && state.build?.mode) {
    const sx = state.input.x, sy = state.input.y;
    const hit = state.uiHit || {};
    const releasedOnUI =
      pointInRect(sx, sy, hit.build_nursery) ||
      pointInRect(sx, sy, hit.build_hatchery) ||
      pointInRect(sx, sy, hit.build_storehouse) ||
      pointInRect(sx, sy, hit.buildpanel_upgrade);

    if (!releasedOnUI) {
      placeBuilding(state, state.build.mode, state.build.ghostX, state.build.ghostY);
      // stay in build mode for multi-place
    }
  }

  // ---------- Natural brood ----------
  const broodLvl = state.upgrades?.brood ?? 0;
  const broodInterval = Math.max(0.9, (state.brood.intervalBase ?? 2.5) - broodLvl * 0.35);

  state.brood.timer += dt;
  if (state.brood.timer >= broodInterval) {
    state.brood.timer = 0;

    if ((state.ui.food ?? 0) >= (state.brood.cost ?? 8) && state.ants.length < (state.brood.maxAnts ?? 140)) {
      state.ui.food -= state.brood.cost;
      state.brood.cost = Math.ceil(state.brood.cost * (state.brood.costGrowth ?? 1.06));

      let role = "worker";
      if (state.tech?.unlocked?.scouts && Math.random() < 0.20) role = "scout";

      state.ants.push({
        x: state.nest.x + (Math.random() - 0.5) * 30 * dpr,
        y: state.nest.y + (Math.random() - 0.5) * 30 * dpr,
        dir: Math.random() * Math.PI * 2,
        speed: role === "scout" ? (46 + Math.random() * 14) : (30 + Math.random() * 20),
        carrying: false,
        role
      });
    }
  }

  // ---------- Pheromones ----------
  const decay = Math.pow(p.decayPerSecond ?? 0.92, dt);
  const k = p.diffuseRate ?? 0.22;

  decayField(p.home.values, decay);
  decayField(p.food.values, decay);
  decayField(p.danger.values, decay);

  diffuseField(p.home.values, p.home.values2, gw, gh, k);
  diffuseField(p.food.values, p.food.values2, gw, gh, k);
  diffuseField(p.danger.values, p.danger.values2, gw, gh, k);

  [p.home.values, p.home.values2] = [p.home.values2, p.home.values];
  [p.food.values, p.food.values2] = [p.food.values2, p.food.values];
  [p.danger.values, p.danger.values2] = [p.danger.values2, p.danger.values];

  const nest = state.nest;
  const foodNodes = state.foodNodes ?? [];

  // bootstrap emitters
  deposit(p.home.values, gw, gh, p.cellSize, dpr, nest.x, nest.y, 7.0);

  for (const node of foodNodes) {
    if (node.amount <= 0) continue;
    const strength = 7.0 * Math.min(1, node.amount / 200);
    deposit(p.food.values, gw, gh, p.cellSize, dpr, node.x, node.y, strength);
  }

  // touch paints FOOD pheromone in world coords
  if (state.input?.pointerDown) {
    deposit(p.food.values, gw, gh, p.cellSize, dpr, state.input.wx, state.input.wy, 4.0);
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

    // move toward nest
    const dx = nest.x - pr.x;
    const dy = nest.y - pr.y;
    const len = Math.hypot(dx, dy) || 1;

    pr.x += (dx / len) * pr.speed * dt * dpr;
    pr.y += (dy / len) * pr.speed * dt * dpr;

    // danger pheromone emission
    deposit(p.danger.values, gw, gh, p.cellSize, dpr, pr.x, pr.y, pr.emitStrength);

    // damage nest if reached
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

  // ---------- Civ production ----------
  for (const b of state.buildings.list) {
    const def = BUILD[b.type];
    if (!def) continue;

    const lvl = b.lvl ?? 1;
    const assigned = countAssignedWorkers(state, b);
    const speed = buildingSpeedMultiplier(b, assigned);

    if (b.type === "nursery") {
      const t = Math.max(0.6, def.time * Math.pow(0.86, lvl - 1));
      b.progress += (dt / t) * speed;

      while (b.progress >= 1) {
        if ((state.ui.food ?? 0) <= 0) { b.progress = 0.99; break; }
        state.ui.food -= 1;
        state.ui.larvae = (state.ui.larvae ?? 0) + 1;
        b.progress -= 1;
      }
    } else if (b.type === "hatchery") {
      const t = Math.max(0.9, def.time * Math.pow(0.88, lvl - 1));
      b.progress += (dt / t) * speed;

      while (b.progress >= 1) {
        if ((state.ui.larvae ?? 0) < 2) { b.progress = 0.99; break; }
        if (state.ants.length >= (state.brood.maxAnts ?? 140)) { b.progress = 0.99; break; }

        state.ui.larvae -= 2;

        const role = chooseHatchRole(state);
        const baseSpeed = role === "scout" ? (46 + Math.random() * 14) : (30 + Math.random() * 20);

        state.ants.push({
          x: b.x + (Math.random() - 0.5) * 24 * dpr,
          y: b.y + (Math.random() - 0.5) * 24 * dpr,
          dir: Math.random() * Math.PI * 2,
          speed: baseSpeed,
          carrying: false,
          role
        });

        b.progress -= 1;
      }
    } else if (b.type === "storehouse") {
      b.progress = 0;
    }
  }

  // ---------- Soldier promotion (FIXED: emergency defenders when predator nears nest) ----------
  const ants = state.ants ?? [];
  const threat01 = (state.ui.threat ?? 0) / 100;
  const frac = Math.min(0.35, state.tuning.soldierFraction ?? 0.22);

  let desiredSoldiers = Math.floor(ants.length * frac * threat01);

  // EMERGENCY DEFENSE: if any predator is near the nest, force defenders immediately
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
      if (a.role === "worker") {
        a.role = "soldier";
        a.carrying = false;
        currentSoldiers++;
      }
    }
  } else if (currentSoldiers > desiredSoldiers) {
    for (const a of ants) {
      if (currentSoldiers <= desiredSoldiers) break;
      if (a.role === "soldier") {
        a.role = "worker";
        currentSoldiers--;
      }
    }
  }

  // ---------- Ant logic ----------
  for (const ant of ants) {
    const role = ant.role || "worker";

    // forage (worker + scout)
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

    const dangerHere = sampleBestDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y).bestVal;

    if ((role === "worker" || role === "scout") && dangerHere > 0.02) {
      // flee danger
      const flee = sampleWorstDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      ant.dir = flee.dir + (Math.random() - 0.5) * 0.2;
    } else if (role === "soldier") {
      // SOLDIER AI (FIXED): prioritize predators threatening the nest
      let target = null;
      let bestNestD2 = Infinity;

      for (const pr of state.predators) {
        if (!pr.active) continue;
        const dn2 = dist2(pr.x, pr.y, nest.x, nest.y);
        if (dn2 < bestNestD2) {
          bestNestD2 = dn2;
          target = pr;
        }
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

        // reinforce danger field around combat
        deposit(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
      } else {
        // no predator: guard nest
        ant.dir = Math.atan2(nest.y - ant.y, nest.x - ant.x);
      }
    } else {
      // trail-following (worker/scout when not fleeing)
      const followField = ant.carrying ? p.home.values : p.food.values;
      const depositField = ant.carrying ? p.food.values : p.home.values;

      const sampled = sampleBestDir(followField, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      const threshold = (role === "scout") ? 0.003 : 0.006;

      if (sampled.bestVal > threshold) ant.dir = sampled.dir;
      else ant.dir += (Math.random() - 0.5) * 0.35;

      deposit(depositField, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
    }

    // move
    const speedMult = (role === "soldier") ? 1.15 : (role === "scout" ? 1.25 : 1.0);
    ant.x += Math.cos(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;
    ant.y += Math.sin(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;

    // bounds bounce (WORLD bounds)
    if (ant.x < 0) { ant.x = 0; ant.dir = Math.PI - ant.dir; }
    if (ant.x > state.world.w) { ant.x = state.world.w; ant.dir = Math.PI - ant.dir; }
    if (ant.y < 0) { ant.y = 0; ant.dir = -ant.dir; }
    if (ant.y > state.world.h) { ant.y = state.world.h; ant.dir = -ant.dir; }
  }
}
