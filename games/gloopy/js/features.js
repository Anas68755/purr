'use strict';
/* =====================================================================
   FEATURES — the relaxing extras layered on the core loop:
   orders · joy & petting · garden · ranch decor · weather · shooting stars
   · glimmering dig spots · context interactions
   ===================================================================== */

/* ---------------- orders (3 at a time, each paid on completion) ---------------- */
const ORDER_KINDS = ['sell', 'sell', 'sell', 'collect', 'harvest', 'dig', 'pet', 'feedfav'];
function makeOrder(avoid) {
  const common = SLIME_IDS.filter(id => !SLIMES[id].rare && !SLIMES[id].hybrid && (!NEW_SLIMES.includes(id) || slimeEntry(id).seen));
  for (let tries = 0; tries < 30; tries++) {
    const kind = ORDER_KINDS[randi(0, ORDER_KINDS.length)];
    const id = common[randi(0, common.length)], nm = SLIMES[id].name, o = { kind, progress: 0 };
    if (kind === 'sell')        { o.key = id; o.amount = randi(2, 6); o.reward = Math.round(SLIMES[id].plort.value * o.amount * 0.7) + 10; o.desc = `Sell ${o.amount} ${nm} glimmer${o.amount > 1 ? 's' : ''}`; }
    else if (kind === 'collect') { o.key = id; o.amount = randi(1, 3); o.reward = o.amount * 25; o.desc = `Catch ${o.amount} ${nm} slime${o.amount > 1 ? 's' : ''}`; }
    else if (kind === 'harvest') { o.amount = randi(3, 7); o.reward = o.amount * 8 + 10; o.desc = `Harvest ${o.amount} crops`; }
    else if (kind === 'dig')     { o.amount = randi(1, 4); o.reward = o.amount * 30; o.desc = `Dig up ${o.amount} glimmering spot${o.amount > 1 ? 's' : ''}`; }
    else if (kind === 'pet')     { o.amount = randi(3, 7); o.reward = o.amount * 8 + 10; o.desc = `Pet slimes ${o.amount} times`; }
    else                         { o.amount = randi(2, 5); o.reward = o.amount * 18 + 10; o.desc = `Feed slimes their favourite food ${o.amount} times`; }
    if (avoid && avoid.some(a => a.kind === o.kind && a.key === o.key)) continue;
    return o;
  }
  return { kind: 'pet', amount: 3, reward: 34, progress: 0, desc: 'Pet slimes 3 times' };
}
function generateOrders() { game.orders = []; for (let i = 0; i < 3; i++) game.orders.push(makeOrder(game.orders)); }
function questProgress(kind, key, n) {
  npcCounter(kind, n);
  game.orders.forEach((o, i) => {
    if (o.kind !== kind || (o.key !== undefined && o.key !== key)) return;
    o.progress += n;
    if (o.progress >= o.amount) {
      game.money += o.reward; stat('moneyEarned', o.reward); stat('ordersDone');
      showAlert(`✅ Order complete! +$${o.reward}`); Sound.play('quest');
      game.orders[i] = makeOrder(game.orders.filter((_, j) => j !== i));
    }
  });
}

/* ---------------- charm, joy, petting ---------------- */
function charm() { let c = 0; for (const d of game.decor) c += DECOR_ITEMS[d.type].charm; return c; }
const joyMult = () => 1 + Math.min(0.5, charm() * 0.02);
const isDelighted = s => s.joy >= 50;

function slimeFed(s, foodType) {
  if (FOODS[foodType].treat) {                                   // treats: pure joy
    s.joy = Math.min(100, s.joy + 60 * joyMult() * traitJoy(s)); stat('treatsGiven');
    for (let i = 0; i < 3; i++) spawnHeart(s.x + rand(-10, 10), s.y - 18 - i * 7);
    const e = slimeEntry(s.type); if (s.joy >= 50 && !e.delighted) { e.delighted = true; profileDirty = true; }
    return;
  }
  const fav = foodType === s.def.fav;
  const liked = foodType === s.likes;                                            // every slime also has its own favourite from its diet
  s.joy = Math.min(100, s.joy + ((fav ? 50 : 20) + (liked ? 18 : 0)) * joyMult() * traitJoy(s));
  if (liked) { spawnHeart(s.x - 7, s.y - 22); if (Math.random() < 0.35) showAlert(`💕 ${s.name} loves ${FOODS[foodType].name}!`, 1400); }
  discoverDiet(s.type, foodType);
  if (fav) { stat('favFed'); questProgress('feedfav', null, 1); spawnHeart(s.x, s.y - 20); spawnHeart(s.x + 8, s.y - 14); }
  if (s.joy >= 50) { const e = slimeEntry(s.type); if (!e.delighted) { e.delighted = true; profileDirty = true; } }
}
function petSlime(s, by) {                                   // `by` = a visiting friend (0.15): no quest/stat credit, no alert
  if (s.petCd > 0) { if (!by) showAlert(`${s.def.name} is enjoying the moment…`, 1200); return false; }
  s.petCd = 10 - 2 * game.upgrades.touch - (game.powers.calm ? 3 : 0); s.petT = 0.9; s.joy = Math.min(100, s.joy + (14 + 6 * game.upgrades.touch) * joyMult() * traitJoy(s) * traitPet(s));
  s.facing = (by || game.player).x < s.x ? -1 : 1;
  for (let i = 0; i < 3; i++) spawnHeart(s.x + rand(-10, 10), s.y - 18 - i * 6);
  Sound.play('pet', 0.8);
  if (by) return true;
  stat('pets'); questProgress('pet', null, 1);
  if (navigator.vibrate && profile.settings.vibrate) navigator.vibrate(10);
  return true;
}

/* ---------------- corrals ---------------- */
const corralCap = c => CORRAL_SIZES[c.size].cap;
const basketCap = c => CORRAL_UPGRADES.basket.cap[c.basket];
const feederCap = c => CORRAL_UPGRADES.feeder.cap[c.feeder];
const basketTotal = c => Object.values(c.bin).reduce((a, b) => a + b, 0);
const feederTotal = c => Object.values(c.stock).reduce((a, b) => a + b, 0);
function corralAt(px, py) {
  for (const c of game.corrals) {
    if (!c.owned) continue;
    const r = corralRect(c);
    if (px > r.x * TILE && px < (r.x + r.w) * TILE && py > r.y * TILE && py < (r.y + r.h) * TILE) return c;
  }
  return null;
}
function corralPop(c) { let n = 0; for (const s of game.slimes) if (penOf(s) === c) n++; return n; }
function corralSign(c) {                       // where the pen's sign (and its ✋ spot) stands
  const sz = c.owned ? CORRAL_SIZES[c.size] : CORRAL_SIZES[0];
  return { x: (c.lot.x + sz.w) * TILE - 16, y: c.lot.y * TILE - 6 };
}
const ownedCorrals = () => game.corrals.filter(c => c.owned).length;

