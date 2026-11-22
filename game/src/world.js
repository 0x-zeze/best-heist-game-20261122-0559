// LOUD QUIET — the world: state, reset and the per-frame update.
// One file, one job: how the thief moves, how noise becomes alarm, how the
// three guards and two cameras think, and how the heist is won or lost.
import {
  ALARM, CAMERA, CAMERA_DEFS, COVER, EXIT, FIELD, GUARD, GUARD_DEFS,
  PLAYER, QUIET_LOOT, STEP, VAULT,
} from './config.js';

export const STAGE_CALM = 0;
export const STAGE_SUSPICIOUS = 1;
export const STAGE_CHASE = 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Angle from (ax, ay) to (bx, by), wrapped to -PI..PI for comparisons.
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Segment (ax,ay)-(bx,by) against an axis-aligned rect: true when blocked.
function segmentHitsRect(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, dir, lo, hi] of [
    [ax, dx, rect.x, rect.x + rect.w],
    [ay, dy, rect.y, rect.y + rect.h],
  ]) {
    if (Math.abs(dir) < 1e-9) {
      if (origin < lo || origin > hi) return false;
    } else {
      let t1 = (lo - origin) / dir;
      let t2 = (hi - origin) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

// Line of sight: nothing between the watcher and the thief but air.
export function hasLineOfSight(ax, ay, bx, by) {
  for (const block of COVER) {
    if (segmentHitsRect(ax, ay, bx, by, block)) return false;
  }
  return true;
}

// Is the thief inside a watcher's cone (range + angle + line of sight)?
export function inVisionCone(wx, wy, wAngle, range, halfAngle, tx, ty) {
  if (distance(wx, wy, tx, ty) > range) return false;
  if (Math.abs(angleDiff(angleTo(wx, wy, tx, ty), wAngle)) > halfAngle) return false;
  return hasLineOfSight(wx, wy, tx, ty);
}

function makeGuard(def) {
  return {
    name: def.name,
    x: def.start.x,
    y: def.start.y,
    angle: 0,
    waypointIndex: 0,
    waypoints: def.waypoints,
    stage: STAGE_CALM,
    suspicion: 0,
    lastSeen: null,
    loseSightTimer: 0,
    investigateTimer: 0,
  };
}

function makeCamera(def) {
  return {
    name: def.name,
    x: def.x,
    y: def.y,
    sweepCentre: def.sweepCentre,
    sweepWidth: def.sweepWidth,
    sweepSpeed: def.sweepSpeed,
    angle: def.sweepCentre,
    sweepPhase: 0,
    disabled: false,
    disabledTimer: 0,
  };
}

export function createWorld() {
  const world = {
    state: null,
    frozen: false, // screenshot mode: render the staged frame, never advance
    reset() {
      this.state = {
        player: { x: PLAYER.start.x, y: PLAYER.start.y, angle: -Math.PI / 2, running: false, sneaking: false, moving: false },
        guards: GUARD_DEFS.map(makeGuard),
        cameras: CAMERA_DEFS.map(makeCamera),
        loot: QUIET_LOOT.map((item) => ({ ...item })),
        vaultCrack: 0, // 0..100, cracking progress
        vaultOpen: false,
        vaultLootTaken: false,
        alarm: 0,
        score: 0, // dollars carried
        time: 0,
        screen: 'title', // title | play | win | caught | busted
        message: 'Steal quiet, or steal loud — the alarm is your budget.',
        messageTimer: 0,
        cameraSpottedTimer: 0,
        lockdown: false,
        reinforcement: null, // the extra guard who enters at alarm 100
        winEmpty: false,
        best: 0,
      };
      try {
        this.state.best = Number(window.localStorage.getItem('loud-quiet-best') || 0) || 0;
      } catch { /* storage unavailable: best stays 0 */ }
    },
  };
  world.reset();
  return world;
}

// Move a point toward a target at speed, stopping on arrival. Returns true on arrival.
function moveToward(entity, tx, ty, speed, dt) {
  const d = distance(entity.x, entity.y, tx, ty);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  entity.angle = angleTo(entity.x, entity.y, tx, ty);
  entity.x += ((tx - entity.x) / d) * step;
  entity.y += ((ty - entity.y) / d) * step;
  return d - step < 1;
}

function clampToField(entity, radius) {
  entity.x = clamp(entity.x, FIELD.x + radius, FIELD.x + FIELD.width - radius);
  entity.y = clamp(entity.y, FIELD.y + radius, FIELD.y + FIELD.height - radius);
}

// Keep an entity out of the cover blocks (simple push-out).
function resolveCover(entity, radius) {
  for (const block of COVER) {
    const cx = clamp(entity.x, block.x, block.x + block.w);
    const cy = clamp(entity.y, block.y, block.y + block.h);
    const d = distance(entity.x, entity.y, cx, cy);
    if (d < radius && d > 0.001) {
      entity.x = cx + ((entity.x - cx) / d) * radius;
      entity.y = cy + ((entity.y - cy) / d) * radius;
    }
  }
  // The vault is solid too.
  const vx = clamp(entity.x, VAULT.x, VAULT.x + VAULT.w);
  const vy = clamp(entity.y, VAULT.y, VAULT.y + VAULT.h);
  const vd = distance(entity.x, entity.y, vx, vy);
  if (vd < radius && vd > 0.001) {
    entity.x = vx + ((entity.x - vx) / vd) * radius;
    entity.y = vy + ((entity.y - vy) / vd) * radius;
  }
}

function nearVault(state) {
  const cx = clamp(state.player.x, VAULT.x, VAULT.x + VAULT.w);
  const cy = clamp(state.player.y, VAULT.y, VAULT.y + VAULT.h);
  return distance(state.player.x, state.player.y, cx, cy) < 78;
}

function nearCamera(state) {
  for (const camera of state.cameras) {
    if (!camera.disabled && distance(state.player.x, state.player.y, camera.x, camera.y) < 70) {
      return camera;
    }
  }
  return null;
}

// What the interact key (E / click) does right now, for the prompt line.
export function interactTarget(state) {
  if (state.screen !== 'play') return null;
  if (!state.vaultOpen && nearVault(state)) return { kind: 'crack', label: 'HOLD E — CRACK VAULT (LOUD! +alarm)' };
  if (state.vaultOpen && !state.vaultLootTaken && nearVault(state)) return { kind: 'vault-loot', label: 'E — GRAB $5,000 VAULT LOOT (+15 alarm)' };
  for (const item of state.loot) {
    if (!item.taken && distance(state.player.x, state.player.y, item.x, item.y) < 46) {
      return { kind: 'quiet-loot', item, label: `E — POCKET ${item.label} $${item.value} (silent)` };
    }
  }
  const camera = nearCamera(state);
  if (camera) return { kind: 'camera', camera, label: `E — DISABLE ${camera.name} (+20 alarm)` };
  return null;
}

function raiseAlarm(state, amount) {
  state.alarm = clamp(state.alarm + amount, 0, 100);
}

// The thief's step: WASD/arrows move, Shift runs loud, C sneaks silent.
function updatePlayer(world, input, dt) {
  const state = world.state;
  const player = state.player;
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  player.moving = dx !== 0 || dy !== 0;
  player.running = input.run && player.moving && !input.sneak;
  player.sneaking = input.sneak && player.moving;
  const speed = player.running ? PLAYER.speedRun : player.sneaking ? PLAYER.speedSneak : PLAYER.speedWalk;
  if (player.moving) {
    const len = Math.hypot(dx, dy);
    player.angle = Math.atan2(dy / len, dx / len);
    player.x += (dx / len) * speed * dt;
    player.y += (dy / len) * speed * dt;
    clampToField(player, PLAYER.radius);
    resolveCover(player, PLAYER.radius);
  }
  if (player.running) raiseAlarm(state, ALARM.runPerSecond * dt);
}

// Cracking, looting and disabling: every loud action spends alarm.
function updateInteract(world, input, dt) {
  const state = world.state;
  const target = interactTarget(state);
  if (target && target.kind === 'crack' && input.interact) {
    state.vaultCrack = clamp(state.vaultCrack + (100 / VAULT.crackSeconds) * dt, 0, 100);
    raiseAlarm(state, ALARM.crackPerSecond * dt);
    if (state.vaultCrack >= 100 && !state.vaultOpen) {
      state.vaultOpen = true;
      state.message = 'VAULT OPEN — $5,000 inside. Grab it and run!';
      state.messageTimer = 3;
    }
  } else if (target && target.kind === 'crack') {
    // Cracking cools off slowly when you let go.
    state.vaultCrack = Math.max(0, state.vaultCrack - 12 * dt);
  }
  if (input.interactPressed) {
    if (target && target.kind === 'vault-loot') {
      state.vaultLootTaken = true;
      state.score += VAULT.loot;
      raiseAlarm(state, ALARM.vaultPickup);
      state.message = `+$${VAULT.loot.toLocaleString()} VAULT LOOT — now get to the EXIT!`;
      state.messageTimer = 3;
    } else if (target && target.kind === 'quiet-loot') {
      target.item.taken = true;
      state.score += target.item.value;
      state.message = `+$${target.item.value} ${target.item.label} — silent. The vault holds $5,000…`;
      state.messageTimer = 2.5;
    } else if (target && target.kind === 'camera') {
      target.camera.disabled = true;
      target.camera.disabledTimer = 25; // it reboots after 25 seconds
      raiseAlarm(state, ALARM.cameraDisable);
      state.message = `${target.camera.name} DISABLED for 25s — but the alarm heard it.`;
      state.messageTimer = 3;
    }
  }
}

// One guard's brain: patrol, investigate what it saw, chase what it sees.
function updateGuard(world, guard, dt) {
  const state = world.state;
  const player = state.player;
  const seen = inVisionCone(guard.x, guard.y, guard.angle, GUARD.visionRange, GUARD.visionHalfAngle, player.x, player.y);
  if (seen) {
    guard.suspicion = clamp(guard.suspicion + GUARD.suspicionGain * dt, 0, 100);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightTimer = 0;
    raiseAlarm(state, ALARM.seenPerSecond * dt);
  } else {
    guard.suspicion = clamp(guard.suspicion - 14 * dt, 0, 100);
    if (guard.stage === STAGE_CHASE) {
      guard.loseSightTimer += dt;
      if (guard.loseSightTimer > GUARD.loseSightSeconds) {
        guard.stage = STAGE_SUSPICIOUS;
        guard.suspicion = Math.min(guard.suspicion, GUARD.suspicionChase - 1);
        guard.investigateTimer = 0;
      }
    }
  }
  const nextStage = guard.suspicion >= GUARD.suspicionChase
    ? STAGE_CHASE
    : guard.suspicion >= GUARD.suspicionCalm ? STAGE_SUSPICIOUS : STAGE_CALM;
  if (nextStage === STAGE_CHASE && guard.stage !== STAGE_CHASE) {
    state.message = `${guard.name} IS CHASING YOU — break line of sight!`;
    state.messageTimer = 2.5;
  }
  // A guard that just lost you stays SUSPICIOUS and investigates, even
  // while its suspicion is still high; otherwise the stage follows the meter.
  if (!(guard.stage === STAGE_SUSPICIOUS && guard.loseSightTimer > GUARD.loseSightSeconds)) {
    guard.stage = nextStage;
  }

  if (guard.stage === STAGE_CHASE) {
    moveToward(guard, player.x, player.y, GUARD.speedChase, dt);
  } else if (guard.stage === STAGE_SUSPICIOUS && guard.lastSeen) {
    const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.speedInvestigate, dt);
    if (arrived) {
      guard.investigateTimer += dt;
      guard.angle += dt * 1.8; // looks around, suspicious
      if (guard.investigateTimer > 2.5) {
        guard.stage = STAGE_CALM;
        guard.lastSeen = null;
        guard.loseSightTimer = 0;
      }
    }
  } else {
    const target = guard.waypoints[guard.waypointIndex];
    if (moveToward(guard, target.x, target.y, GUARD.speedPatrol, dt)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    }
  }
  clampToField(guard, 14);
  resolveCover(guard, 14);
  if (distance(guard.x, guard.y, player.x, player.y) < GUARD.catchDistance) {
    endGame(world, 'caught');
  }
}

// The cameras sweep; being seen by one at high alarm gets you busted.
function updateCameras(world, dt) {
  const state = world.state;
  const player = state.player;
  let spotted = false;
  for (const camera of state.cameras) {
    if (camera.disabled) {
      camera.disabledTimer -= dt;
      if (camera.disabledTimer <= 0) {
        camera.disabled = false;
        state.message = `${camera.name} rebooted — its cone is live again.`;
        state.messageTimer = 2.5;
      }
      continue;
    }
    camera.sweepPhase += camera.sweepSpeed * dt;
    camera.angle = camera.sweepCentre + Math.sin(camera.sweepPhase) * camera.sweepWidth;
    if (inVisionCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, player.x, player.y)) {
      spotted = true;
      raiseAlarm(state, ALARM.cameraPerSecond * dt);
      const nearest = state.guards.reduce((a, b) =>
        distance(a.x, a.y, player.x, player.y) < distance(b.x, b.y, player.x, player.y) ? a : b);
      nearest.suspicion = clamp(nearest.suspicion + 40 * dt, 0, 100);
      nearest.lastSeen = { x: player.x, y: player.y };
    }
  }
  if (spotted && state.alarm >= ALARM.bustAlarm) {
    state.cameraSpottedTimer += dt;
    if (state.cameraSpottedTimer >= ALARM.cameraBustSeconds) endGame(world, 'busted');
  } else {
    state.cameraSpottedTimer = Math.max(0, state.cameraSpottedTimer - dt * 2);
  }
}

