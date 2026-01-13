// src/input.js
export function attachInput(canvas, state) {
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * state.view.dpr,
      y: (e.clientY - rect.top) * state.view.dpr
    };
  };

  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0;
  let moved = 0;

  const clampCamera = () => {
    const maxX = Math.max(0, (state.world.w || state.view.w) - state.view.w);
    const maxY = Math.max(0, (state.world.h || state.view.h) - state.view.h);
    state.camera.x = Math.max(0, Math.min(state.camera.x, maxX));
    state.camera.y = Math.max(0, Math.min(state.camera.y, maxY));
  };

  const updateWorldPointer = () => {
    state.input.wx = state.input.x + (state.camera?.x ?? 0);
    state.input.wy = state.input.y + (state.camera?.y ?? 0);
  };

  const onDown = (e) => {
    e.preventDefault();
    const p = toCanvas(e);

    state.input.pointerDown = true;
    state.input.justPressed = true;
    state.input.justReleased = false;
    state.input.wasTap = false;

    state.input.x = p.x;
    state.input.y = p.y;
    updateWorldPointer();

    startX = p.x; startY = p.y;
    lastX = p.x; lastY = p.y;
    moved = 0;

    // if build mode is active, this down starts ghost dragging immediately
    if (state.build?.mode) {
      state.build.dragging = true;
      state.build.ghostX = state.input.wx;
      state.build.ghostY = state.input.wy;
    }

    canvas.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!state.input.pointerDown) return;
    e.preventDefault();

    const p = toCanvas(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;

    state.input.x = p.x;
    state.input.y = p.y;
    updateWorldPointer();

    const ddx = p.x - startX;
    const ddy = p.y - startY;
    moved = Math.hypot(ddx, ddy);

    // build drag: move ghost, do NOT pan camera
    if (state.build?.mode && state.build.dragging) {
      state.build.ghostX = state.input.wx;
      state.build.ghostY = state.input.wy;
    } else {
      // normal pan
      state.camera.x -= dx;
      state.camera.y -= dy;
      clampCamera();
      updateWorldPointer();
    }

    lastX = p.x;
    lastY = p.y;
  };

  const onUp = (e) => {
    e.preventDefault();

    state.input.pointerDown = false;
    state.input.justReleased = true;

    const TAP_THRESH = 10 * state.view.dpr;
    state.input.wasTap = moved <= TAP_THRESH;

    if (state.build) state.build.dragging = false;

    canvas.releasePointerCapture?.(e.pointerId);
  };

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener("pointerup", onUp, { passive: false });
  canvas.addEventListener("pointercancel", onUp, { passive: false });
}
