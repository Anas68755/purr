// ============================================================
// VOID BREAKER // NEON ASCENSION — player.js  (v5.0 ABYSS)
// Ship controller: movement, dash, shield, weapons, drones,
// homing missiles, crits, magnet.
// v4.0: buzz saws, focus lens stacks, ghost-shell dash,
// overclock reactor, singularity rounds.
// v4.2: orbital lance, arc stunner EMP, glass protocol,
// leech protocol crits, aurora lifeweaver shield regen.
// v5.0: guardian ring wards, broadside volleys, surge capacitor.
// ============================================================
window.VB = window.VB || {};

VB.Player = (function () {
  const C = VB.CONFIG.PLAYER;
  const W = VB.CONFIG.WEAPON;
  let inst = null;

  function create() {
    const g = VB.Game;
    inst = {
      x: g.W / 2, y: g.H - 100,
      w: C.W, h: C.H,
      speed: C.SPEED + g.upgrades.speed * 20,
      fireRate: Math.max(0.06, C.FIRE_RATE - g.upgrades.fireRate * 0.012),
      fireTimer: 0,
      invincible: 0,
      trail: [],
      drones: [],
      dashCd: 0, dashCdMax: C.DASH_COOLDOWN,
      dashDur: 0, dashDirX: 0, dashDirY: -1,
      dashHitSet: new Set(),
      shieldEnergy: 0,
      shieldActive: false,
      droneFireTimer: 0,
      homingTimer: 1.2,
      time: 0,
      saws: [],
      guardians: [],
      barrageTimer: 3,
      stillTime: 0,
      focusStacks: 0,
      shotCount: 0,
      orbitalTimer: 8,
      orbitalCount: 0
    };
    rebuildSaws(inst);
    rebuildGuardians(inst);
    // v4.1 FLEET: hull variant stats + signature power
    inst.baseSpeed = inst.speed;
    inst.baseFireRate = inst.fireRate;
    inst.ship = VB.Ships ? VB.Ships.current() : null;
    if (VB.Ships) { VB.Ships.applyStats(inst); VB.Ships.onSpawn(inst); }
    return inst;
  }

  /** keep the orbiting saw array in sync with the upgrade level */
  function rebuildSaws(p) {
    const g = VB.Game;
    let lvl = (g.upgrades && g.upgrades.buzzsaw) || 0;
    // v5.3 NANO SWARM: the fused swarm spins one extra blade
    if (g.upgrades && g.upgrades.nanoSwarm && lvl > 0) lvl += 1;
    p.saws = [];
    for (let i = 0; i < lvl; i++) p.saws.push({ ang: (i / Math.max(1, lvl)) * Math.PI * 2 });
  }

  /** v5.0 Guardian Ring: keep the orbiting ward array in sync */
  function rebuildGuardians(p) {
    const lvl = (VB.Game.upgrades && VB.Game.upgrades.guardianRing) || 0;
    p.guardians = [];
    for (let i = 0; i < lvl; i++) {
      p.guardians.push({ ang: (i / Math.max(1, lvl)) * Math.PI * 2 });
    }
  }

  function tryDash(dx, dy) {
    const p = inst, g = VB.Game;
    if (!p || p.dashCd > 0 || p.dashDur > 0) return;
    if (dx === 0 && dy === 0) { dx = 0; dy = -1; }
    const len = Math.hypot(dx, dy) || 1;
    p.dashDirX = dx / len; p.dashDirY = dy / len;
    p.dashDur = C.DASH_TIME;
    p.dashCd = p.dashCdMax;
    // v4.0 Ghost Shell: dash grants a longer phasing window
    // v5.3 WARP DRIVER: the fused driver stretches phasing to +1s
    const ghost = (g.upgrades.ghostDash || 0) * 0.5 + (g.upgrades.warpDriver ? 1 : 0);
    p.invincible = Math.max(p.invincible, C.DASH_TIME + 0.05 + ghost);
    p.dashHitSet = new Set();
    VB.Audio.sfx('dash');
    // dash sparks (directional burst behind the ship)
    for (let i = 0; i < 12; i++) {
      VB.FX.spawnBurst(p.x, p.y,
        -p.dashDirX * 200 + VB.U.frand(-50, 50),
        -p.dashDirY * 200 + VB.U.frand(-50, 50),
        '#ffc857');
    }
    // Nova Pulse: shockwave on dash
    const swLvl = g.upgrades.shockwave || 0;
    if (swLvl > 0) {
      const radius = 120 + swLvl * 20;
      const dmg = 2 + swLvl * 2;
      VB.FX.ring(p.x, p.y, '#ffc857', radius, 0.4);
      VB.Audio.sfx('mine_explode');
      for (let i = VB.Enemies.list.length - 1; i >= 0; i--) {
        const e = VB.Enemies.list[i];
        if (e.type === 'boss' && e.fortifyT > 0) continue;
        if (VB.U.dist(e.x, e.y, p.x, p.y) < radius) {
          e.hp -= dmg;
          VB.FX.explosion(e.x, e.y, '#ffc857', 6, 100);
          if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        }
      }
    }
  }

  /** Adrenaline Core: bonus when lives are critical. */
  function overdriveOn() {
    const g = VB.Game;
    const lvl = g.upgrades.overdrive || 0;
    if (lvl <= 0) return 0;
    return g.lives <= Math.max(2, Math.ceil(g.maxLives * 0.34)) ? lvl : 0;
  }

  function fireBullet() {
    const p = inst, g = VB.Game;
    const bx = p.x, by = p.y - p.h / 2;
    const velLvl = g.upgrades.velocity || 0;
    // v4.0 Focus Lens: standing still stacks bonus damage
    const focusDmg = p.focusStacks || 0;
    // v4.1 FLEET: hull stat bonuses
    const shipS = p.ship ? p.ship.stats : null;
    const dmg = 1 + g.upgrades.damage + velLvl * 0.5 + focusDmg + (shipS ? shipS.dmg : 0);
    const spd = C.BULLET_SPEED * (1 + velLvl * 0.2);
    const sz = 3 + g.upgrades.bulletSize * 0.5 + (shipS ? shipS.size : 0);
    const pierce = (g.timers.pierce > 0 ? 1 : 0) + g.upgrades.piercing;
    const critChance = g.upgrades.crit * 0.08 + (shipS ? shipS.crit : 0);
    const bounce = g.upgrades.ricochet || 0;
    // v4.2 Glass Protocol: raw damage at the cost of hull cells
    const glass = g.upgrades.glassCannon ? 1.6 : 1;
    // v5.3 OMEGA ARRAY: the fused array calibrates every barrel +1 damage
    const omg = g.upgrades.omegaArray ? 1 : 0;
    const dmgTotal = dmg + omg;
    // v4.0 Singularity Rounds: every 6th shot is a gravity round
    const sing = g.upgrades.singularity || 0;
    p.shotCount++;
    const isSing = sing > 0 && p.shotCount % 6 === 0;

    if (g.timers.spread > 0) {
      VB.Audio.sfx('laser_spread');
      for (let a = -W.SPREAD_ANGLE; a <= W.SPREAD_ANGLE; a += W.SPREAD_STEP) {
        g.shots++;
        VB.Bullets.spawnPlayer(bx, by, {
          vx: Math.sin(a) * W.SPREAD_SPEED * (1 + velLvl * 0.2),
          vy: -Math.cos(a) * W.SPREAD_SPEED * (1 + velLvl * 0.2),
          size: sz, damage: dmgTotal * glass, color: '#ff5470', pierceLeft: pierce,
          bounce: bounce, pull: isSing,
          crit: Math.random() < critChance
        });
      }
    } else {
      VB.Audio.sfx('laser');
      // main twin cannons
      for (const off of [-W.TWIN_OFFSET, W.TWIN_OFFSET]) {
        g.shots++;
        VB.Bullets.spawnPlayer(bx + off, by, {
          vx: 0, vy: -spd,
          size: isSing ? sz + 1.5 : sz, damage: dmgTotal * glass,
          color: isSing ? '#c86bff' : '#ff8a3d',
          pierceLeft: pierce, bounce: bounce, pull: isSing,
          crit: Math.random() < critChance
        });
      }
      // Twin Cannons: extra angled pairs per level
      // v5.3 OMEGA ARRAY: the fused array adds one more full pair
      const tw = (g.upgrades.twinShot || 0) + (g.upgrades.omegaArray ? 1 : 0);
      for (let i = 1; i <= tw; i++) {
        const ang = 0.1 * i;
        for (const side of [-1, 1]) {
          g.shots++;
          VB.Bullets.spawnPlayer(bx + side * (W.TWIN_OFFSET + 8 * i), by, {
            vx: Math.sin(ang) * spd * side, vy: -Math.cos(ang) * spd,
            size: Math.max(2.5, sz - 0.5), damage: dmgTotal * glass, color: '#ff9a54',
            pierceLeft: pierce, bounce: bounce, pull: isSing,
            crit: Math.random() < critChance
          });
        }
      }
    }
  }

  function fireDroneVolley() {
    const p = inst, g = VB.Game;
    const dmg = 1 + Math.floor(g.upgrades.damage / 2);
    for (const d of p.drones) {
      const dx = p.x + Math.cos(d.angle) * C.DRONE_RADIUS;
      const dy = p.y + Math.sin(d.angle) * C.DRONE_RADIUS;
      const target = VB.Enemies.nearestEnemy(dx, dy);
      if (target) {
        const ang = Math.atan2(target.y - dy, target.x - dx);
        VB.Bullets.spawnPlayer(dx, dy, {
          vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560,
          size: 2.5, damage: dmg, color: '#58f6ff', pierceLeft: 0, crit: false
        });
      } else {
        VB.Bullets.spawnPlayer(dx, dy, {
          vx: 0, vy: -560, size: 2.5, damage: dmg, color: '#58f6ff', pierceLeft: 0, crit: false
        });
      }
    }
  }

  function fireHomingMissiles() {
    const p = inst, g = VB.Game;
    const dmg = 2 + g.upgrades.damage * 1.5;
    for (const side of [-1, 1]) {
      g.shots++;
      VB.Bullets.spawnPlayer(p.x + side * 14, p.y, {
        vx: side * 160, vy: -260,
        size: 3.5, damage: dmg, color: '#ffc857', pierceLeft: 0,
        missile: true, turn: 4.2, speed: 430,
        crit: Math.random() < g.upgrades.crit * 0.08
      });
    }
    VB.Audio.sfx('missile');
  }

  /** v4.2 Arc Stunner: every 10th shot pops an EMP that stuns nearby foes */
  function arcStunner(p) {
    const g = VB.Game;
    const lvl = g.upgrades.stunner;
    const R = 170 + lvl * 40;
    let zapped = 0;
    for (const e of VB.Enemies.list) {
      if (e.type === 'boss') continue;
      if (VB.U.dist(e.x, e.y, p.x, p.y) < R) {
        e.stunT = Math.max(e.stunT || 0, 0.9 + 0.15 * lvl);
        VB.FX.explosion(e.x, e.y, '#ffe86b', 3, 60);
        zapped++;
      }
    }
    VB.FX.ring(p.x, p.y, '#ffe86b', R, 0.4);
    VB.Audio.sfx('emp');
    if (zapped > 0) VB.FX.dmgNum(p.x, p.y - 34, 'EMP ×' + zapped, '#ffe86b', true);
  }

  /** v4.2 Orbital Lance: a strafing beam hits the nearest foe from orbit */
  function orbitalStrike() {
    const g = VB.Game;
    const p = inst;
    const lvl = g.upgrades.orbital;
    const target = VB.Enemies.nearestEnemy(p.x, p.y);
    if (!target) return;
    let dmg = 4 + lvl * 2;
    if (target.type === 'boss') dmg = Math.max(2, Math.round(dmg * 0.6));
    VB.FX.bolt(target.x, -10, target.x, target.y, '#c86bff');
    VB.FX.explosion(target.x, target.y, '#c86bff', 10, 140);
    VB.FX.shake(3, 0.1);
    VB.Audio.sfx('orbital');
    target.hp -= dmg;
    VB.FX.dmgNum(target.x, target.y - 18, '-' + dmg, '#c86bff', false);
    if (target.hp <= 0) g.killEnemy(target, target.x, target.y, false);
  }

  /** v5.0 Broadside Array: perpendicular side volley */
  function fireBroadside(lvl) {
    const p = inst, g = VB.Game;
    const per = 1 + lvl;                       // shots per side
    const dmg = Math.max(1, (1 + g.upgrades.damage * 0.5) * 0.75);
    for (const side of [-1, 1]) {
      for (let j = 0; j < per; j++) {
        g.shots++;
        VB.Bullets.spawnPlayer(
          p.x + side * p.w, p.y - 8 + j * 9, {
            vx: side * (400 + j * 30), vy: -30 + j * 22,
            size: 2.8, damage: dmg, color: '#ff9a54',
            pierceLeft: g.upgrades.piercing, crit: false
          });
      }
    }
    VB.FX.ring(p.x, p.y, '#ff9a54', 46, 0.25);
    VB.Audio.sfx('broadside');
  }

  function update(dtP) {
    const p = inst, g = VB.Game, inp = VB.Input;
    if (!p) return;
    p.time += dtP;

    // v5.0 Surge Capacitor: a hot combo overcharges the whole hull
    const srgLv = g.upgrades.overchargeCap || 0;
    const surging = srgLv > 0 && g.combo >= 10;
    p._surging = surging;

    // v4.1 OVERDRIVE (VANGUARD power): active while powerT > 0
    const vd = !!(p.ship && p.ship.id === 'vanguard' && p.powerT > 0);

    // dash state init (persists between frames)
    if (p.dashCd === undefined) { p.dashCd = 0; p.dashDur = 0; p.dashCdMax = C.DASH_COOLDOWN * Math.pow(0.88, g.upgrades.dashMaster) * (VB.Vault ? VB.Vault.dashMult() : 1); }

    if (p.dashDur > 0) {
      p.dashDur -= dtP;
      p.x += p.dashDirX * C.DASH_SPEED * dtP;
      p.y += p.dashDirY * C.DASH_SPEED * dtP;
    } else {
      const ax = inp.axis();
      const od = overdriveOn();
      const spdMult = (od >= 2 ? 1.28 : od === 1 ? 1.15 : 1) * (vd ? 1.4 : 1) *
        (surging ? 1 + 0.06 * srgLv : 1);
      p.x += ax.x * p.speed * spdMult * dtP;
      p.y += ax.y * p.speed * spdMult * dtP;
      // queue dash if requested
      if (inp.consumeDash()) {
        const a2 = inp.axis();
        tryDash(a2.x, a2.y);
      }
    }
    if (p.dashCd > 0) p.dashCd -= dtP;

    // v4.1 FLEET: signature power trigger + cooldown tick
    if (VB.Ships) {
      if (inp.consumePower && inp.consumePower()) VB.Ships.tryPower(p);
      VB.Ships.update(p, dtP);
    }

    p.x = VB.U.clamp(p.x, p.w, g.W - p.w);
    p.y = VB.U.clamp(p.y, p.h, g.H - p.h);

    p._od = overdriveOn();   // cached for visuals

    // trail
    p.trail.push({ x: p.x, y: p.y + p.h / 2, life: 0.25, maxLife: 0.25 });
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= dtP;
      if (p.trail[i].life <= 0) p.trail.splice(i, 1);
    }

    if (p.invincible > 0) p.invincible -= dtP;

    // firing
    const od = overdriveOn();
    const odRateMult = od >= 2 ? 0.6 : od === 1 ? 0.72 : 1;
    let rate = (g.timers.rapid > 0 ? p.fireRate * 0.35 : p.fireRate) * odRateMult * (vd ? 0.62 : 1);
    // v4.0 Overclock Reactor: burst of speed at the start of each wave
    const oc = g.upgrades.overclock || 0;
    if (oc > 0 && (g.waveElapsed || 0) < 4) rate *= (oc >= 2 ? 0.55 : 0.7);
    // v5.0 Surge Capacitor: combo x10+ tightens the trigger
    if (surging) rate *= 1 - 0.1 * srgLv;
    p.fireTimer -= dtP;
    if (inp.firing && p.fireTimer <= 0) {
      p.fireTimer = rate;
      fireBullet();
      // v4.2 Arc Stunner: every 10th volley pops an EMP
      if (g.upgrades.stunner > 0 && p.shotCount % 10 === 0) arcStunner(p);
    }

    // v4.2 Orbital Lance: scheduled beam strikes
    if (g.upgrades.orbital > 0) {
      p.orbitalTimer -= dtP;
      if (p.orbitalTimer <= 0) {
        p.orbitalTimer = Math.max(4.5, 8.5 - g.upgrades.orbital * 1.2);
        p.orbitalCount++;
        orbitalStrike();
      }
    }

    // v4.0 Focus Lens: stillness builds damage stacks
    const fLv = g.upgrades.focus || 0;
    if (fLv > 0) {
      const moving = Math.abs(inp.axis().x) + Math.abs(inp.axis().y) > 0.01;
      if (moving || p.dashDur > 0) {
        p.stillTime = 0;
        p.focusStacks = Math.max(0, p.focusStacks - dtP * 2);
      } else {
        p.stillTime += dtP;
        p.focusStacks = Math.min(fLv, Math.floor(p.stillTime / 1.2));
      }
    }

    // v4.0 Buzz Saws: orbiting contact blades
    if (p.saws.length) {
      const R = 34;
      for (const sw of p.saws) sw.ang += dtP * 3.2;
      for (let si = VB.Enemies.list.length - 1; si >= 0; si--) {
        const e = VB.Enemies.list[si];
        if (e.ghost) continue;             // v5.0: phased foes feel nothing
        if (e.type === 'boss' && e.fortifyT > 0) continue;
        for (const sw of p.saws) {
          const sx = p.x + Math.cos(sw.ang) * R;
          const sy = p.y + Math.sin(sw.ang) * R;
          if (VB.U.dist(sx, sy, e.x, e.y) < 10 + Math.max(e.w, e.h) * 0.4) {
            // per-enemy saw cooldown keeps hits fair
            if (!e.sawHitT || g.time >= e.sawHitT) {
              e.sawHitT = g.time + 0.35;
              e.hp -= 3 + g.upgrades.buzzsaw;
              VB.FX.explosion(e.x, e.y, '#ff9a54', 5, 90);
              VB.Audio.sfx('hit');
              if (e.hp <= 0) { g.killEnemy(e, e.x, e.y, true); break; }
            }
          }
        }
      }
    }

    // v5.0 Guardian Ring: orbiting wards collapse enemy shots
    if (p.guardians.length) {
      for (const gd of p.guardians) gd.ang += dtP * 2.1;
      const pts = p.guardians.map(function (gd) {
        return { x: p.x + Math.cos(gd.ang) * 58, y: p.y + Math.sin(gd.ang) * 58 };
      });
      if (VB.Bullets.guardianSweep && VB.Bullets.guardianSweep(pts, 16) > 0) {
        VB.Audio.sfx('ward');
      }
    }

    // v5.0 Broadside Array: scheduled side volleys
    if ((g.upgrades.barrage || 0) > 0) {
      p.barrageTimer -= dtP;
      if (p.barrageTimer <= 0) {
        p.barrageTimer = Math.max(3, 5.5 - g.upgrades.barrage * 0.8);
        fireBroadside(g.upgrades.barrage);
      }
    }

    // drones (auto-fire orbitals)
    if (p.drones.length) {
      p.droneFireTimer -= dtP;
      for (const d of p.drones) d.angle += dtP * 2.4;
      if (p.droneFireTimer <= 0) {
        // v5.3 NANO SWARM: the fused swarm cycles 40% faster
        p.droneFireTimer = C.DRONE_FIRE_EVERY * (g.upgrades.nanoSwarm ? 0.6 : 1);
        fireDroneVolley();
      }
    }

    // homing missiles
    if (g.upgrades.homing > 0) {
      p.homingTimer -= dtP;
      if (p.homingTimer <= 0) {
        p.homingTimer = Math.max(0.9, C.HOMING_EVERY - g.upgrades.homing * 0.25);
        fireHomingMissiles();
      }
    }

    // shield energy
    p.shieldActive = inp.shieldHeld && p.shieldEnergy > 0 && g.timers.shield <= 0;
    if (p.shieldActive) {
      p.shieldEnergy = Math.max(0, p.shieldEnergy - C.SHIELD_DRAIN * dtP);
    } else {
      // v4.2 AURORA lifeweaver: passive shield regen multiplier
      const rgm = p.ship && p.ship.stats.shieldMult ? p.ship.stats.shieldMult : 1;
      // v5.3 AEGIS CITADEL: the fused citadel recharges twice as fast
      const cit = g.upgrades.aegisCitadel ? 2 : 1;
      p.shieldEnergy = Math.min(100, p.shieldEnergy +
        (C.SHIELD_REGEN + g.upgrades.shieldRegen * 3) * rgm * cit * dtP);
    }

    // magnet: pull powerups
    if (g.upgrades.magnetRange > 0) {
      const mr = 60 + g.upgrades.magnetRange * 40;
      for (const pu of VB.Powerups.list) {
        const d = VB.U.dist(pu.x, pu.y, p.x, p.y);
        if (d < mr && d > 1) {
          const pull = 400 * dtP;
          pu.x += (p.x - pu.x) / d * pull;
          pu.y += (p.y - pu.y) / d * pull;
        }
      }
    }
  }

  function draw(ctx) {
    VB.Render.drawPlayer(ctx, inst);
  }

    /** refresh derived stats after an upgrade was applied */
  function refreshStats() {
    const p = inst, g = VB.Game;
    if (!p) return;
    p.speed = C.SPEED + g.upgrades.speed * 20;
    // v5.3 GRAVITY WELL curse: the void leans on the thrusters
    if (g.curses && g.curses.gravity) p.speed *= 0.8;
    p.fireRate = Math.max(0.06, C.FIRE_RATE - g.upgrades.fireRate * 0.012);
    // v5.3 OMEGA ARRAY: the fused trigger group cycles 25% faster
    if (g.upgrades.omegaArray) p.fireRate = Math.max(0.045, p.fireRate * 0.75);
    // v5.2 PHASE CAPACITOR (vault): dash comes back faster
    p.dashCdMax = C.DASH_COOLDOWN * Math.pow(0.88, g.upgrades.dashMaster) *
      (VB.Vault ? VB.Vault.dashMult() : 1);
    // v5.3 WARP DRIVER: the fused phase engine halves the cooldown
    if (g.upgrades.warpDriver) p.dashCdMax *= 0.5;
    rebuildSaws(p);
    rebuildGuardians(p);
    // v4.1 FLEET: re-apply hull multipliers on top of the new base stats
    p.baseSpeed = p.speed;
    p.baseFireRate = p.fireRate;
    if (VB.Ships) VB.Ships.applyStats(p);
  }

  function getPos() { return inst ? { x: inst.x, y: inst.y } : null; }
  function get() { return inst; }

  return { create, update, draw, refreshStats, getPos, get, tryDash };
})();