function buyCorral(c) {
  if (c.owned || game.money < c.price) { Sound.play('error', 0.6); return false; }
  game.money -= c.price; c.owned = true; applyCorralTiles();
  statMax('corralsOwned', ownedCorrals());
  const sg = corralSign(c);
  Sound.play('upgrade'); spawnParticles(sg.x - 40, sg.y + 60, 16, '#ffe27a', { spread: 80, up: 70, life: 1.1 });
  showAlert(`🐾 ${c.name} is yours!`, 2400);
  return true;
}
function corralUpgradeCost(c, key) { const u = CORRAL_UPGRADES[key]; return c[key] >= u.max ? null : u.costs[c[key]]; }
function upgradeCorral(c, key) {
  const cost = corralUpgradeCost(c, key);
  if (!c.owned || cost === null || game.money < cost) { Sound.play('error', 0.6); return false; }
  game.money -= cost; c[key]++;
  if (key === 'size') applyCorralTiles();
  stat('corralUpgrades'); statMax('bestCorralLevel', c.size + c.feeder + c.basket + c.bedding);
  Sound.play('upgrade'); showAlert(`${CORRAL_UPGRADES[key].icon} ${CORRAL_UPGRADES[key].name} → Lv ${c[key]}`);
  return true;
}
function buyFence(c, id) {
  const st = FENCE_STYLES.find(f => f.id === id);
  if (!c.owned || !st) return false;
  if (!c.fences.includes(id)) {
    if (game.money < st.cost) { Sound.play('error', 0.6); return false; }
    game.money -= st.cost; c.fences.push(id); stat('fencesBought');
  }
  c.fence = id; Sound.play('click'); return true;
}
function packRemoveN(kind, type, n) {
  let left = n;
  for (let i = game.pack.length - 1; i >= 0 && left > 0; i--) {
    const sl = game.pack[i]; if (sl.kind !== kind || sl.type !== type) continue;
    const t = Math.min(sl.n, left); sl.n -= t; left -= t;
    if (sl.n <= 0) game.pack.splice(i, 1);
  }
  if (game.selected >= game.pack.length) game.selected = Math.max(0, game.pack.length - 1);
  game.packDirty = true; return n - left;
}
function loadFeeder(c, foodType) {
  if (!c.feeder || FOODS[foodType].treat) return 0;
  const n = Math.min(packCount('food', foodType), feederCap(c) - feederTotal(c));
  if (n <= 0) { Sound.play('error', 0.5); return 0; }
  packRemoveN('food', foodType, n); c.stock[foodType] = (c.stock[foodType] || 0) + n;
  Sound.play('collect', 0.7); return n;
}
function collectBasket(c) {
  let got = 0;
  for (const id of Object.keys(c.bin)) {
    while (c.bin[id] > 0 && packCanAdd('plort', id, 1)) { packAdd('plort', id, 1); c.bin[id]--; got++; }
    if (c.bin[id] <= 0) delete c.bin[id];
  }
  if (got) { Sound.play('collect'); showAlert(`🧺 Collected ${got} glimmer${got > 1 ? 's' : ''}`); }
  else showAlert(basketTotal(c) ? '🎒 Your gulper is full' : 'The basket is empty', 1600);
  return got;
}
function updateCorrals(dt) {
  for (const c of game.corrals) {
    if (!c.owned || c.feeder <= 0 || feederTotal(c) <= 0) continue;
    c.feedT -= dt;
    if (c.feedT > 0) continue;
    c.feedT = CORRAL_UPGRADES.feeder.every[c.feeder];
    let best = null, bh = 0.65;
    for (const s of game.slimes) {
      if (penOf(s) !== c) continue;
      const hf = s.hunger / s.def.hunger;
      if (hf < bh && !game.foods.some(f => dist(f.x, f.y, s.x, s.y) < 60)) { best = s; bh = hf; }
    }
    if (!best) continue;
    const def = best.def, type = (c.stock[def.fav] > 0 && def.food.includes(def.fav)) ? def.fav : def.food.find(f => c.stock[f] > 0);
    if (!type) continue;
    c.stock[type]--; if (c.stock[type] <= 0) delete c.stock[type];
    game.foods.push({ type, x: best.x + rand(-14, 14), y: best.y + rand(-8, 8), vx: 0, vy: 0, z: 26, vz: 0, age: 0, thrown: true });
    stat('feederDrops'); spawnParticles(best.x, best.y - 24, 4, FOODS[type].color, { spread: 14, up: 20, life: 0.5, g: 0 });
    if (nearPlayer(best.x, best.y, 260)) Sound.play('plant', 0.35);
  }
  statMax('fullestPen', Math.max(0, ...game.corrals.map(c => c.owned ? corralPop(c) : 0)));
}

/* ---------------- breeding: two delighted neighbours in a pen share an egg ---------------- */
function bondPair(c) {
  const pen = game.slimes.filter(s => penOf(s) === c && isDelighted(s) && s.fly <= 0 && !isBaby(s) && !SLIMES[s.type].hybrid && !SLIMES[s.type].event);
  for (let i = 0; i < pen.length; i++) for (let j = i + 1; j < pen.length; j++) {
    const a = pen[i], b = pen[j];
    if (a.type !== b.type && hybridFor(a.type, b.type) && dist(a.x, a.y, b.x, b.y) < BREED_RANGE) return [a, b];
  }
  if (game.slimes.length >= MAX_SLIMES) return null;                                // same-kind families: two happy slimes of one kind share an egg
  for (let i = 0; i < pen.length; i++) for (let j = i + 1; j < pen.length; j++) {
    const a = pen[i], b = pen[j];
    if (a.type === b.type && dist(a.x, a.y, b.x, b.y) < BREED_RANGE) return [a, b];
  }
  return null;
}
function updateBreeding(dt) {
  for (const c of game.corrals) {
    if (!c.owned) continue;
    if (c.eggCd > 0) { c.eggCd -= dt; continue; }
    if (game.eggs.some(e => e.corral === c.id)) continue;
    const pair = bondPair(c);
    if (!pair) { c.bond = null; continue; }
    const key = pair.map(s => s.type).sort().join('+');
    if (!c.bond || c.bond.key !== key) c.bond = { key, t: 0 };
    c.bond.t += dt;
    if (Math.random() < dt * 1.2) spawnHeart((pair[0].x + pair[1].x) / 2, Math.min(pair[0].y, pair[1].y) - 22);
    if (c.bond.t >= BREED_TIME) {
      const same = pair[0].type === pair[1].type, h = same ? null : hybridFor(pair[0].type, pair[1].type);
      game.eggs.push({ id: Math.random().toString(36).slice(2, 7), corral: c.id, type: same ? pair[0].type : h.id, same, gene: same ? lifeGene(pair[0], pair[1]) : null, x: (pair[0].x + pair[1].x) / 2, y: Math.max(pair[0].y, pair[1].y) + 4, t: 0 });
      pair.forEach(s => { s.joy = Math.max(0, s.joy - 35); });
      c.bond = null; c.eggCd = EGG_COOLDOWN; stat('eggs');
      showToast('🥚', 'An egg appeared!', same ? `${pair[0].name} and ${pair[1].name} are very happy together.` : `${SLIMES[pair[0].type].name} and ${SLIMES[pair[1].type].name} are very happy together.`);
      Sound.play('collect', 0.7); spawnParticles(game.eggs[game.eggs.length - 1].x, game.eggs[game.eggs.length - 1].y - 8, 10, '#ffd9ea', { spread: 40, up: 50, life: 0.9 });
    }
  }
  for (let i = game.eggs.length - 1; i >= 0; i--) {
    const e = game.eggs[i], c = game.corrals[e.corral];
    e.t = Math.min(EGG_HATCH, e.t + dt);
    if (e.t < EGG_HATCH) continue;
    if (c && c.owned && corralPop(c) >= corralCap(c)) continue;                // a full pen keeps the egg until there is room
    const sl = createSlime(e.type, e.x, e.y); sl.home = { x: e.x, y: e.y }; sl.joy = 40; game.slimes.push(sl);
    if (e.same && e.gene) { lifeInit(sl, Object.assign({}, e.gene, { stage: 'baby', born: game.day })); stat('babies'); if (sl.shiny) { sl.noted = true; stat('shinies'); } }
    else stat('hybridsHatched');
    game.eggs.splice(i, 1); discoverSlime(e.type, 'seen');
    showToast('🐣', e.same ? `A baby ${SLIMES[e.type].name}${sl.shiny ? ' — and it is SHINY ✨' : ''}!` : `${SLIMES[e.type].name} hatched!`, e.same ? `${sl.name} is ${TRAITS[sl.trait].icon} ${TRAITS[sl.trait].name}. It will grow up in about ${Math.round(BABY_TIME / 60)} minutes.` : SLIMES[e.type].blurb, true);
    Sound.play('bigpop', 0.6); spawnParticles(e.x, e.y - 10, 18, SLIMES[e.type].color, { spread: 70, up: 70, life: 1 });
  }
}

