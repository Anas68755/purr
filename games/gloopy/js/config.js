'use strict';
/* =====================================================================
   CONFIG — constants, game data and the ASSET MANIFEST.
   To swap art/sound: replace the file on disk (same name) or edit the
   paths below.  Missing files never crash the game: images fall back to
   simple vector drawings, missing sounds are skipped.
   ===================================================================== */

const TILE = 36;
// v5: the world is 4x larger (2x wide, 2x tall). The original 90x70 map stays untouched in the top-left corner, so old saves keep working.
const LEGACY_W = 90, LEGACY_H = 70;
const WORLD_W = 350;                       // 0.11: +70 columns in the east for Frostpeak (the first 180 columns generate exactly as before)
const OLD_WORLD_W = 180;
const WORLD_H = 140;
const DAY_SECONDS = 240;
const VAC_CONE = Math.PI / 2.5;
const ITEM_GRAVITY = 320;
const SAVE_KEY = 'gloopyMeadow_save';
const PROFILE_KEY = 'gloopyMeadow_profile';      // settings + achievements + codex + lifetime stats (survives New Game)
const SAVE_VERSION = 5;
const SAVE_MIN_VERSION = 4;                  // oldest save format we can still migrate (see js/migrate.js)
const PROFILE_VERSION = 2;                   // settings + codex + album (v1 profiles are upgraded on load)
const GAME_VERSION = '0.16.0';
const GAME_TITLE = 'Gloopy Meadow';
const PACK_BASE_SLOTS = 4;
const PACK_SLOT_CAP = 20;
const MAX_PLORTS_ON_GROUND = 120;
const MAX_FOODS_ON_GROUND = 90;
const ATLAS_TILE = 64;                       // size of one tile inside tiles.png
const ZOOM_MIN = 1.25, ZOOM_MAX = 2.1;       // camera zoom is picked from the window height

const T = { GRASS:0, DIRT:1, PATH:2, WATER:3, SAND:4, STONE:5, CORRAL:6, FLOOR:7, CAVE:8, ORCHARD:9, BOULDER:10, LILY:11, MOSS:12, WETSAND:13, SNOW:14, ICE:15 };
// Column order inside assets/images/tiles.png (BOULDER has no column: it draws grass + boulder.png)
const TILE_COLOR = [];
const JUMP_V = 175, BOUNCE_V = 335, DOUBLE_JUMP_V = 150, GLIDE_FALL = -45;   // player jump physics (gravity 560)
TILE_COLOR[T.GRASS]   = ['#7ec850', '#6cb040'];
TILE_COLOR[T.DIRT]    = ['#8b5a3c', '#7a4d33'];
TILE_COLOR[T.PATH]    = ['#c8a878', '#a88858'];
TILE_COLOR[T.WATER]   = ['#4a8acc', '#3a7abc'];
TILE_COLOR[T.SAND]    = ['#ecd898', '#dcc888'];
TILE_COLOR[T.STONE]   = ['#808080', '#6a6a6a'];
TILE_COLOR[T.CORRAL]  = ['#bca078', '#a08868'];
TILE_COLOR[T.FLOOR]   = ['#a89070', '#987860'];
TILE_COLOR[T.CAVE]    = ['#3a3048', '#2e2438'];
TILE_COLOR[T.ORCHARD] = ['#8fcf5a', '#7dbb48'];
TILE_COLOR[T.BOULDER] = TILE_COLOR[T.GRASS];
TILE_COLOR[T.LILY] = ['#4a8acc', '#3a7abc'];
TILE_COLOR[T.MOSS] = ['#4f8f63', '#46825a'];
TILE_COLOR[T.WETSAND] = ['#cbb682', '#bda874'];
TILE_COLOR[T.SNOW] = ['#eef5fb', '#e2edf7'];
TILE_COLOR[T.ICE] = ['#bfe6f6', '#aedcf0'];

