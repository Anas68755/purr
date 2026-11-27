'use strict';
/* ---------------- alerts ---------------- */
let alertTimer = 0;
function showAlert(text, ms = 2400) {
  const a = $('#alert');
  a.textContent = tr(text); a.classList.add('show');
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => a.classList.remove('show'), ms);
}

/* ---------------- image helpers for DOM ---------------- */
function slotImgKey(kind, type) { return kind === 'plort' ? 'plort_' + type : kind === 'food' ? 'food_' + type : kind === 'treasure' ? 'treasure_' + type : 'slime_' + type; }
function slotColor(kind, type) { return kind === 'plort' ? SLIMES[type].plort.color : kind === 'food' ? FOODS[type].color : kind === 'treasure' ? TREASURES[type].color : SLIMES[type].color; }
function slotName(kind, type) { return kind === 'food' ? FOODS[type].name : kind === 'treasure' ? TREASURES[type].name : `${SLIMES[type].name} ${kind === 'plort' ? 'Glimmer' : 'Slime'}`; }
function iconHTML(kind, type, cls = '') {
  const url = IMAGE_FILES[slotImgKey(kind, type)];
  return `<span class="ico ${cls}" style="--c:${slotColor(kind, type)}"><img src="${url}" alt="" onerror="this.remove()"></span>`;
}

/* ---------------- gulper bar ---------------- */
function selectSlot(i) {
  if (i < 0 || i >= game.pack.length) return;
  game.selected = i; game.packDirty = true; Sound.play('click', 0.5);
}
function cyclePack(dir) {
  if (!game.pack.length) return;
  game.selected = (game.selected + dir + game.pack.length) % game.pack.length;
  game.packDirty = true; Sound.play('click', 0.5);
}
function renderPackBar() {
  game.packDirty = false;
  const bar = $('#packBar');
  const max = getPackSlots();
  let html = '';
  for (let i = 0; i < max; i++) {
    const s = game.pack[i];
    if (s) html += `<div class="slot${i === game.selected ? ' sel' : ''}" data-i="${i}">${iconHTML(s.kind, s.type)}<b>${s.n}</b></div>`;
    else html += '<div class="slot empty"></div>';
  }
  const sel = game.pack[game.selected];
  html += `<div id="packLabel">${sel ? tr(slotName(sel.kind, sel.type)) : tr('Gulper empty')}</div>`;
  bar.innerHTML = html;
}
$('#packBar').addEventListener('pointerdown', e => {
  const el = e.target.closest('.slot[data-i]');
  if (el) { Sound.unlock(); selectSlot(parseInt(el.dataset.i, 10)); e.preventDefault(); }
});

