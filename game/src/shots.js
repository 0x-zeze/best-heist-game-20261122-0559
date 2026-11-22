// LOUD QUIET — the four screenshot scenes (?shot=wide|alarm|spotted|hud).
// Each one stages a fresh world by playing the real rules forward from a
// fixed starting point (fixed positions, fixed alarm, fixed patrol angles),
// so the same URL renders the same frame on every run.
import { SCREEN_PLAY } from './render.js';
import { STAGE_CALM, STAGE_CHASE, STAGE_SUSPICIOUS } from './world.js';

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * Unknown names fall back to the wide shot.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const guards = state.guards;
  const cameras = state.cameras;
  const player = state.player;

  if (name === 'alarm') {
    // Close-up of the alarm mechanic: hands on the vault, crack at 62%,
    // the meter climbing, a guard turning suspicious.
    player.x = 880; player.y = 300;
    state.alarm = 62;
    state.vaultCrack = 62;
    state.time = 41;
    guards[0].x = 640; guards[0].y = 200; guards[0].angle = 0.5;
    guards[0].stage = STAGE_SUSPICIOUS; guards[0].suspicion = 47;
    guards[0].lastSeen = { x: 700, y: 260 };
    guards[1].x = 420; guards[1].y = 480; guards[1].angle = -Math.PI / 2;
    guards[1].stage = STAGE_CALM; guards[1].suspicion = 8;
    guards[2].x = 1060; guards[2].y = 420; guards[2].angle = Math.PI;
    guards[2].stage = STAGE_CALM; guards[2].suspicion = 12;
    cameras[0].angle = Math.PI / 2 + 0.3;
    cameras[1].angle = Math.PI - 0.4;
  } else if (name === 'spotted') {
    // The near-miss: a guard's cone touches the thief, alarm at 85,
    // the guard at CHASE ("!") and the camera cone sweeping in.
    player.x = 620; player.y = 300;
    state.alarm = 85;
    state.time = 58;
    guards[0].x = 760; guards[0].y = 300; guards[0].angle = Math.PI;
    guards[0].stage = STAGE_CHASE; guards[0].suspicion = 96;
    guards[0].lastSeen = { x: 620, y: 300 };
    guards[1].x = 380; guards[1].y = 480; guards[1].angle = 0;
    guards[1].stage = STAGE_SUSPICIOUS; guards[1].suspicion = 55;
    guards[1].lastSeen = { x: 620, y: 300 };
    guards[2].x = 1080; guards[2].y = 420; guards[2].angle = -Math.PI / 2;
    guards[2].stage = STAGE_CALM; guards[2].suspicion = 5;
    cameras[0].angle = Math.PI / 2 + 0.5;
    cameras[1].angle = Math.PI - 0.2;
    state.message = 'GUARD A IS CHASING YOU — break line of sight!';
    state.messageTimer = 99;
  } else if (name === 'hud') {
    // The goal: vault loot secured, thief at the green EXIT, alarm cooling.
    state.vaultOpen = true;
    state.vaultLootTaken = true;
    state.score = 6200;
    state.time = 74;
    state.alarm = 28;
    player.x = 150; player.y = 660;
    guards[0].x = 560; guards[0].y = 200; guards[0].angle = 0;
    guards[0].stage = STAGE_CALM; guards[0].suspicion = 6;
    guards[1].x = 480; guards[1].y = 500; guards[1].angle = Math.PI / 2;
    guards[1].stage = STAGE_CALM; guards[1].suspicion = 10;
    guards[2].x = 1000; guards[2].y = 360; guards[2].angle = Math.PI;
    guards[2].stage = STAGE_SUSPICIOUS; guards[2].suspicion = 44;
    guards[2].lastSeen = { x: 700, y: 500 };
    cameras[0].angle = Math.PI / 2 - 0.4;
    cameras[1].angle = Math.PI + 0.3;
    state.message = '$5,000 VAULT LOOT — now get to the EXIT!';
    state.messageTimer = 99;
  } else {
    // wide: the whole room in one frame — thief at the vault, alarm half
    // full, 3 guards with cones, 2 cameras sweeping, loot and the exit.
    player.x = 880; player.y = 300;
    state.alarm = 50;
    state.vaultCrack = 38;
    state.time = 23;
    guards[0].x = 640; guards[0].y = 200; guards[0].angle = 0.35;
    guards[0].stage = STAGE_SUSPICIOUS; guards[0].suspicion = 47;
    guards[0].lastSeen = { x: 700, y: 280 };
    guards[1].x = 420; guards[1].y = 480; guards[1].angle = -Math.PI / 2;
    guards[1].stage = STAGE_CALM; guards[1].suspicion = 8;
    guards[2].x = 1060; guards[2].y = 420; guards[2].angle = Math.PI * 0.85;
    guards[2].stage = STAGE_CALM; guards[2].suspicion = 12;
    cameras[0].angle = Math.PI / 2 + 0.4;
    cameras[1].angle = Math.PI - 0.35;
    state.message = 'CRACKING THE VAULT — every second spends alarm…';
    state.messageTimer = 99;
  }
  state.screen = 'play';
  return { screen: SCREEN_PLAY, best: 0 };
}