const NEW_SLIMES = ['spore', 'puff', 'breeze', 'shell', 'coral', 'frost', 'flurry', 'glacier', 'ember', 'aurora'];     // added in v5 (never shown in orders until you have met them)
const SLIMES = {
  pink:     { name:'Pink',     color:'#ff80b0', dark:'#d06890', food:['carrot','heartbeet','cubery','meat'], fav:'heartbeet',
              plort:{ color:'#ff60a0', value:12 },  size:0.95, speed:0.9,  hopRate:1.15, hunger:240, glow:false, rare:false, home:14,
              habitat:'Open meadows', blurb:'Friendly and curious. Hops toward anything that smells sweet.' },
  tabby:    { name:'Tabby',    color:'#c89060', dark:'#a07040', food:['meat'], fav:'meat',
              plort:{ color:'#ff8030', value:28 },  size:1.0,  speed:1.0,  hopRate:1.25, hunger:280, glow:false, rare:false, home:14,
              habitat:'Eastern grasslands', blurb:'Acts like a cat, hops like a slime. Will not share its lunch.' },
  rock:     { name:'Rock',     color:'#a8a098', dark:'#787068', food:['heartbeet'], fav:'heartbeet', hungerRate:0.5,
              plort:{ color:'#a0a0a0', value:60 },  size:1.15, speed:0.55, hopRate:0.7,  hunger:400, glow:false, rare:false, home:12,
              habitat:'Rocky southern fields', blurb:'Slow, sturdy and surprisingly gentle. Gets hungry very slowly.' },
  phosphor: { name:'Phosphor', color:'#aaffaa', dark:'#60aa60', food:['cubery'], fav:'cubery',
              plort:{ color:'#88ff44', value:95 },  size:0.85, speed:1.1,  hopRate:1.6,  hunger:200, glow:true,  rare:false, home:14,
              habitat:'Northern fields', blurb:'Glows softly in the dark — a living lantern with a lot of energy.' },
  honey:    { name:'Honey',    color:'#ffc830', dark:'#d09a10', food:['fruit'], fav:'fruit',
              plort:{ color:'#ffaa00', value:45 },  size:1.0,  speed:0.85, hopRate:1.0,  hunger:260, glow:false, rare:false, home:10,
              habitat:'The Orchard', blurb:'Collects pollen on its antennae and smells of warm toast.' },
  bubble:   { name:'Bubble',   color:'#9fd6ff', dark:'#4f93c9', food:['fruit','carrot'], fav:'fruit',
              plort:{ color:'#7fc8ff', value:36 },  size:0.95, speed:0.8,  hopRate:1.0,  hunger:250, glow:false, rare:false, home:8,
              habitat:'The pond shore', blurb:'Drifts along the sand and pops tiny happy bubbles when it hops.' },
  mint:     { name:'Mint',     color:'#8fe3b8', dark:'#4fa87c', food:['carrot','cubery'], fav:'carrot', hungerRate:0.6,
              plort:{ color:'#5fe0a0', value:22 },  size:0.95, speed:1.0,  hopRate:1.3,  hunger:300, glow:false, rare:false, home:11,
              habitat:'The sunny garden meadow', blurb:'Smells like fresh leaves. A calm slime — it takes its time getting hungry.' },
  crystal:  { name:'Crystal',  color:'#a0e8ff', dark:'#50a8d0', food:['carrot','meat','heartbeet','cubery','fruit'], fav:'fruit',
              plort:{ color:'#c0f8ff', value:160 }, size:1.05, speed:0.5,  hopRate:0.8,  hunger:340, glow:true,  rare:true,  home:5,
              habitat:'The Crystal Cave', blurb:'Rare and shy. Eats anything, but only shares a glimmer once in a while.' },
  star:     { name:'Star',     color:'#7b6cf0', dark:'#3f3496', food:['cubery','fruit'], fav:'cubery',
              plort:{ color:'#ffd54a', value:210 }, size:1.0,  speed:0.6,  hopRate:0.9,  hunger:360, glow:true,  rare:true,  home:6, event:true,
              habitat:'Falls from the sky on starry nights', blurb:'Sometimes a shooting star brings a friend. It wanders off at dawn — be quick!' },
  spore:    { name:'Spore',    color:'#c9a0f0', dark:'#8a5fc0', food:['truffle','cubery'], fav:'truffle',
              plort:{ color:'#b070ff', value:52 },  size:1.0,  speed:0.8,  hopRate:1.0,  hunger:270, glow:true,  rare:false, home:9,
              habitat:'Mushroom Grove', blurb:'Wears a spotted cap and puffs tiny glowing spores whenever it hops.' },
  puff:     { name:'Puff',     color:'#fff1c0', dark:'#d2b25a', food:['carrot','truffle'], fav:'truffle',
              plort:{ color:'#ffe27a', value:38 },  size:0.9,  speed:0.95, hopRate:1.4,  hunger:220, glow:false, rare:false, home:13,
              habitat:'Sunny Prairie', blurb:'A fluffy seed-head slime. A strong breeze sends it floating away.' },
  breeze:   { name:'Breeze',   color:'#cfe9ff', dark:'#7fa9d6', food:['heartbeet','cubery'], fav:'cubery',
              plort:{ color:'#8fd0ff', value:68 },  size:0.95, speed:1.3,  hopRate:1.7,  hunger:260, glow:false, rare:false, home:15,
              habitat:'Windy Fields', blurb:'Light as a cloud. It zips around whenever the wind picks up.' },
  shell:    { name:'Shell',    color:'#ffc9b0', dark:'#c8805e', food:['kelp','meat'], fav:'kelp', hungerRate:0.8,
              plort:{ color:'#ff9f80', value:58 },  size:1.05, speed:0.7,  hopRate:0.85, hunger:300, glow:false, rare:false, home:10,
              habitat:'Sunny Shore', blurb:'Carries a spiral shell on its back. Press an ear to it and you hear the sea.' },
  frost:    { name:'Frost',    color:'#c8f1ff', dark:'#5fb0d8', food:['frostberry','carrot'], fav:'frostberry',
              plort:{ color:'#8fe0ff', value:62 },  size:1.0,  speed:0.85, hopRate:1.1,  hunger:270, glow:true,  rare:false, home:12,
              habitat:'Frostpeak', blurb:'Wears a crown of ice crystals. Cool to the touch, warm in the heart.' },
  flurry:   { name:'Flurry',   color:'#f4f8ff', dark:'#9ab0d0', food:['pinenut','frostberry'], fav:'pinenut',
              plort:{ color:'#e0ecff', value:48 },  size:0.92, speed:1.0,  hopRate:1.5,  hunger:240, glow:false, rare:false, home:14,
              habitat:'Frostpeak', blurb:'Knitted its own hat and scarf. Bounces through every snowdrift.' },
  glacier:  { name:'Glacier',  color:'#8fd0e8', dark:'#3a80a8', food:['frostberry','heartbeet'], fav:'heartbeet', hungerRate:0.8,
              plort:{ color:'#5fc0e8', value:84 },  size:1.1,  speed:0.6,  hopRate:0.8,  hunger:320, glow:false, rare:false, home:9,
              habitat:'Frostpeak', blurb:'Slow, heavy and very calm. Ice blocks ride on its shoulders.' },
  ember:    { name:'Ember',    color:'#ffb070', dark:'#d06a30', food:['pinenut','meat'], fav:'meat',
              plort:{ color:'#ff8a3a', value:78 },  size:1.0,  speed:0.9,  hopRate:1.2,  hunger:250, glow:true,  rare:false, home:11,
              habitat:'Frostpeak', blurb:'Keeps itself warm with tiny flames. Snow melts wherever it sleeps.' },
  aurora:   { name:'Aurora',   color:'#b0a0ff', dark:'#6a60c0', food:['frostberry','fruit'], fav:'fruit',
              plort:{ color:'#7affc0', value:90 },  size:1.0,  speed:0.95, hopRate:1.0,  hunger:290, glow:true,  rare:false, home:13,
              habitat:'Frostpeak', blurb:'Ribbons of green and violet light float above its head.' },
  coral:    { name:'Coral',    color:'#f0707e', dark:'#b8445a', food:['kelp','fruit'], fav:'fruit',
              plort:{ color:'#ff5f7a', value:82 },  size:1.0,  speed:0.75, hopRate:0.95, hunger:300, glow:false, rare:false, home:10,
              habitat:'Reef Cove', blurb:'Grows tiny antlers of coral. Shy at low tide, cheerful when the waves return.' }
};

/* ---------------------------------------------------------------------
   HYBRIDS — two different, delighted slimes living together in a corral can share an egg. The egg hatches into a hybrid
   with its own look, a bigger glimmer value and the diet of both parents. Hybrids never spawn in the wild.
   --------------------------------------------------------------------- */
