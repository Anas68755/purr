// ============================================================
// VOID BREAKER // NEON ASCENSION — fx.js  (v3.0 HOLO-ARC)
// Completely rebuilt effects engine. Public API unchanged so
// every logic module keeps calling it as before.
//
//   background : deep gradient, drifting nebulae, aurora bands,
//                3 parallax mote layers (dot/plus/diamond),
//                wireframe debris, perspective floor grid,
//                shooting streaks
//   particles  : additive sparks & orbs, spinning polygon shards,
//                shockwave rings, outlined damage numbers,
//                blinking side-warnings
//   screen     : shake, flash, vignette, time-dilation tint
// ============================================================
window.VB = window.VB || {};

VB.FX = (function () {
  const particles = [];
  const floaters = [];
  const warnings = [];
  let motes = [];
  let debris = [];
  let streaks = [];
  let nebulaTime = 0;
  let gridScroll = 0;

  const MAX_PARTICLES = 800;
  let shakeMag = 0, shakeDur = 0, shakeX = 0, shakeY = 0;
  let flash = 0, flashColor = '#ffffff';
  let reducedFx = false;

  // ---------------- background ----------------
  function initStars(W, H) {
    motes = [];
    debris = [];
    // three parallax layers: far dust dots, mid plus-marks, near diamonds
    const layers = [
      { n: 90, spd: 16, a: [0.18, 0.4], col: '#6f7f9a', kind: 'dot', s: [0.5, 1.1] },
      { n: 42, spd: 42, a: [0.25, 0.55], col: '#9db4cc', kind: 'plus', s: [1.4, 2.4] },
      { n: 16, spd: 95, a: [0.4, 0.8], col: '#d9ecff', kind: 'diamond', s: [1.8, 3.2] }
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        motes.push({
          x: Math.random() * W, y: Math.random() * H,
          s: VB.U.frand(L.s[0], L.s[1]),
          speed: L.spd * VB.U.frand(0.75, 1.25),
          brightness: VB.U.frand(L.a[0], L.a[1]),
          color: L.col, kind: L.kind,
          twinkle: Math.random() * Math.PI * 2,
          drift: VB.U.frand(-6, 6)
        });
      }
    }
    // slow wireframe debris silhouettes
    for (let i = 0; i < 6; i++) {
      const sides = 3 + Math.floor(Math.random() * 4);
      const r = VB.U.frand(50, 150);
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + VB.U.frand(-0.3, 0.3);
        pts.push([Math.cos(a) * r * VB.U.frand(0.7, 1.15), Math.sin(a) * r * VB.U.frand(0.7, 1.15)]);
      }
      debris.push({
        x: Math.random() * W, y: Math.random() * H,
        rot: Math.random() * Math.PI * 2,
        vr: VB.U.frand(-0.05, 0.05),
        vy: VB.U.frand(4, 12),
        pts, alpha: VB.U.frand(0.025, 0.05)
      });
    }
  }

  function updateBackground(dt, W, H) {
    nebulaTime += 0.003;
    gridScroll += dt * 26;
    for (const m of motes) {
      m.y += m.speed * dt;
      m.x += m.drift * dt;
      m.twinkle += dt * 3;
      if (m.y > H + 4) { m.y = -4; m.x = Math.random() * W; }
      if (m.x > W + 4) m.x = -4;
      if (m.x < -4) m.x = W + 4;
    }
    for (const d of debris) {
      d.rot += d.vr * dt;
      d.y += d.vy * dt;
      if (d.y - 180 > H) { d.y = -180; d.x = Math.random() * W; }
    }
    if (Math.random() < dt * 0.12) {
      streaks.push({
        x: Math.random() * W * 0.8, y: -10,
        vx: VB.U.frand(120, 260), vy: VB.U.frand(220, 420),
        life: 0.9, maxLife: 0.9
      });
    }
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.y > H + 20) streaks.splice(i, 1);
    }
  }

  function drawBackground(ctx, W, H) {
    // ---- base gradient ----
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#04070d');
    base.addColorStop(0.55, '#081120');
    base.addColorStop(1, '#0b1626');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // ---- drifting nebulae ----
    const spots = [
      { cx: 0.28, cy: 0.36, sx: 0.7, sy: 0.5, r: 340, col: '88,246,255', a: 0.035 },
      { cx: 0.74, cy: 0.62, sx: 0.6, sy: 0.8, r: 300, col: '255,79,216', a: 0.03 },
      { cx: 0.52, cy: 0.16, sx: 1.1, sy: 0.9, r: 240, col: '80,110,255', a: 0.028 }
    ];
    for (const s of spots) {
      const cx = W * s.cx + Math.sin(nebulaTime * s.sx) * 110;
      const cy = H * s.cy + Math.cos(nebulaTime * s.sy) * 90;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, s.r));
      grad.addColorStop(0, 'rgba(' + s.col + ',' + s.a + ')');
      grad.addColorStop(1, 'rgba(' + s.col + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- aurora bands (slow diagonal light sheets) ----
    if (!reducedFx) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.35);
      for (let i = 0; i < 2; i++) {
        const off = ((nebulaTime * (i ? 60 : 40) + i * 500) % (H * 2)) - H;
        const bw = H * 0.22;
        const g = ctx.createLinearGradient(0, off - bw, 0, off + bw);
        const col = i ? '88,246,255' : '255,79,216';
        g.addColorStop(0, 'rgba(' + col + ',0)');
        g.addColorStop(0.5, 'rgba(' + col + ',0.028)');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W, off - bw, W * 2, bw * 2);
      }
      ctx.restore();
    }

    // ---- wireframe debris ----
    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.strokeStyle = 'rgba(140,180,220,' + d.alpha + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.pts[0][0], d.pts[0][1]);
      for (let k = 1; k < d.pts.length; k++) ctx.lineTo(d.pts[k][0], d.pts[k][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // ---- perspective floor grid ----
    const hy = H * 0.74;
    const ga = reducedFx ? 0.03 : 0.05;
    ctx.strokeStyle = 'rgba(88,246,255,' + ga + ')';
    ctx.lineWidth = 1;
    // horizontals scrolling toward the viewer
    const gap = 34;
    const off = gridScroll % gap;
    for (let i = 0; i < 10; i++) {
      const yy = hy + off + i * gap * (1 + i * 0.14);
      if (yy > H) break;
      ctx.globalAlpha = Math.min(1, (yy - hy) / (H - hy)) * 1;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    // verticals converging at the vanishing point
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 14, hy);
      ctx.lineTo(W / 2 + i * (W / 8.5), H + 20);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // horizon hairline
    ctx.strokeStyle = 'rgba(88,246,255,' + (ga * 1.6) + ')';
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();

    // ---- motes ----
    for (const m of motes) {
      const a = m.brightness * (0.7 + 0.3 * Math.sin(m.twinkle));
      ctx.globalAlpha = a;
      ctx.fillStyle = m.color;
      if (m.kind === 'dot') {
        ctx.fillRect(m.x, m.y, m.s, m.s);
      } else if (m.kind === 'plus') {
        ctx.fillRect(m.x - m.s, m.y - 0.5, m.s * 2, 1);
        ctx.fillRect(m.x - 0.5, m.y - m.s, 1, m.s * 2);
      } else { // diamond
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-m.s / 2, -m.s / 2, m.s, m.s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // ---- shooting streaks ----
    for (const s of streaks) {
      const a = s.life / s.maxLife;
      ctx.globalAlpha = a * 0.8;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.09, s.y - s.vy * 0.09);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.09, s.y - s.vy * 0.09);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- particles ----------------
  function push(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  /** main explosion: shards + sparks + core flash */
  function explosion(x, y, color, count, speed) {
    if (reducedFx) count = Math.ceil(count / 3);
    // spinning polygon shards
    const shards = Math.max(2, Math.floor(count / 3));
    for (let i = 0; i < shards; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * speed * 0.7 + speed * 0.25;
      push({
        type: 'shard', x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: Math.random() * 0.45 + 0.3, maxLife: 0.75,
        size: Math.random() * 4.5 + 2, color,
        rot: Math.random() * Math.PI * 2, vr: VB.U.frand(-9, 9)
      });
    }
    // bright streak sparks
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * speed * 1.5 + speed * 0.5;
      push({
        type: 'spark', x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: Math.random() * 0.28 + 0.12, maxLife: 0.4,
        size: Math.random() * 1.6 + 0.6, color: Math.random() < 0.35 ? '#ffffff' : color
      });
    }
    // core flash
    push({
      type: 'orb', x, y, vx: 0, vy: 0,
      life: 0.16, maxLife: 0.16, size: Math.max(8, count * 0.35), color: '#ffffff'
    });
  }

  /** single directional particle (dash plumes, thrusters, ricochets) */
  function spawnBurst(x, y, vx, vy, color) {
    push({
      type: 'orb', x, y, vx, vy,
      life: 0.32, maxLife: 0.32, size: 2.6, color
    });
  }

  /** expanding shockwave ring */
  function ring(x, y, color, maxR, dur) {
    push({ type: 'ring', x, y, color, life: dur, maxLife: dur, size: maxR });
  }

  /** v4.0: jagged lightning bolt between two points (Arc Conductor) */
  function bolt(x1, y1, x2, y2, color) {
    const segs = 6;
    const pts = [[x1, y1]];
    for (let s = 1; s < segs; s++) {
      const f = s / segs;
      pts.push([
        VB.U.lerp(x1, x2, f) + VB.U.frand(-10, 10),
        VB.U.lerp(y1, y2, f) + VB.U.frand(-10, 10)
      ]);
    }
    pts.push([x2, y2]);
    push({ type: 'bolt', pts, color, life: 0.18, maxLife: 0.18 });
  }

  function dmgNum(x, y, text, color, big) {
    if (reducedFx && floaters.length > 14) return;
    floaters.push({ x, y, text, color, life: 0.8, maxLife: 0.8, vy: -85, size: big ? 20 : 14 });
  }

  function warnSide(x, y, color, dir) {
    warnings.push({ x, y, life: 1.2, maxLife: 1.2, color, dir });
  }

  /** v5.3.1: top-edge spawn ping — a chevron pointing down at the lane */
  function warnTop(x, color) {
    warnings.push({ x, y: 12, life: 1.2, maxLife: 1.2, color, dir: 2 });
  }

  function shake(mag, dur) {
    if (reducedFx) mag *= 0.4;
    shakeMag = Math.max(shakeMag, mag); shakeDur = Math.max(shakeDur, dur);
  }

  function screenFlash(amount, color) {
    flash = Math.max(flash, amount); flashColor = color;
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.type === 'ring') continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.955; p.vy *= 0.955;
      if (p.type === 'shard') p.rot += p.vr * dt;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const d = floaters[i];
      d.y += d.vy * dt; d.life -= dt;
      if (d.life <= 0) floaters.splice(i, 1);
    }
    for (let i = warnings.length - 1; i >= 0; i--) {
      warnings[i].life -= dt;
      if (warnings[i].life <= 0) warnings.splice(i, 1);
    }
    if (shakeDur > 0) {
      shakeDur -= dt;
      shakeX = (Math.random() - 0.5) * shakeMag * 2;
      shakeY = (Math.random() - 0.5) * shakeMag * 2;
      shakeMag *= 0.9;
    } else { shakeX = 0; shakeY = 0; }
    if (flash > 0) flash -= dt * 2;
  }

  function draw(ctx) {
    // ---- pass 1: additive glow (orbs + sparks) ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.type === 'orb') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size * alpha * 2.2), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ---- pass 2: solid (shards + rings) ----
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.size, 0);
        ctx.lineTo(-p.size * 0.6, p.size * 0.6);
        ctx.lineTo(-p.size * 0.6, -p.size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'bolt') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color; ctx.shadowBlur = 12;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let k = 1; k < p.pts.length; k++) ctx.lineTo(p.pts[k][0], p.pts[k][1]);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // ---- damage numbers ----
    ctx.textAlign = 'center';
    for (const d of floaters) {
      const k = d.life / d.maxLife;
      const pop = 1 + (1 - k) * 0.35;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = '700 ' + Math.round((d.size || 14) * pop) + 'px "Chakra Petch","Orbitron",sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(3,8,14,0.85)';
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawWarnings(ctx) {
    for (const w of warnings) {
      const k = w.life / w.maxLife;
      if (k < 0.5 && Math.floor(k * 14) % 2 === 0) continue; // blink out
      const alpha = Math.min(1, k * 2.4) * 0.85;
      ctx.save();
      ctx.translate(w.x, w.y);
      // v5.3.1: dir 2 = descending spawn ping — chevron points down
      if (w.dir === 2) ctx.rotate(Math.PI / 2);
      else ctx.scale(w.dir > 0 ? 1 : -1, 1);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = w.color; ctx.shadowBlur = 10;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const off of [0, 8]) {
        ctx.beginPath();
        ctx.moveTo(off - 4, -8);
        ctx.lineTo(off + 5, 0);
        ctx.lineTo(off - 4, 8);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette(ctx, W, H) {
    const grad = ctx.createRadialGradient(
      W / 2, H / 2, Math.max(1, H * 0.32),
      W / 2, H / 2, Math.max(2, H * 0.92)
    );
    grad.addColorStop(0, 'rgba(3,7,13,0)');
    grad.addColorStop(1, 'rgba(3,7,13,0.62)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFlash(ctx, W, H) {
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash) * 0.4;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  /** cool tint while time-dilation is active */
  function drawTimeTint(ctx, W, H, strength) {
    if (strength <= 0) return;
    ctx.globalAlpha = Math.min(0.22, strength * 0.22);
    ctx.fillStyle = '#3fa0ff';
    ctx.fillRect(0, 0, W, H);
    if (!reducedFx) {
      ctx.globalAlpha = Math.min(0.12, strength * 0.12);
      ctx.fillStyle = '#9dd4ff';
      const off = (performance.now() * 0.05) % 6;
      for (let y = -6; y < H; y += 6) ctx.fillRect(0, y + off, W, 1);
    }
    ctx.globalAlpha = 1;
  }

  function clearRunState() {
    particles.length = 0;
    floaters.length = 0;
    warnings.length = 0;
    shakeMag = 0; shakeDur = 0; flash = 0;
    shakeX = 0; shakeY = 0;
  }

  return {
    initStars, updateBackground, drawBackground,
    explosion, ring, bolt, dmgNum, warnSide, warnTop, spawnBurst,
    shake, screenFlash, update, draw, drawWarnings,
    drawVignette, drawFlash, drawTimeTint,
    clearRunState,
    setReduced(v) { reducedFx = !!v; },
    isReduced() { return reducedFx; },
    get shakeOffset() { return { x: shakeX, y: shakeY }; }
  };
})();