// Alarm 100: lockdown — every guard chases, and a reinforcement walks in.
function updateLockdown(world, dt) {
  const state = world.state;
  if (state.alarm >= ALARM.lockdownAt && !state.lockdown) {
    state.lockdown = true;
    state.message = 'ALARM 100 — LOCKDOWN! Every guard is chasing. A reinforcement is in!';
    state.messageTimer = 4;
    for (const guard of state.guards) {
      guard.stage = STAGE_CHASE;
      guard.suspicion = 100;
      guard.lastSeen = { x: state.player.x, y: state.player.y };
    }
    state.reinforcement = {
      name: 'REINFORCEMENT', x: 640, y: 110, angle: Math.PI / 2,
      stage: STAGE_CHASE, suspicion: 100, lastSeen: { x: state.player.x, y: state.player.y },
      loseSightTimer: 0, investigateTimer: 0, waypointIndex: 0,
      waypoints: [{ x: 640, y: 110 }],
    };
  }
  if (state.lockdown && state.alarm < ALARM.lockdownEndsBelow) {
    state.lockdown = false;
    state.message = 'Alarm cooling — the lockdown lifts. Stay quiet.';
    state.messageTimer = 3;
  }
  if (state.reinforcement) {
    updateGuard(world, state.reinforcement, dt);
  }
}

