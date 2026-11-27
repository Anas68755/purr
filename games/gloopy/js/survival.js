'use strict';
/* =====================================================================
   SURVIVAL RANCH (0.13) — an optional mode chosen with “NEW SURVIVAL RANCH” on the title screen. The cosy game stays exactly as it was.
   · Four stats: ❤️ health, 🍖 hunger, 💧 thirst, ⚡ stamina. Eat (R), drink (T), bandage (H). Empty hunger/thirst hurts.
   · Gather 🪵 wood and 🌿 fibre from the world, 🪨 stone from boulders (break them), 🧶 hide from critters.
   · Craft (C) a club or spear, a pickaxe, a canteen, armour, stew and bandages — see RECIPES.
   · Critters roam: Bramble Bugs, Sand Crabs, Gloom Caps and Frost Fangs. Swing (X) to fight; they come out more at night.
   · Thunderstorms: lightning is telegraphed with a red ring — step out of it.
   · Fainting (health 0) wakes you at the ranch crossroads and costs 25% of your money.
   The ranch itself is a safe place: no critters spawn near the crossroads, the market and the corrals.
   ===================================================================== */
const SURV = {
  hpMax: 100, foodMax: 100, waterMax: 100, stamMax: 100,
  foodDrain: 1 / 5.5, waterDrain: 1 / 4,            // per second (≈ 9 and 6.5 minutes from full to empty)
  starve: 1.2, regen: 0.6, stamRegen: 24, stamDelay: 0.7,
  faintLoss: 0.25, drinkAmount: 40, canteenMax: 3, canteenSip: 35, rainDrink: 3,
  safe: { x0: 6, y0: 24, x1: 48, y1: 58 },          // tile rectangle around the ranch where critters never spawn or follow
  atkCd: 0.5, hitStam: 10, gatherStam: 3, breakStam: 8,
  nodeRegrow: 240, critterMax: 4, critterMaxNight: 9, spawnMin: 380, spawnMax: 560, despawn: 900
};
const NUTRITION = { carrot: 14, heartbeet: 18, cubery: 16, fruit: 20, meat: 30, truffle: 22, kelp: 10, frostberry: 15, pinenut: 12, treat: 6 };
const MATS = {
  wood:  { icon: '🪵', name: 'Wood' }, stone: { icon: '🪨', name: 'Stone' }, fiber: { icon: '🌿', name: 'Fibre' }, hide:  { icon: '🧶', name: 'Hide' }
};
const RECIPES = [
  { id: 'club',    kind: 'weapon', icon: '🏏', name: 'Wooden Club',   cost: { wood: 4, fiber: 1 }, dmg: 12, reach: 46, desc: 'Hits for 12. A good first friend.' },
  { id: 'spear',   kind: 'weapon', icon: '🔱', name: 'Stone Spear',   cost: { wood: 3, stone: 3, fiber: 2 }, dmg: 20, reach: 64, desc: 'Hits for 20 and reaches farther.' },
  { id: 'pick',    kind: 'tool',   icon: '⛏️', name: 'Stone Pickaxe', cost: { wood: 3, stone: 4 }, desc: 'Boulders break in 2 hits and give 1 extra stone.' },
  { id: 'canteen', kind: 'tool',   icon: '🫙', name: 'Canteen',       cost: { hide: 2, fiber: 2 }, desc: 'Carries 3 drinks. Refill it at any pond.' },
  { id: 'vest',    kind: 'armor',  icon: '🦺', name: 'Hide Vest',     cost: { hide: 5, fiber: 3 }, def: 0.25, desc: 'Takes 25% off every hit.' },
  { id: 'plate',   kind: 'armor',  icon: '🛡️', name: 'Stone Plate',   cost: { stone: 4, hide: 3, wood: 4 }, def: 0.45, desc: 'Takes 45% off every hit.' },
  { id: 'stew',    kind: 'supply', icon: '🍲', name: 'Hearty Stew',   cost: { food: { carrot: 1, heartbeet: 1, meat: 1 } }, desc: 'Restores 60 hunger and 12 thirst. Eat with R.' },
  { id: 'bandage', kind: 'supply', icon: '🩹', name: 'Bandage',       cost: { fiber: 2, food: { fruit: 1 } }, desc: 'Heals 40 health. Use with H.' }
];
const recipe = id => RECIPES.find(r => r.id === id);

