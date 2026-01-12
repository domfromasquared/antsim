export function stepSim(state, dt) {
  state.time += dt;

  const p = state.pheromone;
  if (!p.values || !p.values2) return;

  const gw = p.gw, gh = p.gh;
  const front = p.values;
  const back = p.values2;

  // 1) Decay
  const decay = Math.pow(p.decayPerSecond, dt);
  for (let i = 0; i < front.length; i++) front[i] *= decay;

  // 2) Diffusion (ping-pong)
  // Simple stable model: new = lerp(center, avg4, diffuseRate)
  const k = p.diffuseRate;
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

  // swap buffers
  p.values = back;
  p.values2 = front;

  // 3) Deposit on touch (into the current front buffer)
  if (state.input.pointerDown) {
    const vals = p.values;

    const cssX = state.input.x / state.view.dpr;
    const cssY = state.input.y / state.view.dpr;
    const cx = Math.floor(cssX / p.cellSize);
    const cy = Math.floor(cssY / p.cellSize);

    const r = 2;          // brush radius (cells)
    const strength = 3.0; // deposit per tick

    for (let yy = cy - r; yy <= cy + r; yy++) {
      if (yy < 0 || yy >= gh) continue;
      for (let xx = cx - r; xx <= cx + r; xx++) {
        if (xx < 0 || xx >= gw) continue;

        const dx = xx - cx;
        const dy = yy - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;

        const falloff = 1 - d2 / (r * r + 0.0001);
        vals[yy * gw + xx] += strength * falloff;
      }
    }
  }
}