/* ---------------- garden ---------------- */
function createPlots() {
  game.plots = plotSpots.map(p => ({ tx: p.x, ty: p.y, x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2, crop: null, t: 0, wet: false }));
}
function plotStage(p) {
  if (!p.crop) return 0;
  const f = p.t / CROPS[p.crop].time;
  return f >= 1 ? 3 : f > 0.55 ? 2 : 1;
}
function updatePlots(dt) {
  const rain = game.weather.raining && game.weather.kind !== 'snow' ? GROW_RAIN_MULT : 1;
  for (const p of game.plots) {
    if (!p.crop) continue;
    if ((game.weather.raining && game.weather.kind !== 'snow' && game.weather.intensity > 0.3) || game.gear.sprinkler) p.wet = true;
    const before = plotStage(p);
    if (p.t < CROPS[p.crop].time) p.t += dt * rain * (p.wet ? GROW_WET_MULT : 1) * (game.powers.pollen ? 1.3 : 1) * seasonCropMult(p.crop);
    if (before < 3 && plotStage(p) === 3) {
      spawnParticles(p.x, p.y - 10, 8, '#fff2a8', { spread: 30, up: 40, life: 1 });
      showAlert(`🌱 ${FOODS[p.crop].name} is ready to harvest!`, 1800); Sound.play('collect', 0.6);
    }
  }
}
function plantCrop(p, crop) {
  const cost = CROPS[crop].seed;
  if (p.crop || game.money < cost) { Sound.play('error', 0.6); return false; }
  game.money -= cost; p.crop = crop; p.t = 0; p.wet = game.weather.raining;
  Sound.play('plant'); stat('planted');
  spawnParticles(p.x, p.y, 8, '#8d6e4a', { spread: 28, up: 30, life: 0.7 });
  return true;
}
function waterPlot(p) {
  p.wet = true; Sound.play('water'); stat('watered'); questProgress('water', null, 1);
  spawnParticles(p.x, p.y - 8, 12, '#7fc8ff', { spread: 34, up: 50, life: 0.8 });
}
function harvestPlot(p) {
  const crop = p.crop, n = 3 + (p.wet ? 1 : 0) + game.upgrades.gloves + (game.powers.pollen ? 1 : 0) + (eventOn() === 'harvest' ? 2 : 0);
  p.crop = null; p.t = 0; p.wet = false;
  for (let i = 0; i < n; i++) {
    game.foods.push({ type: crop, x: p.x + rand(-6, 6), y: p.y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-10, 40), z: 6, vz: rand(70, 110), age: 0 });
  }
  stat('harvests', n); questProgress('harvest', null, n); discoverFood(crop);
  Sound.play('collect'); spawnParticles(p.x, p.y - 10, 10, FOODS[crop].color, { spread: 40, up: 60, life: 0.8 });
}

/* ---------------- ranch decorations ---------------- */
function canPlaceDecor(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (isBlocking(tx, ty)) return false;
  const t = world[tx][ty];
  if (t === T.CAVE || t === T.DIRT) return false;
  if (game.plots.some(p => p.tx === tx && p.ty === ty)) return false;
  const shop = features.find(f => f.type === 'shop');
  if (tx >= shop.x - 1 && tx <= shop.x + shop.w && ty >= shop.y - 1 && ty <= shop.y + shop.h) return false;
  return !game.decor.some(d => Math.floor(d.x / TILE) === tx && Math.floor(d.y / TILE) === ty);
}
function placeDecor(type) {
  const def = DECOR_ITEMS[type], p = game.player;
  if (game.decor.length >= MAX_DECOR) { showAlert(`Your ranch is full (${MAX_DECOR} decorations)`); Sound.play('error', 0.6); return false; }
  if (!(game.stock[type] > 0)) return false;
  // put it one step in front of the player, snapped to the tile grid
  const fx = p.x + Math.cos(p.aim) * 30, fy = p.y + Math.sin(p.aim) * 30;
  const spots = [[fx, fy], [p.x, p.y + 30], [p.x + 30, p.y], [p.x - 30, p.y], [p.x, p.y - 30]];
  for (const [sx, sy] of spots) {
    const x = Math.floor(sx / TILE) * TILE + TILE / 2, y = Math.floor(sy / TILE) * TILE + TILE / 2;
    if (!canPlaceDecor(x, y)) continue;
    game.stock[type]--;
    game.decor.push({ type, x, y });
    stat('decorPlaced'); statMax('maxCharm', charm());
    Sound.play('upgrade', 0.7); spawnParticles(x, y - 10, 10, '#ffe27a', { spread: 36, up: 50, life: 0.9 });
    showAlert(`${def.name} placed · charm ${charm()}`);
    return true;
  }
  showAlert('No room here — step to an empty spot'); Sound.play('error', 0.6);
  return false;
}
function pickupDecor(d) {
  const def = DECOR_ITEMS[d.type];
  game.decor.splice(game.decor.indexOf(d), 1);
  game.stock[d.type] = (game.stock[d.type] || 0) + 1;
  showAlert(`Picked up ${def.name} — back in your decor stock`); Sound.play('click');
}

