// SOLMARINA — story and side work: six missions, taxi fares, dialogue.
// One job: know what the player has to do next, where it is, and what it
// pays. It never moves a character itself: it sets markers and asks
// entities.js for spawns through game.spawnRequests.
import { FARE_REWARD, MISSION_REWARDS } from './config.js';
import { addHeat, showMessage } from './entities.js';

const SPEAKER_MARA = 'Mara Voss — fixer';
const SPEAKER_LUCA = 'Luca — dock hand';
const SPEAKER_RENE = 'Rene — cab dispatcher';

export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    brief: 'Mara needs a car. Take any car on the street and bring it to Voss Garage.',
    dialogue: 'New in Solmarina Bay? Good — I need wheels, and I pay for initiative. Take a car, any car, and bring it to my garage up in the industrial quarter. Try not to make the whole city watch.',
  },
  {
    id: 'sand-and-signal',
    title: 'Sand and Signal',
    brief: 'On foot: pick up the parcel on the beach, then drop it at the Plaza Kiosk downtown.',
    dialogue: 'A package washed up with the tide — or near enough. Walk the beach, pick it up, and leave it at the plaza kiosk. On foot. Cars draw eyes on the sand.',
  },
  {
    id: 'harbour-freight',
    title: 'Harbour Freight',
    brief: 'Pick up the crate at the Harbour Crane and deliver it to the Bay Warehouse. The docks are watched — expect heat.',
    dialogue: 'Luca left a crate under the harbour crane. Fetch it and run it to the Bay Warehouse. The harbour police notice everything, so be quick and be gone.',
  },
  {
    id: 'fares-and-faces',
    title: 'Fares and Faces',
    brief: 'Drive the cab trade: pick up two passengers and drop each where they point.',
    dialogue: 'Rene runs the cabs and he owes me. Two fares, two drop-offs, and you keep the money. Smile — the passengers rate you.',
  },
  {
    id: 'marina-showdown',
    title: 'Marina Showdown',
    brief: 'Three dock thugs guard the ledger at the Marina Office. Deal with them, then take the ledger.',
    dialogue: 'The ledger at the marina office names everyone who skimmed the docks. Three of their men guard it. Take it — whatever it takes — and bring it to me.',
  },
  {
    id: 'sunset-run',
    title: 'The Sunset Run',
    brief: 'Steal the orange Comet GT from the industrial quarter and deliver it to Voss Garage — with the whole bay chasing you.',
    dialogue: 'Last job. A Comet GT, sunset orange, parked by the warehouses. Take it and bring it home while the whole bay chases you. Do this, and Solmarina Bay is yours.',
  },
];

export function createMissionState() {
  return {
    index: 0, // which mission is active; 6 means the story is done
    stage: 0, // step inside the mission
    target: null, // { x, y, label } or null
    farePassenger: null, // the ped waiting for a cab
    fareDest: null,
    faresDone: 0,
    thugsLeft: 0,
    timer: 0,
    started: false,
  };
}

export function missionObjective(game) {
  const m = game.mission;
  if (m.index >= MISSIONS.length) return { title: 'Solmarina Bay is yours', text: 'Story complete — keep the city: fares, parcels and the open road.' };
  const def = MISSIONS[m.index];
  return { title: `Mission ${m.index + 1}/6 — ${def.title}`, text: def.brief };
}

function setTarget(game, x, y, label) {
  game.mission.target = { x, y, label };
}

function completeMission(game) {
  const m = game.mission;
  const reward = MISSION_REWARDS[m.index];
  game.money += reward;
  game.stats.earned += reward;
  game.player.ammo += 12;
  showMessage(game, `Mission complete: ${MISSIONS[m.index].title} — +$${reward}, +12 ammo.`, 5);
  game.audio?.missionDone();
  m.index += 1;
  m.stage = 0;
  m.target = null;
  m.started = false;
  if (m.index >= MISSIONS.length) {
    game.finished = true;
    showMessage(game, 'SOLMARINA complete — you own the bay. Keep playing: fares and parcels pay forever.', 8);
  }
}

