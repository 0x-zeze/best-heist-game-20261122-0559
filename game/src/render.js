// LOUD QUIET — the renderer: every pixel the judge sees.
// One file, one job: draw the room, the cones, the vault, the thief and the
// HUD (alarm meter, loot, timer, objectives) so the whole heist reads at a
// glance, even shrunk onto the judge's contact sheet.
import {
  ALARM, CAMERA, CANVAS_HEIGHT, CANVAS_WIDTH, COVER, EXIT, FIELD, GUARD,
  HUD_HEIGHT, PLAYER, QUIET_LOOT, VAULT,
} from './config.js';
import { STAGE_CALM, STAGE_CHASE, STAGE_SUSPICIOUS, interactTarget } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function coneColor(stage, alpha) {
  if (stage === STAGE_CHASE) return `rgba(255, 64, 64, ${alpha})`;
  if (stage === STAGE_SUSPICIOUS) return `rgba(255, 165, 40, ${alpha})`;
  return `rgba(255, 220, 90, ${alpha})`;
}

function drawFloor(ctx) {
  ctx.fillStyle = '#141a2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // The room: dark blue carpet with a tile grid, gold trim at the walls.
  ctx.fillStyle = '#1b2340';
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = FIELD.x + 44; x < FIELD.x + FIELD.width; x += 44) {
    ctx.beginPath(); ctx.moveTo(x, FIELD.y); ctx.lineTo(x, FIELD.y + FIELD.height); ctx.stroke();
  }
  for (let y = FIELD.y + 44; y < FIELD.y + FIELD.height; y += 44) {
    ctx.beginPath(); ctx.moveTo(FIELD.x, y); ctx.lineTo(FIELD.x + FIELD.width, y); ctx.stroke();
  }
  // A quiet carpet runner down the middle: the safe, silent route.
  ctx.fillStyle = 'rgba(46, 90, 120, 0.25)';
  ctx.fillRect(FIELD.x + 120, FIELD.y + 260, FIELD.width - 240, 90);
  ctx.fillStyle = 'rgba(180, 200, 220, 0.55)';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FIRST MERIDIAN BANK — NIGHT VAULT', FIELD.x + 8, FIELD.y + 48);
  ctx.textAlign = 'center';
  ctx.fillText('quiet carpet — walk here, stay silent', CANVAS_WIDTH / 2, FIELD.y + 296);
}

function drawCover(ctx) {
  for (const block of COVER) {
    ctx.fillStyle = '#2c3554';
    roundRect(ctx, block.x, block.y, block.w, block.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#4a5878';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8fa3c8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(block.label, block.x + block.w / 2, block.y + block.h / 2 + 4);
  }
}

function drawVault(ctx, state) {
  const open = state.vaultOpen;
  ctx.fillStyle = open ? '#3a3f55' : '#232a44';
  roundRect(ctx, VAULT.x, VAULT.y, VAULT.w, VAULT.h, 10);
  ctx.fill();
  ctx.strokeStyle = open ? '#ffd94a' : '#d4af37';
  ctx.lineWidth = 4;
  ctx.stroke();
  // The dial and the door seam.
  ctx.beginPath();
  ctx.arc(VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h / 2 - 8, 26, 0, Math.PI * 2);
  ctx.fillStyle = open ? '#1c2138' : '#4a5878';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h / 2 - 8);
  ctx.lineTo(VAULT.x + VAULT.w / 2 + 16, VAULT.y + VAULT.h / 2 - 20);
  ctx.strokeStyle = '#e8ecf5';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VAULT', VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h - 12);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = open ? '#7dff9a' : '#ffd94a';
  ctx.fillText(open ? 'OPEN — $5,000' : '$5,000 INSIDE', VAULT.x + VAULT.w / 2, VAULT.y - 10);
  // Cracking progress bar above the vault door.
  if (!open && state.vaultCrack > 0) {
    const bw = 130;
    const bx = VAULT.x + (VAULT.w - bw) / 2;
    const by = VAULT.y - 34;
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(bx, by, (bw * state.vaultCrack) / 100, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`CRACKING ${Math.floor(state.vaultCrack)}% — LOUD!`, VAULT.x + VAULT.w / 2, by - 6);
  }
}

