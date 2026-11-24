// ============================================================
// VOID BREAKER // NEON ASCENSION — enemies.js  (v5.0 ABYSS)
// 13 enemy classes + elite variants.
// grunt, zigzag, tank, homing, splitter, flanker (original set)
// shielder, bomber, sniper (new)
// weaver, warden (v4.2)
// phantom, zenith (v5.0)
// v4.0: cryo-slow status support (e.slowT set by Cryo Rounds)
// v4.2: stun support (e.stunT set by VOLT STORM LANCE / Arc Stunner)
// v5.0: phase support (e.ghost set by PHANTOM — untouchable while on)
// ============================================================
window.VB = window.VB || {};

VB.Enemies = (function () {
  const list = [];

  function makeElite(e) {
    const E = VB.CONFIG.ELITE;
    e.elite = true;
    e.hp = e.maxHp = Math.ceil(e.maxHp * E.HP_MULT);
    e.w *= E.SIZE_MULT; e.h *= E.SIZE_MULT;
    e.speed *= E.SPEED_MULT;
    e.scoreValue = Math.round(e.scoreValue * E.SCORE_MULT);
    // v5.2 OMEGA: named affixes deepen elite behavior from wave 9
    if (VB.Waves.wave >= E.AFFIX_FROM_WAVE && VB.U.RNG.float() < E.AFFIX_CHANCE) {
      e.affix = VB.U.pick(Object.keys(E.AFFIXES));
      e.scoreValue = Math.round(e.scoreValue * E.AFFIX_SCORE_MULT);
      if (e.affix === 'shielded') {
        e.affixShield = 2 + Math.floor(VB.Waves.wave / 12);
        e.affixShieldMax = e.affixShield;
        e.affixShieldRegenT = 0;
      } else if (e.affix === 'swift') {
        e.speed *= 1.5;
      }
    }
    return e;
  }

  /** Build an enemy of `type`. `opts.forceElite` is used by elite-squad waves. */
  function spawn(type, opts) {
    opts = opts || {};
    const g = VB.Game;
    const wave = VB.Waves.wave;
    const D = VB.CONFIG.ENEMIES[type];
    if (!D) return null;

    const e = {
      x: 0, y: -40, type,
      // v5.3.1 FIX: speed / w / h were dropped from the spawn template in a
      // past refactor — every hull spawned with undefined drive & size, so
      // its position decayed to NaN (invisible, unkillable, and its NaN
      // hit-radius made every bullet & contact check pass). Restored here.
      speed: D.speed(wave), w: D.w, h: D.h,
      // v5.3.1 SPAWN GATE: hulls are inert while still gliding in from the
      // spawn band — untargetable, unhittable, unable to fire or ram.
      entered: false,
      // v5.2 IRONHULL curse: +50% hull strength
      hp: Math.ceil(D.hp(wave) * ((VB.Game.curses && VB.Game.curses.ironhull) ? 1.5 : 1)),
      maxHp: 0,
      // v5.2 BARRAGE curse: 35% faster trigger fingers
      fireTimer: VB.U.rand(1, 2.5),
      fireRate: D.fireRate * ((VB.Game.curses && VB.Game.curses.barrage) ? 0.65 : 1),
      time: 0, color: D.color,
      scoreValue: D.score,
      fromSide: false, sideDir: 1,
      elite: false, affix: null
    };
    e.maxHp = e.hp;

    switch (type) {
      case 'grunt':
        break;
      case 'zigzag':
        e.amplitude = VB.U.rand(70, 130);
        e.freq = VB.U.rand(2.5, 3.5);
        e.startX = 0;
        break;
      case 'homing':
        break;
      case 'splitter':
        e.splitCount = 2;
        break;
      case 'flanker':
        e.fromSide = true;
        e.sideDir = opts.sideDir || (VB.U.RNG.float() < 0.5 ? -1 : 1);
        break;
      case 'tank':
        e.fireRate = Math.max(0.6, 1.5 - wave * 0.03);
        break;
      case 'shielder':
        e.shieldHp = 3 + Math.floor(wave / 2);
        e.shieldMax = e.shieldHp;
        e.shieldRegenT = 0;
        break;
      case 'bomber':
        e.dropTimer = VB.U.rand(1.5, 2.8);
        break;
      case 'sniper':
        e.targetY = VB.U.rand(100, 220);
        e.chargeT = 0;
        e.sniperCd = VB.U.rand(0.5, 1.2);
        e.lockedAngle = -Math.PI / 2;
        break;
      case 'weaver':
        // v4.2: teleporting duelist — blink timer, brief materialize burst
        e.blinkT = VB.U.rand(1.2, 1.9);
        e.blinkFlash = 0;
        break;
      case 'warden':
        // v4.2: squad medic — periodic heal pulse + radial defense burst
        e.healT = 2.2;
        break;
      case 'phantom':
        // v5.0: phase shifter — cycles tangible / intangible
        e.phaseT = VB.U.rand(1.2, 2.0);
        e.ghostT = 0;
        e.ghost = false;
        break;
      case 'zenith':
        // v5.0: dive bomber — hover, telegraph, then dive through the lane
        e.targetY = VB.U.rand(110, 240);
        e.hoverT = VB.U.rand(1.5, 2.3);
        e.state = 'enter';
        e.teleT = 0;
        e.locked = false;
        e.diveVX = 0; e.diveVY = 0;
        break;
    }

    if (opts.forceElite || (wave >= VB.CONFIG.ELITE.MIN_WAVE &&
        VB.U.RNG.float() < Math.min(VB.CONFIG.ELITE.MAX_CHANCE,
          VB.CONFIG.ELITE.BASE_CHANCE + wave * VB.CONFIG.ELITE.WAVE_BONUS))) {
      makeElite(e);
    }

    // entry position (v5.3: seeded under run codes — same code, same spawns)
    if (e.fromSide) {
      e.x = e.sideDir > 0 ? -30 : g.W + 30;
      e.y = VB.U.rand(0, g.H * 0.4) + 60;
      VB.FX.warnSide(e.sideDir > 0 ? 15 : g.W - 15, e.y, e.color, e.sideDir);
      if (!opts.silent) VB.Audio.sfx('warning');
    } else {
      e.x = VB.U.rand(0, g.W - 100) + 50;
      // v5.3.1: ping the top edge so off-screen spawns are telegraphed
      VB.FX.warnTop(e.x, e.color);
    }
    if (type === 'zigzag') e.startX = e.x;

    // v5.2: announce formidable elites (ironhull also boosts boss-free HP)
    if (e.elite && e.affix && !opts.silent) {
      VB.UI.toast(VB.CONFIG.ELITE.AFFIXES[e.affix].name + ' ELITE', 'danger');
    }

    list.push(e);
    return e;
  }

  function nearestEnemy(x, y) {
    let best = null, bd = Infinity;
    for (const e of list) {
      // v5.3.1 SPAWN GATE: turrets & homing shots never lock a hull
      // that is still gliding in from the spawn band
      if (!e.entered) continue;
      const d = VB.U.dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------ update --
  function update(dt) {
    const g = VB.Game;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.time += dt;

      // v5.3 REGEN HIVE curse: lesser foes slowly mend their hulls
      if (g.curses && g.curses.regen && e.type !== 'boss' &&
          e.hp < e.maxHp && e.hp > 0) {
        e.regenT = (e.regenT || 0) + dt;
        if (e.regenT >= 2) {
          e.regenT = 0;
          e.hp = Math.min(e.maxHp, e.hp + Math.max(1, e.maxHp * 0.04));
          if (Math.random() < 0.35) VB.FX.ring(e.x, e.y, '#4dffa6', e.w + 12, 0.3);
        }
      }

      // v4.0 Cryo Rounds: chilled enemies crawl and fire sluggishly
      let sm = 1;
      if (e.slowT > 0) {
        e.slowT -= dt;
        sm = Math.max(0.5, 1 - 0.18 * ((g.upgrades && g.upgrades.cryo) || 0));
        if (e.slowT <= 0) sm = 1;
      }

      // v4.2 Arc Stunner / STORM LANCE: stunned foes are helpless
      if (e.stunT > 0) {
        e.stunT -= dt;
        e.y += e.speed * 0.15 * dt;   // still drift, cannot act
        if (e.type !== 'boss' && e.type !== 'sniper') e.fireTimer = Math.max(e.fireTimer, 0.35);
        continue;
      }

      // v5.2 AEGIS affix: the shield re-arms after 4s without absorbing
      if (e.affix === 'shielded' && e.affixShield < e.affixShieldMax) {
        e.affixShieldRegenT += dt;
        if (e.affixShieldRegenT >= 4) {
          e.affixShield++;
          e.affixShieldRegenT = 0;
          VB.FX.ring(e.x, e.y, '#8fb7ff', 30, 0.3);
        }
      }

      switch (e.type) {
        case 'grunt':
        case 'tank':
          e.y += e.speed * sm * dt;
          break;

        case 'zigzag':
          e.y += e.speed * sm * dt;
          e.x = e.startX + Math.sin(e.time * e.freq * sm) * e.amplitude;
          break;

        case 'homing': {
          if (g.player) {
            const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
            e.x += Math.cos(ang) * e.speed * 0.4 * sm * dt;
            e.y += Math.sin(ang) * e.speed * 0.4 * sm * dt + e.speed * 0.6 * sm * dt;
          } else e.y += e.speed * sm * dt;
          break;
        }

        case 'splitter':
          e.y += e.speed * sm * dt;
          e.x += Math.sin(e.time * 3 * sm) * 40 * dt;
          break;

        case 'flanker':
          e.x += e.sideDir * e.speed * sm * dt;
          e.y += Math.sin(e.time * 2) * 30 * dt;
          break;

        case 'shielder': {
          e.y += e.speed * sm * dt;
          e.x += Math.sin(e.time * 1.4) * 30 * dt;
          // shield regeneration after 2.5s without damage
          if (e.shieldHp < e.shieldMax) {
            e.shieldRegenT += dt;
            if (e.shieldRegenT > 2.5) {
              e.shieldHp = Math.min(e.shieldMax, e.shieldHp + dt * 2);
            }
          }
          break;
        }

        case 'bomber':
          e.y += e.speed * sm * dt;
          e.x += Math.sin(e.time * 1.1) * 45 * dt;
          e.dropTimer -= dt * sm;
          if (e.dropTimer <= 0 && e.entered && e.y < g.H * 0.7) {   // v5.3.1
            e.dropTimer = 2.8;
            VB.Bullets.spawnMine(e.x, e.y + e.h / 2, true);
            VB.Audio.sfx('mine_beep');
          }
          break;

        case 'sniper': {
          if (e.y < e.targetY) {
            e.y += e.speed * sm * dt;
            e.chargeT = 0;
          } else {
            e.x += Math.sin(e.time * 0.8) * 18 * dt;
            if (e.sniperCd > 0) {
              e.sniperCd -= dt * sm;
              if (e.sniperCd <= 0 && g.player) {
                e.lockedAngle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
                e.chargeT = 0.0001;
              }
            } else if (e.chargeT > 0) {
              e.chargeT += dt * sm;
              if (e.chargeT >= 1.1) {
                // telegraphed fast shot along the laser sight
                VB.Bullets.spawnEnemy(e.x, e.y, {
                  vx: Math.cos(e.lockedAngle) * 520,
                  vy: Math.sin(e.lockedAngle) * 520,
                  size: 4, color: '#ffe08a'
                });
                VB.Audio.sfx('laser_enemy');
                VB.FX.explosion(e.x + Math.cos(e.lockedAngle) * 14,
                  e.y + Math.sin(e.lockedAngle) * 14, '#ffe08a', 4, 60);
                e.chargeT = 0;
                e.sniperCd = 1.6;
              }
            }
          }
          break;
        }

        case 'weaver': {
          // v4.2: drifts down while blinking sideways toward the player's lane
          e.y += e.speed * 0.55 * sm * dt;
          e.blinkT -= dt * sm;
          if (e.blinkFlash > 0) e.blinkFlash -= dt;
          if (e.blinkT <= 0 && g.player) {
            e.blinkT = e.elite ? 1.1 : 1.7;
            e.blinkFlash = 0.25;
            VB.FX.ring(e.x, e.y, '#b7ff5c', 40, 0.3);
            e.x = VB.U.clamp(
              g.player.x + VB.U.rand(-110, 110), 30, g.W - 30);
            // v5.3.1: blinks stay inside the arena — never invisible
            e.y = Math.max(16, e.y - 30);
            VB.FX.ring(e.x, e.y, '#b7ff5c', 40, 0.3);
            VB.Audio.sfx('blink');
            e.fireTimer = Math.min(e.fireTimer, 0.25);   // quick draw on rematerialize
          }
          break;
        }

        case 'warden': {
          // v4.2: slow support hull that mends nearby allies
          e.y += e.speed * sm * dt;
          e.x += Math.sin(e.time * 0.9) * 34 * dt;
          e.healT -= dt * sm;
          if (e.healT <= 0 && e.entered) {   // v5.3.1: no healing from the spawn band
            e.healT = 2.5;
            let mended = 0;
            for (const oe of list) {
              if (oe === e || oe.type === 'boss') continue;
              if (oe.hp < oe.maxHp && VB.U.dist(oe.x, oe.y, e.x, e.y) < 230) {
                oe.hp = Math.min(oe.maxHp, oe.hp + 2);
                VB.FX.ring(oe.x, oe.y, '#d7a8ff', 24, 0.3);
                mended++;
              }
            }
            if (mended > 0) {
              VB.FX.ring(e.x, e.y, '#d7a8ff', 230, 0.55);
              VB.Audio.sfx('heal');
            }
          }
          break;
        }

        case 'phantom': {
          // v5.0: drifts down while cycling in and out of phase
          e.y += e.speed * 0.8 * sm * dt;
          e.x += Math.sin(e.time * 1.3) * 26 * dt;
          if (e.ghostT > 0) {
            e.ghostT -= dt * sm;
            if (e.ghostT <= 0) {
              e.ghostT = 0;
              e.ghost = false;
              VB.FX.ring(e.x, e.y, '#8ef4ff', 42, 0.3);
              e.fireTimer = Math.min(e.fireTimer, 0.3);  // quick draw
            }
          } else {
            e.phaseT -= dt * sm;
            if (e.phaseT <= 0) {
              e.phaseT = e.elite ? 1.7 : 2.4;
              e.ghostT = e.elite ? 1.5 : 1.15;
              e.ghost = true;
              VB.FX.ring(e.x, e.y, '#8ef4ff', 46, 0.35);
              VB.Audio.sfx('phase');
            }
          }
          break;
        }

        case 'zenith': {
          // v5.0: enter → hover & strafe → telegraph → dive through
          if (e.state === 'enter') {
            e.y += e.speed * 0.9 * sm * dt;
            e.x += Math.sin(e.time * 2) * 30 * dt;
            if (e.y >= e.targetY) e.state = 'hover';
          } else if (e.state === 'hover') {
            e.x += Math.sin(e.time * 2.4) * 42 * dt;
            e.y += Math.cos(e.time * 1.8) * 14 * dt;
            e.hoverT -= dt * sm;
            if (e.hoverT <= 0) {
              e.teleT = 0.6;
              e.locked = false;
              e.state = 'aim';
              VB.Audio.sfx('warning');
            }
          } else if (e.state === 'aim') {
            // lock the vector a beat before launch so the dive is dodgeable
            e.teleT -= dt * sm;
            if (g.player && !e.locked && e.teleT <= 0.3) {
              e.locked = true;
              const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
              e.diveVX = Math.cos(ang) * e.speed * 3.2;
              e.diveVY = Math.sin(ang) * e.speed * 3.2;
            }
            if (e.teleT <= 0) {
              e.state = 'dive';
              VB.FX.ring(e.x, e.y, '#ff3d81', 52, 0.4);
              VB.Audio.sfx('dive');
            }
          } else { // dive
            e.x += e.diveVX * dt;
            e.y += e.diveVY * dt;
            if (Math.random() < dt * 30) {
              VB.FX.spawnBurst(e.x, e.y,
                -e.diveVX * 0.2 + VB.U.frand(-20, 20),
                -e.diveVY * 0.2 + VB.U.frand(-20, 20), '#ff3d81');
            }
          }
          break;
        }

        case 'boss':
          VB.Boss.updateBoss(e, dt);
          break;
      }

      // v5.3.1 SPAWN GATE: a hull activates the moment its center is fully
      // inside the arena — until then it cannot fire, ram or be hit
      if (!e.entered && e.type !== 'boss' &&
          e.y > 16 && e.x > 16 && e.x < g.W - 16) {
        e.entered = true;
        VB.FX.ring(e.x, e.y, e.color, e.w + 12, 0.28);
      }

      // ---- regular enemy firing ----
      if (e.type !== 'boss' && e.type !== 'sniper' && !e.ghost &&
          !(e.type === 'zenith' && e.state === 'dive') &&
          e.entered && e.y < g.H * 0.75 && e.x > -20 && e.x < g.W + 20) {
        e.fireTimer -= dt * sm;
        if (e.fireTimer <= 0 && g.player) {
          e.fireTimer = e.fireRate + Math.random() * 0.4;
          const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
          if (e.type === 'homing') {
            // magenta missiles carry a ~15 s fuse so they defuse with a
            // fizzle instead of chasing the player forever
            VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
              vx: Math.cos(ang) * 180, vy: Math.sin(ang) * 180,
              size: 4, color: '#c86bff', homing: true, turn: 2.5, life: 15
            });
          } else if (e.type === 'tank') {
            for (let a = -0.15; a <= 0.15; a += 0.15) {
              VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
                vx: Math.cos(ang + a) * 260, vy: Math.sin(ang + a) * 260,
                size: 5, color: e.color
              });
            }
          } else if (e.type === 'weaver') {
            // quick draw: a tight 3-shot fan right after a blink
            for (let a = -0.16; a <= 0.16; a += 0.16) {
              VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
                vx: Math.cos(ang + a) * 300, vy: Math.sin(ang + a) * 300,
                size: 3, color: e.color
              });
            }
          } else if (e.type === 'warden') {
            // defensive radial pulse instead of an aimed shot
            for (let a = 0; a < 8; a++) {
              const ra = (a / 8) * Math.PI * 2 + e.time;
              VB.Bullets.spawnEnemy(e.x, e.y, {
                vx: Math.cos(ra) * 190, vy: Math.sin(ra) * 190,
                size: 3, color: e.color
              });
            }
          } else {
            const spd = e.type === 'flanker' ? 280 : 220;
            VB.Bullets.spawnEnemy(e.x, e.y + e.h / 2, {
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              size: 3, color: e.color
            });
          }
          VB.Audio.sfx('laser_enemy');
        }
      }

      // ---- off-screen removal ----
      let offScreen = false;
      if (e.fromSide) {
        offScreen = (e.sideDir > 0 ? e.x > g.W + 60 : e.x < -60);
      } else {
        offScreen = e.y > g.H + 60;
      }
      // a diving ZENITH can also exit sideways or straight back up
      if (e.type === 'zenith' && e.state === 'dive' &&
          (e.x < -80 || e.x > g.W + 80 || e.y < -80)) offScreen = true;
      if (offScreen && e.type !== 'boss') {
        list.splice(i, 1);
        VB.Waves.onEnemyGone(e);
      }
    }
  }

  // -------------------------------------------------------------- draw --
  // v3.0 HOLO-ARC: all enemy & boss rendering lives in render.js
  function draw(ctx) {
    VB.Render.drawEnemies(ctx, list);
  }

    function clear() { list.length = 0; }
  function countBosses() {
    let n = 0;
    for (const e of list) if (e.type === 'boss') n++;
    return n;
  }

  return { list, spawn, nearestEnemy, update, draw, clear, countBosses };
})();
