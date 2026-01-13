export function createState() {
  return {
    time: 0,

    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },
    input: { pointerDown: false, x: 0, y: 0 },

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
      cellSize: 12,
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

    tech: {
  unlocked: {},   // { "scouts": true, ... }
  purchased: {}   // { "scouts": 1, ... } for multi-level techs later
},

milestones: {
  bestWave: 0,
  totalBiomass: 0,
  peakAnts: 0
},

    // --- NEW: Brood growth ---
    brood: {
      timer: 0,
      intervalBase: 2.5,   // base hatch interval (sec)
      cost: 8,             // food per hatch
      costGrowth: 1.06,    // cost multiplier per hatch
      maxAnts: 120
    },

    // --- NEW: Upgrades ---
    upgrades: {
      brood: 0, // faster hatch
      dps: 0,   // soldier damage
      nest: 0   // nest max hp
    },

    // --- NEW: UI hitboxes (computed in render, used by sim) ---
    uiHit: {
      brood: null,
      dps: null,
      nest: null
    }
  };
}
