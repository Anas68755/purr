// ============================================================
// VOID BREAKER // NEON ASCENSION — boss.js  (v5.0 ABYSS)
// Twelve boss archetypes, all with an enrage phase at 30% HP.
//   DREADNOUGHT — fan spray, delayed aimed rail bursts (queued via
//                 the frame-synced delayedBullet queue), radial ring,
//                 rotating spiral. (Original boss, enhanced.)
//   SERAPH      — twin-arm bullet spiral, descending bullet walls
//                 with a gap, 4-way cross bursts, flanker summons.
//   HYDRA       — three-headed venom serpent: triple aimed fans,
//                 homing venom orbs, telegraphed coil dash that
//                 trails a wall of toxin.
//   TEMPEST     — storm caller: blinks around the arena, drops
//                 telegraphed lightning columns, chain-bolt fans,
//                 4-arm static spirals.
//   MONOLITH    — armored fortress: rotating beam sweeps, mortar
//                   rings that burst at marked positions, mine
//                   deployment, frontal fortify (bullet-proof window).
//   ARCHON      — final ascendant: judgment ring volleys, twin wing
//                 lasers, void summons, 3-arm ascendant spiral.
//   VORTEX      — v4.0 gravity maelstrom: drags the player inward,
//                 curved debris spirals, telegraphed event-horizon
//                 implosions (bullets converge with a spiral bend),
//                 enrage singularity bursts.
//   GORGON      — v4.0 prism hydra: five hair-turret aimed fans,
//                 prism volleys that shatter into fragment sprays,
//                 sweeping gaze beams, enrage prism storms.
//   LEVIATHAN   — v4.2 void serpent: undulating segmented body,
//                 tide-flood fans, telegraphed maw-pull channel,
//                 fused homing spines, enrage double maelstrom.
//   MIRAGE      — v4.2 illusionist: blink teleports with afterimages,
//                 mirror radial prisms, tri-lance mirrored rails,
//                 illusion doubles, enrage prism storms.
//   OUROBOROS   — v5.0 ring serpent: rides an elliptical orbit while
//                 spinning coil spirals, twin bite fans from head and
//                 tail, scale rings, enrage world-coil double spiral.
//   CERBERUS    — v5.0 triple-headed warden: staggered roar streams,
//                 hound summons, telegraphed slam columns with a
//                 shockwave, enrage infernal cross + prisms.
// ============================================================
window.VB = window.VB || {};

