// SOLMARINA — saving and loading: one localStorage slot holds the
// player's money, story progress, parcels, health and position.
// One job: turn a game state into JSON and back again.
import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      money: game.money,
      health: game.health,
      missionIndex: game.mission.index,
      parcelsCollected: game.parcelsCollected,
      parcelsTaken: game.parcels.map((p) => p.taken),
      clock: game.clock,
      stats: game.stats,
      player: { x: game.player.x, y: game.player.y },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}

// Apply a loaded save onto a fresh game: the world rebuilds from the
// same seed, then the player's progress is laid over it.
export function applySave(game, data) {
  game.money = data.money;
  game.health = data.health;
  game.mission.index = data.missionIndex;
  game.parcelsCollected = data.parcelsCollected || 0;
  if (Array.isArray(data.parcelsTaken)) {
    data.parcelsTaken.forEach((taken, i) => {
      if (game.parcels[i]) game.parcels[i].taken = !!taken;
    });
  }
  game.clock = data.clock || game.clock;
  if (data.stats) game.stats = { ...game.stats, ...data.stats };
  if (data.player) {
    game.player.x = data.player.x;
    game.player.y = data.player.y;
    game.camera.x = data.player.x;
    game.camera.y = data.player.y;
  }
}