/* ---------------- glimmering dig spots ---------------- */
const SPOT_COUNT = 22;
function generateSpots() {
  game.spots = game.spots ? game.spots.filter(sp => sp.tide || sp.aurora) : [];
  for (let tries = 0; tries < 2000 && game.spots.filter(sp => !sp.tide && !sp.aurora).length < SPOT_COUNT; tries++) {
    const tx = randi(3, WORLD_W - 3), ty = randi(3, WORLD_H - 3), t = world[tx][ty];
    if (t !== T.GRASS && t !== T.SAND && t !== T.ORCHARD && t !== T.MOSS && t !== T.SNOW) continue;
    if (tx >= 8 && tx <= 44 && ty >= 26 && ty <= 54) continue;        // keep the ranch, yard, garden and shop tidy
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    if (game.player && dist(x, y, game.player.x, game.player.y) < 300) continue;
    if (game.spots.some(s => dist(s.x, s.y, x, y) < 200)) continue;
    game.spots.push({ x, y });
  }
  for (const key in AREAS) {                                              // every area always has at least one spot to find
    if (game.spots.some(sp => !sp.tide && !sp.aurora && areaAt(Math.floor(sp.x / TILE), Math.floor(sp.y / TILE)) === key)) continue;
    const A = AREAS[key];
    for (let tries = 0; tries < 300; tries++) {
      const tx = randi(A.x + 2, A.x + A.w - 2), ty = randi(A.y + 2, A.y + A.h - 2), t = world[tx][ty];
      if (t !== T.GRASS && t !== T.SAND && t !== T.MOSS && t !== T.SNOW) continue;
      const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
      if (game.player && dist(x, y, game.player.x, game.player.y) < 300) continue;
      game.spots.push({ x, y }); break;
    }
  }
}
function digSpot(sp) {
  game.spots.splice(game.spots.indexOf(sp), 1);
  stat('digs'); questProgress('dig', null, 1);
  Sound.play('dig'); spawnParticles(sp.x, sp.y, 12, '#a07a4a', { spread: 40, up: 50, life: 0.8 });
  const r = Math.min(0.999, Math.random() + game.upgrades.shovel * 0.05 + (game.powers.prismluck ? 0.08 : 0));        // Lucky Shovel nudges the roll toward the good stuff
  const dbl = Math.random() < game.upgrades.shovel * 0.1 ? 2 : 1;
  const pop = (kind, type, n = 1) => {
    n *= dbl;
    for (let i = 0; i < n; i++) {
      const it = { type, x: sp.x + rand(-6, 6), y: sp.y + rand(-4, 4), vx: rand(-45, 45), vy: rand(-20, 40), z: 6, vz: rand(80, 120), age: 0 };
      (kind === 'treasure' ? game.treasures : game.foods).push(it);
    }
  };
  const table = digTableFor(sp);
  if (table === 'aurora') { const pick = AURORA_LOOT[randi(0, AURORA_LOOT.length)]; pop('treasure', pick); if (Math.random() < 0.5) pop('treasure', 'auroradust'); showAlert(`✨ ${TREASURES[pick].name}!`); }
  else if (table === 'peak' && r > 0.4) {
    if (r < 0.7) { const f = Math.random() < 0.5 ? 'frostberry' : 'pinenut'; pop('food', f, 2); showAlert(`❄️ Dug up some ${FOODS[f].name}!`); }
    else { const pick = r > 0.93 ? 'emberstone' : 'icicle'; pop('treasure', pick); showAlert(`✨ ${TREASURES[pick].name}!`); }
  } else if (table === 'tide' || (table === 'beach' && r > 0.45)) {                    // beach loot: sea glass, sand dollars and the odd bottle
    const pick = r > 0.93 ? 'driftbottle' : r > 0.7 ? 'sanddollar' : 'seaglass';
    pop('treasure', pick); if (table === 'tide' && Math.random() < 0.5) pop('treasure', BEACH_LOOT[randi(0, BEACH_LOOT.length)]);
    showAlert(`✨ ${TREASURES[pick].name}!`);
  } else if (table === 'grove' && r > 0.3 && r < 0.75) { pop('food', 'truffle', 2); showAlert('🍄 Dug up some Truffles!'); }
  else if (r < 0.40) { const c = randi(15, 46); game.money += c; stat('moneyEarned', c); showAlert(`🪙 Found $${c}!`); spawnParticles(sp.x, sp.y - 10, 10, '#ffd700', { spread: 40, up: 70, life: 1 }); }
  else if (r < 0.65) { const ids = Object.keys(FOODS).filter(k => !FOODS[k].treat), f = ids[randi(0, ids.length)]; pop('food', f, 2); showAlert(`Dug up some ${FOODS[f].name}!`); }
  else if (r < 0.80) { pop('treasure', 'pearl'); showAlert('✨ A Moon Pearl!'); }
  else if (r < 0.92) { pop('treasure', 'amber'); showAlert('✨ Sunset Amber!'); }
  else { pop('treasure', 'relic'); showAlert('🏺 An Old Coin!'); }
}

/* ---------------- weather ---------------- */
function newWeather() { return { kind: 'rain', raining: false, left: 0, dur: 0, next: rand(90, 200), intensity: 0, rainbow: 0 }; }
function updateWeather(dt) {
  const w = game.weather;
  if (w.raining) {
    w.left -= dt;
    if (w.left <= 0) {
      w.raining = false; w.next = rand(150, 320); if (w.kind === 'rain') maybeWashBottle(); maybeSnowGift();
      if (w.kind === 'rain' && w.dur > 35 && nightAmount(game.time) < 0.5) { w.rainbow = 45; stat('rainbows'); showToast('🌈', 'A rainbow!', 'Look up at the sky'); }
    }
  } else {
    w.next -= dt;
    if (w.next <= 0) {
      w.raining = true; w.dur = w.left = rand(45, 95); w.kind = seasonOf() === 3 ? 'snow' : (game.surv && Math.random() < 0.3 ? 'storm' : 'rain');
      if (w.kind === 'snow') { stat('snows'); showAlert('❄️ Soft snow begins to fall…', 2200); } else if (w.kind === 'storm') { stat('storms'); showToast('⛈️', 'Thunderstorm!', 'Watch for red rings on the ground — step out of them.', true); } else { stat('rains'); showAlert('🌧️ A soft rain begins…', 2200); }
    }
  }
  w.intensity += ((w.raining ? 1 : 0) - w.intensity) * Math.min(1, dt * 0.8);
  if (w.rainbow > 0) w.rainbow -= dt;
  const wet = w.kind !== 'snow';
  Sound.setLoop('rain', wet && w.intensity > 0.04, 0.5);
  Sound.setLoopVol('rain', wet ? 0.5 * w.intensity : 0);
}