const CRITTERS = {
  bramblebug: { cell: 0, name: 'Bramble Bug', hp: 14, dmg: 6,  speed: 1.7, aggro: 200, areas: ['grove0', 'prairie', 'fields', null], drops: { hide: 0.5, meat: 0.2 }, size: 14 },
  sandcrab:   { cell: 1, name: 'Sand Crab',   hp: 24, dmg: 8,  speed: 1.4, aggro: 170, areas: ['beach'],                              drops: { hide: 0.6, meat: 0.3 }, size: 16 },
  gloomcap:   { cell: 2, name: 'Gloom Cap',   hp: 32, dmg: 10, speed: 1.25, aggro: 190, areas: ['grove'],                             drops: { hide: 0.5, truffle: 0.4 }, size: 17 },
  frostfang:  { cell: 3, name: 'Frost Fang',  hp: 46, dmg: 14, speed: 2.0, aggro: 230, areas: ['peak'],                               drops: { hide: 1, meat: 0.5 }, size: 18 }
};

/* ---------------- state ---------------- */
const newSurv = () => ({ hp: SURV.hpMax, food: SURV.foodMax, water: SURV.waterMax, stam: SURV.stamMax, mats: { wood: 0, stone: 0, fiber: 0, hide: 0 }, owned: {}, weapon: null, armor: null, pick: false, canteen: 0, hasCanteen: false, stew: 0, bandage: 0, broken: [], nodeCd: [], atkCd: 0, stamT: 0, hurtT: 0, swing: 0, strike: null, stormT: 3 });
const isSurvival = () => !!(game && game.surv);
const matCount = m => game.surv.mats[m] || 0;
const weaponDef = () => game.surv.weapon ? recipe(game.surv.weapon) : null;
const armorDef = () => game.surv.armor ? recipe(game.surv.armor) : null;
const inSafeZone = (x, y) => { const tx = x / TILE, ty = y / TILE, s = SURV.safe; return tx >= s.x0 && tx <= s.x1 && ty >= s.y0 && ty <= s.y1; };
const isFreshWaterTile = (tx, ty) => tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H && ((world[tx][ty] === T.WATER && ty < BEACH_TOP) || world[tx][ty] === T.ICE);

/* ---------------- gatherable nodes (branches, tufts): generated from the world seed, regrow after SURV.nodeRegrow ---------------- */
let nodeDefs = [];
function generateNodes(seed) {
  nodeDefs = [];
  const rng = makeRng((seed ^ 0x6a09e667) >>> 0), ri = (a, b) => Math.floor(a + rng() * (b - a));
  const want = { branches: 130, tuft: 130 };
  for (const type in want) {
    for (let n = 0, tries = 0; n < want[type] && tries < 6000; tries++) {
      const tx = ri(3, WORLD_W - 3), ty = ri(3, BEACH_TOP + 12), t = world[tx][ty];
      const okTile = type === 'branches' ? (t === T.GRASS || t === T.MOSS || t === T.SNOW || t === T.SAND || t === T.ORCHARD) : (t === T.GRASS || t === T.MOSS || t === T.SAND);
      if (!okTile || noProp.has(tx * 1000 + ty) || nodeDefs.some(d => Math.abs(d.x - tx) + Math.abs(d.y - ty) < 3)) continue;
      nodeDefs.push({ type, x: tx, y: ty }); n++;
    }
  }
}
function syncNodes() {                                                            // game.nodes mirrors nodeDefs with regrow timers
  game.nodes = nodeDefs.map((d, i) => ({ type: d.type, x: d.x * TILE + TILE / 2, y: d.y * TILE + TILE / 2, cd: (game.surv && game.surv.nodeCd[i]) || 0 }));
}
function applyBrokenRocks() {                                                     // boulders broken in earlier sessions stay broken
  if (!game.surv) return;
  for (const k of game.surv.broken) { const [x, y] = k.split(',').map(Number); if (world[x] && world[x][y] === T.BOULDER) world[x][y] = baseTileAt(x, y); }
}
function baseTileAt(x, y) { const a = areaAt(x, y); return a === 'peak' ? T.SNOW : a === 'grove' ? T.MOSS : y >= BEACH_TOP ? T.SAND : T.GRASS; }

