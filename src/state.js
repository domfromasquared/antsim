// src/state.js
export function createState() {
  return {
    time: 0,

    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },

    // screen-space pointer (canvas px) + world-space pointer (canvas px + camera)
    input: {
      pointerDown: false,
      x: 0,
      y: 0,
      wx: 0,
      wy: 0,
      justPressed: false,
      justReleased: false,
      wasTap: false
    },

    // 3x world + camera (all in canvas pixels, i.e. DPR space)
    world: { w: 0, h: 0 },
    camera: { x: 0, y: 0, dragging: false, },
    reveal: { gw: 0, gh: 0,
    cellSize: 24,      // CSS px per reveal cell (bigger = faster)
    seen: null,        // Uint8Array
    imgData: null      // ImageData for fast draw
}


    nest: { x: 0, y: 0, r: 18, hp: 100, maxHp: 100 },
    foodNodes: [],

    game: { over: false, message: "" },

    wave: {
      n: 0,
      inProgress: false,
      nextIn: 6,
      predatorsAlive: 0,
      bannerTimer: 0
    },

    pheromone: {
      gw: 0,
      gh: 0,
      imgData: null,
      cellSize: 12, // CSS px per cell
      decayPerSecond: 0.90,
      diffuseRate: 0.22,

      home: { values: null, values2: null },
      food: { values: null, values2: null },
      danger: { values: null, values2: null }
    },

    ants: [],
    predators: [],

    tuning: {
      soldierFraction: 0.22,
      threatRise: 25,
      threatFall: 14
    },

    brood: {
      timer: 0,
      intervalBase: 2.5,
      cost: 8,
      costGrowth: 1.06,
      maxAnts: 120
    },

    upgrades: { brood: 0, dps: 0, nest: 0 },

    tech: { unlocked: {}, purchased: {} },
    buildings: { pylons: 0 },

    milestones: { bestWave: 0, totalBiomass: 0, peakAnts: 0 },

    // UI hitboxes (screen-space, filled in render)
    uiHit: {
      brood: null,
      dps: null,
      nest: null,
      tech_scouts: null,
      tech_sentry: null
    }
  };
}
