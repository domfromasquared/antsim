import { createState } from "./state.js";
import { stepSim } from "./sim.js";
import { render } from "./render.js";
import { attachInput } from "./input.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const state = createState();
attachInput(canvas, state);

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap for perf
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  state.view.dpr = dpr;
  state.view.w = w;
  state.view.h = h;
}
window.addEventListener("resize", resize, { passive: true });
resize();

// Fixed timestep sim
let last = performance.now();
let acc = 0;
const dt = 1 / 30; // 30 sim ticks/sec to start (mobile-friendly)

function frame(now) {
  const elapsed = Math.min(0.05, (now - last) / 1000); // clamp to avoid spirals
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
