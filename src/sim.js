export function stepSim(state, dt) {
  state.time += dt;

  // clear one-frame input flags
  state.input.justPressed = false;
  state.input.justReleased = false;
}
