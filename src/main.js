// src/main.js
import { createState } from "./state.js";
import { stepSim, loadGame } from "./sim.js";
import { render } from "./render.js";
import { attachInput } from "./input.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const state = createState();
attachInput(canvas, state);

function initPheromoneGrid() {
  const dpr = state.view.dpr || 1;

  const cs = state.pheromone.cellSize; // CSS px per cell
  const cssWorldW = Math.floor((state.world.w || state.view.w) / dpr);
  const cssWorldH = Math.floor((state.world.h || state.view.h) / dpr);

  const gw = Math.max(8, Math.floor(cssWorldW / cs));
  const gh = Math.max(8, Math.floor(cssWorldH / cs));

  state.pheromone.gw = gw;
  state.pheromone.gh = gh;

  state.pheromone.home ??= {};
  state.pheromone.food ??= {};
  state.pheromone.danger ??= {};

  state.pheromone.home.values = new Float32Array(gw * gh);
  state.pheromone.home.values2 = new Float32Array(gw * gh);

  state.pheromone.food.values = new Float32Array(gw * gh);
  state.pheromone.food.values2 = new Float32Array(gw * gh);

  state.pheromone.danger.values = new Float32Array(gw * gh);
  state.pheromone.danger.values2 = new Float32Array(gw * gh);

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

  // 3x world
  state.world.w = w * 3;
  state.world.h = h * 3;

  // clamp camera
  const maxX = Math.max(0, state.world.w - state.view.w);
  const maxY = Math.max(0, state.world.h - state.view.h);
  state.camera.x = Math.max(0, Math.min(state.camera.x, maxX));
  state.camera.y = Math.max(0, Math.min(state.camera.y, maxY));

  initPheromoneGrid();
}

function initWorld() {
  state.nest.x = state.world.w * 0.5;
  state.nest.y = state.world.h * 0.55;

  state.foodNodes.length = 0;
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.min(state.world.w, state.world.h) * (0.18 + Math.random() * 0.22);
    state.foodNodes.push({
      x: state.nest.x + Math.cos(angle) * dist,
      y: state.nest.y + Math.sin(angle) * dist,
      amount: 240
    });
  }

  state.camera.x = state.nest.x - state.view.w * 0.5;
  state.camera.y = state.nest.y - state.view.h * 0.5;

  const maxX = Math.max(0, state.world.w - state.view.w);
  const maxY = Math.max(0, state.world.h - state.view.h);
  state.camera.x = Math.max(0, Math.min(state.camera.x, maxX));
  state.camera.y = Math.max(0, Math.min(state.camera.y, maxY));
}

function spawnAnts(count = 30) {
  state.ants.length = 0;
  for (let i = 0; i < count; i++) {
    state.ants.push({
      x: state.nest.x + (Math.random() - 0.5) * 60 * state.view.dpr,
      y: state.nest.y + (Math.random() - 0.5) * 60 * state.view.dpr,
      dir: Math.random() * Math.PI * 2,
      speed: 30 + Math.random() * 20,
      carrying: false,
      role: "worker"
    });
  }
}

window.addEventListener("resize", () => {
  resize();
  const maxX = Math.max(0, state.world.w - state.view.w);
  const maxY = Math.max(0, state.world.h - state.view.h);
  state.camera.x = Math.max(0, Math.min(state.camera.x, maxX));
  state.camera.y = Math.max(0, Math.min(state.camera.y, maxY));
}, { passive: true });

resize();
initWorld();
loadGame(state);
if (!state.ants || state.ants.length === 0) spawnAnts(30);

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
