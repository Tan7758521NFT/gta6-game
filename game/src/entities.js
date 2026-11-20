// SOLMARINA — the living city: player, pedestrians, police, wanted heat,
// combat, pickups and particles. One job: advance everything that moves
// or fights for one fixed step. Missions live in missions.js.
import {
  HEAT_DECAY, HEAT_PER_STAR, HEAT_QUIET_SECONDS, PARCEL_REWARD,
  PARCEL_TOTAL, PISTOL_DAMAGE, PISTOL_RANGE, PLAYER_RADIUS, PLAYER_RUN,
  PLAYER_WALK, PUNCH_DAMAGE, PUNCH_RANGE,
} from './config.js';
import { createRandom } from './random.js';
import { buildCity, circleBlocked, nearestRoadPoint, resolveCircle } from './world.js';
import { collideCars, createCar, driveCar, makeTrafficBrain, updateTrafficCar } from './vehicles.js';
import { createMissionState, missionObjective, updateMissions } from './missions.js';

export function wantedStars(game) {
  let stars = 0;
  for (let i = 0; i < HEAT_PER_STAR.length; i += 1) {
    if (game.heat >= HEAT_PER_STAR[i]) stars = i;
  }
  return stars;
}

export function addHeat(game, amount, message) {
  game.heat = Math.min(100, game.heat + amount);
  game.quietTimer = 0;
  if (message) showMessage(game, message);
}

export function showMessage(game, text, seconds = 4) {
  game.message = text;
  game.messageTimer = seconds;
}

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const start = city.landmarks.start;
  const game = {
    seed,
    rng,
    city,
    time: 0,
    clock: 8 * 60 + 15, // 08:15 on a sunny morning
    money: 150,
    health: 100,
    heat: 0,
    quietTimer: 99,
    wanted: 0,
    player: {
      x: start.x, y: start.y, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      speed: 0, inCar: null, weapon: 'pistol', ammo: 24,
      shootCooldown: 0, punchCooldown: 0, hurtCooldown: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    policeCars: [],
    bullets: [],
    particles: [],
    parcels: city.parcelSpots.map((p) => ({ x: p.x, y: p.y, taken: false })),
    parcelsCollected: 0,
    firstAid: [
      { x: city.landmarks.beachCafe.x + 40, y: city.landmarks.beachCafe.y, taken: false },
      { x: city.landmarks.plaza.x - 60, y: city.landmarks.plaza.y + 40, taken: false },
      { x: city.landmarks.marinaOffice.x + 30, y: city.landmarks.marinaOffice.y - 30, taken: false },
    ],
    mission: createMissionState(),
    taxi: null,
    spawnRequests: [],
    stats: { earned: 0, carsStolen: 0, faresDone: 0, shotsFired: 0 },
    message: '',
    messageTimer: 0,
    camera: { x: start.x, y: start.y },
    view: { w: 1280, h: 800 },
    over: false,
    finished: false,
    audio: null,
    dialogue: null,
  };
  // Parked cars around the plaza and the beach, plus rolling traffic.
  const parkedSpots = [
    ['sedan', 1380, 700, 0], ['coupe', 1470, 700, 0], ['taxi', 1330, 760, Math.PI],
    ['van', 1560, 700, 0], ['sedan', 900, 320, Math.PI / 2], ['coupe', 1900, 1120, 0],
    ['taxi', 2400, 720, Math.PI / 2], ['sedan', 700, 2050, 0], ['sports', 2620, 160, Math.PI / 2],
    ['truck', 2800, 180, 0], ['sedan', 3100, 1650, Math.PI / 2], ['van', 1150, 1500, Math.PI],
  ];
  for (const [type, x, y, angle] of parkedSpots) {
    game.cars.push(createCar(type, x, y, angle, { driver: null }));
  }
  for (let i = 0; i < 10; i += 1) spawnTrafficCar(game);
  for (let i = 0; i < 24; i += 1) spawnPed(game);
  return game;
}

