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

  state.pheromone.home.values = new Float32Array(gw * gh);
  state.pheromone.home.values2 = new Float32Array(gw * gh);

  state.pheromone.food.values = new Float32Array(gw * gh);
  state.pheromone.food.values2 = new Float32Array(gw * gh);

  state.pheromone.danger.values = new Float32Array(gw * gh);
  state.pheromone.danger.values2 = new Float32Array(gw * gh);

  // NEW: command field
  state.pheromone.command.values = new Float32Array(gw * gh);
  state.pheromone.command.values2 = new Float32Array(gw * gh);

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

  // Make world larger than screen
  state.world.w = w * 3;
  state.world.h = h * 3;

  // Center camera so nest feels centered-ish
  state.camera.x = Math.max(0, (state.world.w - state.view.w) * 0.5);
  state.camera.y = Math.max(0, (state.world.h - state.view.h) * 0.5);

  // Place nest once if not set
  if (!state.nest.x && !state.nest.y) {
    state.nest.x = state.world.w * 0.5;
    state.nest.y = state.world.h * 0.55;
  }

  // Create some food nodes once
  if (!state.foodNodes.length) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(state.world.w, state.world.h) * (0.25 + Math.random() * 0.25);
      state.foodNodes.push({
        x: state.nest.x + Math.cos(angle) * dist,
        y: state.nest.y + Math.sin(angle) * dist,
        amount: 200
      });
    }
  }

  initPheromoneGrid();
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

window.addEventListener("resize", resize, { passive: true });

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