/* ---------------- stats ---------------- */
function updateSurvival(dt) {
  const s = game.surv; if (!s) return;
  const p = game.player;
  s.atkCd = Math.max(0, s.atkCd - dt); s.hurtT = Math.max(0, s.hurtT - dt); s.swing = Math.max(0, s.swing - dt); s.stamT = Math.max(0, s.stamT - dt);
  const w = game.weather, storm = w.raining && w.kind === 'storm';
  s.food = Math.max(0, s.food - SURV.foodDrain * dt * (p.moving ? 1.15 : 1));
  s.water = Math.max(0, s.water - SURV.waterDrain * dt * (p.moving ? 1.15 : 1));
  if (w.raining && w.kind !== 'snow' && w.intensity > 0.5) s.water = Math.min(SURV.waterMax, s.water + SURV.rainDrink * dt * 0.5);       // rain quenches a little
  if (s.stamT <= 0) s.stam = Math.min(SURV.stamMax, s.stam + SURV.stamRegen * (storm ? 0.6 : 1) * dt);
  if (s.food <= 0 || s.water <= 0) hurtPlayer(SURV.starve * dt, true);
  else if (s.food > 40 && s.water > 40 && s.hp < SURV.hpMax) s.hp = Math.min(SURV.hpMax, s.hp + SURV.regen * dt * (s.food > 75 && s.water > 75 ? 1.6 : 1));
  if (s.hp <= 0) faint();
  for (const n of game.nodes || []) if (n.cd > 0) n.cd = Math.max(0, n.cd - dt);
  updateCritters(dt); updateStorm(dt);
}
function hurtPlayer(amount, silent) {
  const s = game.surv; if (!s || amount <= 0) return;
  const red = armorDef() && !silent ? armorDef().def : 0;
  s.hp -= amount * (1 - red);
  if (!silent) { s.hurtT = 0.35; Sound.play('error', 0.5); }
}
function faint() {
  const s = game.surv, p = game.player, lost = Math.floor(game.money * SURV.faintLoss);
  game.money -= lost; stat('faints');
  const f = findFreeSpot(19.5 * TILE, 43.5 * TILE); p.x = f.x; p.y = f.y; p.z = 0; p.vz = 0; game.camera.x = p.x; game.camera.y = p.y;
  s.hp = 40; s.food = Math.max(s.food, 40); s.water = Math.max(s.water, 40); s.stam = 60; s.hurtT = 0; s.strike = null;
  game.critters = [];
  showToast('😵', 'You fainted…', `You woke up at the ranch. ${lost ? 'You lost $' + lost + ' on the way.' : 'Nothing was lost.'}`, true);
  const fl = $('#flash'); if (fl) { fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 400); }
}
function useStamina(n) {
  const s = game.surv; if (s.stam < n) { showAlert('😮‍💨 Too tired — catch your breath', 1200); return false; }
  s.stam -= n; s.stamT = SURV.stamDelay; return true;
}