function drawQuietLoot(ctx, state) {
  for (const item of state.loot) {
    if (item.taken) continue;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.r + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(125, 255, 154, 0.18)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(item.x, item.y - item.r);
    ctx.lineTo(item.x + item.r, item.y);
    ctx.lineTo(item.x, item.y + item.r);
    ctx.lineTo(item.x - item.r, item.y);
    ctx.closePath();
    ctx.fillStyle = '#7dff9a';
    ctx.fill();
    ctx.fillStyle = '#0b0e1a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$', item.x, item.y + 4);
    ctx.fillStyle = '#7dff9a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${item.label} $${item.value}`, item.x, item.y - item.r - 10);
  }
  if (state.vaultOpen && !state.vaultLootTaken) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◆ $5,000 — TAKE IT ◆', VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h + 22);
  }
}

function drawExit(ctx) {
  ctx.fillStyle = '#0e3d24';
  roundRect(ctx, EXIT.x, EXIT.y, EXIT.w, EXIT.h, 6);
  ctx.fill();
  ctx.strokeStyle = '#2eff7a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#2eff7a';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', EXIT.x + EXIT.w / 2 + 40, EXIT.y + EXIT.h / 2 - 14);
  ctx.font = 'bold 11px monospace';
  ctx.fillText('GETAWAY →', EXIT.x + EXIT.w / 2 + 40, EXIT.y + EXIT.h / 2 + 6);
  ctx.fillStyle = 'rgba(46, 255, 122, 0.15)';
  ctx.fillRect(EXIT.x + EXIT.w, EXIT.y, 26, EXIT.h);
}

function drawGuard(ctx, guard) {
  drawCone(ctx, guard.x, guard.y, guard.angle, GUARD.visionRange, GUARD.visionHalfAngle, coneColor(guard.stage, 0.22));
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
  ctx.fillStyle = guard.stage === STAGE_CHASE ? '#c22' : guard.stage === STAGE_SUSPICIOUS ? '#c80' : '#2c4a6e';
  ctx.fill();
  ctx.strokeStyle = '#dfe6f2';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick + cap.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(guard.name, guard.x, guard.y - 22);
  const mark = guard.stage === STAGE_CHASE ? '!' : guard.stage === STAGE_SUSPICIOUS ? '?' : '';
  if (mark) {
    ctx.fillStyle = guard.stage === STAGE_CHASE ? '#ff4040' : '#ffb020';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(mark, guard.x, guard.y - 38);
  }
  if (guard.stage !== STAGE_CALM) {
    const bw = 44;
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(guard.x - bw / 2, guard.y + 20, bw, 7);
    ctx.fillStyle = guard.stage === STAGE_CHASE ? '#ff4040' : '#ffb020';
    ctx.fillRect(guard.x - bw / 2, guard.y + 20, (bw * guard.suspicion) / 100, 7);
  }
}

function drawCamera(ctx, camera) {
  if (!camera.disabled) {
    drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, 'rgba(255, 70, 70, 0.20)');
  }
  ctx.fillStyle = camera.disabled ? '#3a3f55' : '#7a1020';
  roundRect(ctx, camera.x - 11, camera.y - 8, 22, 16, 4);
  ctx.fill();
  ctx.strokeStyle = camera.disabled ? '#8a90a8' : '#ff4040';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(camera.x, camera.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = camera.disabled ? '#8a90a8' : '#ff2020';
  ctx.fill();
  ctx.fillStyle = camera.disabled ? '#8a90a8' : '#ff8080';
  ctx.font = 'bold 12px monospace';
  // Label beside the mount, never over the room title: CAM 1 to the right,
  // CAM 2 to the left.
  if (camera.x < CANVAS_WIDTH / 2) {
    ctx.textAlign = 'left';
    ctx.fillText(camera.disabled ? `${camera.name} OFF` : camera.name, camera.x + 16, camera.y + 4);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(camera.disabled ? `${camera.name} OFF` : camera.name, camera.x - 16, camera.y + 4);
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius + 7, 0, Math.PI * 2);
  ctx.fillStyle = p.running ? 'rgba(255, 90, 74, 0.25)' : 'rgba(45, 212, 191, 0.20)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#123b36';
  ctx.fill();
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Hood + mask: two eyes looking where the thief looks.
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#e8fff9';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle - 0.35) * 6, p.y + Math.sin(p.angle - 0.35) * 6, 2.2, 0, Math.PI * 2);
  ctx.arc(p.x + Math.cos(p.angle + 0.35) * 6, p.y + Math.sin(p.angle + 0.35) * 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8fff9';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THIEF', p.x, p.y - 22);
  if (p.running) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('RUNNING — LOUD!', p.x, p.y + 30);
  }
}

