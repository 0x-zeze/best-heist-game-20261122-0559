// LOUD QUIET — keyboard + mouse input, one job: turn keys and clicks into
// the booleans the world reads (move, run, sneak, interact, pause, restart).
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false,
    run: false, sneak: false,
    interact: false, // held: cracking the vault needs a held key
    interactPressed: false, // edge: one-shot actions (grab, disable)
    mouse: { x: 0, y: 0, down: false },
    onStart: null, // called on Space / click while on the title screen
    onRestart: null, // called on R after a win or a bust
    onPause: null, // called on P / Escape
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function refresh() {
    input.up = keys.has('up');
    input.down = keys.has('down');
    input.left = keys.has('left');
    input.right = keys.has('right');
    input.run = keys.has('run');
    input.sneak = keys.has('sneak');
  }

  function pressInteract() {
    input.interact = true;
    input.interactPressed = true;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (KEYMAP[event.code]) {
      keys.add(KEYMAP[event.code]);
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      keys.add('run');
    } else if (event.code === 'KeyC') {
      keys.add('sneak');
    } else if (event.code === 'KeyE') {
      if (!event.repeat) pressInteract();
    } else if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat && input.onStart) input.onStart();
    } else if (event.code === 'KeyR') {
      if (!event.repeat && input.onRestart) input.onRestart();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat && input.onPause) input.onPause();
    }
    refresh();
  });

  window.addEventListener('keyup', (event) => {
    if (KEYMAP[event.code]) keys.delete(KEYMAP[event.code]);
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') keys.delete('run');
    else if (event.code === 'KeyC') keys.delete('sneak');
    else if (event.code === 'KeyE') input.interact = false;
    refresh();
  });

  // Mouse: click to interact (crack / grab / disable), click title to start.
  // The click point also steers the thief's facing, so the mouse aims the game.
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    input.mouse.down = true;
    pressInteract();
    if (input.onStart) input.onStart();
  });
  window.addEventListener('pointerup', () => {
    input.mouse.down = false;
    input.interact = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });

  // The world consumes the edge each frame; the held state lives on.
  input.consumePressed = () => {
    const pressed = input.interactPressed;
    input.interactPressed = false;
    return pressed;
  };

  return input;
}