export function spawnTrafficCar(game) {
  const rng = game.rng;
  const type = rng.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'truck']);
  const road = rng.pick(game.city.roads.avenues.map((x) => ({ x, y: rng.range(100, 2100), vertical: true }))
    .concat(game.city.roads.streets.map((y) => ({ x: rng.range(100, 3200), y, vertical: false }))));
  const car = createCar(type, road.x, road.y, road.vertical ? Math.PI / 2 : 0, { driver: 'traffic' });
  car.ai = makeTrafficBrain(rng, road.x, road.y);
  car.x = car.ai.axis === 'v' ? car.ai.line + car.ai.lane : road.x;
  car.y = car.ai.axis === 'h' ? car.ai.line + car.ai.lane : road.y;
  car.angle = car.ai.axis === 'v' ? (car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.ai.dir > 0 ? 0 : Math.PI);
  game.cars.push(car);
  return car;
}

export function spawnPed(game, x, y, opts = {}) {
  const rng = game.rng;
  let px = x;
  let py = y;
  if (px === undefined) {
    const p = nearestRoadPoint(game.city, rng.range(200, 3400), rng.range(200, 2100));
    px = p.x + rng.range(-70, 70);
    py = p.y + rng.range(-70, 70);
  }
  const ped = {
    x: px, y: py,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(35, 70),
    state: 'walk', // walk | flee | down | wait
    target: null,
    panic: 0,
    color: opts.color || rng.pick(['#e8e4da', '#d97b4f', '#5b8dd9', '#e8c44d', '#9a6bd9', '#4fb07a']),
    hostile: !!opts.hostile,
    armed: !!opts.armed,
    thug: !!opts.thug,
    health: opts.thug ? 70 : 40,
    shootCooldown: rng.range(0.5, 1.5),
    punchCooldown: 0,
    fare: false,
  };
  game.peds.push(ped);
  return ped;
}

function spawnCop(game, onFoot) {
  const rng = game.rng;
  const p = game.player.inCar ? game.player.inCar : game.player;
  const angle = rng.range(0, Math.PI * 2);
  const dist = onFoot ? 480 : 700;
  const spot = nearestRoadPoint(game.city, p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist);
  if (onFoot) {
    game.cops.push({
      x: spot.x, y: spot.y, angle: 0, speed: 150, punchCooldown: 0,
      shootCooldown: rng.range(0.5, 1.5), health: 50,
    });
  } else {
    const car = createCar('police', spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), { driver: 'police' });
    game.policeCars.push(car);
    game.cars.push(car);
  }
}

function burst(game, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(speed * 0.3, speed);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: game.rng.range(0.25, 0.6), maxLife: 0.6, color, size: game.rng.range(2, 5),
    });
  }
}

function fireBullet(game, from, x, y, angle, damage) {
  game.bullets.push({
    x, y, angle, speed: 900, from, damage, life: PISTOL_RANGE / 900,
  });
  burst(game, x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, '#ffd94d', 3, 120);
  game.audio?.gunshot();
}

function damagePlayer(game, amount) {
  const p = game.player;
  if (p.hurtCooldown > 0 || game.over) return;
  p.hurtCooldown = 0.5;
  game.health -= amount;
  burst(game, p.x, p.y, '#ff5a4d', 6, 140);
  game.audio?.hurt();
  if (game.health <= 0) {
    game.health = 0;
    game.over = true;
    showMessage(game, 'You were taken down. The bay keeps your story — try again.', 6);
  }
}

