'use strict';
/* =====================================================================
   STORY — "The Heart Lantern" (nine chapters, two acts)
   Act I   (1–5)  Strange Lights → the lantern is lit again.
   Act II  (6–9)  Wren's Letters → the Five Sparks → The Sea Remembers → Wren's Last Lantern (you choose the ending).
   You are Wren's grandchild; the four neighbours (and later Bramble) each knew her differently and each has an arc:
     Old Fern    — her oldest friend; has to learn that waiting is not the same as being left.
     Prof. Glim  — studied her slimes for years; learns they are friends, not specimens.
     Capt. Pebble— sailed her away once; carries a secret about why.
     Tinker Tess — built the lantern's clockwork with her; doubts she can finish it alone.
     Bramble     — hears the mushrooms; the grove remembers every autumn Wren visited.
   Steps are handed out one at a time (look for a ★). Step kinds: give (what,key) · counters (harvest, pet, dig, skyorb,
   jump, jumbo, bounce…) · state (charm, delighted, pen, corrals, powers, visit:area, photos) · choice.
   ===================================================================== */
const STORY_PROLOGUE = [
  'The ranch was your grandmother Wren\'s. She raised slimes here for forty years, and she never once called them anything but “my neighbours”.',
  'One spring she packed a trunk, left you the keys and a note: “Keep the lantern lit. I will be back when the meadow is bright.”',
  'The old lantern has been dark ever since — and now strange lights have started to glow at the edge of the meadow after dark.'
];
const STORY = [
  { id: 'c1', title: 'Strange Lights', badge: 'story1',
    intro: 'Something glows at the edge of the meadow after dark. Nobody remembers lighting it.',
    recap: 'The strange glow answered happy slimes and cosy places. It felt warm, and old — and familiar.',
    lore: { title: 'The glow', text: 'Slimes shine a little brighter when they are happy. Wren used to say the meadow itself was keeping a gentle tally.' },
    reward: { money: 300, treasure: ['starshard', 1] },
    steps: [
      { npc: 'fern',   kind: 'harvest', amount: 8, talk: ['You have Wren\'s eyes, dear. She sat on that very fence and talked to the glow, too.'], text: 'The garden glows at night. Harvest 8 crops so I can look under the leaves.', thanks: 'Nothing under the leaves… but the glow is warm. Strange.', reward: { money: 80 } },
      { npc: 'glim',   kind: 'pet', amount: 10, talk: ['Your grandmother let me measure her slimes for years. Never once did she call them “specimens”. I am still working out why.'], text: 'My notes say the lights answer happy slimes. Pet slimes 10 times — for science!', thanks: 'The glow flickered when you petted them. I am sure of it!', reward: { money: 90 } },
      { npc: 'pebble', kind: 'skyorb', amount: 2, talk: ['I sailed Wren to the far shore once. She would not say why. Only that the sea “owed her a favour”.'], text: 'There are lights in the sky as well. Catch 2 sky orbs and tell me if they feel the same.', thanks: 'Same warmth. Something old is waking up.', reward: { money: 100 } },
      { npc: 'tess',   kind: 'charm', amount: 4, talk: ['I built the lantern\'s clockwork with her. It never ran backwards — until the night she left.'], text: 'Whatever it is, it likes cosy places. Decorate until the ranch has 4 charm.', thanks: 'Look at that — the glow settled right by your lantern.', reward: { money: 110 } }
    ] },
  { id: 'c2', title: 'The Whispering Grove', badge: 'story2',
    intro: 'The glow points east, past the pond, toward a forest of giant mushrooms.',
    recap: 'The Mushroom Grove hums at the same pitch as the glow. Its tea speaks of a lantern with a dark heart.',
    lore: { title: 'The Spore', text: 'Spore slimes carry a little cap of the grove on their heads. They drift between the mushrooms at night, carrying small glowing seeds from one to another.' },
    reward: { money: 450, treasure: ['amber', 2] },
    steps: [
      { npc: 'glim',   kind: 'visit', area: 'grove', text: 'Spores drifted in from the east. Walk the east road to the Mushroom Grove and look around.', thanks: 'The Grove! So that is where the spores come from. Fascinating!', reward: { money: 120 } },
      { npc: 'fern',   kind: 'give', what: 'food', key: 'truffle', amount: 6, text: 'Truffles grow only in the grove. Bring me 6 and I will brew a tea that lets us hear the mushrooms.', thanks: 'Mm… the tea says: “the lantern is dark, find its heart”.', reward: { money: 130 } },
      { npc: 'tess',   kind: 'dig', amount: 5, text: 'The tea mentioned old bits and bobs. Dig up 5 glimmering spots — one may be a piece of the lantern.', thanks: 'Not a lantern piece, but a lovely bobble! Keep digging, always.', reward: { money: 120 } },
      { npc: 'pebble', kind: 'give', what: 'treasure', key: 'pearl', amount: 2, text: 'Moon Pearls glow like those spores. Bring me 2 and I will test an old sea-chart theory.', thanks: 'The chart points south, to the sea. Pack your boots!', reward: { money: 150 } }
    ] },
  { id: 'c3', title: 'Salt and Sand', badge: 'story3',
    intro: 'The old chart ends at the Sunny Shore, far to the south.',
    recap: 'The shore sang back. Glass lenses, sticky kelp and Shell glimmers: the lantern is near.',
    lore: { title: 'The Shell', text: 'Shell slimes carry the sound of the sea in their spirals. When the tide goes out they hum — very softly — to call it back.' },
    reward: { money: 600, treasure: ['sanddollar', 2] },
    steps: [
      { npc: 'pebble', kind: 'visit', area: 'beach', text: 'Follow the road south until you smell the sea. Step onto the Sunny Shore and give me a wave!', thanks: 'Ha, I can hear the waves in your pockets. Now the real work.', reward: { money: 140 } },
      { npc: 'tess',   kind: 'give', what: 'treasure', key: 'seaglass', amount: 3, text: 'I need 3 pieces of Sea Glass for a lens. Look on the beach — or dig at low tide.', thanks: 'A perfect lens! Everything looks closer and warmer now.', reward: { money: 150 } },
      { npc: 'fern',   kind: 'give', what: 'food', key: 'kelp', amount: 6, text: 'Bring me 6 Kelp from the shore, dear. It makes a very good glue.', thanks: 'Sticky and sea-smelling. Perfect for mending a lantern.', reward: { money: 150 } },
      { npc: 'glim',   kind: 'give', what: 'plort', key: 'shell', amount: 3, text: 'Shell glimmers hum at the pitch of the lantern. I need 3 of them for my instruments.', thanks: 'There! The lantern is nearby. It wants… Jumbos?', reward: { money: 160 } }
    ] },
  { id: 'c4', title: 'The Jumbo Mystery', badge: 'story4',
    intro: 'The giant slimes carry the lantern\'s light in their crowns. Time to be friends with all of them.',
    recap: 'A Jumbo\'s crown matches the lantern exactly. The ranch is bright, happy, and full of people who care.',
    lore: { title: 'The Jumbos', text: 'Jumbos are not bigger slimes — they are slimes that were loved for a very long time. Wren believed any slime could become one.' },
    reward: { money: 800, treasure: ['heartstone', 1] },
    steps: [
      { npc: 'glim',   kind: 'jumbo', amount: 1, text: 'Feed a Jumbo until it bursts — gently! — and tell me what its power feels like.', thanks: 'Wonderful. The crown glimmers match the lantern exactly.', reward: { money: 200 } },
      { npc: 'tess',   kind: 'corrals', amount: 3, text: 'A big adventure needs a big ranch. Own 3 corrals so the slimes have somewhere to rest.', thanks: 'Now THAT is a ranch. The slimes look so relaxed.', reward: { money: 180 } },
      { npc: 'fern',   kind: 'delighted', amount: 5, text: 'Make 5 slimes delighted at once. The lantern wakes up in glad company.', thanks: 'Oh, look at all those hearts. Warm as toast.', reward: { money: 200 } },
      { npc: 'pebble', kind: 'powers', amount: 4, text: 'Gather 4 Jumbo powers. The lantern only trusts a ranger who can jump, glide and skip.', thanks: 'Four powers! The old sea dogs would be proud.', reward: { money: 220 } }
    ] },
  { id: 'c5', title: 'The Heart Lantern', badge: 'story5',
    intro: 'Everything points to the meadow\'s heart: an old lantern that only needs a little help.',
    recap: 'The Heart Lantern is lit. And inside it, folded small, there is a letter in your grandmother\'s handwriting.',
    lore: { title: 'The lantern', text: 'It is not a lamp. It is a very old promise, made of glass and clockwork: someone will always keep a light on for the slimes.' },
    toast: ['🏮', 'The Heart Lantern shines again!', 'The meadow is bright. Something is folded inside the lantern…'],
    reward: { money: 1500, decor: ['heartlantern', 1] },
    steps: [
      { npc: 'fern',   kind: 'harvest', amount: 20, text: 'The lantern wants a feast. Harvest 20 crops for its table.', thanks: 'A feast fit for the whole meadow!', reward: { money: 250 } },
      { npc: 'pebble', kind: 'powers', amount: 7, text: 'Seven powers, and the sea will carry your name. Gather 7.', thanks: 'Seven! I will have to start telling stories about you.', reward: { money: 300 } },
      { npc: 'glim',   kind: 'photos', amount: 3, text: 'Record the great moment: take 3 photos with photo mode (☰ → Slime Album → Photo mode).', thanks: 'Splendid! Evidence for the journal of the century.', reward: { money: 300 } },
      { npc: 'tess',   kind: 'give', what: 'treasure', key: 'starshard', amount: 3, text: 'Last piece: 3 Star Shards for the lantern\'s heart. They fall from the sky on clear nights.', thanks: 'Hold on… I think the wick just caught. Look at the sky!', reward: { money: 350 } }
    ] },

  /* ---------------------------- ACT II ---------------------------- */
  { id: 'c6', title: 'Wren\'s Letters', badge: 'story6',
    intro: 'In the lit lantern lies a letter from your grandmother. It sends you to her oldest friends, one by one.',
    recap: 'Wren\'s first letter: “The slimes were never alone, and neither were you. Visit my friends. They will tell you the rest.”',
    lore: { title: 'The First Slime', text: 'Wren wrote that the first slime was born when a lantern spark fell into a dewdrop. Every slime since carries a tiny glow of it — that is why they shine when they are happy.' },
    reward: { money: 700, treasure: ['amber', 3] },
    steps: [
      { npc: 'fern',   kind: 'harvest', amount: 12, talk: ['“Start with the garden,” Wren wrote. “Feed my oldest friend first.” That would be me, dear. She planted this garden the day you were born.'], text: 'Harvest 12 crops and we will make her favourite stew.', thanks: 'Her stew! Now I can read you the second line without crying into it.', reward: { money: 150 } },
      { npc: 'tess',   kind: 'dig', amount: 8, talk: ['She mentions a brass key buried “where the slimes like to dig”. Her workshop key! I have been looking for it since she left.'], text: 'Dig up 8 glimmering spots. One of them hides the workshop key.', thanks: 'A brass key with a tiny slime stamped on it! Inside the workshop there is a half-finished lantern… and a note for you.', reward: { money: 160 } },
      { npc: 'glim',   kind: 'photos', amount: 2, talk: ['“Show them to the lantern,” she wrote. I think she means photographs! The lantern is an old camera obscura — it remembers what it sees.'], text: 'Take 2 photos with photo mode and bring them to me.', thanks: 'Look — the lantern lit up the moment I held your photo to it. Wren is in the corner of the picture, waving.', reward: { money: 170 } },
      { npc: 'pebble', kind: 'give', what: 'treasure', key: 'amber', amount: 3, talk: ['Amber catches light the way slimes do. Wren paid me in amber once. I kept every piece. Now I know why she did.'], text: 'Bring me 3 Sunset Amber. I will grind a lens for the lantern.', thanks: 'The lens fits. And the letter says… “Five sparks. Five guardians. Find them.”', reward: { money: 200 } }
    ] },
  { id: 'c7', title: 'The Five Sparks', badge: 'story7',
    intro: 'Wren hid five sparks of the lantern with five Jumbo guardians in the far corners of the meadow.',
    recap: 'You woke the guardians. Each spark was small, warm and very, very glad to be asked.',
    lore: { title: 'The guardians', text: 'Spore, Puff, Breeze, Shell and Coral each look after one corner of the world. Wren called them “my five oldest friends who happen to be slimes”.' },
    reward: { money: 900, treasure: ['starshard', 2] },
    steps: [
      { npc: 'bram',   kind: 'jumbo', amount: 2, talk: ['The mushrooms told me about you. “The one with the lantern,” they said. Wren came here every autumn and sang to the Spore Jumbo.'], text: 'The sparks sleep inside the Jumbos. Feed two of them until they pop — gently — and wake the sparks.', thanks: 'Did you hear that? The whole grove just sighed with relief.', reward: { money: 220 } },
      { npc: 'glim',   kind: 'give', what: 'plort', key: 'spore', amount: 6, talk: ['I have kept my notes for forty years. Today I tore up the page that said “subject”. Sparks answer friendship, not measurement.'], text: 'Spore glimmers glow at the pitch of the sparks. Bring me 6 so I can listen properly.', thanks: 'I can hear it! A tiny voice, humming a lullaby. It sounds like Wren.', reward: { money: 220 } },
      { npc: 'tess',   kind: 'give', what: 'plort', key: 'breeze', amount: 5, talk: ['I thought I could never finish her lantern alone. But a tool is only lonely if nobody picks it up.'], text: 'Breeze glimmers hold a spark steady in the wind. Bring me 5 for the new lantern\'s frame.', thanks: 'It holds! The frame hums like a bell in a gentle wind.', reward: { money: 220 } },
      { npc: 'fern',   kind: 'give', what: 'food', key: 'kelp', amount: 8, talk: ['I have been waiting for Wren by the fence for a long time. Maybe waiting and being left are not the same thing at all.'], text: 'Bring me 8 Kelp. I will plant a sea-garden, so the shore has something green to wait beside.', thanks: 'There. Now the shore is waiting too. We are all waiting together — that feels much better.', reward: { money: 240 } },
      { npc: 'pebble', kind: 'powers', amount: 8, talk: ['I never told you why I sailed her away. She asked me to take her to the far shore and to promise not to look back. I looked back anyway. She was smiling.'], text: 'Gather 8 Jumbo powers. A sea captain needs a strong crew to follow a lantern home.', thanks: 'Eight. That is a crew. Come and see me at the shore when you are ready.', reward: { money: 260 } }
    ] },
  { id: 'c8', title: 'The Sea Remembers', badge: 'story8',
    intro: 'The five sparks lead back to the Sunny Shore, where Wren once sailed away.',
    recap: 'The meadow, the grove and the sea are all humming the same lullaby. Somewhere beyond the horizon, a small boat turns around.',
    lore: { title: 'The lullaby', text: 'It is the song every slime hums in its sleep. Wren taught it to the first Jumbo, and the Jumbo taught it to everyone else.' },
    reward: { money: 1100, treasure: ['seaglass', 3] },
    steps: [
      { npc: 'pebble', kind: 'delighted', amount: 6, talk: ['The sea only answers when the shore is happy. So make your slimes happy, rancher — as many as you can at once.'], text: 'Make 6 slimes delighted at once. The tide listens to happy things.', thanks: 'Look at the water. It is turning back toward us.', reward: { money: 240 } },
      { npc: 'tess',   kind: 'charm', amount: 12, text: 'The new lantern needs a proper home. Decorate until the ranch has 12 charm.', thanks: 'Now it looks like somewhere someone would come home to.', reward: { money: 250 } },
      { npc: 'glim',   kind: 'give', what: 'plort', key: 'coral', amount: 4, talk: ['Coral glimmers glow at low tide, when the sea is thinking. Wren called that “the quiet minute”.'], text: 'Bring me 4 Coral glimmers for the lighthouse lens.', thanks: 'The lens is ready — it throws a warm light a very long way.', reward: { money: 260 } },
      { npc: 'bram',   kind: 'bounce', amount: 25, talk: ['The grove\'s spores float on the wind all the way to the shore. Bounce on the mushrooms and the whole forest will pass the message along.'], text: 'Bounce on the grove mushrooms 25 times to carry the message across the sea.', thanks: 'Listen — the spores are singing it. Wren will hear.', reward: { money: 260 } },
      { npc: 'fern',   kind: 'pet', amount: 30, talk: ['Every slime needs a kind word every day. Pet them — it is the oldest ranch tradition there is.'], text: 'Pet slimes 30 times. Wren would want the whole herd glowing when she arrives.', thanks: 'They are all glowing. I can see it from here. Oh, Wren…', reward: { money: 270 } }
    ] },
  { id: 'c9', title: 'Wren\'s Last Lantern', badge: 'story9', finale: true,
    intro: 'A small boat is crossing the evening sea, with a lantern at the bow.',
    recap: 'Wren came home. You chose how the light would stay — and the meadow has never been brighter.',
    lore: { title: 'Home', text: 'Wren says every ranch is a lantern, and every rancher is a wick. Slimes are the glow.' },
    reward: { money: 2000 },
    steps: [
      { npc: 'tess',   kind: 'give', what: 'treasure', key: 'starshard', amount: 5, talk: ['It is nearly finished. The last lantern needs one more thing: five pieces of the sky.'], text: 'Bring me 5 Star Shards for the last lantern.', thanks: 'There. I can hold the whole sky in one hand. Look!', reward: { money: 300 } },
      { npc: 'glim',   kind: 'photos', amount: 4, talk: ['Wren will want to see the ranch as it is now. Take 4 photos — and be sure to catch the slimes at their happiest.'], text: 'Take 4 photos with photo mode for Wren\'s album.', thanks: 'The album is full of light. She will cry. I will pretend not to notice.', reward: { money: 300 } },
      { npc: 'fern',   kind: 'harvest', amount: 30, talk: ['A guest from afar needs a feast. Harvest 30 crops, dear. We are going to do this properly.'], text: 'Harvest 30 crops for the welcome-home feast.', thanks: 'The whole table smells of home. Come back when you see the boat.', reward: { money: 300 } },
      { npc: 'bram',   kind: 'powers', amount: 10, talk: ['The mushrooms say you are ready. They say ten powers is “a whole orchestra”.'], text: 'Gather 10 Jumbo powers. The last lantern asks for an orchestra.', thanks: 'The mushrooms are applauding. They are very, very shy about it.', reward: { money: 350 } },
      { npc: 'wren', kind: 'choice', amount: 1, talk: ['Hello, my dear. Look how bright the meadow is — and how big you have grown.', 'I brought the last spark home. I kept it for you. What should we do with the light?', 'It is your choice. It is always your choice.'],
        text: 'Wren has brought the last spark home. Decide what happens to the light.', thanks: '', reward: { money: 500 },
        options: [
          { id: 'keep', label: '🏮 Keep the lantern burning at the ranch', text: '“Then the ranch will always be the brightest place in the meadow,” says Wren. She hangs the new lantern beside the old one, and sits down on the fence beside Fern. Bonus: a second Heart Lantern.' },
          { id: 'release', label: '✨ Let the light drift out over the meadow', text: 'The five sparks drift out over the grass and every slime glows for a heartbeat. “That is the best gift anyone ever gave me,” says Wren. Bonus: happy slimes give two glimmers a little more often — forever.' }
        ] }
    ] }
];
/* ---------------- Wren herself ----------------
   She is not one of the quest neighbours: she waits on the beach once the last step of the story is reached (that is where the
   spark came home), and after the finale she lives at the ranch, beside Fern's fence. Talk to her any time. */
