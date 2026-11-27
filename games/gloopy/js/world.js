'use strict';
let world = [];
let features = [];
let foodPatches = [];
let plotSpots = [];                 // garden plot tiles [{x, y}]
let worldSeed = 7777;
let tideTiles = [];                 // sea tiles that dry out at low tide [{x, y}]
let tideLow = false;                // is the tide currently out?
let noProp = new Set();             // tiles kept clear of giant mushrooms / beach props (around Jumbos, neighbours and bouncers)

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateWorld(seed) {
  worldSeed = seed;
  const rng = makeRng(seed);
  const ri = (a, b) => Math.floor(a + rng() * (b - a));
  world = []; features = []; foodPatches = []; plotSpots = []; tideTiles = []; tideLow = false; noProp = new Set();
  for (let x = 0; x < WORLD_W; x++) { world.push([]); for (let y = 0; y < WORLD_H; y++) world[x].push(T.GRASS); }
  const inb = (x, y) => x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H;

  // pond (north-east)
  const pcx = 70, pcy = 18;
  for (let x = pcx - 12; x < pcx + 12; x++) for (let y = pcy - 10; y < pcy + 10; y++) {
    if (!inb(x, y)) continue;
    const dx = (x - pcx) / 10, dy = (y - pcy) / 8, q = dx * dx + dy * dy;
    if (q < 1) world[x][y] = T.WATER; else if (q < 1.6) world[x][y] = T.SAND;
  }
  // main paths
  for (let x = 0; x < WORLD_W; x++) if (world[x][40] !== T.WATER) world[x][40] = T.PATH;
  for (let y = 0; y < WORLD_H; y++) if (world[18][y] !== T.WATER) world[18][y] = T.PATH;

  // pond islands + lily pads: pad-to-pad gaps are one water tile wide, so a normal jump crosses them
  for (const isl of ISLANDS) for (let x = isl.x; x < isl.x + isl.w; x++) for (let y = isl.y; y < isl.y + isl.h; y++) world[x][y] = (x === isl.x + 1 && y === isl.y + 1) ? T.GRASS : T.SAND;
  for (const [lx, ly] of LILY_PADS) world[lx][ly] = T.LILY;

  // scattered boulders (seeded -> identical after load)
  for (let i = 0; i < 38; i++) {
    const bx = ri(5, LEGACY_W - 5), by = ri(5, LEGACY_H - 5);       // legacy dimensions: the original map must stay identical for old saves
    if (world[bx][by] === T.GRASS && rng() < 0.6) world[bx][by] = T.BOULDER;
  }

  // orchard (north-west) - Honey slimes + fruit
  const ox = 4, oy = 4, ow = 14, oh = 12;
  for (let x = ox; x < ox + ow; x++) for (let y = oy; y < oy + oh; y++) world[x][y] = T.ORCHARD;
  features.push({ type: 'orchard', x: ox, y: oy, w: ow, h: oh });

  // crystal cave (south-east) - walled, 3-wide entrance on the south side
  const cvx = 62, cvy = 54, cvw = 14, cvh = 12;
  for (let x = cvx - 1; x <= cvx + cvw; x++) for (let y = cvy - 1; y <= cvy + cvh; y++) {
    if (!inb(x, y)) continue;
    const edge = x === cvx - 1 || x === cvx + cvw || y === cvy - 1 || y === cvy + cvh;
    world[x][y] = edge ? T.STONE : T.CAVE;
  }
  for (let x = cvx + 5; x < cvx + 8; x++) world[x][cvy + cvh] = T.CAVE;
  features.push({ type: 'cave', x: cvx, y: cvy, w: cvw, h: cvh });

  // ranch floor (room for four corral lots), the east yard (a fifth lot) and the shop between them
  for (let x = RANCH.x; x < RANCH.x + RANCH.w; x++) for (let y = RANCH.y; y < RANCH.y + RANCH.h; y++) world[x][y] = T.FLOOR;
  const yard = CORRAL_LOTS[4];
  for (let x = yard.x - 1; x < yard.x + 9; x++) for (let y = yard.y - 1; y < yard.y + 8; y++) world[x][y] = T.FLOOR;
  const sx = RANCH.x + RANCH.w + 1, sy = RANCH.y + 3;
  for (let x = sx; x < sx + 3; x++) for (let y = sy; y < sy + 3; y++) world[x][y] = T.FLOOR;
  features.push({ type: 'shop', x: sx, y: sy, w: 3, h: 3 });

  // garden (north of the ranch): six plots on tilled dirt
  for (let x = 19; x <= 27; x++) for (let y = 28; y <= 34; y++) world[x][y] = T.GRASS;
  for (const [px, py] of [[21, 30], [23, 30], [25, 30], [21, 32], [23, 32], [25, 32]]) { world[px][py] = T.DIRT; plotSpots.push({ x: px, y: py }); }
  features.push({ type: 'garden', x: 20, y: 29, w: 7, h: 5 });

  // wild food patches
  const patches = [
    [30, 10, 'cubery', 4], [45, 55, 'heartbeet', 5], [75, 55, 'cubery', 4], [25, 60, 'carrot', 5], [55, 45, 'heartbeet', 4],
    [85, 8, 'meat', 4], [5, 60, 'meat', 4], [40, 25, 'cubery', 3], [65, 30, 'heartbeet', 3], [35, 50, 'carrot', 4], [48, 12, 'carrot', 4]
  ];
  for (const [px, py, food, n] of patches) for (let i = 0; i < n; i++) {
    const fx = px + ri(-2, 3), fy = py + ri(-2, 3);
    if (fx < 1 || fx >= LEGACY_W - 1 || fy < 1 || fy >= LEGACY_H - 1 || world[fx][fy] !== T.GRASS) continue;
    foodPatches.push({ x: fx, y: fy, food, item: null, regen: rng() * 6 });
  }
  const clearAround = (tx, ty, r) => { for (let x = tx - r; x <= tx + r; x++) for (let y = ty - r; y <= ty + r; y++) if (x > 0 && y > 0 && x < WORLD_W && y < WORLD_H && world[x][y] === T.BOULDER) world[x][y] = T.GRASS; };
  LEGACY_JUMBO_SPOTS.forEach(([x, y]) => clearAround(x, y, 2)); BOUNCERS.forEach(b => clearAround(b.x, b.y, 2)); NPCS.forEach(n => clearAround(n.x, n.y, 1));   // exactly what the first release cleared
  for (let i = 0; i < 8; i++) {                       // fruit grows inside the orchard
    const fx = ox + ri(2, ow - 2), fy = oy + ri(2, oh - 2);
    if (world[fx][fy] === T.ORCHARD) foodPatches.push({ x: fx, y: fy, food: 'fruit', item: null, regen: rng() * 6 });
  }
  for (const isl of ISLANDS) for (let x = isl.x; x < isl.x + isl.w; x++) for (let y = isl.y; y < isl.y + isl.h; y++)
    if (world[x][y] === T.BOULDER) world[x][y] = (x === isl.x + 1 && y === isl.y + 1) ? T.GRASS : T.SAND;      // a random boulder must never land on a pond island (≈1% of seeds had one on the chest)
  generateNewAreas(seed, clearAround);                 // v5: grove, prairie, windy fields and the beach (separate random stream)
  generateMountain(seed, clearAround);                 // v6: Frostpeak (its own random stream again)
  generateFar(seed, clearAround);                      // 0.14: the Far Meadow in the new eastern lands
  generateNodes(seed);                                 // v7: branches and tufts for Survival mode
}

