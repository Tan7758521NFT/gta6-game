// SOLMARINA — the city itself: Solmarina Bay, built from a seed.
// One job: lay out roads, districts, buildings, parks, beach and water,
// and answer "is this point blocked / on a road / in the water?".
import {
  AVENUES, BEACH_TOP, HARBOUR, PALETTE, ROAD_WIDTH, SEA_TOP,
  STREETS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Which district a point belongs to: downtown, marina, beach, suburbs, industrial.
export function districtAt(x, y) {
  if (y >= BEACH_TOP) return 'beach';
  if (x >= 3260 && y >= 640 && y <= 1960) return 'marina';
  if (x >= 2420 && y < 320) return 'industrial';
  if (x < 920) return 'suburbs';
  if (x >= 920 && x <= 2420 && y >= 320 && y <= 1120) return 'downtown';
  return 'midtown';
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const roads = { avenues: [...AVENUES], streets: [...STREETS] };
  const roadRects = [];
  for (const x of AVENUES) roadRects.push({ x: x - ROAD_WIDTH / 2, y: 0, w: ROAD_WIDTH, h: SEA_TOP });
  for (const y of STREETS) roadRects.push({ x: 0, y: y - ROAD_WIDTH / 2, w: WORLD_WIDTH, h: ROAD_WIDTH });

  // Every block between two roads gets buildings, a park, or stays open.
  const xs = [0, ...AVENUES, WORLD_WIDTH];
  const ys = [0, ...STREETS, BEACH_TOP];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const bx = xs[bi] + ROAD_WIDTH / 2 + 14;
      const by = ys[bj] + ROAD_WIDTH / 2 + 14;
      const blockW = xs[bi + 1] - xs[bi] - ROAD_WIDTH - 28;
      const blockH = ys[bj + 1] - ys[bj] - ROAD_WIDTH - 28;
      if (blockW < 60 || blockH < 60) continue;
      const cx = bx + blockW / 2;
      const cy = by + blockH / 2;
      const district = districtAt(cx, cy);
      if (district === 'marina') continue; // docks stay open
      // Two parks: one downtown, one in the suburbs.
      if ((bi === 2 && bj === 2) || (bi === 0 && bj === 3)) {
        parks.push({ x: bx, y: by, w: blockW, h: blockH });
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: rng.range(bx + 10, bx + blockW - 10), y: rng.range(by + 10, by + blockH - 10), r: rng.range(7, 12) });
        }
        continue;
      }
      if (district === 'industrial') {
        buildings.push({
          x: bx, y: by, w: blockW, h: blockH, tall: false, roof: '#7d8aa0',
          district, warehouse: true,
        });
        continue;
      }
      const cols = district === 'downtown' ? 2 : rng.int(2, 3);
      const rows = district === 'downtown' ? 2 : rng.int(1, 2);
      const cellW = blockW / cols;
      const cellH = blockH / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const pad = district === 'downtown' ? 10 : 16;
          const w = cellW - pad * 2;
          const h = cellH - pad * 2;
          if (w < 40 || h < 40) continue;
          buildings.push({
            x: bx + c * cellW + pad,
            y: by + r * cellH + pad,
            w, h,
            tall: district === 'downtown' && rng.chance(0.6),
            roof: rng.pick(district === 'suburbs' ? PALETTE.houseRoof : PALETTE.buildingRoof),
            district,
            warehouse: false,
          });
        }
      }
      if (district !== 'downtown' && rng.chance(0.7)) {
        trees.push({ x: rng.range(bx + 8, bx + blockW - 8), y: rng.range(by + 8, by + blockH - 8), r: rng.range(6, 10) });
      }
    }
  }

  // The marina: piers, crates and a lighthouse on the harbour edge.
  const piers = [
    { x: 3260, y: 700, w: 120, h: 26 },
    { x: 3260, y: 1000, w: 120, h: 26 },
    { x: 3260, y: 1300, w: 120, h: 26 },
    { x: 3260, y: 1600, w: 120, h: 26 },
  ];
  const crates = [];
  for (let i = 0; i < 10; i += 1) {
    crates.push({ x: rng.range(3060, 3220), y: rng.range(700, 1900), s: rng.range(18, 30), rot: rng.range(0, 0.6) });
  }

  // Fixed landmarks the missions point at (never random: the story needs them).
  const landmarks = {
    garage: { x: 2520, y: 180, label: 'Voss Garage' },
    kiosk: { x: 1380, y: 1080, label: 'Plaza Kiosk' },
    crane: { x: 3180, y: 880, label: 'Harbour Crane' },
    warehouse: { x: 2680, y: 180, label: 'Bay Warehouse' },
    marinaOffice: { x: 3120, y: 1500, label: 'Marina Office' },
    beachCafe: { x: 1500, y: 2120, label: 'Beach Cafe' },
    plaza: { x: 1420, y: 720, label: 'Sun Plaza' },
    start: { x: 1420, y: 760 },
  };

  // Hidden parcels: eight spots across the districts.
  const parcelSpots = [
    { x: 300, y: 200 }, { x: 880, y: 620 }, { x: 1900, y: 420 },
    { x: 2500, y: 1000 }, { x: 3100, y: 1750 }, { x: 700, y: 2050 },
    { x: 2050, y: 2100 }, { x: 2850, y: 500 },
  ];

  return {
    buildings, trees, parks, piers, crates, landmarks, parcelSpots,
    roads, roadRects,
    water: [
      { x: 0, y: SEA_TOP, w: WORLD_WIDTH, h: WORLD_HEIGHT - SEA_TOP },
      { x: HARBOUR.x, y: HARBOUR.y, w: HARBOUR.w, h: HARBOUR.h },
    ],
    beach: { x: 0, y: BEACH_TOP, w: WORLD_WIDTH, h: SEA_TOP - BEACH_TOP },
  };
}