/* ---------------- HUD ---------------- */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = tr(String(v)); } }
function updateHUD() {
  setText('money', game.money);
  updateSurvHud();
  setText('dayNum', game.day);
  const hour = Math.floor(game.time * 24), min = Math.floor((game.time * 24 - hour) * 60 / 5) * 5;
  setText('time', `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  setText('slimeCount', `🐙 ${game.slimes.length}`);
  setText('plortCount', `💎 ${packCount('plort')}`);
  setText('foodCount', `🥕 ${packCount('food')}`);
  // the order closest to completion
  let best = null, bestR = -1;
  for (const o of game.orders) { const r = o.progress / o.amount; if (r > bestR) { bestR = r; best = o; } }
  if (best) setText('questText', `${best.desc} (${Math.min(best.progress, best.amount)}/${best.amount}) → $${best.reward}`);
  setText('dayNum', game.day + ' ' + season().icon);
  $('#btnMenu').classList.toggle('dot', boardClaimable() > 0);
  setText('weatherIco', game.weather.raining ? (game.weather.kind === 'snow' ? '🌨️' : '🌧️') : game.weather.rainbow > 0 ? '🌈' : nightAmount(game.time) > 0.6 ? '🌙' : '☀️');
  if (game.packDirty) renderPackBar();
  const it = game.interact, btn = $('#shopBtn');
  btn.classList.toggle('near', !!it);
  const ico = it ? it.icon : '✋';
  if (hudCache.act !== ico) { hudCache.act = ico; btn.textContent = ico; }
}

/* ---------------- sound toggles ---------------- */
function refreshSoundButtons() {
  const set = (id, on, onKey, offKey, onEmoji, offEmoji) => {
    const b = $(id), key = on ? onKey : offKey;
    if (Assets.get(key)) { b.style.backgroundImage = `url(${IMAGE_FILES[key]})`; b.classList.add('has-ico'); b.textContent = ''; }
    else { b.style.backgroundImage = ''; b.classList.remove('has-ico'); b.textContent = on ? onEmoji : offEmoji; }
  };
  set('#btnSfx', Sound.sfxOn, 'ui_sfx_on', 'ui_sfx_off', '🔊', '🔇');
  set('#btnMusic', Sound.musicOn, 'ui_music_on', 'ui_music_off', '🎵', '🚫');
}
function toggleSfx() { Sound.setSfx(!Sound.sfxOn); refreshSoundButtons(); Sound.play('click'); }
function toggleMusic() { Sound.setMusic(!Sound.musicOn); refreshSoundButtons(); Sound.play('click'); }
$('#btnSfx').addEventListener('click', toggleSfx);
$('#btnMusic').addEventListener('click', toggleMusic);

/* ---------------- shop ---------------- */
function toggleShop() { game.shopOpen ? closeShop() : openShop(); }
function openShop() {
  if (!game.nearShop) { showAlert('Walk closer to the shop 🏪'); Sound.play('error', 0.6); return; }
  game.shopOpen = true; input.suck = false; input.shoot = false;
  $('#shop').style.display = 'flex';
  renderShop(); Sound.play('click');
}
function closeShop() { game.shopOpen = false; $('#shop').style.display = 'none'; Sound.play('click', 0.6); }

function upgradeCost(key) { return UPGRADES[key].base * ((game.upgrades[key] || 0) + 1); }

function treasureTotal() { return Object.keys(TREASURES).reduce((a, id) => a + packCount('treasure', id) * treasurePrice(id), 0); }
const stockCount = () => Object.values(game.stock).reduce((a, b) => a + b, 0);

let shopTab = 'sell';
const SHOP_TABS = [['sell', '💰 Sell'], ['food', '🥕 Food'], ['upgrades', '⚙️ Upgrades'], ['gear', '🎁 Gear & decor']];
const pips = (lvl, max) => '●'.repeat(lvl) + '○'.repeat(max - lvl);

function renderShop() {
  $('#shopMoney').textContent = game.money;
  let html = `<div class="tabs shoptabs">${SHOP_TABS.map(([k, l]) => `<button class="${shopTab === k ? 'on' : ''}" data-act="shoptab" data-id="${k}">${l}</button>`).join('')}</div>`;

  if (shopTab === 'sell') {
    const total = Object.keys(SLIMES).reduce((a, id) => { const n = packCount('plort', id); return a + Math.round(n * salePrice(id) * (1 + bulkBonus(n))); }, 0) + treasureTotal();
    html += `<button class="sell-btn big" data-act="sellall" ${total ? '' : 'disabled'}>💰 SELL EVERYTHING (+$${total})</button>`;
    if (game.upgrades.haggler) html += `<div class="note">📒 Haggler's Ledger: +${game.upgrades.haggler * 6}% on every sale</div>`;
    const mk = ensureMarket(), ev = marketEvent();
    if (mk.demand) html += `<div class="note hot">🔥 <b>In demand today: ${SLIMES[mk.demand.id].name} glimmers ×${mk.demand.mult}</b></div>`;
    if (ev) html += `<div class="note hot">${ev.icon} <b>${ev.name}</b> — ${ev.desc}${mk.event.type ? ' (' + SLIMES[mk.event.type].name + ')' : ''}</div>`;
    html += '<div class="note">📦 Bulk bonus when you sell many of one kind at once: 10+ → +5% · 25+ → +10% · 50+ → +15%. Selling lowers a price a little; it recovers overnight.</div>';
    html += '<div class="sec">💎 Glimmers — today\'s prices</div>';
    const shown = Object.keys(SLIMES).filter(id => slimeEntry(id).seen || packCount('plort', id) > 0 || !NEW_SLIMES.includes(id));
    for (const id of shown) {
      const n = packCount('plort', id), tr = game.trends[id] || 0, tags = marketTags(id);
      const arrow = tr > 0 ? '<span class="up">▲</span>' : tr < 0 ? '<span class="down">▼</span>' : '';
      const bb = bulkBonus(n);
      html += `<div class="shop-item">${iconHTML('plort', id, 'lg')}
        <div class="info"><b>${SLIMES[id].name} Glimmer${SLIMES[id].rare ? ' ✨' : ''}</b><br><small>In pack: ${n} • $${salePrice(id)} ${arrow}${bb && n ? ` • bulk +${Math.round(bb * 100)}%` : ''}</small>${tags.length ? `<br><small class="tags">${tags.join(' · ')}</small>` : ''}</div>
        <div class="sellbtns"><button class="sell-btn" data-act="sell" data-id="${id}" data-n="1" ${n ? '' : 'disabled'}>×1</button><button class="sell-btn" data-act="sell" data-id="${id}" data-n="10" ${n >= 10 ? '' : 'disabled'}>×10</button><button class="sell-btn" data-act="sell" data-id="${id}" ${n ? '' : 'disabled'}>ALL</button></div></div>`;
    }
    html += '<div class="sec">🏺 Treasures</div>';
    for (const id of Object.keys(TREASURES)) {
      const n = packCount('treasure', id);
      html += `<div class="shop-item">${iconHTML('treasure', id, 'lg')}
        <div class="info"><b>${TREASURES[id].name}</b><br><small>In pack: ${n} • $${treasurePrice(id)}</small></div>
        <button class="sell-btn" data-act="selltreasure" data-id="${id}" ${n ? '' : 'disabled'}>SELL</button></div>`;
    }
  } else if (shopTab === 'food') {
    html += '<div class="sec">🥕 Food &amp; treats (goes straight into your gulper)</div>';
    for (const id of Object.keys(FOODS)) {
      const f = FOODS[id], price = foodPrice(id);
      html += `<div class="shop-item">${iconHTML('food', id, 'lg')}
        <div class="info"><b>${f.name}</b><br><small>${f.treat ? 'Any slime adores it: big joy, no glimmer • ' : ''}In pack: ${packCount('food', id)} • ×3 for $${price}${eventFoodMult() < 1 ? ' 🏷️ sale' : ''}</small></div>
        <button class="sell-btn" data-act="buy" data-id="${id}" ${game.money >= price ? '' : 'disabled'}>BUY ×3</button></div>`;
    }
    html += '<div class="note">Tip: seeds for the garden are bought at the plots themselves.</div>';
  } else if (shopTab === 'upgrades') {
    html += '<div class="sec">⚙️ Upgrades for you</div>';
    for (const key of UPGRADE_KEYS) {
      const u = UPGRADES[key], lvl = game.upgrades[key], maxed = lvl >= u.max, cost = upgradeCost(key);
      html += `<div class="shop-item"><span class="ico lg" style="--c:#fff3d6;font-size:20px">${u.icon}</span>
        <div class="info"><b>${u.name}</b> <small class="pips">${pips(lvl, u.max)}</small><br><small>${u.desc}${maxed ? ' • maxed' : ''}</small></div>
        <button class="sell-btn" data-act="upgrade" data-id="${key}" ${maxed || game.money < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '$' + cost}</button></div>`;
    }
    html += '<div class="note">Corral upgrades are bought at each corral\'s sign (🐾).</div>';
  } else {
    html += '<div class="sec">🎁 Gear — one-time buys</div>';
    for (const id of Object.keys(GEAR)) {
      const g = GEAR[id], own = !!game.gear[id];
      html += `<div class="shop-item"><span class="ico lg" style="--c:#fff3d6;font-size:20px">${g.icon}</span>
        <div class="info"><b>${g.name}</b><br><small>${g.desc}</small></div>
        <button class="sell-btn" data-act="buygear" data-id="${id}" ${own || game.money < g.cost ? 'disabled' : ''}>${own ? 'OWNED' : '$' + g.cost}</button></div>`;
    }
    html += `<div class="sec">🪴 Ranch decor — charm ${charm()}</div><div class="note">Place decor from the ☰ menu or the 🪴 button.</div>`;
    for (const id of Object.keys(DECOR_ITEMS)) {
      const d = DECOR_ITEMS[id]; if (d.noSale) continue;
      html += `<div class="shop-item"><span class="decor-ico" style="background-image:url(${IMAGE_FILES.ranch_decor});background-position:-${d.cell * 40}px 0"></span>
        <div class="info"><b>${d.name}</b><br><small>${d.blurb} • +${d.charm} charm • in stock: ${game.stock[id] || 0}</small></div>
        <button class="sell-btn" data-act="buydecor" data-id="${id}" ${game.money >= d.cost ? '' : 'disabled'}>$${d.cost}</button></div>`;
    }
  }
  const sc = $('#shopItems').scrollTop;
  $('#shopItems').innerHTML = html;
  if (isRtl()) trDom($('#shopItems'));
  $('#shopItems').scrollTop = sc;
}

