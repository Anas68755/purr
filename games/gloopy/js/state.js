'use strict';
const game = {
  state: 'menu',
  money: 50, day: 1, time: 0.3,
  player: null, slimes: [], foods: [], plorts: [], treasures: [], particles: [],
  plots: [], decor: [], stock: {}, spots: [], orders: [],
  weather: { raining: false, left: 0, dur: 0, next: 120, intensity: 0, rainbow: 0 }, sky: { timer: 40, fall: null },
  interact: null, tickT: 0, paused: false,
  camera: { x: 0, y: 0 },
  pack: [],                 // [{kind:'plort'|'food'|'slime', type, n}]  <- the ONLY inventory
  selected: 0, packDirty: true,
  upgrades: {}, gear: {}, corrals: [], powers: {}, board: null, eggs: [], jumbos: [], npcs: [], chests: [], orbs: [], bouncers: [], shake: 0,
  prices: {}, trends: {}, market: null, story: null, photo: null,
  nearShop: false, shopOpen: false,
  shootCd: 0, msgCd: 0,
  visitor: false, hostSurv: false     // 0.15: visiting a friend's ranch (see js/net.js)
};

/* ---------------- derived stats ---------------- */
const getVacRange = () => 92 + game.upgrades.vac * 26 + (game.powers.windstep ? 18 : 0);
const getPlayerSpeed = () => (2.5 + game.upgrades.speed * 0.5) * (game.powers.windstep ? 1.15 : 1);
const getPackSlots = () => PACK_BASE_SLOTS + game.upgrades.pack + (game.powers.sturdy ? 2 : 0);
const getSlotCap = () => PACK_SLOT_CAP + game.upgrades.pockets * 10;
const getVacCone = () => VAC_CONE + game.upgrades.nozzle * 0.2;
const getThrowMult = () => 1 + game.upgrades.throw * 0.18;
const sellMult = () => 1 + game.upgrades.haggler * 0.06 + (game.powers.tideledger ? 0.10 : 0) + (game.powers.frostward ? 0.05 : 0);
const freshUpgrades = () => Object.fromEntries(UPGRADE_KEYS.map(k => [k, 0]));
game.upgrades = freshUpgrades();

/* ---------------- vacpack ---------------- */
function packCanAdd(kind, type, n = 1) {
  let room = 0;
  for (const s of game.pack) if (s.kind === kind && s.type === type) room += getSlotCap() - s.n;
  room += (getPackSlots() - game.pack.length) * getSlotCap();
  return room >= n;
}
function packAdd(kind, type, n = 1) {
  if (!packCanAdd(kind, type, n)) return false;
  const added = n;
  while (n > 0) {
    let slot = game.pack.find(s => s.kind === kind && s.type === type && s.n < getSlotCap());
    if (!slot) { slot = { kind, type, n: 0 }; game.pack.push(slot); }
    const add = Math.min(n, getSlotCap() - slot.n);
    slot.n += add; n -= add;
  }
  game.packDirty = true;
  if (kind === 'plort') { stat('glimmersCollected', added); discoverSlime(type, 'plort'); }
  else if (kind === 'slime') { stat('slimesCaught', added); discoverSlime(type, 'caught'); }
  else if (kind === 'food') discoverFood(type);
  else if (kind === 'treasure') { discoverTreasure(type); if (type === 'starshard') stat('shards', added); }
  return true;
}
function packTake(index) {
  const s = game.pack[index];
  if (!s) return null;
  const out = { kind: s.kind, type: s.type };
  s.n--;
  if (s.n <= 0) {
    game.pack.splice(index, 1);
    if (game.selected >= game.pack.length) game.selected = Math.max(0, game.pack.length - 1);
  }
  game.packDirty = true;
  return out;
}
function packCount(kind, type) {
  let n = 0;
  for (const s of game.pack) if (s.kind === kind && (type === undefined || s.type === type)) n += s.n;
  return n;
}
function packRemoveAll(kind, type) {
  const n = packCount(kind, type);
  game.pack = game.pack.filter(s => !(s.kind === kind && s.type === type));
  if (game.selected >= game.pack.length) game.selected = Math.max(0, game.pack.length - 1);
  game.packDirty = true;
  return n;
}

