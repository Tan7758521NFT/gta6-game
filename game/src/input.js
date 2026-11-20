// SOLMARINA — keyboard and mouse.
// One job: turn raw DOM events into the game's view of the controls:
// held keys, the mouse position and aim, and one-shot action flags.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_WEAPON = 8;
export const ACTION_TAXI = 16;
export const ACTION_MUTE = 32;

export function createInput(canvas) {
  const keys = new Set();
  const actions = { flags: 0 };
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function keyFor(code) {
    return code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(keyFor(event.code));
    if (event.code === 'Enter' || event.code === 'Space') actions.flags |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions.flags |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions.flags |= ACTION_ENTER_CAR;
    if (event.code === 'KeyQ') actions.flags |= ACTION_WEAPON;
    if (event.code === 'KeyT') actions.flags |= ACTION_TAXI;
    if (event.code === 'KeyM') actions.flags |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyFor(event.code));
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  function down(...codes) {
    return codes.some((c) => keys.has(c));
  }

  return {
    // Whether a physical key is held right now (for one-off keys like C).
    key(code) {
      return keys.has(code);
    },
    // Movement axes, -1..1: x right, y down (screen space).
    moveX() {
      return (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    moveY() {
      return (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
    },
    running() {
      return down('ShiftLeft', 'ShiftRight');
    },
    handbrake() {
      return down('Space');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeActions() {
      const flags = actions.flags;
      actions.flags = 0;
      return flags;
    },
  };
}
