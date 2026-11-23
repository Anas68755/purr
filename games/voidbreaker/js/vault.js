// ============================================================
// VOID BREAKER // NEON ASCENSION — vault.js  (v5.2 OMEGA)
// Salvage Vault: persistent currency earned from sorties, spent
// on permanent fleet upgrades. Fully offline (localStorage).
//   earn(n)          — bank salvage (called once per game over)
//   level(id)        — owned level of a vault item
//   windfallMult()   — salvage gain multiplier
//   scoreMult()      — veteran score multiplier
//   dashMult()       — dash cooldown multiplier
//   startLives()     — extra starting lives
//   draftSlots()     — upgrade draft card count (3 + headstart)
// ============================================================
window.VB = window.VB || {};

VB.Vault = (function () {
  const KEY = VB.CONFIG.STORAGE.vault;
  const ITEMS = VB.CONFIG.VAULT.ITEMS;

  let bank = 0;            // unspent salvage
  let lifetime = 0;        // total ever earned (commendation)
  let levels = {};         // item id -> owned level
  let initialized = false;

  function load() {
    const data = VB.U.storage.get(KEY, null);
    if (data) {
      bank = data.bank || 0;
      lifetime = data.lifetime || 0;
      levels = data.levels || {};
    }
    initialized = true;
  }

  function save() {
    VB.U.storage.set(KEY, { bank, lifetime, levels });
  }

  function level(id) { return levels[id] || 0; }

  function cost(id) {
    const def = ITEMS[id];
    if (!def) return Infinity;
    return def.cost(level(id));
  }

  function canBuy(id) {
    const def = ITEMS[id];
    if (!def || level(id) >= def.max) return false;
    return bank >= cost(id);
  }

  function buy(id) {
    if (!canBuy(id)) return false;
    bank -= cost(id);
    levels[id] = level(id) + 1;
    save();
    if (VB.Achievements) VB.Achievements.on('vaultBuy');
    VB.Audio.sfx('ui_pick');
    VB.U.vibrate(20);
    return true;
  }

  /** bank salvage earned by a finished sortie (already windfall-multiplied by caller) */
  function earn(n) {
    n = Math.max(0, Math.round(n));
    bank += n;
    lifetime += n;
    save();
    if (VB.Achievements && n > 0) VB.Achievements.on('salvage', n);
    return n;
  }

  /** projected gain for the live run (for HUD-ish displays / debrief) */
  function projectedGain(score, elites, bosses) {
    const V = VB.CONFIG.VAULT;
    const g = VB.Game;
    let gain = score / V.SALVAGE_PER_SCORE +
      elites * V.ELITE_BOUNTY + bosses * V.BOSS_BOUNTY;
    return Math.floor(gain * windfallMult());
  }

  function windfallMult() { return 1 + 0.15 * level('windfall'); }
  function scoreMult()    { return 1 + 0.05 * level('veteran'); }
  function dashMult()     { return Math.pow(0.92, level('dashcore')); }
  function startLives()   { return level('hullplus'); }
  function draftSlots()   { return 3 + level('headstart'); }

  /** start-screen vault chip label */
  function bankLabel() { return 'VAULT · ' + VB.U.fmt(bank); }

  return {
    load, save, level, cost, canBuy, buy, earn, projectedGain,
    windfallMult, scoreMult, dashMult, startLives, draftSlots,
    bankLabel,
    get bank() { return bank; },
    get lifetime() { return lifetime; },
    get ready() { return initialized; }
  };
})();
