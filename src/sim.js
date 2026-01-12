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

// Move away from danger by choosing the lowest neighbor
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

function ensurePredator(state) {
  if (!state.predator) {
    state.predator = {
      active: false,
      x: 0, y: 0,
      hp: 0,
      maxHp: 80,
      spawnTimer: 6,
      emitStrength: 10,
      speed: 55
    };
  } else {
    if (typeof state.predator.maxHp !== "number") state.predator.maxHp = 80;
    if (typeof state.predator.emitStrength !== "number") state.predator.emitStrength = 10;
    if (typeof state.predator.speed !== "number") state.predator.speed = 55;
    if (typeof state.predator.spawnTimer !== "number") state.predator.spawnTimer = 6;
  }
  if (!state.tuning) {
    state.tuning = {
      soldierFraction: 0.22,
      threatRise: 25,
      threatFall: 14
    };
  }
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
  // reset nest
  if (state.nest) {
    state.nest.hp = state.nest.maxHp ?? 100;
  }

  // reset ui
  state.ui.food = 0;
  state.ui.biomass = 0;
  state.ui.threat = 0;

  // reset predator
  if (state.predator) {
    state.predator.active = false;
    state.predator.hp = 0;
    state.predator.spawnTimer = 6;
  }

  // reset game flags
  state.game.over = false;
  state.game.message = "";

  resetPheromones(state);
}

export function stepSim(state, dt) {
  // stop sim if game over
if (state.game?.over) return;
  state.time += dt;
  // tap to restart when game over
if (state.game?.over && state.input?.pointerDown)
  resetGame(state);

  const p = state.pheromone;
  if (!p?.imgData || !p.home?.values || !p.food?.values) return;

  ensurePredator(state);

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

  const decay = Math.pow(p.decayPerSecond ?? 0.92, dt);
  const k = p.diffuseRate ?? 0.22;

  // 1) decay
  decayField(p.home.values, decay);
  decayField(p.food.values, decay);
  if (p.danger?.values) decayField(p.danger.values, decay);

  // 2) diffuse (ping-pong)
  diffuseField(p.home.values, p.home.values2, gw, gh, k);
  diffuseField(p.food.values, p.food.values2, gw, gh, k);
  if (p.danger?.values && p.danger?.values2) {
    diffuseField(p.danger.values, p.danger.values2, gw, gh, k);
  }

  // swap
  [p.home.values, p.home.values2] = [p.home.values2, p.home.values];
  [p.food.values, p.food.values2] = [p.food.values2, p.food.values];
  if (p.danger?.values && p.danger?.values2) {
    [p.danger.values, p.danger.values2] = [p.danger.values2, p.danger.values];
  }

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

  // --- PREDATOR SYSTEM ---
  const predator = state.predator;
  predator.spawnTimer -= dt;

  if (!predator.active && predator.spawnTimer <= 0) {
    predator.active = true;
    predator.maxHp = predator.maxHp ?? 80;
    predator.hp = predator.maxHp;

    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { predator.x = 0; predator.y = Math.random() * state.view.h; }
    if (edge === 1) { predator.x = state.view.w; predator.y = Math.random() * state.view.h; }
    if (edge === 2) { predator.x = Math.random() * state.view.w; predator.y = 0; }
    if (edge === 3) { predator.x = Math.random() * state.view.w; predator.y = state.view.h; }
  }

  if (predator.active && nest) {
    // move toward nest
    const dx = nest.x - predator.x;
    const dy = nest.y - predator.y;
    const len = Math.hypot(dx, dy) || 1;

    predator.x += (dx / len) * predator.speed * dt * dpr;
    predator.y += (dy / len) * predator.speed * dt * dpr;

    // emit danger pheromone
    if (p.danger?.values) {
      deposit(p.danger.values, gw, gh, p.cellSize, dpr, predator.x, predator.y, predator.emitStrength);
    }

    // NEST DAMAGE if predator reaches nest
if (nest) {
  const ndx = predator.x - nest.x;
  const ndy = predator.y - nest.y;
  const reachR = (nest.r * 1.1) * dpr;

  if (ndx * ndx + ndy * ndy < reachR * reachR) {
    const dps = 18; // nest damage per second
    nest.hp -= dps * dt;

    if (nest.hp <= 0) {
      nest.hp = 0;
      state.game.over = true;
      state.game.message = "Colony Collapsed";
    }
  }
}

    // threat rises
    state.ui.threat = Math.min(100, state.ui.threat + state.tuning.threatRise * dt);
  } else {
    // threat falls
    state.ui.threat = Math.max(0, state.ui.threat - state.tuning.threatFall * dt);
  }

  // --- SOLDIER PROMOTION/DEMOTION BASED ON THREAT ---
  const ants = state.ants ?? [];
  const threat01 = (state.ui.threat ?? 0) / 100;
  const desiredSoldiers = Math.floor(ants.length * (state.tuning.soldierFraction ?? 0.22) * threat01);

  let currentSoldiers = 0;
  for (const a of ants) {
    if ((a.role || "worker") === "soldier") currentSoldiers++;
    if (!a.role) a.role = "worker";
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

    // WORKER: pickup/dropoff loop
    if (role === "worker") {
      if (!ant.carrying) {
        for (let node of foodNodes) {
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

    // DANGER REACTION
    let dangerHere = 0;
    if (p.danger?.values) {
      dangerHere = sampleBestDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y).bestVal;
    }

    if (role === "worker" && dangerHere > 0.02 && p.danger?.values) {
      // flee downhill away from danger
      const flee = sampleWorstDir(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y);
      ant.dir = flee.dir + (Math.random() - 0.5) * 0.2;
    } else if (role === "soldier") {
      if (predator.active) {
        const dx = predator.x - ant.x;
        const dy = predator.y - ant.y;
        ant.dir = Math.atan2(dy, dx);

        // attack if close
        const attackR = 16 * dpr;
        if (dx * dx + dy * dy < attackR * attackR) {
          predator.hp -= 22 * dt; // DPS
          if (predator.hp <= 0) {
            predator.active = false;
            predator.spawnTimer = 10 + Math.random() * 8;
            state.ui.biomass = (state.ui.biomass ?? 0) + 1;
          }
        }

        // soldiers “thicken” danger mark near combat
        if (p.danger?.values) {
          deposit(p.danger.values, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.35);
        }
      } else if (nest) {
        // rally near nest when idle
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

      if (sampled.bestVal > 0.006) {
        ant.dir = sampled.dir;
      } else {
        ant.dir += (Math.random() - 0.5) * 0.35;
      }

      // leave trail
      deposit(depositField, gw, gh, p.cellSize, dpr, ant.x, ant.y, 0.45);
    }

    // MOVE
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
