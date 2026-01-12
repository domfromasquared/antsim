export function stepSim(state, dt) {
  state.time += dt;

  const p = state.pheromone;
  if (!p.values) return;

  // Decay (tweakable)
  const decayPerSecond = 0.85; // closer to 1 = slower decay
  const decay = Math.pow(decayPerSecond, dt);

  const vals = p.values;
  for (let i = 0; i < vals.length; i++) vals[i] *= decay;

  // Deposit on touch
  if (state.input.pointerDown) {
    const gw = p.gw, gh = p.gh;

    // Convert DPR pixels -> CSS pixels, then -> cell coords
    const cssX = state.input.x / state.view.dpr;
    const cssY = state.input.y / state.view.dpr;
    const cx = Math.floor(cssX / p.cellSize);
    const cy = Math.floor(cssY / p.cellSize);

    // Brush radius in cells
    const r = 2;
    const strength = 2.0; // deposit amount per tick

    for (let y = cy - r; y <= cy + r; y++) {
      if (y < 0 || y >= gh) continue;
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || x >= gw) continue;

        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;

        const falloff = 1 - d2 / (r * r + 0.0001);
        vals[y * gw + x] += strength * falloff;
      }
    }
  }
}