function coinBurst() {
  const shop = features.find(f => f.type === 'shop');
  spawnParticles((shop.x + shop.w / 2) * TILE, (shop.y + 1) * TILE, 12, '#ffd700', { spread: 60, up: 80, life: 1.2 });
}

$('#shopItems').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'shoptab': shopTab = id; Sound.play('click', 0.5); $('#shopItems').scrollTop = 0; break;
    case 'sell': { const earn = sellPlorts(id, b.dataset.n ? parseInt(b.dataset.n, 10) : undefined), ls = game.lastSale; if (earn) { showAlert(`Sold for $${earn} 💰${ls && ls.bonus ? ` (bulk +${Math.round(ls.bonus * 100)}%)` : ''}`); Sound.play('sell'); coinBurst(); } break; }
    case 'selltreasure': {
      const n = packRemoveAll('treasure', id), earn = n * treasurePrice(id);
      if (n) { game.money += earn; stat('moneyEarned', earn); stat('sales'); showAlert(`Sold for $${earn} 💰`); Sound.play('sell'); coinBurst(); }
      break;
    }
    case 'buydecor': {
      const d = DECOR_ITEMS[id];
      if (game.money < d.cost) break;
      game.money -= d.cost; game.stock[id] = (game.stock[id] || 0) + 1;
      showAlert(`${d.name} added to your decor stock 🪴`); Sound.play('collect'); break;
    }
    case 'buygear': {
      const g = GEAR[id];
      if (game.gear[id] || game.money < g.cost) break;
      game.money -= g.cost; game.gear[id] = true; stat('gearBought');
      showAlert(`${g.icon} ${g.name} is yours!`, 2400); Sound.play('upgrade'); break;
    }
    case 'sellall': {
      let total = 0; Object.keys(SLIMES).forEach(k => { total += sellPlorts(k); });
      Object.keys(TREASURES).forEach(k => { const n = packRemoveAll('treasure', k); if (n) { const e2 = n * treasurePrice(k); total += e2; game.money += e2; stat('moneyEarned', e2); stat('sales'); } });
      if (total) { showAlert(`Sold everything for $${total} 💰`); Sound.play('sell'); coinBurst(); }
      break;
    }
    case 'buy': {
      const price = foodPrice(id);
      if (game.money < price) break;
      if (!packCanAdd('food', id, 3)) { showAlert('🎒 Not enough room in your gulper'); Sound.play('error', 0.7); break; }
      game.money -= price; packAdd('food', id, 3); showAlert(`Bought 3 ${FOODS[id].name}`); Sound.play('collect'); break;
    }
    case 'upgrade': {
      const cost = upgradeCost(id);
      if (game.upgrades[id] >= UPGRADES[id].max || game.money < cost) break;
      game.money -= cost; game.upgrades[id]++; game.packDirty = true; stat('upgradesBought');
      showAlert(`${UPGRADES[id].icon} ${UPGRADES[id].name} → Lv ${game.upgrades[id]}`); Sound.play('upgrade'); break;
    }
  }
  renderShop();
});
$('#closeShop').addEventListener('click', closeShop);
$('#shopBtn').addEventListener('click', () => { Sound.unlock(); doInteract(); });

