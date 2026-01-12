const SAVE_KEY = "antsim_save_v1";
let _saveTimer = 0;

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

function nearestPredator(predators, x, y) {
  let best = null;
  let bestD2 = Infinity;
  for (const pr of predators) {
    if (!pr.active) continue;
    const dx = pr.x - x;
    const dy = pr.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = pr;
    }
  }
  return best;
}

function ensureSystems(state) {
  state.wave ??= { n: 0, inProgress: false, nextIn: 6, predatorsAlive: 0, bannerTimer: 0 };
  state.predators ??= [];
  state.tuning ??= { soldierFraction: 0.22, threatRise: 25, threatFall: 14 };
  state.game ??= { over: false, message: "" };

  state.brood ??= { timer: 0, intervalBase: 2.5, cost: 8, costGrowth: 1.06, maxAnts: 120 };
  state.upgrades ??= { brood: 0, dps: 0, nest: 0 };
  state.uiHit ??= { brood: null, dps: null, nest: null };
}

function resetPheromones(state) {
  const p = state.pheromone;
  const fields = [p.home, p.food, p.danger];
  for (const f of fields) {
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

function resetGame(state) {
  // keep upgrades & brood costs; reset run-state
  state.ui.food = 0;
  state.ui.biomass = 0;
  state.ui.threat = 0;

  state.predators = [];
  state.wave.n = 0;
  state.wave.inProgress = false;
  state.wave.nextIn = 6;
  state.wave.predatorsAlive = 0;
  state.wave.bannerTimer = 0;

  state.game.over = false;
  state.game.message = "";

  // reset nest hp (respect upgrade)
  applyNestUpgrade(state);
  state.nest.hp = state.nest.maxHp;

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
  if (edge === 0) { pr.x = 0; pr.y = Math.random() * state.view.h; }
  if (edge === 1) { pr.x = state.view.w; pr.y = Math.random() * state.view.h; }
  if (edge === 2) { pr.x = Math.random() * state.view.w; pr.y = 0; }
  if (edge === 3) { pr.x = Math.random() * state.view.w; pr.y = state.view.h; }

  state.predators.push(pr);
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function upgradeCost(key, level) {
  // simple escalating costs in BIOMASS
  if (key === "brood") return Math.floor(3 + level * 3 + level * level * 0.5);
  if (key === "dps") return Math.floor(4 + level * 4 + level * level * 0.6);
  if (key === "nest") return Math.floor(5 + level * 5 + level * level * 0.7);
  return 9999;
}

function tryPurchaseUpgrade(state, key) {
  const lvl = state.upgrades[key] ?? 0;
  const cost = upgradeCost(key, lvl);
  if ((state.ui.biomass ?? 0) < cost) return false;

  state.ui.biomass -= cost;
  state.upgrades[key] = lvl + 1;

  // apply immediate effects where appropriate
  if (key === "nest") applyNestUpgrade(state);
  return true;
}

function saveGame(state) {
  try {
    const payload = {
      ui: {
        food: state.ui.food ?? 0,
        biomass: state.ui.biomass ?? 0
      },
      upgrades: state.upgrades,
      brood: {
        cost: state.brood.cost,
        maxAnts: state.brood.maxAnts
      },
      wave: { n: state.wave.n }, // don't save timers
      nest: {
        maxHp: state.nest.maxHp,
        hp: state.nest.hp
      },
      antsCount: state.ants?.length ?? 0
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

// Exported so main.js can call it once after initWorld/resize
export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return;

    // ensure
    ensureSystems(state);

    // restore upgrades first
    if (s.upgrades) state.upgrades = { ...state.upgrades, ...s.upgrades };

    // restore brood cost/max
    if (s.brood?.cost) state.brood.cost = s.brood.cost;
    if (s.brood?.maxAnts) state.brood.maxAnts = s.brood.maxAnts;

    // restore resources
    if (s.ui) {
      state.ui.food = s.ui.food ?? state.ui.food;
      state.ui.biomass = s.ui.biomass ?? state.ui.biomass;
    }

    // restore nest upgrade-derived stats
    applyNestUpgrade(state);
    if (s.nest?.hp != null) state.nest.hp = Math.min(state.nest.maxHp, Math.max(0, s.nest.hp));

    // restore wave number only
    if (s.wave?.n != null) state.wave.n = Math.max(0, s.wave.n);

    // rebuild ants count
    const desired = Math.min(s.antsCount ?? 30, state.brood.maxAnts ?? 120);
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

  // tap-to-restart when game over
  if (state.game?.over) {
    if (state.input?.pointerDown) resetGame(state);
    return;
  }

  state.time += dt;

  const p = state.pheromone;
  if (!p?.imgData || !p.home?.values || !p.food?.values || !p.danger?.values) return;

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

  // autosave
  _saveTimer += dt;
  if (_saveTimer > 3) {
    _saveTimer = 0;
    saveGame(state);
  }

  // --- upgrades impact brood + nest ---
  const broodLvl = state.upgrades?.brood ?? 0;
  const broodInterval = Math.max(0.9, (state.brood.intervalBase ?? 2.5) - broodLvl * 0.35);

  applyNestUpgrade(state);

  // --- brood (food -> new workers) ---
  state.brood.timer += dt;
  if (state.brood.timer >= broodInterval) {
    state.brood.timer = 0;

    if ((state.ui.food ?? 0) >= (state.brood.cost ?? 8) && state.ants.length < (state.brood.maxAnts ?? 120)) {
      state.ui.food -= state.brood.cost;

      state.brood.cost = Math.ceil(state.brood.cost * (state.brood.costGrowth ?? 1.06));

      const nx = state.nest.x + (Math.random() - 0.5) * 30 * dpr;
      const ny = state.nest.y + (Math.random() - 0.5) * 30 * dpr;

      state.ants.push({
        x: nx,
        y: ny,
        dir: Math.random() * Math.PI * 2,
        speed: 30 + Math.random() * 20,
        carrying: false,
        role: "worker"
      });
    }
  }

  // --- upgrade tap handling (top-right buttons) ---
  // (only treat a tap if pointerDown AND it hits a chip; this is "press to buy")
  if (state.input?.pointerDown) {
    const x = state.input.x;
    const y = state.input.y;
    const hit = state.uiHit || {};

    if (pointInRect(x, y, hit.brood)) tryPurchaseUpgrade(state, "brood");
    else if (pointInRect(x, y, hit.dps)) tryPurchaseUpgrade(state, "dps");
    else if (pointInRect(x, y, hit.nest)) tryPurchaseUpgrade(state, "nest");
  }

  const decay = Math.pow(p.decayPerSecond ?? 0.92, dt);
  const k = p.diffuseRate ?? 0.22;

  // 1) decay
  decayField(p.home.values, decay);
  decayField(p.food.values, decay);
  decayField(p.danger.values, decay);

  // 2) diffuse (ping-pong)
  diffuseField(p.home.values, p.home.values2, gw, gh, k);
  diffuseField(p.food.values, p.food.values2, gw, gh, k);
  diffuseField(p.danger.values, p.danger.values2, gw, gh, k);

  // swap
  [p.home.values, p.home.values2] = [p.home.values2, p.home.values];
  [p.food.values, p.food.values2] = [p.food.values2, p.food.values];
  [p.danger.values, p.danger.values2] = [p.danger.values2, p.danger.values];

  // World refs
  const nest = state.nest;
  const foodNodes = state.foodNodes ?? [];

  // --- EMITTERS ---
  if (nest) deposit(p.home.values, gw, gh, p.cellSize, dpr, nest.x, nest.y, 7.0);

  for (const node of foodNodes) {
    if (node.amount <= 0) continue;
    const strength = 7.0 * Math.min(1, node.amount / 200);
    deposit(p.food.values, gw, gh, p.cellSize, dpr, node.x, node.y, strength);
  }

  // Optional: touch paints FOOD pheromone
  if (state.input?.pointerDown) {
    deposit(p.food.values, gw, gh, p.cellSize, dpr, state.input.x, state.input.y, 4.0);
  }

  // ----- WAVE MANAGER -----
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

  // ----- PREDATORS UPDATE -----
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

    // emit danger
    deposit(p.danger.values, gw, gh, p.cellSize, dpr, pr.x, pr.y, pr.emitStrength);

    // nest damage
    const ndx = pr.x - nest.x;
    const ndy = pr.y - nest.y;
    const reachR = (nest.r * 1.1) * dpr;

    if (ndx * ndx + ndy * ndy < reachR * reachR) {
      const dps = 18 + wave.n * 1.5;
      nest.hp -= dps * dt;

      if (nest.hp <= 0) {
        nest.hp = 0;
        state.game.over = true;
        state.game.message = "Colony Collapsed";
      }
    }
  }

  // threat meter rises/falls
  if (anyPredatorActive) state.ui.threat = Math.min(100, state.ui.threat + state.tuning.threatRise * dt);
  else state.ui.threat = Math.max(0, state.ui.threat - state.tuning.threatFall * dt);

  // --- SOLDIER PROMOTION ---
  const ants = state.ants ?? [];
  const threat01 = (state.ui.threat ?? 0) / 100;

  // cap soldier fraction so brood still matters
  const frac = Math.min(0.35, state.tuning.soldierFraction ?? 0.22);
  const desiredSoldiers = Math.floor(ants.length * frac * threat01);

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

  // --- ANT LOOP ---
  for (let ant of ants) {
    const role = ant.role || "worker";

    // Worker pickup/dropoff
    if (role === "worker") {
      if (!ant.carrying) {
        for (const node of foodNodes) {
          if (node.amount <= 0) continue;

          const dx = node.x - ant.x;
          const dy = node.y - ant.y;
          const pickupR = 20 * dpr;

          if (dx * dx + dy * dy < pickupR * pickupR) {
            ant.carrying = true;
            node.amount -= 1;
            break;
          }
        }
      } else {
        const dx = nest.x - ant.x;
        const dy = nest.y - ant.y;
        const dropR = (nest.r * 1.25) * dpr;

        if (dx * dx + dy * dy < dropR * dropR) {
          ant.carrying = false;
          state.ui.food = (state.ui.food ?? 0) + 1;
        }
      }
    }

    // Danger sensing
    const dangerHere = sampleBestDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y).bestVal;

    if (role === "worker" && dangerHere > 0.02) {
      const flee = sampleWorstDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      ant.dir = flee.dir + (Math.random() - 0.5) * 0.2;
    } else if (role === "soldier") {
      const target = nearestPredator(state.predators, ant.x, ant.y);

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
          }
        }

        deposit(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.35);
      } else {
        // idle guard
        const dx = nest.x - ant.x;
        const dy = nest.y - ant.y;
        ant.dir = Math.atan2(dy, dx);
      }
    } else {
      // normal worker trail-following
      const followField = ant.carrying ? p.home.values : p.food.values;
      const depositField = ant.carrying ? p.food.values : p.home.values;

      const sampled = sampleBestDir(followField, gw, gh, p.cellSize, dpr, ant.x, ant.y);

      if (sampled.bestVal > 0.006) ant.dir = sampled.dir;
      else ant.dir += (Math.random() - 0.5) * 0.35;

      deposit(depositField, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
    }

    // Move
    const speedMult = (role === "soldier") ? 1.15 : 1.0;
    ant.x += Math.cos(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;
    ant.y += Math.sin(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;

    // Bounds bounce
    if (ant.x < 0) { ant.x = 0; ant.dir = Math.PI - ant.dir; }
    if (ant.x > state.view.w) { ant.x = state.view.w; ant.dir = Math.PI - ant.dir; }
    if (ant.y < 0) { ant.y = 0; ant.dir = -ant.dir; }
    if (ant.y > state.view.h) { ant.y = state.view.h; ant.dir = -ant.dir; }
  }
}
