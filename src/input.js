// src/input.js
export function attachInput(canvas, state) {
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * state.view.dpr,
      y: (e.clientY - rect.top) * state.view.dpr
    };
  };

  // Ensure command object exists
  state.command ??= { mode: "none", clear: false };

  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0;
  let moved = 0;

  let lastTapAt = 0;

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

  const commandButtonRect = () => {
    // Top-right “mode” button in SCREEN (canvas) coords
    const dpr = state.view.dpr || 1;
    const w = state.view.w || canvas.width;
    const pad = 10 * dpr;
    const bw = 150 * dpr;
    const bh = 34 * dpr;
    return { x: w - pad - bw, y: pad, w: bw, h: bh };
  };

  const inRect = (px, py, r) => {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };

  const cycleCommandMode = () => {
    const m = state.command?.mode || "none";
    const next =
      (m === "none") ? "rally" :
      (m === "rally") ? "harvest" :
      (m === "harvest") ? "avoid" :
      "none";
    state.command.mode = next;
  };

  const onDown = (e) => {
    e.preventDefault();
    const p = toCanvas(e);

    state.input.pointerDown = true;
    state.input.justPressed = true;
    state.input.x = p.x;
    state.input.y = p.y;
    updateWorldPointer();

    startX = lastX = p.x;
    startY = lastY = p.y;
    moved = 0;

    if (state.build?.mode) state.build.dragging = true;

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

    if (state.build?.mode && state.build.dragging) {
      state.build.ghostX = state.input.wx;
      state.build.ghostY = state.input.wy;
    } else if (state.command?.mode && state.command.mode !== "none") {
      // Command paint mode: do NOT pan camera (drag paints in sim)
    } else {
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

    // Tap on command button cycles command mode; double-tap clears command field.
    if (state.input.wasTap) {
      const r = commandButtonRect();
      if (inRect(state.input.x, state.input.y, r)) {
        const now = performance.now();
        if (now - lastTapAt < 320) {
          state.command.clear = true;
        } else {
          cycleCommandMode();
        }
        lastTapAt = now;

        // Prevent sim from treating this as a world tap
        state.input.wasTap = false;
      }
    }

    if (state.build) state.build.dragging = false;

    canvas.releasePointerCapture?.(e.pointerId);
  };

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener("pointerup", onUp, { passive: false });
  canvas.addEventListener("pointercancel", onUp, { passive: false });
}