/* ---------------------------------------------------------------------
   v5 — the three new quarters of the world. Everything below uses its OWN random stream so the original map never changes.
   --------------------------------------------------------------------- */
const inLegacy = (x, y) => x < LEGACY_W && y < LEGACY_H;
function areaAt(tx, ty) {
  for (const k in AREAS) { const a = AREAS[k]; if (tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h) return k; }
  return null;
}
function generateNewAreas(seed, clearAround) {
  const rng = makeRng((seed ^ 0x5bd1e995) >>> 0), ri = (a, b) => Math.floor(a + rng() * (b - a));
  // scattered boulders in the new quarters
  for (let i = 0; i < 150; i++) {
    const bx = ri(3, OLD_WORLD_W - 3), by = ri(3, BEACH_TOP - 3);      // old width: the earlier areas must generate exactly as in 0.9–0.10
    if (!inLegacy(bx, by) && world[bx][by] === T.GRASS && rng() < 0.6) world[bx][by] = T.BOULDER;
  }
  // Mushroom Grove: a mossy, irregular oval (the east road keeps running through it)
  const G = AREAS.grove, gcx = G.x + G.w / 2, gcy = G.y + G.h / 2;
  for (let x = G.x; x < G.x + G.w; x++) for (let y = G.y; y < G.y + G.h; y++) {
    const dx = (x - gcx) / (G.w / 2), dy = (y - gcy) / (G.h / 2), q = dx * dx + dy * dy + (hash2(x, y) - 0.5) * 0.18;
    if (q < 0.92 && (world[x][y] === T.GRASS || world[x][y] === T.BOULDER)) world[x][y] = T.MOSS;
  }
  features.push({ type: 'grove', x: G.x, y: G.y, w: G.w, h: G.h });
  // the beach: sand, a wet shore line, then the sea (the outer rows of sea dry out at low tide)
  for (let x = 0; x < WORLD_W; x++) {
    const sl = seaLine(x), top = BEACH_TOP + Math.round(hash2(x, 3) * 2);
    for (let y = top; y < WORLD_H; y++) {
      if (y < sl - 1) world[x][y] = T.SAND;
      else if (y === sl - 1) world[x][y] = T.WETSAND;
      else { world[x][y] = T.WATER; if (y < sl + TIDE_ROWS) tideTiles.push({ x, y }); }
    }
  }
  features.push({ type: 'beach', x: AREAS.beach.x, y: AREAS.beach.y, w: AREAS.beach.w, h: AREAS.beach.h });
  // wild food: every new area has its own patches
  const scatter = (area, food, patches, per, ok) => {
    const A = AREAS[area]; let made = 0;
    for (let tries = 0; tries < 400 && made < patches; tries++) {
      const cx = ri(A.x + 3, A.x + A.w - 3), cy = ri(A.y + 3, A.y + A.h - 3);
      if (!ok(cx, cy)) continue;
      let any = 0;
      for (let i = 0; i < per; i++) {
        const fx = cx + ri(-2, 3), fy = cy + ri(-2, 3);
        if (fx < 1 || fx >= WORLD_W - 1 || fy < 1 || fy >= WORLD_H - 1 || !ok(fx, fy)) continue;
        foodPatches.push({ x: fx, y: fy, food, item: null, regen: rng() * 6 }); any++;
      }
      if (any) made++;
    }
  };
  const onGrass = (x, y) => world[x][y] === T.GRASS, onMoss = (x, y) => world[x][y] === T.MOSS;
  const onSandRow = (x, y) => world[x][y] === T.SAND && y > seaLine(x) - 5;
  scatter('grove', 'truffle', 8, 4, onMoss); scatter('grove', 'cubery', 3, 3, onMoss);
  scatter('prairie', 'carrot', 7, 4, onGrass); scatter('prairie', 'meat', 2, 3, onGrass); scatter('prairie', 'fruit', 2, 3, onGrass);
  scatter('fields', 'heartbeet', 6, 4, onGrass); scatter('fields', 'cubery', 4, 3, onGrass); scatter('fields', 'carrot', 2, 3, onGrass);
  scatter('beach', 'kelp', 14, 3, onSandRow); scatter('beach', 'meat', 2, 3, onSandRow); scatter('beach', 'fruit', 2, 3, onGrass);
  JUMBOS.forEach(j => clearAround(j.x, j.y, 2)); BOUNCERS.forEach(b => clearAround(b.x, b.y, 2)); NPCS.forEach(n => clearAround(n.x, n.y, 1));
  const keep = (cx, cy, r) => { for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) noProp.add(x * 1000 + y); };
  JUMBOS.forEach(j => keep(j.x, j.y, 5)); NPCS.forEach(n => keep(n.x, n.y, 3)); BOUNCERS.forEach(b => keep(b.x, b.y, 3));
  foodPatches.forEach(f => keep(f.x, f.y, 0));
}

