export function createState() {
  return {
    time: 0,
    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },
    input: { pointerDown: false, x: 0, y: 0 },

    pheromone: {
      gw: 0,           // grid width in cells
      gh: 0,           // grid height in cells
      values: null,    // Float32Array
      imgData: null,   // ImageData for fast draw
      cellSize: 12     // pixels per cell (in CSS pixels, not DPR pixels)
    }
  };
}