/* ---------------- market: see js/economy.js ---------------- */
const seasonOf = (day = game.day) => Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length;
const season = (day = game.day) => SEASONS[seasonOf(day)];
const dayInSeason = (day = game.day) => (day - 1) % SEASON_DAYS + 1;
function eventOn(day = game.day) { for (const k in SEASON_EVENTS) { const e = SEASON_EVENTS[k]; if (seasonOf(day) === e.season && dayInSeason(day) === e.day) return k; } return null; }
function daysUntilEvent(k, from = game.day) { for (let d = 0; d < SEASON_DAYS * SEASONS.length; d++) if (eventOn(from + d) === k) return d; return -1; }
const seasonCropMult = crop => season().crop === crop ? 1.5 : (seasonOf() === 3 ? 0.8 : 1);

/* ---------------- factories ---------------- */
function createPlayer(x, y) {
  return { x, y, z: 0, vz: 0, aim: 0, facing: 1, moving: false, walkT: 0, sucking: false };
}
let slimeNid = 1;                                              // 0.15: every slime has a stable id (nid) so multiplayer snapshots can follow it
function fixNids() {                                           // after loading: ids must be unique and the counter must be ahead of all of them
  const seen = new Set(); let max = 0;
  for (const s of game.slimes) if (s.nid) max = Math.max(max, s.nid);
  slimeNid = Math.max(slimeNid, max + 1);
  for (const s of game.slimes) { if (!s.nid || seen.has(s.nid)) s.nid = slimeNid++; seen.add(s.nid); }
}
function createSlime(type, x, y) {
  const def = SLIMES[type];
  const s = {
    nid: slimeNid++, type, def, x, y, home: { x, y }, z: 0,
    dx: 0, dy: 0, moving: false, facing: Math.random() < 0.5 ? 1 : -1,
    hop: Math.random(), age: 0,
    hunger: def.hunger * (0.55 + Math.random() * 0.35),
    target: null, wanderTimer: rand(0.5, 2.5), idle: false,
    eatTimer: 0, makePlort: false, scared: 0, sucked: 0,
    fly: 0, flyMax: 0.5, fvx: 0, fvy: 0, cooldown: 0,
    joy: 0, petCd: 0, petT: 0, heartT: rand(1, 3)
  };
  return lifeInit(s);                                           // name, trait, favourite food, 2% shiny (js/life.js)
}
function spawnFoodFromPatch(patch) {
  const f = { type: patch.food, x: patch.x * TILE + TILE / 2 + rand(-5, 5), y: patch.y * TILE + TILE / 2 + rand(-5, 5),
              vx: rand(-8, 8), vy: rand(-8, 8), z: 0, vz: rand(40, 65), age: 0 };
  game.foods.push(f);
  patch.item = f;
}

/* ---------------- new game ---------------- */
function createWorldThings() {
  createJumbos(); createNpcs(); createChests(); createOrbs(); createBouncers();
}

function createCorrals() {
  game.corrals = CORRAL_LOTS.map(l => ({
    id: l.id, name: l.name, price: l.price, lot: { x: l.x, y: l.y }, owned: l.id === 0, size: 0, feeder: 0, basket: 0, bedding: 0,
    fence: 'wood', fences: ['wood'], stock: {}, bin: {}, feedT: 0, eggCd: 0, bond: null
  }));
  applyCorralTiles();
}

