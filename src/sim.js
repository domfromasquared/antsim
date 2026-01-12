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

  // px/py are in DPR pixels (canvas space). Convert to CSS pixels for grid mapping.
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

function ensureWaveSystem(state) {
  state.wave ??= { n: 0, inProgress: false, nextIn: 6, predatorsAlive: 0, bannerTimer: 0 };
  state.predators ??= [];
  state.tuning ??= { soldierFraction: 0.22, threatRise: 25, threatFall: 14 };
  state.game ??= { over: false, message: "" };
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

function resetGame(state) {
  if (state.nest) state.nest.hp = state.nest.maxHp ?? 100;

  state.ui.food = 0;
  state.ui.biomass = 0;
  state.ui.threat = 0;

  // reset waves/predators
  state.predators = [];
  state.wave.n = 0;
  state.wave.inProgress = false;
  state.wave.nextIn = 6;
  state.wave.predatorsAlive = 0;
  state.wave.bannerTimer = 0;

  // back-compat predator cleared too
  if (state.predator) {
    state.predator.active = false;
    state.predator.hp = 0;
    state.predator.spawnTimer = 6;
  }

  state.game.over = false;
  state.game.message = "";

  resetPheromones(state);
}

function waveStats(waveN) {
  // waveN starts at 1
  return {
    hp: 70 + waveN * 14,
    speed: 48 + waveN * 2.2,
    emitStrength: 9 + waveN * 0.7,
    count: 1 + Math.floor((waveN - 1) / 3) // +1 every 3 waves
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

export function stepSim(state, dt) {
  ensureWaveSystem(state);

  // tap to restart when game over
  if (state.game?.over) {
    if (state.input?.pointerDown) resetGame(state);
    return;
  }

  state.time += dt;

  const p = state.pheromone;
  if (!p?.imgData || !p.home?.values || !p.food?.values || !p.danger?.values) return;

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

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

  // --- EMITTERS: bootstrap gradients ---
  if (nest) {
    deposit(p.home.values, gw, gh, p.cellSize, dpr, nest.x, nest.y, 7.0);
  }

  for (const node of foodNodes) {
    if (node.amount <= 0) continue;
    const strength = 7.0 * Math.min(1, node.amount / 200);
    deposit(p.food.values, gw, gh, p.cellSize, dpr, node.x, node.y, strength);
  }

  // Optional: touch paints FOOD pheromone to “train”
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

    if (nest) {
      // move toward nest
      const dx = nest.x - pr.x;
      const dy = nest.y - pr.y;
      const len = Math.hypot(dx, dy) || 1;

      pr.x += (dx / len) * pr.speed * dt * dpr;
      pr.y += (dy / len) * pr.speed * dt * dpr;

      // emit danger pheromone
      deposit(p.danger.values, gw, gh, p.cellSize, dpr, pr.x, pr.y, pr.emitStrength);

      // nest damage when reached
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
  }

  // threat meter rises/falls
  if (anyPredatorActive) {
    state.ui.threat = Math.min(100, state.ui.threat + state.tuning.threatRise * dt);
  } else {
    state.ui.threat = Math.max(0, state.ui.threat - state.tuning.threatFall * dt);
  }

  // --- SOLDIER PROMOTION/DEMOTION BASED ON THREAT ---
  const ants = state.ants ?? [];
  const threat01 = (state.ui.threat ?? 0) / 100;
  const desiredSoldiers = Math.floor(ants.length * (state.tuning.soldierFraction ?? 0.22) * threat01);

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

  // --- ANT LOGIC ---
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
      } else if (nest) {
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
      // flee downhill away from danger
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
          target.hp -= 22 * dt;
          if (target.hp <= 0) {
            target.hp = 0;
            target.active = false;
            state.ui.biomass = (state.ui.biomass ?? 0) + 1;
          }
        }

        // thicken danger near combat for clearer flee behavior
        deposit(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.35);
      } else if (nest) {
        // idle guard near nest
        const dx = nest.x - ant.x;
        const dy = nest.y - ant.y;
        ant.dir = Math.atan2(dy, dx);
      } else {
        ant.dir += (Math.random() - 0.5) * 0.3;
      }
    } else {
      // normal worker trail-following
      const followField = ant.carrying ? p.home.values : p.food.values;
      const depositField = ant.carrying ? p.food.values : p.home.values;

      const sampled = sampleBestDir(followField, gw, gh, p.cellSize, dpr, ant.x, ant.y);

      if (sampled.bestVal > 0.006) ant.dir = sampled.dir;
      else ant.dir += (Math.random() - 0.5) * 0.35;

      // leave trail
      deposit(depositField, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
    }

    // move
    const speedMult = (role === "soldier") ? 1.15 : 1.0;
    ant.x += Math.cos(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;
    ant.y += Math.sin(ant.dir) * (ant.speed || 60) * speedMult * dt * dpr;

    // bounds bounce
    if (ant.x < 0) { ant.x = 0; ant.dir = Math.PI - ant.dir; }
    if (ant.x > state.view.w) { ant.x = state.view.w; ant.dir = Math.PI - ant.dir; }
    if (ant.y < 0) { ant.y = 0; ant.dir = -ant.dir; }
    if (ant.y > state.view.h) { ant.y = state.view.h; ant.dir = -ant.dir; }
  }
}