/* ---------------- sky: shooting stars at night ---------------- */
function newSky() { return { timer: rand(25, 70), fall: null }; }
function updateSky(dt) {
  const sky = game.sky, n = nightAmount(game.time);
  if (n > 0.85) {
    sky.timer -= dt;
    if (sky.timer <= 0 && !sky.fall) { startShootingStar(); sky.timer = rand(55, 130) * (game.gear.charm ? 0.5 : 1) * (eventOn() === 'star' ? 0.3 : 1); }
  } else if (n < 0.3 && sky.timer < 20) sky.timer = rand(25, 70);
  if (sky.fall) { sky.fall.t += dt; if (sky.fall.t >= sky.fall.dur) { landStar(sky.fall); sky.fall = null; } }
  if (n < 0.12) {          // visitors from the sky wander off at dawn
    for (let i = game.slimes.length - 1; i >= 0; i--) {
      const s = game.slimes[i];
      if (s.def.event) { spawnParticles(s.x, s.y - 8, 14, '#ffd54a', { spread: 50, up: 60, life: 1 }); game.slimes.splice(i, 1); showAlert('The star slime drifted away with the dawn…', 2600); }
    }
  }
}
function startShootingStar() {
  const p = game.player;
  for (let i = 0; i < 25; i++) {
    const a = rand(0, Math.PI * 2), d = rand(150, 280), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (blockedAt(x, y, 8) || world[Math.floor(x / TILE)][Math.floor(y / TILE)] === T.WATER) continue;
    game.sky.fall = { tx: x, ty: y, t: 0, dur: 1.4 };
    Sound.play('star', 0.8); showAlert('🌠 A shooting star!', 1800);
    return;
  }
}
function landStar(f) {
  game.treasures.push({ type: 'starshard', x: f.tx, y: f.ty, vx: 0, vy: 0, z: 30, vz: 40, age: 0 });
  spawnParticles(f.tx, f.ty - 6, 18, '#ffe27a', { spread: 70, up: 80, life: 1.2 });
  showAlert('✨ Something sparkly landed nearby!', 2600);
  if ((eventOn() === 'star' || Math.random() < (game.gear.charm ? 0.7 : 0.4)) && !game.slimes.some(s => s.type === 'star')) {
    const spot = findFreeSpot(f.tx + rand(-40, 40), f.ty + rand(-40, 40));
    const s = createSlime('star', spot.x, spot.y); s.fly = s.flyMax = 0.6; s.fvx = rand(-60, 60); s.fvy = rand(-60, 60);
    game.slimes.push(s);
  }
}

/* ---------------- context interaction button ---------------- */
function findInteract() {
  if (game.visitor) return netFindInteract();
  const p = game.player; let best = null, bd = 1e9;
  const consider = (kind, obj, x, y, r, icon, label, bias = 0) => {
    const d = dist(p.x, p.y, x, y);
    if (d < r && d + bias < bd) { bd = d + bias; best = { kind, obj, icon, label, x, y }; }
  };
  for (const s of game.slimes) if (s.fly <= 0) consider('pet', s, s.x, s.y, 34, '🤚', 'Pet ' + s.name);
  for (const sp of game.spots) consider('dig', sp, sp.x, sp.y, 36, '⛏️', 'Dig');
  for (const pl of game.plots) {
    if (!pl.crop) consider('plant', pl, pl.x, pl.y, 38, '🌱', 'Plant');
    else if (plotStage(pl) === 3) consider('harvest', pl, pl.x, pl.y, 38, '🧺', 'Harvest');
    else if (!pl.wet) consider('water', pl, pl.x, pl.y, 38, '💧', 'Water');
  }
  for (const d of game.decor) consider('pickup', d, d.x, d.y, 26, '📦', 'Pick up', 22);
  for (const ch of game.chests) if (!ch.open && tideChestVisible(ch)) consider('chest', ch, ch.x, ch.y, 40, '🧰', 'Open chest');
  if (game.surv) {
    for (const n of game.nodes) if (n.cd <= 0) consider('gather', n, n.x, n.y, 34, '✋', n.type === 'branches' ? 'Gather wood' : 'Gather fibre');
    const rock = nearBoulder(); if (rock) consider('break', rock, rock.x, rock.y, 74, '⛏️', 'Break rock');
    const wat = nearFreshWater(); if (wat) consider('drink', wat, wat.x, wat.y, 66, '💧', 'Drink');
  }
  if (wrenVisible()) { const w = wrenNpc(); consider('wren', w, w.x * TILE + TILE / 2, w.y * TILE + TILE / 2, 54, '💬', storyFor('wren') ? '★ Story · Wren' : 'Talk to Wren'); }
  for (const n of NPCS) { const st = npcState(n.id); consider('npc', n, n.x * TILE + TILE / 2, n.y * TILE + TILE / 2, 54, '💬', st && st.status === 'active' && npcReady(st) ? 'Hand in' : (storyFor(n.id) ? '★ Story · ' : 'Talk to ') + n.name.split(' ').pop(), storyFor(n.id) ? 12 : 6); }
  for (const c of game.corrals) { const sg = corralSign(c); consider('corral', c, sg.x, sg.y + 14, 48, '🐾', c.owned ? 'Manage corral' : `Corral · $${c.price}`, 10); }
  if (game.nearShop) { const sh = features.find(f => f.type === 'shop'); consider('shop', null, (sh.x + sh.w / 2) * TILE, (sh.y + sh.h / 2) * TILE, TILE * 2.7, '🏪', 'Shop', 60); }
  if (!best && Object.values(game.stock).some(n => n > 0)) best = { kind: 'decorate', obj: null, icon: '🪴', label: 'Place decor' };
  game.interact = best;
}
function doInteract() {
  if (game.state !== 'playing') return;
  if (game.visitor) { netInteract(); return; }
  if (game.shopOpen) { closeShop(); return; }
  const it = game.interact;
  if (!it) { showAlert('Nothing to do here — walk up to a slime, a plot or the shop', 1800); Sound.play('error', 0.4); return; }
  switch (it.kind) {
    case 'shop':    openShop(); break;
    case 'pet':     petSlime(it.obj); break;
    case 'dig':     digSpot(it.obj); break;
    case 'plant':   openPlantMenu(it.obj); break;
    case 'water':   waterPlot(it.obj); break;
    case 'harvest': harvestPlot(it.obj); break;
    case 'pickup':  pickupDecor(it.obj); break;
    case 'decorate': openScreen('decorate'); break;
    case 'corral':  openScreen('corral', { id: it.obj.id }); break;
    case 'chest':   openChest(it.obj); break;
    case 'npc':     openScreen('npc', { id: it.obj.id }); break;
    case 'wren':    stat('wrenTalks'); openScreen('wren', {}); break;
    case 'gather':  gatherNode(it.obj); break;
    case 'break':   breakRock(it.obj.tx, it.obj.ty); break;
    case 'drink':   drink(); break;
  }
}