const HYBRIDS = [
  { id:'blossom',   name:'Blossom',   a:'pink',    b:'honey',  color:'#ffb08a', dark:'#d9764f', pc:'#ff9a6a', value:40,  blurb:'Smells like peach tea. Cannot stop humming.' },
  { id:'cobble',    name:'Cobble',    a:'tabby',   b:'rock',   color:'#b89a78', dark:'#7e6850', pc:'#a8865a', value:85,  blurb:'Stubborn like a rock, curious like a cat.' },
  { id:'glowleaf',  name:'Glowleaf',  a:'phosphor', b:'mint',  color:'#9af0b8', dark:'#4fb87c', pc:'#6aff9a', value:120, blurb:'A garden lantern that always smells of mint.' },
  { id:'fizz',      name:'Fizz',      a:'pink',    b:'bubble', color:'#e0a0f0', dark:'#a860c0', pc:'#d080ff', value:55,  blurb:'Hiccups tiny bubbles when it is happy.' },
  { id:'marmalade', name:'Marmalade', a:'honey',   b:'tabby',  color:'#f0a040', dark:'#b8681c', pc:'#ff8a1c', value:70,  blurb:'Sticky, sleepy and very orange.' },
  { id:'dewdrop',   name:'Dewdrop',   a:'crystal', b:'bubble', color:'#b0f0f0', dark:'#58b8c8', pc:'#8ff0ff', value:190, blurb:'Sparkles like morning dew, and just as shy.' }
];
HYBRIDS.forEach(h => {
  const A = SLIMES[h.a], B = SLIMES[h.b];
  SLIMES[h.id] = { name:h.name, color:h.color, dark:h.dark, food:[...new Set([...A.food, ...B.food])], fav:A.fav, hungerRate:Math.min(A.hungerRate || 1, B.hungerRate || 1) < 1 ? 0.8 : 1,
    plort:{ color:h.pc, value:h.value }, size:(A.size + B.size) / 2, speed:(A.speed + B.speed) / 2, hopRate:(A.hopRate + B.hopRate) / 2, hunger:Math.round((A.hunger + B.hunger) / 2),
    glow:A.glow || B.glow, rare:false, home:10, hybrid:[h.a, h.b], habitat:'Born in a corral', blurb:h.blurb };
});
const hybridFor = (t1, t2) => HYBRIDS.find(h => (h.a === t1 && h.b === t2) || (h.a === t2 && h.b === t1));
const BREED_TIME = 10, BREED_RANGE = 70, EGG_HATCH = 60, EGG_COOLDOWN = 90;    // seconds of play time

// things you find while exploring (sold at the market for a fixed price)
const TREASURES = {
  starshard: { name:'Star Shard', hint:'Something falls from the sky on clear nights…', color:'#ffd54a', value:70, blurb:'A sliver of a fallen star. Still warm to the touch.' },
  pearl:     { name:'Moon Pearl', color:'#f6eef7', value:45, blurb:'Smooth, pale and a little bit glowy.' },
  amber:     { name:'Sunset Amber', color:'#f2a31b', value:55, blurb:'Something tiny has been napping inside for a very long time.' },
  relic:     { name:'Old Coin', color:'#d4b64a', value:95, blurb:'From a meadow that was here long before the ranch.' },
  // from digging, chests and sky orbs
  skystone:      { name:'Sky Stone',        color:'#9ac8ff', value:90,  hint:'Catch a floating sky orb — bounce high!', blurb:'Light as a feather, and it hums when you jump.' },
  tidegem:       { name:'Tide Gem',         color:'#33d6c8', value:110, hint:'Hidden in the chests on the pond islands.', blurb:'Cool to the touch, like a tiny wave.' },
  // dropped by Jumbo slimes
  heartstone:    { name:'Heartstone',       color:'#ff5c9a', value:240, hint:'A pink Jumbo might pop with it…', blurb:'Warm, a little squishy-looking, but very much stone.' },
  goldenwhisker: { name:'Golden Whisker',   color:'#ffd54a', value:260, hint:'A Tabby Jumbo guards one.', blurb:'Purrs very quietly when you hold it.' },
  geode:         { name:'Dreaming Geode',   color:'#9a6af0', value:280, hint:'A Rock Jumbo is sitting on one.', blurb:'Crack it open and the night sky is inside.' },
  glowpearl:     { name:'Glowcap Pearl',    color:'#58d880', value:320, hint:'A Phosphor Jumbo glows with it.', blurb:'Lights up your pockets from the inside.' },
  honeycrown:    { name:'Honeycomb Crown',  color:'#ffb81c', value:300, hint:'Ask the Honey Jumbo nicely.', blurb:'Sticky. Surprisingly regal.' },
  tidepearl:     { name:'Tide Pearl',       color:'#5fb4e8', value:290, hint:'The pond shore Jumbo knows.', blurb:'You can hear the pond in it.' },
  evergreen:     { name:'Evergreen Sprig',  color:'#3fb36a', value:270, hint:'A Mint Jumbo near the garden.', blurb:'Never wilts. Smells like spring.' },
  prism:         { name:'Prism Shard',      color:'#a8c8e8', value:400, hint:'Deep in the Crystal Cave…', blurb:'Splits a sunbeam into every colour.' },
  // v5: dropped by the new Jumbos
  moonshroom:    { name:'Moonshroom Cap',   color:'#b890ff', value:310, hint:'A Spore Jumbo in the Mushroom Grove…', blurb:'Glows softly. Smells like rain on moss.' },
  dandygold:     { name:'Dandelion Gold',   color:'#ffe27a', value:280, hint:'A Puff Jumbo out on the prairie…', blurb:'Make a wish and blow. It stays put, though.' },
  galecrystal:   { name:'Gale Crystal',     color:'#9fe0ff', value:330, hint:'A Breeze Jumbo in the windy fields…', blurb:'A tiny storm is spinning inside.' },
  singingconch:  { name:'Singing Conch',    color:'#ffb8a0', value:340, hint:'A Shell Jumbo on the shore…', blurb:'It hums a lullaby when the tide turns.' },
  reefheart:     { name:'Reef Heart',       color:'#ff6f8e', value:360, hint:'A Coral Jumbo guards one in the cove…', blurb:'Warm, and it beats very slowly.' },
  // v5: washed up on the beach (low tide, tide pools, bottles, digging in the sand)
  seaglass:      { name:'Sea Glass',        color:'#7fe0cf', value:60,  hint:'Dig on the beach, or explore at low tide.', blurb:'Worn smooth by a thousand waves.' },
  sanddollar:    { name:'Sand Dollar',      color:'#f4e6c8', value:75,  hint:'Hidden in the tide pools at low tide.', blurb:'A tiny star is carved into it.' },
  // v6: Frostpeak
  icicle:        { name:'Glass Icicle',     color:'#8fdcff', value:85,  hint:'Dig in the snow on Frostpeak.', blurb:'It never melts, and it rings when you flick it.' },
  snowglobe:     { name:'Snow Globe',       color:'#eaf6ff', value:130, hint:'Snowdrift gifts appear on Frostpeak after the weather turns.', blurb:'A tiny pine tree. It is always snowing in there.' },
  auroradust:    { name:'Aurora Dust',      color:'#a89cff', value:160, hint:'Ice chests open during Aurora Night.', blurb:'Shimmers green, blue and violet in your palm.' },
  emberstone:    { name:'Ember Stone',      color:'#ff8a2a', value:110, hint:'Found in aurora chests and deep snow.', blurb:'Still warm. It has been warm for a thousand winters.' },
  glaciersoul:   { name:'Glacier Soul',     color:'#7fd0f8', value:380, hint:'A Glacier Jumbo guards one on Frostpeak…', blurb:'Heart-shaped ice with a snowflake inside.' },
  driftbottle:   { name:'Drift Bottle',     color:'#9ad0b0', value:120, hint:'Bottles wash ashore after the rain.', blurb:'There is a note inside. It says: “Thank you for the slimes.”' }
};

