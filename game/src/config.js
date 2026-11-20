// SOLMARINA — shared constants: world size, colours, tuning, car types.
// One job: every number the other modules agree on lives here.
export const STEP = 1 / 60;
export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2600;

export const ROAD_WIDTH = 92;
export const SIDEWALK = 14;

// Avenues run north-south, streets run east-west. The grid is the city.
export const AVENUES = [420, 920, 1420, 1920, 2420, 2920];
export const STREETS = [320, 720, 1120, 1520, 1920];

// Water: the bay along the south shore and the harbour basin in the east.
export const SEA_TOP = 2260;
export const BEACH_TOP = 2180;
export const HARBOUR = { x: 3260, y: 640, w: 340, h: 1320 };

export const SAVE_KEY = 'solmarina-save-v1';

// Sun-soaked coastal palette: warm asphalt, pale sidewalks, turquoise water.
export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6f9e55',
  park: '#69a854',
  sand: '#e8d39a',
  water: '#2f8fb8',
  waterDeep: '#22749b',
  road: '#3d3a38',
  roadEdge: '#2e2b29',
  sidewalk: '#c9c2b4',
  lane: '#e8d44d',
  buildingRoof: ['#c96f4a', '#b8573f', '#d9a05b', '#7d8aa0', '#a8677e', '#5f7d6a'],
  buildingWall: '#8a7f72',
  houseRoof: ['#c96f4a', '#b8573f', '#d9a05b', '#7d8aa0'],
  tree: '#3f7d3a',
  treeDark: '#356b31',
  player: '#18b8a6',
  playerDark: '#0e8a7d',
  police: '#2b5fd9',
  policeDark: '#1d439e',
  thug: '#8a2f2f',
  pedShirt: ['#e8e4da', '#d97b4f', '#5b8dd9', '#e8c44d', '#9a6bd9', '#4fb07a'],
  hudPanel: 'rgba(12, 18, 28, 0.72)',
  hudText: '#f5f1e6',
  gold: '#ffd94d',
  marker: '#ffd94d',
  danger: '#ff5a4d',
};

// Every drivable car type: how it looks and how it handles.
export const CAR_TYPES = {
  sedan:   { name: 'Marlin Sedan',  color: '#c94f3d', top: 44, accel: 300, maxSpeed: 430, grip: 3.4, len: 52, wid: 26 },
  taxi:    { name: 'Sun Cab',       color: '#f2b705', top: 44, accel: 290, maxSpeed: 410, grip: 3.4, len: 52, wid: 26 },
  sports:  { name: 'Comet GT',      color: '#ff7a1a', top: 40, accel: 430, maxSpeed: 580, grip: 4.4, len: 54, wid: 25 },
  truck:   { name: 'Hauler Truck',  color: '#5b8dd9', top: 44, accel: 200, maxSpeed: 330, grip: 2.6, len: 66, wid: 28 },
  van:     { name: 'Courier Van',   color: '#e8e4da', top: 46, accel: 230, maxSpeed: 360, grip: 2.8, len: 60, wid: 28 },
  police:  { name: 'Patrol Cruiser', color: '#2b5fd9', top: 44, accel: 380, maxSpeed: 510, grip: 4.0, len: 54, wid: 26 },
  coupe:   { name: 'Breeze Coupe',  color: '#9a6bd9', top: 42, accel: 340, maxSpeed: 470, grip: 3.8, len: 50, wid: 25 },
};

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 265;
export const PLAYER_RADIUS = 13;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 430;
export const PUNCH_DAMAGE = 18;
export const PUNCH_RANGE = 34;

// Wanted heat: crossing a threshold adds a star; quiet time cools it off.
export const HEAT_PER_STAR = [0, 10, 30, 50, 70, 90];
export const HEAT_DECAY = 1.4;
export const HEAT_QUIET_SECONDS = 5;

export const MISSION_REWARDS = [300, 350, 500, 400, 700, 1200];
export const PARCEL_REWARD = 150;
export const FARE_REWARD = 200;
export const PARCEL_TOTAL = 8;
