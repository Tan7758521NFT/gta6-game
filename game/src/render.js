// SOLMARINA — painting the city: ground, roads, buildings, cars, people,
// effects, and the title / pause / game-over screens. One job: draw a
// frame of the game state onto the canvas. HUD chrome lives in hud.js.
import { PALETTE, PLAYER_RADIUS, SEA_TOP, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { districtAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  return {
    canvas,
    ctx,
    resize,
    draw(game, screen, saveInfo) {
      resize();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (screen === SCREEN_TITLE) {
        drawWorld(ctx, game, w, h, game.time);
        drawTitle(ctx, game, w, h, saveInfo);
        return;
      }
      drawWorld(ctx, game, w, h, game.time);
      if (screen === SCREEN_PAUSED) drawPaused(ctx, w, h);
      if (screen === SCREEN_OVER) drawGameOver(ctx, game, w, h);
    },
  };
}

function drawWorld(ctx, game, w, h, time) {
  const city = game.city;
  const camX = Math.max(0, Math.min(WORLD_WIDTH - w, game.camera.x - w / 2));
  const camY = Math.max(0, Math.min(WORLD_HEIGHT - h, game.camera.y - h / 2));
  ctx.save();
  ctx.translate(-camX, -camY);
  // Ground: grass base, sand along the shore, water with a slow shimmer.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(camX - 20, camY - 20, w + 40, h + 40);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(camX - 20, 2180, w + 40, 80);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(camX - 20, SEA_TOP, w + 40, WORLD_HEIGHT - SEA_TOP);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(3260, 640, 340, 1320);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const yy = SEA_TOP + 30 + i * 36;
    const off = Math.sin(time * 0.7 + i * 1.7) * 14;
    ctx.beginPath();
    ctx.moveTo(camX + off, yy);
    ctx.lineTo(camX + w + off, yy);
    ctx.stroke();
  }
  // Parks and trees.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Roads: asphalt, pale sidewalks, dashed centre lines.
  for (const r of city.roadRects) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const ax of city.roads.avenues) {
    ctx.beginPath();
    ctx.moveTo(ax, Math.max(camY, 0));
    ctx.lineTo(ax, Math.min(camY + h, SEA_TOP));
    ctx.stroke();
  }
  for (const sy of city.roads.streets) {
    ctx.beginPath();
    ctx.moveTo(Math.max(camX, 0), sy);
    ctx.lineTo(Math.min(camX + w, WORLD_WIDTH), sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Marina piers and crates.
  for (const pier of city.piers) {
    ctx.fillStyle = '#a9805a';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(pier.x, pier.y, pier.w, 5);
  }
  for (const crate of city.crates) {
    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.rotate(crate.rot);
    ctx.fillStyle = '#b98a3e';
    ctx.fillRect(-crate.s / 2, -crate.s / 2, crate.s, crate.s);
    ctx.strokeStyle = '#7a5a22';
    ctx.strokeRect(-crate.s / 2, -crate.s / 2, crate.s, crate.s);
    ctx.restore();
  }
  // Buildings: soft shadow, coloured roof, taller ones cast further.
  for (const b of city.buildings) {
    const shadow = b.tall ? 12 : 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + shadow, b.y + shadow, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, Math.min(10, b.h * 0.2));
    if (b.warehouse) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 10, b.y + b.h - 16, b.w - 20, 8);
    } else if (b.tall) {
      // Downtown towers get a rooftop box.
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
    }
  }
  for (const tree of city.trees) {
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(tree.x + 2, tree.y + 3, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Landmark labels, small and unobtrusive.
  ctx.fillStyle = 'rgba(20,26,34,0.75)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of ['garage', 'crane', 'warehouse', 'marinaOffice', 'beachCafe', 'plaza']) {
    const L = city.landmarks[key];
    ctx.fillText(L.label, L.x, L.y - 12);
  }
  // Parcels shimmer gold; first-aid kits are white crosses.
  for (const parcel of game.parcels) {
    if (parcel.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4 + parcel.x);
    ctx.fillStyle = `rgba(255, 217, 77, ${pulse})`;
    ctx.fillRect(parcel.x - 9, parcel.y - 9, 18, 18);
    ctx.fillStyle = '#7a5a00';
    ctx.fillRect(parcel.x - 4, parcel.y - 2, 8, 4);
  }
  for (const kit of game.firstAid) {
    if (kit.taken) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(kit.x - 10, kit.y - 10, 20, 20);
    ctx.fillStyle = '#d9382b';
    ctx.fillRect(kit.x - 2, kit.y - 7, 4, 14);
    ctx.fillRect(kit.x - 7, kit.y - 2, 14, 4);
  }
  // Mission target: a tall golden beacon the player can see across town.
  const target = game.mission.target;
  if (target && !game.over) {
    const bounce = Math.sin(time * 3) * 6;
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 + bounce * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 46 + bounce);
    ctx.lineTo(target.x - 10, target.y - 26 + bounce);
    ctx.lineTo(target.x + 10, target.y - 26 + bounce);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2f00';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(target.label, target.x, target.y + 44);
  }
  // Cars, pedestrians, police, bullets, particles.
  for (const car of game.cars) drawCar(ctx, car, game.time);
  for (const ped of game.peds) drawPed(ctx, ped, game.time);
  for (const cop of game.cops) drawCop(ctx, cop);
  drawPlayer(ctx, game);
  for (const b of game.bullets) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  // District name, faint, below the HUD panels so it never collides with them.
  const district = districtAt(game.player.x, game.player.y);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(districtLabel(district), camX + w / 2, camY + 102);
  ctx.restore();
}