/* ---------------- jumbo slimes ---------------- */
const jumboSize = j => 1 + 0.55 * Math.min(1, j.fed / j.goal);
const jumboCfg = id => JUMBOS.find(c => c.id === id);
function newJumbo(cfg) {
  return { id: cfg.id, type: cfg.id, x: cfg.x * TILE + TILE / 2, y: cfg.y * TILE + TILE / 2, goal: randi(JUMBO_GOAL[0], JUMBO_GOAL[1] + 1), fed: 0, state: 'alive', timer: 0, wob: 0, pop: 0 };
}
function createJumbos() { game.jumbos = JUMBOS.map(newJumbo); }
function popItem(list, type, x, y) {
  list.push({ type, x: x + rand(-8, 8), y: y + rand(-4, 8), vx: rand(-70, 70), vy: rand(-30, 60), z: 20, vz: rand(110, 190), age: 0 });
}
function updateJumbos(dt) {
  for (const j of game.jumbos) {
    j.wob = Math.max(0, j.wob - dt);
    if (j.state === 'alive') {
      const r = 46 * jumboSize(j), diet = SLIMES[j.type].food;
      for (let i = game.foods.length - 1; i >= 0; i--) {
        const f = game.foods[i];
        if (!f.thrown || f.z > 34 || !diet.includes(f.type) || dist(f.x, f.y, j.x, j.y) > r) continue;       // only food you throw counts — wild patches can't feed it
        game.foods.splice(i, 1); j.fed++; j.wob = 0.7; stat('jumboFed');
        spawnParticles(j.x + rand(-10, 10), j.y - 30 * jumboSize(j), 6, FOODS[f.type].color, { spread: 40, up: 60, life: 0.7 });
        spawnHeart(j.x + rand(-16, 16), j.y - 50 * jumboSize(j));
        if (nearPlayer(j.x, j.y, 400)) Sound.play('eat', 0.9, 0.7 + rand(0, 0.2));
        if (j.fed >= j.goal) { j.state = 'popping'; j.pop = 1.6; showAlert('🫧 The Jumbo is wobbling… it is about to burst!', 2600); break; }
      }
    } else if (j.state === 'popping') {
      j.pop -= dt; j.wob = 0.3;
      if (j.pop <= 0) popJumbo(j);
    } else {
      j.timer -= dt;
      if (j.timer <= 0) {
        Object.assign(j, { state: 'alive', fed: 0, goal: randi(JUMBO_GOAL[0], JUMBO_GOAL[1] + 1), wob: 0.8 });
        spawnParticles(j.x, j.y - 20, 18, '#fff2a8', { spread: 60, up: 70, life: 1.1 });
        if (nearPlayer(j.x, j.y, 700)) showAlert(`✨ The Jumbo ${SLIMES[j.type].name} slime has grown back!`, 2400);
      }
    }
  }
}
function popJumbo(j) {
  const cfg = jumboCfg(j.id), def = SLIMES[j.type], size = jumboSize(j);
  const cy = j.y - 24 * size;
  for (const col of [def.color, '#ffd54a', '#ffffff', def.plort.color]) spawnParticles(j.x, cy, 14, col, { spread: 130, up: 150, life: 1.4 });
  ringFx(j.x, j.y, '#ffffff'); game.shake = 0.5;
  Sound.play('bigpop', 1);
  const extra = game.powers.prismluck ? 1 : 0;
  for (let i = 0; i < 1 + extra; i++) popItem(game.treasures, cfg.treasure, j.x, cy);
  const pool = ['pearl', 'amber', 'relic', 'starshard', 'tidegem', 'skystone'];
  for (let i = 0; i < 2 + extra + randi(0, 2); i++) popItem(game.treasures, pool[randi(0, pool.length)], j.x, cy);
  let money = randi(150, 401);
  if (game.powers[cfg.power]) { money += 150; showAlert(`💥 Jumbo ${def.name} popped! +$${money} (you already own its power)`, 3600); }
  else {
    game.powers[cfg.power] = true; stat('powersGained');
    showToast(POWERS[cfg.power].icon, 'Power gained: ' + POWERS[cfg.power].name, POWERS[cfg.power].desc, true);
    showAlert(`💥 Jumbo ${def.name} popped! +$${money}`, 3600);
  }
  game.money += money; stat('moneyEarned', money); stat('jumbosPopped'); questProgress('jumbo', null, 1); profile.codex.jumbos = profile.codex.jumbos || {}; profile.codex.jumbos[j.id] = true; profileDirty = true; achDirty = true;
  j.state = 'gone'; j.timer = rand(JUMBO_RESPAWN[0], JUMBO_RESPAWN[1]); j.fed = 0; j.pop = 0;
}

/* ---------------- jump toys: bounce mushrooms, sky orbs, chests ---------------- */
function createBouncers() { game.bouncers = BOUNCERS.map(b => ({ x: b.x * TILE + TILE / 2, y: b.y * TILE + TILE / 2, squash: 0, cool: 0 })); }
function createOrbs() {
  game.orbs = [];
  BOUNCERS.forEach(b => b.orbs.forEach(o => game.orbs.push({ x: b.x * TILE + TILE / 2 + o.dx, y: b.y * TILE + TILE / 2 + o.dy, h: o.h, taken: false })));
}
function createChests() {
  game.chests = CHESTS.map(c => ({ id: c.id, x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2, rich: c.rich, open: false }));
  TIDE_CHESTS.forEach((tx, i) => game.chests.push({ id: 't' + i, x: tx * TILE + TILE / 2, y: (seaLine(tx) + 1) * TILE + TILE / 2, rich: true, open: false, tide: true }));   // only while the tide is out
  AURORA_CHESTS.forEach(([tx, ty], i) => game.chests.push({ id: 'a' + i, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, rich: true, open: false, aurora: true }));         // only on Aurora Night
}
function openChest(ch) {
  ch.open = true; stat('chests'); questProgress('chest', null, 1);
  Sound.play('chest'); spawnParticles(ch.x, ch.y - 12, 16, '#ffd54a', { spread: 60, up: 90, life: 1.0 });
  if (ch.tide) { stat('tideChests'); openBeachChest(ch); return; }
  if (ch.aurora) { stat('auroraChests'); openAuroraChest(ch); return; }
  const lucky = game.powers.prismluck ? 1.35 : 1;
  const coins = Math.round((ch.rich ? randi(160, 301) : randi(60, 141)) * lucky); game.money += coins; stat('moneyEarned', coins);
  const drops = ch.rich ? ['tidegem', 'tidegem', Math.random() < 0.5 ? 'relic' : 'starshard'] : [Math.random() < 0.65 ? 'tidegem' : 'pearl'];
  if (game.powers.prismluck) drops.push('tidegem');
  drops.forEach(t => popItem(game.treasures, t, ch.x, ch.y - 10));
  showAlert(`🧰 +$${coins} and treasure!`, 2400);
}
function updateJumpToys(dt) {
  const p = game.player;
  for (const b of game.bouncers) {
    b.squash = Math.max(0, b.squash - dt * 3.5); b.cool -= dt;
    if (b.cool <= 0 && p.z < 16 && p.vz <= 0 && dist(p.x, p.y, b.x, b.y) < 22) {
      p.vz = BOUNCE_V; p.djUsed = false; b.squash = 1; b.cool = 0.35; stat('bounces'); npcCounter('bounce', 1);
      Sound.play('boing', 0.9, rand(0.95, 1.1)); ringFx(b.x, b.y, '#f58ae8');
      spawnParticles(b.x, b.y - 10, 8, '#ffd9f8', { spread: 40, up: 60, life: 0.6 });
    }
  }
  for (const o of game.orbs) {
    if (o.taken || dist(p.x, p.y, o.x, o.y) > 28 || Math.abs(p.z + 12 - o.h) > 30) continue;
    o.taken = true; stat('skyOrbs'); questProgress('skyorb', null, 1);
    const coins = randi(25, 61); game.money += coins; stat('moneyEarned', coins);
    if (Math.random() < 0.4) popItem(game.treasures, 'skystone', o.x, o.y);
    Sound.play('star', 0.8); showAlert(`☁️ Sky orb! +$${coins}`, 1400);
    spawnParticles(o.x, o.y - o.h, 14, '#fff2a8', { spread: 50, up: 60, life: 0.9, g: 30 });
  }
  for (const j of game.jumbos) {                                // jumbos and neighbours are solid
    if (j.state === 'gone') continue;
    const r = 34 * jumboSize(j), d = dist(p.x, p.y, j.x, j.y);
    if (d < r && p.z < 40) { const a = Math.atan2(p.y - j.y, p.x - j.x); p.x = j.x + Math.cos(a) * r; p.y = j.y + Math.sin(a) * r; }
  }
  for (const n of NPCS) { const d = dist(p.x, p.y, n.x * TILE + TILE / 2, n.y * TILE + TILE / 2); if (d < 14 && p.z < 30) { const a = Math.atan2(p.y - (n.y * TILE + TILE / 2), p.x - (n.x * TILE + TILE / 2)); p.x = n.x * TILE + TILE / 2 + Math.cos(a) * 14; p.y = n.y * TILE + TILE / 2 + Math.sin(a) * 14; } }
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
  updateNpcs(dt);
}
function seasonDayStart() {                      // called at every dawn
  const s = season(), d = dayInSeason();
  if (d === 1 && game.day > 1) showToast(s.icon, s.name + ' has arrived', s.blurb + ` ${FOODS[s.crop].name} grows best now.`, true);
  const ev = eventOn();
  if (ev === 'harvest') {
    stat('festivals'); showToast('🎪', 'Harvest Festival!', 'Every crop is ripe and harvests give +2 food today.', true);
    for (const p of game.plots) if (p.crop) p.t = CROPS[p.crop].time;
  } else if (ev === 'star') { stat('starNights'); showToast('🌠', 'Star Night tonight', 'Shooting stars will keep falling — and a Star slime is sure to visit.', true); }
}
function newDayReset() {
  generateSpots(); seasonDayStart(); marketToasts(); syncTide(); syncAurora(); storyNewDay(); boardNewDay(); game.orbs.forEach(o => { o.taken = false; }); game.chests.forEach(c => { c.open = false; });
}

