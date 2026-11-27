'use strict';
/* =====================================================================
   META — everything that outlives a single save game:
   settings, lifetime stats, achievements and the codex.
   Stored under PROFILE_KEY, separate from the ranch save.
   ===================================================================== */
const DEFAULT_SETTINGS = {
  sfx: true, music: true, sfxVol: 0.8, musicVol: 0.6,
  vibrate: true, assist: true, lefty: false, hints: true,
  lighting: true, particles: 2,        // 0 low · 1 medium · 2 high
  dayLen: 1,                           // 0 calm (6 min) · 1 normal (4 min) · 2 quick (2.5 min)
  lang: -1,                            // -1 follow the browser · 0 English · 1 العربية
  playerName: '', netUrl: '', playerColor: -1   // 0.15 Play together: your name, the relay address, your ring colour (-1 = pick one)
};
const DAY_LENGTHS = [360, 240, 150];

function freshProfile() {
  return { v: PROFILE_VERSION, settings: Object.assign({}, DEFAULT_SETTINGS), stats: {}, ach: {}, badges: {}, album: { photos: [], frame: 'plain', sticker: '' }, codex: { slimes: {}, foods: {}, treasures: {}, places: {}, jumbos: {} } };
}
function loadProfile() {
  try {
    const d = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (d && d.v >= 1 && d.v <= PROFILE_VERSION) {                    // v1 profiles (before the album) are upgraded in place
      d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
      d.stats = d.stats || {}; d.ach = d.ach || {}; d.badges = d.badges || {};
      d.album = Object.assign({ photos: [], frame: 'plain', sticker: '' }, d.album);
      if (!Array.isArray(d.album.photos)) d.album.photos = [];
      d.codex = Object.assign({ slimes: {}, foods: {}, treasures: {}, places: {}, jumbos: {} }, d.codex);
      d.v = PROFILE_VERSION;
      return d;
    }
  } catch (e) {}
  return freshProfile();
}
let profile = loadProfile();
let profileDirty = false, achDirty = true;
function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {} profileDirty = false; }
function resetProfile() { profile = freshProfile(); saveProfile(); achDirty = true; }

