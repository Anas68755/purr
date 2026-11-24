// ============================================================
// VOID BREAKER // NEON ASCENSION — game.js  (v5.0 ABYSS)
// State machine, run state, main loop, scoring, collisions glue,
// game flow and bootstrapping.
// v4.0: game modes (classic / boss-rush), 12 new upgrade wirings
// (arc / blossom / retaliation / ablative / focus / overclock ...),
// achievements event pump.
// v4.2: 6 new upgrade wirings (stunner / vampire / orbital /
// proximity / glassCannon / platedHull), proximity wards,
// hull-aware run logs, MAGNUS well rendering hook.
// v5.0: 6 new upgrade wirings (comboMaster / sustained / barrage /
// deadEye / overchargeCap / guardianRing), FORGE turret render hook,
// trio of new music themes via the audio director.
// ============================================================
window.VB = window.VB || {};

VB.Game = (function () {
  const C = VB.CONFIG;
  let canvas, ctx;
  let W = 0, H = 0;

  const S = {
    state: 'menu',
    mode: 'classic',           // 'classic' | 'rush'
    player: null,
    score: 0, combo: 1, comboTimer: 0, maxCombo: 1,
    kills: 0, shots: 0, hits: 0, runTime: 0,
    lives: C.PLAYER.START_LIVES, maxLives: C.PLAYER.MAX_LIVES,
    upgrades: {},
    // v5.2 OMEGA — curses, vault and debrief tracking
    curses: {},                // id -> true for the active run
    scoreMult: 1,              // curses × veteran insignia
    elitesKilled: 0, bossesKilled: 0, salvageEarned: 0,
    vaultPhoenixReady: false,  // PHOENIX COVENANT revive for this run
    salvageKills: 0,
    phoenixReady: false,
    // v5.3 HORIZON — seeded runs, challenge codes & debrief timeline
    runSeed: 0, runCode: '', runSource: 'normal',   // normal | code | daily
    waveLog: [],               // {w, k, t, hit} per cleared wave
    waveKillsMark: 0, waveHit: false,
    waveElapsed: 0,            // seconds since the current wave started
    ablativeCharge: 0,         // 1 = a hit is currently negated
    ablativeT: 0,              // seconds until the next charge
    timers: { rapid: 0, spread: 0, shield: 0, pierce: 0 },
    timeSlowTimer: 0,
    slowmo: { scale: 1, timer: 0 },
    upgradePending: false,
    lastScoreMilestone: 0, lastKillMilestone: 0,
    zone: null,                 // {x,y,r,timer}
    scheduled: [],              // {t, fn}
    time: 0,                    // global animation clock
    _upgradeChoices: null
  };

  /** v5.2: combined score multiplier of the run (curses × vault veteran) */
  function runScoreMult() {
    let m = VB.Vault.scoreMult();
    for (const id in S.curses) m *= C.CURSES[id].mult;
    return m;
  }
  function curseCount() {
    let n = 0;
    for (const id in S.curses) n++;
    return n;
  }

  // ------------------------------------------------------------- utils --
  function enemiesList() { return VB.Enemies.list; }
  Object.defineProperty(S, 'enemiesList', { get: enemiesList });

  function bossActive() {
    for (const e of VB.Enemies.list) if (e.type === 'boss') return true;
    return false;
  }

  /** v5.0: how many bosses are live (the director picks the finale theme for duals) */
  function bossCount() {
    let n = 0;
    for (const e of VB.Enemies.list) if (e.type === 'boss') n++;
    return n;
  }

  function musicCheck() {
    const boss = bossCount();
    const name = VB.Audio.director(S.state, VB.Waves.wave, boss);
    if (name) VB.Audio.music(name);
    else VB.Audio.stopMusic();
  }

  // -------------------------------------------------------- scheduling --
  function schedule(delay, fn) { S.scheduled.push({ t: delay, fn }); }
  function processSchedule(dt) {
    for (let i = S.scheduled.length - 1; i >= 0; i--) {
      S.scheduled[i].t -= dt;
      if (S.scheduled[i].t <= 0) {
        const fn = S.scheduled[i].fn;
        S.scheduled.splice(i, 1);
        fn();
      }
    }
  }

  // --------------------------------------------------------- slow-mo ----
  function setSlowmo(scale, dur) { S.slowmo.scale = scale; S.slowmo.timer = dur; }
  function setTimeSlow(dur) {
    S.timeSlowTimer = dur;
    VB.Audio.sfx('time_slow');
    VB.UI.toast('TIME DILATION', 'info');
  }

  // ------------------------------------------------------- score zone ---
  function spawnScoreZone() {
    // v5.3: zone placement joins the seeded stream
    S.zone = {
      x: VB.U.rand(0, W - 200) + 100,
      y: VB.U.rand(0, H - 300) + 100,
      r: 80 + VB.U.rand(0, 40),
      timer: 6
    };
    VB.Audio.sfx('score_zone');
    VB.UI.toast('SCORE ZONE ACTIVE', 'milestone');
  }
  function isInScoreZone(x, y) {
    if (!S.zone || S.zone.timer <= 0) return false;
    return VB.U.dist(x, y, S.zone.x, S.zone.y) < S.zone.r;
  }
  function updateZone(dt) {
    if (!S.zone) return;
    S.zone.timer -= dt;
    if (S.zone.timer <= 0) S.zone = null;
  }
  function drawZone(ctx) {
    VB.Render.drawZone(ctx, S.zone, S.time);
  }

    // ---------------------------------------------------------- scoring ---
  function checkMilestones() {
    for (const t of C.MILESTONES.score) {
      if (S.score >= t && S.lastScoreMilestone < t) {
        S.lastScoreMilestone = t;
        VB.UI.toast(VB.U.fmt(t) + ' POINTS', 'milestone');
      }
    }
    for (const t of C.MILESTONES.kills) {
      if (S.kills >= t && S.lastKillMilestone < t) {
        S.lastKillMilestone = t;
        VB.UI.toast(t + ' KILLS', 'milestone');
      }
    }
    // v4.0 achievements: score tracking
    if (VB.Achievements) VB.Achievements.on('score', S.score);
  }

  // ------------------------------------------------------- kill logic ---
  function killEnemy(e, x, y, noDrop) {
    const isBoss = e.type === 'boss';
    const idx = VB.Enemies.list.indexOf(e);
    if (idx === -1) return;

    VB.FX.explosion(e.x, e.y, e.color, isBoss ? 80 : 20, isBoss ? 350 : 180);
    if (isBoss) {
      VB.FX.ring(e.x, e.y, '#ffc857', 260, 0.8);
      VB.FX.shake(18, 0.5);
      VB.FX.screenFlash(0.5, '#ffc857');
      VB.Audio.sfx('expl_boss');
      VB.Audio.sfx('boss_defeated');
      setSlowmo(0.25, 0.8);
      // chained secondary explosions
      for (let k = 1; k <= 5; k++) {
        schedule(k * 0.12, function () {
          VB.FX.explosion(e.x + VB.U.frand(-60, 60), e.y + VB.U.frand(-50, 50),
            k % 2 ? '#ff8a3d' : '#ffc857', 24, 220);
          VB.FX.shake(6, 0.15);
        });
      }
    } else {
      VB.FX.shake(5, 0.12);
      VB.FX.screenFlash(0.1, '#ffffff');
      VB.Audio.sfx(e.type === 'tank' || e.type === 'splitter' ? 'expl_big' : 'expl_small');
    }

    // combo & score
    S.comboTimer = C.COMBO_WINDOW +
      0.6 * (S.upgrades.comboMaster || 0);   // v5.0 Combo Catalyst
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;

    let pts = e.scoreValue * S.combo;
    const inZone = isInScoreZone(e.x, e.y);
    if (inZone) pts *= 2;
    // Fortune Module: score multiplier
    if (S.upgrades.goldRush > 0) pts = Math.round(pts * (1 + 0.15 * S.upgrades.goldRush));
    // v5.2 OMEGA: curses + Veteran Insignia multiply all score
    pts = Math.round(pts * S.scoreMult);
    S.score += pts;
    S.kills++;
    if (e.elite) S.elitesKilled++;
    VB.FX.dmgNum(e.x, e.y - 20, '+' + VB.U.fmt(pts), inZone ? '#ffc857' : '#ffffff', inZone);
    if (S.combo >= 5 && S.combo % 5 === 0) {
      VB.UI.comboPop('x' + S.combo);
      VB.Audio.sfx('combo');
      if (VB.Achievements) VB.Achievements.on('combo', S.combo);
    }
    // v4.0 achievements: kill counters
    if (VB.Achievements) {
      VB.Achievements.on('kill');
      if (isBoss) {
        VB.Achievements.on('bossKill');
        VB.Achievements.on('archetype', e.archetype);
      }
    }

    // v4.0 Arc Conductor: the kill lightning-zaps nearby foes
    // v5.3 STORM CHORUS: the evolved lens doubles the chain reach
    let arcLv = S.upgrades.arc || 0;
    if (S.upgrades.stormChorus) arcLv = Math.min(5, arcLv + 2);
    if (arcLv > 0) {
      const range = 170 + arcLv * 30;
      let zapped = 0;
      const maxZaps = Math.min(2 + arcLv, 5);
      for (const oe of VB.Enemies.list) {
        if (oe === e || zapped >= maxZaps) continue;
        if (VB.U.dist(oe.x, oe.y, e.x, e.y) < range) {
          VB.FX.bolt(e.x, e.y, oe.x, oe.y, '#ffe08a');
          oe.hp -= 2;
          zapped++;
          if (oe.hp <= 0) {
            // deferred: splice safely via the scheduler
            schedule(0, (function (target) {
              return function () {
                if (VB.Enemies.list.indexOf(target) !== -1) {
                  killEnemy(target, target.x, target.y, true);
                }
              };
            })(oe));
          }
        }
      }
      if (zapped > 0) VB.Audio.sfx('crit');
    }

    // v4.0 Death Blossom: kills may spray petals
    const blmLv = S.upgrades.blossom || 0;
    if (blmLv > 0 && !isBoss && Math.random() < 0.12 * blmLv) {
      // v5.3 STORM CHORUS: the chorus adds four extra petals
      const petals = 6 + (S.upgrades.stormChorus ? 4 : 0);
      for (let k = 0; k < petals; k++) {
        const ang = (k / petals) * Math.PI * 2 + Math.random() * 0.5;
        VB.Bullets.spawnPlayer(e.x, e.y, {
          vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
          size: 2.5, damage: 1 + Math.floor(blmLv / 2),
          color: '#ff7ab8', pierceLeft: 0, crit: false
        });
      }
      VB.FX.ring(e.x, e.y, '#ff7ab8', 60, 0.3);
    }

    // v4.2 Proximity Ward: the wreck may drop a player-side mine
    if (!isBoss && (S.upgrades.proximity || 0) > 0 && Math.random() < 0.2) {
      VB.Bullets.spawnMine(e.x, e.y, false, true);
      VB.FX.ring(e.x, e.y, '#6effc4', 26, 0.3);
    }

    // splitter death-splits
    if (e.type === 'splitter' && e.splitCount > 0) {
      for (let s2 = 0; s2 < 2; s2++) {
        const mini = VB.Enemies.spawn('grunt', { silent: true, forceElite: false });
        if (mini) {
          mini.x = e.x + (s2 === 0 ? -20 : 20);
          mini.y = e.y;
          mini.hp = mini.maxHp = Math.max(1, Math.floor(e.maxHp / 3));
          mini.speed = e.speed * 1.3;
          mini.w = mini.h = 14;
          mini.color = '#8dffb8';
          mini.scoreValue = 50;
          mini.fireTimer = 2;
        }
      }
      VB.UI.toast('SPLIT', 'danger');
    }

    // v5.2 OMEGA: VOLATILE affix — the wreck detonates shortly after death
    if (!isBoss && e.affix === 'volatile') {
      const vx = e.x, vy = e.y;
      VB.FX.ring(vx, vy, '#ff8a3d', 70, 0.45);
      schedule(0.5, function () {
        VB.FX.explosion(vx, vy, '#ff8a3d', 26, 200);
        VB.FX.ring(vx, vy, '#ff8a3d', 130, 0.4);
        VB.FX.shake(8, 0.2);
        VB.Audio.sfx('bomb');
        if (S.player && S.state === 'playing' &&
            VB.U.dist(S.player.x, S.player.y, vx, vy) < 110) {
          damagePlayer();
        }
      });
    }

    // v5.3 SINGULARITY CORE: every kill implodes — foes are yanked inward
    // and scoured by a heavy blast before the wreck even settles
    if (!isBoss && S.upgrades.singularityCore) {
      const R = 170, BD = 120;
      VB.FX.ring(e.x, e.y, '#c86bff', R, 0.4);
      VB.Audio.sfx('gravity');
      for (const oe of VB.Enemies.list) {
        if (oe === e || oe.type === 'boss') continue;
        const d = VB.U.dist(oe.x, oe.y, e.x, e.y);
        if (d < R && d > 4) {
          const pull = Math.min(70, (R - d) * 0.45);
          oe.x += (e.x - oe.x) / d * pull;
          oe.y += (e.y - oe.y) / d * pull;
        }
        if (d < BD) {
          oe.hp -= 3;
          if (oe.hp <= 0) {
            schedule(0, (function (target) {
              return function () {
                if (VB.Enemies.list.indexOf(target) !== -1) {
                  killEnemy(target, target.x, target.y, true);
                }
              };
            })(oe));
          }
        }
      }
    }

    VB.Enemies.list.splice(idx, 1);

    if (isBoss) {
      S.bossesKilled++;
      const bonus = Math.round(5000 * S.scoreMult);
      S.score += bonus;
      VB.UI.toast('BOSS DEFEATED  +' + VB.U.fmt(bonus), 'milestone');
      VB.UI.bossBarHide();
      musicCheck();
    } else if (!noDrop) {
      const dropChance = (e.elite ? 1 : C.POWERUP_DROP_BASE + VB.Waves.wave * C.POWERUP_DROP_WAVE)
        * (1 + 0.25 * (S.upgrades.goldRush || 0));
      // v5.3: drop rolls join the seeded stream (challenge codes stay fair)
      if (VB.U.RNG.float() < dropChance) VB.Powerups.spawn(e.x, e.y);
      // Salvage Drones: every N kills grants a life
      if (S.upgrades.salvage > 0) {
        S.salvageKills++;
        const need = S.upgrades.salvage >= 2 ? 15 : 25;
        if (S.salvageKills >= need) {
          S.salvageKills = 0;
          if (S.lives < S.maxLives) {
            S.lives++;
            VB.UI.toast('SALVAGED +1 LIFE', 'milestone');
            VB.Audio.sfx('powerup_life');
          }
        }
      }
    }
  }

  // ---------------------------------------------------- player damage ---
  function damagePlayer() {
    const p = S.player;

    // v4.1 Aegis Bulwark (BASTION power): the hull absorbs the hit
    if (p && p.bulwark) {
      VB.FX.explosion(p.x, p.y, p.ship ? p.ship.color : '#8fb7ff', 10, 140);
      VB.FX.ring(p.x, p.y, p.ship ? p.ship.color : '#8fb7ff', 48, 0.3);
      VB.Audio.sfx('hit_shield');
      return;
    }

    // v4.0 Ablative Plating: a stored charge negates this hit
    if (S.ablativeCharge > 0) {
      S.ablativeCharge = 0;
      S.ablativeT = 25;
      if (p) p.invincible = Math.max(p.invincible, 0.8);
      VB.FX.ring(p ? p.x : W / 2, p ? p.y : H / 2, '#8fb7ff', 120, 0.5);
      VB.FX.screenFlash(0.2, '#8fb7ff');
      VB.Audio.sfx('shield_break');
      VB.UI.toast('ABLATIVE PLATING SPENT', 'info');
      return;
    }

    S.lives--;
    S.hitTaken = true;
    S.waveHit = true;          // v5.3: debrief timeline red tick
    VB.U.vibrate(60);
    if (VB.Achievements) VB.Achievements.on('hitTaken');
    if (p) {
      // v5.2 FRAGILE curse: less recovery time after a hit
      p.invincible = S.curses.fragile ? 1.2 : C.PLAYER.INVINCIBLE_ON_HIT;
      VB.FX.explosion(p.x, p.y, '#ff5470', 30, 220);
    }
    // v4.0 Retaliation Matrix: counter-nova on taking damage
    const rtb = S.upgrades.retaliation || 0;
    if (rtb > 0 && p) {
      const n = 12 + rtb * 6;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2;
        VB.Bullets.spawnPlayer(p.x, p.y, {
          vx: Math.cos(ang) * 460, vy: Math.sin(ang) * 460,
          size: 3, damage: 1 + rtb, color: '#ff8a3d',
          pierceLeft: 0, crit: false
        });
      }
      VB.FX.ring(p.x, p.y, '#ff8a3d', 150, 0.45);
      VB.Audio.sfx('mine_explode');
    }
    S.combo = 1; S.comboTimer = 0;
    VB.FX.shake(12, 0.3);
    VB.FX.screenFlash(0.25, '#ff5470');
    VB.Audio.sfx('player_hit');
    setSlowmo(0.35, 0.25);
    // Phoenix Protocol: cheat death once per boss wave
    if (S.lives <= 0 && S.phoenixReady) {
      S.lives = 1;
      S.phoenixReady = false;
      if (p) p.invincible = 2.5;
      VB.FX.ring(p ? p.x : W / 2, p ? p.y : H / 2, '#4dffa6', 200, 0.7);
      VB.FX.screenFlash(0.35, '#4dffa6');
      VB.Audio.sfx('shield_up');
      VB.UI.toast('PHOENIX PROTOCOL', 'milestone');
      return;
    }
    // v5.2 PHOENIX COVENANT: one vault-funded revive per run
    if (S.lives <= 0 && S.vaultPhoenixReady) {
      S.vaultPhoenixReady = false;
      S.lives = 1;
      if (p) p.invincible = 2.5;
      VB.FX.ring(p ? p.x : W / 2, p ? p.y : H / 2, '#ffc857', 220, 0.7);
      VB.FX.screenFlash(0.35, '#ffc857');
      VB.Audio.sfx('shield_up');
      VB.UI.toast('PHOENIX COVENANT', 'milestone');
      return;
    }
    if (S.lives <= 0) gameOver();
  }

  // ------------------------------------------------------------- nuke ---
  function applyNuke() {
    // mutate the list in place — Enemies.list must stay the same array
    for (let i = VB.Enemies.list.length - 1; i >= 0; i--) {
      const e = VB.Enemies.list[i];
      // v5.3.1 SPAWN GATE: hulls still gliding in ride out the nova
      if (!e.entered) continue;
      if (e.type !== 'boss') {
        VB.FX.explosion(e.x, e.y, e.color, 15, 150);
        S.score += e.scoreValue * S.combo;
        S.kills++;
        VB.Enemies.list.splice(i, 1);
      } else {
        e.hp -= 15;
        if (e.hp <= 0) killEnemy(e, e.x, e.y, true);
      }
    }
    VB.Bullets.clearEnemyBullets();
    VB.Audio.sfx('nuke');
    VB.FX.shake(14, 0.4);
    VB.FX.explosion(W / 2, H / 2, '#ff8a3d', 60, 400);
    VB.FX.ring(W / 2, H / 2, '#ffc857', Math.max(W, H) * 0.6, 0.9);
    VB.FX.screenFlash(0.4, '#ff8a3d');
    VB.UI.toast('SCREEN CLEARED', 'milestone');
    if (!bossActive()) VB.UI.bossBarHide();
  }

  // --------------------------------------------------------- game flow --
  // v5.3 HORIZON: every run is seeded. Challenge codes pin the seed (and
  // curses/mode); the Daily Void derives it from the calendar date; plain
  // runs draw a random seed whose code is shown at game over for sharing.
  function startGame(mode, opts) {
    opts = opts || {};
    S.state = 'playing';
    S.mode = mode === 'rush' ? 'rush' : 'classic';
    S.score = 0; S.combo = 1; S.comboTimer = 0; S.maxCombo = 1;
    S.kills = 0; S.shots = 0; S.hits = 0; S.runTime = 0;
    // v5.2 OMEGA: nightmare curses — frozen for the whole run
    S.curses = {};
    S.runSource = 'normal';
    S.runSeed = opts.seed != null ? opts.seed : VB.U.code.newSeed();
    if (opts.daily) {
      // Daily Void: one seeded gauntlet for every pilot, calendar-locked
      S.runSource = 'daily';
      S.mode = 'classic';
      S.runSeed = VB.U.code.dailySeed();
    } else if (opts.seed != null) {
      S.runSource = 'code';
      if (opts.mode) S.mode = opts.mode === 'rush' ? 'rush' : 'classic';
    }
    const curseSrc = (opts.seed != null || opts.daily) ? (opts.curses || [])
      : VB.Settings.data.curses;
    for (const id of curseSrc) {
      if (C.CURSES[id]) S.curses[id] = true;
    }
    S.runCode = VB.U.code.encode(S.runSeed, Object.keys(S.curses), S.mode);
    VB.U.RNG.seed(S.runSeed);
    S.scoreMult = runScoreMult();
    S.elitesKilled = 0; S.bossesKilled = 0; S.salvageEarned = 0;
    // v5.2 vault loadout: extra hull, fragile curse, phoenix covenant
    const extraLives = VB.Vault.startLives() - (S.curses.fragile ? 2 : 0);
    S.maxLives = Math.max(2, C.PLAYER.MAX_LIVES + extraLives);
    S.lives = Math.max(1, C.PLAYER.START_LIVES + extraLives);
    S.timers = { rapid: 0, spread: 0, shield: 0, pierce: 0 };
    S.timeSlowTimer = 0; S.slowmo = { scale: 1, timer: 0 };
    S.upgradePending = false;
    S.lastScoreMilestone = 0; S.lastKillMilestone = 0;
    S.zone = null; S.scheduled = [];
    S.upgrades = { damage: 0, speed: 0, fireRate: 0, shieldRegen: 0, bulletSize: 0,
      extraLife: 0, piercing: 0, magnetRange: 0, crit: 0, drones: 0, homing: 0,
      dashMaster: 0, twinShot: 0, velocity: 0, ricochet: 0, explosive: 0,
      bountyHunter: 0, shockwave: 0, thorns: 0, timeWarp: 0, overdrive: 0,
      secondWind: 0, goldRush: 0, salvage: 0,
      cryo: 0, arc: 0, execute: 0, blossom: 0, singularity: 0, focus: 0,
      buzzsaw: 0, ghostDash: 0, retaliation: 0, reflect: 0, ablative: 0, overclock: 0,
      stunner: 0, vampire: 0, orbital: 0, proximity: 0, glassCannon: 0, platedHull: 0,
      comboMaster: 0, sustained: 0, barrage: 0, deadEye: 0,
      overchargeCap: 0, guardianRing: 0,
      // v5.3 CARD EVOLUTION: fused cards live in the same ledger
      omegaArray: 0, singularityCore: 0, nanoSwarm: 0,
      aegisCitadel: 0, warpDriver: 0, stormChorus: 0 };
    S.salvageKills = 0;
    S.phoenixReady = false;
    S.vaultPhoenixReady = VB.Vault.level('phoenix') > 0;
    S.waveElapsed = 0;
    S.ablativeCharge = 0; S.ablativeT = 25;
    S.hitTaken = false;
    S.waveLog = []; S.waveKillsMark = 0; S.waveHit = false;
    if (VB.Achievements) VB.Achievements.on('runStart');
    if (curseCount() > 0) {
      VB.UI.toast('CURSES ACTIVE — SCORE ×' + S.scoreMult.toFixed(2), 'danger');
    }
    if (S.runSource === 'daily') {
      VB.UI.toast('DAILY VOID — ' + VB.U.code.dailyStamp() + ' SEED ' + S.runCode.split('.')[0], 'milestone');
    } else if (S.runSource === 'code') {
      VB.UI.toast('CHALLENGE ' + S.runCode + ' — SAME GAUNTLET FOR EVERY PILOT', 'milestone');
    }

    VB.Enemies.clear();
    VB.Bullets.clearAll();
    VB.Powerups.clearAll();
    VB.FX.clearRunState();
    S.player = VB.Player.create();
    // v5.2: apply dash upgrades + vault PHASE CAPACITOR from frame one
    VB.Player.refreshStats();

    // v5.1.2: route through showScreen(null) so body.menu-open is cleared —
    // hiding screens directly left the class stuck and kept #touchUI display:none
    // for the whole run (invisible joypad / action buttons during gameplay).
    VB.UI.showScreen(null);
    document.getElementById('upgradeScreen').classList.remove('show');
    el.hud.style.display = 'flex';

    VB.Waves.reset();
    VB.Waves.startWave(1);
    musicCheck();
  }

  // ------------------------------------------------- debrief timeline ---
  // v5.3 HORIZON: one entry per cleared wave — kills, seconds, damage tick
  function logWave(w, partial) {
    if (S.waveLog.length > 40) return;   // UI bars cap, keeps memory flat
    S.waveLog.push({
      w: w,
      k: Math.max(0, S.kills - S.waveKillsMark),
      t: Math.round(S.waveElapsed),
      hit: S.waveHit,
      partial: !!partial
    });
    S.waveKillsMark = S.kills;
    S.waveHit = false;
  }

  function gameOver() {
    S.state = 'gameover';
    {
      // the unfinished wave still deserves a bar in the timeline
      const last = S.waveLog[S.waveLog.length - 1];
      if (!last || !(last.w === VB.Waves.wave && last.partial)) {
        logWave(VB.Waves.wave, true);
      }
    }
    el.hud.style.display = 'none';
    VB.UI.bossBarHide();
    VB.Audio.stopMusic();
    VB.Audio.sfx('game_over');
    setSlowmo(0.2, 1.2);

    // persist best (per mode) & leaderboard
    const bestKey = S.mode === 'rush' ? C.STORAGE.bestRush : C.STORAGE.best;
    const best = VB.U.storage.get(bestKey, 0);
    const newBest = S.score > best;
    if (newBest) VB.U.storage.set(bestKey, S.score);
    const board = VB.U.storage.get(C.STORAGE.board, []);
    board.push({ s: S.score, w: VB.Waves.wave, k: S.kills, m: S.mode,
      h: S.player && S.player.ship ? S.player.ship.id : 'vanguard' });
    board.sort(function (a, b) { return b.s - a.s; });
    VB.U.storage.set(C.STORAGE.board, board.slice(0, 5));

    const acc = S.shots > 0 ? Math.min(100, Math.round(S.hits / S.shots * 100)) : 0;
    // v5.2 OMEGA: bank the sortie's salvage (score + elite/boss bounties)
    S.salvageEarned = VB.Vault.projectedGain(S.score, S.elitesKilled, S.bossesKilled);
    VB.Vault.earn(S.salvageEarned);
    // v5.3 HORIZON: Daily Void ledger + challenge-run commendations
    if (S.runSource === 'daily') {
      const prev = VB.U.storage.get(C.STORAGE.daily, null);
      const stamp = VB.U.code.dailyStamp();
      const today = (prev && prev.date === stamp) ? prev : null;
      if (!today || S.score > today.score) {
        VB.U.storage.set(C.STORAGE.daily,
          { date: stamp, score: S.score, wave: VB.Waves.wave });
      }
      if (VB.Achievements) VB.Achievements.on('dailyRun');
    } else if (S.runSource === 'code' && VB.Achievements) {
      VB.Achievements.on('codeRun');
    }
    VB.U.RNG.clear();            // the seeded stream ends with the run
    setTimeout(function () {
      if (S.state !== 'gameover') return;
      VB.UI.showGameOver({
        score: S.score, wave: VB.Waves.wave, kills: S.kills,
        maxCombo: S.maxCombo, accuracy: acc, time: S.runTime,
        best: Math.max(best, S.score), newBest: newBest, mode: S.mode,
        hull: S.player && S.player.ship ? S.player.ship.name : 'VANGUARD',
        elites: S.elitesKilled, bosses: S.bossesKilled,
        salvage: S.salvageEarned,
        curseN: curseCount(), curseMult: S.scoreMult,
        runCode: S.runCode, source: S.runSource, waveLog: S.waveLog
      });
    }, 900);
  }

  function toMenu() {
    S.state = 'menu';
    S.player = null;
    el.hud.style.display = 'none';
    VB.UI.bossBarHide();
    VB.Audio.stopMusic();
    VB.UI.showScreen('start');
    VB.UI.refreshStart();
    musicCheck();
  }

  function togglePause() {
    if (S.state === 'playing') {
      S.state = 'paused';
      VB.Input.releaseAll();
      VB.UI.showScreen('pause');
    } else if (S.state === 'paused') {
      resumeGame();
    }
  }
  function resumeGame() {
    if (S.state !== 'paused') return;
    S.state = 'playing';
    VB.UI.showScreen(null);
  }

  // -------------------------------------------------------------- loop --
  let lastTime = 0;
  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dtRaw = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    S.time += dtRaw;

    VB.FX.updateBackground(dtRaw, W, H);

    if (S.state === 'playing') {
      if (S.slowmo.timer > 0) S.slowmo.timer -= dtRaw;
      if (S.timeSlowTimer > 0) S.timeSlowTimer -= dtRaw;
      const slowScale = S.slowmo.timer > 0 ? S.slowmo.scale : 1;
      const dtP = dtRaw * slowScale;
      const dtW = dtRaw * slowScale * (S.timeSlowTimer > 0 ? 0.45 : 1);

      S.runTime += dtRaw;
      S.waveElapsed += dtRaw;
      // v4.0 Ablative Plating: recharge the negation charge
      if (S.upgrades.ablative > 0 && S.ablativeCharge <= 0) {
        S.ablativeT -= dtRaw;
        if (S.ablativeT <= 0) {
          S.ablativeCharge = 1;
          VB.UI.toast('ABLATIVE PLATING READY', 'info');
          VB.Audio.sfx('shield_up');
        }
      }
      // v5.0 Sustain Field: power-up timers drain 20% slower per level
      const sus = 1 + 0.2 * (S.upgrades.sustained || 0);
      for (const k in S.timers) if (S.timers[k] > 0) S.timers[k] -= dtRaw / sus;
      if (S.comboTimer > 0) { S.comboTimer -= dtRaw; if (S.comboTimer <= 0) S.combo = 1; }
      updateZone(dtW);
      processSchedule(dtW);

      VB.Player.update(dtP);
      VB.Enemies.update(dtW);
      VB.Bullets.update(dtW);
      VB.Bullets.collide();
      VB.Powerups.update(dtW);
      VB.FX.update(dtW);
      VB.Waves.update(dtRaw);
      VB.UI.updateHUD(dtRaw);
    } else if (S.state === 'gameover') {
      VB.Bullets.update(dtRaw * 0.3);
      VB.FX.update(dtRaw);
      processSchedule(dtRaw);
    } else {
      VB.FX.update(dtRaw);
    }

    VB.UI.fpsTick(dtRaw);
    // a visual glitch must never break the rAF chain
    try { render(); }
    catch (err) { VB.UI.err(err.message + ' @' + (err.lineNumber || '?')); }
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.fillStyle = C.COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    VB.FX.drawBackground(ctx, W, H);

    const inWorld = S.state === 'playing' || S.state === 'paused' ||
      S.state === 'upgrade' || S.state === 'gameover';
    if (inWorld) {
      const sh = VB.FX.shakeOffset;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      drawZone(ctx);
      VB.Bullets.drawMines(ctx);
      VB.FX.drawWarnings(ctx);
      VB.Powerups.draw(ctx);
      VB.Bullets.draw(ctx);
      VB.Enemies.draw(ctx);
      if (S.state !== 'gameover') VB.Player.draw(ctx);
      if (VB.Render.drawShipFX) VB.Render.drawShipFX(ctx);   // v4.2 wells + v5.0 turrets
      VB.FX.draw(ctx);
      ctx.restore();

      VB.FX.drawTimeTint(ctx, W, H, S.timeSlowTimer);
    }

    // v5.2 OMEGA: NEBULA FOG curse — edges of the void close in
    if (S.curses.fog && S.state === 'playing') {
      VB.Render.drawFog(ctx, W, H, S.time);
    }

    VB.FX.drawVignette(ctx, W, H);
    VB.FX.drawFlash(ctx, W, H);
  }

  // -------------------------------------------------------------- boot --
  const el = {};
  let settingsReturnTo = 'start';

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    VB.FX.initStars(W, H);
  }

  function bindButtons() {
    el.startBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      // v5.3: a loaded challenge code arms the next launch (one-shot)
      const pend = VB.Settings.data.pendingRun;
      if (pend && pend.seed != null) {
        VB.Settings.data.pendingRun = null;
        VB.Settings.save();
        startGame('classic', { seed: pend.seed, curses: pend.curses });
      } else {
        startGame('classic');
      }
    });
    el.restartBtn.addEventListener('click', function () { VB.Audio.sfx('ui_click'); startGame(S.mode); });
    el.bossRushBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      const pend = VB.Settings.data.pendingRun;
      if (pend && pend.seed != null) {
        VB.Settings.data.pendingRun = null;
        VB.Settings.save();
        startGame('rush', { seed: pend.seed, curses: pend.curses });
      } else {
        startGame('rush');
      }
    });
    // v5.3 HORIZON: the Daily Void — one calendar-seeded gauntlet for all
    el.dailyBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      startGame('classic', { daily: true });
    });
    el.resumeBtn.addEventListener('click', function () { VB.Audio.sfx('ui_click'); resumeGame(); });
    el.menuBtn.addEventListener('click', function () { VB.Audio.sfx('ui_click'); toMenu(); });
    el.quitBtn.addEventListener('click', function () { VB.Audio.sfx('ui_click'); toMenu(); });

    // v5.2 OMEGA: salvage vault
    el.vaultBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      VB.UI.renderVault();
      VB.UI.showScreen('vault');
    });
    el.vaultCloseBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      VB.UI.showScreen('start');
    });

    el.settingsBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      settingsReturnTo = 'start';
      VB.UI.showScreen('settings');
    });
    el.pauseSettingsBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      settingsReturnTo = 'pause';
      el.settingsScreen.classList.remove('hidden');
      el.pauseScreen.classList.add('hidden');
    });
    el.settingsCloseBtn.addEventListener('click', function () {
      VB.Audio.sfx('ui_click');
      if (settingsReturnTo === 'pause') {
        el.settingsScreen.classList.add('hidden');
        el.pauseScreen.classList.remove('hidden');
      } else {
        VB.UI.showScreen('start');
      }
    });

    // hover blips
    document.querySelectorAll('.btn, .upgrade-card').forEach(function (b) {
      b.addEventListener('mouseenter', function () { VB.Audio.sfx('ui_hover'); });
    });
  }

  function boot() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    for (const id of ['hud', 'startScreen', 'gameOverScreen', 'pauseScreen',
      'settingsScreen', 'startBtn', 'restartBtn', 'resumeBtn', 'menuBtn',
      'quitBtn', 'settingsBtn', 'pauseSettingsBtn', 'settingsCloseBtn',
      'bossRushBtn', 'achvGrid', 'vaultBtn', 'vaultCloseBtn',
      'dailyBtn']) {
      el[id] = document.getElementById(id);
    }

    resize();
    window.addEventListener('resize', resize);

    VB.Vault.load();
    VB.UI.init();
    if (VB.Ships) VB.Ships.initUI();
    VB.Achievements.init();
    VB.Input.init(canvas, {
      onPauseToggle: togglePause,
      onMuteToggle: toggleMute,
      onEnter: function () {
        if (S.state === 'menu' || S.state === 'gameover') {
          startGame(S.state === 'menu' ? 'classic' : S.mode);
        }
      }
    });
    VB.Audio.init();
    bindButtons();

    // auto-pause on tab switch (mirrors the original game)
    window.addEventListener('blur', function () {
      if (S.state === 'playing') togglePause();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && S.state === 'playing') togglePause();
    });

    // upgrade draft hotkeys 1 / 2 / 3 / 4 (4th card: vault quartermaster
    // drafts and v5.3 evolution offers)
    window.addEventListener('keydown', function (e) {
      if (S.state === 'upgrade') {
        const i = ['1', '2', '3', '4'].indexOf(e.key);
        if (i >= 0) VB.Upgrades.pickByIndex(i);
      }
    });

    // surface runtime errors for QA
    window.addEventListener('error', function (ev) {
      VB.UI.err(ev.message + ' @' + (ev.lineno || '?'));
    });

    el.hud.style.display = 'none';
    VB.UI.showScreen('start');
    musicCheck(); // menu theme (starts after the first user gesture)
    requestAnimationFrame(loop);
  }

  function toggleMute() {
    VB.Settings.data.mute = !VB.Settings.data.mute;
    VB.Settings.save();
    VB.Audio.applyVolumes(VB.Settings.data.music, VB.Settings.data.sfx, VB.Settings.data.mute);
    VB.UI.toast(VB.Settings.data.mute ? 'AUDIO MUTED' : 'AUDIO ON', 'info');
  }

  // public surface
  const pub = {
    boot,
    startGame, gameOver, toMenu, togglePause, resumeGame,
    killEnemy, damagePlayer, applyNuke,
    setTimeSlow, setSlowmo, schedule, musicCheck,
    spawnScoreZone, isInScoreZone, checkMilestones, toggleMute,
    logWave, loop
  };
  // expose live run-state as direct properties on the public object
  for (const k of ['state', 'mode', 'player', 'score', 'combo', 'comboTimer', 'maxCombo',
    'kills', 'shots', 'hits', 'runTime', 'lives', 'maxLives', 'upgrades',
    'timers', 'timeSlowTimer', 'slowmo', 'upgradePending', 'zone', 'time',
    'waveElapsed', 'ablativeCharge', 'ablativeT', 'hitTaken',
    'curses', 'scoreMult', 'elitesKilled', 'bossesKilled', 'salvageEarned',
    'vaultPhoenixReady',
    'runSeed', 'runCode', 'runSource', 'waveLog',
    '_upgradeChoices']) {
    (function (key) {
      Object.defineProperty(pub, key, {
        get: function () { return S[key]; },
        set: function (v) { S[key] = v; }
      });
    })(k);
  }
  Object.defineProperty(pub, 'W', { get: function () { return W; } });
  Object.defineProperty(pub, 'H', { get: function () { return H; } });
  Object.defineProperty(pub, 'enemiesList', { get: enemiesList });
  pub.curseCount = curseCount;
  pub.runScoreMult = runScoreMult;

  return pub;
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', VB.Game.boot);
} else {
  VB.Game.boot();
}