/* ---------------- NPCs with special quests ---------------- */
const npcDef = id => id === 'wren' ? WREN : NPCS.find(n => n.id === id);
const npcState = id => game.npcs.find(n => n.id === id);
function createNpcs() { game.npcs = NPCS.map(n => ({ id: n.id, status: 'idle', qi: randi(0, n.quests.length), last: -1, progress: 0, cool: 0, done: 0 })); }
const npcQuest = st => npcDef(st.id).quests[st.qi];
function npcValue(st) {                      // [current, goal] for display
  const q = npcQuest(st);
  switch (q.kind) {
    case 'give': return [Math.min(packCount(q.what, q.key), q.amount), q.amount];
    case 'delighted': return [Math.min(game.slimes.filter(isDelighted).length, q.amount), q.amount];
    case 'charm': return [Math.min(charm(), q.amount), q.amount];
    case 'pen': return [Math.min(Math.max(0, ...game.corrals.map(c => c.owned ? corralPop(c) : 0)), q.amount), q.amount];
    default: return [Math.min(st.progress, q.amount), q.amount];
  }
}
function npcReady(st) { if (st.status !== 'active') return false; const [c, g] = npcValue(st); return c >= g; }
function npcAccept(st) { if (st.status === 'idle') { st.status = 'active'; st.progress = 0; Sound.play('click', 0.6); } }
function giveTreasure(type, n) {
  const p = game.player;
  for (let i = 0; i < n; i++) { if (packCanAdd('treasure', type, 1)) packAdd('treasure', type, 1); else popItem(game.treasures, type, p.x, p.y); }
}
function npcHandIn(st) {
  if (!npcReady(st)) { Sound.play('error', 0.5); return false; }
  const q = npcQuest(st), def = npcDef(st.id);
  if (q.kind === 'give') packRemoveN(q.what, q.key, q.amount);
  game.money += q.reward.money; stat('moneyEarned', q.reward.money);
  if (q.reward.treasure) giveTreasure(q.reward.treasure[0], q.reward.treasure[1]);
  st.status = 'cooldown'; st.cool = NPC_COOLDOWN; st.last = st.qi; st.progress = 0; st.done++;
  stat('npcQuests'); Sound.play('quest'); Sound.play('achieve', 0.5);
  showToast('💬', `${def.name} says thanks!`, `+$${q.reward.money}${q.reward.treasure ? ' and ' + TREASURES[q.reward.treasure[0]].name + (q.reward.treasure[1] > 1 ? ' ×' + q.reward.treasure[1] : '') : ''}`, true);
  return true;
}
function updateNpcs(dt) {
  for (const st of game.npcs) {
    if (st.status !== 'cooldown') continue;
    st.cool -= dt;
    if (st.cool <= 0) {
      const n = npcDef(st.id).quests.length; let qi = randi(0, n); if (n > 1 && qi === st.last) qi = (qi + 1) % n;
      st.qi = qi; st.status = 'idle'; st.progress = 0;
      if (nearPlayer(npcDef(st.id).x * TILE, npcDef(st.id).y * TILE, 600)) showAlert(`💬 ${npcDef(st.id).name} has a new request for you`, 2400);
    }
  }
}
function npcCounter(kind, n) {
  storyCounter(kind, n);
  for (const st of game.npcs) { if (st.status !== 'active') continue; const q = npcQuest(st); if (q.kind === kind) st.progress = Math.min(q.amount, st.progress + n); }
}

