// SOLMARINA — boot and the one loop: read input every frame, advance the
// world in fixed 1/60 s steps, and paint what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady so a screenshot knows the frame is settled.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame, updateGame } from './entities.js';
import {
  ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE,
  ACTION_TAXI, ACTION_WEAPON, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHud } from './hud.js';
import { createAudio, createNullAudio } from './audio.js';
import { applySave, clearSave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 15;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let game = createGame(seed);
game.view = { w: window.innerWidth, h: window.innerHeight };
const renderer = createRenderer(canvas);
const audio = shot ? createNullAudio() : createAudio();
game.audio = audio;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, game);
  window.__solmarina = game; // play-test hook: state readable from outside
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, { hasSave: false });
    if (scene.screen === SCREEN_PLAY) drawHud(renderer.ctx, game, canvas.width, canvas.height);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastSave = 0;
  let saveExists = hasSave();

  // First gesture unlocks the synthesized audio (browsers demand one).
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  function startGame(fresh) {
    if (fresh) {
      clearSave();
      game = createGame(Math.floor(Math.random() * 4294967296));
      game.view = { w: window.innerWidth, h: window.innerHeight };
      game.audio = audio;
      saveExists = false;
    } else if (saveExists) {
      const data = loadSave();
      if (data) applySave(game, data);
    }
    accumulator = 0;
    lastSave = game.time;
    screen = SCREEN_PLAY;
    announce('Playing SOLMARINA. Follow the gold marker.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(`Taken down. You earned $${game.stats.earned} this run.`);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic rolls, pedestrians walk.
      updateGame(game, idleInput, NO_ACTIONS, STEP);
      return;
    }
    const flags = lastFlags;
    updateGame(game, input, flags, STEP);
    if (game.time - lastSave > AUTOSAVE_SECONDS) {
      lastSave = game.time;
      saveGame(game);
    }
  }

  // The title screen's input: nothing moves, the world just breathes.
  const idleInput = {
    moveX: () => 0,
    moveY: () => 0,
    running: () => false,
    handbrake: () => false,
    mouse: () => ({ x: 640, y: 400, down: false }),
    takeClick: () => false,
    takeActions: () => 0,
  };
  const NO_ACTIONS = { enterCar: false, weapon: false, taxi: false, mute: false };
  let lastFlags = NO_ACTIONS;
  let cWasDown = false;

  function frame(now) {
    requestAnimationFrame(frame);
    window.__solmarina = game; // play-test hook: state readable from outside
    game.view = { w: canvas.width, h: canvas.height };
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot actions are read once per frame and handed to every step.
    const flags = input.takeActions();
    lastFlags = {
      enterCar: !!(flags & ACTION_ENTER_CAR),
      weapon: !!(flags & ACTION_WEAPON),
      taxi: !!(flags & ACTION_TAXI),
      mute: !!(flags & ACTION_MUTE),
    };
    if (flags & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      // 'C' starts a brand-new game instead of continuing the save.
      const cNow = input.key('KeyC');
      if (cNow && !cWasDown) startGame(true);
      else if (flags & ACTION_CONFIRM || input.takeClick()) startGame(false);
      cWasDown = cNow;
    } else if (screen === SCREEN_OVER) {
      if (flags & ACTION_CONFIRM || input.takeClick()) startGame(true);
    } else if (screen === SCREEN_PAUSED) {
      if (flags & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (flags & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(game);
      announce('Paused. Progress saved.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
        if (game.over) {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, { hasSave: saveExists });
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(renderer.ctx, game, canvas.width, canvas.height);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(game);
      announce('Paused.');
    }
  });

  announce('SOLMARINA. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