// --- Collision and ground queries -------------------------------------------

export function buildingAt(city, x, y) {
  for (const b of city.buildings) if (pointInRect(x, y, b)) return b;
  return null;
}

export function inWater(city, x, y) {
  for (const w of city.water) if (pointInRect(x, y, w)) return true;
  return false;
}

export function onRoad(city, x, y) {
  for (const r of city.roadRects) if (pointInRect(x, y, r)) return true;
  return false;
}

export function inPark(city, x, y) {
  for (const p of city.parks) if (pointInRect(x, y, p)) return true;
  return false;
}

// A circle of radius r at (x, y) is blocked by a building, water, or the map edge.
export function circleBlocked(city, x, y, r) {
  if (x < r || y < r || x > WORLD_WIDTH - r || y > WORLD_HEIGHT - r) return true;
  if (inWater(city, x, y)) return true;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Push a circle out of whatever blocks it; returns true when it was pushed.
export function resolveCircle(city, body, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    let dx = body.x - nx;
    let dy = body.y - ny;
    let d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    pushed = true;
    if (d2 < 0.0001) {
      // Centre inside the building: push out along the smallest exit.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      dx /= d;
      dy /= d;
      body.x = nx + dx * r;
      body.y = ny + dy * r;
    }
  }
  if (inWater(city, body.x, body.y)) {
    // Water is a wall: step back toward the beach line or harbour edge.
    if (body.y >= SEA_TOP) body.y = SEA_TOP - r;
    else if (body.x >= HARBOUR.x) body.x = HARBOUR.x - r;
    pushed = true;
  }
  body.x = Math.max(r, Math.min(WORLD_WIDTH - r, body.x));
  body.y = Math.max(r, Math.min(WORLD_HEIGHT - r, body.y));
  return pushed;
}

// Nearest point on the road grid to (x, y): traffic and spawns use it.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of city.roads.avenues) {
    const cy = Math.max(0, Math.min(SEA_TOP, y));
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y: cy }; }
  }
  for (const sy of city.roads.streets) {
    const cx = Math.max(0, Math.min(WORLD_WIDTH, x));
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x: cx, y: sy }; }
  }
  return best ?? { x: 1420, y: 720 };
}

export function rectsOverlapPublic(a, b) {
  return rectsOverlap(a, b);
}
