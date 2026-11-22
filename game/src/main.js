// LOUD QUIET — the entry point: canvas, game loop, screens and sound hooks.
// One file, one job: own the frame loop, wire input to the world, and stage
// the deterministic ?shot= scenes for screenshots.
import { CANVAS_HEIGHT, CANVAS_WIDTH, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, updateWorld } from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const world = createWorld();
const input = createInput(canvas);
const audio = createAudio();

let paused = false;
let lastScreen = world.state.screen;
let stepTimer = 0;
let crackSoundTimer = 0;
let wasLockdown = false;
let wasChasing = false;
let wasVaultOpen = false;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.width = `${Math.floor(CANVAS_WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(CANVAS_HEIGHT * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Start / restart / pause, each only where it makes sense.
input.onStart = () => {
  audio.unlock();
  const state = world.state;
  if (state.screen === 'title') {
    state.screen = 'play';
    state.message = 'Steal quiet, or steal loud — the alarm is your budget.';
    state.messageTimer = 3;
  }
};
input.onRestart = () => {
  const state = world.state;
  if (state.screen === 'win' || state.screen === 'caught' || state.screen === 'busted') {
    audio.sirenStop();
    world.reset();
    world.state.screen = 'play';
  }
};
input.onPause = () => {
  if (world.state.screen === 'play') paused = !paused;
};

// Screenshot mode: stage the scene, freeze the world, paint one frame
// forever — the same URL renders the same pixels on every run.
let shotMode = false;
if (shotName) {
  stageShot(shotName, world);
  world.frozen = true;
  shotMode = true;
  document.title = `LOUD QUIET — shot ${shotName}`;
}

function announceScreen() {
  const state = world.state;
  const text = {
    title: 'LOUD QUIET. Press Space to start the heist.',
    play: `Playing. Loot $${state.score}, alarm ${Math.floor(state.alarm)} percent.`,
    win: `Clean getaway with $${state.score}. Press R to play again.`,
    caught: 'Caught by a guard. Press R to try again.',
    busted: 'Busted on camera. Press R to try again.',
  }[state.screen] || '';
  if (status) status.textContent = text;
}

function playFrameSounds(dt) {
  const state = world.state;
  if (state.screen !== 'play') return;
  // Footsteps: quicker and louder while running.
  if (state.player.moving) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      audio.step(state.player.running);
      stepTimer = state.player.running ? 0.22 : 0.38;
    }
  }
  // The vault crack ticks while you hold E on it.
  if (state.vaultCrack > 0 && !state.vaultOpen && input.interact) {
    crackSoundTimer -= dt;
    if (crackSoundTimer <= 0) {
      audio.crackClick();
      crackSoundTimer = 0.25;
    }
  }
  // A guard starting a chase gets a warning beep; lockdown gets the siren.
  const chasing = state.guards.some((g) => g.stage === 2) || !!state.reinforcement;
  if (chasing && !wasChasing) audio.spotted();
  wasChasing = chasing;
  if (state.lockdown && !wasLockdown) audio.sirenStart();
  if (!state.lockdown && wasLockdown) audio.sirenStop();
  wasLockdown = state.lockdown;
}

function playScreenSounds() {
  const state = world.state;
  if (state.screen === lastScreen) return;
  if (state.screen === 'win') audio.win();
  else if (state.screen === 'caught' || state.screen === 'busted') {
    audio.sirenStop();
    audio.caught();
  } else if (state.screen === 'play' && lastScreen === 'title') {
    // The heist starts in silence.
  }
  if (state.vaultOpen && !wasVaultOpen) {
    wasVaultOpen = true;
    audio.vaultOpen();
  } else if (!state.vaultOpen) {
    wasVaultOpen = false;
  }
  lastScreen = state.screen;
  announceScreen();
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!shotMode && !paused) {
    accumulator += dt;
    while (accumulator >= STEP) {
      updateWorld(world, input, STEP);
      input.consumePressed();
      accumulator -= STEP;
    }
    playFrameSounds(dt);
    playScreenSounds();
  }
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawGame(ctx, world);
  if (paused && world.state.screen === 'play') {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — P to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }
  requestAnimationFrame(frame);
}

announceScreen();
requestAnimationFrame(frame);