function endGame(world, kind) {
  const state = world.state;
  if (state.screen !== 'play') return;
  if (kind === 'win') {
    state.screen = 'win';
    state.winEmpty = state.score === 0;
    const bonus = Math.max(0, 300 - Math.floor(state.time)) * 10;
    state.score += bonus;
    state.winBonus = bonus;
    try {
      if (state.score > state.best) {
        window.localStorage.setItem('loud-quiet-best', String(state.score));
        state.best = state.score;
      }
    } catch { /* storage unavailable */ }
  } else {
    state.screen = kind; // 'caught' or 'busted'
  }
}

export function updateWorld(world, input, dt) {
  const state = world.state;
  if (world.frozen || state.screen !== 'play') return;
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  updatePlayer(world, input, dt);
  updateInteract(world, input, dt);
  for (const guard of state.guards) updateGuard(world, guard, dt);
  updateCameras(world, dt);
  updateLockdown(world, dt);
  if (state.screen !== 'play') return;
  // The alarm drains slowly while you move quietly and nobody sees you.
  const anyoneSees = state.guards.some((g) => g.stage === STAGE_CHASE);
  if (!state.player.running && !anyoneSees) {
    state.alarm = clamp(state.alarm - ALARM.quietDecay * dt, 0, 100);
  }
  // The exit: reach it with loot to win, empty-handed to escape with nothing.
  const p = state.player;
  if (p.x - PLAYER.radius < EXIT.x + EXIT.w && p.x > EXIT.x - 10
    && p.y > EXIT.y - 10 && p.y < EXIT.y + EXIT.h + 10) {
    endGame(world, 'win');
  }
}

export { STEP };
