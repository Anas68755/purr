'use strict';
/* =====================================================================
   AREAS (v5) — events of the second area, the Sunny Shore.
   · Low Tide: day 3 of every 6, during daylight the sea draws back. The outer sea rows turn into walkable wet sand,
     tide-pool chests appear and extra glimmering spots show up on the wet sand.
   · Drift Bottles: when the rain stops, bottles wash ashore with a little treasure.
   ===================================================================== */
const isLowTideDay = (day = game.day) => ((day - 1) % LOW_TIDE.cycle) + 1 === LOW_TIDE.day;
const lowTideActive = (day = game.day, time = game.time) => isLowTideDay(day) && time >= LOW_TIDE.from && time <= LOW_TIDE.to;
function daysUntilLowTide(from = game.day) { for (let d = 0; d < LOW_TIDE.cycle; d++) if (isLowTideDay(from + d)) return d; return -1; }

// Called when the world is built or loaded, and every second: makes the sea match the clock.
function syncTide(silent) {
  if (!tideTiles.length) return;
  const want = lowTideActive();
  if (want === tideLow && !silent) return;
  if (want === tideLow) return;
  applyTide(want);
  if (want) startLowTideEffects(silent); else endLowTideEffects(silent);
}
function startLowTideEffects(silent) {
  if (silent) return;                                // loading a save mid-tide: keep the saved chests and spots (no re-opening by reloading)
  game.chests.forEach(c => { if (c.tide) c.open = false; });
  game.spots = game.spots.filter(s => !s.tide);
  let made = 0;
  for (let tries = 0; tries < 300 && made < LOW_TIDE.extraSpots; tries++) {
    const t = tideTiles[randi(0, tideTiles.length)];
    const x = t.x * TILE + TILE / 2, y = t.y * TILE + TILE / 2;
    if (game.spots.some(s => dist(s.x, s.y, x, y) < 120)) continue;
    game.spots.push({ x, y, tide: true }); made++;
  }
  if (!silent) { stat('lowTides'); showToast('🌊', 'Low tide!', 'The sea draws back — tide pools, chests and treasure on the wet sand.', true); }
}
function endLowTideEffects(silent) {
  game.spots = game.spots.filter(s => !s.tide);
  const p = game.player;
  if (p && isBlocking(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) {          // the sea came back while you were standing in it
    const f = findFreeSpot(p.x, p.y); p.x = f.x; p.y = f.y; p.z = 0; p.vz = 0;
    if (!silent) showAlert('🌊 The tide came back — you were carried to the shore', 2600);
  } else if (!silent) showAlert('🌊 The tide is coming back in…', 2200);
  for (const s of game.slimes) if (isBlocking(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) { const f = findFreeSpot(s.x, s.y); s.x = f.x; s.y = f.y; s.home = { x: f.x, y: f.y }; }
}

/* ---------------- drift bottles ---------------- */
function maybeWashBottle() {                       // called when rain ends
  if (game.treasures.filter(t => t.type === 'driftbottle').length >= BOTTLE.maxOnBeach) return;
  for (let tries = 0; tries < 60; tries++) {
    const tx = randi(8, WORLD_W - 8), sl = seaLine(tx), ty = sl - 2;
    if (world[tx][ty] !== T.SAND && world[tx][ty] !== T.WETSAND) continue;
    game.treasures.push({ type: 'driftbottle', x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, vx: 0, vy: 0, z: 14, vz: 30, age: 0 });
    stat('bottles'); showToast('🍾', 'A bottle washed ashore', 'Look along the Sunny Shore after the rain.');
    return;
  }
}

/* ---------------- tide chests ---------------- */
const tideChestVisible = ch => ch.tide ? tideLow : ch.aurora ? auroraOn : true;      // tide-pool chests need low tide, ice chests need Aurora Night
function openBeachChest(ch) {
  const lucky = game.powers.prismluck ? 1.35 : 1;
  const coins = Math.round(randi(140, 281) * lucky); game.money += coins; stat('moneyEarned', coins);
  const drops = ['sanddollar', 'seaglass', BEACH_LOOT[randi(0, BEACH_LOOT.length)]];
  if (Math.random() < 0.25) drops.push('driftbottle');
  if (game.powers.prismluck) drops.push('seaglass');
  drops.forEach(t => popItem(game.treasures, t, ch.x, ch.y - 10));
  showAlert(`🧰 Tide-pool chest! +$${coins} and treasure`, 2600);
}

// what a glimmering spot gives, depending on where it is
function digTableFor(sp) {
  if (sp.tide) return 'tide';
  if (sp.aurora) return 'aurora';
  const a = areaAt(Math.floor(sp.x / TILE), Math.floor(sp.y / TILE));
  return a === 'beach' ? 'beach' : a === 'grove' ? 'grove' : a === 'peak' ? 'peak' : 'meadow';
}

/* =====================================================================
   v5.1 — getting around the big world
   · Signposts (fast travel): every area you have visited can be reached from ☰ → World map for $TRAVEL_COST.
   · Story guide: a golden arrow at the edge of the screen points to whoever (or wherever) the story needs next.
   ===================================================================== */
const TRAVEL_COST = 25;
const WAYPOINTS = [
  { id: 'ranch',   name: 'Ranch crossroads', icon: '🏠', x: 19.5, y: 43.5, need: null },
  { id: 'shop',    name: 'Market',           icon: '🛒', get x() { const f = features.find(q => q.type === 'shop'); return f.x + 1.5; }, get y() { const f = features.find(q => q.type === 'shop'); return f.y + 3.6; }, need: null },
  { id: 'cave',    name: 'Crystal Cave',     icon: '💎', x: 69, y: 54, need: 'cave' },
  { id: 'grove',   name: 'Mushroom Grove',   icon: '🍄', x: 128, y: 36, need: 'grove' },
  { id: 'prairie', name: 'Sunny Prairie',    icon: '🌼', x: 134, y: 92, need: 'prairie' },
  { id: 'fields',  name: 'Windy Fields',     icon: '🌬️', x: 44, y: 92, need: 'fields' },
  { id: 'beach',   name: 'Sunny Shore',      icon: '🏖️', x: 90, y: 119, need: 'beach' },
  { id: 'peak',    name: 'Frostpeak',        icon: '🏔️', x: 214, y: 44, need: 'peak' },
  { id: 'far',     name: 'Far Meadow',       icon: '🌾', x: 290, y: 46, need: 'far' }
];
const waypointOpen = w => !w.need || !!profile.codex.places[w.need];
function travelTo(id) {
  const w = WAYPOINTS.find(q => q.id === id);
  if (!w || !waypointOpen(w)) return false;
  if (game.money < TRAVEL_COST) { showAlert(`Signpost fare is $${TRAVEL_COST}`, 1800); Sound.play('error', 0.5); return false; }
  const f = findFreeSpot(w.x * TILE, w.y * TILE), p = game.player;
  game.money -= TRAVEL_COST; p.x = f.x; p.y = f.y; p.z = 0; p.vz = 0;
  game.camera.x = p.x; game.camera.y = p.y; stat('travels'); syncTide(); syncAurora(); Sound.play('collect', 0.7);
  showAlert(`${w.icon} ${w.name}`, 1600);
  return true;
}
// where the story wants you next (tile coordinates) or null
function storyTarget() {
  const s = storyStep(), st = ensureStory(); if (!s) return null;
  const npc = () => { if (s.npc === 'wren') { const t = wrenTile(); return { x: t.x, y: t.y, label: WREN.name }; } const n = NPCS.find(q => q.id === s.npc); return { x: n.x, y: n.y, label: n.name }; };
  if (st.status === 'idle' || storyReady()) return npc();
  if (s.kind === 'visit') { const a = AREAS[s.area]; return { x: a.x + a.w / 2, y: a.y + a.h / 2, label: PLACES[s.area].name }; }
  return null;
}

/* =====================================================================
   v6 — Frostpeak events
   · Aurora Night: day 4 of every 5, after dusk. Ribbons of light fill the sky, three ice chests open on the mountain and
     extra glimmering spots appear in the snow (rich in Aurora Dust and Ember Stones).
   · Snowdrift gifts: when the weather ends, a Snow Globe or Glass Icicle is left in the snow.
   ===================================================================== */
let auroraOn = false;
const isAuroraDay = (day = game.day) => ((day - 1) % AURORA.cycle) + 1 === AURORA.day;
const auroraActive = (day = game.day, time = game.time) => isAuroraDay(day) && time >= AURORA.from;
function daysUntilAurora(from = game.day) { for (let d = 0; d < AURORA.cycle; d++) if (isAuroraDay(from + d)) return d; return -1; }
function syncAurora(silent) {
  const want = auroraActive(); if (want === auroraOn) return;
  auroraOn = want;
  if (want) { if (!silent) startAurora(); } else endAurora();
}
function startAurora() {
  game.chests.forEach(c => { if (c.aurora) c.open = false; });
  game.spots = game.spots.filter(s => !s.aurora);
  const P = AREAS.peak; let made = 0;
  for (let tries = 0; tries < 400 && made < AURORA.extraSpots; tries++) {
    const tx = randi(P.x + 3, P.x + P.w - 3), ty = randi(P.y + 3, P.y + P.h - 3);
    if (world[tx][ty] !== T.SNOW) continue;
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    if (game.spots.some(s => dist(s.x, s.y, x, y) < 120)) continue;
    game.spots.push({ x, y, aurora: true }); made++;
  }
  stat('auroraNights'); showToast('🌌', 'Aurora Night!', 'Ribbons of light over Frostpeak — the ice chests are open.', true);
}
function endAurora() { game.spots = game.spots.filter(s => !s.aurora); }
function openAuroraChest(ch) {
  const lucky = game.powers.prismluck ? 1.35 : 1;
  const coins = Math.round(randi(200, 381) * lucky); game.money += coins; stat('moneyEarned', coins);
  const drops = [AURORA_LOOT[randi(0, AURORA_LOOT.length)], 'auroradust', AURORA_LOOT[randi(0, AURORA_LOOT.length)]];
  if (game.powers.prismluck) drops.push('emberstone');
  drops.forEach(t => popItem(game.treasures, t, ch.x, ch.y - 10));
  showAlert(`🧊 Ice chest! +$${coins} and treasure`, 2600);
}
function maybeSnowGift() {                                           // called when the weather ends
  if (game.treasures.filter(t => t.type === 'snowglobe' || t.type === 'icicle').length >= SNOW_GIFT.maxOnPeak) return;
  const P = AREAS.peak;
  for (let tries = 0; tries < 80; tries++) {
    const tx = randi(P.x + 4, P.x + P.w - 4), ty = randi(P.y + 4, P.y + P.h - 4);
    if (world[tx][ty] !== T.SNOW || areaAt(tx, ty) !== 'peak') continue;
    game.treasures.push({ type: Math.random() < 0.5 ? 'snowglobe' : 'icicle', x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, vx: 0, vy: 0, z: 14, vz: 30, age: 0 });
    showToast('❄️', 'A gift in the snow', 'Something was left behind on Frostpeak.'); return;
  }
}