// --- One fixed step of the whole game ---------------------------------------
export function updateGame(game, input, actions, dt) {
  const p = game.player;
  const city = game.city;
  game.time += dt;
  game.clock = (game.clock + dt * 0.6) % (24 * 60);
  if (game.messageTimer > 0) game.messageTimer -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;

  // Wanted heat cools off only after a few quiet seconds.
  game.quietTimer += dt;
  if (game.quietTimer > HEAT_QUIET_SECONDS) game.heat = Math.max(0, game.heat - HEAT_DECAY * dt);
  game.wanted = wantedStars(game);

  // Police presence follows the wanted level.
  const wantFoot = Math.min(4, game.wanted);
  const wantCars = Math.max(0, Math.min(3, game.wanted - 1));
  while (game.cops.length < wantFoot) spawnCop(game, true);
  while (game.policeCars.length < wantCars) spawnCop(game, false);
  if (game.wanted === 0) {
    // Cops give up and drive off once the heat is gone.
    game.cops.length = 0;
    for (const pc of game.policeCars) {
      const i = game.cars.indexOf(pc);
      if (i >= 0) game.cars.splice(i, 1);
    }
    game.policeCars.length = 0;
  }

  // Spawn requests from missions (thugs, passengers, escorts).
  for (const req of game.spawnRequests) {
    if (req.kind === 'thug') spawnPed(game, req.x, req.y, { hostile: true, armed: true, thug: true, color: '#8a2f2f' });
    if (req.kind === 'fare') {
      const ped = spawnPed(game, req.x, req.y, {});
      ped.fare = true;
      ped.state = 'wait';
    }
  }
  game.spawnRequests.length = 0;

  // --- Player ---------------------------------------------------------------
  const mouse = input.mouse();
  const cam = game.camera;
  const view = game.view || { w: 1280, h: 800 };
  const aimWorldX = cam.x - view.w / 2 + mouse.x;
  const aimWorldY = cam.y - view.h / 2 + mouse.y;
  const clicked = input.takeClick();
  if (p.inCar) {
    const car = p.inCar;
    const throttle = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -1 : 0;
    const steer = input.moveX();
    driveCar(car, city, throttle, steer, input.handbrake(), dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (Math.abs(car.speed) > 30) game.audio?.engine(Math.abs(car.speed) / car.maxSpeed);
    if (actions.enterCar) {
      // Step out beside the car.
      p.inCar = null;
      car.driver = null;
      p.x = car.x - Math.sin(car.angle) * 30;
      p.y = car.y + Math.cos(car.angle) * 30;
      resolveCircle(city, p, PLAYER_RADIUS);
      game.audio?.door();
    }
  } else {
    const mx = input.moveX();
    const my = input.moveY();
    const len = Math.hypot(mx, my);
    const speed = input.running() ? PLAYER_RUN : PLAYER_WALK;
    if (len > 0) {
      const nx = p.x + (mx / len) * speed * dt;
      const ny = p.y + (my / len) * speed * dt;
      const before = { x: p.x, y: p.y };
      p.x = nx;
      p.y = ny;
      if (resolveCircle(city, p, PLAYER_RADIUS)) {
        // Slide along the wall instead of sticking to it.
        p.x = before.x;
        p.y = ny;
        resolveCircle(city, p, PLAYER_RADIUS);
        if (circleBlocked(city, p.x, p.y, PLAYER_RADIUS)) {
          p.x = nx;
          p.y = before.y;
          resolveCircle(city, p, PLAYER_RADIUS);
        }
      }
      p.angle = Math.atan2(my, mx);
    }
    p.aimAngle = Math.atan2(aimWorldY - p.y, aimWorldX - p.x);
    // Shooting and punching.
    if (clicked && p.shootCooldown <= 0 && !game.over) {
      if (p.weapon === 'pistol' && p.ammo > 0) {
        p.ammo -= 1;
        p.shootCooldown = 0.28;
        game.stats.shotsFired += 1;
        const spread = game.rng.range(-0.04, 0.04);
        fireBullet(game, 'player', p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle + spread, PISTOL_DAMAGE);
        addHeat(game, 2, null);
        for (const ped of game.peds) {
          if (Math.hypot(ped.x - p.x, ped.y - p.y) < 320) ped.panic = 3;
        }
      } else if (p.weapon === 'pistol' && p.ammo === 0) {
        showMessage(game, 'Out of ammo — fists it is. Ammo comes with mission pay.', 3);
        p.weapon = 'fists';
      } else {
        p.punchCooldown = 0.4;
        p.shootCooldown = 0.35;
        game.audio?.punch();
        for (const ped of game.peds) {
          if (ped.state !== 'down' && Math.hypot(ped.x - p.x, ped.y - p.y) < PUNCH_RANGE + 14) {
            const a = Math.atan2(ped.y - p.y, ped.x - p.x);
            let d = a - p.aimAngle;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < 1.1) hurtPed(game, ped, PUNCH_DAMAGE);
          }
        }
        for (const cop of game.cops) {
          if (Math.hypot(cop.x - p.x, cop.y - p.y) < PUNCH_RANGE + 14) hurtCop(game, cop, PUNCH_DAMAGE);
        }
      }
    }
    if (actions.weapon) {
      p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';
      showMessage(game, p.weapon === 'pistol' ? 'Pistol ready.' : 'Fists ready.', 2);
    }
    if (actions.enterCar) {
      let best = null;
      let bestD = 70;
      for (const car of game.cars) {
        if (car.wrecked) continue;
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) {
        const stolen = best.driver === 'traffic' || best.driver === null;
        if (best.driver === 'traffic') {
          // Shove the driver out onto the sidewalk.
          spawnPed(game, best.x - 30, best.y + 20, {});
          addHeat(game, 12, 'Car taken — a witness called it in!');
          game.stats.carsStolen += 1;
        } else if (best.type === 'police') {
          addHeat(game, 15, 'You stole a patrol car!');
          game.stats.carsStolen += 1;
        }
        best.driver = 'player';
        best.ai = null;
        p.inCar = best;
        p.x = best.x;
        p.y = best.y;
        game.audio?.door();
        if (stolen) showMessage(game, `You took the ${best.name}.`, 2.5);
      }
    }
  }

  // --- Traffic, pedestrians, police -----------------------------------------
  for (const car of game.cars) {
    if (car.driver === 'traffic' && !car.wrecked) updateTrafficCar(car, city, game.rng, dt);
  }
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      collideCars(game.cars[i], game.cars[j]);
    }
  }
  // Wrecked cars fade out and are replaced by fresh traffic.
  for (let i = game.cars.length - 1; i >= 0; i -= 1) {
    const car = game.cars[i];
    if (car.wrecked && car.driver !== 'player') {
      game.cars.splice(i, 1);
      if (game.cars.length < 22) spawnTrafficCar(game);
    }
  }

  updatePeds(game, dt);
  updateCops(game, dt);
  updatePoliceCars(game, dt);
  updateBullets(game, dt);

  // Particles fade.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }

  // Parcels and first-aid kits: walk over them to collect.
  if (!p.inCar) {
    for (const parcel of game.parcels) {
      if (!parcel.taken && Math.hypot(parcel.x - p.x, parcel.y - p.y) < 26) {
        parcel.taken = true;
        game.parcelsCollected += 1;
        game.money += PARCEL_REWARD;
        game.stats.earned += PARCEL_REWARD;
        showMessage(game, `Hidden parcel found! +$${PARCEL_REWARD} (${game.parcelsCollected}/${PARCEL_TOTAL})`, 3);
        burst(game, parcel.x, parcel.y, '#ffd94d', 10, 120);
        game.audio?.pickup();
      }
    }
    for (const kit of game.firstAid) {
      if (!kit.taken && Math.hypot(kit.x - p.x, kit.y - p.y) < 26) {
        kit.taken = true;
        game.health = Math.min(100, game.health + 40);
        showMessage(game, 'First-aid kit: +40 health.', 2.5);
        game.audio?.pickup();
      }
    }
  }

  // Missions and taxi fares advance here.
  updateMissions(game, dt);
  // Camera follows the player smoothly.
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  // Engine and siren ambience follow the state.
  if (game.wanted > 0) game.audio?.siren(true);
  else game.audio?.siren(false);
  if (!p.inCar) game.audio?.engine(0);
}