/* ---------------- save / load ---------------- */
function hasSave() { return readSave() !== null; }

function saveGame() {
  if (game.visitor) return;                                   // visiting a friend: your own ranch save must stay untouched
  if (!game.player || !['playing', 'paused'].includes(game.state)) return;
  try {
    const saveObj = {
      v: SAVE_VERSION, gameVersion: GAME_VERSION, mountainDone: true, farDone: true, survival: survSave(), market: game.market, story: game.story, seed: worldSeed, money: game.money, day: game.day, time: game.time,
      player: { x: game.player.x, y: game.player.y }, pack: game.pack, selected: game.selected,
      upgrades: game.upgrades, orders: game.orders, prices: game.prices, trends: game.trends,
      stock: game.stock, decor: game.decor, spots: game.spots, gear: game.gear, powers: game.powers,
      jumbos: game.jumbos.map(j => ({ id: j.id, fed: j.fed, goal: j.goal, state: j.state === 'popping' ? 'alive' : j.state, timer: j.timer })),
      npcs: game.npcs.map(n => ({ id: n.id, status: n.status, qi: n.qi, last: n.last, progress: n.progress, cool: n.cool, done: n.done })),
      chests: game.chests.map(c => c.open), orbs: game.orbs.map(o => o.taken),
      board: game.board,
      eggs: game.eggs.map(e => ({ corral: e.corral, type: e.type, x: e.x, y: e.y, t: e.t, same: !!e.same, gene: e.gene || null })),
      corrals: game.corrals.map(c => ({ owned: c.owned, size: c.size, feeder: c.feeder, basket: c.basket, bedding: c.bedding, fence: c.fence, fences: c.fences, stock: c.stock, bin: c.bin, eggCd: c.eggCd })),
      plots: game.plots.map(p => ({ crop: p.crop, t: p.t, wet: p.wet })),
      slimes: game.slimes.map(s => ({ nid: s.nid, type: s.type, x: s.x, y: s.y, hunger: s.hunger, joy: s.joy, home: s.home, name: s.name, trait: s.trait, likes: s.likes, shiny: s.shiny, stage: s.stage, growT: s.growT, named: s.named, born: s.born, noted: s.noted })),
      foods: game.foods.map(f => ({ type: f.type, x: f.x, y: f.y })),
      plorts: game.plorts.map(p => ({ type: p.type, x: p.x, y: p.y })),
      treasures: game.treasures.map(t => ({ type: t.type, x: t.x, y: t.y }))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj));
    try { if (typeof GloopyCloud !== 'undefined') GloopyCloud.pushSave(saveObj); } catch (e) {}
  } catch (e) {}
}