/* ---------------------------------------------------------------------
   JUMBOS — big, fixed slimes. Feed one the food its kind eats (throw it!) and it swells… nobody
   knows how much food it wants (always more than 20). When it finally pops it showers you with
   treasure and a permanent POWER, then regrows 20–30 minutes later.
   --------------------------------------------------------------------- */
const JUMBOS = [
  { id:'pink',     x:44, y:22, power:'springy',     treasure:'heartstone' },
  { id:'tabby',    x:310, y:60, power:'featherfall', treasure:'goldenwhisker' },
  { id:'rock',     x:33, y:60, power:'sturdy',      treasure:'geode' },
  { id:'phosphor', x:335, y:20, power:'glowsense',   treasure:'glowpearl' },
  { id:'honey',    x:270, y:30, power:'pollen',      treasure:'honeycrown' },
  { id:'bubble',   x:104, y:92, power:'skipping',    treasure:'tidepearl' },
  { id:'mint',     x:275, y:90, power:'calm',        treasure:'evergreen' },
  { id:'crystal',  x:72, y:58, power:'prismluck',   treasure:'prism' },
  // v5 — one Jumbo per new area. They stand at least JUMBO_MIN_DIST tiles away from every other Jumbo.
  { id:'spore',    x:126, y:24,  power:'forager',    treasure:'moonshroom' },
  { id:'puff',     x:166, y:78,  power:'lift',       treasure:'dandygold' },
  { id:'breeze',   x:22,  y:104, power:'windstep',   treasure:'galecrystal' },
  { id:'shell',    x:68,  y:124, power:'tideledger', treasure:'singingconch' },
  { id:'coral',    x:148, y:124, power:'reefcharm',  treasure:'reefheart' },
  { id:'glacier',  x:215, y:52,  power:'frostward',  treasure:'glaciersoul' }       // v6 — Frostpeak
];
const JUMBO_MIN_DIST = 38;              // 0.14: ALL fourteen Jumbos keep at least this many tiles from each other (five of the old ones moved out to the new lands)
const LEGACY_JUMBO_SPOTS = [[44, 22], [60, 46], [33, 60], [52, 14], [11, 11], [58, 31], [33, 29], [72, 58]];   // where the first eight stood: the old map keeps clearing boulders there, so older saves see the identical meadow               // tiles — the five new Jumbos keep this distance from each other and from the older eight
const JUMBO_GOAL = [21, 45];            // hidden amount of food, inclusive
const JUMBO_RESPAWN = [1200, 1800];     // seconds (20–30 minutes) of play time
const POWERS = {
  springy:     { name:'Springy Soles',   icon:'🦘', desc:'A second jump in mid-air.' },
  featherfall: { name:'Featherfall',     icon:'🪶', desc:'Hold jump while falling to glide.' },
  sturdy:      { name:'Sturdy Pack',     icon:'🧱', desc:'+2 gulper slots.' },
  glowsense:   { name:'Glow Sense',      icon:'💡', desc:'Glimmering spots shine like beacons and your own light grows.' },
  pollen:      { name:'Pollen Charm',    icon:'🐝', desc:'Crops grow 30% faster and give +1 food.' },
  skipping:    { name:'Skipping Stones', icon:'🫧', desc:'Landing on water bounces you back up — skip across the pond.' },
  calm:        { name:'Calm Aura',       icon:'🌿', desc:'Slimes get hungry 25% slower and petting cools down faster.' },
  prismluck:   { name:'Prism Luck',      icon:'🌈', desc:'Digging and chests give richer finds.' },
  forager:     { name:'Forager\'s Nose', icon:'🍄', desc:'Wild food patches regrow twice as fast.' },
  lift:        { name:'Dandelion Lift',  icon:'🌼', desc:'Every jump is 22% higher.' },
  windstep:    { name:'Windstep',        icon:'🌬️', desc:'Run 15% faster and gulp from a little farther away.' },
  tideledger:  { name:'Tide Ledger',     icon:'🐚', desc:'+10% on everything you sell.' },
  frostward:   { name:'Frostward',       icon:'❄️', desc:'Slimes get hungry 10% slower and you sell for +5%.' },
  reefcharm:   { name:'Reef Charm',      icon:'🪸', desc:'Delighted slimes give two glimmers much more often.' }
};

/* ---------------------------------------------------------------------
   JUMP TOYS — bounce mushrooms launch you high; sky orbs hover above them;
   lily pads and islands in the pond are reached by jumping from pad to pad.
   --------------------------------------------------------------------- */
const BOUNCERS = [
  { x:37, y:33, orbs:[{ dx:0, dy:-34, h:86 }, { dx:36, dy:12, h:94 }] },
  { x:48, y:50, orbs:[{ dx:-30, dy:0, h:90 }] },
  { x:14, y:22, orbs:[{ dx:26, dy:-26, h:92 }, { dx:-30, dy:20, h:80 }] },
  { x:77, y:36, orbs:[{ dx:0, dy:-40, h:94 }] },
  // v5: the Mushroom Grove and the prairie
  { x:112, y:20, orbs:[{ dx:0, dy:-36, h:90 }, { dx:34, dy:14, h:96 }] },
  { x:134, y:38, orbs:[{ dx:-30, dy:0, h:90 }] },
  { x:142, y:14, orbs:[{ dx:24, dy:-26, h:94 }] },
  { x:132, y:94, orbs:[{ dx:0, dy:-38, h:92 }] }
];
const ISLANDS = [{ id:'a', x:64, y:18, w:3, h:3 }, { id:'b', x:74, y:18, w:3, h:3 }, { id:'c', x:69, y:14, w:3, h:2 }];
const LILY_PADS = [[72, 19], [70, 19], [68, 19], [74, 24], [74, 22]];
const CHESTS = [{ id:'a', x:65, y:19, rich:false }, { id:'b', x:75, y:19, rich:false }, { id:'c', x:70, y:14, rich:true }];

/* ---------------------------------------------------------------------
   NPCs — four neighbours with special quests. Finish one and that neighbour has a new request after 10 minutes.
   quest kinds: give (hand in items) · counters (pet, dig, harvest, water, jump, skyorb, chest) · state (delighted, charm, pen)
   --------------------------------------------------------------------- */