function districtLabel(d) {
  return {
    downtown: 'Downtown Solmarina',
    marina: 'The Marina',
    beach: 'Solmarina Beach',
    suburbs: 'Palm Suburbs',
    industrial: 'Industrial Quarter',
    midtown: 'Midtown',
  }[d] || 'Solmarina Bay';
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.wrecked) ctx.globalAlpha = 0.75;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  roundRect(ctx, -car.len * 0.18, -car.wid * 0.36, car.len * 0.36, car.wid * 0.72, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(car.len * 0.28, -car.wid * 0.32, 5, car.wid * 0.64);
  // Headlights and brake lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a1a' : '#7a1a12';
  ctx.fillRect(-car.len / 2, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(-car.len / 2, car.wid / 2 - 8, 3, 5);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-car.len * 0.28, -car.wid / 2, car.len * 0.2, 3);
    ctx.fillRect(-car.len * 0.28, car.wid / 2 - 3, car.len * 0.2, 3);
    // Flashing light bar.
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a1a' : '#2b5fd9';
    ctx.fillRect(-6, -car.wid / 2 - 2, 12, 5);
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(30,30,30,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped, time) {
  if (ped.state === 'down') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const bob = Math.sin(time * 8 + ped.x) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.thug ? '#8a2f2f' : ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.fare) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 16);
  }
}

function drawCop(ctx, cop) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cop.x, cop.y + 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b5fd9';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d439e';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y - 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(cop.x + Math.cos(cop.angle) * 5, cop.y + Math.sin(cop.angle) * 5, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) return; // the car is the player now
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 3, 7, 0, Math.PI * 2);
  ctx.fill();
  // Face and aim direction.
  ctx.fillStyle = '#f5d7b0';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.aimAngle) * 5, p.y + Math.sin(p.aimAngle) * 5, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e8a7d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aimAngle) * 12, p.y + Math.sin(p.aimAngle) * 12);
  ctx.lineTo(p.x + Math.cos(p.aimAngle) * 24, p.y + Math.sin(p.aimAngle) * 24);
  ctx.stroke();
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x + Math.cos(p.aimAngle) * 14 - 3, p.y + Math.sin(p.aimAngle) * 14 - 2, 8, 4);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTitle(ctx, game, w, h, saveInfo) {
  // Sunset band across the top, then the title card.
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(255, 122, 26, 0.9)');
  grad.addColorStop(0.6, 'rgba(255, 190, 80, 0.75)');
  grad.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 260);
  ctx.fillStyle = 'rgba(10, 16, 26, 0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMARINA', w / 2, 210);
  ctx.fillStyle = '#f5f1e6';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('Sun-coast open-world crime — Solmarina Bay is yours to take', w / 2, 258);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#cfd6de';
  const lines = [
    'WASD / arrows — walk and drive   •   E — steal / leave a car   •   Mouse — aim, click — shoot',
    'Q — switch fists / pistol   •   Shift — run   •   Space — handbrake   •   P — pause   •   M — mute',
    'Six story missions with Mara Voss, taxi fares, and 8 hidden parcels across the bay.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, 330 + i * 28));
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(saveInfo && saveInfo.hasSave ? 'Press ENTER to continue your story — or C for a new game' : 'Press ENTER or click to start', w / 2, 470);
  ctx.fillStyle = '#9fb0c0';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('An original game. No borrowed city, no borrowed names — Solmarina Bay is invented, street by street.', w / 2, h - 36);
  ctx.fillText('Wanted stars bring the police. Missions pay. The Comet GT is waiting.', w / 2, h - 14);
}

function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(10, 16, 26, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5f1e6';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press P or Enter to keep playing', w / 2, h / 2 + 30);
}

function drawGameOver(ctx, game, w, h) {
  ctx.fillStyle = 'rgba(10, 16, 26, 0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4d';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('TAKEN DOWN', w / 2, h / 2 - 40);
  ctx.fillStyle = '#f5f1e6';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`You earned $${game.stats.earned} this run and stole ${game.stats.carsStolen} cars.`, w / 2, h / 2 + 4);
  ctx.fillText('Press ENTER to start over — the bay forgets nothing, but it forgives.', w / 2, h / 2 + 40);
}