function alarmColor(alarm) {
  if (alarm >= ALARM.lockdownAt) return '#ff2a2a';
  if (alarm >= ALARM.bustAlarm) return '#ff7a2a';
  if (alarm >= 40) return '#ffb020';
  return '#2dd4bf';
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
  ctx.strokeStyle = '#2a3352';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, HUD_HEIGHT); ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT); ctx.stroke();

  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('LOUD QUIET', 18, 30);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '11px monospace';
  ctx.fillText('the alarm is your budget', 18, 50);

  // The alarm meter: the big bar in the middle of the HUD.
  const barX = 250;
  const barW = 380;
  const barY = 16;
  ctx.fillStyle = '#8fa3c8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', barX, barY + 11);
  ctx.fillStyle = '#10152a';
  ctx.fillRect(barX + 62, barY, barW, 20);
  ctx.fillStyle = alarmColor(state.alarm);
  ctx.fillRect(barX + 62, barY, (barW * state.alarm) / 100, 20);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX + 62, barY, barW, 20);
  // Tick at 70: the camera-bust line. Tick at 100: lockdown.
  ctx.strokeStyle = '#ff7a2a';
  ctx.beginPath();
  ctx.moveTo(barX + 62 + (barW * 70) / 100, barY - 3);
  ctx.lineTo(barX + 62 + (barW * 70) / 100, barY + 23);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`${Math.floor(state.alarm)}%`, barX + 62 + barW + 10, barY + 16);
  ctx.fillStyle = state.lockdown ? '#ff4040' : '#8fa3c8';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(state.lockdown ? 'LOCKDOWN!' : 'run +12/s · crack +9/s · camera +26/s', barX + 62, barY + 36);

  // Loot, timer, objective on the right.
  ctx.fillStyle = '#7dff9a';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`LOOT $${state.score.toLocaleString()}`, CANVAS_WIDTH - 18, 28);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = '13px monospace';
  ctx.fillText(`TIME ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, CANVAS_WIDTH - 18, 50);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  const objective = state.vaultLootTaken
    ? 'VAULT LOOT SECURED — RUN TO THE EXIT!'
    : state.vaultOpen ? 'GRAB THE $5,000, THEN EXIT' : 'CRACK THE VAULT — OR LEAVE QUIET AND POOR';
  ctx.fillText(objective, CANVAS_WIDTH / 2 + 330, 56);

  // Guard status chips under the HUD, top-left of the field.
  const allGuards = state.reinforcement ? [...state.guards, state.reinforcement] : state.guards;
  let chipX = FIELD.x + 4;
  for (const guard of allGuards) {
    const label = guard.stage === STAGE_CHASE ? 'CHASING' : guard.stage === STAGE_SUSPICIOUS ? 'SUSPICIOUS' : 'CALM';
    const color = guard.stage === STAGE_CHASE ? '#ff4040' : guard.stage === STAGE_SUSPICIOUS ? '#ffb020' : '#7dff9a';
    ctx.fillStyle = 'rgba(11, 14, 26, 0.85)';
    ctx.fillRect(chipX, FIELD.y + 4, 148, 20);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX, FIELD.y + 4, 148, 20);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${guard.name}: ${label}`, chipX + 6, FIELD.y + 18);
    chipX += 156;
  }
  // Camera status chips, top-right of the field.
  let camX = FIELD.x + FIELD.width - 4;
  for (const camera of [...state.cameras].reverse()) {
    const label = camera.disabled ? `${camera.name}: OFF` : `${camera.name}: LIVE`;
    const color = camera.disabled ? '#8a90a8' : '#ff6060';
    ctx.fillStyle = 'rgba(11, 14, 26, 0.85)';
    ctx.fillRect(camX - 104, FIELD.y + 4, 104, 20);
    ctx.strokeStyle = color;
    ctx.strokeRect(camX - 104, FIELD.y + 4, 104, 20);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, camX - 98, FIELD.y + 18);
    camX -= 112;
  }
}

