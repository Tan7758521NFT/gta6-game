// SOLMARINA — screenshot scenes behind ?shot=start|drive|chase|mission.
// One job: take a fresh seeded world, drive it forward with a scripted
// autopilot (no human input, no randomness outside the seed), and leave
// exactly one frame for the camera. The same seed always gives the same
// frame, because every choice runs on the game's own seeded RNG.
import { STEP } from './config.js';
import { updateGame } from './entities.js';
import { createCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_INPUT = {
  moveX: () => 0,
  moveY: () => 0,
  running: () => false,
  handbrake: () => false,
  mouse: () => ({ x: 640, y: 400, down: false }),
  takeClick: () => false,
  takeActions: () => 0,
};
const NO_ACTIONS = { enterCar: false, weapon: false, taxi: false, mute: false };

// Waypoints along the road grid, in driving order: a loop around downtown.
const DRIVE_LOOP = [
  { x: 1920, y: 720 }, { x: 2420, y: 720 }, { x: 2420, y: 1120 },
  { x: 1920, y: 1120 }, { x: 1420, y: 1120 }, { x: 1420, y: 1520 },
  { x: 1920, y: 1520 }, { x: 1920, y: 1120 }, { x: 1920, y: 720 },
];

// A scripted driver: steer toward the next waypoint, full throttle.
function makeDriver(game, waypoints) {
  let wp = 0;
  let clickAt = -1;
  return {
    input: {
      moveX() {
        const car = game.player.inCar;
        if (!car) return 0;
        const t = waypoints[wp];
        const want = Math.atan2(t.y - car.y, t.x - car.x);
        let diff = want - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.max(-1, Math.min(1, diff * 2.5));
      },
      moveY() {
        return -1; // forward
      },
      running: () => false,
      handbrake: () => false,
      mouse: () => ({ x: 640, y: 400, down: false }),
      takeClick() {
        return false;
      },
      takeActions: () => 0,
    },
    step() {
      const car = game.player.inCar;
      if (car) {
        const t = waypoints[wp];
        if (Math.hypot(t.x - car.x, t.y - car.y) < 90) wp = (wp + 1) % waypoints.length;
      }
    },
  };
}

// A scripted walker: close to 240 px of a thug and hold there, shooting
// from range instead of walking into the line of fire.
function makeWalker(game) {
  let tick = 0;
  function inRange() {
    const t = nearestThug(game);
    if (!t) return false;
    return Math.hypot(t.x - game.player.x, t.y - game.player.y) < 240;
  }
  return {
    input: {
      moveX() {
        tick += 1;
        if (inRange()) return 0;
        const t = walkerTarget(game);
        if (!t) return 0;
        const dx = t.x - game.player.x;
        return Math.abs(dx) < 12 ? 0 : Math.sign(dx);
      },
      moveY() {
        if (inRange()) return 0;
        const t = walkerTarget(game);
        if (!t) return 0;
        const dy = t.y - game.player.y;
        return Math.abs(dy) < 12 ? 0 : Math.sign(dy);
      },
      running: () => true,
      handbrake: () => false,
      mouse() {
        const t = nearestThug(game);
        const view = game.view || { w: 1280, h: 800 };
        if (!t) return { x: view.w / 2, y: view.h / 2, down: false };
        return {
          x: t.x - (game.camera.x - view.w / 2),
          y: t.y - (game.camera.y - view.h / 2),
          down: false,
        };
      },
      takeClick() {
        const t = nearestThug(game);
        if (!t) return false;
        const d = Math.hypot(t.x - game.player.x, t.y - game.player.y);
        return d < 340 && tick % 40 === 0;
      },
      takeActions: () => 0,
    },
    step() {},
  };
}

function nearestThug(game) {
  let best = null;
  let bestD = Infinity;
  for (const ped of game.peds) {
    if (!ped.thug || ped.state === 'down') continue;
    const d = Math.hypot(ped.x - game.player.x, ped.y - game.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

function walkerTarget(game) {
  const thug = nearestThug(game);
  if (thug) return { x: thug.x, y: thug.y };
  if (game.mission.target) return game.mission.target;
  return null;
}

function putPlayerInCar(game, type, x, y, angle) {
  const car = createCar(type, x, y, angle, { driver: 'player' });
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

function runSteps(game, driver, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    driver.step();
    updateGame(game, driver.input, NO_ACTIONS, STEP);
    if (game.over) break;
  }
}

// Stage the named scene on a fresh game and say which screen to draw.
export function stageShot(name, game) {
  if (name === 'drive') {
    putPlayerInCar(game, 'sedan', 1420, 720, 0);
    const driver = makeDriver(game, DRIVE_LOOP);
    runSteps(game, driver, 14);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putPlayerInCar(game, 'sports', 1900, 1120, 0);
    game.heat = 72; // three stars after the quiet-time cooldown: cruisers respond
    game.mission.index = 5;
    game.mission.started = true;
    game.mission.stage = 1;
    game.mission.target = { x: 2520, y: 180, label: 'Voss Garage' };
    const driver = makeDriver(game, DRIVE_LOOP);
    runSteps(game, driver, 12);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    const L = game.city.landmarks;
    game.player.x = L.marinaOffice.x - 160;
    game.player.y = L.marinaOffice.y + 120;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    game.mission.index = 4;
    const walker = makeWalker(game);
    runSteps(game, walker, 6);
    return { screen: SCREEN_PLAY };
  }
  // Default: the title screen over a living city.
  runSteps(game, { input: IDLE_INPUT, step() {} }, 5);
  return { screen: SCREEN_TITLE };
}
