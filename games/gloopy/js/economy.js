'use strict';
/* =====================================================================
   ECONOMY (v5) — the market.
   price = base value × daily drift × season bonus × TODAY'S DEMAND × market event × glut × saturation
   · Demand: every dawn one kind of glimmer is "in demand" (×1.5–1.9).
   · Events: some days the market has a mood (boom, treasure fair, glut, food sale, wholesale buyer).
   · Bulk selling: 10+ / 25+ / 50+ of one kind in one sale pays +5% / +10% / +15%.
   · Saturation: every glimmer you sell nudges that price down a little; it recovers overnight.
   · Balancing round: each dawn prices are pulled back toward ×1.0 and the market average is kept near ×1.0,
     so no run of luck (or of bad luck) lasts forever.
   ===================================================================== */
const PRICE_MIN = 0.7, PRICE_MAX = 1.45;
const DEMAND_RANGE = [1.5, 1.9];
const BULK_TIERS = [[50, 0.15], [25, 0.10], [10, 0.05]];          // [amount, bonus]
const SAT_STEP = 0.006, SAT_MIN = 0.7;                            // each glimmer sold lowers its price by 0.6% (never below ×0.7)
const MARKET_EVENTS = [
  { id: 'boom',     icon: '📈', name: 'Market Boom',       desc: 'Every glimmer sells for +20% today.',                         plort: 1.2 },
  { id: 'fair',     icon: '🎡', name: 'Treasure Fair',     desc: 'Collectors pay +35% for treasures today.',                    treasure: 1.35 },
  { id: 'glut',     icon: '📦', name: 'Glimmer Glut',      desc: 'One kind of glimmer is oversupplied: −30% today.',            glut: 0.7 },
  { id: 'sale',     icon: '🏷️', name: 'Food Sale',         desc: 'Food and treats cost half price today.',                      food: 0.5 },
  { id: 'merchant', icon: '🚚', name: 'Wholesale Buyer',   desc: 'A merchant pays another +10% on bulk sales (10+ of a kind).', bulk: 0.10 }
];
const EVENT_CHANCE = 0.4;

function freshMarket() { return { day: 0, demand: null, event: null, sat: {}, avg: 1 }; }
function ensureMarket() { if (!game.market) game.market = freshMarket(); return game.market; }
const marketEvent = () => { const m = ensureMarket(); return m.event ? MARKET_EVENTS.find(e => e.id === m.event.id) : null; };
const demandMult = id => { const m = ensureMarket(); return m.demand && m.demand.id === id ? m.demand.mult : 1; };
const satMult = id => ensureMarket().sat[id] || 1;
function eventPlortMult(id) {
  const e = marketEvent(), m = ensureMarket(); if (!e) return 1;
  if (e.plort) return e.plort;
  if (e.glut && m.event.type === id) return e.glut;
  return 1;
}
const eventTreasureMult = () => { const e = marketEvent(); return e && e.treasure ? e.treasure : 1; };
const eventFoodMult = () => { const e = marketEvent(); return e && e.food ? e.food : 1; };
const foodPrice = id => Math.max(1, Math.round(FOODS[id].price * 3 * eventFoodMult() * (BUY_EXEMPT.food ? 1 : BUY_MULT)));      // 3 helpings per purchase; ×BUY_MULT since 0.10.1

const plortPrice = id => Math.max(1, Math.round(SLIMES[id].plort.value * (game.prices[id] || 1) * (season().slimes.includes(id) ? 1.25 : 1) * demandMult(id) * eventPlortMult(id) * satMult(id)));
function bulkBonus(n) {
  let b = 0; for (const [amt, bonus] of BULK_TIERS) if (n >= amt) { b = bonus; break; }
  const e = marketEvent(); if (e && e.bulk && n >= 10) b += e.bulk;
  return b;
}