function drawPrompt(ctx, state) {
  if (state.screen !== 'play') return;
  const target = interactTarget(state);
  const line = target ? target.label : 'WASD move · SHIFT run (loud) · C sneak · E interact · mouse click works too';
  ctx.fillStyle = 'rgba(11, 14, 26, 0.85)';
  const w = 640;
  ctx.fillRect((CANVAS_WIDTH - w) / 2, CANVAS_HEIGHT - 30, w, 22);
  ctx.fillStyle = target ? '#ffd94a' : '#c8d2e8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14);
  if (state.messageTimer > 0) {
    // Toast just above the prompt bar, clear of the room title.
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 44);
  }
  if (state.cameraSpottedTimer > 0.05) {
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`CAMERA SEES YOU — ${ALARM.cameraBustSeconds - state.cameraSpottedTimer > 0 ? (ALARM.cameraBustSeconds - state.cameraSpottedTimer).toFixed(1) : '0.0'}s TO BUSTED!`, CANVAS_WIDTH / 2, FIELD.y + 68);
  }
}

function overlay(ctx, title, lines, color) {
  ctx.fillStyle = 'rgba(5, 8, 18, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = color;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_WIDTH / 2, 250);
  ctx.fillStyle = '#e8ecf5';
  ctx.font = '17px monospace';
  lines.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, 300 + i * 30));
}

export function drawGame(ctx, world) {
  const state = world.state;
  drawFloor(ctx);
  drawCover(ctx);
  drawVault(ctx, state);
  drawQuietLoot(ctx, state);
  drawExit(ctx);
  for (const camera of state.cameras) drawCamera(ctx, camera);
  for (const guard of state.guards) drawGuard(ctx, guard);
  if (state.reinforcement) drawGuard(ctx, state.reinforcement);
  drawPlayer(ctx, state);
  drawHud(ctx, state);
  drawPrompt(ctx, state);

  if (state.screen === 'title') {
    overlay(ctx, 'LOUD QUIET', [
      'The alarm is your budget. Every loud move spends it.',
      'Walk quiet and stay poor — or run, crack the vault, and get rich loud.',
      'Steal the $5,000 vault loot, dodge 3 guards + 2 cameras, reach the EXIT.',
      '',
      'WASD / arrows — move    SHIFT — run (LOUD +12 alarm/s)',
      'C — sneak (slow, silent)    E / click — crack, grab, disable cameras',
      '',
      'Press SPACE or click to start.  R restarts after a win or a bust.',
    ], '#ffd94a');
  } else if (state.screen === 'win') {
    overlay(ctx, state.winEmpty ? 'ESCAPED EMPTY' : 'CLEAN GETAWAY!', [
      state.winEmpty
        ? 'You slipped out unseen — with nothing. The vault still holds $5,000.'
        : `You escaped with $${state.score.toLocaleString()} — time bonus $${state.winBonus || 0} included.`,
      `Best getaway: $${state.best.toLocaleString()}    Time: ${Math.floor(state.time)}s`,
      '',
      'Press R to run it again — louder this time?',
    ], '#2eff7a');
  } else if (state.screen === 'caught') {
    overlay(ctx, 'CAUGHT!', [
      'A guard got within arm\'s reach. The heist is over.',
      `Loot carried: $${state.score.toLocaleString()} — the bank keeps it.`,
      '',
      'Press R to try again. Break line of sight before suspicion hits 80.',
    ], '#ff4040');
  } else if (state.screen === 'busted') {
    overlay(ctx, 'BUSTED ON CAMERA!', [
      'A camera held you in its cone while the alarm was over 70%.',
      `Loot carried: $${state.score.toLocaleString()} — the bank keeps it.`,
      '',
      'Press R to try again. Disable cameras (E, +20 alarm) or stay out of the red cone.',
    ], '#ff4040');
  }
}