VB.Boss = (function () {

  function spawn(archetype, wave) {
    const B = VB.CONFIG.BOSSES[archetype];
    const g = VB.Game;
    const e = {
      type: 'boss',
      archetype: archetype,
      name: B.name,
      x: g.W / 2, y: -70,
      hp: B.hp(wave), maxHp: B.hp(wave),
      speed: B.speed, w: B.w, h: B.h,
      color: B.color, enragedColor: B.enragedColor,
      scoreValue: B.score,
      fireRate: Math.max(0.3, 0.55 - wave * 0.01),
      fireTimer: 1.2,
      time: 0, enraged: false,
      phase: 0, phaseTimer: 0,
      spiralAngle: 0, summonTimer: 4
    };
    VB.Enemies.list.push(e);
    VB.UI.bossBar(B.name, 1);
    return e;
  }

  function enrage(e) {
    e.enraged = true;
    e.fireRate *= 0.6;
    VB.UI.toast('BOSS ENRAGED', 'danger');
    VB.Audio.sfx('shield_break');
    VB.FX.screenFlash(0.3, '#ff5470');
    VB.FX.shake(12, 0.4);
    VB.FX.ring(e.x, e.y, '#ff5470', 220, 0.6);
  }

  function updateBoss(e, dt) {
    const g = VB.Game;

    // entrance (one-shot: once docked, never early-return again so
    // phaseTimer & attack timers keep running while the boss bobs)
    if (!e.entered) {
      e.y += e.speed * dt;
      if (e.y >= 110) e.entered = true;
      return;
    }

    e.phaseTimer += dt;

    if (!e.enraged && e.hp / e.maxHp < 0.3) enrage(e);

    switch (e.archetype) {
      case 'SERAPH':    updateSeraph(e, dt);    return;
      case 'HYDRA':     updateHydra(e, dt);     return;
      case 'TEMPEST':   updateTempest(e, dt);   return;
      case 'MONOLITH':  updateMonolith(e, dt);  return;
      case 'ARCHON':    updateArchon(e, dt);    return;
      case 'VORTEX':    updateVortex(e, dt);    return;
      case 'GORGON':    updateGorgon(e, dt);    return;
      case 'LEVIATHAN': updateLeviathan(e, dt); return;
      case 'MIRAGE':    updateMirage(e, dt);    return;
      case 'OUROBOROS': updateOuroboros(e, dt); return;
      case 'CERBERUS':  updateCerberus(e, dt);  return;
      default:          updateDreadnought(e, dt);
    }
  }

  // ------------------------------------------------- DREADNOUGHT ------
  function updateDreadnought(e, dt) {
    const g = VB.Game;
    const strafeW = g.W * (e.enraged ? 0.4 : 0.32);
    const strafeSpd = e.enraged ? 1.2 : 0.8;
    e.x = g.W / 2 + Math.sin(e.phaseTimer * strafeSpd) * strafeW;
    e.y = 110 + Math.sin(e.phaseTimer * 0.6) * 25;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // forward fan
      const count = e.enraged ? 9 : 5;
      for (let a = 0; a < count; a++) {
        const ang = -0.6 + (1.2 / Math.max(1, count - 1)) * a;
        VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
          vx: Math.sin(ang) * 320, vy: Math.cos(ang) * 280,
          size: 5, color: '#ff8a3d'
        });
      }
      e.fireTimer = e.fireRate;
    } else if (e.phase === 1) {
      // aimed rail burst — queued frame-synced shots (pause-safe)
      if (g.player) {
        const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        const count = e.enraged ? 5 : 3;
        for (let j = 0; j < count; j++) {
          VB.Bullets.queueDelayed({
            x: e.x, y: e.y + e.h / 2,
            vx: Math.cos(ang) * (380 + j * 40),
            vy: Math.sin(ang) * (380 + j * 40),
            size: 4, color: '#ff5470',
            delay: j * 0.08
          });
        }
      }
      e.fireTimer = e.fireRate * 0.9;
    } else if (e.phase === 2) {
      // radial ring
      const count = e.enraged ? 16 : 12;
      for (let a = 0; a < count; a++) {
        const ang = (a / count) * Math.PI * 2;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220,
          size: 4, color: '#ffc857'
        });
      }
      e.fireTimer = e.fireRate * 1.4;
    } else {
      // rotating spiral
      for (let a = 0; a < 8; a++) {
        const ang = e.phaseTimer * 3 + (a / 8) * Math.PI * 2;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 250, vy: Math.sin(ang) * 250,
          size: 3, color: '#c86bff'
        });
      }
      e.fireTimer = e.fireRate * 0.5;
    }
  }

  // ------------------------------------------------------ SERAPH -------
  function updateSeraph(e, dt) {
    const g = VB.Game;
    // figure-8 drift
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.7) * g.W * (e.enraged ? 0.36 : 0.3);
    e.y = 130 + Math.sin(e.phaseTimer * 1.4) * 42;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;

    if (e.phase === 0) {
      // twin-arm spiral burst
      const ticks = e.enraged ? 16 : 11;
      e.spiralAngle += 0.42;
      for (let k = 0; k < 2; k++) {
        const ang = e.spiralAngle + k * Math.PI;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 215, vy: Math.sin(ang) * 215,
          size: 4, color: '#c86bff'
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.phase = 1;
        e.fireTimer = e.fireRate * 1.6;
      } else {
        e.fireTimer = 0.09;
      }
    } else if (e.phase === 1) {
      // bullet wall with a gap
      const cols = Math.max(8, Math.floor(g.W / 90));
      const gap = VB.U.randi(1, cols - 2);
      for (let c = 0; c < cols; c++) {
        if (c === gap || c === gap + 1) continue;
        VB.Bullets.spawnEnemy(40 + c * (g.W - 80) / (cols - 1), -12, {
          vx: 0, vy: 195, size: 5, color: '#ff4fd8'
        });
      }
      e.phase = e.enraged ? 2 : 0;
      e.fireTimer = e.fireRate * 1.5;
    } else if (e.phase === 2) {
      // 4-way cross bursts aimed at the player's quadrant
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (let q = 0; q < 4; q++) {
          const ang = base + q * Math.PI / 2;
          for (let j = 0; j < 3; j++) {
            VB.Bullets.queueDelayed({
              x: e.x, y: e.y,
              vx: Math.cos(ang) * (340 + j * 45),
              vy: Math.sin(ang) * (340 + j * 45),
              size: 4, color: '#ff5470',
              delay: j * 0.07
            });
          }
        }
      }
      e.phase = e.enraged ? 3 : 0;
      e.fireTimer = e.fireRate * 1.8;
    } else {
      // enrage only: summon flankers
      if (VB.Enemies.countBosses() === 1 && VB.Enemies.list.length < 14) {
        VB.Enemies.spawn('flanker', { forceElite: false, silent: true });
        VB.Enemies.spawn('flanker', { forceElite: false, silent: true });
      }
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.2;
    }
  }

  // ------------------------------------------------------- HYDRA -------
  // Modes: 0 = triple venom fan, 1 = homing orbs, 2 = coil dash.
  function updateHydra(e, dt) {
    const g = VB.Game;

    // ---- coil dash overrides normal drift ----
    if (e.coilT > 0) {
      e.coilT -= dt;
      e.x += e.coilDir * e.coilSpeed * dt;
      e.y = 130 + Math.sin(e.phaseTimer * 6) * 8;
      // toxic trail behind the dash
      e.trailEmit -= dt;
      if (e.trailEmit <= 0) {
        e.trailEmit = e.enraged ? 0.045 : 0.07;
        VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
          vx: VB.U.rand(-30, 30), vy: 210,
          size: 5, color: e.enraged ? '#d8ff4f' : '#4dffa6'
        });
      }
      if (e.x < 70) { e.x = 70; e.coilT = 0; }
      if (e.x > g.W - 70) { e.x = g.W - 70; e.coilT = 0; }
      if (e.coilT <= 0) e.fireTimer = e.fireRate * 0.8;
      return;
    }

    // slither drift
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.55) * g.W * (e.enraged ? 0.3 : 0.24);
    e.y = 125 + Math.sin(e.phaseTimer * 1.1) * 30;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % 3;

    if (e.phase === 0) {
      // triple venom fan — one stream per head
      const heads = [-38, 0, 38];
      const spread = e.enraged ? 7 : 5;
      if (g.player) {
        for (const hx of heads) {
          const base = Math.atan2(g.player.y - e.y, g.player.x - (e.x + hx));
          for (let j = 0; j < spread; j++) {
            const ang = base + (j - (spread - 1) / 2) * 0.14;
            VB.Bullets.queueDelayed({
              x: e.x + hx, y: e.y + e.h / 2,
              vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
              size: 4, color: '#4dffa6', delay: j * 0.05
            });
          }
        }
      }
      e.fireTimer = e.fireRate * 1.3;
    } else if (e.phase === 1) {
      // homing venom orbs
      const orbs = e.enraged ? 6 : 4;
      for (let k = 0; k < orbs; k++) {
        const ang = (k / orbs) * Math.PI * 2 + e.phaseTimer;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 150, vy: Math.abs(Math.sin(ang)) * 90 + 60,
          size: 6, color: '#8dffb8', homing: true, turn: 1.7
        });
      }
      VB.Audio.sfx('laser_enemy');
      e.fireTimer = e.fireRate * 1.7;
    } else {
      // telegraph then coil dash
      e.coilDir = (g.player && g.player.x < e.x) ? -1 : 1;
      if (Math.abs((g.player ? g.player.x : g.W / 2) - e.x) < 60) {
        e.coilDir = Math.random() < 0.5 ? -1 : 1;
      }
      e.coilSpeed = e.enraged ? 780 : 640;
      e.coilT = 0.95;
      e.trailEmit = 0;
      VB.FX.ring(e.x, e.y, '#4dffa6', 120, 0.4);
      VB.Audio.sfx('warning');
      e.fireTimer = 99; // resumed when the coil ends
    }
  }

  // ----------------------------------------------------- TEMPEST -------
  // Blinks around the arena. Attacks: lightning columns (telegraphed),
  // chain-bolt fans, static spirals.
  function updateTempest(e, dt) {
    const g = VB.Game;

    // lightning column countdown (telegraph drawn in enemies.js)
    if (e.columns && e.colT > 0) {
      e.colT -= dt;
      if (e.colT <= 0) {
        for (const cx of e.columns) {
          const drops = e.enraged ? 10 : 7;
          for (let j = 0; j < drops; j++) {
            VB.Bullets.queueDelayed({
              x: cx + VB.U.rand(-8, 8), y: -14,
              vx: 0, vy: 540, size: 3, color: '#58a6ff', delay: j * 0.055
            });
          }
        }
        VB.Audio.sfx('laser_enemy');
        VB.FX.screenFlash(0.12, '#58a6ff');
        e.columns = null;
      }
    }

    // blink repositioning
    e.blinkT -= dt;
    if (e.blinkT <= 0) {
      e.blinkT = e.enraged ? 1.3 : 1.9;
      VB.FX.explosion(e.x, e.y, '#58a6ff', 10, 140);
      e.x = VB.U.rand(90, g.W - 90);
      e.y = VB.U.rand(95, 200);
      VB.FX.explosion(e.x, e.y, '#58a6ff', 10, 140);
      VB.FX.ring(e.x, e.y, '#58a6ff', 90, 0.3);
    } else {
      // gentle hover wobble between blinks
      e.x += Math.sin(e.phaseTimer * 2.2) * 14 * dt;
      e.y += Math.cos(e.phaseTimer * 1.7) * 10 * dt;
      e.x = VB.U.clamp(e.x, 70, g.W - 70);
      e.y = VB.U.clamp(e.y, 85, 240);
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % 3;

    if (e.phase === 0) {
      // telegraphed lightning columns (3, or 5 when enraged)
      const n = e.enraged ? 5 : 3;
      const cols = [];
      for (let i = 0; i < n; i++) {
        cols.push(Math.round(VB.U.rand(60, g.W - 60)));
      }
      if (g.player) cols[0] = Math.round(g.player.x); // one always tracks the player
      e.columns = cols;
      e.colT = 0.85;
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 1.9;
    } else if (e.phase === 1) {
      // chain-bolt fan: staggered bursts that chase the player's quadrant
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        const arms = e.enraged ? 7 : 5;
        for (let j = 0; j < arms; j++) {
          const ang = base + (j - (arms - 1) / 2) * 0.16;
          VB.Bullets.queueDelayed({
            x: e.x, y: e.y,
            vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430,
            size: 4, color: '#ffc857', delay: j * 0.06
          });
        }
      }
      e.fireTimer = e.fireRate * 1.4;
    } else {
      // static spiral — 4 arms, reverse-spin burst
      const ticks = e.enraged ? 14 : 10;
      e.spiralAngle -= 0.5;
      for (let k = 0; k < 4; k++) {
        const ang = e.spiralAngle + k * Math.PI / 2;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240,
          size: 3, color: '#58a6ff'
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.fireTimer = e.fireRate * 1.5;
      } else {
        e.fireTimer = 0.1;
      }
    }
  }

  // ---------------------------------------------------- MONOLITH -------
  // Slow fortress. Modes: 0 = beam sweep, 1 = mortar rings,
  // 2 = mine volley, 3 = fortify (frontal shield window).
  function updateMonolith(e, dt) {
    const g = VB.Game;

    // heavy drift
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.35) * g.W * 0.26;
    e.y = 120 + Math.sin(e.phaseTimer * 0.5) * 18;

    // fortify window: frontal arc blocks bullets (collide checks this)
    if (e.fortifyT > 0) {
      e.fortifyT -= dt;
      if (e.fortifyT <= 0) {
        // shield collapse burst
        const count = e.enraged ? 16 : 12;
        for (let a = 0; a < count; a++) {
          const ang = (a / count) * Math.PI * 2;
          VB.Bullets.spawnEnemy(e.x, e.y, {
            vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230,
            size: 4, color: '#8fb7ff'
          });
        }
        VB.FX.ring(e.x, e.y, '#8fb7ff', 140, 0.45);
        VB.Audio.sfx('shield_break');
      }
      return; // no attacks while fortified
    }

    // beam sweep emission (rotating lighthouse beam)
    if (e.sweepT > 0) {
      e.sweepT -= dt;
      e.sweepAngle += e.sweepDir * (e.enraged ? 1.7 : 1.25) * dt;
      e.sweepEmit -= dt;
      if (e.sweepEmit <= 0) {
        e.sweepEmit = 0.055;
        VB.Bullets.spawnEnemy(
          e.x + Math.cos(e.sweepAngle) * (e.w + 8),
          e.y + Math.sin(e.sweepAngle) * (e.w + 8), {
            vx: Math.cos(e.sweepAngle) * 250,
            vy: Math.abs(Math.sin(e.sweepAngle)) * 120 + Math.sin(e.sweepAngle) * 140,
            size: 4, color: '#8fb7ff'
          });
      }
      // mirrored beam when enraged
      if (e.enraged) {
        const ang2 = Math.PI - e.sweepAngle;
        e.sweepEmit2 -= dt;
        if (e.sweepEmit2 <= 0) {
          e.sweepEmit2 = 0.055;
          VB.Bullets.spawnEnemy(
            e.x + Math.cos(ang2) * (e.w + 8),
            e.y + Math.sin(ang2) * (e.w + 8), {
              vx: Math.cos(ang2) * 250,
              vy: Math.sin(ang2) * 250,
              size: 4, color: '#ffb35c'
            });
        }
      }
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % 4;

    if (e.phase === 0) {
      // rotating beam sweep
      e.sweepT = e.enraged ? 2.8 : 2.2;
      e.sweepDir = Math.random() < 0.5 ? -1 : 1;
      e.sweepAngle = g.player
        ? Math.atan2(g.player.y - e.y, g.player.x - e.x)
        : Math.PI / 2;
      e.sweepEmit = 0; e.sweepEmit2 = 0;
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 2.2;
    } else if (e.phase === 1) {
      // mortar rings — burst at the player's marked position
      const shots = e.enraged ? 3 : 2;
      for (let m = 0; m < shots; m++) {
        const tx = g.player ? g.player.x + VB.U.rand(-70, 70) : g.W / 2;
        const ty = g.player ? g.player.y + VB.U.rand(-40, 40) : g.H * 0.7;
        VB.Game.schedule(0.9 + m * 0.35, function () {
          if (e.hp <= 0) return;
          const count = e.enraged ? 12 : 8;
          for (let a = 0; a < count; a++) {
            const ang = (a / count) * Math.PI * 2;
            VB.Bullets.spawnEnemy(tx, ty, {
              vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200,
              size: 4, color: '#ffb35c'
            });
          }
          VB.FX.ring(tx, ty, '#ffb35c', 70, 0.35);
          VB.Audio.sfx('mine_beep');
        });
        // target marker
        VB.FX.ring(tx, ty, '#8fb7ff', 60, 0.9);
      }
      e.fireTimer = e.fireRate * 2;
    } else if (e.phase === 2) {
      // mine volley
      const n = e.enraged ? 4 : 3;
      for (let m = 0; m < n; m++) {
        VB.Bullets.spawnMine(e.x + VB.U.rand(-90, 90), e.y + 50, false);
      }
      VB.Audio.sfx('mine_beep');
      e.fireTimer = e.fireRate * 2.1;
    } else {
      // fortify — frontal shield window, then collapse burst
      e.fortifyT = e.enraged ? 2.0 : 1.6;
      VB.Audio.sfx('shield_up');
      e.fireTimer = e.fireRate * 1.4;
    }
  }

  // ------------------------------------------------------ ARCHON -------
  // Final ascendant: cycles judgment rings, wing lasers, void summons
  // and a 3-arm ascendant spiral.
  function updateArchon(e, dt) {
    const g = VB.Game;
    // stately drift with slow vertical bob
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.45) * g.W * (e.enraged ? 0.3 : 0.24);
    e.y = 115 + Math.sin(e.phaseTimer * 0.8) * 22;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 5 : 4);

    if (e.phase === 0) {
      // judgment rings — 3 rapid offset radial volleys
      const waves = 3;
      for (let w = 0; w < waves; w++) {
        VB.Game.schedule(w * 0.28, function () {
          if (e.hp <= 0) return;
          const count = e.enraged ? 18 : 14;
          const off = w * (Math.PI / count);
          for (let a = 0; a < count; a++) {
            const ang = (a / count) * Math.PI * 2 + off;
            VB.Bullets.spawnEnemy(e.x, e.y, {
              vx: Math.cos(ang) * 235, vy: Math.sin(ang) * 235,
              size: 4, color: '#ff5470'
            });
          }
          VB.FX.ring(e.x, e.y, '#ff5470', 120, 0.35);
        });
      }
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 2;
    } else if (e.phase === 1) {
      // twin wing lasers — alternating streams from both wings
      if (g.player) {
        const shots = e.enraged ? 8 : 6;
        for (let j = 0; j < shots; j++) {
          const side = j % 2 === 0 ? -1 : 1;
          const ox = side * (e.w * 0.7);
          VB.Game.schedule(j * 0.09, function () {
            if (e.hp <= 0 || !g.player) return;
            const ang = Math.atan2(g.player.y - e.y, g.player.x - (e.x + ox));
            VB.Bullets.spawnEnemy(e.x + ox, e.y + e.h / 2, {
              vx: Math.cos(ang) * 470, vy: Math.sin(ang) * 470,
              size: 4, color: '#ff4fd8'
            });
          });
        }
      }
      e.fireTimer = e.fireRate * 1.7;
    } else if (e.phase === 2) {
      // void summons
      if (VB.Enemies.list.length < 16) {
        const n = e.enraged ? 4 : 2;
        for (let s = 0; s < n; s++) {
          VB.Enemies.spawn(Math.random() < 0.5 ? 'flanker' : 'grunt',
            { forceElite: false, silent: true });
        }
        VB.FX.ring(e.x, e.y, '#c86bff', 130, 0.4);
      }
      e.fireTimer = e.fireRate * 1.6;
    } else if (e.phase === 3) {
      // ascendant spiral — 3 arms, accelerating
      const ticks = e.enraged ? 18 : 13;
      e.spiralAngle += 0.46;
      for (let k = 0; k < 3; k++) {
        const ang = e.spiralAngle + k * (Math.PI * 2 / 3);
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
          size: 4, color: '#ffc857'
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.fireTimer = e.fireRate * 1.6;
      } else {
        e.fireTimer = 0.085;
      }
    } else {
      // enrage only: cross judgment — 6-way aimed rails
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (let q = 0; q < 6; q++) {
          const ang = base + q * Math.PI / 3;
          for (let j = 0; j < 3; j++) {
            VB.Bullets.queueDelayed({
              x: e.x, y: e.y,
              vx: Math.cos(ang) * (400 + j * 50),
              vy: Math.sin(ang) * (400 + j * 50),
              size: 4, color: '#ffc857', delay: j * 0.07
            });
          }
        }
      }
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.5;
    }
  }

  // ------------------------------------------------------ VORTEX -------
  // Gravity maelstrom. Constant pull on the player, then:
  // 0 = curved debris spiral, 1 = event-horizon implosion,
  // 2 = shrapnel whirl, 3 (enrage) = singularity burst.
  function updateVortex(e, dt) {
    const g = VB.Game;

    // slow orbit around the upper arena
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.42) * g.W * (e.enraged ? 0.32 : 0.26);
    e.y = 135 + Math.sin(e.phaseTimer * 0.85) * 28;

    // ---- gravity well: drag the player toward the storm ----
    if (g.player && !g.player.dashDur) {
      const dx = e.x - g.player.x, dy = e.y - g.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 470 && d > 30) {
        const str = (e.enraged ? 74 : 44) * dt;
        g.player.x += dx / d * str;
        g.player.y += dy / d * str * 0.7;
      }
    }

    // event-horizon implosion timer (telegraph rendered in render.js)
    if (e.implodeT > 0) {
      e.implodeT -= dt;
      if (e.implodeT <= 0) {
        const ix = e.implodeX, iy = e.implodeY;
        const n = e.enraged ? 20 : 14;
        for (let a = 0; a < n; a++) {
          const ang = (a / n) * Math.PI * 2;
          const r = 250;
          const bx = ix + Math.cos(ang) * r, by = iy + Math.sin(ang) * r;
          if (by < -30 || by > g.H + 30 || bx < -30 || bx > g.W + 30) continue;
          // aim at the center, then let `curve` bend the path into a spiral
          const va = Math.atan2(iy - by, ix - bx);
          VB.Bullets.spawnEnemy(bx, by, {
            vx: Math.cos(va) * 240, vy: Math.sin(va) * 240,
            size: 4, color: '#58ffd1', curve: 1.5
          });
        }
        VB.FX.ring(ix, iy, '#58ffd1', 200, 0.6);
        VB.FX.shake(8, 0.25);
        VB.Audio.sfx('expl_small');
      }
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // curved debris spiral — 3 arms, spin + slight outward bank
      const ticks = e.enraged ? 16 : 11;
      e.spiralAngle += 0.5;
      for (let k = 0; k < 3; k++) {
        const ang = e.spiralAngle + k * (Math.PI * 2 / 3);
        const vx = Math.cos(ang) * 210, vy = Math.sin(ang) * 210;
        VB.Bullets.spawnEnemy(e.x + Math.cos(ang) * e.w, e.y + Math.sin(ang) * e.w,
          { vx, vy, size: 4, color: '#58ffd1', curve: k % 2 ? 0.55 : -0.55 });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.fireTimer = e.fireRate * 1.5;
      } else {
        e.fireTimer = 0.09;
      }
    } else if (e.phase === 1) {
      // event-horizon implosion at the player's marked position
      const ix = g.player ? VB.U.clamp(g.player.x, 90, g.W - 90) : g.W / 2;
      const iy = g.player ? VB.U.clamp(g.player.y, 90, g.H - 90) : g.H * 0.6;
      e.implodeX = ix; e.implodeY = iy; e.implodeT = 0.85;
      VB.FX.ring(ix, iy, '#58ffd1', 120, 0.85);
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 2.1;
    } else if (e.phase === 2) {
      // shrapnel whirl — 6 double-speed curved fans
      const arms = 6;
      for (let k = 0; k < arms; k++) {
        const ang = e.phaseTimer + (k / arms) * Math.PI * 2;
        for (const [spd, cv] of [[190, 1.3], [280, -1.0]]) {
          VB.Bullets.spawnEnemy(e.x, e.y, {
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            size: 3, color: '#a8ffe8', curve: e.enraged ? cv * 1.4 : cv
          });
        }
      }
      VB.Audio.sfx('laser_enemy');
      e.fireTimer = e.fireRate * 1.6;
    } else {
      // enrage: singularity burst — dense radial + offset echo
      for (const [n, off, spd] of [[18, 0, 235], [12, Math.PI / 12, 300]]) {
        for (let a = 0; a < n; a++) {
          const ang = (a / n) * Math.PI * 2 + off;
          VB.Bullets.spawnEnemy(e.x, e.y, {
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            size: 4, color: '#ff8a3d'
          });
        }
      }
      VB.FX.ring(e.x, e.y, '#ff8a3d', 150, 0.4);
      VB.Audio.sfx('expl_big');
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.8;
    }
  }

  // ------------------------------------------------------ GORGON -------
  // Prism hydra. 0 = hair-turret fans, 1 = prism volley (shatters),
  // 2 = gaze sweep, 3 (enrage) = prism storm.
  function updateGorgon(e, dt) {
    const g = VB.Game;
    // figure-8 drift
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.62) * g.W * (e.enraged ? 0.34 : 0.27);
    e.y = 120 + Math.sin(e.phaseTimer * 1.25) * 36;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // hair-turret fans — 5 offsets each fire a short aimed stream
      if (g.player) {
        const offs = [-2, -1, 0, 1, 2];
        const per = e.enraged ? 5 : 4;
        for (const o of offs) {
          const ox = e.x + o * 20;
          const base = Math.atan2(g.player.y - e.y, g.player.x - ox);
          for (let j = 0; j < per; j++) {
            const ang = base + (j - (per - 1) / 2) * 0.11;
            VB.Bullets.queueDelayed({
              x: ox, y: e.y + e.h * 0.3,
              vx: Math.cos(ang) * 285, vy: Math.sin(ang) * 285,
              size: 3, color: '#8fa8ff', delay: Math.abs(o) * 0.05 + j * 0.04
            });
          }
        }
      }
      e.fireTimer = e.fireRate * 1.5;
    } else if (e.phase === 1) {
      // prism volley — big shards that shatter mid-flight
      const n = e.enraged ? 5 : 3;
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (let k = 0; k < n; k++) {
          const ang = base + (k - (n - 1) / 2) * 0.3;
          VB.Bullets.spawnEnemy(e.x, e.y + e.h * 0.3, {
            vx: Math.cos(ang) * 265, vy: Math.sin(ang) * 265,
            size: 7, color: '#e8f6ff', splitAt: 0.8, splitN: 3
          });
        }
      }
      VB.Audio.sfx('laser_spread');
      e.fireTimer = e.fireRate * 1.7;
    } else if (e.phase === 2) {
      // gaze sweep — a hose of fast shots that rakes across the arena
      if (g.player) {
        e.gazeDir = Math.random() < 0.5 ? -1 : 1;
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x) - e.gazeDir * 0.5;
        const ticks = e.enraged ? 16 : 12;
        for (let j = 0; j < ticks; j++) {
          const ang = base + e.gazeDir * j * 0.085;
          VB.Bullets.queueDelayed({
            x: e.x, y: e.y + e.h * 0.3,
            vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
            size: 3, color: '#c9d6ff', delay: j * 0.055
          });
        }
      }
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 1.9;
    } else {
      // enrage: prism storm — radial prisms that all shatter
      const n = 6;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + e.phaseTimer * 0.5;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230,
          size: 7, color: '#ff4fd8', splitAt: 0.75, splitN: 4
        });
      }
      VB.FX.ring(e.x, e.y, '#ff4fd8', 110, 0.4);
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.7;
    }
  }

  // -------------------------------------------------- LEVIATHAN -------
  // v4.2 void serpent. 0 = tide flood, 1 = maw pull (telegraphed),
  // 2 = fused spines, 3 (enrage) = maelstrom spiral.
  function updateLeviathan(e, dt) {
    const g = VB.Game;
    // broad sinusoidal swim — the body trail is drawn procedurally
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.55) * g.W * (e.enraged ? 0.34 : 0.28);
    e.y = 125 + Math.sin(e.phaseTimer * 1.1) * 34;

    // maw pull channel: drag the player toward the jaws
    if (e.pullT > 0) {
      e.pullT -= dt;
      if (g.player && !g.player.dashDur) {
        const dx = e.x - g.player.x, dy = e.y - g.player.y;
        const d = Math.hypot(dx, dy);
        if (d > 40) {
          g.player.x += dx / d * 95 * dt;
          g.player.y += dy / d * 70 * dt;
        }
      }
      if (e.pullT <= 0) {
        // the maw snaps shut: dense radial burst
        const n = e.enraged ? 20 : 14;
        for (let a = 0; a < n; a++) {
          const ang = (a / n) * Math.PI * 2 + e.phaseTimer;
          VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
            vx: Math.cos(ang) * 250, vy: Math.sin(ang) * 250,
            size: 4, color: e.enraged ? '#b7ff5c' : '#5cff9d'
          });
        }
        VB.FX.ring(e.x, e.y, '#5cff9d', 170, 0.45);
        VB.FX.shake(7, 0.22);
        VB.Audio.sfx('expl_big');
      }
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // tide flood — three fanned waves from the maw
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (let wv = 0; wv < 3; wv++) {
          VB.Game.schedule(wv * 0.22, function () {
            if (e.hp <= 0) return;
            for (let j = -3; j <= 3; j++) {
              const ang = base + j * 0.13;
              VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
                vx: Math.cos(ang) * 270, vy: Math.sin(ang) * 270,
                size: 4, color: '#5cff9d'
              });
            }
            VB.FX.ring(e.x, e.y + e.h / 2, '#5cff9d', 60, 0.25);
          });
        }
      }
      VB.Audio.sfx('laser_spread');
      e.fireTimer = e.fireRate * 1.7;
    } else if (e.phase === 1) {
      // telegraphed maw pull (ring drawn in render.js)
      e.pullT = 1.15;
      VB.FX.ring(e.x, e.y, '#5cff9d', 120, 1.1);
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 2.2;
    } else if (e.phase === 2) {
      // fused spines — homing, but their fuel cell burns out (fuse)
      const n = e.enraged ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * 0.3 - Math.PI / 2;
        VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
          vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
          size: 5, color: '#b7ff5c', homing: true, turn: 2.1, life: 6
        });
      }
      // escort: a pair of grunts slips out of the wake
      if (VB.Enemies.list.length < 12) {
        VB.Enemies.spawn('grunt', { forceElite: false, silent: true });
      }
      VB.Audio.sfx('missile');
      e.fireTimer = e.fireRate * 1.9;
    } else {
      // enrage: maelstrom — twin counter-rotating spirals
      const ticks = 14;
      e.spiralAngle += 0.55;
      for (let k = 0; k < 2; k++) {
        const ang = e.spiralAngle + k * Math.PI;
        const va = Math.atan2(Math.sin(ang), Math.cos(ang));
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(va) * 240, vy: Math.sin(va) * 240,
          size: 4, color: '#5cff9d', curve: k % 2 ? 1.1 : -1.1
        });
        const ang2 = -e.spiralAngle * 0.8 + k * Math.PI;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang2) * 200, vy: Math.sin(ang2) * 200,
          size: 3, color: '#b7ff5c', curve: k % 2 ? -0.9 : 0.9
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.fireTimer = e.fireRate * 1.4;
      } else {
        e.fireTimer = 0.09;
      }
    }
  }

  // ------------------------------------------------------- MIRAGE -------
  // v4.2 illusionist. 0 = mirror radial prisms, 1 = tri-lance rails,
  // 2 = illusion doubles, 3 (enrage) = shatter storm. Blinks between
  // attacks leave afterimage rings.
  function updateMirage(e, dt) {
    const g = VB.Game;
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.8) * g.W * (e.enraged ? 0.32 : 0.24);
    e.y = 120 + Math.sin(e.phaseTimer * 1.35) * 40;

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    // blink after every attack — more often when enraged
    if (Math.random() < (e.enraged ? 0.8 : 0.5)) {
      VB.FX.ring(e.x, e.y, '#ff9ad5', 90, 0.35);
      e.x = VB.U.rand(g.W * 0.2, g.W * 0.8);
      e.y = VB.U.rand(90, 200);
      VB.FX.ring(e.x, e.y, '#ff9ad5', 90, 0.35);
      VB.Audio.sfx('blink');
    }

    if (e.phase === 0) {
      // mirror radial — solid ring + prism shards that shatter
      const n = e.enraged ? 14 : 10;
      for (let a = 0; a < n; a++) {
        const ang = (a / n) * Math.PI * 2 + e.phaseTimer * 0.4;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 225, vy: Math.sin(ang) * 225,
          size: 4, color: '#ff9ad5'
        });
      }
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2 + 0.4;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 190, vy: Math.sin(ang) * 190,
          size: 7, color: '#e8f0ff', splitAt: 0.85, splitN: 3
        });
      }
      VB.Audio.sfx('laser_spread');
      e.fireTimer = e.fireRate * 1.6;
    } else if (e.phase === 1) {
      // tri-lance: three mirrored aimed rails from illusion offsets
      if (g.player) {
        const offs = [-1, 0, 1];
        for (const o of offs) {
          const ox = e.x + o * 26;
          const ang = Math.atan2(g.player.y - e.y, g.player.x - ox);
          for (let j = 0; j < 2; j++) {
            VB.Bullets.queueDelayed({
              x: ox, y: e.y + e.h * 0.3,
              vx: Math.cos(ang) * (430 + j * 60),
              vy: Math.sin(ang) * (430 + j * 60),
              size: 4, color: '#ff9ad5', delay: Math.abs(o) * 0.06 + j * 0.09
            });
          }
        }
      }
      VB.Audio.sfx('laser_enemy');
      e.fireTimer = e.fireRate * 1.8;
    } else if (e.phase === 2) {
      // illusion doubles: two pink homing echoes of the boss
      if (VB.Enemies.list.length < 14) {
        for (let s = 0; s < 2; s++) {
          const ghost = VB.Enemies.spawn('homing', { forceElite: false, silent: true });
          if (ghost) {
            ghost.color = '#ff9ad5';
            ghost.scoreValue = 60;
            ghost.hp = ghost.maxHp = Math.max(1, Math.ceil(ghost.maxHp * 0.6));
          }
        }
        VB.FX.ring(e.x, e.y, '#ff9ad5', 130, 0.4);
      }
      e.fireTimer = e.fireRate * 1.7;
    } else {
      // enrage: shatter storm — radial prisms everywhere
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + e.phaseTimer * 0.7;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 215, vy: Math.sin(ang) * 215,
          size: 7, color: '#e8f0ff', splitAt: 0.7, splitN: 4
        });
      }
      VB.FX.ring(e.x, e.y, '#e8f0ff', 130, 0.4);
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.7;
    }
  }

  // -------------------------------------------------- OUROBOROS -------
  // v5.0 ring serpent. Rides an elliptical orbit; phases:
  // 0 = coil spiral (curved arms), 1 = twin bite (head & tail fans),
  // 2 = scale ring + fast aimed pair, 3 (enrage) = world coil.
  function updateOuroboros(e, dt) {
    const g = VB.Game;
    const cx = g.W / 2, cy = 150;
    // elliptical orbit — faster when enraged
    e.orbA = (e.orbA || Math.PI / 2) + dt * (e.enraged ? 1.35 : 0.9);
    const rx = g.W * (e.enraged ? 0.33 : 0.27), ry = 92;
    e.x = cx + Math.cos(e.orbA) * rx;
    e.y = cy + Math.sin(e.orbA) * ry;
    e.orbCX = cx; e.orbCY = cy; e.orbRX = rx; e.orbRY = ry;  // for the draw

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // coil spiral — 4 curved arms while the body circles
      const ticks = e.enraged ? 14 : 10;
      e.spiralAngle += 0.44;
      for (let k = 0; k < 4; k++) {
        const ang = e.spiralAngle + k * (Math.PI / 2);
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 235, vy: Math.sin(ang) * 235,
          size: 4, color: '#b6ff3d', curve: k % 2 ? 0.5 : -0.5
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        e.fireTimer = e.fireRate * 1.5;
      } else {
        e.fireTimer = 0.09;
      }
    } else if (e.phase === 1) {
      // twin bite — the head and the mirrored tail both spit aimed fans
      if (g.player) {
        const maws = [[e.x, e.y], [2 * cx - e.x, 2 * cy - e.y]];
        for (const [sx, sy] of maws) {
          const base = Math.atan2(g.player.y - sy, g.player.x - sx);
          const n = e.enraged ? 6 : 4;
          for (let j = 0; j < n; j++) {
            const ang = base + (j - (n - 1) / 2) * 0.15;
            VB.Bullets.queueDelayed({
              x: sx, y: sy,
              vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330,
              size: 4, color: '#d9ff8a', delay: j * 0.05
            });
          }
        }
      }
      VB.Audio.sfx('laser_spread');
      e.fireTimer = e.fireRate * 1.6;
    } else if (e.phase === 2) {
      // scale ring — slow radial shed plus a fast aimed pair
      const n = e.enraged ? 16 : 12;
      for (let a = 0; a < n; a++) {
        const ang = (a / n) * Math.PI * 2 + e.orbA;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 165, vy: Math.sin(ang) * 165,
          size: 5, color: '#8fd12f'
        });
      }
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (const s of [-0.12, 0.12]) {
          VB.Bullets.spawnEnemy(e.x, e.y, {
            vx: Math.cos(base + s) * 430, vy: Math.sin(base + s) * 430,
            size: 3, color: '#eaffb0'
          });
        }
      }
      VB.FX.ring(e.x, e.y, '#b6ff3d', 120, 0.4);
      e.fireTimer = e.fireRate * 1.8;
    } else {
      // enrage: world coil — counter-rotating double spiral + escort
      const ticks = 12;
      e.spiralAngle += 0.6;
      for (let k = 0; k < 2; k++) {
        const ang = e.spiralAngle + k * Math.PI;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 255, vy: Math.sin(ang) * 255,
          size: 4, color: '#b6ff3d', curve: k % 2 ? 1.0 : -1.0
        });
      }
      e.burstCount = (e.burstCount || 0) + 1;
      if (e.burstCount >= ticks) {
        e.burstCount = 0;
        if (VB.Enemies.countBosses() === 1 && VB.Enemies.list.length < 12) {
          VB.Enemies.spawn('weaver', { forceElite: false, silent: true });
        }
        VB.FX.ring(e.x, e.y, '#b6ff3d', 150, 0.45);
        e.phase = 0;
        e.fireTimer = e.fireRate * 1.5;
      } else {
        e.fireTimer = 0.085;
      }
    }
  }

  // --------------------------------------------------- CERBERUS -------
  // v5.0 triple-headed warden. Phases:
  // 0 = triple roar (staggered streams), 1 = hound call,
  // 2 = slam columns + shockwave, 3 (enrage) = infernal cross.
  function updateCerberus(e, dt) {
    const g = VB.Game;
    // heavy sway with a slow menace bob
    e.x = g.W / 2 + Math.sin(e.phaseTimer * 0.5) * g.W * (e.enraged ? 0.3 : 0.22);
    e.y = 118 + Math.sin(e.phaseTimer * 0.9) * 24;

    // slam column countdown (telegraph drawn in render.js)
    if (e.columns && e.colT > 0) {
      e.colT -= dt;
      if (e.colT <= 0) {
        for (const cx of e.columns) {
          const drops = e.enraged ? 9 : 6;
          for (let j = 0; j < drops; j++) {
            VB.Bullets.queueDelayed({
              x: cx + VB.U.rand(-10, 10), y: -14,
              vx: 0, vy: 500, size: 4, color: '#ff4f6e', delay: j * 0.06
            });
          }
        }
        // the slam lands: body shockwave
        const n = e.enraged ? 14 : 10;
        for (let a = 0; a < n; a++) {
          const ang = (a / n) * Math.PI * 2;
          VB.Bullets.spawnEnemy(e.x, e.y, {
            vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210,
            size: 4, color: '#ffd166'
          });
        }
        VB.Audio.sfx('roar');
        VB.FX.shake(6, 0.2);
        e.columns = null;
      }
    }

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.phase = (e.phase + 1) % (e.enraged ? 4 : 3);

    if (e.phase === 0) {
      // triple roar — each head spits a staggered aimed stream
      if (g.player) {
        const heads = [-40, 0, 40];
        const per = e.enraged ? 5 : 4;
        for (const hx of heads) {
          const base = Math.atan2(g.player.y - e.y, g.player.x - (e.x + hx));
          for (let j = 0; j < per; j++) {
            VB.Bullets.queueDelayed({
              x: e.x + hx, y: e.y + e.h / 2,
              vx: Math.cos(base) * (360 + j * 42),
              vy: Math.sin(base) * (360 + j * 42),
              size: 4, color: '#ff4f6e',
              delay: Math.abs(hx) * 0.004 + j * 0.09
            });
          }
        }
      }
      VB.Audio.sfx('roar');
      e.fireTimer = e.fireRate * 1.6;
    } else if (e.phase === 1) {
      // hound call — unleash dive bombers from the packs
      if (VB.Enemies.countBosses() === 1 && VB.Enemies.list.length < 13) {
        const n = e.enraged ? 3 : 2;
        for (let s = 0; s < n; s++) {
          VB.Enemies.spawn(
            (s === 0 && VB.Waves.wave < 12) ? 'grunt' : 'zenith',
            { forceElite: false, silent: true });
        }
        VB.FX.ring(e.x, e.y, '#ff4f6e', 140, 0.45);
      }
      e.fireTimer = e.fireRate * 1.9;
    } else if (e.phase === 2) {
      // slam — telegraphed columns, one always tracks the pilot
      const n = e.enraged ? 4 : 3;
      const cols = [];
      for (let i = 0; i < n; i++) cols.push(Math.round(VB.U.rand(60, g.W - 60)));
      if (g.player) cols[0] = Math.round(g.player.x);
      e.columns = cols;
      e.colT = 0.9;
      VB.Audio.sfx('warning');
      e.fireTimer = e.fireRate * 2.1;
    } else {
      // enrage: infernal cross — 6-way rails plus prism shards
      if (g.player) {
        const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        for (let q = 0; q < 6; q++) {
          const ang = base + q * Math.PI / 3;
          for (let j = 0; j < 2; j++) {
            VB.Bullets.queueDelayed({
              x: e.x, y: e.y,
              vx: Math.cos(ang) * (410 + j * 55),
              vy: Math.sin(ang) * (410 + j * 55),
              size: 4, color: '#ffd166', delay: j * 0.08
            });
          }
        }
      }
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        VB.Bullets.spawnEnemy(e.x, e.y, {
          vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240,
          size: 7, color: '#ffd166', splitAt: 0.8, splitN: 3
        });
      }
      VB.FX.screenFlash(0.12, '#ffd166');
      e.phase = 0;
      e.fireTimer = e.fireRate * 1.7;
    }
  }

  return { spawn, updateBoss };
})();
