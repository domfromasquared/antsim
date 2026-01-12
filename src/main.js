import { createState } from "./state.js";
import { stepSim } from "./sim.js";
import { render } from "./render.js";
import { attachInput } from "./input.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const state = createState();
attachInput(canvas, state);

function initPheromoneGrid() {
  const cssW = Math.floor(window.innerWidth);
  const cssH = Math.floor(window.innerHeight);

  const cs = state.pheromone.cellSize;
  const gw = Math.max(8, Math.floor(cssW / cs));
  const gh = Math.max(8, Math.floor(cssH / cs));

  state.pheromone.gw = gw;
  state.pheromone.gh = gh;
  state.pheromone.values = new Float32Array(gw * gh);
  state.pheromone.values2 = new Float32Array(gw * gh);
  state.pheromone.imgData = new ImageData(gw, gh);
}

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";

  state.view.dpr = dpr;
  state.view.w = w;
  state.view.h = h;

  initPheromoneGrid();
}

function spawnAnts(count = 30) {
  // ensure ants array exists (in case createState() doesn’t set it yet)
  if (!state.ants) state.ants = [];

  const cx = state.view.w * 0.5;
  const cy = state.view.h * 0.5;

  state.ants.length = 0; // reset so we don’t double-spawn on reloads

  for (let i = 0; i < 30; i++) {
    state.ants.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 40,
      dir: Math.random() * Math.PI * 2,
      speed: 30 + Math.random() * 20
    });
  }
}

window.addEventListener("resize", resize, { passive: true });

// IMPORTANT: resize first, then spawn
resize();
spawnAnts(30);

// Fixed timestep sim
let last = performance.now();
let acc = 0;
const dt = 1 / 30;

function frame(now) {
  const elapsed = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += elapsed;

  while (acc >= dt) {
    stepSim(state, dt);
    acc -= dt;
  }

  render(ctx, state);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
