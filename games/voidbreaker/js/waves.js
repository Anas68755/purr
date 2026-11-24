// ============================================================
// VOID BREAKER // NEON ASCENSION — waves.js  (v4.0 SINGULARITY)
// Budget-based wave director with special waves (swarm / minefield /
// elite squad), boss waves every 5 waves (8-archetype rotation with
// fixed dual-boss sets and random pairs late game), mines & zones.
// v4.0: BOSS RUSH mode — a pure boss gauntlet (dual pair every 4th
// fight, HP ramps with BOSS_RUSH.HP_STEP), upgrade after every kill.
// ============================================================
window.VB = window.VB || {};

VB.Waves = (function () {
  let wave = 1;
  let budget = 0;
  let spawnTimer = 0;
  let waveDelay = 0;
  let mineTimer = 10;
  let zoneTimer = 0;          // negative = countdown until zone spawns
  let special = null;         // 'swarm' | 'minefield' | 'elites' | null
  let specialIdx = 0;
  let bossIntro = false;

  function isBossWave(w) {
    if (rush()) return true;
    return (w || wave) % VB.CONFIG.BOSS_EVERY === 0;
  }

  /** v4.0 BOSS RUSH mode? */
  function rush() { return VB.Game.mode === 'rush'; }

  /** label for a rush wave banner */
  function rushLabel(w) {
    if (w % VB.CONFIG.BOSS_RUSH.DUAL_EVERY === 0) return 'TWIN ASCENDANTS';
    return VB.CONFIG.BOSS_ROTATION[(w - 1) % VB.CONFIG.BOSS_ROTATION.length];
  }

  function startWave(w) {
    const g = VB.Game;
    wave = w;
    special = null;
    bossIntro = false;

    if (isBossWave()) {
      budget = 0;
      waveDelay = 1.6;
      bossIntro = true;
      // Phoenix Protocol recharges at the start of every boss wave
      if (VB.Game.upgrades.secondWind > 0) VB.Game.phoenixReady = true;
      if (rush()) {
        // score zones still rotate through the gauntlet
        zoneTimer = -2;
        VB.UI.bossBanner(rushLabel(w));
        if (VB.Achievements) VB.Achievements.on('rushWave', w);
      } else {
        VB.UI.bossBanner(B.bossName(w));
      }
      VB.Audio.sfx('boss_warning');
      VB.FX.screenFlash(0.25, '#ff5470');
      g.musicCheck();
    } else {
      // special waves on every 3rd normal wave, rotating (2nd with SPECIAL OPS)
      const g2 = VB.Game;
      const specialEvery = (g2.curses && g2.curses.rushhour) ? 2 : 3;
      if (w > 2 && (w % specialEvery === (specialEvery === 3 ? 2 : 0))) {
        special = ['swarm', 'minefield', 'elites'][specialIdx % 3];
        specialIdx++;
      }
      let mult = 1;
      if (special === 'swarm') mult = 1.6;
      if (special === 'elites') mult = 0.8;
      // v5.2 HORDES curse: the void sends more
      if (g2.curses && g2.curses.hordes) mult *= 1.4;
      budget = Math.ceil((6 + w * 3 + Math.floor(w * w * 0.25)) * mult);
      waveDelay = 1.5;
      VB.UI.announce(special ? specialName(special) : 'WAVE ' + w, special ? 'danger' : '');
      VB.Audio.sfx('wave_start');
      if (special) VB.UI.toast(specialHint(special), 'danger');
      // v5.2: DOOMED BUT GLORIOUS — deep into a cursed run
      if (VB.Game.curseCount && VB.Game.curseCount() >= 3 && VB.Achievements) {
        VB.Achievements.on('curseWave', w);
      }
      // v5.3 HORIZON: deep into ANY cursed run unfreezes the secret hull
      if (w >= 20 && VB.Game.curseCount && VB.Game.curseCount() >= 2 &&
          VB.Game.mode === 'classic' && VB.Achievements) {
        VB.Achievements.on('omegaUnlock');
      }
      // schedule a score zone shortly after the wave starts
      zoneTimer = -2;
    }
    spawnTimer = 0;
    VB.Game.waveElapsed = 0;   // v4.0 Overclock Reactor window
    VB.UI.updateWave(wave);
  }

  const C = VB.CONFIG;

  function isDualBoss(w) {
    w = w || wave;
    return !!(C.DUAL_BOSS_SETS[w]) || w >= C.DUAL_BOSS_RANDOM_WAVE;
  }

  function dualPair(w) {
    if (C.DUAL_BOSS_SETS[w]) return C.DUAL_BOSS_SETS[w];
    // random distinct pair from the full roster (v5.3: seeded under run codes)
    const pool = C.BOSS_ROTATION.slice();
    const a = pool.splice(Math.floor(VB.U.RNG.float() * pool.length), 1)[0];
    const b = pool.splice(Math.floor(VB.U.RNG.float() * pool.length), 1)[0];
    return [a, b];
  }

  const B = {
    bossName(w) {
      w = w || wave;
      if (isDualBoss(w)) return 'TWIN ASCENDANTS';
      // singles walk the full rotation; dual fights don't consume slots
      let idx = Math.floor(w / C.BOSS_EVERY) - 1;
      for (const dw of Object.keys(C.DUAL_BOSS_SETS)) {
        if (w > Number(dw)) idx--;
      }
      const R = C.BOSS_ROTATION;
      return R[((idx % R.length) + R.length) % R.length];
    }
  };
  function specialName(s) {
    return s === 'swarm' ? 'SWARM DETECTED' :
      s === 'minefield' ? 'MINEFIELD AHEAD' : 'ELITE SQUAD';
  }
  function specialHint(s) {
    return s === 'swarm' ? 'They come in numbers - clear fast' :
      s === 'minefield' ? 'Watch the floor - mines inbound' :
        'Veteran hulls - worth big score';
  }

  function unlockedTypes() {
    const w = wave;
    const out = [];
    for (const k in VB.CONFIG.ENEMIES) {
      if (VB.CONFIG.ENEMIES[k].minWave <= w) out.push(k);
    }
    return out;
  }

  function pickType() {
    const g = VB.Game;
    const avail = unlockedTypes().filter(function (t) {
      return VB.CONFIG.ENEMIES[t].cost <= Math.max(budget, 1);
    });
    if (!avail.length) return 'grunt';

    if (special === 'swarm') {
      return VB.U.RNG.float() < 0.7 ? 'grunt' : 'zigzag';
    }
    const weights = {};
    for (const t of avail) {
      // slightly favor expensive units later on
      weights[t] = 1 + VB.CONFIG.ENEMIES[t].cost * Math.min(0.35, wave * 0.02);
    }
    return VB.U.weightedPick(weights);
  }

  function update(dt) {
    const g = VB.Game;

    // score zone scheduling (counts up from a negative timer)
    if (zoneTimer < 0 && (!isBossWave() || rush())) {
      zoneTimer += dt;
      if (zoneTimer >= 0) {
        g.spawnScoreZone();
        zoneTimer = -VB.CONFIG.SCORE_ZONE_EVERY;   // recurring
      }
    }

    // boss intro delay
    if (bossIntro && waveDelay > 0) {
      waveDelay -= dt;
      if (waveDelay <= 0) {
        bossIntro = false;
        if (rush()) {
          const eff = VB.CONFIG.BOSS_RUSH.HP_BASE + wave * VB.CONFIG.BOSS_RUSH.HP_STEP;
          if (wave % VB.CONFIG.BOSS_RUSH.DUAL_EVERY === 0) {
            // every 4th gauntlet fight is a random dual pair (seeded v5.3)
            const pool = C.BOSS_ROTATION.slice();
            const a = pool.splice(Math.floor(VB.U.RNG.float() * pool.length), 1)[0];
            const b = pool.splice(Math.floor(VB.U.RNG.float() * pool.length), 1)[0];
            VB.Boss.spawn(a, eff);
            VB.Boss.spawn(b, eff);
          } else {
            VB.Boss.spawn(rushLabel(wave), eff);
          }
        } else if (isDualBoss(wave)) {
          const pair = dualPair(wave);
          VB.Boss.spawn(pair[0], wave);
          VB.Boss.spawn(pair[1], wave);
        } else {
          VB.Boss.spawn(B.bossName(wave), wave);
        }
        g.musicCheck();
      }
      return;
    }

    if (waveDelay > 0) { waveDelay -= dt; return; }

    // enemy spawning from the budget
    if (budget > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const baseRate = Math.max(0.2, 1.1 - wave * 0.04);
        spawnTimer = special === 'swarm' ? baseRate * 0.5 : baseRate;
        const type = pickType();
        const cost = VB.CONFIG.ENEMIES[type].cost;
        VB.Enemies.spawn(type, { forceElite: special === 'elites' });
        budget -= cost;
      }
    }

    // ambient mine spawner (suppressed in BOSS RUSH — bosses bring their own)
    if (!rush() && wave >= VB.CONFIG.MINE_WAVE) {
      mineTimer -= dt;
      if (mineTimer <= 0) {
        // v5.2 MINE BELT curse: the belt thickens
        const curseMult = (VB.Game.curses && VB.Game.curses.minefield) ? 0.45 : 1;
        mineTimer = Math.max(3, 8 - wave * 0.3) * (special === 'minefield' ? 0.35 : 1) * curseMult;
        VB.Bullets.spawnMine();
      }
    }

    // wave complete?
    if (budget <= 0 && VB.Enemies.list.length === 0 && !bossIntro) {
      VB.Game.checkMilestones();
      if (VB.Game.logWave) VB.Game.logWave(wave);   // v5.3 debrief timeline
      VB.Upgrades.offer();
    }
  }

  function onEnemyGone(e) {
    // enemies that escape off-screen free up their slot
    budget = Math.max(0, budget);   // budget already spent; nothing to refund
  }

  function reset() {
    wave = 1; budget = 0; spawnTimer = 0; waveDelay = 0;
    mineTimer = 10; zoneTimer = 0; special = null; specialIdx = 0; bossIntro = false;
  }

  return {
    startWave, update, onEnemyGone, reset, isBossWave,
    get wave() { return wave; },
    get pendingEnemies() { return budget; }
  };
})();