const WREN = { id: 'wren', name: 'Wren', title: 'Grandmother', cell: 5, color: '#c8a0e8' };
const wrenVisible = () => { const st = ensureStory(); return st.done || (st.ch === STORY.length - 1 && st.step >= STORY[st.ch].steps.length - 1); };
function wrenTile() { const f = NPCS.find(n => n.id === 'fern'); return ensureStory().done ? { x: f.x + 2, y: f.y + 1 } : { x: 88, y: 118 }; }
const wrenNpc = () => Object.assign({}, WREN, wrenTile());
function wrenLines() {
  const st = ensureStory(), n = game.slimes.length;
  return [
    st.ending === 'release' ? 'The whole meadow glows a little at night now. I like to think that is you.' : 'Both lanterns are burning. I can see them from my window.',
    `Look at them all — ${n} slimes! I never had more than thirty.`,
    'Fern waves at me from the fence now. I did not know a person could wave so happily.',
    'Pebble sails me out to the far shore every spring. The sea still owes me a favour — and I intend to collect it slowly.',
    'Glim showed me his notebook. The cover says “Friends”. I had to sit down.',
    'Tess\'s lantern is better than mine ever was. Do not tell her I said so. Actually — do tell her.',
    'Bramble keeps asking if the mushrooms can come to dinner. I said yes. I regret nothing.',
    'Every night I leave the window open so I can hear them humming the lullaby.',
    'You kept the light on. That is all I ever asked.'
  ];
}
const STORY_STEPS = STORY.reduce((a, c) => a + c.steps.length, 0);