/* ---------------- the daily roll + balancing round ---------------- */
function sellableTypes() { return SLIME_IDS.filter(id => !SLIMES[id].event); }
function rollPrices(first) {
  const m = ensureMarket();
  const ids = Object.keys(SLIMES);
  for (const id of ids) {
    const prev = game.prices[id] || 1;
    // random walk + a pull back toward ×1.0 (this is the balancing round)
    const m2 = first ? 1 : clamp(prev + (Math.random() - 0.5) * 0.55 + (1 - prev) * 0.25, PRICE_MIN, PRICE_MAX);
    game.trends[id] = first ? 0 : Math.sign(m2 - prev);
    game.prices[id] = m2;
  }
  if (!first) {                                                     // keep the market average near ×1.0 so a whole market never drifts away
    const mean = ids.reduce((a, id) => a + game.prices[id], 0) / ids.length;
    if (mean < 0.94 || mean > 1.08) {
      const shift = (1 - mean) * 0.6;
      for (const id of ids) game.prices[id] = clamp(game.prices[id] + shift, PRICE_MIN, PRICE_MAX);
    }
  }
  m.avg = ids.reduce((a, id) => a + game.prices[id], 0) / ids.length;
  for (const id of ids) m.sat[id] = Math.min(1, (m.sat[id] || 1) + (1 - (m.sat[id] || 1)) * 0.5 + 0.05);   // saturation recovers overnight
  rollDemandAndEvent(first);
}
function rollDemandAndEvent(first) {
  const m = ensureMarket(), prevId = m.demand ? m.demand.id : null;
  // demand favours kinds you have already met (otherwise it would be a mystery shopping list)
  let pool = sellableTypes().filter(id => id !== prevId && (!NEW_SLIMES.includes(id) || (typeof slimeEntry === 'function' && slimeEntry(id).seen)));
  if (!pool.length) pool = sellableTypes();
  const id = pool[randi(0, pool.length)];
  m.demand = { id, mult: Math.round(rand(DEMAND_RANGE[0], DEMAND_RANGE[1]) * 10) / 10 };
  m.event = null;
  if (!first && game.day > 1 && Math.random() < EVENT_CHANCE) {
    const ev = MARKET_EVENTS[randi(0, MARKET_EVENTS.length)];
    m.event = { id: ev.id };
    if (ev.glut) { const others = sellableTypes().filter(x => x !== id); m.event.type = others[randi(0, others.length)]; }
  }
  m.day = game.day;
}
function marketToasts() {                                           // called at dawn
  const m = ensureMarket(); if (!m.demand) return;
  showToast('🔥', `In demand: ${SLIMES[m.demand.id].name} glimmers ×${m.demand.mult}`, 'Sell them at the market today.');
  const e = marketEvent();
  if (e) showToast(e.icon, e.name, e.desc + (m.event.type ? ` (${SLIMES[m.event.type].name})` : ''), true);
}

/* ---------------- selling ---------------- */
const salePrice = id => Math.round(plortPrice(id) * sellMult());
const treasurePrice = id => Math.round(TREASURES[id].value * sellMult() * eventTreasureMult());
// Sells `count` glimmers of one kind (default: all of them). Returns the money earned.
function sellPlorts(id, count) {
  const have = packCount('plort', id), n = Math.min(count === undefined ? have : count, have);
  if (n <= 0) return 0;
  const unit = salePrice(id), bonus = bulkBonus(n);
  packRemoveN('plort', id, n);
  const earn = Math.round(n * unit * (1 + bonus));
  game.money += earn; stat('moneyEarned', earn); stat('sales'); stat('glimmersSold', n);
  if (bonus > 0) { stat('bulkSales'); statMax('bestBulk', n); }
  const m = ensureMarket(); m.sat[id] = Math.max(SAT_MIN, (m.sat[id] || 1) - SAT_STEP * n);
  questProgress('sell', id, n);
  game.lastSale = { id, n, bonus, earn };
  return earn;
}
function marketTags(id) {
  const t = [], m = ensureMarket();
  if (m.demand && m.demand.id === id) t.push(`🔥 demand ×${m.demand.mult}`);
  if (season().slimes.includes(id)) t.push('🌸 season +25%');
  const e = marketEvent();
  if (e && e.glut && m.event.type === id) t.push('📦 glut −30%');
  if (e && e.plort) t.push(`${e.icon} ${e.name}`);
  if (satMult(id) < 0.985) t.push(`📉 saturated ×${satMult(id).toFixed(2)}`);
  return t;
}