/* ---------------- challenge board: 3 daily + 2 weekly challenges, a streak, and star tokens to spend ---------------- */
const CHALLENGE_TEMPLATES = {
  daily: [
    { stat: 'pets', icon: '🤚', text: n => `Pet slimes ${n} times`, min: 6, max: 12 },
    { stat: 'digs', icon: '⛏️', text: n => `Dig up ${n} glimmering spots`, min: 2, max: 4 },
    { stat: 'harvests', icon: '🥕', text: n => `Harvest ${n} crops`, min: 4, max: 10 },
    { stat: 'watered', icon: '💧', text: n => `Water plants ${n} times`, min: 4, max: 8 },
    { stat: 'glimmersCollected', icon: '💎', text: n => `Collect ${n} glimmers`, min: 8, max: 20 },
    { stat: 'moneyEarned', icon: '💰', text: n => `Earn $${n}`, min: 150, max: 400, round: 25 },
    { stat: 'jumps', icon: '🦘', text: n => `Jump ${n} times`, min: 20, max: 50, round: 5 },
    { stat: 'skyOrbs', icon: '☁️', text: n => `Catch ${n} sky orb${n > 1 ? 's' : ''}`, min: 1, max: 2 },
    { stat: 'favFed', icon: '❤️', text: n => `Feed favourite food ${n} times`, min: 3, max: 6 },
    { stat: 'slimesCaught', icon: '🌀', text: n => `Catch ${n} slimes`, min: 2, max: 4 },
    { stat: 'planted', icon: '🌱', text: n => `Plant ${n} seeds`, min: 3, max: 6 },
    { stat: 'treatsGiven', icon: '🍬', text: n => `Give slimes ${n} treat${n > 1 ? 's' : ''}`, min: 1, max: 3 },
    { stat: 'bounces', icon: '🍄', text: n => `Bounce on mushrooms ${n} times`, min: 4, max: 8 }
  ],
  weekly: [
    { stat: 'glimmersCollected', icon: '💎', text: n => `Collect ${n} glimmers this week`, min: 60, max: 120, round: 5 },
    { stat: 'moneyEarned', icon: '💰', text: n => `Earn $${n} this week`, min: 1500, max: 3000, round: 100 },
    { stat: 'harvests', icon: '🥕', text: n => `Harvest ${n} crops this week`, min: 20, max: 35 },
    { stat: 'pets', icon: '🤚', text: n => `Pet slimes ${n} times this week`, min: 40, max: 60, round: 5 },
    { stat: 'digs', icon: '⛏️', text: n => `Dig up ${n} spots this week`, min: 10, max: 16 },
    { stat: 'jumps', icon: '🦘', text: n => `Jump ${n} times this week`, min: 150, max: 300, round: 10 },
    { stat: 'skyOrbs', icon: '☁️', text: n => `Catch ${n} sky orbs this week`, min: 5, max: 9 },
    { stat: 'eggs', icon: '🥚', text: n => `Find ${n} slime egg${n > 1 ? 's' : ''} this week`, min: 1, max: 2 },
    { stat: 'favFed', icon: '❤️', text: n => `Feed favourites ${n} times this week`, min: 15, max: 25 },
    { stat: 'slimesCaught', icon: '🌀', text: n => `Catch ${n} slimes this week`, min: 6, max: 10 }
  ]
};
const REDEEM = [
  { id: 'treats', icon: '🍬', name: 'Slime Treats ×5', cost: 2, give: () => { for (let i = 0; i < 5; i++) { if (packCanAdd('food', 'treat', 1)) packAdd('food', 'treat', 1); else popItem(game.foods, 'treat', game.player.x, game.player.y); } } },
  { id: 'star', icon: '⭐', name: 'Star Shard', cost: 4, give: () => giveTreasure('starshard', 1) },
  { id: 'crate', icon: '🎁', name: 'Mystery Crate — 3 rare treasures + $200', cost: 8, give: () => { const pool = JUMBOS.map(j => j.treasure); for (let i = 0; i < 3; i++) giveTreasure(pool[randi(0, pool.length)], 1); game.money += 200; stat('moneyEarned', 200); } }
];
function newChallenge(tpl, weekly) {
  let amount = randi(tpl.min, tpl.max + 1); if (tpl.round) amount = Math.max(tpl.min, Math.round(amount / tpl.round) * tpl.round);
  return { stat: tpl.stat, icon: tpl.icon, text: tpl.text(amount), amount, start: getStat(tpl.stat), reward: { money: weekly ? randi(400, 901) : randi(60, 141), tokens: weekly ? 3 : 1 }, claimed: false, notified: false };
}
function pickTemplates(list, n) { const pool = list.slice(), out = []; while (out.length < n) out.push(pool.splice(randi(0, pool.length), 1)[0]); return out; }
function generateBoard(daily = true, weekly = true) {
  const b = game.board || (game.board = { tokens: 0, streak: 0, streakDay: 0, allBonus: false, day: 0, week: -1, daily: [], weekly: [] });
  if (daily) { b.daily = pickTemplates(CHALLENGE_TEMPLATES.daily, 3).map(t => newChallenge(t, false)); b.allBonus = false; }
  if (weekly) b.weekly = pickTemplates(CHALLENGE_TEMPLATES.weekly, 2).map(t => newChallenge(t, true));
  b.day = game.day; b.week = Math.floor((game.day - 1) / 7);
}
function boardNewDay() {
  const b = game.board; if (!b) return generateBoard();
  if (b.streakDay < game.day - 1) b.streak = 0;                                    // a missed day breaks the streak
  generateBoard(true, Math.floor((game.day - 1) / 7) !== b.week);
}
const effStreak = () => (game.board && game.board.streakDay >= game.day - 1) ? game.board.streak : 0;
function chProgress(c) { const cur = getStat(c.stat); if (cur < c.start) c.start = cur; return Math.min(c.amount, cur - c.start); }
const chReady = c => !c.claimed && chProgress(c) >= c.amount;
const boardClaimable = () => game.board ? [...game.board.daily, ...game.board.weekly].filter(chReady).length : 0;
function claimChallenge(c, weekly) {
  const b = game.board; if (!chReady(c)) { Sound.play('error', 0.5); return false; }
  const money = Math.round(c.reward.money * (weekly ? 1 : 1 + Math.min(0.5, effStreak() * 0.1)));
  game.money += money; stat('moneyEarned', money); b.tokens += c.reward.tokens; c.claimed = true; stat('challengesClaimed');
  let msg = `+$${money} and ${c.reward.tokens}⭐`;
  if (weekly) stat('weeklyClaimed');
  else {
    if (b.streakDay !== game.day) { b.streak = b.streakDay === game.day - 1 ? b.streak + 1 : 1; b.streakDay = game.day; statMax('bestStreak', b.streak); }
    if (!b.allBonus && b.daily.every(x => x.claimed)) { b.allBonus = true; b.tokens += 2; game.money += 50; stat('moneyEarned', 50); msg += ' · all three done: +2⭐ +$50!'; }
  }
  Sound.play('quest'); showToast('📋', 'Challenge reward', msg); return true;
}
function redeemToken(id) {
  const it = REDEEM.find(r => r.id === id), b = game.board;
  if (!it || b.tokens < it.cost) { Sound.play('error', 0.5); return false; }
  b.tokens -= it.cost; it.give(); stat('redeemed'); Sound.play('upgrade'); showAlert(`${it.icon} ${it.name}`, 2200); return true;
}
function boardCheck() {                                                           // once a second: tell the player when something is ready
  if (!game.board) return;
  for (const c of [...game.board.daily, ...game.board.weekly]) if (!c.notified && chReady(c)) { c.notified = true; showToast(c.icon, 'Challenge complete!', 'Claim it in ☰ → Challenges'); Sound.play('collect', 0.6); }
}

/* ---------------- once-a-second housekeeping ---------------- */
function currentPlaces() {
  const p = game.player, tx = p.x / TILE, ty = p.y / TILE, out = [];
  if (tx >= RANCH.x && tx <= RANCH.x + RANCH.w && ty >= RANCH.y && ty <= RANCH.y + RANCH.h) out.push('ranch');
  for (const f of features) {
    if (['orchard', 'cave', 'garden'].includes(f.type) && tx >= f.x - 1 && tx <= f.x + f.w + 1 && ty >= f.y - 1 && ty <= f.y + f.h + 1) out.push(f.type);
  }
  if (dist(tx, ty, 70, 18) < 13) out.push('pond');
  const ar = areaAt(Math.floor(tx), Math.floor(ty)); if (ar) out.push(ar);
  if (game.nearShop) out.push('shop');
  return out;
}
function featuresTick() {
  currentPlaces().forEach(discoverPlace);
  let d = 0; for (const s of game.slimes) if (isDelighted(s)) d++;
  statMax('maxDelighted', d); statMax('maxCharm', charm()); statMax('bestDay', game.day);
  stat('playSeconds'); boardCheck(); syncTide(); syncAurora(); storyCheck();
  if (nightAmount(game.time) > 0.6) stat('nightSeconds');
  metaTick();
}

function nearestSpot() {
  let best = null, bd = 1e9; const p = game.player;
  for (const sp of game.spots) { const d = dist(p.x, p.y, sp.x, sp.y); if (d < bd) { bd = d; best = sp; } }
  return best ? { spot: best, d: bd } : null;
}