function near(game, x, y, radius) {
  const p = game.player.inCar ? game.player.inCar : game.player;
  return Math.hypot(p.x - x, p.y - y) < radius;
}

function startMission(game) {
  const m = game.mission;
  const L = game.city.landmarks;
  m.started = true;
  showMessage(game, `${MISSIONS[m.index].title}: ${MISSIONS[m.index].brief}`, 6);
  game.dialogue = { speaker: speakerFor(m.index), text: MISSIONS[m.index].dialogue, timer: 9 };
  game.audio?.missionStart();
  if (m.index === 0) setTarget(game, L.garage.x, L.garage.y, 'Voss Garage');
  if (m.index === 1) setTarget(game, 700, 2100, 'Beach parcel');
  if (m.index === 2) setTarget(game, L.crane.x, L.crane.y, 'Harbour Crane');
  if (m.index === 3) {
    m.faresDone = 0;
    startFare(game, { x: 1500, y: 760 }, { x: 620, y: 380 });
  }
  if (m.index === 4) {
    m.thugsLeft = 3;
    game.spawnRequests.push({ kind: 'thug', x: L.marinaOffice.x - 60, y: L.marinaOffice.y - 40 });
    game.spawnRequests.push({ kind: 'thug', x: L.marinaOffice.x + 40, y: L.marinaOffice.y + 20 });
    game.spawnRequests.push({ kind: 'thug', x: L.marinaOffice.x - 20, y: L.marinaOffice.y + 80 });
    setTarget(game, L.marinaOffice.x, L.marinaOffice.y, 'Marina Office');
  }
  if (m.index === 5) setTarget(game, 2620, 160, 'Comet GT');
}

function speakerFor(index) {
  if (index === 2) return SPEAKER_LUCA;
  if (index === 3) return SPEAKER_RENE;
  return SPEAKER_MARA;
}

// A fare: a passenger waits at `from`, rides to `to`, pays on arrival.
function startFare(game, from, to) {
  const m = game.mission;
  game.spawnRequests.push({ kind: 'fare', x: from.x, y: from.y });
  m.fareDest = to;
  setTarget(game, from.x, from.y, 'Pick up passenger');
  m.stage = 0;
}

const FARE_STOPS = [
  [{ x: 1500, y: 760 }, { x: 620, y: 380 }],
  [{ x: 2400, y: 1500 }, { x: 1420, y: 1080 }],
  [{ x: 900, y: 1900 }, { x: 2920, y: 1120 }],
];