/* ---------------------------------------------------------------------
   v6 — Frostpeak: snowy mountain in the far east. Snow, ice ponds, rock clusters (they block, with plenty of gaps), pines.
   --------------------------------------------------------------------- */
function generateMountain(seed, clearAround) {
  const rng = makeRng((seed ^ 0x2545f491) >>> 0), ri = (a, b) => Math.floor(a + rng() * (b - a));
  const P = AREAS.peak, cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  for (let x = P.x; x < P.x + P.w; x++) for (let y = P.y; y < P.y + P.h; y++) {
    const dx = (x - cx) / (P.w / 2), dy = (y - cy) / (P.h / 2), q = Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3) + (hash2(x + 7, y + 3) - 0.5) * 0.2;
    if (q < 0.92 && world[x][y] !== T.PATH) world[x][y] = T.SNOW;
  }
  for (const [px, py, rx, ry] of [[205, 78, 6, 4], [232, 22, 5, 4], [192, 58, 4, 3]])      // frozen ponds (walkable)
    for (let x = px - rx; x <= px + rx; x++) for (let y = py - ry; y <= py + ry; y++)
      if (((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 < 1 && world[x][y] === T.SNOW) world[x][y] = T.ICE;
  // rock clusters: they must not sit on the road, the Jumbo, the ice chests or the wild slimes' spots
  const keepOpen = [[215, 52, 9], ...AURORA_CHESTS.map(([x, y]) => [x, y, 6]), ...MOUNTAIN_SPAWNS.map(([, x, y]) => [x, y, 5])];
  for (let n = 0, tries = 0; n < 15 && tries < 400; tries++) {
    const bx = ri(P.x + 6, P.x + P.w - 6), by = ri(P.y + 6, P.y + P.h - 6), r = ri(2, 4);
    if (by > 34 && by < 47) continue;                                                   // leave the road corridor free
    if (keepOpen.some(([x, y, d]) => Math.hypot(bx - x, by - y) < d + r)) continue;
    for (let x = bx - r; x <= bx + r; x++) for (let y = by - r; y <= by + r; y++)
      if (Math.hypot(x - bx, y - by) < r - 0.4 + hash2(x, y) * 0.9 && world[x][y] === T.SNOW) world[x][y] = T.STONE;
    n++;
  }
  features.push({ type: 'peak', x: P.x, y: P.y, w: P.w, h: P.h });
  // wild food
  const scatter = (food, patches, per, ok) => {
    let made = 0;
    for (let tries = 0; tries < 400 && made < patches; tries++) {
      const px = ri(P.x + 3, P.x + P.w - 3), py = ri(P.y + 3, P.y + P.h - 3); if (!ok(px, py)) continue;
      let any = 0;
      for (let i = 0; i < per; i++) { const fx = px + ri(-2, 3), fy = py + ri(-2, 3); if (fx < 1 || fx >= WORLD_W - 1 || !ok(fx, fy)) continue; foodPatches.push({ x: fx, y: fy, food, item: null, regen: rng() * 6 }); any++; }
      if (any) made++;
    }
  };
  const onSnow = (x, y) => world[x][y] === T.SNOW;
  scatter('frostberry', 10, 4, onSnow); scatter('pinenut', 8, 3, onSnow); scatter('heartbeet', 3, 3, onSnow); scatter('meat', 2, 3, onSnow); scatter('fruit', 2, 3, onSnow); scatter('carrot', 2, 3, onSnow);
  clearAround(215, 52, 2); JUMBOS.filter(j => areaAt(j.x, j.y) === 'peak').forEach(j => clearAround(j.x, j.y, 2));
  const keep = (kx, ky, r) => { for (let x = kx - r; x <= kx + r; x++) for (let y = ky - r; y <= ky + r; y++) noProp.add(x * 1000 + y); };
  JUMBOS.filter(j => areaAt(j.x, j.y) === 'peak').forEach(j => keep(j.x, j.y, 5)); AURORA_CHESTS.forEach(([x, y]) => keep(x, y, 2)); foodPatches.forEach(f => keep(f.x, f.y, 0));
}

/* ---------------------------------------------------------------------
   0.14 — Far Meadow: a wide golden-grass land east of Frostpeak. Boulders, wild food, and a home for four Jumbos.
   --------------------------------------------------------------------- */
function generateFar(seed, clearAround) {
  const rng = makeRng((seed ^ 0x3c6ef372) >>> 0), ri = (a, b) => Math.floor(a + rng() * (b - a)), F = AREAS.far;
  const avoid = [...JUMBOS.filter(j => areaAt(j.x, j.y) === 'far').map(j => [j.x, j.y, 8]), ...FAR_SPAWNS.map(([, x, y]) => [x, y, 4])];
  for (let n = 0, tries = 0; n < 110 && tries < 800; tries++) {
    const bx = ri(F.x + 2, F.x + F.w - 2), by = ri(F.y + 2, F.y + F.h - 2);
    if ((by > 36 && by < 45) || world[bx][by] !== T.GRASS || avoid.some(([x, y, d]) => Math.hypot(bx - x, by - y) < d)) continue;
    world[bx][by] = T.BOULDER; n++;
  }
  const scatter = (food, patches, per) => {
    let made = 0;
    for (let tries = 0; tries < 400 && made < patches; tries++) {
      const px = ri(F.x + 3, F.x + F.w - 3), py = ri(F.y + 3, F.y + F.h - 3); if (world[px][py] !== T.GRASS) continue;
      let any = 0; for (let i = 0; i < per; i++) { const fx = px + ri(-2, 3), fy = py + ri(-2, 3); if (world[fx][fy] !== T.GRASS) continue; foodPatches.push({ x: fx, y: fy, food, item: null, regen: rng() * 6 }); any++; }
      if (any) made++;
    }
  };
  scatter('carrot', 7, 4); scatter('heartbeet', 6, 4); scatter('cubery', 5, 3); scatter('meat', 4, 3); scatter('fruit', 4, 3);
  features.push({ type: 'far', x: F.x, y: F.y, w: F.w, h: F.h });
  JUMBOS.filter(j => areaAt(j.x, j.y) === 'far').forEach(j => { clearAround(j.x, j.y, 2); for (let x = j.x - 5; x <= j.x + 5; x++) for (let y = j.y - 5; y <= j.y + 5; y++) noProp.add(x * 1000 + y); });
}

/* ---- tides: the outer sea rows turn into walkable wet sand at low tide ---- */
function applyTide(low) {
  tideLow = low;
  for (const t of tideTiles) world[t.x][t.y] = low ? T.WETSAND : T.WATER;
}

function isBlockingAir(tx, ty) {          // while jumping you clear water and boulders, but not cave walls
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
  return world[tx][ty] === T.STONE;
}

function isBlocking(tx, ty) {
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
  const t = world[tx][ty];
  return t === T.WATER || t === T.STONE || t === T.BOULDER;
}

// collision test for a small box centred on (x, y)
function blockedAt(x, y, r, air = false) {
  const yy = r * 0.6, b = air ? isBlockingAir : isBlocking;
  return b(Math.floor((x - r) / TILE), Math.floor((y - yy) / TILE)) ||
         b(Math.floor((x + r) / TILE), Math.floor((y - yy) / TILE)) ||
         b(Math.floor((x - r) / TILE), Math.floor((y + yy) / TILE)) ||
         b(Math.floor((x + r) / TILE), Math.floor((y + yy) / TILE));
}

// nearest walkable pixel position to (px, py)
function findFreeSpot(px, py) {
  if (!blockedAt(px, py, 9)) return { x: px, y: py };
  for (let rad = 1; rad < 8; rad++) {
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      const x = px + Math.cos(ang) * rad * TILE * 0.7, y = py + Math.sin(ang) * rad * TILE * 0.7;
      if (!blockedAt(x, y, 9)) return { x, y };
    }
  }
  return { x: px, y: py };
}

/* ---- corral pens ---- (tile floor under every owned pen; call after generateWorld and after any size upgrade) */
function corralRect(c) { const sz = CORRAL_SIZES[c.size]; return { x: c.lot.x, y: c.lot.y, w: sz.w, h: sz.h }; }
function applyCorralTiles() {
  const big = CORRAL_SIZES[CORRAL_SIZES.length - 1];
  for (const c of game.corrals) {
    for (let x = c.lot.x; x < c.lot.x + big.w; x++) for (let y = c.lot.y; y < c.lot.y + big.h; y++) world[x][y] = T.FLOOR;
    if (!c.owned) continue;
    const r = corralRect(c);
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) world[x][y] = T.CORRAL;
  }
}