function newStory() { return { sv: 2, ch: 0, step: 0, status: 'idle', progress: 0, done: false, ready: false, told: false, choice: null, ending: null }; }
function ensureStory() { if (!game.story) game.story = newStory(); return game.story; }
// Older saves finished the 5-chapter story (done:true). The story now continues with Act II.
function upgradeStory(st) {
  if (!st) return newStory();
  if (!st.sv) { st.sv = 2; if (st.done) { st.done = false; st.ch = 5; st.step = 0; st.status = 'idle'; st.progress = 0; st.told = false; } }
  if (st.choice === undefined) st.choice = null;
  if (st.ending === undefined) st.ending = null;
  return st;
}
const storyChapter = () => { const st = ensureStory(); return st.done ? null : STORY[st.ch]; };
const storyStep = () => { const c = storyChapter(); return c ? c.steps[ensureStory().step] : null; };
const storyFor = npcId => { const s = storyStep(); return s && s.npc === npcId ? s : null; };
const lanternBond = () => (game.story && game.story.ending === 'release') ? 0.1 : 0;        // the "release the light" ending

function storyValue() {                                                 // [current, goal] of the current step
  const s = storyStep(), st = ensureStory(); if (!s) return [0, 0];
  const a = s.amount || 1;
  switch (s.kind) {
    case 'give': return [Math.min(packCount(s.what, s.key), a), a];
    case 'delighted': return [Math.min(game.slimes.filter(isDelighted).length, a), a];
    case 'charm': return [Math.min(charm(), a), a];
    case 'pen': return [Math.min(Math.max(0, ...game.corrals.map(c => c.owned ? corralPop(c) : 0)), a), a];
    case 'corrals': return [Math.min(ownedCorrals(), a), a];
    case 'powers': return [Math.min(Object.keys(game.powers).length, a), a];
    case 'visit': return [profile.codex.places[s.area] ? 1 : 0, 1];
    case 'photos': return [Math.min(Math.max(0, getStat('photos') - (st.photoBase || 0)), a), a];
    case 'choice': return [st.choice ? 1 : 0, 1];
    default: return [Math.min(st.progress, a), a];
  }
}
const storyReady = () => { const st = ensureStory(); if (st.status !== 'active') return false; const [c, g] = storyValue(); return c >= g; };
function storyAccept() {
  const st = ensureStory(), s = storyStep(); if (!s || st.status !== 'idle') return;
  st.status = 'active'; st.progress = 0; st.ready = false; st.choice = null; st.photoBase = getStat('photos'); Sound.play('click', 0.6);
}
function storyCounter(kind, n) {
  const st = ensureStory(), s = storyStep();
  if (s && st.status === 'active' && s.kind === kind) st.progress = Math.min(s.amount, st.progress + n);
}
function storyChoose(id) {                                              // the final decision (choice steps only)
  const st = ensureStory(), s = storyStep();
  if (!s || s.kind !== 'choice' || st.status !== 'active' || !s.options.some(o => o.id === id)) return false;
  st.choice = id; Sound.play('click', 0.6); return true;
}
function storyHandIn() {
  const st = ensureStory(), s = storyStep(), ch = storyChapter();
  if (!s || !storyReady()) { Sound.play('error', 0.5); return false; }
  if (s.kind === 'give') packRemoveN(s.what, s.key, s.amount);
  if (s.kind === 'choice') st.ending = st.choice;
  game.money += s.reward.money; stat('moneyEarned', s.reward.money); stat('storySteps');
  Sound.play('quest');
  const thanks = s.kind === 'choice' ? s.options.find(o => o.id === st.ending).text : '“' + s.thanks + '”';
  showToast('★', `${npcDef(s.npc).name}: ${thanks}`, `+$${s.reward.money}`, true);
  st.step++; st.status = 'idle'; st.progress = 0; st.ready = false; st.told = false; st.choice = null;
  if (st.step >= ch.steps.length) finishChapter(ch);
  return true;
}
function finishChapter(ch) {
  const st = ensureStory(), r = ch.reward;
  game.money += r.money; stat('moneyEarned', r.money); stat('storyChapters');
  if (r.treasure) giveTreasure(r.treasure[0], r.treasure[1]);
  if (r.decor) { game.stock[r.decor[0]] = (game.stock[r.decor[0]] || 0) + r.decor[1]; }
  if (ch.finale) {                                                      // the ending you chose
    if (st.ending === 'keep') game.stock.heartlantern = (game.stock.heartlantern || 0) + 1;
    else { giveTreasure('starshard', 5); game.slimes.forEach(s => { s.joy = Math.min(100, (s.joy || 0) + 40); }); }
  }
  Sound.play('achieve');
  showToast('📖', `Chapter complete: ${ch.title}`, `+$${r.money}${r.treasure ? ' and ' + TREASURES[r.treasure[0]].name : ''}${r.decor ? ' and the ' + DECOR_ITEMS[r.decor[0]].name + '!' : ''}`, true);
  if (ch.toast) showToast(ch.toast[0], ch.toast[1], ch.toast[2], true);
  st.ch++; st.step = 0;
  if (st.ch >= STORY.length) { st.done = true; stat('storyDone'); showToast('🏮', 'The story is complete', 'Wren is home. Read the epilogue in the Journal → Story.', true); }
}
// once a second: tell the player a step is ready / someone has something to say
function storyCheck() {
  const st = ensureStory(), s = storyStep(); if (!s) return;
  if (st.status === 'idle' && !st.told) { st.told = true; showToast('★', `${npcDef(s.npc).name} has something to tell you`, STORY[st.ch].title); }
  else if (st.status === 'active' && !st.ready && storyReady() && s.kind !== 'choice') { st.ready = true; showToast('★', 'Story step ready', `Go back to ${npcDef(s.npc).name}.`); Sound.play('collect', 0.6); }
}
function storyNewDay() {}

