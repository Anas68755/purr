// ============================================================
// VOID BREAKER // NEON ASCENSION — ships.js  (v5.0 ABYSS)
// Pilotable hull variants. Each hull trades stats and carries a
// signature power fired with Q (mobile: PWR button).
//
//   VANGUARD — balanced interceptor        OVERDRIVE
//   RAZOR    — light striker               GHOST STEP
//   BASTION  — heavy gunship               AEGIS BULWARK
//   NOVA     — siege artillery             NOVA PULSE
//   WRAITH   — phantom hunter              SWARM PROTOCOL
//   CHRONOS  — temporal experimental       TIME FRACTURE
//   VOLT     — storm striker               STORM LANCE
//   MAGNUS   — gravity warden              GRAVITY WELL
//   AURORA   — lifeweaver support          REGENESIS
//   ECLIPSE  — railgun sniper              ANNIHILATOR RAIL
//   v5.0:
//   FORGE    — siege engineer              BASTION ARRAY
//   HALCYON  — barrage bomber              CARPET STRIKE
//
// Powers reuse the existing FX / audio / bullet systems; per-hull
// silhouettes live in render.js (HULLS map). MAGNUS wells and FORGE
// turrets are world objects updated here and drawn by render.js
// drawShipFX.
// ============================================================
window.VB = window.VB || {};

