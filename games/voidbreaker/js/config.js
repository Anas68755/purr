// ============================================================
// VOID BREAKER // NEON ASCENSION — config.js  (v5.0 ABYSS)
// Global namespace + all balance/data tables in one place.
// ============================================================
window.VB = window.VB || {};

VB.CONFIG = {
  // HOLO-ARC palette (v3.0 visual rebuild)
  COLORS: {
    bg: '#04070d',
    fg: '#dfe9f5',
    accent: '#ff8a3d',
    accent2: '#58f6ff',
    accent3: '#ff5470',
    gold: '#ffc857',
    green: '#4dffa6',
    violet: '#c86bff'
  },

  PLAYER: {
    W: 28, H: 32,
    SPEED: 320,
    FIRE_RATE: 0.15,
    BULLET_SPEED: 720,
    START_LIVES: 4,
    MAX_LIVES: 6,
    INVINCIBLE_ON_HIT: 2.0,
    SHIELD_DRAIN: 55,          // energy/s while holding Shift
    SHIELD_REGEN: 6,           // energy/s passive
    DASH_SPEED: 900,
    DASH_TIME: 0.12,
    DASH_COOLDOWN: 2.5,
    DASH_CONTACT_DMG: 3,
    DRONE_RADIUS: 46,
    DRONE_FIRE_EVERY: 0.9,
    HOMING_EVERY: 2.2
  },

  WEAPON: {
    SPREAD_ANGLE: 0.35, SPREAD_STEP: 0.14, SPREAD_SPEED: 620,
    TWIN_OFFSET: 8
  },

  // Enemy classes — hp/speed scale with wave. COST feeds the wave-budget director.
  ENEMIES: {
    grunt:    { minWave: 1, cost: 1, hp: w => 1 + Math.floor(w / 2),        speed: w => 110 + w * 6,  w: 20, h: 20, color: '#ff5470', score: 100, fireRate: 2.0 },
    zigzag:   { minWave: 2, cost: 2, hp: w => 2 + Math.floor(w / 2),        speed: w => 85 + w * 5,   w: 20, h: 20, color: '#ffc857', score: 150, fireRate: 2.0 },
    homing:   { minWave: 3, cost: 2, hp: w => 2 + Math.floor(w / 3),        speed: w => 70 + w * 3,   w: 18, h: 18, color: '#c86bff', score: 200, fireRate: 1.8 },
    splitter: { minWave: 4, cost: 3, hp: w => 3 + Math.floor(w / 2),        speed: w => 90 + w * 4,   w: 24, h: 24, color: '#4dffa6', score: 180, fireRate: 2.5 },
    flanker:  { minWave: 4, cost: 2, hp: w => 2 + Math.floor(w / 3),        speed: w => 140 + w * 5,  w: 18, h: 22, color: '#ff9a54', score: 160, fireRate: 1.5 },
    tank:     { minWave: 5, cost: 4, hp: w => 6 + w * 2,                    speed: w => 45 + w * 2,   w: 34, h: 34, color: '#58f6ff', score: 350, fireRate: 1.5 },
    shielder: { minWave: 6, cost: 3, hp: w => 4 + Math.floor(w * 0.8),      speed: w => 65 + w * 2.5, w: 26, h: 26, color: '#8fb7ff', score: 260, fireRate: 1.9 },
    bomber:   { minWave: 7, cost: 3, hp: w => 3 + Math.floor(w / 2),        speed: w => 55 + w * 1.5, w: 26, h: 26, color: '#ff7ab8', score: 240, fireRate: 3.5 },
    sniper:   { minWave: 8, cost: 3, hp: w => 2 + Math.floor(w / 3),        speed: w => 95 + w * 2,   w: 18, h: 24, color: '#ffe08a', score: 280, fireRate: 2.4 },
    // v4.2 TITAN: weaver blinks across the lane, warden heals its squad
    weaver:   { minWave: 9, cost: 3, hp: w => 2 + Math.floor(w / 3),        speed: w => 100 + w * 3,  w: 20, h: 20, color: '#b7ff5c', score: 300, fireRate: 1.6 },
    warden:   { minWave: 10, cost: 4, hp: w => 5 + Math.floor(w * 0.9),     speed: w => 55 + w * 2,   w: 28, h: 28, color: '#d7a8ff', score: 380, fireRate: 3.2 },
    // v5.0 ABYSS: phantom phases out of reach, zenith dive-bombs the pilot
    phantom:  { minWave: 11, cost: 3, hp: w => 2 + Math.floor(w / 3),       speed: w => 62 + w * 2,   w: 22, h: 22, color: '#8ef4ff', score: 320, fireRate: 2.2 },
    zenith:   { minWave: 12, cost: 3, hp: w => 2 + Math.floor(w / 3),       speed: w => 150 + w * 4,  w: 20, h: 26, color: '#ff3d81', score: 300, fireRate: 2.0 }
  },
  ELITE: {
    MIN_WAVE: 7,
    BASE_CHANCE: 0.08,
    WAVE_BONUS: 0.006,
    MAX_CHANCE: 0.22,
    HP_MULT: 2.5,
    SIZE_MULT: 1.35,
    SPEED_MULT: 0.85,
    SCORE_MULT: 2.5,
    // v5.2 OMEGA: named affixes on elites from wave 9 — each adds a twist
    AFFIX_FROM_WAVE: 9,
    AFFIX_CHANCE: 0.65,
    AFFIX_SCORE_MULT: 1.5,
    AFFIXES: {
      shielded: { name: 'AEGIS',    color: '#8fb7ff', desc: 'Absorbs 2 hits, then re-arm' },
      volatile: { name: 'VOLATILE', color: '#ff8a3d', desc: 'Detonates 0.5s after dying' },
      swift:    { name: 'SWIFT',    color: '#b7ff5c', desc: 'Moves 50% faster' }
    }
  },

  // v5.2 OMEGA — Nightmare curses. Toggle before launch; each multiplies score.
  // v5.3 HORIZON — three new curses joined the nightmare roster (indices 7-9
  // are locked in: challenge codes encode curses as digit indices).
  CURSES: {
    hordes:    { name: 'HORDES',     desc: '40% more enemies per wave',      mult: 1.35 },
    ironhull:  { name: 'IRONHULL',   desc: 'Enemy hulls +50% HP',            mult: 1.30 },
    barrage:   { name: 'BARRAGE',    desc: 'Foes fire 35% faster',           mult: 1.40 },
    fragile:   { name: 'FRAGILE',    desc: 'Start with 2 fewer lives',       mult: 1.25 },
    fog:       { name: 'NEBULA FOG', desc: 'Vision fades at the edges',      mult: 1.20 },
    minefield: { name: 'MINE BELT',  desc: 'Mines spawn far more often',     mult: 1.30 },
    rushhour:  { name: 'SPECIAL OPS',desc: 'Special waves twice as often',   mult: 1.35 },
    // v5.3 HORIZON
    gravity:   { name: 'GRAVITY WELL', desc: 'Thrusters strain: -20% speed', mult: 1.30 },
    regen:     { name: 'REGEN HIVE',   desc: 'Foes slowly mend their hulls', mult: 1.35 },
    overload:  { name: 'POWER LEAK',   desc: 'Power-ups last half as long',  mult: 1.25 }
  },

  // v5.2 OMEGA — Salvage Vault: persistent currency + permanent upgrades.
  VAULT: {
    SALVAGE_PER_SCORE: 2500,     // 1 salvage per 2500 points flown
    ELITE_BOUNTY: 5,             // per elite killed
    BOSS_BOUNTY: 25,             // per boss killed
    ITEMS: {
      hullplus:  { name: 'HULL CACHE',      desc: 'Start each sortie with +1 life',          max: 2, cost: lv => 300 + lv * 250 },
      dashcore:  { name: 'PHASE CAPACITOR', desc: 'Dash recharges 8% faster per level',      max: 2, cost: lv => 350 + lv * 300 },
      headstart: { name: 'QUARTERMASTER',   desc: 'Upgrade drafts offer a 4th card',         max: 1, cost: () => 600 },
      veteran:   { name: 'VETERAN INSIGNIA',desc: 'Score multiplier +5% per level',          max: 2, cost: lv => 500 + lv * 400 },
      windfall:  { name: 'SALVAGE RIG',     desc: 'Earn +15% salvage per level',             max: 3, cost: lv => 250 + lv * 200 },
      phoenix:   { name: 'PHOENIX COVENANT',desc: 'Revive once per sortie at 1 hull',        max: 1, cost: () => 900 }
    }
  },

  // Boss archetypes. HP/score scale with the wave they appear on.
  // Rotation order ramps difficulty; DUAL_BOSS_SETS picks fixed pairs,
  // waves >= DUAL_BOSS_RANDOM_WAVE get a random pair.
  // v4.0: VORTEX (gravity maelstrom) and GORGON (prism hydra) joined.
  // v4.2: LEVIATHAN (void serpent) and MIRAGE (illusionist) joined.
  // v5.0: OUROBOROS (orbiting ring serpent) and CERBERUS (triple-head
  //       warden) close out the twelve-archetype roster.
  BOSS_ROTATION: ['DREADNOUGHT', 'SERAPH', 'HYDRA', 'TEMPEST', 'MONOLITH', 'ARCHON', 'VORTEX', 'GORGON', 'LEVIATHAN', 'MIRAGE', 'OUROBOROS', 'CERBERUS'],
  BOSSES: {
    DREADNOUGHT: {
      name: 'DREADNOUGHT', color: '#ff8a3d', enragedColor: '#ff5470',
      hp: w => 60 + w * 25, speed: 45, w: 65, h: 55, score: 3000
    },
    SERAPH: {
      name: 'SERAPH', color: '#c86bff', enragedColor: '#ff4fd8',
      hp: w => 55 + w * 22, speed: 55, w: 58, h: 58, score: 3200
    },
    HYDRA: {
      name: 'HYDRA', color: '#4dffa6', enragedColor: '#d8ff4f',
      hp: w => 65 + w * 24, speed: 60, w: 62, h: 50, score: 3400
    },
    TEMPEST: {
      name: 'TEMPEST', color: '#58a6ff', enragedColor: '#ffc857',
      hp: w => 50 + w * 20, speed: 70, w: 54, h: 50, score: 3600
    },
    MONOLITH: {
      name: 'MONOLITH', color: '#8fb7ff', enragedColor: '#ffb35c',
      hp: w => 80 + w * 27, speed: 30, w: 60, h: 68, score: 3800
    },
    ARCHON: {
      name: 'ARCHON', color: '#ff4fd8', enragedColor: '#ffc857',
      hp: w => 95 + w * 30, speed: 40, w: 74, h: 66, score: 5000
    },
    VORTEX: {
      name: 'VORTEX', color: '#58ffd1', enragedColor: '#ff8a3d',
      hp: w => 70 + w * 26, speed: 50, w: 60, h: 60, score: 4200
    },
    GORGON: {
      name: 'GORGON', color: '#8fa8ff', enragedColor: '#ff4fd8',
      hp: w => 75 + w * 25, speed: 58, w: 64, h: 56, score: 4400
    },
    // v4.2 TITAN
    LEVIATHAN: {
      name: 'LEVIATHAN', color: '#5cff9d', enragedColor: '#b7ff5c',
      hp: w => 85 + w * 28, speed: 52, w: 60, h: 46, score: 4800
    },
    MIRAGE: {
      name: 'MIRAGE', color: '#ff9ad5', enragedColor: '#e8f0ff',
      hp: w => 68 + w * 24, speed: 76, w: 56, h: 56, score: 4600
    },
    // v5.0 ABYSS
    OUROBOROS: {
      name: 'OUROBOROS', color: '#b6ff3d', enragedColor: '#ff5470',
      hp: w => 80 + w * 27, speed: 58, w: 66, h: 56, score: 5000
    },
    CERBERUS: {
      name: 'CERBERUS', color: '#ff4f6e', enragedColor: '#ffd166',
      hp: w => 90 + w * 29, speed: 48, w: 72, h: 60, score: 5200
    }
  },

  // BOSS RUSH mode: every wave is a boss (or a dual pair every DUAL_EVERY).
  // Boss HP scales as hp(HP_BASE + wave * HP_STEP) — steeper than classic.
  BOSS_RUSH: {
    HP_BASE: 5, HP_STEP: 4, DUAL_EVERY: 4
  },
  BOSS_EVERY: 5,
  DUAL_BOSS_WAVE: 20,
  DUAL_BOSS_SETS: {
    20: ['DREADNOUGHT', 'SERAPH'],
    40: ['TEMPEST', 'HYDRA'],
    60: ['MONOLITH', 'ARCHON']
  },
  DUAL_BOSS_RANDOM_WAVE: 80,

  POWERUPS: {
    rapid:  { weight: 24, color: '#ffc857', label: 'R', dur: 6,  name: 'RAPID FIRE' },
    spread: { weight: 21, color: '#ff5470', label: 'S', dur: 6,  name: 'SPREAD SHOT' },
    shield: { weight: 17, color: '#58f6ff', label: 'D', dur: 8,  name: 'DEFLECTOR' },
    pierce:{ weight: 12, color: '#c86bff', label: 'P', dur: 8,  name: 'PIERCING' },
    time:   { weight: 10, color: '#58a6ff', label: 'T', dur: 4,  name: 'TIME DILATION' },
    life:   { weight: 10, color: '#4dffa6', label: '+', dur: 0,  name: '+1 LIFE' },
    nuke:   { weight: 6,  color: '#ff8a3d', label: 'N', dur: 0,  name: 'VOID NUKE' }
  },
  POWERUP_DROP_BASE: 0.10,
  POWERUP_DROP_WAVE: 0.005,

  MINES: {
    BLAST_BASE: 70, BLAST_WAVE: 3,
    TRIGGER_RADIUS: 0.5,      // fraction of blast radius
    ARM_TIME: 1.5
  },

  COMBO_WINDOW: 2.5,
  SCORE_ZONE_EVERY: 24,
  MINE_WAVE: 3,

  MILESTONES: {
    score: [10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    kills: [50, 100, 200, 500, 1000]
  },

  AUDIO: {
    // html5:true is forced on file:// where XHR/webaudio decoding is blocked.
    MUSIC: {
      menu_theme:   'assets/audio/music/menu_theme.wav',
      battle_a:     'assets/audio/music/battle_a.wav',
      battle_b:     'assets/audio/music/battle_b.wav',
      boss_theme:   'assets/audio/music/boss_theme.wav',
      // v5.0 ABYSS — the gauntlet, the deep and the twin ascendants
      rush_theme:   'assets/audio/music/rush_theme.wav',
      abyss_theme:  'assets/audio/music/abyss_theme.wav',
      finale_theme: 'assets/audio/music/finale_theme.wav'
    },
    SFX: {
      laser:        { file: 'assets/audio/sfx/laser.wav',        vol: 0.45, throttle: 45 },
      laser_spread: { file: 'assets/audio/sfx/laser_spread.wav', vol: 0.5,  throttle: 45 },
      missile:      { file: 'assets/audio/sfx/missile.wav',      vol: 0.4,  throttle: 90 },
      laser_enemy:  { file: 'assets/audio/sfx/laser_enemy.wav',  vol: 0.22, throttle: 60 },
      hit:          { file: 'assets/audio/sfx/hit.wav',          vol: 0.3,  throttle: 30 },
      crit:         { file: 'assets/audio/sfx/crit.wav',         vol: 0.45, throttle: 60 },
      hit_shield:   { file: 'assets/audio/sfx/hit_shield.wav',   vol: 0.5,  throttle: 40 },
      expl_small:   { file: 'assets/audio/sfx/expl_small.wav',   vol: 0.5,  throttle: 40 },
      expl_big:     { file: 'assets/audio/sfx/expl_big.wav',     vol: 0.6,  throttle: 60 },
      expl_boss:    { file: 'assets/audio/sfx/expl_boss.wav',    vol: 0.75, throttle: 100 },
      mine_explode: { file: 'assets/audio/sfx/mine_explode.wav', vol: 0.6,  throttle: 80 },
      player_hit:   { file: 'assets/audio/sfx/player_hit.wav',   vol: 0.8,  throttle: 100 },
      shield_up:    { file: 'assets/audio/sfx/shield_up.wav',    vol: 0.5,  throttle: 100 },
      shield_break: { file: 'assets/audio/sfx/shield_break.wav', vol: 0.6,  throttle: 100 },
      dash:         { file: 'assets/audio/sfx/dash.wav',         vol: 0.5,  throttle: 100 },
      powerup:      { file: 'assets/audio/sfx/powerup.wav',      vol: 0.55, throttle: 50 },
      powerup_life: { file: 'assets/audio/sfx/powerup_life.wav', vol: 0.55, throttle: 50 },
      nuke:         { file: 'assets/audio/sfx/nuke.wav',         vol: 0.8,  throttle: 200 },
      mine_beep:    { file: 'assets/audio/sfx/mine_beep.wav',    vol: 0.3,  throttle: 100 },
      warning:      { file: 'assets/audio/sfx/warning.wav',      vol: 0.45, throttle: 150 },
      boss_warning: { file: 'assets/audio/sfx/boss_warning.wav', vol: 0.7,  throttle: 300 },
      wave_start:   { file: 'assets/audio/sfx/wave_start.wav',   vol: 0.5,  throttle: 200 },
      combo:        { file: 'assets/audio/sfx/combo.wav',        vol: 0.4,  throttle: 80 },
      score_zone:   { file: 'assets/audio/sfx/score_zone.wav',   vol: 0.4,  throttle: 100 },
      time_slow:    { file: 'assets/audio/sfx/time_slow.wav',    vol: 0.5,  throttle: 200 },
      game_over:    { file: 'assets/audio/sfx/game_over.wav',    vol: 0.7,  throttle: 300 },
      boss_defeated:{ file: 'assets/audio/sfx/boss_defeated.wav',vol: 0.75, throttle: 300 },
      ui_click:     { file: 'assets/audio/sfx/ui_click.wav',     vol: 0.4,  throttle: 30 },
      ui_hover:     { file: 'assets/audio/sfx/ui_hover.wav',     vol: 0.25, throttle: 40 },
      ui_open:      { file: 'assets/audio/sfx/ui_open.wav',      vol: 0.45, throttle: 100 },
      ui_pick:      { file: 'assets/audio/sfx/ui_pick.wav',      vol: 0.55, throttle: 80 },
      // v4.2 TITAN — fleet powers, new upgrades & new foes
      zap:          { file: 'assets/audio/sfx/zap.wav',          vol: 0.5,  throttle: 70 },
      rail:         { file: 'assets/audio/sfx/rail.wav',         vol: 0.6,  throttle: 90 },
      gravity:      { file: 'assets/audio/sfx/gravity.wav',      vol: 0.55, throttle: 120 },
      well_collapse:{ file: 'assets/audio/sfx/well_collapse.wav',vol: 0.6,  throttle: 150 },
      heal:         { file: 'assets/audio/sfx/heal.wav',         vol: 0.55, throttle: 150 },
      emp:          { file: 'assets/audio/sfx/emp.wav',          vol: 0.5,  throttle: 120 },
      orbital:      { file: 'assets/audio/sfx/orbital.wav',      vol: 0.55, throttle: 150 },
      blink:        { file: 'assets/audio/sfx/blink.wav',        vol: 0.4,  throttle: 90 },
      // v5.0 ABYSS — FORGE/HALCYON fleet tech, wards & new foes
      turret:       { file: 'assets/audio/sfx/turret.wav',       vol: 0.5,  throttle: 130 },
      bomb:         { file: 'assets/audio/sfx/bomb.wav',         vol: 0.5,  throttle: 150 },
      broadside:    { file: 'assets/audio/sfx/broadside.wav',    vol: 0.45, throttle: 110 },
      ward:         { file: 'assets/audio/sfx/ward.wav',         vol: 0.4,  throttle: 90 },
      roar:         { file: 'assets/audio/sfx/roar.wav',         vol: 0.65, throttle: 200 },
      dive:         { file: 'assets/audio/sfx/dive.wav',         vol: 0.45, throttle: 120 },
      phase:        { file: 'assets/audio/sfx/phase.wav',        vol: 0.4,  throttle: 120 }
    }
  },

  STORAGE: {
    best: 'vb_ascension_best',
    bestRush: 'vb_ascension_best_rush',
    board: 'vb_ascension_board',
    settings: 'vb_ascension_settings',
    ship: 'vb_ascension_ship',
    vault: 'vb_omega_vault',
    daily: 'vb_horizon_daily'     // v5.3: Daily Void ledger {date, score, wave}
  }
};
