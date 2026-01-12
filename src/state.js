export function createState() {
  return {
    time: 0,
    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },
    input: { pointerDown: false, x: 0, y: 0 },

    nest: { x: 0, y: 0, r: 18 },
    foodNodes: [],

    pheromone: {
      gw: 0, gh: 0,
      imgData: null,
      cellSize: 12,
      decayPerSecond: 0.90,
      diffuseRate: 0.22,

      home: { values: null, values2: null },
      food: { values: null, values2: null },
      danger: { values: null, values2: null } // NEW
    },

    ants: [],

    predator: {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      hp: 0,
      spawnTimer: 6,      // seconds until first spawn
      emitStrength: 10.0, // danger pheromone strength
      speed: 55
    },

    tuning: {
      soldierFraction: 0.22, // ~22% of ants become soldiers when threat is high
      threatRise: 25,        // threat per second while predator is active
      threatFall: 14         // threat per second while no predator
    }
  };
}