const NPC_COOLDOWN = 600;               // seconds of play time
const NPCS = [
  { id:'fern', name:'Old Fern', title:'Garden keeper', cell:0, x:16, y:31, color:'#4caf6a',
    hello:'Oh, hello dear! Things grow nicely when you are patient.',
    quests:[
      { kind:'give', what:'food', key:'heartbeet', amount:8, text:'My kitchen needs 8 Heartbeets for a stew.', reward:{ money:140, treasure:['pearl', 1] } },
      { kind:'harvest', amount:12, text:'Harvest 12 crops from the garden — show them what a green thumb can do.', reward:{ money:170, treasure:['amber', 1] } },
      { kind:'give', what:'food', key:'fruit', amount:6, text:'Could you spare 6 Fruit? My jam jars are empty.', reward:{ money:190, treasure:['tidegem', 1] } },
      { kind:'water', amount:8, text:'Water the plants 8 times, would you? My knees are not what they were.', reward:{ money:130, treasure:['skystone', 1] } }
    ] },
  { id:'pebble', name:'Captain Pebble', title:'Pond explorer', cell:1, x:62, y:28, color:'#2f5fa8',
    hello:'Ahoy! The pond has secrets — and the sky has even more.',
    quests:[
      { kind:'give', what:'treasure', key:'pearl', amount:2, text:'I collect Moon Pearls. Bring me 2 and I will make it worth your while.', reward:{ money:260, treasure:['tidegem', 2] } },
      { kind:'chest', amount:2, text:'Open 2 chests on the pond islands. Jump from lily pad to lily pad!', reward:{ money:230, treasure:['pearl', 2] } },
      { kind:'skyorb', amount:3, text:'Catch 3 floating sky orbs. Bounce mushrooms are your friend!', reward:{ money:240, treasure:['skystone', 2] } },
      { kind:'jump', amount:60, text:'Show me you can jump! 60 hops should do it.', reward:{ money:160, treasure:['amber', 1] } }
    ] },
  { id:'glim', name:'Professor Glim', title:'Slime researcher', cell:2, x:8, y:38, color:'#6aa8ff',
    hello:'Fascinating! Every slime is a tiny mystery. Care to help my research?',
    quests:[
      { kind:'give', what:'plort', key:'pink', amount:6, text:'I need 6 Pink glimmers for a light experiment.', reward:{ money:170, treasure:['relic', 1] } },
      { kind:'pet', amount:15, text:'Pet slimes 15 times. For science. Also because it is nice.', reward:{ money:180, treasure:['pearl', 1] } },
      { kind:'give', what:'plort', key:'honey', amount:4, text:'4 Honey glimmers, please — I want to test their warmth.', reward:{ money:210, treasure:['amber', 2] } },
      { kind:'delighted', amount:3, text:'Have 3 delighted slimes at the same time. Then come tell me how!', reward:{ money:250, treasure:['starshard', 1] } }
    ] },
  { id:'tess', name:'Tinker Tess', title:'Ranch tinkerer', cell:3, x:31, y:44, color:'#e8833a',
    hello:'Oh good, an extra pair of hands! The ranch is never quite finished.',
    quests:[
      { kind:'charm', amount:6, text:'Decorate until your ranch has 6 charm. It needs some character!', reward:{ money:200, treasure:['relic', 1] } },
      { kind:'give', what:'food', key:'meat', amount:6, text:'I am testing feeders — 6 pieces of Meat, please.', reward:{ money:190, treasure:['amber', 1] } },
      { kind:'dig', amount:4, text:'Dig up 4 glimmering spots — I love old bits and bobs.', reward:{ money:200, treasure:['skystone', 2] } },
      { kind:'pen', amount:4, text:'Get 4 slimes living in one corral. A proper little herd!', reward:{ money:260, treasure:['geode', 1] } }
    ] },
  { id:'bram', name:'Bramble', title:'Mushroom forager', cell:4, x:117, y:31, color:'#9a6ad0',
    hello:'Shh — listen. The grove is humming today. Have you got a moment, friend?',
    quests:[
      { kind:'give', what:'food', key:'truffle', amount:8, text:'I am drying 8 Truffles for the winter. Could you dig up a few?', reward:{ money:240, treasure:['pearl', 1] } },
      { kind:'bounce', amount:12, text:'Bounce on the grove mushrooms 12 times. They like being stepped on, I promise.', reward:{ money:200, treasure:['skystone', 1] } },
      { kind:'give', what:'plort', key:'spore', amount:4, text:'I need 4 Spore glimmers. They make the best lanterns.', reward:{ money:280, treasure:['amber', 2] } },
      { kind:'delighted', amount:4, text:'Make 4 slimes delighted at the same time. Mushrooms grow better near happy things.', reward:{ money:300, treasure:['starshard', 1] } }
    ] }
];

// garden: seeds cost money, the harvest is 3 food
const CROPS = {
  carrot:    { seed:3, time:70 },
  heartbeet: { seed:4, time:85 },
  cubery:    { seed:5, time:95 },
  fruit:     { seed:6, time:115 }
};
const GROW_RAIN_MULT = 2.0, GROW_WET_MULT = 1.6;

/* ---------------------------------------------------------------------
   SEASONS — 7 days each. The season's crop grows 1.5x faster (winter slows the others), its slimes' glimmers sell for +25%,
   and there is weather and falling scenery to match. Winter precipitation is snow.
   Events: Harvest Festival (autumn, day 4) and Star Night (winter, day 4) — they repeat every 28 days.
   --------------------------------------------------------------------- */
const SEASON_DAYS = 7;
const SEASONS = [
  { id:'spring', name:'Spring', icon:'🌸', crop:'carrot',    slimes:['mint', 'pink'],     tint:[255, 190, 215, 0.05], fx:'petal', blurb:'Soft rain and blossoms.' },
  { id:'summer', name:'Summer', icon:'☀️', crop:'fruit',     slimes:['honey', 'bubble'],  tint:[255, 214, 90, 0.07],   fx:'pollen', blurb:'Long, golden days.' },
  { id:'autumn', name:'Autumn', icon:'🍂', crop:'heartbeet', slimes:['tabby', 'rock'],    tint:[255, 140, 50, 0.10],   fx:'leaf', blurb:'Falling leaves and a big harvest.' },
  { id:'winter', name:'Winter', icon:'❄️', crop:'cubery',    slimes:['crystal', 'phosphor'], tint:[200, 225, 255, 0.13], fx:'snow', blurb:'Snow, slow gardens and starry nights.' }
];
const SEASON_EVENTS = { harvest:{ season:2, day:4, name:'Harvest Festival', icon:'🎪' }, star:{ season:3, day:4, name:'Star Night', icon:'🌠' } };

