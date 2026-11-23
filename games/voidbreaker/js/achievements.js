// ============================================================
// VOID BREAKER // NEON ASCENSION — achievements.js  (v5.0)
// Commendations: persistent, cross-run milestones with toast
// unlocks and a start-screen panel.
//   kill / bossKill / archetype / combo / wave / score /
//   rushWave / hitTaken / pilot events stream in from the modules.
// ============================================================
window.VB = window.VB || {};

VB.Achievements = (function () {
  const KEY = 'vb_ascension_achv';

  // ---- definitions -----------------------------------------------------
  // check(counters) -> bool  (counters are persistent lifetime totals)
  const DEFS = [
    { id: 'firstBlood', name: 'FIRST BLOOD',    desc: 'Score your first kill',
      check: c => c.kills >= 1 },
    { id: 'centurion',  name: 'CENTURION',      desc: '100 lifetime kills',
      check: c => c.kills >= 100 },
    { id: 'exterminator', name: 'EXTERMINATOR', desc: '500 lifetime kills',
      check: c => c.kills >= 500 },
    { id: 'bossSlayer', name: 'BOSS SLAYER',    desc: 'Defeat any boss',
      check: c => c.bossKills >= 1 },
    { id: 'bestiary',   name: 'XENOARCHIVIST',  desc: 'Defeat all 12 boss archetypes',
      check: c => c.archetypes.length >= 12 },
    { id: 'combo15',    name: 'CHAIN REACTION', desc: 'Reach a x15 combo',
      check: c => c.bestCombo >= 15 },
    { id: 'combo30',    name: 'UNBROKEN',       desc: 'Reach a x30 combo',
      check: c => c.bestCombo >= 30 },
    { id: 'wave10',     name: 'DEEP DIVER',     desc: 'Reach wave 10 (classic)',
      check: c => c.bestWave >= 10 },
    { id: 'wave20',     name: 'ABYSSAL',        desc: 'Reach wave 20 (classic)',
      check: c => c.bestWave >= 20 },
    { id: 'riches',     name: 'VOID RICHES',    desc: 'Bank 100,000 points in one run',
      check: c => c.bestScore >= 100000 },
    { id: 'gauntlet',   name: 'GAUNTLET RUNNER',desc: 'Clear 4 Boss Rush fights',
      check: c => c.bestRush >= 4 },
    { id: 'untouched',  name: 'UNTOUCHABLE',    desc: 'Reach wave 5 without a scratch',
      check: c => c.flawlessWave >= 5 },
    { id: 'fleetAdmiral', name: 'FLEET ADMIRAL', desc: 'Pilot 12 different hulls',
      check: c => c.piloted.length >= 12 },
    // ---- v5.0 ABYSS ----
    { id: 'wave30',     name: 'ABYSS DIVER',    desc: 'Reach wave 30 (classic)',
      check: c => c.bestWave >= 30 },
    { id: 'combo50',    name: 'SINGULARITY',    desc: 'Reach a x50 combo',
      check: c => c.bestCombo >= 50 },
    { id: 'ouroSlayer', name: 'TAIL EATER',     desc: 'Defeat OUROBOROS',
      check: c => c.archetypes.indexOf('OUROBOROS') !== -1 },
    { id: 'cerbSlayer', name: 'PACK LEADER',    desc: 'Defeat CERBERUS',
      check: c => c.archetypes.indexOf('CERBERUS') !== -1 },
    // ---- v5.2 OMEGA ----
    { id: 'quartermaster', name: 'QUARTERMASTER', desc: 'Buy a Salvage Vault upgrade',
      check: c => c.vaultBuys >= 1 },
    { id: 'tycoon',        name: 'VAULT TYCOON',  desc: 'Earn 5,000 lifetime salvage',
      check: c => c.salvageTotal >= 5000 },
    { id: 'doomed',        name: 'DOOMED BUT GLORIOUS', desc: 'Reach wave 15 with 3+ curses',
      check: c => c.bestCurseWave >= 15 },
    // ---- v5.3 HORIZON ----
    { id: 'evolver',    name: 'GENE FORGE',   desc: 'Craft any evolved card',
      check: c => c.evos >= 1 },
    { id: 'omegaUnseal', name: 'OMEGA PROTOCOL', desc: 'Unseal the classified 13th hull',
      check: c => c.omegaUnlocked },
    { id: 'daily',      name: 'DAY BREAKER',  desc: 'Fly the Daily Void',
      check: c => c.dailies >= 1 },
    { id: 'codemaster', name: 'CODE RUNNER',  desc: 'Finish a challenge-code sortie',
      check: c => c.codeRuns >= 1 }
  ];

  const COUNTER_DEFAULTS = {
    kills: 0, bossKills: 0, archetypes: [], bestCombo: 1,
    bestWave: 0, bestScore: 0, bestRush: 0, flawlessWave: 0, piloted: [],
    vaultBuys: 0, salvageTotal: 0, bestCurseWave: 0,
    evos: 0, omegaUnlocked: false, dailies: 0, codeRuns: 0
  };

  let unlocked = {};        // id -> true (persisted)
  let counters = Object.assign({}, COUNTER_DEFAULTS);  // persisted
  let runHit = false;       // scratch-free tracking for the current run
  let initialized = false;

  function load() {
    const data = VB.U.storage.get(KEY, null);
    if (data) {
      unlocked = data.unlocked || {};
      counters = Object.assign({}, COUNTER_DEFAULTS, data.counters || {});
      if (!Array.isArray(counters.archetypes)) counters.archetypes = [];
      if (!Array.isArray(counters.piloted)) counters.piloted = [];
    }
  }
  function save() {
    VB.U.storage.set(KEY, { unlocked, counters });
  }

  function isUnlocked(id) { return !!unlocked[id]; }
  function all() { return DEFS; }
  function getCounters() { return counters; }

  /** evaluate every definition; unlock + toast anything newly earned */
  function evaluate() {
    let dirty = false;
    for (const def of DEFS) {
      if (!unlocked[def.id] && def.check(counters)) {
        unlocked[def.id] = true;
        dirty = true;
        VB.UI.toast('COMMENDATION — ' + def.name, 'milestone');
        VB.Audio.sfx('powerup_life');
      }
    }
    if (dirty) save();
  }

  /** main event pump */
  function on(evt, val) {
    if (!initialized) return;
    switch (evt) {
      case 'kill':
        counters.kills++;
        break;
      case 'bossKill':
        counters.bossKills++;
        break;
      case 'archetype':
        if (val && counters.archetypes.indexOf(val) === -1) counters.archetypes.push(val);
        break;
      case 'combo':
        if (val > counters.bestCombo) counters.bestCombo = val;
        break;
      case 'wave':
        // classic mode only; flawless tracking too
        if (VB.Game.mode !== 'rush' && val > counters.bestWave) counters.bestWave = val;
        if (!runHit && val > counters.flawlessWave) {
          counters.flawlessWave = val;
        }
        break;
      case 'score':
        if (val > counters.bestScore) counters.bestScore = val;
        break;
      case 'rushWave':
        if (val > counters.bestRush) counters.bestRush = val;
        break;
      case 'pilot':
        // v4.2: lifetime hull roster for FLEET ADMIRAL
        if (val && counters.piloted.indexOf(val) === -1) counters.piloted.push(val);
        break;
      case 'vaultBuy':
        // v5.2: permanent fleet upgrades
        counters.vaultBuys++;
        break;
      case 'salvage':
        // v5.2: lifetime salvage earnings
        counters.salvageTotal += (val || 0);
        break;
      case 'curseWave':
        // v5.2: deepest wave flown under 3+ curses
        if (val > counters.bestCurseWave) counters.bestCurseWave = val;
        break;
      case 'evolve':
        // v5.3: evolution crafting
        counters.evos++;
        break;
      case 'omegaUnlock':
        // v5.3: the classified hull unseals (idempotent, fires each deep wave)
        counters.omegaUnlocked = true;
        break;
      case 'dailyRun':
        // v5.3: flew the Daily Void
        counters.dailies++;
        break;
      case 'codeRun':
        // v5.3: finished a challenge-code sortie
        counters.codeRuns++;
        break;
      case 'hitTaken':
        runHit = true;
        break;
      case 'runStart':
        runHit = false;
        break;
      default:
        return;
    }
    evaluate();
  }

  /** start-screen commendations panel */
  function renderPanel(container) {
    if (!container) return;
    container.innerHTML = '';
    for (const def of DEFS) {
      const on = !!unlocked[def.id];
      const chip = document.createElement('div');
      chip.className = 'achv' + (on ? ' on' : '');
      chip.title = def.desc;
      chip.innerHTML =
        '<span class="achv-name">' + def.name + '</span>' +
        '<span class="achv-desc">' + (on ? def.desc : '?? — ' + def.desc) + '</span>';
      container.appendChild(chip);
    }
  }

  function init() {
    load();
    initialized = true;
  }

  return { init, on, isUnlocked, all, renderPanel, getCounters };
})();