// The epilogue is written from what actually happened on your ranch.
function storyEpilogue() {
  const st = ensureStory(), n = game.slimes.length, kinds = new Set(game.slimes.map(s => s.type)).size, jp = getStat('jumbosPopped'), ph = getStat('photos');
  const p = [];
  p.push(st.ending === 'release'
    ? 'The five sparks drifted out over the meadow that evening, and every slime on the ranch glowed for a heartbeat. Some say the grass has been a little greener ever since.'
    : 'Wren hung the new lantern beside the old one, and the two have burned side by side ever since. On clear nights you can see them from the shore.');
  p.push(`It took ${game.day} days. Today your ranch has ${n} slime${n === 1 ? '' : 's'} of ${kinds} kind${kinds === 1 ? '' : 's'}${jp ? `, ${jp} Jumbo${jp === 1 ? '' : 's'} befriended` : ''}${ph ? ` and ${ph} photo${ph === 1 ? '' : 's'} in the album` : ''}.`);
  p.push('Fern still sits on the fence, but now she waves. Glim has a new notebook with one word on the cover: “Friends”. Pebble sails out every spring and always comes back. Tess finished the lantern. Bramble says the mushrooms are humming a new song — the lullaby, in four parts.');
  p.push('And Wren sleeps in the room at the top of the house, as she did when you were small, with a window open toward the meadow so she can hear the slimes singing.');
  return p;
}
