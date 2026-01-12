export function attachInput(canvas, state) {
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * state.view.dpr;
    const y = (e.clientY - rect.top) * state.view.dpr;
    return { x, y };
  };

  const onDown = (e) => {
    e.preventDefault();
    const p = toCanvas(e);
    state.input.pointerDown = true;
    state.input.justPressed = true;
    state.input.x = p.x;
    state.input.y = p.y;
  };

  const onMove = (e) => {
    if (!state.input.pointerDown) return;
    e.preventDefault();
    const p = toCanvas(e);
    state.input.x = p.x;
    state.input.y = p.y;
  };

  const onUp = (e) => {
    e.preventDefault();
    state.input.pointerDown = false;
    state.input.justReleased = true;
  };

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener("pointerup", onUp, { passive: false });
  canvas.addEventListener("pointercancel", onUp, { passive: false });
}
