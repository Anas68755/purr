// ============================================================
// VOID BREAKER // NEON ASCENSION — render.js  (v3.0 HOLO-ARC)
// Entirely new from-scratch visual layer for every entity:
// player, 9 enemy classes, 6 boss archetypes, bullets, missiles,
// mines, power-ups and the score zone.
//
// Design language "HOLO-ARC":
//   - dark glass bodies with a colored energy tint
//   - triple-pass holographic strokes (soft / core / white hairline)
//   - animated sub-structures (rotating rings, orbiting pods,
//     undulating spines, world-space telegraphs)
//   - additive glow only where it reads (cores, thrusters)
// All game logic stays in the original modules — they delegate
// their draw() calls here.
// ============================================================
window.VB = window.VB || {};

VB.Render = (function () {
  const TAU = Math.PI * 2;
  const FONT = '"Chakra Petch","Orbitron",sans-serif';
  const CORE = '#040a12';           // near-black glass core
  const HAIR = 'rgba(235,250,255,0.5)';

  function reduced() { return !!(VB.FX && VB.FX.isReduced && VB.FX.isReduced()); }

  // ----------------------------------------------------- primitives ----
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow(ctx) { ctx.shadowBlur = 0; }

  /** signature holographic stroke over the current path */
  function holo(ctx, color, w) {
    w = w || 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = VB.U.hexA(color, 0.28); ctx.lineWidth = w + 3.5; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    if (!reduced()) {
      ctx.strokeStyle = HAIR; ctx.lineWidth = Math.max(0.7, w * 0.32); ctx.stroke();
    }
  }

  /** dark glass body fill over the current path + colored tint */
  function glass(ctx, color, tintA, baseA) {
    ctx.fillStyle = 'rgba(7,14,24,' + (baseA !== undefined ? baseA : 0.85) + ')';
    ctx.fill();
    ctx.fillStyle = VB.U.hexA(color, tintA !== undefined ? tintA : 0.16);
    ctx.fill();
  }

  /** soft radial under-glow that seats a big entity */
  function underGlow(ctx, r, color, a) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, VB.U.hexA(color, a));
    g.addColorStop(1, VB.U.hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** pulsing reactor core shared by all bosses */
  function bossCore(ctx, e, col) {
    const es = 6 + Math.sin(e.time * 8) * 2.5;
    glow(ctx, col, 18);
    ctx.fillStyle = CORE;
    ctx.beginPath(); ctx.arc(0, 0, es + 5, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, es), 0, TAU); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-es * 0.3, -es * 0.3, Math.max(1, es * 0.28), 0, TAU); ctx.fill();
  }

  /** thin hologram scan line sweeping a body of half-height hh */
  function scanLine(ctx, hw, hh, t, seed) {
    if (reduced()) return;
    const y = -hh + ((t * 26 + (seed || 0) * 61) % (hh * 2));
    ctx.fillStyle = 'rgba(200,245,255,0.10)';
    ctx.fillRect(-hw, y, hw * 2, 1.6);
  }

  // ====================================================== PLAYER =======
  function drawPlayer(ctx, p) {
    if (!p) return;
    const g = VB.Game;
    const dashing = p.dashDur > 0;
    const od = p._od > 0;

    // banking tilt from horizontal motion
    const vx = p.x - (p._rx !== undefined ? p._rx : p.x);
    p._rx = p.x;
    p._tilt = VB.U.lerp(p._tilt || 0, VB.U.clamp(vx * 0.06, -0.4, 0.4), 0.18);

    const shipCol = p.ship ? p.ship.color : '#7deaff';
    const edge = dashing ? '#eafcff' : shipCol;
    const thrust = dashing ? '#ffffff' : od ? '#ff5470' : (p.ship ? p.ship.glow : '#ffc857');

    // -- engine trail (additive plume) --
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const tr of p.trail) {
      const a = tr.life / tr.maxLife;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = dashing ? '#ffffff' : thrust;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, Math.max(0.6, 4.5 * a), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // -- dash afterimages --
    if (dashing && !reduced()) {
      for (let k = 1; k <= 2; k++) {
        ctx.save();
        ctx.translate(p.x - p.dashDirX * k * 12, p.y - p.dashDirY * k * 12);
        ctx.rotate(p._tilt);
        ctx.globalAlpha = 0.26 / k;
        shipHull(ctx, p, edge, true);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // -- engine plumes --
    if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) ctx.globalAlpha = 0.35;
    const fl = 9 + Math.sin(p.time * 42) * 3 + (dashing ? 9 : 0) + (od ? 4 : 0);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(p.x + side * 4.5, p.y + p.h * 0.36);
      const fg = ctx.createLinearGradient(0, 0, 0, fl + 6);
      fg.addColorStop(0, VB.U.hexA(thrust, 0.9));
      fg.addColorStop(1, VB.U.hexA(thrust, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(0, fl + 6);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // -- hull --
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p._tilt);
    glow(ctx, edge, dashing ? 26 : 16);
    shipHull(ctx, p, edge, false);
    noGlow(ctx);

    // spine + wing lights
    ctx.strokeStyle = VB.U.hexA('#58f6ff', 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -p.h * 0.5); ctx.lineTo(0, p.h * 0.3);
    ctx.stroke();
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(p.time * 3.4));
    for (const side of [-1, 1]) {
      ctx.fillStyle = VB.U.hexA('#ffc857', blink);
      ctx.beginPath();
      ctx.arc(side * p.w * 0.42, p.h * 0.08, 1.6, 0, TAU);
      ctx.fill();
    }
    // cockpit
    glow(ctx, '#ffffff', 8);
    ctx.fillStyle = '#eafcff';
    ctx.beginPath(); ctx.arc(0, -p.h * 0.16, 2.6, 0, TAU); ctx.fill();
    noGlow(ctx);
    ctx.restore();
    ctx.globalAlpha = 1;

    // -- orbital drones --
    if (p.drones.length) {
      ctx.save();
      ctx.strokeStyle = VB.U.hexA('#58f6ff', 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 46, 0, TAU); ctx.stroke();
      ctx.restore();
      for (const d of p.drones) {
        const dx = p.x + Math.cos(d.angle) * 46;
        const dy = p.y + Math.sin(d.angle) * 46;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(p.time * 4 + d.angle);
        glow(ctx, '#58f6ff', 9);
        ctx.strokeStyle = '#58f6ff'; ctx.lineWidth = 1.4;
        rrect(ctx, -4, -4, 8, 8, 2); ctx.stroke();
        ctx.fillStyle = VB.U.hexA('#58f6ff', 0.35); ctx.fill();
        noGlow(ctx);
        ctx.fillStyle = '#eafcff';
        ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    // -- orbital buzz saws (v4.0 Buzz Saws upgrade) --
    if (p.saws && p.saws.length) {
      const R = 34;
      ctx.save();
      ctx.strokeStyle = VB.U.hexA('#ff9a54', 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
      ctx.restore();
      for (const sw of p.saws) {
        const sx = p.x + Math.cos(sw.ang) * R;
        const sy = p.y + Math.sin(sw.ang) * R;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.time * 14 + sw.ang);
        // v5.3 NANO SWARM: the fused swarm grows every blade
        const sBoost = VB.Game.upgrades && VB.Game.upgrades.nanoSwarm ? 1.35 : 1;
        // saw blade: toothed ring
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * TAU;
          const rr = (k % 2 === 0 ? 8 : 5.5) * sBoost;
          const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        glass(ctx, '#ff9a54', 0.4, 0.7);
        glow(ctx, '#ff9a54', 10);
        holo(ctx, '#ff9a54', 1.5);
        noGlow(ctx);
        ctx.fillStyle = CORE;
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    // -- shield bubble (hexagonal; AEGIS BULWARK shows a wider hull-tinted dome) --
    const shieldOn = p.shieldActive || g.timers.shield > 0 || p.bulwark;
    if (shieldOn) {
      const bul = !!p.bulwark;
      const scol = bul && p.ship ? p.ship.color : '#58f6ff';
      const r = (bul ? 38 : 27) + Math.sin(p.time * 6) * 1.5;
      const a = bul ? 0.6 : g.timers.shield > 0 ? 0.55 : 0.4;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.time * (bul ? 1.2 : 0.7));
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU;
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      poly(ctx, pts);
      ctx.fillStyle = VB.U.hexA(scol, bul ? 0.09 : 0.06); ctx.fill();
      glow(ctx, scol, bul ? 18 : 12);
      ctx.strokeStyle = VB.U.hexA(scol, a);
      ctx.lineWidth = bul ? 2 : 1.6;
      ctx.stroke();
      noGlow(ctx);
      if (bul) {
        // extra containment ring while the bulwark is up
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = VB.U.hexA(scol, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // -- dash cooldown indicator --
    if (p.dashCd > 0 && p.dashDur <= 0) {
      const ratio = 1 - p.dashCd / p.dashCdMax;
      ctx.strokeStyle = VB.U.hexA('#ffc857', 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 2, 21, -Math.PI / 2, -Math.PI / 2 + ratio * TAU);
      ctx.stroke();
    }

    // -- v4.1 FLEET: signature power status --
    if (p.ship) {
      const sc = p.ship.color;
      if (p.powerT > 0) {
        // active: rotating dashed halo in the hull color
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.time * 1.6);
        ctx.setLineDash([7, 9]);
        ctx.strokeStyle = VB.U.hexA(sc, 0.45 + 0.25 * Math.sin(p.time * 9));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 31 + Math.sin(p.time * 7) * 2, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (p.powerCd > 0) {
        // recharging: cooldown sweep just under the ship
        const ratio = 1 - p.powerCd / (p.powerCdMax || 1);
        ctx.strokeStyle = VB.U.hexA(sc, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 2, 25, -Math.PI / 2, -Math.PI / 2 + ratio * TAU);
        ctx.stroke();
      }
    }
  }

  // ---- v4.1 FLEET: per-hull silhouettes (path builders; caller fills/strokes) ----
  const HULLS = {
    vanguard(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.5], [w * 0.18, -h * 0.18], [w * 0.5, h * 0.12], [w * 0.32, h * 0.34],
        [w * 0.11, h * 0.2], [0, h * 0.32], [-w * 0.11, h * 0.2], [-w * 0.32, h * 0.34],
        [-w * 0.5, h * 0.12], [-w * 0.18, -h * 0.18]
      ]);
    },
    razor(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.62], [w * 0.1, -h * 0.24], [w * 0.28, h * 0.06], [w * 0.16, h * 0.4],
        [0, h * 0.26], [-w * 0.16, h * 0.4], [-w * 0.28, h * 0.06], [-w * 0.1, -h * 0.24]
      ]);
    },
    bastion(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.44], [w * 0.3, -h * 0.12], [w * 0.52, h * 0.02], [w * 0.48, h * 0.36],
        [w * 0.22, h * 0.3], [w * 0.13, h * 0.44], [0, h * 0.3],
        [-w * 0.13, h * 0.44], [-w * 0.22, h * 0.3], [-w * 0.48, h * 0.36],
        [-w * 0.52, h * 0.02], [-w * 0.3, -h * 0.12]
      ]);
    },
    nova(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.52], [w * 0.3, -h * 0.3], [w * 0.46, 0], [w * 0.3, h * 0.3],
        [w * 0.34, h * 0.46], [0, h * 0.36], [-w * 0.34, h * 0.46], [-w * 0.3, h * 0.3],
        [-w * 0.46, 0], [-w * 0.3, -h * 0.3]
      ]);
    },
    wraith(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.56], [w * 0.14, -h * 0.12], [w * 0.54, h * 0.3], [w * 0.28, h * 0.24],
        [w * 0.12, h * 0.4], [0, h * 0.26], [-w * 0.12, h * 0.4], [-w * 0.28, h * 0.24],
        [-w * 0.54, h * 0.3], [-w * 0.14, -h * 0.12]
      ]);
    },
    chronos(ctx, w, h) {
      poly(ctx, [
        [0, -h * 0.56], [w * 0.24, -h * 0.22], [w * 0.36, h * 0.06], [w * 0.24, h * 0.42],
        [0, h * 0.3], [-w * 0.24, h * 0.42], [-w * 0.36, h * 0.06], [-w * 0.24, -h * 0.22]
      ]);
    },
    // ---- v4.2 TITAN hulls ----
    volt(ctx, w, h) {
      // twin-prong storm dagger
      poly(ctx, [
        [0, -h * 0.6], [w * 0.12, -h * 0.3], [w * 0.5, -h * 0.05], [w * 0.2, h * 0.1],
        [w * 0.3, h * 0.44], [0, h * 0.22], [-w * 0.3, h * 0.44], [-w * 0.2, h * 0.1],
        [-w * 0.5, -h * 0.05], [-w * 0.12, -h * 0.3]
      ]);
    },
    magnus(ctx, w, h) {
      // heavy ring-hauler with a wide gravity shroud
      poly(ctx, [
        [0, -h * 0.46], [w * 0.34, -h * 0.26], [w * 0.42, h * 0.06], [w * 0.26, h * 0.4],
        [0, h * 0.5], [-w * 0.26, h * 0.4], [-w * 0.42, h * 0.06], [-w * 0.34, -h * 0.26]
      ]);
    },
    aurora(ctx, w, h) {
      // graceful swept-wing lifeweaver
      poly(ctx, [
        [0, -h * 0.5], [w * 0.16, -h * 0.2], [w * 0.52, h * 0.16], [w * 0.2, h * 0.1],
        [w * 0.12, h * 0.38], [0, h * 0.24], [-w * 0.12, h * 0.38], [-w * 0.2, h * 0.1],
        [-w * 0.52, h * 0.16], [-w * 0.16, -h * 0.2]
      ]);
    },
    eclipse(ctx, w, h) {
      // needle rail platform: long thin spikes flanking a slim spine
      poly(ctx, [
        [0, -h * 0.66], [w * 0.1, -h * 0.3], [w * 0.42, h * 0.02], [w * 0.16, h * 0.08],
        [w * 0.1, h * 0.34], [0, h * 0.5], [-w * 0.1, h * 0.34], [-w * 0.16, h * 0.08],
        [-w * 0.42, h * 0.02], [-w * 0.1, -h * 0.3]
      ]);
    },
    // ---- v5.0 ABYSS hulls ----
    forge(ctx, w, h) {
      // blocky fabrication chassis with wide tool wings
      poly(ctx, [
        [0, -h * 0.5], [w * 0.22, -h * 0.34], [w * 0.52, -h * 0.1], [w * 0.52, h * 0.2],
        [w * 0.24, h * 0.16], [w * 0.16, h * 0.44], [0, h * 0.3],
        [-w * 0.16, h * 0.44], [-w * 0.24, h * 0.16], [-w * 0.52, h * 0.2],
        [-w * 0.52, -h * 0.1], [-w * 0.22, -h * 0.34]
      ]);
    },
    halcyon(ctx, w, h) {
      // broad-winged bomber with a deep payload bay
      poly(ctx, [
        [0, -h * 0.44], [w * 0.16, -h * 0.26], [w * 0.6, h * 0.08], [w * 0.4, h * 0.3],
        [w * 0.14, h * 0.22], [0, h * 0.52], [-w * 0.14, h * 0.22],
        [-w * 0.4, h * 0.3], [-w * 0.6, h * 0.08], [-w * 0.16, -h * 0.26]
      ]);
    },
    // ---- v5.3 HORIZON: the classified 13th hull ----
    omega(ctx, w, h) {
      // radial rewrite engine: four prongs around a piercing core
      poly(ctx, [
        [0, -h * 0.55], [w * 0.18, -h * 0.18], [w * 0.55, 0], [w * 0.18, h * 0.18],
        [w * 0.34, h * 0.44], [0, h * 0.28], [-w * 0.34, h * 0.44], [-w * 0.18, h * 0.18],
        [-w * 0.55, 0], [-w * 0.18, -h * 0.18]
      ]);
    }
  };

  /** player hull path + fill + stroke (called inside a translated/rotated ctx) */
  function shipHull(ctx, p, edge, ghost) {
    const w = p.w, h = p.h;
    const fn = HULLS[p.ship ? p.ship.id : 'vanguard'] || HULLS.vanguard;
    fn(ctx, w, h);
    if (ghost) {
      ctx.strokeStyle = VB.U.hexA(edge, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
      return;
    }
    glass(ctx, edge, 0.14, 0.88);
    holo(ctx, edge, 2);
  }

  /** v4.1: static hull preview for the hangar cards */
  function previewHull(ctx, id, size, color) {
    const fn = HULLS[id] || HULLS.vanguard;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2 + 2);
    glow(ctx, color, 8);
    fn(ctx, size * 0.56, size * 0.68);
    glass(ctx, color, 0.2, 0.8);
    holo(ctx, color, 1.4);
    noGlow(ctx);
    ctx.restore();
  }

  // ===================================================== ENEMIES =======
  function drawEnemies(ctx, list) {
    const g = VB.Game;
    const t = g.time;
    for (const e of list) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.type === 'boss') { drawBoss(ctx, e, t); ctx.restore(); continue; }
      drawSmall(ctx, e, t, g);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawSmall(ctx, e, t, g) {
    const w = e.w, h = e.h, col = e.color;

    // idle hologram sway
    ctx.save();
    ctx.rotate(Math.sin(e.time * 2.1 + e.x * 0.05) * 0.09);

    switch (e.type) {
      case 'grunt': {
        poly(ctx, [
          [0, -h * 0.55], [w * 0.5, -h * 0.08], [w * 0.3, h * 0.5],
          [0, h * 0.22], [-w * 0.3, h * 0.5], [-w * 0.5, -h * 0.08]
        ]);
        glass(ctx, col, 0.2);
        holo(ctx, col, 1.8);
        // fang slits
        ctx.strokeStyle = VB.U.hexA(col, 0.8); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w * 0.16, -h * 0.05); ctx.lineTo(-w * 0.02, h * 0.12);
        ctx.moveTo(w * 0.16, -h * 0.05); ctx.lineTo(w * 0.02, h * 0.12);
        ctx.stroke();
        break;
      }
      case 'zigzag': {
        poly(ctx, [
          [-w * 0.45, -h * 0.5], [w * 0.48, -h * 0.12], [w * 0.12, h * 0.05],
          [w * 0.45, h * 0.5], [-w * 0.48, h * 0.12], [-w * 0.12, -h * 0.05]
        ]);
        glass(ctx, col, 0.2);
        holo(ctx, col, 1.8);
        break;
      }
      case 'homing': {
        const r = w * 0.42;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
        glass(ctx, col, 0.2);
        holo(ctx, col, 1.8);
        // mandibles
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, r * 0.45); ctx.lineTo(-r * 1.15, r * 0.95);
        ctx.moveTo(r * 0.55, r * 0.45); ctx.lineTo(r * 1.15, r * 0.95);
        ctx.stroke();
        // dorsal fin
        poly(ctx, [[-r * 0.42, -r * 0.72], [0, -r * 1.6], [r * 0.42, -r * 0.72]]);
        ctx.fillStyle = VB.U.hexA(col, 0.5); ctx.fill();
        break;
      }
      case 'splitter': {
        ctx.beginPath();
        ctx.moveTo(w * 0.62, -h * 0.12); ctx.arc(w * 0.28, -h * 0.12, w * 0.34, 0, TAU);
        ctx.moveTo(w * 0.62 + 0.01, -h * 0.12); ctx.arc(-w * 0.28, -h * 0.12, w * 0.34, 0, TAU);
        ctx.moveTo(w * 0.3, h * 0.3); ctx.arc(0, h * 0.3, w * 0.3, 0, TAU);
        glass(ctx, col, 0.16, 0.8);
        holo(ctx, col, 1.7);
        ctx.fillStyle = CORE;
        for (const [nx, ny] of [[w * 0.28, -h * 0.12], [-w * 0.28, -h * 0.12], [0, h * 0.3]]) {
          ctx.beginPath(); ctx.arc(nx, ny, 2.4, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'flanker': {
        const s = e.sideDir || 1;
        ctx.scale(s, 1);
        poly(ctx, [
          [w * 0.62, 0], [-w * 0.2, -h * 0.52], [-w * 0.06, 0], [-w * 0.2, h * 0.52]
        ]);
        glass(ctx, col, 0.2);
        holo(ctx, col, 1.8);
        // canopy slit
        ctx.strokeStyle = HAIR; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w * 0.3, -h * 0.05); ctx.lineTo(-w * 0.05, -h * 0.02);
        ctx.stroke();
        break;
      }
      case 'tank': {
        // turret barrel first (under the hull)
        if (g.player) {
          const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x) - ctx.getTransform().a * 0; // world angle
          ctx.save();
          ctx.rotate(ang - Math.sin(e.time * 2.1 + e.x * 0.05) * 0.09); // cancel sway
          ctx.strokeStyle = VB.U.hexA(col, 0.85); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.85, 0); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(w * 0.85, 0, 1.6, 0, TAU); ctx.fill();
          ctx.restore();
        }
        poly(ctx, [
          [0, -h * 0.55], [w * 0.5, -h * 0.28], [w * 0.44, h * 0.4],
          [0, h * 0.55], [-w * 0.44, h * 0.4], [-w * 0.5, -h * 0.28]
        ]);
        glass(ctx, col, 0.18, 0.9);
        holo(ctx, col, 2.2);
        // plating
        ctx.strokeStyle = VB.U.hexA(col, 0.35); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, -h * 0.16); ctx.lineTo(w * 0.3, -h * 0.16);
        ctx.moveTo(-w * 0.26, h * 0.12); ctx.lineTo(w * 0.26, h * 0.12);
        ctx.stroke();
        // rivets
        ctx.fillStyle = VB.U.hexA('#ffffff', 0.4);
        for (const [rx, ry] of [[-w * 0.34, -h * 0.26], [w * 0.34, -h * 0.26], [0, h * 0.4]]) {
          ctx.beginPath(); ctx.arc(rx, ry, 1.1, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'shielder': {
        const r = w * 0.45;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
        glass(ctx, col, 0.16);
        holo(ctx, col, 1.8);
        ctx.strokeStyle = VB.U.hexA(col, 0.4); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.stroke();
        // two orbiting nodes
        for (const o of [0, Math.PI]) {
          const oa = e.time * 2.6 + o;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(Math.cos(oa) * r * 1.25, Math.sin(oa) * r * 1.25, 1.8, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'bomber': {
        poly(ctx, [
          [0, -h * 0.35], [w * 0.55, -h * 0.08], [w * 0.36, h * 0.2],
          [0, h * 0.32], [-w * 0.36, h * 0.2], [-w * 0.55, -h * 0.08]
        ]);
        glass(ctx, col, 0.18);
        holo(ctx, col, 1.8);
        // bomb pod
        ctx.beginPath(); ctx.arc(0, h * 0.1, 5, 0, TAU);
        ctx.fillStyle = CORE; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
        // payload blink
        if (Math.sin(e.time * 9) > 0.2) {
          glow(ctx, '#ff5470', 6);
          ctx.fillStyle = '#ff5470';
          ctx.beginPath(); ctx.arc(0, h * 0.1, 1.8, 0, TAU); ctx.fill();
          noGlow(ctx);
        }
        break;
      }
      case 'sniper': {
        poly(ctx, [
          [-w * 0.32, -h * 0.5], [w * 0.32, -h * 0.5],
          [w * 0.22, h * 0.26], [0, h * 0.5], [-w * 0.22, h * 0.26]
        ]);
        glass(ctx, col, 0.18);
        holo(ctx, col, 1.7);
        // long rail barrel
        ctx.fillStyle = VB.U.hexA(col, 0.85);
        ctx.fillRect(-1.6, -h * 0.95, 3.2, h * 0.45);
        // scope
        glow(ctx, col, 8);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -h * 0.22, 2.2, 0, TAU); ctx.fill();
        noGlow(ctx);
        break;
      }
      case 'weaver': {
        // v4.2: faceted blink-dart with a flash while rematerializing
        const flash = e.blinkFlash > 0;
        poly(ctx, [
          [0, -h * 0.58], [w * 0.3, -h * 0.1], [w * 0.5, h * 0.34], [0, h * 0.14],
          [-w * 0.5, h * 0.34], [-w * 0.3, -h * 0.1]
        ]);
        glass(ctx, col, flash ? 0.5 : 0.2, flash ? 0.6 : 0.85);
        holo(ctx, col, flash ? 2.6 : 1.8);
        if (flash && !reduced()) {
          glow(ctx, col, 14);
          ctx.strokeStyle = VB.U.hexA('#ffffff', 0.7); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, w * 0.7, 0, TAU); ctx.stroke();
          noGlow(ctx);
        }
        break;
      }
      case 'warden': {
        // v4.2: tri-hex medic with a rotating mend aura
        poly(ctx, [
          [0, -h * 0.55], [w * 0.48, -h * 0.26], [w * 0.48, h * 0.26],
          [0, h * 0.55], [-w * 0.48, h * 0.26], [-w * 0.48, -h * 0.26]
        ]);
        glass(ctx, col, 0.18, 0.9);
        holo(ctx, col, 2);
        ctx.save();
        ctx.rotate(e.time * 1.5);
        ctx.setLineDash([6, 7]);
        ctx.strokeStyle = VB.U.hexA(col, 0.5);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, w * 0.72, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // three mend nodes
        for (let k = 0; k < 3; k++) {
          const na = e.time * 2 + (k / 3) * TAU;
          glow(ctx, col, 6);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(Math.cos(na) * w * 0.72, Math.sin(na) * w * 0.72, 2, 0, TAU);
          ctx.fill();
          noGlow(ctx);
        }
        break;
      }
      case 'phantom': {
        // v5.0: slit-wing phase ghost — flickers while intangible
        const gh = e.ghost;
        if (gh) ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t * 14);
        poly(ctx, [
          [0, -h * 0.5], [w * 0.14, -h * 0.1], [w * 0.55, h * 0.2], [w * 0.2, h * 0.1],
          [0, h * 0.5], [-w * 0.2, h * 0.1], [-w * 0.55, h * 0.2], [-w * 0.14, -h * 0.1]
        ]);
        glass(ctx, col, 0.2, 0.85);
        holo(ctx, col, 1.8);
        if (gh && !reduced()) {
          glow(ctx, col, 12);
          ctx.strokeStyle = VB.U.hexA(col, 0.5);
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, w * 0.85, 0, TAU); ctx.stroke();
          noGlow(ctx);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'zenith': {
        // v5.0: bent dive dart with a dashed launch telegraph
        poly(ctx, [
          [0, -h * 0.62], [w * 0.16, -h * 0.1], [w * 0.5, h * 0.3], [w * 0.1, h * 0.14],
          [0, h * 0.5], [-w * 0.1, h * 0.14], [-w * 0.5, h * 0.3], [-w * 0.16, -h * 0.1]
        ]);
        glass(ctx, col, 0.2, 0.85);
        holo(ctx, col, 1.8);
        if (e.state === 'aim' && !reduced()) {
          glow(ctx, '#ff3d81', 9);
          ctx.strokeStyle = VB.U.hexA('#ff3d81', 0.45 + 0.3 * Math.sin(t * 20));
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 6]);
          const dx = e.locked ? e.diveVX : 0;
          const dy = e.locked ? e.diveVY : 220;
          const n = Math.hypot(dx, dy) || 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(dx / n * 260, dy / n * 260);
          ctx.stroke();
          ctx.setLineDash([]);
          noGlow(ctx);
        }
        break;
      }
      default: { // fallback: diamond
        poly(ctx, [[0, -h * 0.5], [w * 0.5, 0], [0, h * 0.5], [-w * 0.5, 0]]);
        glass(ctx, col, 0.2);
        holo(ctx, col, 1.8);
      }
    }

    // dark core dot
    if (e.type !== 'splitter') {
      ctx.fillStyle = CORE;
      const ir = e.type === 'tank' ? 4.5 : 2.6;
      ctx.beginPath(); ctx.arc(0, 0, ir, 0, TAU); ctx.fill();
    }
    ctx.restore(); // end sway

    // shielder frontal arc (facing the player, unrotated)
    if (e.type === 'shielder' && g.player) {
      const face = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      const ratio = VB.U.clamp(e.shieldHp / e.shieldMax, 0, 1);
      glow(ctx, '#8fb7ff', 8);
      ctx.strokeStyle = VB.U.hexA('#8fb7ff', 0.22 + 0.6 * ratio);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.8, face - 1.0, face + 1.0);
      ctx.stroke();
      noGlow(ctx);
    }

    // sniper laser sight while charging
    if (e.type === 'sniper' && e.chargeT > 0) {
      const a = Math.min(0.75, (e.chargeT / 1.1) * 0.75);
      const lx = Math.cos(e.lockedAngle), ly = Math.sin(e.lockedAngle);
      ctx.strokeStyle = VB.U.hexA('#ffe08a', a * 0.4);
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lx * 2000, ly * 2000); ctx.stroke();
      ctx.strokeStyle = VB.U.hexA('#ffe08a', a);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lx * 2000, ly * 2000); ctx.stroke();
      glow(ctx, '#ffe08a', 10);
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(0, 0, 2 + e.chargeT * 4, 0, TAU); ctx.fill();
      noGlow(ctx);
    }

    // v4.2 stun ticks: crackling EMP arcs over helpless foes
    if (e.stunT > 0 && !reduced()) {
      const sa = Math.min(1, e.stunT * 1.6);
      ctx.strokeStyle = VB.U.hexA('#ffe86b', sa * (0.5 + 0.4 * Math.sin(t * 22)));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ba = (k / 3) * TAU + t * 5;
        ctx.moveTo(Math.cos(ba) * w * 0.4, Math.sin(ba) * h * 0.4);
        ctx.lineTo(Math.cos(ba) * w * 0.78, Math.sin(ba) * h * 0.78);
      }
      ctx.stroke();
    }

    // elite brackets (v5.2: colored by the elite's affix)
    if (e.elite) {
      const r = Math.max(w, h) * 0.75 + 5;
      const blink = 0.45 + 0.3 * Math.sin(e.time * 6);
      const acol = (e.affix && VB.CONFIG.ELITE.AFFIXES[e.affix]) ?
        VB.CONFIG.ELITE.AFFIXES[e.affix].color : '#ffc857';
      glow(ctx, acol, 10);
      ctx.strokeStyle = VB.U.hexA(acol, blink);
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a0 = e.time * 1.8 + k * (TAU / 3);
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a0 + 1.15);
        ctx.stroke();
      }
      noGlow(ctx);
      // affix sigil above the hull
      if (e.affix) {
        const letter = e.affix === 'shielded' ? 'A' : e.affix === 'volatile' ? 'V' : 'S';
        ctx.fillStyle = VB.U.hexA(acol, 0.85);
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[' + letter + ']', 0, -h / 2 - 14);
      }
    }

    // hp bar for tanky units (straight, unrotated)
    if (e.type === 'tank' || e.type === 'splitter' || e.type === 'shielder' ||
        e.type === 'warden' || e.elite) {
      const hpR = Math.max(0, e.hp / e.maxHp);
      const bw = Math.max(18, w);
      ctx.fillStyle = 'rgba(223,233,245,0.14)';
      ctx.fillRect(-bw / 2, -h / 2 - 10, bw, 2.5);
      ctx.fillStyle = col;
      ctx.fillRect(-bw / 2, -h / 2 - 10, bw * hpR, 2.5);
    }
  }

  // ======================================================= BOSSES ======
  function drawBoss(ctx, e, t) {
    const col = e.enraged ? e.enragedColor : e.color;

    // ---- world-space telegraphs (drawn before local body) ----
    if (e.archetype === 'TEMPEST' && e.columns && e.colT > 0) {
      const prog = 1 - e.colT / 0.85;
      ctx.save();
      ctx.translate(-e.x, -e.y);
      const H = VB.Game.H;
      for (const cx of e.columns) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, VB.U.hexA('#58a6ff', 0.10 + prog * 0.22));
        grad.addColorStop(1, VB.U.hexA('#58a6ff', 0.02));
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 12, 0, 24, H);
        ctx.strokeStyle = VB.U.hexA('#58a6ff', 0.35 + prog * 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
      }
      ctx.restore();
    }
    if (e.archetype === 'MONOLITH' && e.sweepT > 0) {
      ctx.save();
      ctx.translate(-e.x, -e.y);
      drawBeam(ctx, e.x, e.y, e.sweepAngle, '#8fb7ff', 0.4);
      if (e.enraged) drawBeam(ctx, e.x, e.y, Math.PI - e.sweepAngle, '#ffb35c', 0.32);
      ctx.restore();
    }
    // v4.0 VORTEX: event-horizon implosion telegraph (world-space)
    if (e.archetype === 'VORTEX' && e.implodeT > 0) {
      const prog = 1 - e.implodeT / 0.85;
      ctx.save();
      ctx.translate(-e.x, -e.y);
      const r0 = 250 * (1 - prog * 0.55);
      ctx.strokeStyle = VB.U.hexA('#58ffd1', 0.25 + prog * 0.5);
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.arc(e.implodeX, e.implodeY, r0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(e.implodeX, e.implodeY, r0 * (0.4 + prog * 0.3), 0, TAU);
      ctx.strokeStyle = VB.U.hexA('#58ffd1', 0.15 + prog * 0.3);
      ctx.stroke();
      // inward tick marks
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU + prog * 2.2;
        const r1 = r0, r2 = r0 - 12 - prog * 10;
        ctx.beginPath();
        ctx.moveTo(e.implodeX + Math.cos(ang) * r1, e.implodeY + Math.sin(ang) * r1);
        ctx.lineTo(e.implodeX + Math.cos(ang) * r2, e.implodeY + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // v4.2 LEVIATHAN maw-pull telegraph (world-space)
    if (e.archetype === 'LEVIATHAN' && e.pullT > 0) {
      const prog = 1 - e.pullT / 1.15;
      ctx.save();
      ctx.translate(-e.x, -e.y);
      ctx.strokeStyle = VB.U.hexA('#5cff9d', 0.25 + prog * 0.55);
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(0, 0, 150 + (1 - prog) * 90, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // inward tick marks being swallowed
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * TAU + prog * 3;
        const r1 = 240 - prog * 60, r2 = r1 - 16 - prog * 14;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // v5.0 CERBERUS slam columns telegraph (world-space)
    if (e.archetype === 'CERBERUS' && e.columns && e.colT > 0) {
      const prog = 1 - e.colT / 0.9;
      ctx.save();
      ctx.translate(-e.x, -e.y);
      const H2 = VB.Game.H;
      for (const cx of e.columns) {
        const grad = ctx.createLinearGradient(0, 0, 0, H2);
        grad.addColorStop(0, VB.U.hexA('#ff4f6e', 0.10 + prog * 0.22));
        grad.addColorStop(1, VB.U.hexA('#ff4f6e', 0.02));
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 13, 0, 26, H2);
        ctx.strokeStyle = VB.U.hexA('#ff4f6e', 0.35 + prog * 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H2); ctx.stroke();
      }
      ctx.restore();
    }

    // seat glow + scan shimmer
    underGlow(ctx, e.w * 1.5, col, e.enraged ? 0.14 : 0.10);
    if (!reduced()) scanLine(ctx, e.w * 1.05, e.h * 0.75, t, e.archetype.length);

    switch (e.archetype) {
      case 'SERAPH':   drawSeraph(ctx, e, t, col);   break;
      case 'HYDRA':    drawHydra(ctx, e, t, col);    break;
      case 'TEMPEST':  drawTempest(ctx, e, t, col);  break;
      case 'MONOLITH': drawMonolith(ctx, e, t, col); break;
      case 'ARCHON':   drawArchon(ctx, e, t, col);   break;
      case 'VORTEX':   drawVortex(ctx, e, t, col);   break;
      case 'GORGON':   drawGorgon(ctx, e, t, col);   break;
      case 'LEVIATHAN': drawLeviathan(ctx, e, t, col); break;
      case 'MIRAGE':   drawMirage(ctx, e, t, col);   break;
      case 'OUROBOROS': drawOuroboros(ctx, e, t, col); break;
      case 'CERBERUS':  drawCerberus(ctx, e, t, col);  break;
      default:         drawDreadnought(ctx, e, t, col);
    }

    // shared reactor core on top
    bossCore(ctx, e, col);

    // MONOLITH fortify arc
    if (e.archetype === 'MONOLITH' && e.fortifyT > 0) {
      ctx.strokeStyle = 'rgba(240,250,255,' + (0.35 + 0.3 * Math.sin(e.time * 10)) + ')';
      glow(ctx, '#8fb7ff', 16);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, e.w * 1.08, Math.PI * 0.22, Math.PI * 0.78);
      ctx.stroke();
      // rotating braces
      ctx.save();
      ctx.rotate(e.time * 3);
      ctx.lineWidth = 2;
      for (const a0 of [Math.PI * 0.3, Math.PI * 0.5, Math.PI * 0.7]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * e.w * 0.9, Math.sin(a0) * e.w * 0.9);
        ctx.lineTo(Math.cos(a0) * e.w * 1.22, Math.sin(a0) * e.w * 1.22);
        ctx.stroke();
      }
      ctx.restore();
      noGlow(ctx);
    }
    noGlow(ctx);
  }

  function drawBeam(ctx, x, y, ang, color, a) {
    const ex = x + Math.cos(ang) * 1600, ey = y + Math.sin(ang) * 1600;
    ctx.strokeStyle = VB.U.hexA(color, a * 0.45);
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = VB.U.hexA(color, a);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  }

  // ---- DREADNOUGHT: gear ring of cannon pods around a hexagonal hull ----
  function drawDreadnought(ctx, e, t, col) {
    const w = e.w;
    // rotating gear ring + pods
    ctx.save();
    ctx.rotate(t * (e.enraged ? 0.9 : 0.5));
    ctx.setLineDash([12, 9]);
    ctx.strokeStyle = VB.U.hexA(col, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.95, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * TAU;
      ctx.save();
      ctx.rotate(ang);
      ctx.translate(w * 1.12, 0);
      poly(ctx, [[-5, -6], [6, -3.5], [6, 3.5], [-5, 6]]);
      glass(ctx, col, 0.25, 0.75);
      holo(ctx, col, 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(2.5, 0, 1.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // main hex hull
    const hex = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * TAU - Math.PI / 2;
      hex.push([Math.cos(ang) * w * 0.72, Math.sin(ang) * w * 0.72]);
    }
    poly(ctx, hex);
    glass(ctx, col, 0.2, 0.9);
    holo(ctx, col, 3);

    // counter-rotating inner frame + cross beams
    ctx.save();
    ctx.rotate(-t * 0.7);
    const inner = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * TAU - Math.PI / 2;
      inner.push([Math.cos(ang) * w * 0.42, Math.sin(ang) * w * 0.42]);
    }
    poly(ctx, inner);
    ctx.strokeStyle = VB.U.hexA(col, 0.55); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = VB.U.hexA(col, 0.3);
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * w * 0.6, Math.sin(ang) * w * 0.6);
      ctx.lineTo(-Math.cos(ang) * w * 0.6, -Math.sin(ang) * w * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- SERAPH: four wing blades + halo + eight-point star core ----
  function drawSeraph(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // wing blades
    ctx.save();
    ctx.rotate(t * 0.35);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate((k / 4) * TAU);
      poly(ctx, [[0, -h * 0.32], [w * 0.15, -h * 1.22], [-w * 0.15, -h * 1.22]]);
      glass(ctx, col, 0.18, 0.7);
      holo(ctx, col, 1.6);
      // tip light
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, -h * 1.18, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // halo
    ctx.save();
    ctx.strokeStyle = VB.U.hexA('#ffc857', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.72, w * 0.5, h * 0.15, Math.sin(t * 1.1) * 0.35, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // eight-point star hull
    const pts = [];
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU - Math.PI / 2 + t * 0.8;
      const r = k % 2 === 0 ? w * 0.78 : w * 0.44;
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    poly(ctx, pts);
    glass(ctx, col, 0.2, 0.9);
    holo(ctx, col, 2.6);
  }

  // ---- HYDRA: serpent body, undulating tail, three orbiting heads ----
  function drawHydra(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // tail segments curling behind
    for (let s = 3; s >= 1; s--) {
      const sx = Math.sin(t * 3 + s * 1.1) * w * 0.4;
      const sy = h * 0.14 * s;
      const r = 9 - s * 1.8;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU);
      ctx.fillStyle = VB.U.hexA(col, 0.12 + 0.05 * s);
      ctx.fill();
      ctx.strokeStyle = VB.U.hexA(col, 0.4 - s * 0.08);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h * 0.52, 0, 0, TAU);
    glass(ctx, col, 0.16, 0.88);
    holo(ctx, col, 2.6);
    // scale rows
    ctx.strokeStyle = VB.U.hexA(col, 0.3); ctx.lineWidth = 1;
    for (const ry of [-h * 0.2, 0, h * 0.2]) {
      ctx.beginPath();
      ctx.ellipse(0, ry, w * 0.8, h * 0.14, 0, 0, Math.PI);
      ctx.stroke();
    }
    // inner void
    ctx.fillStyle = CORE;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, h * 0.24, 0, 0, TAU); ctx.fill();

    // three heads + connecting arcs
    for (let k = 0; k < 3; k++) {
      const ang = t * 1.6 + k * (TAU / 3);
      const hx = Math.cos(ang) * w * 0.95;
      const hy = -h * 0.5 + Math.sin(ang) * h * 0.3;
      ctx.strokeStyle = VB.U.hexA(col, 0.35);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx * 0.45, -h * 0.1);
      ctx.quadraticCurveTo(hx * 0.8, hy * 0.5, hx, hy);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 11, 0, TAU);
      glass(ctx, col, 0.3, 0.8);
      holo(ctx, col, 1.8);
      // jaw wedge
      const ja = Math.atan2(hy + h * 0.4, hx);
      ctx.save();
      ctx.translate(hx, hy); ctx.rotate(ja);
      poly(ctx, [[6, -3], [13, 0], [6, 3]]);
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      // eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(hx + Math.cos(ja) * 3, hy + Math.sin(ja) * 3 - 2, 1.4, 0, TAU); ctx.fill();
    }
  }

  // ---- TEMPEST: jagged storm shroud, orbiting nodes, arc lightning ----
  function drawTempest(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // unstable shroud
    const pts = [];
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU - Math.PI / 2;
      const jitter = 0.72 + 0.28 * Math.abs(Math.sin(t * 9 + k * 2.7));
      pts.push([Math.cos(ang) * w * jitter, Math.sin(ang) * w * jitter * 0.9]);
    }
    poly(ctx, pts);
    glass(ctx, col, 0.12, 0.66);
    holo(ctx, col, 2);

    // orbiting nodes + jagged arcs between them
    const nodes = [];
    for (let k = 0; k < 3; k++) {
      const a0 = t * 5 + k * 2.1;
      nodes.push([Math.cos(a0) * w * 0.62, Math.sin(a0) * h * 0.5]);
    }
    ctx.strokeStyle = VB.U.hexA(col, 0.6);
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 3; k++) {
      const [ax, ay] = nodes[k];
      const [bx, by] = nodes[(k + 1) % 3];
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const segs = 3;
      for (let s2 = 1; s2 <= segs; s2++) {
        const f = s2 / segs;
        const nx = VB.U.lerp(ax, bx, f) + Math.sin(t * 23 + k * 5 + s2 * 7) * 6;
        const ny = VB.U.lerp(ay, by, f) + Math.cos(t * 19 + k * 3 + s2 * 5) * 6;
        ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }
    glow(ctx, col, 8);
    ctx.fillStyle = '#dff1ff';
    for (const [nx, ny] of nodes) {
      ctx.beginPath(); ctx.arc(nx, ny, 2.4, 0, TAU); ctx.fill();
    }
    noGlow(ctx);

    // eye of the storm
    ctx.fillStyle = CORE;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.3, 0, TAU); ctx.fill();
  }

  // ---- MONOLITH: armored slab, rotating side plates, hazard chevrons ----
  function drawMonolith(ctx, e, t, col) {
    const w = e.w, h = e.h;
    poly(ctx, [
      [-w * 0.55, -h * 0.5], [w * 0.55, -h * 0.5], [w * 0.75, 0],
      [w * 0.55, h * 0.5], [-w * 0.55, h * 0.5], [-w * 0.75, 0]
    ]);
    glass(ctx, col, 0.14, 0.94);
    holo(ctx, col, 3.2);

    // plating seams
    ctx.strokeStyle = VB.U.hexA(CORE, 0.8); ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -h * 0.2); ctx.lineTo(w * 0.55, -h * 0.2);
    ctx.moveTo(-w * 0.55, h * 0.2); ctx.lineTo(w * 0.55, h * 0.2);
    ctx.stroke();
    ctx.strokeStyle = VB.U.hexA(col, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, 0); ctx.lineTo(w * 0.55, 0);
    ctx.stroke();

    // rotating side armor plates
    ctx.save();
    ctx.rotate(t * 0.5);
    ctx.strokeStyle = VB.U.hexA(col, 0.55);
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.strokeRect(s * w * 0.62 - w * 0.1, -w * 0.24, w * 0.2, w * 0.48);
    }
    ctx.restore();

    // hazard chevrons near the base
    ctx.strokeStyle = VB.U.hexA('#ffc857', 0.4);
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * w * 0.3 - 5, h * 0.36);
      ctx.lineTo(k * w * 0.3, h * 0.44);
      ctx.lineTo(k * w * 0.3 + 5, h * 0.36);
      ctx.stroke();
    }
    // emitter eye at top
    glow(ctx, col, 10);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, -h * 0.38, 3.2, 0, TAU); ctx.fill();
    noGlow(ctx);
  }

  // ---- ARCHON: crowned radial figure — tick ring, crown ring, blades ----
  function drawArchon(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // outer tick ring
    ctx.save();
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = VB.U.hexA(col, 0.6);
    ctx.lineWidth = 2;
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * w * 1.02, Math.sin(ang) * w * 1.02);
      ctx.lineTo(Math.cos(ang) * w * 1.18, Math.sin(ang) * w * 1.18);
      ctx.stroke();
    }
    ctx.restore();
    // dashed crown ring
    ctx.save();
    ctx.rotate(-t * 0.55);
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = VB.U.hexA('#ffc857', 0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, w * 0.95, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // four long wing blades
    ctx.save();
    ctx.rotate(t * 0.25);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate((k / 4) * TAU + Math.PI / 4);
      poly(ctx, [[0, -h * 0.3], [w * 0.1, -h * 1.45], [-w * 0.1, -h * 1.45]]);
      glass(ctx, col, 0.15, 0.66);
      holo(ctx, col, 1.5);
      glow(ctx, col, 6);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -h * 1.4, 1.8, 0, TAU); ctx.fill();
      noGlow(ctx);
      ctx.restore();
    }
    ctx.restore();

    // grand hull diamond
    poly(ctx, [
      [0, -h * 0.5], [w * 0.45, -h * 0.15], [w * 0.28, h * 0.3],
      [0, h * 0.5], [-w * 0.28, h * 0.3], [-w * 0.45, -h * 0.15]
    ]);
    glass(ctx, col, 0.2, 0.9);
    holo(ctx, col, 3);

    // inner rotating diamond
    ctx.save();
    ctx.rotate(t * 0.6);
    poly(ctx, [
      [0, -h * 0.26], [w * 0.22, 0], [0, h * 0.26], [-w * 0.22, 0]
    ]);
    ctx.strokeStyle = VB.U.hexA(col, 0.65);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // ---- VORTEX: swirling maelstrom — spiral arms, debris ring, eye ----
  function drawVortex(ctx, e, t, col) {
    const w = e.w, h = e.h;

    // three spiral arms (logarithmic curl, drawn as tapered polylines)
    ctx.save();
    ctx.rotate(t * (e.enraged ? 2.6 : 1.7));
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate((k / 3) * TAU);
      ctx.beginPath();
      let r = w * 0.22;
      let a = 0;
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      for (let s = 0; s < 9; s++) {
        a += 0.5;
        r *= 1.16;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.92);
      }
      ctx.strokeStyle = VB.U.hexA(col, 0.55);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // orbiting debris chunks (mini shards on an inclined ring)
    ctx.save();
    ctx.rotate(-t * 1.1);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU;
      const rr = w * (1.05 + 0.08 * Math.sin(t * 3 + k));
      const dx = Math.cos(ang) * rr, dy = Math.sin(ang) * rr * 0.8;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(t * 3 + k);
      poly(ctx, [[3, 0], [-2, 2.2], [-2, -2.2]]);
      ctx.fillStyle = VB.U.hexA(col, 0.7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // body: double-walled torus
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.72, h * 0.6, 0, 0, TAU);
    glass(ctx, col, 0.16, 0.8);
    holo(ctx, col, 2.6);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.48, h * 0.38, 0, 0, TAU);
    ctx.strokeStyle = VB.U.hexA(col, 0.5); ctx.lineWidth = 1.4; ctx.stroke();

    // the eye — dark event horizon with an accretion glint
    ctx.fillStyle = '#010608';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.26, h * 0.2, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.rotate(t * 4);
    ctx.strokeStyle = VB.U.hexA(col, 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, h * 0.12, 0, 0.3, Math.PI + 0.3); ctx.stroke();
    ctx.restore();
  }

  // ---- GORGON: prism hydra — crystalline body, five hair turrets ----
  function drawGorgon(ctx, e, t, col) {
    const w = e.w, h = e.h;

    // serpentine tail coils
    for (let s = 2; s >= 1; s--) {
      const sx = Math.sin(t * 2.2 + s * 1.4) * w * 0.5;
      const sy = h * 0.34 * s;
      ctx.beginPath(); ctx.arc(sx, sy, 8 - s * 2, 0, TAU);
      ctx.fillStyle = VB.U.hexA(col, 0.1 + 0.06 * s); ctx.fill();
      ctx.strokeStyle = VB.U.hexA(col, 0.42 - s * 0.1); ctx.lineWidth = 1.3; ctx.stroke();
    }

    // faceted crystal hull (angular prism head)
    poly(ctx, [
      [0, -h * 0.62], [w * 0.52, -h * 0.2], [w * 0.6, h * 0.18],
      [w * 0.24, h * 0.52], [-w * 0.24, h * 0.52], [-w * 0.6, h * 0.18],
      [-w * 0.52, -h * 0.2]
    ]);
    glass(ctx, col, 0.18, 0.9);
    holo(ctx, col, 2.8);
    // facet seams
    ctx.strokeStyle = VB.U.hexA('#ffffff', 0.22); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.52, -h * 0.2); ctx.lineTo(0, -h * 0.05); ctx.lineTo(w * 0.52, -h * 0.2);
    ctx.moveTo(-w * 0.6, h * 0.18); ctx.lineTo(0, h * 0.05); ctx.lineTo(w * 0.6, h * 0.18);
    ctx.stroke();

    // five hair turrets — writhing filaments with glowing tips
    for (let k = -2; k <= 2; k++) {
      const bx = k * 20;
      const sway = Math.sin(t * 5 + k * 1.7) * 7;
      const tipX = bx + sway, tipY = -h * 0.62 - 16 + Math.abs(k) * 7;
      ctx.strokeStyle = VB.U.hexA(col, 0.75);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, -h * 0.4);
      ctx.quadraticCurveTo(bx + sway * 0.4, -h * 0.75, tipX, tipY);
      ctx.stroke();
      glow(ctx, col, 7);
      ctx.fillStyle = k % 2 ? '#e8f6ff' : col;
      ctx.beginPath(); ctx.arc(tipX, tipY, 2.4, 0, TAU); ctx.fill();
      noGlow(ctx);
    }

    // gaze eye — slit pupil that tracks its sweep
    ctx.fillStyle = '#0a0f1e';
    ctx.beginPath(); ctx.arc(0, h * 0.02, w * 0.17, 0, TAU); ctx.fill();
    ctx.strokeStyle = VB.U.hexA('#e8f6ff', 0.9); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, h * 0.02, w * 0.17, 0, TAU); ctx.stroke();
    const look = e.gazeDir || 1;
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath(); ctx.ellipse(look * 3, h * 0.02, 2.2, 5.5, 0, 0, TAU); ctx.fill();
  }

  // ---- v4.2 LEVIATHAN: procedural segmented serpent trailing the maw ----
  function drawLeviathan(ctx, e, t, col) {
    const w = e.w, h = e.h;
    const segs = 7;
    // body: circles receding behind the head with a travelling wave
    for (let i = segs; i >= 1; i--) {
      const px = -i * w * 0.42 * (0.72 + 0.28 * Math.sin(t * 2.6 + i * 0.55));
      const py = Math.sin(t * 3.6 - i * 0.85) * (6 + i * 2.4);
      const r = Math.max(3, w * 0.34 - i * w * 0.038);
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU);
      glass(ctx, col, 0.14, 0.8);
      holo(ctx, col, 1.5);
      // dorsal spine on every second segment
      if (i % 2 === 0) {
        poly(ctx, [[px - r * 0.4, py - r * 0.7], [px, py - r * 1.7], [px + r * 0.4, py - r * 0.7]]);
        ctx.fillStyle = VB.U.hexA(col, 0.5); ctx.fill();
      }
    }
    // tail fin
    const tx = -segs * w * 0.42, ty = Math.sin(t * 3.6 - segs * 0.85) * (6 + segs * 2.4);
    poly(ctx, [[tx - w * 0.3, ty - h * 0.3], [tx + w * 0.18, ty], [tx - w * 0.3, ty + h * 0.3]]);
    glass(ctx, col, 0.2, 0.85);
    holo(ctx, col, 1.6);

    // armored maw head: angular jaw plates around a dark gullet
    poly(ctx, [
      [0, -h * 0.62], [w * 0.5, -h * 0.3], [w * 0.62, h * 0.05],
      [w * 0.3, h * 0.5], [-w * 0.3, h * 0.5], [-w * 0.62, h * 0.05], [-w * 0.5, -h * 0.3]
    ]);
    glass(ctx, col, 0.18, 0.92);
    holo(ctx, col, 2.8);
    // jaw seams
    ctx.strokeStyle = VB.U.hexA('#eafff3', 0.55); ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, h * 0.16); ctx.lineTo(0, h * 0.34); ctx.lineTo(w * 0.34, h * 0.16);
    ctx.moveTo(-w * 0.2, h * 0.32); ctx.lineTo(0, h * 0.5); ctx.lineTo(w * 0.2, h * 0.32);
    ctx.stroke();
    // fang pair
    ctx.fillStyle = VB.U.hexA('#eafff3', 0.85);
    poly(ctx, [[-w * 0.16, h * 0.34], [-w * 0.08, h * 0.34], [-w * 0.12, h * 0.52]]); ctx.fill();
    poly(ctx, [[w * 0.16, h * 0.34], [w * 0.08, h * 0.34], [w * 0.12, h * 0.52]]); ctx.fill();
    // hunt eyes
    glow(ctx, col, 8);
    ctx.fillStyle = e.enraged ? '#ffe86b' : '#eafff3';
    ctx.beginPath(); ctx.ellipse(-w * 0.2, -h * 0.14, 3, 5, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.2, -h * 0.14, 3, 5, 0.4, 0, TAU); ctx.fill();
    noGlow(ctx);
  }

  // ---- v4.2 MIRAGE: mirrored shards and flickering afterimages ----
  function drawMirage(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // two phase-offset afterimages
    if (!reduced()) {
      for (const [k, ax] of [[-1, -w * 0.55], [1, w * 0.55]]) {
        const ox = Math.sin(t * 2.4 + (k > 0 ? 0 : Math.PI)) * ax;
        const a = 0.16 + 0.1 * Math.sin(t * 6 + k);
        ctx.save();
        ctx.translate(ox, 0);
        ctx.globalAlpha = Math.max(0.06, a);
        poly(ctx, [
          [0, -h * 0.6], [w * 0.46, 0], [0, h * 0.6], [-w * 0.46, 0]
        ]);
        ctx.strokeStyle = VB.U.hexA(col, 0.8); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // main body: vertical mirror diamond
    poly(ctx, [
      [0, -h * 0.64], [w * 0.3, -h * 0.22], [w * 0.5, 0], [w * 0.3, h * 0.22],
      [0, h * 0.64], [-w * 0.3, h * 0.22], [-w * 0.5, 0], [-w * 0.3, -h * 0.22]
    ]);
    glass(ctx, col, 0.2, 0.9);
    holo(ctx, col, 2.6);
    // mirror seam down the spine
    ctx.strokeStyle = VB.U.hexA('#ffffff', 0.5 + 0.3 * Math.sin(t * 7));
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -h * 0.64); ctx.lineTo(0, h * 0.64); ctx.stroke();
    // orbiting shard prisms
    for (let k = 0; k < 4; k++) {
      const oa = t * 2.1 + (k / 4) * TAU;
      const ox = Math.cos(oa) * w * 0.85;
      const oy = Math.sin(oa) * h * 0.55;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(oa * 2);
      poly(ctx, [[0, -5], [4, 0], [0, 5], [-4, 0]]);
      ctx.fillStyle = k % 2 ? '#e8f0ff' : col; ctx.fill();
      ctx.restore();
    }
  }

  // ---- v5.0 OUROBOROS: segmented serpent riding a dashed elliptical orbit ----
  function drawOuroboros(ctx, e, t, col) {
    const w = e.w, h = e.h;
    // orbit path (world-space telegraph)
    if (e.orbCX !== undefined && !reduced()) {
      ctx.save();
      ctx.translate(-e.x, -e.y);
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = VB.U.hexA(col, 0.12);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(e.orbCX, e.orbCY, e.orbRX, e.orbRY, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (e.orbCX === undefined) return;

    // body: segments trailing along the orbit behind the head
    const segs = 6;
    for (let k = segs; k >= 1; k--) {
      const a = (e.orbA || 0) - k * 0.17;
      const sx = e.orbCX + Math.cos(a) * e.orbRX - e.x;
      const sy = e.orbCY + Math.sin(a) * e.orbRY - e.y;
      const r = Math.max(3, w * 0.3 - k * w * 0.032);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU);
      glass(ctx, col, 0.14, 0.8);
      holo(ctx, col, 1.5);
      // scale tick
      ctx.strokeStyle = VB.U.hexA(col, 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, a + 1.2, a + 2.6); ctx.stroke();
    }
    // tail fin at the last segment
    const ta = (e.orbA || 0) - (segs + 0.6) * 0.17;
    const tx = e.orbCX + Math.cos(ta) * e.orbRX - e.x;
    const ty = e.orbCY + Math.sin(ta) * e.orbRY - e.y;
    poly(ctx, [[tx - 8, ty - 8], [tx + 8, ty], [tx - 8, ty + 8]]);
    glass(ctx, col, 0.2, 0.85);
    holo(ctx, col, 1.4);

    // armored head leading the body (nose along the orbit tangent)
    ctx.save();
    ctx.rotate(e.orbA || 0);
    poly(ctx, [
      [0, h * 0.7], [w * 0.42, h * 0.18], [w * 0.5, -h * 0.2],
      [w * 0.2, -h * 0.42], [-w * 0.2, -h * 0.42], [-w * 0.5, -h * 0.2],
      [-w * 0.42, h * 0.18]
    ]);
    glass(ctx, col, 0.18, 0.92);
    holo(ctx, col, 2.6);
    // fangs
    ctx.fillStyle = VB.U.hexA('#f4ffd9', 0.85);
    poly(ctx, [[-w * 0.14, h * 0.42], [-w * 0.06, h * 0.4], [-w * 0.1, h * 0.62]]); ctx.fill();
    poly(ctx, [[w * 0.14, h * 0.42], [w * 0.06, h * 0.4], [w * 0.1, h * 0.62]]); ctx.fill();
    // hunt eyes
    glow(ctx, col, 8);
    ctx.fillStyle = e.enraged ? '#ff5470' : '#f4ffd9';
    ctx.beginPath(); ctx.ellipse(-w * 0.16, h * 0.05, 2.6, 4.4, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.16, h * 0.05, 2.6, 4.4, 0.4, 0, TAU); ctx.fill();
    noGlow(ctx);
    ctx.restore();
  }

  // ---- v5.0 CERBERUS: broad warden torso with three chained heads ----
  function drawCerberus(ctx, e, t, col) {
    const w = e.w, h = e.h;
    const heads = [[-w * 0.52, -h * 0.55, 0.5], [0, -h * 0.72, 0], [w * 0.52, -h * 0.55, -0.5]];
    // necks arcing up from the torso
    ctx.lineCap = 'round';
    for (const [nx, ny] of heads) {
      ctx.strokeStyle = VB.U.hexA(col, 0.45);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.1);
      ctx.quadraticCurveTo(nx * 0.5, -h * 0.3, nx, ny);
      ctx.stroke();
    }
    // main hull: broad shield-like torso
    poly(ctx, [
      [0, -h * 0.28], [w * 0.44, -h * 0.1], [w * 0.56, h * 0.18],
      [w * 0.3, h * 0.5], [-w * 0.3, h * 0.5], [-w * 0.56, h * 0.18],
      [-w * 0.44, -h * 0.1]
    ]);
    glass(ctx, col, 0.16, 0.92);
    holo(ctx, col, 2.8);
    // shoulder spikes
    ctx.fillStyle = VB.U.hexA(col, 0.75);
    poly(ctx, [[w * 0.3, -h * 0.16], [w * 0.5, -h * 0.34], [w * 0.52, -h * 0.06]]); ctx.fill();
    poly(ctx, [[-w * 0.3, -h * 0.16], [-w * 0.5, -h * 0.34], [-w * 0.52, -h * 0.06]]); ctx.fill();
    // three heads, gently swaying out of phase
    for (const [nx, ny, tilt] of heads) {
      ctx.save();
      ctx.translate(nx, ny + Math.sin(t * 2.2 + tilt * 3) * 3);
      ctx.rotate(tilt * 0.4);
      poly(ctx, [
        [0, -9], [8, -3], [10, 5], [3, 8], [-3, 8], [-10, 5], [-8, -3]
      ]);
      glass(ctx, col, 0.25, 0.9);
      holo(ctx, col, 1.8);
      // jaws
      ctx.strokeStyle = VB.U.hexA('#ffe9ec', 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5, 3); ctx.lineTo(-1, 7);
      ctx.moveTo(5, 3); ctx.lineTo(1, 7);
      ctx.stroke();
      // eye
      glow(ctx, col, 6);
      ctx.fillStyle = e.enraged ? '#ffd166' : '#ffe9ec';
      ctx.beginPath(); ctx.arc(0, -1, 1.8, 0, TAU); ctx.fill();
      noGlow(ctx);
      ctx.restore();
    }
    // chest reactor
    ctx.fillStyle = CORE;
    ctx.beginPath(); ctx.arc(0, h * 0.14, w * 0.14, 0, TAU); ctx.fill();
    ctx.strokeStyle = VB.U.hexA('#ffd166', 0.6 + 0.3 * Math.sin(t * 6));
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, h * 0.14, w * 0.14, 0, TAU); ctx.stroke();
  }

  // ---- v4.2 MAGNUS gravity wells + v5.0 FORGE turrets (world-space) ----
  function drawShipFX(ctx) {
    const t = VB.Game.time;
    const wells = VB.Ships && VB.Ships.wells ? VB.Ships.wells : null;
    if (wells) {
      for (const w of wells) {
        const life = 1 - w.t / w.dur;               // 1 → 0
        ctx.save();
        ctx.translate(w.x, w.y);
        // event-horizon shell
        ctx.strokeStyle = VB.U.hexA('#9d8bff', 0.3 + 0.3 * Math.sin(t * 6));
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 9]);
        ctx.beginPath(); ctx.arc(0, 0, w.r * (0.55 + 0.45 * life), 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        // inward spiral arms
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let s = 0; s <= 14; s++) {
            const rr = w.r * 0.55 * (1 - s / 14);
            const aa = t * 3 + (k / 3) * TAU + s * 0.5;
            const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = VB.U.hexA('#9d8bff', 0.35);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        // dark core with violet rim
        const cr = 15 + Math.sin(t * 9) * 3;
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, cr * 2.2);
        grad.addColorStop(0, 'rgba(10,4,26,0.95)');
        grad.addColorStop(0.55, VB.U.hexA('#9d8bff', 0.4));
        grad.addColorStop(1, 'rgba(157,139,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, cr * 2.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = VB.U.hexA('#cabcff', 0.8);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }

    // v5.0 BASTION ARRAY: FORGE's deployed auto-turrets
    const turrets = VB.Ships && VB.Ships.turrets ? VB.Ships.turrets : null;
    if (turrets && turrets.length) {
      for (const tr of turrets) {
        const life = 1 - tr.t / tr.dur;
        ctx.save();
        ctx.translate(tr.x, tr.y);
        // deploy pad
        ctx.strokeStyle = VB.U.hexA('#ffb35c', 0.25 + 0.2 * Math.sin(t * 5));
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        // base hex
        poly(ctx, [[0, -9], [8, -4.5], [8, 4.5], [0, 9], [-8, 4.5], [-8, -4.5]]);
        glass(ctx, '#ffb35c', 0.25, 0.9);
        holo(ctx, '#ffb35c', 1.6);
        // barrel sweeping toward its aim angle
        ctx.save();
        ctx.rotate(tr.aim);
        ctx.strokeStyle = VB.U.hexA('#ffd9a0', 0.9);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(13, 0, 1.4, 0, TAU); ctx.fill();
        ctx.restore();
        // expiry flicker during the final quarter
        if (life < 0.25 && !reduced()) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 16));
          ctx.strokeStyle = VB.U.hexA('#ffb35c', 0.7);
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }
  }

  // ====================================================== BULLETS ======
  function drawBullets(ctx, playerB, enemyB) {
    const t = VB.Game.time;
    const pGlow = playerB.length < 140 && !reduced();
    const eGlow = enemyB.length < 90 && !reduced();

    // ---- player bullets / missiles ----
    for (const b of playerB) {
      // v4.0 Singularity Rounds: gravity-warped shot with a swirl aura
      if (b.pull) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(t * 7 + b.x * 0.1);
        ctx.strokeStyle = VB.U.hexA('#c86bff', 0.5);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(0, 0, 11 + Math.sin(t * 9) * 2, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (b.missile) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        if (pGlow) glow(ctx, b.color, 9);
        poly(ctx, [[b.size * 2.6, 0], [-b.size, -b.size * 0.9], [-b.size * 0.4, 0], [-b.size, b.size * 0.9]]);
        ctx.fillStyle = CORE; ctx.fill();
        holo(ctx, b.color, 1.5);
        noGlow(ctx);
        // flame flicker
        const fl = 5 + Math.random() * 4;
        const fg = ctx.createLinearGradient(-b.size, 0, -b.size - fl, 0);
        fg.addColorStop(0, VB.U.hexA('#ffc857', 0.85));
        fg.addColorStop(1, VB.U.hexA('#ffc857', 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(-b.size, -2); ctx.lineTo(-b.size - fl, 0); ctx.lineTo(-b.size, 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        continue;
      }
      const ang = Math.atan2(b.vy, b.vx);
      const spd = Math.hypot(b.vx, b.vy);
      const L = Math.min(26, spd * 0.026) + b.size * 2;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      if (pGlow) glow(ctx, b.color, 8);
      ctx.lineCap = 'round';
      ctx.strokeStyle = VB.U.hexA(b.color, 0.42);
      ctx.lineWidth = b.size * 2.3;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, b.size * 0.85);
      ctx.beginPath(); ctx.moveTo(-L * 0.55, 0); ctx.lineTo(0, 0); ctx.stroke();
      noGlow(ctx);
      ctx.restore();
      if (b.crit) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(t * 6);
        ctx.strokeStyle = VB.U.hexA('#ffc857', 0.85);
        ctx.lineWidth = 1.2;
        poly(ctx, [[0, -(b.size + 3.5)], [b.size + 3.5, 0], [0, b.size + 3.5], [-(b.size + 3.5), 0]]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ---- enemy bullets ----
    for (const b of enemyB) {
      const s = b.size || 4;
      const c = b.color || '#ff5470';
      // v4.0: prism shards — rotating crystalline triangles
      if (b.prism) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(t * 5 + b.age * 4);
        if (eGlow) glow(ctx, c, 12);
        poly(ctx, [[0, -s * 1.4], [s * 1.2, s], [-s * 1.2, s]]);
        glass(ctx, c, 0.5, 0.55);
        holo(ctx, c, 1.6);
        noGlow(ctx);
        ctx.restore();
        continue;
      }
      if (b.homing) {
        const fuse = b.life > 0 ? b.life - b.age : Infinity;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        // spent missile: flickers during its final 1.5 s before defusing
        if (fuse < 1.5) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 18));
        if (eGlow) glow(ctx, c, 9);
        poly(ctx, [[s * 1.6, 0], [0, -s], [-s * 0.7, 0], [0, s]]);
        glass(ctx, c, 0.45, 0.6);
        holo(ctx, c, 1.4);
        noGlow(ctx);
        ctx.restore();
        continue;
      }
      const ph = b.x * 0.07 + b.y * 0.05;
      const pr = s * (1 + 0.16 * Math.sin(t * 10 + ph));
      if (eGlow) glow(ctx, c, 7);
      ctx.fillStyle = VB.U.hexA(c, 0.2);
      ctx.beginPath(); ctx.arc(b.x, b.y, pr * 2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = VB.U.hexA(c, 0.75);
      ctx.beginPath(); ctx.arc(b.x, b.y, pr, 0, TAU); ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(0.8, pr * 0.32), 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ------------------------------------------------------- mines -------
  function drawMines(ctx, mines) {
    const g = VB.Game;
    for (const m of mines) {
      ctx.save();
      ctx.translate(m.x, m.y);
      if (m.armed) {
        // rotating dashed threat radius
        ctx.save();
        ctx.rotate(VB.Game.time * 0.9);
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = VB.U.hexA('#ff5470', 0.14);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, m.blastRadius * 0.3, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // proximity warning ring
        if (g.player) {
          const d = VB.U.dist(m.x, m.y, g.player.x, g.player.y);
          const warn = 1 - (m.blastRadius * 0.5 - d) / (m.blastRadius * 0.5);
          if (warn > 0.5) {
            ctx.strokeStyle = VB.U.hexA('#ff5470', Math.min(0.45, (warn - 0.5) * 0.9));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, m.size + 5 + Math.sin(m.pulseTime * 8) * 3, 0, TAU);
            ctx.stroke();
          }
        }
      }
      const col = m.armed ? '#ff5470' : '#5d7186';
      // spike sphere
      const pts = [];
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * TAU;
        const r = k % 2 === 0 ? m.size : m.size * 0.55;
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      poly(ctx, pts);
      glass(ctx, col, 0.3, 0.8);
      holo(ctx, col, 1.6);
      ctx.fillStyle = CORE;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      if (m.armed && Math.sin(m.pulseTime * 8) > 0) {
        glow(ctx, '#ff5470', 8);
        ctx.fillStyle = '#ff5470';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
        noGlow(ctx);
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------- power-ups ------
  function drawPowerups(ctx, list) {
    const t = VB.Game.time;
    for (const p of list) {
      const pulse = 1 + Math.sin(p.time * 5) * 0.1;
      const s = p.size * pulse;
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(p.time * 3) * 2);
      // rotating corner brackets
      ctx.save();
      ctx.rotate(t * 0.9);
      ctx.strokeStyle = VB.U.hexA(p.color, 0.75);
      ctx.lineWidth = 1.6;
      const r = s + 6;
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * TAU;
        const cx = Math.cos(ang) * r, cy = Math.sin(ang) * r;
        const tx = -Math.sin(ang), ty = Math.cos(ang);
        ctx.beginPath();
        ctx.moveTo(cx + tx * 4, cy + ty * 4);
        ctx.lineTo(cx - tx * 4, cy - ty * 4);
        ctx.stroke();
      }
      ctx.restore();
      // chip body
      rrect(ctx, -s, -s, s * 2, s * 2, 4);
      glass(ctx, p.color, 0.2, 0.82);
      glow(ctx, p.color, 12 * pulse);
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.8; ctx.stroke();
      noGlow(ctx);
      // label
      ctx.fillStyle = p.color;
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.label, 0, 0.5);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 0;
  }

  // --------------------------------------------- nebula fog (v5.2) ----
  /** NEBULA FOG curse: creeping purple haze that swallows the edges of
   *  the arena. Breathing alpha keeps it alive without stealing contrast
   *  from enemy fire. */
  function drawFog(ctx, W, H, t) {
    const breathe = 0.5 + 0.12 * Math.sin(t * 0.8);
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    top.addColorStop(0, 'rgba(24, 6, 46, ' + (breathe + 0.18) + ')');
    top.addColorStop(1, 'rgba(24, 6, 46, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.3);

    const bottom = ctx.createLinearGradient(0, H, 0, H * 0.72);
    bottom.addColorStop(0, 'rgba(24, 6, 46, ' + breathe + ')');
    bottom.addColorStop(1, 'rgba(24, 6, 46, 0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    const side = Math.max(90, W * 0.12);
    const l = ctx.createLinearGradient(0, 0, side, 0);
    l.addColorStop(0, 'rgba(16, 4, 34, ' + (breathe - 0.08) + ')');
    l.addColorStop(1, 'rgba(16, 4, 34, 0)');
    ctx.fillStyle = l;
    ctx.fillRect(0, 0, side, H);
    const r = ctx.createLinearGradient(W, 0, W - side, 0);
    r.addColorStop(0, 'rgba(16, 4, 34, ' + (breathe - 0.08) + ')');
    r.addColorStop(1, 'rgba(16, 4, 34, 0)');
    ctx.fillStyle = r;
    ctx.fillRect(W - side, 0, side, H);
  }

  // ----------------------------------------------------- score zone ----
  function drawZone(ctx, zone, t) {
    if (!zone || zone.timer <= 0) return;
    const pulse = 1 + Math.sin(t * 5) * 0.05;
    const a = Math.min(1, zone.timer) * 0.16;
    ctx.save();
    ctx.translate(zone.x, zone.y);
    // rotating hexagon
    ctx.save();
    ctx.rotate(t * 0.5);
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * TAU;
      pts.push([Math.cos(ang) * zone.r * pulse, Math.sin(ang) * zone.r * pulse]);
    }
    poly(ctx, pts);
    ctx.fillStyle = VB.U.hexA('#ffc857', a);
    ctx.fill();
    glow(ctx, '#ffc857', 14);
    ctx.strokeStyle = VB.U.hexA('#ffc857', a * 2.2);
    ctx.lineWidth = 2;
    ctx.stroke();
    noGlow(ctx);
    ctx.restore();
    // inner dashed circle
    ctx.save();
    ctx.rotate(-t * 0.8);
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = VB.U.hexA('#ffc857', a * 1.6);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, zone.r * 0.66, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // label
    ctx.globalAlpha = Math.min(1, zone.timer * 2);
    ctx.font = '700 11px ' + FONT;
    ctx.fillStyle = '#ffc857';
    ctx.textAlign = 'center';
    ctx.fillText('2X SCORE', 0, -zone.r - 10);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    drawPlayer, drawEnemies, drawBullets, drawMines, drawPowerups, drawZone, drawFog,
    previewHull, drawShipFX,
    FONT
  };
})();
