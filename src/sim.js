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

export function stepSim(state, dt) {
  state.time += dt;

  const p = state.pheromone;
  if (!p.imgData || !p.home?.values || !p.food?.values) return;

  const gw = p.gw, gh = p.gh;
  const dpr = state.view.dpr;

  // Slightly slower decay helps trails persist long enough to “lock”
  const decay = Math.pow(p.decayPerSecond ?? 0.92, dt);
  const k = p.diffuseRate ?? 0.22;

  // 1) decay
  decayField(p.home.values, decay);
  decayField(p.food.values, decay);

  // 2) diffuse (ping-pong)
  diffuseField(p.home.values, p.home.values2, gw, gh, k);
  diffuseField(p.food.values, p.food.values2, gw, gh, k);

  // swap
  [p.home.values, p.home.values2] = [p.home.values2, p.home.values];
  [p.food.values, p.food.values2] = [p.food.values2, p.food.values];

  // 3) BOOTSTRAP EMITTERS (THIS MAKES LOOPS HAPPEN)
  // Nest constantly emits HOME pheromone
  if (state.nest) {
    deposit(p.home.values, gw, gh, p.cellSize, dpr, state.nest.x, state.nest.y, 7.0);
  }

  // Food nodes constantly emit FOOD pheromone (scaled by remaining amount)
  if (state.foodNodes) {
    for (const node of state.foodNodes) {
      if (node.amount <= 0) continue;
      const strength = 3.5 * Math.min(1, node.amount / 200);
      deposit(p.food.values, gw, gh, p.cellSize, dpr, node.x, node.y, strength);
    }
  }

  // Optional: touch paints FOOD pheromone to “train” the system
  if (state.input.pointerDown) {
    deposit(p.food.values, gw, gh, p.cellSize, dpr, state.input.x, state.input.y, 4.0);
  }

  // 4) ant logic
  const ants = state.ants ?? [];
  cons