function resetGame(seed) {
  generateWorld(seed);
  game.visitor = false; game.hostSurv = false;
  game.critters = []; game.surv = null;
  game.money = 50; game.day = 1; game.time = 0.3;
  game.foods = []; game.plorts = []; game.treasures = []; game.particles = []; game.slimes = [];
  game.decor = []; game.stock = {}; game.weather = newWeather(); game.sky = newSky(); game.interact = null;
  game.pack = []; game.selected = 0; game.packDirty = true;
  game.upgrades = freshUpgrades(); game.gear = {};
  game.shopOpen = false; game.shootCd = 0;
  game.powers = {}; game.eggs = []; game.board = null; game.market = null; createCorrals(); createWorldThings(); generateBoard();
  const start = findFreeSpot(19.5 * TILE, 43.5 * TILE);       // the crossroads between the corral lots
  game.player = createPlayer(start.x, start.y);
  game.camera.x = start.x; game.camera.y = start.y;
  rollPrices(true);
  generateOrders(); createPlots();
  const spawns = [
    ['pink', 40, 18, 3], ['pink', 55, 25, 2], ['tabby', 56, 52, 2], ['rock', 30, 60, 2], ['phosphor', 80, 50, 2],
    ['phosphor', 50, 8, 2], ['honey', 10, 10, 3], ['crystal', 69, 60, 1], ['bubble', 66, 29, 2], ['bubble', 56, 20, 1],
    ['mint', 28, 25, 2], ['mint', 12, 27, 1]
  ];
  for (const [type, tx, ty, n] of spawns) for (let i = 0; i < n; i++) {
    const p = findFreeSpot(tx * TILE + rand(-30, 30), ty * TILE + rand(-30, 30));
    game.slimes.push(createSlime(type, p.x, p.y));
  }
  spawnNewAreaSlimes(); spawnMountainSlimes(); spawnFarSlimes();
  foodPatches.forEach(spawnFoodFromPatch);
  generateSpots();
  game.story = newStory(); game.photo = null; auroraOn = false; syncTide(true); syncAurora(true);
  endSurvival(); syncNodes();
}

// v5: wild slimes of the new quarters (also used to top up older saves when they are migrated)
const NEW_AREA_SPAWNS = [
  ['spore', 120, 20, 2], ['spore', 132, 36, 2], ['phosphor', 112, 40, 2],
  ['puff', 150, 90, 2], ['puff', 168, 100, 2], ['pink', 120, 96, 3], ['tabby', 140, 104, 2],
  ['breeze', 30, 90, 2], ['breeze', 60, 98, 2], ['rock', 40, 104, 2], ['mint', 70, 84, 2],
  ['shell', 40, 120, 2], ['shell', 90, 121, 2], ['coral', 140, 120, 2], ['coral', 160, 119, 1], ['bubble', 56, 120, 1], ['bubble', 122, 121, 1]
];
const MOUNTAIN_SPAWNS = [
  ['frost', 200, 22, 2], ['frost', 236, 30, 1], ['flurry', 205, 70, 2], ['flurry', 232, 84, 1],
  ['glacier', 224, 60, 2], ['ember', 196, 96, 1], ['ember', 238, 98, 1], ['aurora', 225, 14, 1], ['aurora', 207, 40, 1]
];
const FAR_SPAWNS = [
  ['honey', 275, 36, 2], ['tabby', 305, 56, 2], ['mint', 280, 86, 2], ['phosphor', 328, 24, 2], ['pink', 300, 40, 3], ['rock', 322, 88, 2], ['bubble', 262, 62, 1], ['crystal', 335, 62, 1], ['puff', 290, 72, 2]
];
function spawnFarSlimes() {
  for (const [type, tx, ty, n] of FAR_SPAWNS) for (let i = 0; i < n; i++) {
    const p = findFreeSpot(tx * TILE + rand(-30, 30), ty * TILE + rand(-30, 30));
    game.slimes.push(createSlime(type, p.x, p.y));
  }
}
function spawnMountainSlimes() {
  for (const [type, tx, ty, n] of MOUNTAIN_SPAWNS) for (let i = 0; i < n; i++) {
    const p = findFreeSpot(tx * TILE + rand(-30, 30), ty * TILE + rand(-30, 30));
    game.slimes.push(createSlime(type, p.x, p.y));
  }
}
function spawnNewAreaSlimes() {
  for (const [type, tx, ty, n] of NEW_AREA_SPAWNS) for (let i = 0; i < n; i++) {
    const p = findFreeSpot(tx * TILE + rand(-30, 30), ty * TILE + rand(-30, 30));
    game.slimes.push(createSlime(type, p.x, p.y));
  }
}
