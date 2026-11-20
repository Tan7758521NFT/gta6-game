// SOLMARINA — the HUD: health, money, wanted stars, clock, minimap,
// mission objective, dialogue and messages. One job: paint everything
// that is interface, on top of the world render.js already drew.
import { PALETTE, PARCEL_TOTAL } from './config.js';
import { missionObjective } from './missions.js';
import { wantedStars } from './entities.js';

export function drawHud(ctx, game, w, h) {
  const p = game.player;
  // Top-left panel: health, money, ammo, parcels.
  ctx.fillStyle = PALETTE.hudPanel;
  roundPanel(ctx, 14, 14, 250, 108, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('SOLMARINA', 28, 38);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(28, 50, 180, 12);
  ctx.fillStyle = game.health > 30 ? '#58d68d' : '#ff5a4d';
  ctx.fillRect(28, 50, 180 * Math.max(0, game.health / 100), 12);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Health ${Math.ceil(game.health)}`, 214, 61);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$${game.money}`, 28, 90);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px system-ui, sans-serif';
  const weapon = p.inCar ? 'Driving' : p.weapon === 'pistol' ? `Pistol — ${p.ammo} rounds` : 'Fists';
  ctx.fillText(weapon, 110, 90);
  ctx.fillText(`Parcels ${game.parcelsCollected}/${PARCEL_TOTAL}`, 28, 112);

  // Top-right: wanted stars and the clock.
  ctx.fillStyle = PALETTE.hudPanel;
  roundPanel(ctx, w - 264, 14, 250, 62, 10);
  ctx.fill();
  const stars = wantedStars(game);
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 250 + i * 28, 44);
  }
  const hh = String(Math.floor(game.clock / 60)).padStart(2, '0');
  const mm = String(Math.floor(game.clock % 60)).padStart(2, '0');
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${hh}:${mm}`, w - 96, 44);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = stars > 0 ? '#ff8a7a' : '#9fb0c0';
  ctx.fillText(stars > 0 ? 'WANTED — lay low to cool off' : 'Clean — the bay is calm', w - 250, 66);

  // Mission objective, centred under the top edge.
  const obj = missionObjective(game);
  const objW = Math.min(560, w - 560);
  ctx.fillStyle = PALETTE.hudPanel;
  roundPanel(ctx, w / 2 - objW / 2, 14, objW, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(obj.title, w / 2, 36);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px system-ui, sans-serif';
  wrapText(ctx, obj.text, w / 2, 56, objW - 24, 16);

  // Dialogue box from the story, above the bottom edge.
  if (game.dialogue) {
    ctx.fillStyle = 'rgba(12, 18, 28, 0.85)';
    roundPanel(ctx, w / 2 - 320, h - 190, 640, 84, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.dialogue.speaker, w / 2 - 300, h - 162);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, game.dialogue.text, w / 2 - 300, h - 138, 600, 19);
  }

  // Transient message line.
  if (game.messageTimer > 0 && game.message) {
    ctx.fillStyle = 'rgba(12, 18, 28, 0.8)';
    const msgW = Math.min(620, ctx.measureText(game.message).width + 36);
    roundPanel(ctx, w / 2 - msgW / 2, h - 96, msgW, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, w / 2, h - 73);
  }

  drawMinimap(ctx, game, w, h);
  // Controls reminder, faint, bottom-right.
  ctx.fillStyle = 'rgba(245,241,230,0.6)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive · E car · Click shoot · Q weapon · P pause · M mute', w - 16, h - 12);
}

function drawMinimap(ctx, game, w, h) {
  const size = 190;
  const x0 = 14;
  const y0 = h - size - 14;
  const scale = size / 3600;
  ctx.fillStyle = 'rgba(12, 18, 28, 0.78)';
  roundPanel(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Water and sand.
  ctx.fillStyle = '#2f8fb8';
  ctx.fillRect(x0, y0 + 2260 * scale, size, size);
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(x0, y0 + 2180 * scale, size, 80 * scale + 2);
  ctx.fillStyle = '#5d7a4a';
  ctx.fillRect(x0, y0, size, 2180 * scale);
  // Roads.
  ctx.fillStyle = '#3d3a38';
  for (const ax of game.city.roads.avenues) ctx.fillRect(x0 + ax * scale - 1, y0, 3, 2260 * scale);
  for (const sy of game.city.roads.streets) ctx.fillRect(x0, y0 + sy * scale - 1, size, 3);
  // Parcels not yet found.
  ctx.fillStyle = '#ffd94d';
  for (const parcel of game.parcels) {
    if (!parcel.taken) ctx.fillRect(x0 + parcel.x * scale - 2, y0 + parcel.y * scale - 2, 4, 4);
  }
  // Mission target.
  const target = game.mission.target;
  if (target) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2f00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police as blue dots, player as a white arrow.
  ctx.fillStyle = '#6ea8ff';
  for (const cop of game.cops) ctx.fillRect(x0 + cop.x * scale - 2, y0 + cop.y * scale - 2, 4, 4);
  for (const car of game.policeCars) ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  const p = game.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMARINA BAY', x0, y0 - 10);
}

function roundPanel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
}
