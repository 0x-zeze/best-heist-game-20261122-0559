// LOUD QUIET — the heist floor plan and every tuning number.
// One file, one job: every size, speed and rate the world and the
// renderer share, so the alarm-as-currency trade-off is tuned in one place.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;

// Play field: one single room, the night vault of First Meridian Bank.
export const FIELD = { x: 24, y: 88, width: 1232, height: 612 };

// The vault: the big noisy loot. Cracking it takes time and makes noise.
export const VAULT = { x: 880, y: 150, w: 150, h: 110, loot: 5000, crackSeconds: 4 };

// Quiet loot: small, silent, poor. Take these and stay poor — or go loud.
export const QUIET_LOOT = [
  { id: 'jewels', label: 'JEWELS', value: 800, x: 300, y: 185, r: 15, taken: false },
  { id: 'cash', label: 'CASH', value: 500, x: 210, y: 560, r: 15, taken: false },
  { id: 'gold', label: 'GOLD BAR', value: 1200, x: 1090, y: 565, r: 15, taken: false },
];

// The way out: green EXIT door on the west wall.
export const EXIT = { x: 24, y: 560, w: 46, h: 108 };

// Cover that blocks a guard's or a camera's line of sight.
export const COVER = [
  { x: 420, y: 300, w: 56, h: 56, label: 'PILLAR' },
  { x: 760, y: 430, w: 56, h: 56, label: 'PILLAR' },
  { x: 1000, y: 300, w: 56, h: 56, label: 'PILLAR' },
  { x: 480, y: 560, w: 130, h: 34, label: 'DESK' },
  { x: 620, y: 180, w: 130, h: 34, label: 'DESK' },
];

// Three guards, three patrol loops, three states each: CALM / SUSPICIOUS / CHASE.
export const GUARD_DEFS = [
  {
    name: 'GUARD A',
    start: { x: 500, y: 180 },
    waypoints: [
      { x: 480, y: 180 }, { x: 700, y: 180 },
      { x: 700, y: 320 }, { x: 480, y: 320 },
    ],
  },
  {
    name: 'GUARD B',
    start: { x: 300, y: 430 },
    waypoints: [
      { x: 300, y: 430 }, { x: 620, y: 430 },
      { x: 620, y: 560 }, { x: 300, y: 560 },
    ],
  },
  {
    name: 'GUARD C',
    start: { x: 920, y: 330 },
    waypoints: [
      { x: 920, y: 330 }, { x: 1150, y: 330 },
      { x: 1150, y: 560 }, { x: 920, y: 560 },
    ],
  },
];
export const GUARD = {
  speedPatrol: 82,
  speedInvestigate: 130,
  speedChase: 208,
  visionRange: 235,
  visionHalfAngle: 0.56, // ~32 degrees each side
  catchDistance: 24,
  suspicionGain: 70, // per second while the thief is seen
  suspicionCalm: 40, // below this: CALM (patrol)
  suspicionChase: 80, // at/above this: CHASE (!)
  loseSightSeconds: 3,
};

// Two sweeping CCTV cameras on the walls.
export const CAMERA_DEFS = [
  { name: 'CAM 1', x: 640, y: 96, sweepCentre: Math.PI / 2, sweepWidth: 1.0, sweepSpeed: 0.5 },
  { name: 'CAM 2', x: 1248, y: 380, sweepCentre: Math.PI, sweepWidth: 0.9, sweepSpeed: 0.65 },
];
export const CAMERA = { range: 250, halfAngle: 0.49 };

// The thief: walk quiet, run loud, sneak slowest and silent.
export const PLAYER = {
  radius: 13,
  speedWalk: 132,
  speedRun: 232,
  speedSneak: 70,
  start: { x: 110, y: 640 },
};

// The alarm meter 0..100 — the game's currency. Noise spends it.
export const ALARM = {
  runPerSecond: 12, // running (Shift) fills the meter
  crackPerSecond: 9, // cracking the vault fills it
  cameraPerSecond: 26, // being seen by a camera fills it fast
  seenPerSecond: 8, // being seen by a guard fills it
  vaultPickup: 15, // grabbing the vault loot
  cameraDisable: 20, // switching a camera off (E next to it)
  quietDecay: 3, // drains while you move quietly and unseen
  cameraBustSeconds: 1.2, // seen by a camera this long at alarm >= 70: BUSTED
  bustAlarm: 70,
  lockdownAt: 100, // full meter: every guard chases, reinforcement enters
  lockdownEndsBelow: 60,
};

export const BEST_KEY = 'loud-quiet-best';