VB.Ships = (function () {
  const U = VB.U;

  // ------------------------------------------------------- hull data ---
  const SHIPS = {
    vanguard: {
      id: 'vanguard', name: 'VANGUARD', role: 'BALANCED INTERCEPTOR',
      color: '#7deaff', glow: '#ffc857',
      stats: { speedMult: 1.0, fireMult: 1.0, lives: 4, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'OVERDRIVE', icon: 'OD', cd: 18, dur: 5,
        desc: '5s: +40% thrust, +60% fire rate. Burn bright, burn fast.'
      },
      exec(p) {
        VB.FX.ring(p.x, p.y, '#ffc857', 70, 0.4);
        VB.FX.explosion(p.x, p.y, '#ffc857', 12, 120);
        VB.Audio.sfx('powerup');
      }
    },

    razor: {
      id: 'razor', name: 'RAZOR', role: 'LIGHT STRIKER',
      color: '#58ffd1', glow: '#58ffd1',
      stats: { speedMult: 1.18, fireMult: 0.92, lives: 3, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'GHOST STEP', icon: 'GS', cd: 9, dur: 0,
        desc: 'Blink 165px along your vector and phase out for 1.15s.'
      },
      exec(p) {
        const g = VB.Game;
        const ax = VB.Input.axis();
        let dx = ax.x, dy = ax.y;
        if (!dx && !dy) { dy = -1; }
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        VB.FX.explosion(p.x, p.y, '#58ffd1', 14, 170);
        p.x = U.clamp(p.x + dx * 165, p.w, g.W - p.w);
        p.y = U.clamp(p.y + dy * 165, p.h, g.H - p.h);
        p.invincible = Math.max(p.invincible, 1.15);
        VB.FX.ring(p.x, p.y, '#58ffd1', 62, 0.35);
        VB.FX.explosion(p.x, p.y, '#58ffd1', 10, 120);
        VB.Audio.sfx('dash');
      }
    },

    bastion: {
      id: 'bastion', name: 'BASTION', role: 'HEAVY GUNSHIP',
      color: '#8fb7ff', glow: '#8fb7ff',
      stats: { speedMult: 0.85, fireMult: 1.08, lives: 5, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'AEGIS BULWARK', icon: 'AB', cd: 20, dur: 4,
        desc: '4s: absorb every hit and vaporize shots that come near.'
      },
      exec(p) {
        p.bulwark = true;
        VB.FX.ring(p.x, p.y, '#8fb7ff', 92, 0.5);
        VB.FX.screenFlash(0.15, '#8fb7ff');
        VB.Audio.sfx('shield_up');
      }
    },

    nova: {
      id: 'nova', name: 'NOVA', role: 'SIEGE ARTILLERY',
      color: '#ff8a3d', glow: '#ff8a3d',
      stats: { speedMult: 0.92, fireMult: 1.15, lives: 4, dmg: 1, size: 1.2, crit: 0 },
      power: {
        name: 'NOVA PULSE', icon: 'NP', cd: 14, dur: 0,
        desc: '250px shockwave: heavy damage, knockback, shots erased.'
      },
      exec(p) {
        const g = VB.Game;
        const R = 250;
        VB.FX.ring(p.x, p.y, '#ff8a3d', R, 0.5);
        VB.FX.ring(p.x, p.y, '#ffc857', R * 0.65, 0.35);
        VB.FX.shake(9, 0.3);
        VB.Audio.sfx('mine_explode');
        if (VB.Bullets.wipeEnemyBullets) VB.Bullets.wipeEnemyBullets(p.x, p.y, R);
        for (let i = VB.Enemies.list.length - 1; i >= 0; i--) {
          const e = VB.Enemies.list[i];
          const d = U.dist(e.x, e.y, p.x, p.y);
          if (d >= R) continue;
          e.hp -= e.type === 'boss' ? 6 : 9;
          VB.FX.explosion(e.x, e.y, '#ff8a3d', 8, 120);
          if (e.type !== 'boss' && d > 1) {
            e.x += (e.x - p.x) / d * 90;
            e.y += (e.y - p.y) / d * 90;
          }
          if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        }
      }
    },

    wraith: {
      id: 'wraith', name: 'WRAITH', role: 'PHANTOM HUNTER',
      color: '#c86bff', glow: '#c86bff',
      stats: { speedMult: 1.06, fireMult: 0.96, lives: 4, dmg: 0, size: 0, crit: 0.1 },
      power: {
        name: 'SWARM PROTOCOL', icon: 'SP', cd: 12, dur: 0,
        desc: 'Launch a fan of 6 phasing homing missiles.'
      },
      exec(p) {
        const g = VB.Game;
        const n = 6;
        for (let k = 0; k < n; k++) {
          const a = (k - (n - 1) / 2) * 0.22;
          g.shots++;
          VB.Bullets.spawnPlayer(p.x, p.y, {
            vx: Math.sin(a) * 170, vy: -Math.cos(a) * 170 - 60,
            size: 3.4, damage: 3 + g.upgrades.damage * 0.5,
            color: '#c86bff', pierceLeft: 0,
            missile: true, turn: 4.4, speed: 440,
            crit: Math.random() < g.upgrades.crit * 0.08 +
              (p.ship ? p.ship.stats.crit : 0)
          });
        }
        VB.FX.ring(p.x, p.y, '#c86bff', 42, 0.3);
        VB.Audio.sfx('missile');
      }
    },

    chronos: {
      id: 'chronos', name: 'CHRONOS', role: 'TEMPORAL EXPERIMENT',
      color: '#58a6ff', glow: '#58a6ff',
      stats: { speedMult: 0.95, fireMult: 1.0, lives: 4, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'TIME FRACTURE', icon: 'TF', cd: 22, dur: 0,
        desc: 'Fracture the flow: 4s of time dilation for everything else.'
      },
      exec(p) {
        VB.FX.ring(p.x, p.y, '#58a6ff', 130, 0.5);
        VB.Game.setTimeSlow(4);
      }
    },

    // ---------------------------------------------- v4.2 TITAN ----
    volt: {
      id: 'volt', name: 'VOLT', role: 'STORM STRIKER',
      color: '#ffe86b', glow: '#ffe86b',
      stats: { speedMult: 1.08, fireMult: 0.94, lives: 4, dmg: 0, size: 0, crit: 0.05 },
      power: {
        name: 'STORM LANCE', icon: 'SL', cd: 11, dur: 0,
        desc: 'Chain lightning leaps through up to 7 foes and stuns them.'
      },
      exec(p) {
        const g = VB.Game;
        // collect nearby foes, then hop the arc between them
        const near = VB.Enemies.list.filter(function (e) {
          return VB.U.dist(e.x, e.y, p.x, p.y) < 480;
        });
        if (!near.length) {
          VB.FX.ring(p.x, p.y, '#ffe86b', 90, 0.3);
          VB.Audio.sfx('zap');
          return;
        }
        near.sort(function (a, b) {
          return VB.U.dist(a.x, a.y, p.x, p.y) - VB.U.dist(b.x, b.y, p.x, p.y);
        });
        const chain = near.slice(0, 7);
        let fx = p.x, fy = p.y;
        for (const e of chain) {
          VB.FX.bolt(fx, fy, e.x, e.y, '#ffe86b');
          e.hp -= e.type === 'boss' ? 4 : 6;
          if (e.type !== 'boss') e.stunT = Math.max(e.stunT || 0, 0.8);
          VB.FX.explosion(e.x, e.y, '#ffe86b', 6, 110);
          fx = e.x; fy = e.y;
          if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        }
        VB.FX.ring(p.x, p.y, '#ffe86b', 70, 0.35);
        VB.FX.screenFlash(0.12, '#ffe86b');
        VB.Audio.sfx('zap');
      }
    },

    magnus: {
      id: 'magnus', name: 'MAGNUS', role: 'GRAVITY WARDEN',
      color: '#9d8bff', glow: '#9d8bff',
      stats: { speedMult: 0.9, fireMult: 1.05, lives: 4, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'GRAVITY WELL', icon: 'GW', cd: 16, dur: 0,
        desc: 'Collapse space: drag foes & shots into a well that implodes.'
      },
      exec(p) {
        wells.push({ x: p.x, y: p.y - 40, t: 0, dur: 3.5, r: 240 });
        VB.FX.ring(p.x, p.y - 40, '#9d8bff', 150, 0.5);
        VB.Audio.sfx('gravity');
      }
    },

    aurora: {
      id: 'aurora', name: 'AURORA', role: 'LIFEWEAVER SUPPORT',
      color: '#6effc4', glow: '#6effc4',
      stats: { speedMult: 1.02, fireMult: 0.9, lives: 4, dmg: 0, size: 0, crit: 0, shieldMult: 1.6 },
      power: {
        name: 'REGENESIS', icon: 'RG', cd: 26, dur: 0,
        desc: 'Restore a life (or bank points), refill shields, phase 2s.'
      },
      exec(p) {
        const g = VB.Game;
        if (g.lives < g.maxLives) {
          g.lives++;
          VB.UI.toast('+1 LIFE', 'milestone');
        } else {
          g.score += 2000;
          VB.UI.toast('+2000 OVERCHARGE', 'milestone');
        }
        p.shieldEnergy = 100;
        p.invincible = Math.max(p.invincible, 2);
        VB.FX.ring(p.x, p.y, '#6effc4', 170, 0.6);
        VB.FX.ring(p.x, p.y, '#ffffff', 90, 0.4);
        VB.FX.screenFlash(0.18, '#6effc4');
        VB.Audio.sfx('heal');
      }
    },

    eclipse: {
      id: 'eclipse', name: 'ECLIPSE', role: 'RAILGUN SNIPER',
      color: '#e8f0ff', glow: '#e8f0ff',
      stats: { speedMult: 0.95, fireMult: 0.8, lives: 3, dmg: 2, size: 0.6, crit: 0 },
      power: {
        name: 'ANNIHILATOR RAIL', icon: 'AR', cd: 13, dur: 0,
        desc: 'Fire 3 hypervelocity slugs that pierce the entire lane.'
      },
      exec(p) {
        const g = VB.Game;
        const dmg = 9 + g.upgrades.damage;
        for (let k = -1; k <= 1; k++) {
          const a = -Math.PI / 2 + k * 0.09;
          g.shots++;
          VB.Bullets.spawnPlayer(p.x, p.y - p.h / 2, {
            vx: Math.cos(a) * 1050, vy: Math.sin(a) * 1050,
            size: 7, damage: dmg, color: '#e8f0ff', pierceLeft: 99,
            crit: Math.random() < g.upgrades.crit * 0.08
          });
        }
        VB.FX.shake(7, 0.22);
        VB.FX.screenFlash(0.16, '#e8f0ff');
        VB.FX.ring(p.x, p.y - 16, '#e8f0ff', 60, 0.3);
        VB.Audio.sfx('rail');
      }
    },

    // ---------------------------------------------- v5.0 ABYSS ----
    forge: {
      id: 'forge', name: 'FORGE', role: 'SIEGE ENGINEER',
      color: '#ffb35c', glow: '#ffb35c',
      stats: { speedMult: 0.88, fireMult: 0.95, lives: 5, dmg: 0, size: 0, crit: 0 },
      power: {
        name: 'BASTION ARRAY', icon: 'BA', cd: 17, dur: 6,
        desc: 'Deploy 3 auto-turrets that hold your lane for 6s.'
      },
      exec(p) {
        const g = VB.Game;
        for (let k = -1; k <= 1; k++) {
          turrets.push({
            x: VB.U.clamp(p.x + k * 42, 24, g.W - 24),
            y: Math.max(40, p.y - 30),
            t: 0, dur: 6, fireT: 0.25 + Math.abs(k) * 0.12,
            aim: -Math.PI / 2
          });
        }
        VB.FX.ring(p.x, p.y - 26, '#ffb35c', 110, 0.45);
        VB.FX.spawnBurst(p.x, p.y - 30, 0, -40, '#ffb35c');
        VB.Audio.sfx('turret');
      }
    },

    halcyon: {
      id: 'halcyon', name: 'HALCYON', role: 'BARRAGE BOMBER',
      color: '#ff5f9e', glow: '#ff5f9e',
      stats: { speedMult: 0.9, fireMult: 0.9, lives: 4, dmg: 1, size: 0.8, crit: 0 },
      power: {
        name: 'CARPET STRIKE', icon: 'CS', cd: 14, dur: 0,
        desc: 'Walk 6 payloads across your lane; each detonates in turn.'
      },
      exec(p) {
        const g = VB.Game;
        for (let k = 0; k < 6; k++) {
          const bx = VB.U.clamp(p.x + (k - 2.5) * 62, 30, g.W - 30);
          const by = VB.U.clamp(p.y - 26, 60, g.H - 90);
          VB.Game.schedule(k * 0.14, function () {
            VB.FX.ring(bx, by, '#ff5f9e', 30, 0.3);
            VB.Audio.sfx('bomb');
          });
          VB.Game.schedule(k * 0.14 + 0.38, function () {
            // detonation: heavy blast that also scrubs enemy fire
            VB.FX.explosion(bx, by, '#ff5f9e', 18, 170);
            VB.FX.ring(bx, by, '#ffc857', 95, 0.4);
            VB.FX.shake(4, 0.14);
            VB.Audio.sfx('mine_explode');
            if (VB.Bullets.wipeEnemyBullets) VB.Bullets.wipeEnemyBullets(bx, by, 115);
            for (let i = VB.Enemies.list.length - 1; i >= 0; i--) {
              const e = VB.Enemies.list[i];
              const d = VB.U.dist(e.x, e.y, bx, by);
              if (d >= 95) continue;
              e.hp -= e.type === 'boss' ? 4 : 7 + g.upgrades.damage;
              VB.FX.explosion(e.x, e.y, '#ff5f9e', 6, 100);
              if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
            }
          });
        }
        VB.FX.ring(p.x, p.y, '#ff5f9e', 70, 0.35);
      }
    },

    // ------------------------------------------ v5.3 HORIZON ----
    // The secret 13th hull. Locked in the hangar until a pilot flies
    // deep into a cursed run (wave 20 with 2+ curses active).
    omega: {
      id: 'omega', name: 'OMEGA', role: 'REWRITE ENGINE',
      color: '#ffd166', glow: '#ffd166',
      stats: { speedMult: 1.08, fireMult: 0.85, lives: 4, dmg: 1, size: 0, crit: 0.05 },
      power: {
        name: 'OMEGA PROTOCOL', icon: 'OM', cd: 22, dur: 5,
        desc: '5s of everything: rapid, spread, piercing, time dilation.'
      },
      exec(p) {
        const g = VB.Game;
        g.timers.rapid = 5;
        g.timers.spread = 5;
        g.timers.pierce = 5;
        g.setTimeSlow(5);
        p.shieldEnergy = 100;
        VB.FX.ring(p.x, p.y, '#ffd166', 200, 0.6);
        VB.FX.ring(p.x, p.y, '#ffffff', 120, 0.4);
        VB.FX.screenFlash(0.22, '#ffd166');
        VB.Audio.sfx('orbital');
      }
    }
  };

  const ORDER = ['vanguard', 'razor', 'bastion', 'nova', 'wraith', 'chronos',
    'volt', 'magnus', 'aurora', 'eclipse', 'forge', 'halcyon', 'omega'];

  // ------------------------------------------------------- selection ---
  let selectedId = 'vanguard';
  let loaded = false;

  /** v5.3: the secret hull stays frozen until the curse-run commendation */
  function isUnlocked(id) {
    if (id !== 'omega') return true;
    return !!(VB.Achievements && VB.Achievements.getCounters().omegaUnlocked);
  }

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const s = VB.U.storage.get(VB.CONFIG.STORAGE.ship, 'vanguard');
    if (SHIPS[s] && isUnlocked(s)) selectedId = s;
  }
  function current() { ensureLoaded(); return SHIPS[selectedId] || SHIPS.vanguard; }
  function select(id) {
    if (!SHIPS[id]) return false;
    if (!isUnlocked(id)) return false;   // v5.3: no hull sneaking past the seal
    ensureLoaded();
    selectedId = id;
    VB.U.storage.set(VB.CONFIG.STORAGE.ship, id);
    return true;
  }
  function cycle(dir) {
    ensureLoaded();
    let i = ORDER.indexOf(selectedId);
    // v5.3: locked hulls are skipped by the arrow-key cycle
    for (let step = 0; step < ORDER.length; step++) {
      i = (i + dir + ORDER.length) % ORDER.length;
      if (isUnlocked(ORDER[i])) break;
    }
    select(ORDER[i]);
    refreshCards();
    return SHIPS[ORDER[i]];
  }

  // ------------------------------------------------------ gravity wells ---
  // MAGNUS world objects: pull foes & shots, then implode.
  const wells = [];

  // --------------------------------------------------- FORGE turrets ---
  // v5.0 BASTION ARRAY: static auto-turrets that hold the lane while
  // they last, sweeping their aim toward the nearest target.
  const turrets = [];

  function updateTurrets(dt) {
    const g = VB.Game;
    for (let i = turrets.length - 1; i >= 0; i--) {
      const tr = turrets[i];
      tr.t += dt;
      if (tr.t >= tr.dur) {
        VB.FX.explosion(tr.x, tr.y, '#ffb35c', 10, 110);
        VB.FX.ring(tr.x, tr.y, '#ffb35c', 34, 0.3);
        turrets.splice(i, 1);
        continue;
      }
      const target = VB.Enemies.nearestEnemy(tr.x, tr.y);
      if (target) {
        const want = Math.atan2(target.y - tr.y, target.x - tr.x);
        const diff = VB.U.angleDiff(want, tr.aim);
        tr.aim += Math.sign(diff) * Math.min(Math.abs(diff), 6 * dt);
      }
      tr.fireT -= dt;
      if (tr.fireT <= 0 && target) {
        tr.fireT = 0.55;
        g.shots++;
        VB.Bullets.spawnPlayer(
          tr.x + Math.cos(tr.aim) * 10, tr.y + Math.sin(tr.aim) * 10, {
            vx: Math.cos(tr.aim) * 540, vy: Math.sin(tr.aim) * 540,
            size: 2.6, damage: 2 + g.upgrades.damage * 0.4,
            color: '#ffb35c', pierceLeft: 0,
            crit: Math.random() < g.upgrades.crit * 0.08
          });
        VB.FX.spawnBurst(tr.x + Math.cos(tr.aim) * 12,
          tr.y + Math.sin(tr.aim) * 12,
          Math.cos(tr.aim) * 60, Math.sin(tr.aim) * 60, '#ffb35c');
        VB.Audio.sfx('laser');
      }
    }
  }

  function updateWells(dt) {
    const g = VB.Game;
    for (let i = wells.length - 1; i >= 0; i--) {
      const w = wells[i];
      w.t += dt;
      // pull light enemies (bosses resist)
      for (const e of g.enemiesList) {
        if (e.type === 'boss' || !e.entered) continue;   // v5.3.1 spawn gate
        const dx = w.x - e.x, dy = w.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < w.r && d > 6) {
          const f = (150 + 60 * Math.sin(w.t * 6)) * dt;
          e.x += dx / d * f;
          e.y += dy / d * f;
        }
      }
      // drag enemy shots; bullets.js consumes them at the core
      if (VB.Bullets.pullEnemyBullets) {
        VB.Bullets.pullEnemyBullets(w.x, w.y, w.r, dt);
      }
      if (w.t >= w.dur) {
        // implosion: heavy damage around the core
        const R = 150;
        VB.FX.ring(w.x, w.y, '#9d8bff', 220, 0.5);
        VB.FX.explosion(w.x, w.y, '#9d8bff', 26, 240);
        VB.FX.shake(8, 0.25);
        VB.Audio.sfx('well_collapse');
        for (let k = g.enemiesList.length - 1; k >= 0; k--) {
          const e = g.enemiesList[k];
          if (!e.entered) continue;                       // v5.3.1 spawn gate
          const d = VB.U.dist(e.x, e.y, w.x, w.y);
          if (d < R) {
            e.hp -= e.type === 'boss' ? 5 : 8;
            VB.FX.explosion(e.x, e.y, '#9d8bff', 5, 90);
            if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
          }
        }
        wells.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------- stat plumbing ---
  /** re-derive ship-modified stats from the freshly computed base stats */
  function applyStats(p) {
    if (!p || !p.ship) return;
    const s = p.ship.stats;
    p.speed = p.baseSpeed * s.speedMult;
    p.fireRate = Math.max(0.05, p.baseFireRate * s.fireMult);
  }

  /** called once per run from Player.create: lives, power timers, HUD tint */
  function onSpawn(p) {
    const g = VB.Game;
    p.powerCd = 0; p.powerT = 0;
    p.powerCdMax = p.ship.power.cd;
    p.bulwark = false;
    // v5.2 OMEGA: hull life budget stacks with the vault HULL CACHE and
    // pays the FRAGILE curse penalty (startGame only fixes maxLives)
    const lifeDelta = (VB.Vault ? VB.Vault.startLives() : 0) -
      (g.curses && g.curses.fragile ? 2 : 0);
    g.lives = Math.min(Math.max(1, p.ship.stats.lives + lifeDelta), g.maxLives);
    wells.length = 0;                    // fresh field for each run
    turrets.length = 0;
    const pf = document.getElementById('powerFill');
    if (pf) pf.style.background = p.ship.color;
    if (VB.Achievements) VB.Achievements.on('pilot', p.ship.id);
  }

  // ------------------------------------------------------- the power ---
  function tryPower(p) {
    if (!p || !p.ship) return false;
    if (VB.Game.state !== 'playing') return false;
    if (p.powerCd > 0 || p.powerT > 0) return false;
    const sh = p.ship;
    sh.exec(p);
    p.powerCd = sh.power.cd;
    p.powerCdMax = sh.power.cd;
    p.powerT = sh.power.dur || 0;
    VB.UI.toast(sh.power.name + ' ONLINE', 'info');
    return true;
  }

  function update(p, dt) {
    if (!p || !p.ship) return;
    updateWells(dt);
    updateTurrets(dt);
    if (p.powerCd > 0) {
      p.powerCd -= dt;
      if (p.powerCd <= 0) {
        p.powerCd = 0;
        VB.UI.toast(p.ship.power.name + ' READY', 'info');
        VB.Audio.sfx('ui_pick');
      }
    }
    if (p.powerT > 0) {
      p.powerT -= dt;
      if (p.powerT <= 0) {
        p.powerT = 0;
        if (p.ship.id === 'bastion') p.bulwark = false;
      }
    }
  }

  // ------------------------------------------------- start-screen UI ---
  function statChips(s) {
    const chips = [];
    if (s.speedMult > 1.02) chips.push(['SPD+', 'good']);
    else if (s.speedMult < 0.98) chips.push(['SPD−', 'bad']);
    if (s.fireMult < 0.98) chips.push(['RIF+', 'good']);
    else if (s.fireMult > 1.02) chips.push(['RIF−', 'bad']);
    if (s.lives > 4) chips.push(['HUL+', 'good']);
    else if (s.lives < 4) chips.push(['HUL−', 'bad']);
    if (s.dmg > 0) chips.push(['DMG+', 'good']);
    if (s.crit > 0) chips.push(['CRT+', 'good']);
    if (s.size > 0) chips.push(['CAL+', 'good']);
    if (s.shieldMult > 1) chips.push(['RGN+', 'good']);
    if (!chips.length) chips.push(['STD', '']);
    return chips.map(function (c) {
      return '<span class="ship-stat ' + c[1] + '">' + c[0] + '</span>';
    }).join('');
  }

  let rootEl = null;
  function buildCard(sh) {
    const card = document.createElement('div');
    card.id = 'shipCard-' + sh.id;
    // v5.3: the classified hull renders as a sealed ghost tile
    const locked = !isUnlocked(sh.id);
    card.className = 'ship-card' + (locked ? ' locked' : '');
    card.style.setProperty('--c', sh.color);
    card.style.setProperty('--c-soft', VB.U.hexA(sh.color, 0.35));
    card.style.setProperty('--c-faint', VB.U.hexA(sh.color, 0.1));
    if (locked) {
      card.innerHTML =
        '<span class="sc-key">?</span>' +
        '<span class="sc-tag">LOCK</span>' +
        '<div class="ship-name">???</div>' +
        '<div class="ship-role">CLASSIFIED HULL</div>' +
        '<div class="ship-power">SEALED</div>' +
        '<div class="ship-pdesc">Reach wave 20 with 2+ curses active to unseal.</div>' +
        '<div class="ship-stats"><span class="ship-stat">???</span></div>';
      card.addEventListener('click', function () {
        VB.Audio.sfx('ui_hover');
        VB.UI.toast('SEALED HULL — reach wave 20 with 2+ curses to unseal OMEGA', 'danger');
      });
      return card;
    }
    card.innerHTML =
      '<span class="sc-key">Q</span>' +
      '<span class="sc-tag">' + sh.power.icon + '</span>' +
      '<canvas class="ship-canvas" width="52" height="52"></canvas>' +
      '<div class="ship-name">' + sh.name + '</div>' +
      '<div class="ship-role">' + sh.role + '</div>' +
      '<div class="ship-power">' + sh.power.name + '</div>' +
      '<div class="ship-pdesc">' + sh.power.desc + '</div>' +
      '<div class="ship-stats">' + statChips(sh.stats) + '</div>';
    card.addEventListener('click', function () {
      VB.Audio.sfx('ui_pick');
      select(sh.id);
      refreshCards();
    });
    card.addEventListener('mouseenter', function () { VB.Audio.sfx('ui_hover'); });
    return card;
  }

  function refreshCards() {
    if (!rootEl) return;
    ensureLoaded();
    for (const id of ORDER) {
      const card = document.getElementById('shipCard-' + id);
      if (card) card.classList.toggle('sel', id === selectedId);
    }
  }

  function initUI() {
    rootEl = document.getElementById('shipSelect');
    if (!rootEl) return;
    ensureLoaded();
    for (const id of ORDER) rootEl.appendChild(buildCard(SHIPS[id]));
    refreshCards();

    // preview hulls on the little canvases
    if (VB.Render && VB.Render.previewHull) {
      for (const id of ORDER) {
        const cv = document.querySelector('#shipCard-' + id + ' canvas');
        if (!cv || !cv.getContext) continue;
        const c2 = cv.getContext('2d');
        VB.Render.previewHull(c2, id, 52, SHIPS[id].color);
      }
    }

    // ← / → cycle hulls while the start screen is up
    window.addEventListener('keydown', function (e) {
      const start = document.getElementById('startScreen');
      if (!start || start.classList.contains('hidden')) return;
      if (VB.Game.state !== 'menu') return;
      if (e.key === 'ArrowLeft') { VB.Audio.sfx('ui_hover'); cycle(-1); }
      if (e.key === 'ArrowRight') { VB.Audio.sfx('ui_hover'); cycle(1); }
    });
  }

  return {
    ORDER, current, select, cycle, isUnlocked,
    applyStats, onSpawn, tryPower, update, initUI, refreshCards,
    get SHIPS() { return SHIPS; },
    get selectedId() { ensureLoaded(); return selectedId; },
    get wells() { return wells; },
    get turrets() { return turrets; }
  };
})();