// ranch decorations — every point of charm makes slimes happier
const DECOR_ITEMS = {
  lantern:   { name:'Lantern',        cost:40,  charm:1, cell:0, light:140, blurb:'Glows warmly at night.' },
  flowerbed: { name:'Flower Bed',     cost:25,  charm:1, cell:1, blurb:'Bees approve.' },
  bench:     { name:'Bench',          cost:55,  charm:2, cell:2, blurb:'For watching slimes hop.' },
  mushlamp:  { name:'Mushroom Lamp',  cost:70,  charm:2, cell:3, light:115, blurb:'A cosy red glow after dark.' },
  banner:    { name:'Pennant',        cost:45,  charm:1, cell:4, blurb:'Very festive.' },
  statue:    { name:'Slime Statue',   cost:120, charm:4, cell:5, blurb:'It looks proud of you.' },
  heartlantern: { name:'Heart Lantern', cost:0,   charm:6, cell:6, light:240, noSale:true, blurb:'The meadow\'s old lantern, lit again. Story reward.' },
  sandcastle:   { name:'Sandcastle',    cost:90,  charm:3, cell:7, blurb:'Somebody tiny lives here.' },
  glowshroom:   { name:'Glowshroom Lamp', cost:85, charm:2, cell:8, light:135, blurb:'A cool blue glow after dark.' }
};
const MAX_DECOR = 30;

// places for the codex (rect = tile bounds, or circle for the pond)
const PLACES = {
  ranch:   { name:'The Ranch',     icon:'🏡', blurb:'Home sweet home. Corrals, a path and a lot of hopping.' },
  shop:    { name:'The Market',    icon:'🏪', blurb:'Sells food and buys everything you find.' },
  garden:  { name:'The Garden',    icon:'🥕', blurb:'Six little plots. Plant, water, wait, harvest.' },
  orchard: { name:'The Orchard',   icon:'🌳', blurb:'Fruit trees and sleepy honey slimes.' },
  pond:    { name:'The Pond',      icon:'💧', blurb:'Sandy shores where bubble slimes drift about.' },
  cave:    { name:'Crystal Cave',  icon:'💎', blurb:'Dark, sparkly and very quiet.' },
  grove:   { name:'Mushroom Grove', icon:'🍄', blurb:'Giant mushrooms, glowing moss and a forager who talks to them.' },
  prairie: { name:'Sunny Prairie', icon:'🌼', blurb:'Wide, warm and full of floating seeds.' },
  fields:  { name:'Windy Fields',  icon:'🌬️', blurb:'Open fields where the breeze never really stops.' },
  beach:   { name:'Sunny Shore',   icon:'🏖️', blurb:'Warm sand, tide pools and a sea that comes and goes.' },
  far:     { name:'Far Meadow',    icon:'🌾', blurb:'Golden grass as far as you can see, and four old Jumbos who moved out here for the quiet.' },
  peak:    { name:'Frostpeak',     icon:'🏔️', blurb:'Snowy pines, ice ponds and an aurora that shows up every fifth night.' }
};

/* ---------------------------------------------------------------------
   AREAS (v5) — big rectangles (in tiles) in the three new quarters of the world. Used for labels, codex places,
   dig loot, wild slimes and the beach events.  The original 90x70 map is the top-left quarter.
   --------------------------------------------------------------------- */
const AREAS = {
  grove:   { x:100, y:4,   w:56,  h:46, label:'🍄 Mushroom Grove' },
  prairie: { x:94,  y:74,  w:80,  h:36, label:'🌼 Sunny Prairie' },
  fields:  { x:4,   y:74,  w:84,  h:34, label:'🌬️ Windy Fields' },
  beach:   { x:6,   y:112, w:238, h:26, label:'🏖️ Sunny Shore' },
  peak:    { x:184, y:4,   w:62,  h:104, label:'🏔️ Frostpeak' },
  far:     { x:252, y:4,   w:94,  h:104, label:'🌾 Far Meadow' }
};
const BEACH_TOP = 113;                                              // first sand row of the beach
const seaLine = x => Math.round(128 + 2 * Math.sin(x * 0.15) + 1.5 * Math.sin(x * 0.37));   // first sea row at column x (a gently wavy shoreline)
const TIDE_ROWS = 4;                                                // sea rows that dry out at low tide
// Beach events: Low Tide (scheduled) and Drift Bottles (after rain). Low tide is out during daylight on day 3 of every 6.
const LOW_TIDE = { cycle: 6, day: 3, from: 0.28, to: 0.78, extraSpots: 8 };
const BOTTLE = { maxOnBeach: 2 };
const TIDE_CHESTS = [34, 66, 112, 142];                              // x of the tide-pool chests (they only exist while the tide is out)
const BEACH_LOOT = ['seaglass', 'seaglass', 'sanddollar', 'pearl', 'amber'];
// Frostpeak events: Aurora Night (every 5th day, after dusk) opens ice chests and shows the aurora; snowdrift gifts appear when the weather ends.
const AURORA = { cycle: 5, day: 4, from: 0.78, extraSpots: 6 };
const AURORA_CHESTS = [[200, 30], [229, 66], [211, 94]];                // tile positions of the ice chests
const AURORA_LOOT = ['auroradust', 'auroradust', 'emberstone', 'icicle', 'snowglobe'];
const SNOW_GIFT = { maxOnPeak: 2 };

const FOODS = {
  carrot:    { name:'Carrot',    color:'#ff9540', price:5 },
  meat:      { name:'Meat',      color:'#c85050', price:8 },
  heartbeet: { name:'Heartbeet', color:'#b04080', price:6 },
  cubery:    { name:'Cubery',    color:'#8855dd', price:7 },
  fruit:     { name:'Fruit',     color:'#ff5577', price:9 },
  truffle:   { name:'Truffle',   color:'#7a5a44', price:10 },
  frostberry:{ name:'Frostberry',color:'#3a6ad0', price:9 },
  pinenut:   { name:'Pine Nut',  color:'#9a6a3a', price:8 },
  kelp:      { name:'Kelp',      color:'#2f9a6a', price:8 },
  treat:     { name:'Slime Treat', color:'#ff9ecb', price:10, treat:true }   // any slime loves it: big joy boost, no glimmer
};

const UPGRADES = {
  speed:   { name:'Speed Boots',      icon:'👢', max:3, base:40,  desc:'Run faster' },
  vac:     { name:'Gulper Power',     icon:'🌀', max:3, base:50,  desc:'Longer suction range' },
  pack:    { name:'Pack Space',       icon:'🎒', max:3, base:60,  desc:'+1 gulper slot' },
  nozzle:  { name:'Wide Nozzle',      icon:'📡', max:3, base:70,  desc:'Wider suction cone' },
  pockets: { name:'Deep Pockets',     icon:'👝', max:3, base:90,  desc:'+10 items per gulper slot' },
  throw:   { name:'Strong Throw',     icon:'💪', max:3, base:60,  desc:'Throw things farther' },
  shovel:  { name:'Lucky Shovel',     icon:'🍀', max:3, base:80,  desc:'Better finds when digging' },
  gloves:  { name:'Garden Gloves',    icon:'🧤', max:2, base:90,  desc:'+1 food per harvest' },
  haggler: { name:"Haggler's Ledger", icon:'📒', max:3, base:110, desc:'+6% on everything you sell' },
  touch:   { name:'Gentle Touch',     icon:'💗', max:2, base:70,  desc:'Petting gives more joy, faster' }
};
const UPGRADE_KEYS = Object.keys(UPGRADES);