/* ---------------- eat / drink / heal ---------------- */
function eatSelected() {
  const s = game.surv; if (!s) return false;
  const slot = game.pack[game.selected];
  if (slot && slot.kind === 'food' && NUTRITION[slot.type] !== undefined && s.food < SURV.foodMax - 1) {
    packRemoveN('food', slot.type, 1);
    const gain = NUTRITION[slot.type]; s.food = Math.min(SURV.foodMax, s.food + gain); Sound.play('eat', 0.7); stat('mealsEaten');
    showAlert(`🍖 +${gain} hunger`, 1100); return true;
  }
  if (s.stew > 0 && s.food < SURV.foodMax - 1) { s.stew--; s.food = Math.min(SURV.foodMax, s.food + 60); s.water = Math.min(SURV.waterMax, s.water + 12); Sound.play('eat', 0.8); stat('mealsEaten'); showAlert('🍲 +60 hunger, +12 thirst', 1300); return true; }
  showAlert(s.food >= SURV.foodMax - 1 ? '🍖 You are full' : '🍖 Select a food in your gulper (or craft a stew)', 1500); return false;
}
function nearFreshWater() {
  const p = game.player, tx0 = Math.floor(p.x / TILE), ty0 = Math.floor(p.y / TILE);
  let best = null, bd = 1e9;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const tx = tx0 + dx, ty = ty0 + dy; if (!isFreshWaterTile(tx, ty)) continue;
    const d = dist(p.x, p.y, tx * TILE + TILE / 2, ty * TILE + TILE / 2); if (d < bd && d < 64) { bd = d; best = { tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
  }
  return best;
}
function drink() {
  const s = game.surv; if (!s) return false;
  if (nearFreshWater()) {
    if (s.water >= SURV.waterMax - 1 && (!s.hasCanteen || s.canteen >= SURV.canteenMax)) { showAlert('💧 You are not thirsty', 1200); return false; }
    s.water = Math.min(SURV.waterMax, s.water + SURV.drinkAmount); if (s.hasCanteen) s.canteen = SURV.canteenMax;
    Sound.play('water', 0.7); stat('drinks'); showAlert(s.hasCanteen ? '💧 Drank, and refilled your canteen' : '💧 Fresh water!', 1300); return true;
  }
  if (s.hasCanteen && s.canteen > 0 && s.water < SURV.waterMax - 1) { s.canteen--; s.water = Math.min(SURV.waterMax, s.water + SURV.canteenSip); Sound.play('water', 0.6); stat('drinks'); showAlert(`💧 Canteen sip (${s.canteen} left)`, 1200); return true; }
  showAlert(s.hasCanteen ? '💧 Canteen empty — find a pond' : '💧 Walk up to a pond to drink', 1400); return false;
}
function heal() {
  const s = game.surv; if (!s) return false;
  if (s.bandage <= 0) { showAlert('🩹 No bandages — craft one (C)', 1300); return false; }
  if (s.hp >= SURV.hpMax - 1) { showAlert('❤️ You are healthy', 1100); return false; }
  s.bandage--; s.hp = Math.min(SURV.hpMax, s.hp + 40); Sound.play('plant', 0.7); showAlert('🩹 +40 health', 1200); return true;
}

/* ---------------- gather / break ---------------- */
function gatherNode(n) {
  const s = game.surv; if (n.cd > 0 || !useStamina(SURV.gatherStam)) return;
  const wood = n.type === 'branches';
  const amount = randi(2, 4); s.mats[wood ? 'wood' : 'fiber'] += amount; n.cd = SURV.nodeRegrow; stat('gathered');
  const i = game.nodes.indexOf(n); if (i >= 0) s.nodeCd[i] = n.cd;
  spawnParticles(n.x, n.y - 8, 6, wood ? '#a8702e' : '#7ac84a', { spread: 24, up: 40, life: 0.7 });
  showAlert(`${MATS[wood ? 'wood' : 'fiber'].icon} +${amount} ${MATS[wood ? 'wood' : 'fiber'].name}`, 1100); Sound.play('collect', 0.5);
}
const rockHits = {};
function breakRock(tx, ty) {
  const s = game.surv, need = s.pick ? 2 : 4, key = tx + ',' + ty;
  if (!useStamina(SURV.breakStam)) return;
  rockHits[key] = (rockHits[key] || 0) + 1; Sound.play('dig', 0.7); spawnParticles(tx * TILE + TILE / 2, ty * TILE + TILE / 2 - 8, 6, '#9a9aa6', { spread: 22, up: 36, life: 0.6 });
  if (rockHits[key] < need) { showAlert(`⛏️ ${rockHits[key]}/${need}`, 700); return; }
  delete rockHits[key]; world[tx][ty] = baseTileAt(tx, ty); s.broken.push(key); stat('rocksBroken');
  const amount = randi(1, 3) + (s.pick ? 1 : 0); s.mats.stone += amount;
  showAlert(`🪨 +${amount} Stone`, 1200);
}
function nearBoulder() {
  const p = game.player, tx0 = Math.floor(p.x / TILE), ty0 = Math.floor(p.y / TILE); let best = null, bd = 1e9;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const tx = tx0 + dx, ty = ty0 + dy; if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H || world[tx][ty] !== T.BOULDER) continue;
    const d = dist(p.x, p.y, tx * TILE + TILE / 2, ty * TILE + TILE / 2); if (d < bd && d < 72) { bd = d; best = { tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
  }
  return best;
}

/* ---------------- crafting ---------------- */
function canAfford(r) {
  const s = game.surv;
  for (const k in r.cost) if (k !== 'food' && matCount(k) < r.cost[k]) return false;
  if (r.cost.food) for (const f in r.cost.food) if (packCount('food', f) < r.cost.food[f]) return false;
  return true;
}
function craft(id) {
  const s = game.surv, r = recipe(id); if (!s || !r || !canAfford(r)) { Sound.play('error', 0.5); return false; }
  if ((r.kind === 'weapon' || r.kind === 'armor' || r.kind === 'tool') && s.owned[id]) { showAlert('You already made that', 1200); return false; }
  for (const k in r.cost) if (k !== 'food') s.mats[k] -= r.cost[k];
  if (r.cost.food) for (const f in r.cost.food) packRemoveN('food', f, r.cost.food[f]);
  if (r.kind === 'weapon') { s.owned[id] = true; if (!s.weapon || (recipe(s.weapon).dmg < r.dmg)) s.weapon = id; }
  else if (r.kind === 'armor') { s.owned[id] = true; if (!s.armor || (recipe(s.armor).def < r.def)) s.armor = id; }
  else if (id === 'pick') { s.owned.pick = true; s.pick = true; }
  else if (id === 'canteen') { s.owned.canteen = true; s.hasCanteen = true; s.canteen = SURV.canteenMax; }
  else if (id === 'stew') s.stew++; else if (id === 'bandage') s.bandage++;
  stat('crafted'); Sound.play('upgrade', 0.8); showToast(r.icon, `Crafted: ${r.name}`, r.desc);
  return true;
}
function equip(id) {
  const s = game.surv, r = recipe(id); if (!r || !s.owned[id]) return false;
  if (r.kind === 'weapon') s.weapon = s.weapon === id ? null : id; else if (r.kind === 'armor') s.armor = s.armor === id ? null : id; else return false;
  Sound.play('click', 0.6); return true;
}

/* ---------------- critters ---------------- */
function critterKindAt(tx, ty) {
  const a = areaAt(tx, ty);
  if (a === 'beach' || ty >= BEACH_TOP) return 'sandcrab';
  if (a === 'grove') return Math.random() < 0.7 ? 'gloomcap' : 'bramblebug';
  if (a === 'peak') return 'frostfang';
  return 'bramblebug';
}
function spawnCritter(kind, x, y) {
  const def = CRITTERS[kind];
  const c = { kind, def, x, y, vx: 0, vy: 0, hp: def.hp, maxHp: def.hp, cd: 0.6, hurt: 0, state: 'wander', wt: rand(1, 3), dir: rand(0, 6.28), walk: rand(0, 6), z: 0, id: Math.random().toString(36).slice(2, 6) };
  game.critters.push(c); return c;
}
function updateCritters(dt) {
  const s = game.surv, p = game.player; game.critters = game.critters || [];
  const night = nightAmount(game.time) > 0.5, target = night ? SURV.critterMaxNight : SURV.critterMax;
  // spawn out of sight, never in the safe zone around the ranch
  game.spawnT = (game.spawnT || 0) - dt;
  if (game.spawnT <= 0) {
    game.spawnT = rand(1.5, 3);
    if (game.critters.length < target && !inSafeZone(p.x, p.y)) {
      for (let tries = 0; tries < 12; tries++) {
        const a = rand(0, 6.283), d = rand(SURV.spawnMin, SURV.spawnMax), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (tx < 2 || ty < 2 || tx >= WORLD_W - 2 || ty >= WORLD_H - 2 || isBlocking(tx, ty) || inSafeZone(x, y) || game.spots.some(sp => dist(sp.x, sp.y, x, y) < 40)) continue;
        spawnCritter(critterKindAt(tx, ty), x, y); break;
      }
    }
  }
  for (let i = game.critters.length - 1; i >= 0; i--) {
    const c = game.critters[i], def = c.def, d = dist(c.x, c.y, p.x, p.y);
    c.cd = Math.max(0, c.cd - dt); c.hurt = Math.max(0, c.hurt - dt); c.walk += dt * 8;
    if (d > SURV.despawn || (inSafeZone(c.x, c.y) && d > 250)) { game.critters.splice(i, 1); continue; }
    const chase = d < def.aggro * (night ? 1.25 : 1) && !inSafeZone(p.x, p.y) && p.z < 4;
    let mx = 0, my = 0;
    if (chase) { c.state = 'chase'; const a = Math.atan2(p.y - c.y, p.x - c.x); mx = Math.cos(a); my = Math.sin(a); }
    else { c.state = 'wander'; c.wt -= dt; if (c.wt <= 0) { c.wt = rand(1, 3); c.dir = rand(0, 6.283); c.idle = Math.random() < 0.35; } if (!c.idle) { mx = Math.cos(c.dir) * 0.5; my = Math.sin(c.dir) * 0.5; } }
    const sp = def.speed * 60 * dt * (c.hurt > 0 ? 0.3 : 1);
    if (Math.abs(mx) + Math.abs(my) > 0) { moveWithCollision(c, mx * sp + c.vx * dt, my * sp + c.vy * dt, def.size * 0.5); c.face = mx < 0 ? -1 : 1; }
    c.vx *= Math.pow(0.02, dt); c.vy *= Math.pow(0.02, dt);
    if (chase && d < def.size + 14 && c.cd <= 0 && p.z < 8) {                      // bite
      c.cd = 1.1; hurtPlayer(def.dmg); stat('hitsTaken');
      const a = Math.atan2(p.y - c.y, p.x - c.x); p.x += Math.cos(a) * 10; p.y += Math.sin(a) * 10;
      spawnParticles(p.x, p.y - 12, 5, '#ff5a5a', { spread: 26, up: 40, life: 0.5 });
    }
  }
}
function swing() {
  const s = game.surv, p = game.player; if (!s || s.atkCd > 0) return false;
  if (!useStamina(SURV.hitStam)) return false;
  s.atkCd = SURV.atkCd; s.swing = 0.22; Sound.play('shoot', 0.6);
  const wd = weaponDef(), dmg = wd ? wd.dmg : 5, reach = wd ? wd.reach : 36;
  let hit = 0;
  for (const c of game.critters) {
    const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d > reach + c.def.size) continue;
    const da = Math.abs(angleDiff(Math.atan2(dy, dx), p.aim)); if (da > 1.1) continue;
    hit++; c.hp -= dmg * rand(0.85, 1.15); c.hurt = 0.35; c.vx += Math.cos(p.aim) * 420; c.vy += Math.sin(p.aim) * 420;
    spawnParticles(c.x, c.y - 10, 5, '#ffe9a8', { spread: 22, up: 34, life: 0.45 });
    if (c.hp <= 0) killCritter(c);
  }
  game.critters = game.critters.filter(c => c.hp > 0);
  return true;
}
function killCritter(c) {
  const s = game.surv; stat('kills'); Sound.play('plort', 0.6);
  const d = c.def.drops;
  if (Math.random() < (d.hide || 0)) { s.mats.hide++; showAlert('🧶 +1 Hide', 1000); }
  for (const f of ['meat', 'truffle']) if (d[f] && Math.random() < d[f]) popItem(game.foods, f, c.x, c.y - 6);
  spawnParticles(c.x, c.y - 10, 10, '#ffffff', { spread: 34, up: 50, life: 0.7 });
}

