export function createState() {
  return {
    time: 0,
    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },
    input: { pointerDown: false, x: 0, y: 0 },

    pheromone: {
  gw: 0,
  gh: 0,
  values: null,     // front buffer
  values2: null,    // back buffer (for diffusion)
  imgData: null,
  cellSize: 12,

  // tuning
  decayPerSecond: 0.88, // closer to 1 = slower fade
  diffuseRate: 0.22     // 0..1, how much spreads each sim tick
}
  };
}