/* ---------------- stats ---------------- */
const getStat = n => profile.stats[n] || 0;
function stat(name, n = 1) { profile.stats[name] = getStat(name) + n; profileDirty = true; achDirty = true; }
function statMax(name, v) { if (v > getStat(name)) { profile.stats[name] = v; profileDirty = true; achDirty = true; } }
function fmtTime(sec) {
  sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* ---------------- codex ---------------- */
const SLIME_IDS = Object.keys(SLIMES);
function slimeEntry(id) {
  const c = profile.codex.slimes;
  return c[id] || (c[id] = { seen: false, caught: false, ate: {}, plort: false, delighted: false });
}
function codexCount(flag) { return SLIME_IDS.filter(id => slimeEntry(id)[flag]).length; }
function codexTotalPieces() {
  return SLIME_IDS.length * 3 + Object.keys(FOODS).length + Object.keys(TREASURES).length + Object.keys(PLACES).length;
}
function codexDonePieces() {
  let n = 0;
  SLIME_IDS.forEach(id => { const e = slimeEntry(id); n += (e.seen ? 1 : 0) + (e.caught ? 1 : 0) + (e.plort ? 1 : 0); });
  n += Object.keys(FOODS).filter(k => profile.codex.foods[k]).length;
  n += Object.keys(TREASURES).filter(k => profile.codex.treasures[k]).length;
  n += Object.keys(PLACES).filter(k => profile.codex.places[k]).length;
  return n;
}
let lastCodexToast = 0;
function codexToast(text) {
  const now = performance.now();
  if (now - lastCodexToast < 1500) return;
  lastCodexToast = now;
  showToast('📖', 'Codex updated', text);
}
function discoverSlime(id, flag) {
  const e = slimeEntry(id);
  if (e[flag]) return;
  e[flag] = true; profileDirty = true; achDirty = true;
  if (flag === 'seen') codexToast(`New slime spotted: ${SLIMES[id].name}`);
  else if (flag === 'caught') codexToast(`${SLIMES[id].name} slime — caught!`);
  else if (flag === 'plort') codexToast(`${SLIMES[id].name} glimmer discovered`);
}
function discoverDiet(id, food) {
  const e = slimeEntry(id);
  if (!e.ate[food]) { e.ate[food] = true; profileDirty = true; }
}
function discoverFood(id) { if (!profile.codex.foods[id]) { profile.codex.foods[id] = true; profileDirty = true; achDirty = true; codexToast(`${FOODS[id].name} added`); } }
function discoverTreasure(id) { if (!profile.codex.treasures[id]) { profile.codex.treasures[id] = true; profileDirty = true; achDirty = true; codexToast(`${TREASURES[id].name} found!`); } }
function discoverPlace(id) { if (!profile.codex.places[id]) { profile.codex.places[id] = true; profileDirty = true; achDirty = true; codexToast(`New place: ${PLACES[id].name}`); } }

/* ---------------- achievements ---------------- */
const placesFound = () => Object.keys(PLACES).filter(k => profile.codex.places[k]).length;
const ACHIEVEMENTS = [
  { id: 'firstGulp',  icon: '🌀', name: 'First Gulp',         desc: 'Catch your first slime.',                 stat: 'slimesCaught',     goal: 1,    reward: 20 },
  { id: 'glimmer25',  icon: '💎', name: 'Glimmer Gatherer',   desc: 'Collect 25 glimmers.',                    stat: 'glimmersCollected', goal: 25,   reward: 30 },
  { id: 'glimmer250', icon: '👑', name: 'Glimmer Hoarder',    desc: 'Collect 250 glimmers.',                   stat: 'glimmersCollected', goal: 250,  reward: 120 },
  { id: 'market',     icon: '🏪', name: 'Open for Business',  desc: 'Sell something at the market.',           stat: 'sales',            goal: 1,    reward: 15 },
  { id: 'earn500',    icon: '💰', name: 'Pocket Change',      desc: 'Earn $500 in total.',                     stat: 'moneyEarned',      goal: 500,  reward: 50 },
  { id: 'earn5000',   icon: '🏦', name: 'Cosy Tycoon',        desc: 'Earn $5,000 in total.',                   stat: 'moneyEarned',      goal: 5000, reward: 250 },
  { id: 'gear',       icon: '⚙️', name: 'Gear Up',            desc: 'Buy 6 upgrade levels.',                   stat: 'upgradesBought',   goal: 6,    reward: 100 },
  { id: 'harvest10',  icon: '🥕', name: 'Green Thumb',        desc: 'Harvest 10 crops.',                       stat: 'harvests',         goal: 10,   reward: 40 },
  { id: 'harvest50',  icon: '🌾', name: 'Farmer',             desc: 'Harvest 50 crops.',                       stat: 'harvests',         goal: 50,   reward: 150 },
  { id: 'dig5',       icon: '⛏️', name: 'Treasure Hunter',    desc: 'Dig up 5 glimmering spots.',              stat: 'digs',             goal: 5,    reward: 40 },
  { id: 'dig25',      icon: '🏺', name: 'Archaeologist',      desc: 'Dig up 25 glimmering spots.',             stat: 'digs',             goal: 25,   reward: 160 },
  { id: 'shard',      icon: '⭐', name: 'Stargazer',          desc: 'Pick up a star shard.',                   stat: 'shards',           goal: 1,    reward: 40 },
  { id: 'starFriend', icon: '🌟', name: 'Star Friend',        desc: 'Catch a Star slime.',                     cur: () => slimeEntry('star').caught ? 1 : 0, goal: 1, reward: 150 },
  { id: 'rain',       icon: '🌧️', name: 'Rainy Day',          desc: 'Be out on the ranch while it rains.',     stat: 'rains',            goal: 1,    reward: 20 },
  { id: 'rainbow',    icon: '🌈', name: 'Rainbow Chaser',     desc: 'See a rainbow after the rain.',           stat: 'rainbows',         goal: 1,    reward: 40 },
  { id: 'pet25',      icon: '🤚', name: 'Slime Whisperer',    desc: 'Pet slimes 25 times.',                    stat: 'pets',             goal: 25,   reward: 60 },
  { id: 'delight3',   icon: '😊', name: 'Delighted!',         desc: 'Have 3 delighted slimes at once.',        stat: 'maxDelighted',     goal: 3,    reward: 60 },
  { id: 'fav20',      icon: '❤️', name: "Chef's Kiss",        desc: 'Feed slimes their favourite food 20 times.', stat: 'favFed',         goal: 20,   reward: 60 },
  { id: 'decor5',     icon: '🪴', name: 'Interior Decorator', desc: 'Place 5 decorations.',                    stat: 'decorPlaced',      goal: 5,    reward: 50 },
  { id: 'charm15',    icon: '🏡', name: 'Cosy Ranch',         desc: 'Reach 15 ranch charm.',                   stat: 'maxCharm',         goal: 15,   reward: 120 },
  { id: 'naturalist', icon: '🔍', name: 'Naturalist',         desc: 'Spot every kind of slime.',               cur: () => codexCount('seen'),   goal: SLIME_IDS.length, reward: 100 },
  { id: 'collector',  icon: '📚', name: 'Complete Collection', desc: 'Catch every kind of slime.',             cur: () => codexCount('caught'), goal: SLIME_IDS.length, reward: 200 },
  { id: 'explorer',   icon: '🧭', name: 'Explorer',           desc: 'Visit every place on the map.',           cur: placesFound,                goal: Object.keys(PLACES).length, reward: 80 },
  { id: 'nightOwl',   icon: '🦉', name: 'Night Owl',          desc: 'Spend 5 minutes outside after dark.',     stat: 'nightSeconds',     goal: 300,  reward: 50 },
  { id: 'week',       icon: '📅', name: 'A Calm Week',        desc: 'Reach day 7.',                            stat: 'bestDay',          goal: 7,    reward: 60 },
  { id: 'corral3',    icon: '🐾', name: 'Growing Herd',       desc: 'Own 3 corrals.',                          stat: 'corralsOwned',     goal: 3,    reward: 80 },
  { id: 'corral5',    icon: '🏘️', name: 'Ranch Baron',        desc: 'Own every corral lot.',                   stat: 'corralsOwned',     goal: CORRAL_LOTS.length, reward: 300 },
  { id: 'pen6',       icon: '🫂', name: 'Full House',         desc: 'Have 6 slimes in one corral.',            stat: 'fullestPen',       goal: 6,    reward: 60 },
  { id: 'pen10',      icon: '🥰', name: 'Cuddle Puddle',      desc: 'Have 10 slimes in one corral.',           stat: 'fullestPen',       goal: 10,   reward: 150 },
  { id: 'autoFeed',   icon: '🥣', name: 'Hands-free Feeding', desc: 'Let feeders drop food 25 times.',         stat: 'feederDrops',      goal: 25,   reward: 70 },
  { id: 'basket30',   icon: '🧺', name: 'Basket Case',        desc: 'Catch 30 glimmers in baskets.',           stat: 'basketCaught',     goal: 30,   reward: 70 },
  { id: 'penUp8',     icon: '🔧', name: 'Pen Perfect',        desc: 'Buy 8 corral upgrades.',                  stat: 'corralUpgrades',   goal: 8,    reward: 120 },
  { id: 'fences3',    icon: '🎨', name: 'Fence Fashion',      desc: 'Buy 3 fence styles.',                     stat: 'fencesBought',     goal: 3,    reward: 60 },
  { id: 'treats10',   icon: '🍬', name: 'Spoiled Rotten',     desc: 'Give slimes 10 treats.',                  stat: 'treatsGiven',      goal: 10,   reward: 50 },
  { id: 'gear4',      icon: '🎁', name: 'Fully Equipped',     desc: 'Buy all four gear items.',                stat: 'gearBought',       goal: 4,    reward: 150 },
  { id: 'jumbo1',     icon: '💥', name: 'First Pop',          desc: 'Feed a Jumbo slime until it bursts.',     stat: 'jumbosPopped',     goal: 1,    reward: 100 },
  { id: 'jumbo4',     icon: '👑', name: 'Jumbo Wrangler',     desc: 'Pop 4 Jumbo slimes.',                     stat: 'jumbosPopped',     goal: 4,    reward: 250 },
  { id: 'powers8',    icon: '🦸', name: 'Power Collector',    desc: 'Gain 8 Jumbo powers.',                    stat: 'powersGained',     goal: 8,    reward: 400 },
  { id: 'powersAll',  icon: '🦸', name: 'Power Master',       desc: 'Gain every Jumbo power.',                 stat: 'powersGained',     goal: JUMBOS.length, reward: 700 },
  { id: 'bigEater',   icon: '🍽️', name: 'Big Appetite',       desc: 'Feed Jumbos 100 helpings.',               stat: 'jumboFed',         goal: 100,  reward: 120 },
  { id: 'jump100',    icon: '🐇', name: 'Bunny Hop',          desc: 'Jump 100 times.',                         stat: 'jumps',            goal: 100,  reward: 40 },
  { id: 'jump1000',   icon: '🌙', name: 'Moon Walker',        desc: 'Jump 1,000 times.',                       stat: 'jumps',            goal: 1000, reward: 150 },
  { id: 'bounce20',   icon: '🍄', name: 'Spring Fever',       desc: 'Launch off bounce mushrooms 20 times.',   stat: 'bounces',          goal: 20,   reward: 50 },
  { id: 'orbs10',     icon: '☁️', name: 'Head in the Clouds', desc: 'Catch 10 sky orbs.',                      stat: 'skyOrbs',          goal: 10,   reward: 100 },
  { id: 'chests5',    icon: '🧰', name: 'Island Hopper',      desc: 'Open 5 pond chests.',                     stat: 'chests',           goal: 5,    reward: 100 },
  { id: 'skip10',     icon: '🫧', name: 'Stone Skipper',      desc: 'Skip across the water 10 times.',         stat: 'skips',            goal: 10,   reward: 80 },
  { id: 'splash3',    icon: '💦', name: 'Making a Splash',    desc: 'Land in the pond 3 times. It happens!',   stat: 'splashes',         goal: 3,    reward: 20 },
  { id: 'npc1',       icon: '💬', name: 'Good Neighbour',     desc: 'Finish a neighbour\'s special quest.',    stat: 'npcQuests',        goal: 1,    reward: 60 },
  { id: 'npc10',      icon: '🏘️', name: 'Beloved Neighbour',  desc: 'Finish 10 special quests.',               stat: 'npcQuests',        goal: 10,   reward: 300 },
  { id: 'winter',     icon: '❄️', name: 'Winter Is Here',     desc: 'Reach the first winter (day 22).',         stat: 'bestDay',          goal: 22,   reward: 80 },
  { id: 'festival',   icon: '🎪', name: 'Harvest Festival',   desc: 'Be there for a Harvest Festival.',        stat: 'festivals',        goal: 1,    reward: 100 },
  { id: 'starnight',  icon: '🌠', name: 'Star Night',         desc: 'Experience a Star Night.',                stat: 'starNights',       goal: 1,    reward: 100 },
  { id: 'egg1',       icon: '🥚', name: 'Something Is Cooking', desc: 'Find the first egg in a corral.',        stat: 'eggs',             goal: 1,    reward: 60 },
  { id: 'hatch3',     icon: '🐣', name: 'Matchmaker',         desc: 'Hatch 3 hybrid slimes.',                  stat: 'hybridsHatched',   goal: 3,    reward: 150 },
  { id: 'family',     icon: '🧬', name: 'Family Tree',        desc: 'Discover all six hybrid slimes.',         cur: () => HYBRIDS.filter(h => slimeEntry(h.id).seen).length, goal: HYBRIDS.length, reward: 250 },
  { id: 'chal10',     icon: '📋', name: 'Board Regular',      desc: 'Claim 10 challenge rewards.',             stat: 'challengesClaimed', goal: 10,  reward: 80 },
  { id: 'chal50',     icon: '🗂️', name: 'Board Veteran',      desc: 'Claim 50 challenge rewards.',             stat: 'challengesClaimed', goal: 50,  reward: 250 },
  { id: 'streak7',    icon: '🔥', name: 'On a Roll',          desc: 'Keep a 7-day challenge streak.',          stat: 'bestStreak',       goal: 7,    reward: 200 },
  { id: 'weekly1',    icon: '🏅', name: 'Weekly Winner',      desc: 'Complete a weekly challenge.',            stat: 'weeklyClaimed',    goal: 1,    reward: 60 },
  { id: 'month',      icon: '🌻', name: 'Old Friend',         desc: 'Reach day 30.',                           stat: 'bestDay',          goal: 30,   reward: 300 },
  { id: 'bulk1',      icon: '📦', name: 'Wholesale',          desc: 'Make a bulk sale (10+ of one kind).',     stat: 'bulkSales',        goal: 1,    reward: 60 },
  { id: 'sold500',    icon: '🏬', name: 'Market Legend',      desc: 'Sell 500 glimmers.',                      stat: 'glimmersSold',     goal: 500,  reward: 200 },
  { id: 'tide1',      icon: '🌊', name: 'Tide Walker',        desc: 'Open a tide-pool chest at low tide.',     stat: 'tideChests',       goal: 1,    reward: 80 },
  { id: 'bottle1',    icon: '🍾', name: 'Message in a Bottle', desc: 'Find a drift bottle after the rain.',    stat: 'bottles',          goal: 1,    reward: 60 },
  { id: 'storyAll',   icon: '🏮', name: 'The Lantern Shines', desc: 'Finish the whole story.',                 stat: 'storyDone',        goal: 1,    reward: 500 },
  { id: 'photo5',     icon: '📸', name: 'Shutterbug',         desc: 'Take 5 photos.',                          stat: 'photos',           goal: 5,    reward: 60 },
  { id: 'crafty',     icon: '🛠️', name: 'Handy Rancher',      desc: 'Craft 5 things in Survival mode.',       stat: 'crafted',          goal: 5,    reward: 80 },
  { id: 'hunter',     icon: '⚔️', name: 'Critter Chaser',     desc: 'Defeat 25 critters.',                     stat: 'kills',            goal: 25,   reward: 200 },
  { id: 'wellfed',    icon: '🍲', name: 'Well Fed',           desc: 'Eat 10 meals in Survival mode.',          stat: 'mealsEaten',       goal: 10,   reward: 80 },
  { id: 'stormy',     icon: '⛈️', name: 'Stormy Weather',     desc: 'Live through a thunderstorm.',            stat: 'storms',           goal: 1,    reward: 60 },
  { id: 'named5',     icon: '✏️', name: 'Name Giver',         desc: 'Give 5 slimes their own name.',           stat: 'named',            goal: 5,    reward: 60 },
  { id: 'baby1',      icon: '🍼', name: 'First Baby',         desc: 'Hatch a baby from two slimes of one kind.', stat: 'babies',         goal: 1,    reward: 80 },
  { id: 'family10',   icon: '👨‍👩‍👧‍👦', name: 'Big Family',      desc: 'Hatch 10 baby slimes.',                   stat: 'babies',           goal: 10,   reward: 250 },
  { id: 'shiny1',     icon: '✨', name: 'Something Shiny',    desc: 'Meet a shiny slime.',                     stat: 'shinies',          goal: 1,    reward: 150 },
  { id: 'aurora1',    icon: '🌌', name: 'Under the Aurora',   desc: 'Experience an Aurora Night on Frostpeak.', stat: 'auroraNights',    goal: 1,    reward: 100 },
  { id: 'badges20',   icon: '🏅', name: 'Badge Collector',    desc: 'Collect 20 album badges.',                cur: () => (typeof badgeCount === 'function' ? badgeCount() : 0), goal: 20, reward: 200 }
];
function achProgress(a) { const cur = a.cur ? a.cur() : getStat(a.stat); return [Math.min(cur, a.goal), a.goal]; }

function checkAchievements() {
  achDirty = false;
  if (typeof checkBadges === 'function') checkBadges();
  for (const a of ACHIEVEMENTS) {
    if (profile.ach[a.id]) continue;
    const [cur, goal] = achProgress(a);
    if (cur >= goal) unlockAchievement(a);
  }
}
function unlockAchievement(a) {
  profile.ach[a.id] = Date.now(); profileDirty = true;
  if (typeof game !== 'undefined' && game.state === 'playing') game.money += a.reward;
  showToast(a.icon, 'Achievement unlocked!', `${a.name} · +$${a.reward}`, true);
  Sound.play('achieve', 0.9);
  saveProfile();
}

/* ---------------- toasts (small banners at the top) ---------------- */
const toastQueue = []; let toastBusy = false;
function showToast(icon, title, sub, big) {
  toastQueue.push({ icon, title, sub, big });
  if (!toastBusy) nextToast();
}
function nextToast() {
  const box = document.querySelector('#toasts');
  const t = toastQueue.shift();
  if (!t || !box) { toastBusy = false; return; }
  toastBusy = true;
  const el = document.createElement('div');
  el.className = 'toast' + (t.big ? ' big' : '');
  el.innerHTML = `<span class="ti">${t.icon}</span><span class="tt"><b>${tr(t.title)}</b><small>${tr(t.sub || '')}</small></span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), t.big ? 3200 : 2200);
  setTimeout(() => { el.remove && el.remove(); nextToast(); }, t.big ? 3600 : 2600);
}

// periodic housekeeping (called once a second from the main loop)
function metaTick() {
  if (achDirty) checkAchievements();
  if (profileDirty) saveProfile();
  if (typeof CloudFame !== 'undefined') { try { CloudFame.tick(); } catch (e) {} }
}