/* ---------------- storms ---------------- */
function updateStorm(dt) {
  const s = game.surv, w = game.weather, p = game.player;
  if (!(w.raining && w.kind === 'storm')) { s.strike = null; return; }
  if (s.strike) {
    s.strike.t -= dt;
    if (s.strike.t <= 0) {
      const k = s.strike; s.strike = null; s.stormT = rand(4, 7);
      spawnParticles(k.x, k.y - 20, 18, '#fff7a8', { spread: 50, up: 80, life: 0.6 }); const fl = $('#flash'); if (fl) { fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 120); }
      Sound.play('bigpop', 0.5);
      if (dist(p.x, p.y, k.x, k.y) < 46 && p.z < 10) { hurtPlayer(24); stat('lightningHits'); showAlert('⚡ Struck by lightning!', 1400); }
    }
  } else {
    s.stormT -= dt;
    if (s.stormT <= 0) { const a = rand(0, 6.283), d = rand(30, 230); s.strike = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 1.4, t0: 1.4 }; }
  }
}

/* ---------------- start / save ---------------- */
function startSurvival() { game.surv = newSurv(); game.critters = []; syncNodes(); setSurvClass(true); }
function endSurvival() { game.surv = null; game.critters = []; setSurvClass(false); }
function setSurvClass(on) { if (typeof document !== 'undefined' && document.body && document.body.classList) document.body.classList.toggle('survival', on); }
function survSave() { return game.surv ? Object.assign({}, game.surv, { strike: null, nodeCd: game.nodes.map(n => Math.round(n.cd)) }) : null; }
function survLoad(d) {
  if (!d) { endSurvival(); syncNodes(); return; }
  game.surv = Object.assign(newSurv(), d); game.surv.mats = Object.assign({ wood: 0, stone: 0, fiber: 0, hide: 0 }, d.mats); game.surv.strike = null;
  game.critters = []; applyBrokenRocks(); syncNodes(); setSurvClass(true);
}

