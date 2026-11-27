'use strict';
/* =====================================================================
   SLIME LIFE (0.11) — every slime is an individual.
   · A name (rename it in ☰ → My slimes), a personality trait, a favourite food from its diet, and a 2% chance of being SHINY.
   · Two delighted slimes of the SAME kind in a pen can share an egg (hybrids still need two different kinds).
     The baby is small, does not make glimmers, and grows up after BABY_TIME seconds. Traits and shininess are inherited.
   · Names, traits and the baby stage are saved with the ranch; older saves give their slimes a name and trait on load.
   ===================================================================== */
const BABY_TIME = 180;                   // seconds of play until a baby is grown
const MAX_SLIMES = 90;                   // no more same-kind eggs beyond this (keeps big ranches smooth)
const SHINY_CHANCE = 0.02;
const SLIME_NAMES = ['Mochi', 'Pip', 'Bean', 'Nibbles', 'Jelly', 'Gumdrop', 'Pudding', 'Biscuit', 'Noodle', 'Marble', 'Waffles', 'Sprout', 'Button', 'Muffin', 'Pebbles', 'Ziggy', 'Dumpling', 'Clover', 'Sugar', 'Bubbles', 'Peanut', 'Toffee', 'Fudge', 'Maple', 'Honeydew', 'Cupcake', 'Sparkle', 'Cocoa', 'Pickle', 'Tiny', 'Boop', 'Squish', 'Wiggles', 'Pancake', 'Cookie', 'Sunny', 'Misty', 'Ripple', 'Daisy', 'Coco', 'Lemon', 'Berry', 'Ginger', 'Olive', 'Poppy', 'Rosie', 'Snickers', 'Taffy', 'Zippy', 'Fluff'];
const TRAITS = {
  playful: { icon: '🎈', name: 'Playful', desc: 'Hops more and loves to be petted (+40% joy from petting).' },
  sleepy:  { icon: '😴', name: 'Sleepy',  desc: 'Hops less and gets hungry 15% slower.' },
  greedy:  { icon: '🍽️', name: 'Greedy',  desc: 'Gets hungry 20% faster; when happy, gives two glimmers more often (+15%).' },
  lucky:   { icon: '🍀', name: 'Lucky',   desc: 'When happy, gives two glimmers more often (+12%).' },
  gentle:  { icon: '🌸', name: 'Gentle',  desc: 'Gains 30% more joy from food, treats and petting.' },
  curious: { icon: '🔍', name: 'Curious', desc: 'Spots food from much farther away.' }
};
const TRAIT_IDS = Object.keys(TRAITS);

const pickOf = a => a[Math.floor(Math.random() * a.length)];
const isBaby = s => s.stage === 'baby';
function eatableFoods(def) { return def.food.filter(f => FOODS[f] && !FOODS[f].treat); }
function lifeInit(s, o = {}) {
  s.name = o.name || pickOf(SLIME_NAMES);
  s.trait = o.trait || pickOf(TRAIT_IDS);
  const foods = eatableFoods(s.def); s.likes = o.likes && foods.includes(o.likes) ? o.likes : pickOf(foods);
  s.shiny = o.shiny !== undefined ? !!o.shiny : Math.random() < SHINY_CHANCE;
  s.stage = o.stage === 'baby' ? 'baby' : 'adult';
  s.growT = s.stage === 'baby' ? (o.growT !== undefined ? o.growT : BABY_TIME) : 0;
  s.named = !!o.named; s.born = o.born || (typeof game !== 'undefined' && game.day) || 1; s.noted = !!o.noted;
  return s;
}
// what a slime inherits from its two parents
function lifeGene(a, b) {
  return {
    trait: Math.random() < 0.85 ? pickOf([a.trait, b.trait]) : pickOf(TRAIT_IDS),
    likes: pickOf([a.likes, b.likes]),
    shiny: Math.random() < SHINY_CHANCE + (a.shiny || b.shiny ? 0.12 : 0)
  };
}

/* ---------------- what traits do ---------------- */
const traitHunger = s => s.trait === 'greedy' ? 1.2 : s.trait === 'sleepy' ? 0.85 : 1;
const traitHop = s => s.trait === 'playful' ? 1.3 : s.trait === 'sleepy' ? 0.7 : 1;
const traitJoy = s => s.trait === 'gentle' ? 1.3 : 1;                                   // food, treats, petting
const traitPet = s => s.trait === 'playful' ? 1.4 : 1;
const traitSight = s => s.trait === 'curious' ? 1.45 : 1;
const lifeBonus = s => (s.trait === 'greedy' ? 0.15 : s.trait === 'lucky' ? 0.12 : 0) + (s.shiny ? 0.25 : 0);   // extra chance of a second glimmer (only when delighted)
const lifeScale = s => isBaby(s) ? 0.62 + 0.38 * (1 - Math.max(0, s.growT) / BABY_TIME) : 1;

/* ---------------- per-frame: growing up, shiny sparkles ---------------- */
let lifeTick = 0;
function updateLife(dt) {
  lifeTick += dt;
  for (const s of game.slimes) {
    if (isBaby(s)) {
      s.growT -= dt;
      if (s.growT <= 0) { s.stage = 'adult'; s.growT = 0; stat('grownUp'); showToast('🌱', `${s.name} grew up!`, `A little ${SLIMES[s.type].name} is all grown now and will start making glimmers.`); Sound.play('collect', 0.6); }
    }
    if (s.shiny) {
      if (!s.noted && nearPlayer(s.x, s.y, 170)) { s.noted = true; stat('shinies'); showToast('✨', `${s.name} is shiny!`, `A very rare ${SLIMES[s.type].name}. Its glimmers are extra lucky.`, true); }
      if (Math.random() < dt * 1.4 && nearPlayer(s.x, s.y, 360)) spawnParticles(s.x + rand(-9, 9), s.y - rand(8, 22), 1, '#fff6a8', { spread: 8, up: 26, life: 0.8, g: 0 });
    }
  }
}
function renameSlime(s, name) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14);
  if (!name || name === s.name) return false;
  s.name = name; if (!s.named) { s.named = true; stat('named'); }
  return true;
}