function hurtPed(game, ped, damage) {
  ped.health -= damage;
  burst(game, ped.x, ped.y, '#ff5a4d', 5, 110);
  ped.panic = 4;
  ped.state = 'flee';
  if (ped.health <= 0) {
    ped.state = 'down';
    addHeat(game, ped.thug ? 8 : 20, ped.thug ? null : 'A pedestrian is down — the heat is on you!');
  }
}

function hurtCop(game, cop, damage) {
  cop.health -= damage;
  burst(game, cop.x, cop.y, '#ff5a4d', 5, 110);
  if (cop.health <= 0) {
    const i = game.cops.indexOf(cop);
    if (i >= 0) game.cops.splice(i, 1);
    addHeat(game, 25, 'An officer is down — every cruiser in the bay is coming.');
  }
}

function updatePeds(game, dt) {
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.hostile && !game.over) {
      // Thugs hunt the player and shoot when close enough.
      const d = Math.hypot(p.x - ped.x, p.y - ped.y);
      const a = Math.atan2(p.y - ped.y, p.x - ped.x);
      ped.angle = a;
      if (d > 220) {
        ped.x += Math.cos(a) * 130 * dt;
        ped.y += Math.sin(a) * 130 * dt;
        resolveCircle(game.city, ped, 10);
      } else {
        ped.shootCooldown -= dt;
        if (ped.shootCooldown <= 0 && d < 380) {
          ped.shootCooldown = 1.3;
          fireBullet(game, 'thug', ped.x, ped.y, a + game.rng.range(-0.12, 0.12), 9);
        }
      }
      continue;
    }
    if (ped.fare && ped.state === 'wait') continue;
    // Flee from gunfire, a speeding car, or a panicked crowd.
    let fleeing = ped.panic > 0;
    if (p.inCar && Math.abs(p.inCar.speed) > 200 && Math.hypot(p.inCar.x - ped.x, p.inCar.y - ped.y) < 130) fleeing = true;
    if (fleeing) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = a;
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      resolveCircle(game.city, ped, 10);
      continue;
    }
    // Amble along: pick a nearby sidewalk point, walk to it, pick another.
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
      const spot = nearestRoadPoint(game.city, ped.x + game.rng.range(-260, 260), ped.y + game.rng.range(-260, 260));
      ped.target = { x: spot.x + game.rng.range(-60, 60), y: spot.y + game.rng.range(-60, 60) };
    }
    const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
    resolveCircle(game.city, ped, 10);
    // A fast car that clips a pedestrian is a crime the whole street sees.
    if (p.inCar && Math.abs(p.inCar.speed) > 120) {
      const car = p.inCar;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
        hurtPed(game, ped, 100);
        car.speed *= 0.6;
      }
    }
  }
  // Fallen pedestrians get up after a while (or stay down if the player left).
  for (const ped of game.peds) {
    if (ped.state === 'down' && ped.health <= 0) {
      ped.health = 40;
      ped.state = 'walk';
      ped.panic = 2;
    }
  }
}