/* ---------------- HUD ---------------- */
function updateSurvHud() {
  const s = game.surv, on = !!s; setSurvClass(on); if (!on) return;
  const set = (id, v, max) => { const el = document.getElementById(id); if (el) el.style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; };
  set('sbHp', s.hp, SURV.hpMax); set('sbFood', s.food, SURV.foodMax); set('sbWater', s.water, SURV.waterMax); set('sbStam', s.stam, SURV.stamMax);
  const gear = document.getElementById('survGear');
  if (gear) gear.textContent = `${s.weapon ? recipe(s.weapon).icon : '✊'}${s.armor ? recipe(s.armor).icon : ''}${s.pick ? '⛏️' : ''}${s.hasCanteen ? '🫙' + s.canteen : ''}${s.stew ? ' 🍲' + s.stew : ''}${s.bandage ? ' 🩹' + s.bandage : ''}  🪵${s.mats.wood} 🪨${s.mats.stone} 🌿${s.mats.fiber} 🧶${s.mats.hide}`;
  const sh = document.getElementById('stormShade'); if (sh) { const w = game.weather, k = w.raining && w.kind === 'storm' ? w.intensity * 0.32 : 0; sh.style.background = 'rgba(8,12,36,' + k.toFixed(3) + ')'; }
  const hb = document.getElementById('survHurt'); if (hb) hb.style.opacity = s.hurtT > 0 ? Math.min(0.5, s.hurtT * 1.6) : (s.hp < 30 ? 0.18 + Math.sin(performance.now() * 0.008) * 0.06 : 0);
}
