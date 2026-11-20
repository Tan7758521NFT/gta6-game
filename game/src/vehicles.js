// SOLMARINA — cars: how they are built, driven, and crashed.
// One job: vehicle physics (player-driven and traffic AI) and car-vs-car
// and car-vs-building collisions. The city itself lives in world.js.
import { AVENUES, CAR_TYPES, STREETS } from './config.js';
import { circleBlocked, nearestRoadPoint, onRoad } from './world.js';

let carId = 1;

export function createCar(type, x, y, angle, opts = {}) {
  const def = CAR_TYPES[type];
  return {
    id: carId += 1,
    type,
    name: def.name,
    color: opts.color || def.color,
    x, y,
    angle,
    speed: 0,
    steer: 0,
    len: def.len,
    wid: def.wid,
    accel: def.accel,
    maxSpeed: def.maxSpeed,
    grip: def.grip,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null (parked)
    ai: null, // traffic brain: { axis, dir, lane, target }
    wrecked: false,
    health: 100,
    brakeLight: false,
    siren: type === 'police',
  };
}

// Drive one car for dt seconds. throttle -1..1, steer -1..1, handbrake bool.
// Speed is signed: forward positive, reverse negative.
export function driveCar(car, city, throttle, steer, handbrake, dt) {
  const def = CAR_TYPES[car.type];
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed += def.accel * throttle * dt * 1.4; // braking
    else car.speed += def.accel * throttle * dt * 0.55; // reversing, slower
  }
  // Rolling drag and the handbrake's hard grip.
  car.speed -= car.speed * (handbrake ? 3.2 : 0.45) * dt;
  if (car.speed > def.maxSpeed) car.speed = def.maxSpeed;
  if (car.speed < -def.maxSpeed * 0.45) car.speed = -def.maxSpeed * 0.45;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  // Steering bites only while moving, and more at low speed.
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  const turnRate = steer * def.grip * 0.55 * steerAuthority * (car.speed >= 0 ? 1 : -1);
  car.angle += turnRate * dt * (handbrake ? 1.5 : 1);
  const nx = car.x + forward.x * car.speed * dt;
  const ny = car.y + forward.y * car.speed * dt;
  // Buildings and water stop a car dead (with a thud the caller hears).
  const r = Math.max(car.len, car.wid) / 2 - 4;
  if (circleBlocked(city, nx, car.y, r * 0.7)) {
    car.speed *= -0.25;
    car.health -= Math.abs(car.speed) * 0.02;
  } else {
    car.x = nx;
  }
  if (circleBlocked(city, car.x, ny, r * 0.7)) {
    car.speed *= -0.25;
    car.health -= Math.abs(car.speed) * 0.02;
  } else {
    car.y = ny;
  }
  car.brakeLight = throttle < 0;
  if (car.health <= 0) {
    car.wrecked = true;
    car.speed = 0;
  }
  return car;
}

// Two cars overlapping: shove them apart and trade a little speed.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = (a.len + b.len) / 2 - 8;
  if (d >= min || d < 0.001) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const swap = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = swap * 0.4;
  a.health -= 2;
  b.health -= 2;
  return true;
}

// --- Traffic AI -------------------------------------------------------------
// A traffic car cruises one road line; at an intersection it may turn onto
// the crossing road, so traffic spreads over the whole grid.

export function makeTrafficBrain(rng, x, y) {
  const onAvenue = rng.chance(0.5);
  if (onAvenue) {
    const ax = AVENUES.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), AVENUES[0]);
    return { axis: 'v', line: ax, dir: rng.chance(0.5) ? 1 : -1, lane: rng.chance(0.5) ? 20 : -20 };
  }
  const sy = STREETS.reduce((best, v) => (Math.abs(v - y) < Math.abs(best - y) ? v : best), STREETS[0]);
  return { axis: 'h', line: sy, dir: rng.chance(0.5) ? 1 : -1, lane: rng.chance(0.5) ? 20 : -20 };
}

function atIntersection(brain, car) {
  if (brain.axis === 'v') {
    return STREETS.some((sy) => Math.abs(car.y - sy) < 26);
  }
  return AVENUES.some((ax) => Math.abs(car.x - ax) < 26);
}

export function updateTrafficCar(car, city, rng, dt) {
  const brain = car.ai;
  if (!brain) return;
  // Maybe turn at an intersection onto the crossing road.
  if (atIntersection(brain, car) && rng.chance(0.012)) {
    if (brain.axis === 'v') {
      const sy = STREETS.reduce((best, v) => (Math.abs(v - car.y) < Math.abs(best - car.y) ? v : best), STREETS[0]);
      car.ai = { axis: 'h', line: sy, dir: rng.chance(0.5) ? 1 : -1, lane: rng.chance(0.5) ? 20 : -20 };
    } else {
      const ax = AVENUES.reduce((best, v) => (Math.abs(v - car.x) < Math.abs(best - car.x) ? v : best), AVENUES[0]);
      car.ai = { axis: 'v', line: ax, dir: rng.chance(0.5) ? 1 : -1, lane: rng.chance(0.5) ? 20 : -20 };
    }
    return;
  }
  // Steer toward the lane line, then cruise at a calm city speed.
  const b = car.ai;
  const targetAngle = b.axis === 'v' ? (b.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (b.dir > 0 ? 0 : Math.PI);
  let want = targetAngle;
  const off = b.axis === 'v' ? (car.x - (b.line + b.lane)) : (car.y - (b.line + b.lane));
  want += Math.max(-0.5, Math.min(0.5, -off * 0.012)) * (b.dir > 0 ? 1 : -1);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const cruise = 150;
  const throttle = car.speed < cruise ? 0.7 : 0;
  driveCar(car, city, throttle, steer, false, dt);
  // A car that somehow left the road (shoved by a crash) steers back to it.
  if (!onRoad(city, car.x, car.y)) {
    const p = nearestRoadPoint(city, car.x, car.y);
    const back = Math.atan2(p.y - car.y, p.x - car.x);
    let d2 = back - car.angle;
    while (d2 > Math.PI) d2 -= Math.PI * 2;
    while (d2 < -Math.PI) d2 += Math.PI * 2;
    car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, d2));
  }
}