// one-time gear
const GEAR = {
  compass:   { name:'Treasure Compass', icon:'🧭', cost:150, desc:'An arrow points to the nearest glimmering spot' },
  sprinkler: { name:'Auto-Sprinkler',   icon:'💦', cost:220, desc:'Keeps every garden plot watered' },
  charm:     { name:'Lucky Charm',      icon:'🔮', cost:200, desc:'Shooting stars come more often and bring Star slimes more often' },
  lantern:   { name:'Night Lantern',    icon:'🏮', cost:120, desc:'Your own light reaches much farther after dark' }
};

/* ---------------------------------------------------------------------
   RANCH + CORRALS
   The ranch floor holds four corral lots (A–D) and a fifth lot sits in the east yard.
   Each lot reserves room for the biggest pen size, so upgrading never collides with a neighbour.
   --------------------------------------------------------------------- */
const RANCH = { x: 10, y: 35, w: 19, h: 17 };
const CORRAL_LOTS = [
  { id: 0, name: 'Home Corral',  x: 11, y: 36, price: 0 },
  { id: 1, name: 'East Corral',  x: 20, y: 36, price: 200 },
  { id: 2, name: 'South Corral', x: 11, y: 44, price: 350 },
  { id: 3, name: 'Back Corral',  x: 20, y: 44, price: 550 },
  { id: 4, name: 'Yard Corral',  x: 35, y: 36, price: 800 }
];
const CORRAL_SIZES = [ { w: 6, h: 5, cap: 6 }, { w: 7, h: 6, cap: 8 }, { w: 8, h: 7, cap: 10 } ];
const CORRAL_UPGRADES = {
  size:    { name:'Roomier Pen',    icon:'📐', max:2, costs:[120, 260], desc:lv => `Bigger pen · holds ${CORRAL_SIZES[Math.min(2, lv + 1)].cap} slimes` },
  feeder:  { name:'Auto-Feeder',    icon:'🥣', max:3, costs:[90, 180, 320], cap:[0, 6, 12, 20], every:[0, 6, 4, 2.5],
             desc:lv => `Drops food for hungry slimes · stock ${[6, 12, 20][lv]} · every ${[6, 4, 2.5][lv]}s` },
  basket:  { name:'Glimmer Basket', icon:'🧺', max:2, costs:[110, 240], cap:[0, 15, 40], desc:lv => `Catches glimmers made inside · holds ${[15, 40][lv]}` },
  bedding: { name:'Cosy Bedding',   icon:'🛏️', max:2, costs:[100, 220], joy:[0, 0.8, 1.4], top:[0, 60, 80], desc:lv => `Slimes here slowly grow happy (up to ${[60, 80][lv]} joy)` }
};
const FENCE_STYLES = [
  { id:'wood',   name:'Wooden',       cost:0,   post:'#5a3818', rail:'#8b5a2b', plank:'#a8703c' },
  { id:'picket', name:'White picket', cost:50,  post:'#d8d2c4', rail:'#f4efe4', plank:'#ffffff' },
  { id:'stone',  name:'Mossy stone',  cost:90,  post:'#6e6a64', rail:'#8e8a82', plank:'#a6a299', moss:true },
  { id:'candy',  name:'Candy',        cost:130, post:'#d6457f', rail:'#ff8fb8', plank:'#fff2f8', stripe:'#ff6b9d' }
];

/* ---------------------------------------------------------------------
   ASSET MANIFEST
   --------------------------------------------------------------------- */
const SLIME_CELL = 96;                       // slime sheets: 6 frames of 96x96 in one row
const SLIME_FRAME = { IDLE: 0, SQUASH: 1, STRETCH: 2, HAPPY: 3, SAD: 4, SURPRISED: 5 };
const PLAYER_CELL = 96;                      // player.png: 4 walk frames x 3 rows (0 = down, 1 = up, 2 = side, faces right)
const ATLAS_VARIANTS = 4;
const ATLAS_COLS = 16;                       // tiles.png columns = tile ids (10 and 11 unused)
const PARTICLE_CELL = 32;                    // particles.png cells: 0 spark, 1 puff, 2 ring, 3 coin, 4 heart, 5 leaf
const PART = { spark: 0, puff: 1, ring: 2, coin: 3, heart: 4, leaf: 5 };
const DECOR_CELL = 48;                       // decor.png cells: flowerR, flowerY, flowerW, tuft, mushroom, glow mushroom, bush, reeds
const DECOR = { flowerR: 0, flowerY: 1, flowerW: 2, tuft: 3, mushroom: 4, glowShroom: 5, bush: 6, reeds: 7 };