function updateCops(game, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const cop of [...game.cops]) {
    const d = Math.hypot(px - cop.x, py - cop.y);
    const a = Math.atan2(py - cop.y, px - cop.x);
    cop.angle = a;
    if (d > 34) {
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      resolveCircle(game.city, cop, 10);
    } else if (!p.inCar) {
      cop.punchCooldown -= dt;
      if (cop.punchCooldown <= 0) {
        cop.punchCooldown = 0.9;
        damagePlayer(game, 8);
      }
    }
    // At three stars and up, officers open fire from a distance.
    if (game.wanted >= 3 && d < 360 && d > 90) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = 1.4;
        fireBullet(game, 'cop', cop.x, cop.y, a + game.rng.range(-0.15, 0.15), 6);
      }
    }
  }
}

function updatePoliceCars(game, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const car of game.policeCars) {
    if (car.wrecked) continue;
    const d = Math.hypot(px - car.x, py - car.y);
    const want = Math.atan2(py - car.y, px - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    const throttle = d > 90 ? 1 : 0.3;
    driveCar(car, game.city, throttle, steer, false, dt);
    // Ramming the player's car is the point; the crash itself does the damage.
    if (p.inCar && Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y) < 50) {
      burst(game, car.x, car.y, '#ffb14d', 3, 90);
    }
    // A cruiser that catches the player on foot drops an officer off.
    if (!p.inCar && d < 70 && game.cops.length < 4) {
      game.cops.push({
        x: car.x + 30, y: car.y, angle: want, speed: 150,
        punchCooldown: 0, shootCooldown: 1, health: 50,
      });
      car.speed = 0;
    }
  }
}

function updateBullets(game, dt) {
  const p = game.player;
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || circleBlocked(game.city, b.x, b.y, 2);
    if (!dead && b.from === 'player') {
      for (const ped of game.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          hurtPed(game, ped, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of game.cops) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
            hurtCop(game, cop, b.damage);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of game.cars) {
          if (car.driver !== 'player' && Math.hypot(car.x - b.x, car.y - b.y) < 24) {
            car.health -= b.damage;
            burst(game, b.x, b.y, '#c9c2b4', 4, 100);
            if (car.health <= 0) car.wrecked = true;
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'cop' || b.from === 'thug')) {
      const tx = p.inCar ? p.inCar.x : p.x;
      const ty = p.inCar ? p.inCar.y : p.y;
      const r = p.inCar ? 26 : PLAYER_RADIUS;
      if (Math.hypot(tx - b.x, ty - b.y) < r) {
        if (p.inCar) p.inCar.health -= b.damage;
        else damagePlayer(game, b.damage);
        dead = true;
      }
    }
    if (dead) {
      burst(game, b.x, b.y, '#e8d44d', 2, 60);
      game.bullets.splice(i, 1);
    }
  }
}