function loadGame() {
  try {
    const d = readSave();
    if (!d) return false;
    generateWorld(d.seed);
    game.money = d.money; game.day = d.day; game.time = d.time;
    game.pack = (d.pack || []).filter(s => (s.kind === 'plort' || s.kind === 'slime') ? SLIMES[s.type] : s.kind === 'food' ? FOODS[s.type] : TREASURES[s.type]);
    game.selected = d.selected || 0; game.packDirty = true;
    game.upgrades = Object.assign(freshUpgrades(), d.upgrades); game.gear = d.gear || {};
    game.prices = d.prices || {}; game.trends = d.trends || {};
    if (!Object.keys(game.prices).length) rollPrices(true);
    SLIME_IDS.forEach(id => { if (!game.prices[id]) game.prices[id] = 1; });      // slimes added by newer versions
    game.orders = Array.isArray(d.orders) && d.orders.length === 3 ? d.orders : null; if (!game.orders) generateOrders();
    game.player = createPlayer(d.player.x, d.player.y);
    game.camera.x = d.player.x; game.camera.y = d.player.y;
    game.slimes = d.slimes.filter(s => SLIMES[s.type]).map(s => {
      const sl = createSlime(s.type, s.x, s.y); sl.hunger = s.hunger; sl.joy = s.joy || 0; if (s.home) sl.home = s.home;
      if (s.nid) sl.nid = s.nid;
      if (s.name) lifeInit(sl, s);                                       // older saves keep the random name / trait that createSlime just rolled
      return sl;
    });
    const item = o => ({ type: o.type, x: o.x, y: o.y, z: 0, vz: 0, vx: 0, vy: 0, age: 0 });
    game.foods = d.foods.filter(f => FOODS[f.type]).map(item);
    game.plorts = d.plorts.filter(p => SLIMES[p.type]).map(item);
    game.treasures = (d.treasures || []).filter(t => TREASURES[t.type]).map(item);
    game.decor = (d.decor || []).filter(x => DECOR_ITEMS[x.type]); game.stock = d.stock || {};
    game.spots = d.spots || []; if (!game.spots.length) generateSpots();
    createCorrals();
    (d.corrals || []).forEach((sv, i) => { const c = game.corrals[i]; if (c && sv) Object.assign(c, { owned: i === 0 ? true : !!sv.owned, size: sv.size || 0, feeder: sv.feeder || 0, basket: sv.basket || 0, bedding: sv.bedding || 0, fence: sv.fence || 'wood', fences: sv.fences || ['wood'], stock: sv.stock || {}, bin: sv.bin || {}, eggCd: sv.eggCd || 0 }); });
    applyCorralTiles();
    createPlots();
    (d.plots || []).forEach((sp, i) => { const p = game.plots[i]; if (p && sp.crop && CROPS[sp.crop]) { p.crop = sp.crop; p.t = sp.t || 0; p.wet = !!sp.wet; } });
    createWorldThings(); game.powers = d.powers || {}; game.board = d.board || null; if (!game.board) generateBoard();
    (d.jumbos || []).forEach(sv => { const j = game.jumbos.find(x => x.id === sv.id); if (j) Object.assign(j, { fed: sv.fed || 0, goal: sv.goal || j.goal, state: sv.state === 'gone' ? 'gone' : 'alive', timer: sv.timer || 0 }); });
    (d.npcs || []).forEach(sv => { const n = game.npcs.find(x => x.id === sv.id); if (n && npcDef(n.id).quests[sv.qi]) Object.assign(n, sv); });
    game.eggs = (d.eggs || []).filter(e => SLIMES[e.type]).map(e => Object.assign({ id: Math.random().toString(36).slice(2, 7) }, e));
    (d.chests || []).forEach((o, i) => { if (game.chests[i]) game.chests[i].open = !!o; });
    (d.orbs || []).forEach((t, i) => { if (game.orbs[i]) game.orbs[i].taken = !!t; });
    game.market = d.market || null; ensureMarket(); if (!d.market) rollDemandAndEvent(true);
    game.story = upgradeStory(d.story); game.photo = null; survLoad(d.survival);
    if (d.populateNewAreas) spawnNewAreaSlimes();
    if (d.populateNewAreas || !d.farDone) { if (d.populateNewAreas || !d.mountainDone) spawnMountainSlimes(); spawnFarSlimes(); }
    else if (!d.mountainDone) spawnMountainSlimes();          // saves from before Frostpeak: stock the mountain once
    fixNids();
    game.visitor = false; game.hostSurv = false;
    auroraOn = false; syncTide(true); syncAurora(true);
    game.particles = []; game.shopOpen = false; game.interact = null;
    game.weather = newWeather(); game.sky = newSky();
    for (const patch of foodPatches) {          // re-link patches to foods that were saved sitting on them
      const f = game.foods.find(fd => fd.type === patch.food && Math.abs(fd.x - (patch.x * TILE + TILE / 2)) < 12 && Math.abs(fd.y - (patch.y * TILE + TILE / 2)) < 12);
      if (f) patch.item = f; else patch.regen = rand(6, 20);
    }
    return true;
  } catch (e) { console.error('load failed', e); return false; }
}