const IMAGE_FILES = {
  tiles:     'assets/images/tiles.png',      // 896x256 atlas: 14 tile columns (id = column; 10 and 11 unused) x 4 variants (rows), 64px
  water:     'assets/images/water.png',      // 256x64: 4 animation frames of water
  overlays:  'assets/images/overlays.png',   // 192x64: [grass fringe][shore foam][edge shade] (drawn for the TOP edge, rotated in code)
  decor:     'assets/images/decor.png',      // 384x48: flowers, grass tuft, mushrooms, bush, reeds
  fence:     'assets/images/fence.png',      // 192x64: [horizontal][vertical][post]
  sign:      'assets/images/sign.png',       // 64x64 corral sign
  player:    'assets/images/player.png',     // 384x288 (see PLAYER_CELL)
  shop:      'assets/images/shop.png',       // 192x144
  tree:      'assets/images/tree.png',       // 64x80
  crystal:   'assets/images/crystal.png',    // 40x48
  boulder:   'assets/images/boulder.png',    // 48x40
  shadow:    'assets/images/shadow.png',     // 64x32 soft blob shadow
  particles: 'assets/images/particles.png',  // 192x32 (see PART)
  reticle:   'assets/images/reticle.png',    // 64x64 crosshair
  logo:      'assets/images/logo.png',       // 640x200
  menu_bg:   'assets/images/menu_bg.png',    // 1600x900 menu backdrop (also set from CSS)
  glow:      'assets/images/glow.png'        // 128x128 white radial gradient (lights, fireflies)
};
Object.keys(SLIMES).forEach(id => {
  IMAGE_FILES['slime_' + id] = 'assets/images/slimes/' + id + '.png';   // 576x96 sheet
  IMAGE_FILES['plort_' + id] = 'assets/images/plorts/' + id + '.png';   // 48x48
});
Object.keys(TREASURES).forEach(id => { IMAGE_FILES['treasure_' + id] = 'assets/images/treasures/' + id + '.png'; });
JUMBOS.forEach(j => { IMAGE_FILES['jumbo_' + j.id] = 'assets/images/jumbos/' + j.id + '.png'; });   // 480x160: 3 frames (calm, happy, stuffed)
IMAGE_FILES.egg = 'assets/images/egg.png';             // 48x48 slime egg (parent colours are drawn on top)
IMAGE_FILES.npcs = 'assets/images/npcs.png';           // 576x96: 5 neighbours + Wren, 96 px cells
IMAGE_FILES.grove = 'assets/images/grove.png';         // 192x80: three giant mushrooms (red, glowing blue, purple), 64x80 cells
IMAGE_FILES.critters = 'assets/images/critters.png';   // 512x64: Bramble Bug, Sand Crab, Gloom Cap, Frost Fang — 2 frames each, 64 px cells (Survival mode)
IMAGE_FILES.peak = 'assets/images/peak.png';           // 256x80: snowy pine, snowy rock, ice crystals, igloo (64x80 cells)
IMAGE_FILES.beach = 'assets/images/beach.png';         // 256x80: palm, sandcastle, driftwood, tide-pool rock, 64x80 cells
IMAGE_FILES.bouncer = 'assets/images/bouncer.png';     // 128x64: rest, squash
IMAGE_FILES.lily = 'assets/images/lily.png';           // 128x64: two lily pads
IMAGE_FILES.skyorb = 'assets/images/skyorb.png';       // 48x48
IMAGE_FILES.chest = 'assets/images/chest.png';         // 128x64: closed, open   // 48x48
IMAGE_FILES.corral_props = 'assets/images/corral_props.png';   // 128x64: 0 feeding trough, 1 glimmer basket
IMAGE_FILES.plot = 'assets/images/plot.png';                 // 256x64: 4 garden stages (tilled, sprout, growing, ripe)
IMAGE_FILES.ranch_decor = 'assets/images/ranch_decor.png';   // 576x64: 9 decorations, see DECOR_ITEMS[].cell
Object.keys(FOODS).forEach(id => {
  IMAGE_FILES['food_' + id] = 'assets/images/foods/' + id + '.png';     // 48x48
});
// HUD / menu art used by index.html and css/style.css (listed here so they are preloaded and checked)
['coin', 'sun', 'moon', 'scroll', 'slime', 'gem', 'basket', 'sfx_on', 'sfx_off', 'music_on', 'music_off', 'boots', 'vacuum', 'backpack', 'cart',
 'panel_wood', 'panel_dark', 'slot', 'slot_sel', 'btn_green', 'btn_red', 'btn_orange', 'btn_gray', 'ribbon'
].forEach(n => { IMAGE_FILES['ui_' + n] = 'assets/images/ui/' + n + '.png'; });

const SFX_FILES = {
  click:'assets/audio/sfx/click.wav',     collect:'assets/audio/sfx/collect.wav',   plort:'assets/audio/sfx/plort.wav',
  shoot:'assets/audio/sfx/shoot.wav',     eat:'assets/audio/sfx/eat.wav',           sell:'assets/audio/sfx/sell.wav',
  upgrade:'assets/audio/sfx/upgrade.wav', quest:'assets/audio/sfx/quest.wav',       error:'assets/audio/sfx/error.wav',
  jump:'assets/audio/sfx/jump.wav',       hop:'assets/audio/sfx/hop.wav',           capture:'assets/audio/sfx/capture.wav',
  achieve:'assets/audio/sfx/achieve.wav', dig:'assets/audio/sfx/dig.wav',           water:'assets/audio/sfx/water.wav',
  boing:'assets/audio/sfx/boing.wav', bigpop:'assets/audio/sfx/bigpop.wav', chest:'assets/audio/sfx/chest.wav',
  pet:'assets/audio/sfx/pet.wav',         plant:'assets/audio/sfx/plant.wav',       star:'assets/audio/sfx/star.wav'
};
const LOOP_FILES  = { suck:'assets/audio/sfx/suck_loop.wav', rain:'assets/audio/sfx/rain_loop.wav' };
const MUSIC_FILES = { day:'assets/audio/music/day.wav', night:'assets/audio/music/night.wav' };

/* ---------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------- */
const $ = s => document.querySelector(s);
const rand = (a, b) => Math.random() * (b - a) + a;
const randi = (a, b) => Math.floor(rand(a, b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const hash2 = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return h - Math.floor(h); };

// 0 = full day, 1 = full night (smooth piecewise curve over the 0..1 day clock; 0.25 = 06:00)
function lerpKeys(keys, t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0] || 1);
      return a.slice(1).map((v, k) => lerp(v, b[k + 1], f));
    }
  }
  return keys[keys.length - 1].slice(1);
}
const NIGHT_KEYS = [[0, 1], [0.2, 1], [0.34, 0], [0.68, 0], [0.8, 1], [1, 1]];
const nightAmount = t => lerpKeys(NIGHT_KEYS, t)[0];
const AMBIENT_KEYS = [                       // [t, r, g, b, alpha] of the colour overlay
  [0, 12, 16, 56, 0.62], [0.2, 12, 16, 56, 0.62], [0.27, 255, 160, 90, 0.2], [0.34, 255, 220, 160, 0],
  [0.68, 255, 255, 255, 0], [0.75, 255, 120, 60, 0.25], [0.82, 12, 16, 56, 0.62], [1, 12, 16, 56, 0.62]
];
const ambientAt = t => lerpKeys(AMBIENT_KEYS, t);

/* ---------------------------------------------------------------------
   PRICE TUNING (0.10.1) — everything you BUY costs 3× the old price (+200%), except the farm (garden seeds).
   Selling prices are untouched. Change BUY_MULT, or set a category to true in BUY_EXEMPT, to retune in one place.
   Categories: seeds (always exempt = the farm), food, upgrades, gear, decor, corrals, corralUpgrades, fences.
   --------------------------------------------------------------------- */
const BUY_MULT = 3;
const BUY_EXEMPT = { seeds: true };
(function applyBuyPrices() {
  if (BUY_MULT === 1) return;
  const m = (cat, n) => (BUY_EXEMPT[cat] || !n) ? n : Math.round(n * BUY_MULT);
  for (const k in UPGRADES) UPGRADES[k].base = m('upgrades', UPGRADES[k].base);
  for (const k in GEAR) GEAR[k].cost = m('gear', GEAR[k].cost);
  for (const k in DECOR_ITEMS) DECOR_ITEMS[k].cost = m('decor', DECOR_ITEMS[k].cost);
  CORRAL_LOTS.forEach(c => { c.price = m('corrals', c.price); });
  for (const k in CORRAL_UPGRADES) CORRAL_UPGRADES[k].costs = CORRAL_UPGRADES[k].costs.map(c => m('corralUpgrades', c));
  FENCE_STYLES.forEach(f => { f.cost = m('fences', f.cost); });
})();
