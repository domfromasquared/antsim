// src/state.js
export function createState() {
  return {
    time: 0,

    ui: {
      food: 0,
      biomass: 0,
      larvae: 0,
      threat: 0,
      maxFood: 200
    },

    view: { w: 0, h: 0, dpr: 1 },

    // screen-space pointer (canvas px) + world-space pointer
    input: {
      pointerDown: false,
      x: 0, y: 0,
      wx: 0, wy: 0,
      justPressed: false,
      justReleased: false,
      wasTap: false
    },

    // world + camera in canvas px (DPR space)
    world: { w: 0, h: 0 },
    camera: { x: 0, y: 0 },

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
      cellSize: 12, // CSS px per pheromone cell
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
      maxAnts: 140
    },

    upgrades: { brood: 0, dps: 0, nest: 0 },

    tech: { unlocked: {}, purchased: {} },

    // ---- CIV BUILDINGS ----
    buildings: {
      list: [], // {id,type,x,y,lvl,progress}
      nextId: 1
    },

    build: {
      mode: null,      // "nursery" | "hatchery" | "storehouse" | null
      ghostX: 0,       // world coords
      ghostY: 0,
      dragging: false
    },

    // UI hitboxes (screen-space, filled by render)
    uiHit: {
      brood: null,
      dps: null,
      nest: null,
      tech_scouts: null,
      tech_sentry: null,
      build_nursery: null,
      build_hatchery: null,
      build_storehouse: null
    }
  };
}
