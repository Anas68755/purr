// ============================================================
// VOID BREAKER // NEON ASCENSION — bullets.js  (v5.0 ABYSS)
// Player bullets, enemy bullets, homing missiles, the frame-synced
// delayed-shot queue (pause safe), mines, and all bullet collisions.
// v4.0 bullet physics:
//   curve   — enemy shots that bank sideways (VORTEX spiral arms)
//   prism   — bullets that shatter into fragments after splitAt (GORGON)
//   pull    — player rounds that drag light enemies toward their path
//   fuse    — shots with a lifetime: homing missiles defuse after ~15 s
//             instead of chasing the player forever
// v4.2:
//   pullEnemyBullets — MAGNUS gravity wells drag & consume enemy shots
//   friendly mines   — Proximity Ward upgrade leaves player-side mines
//   vampire          — crit hits restore shield energy
// v5.0:
//   guardianSweep    — GUARDIAN RING wards collapse enemy shots
//   deadEye          — crits scale past 2.5x with the Deadeye Suite
//   e.ghost          — phased PHANTOMs ignore bullets & contact
// ============================================================
window.VB = window.VB || {};

VB.Bullets = (function () {
  const playerB = [];      // player bullets & missiles
  const enemyB = [];       // enemy bullets
  const delayed = [];      // delayed enemy shots (frame-synced queue)
  const mines = [];

  // ------------------------------------------------------ spawning ------
  function spawnPlayer(x, y, o) {
    playerB.push({
      x, y, vx: o.vx, vy: o.vy,
      size: o.size, damage: o.damage, color: o.color,
      pierceLeft: o.pierceLeft || 0,
      crit: !!o.crit,
      missile: !!o.missile,
      turn: o.turn || 0,
      speed: o.speed || Math.hypot(o.vx, o.vy),
      bounce: o.bounce || 0,
      pull: !!o.pull,
      hasHit: false
    });
  }

  function spawnEnemy(x, y, o) {
    // Chrono Field: enemy bullets crawl when the upgrade is owned
    const tw = 1 - 0.1 * ((VB.Game.upgrades && VB.Game.upgrades.timeWarp) || 0);
    enemyB.push({
      x, y, vx: o.vx * tw, vy: o.vy * tw,
      size: o.size || 4, color: o.color || '#ff5470',
      homing: !!o.homing, turn: o.turn || 0,
      curve: o.curve || 0,
      prism: !!o.splitAt, splitAt: o.splitAt || 0, splitN: o.splitN || 3,
      life: o.life || 0,   // >0: projectile defuses after this many seconds
      age: 0
    });
  }

  function queueDelayed(o) { delayed.push(o); }

  function spawnMine(x, y, fromBomber, friendly) {
    const g = VB.Game;
    if (mines.length > 14) return;
    const M = VB.CONFIG.MINES;
    mines.push({
      x: x !== undefined ? x : Math.random() * (g.W - 100) + 50,
      y: y !== undefined ? y : -30,
      vy: fromBomber ? 30 : 40 + Math.random() * 30,
      size: 12, time: 0, armed: false,
      armTimer: M.ARM_TIME, beepT: 0,
      blastRadius: M.BLAST_BASE + VB.Waves.wave * M.BLAST_WAVE,
      pulseTime: 0,
      // v4.2 Proximity Ward: player-side mine, triggers on foes only
      friendly: !!friendly,
      dmg: friendly ? 6 + 2 * ((VB.Game.upgrades && VB.Game.upgrades.proximity) || 0) : 3
    });
  }

  // ------------------------------------------------------- updates ------
  function nearestEnemyTo(x, y) {
    return VB.Enemies.nearestEnemy(x, y);
  }

  function update(dt) {
    const g = VB.Game;

    // ---- player bullets / missiles ----
    for (let i = playerB.length - 1; i >= 0; i--) {
      const b = playerB[i];
      if (b.missile && b.turn) {
        const t = nearestEnemyTo(b.x, b.y);
        if (t) {
          const want = Math.atan2(t.y - b.y, t.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const diff = VB.U.angleDiff(want, cur);
          const turn = Math.sign(diff) * Math.min(Math.abs(diff), b.turn * dt);
          const a = cur + turn;
          b.vx = Math.cos(a) * b.speed;
          b.vy = Math.sin(a) * b.speed;
        }
        if (Math.random() < dt * 30) {
          VB.FX.spawnBurst(b.x, b.y, VB.U.frand(-20, 20), VB.U.frand(10, 60), '#ffc857');
        }
      }
      // v4.0 Singularity Rounds: drag nearby light enemies toward the shot
      if (b.pull) {
        for (const e of g.enemiesList) {
          if (e.type === 'boss' || !e.entered) continue;   // v5.3.1 spawn gate
          const dx = b.x - e.x, dy = b.y - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 130 && d > 4) {
            const f = 150 * dt;
            e.x += dx / d * f;
            e.y += dy / d * f;
          }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      // Ricochet Rounds: reflect off side walls & the bottom edge
      if (b.bounce > 0) {
        let bounced = false;
        if (b.x < b.size && b.vx < 0) { b.x = b.size; b.vx = -b.vx; bounced = true; }
        else if (b.x > g.W - b.size && b.vx > 0) { b.x = g.W - b.size; b.vx = -b.vx; bounced = true; }
        else if (b.y > g.H - b.size && b.vy > 0) { b.y = g.H - b.size; b.vy = -b.vy; bounced = true; }
        if (bounced) {
          b.bounce--;
          VB.FX.spawnBurst(b.x, b.y, -b.vx * 0.3, -b.vy * 0.3, b.color);
        }
      }
      if (b.y < -20 || b.y > g.H + 20 || b.x < -20 || b.x > g.W + 20) {
        playerB.splice(i, 1);
      }
    }

    // ---- enemy bullets ----
    for (let i = enemyB.length - 1; i >= 0; i--) {
      const b = enemyB[i];
      if (b.homing && g.player) {
        const ang = Math.atan2(g.player.y - b.y, g.player.x - b.x);
        const curAng = Math.atan2(b.vy, b.vx);
        const diff = VB.U.angleDiff(ang, curAng);
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), b.turn * dt);
        const newAng = curAng + turn;
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(newAng) * spd;
        b.vy = Math.sin(newAng) * spd;
      }
      // v4.0: curved shots bank their velocity (spiral arms)
      if (b.curve) {
        const ang = Math.atan2(b.vy, b.vx) + b.curve * dt;
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.age += dt;
      // fuse: dying fuel vents as smoke during the final 1.5 s
      if (b.life > 0 && b.life - b.age < 1.5 && Math.random() < dt * 18) {
        VB.FX.spawnBurst(b.x, b.y, VB.U.frand(-14, 14), VB.U.frand(-14, 14), b.color);
      }
      // fuse expired: the missile defuses with a fizzle instead of
      // circling the player forever
      if (b.life > 0 && b.age >= b.life) {
        VB.FX.explosion(b.x, b.y, b.color, 7, 90);
        VB.FX.spawnBurst(b.x, b.y, -b.vx * 0.25, -b.vy * 0.25, b.color);
        VB.FX.ring(b.x, b.y, b.color, 14, 0.3);
        enemyB.splice(i, 1);
        continue;
      }
      // v4.0: prism rounds shatter into fragments mid-flight
      if (b.prism) {
        if (b.age >= b.splitAt) {
          const spd = Math.hypot(b.vx, b.vy) * 0.82;
          const base = Math.atan2(b.vy, b.vx);
          for (let s = 0; s < b.splitN; s++) {
            const ang = base + (s - (b.splitN - 1) / 2) * 0.34;
            enemyB.push({
              x: b.x, y: b.y,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              size: Math.max(2.5, b.size * 0.62),
              color: b.color, homing: false, turn: 0,
              curve: 0, prism: false, splitAt: 0, age: 0
            });
          }
          VB.FX.spawnBurst(b.x, b.y, 0, 0, b.color);
          VB.FX.spawnBurst(b.x, b.y, 40, -40, b.color);
          enemyB.splice(i, 1);
          continue;
        }
      }
      if (b.y < -30 || b.y > g.H + 30 || b.x < -30 || b.x > g.W + 30) {
        enemyB.splice(i, 1);
      }
    }

    // ---- delayed shots (frame-synced; respects pause & boss death) ----
    for (let i = delayed.length - 1; i >= 0; i--) {
      delayed[i].delay -= dt;
      if (delayed[i].delay <= 0) {
        const db = delayed[i];
        enemyB.push({ x: db.x, y: db.y, vx: db.vx, vy: db.vy, size: db.size, color: db.color });
        delayed.splice(i, 1);
      }
    }

    // ---- mines ----
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.y += m.vy * dt;
      m.time += dt;
      m.pulseTime += dt;
      m.beepT -= dt;
      if (m.time >= m.armTimer) {
        if (!m.armed && m.y > 0 && m.y < g.H) VB.Audio.sfx('mine_beep');
        m.armed = true;
      }
      if (m.armed && m.beepT <= 0 && m.y > 0 && m.y < g.H) {
        m.beepT = 1.0;
        VB.Audio.sfx('mine_beep');
      }
      if (m.armed && !m.friendly && g.player) {
        const d = VB.U.dist(m.x, m.y, g.player.x, g.player.y);
        if (d < m.blastRadius * VB.CONFIG.MINES.TRIGGER_RADIUS) {
          explodeMine(m);
          mines.splice(i, 1);
          continue;
        }
      }
      // v4.2 friendly mine: detonates on the closest foe in range
      if (m.armed && m.friendly) {
        for (const e of g.enemiesList) {
          if (!e.entered) continue;                        // v5.3.1 spawn gate
          if (e.type === 'boss' && e.fortifyT > 0) continue;
          if (VB.U.dist(m.x, m.y, e.x, e.y) <
              m.blastRadius * VB.CONFIG.MINES.TRIGGER_RADIUS + Math.max(e.w, e.h) * 0.4) {
            explodeMine(m);
            mines.splice(i, 1);
            break;
          }
        }
        if (mines[i] !== m) continue;   // consumed above
      }
      if (m.y > g.H + 50) mines.splice(i, 1);
    }
  }

  function explodeMine(m) {
    const g = VB.Game;
    VB.FX.explosion(m.x, m.y, m.friendly ? '#6effc4' : '#ff5470', 30, 250);
    VB.FX.explosion(m.x, m.y, '#ffc857', 15, 150);
    VB.FX.ring(m.x, m.y, m.friendly ? '#6effc4' : '#ff5470', m.blastRadius, 0.5);
    VB.FX.shake(10, 0.3);
    if (!m.friendly) VB.FX.screenFlash(0.2, '#ff5470');
    VB.Audio.sfx('mine_explode');
    // blast also damages enemies caught in radius (player is handled below)
    for (let i = VB.Enemies.list.length - 1; i >= 0; i--) {
      const e = VB.Enemies.list[i];
      if (e.type === 'boss' || !e.entered) continue;   // v5.3.1 spawn gate
      if (VB.U.dist(m.x, m.y, e.x, e.y) < m.blastRadius) {
        e.hp -= m.dmg || 3;
        VB.FX.explosion(e.x, e.y, '#ffc857', 4, 80);
        if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
      }
    }
    if (m.friendly) return;   // player-side ward never hurts the pilot
    if (g.player && g.player.invincible <= 0 &&
        !(g.player.shieldActive || g.timers.shield > 0) &&
        VB.U.dist(m.x, m.y, g.player.x, g.player.y) < m.blastRadius * 0.8) {
      g.damagePlayer();
    }
  }

  /** v4.2 MAGNUS GRAVITY WELL: bend enemy shots toward the core and
   *  vaporize anything that reaches it. Returns how many were eaten. */
  function pullEnemyBullets(x, y, r, dt) {
    let eaten = 0;
    for (let i = enemyB.length - 1; i >= 0; i--) {
      const b = enemyB[i];
      const dx = x - b.x, dy = y - b.y;
      const d = Math.hypot(dx, dy);
      if (d >= r || d < 1) continue;
      // pull strength grows as shots near the core
      const f = (120 + (1 - d / r) * 260) * dt;
      b.vx += dx / d * f;
      b.vy += dy / d * f;
      if (d < 26) {
        VB.FX.spawnBurst(b.x, b.y, dx / d * 40, dy / d * 40, b.color || '#9d8bff');
        enemyB.splice(i, 1);
        eaten++;
      }
    }
    return eaten;
  }

  /** v5.0 GUARDIAN RING: collapse enemy shots near the orbiting wards.
   *  Returns how many shots were consumed. */
  function guardianSweep(points, r) {
    let eaten = 0;
    for (let i = enemyB.length - 1; i >= 0; i--) {
      const b = enemyB[i];
      for (const pt of points) {
        if (VB.U.dist(b.x, b.y, pt.x, pt.y) < r) {
          VB.FX.spawnBurst(b.x, b.y, VB.U.frand(-40, 40), VB.U.frand(-40, 40),
            b.color || '#e8f0ff');
          VB.FX.ring(b.x, b.y, '#e8f0ff', 14, 0.22);
          enemyB.splice(i, 1);
          eaten++;
          break;
        }
      }
    }
    return eaten;
  }

  // ----------------------------------------------------- collisions -----
  function collide() {
    const g = VB.Game;
    if (!g.player) return;

    // ---- player bullets vs enemies (incl. bosses) ----
    for (let bi = playerB.length - 1; bi >= 0; bi--) {
      const b = playerB[bi];
      let removed = false;
      for (let ei = g.enemiesList.length - 1; ei >= 0; ei--) {
        const e = g.enemiesList[ei];
        if (e.ghost) continue;               // v5.0: phased phantom is untouchable
        if (!e.entered) continue;            // v5.3.1: still gliding in — untouchable
        const hitR = e.type === 'boss' ? e.w : Math.max(e.w, e.h) * 0.6;
        if (VB.U.dist(b.x, b.y, e.x, e.y) >= hitR) continue;

        // shielder frontal shield test
        if (e.type === 'boss' && e.fortifyT > 0) {
          // MONOLITH fortify: frontal arc blocks bullets outright
          if (b.vy < 0 || b.y < e.y) {
            VB.FX.explosion(b.x, b.y, '#8fb7ff', 4, 80);
            VB.Audio.sfx('hit_shield');
            consumeBullet(b, bi);
            removed = true;
            break;
          }
        }
        if (e.type === 'shielder' && e.shieldHp > 0 && g.player) {
          const toEnemy = Math.atan2(e.y - g.player.y, e.x - g.player.x);
          const bulletAng = Math.atan2(b.vy, b.vx);
          const facing = Math.abs(VB.U.angleDiff(toEnemy, bulletAng));
          if (facing < 1.0) {
            // blocked by the energy shield
            e.shieldHp -= b.damage;
            e.shieldRegenT = 0;
            VB.FX.explosion(b.x, b.y, '#8fb7ff', 4, 80);
            VB.Audio.sfx('hit_shield');
            consumeBullet(b, bi);
            removed = true;
            break;
          }
        }

        let dmg = b.damage;
        // Marked Prey: elites & bosses take amplified damage
        if (g.upgrades.bountyHunter > 0 && (e.elite || e.type === 'boss')) {
          dmg = Math.max(1, Math.round(dmg * (1 + 0.15 * g.upgrades.bountyHunter)));
        }
        if (b.crit) {
          // v5.0 Deadeye Suite: crits scale past the base 2.5x
          dmg = Math.ceil(b.damage * (2.5 + 0.5 * (g.upgrades.deadEye || 0)));
          VB.FX.dmgNum(b.x, b.y - 14, 'CRIT -' + dmg, '#ffc857', true);
          VB.Audio.sfx('crit');
          VB.FX.shake(3, 0.1);
          // v4.2 Leech Protocol: critical hits recharge the shield
          if (g.upgrades.vampire > 0) {
            g.player.shieldEnergy = Math.min(100,
              g.player.shieldEnergy + 4 + 2 * g.upgrades.vampire);
            VB.FX.ring(b.x, b.y, '#6effc4', 18, 0.22);
          }
        } else {
          VB.FX.dmgNum(b.x, b.y - 10, '-' + dmg, e.color);
        }
        if (!b.hasHit) { g.hits++; b.hasHit = true; }
        // v5.2 AEGIS affix: the shield drinks the whole shot
        if (e.affixShield > 0) {
          e.affixShield--;
          e.affixShieldRegenT = 0;
          VB.FX.ring(b.x, b.y, '#8fb7ff', 26, 0.25);
          VB.FX.dmgNum(b.x, b.y - 16, 'ABSORB', '#8fb7ff', false);
          VB.Audio.sfx('hit_shield');
        } else {
          e.hp -= dmg;
        }
        VB.FX.explosion(b.x, b.y, e.color, 3, 60);
        VB.Audio.sfx('hit');
        // v4.0 Cryo Rounds: chilled on hit
        if (g.upgrades.cryo > 0 && e.type !== 'boss') e.slowT = 1.2;
        // v4.0 Executioner: finish wounded non-boss foes outright
        if (g.upgrades.execute > 0 && e.type !== 'boss' &&
            e.hp > 0 && e.hp <= e.maxHp * 0.12) {
          e.hp = 0;
          VB.FX.dmgNum(e.x, e.y - 16, 'EXECUTED', '#ff5470', true);
        }

        if (e.hp <= 0) {
          g.killEnemy(e, e.x, e.y, false);
          // Fusion Warheads: kills splash nearby enemies
          if (g.upgrades.explosive > 0) {
            const radius = 80 + g.upgrades.explosive * 15;
            const sdmg = 1 + g.upgrades.explosive;
            VB.FX.ring(e.x, e.y, '#ff8a3d', radius, 0.3);
            for (let si = VB.Enemies.list.length - 1; si >= 0; si--) {
              const se = VB.Enemies.list[si];
              if (se === e || !se.entered) continue;   // v5.3.1 spawn gate
              if (VB.U.dist(se.x, se.y, e.x, e.y) < radius) {
                se.hp -= sdmg;
                VB.FX.explosion(se.x, se.y, '#ff8a3d', 3, 60);
                if (se.hp <= 0) g.killEnemy(se, se.x, se.y, true);
              }
            }
          }
          if (g.enemiesList[ei] === e) { /* killEnemy already removed */ }
        }

        consumeBullet(b, bi);
        removed = true;
        break;
      }
      if (removed) continue;
    }

    // ---- enemy bullets vs player ----
    for (let i = enemyB.length - 1; i >= 0; i--) {
      const b = enemyB[i];
      const d = VB.U.dist(b.x, b.y, g.player.x, g.player.y);
      // v4.1 Aegis Bulwark: the active ship power vaporizes incoming shots
      if (g.player.bulwark && d < 78) {
        VB.FX.explosion(b.x, b.y, g.player.ship ? g.player.ship.color : '#8fb7ff', 4, 80);
        VB.Audio.sfx('hit_shield');
        enemyB.splice(i, 1);
        continue;
      }
      if (d < 16) {
        enemyB.splice(i, 1);
        if (g.player.shieldActive || g.timers.shield > 0) {
          VB.FX.explosion(b.x, b.y, '#58f6ff', 5, 80);
          VB.Audio.sfx('hit_shield');
          // v4.0 Aegis Reversal: blocked shots recharge the shield
          const rv = g.upgrades.reflect || 0;
          if (rv > 0) {
            g.player.shieldEnergy = Math.min(100, g.player.shieldEnergy + 1.5 + rv);
            VB.FX.ring(b.x, b.y, '#58f6ff', 22, 0.25);
          }
          // v5.3 AEGIS CITADEL: every block detonates a counter-nova
          if (g.upgrades.aegisCitadel) {
            const n = 10;
            for (let k = 0; k < n; k++) {
              const ang = (k / n) * Math.PI * 2;
              VB.Bullets.spawnPlayer(g.player.x, g.player.y, {
                vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
                size: 2.8, damage: 2 + g.upgrades.damage * 0.5,
                color: '#8fb7ff', pierceLeft: 0, crit: false
              });
            }
            VB.FX.ring(g.player.x, g.player.y, '#8fb7ff', 130, 0.4);
            VB.Audio.sfx('zap');
          }
        } else if (g.player.invincible <= 0) {
          g.damagePlayer();
          return; // stop processing after a player hit this frame
        }
      }
    }

    // ---- powerup pickup ----
    for (let i = VB.Powerups.list.length - 1; i >= 0; i--) {
      const p = VB.Powerups.list[i];
      if (VB.U.dist(p.x, p.y, g.player.x, g.player.y) < 26) {
        VB.Powerups.collect(p);
        VB.Powerups.list.splice(i, 1);
      }
    }

    // ---- enemies colliding with the player ----
    for (let i = g.enemiesList.length - 1; i >= 0; i--) {
      const e = g.enemiesList[i];
      if (e.ghost) continue;                 // v5.0: the phased hull cannot touch
      if (!e.entered) continue;              // v5.3.1: entering hulls cannot ram
      const hitR = e.type === 'boss' ? e.w * 0.65 : Math.max(e.w, e.h) * 0.5 + 10;
      const d = VB.U.dist(e.x, e.y, g.player.x, g.player.y);
      if (d >= hitR) continue;

      // dash-through damage
      if (g.player.dashDur > 0 && !g.player.dashHitSet.has(e)) {
        g.player.dashHitSet.add(e);
        // v5.3 WARP DRIVER: the fused phase engine quadruples dash impact
        const dashDmg = VB.CONFIG.PLAYER.DASH_CONTACT_DMG *
          (g.upgrades.warpDriver ? 4 : 1);
        e.hp -= dashDmg;
        VB.FX.explosion(e.x, e.y, '#ffc857', 8, 120);
        if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        continue;
      }

      // Static Aura: contact always burns the attacker
      if (g.upgrades.thorns > 0 && e.type !== 'boss') {
        e.hp -= 2 + 2 * g.upgrades.thorns;
        VB.FX.explosion(e.x, e.y, '#8fb7ff', 5, 90);
        if (e.hp <= 0) {
          g.killEnemy(e, e.x, e.y, true);
          continue;
        }
      }

      if (g.player.shieldActive || g.timers.shield > 0 || g.player.bulwark) {
        if (e.type !== 'boss') {
          e.hp -= 3;
          VB.FX.explosion(e.x, e.y, '#58f6ff', 10, 120);
          VB.Audio.sfx('hit_shield');
          if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        }
      } else if (g.player.invincible <= 0) {
        g.damagePlayer();
        if (e.type !== 'boss') {
          e.hp -= 2;
          if (e.hp <= 0) g.killEnemy(e, e.x, e.y, true);
        }
        return;
      }
    }
  }

  function consumeBullet(b, bi) {
    if (b.pierceLeft > 0) {
      b.pierceLeft--;
      if (b.pierceLeft <= 0) playerB.splice(bi, 1);
    } else {
      playerB.splice(bi, 1);
    }
  }

  /** v4.1: erase enemy shots within r of (x,y) — NOVA PULSE / tests. */
  function wipeEnemyBullets(x, y, r) {
    let n = 0;
    for (let i = enemyB.length - 1; i >= 0; i--) {
      const b = enemyB[i];
      if (VB.U.dist(b.x, b.y, x, y) < r) {
        VB.FX.explosion(b.x, b.y, b.color || '#8fb7ff', 3, 60);
        enemyB.splice(i, 1);
        n++;
      }
    }
    return n;
  }

  // --------------------------------------------------------- drawing ----
  // v3.0 HOLO-ARC: bullet / missile rendering lives in render.js
  function draw(ctx) {
    VB.Render.drawBullets(ctx, playerB, enemyB);
  }

  function drawMines(ctx) {
    VB.Render.drawMines(ctx, mines);
  }

    function clearEnemyBullets() {
    enemyB.length = 0;
    delayed.length = 0;
  }
  function clearAll() {
    playerB.length = 0; enemyB.length = 0;
    delayed.length = 0; mines.length = 0;
  }

  return {
    spawnPlayer, spawnEnemy, queueDelayed, spawnMine,
    update, collide, draw, drawMines,
    clearEnemyBullets, clearAll, wipeEnemyBullets, pullEnemyBullets,
    guardianSweep,
    get minesCount() { return mines.length; },
    get friendlyMines() { return mines.filter(function (m) { return m.friendly; }).length; },
    get enemyBulletCount() { return enemyB.length; },
    get playerBulletCount() { return playerB.length; }
  };
})();
