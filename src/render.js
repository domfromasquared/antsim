export function render(ctx, state) {
  const { w, h } = state.view;

  // background
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  // simple “heartbeat” proof
  const t = state.time;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = 20 + Math.sin(t * 4) * 6;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // pointer indicator
  if (state.input.pointerDown) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(state.input.x, state.input.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD text update (cheap)
  document.getElementById("food").textContent = `🍃 ${state.ui.food}`;
  document.getElementById("biomass").textContent = `🧬 ${state.ui.biomass}`;
  document.getElementById("threat").textContent = `⚠️ ${state.ui.threat}`;
}