export function updateMissions(game, dt) {
  const m = game.mission;
  const L = game.city.landmarks;
  if (game.dialogue) {
    game.dialogue.timer -= dt;
    if (game.dialogue.timer <= 0) game.dialogue = null;
  }
  if (m.index >= MISSIONS.length) {
    updateFreeTaxi(game, dt);
    return;
  }
  if (!m.started) {
    startMission(game);
    return;
  }
  const p = game.player;

  if (m.index === 0) {
    // Bring any car you drive to the garage.
    if (p.inCar && near(game, L.garage.x, L.garage.y, 90)) completeMission(game);
    return;
  }
  if (m.index === 1) {
    if (m.stage === 0) {
      if (!p.inCar && near(game, 700, 2100, 34)) {
        m.stage = 1;
        setTarget(game, L.kiosk.x, L.kiosk.y, 'Plaza Kiosk');
        showMessage(game, 'Parcel picked up. Take it to the Plaza Kiosk.', 4);
        game.audio?.pickup();
      }
    } else if (near(game, L.kiosk.x, L.kiosk.y, 70)) {
      completeMission(game);
    }
    return;
  }
  if (m.index === 2) {
    if (m.stage === 0) {
      if (near(game, L.crane.x, L.crane.y, 70)) {
        m.stage = 1;
        setTarget(game, L.warehouse.x, L.warehouse.y, 'Bay Warehouse');
        addHeat(game, 12, 'Harbour police spotted the crate — move!');
        showMessage(game, 'Crate loaded. Deliver it to the Bay Warehouse.', 4);
      }
    } else if (near(game, L.warehouse.x, L.warehouse.y, 90)) {
      completeMission(game);
    }
    return;
  }
  if (m.index === 3) {
    updateFare(game, dt, true);
    return;
  }
  if (m.index === 4) {
    // Count thugs still standing; the ledger opens up once they are down.
    let left = 0;
    for (const ped of game.peds) if (ped.thug && ped.state !== 'down') left += 1;
    m.thugsLeft = left;
    if (m.stage === 0 && left === 0) {
      m.stage = 1;
      setTarget(game, L.marinaOffice.x, L.marinaOffice.y, 'Take the ledger');
      showMessage(game, 'The office is clear. Take the ledger.', 4);
    } else if (m.stage === 1 && !p.inCar && near(game, L.marinaOffice.x, L.marinaOffice.y, 46)) {
      completeMission(game);
    }
    return;
  }
  if (m.index === 5) {
    if (m.stage === 0) {
      // Steal the Comet GT (the orange sports car by the warehouses).
      if (p.inCar && p.inCar.type === 'sports') {
        m.stage = 1;
        setTarget(game, L.garage.x, L.garage.y, 'Voss Garage');
        addHeat(game, 30, 'The Comet GT is gone — three stars and counting!');
        showMessage(game, 'The Comet GT is yours. Lose the heat, reach the garage.', 5);
      }
    } else if (p.inCar && p.inCar.type === 'sports' && near(game, L.garage.x, L.garage.y, 90)) {
      completeMission(game);
    }
  }
}

// One fare step: wait for the player to reach the passenger, then the drop-off.
function updateFare(game, dt, story) {
  const m = game.mission;
  const p = game.player;
  if (m.stage === 0) {
    // Find the waiting passenger the mission spawned.
    let waiting = null;
    for (const ped of game.peds) if (ped.fare && ped.state === 'wait') waiting = ped;
    if (!waiting) return;
    if (p.inCar && Math.hypot(p.inCar.x - waiting.x, p.inCar.y - waiting.y) < 60) {
      const i = game.peds.indexOf(waiting);
      if (i >= 0) game.peds.splice(i, 1);
      m.stage = 1;
      setTarget(game, m.fareDest.x, m.fareDest.y, 'Drop-off');
      showMessage(game, 'Passenger aboard — drive to the marker.', 3);
      game.audio?.pickup();
    }
    return;
  }
  if (p.inCar && near(game, m.fareDest.x, m.fareDest.y, 80)) {
    game.money += FARE_REWARD;
    game.stats.earned += FARE_REWARD;
    game.stats.faresDone += 1;
    showMessage(game, `Fare paid: +$${FARE_REWARD}.`, 3);
    game.audio?.pickup();
    if (story) {
      m.faresDone += 1;
      if (m.faresDone >= 2) {
        completeMission(game);
      } else {
        const next = FARE_STOPS[m.faresDone];
        startFare(game, next[0], next[1]);
      }
    } else {
      // Free-play fares keep coming: a new passenger appears elsewhere.
      const next = FARE_STOPS[game.stats.faresDone % FARE_STOPS.length];
      startFare(game, next[0], next[1]);
    }
  }
}

// After the story, driving a cab and pressing T (or just driving one)
// keeps fares coming: the city always needs a ride.
function updateFreeTaxi(game, dt) {
  const m = game.mission;
  const p = game.player;
  if (m.target) {
    updateFare(game, dt, false);
    return;
  }
  if (p.inCar && p.inCar.type === 'taxi' && !m.target) {
    const next = FARE_STOPS[game.stats.faresDone % FARE_STOPS.length];
    startFare(game, next[0], next[1]);
    showMessage(game, 'A fare is waiting — the cab trade never sleeps.', 3);
  }
}
