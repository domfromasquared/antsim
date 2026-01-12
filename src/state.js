export function createState() {
  return {
    time: 0,
    ui: { food: 0, biomass: 0, threat: 0 },
    view: { w: 0, h: 0, dpr: 1 },
    input: { pointerDown: false, x: 0, y: 0 },

    nest: { x: 0, y: 0, r: 18, hp: 100, maxHp: 100 },
    foodNodes: [],

    game: {
      over: false,
      message: ""
    },

    // NEW: wave manager
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

    // NEW: multi predator waves
    predators: [],

    // Back-compat (not used by wave manager, but kept so nothing breaks)
    predator: {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      hp: 0,
      maxHp: 80,
      spawnTimer: 6,
      emitStrength: 10.0,
      speed: 55
    },

    tuning: {
      soldierFraction: 0.22, // scales by threat (0..100)
      threatRise: 25,
      threatFall: 14
    }
  };
}
