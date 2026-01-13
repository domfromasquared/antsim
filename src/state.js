// src/state.js
export function createState() {
  return {
    time: 0,

    ui: { food: 0, biomass: 0, larvae: 0, threat: 0, maxFood: 200 },
    view: { w: 0, h: 0, dpr: 1 },

    // Input is filled by input.js
    input: {
      pointerDown: false,
      x: 0, y: 0,
      wx: 0, wy: 0,
      wasTap: false,
      justPressed: false,
      justReleased: false
    },

    // World + camera (world is larger than viewport)
    world: { w: 0, h: 0 },
    camera: { x: 0, y: 0 },

    nest: { x: 0, y: 0, r: 18, hp: 100, maxHp: 100 },
    foodNodes: [],

    ants: [],

    pheromone: {
      gw: 0, gh: 0,
      imgData: null,
      cellSize: 12,
      decayPerSecond: 0.90,
      diffuseRate: 0.22,

      home: { values: null, values2: null },
      food: { values: null, values2: null },
      danger: { values: null, values2: null },

      // NEW: player-painted intent layer (signed)
      //  + = attract (rally/harvest),  - = repel (avoid)
      command: { values: null, values2: null }
    },

    // Player command paint mode: none -> rally -> harvest -> avoid
    command: { mode: "none", clear: false },

    game: { over: false, message: "" },

    // Wave predators
    wave: { n: 0, inProgress: false, nextIn: 6, predatorsAlive: 0, bannerTimer: 0 },
    predators: [],

    tuning: { soldierFraction: 0.22, threatRise: 25, threatFall: 14 },

    brood: { timer: 0, intervalBase: 2.5, cost: 8, costGrowth: 1.06, maxAnts: 140 },
    upgrades: { brood: 0, dps: 0, nest: 0 },

    tech: { unlocked: {}, purchased: {} },

    buildings: { list: [], nextId: 1 },
    build: { mode: null, ghostX: 0, ghostY: 0, dragging: false },
    selectedBuildingId: null,

    milestones: { bestWave: 0, totalBiomass: 0, peakAnts: 0 },

    // UI hitboxes written by render.js
    uiHit: {}
  };
}
