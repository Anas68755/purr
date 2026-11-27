'use strict';
const canvas = $('#gc');
const ctx = canvas.getContext('2d');
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const LS = 0.5;                       // light-layer resolution scale

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  lightCv.width = Math.max(1, Math.round(VW * LS)); lightCv.height = Math.max(1, Math.round(VH * LS));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

const drawList = [];
const glowProps = [];                    // night-glowing scenery found while drawing tiles (glowing mushrooms)
let cullL = 0, cullT = 0, cullR = 0, cullB = 0;
const vis = (x, y, m = 90) => x > cullL - m && x < cullR + m && y > cullT - m && y < cullB + m;     // off-screen things are not even queued for drawing

/* ---------------- sprite helpers (image if loaded, else vector fallback) ---------------- */
function shadow(x, y, rx, ry, a = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSlimeSprite(s) {
  const def = s.def, img = Assets.get('slime_' + s.type);
  const w = def.size * 40 * lifeScale(s);
  const t = s.hop;
  let sx = 1, sy = 1;
  if (s.eatTimer > 0) { sy = 1 + Math.sin(s.age * 22) * 0.09; sx = 2 - sy; }
  else if (s.fly > 0) { sy = 1.12; sx = 0.9; }
  else if (t < 0.5) { const q = Math.sin(t / 0.5 * Math.PI); sy = 1 + 0.14 * q; sx = 1 - 0.09 * q; }
  else { const q = Math.sin((t - 0.5) / 0.5 * Math.PI); sy = 1 - 0.1 * q; sx = 1 + 0.08 * q; }
  // the sheet already contains squash / stretch / happy / sad / surprised poses, so keep the code-driven squish gentle
  let frame = SLIME_FRAME.IDLE;
  if (s.sucked > 0 || s.scared > 0) frame = SLIME_FRAME.SURPRISED;
  else if (s.eatTimer > 0) frame = SLIME_FRAME.HAPPY;
  else if (s.fly > 0 || (t < 0.5 && s.z > 1.5)) frame = SLIME_FRAME.STRETCH;
  else if (t >= 0.5 && t < 0.62) frame = SLIME_FRAME.SQUASH;
  else if (s.hunger < def.hunger * 0.25) frame = SLIME_FRAME.SAD;
  if (img) { sx = 1 + (sx - 1) * 0.4; sy = 1 + (sy - 1) * 0.4; }
  shadow(s.x, s.y + 11, w * 0.34 * (1 - s.z * 0.012), 4.5 * (1 - s.z * 0.012));
  ctx.save();
  ctx.translate(s.x, s.y + 11 - s.z);
  ctx.scale(s.facing * sx, sy);
  if (img) ctx.drawImage(img, frame * SLIME_CELL, 0, SLIME_CELL, SLIME_CELL, -w / 2, -w * 0.92, w, w);
  else {
    ctx.fillStyle = def.color; ctx.beginPath(); ctx.ellipse(0, -w * 0.3, w * 0.42, w * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -w * 0.33, 3, 0, 7); ctx.arc(5, -w * 0.33, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-3, -w * 0.33, 1.4, 0, 7); ctx.arc(6, -w * 0.33, 1.4, 0, 7); ctx.fill();
  }
  ctx.restore();
  if (!inPhotoMode() && dist(s.x, s.y, game.player.x, game.player.y) < 115) drawLabel(`${s.shiny ? '✨ ' : ''}${tr(s.name)} ${TRAITS[s.trait].icon}${isBaby(s) ? ' 🍼' : ''}`, s.x, s.y - w * 0.95 - 4, s.shiny ? '#fff3a8' : '#ffffff');
}

function drawItem(it, kind) {
  const z = it.z || 0;
  const key = (kind === 'plort' ? 'plort_' : kind === 'treasure' ? 'treasure_' : 'food_') + it.type;
  const img = Assets.get(key);
  const size = kind === 'plort' ? 20 : 22;
  if (kind === 'treasure') { const gl = Assets.get('glow'); if (gl) { ctx.globalAlpha = 0.45 + 0.25 * Math.sin(performance.now() * 0.005 + it.x); ctx.drawImage(gl, it.x - 18, it.y - z - 20, 36, 36); ctx.globalAlpha = 1; } }
  shadow(it.x, it.y + 4, size * 0.34, 2.6, 0.28 * (1 - Math.min(0.6, z * 0.02)));
  const bob = it.z === 0 ? Math.sin(performance.now() * 0.004 + it.x) * 0.8 : 0;
  if (img) ctx.drawImage(img, it.x - size / 2, it.y - z - size + 6 + bob, size, size);
  else {
    ctx.fillStyle = kind === 'plort' ? SLIMES[it.type].plort.color : kind === 'treasure' ? TREASURES[it.type].color : FOODS[it.type].color;
    ctx.beginPath(); ctx.arc(it.x, it.y - z - 4, 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayerSprite(p) {
  const img = Assets.get('player');
  const size = 54;
  const frame = p.moving ? Math.floor(p.walkT) % 4 : 0;
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  const row = Math.abs(ca) >= Math.abs(sa) * 0.9 ? 2 : (sa > 0 ? 0 : 1);   // 0 down, 1 up, 2 side (faces right)
  const bob = p.moving ? Math.abs(Math.sin(p.walkT * 1.5)) * -1.5 : 0;
  const zf = Math.max(0.3, 1 - p.z * 0.006);
  shadow(p.x, p.y + 12, 10 * zf, 3.5 * zf, 0.3 * zf + 0.1);
  ctx.save();
  ctx.translate(p.x, p.y + 12 - p.z + bob);
  ctx.scale(row === 2 ? p.facing : 1, 1);
  if (img) ctx.drawImage(img, frame * PLAYER_CELL, row * PLAYER_CELL, PLAYER_CELL, PLAYER_CELL, -size / 2, -size * 0.92, size, size);
  else { ctx.fillStyle = '#ffeb3b'; ctx.fillRect(-7, -26, 14, 22); ctx.fillStyle = '#ffe0a8'; ctx.beginPath(); ctx.arc(0, -30, 7, 0, 7); ctx.fill(); }
  ctx.restore();
  if (p.gliding) {                                   // little feather wings while gliding
    const w = Math.sin(performance.now() * 0.02) * 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(p.x + sd * 6, p.y - 22 - p.z); ctx.quadraticCurveTo(p.x + sd * 18, p.y - 32 - p.z - w, p.x + sd * 24, p.y - 20 - p.z); ctx.stroke(); }
  }
  // vacpack nozzle (always visible, rotates with aim)
  ctx.save();
  ctx.translate(p.x, p.y - 5 - p.z + bob);
  ctx.rotate(p.aim);
  ctx.fillStyle = '#6a737d'; ctx.fillRect(4, -3.5, 12, 7);
  ctx.fillStyle = p.sucking ? '#7fd8ff' : '#aeb7c1'; ctx.fillRect(13, -4.5, 5, 9);
  ctx.fillStyle = '#3c434b'; ctx.fillRect(4, -3.5, 12, 1.6);
  ctx.restore();
}

/* a friend's colour ring, name, chapter, emote and chat bubble (names and typed text are never translated) */
function drawRawLabel(text, x, y, color, size) {
  ctx.font = 'bold ' + (size || 12) + 'px Arial'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawNetTag(rp, x, y, z, mine) {
  ctx.save(); ctx.strokeStyle = rp.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 6.5, 0, 0, 7); ctx.stroke(); ctx.restore();
  const top = y - 58 - z;
  drawRawLabel(rp.name, x, top, rp.color, 12);
  if (!mine) drawRawLabel(netStoryLabel(rp.story), x, top - 14, '#fff3c8', 11);
  let up = top - (mine ? 14 : 28);
  if (rp.sayT > 0 && rp.say) { const t = NET_PHRASES.includes(rp.say) ? tr(rp.say) : rp.say; ctx.direction = 'ltr'; drawRawLabel(t.length > 40 ? t.slice(0, 40) + '…' : t, x, up, '#ffffff', 13); up -= 16; }
  if (rp.emoteT > 0 && rp.emote) { ctx.font = '24px Arial'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, rp.emoteT); ctx.fillText(rp.emote, x, up - 4 - (3 - Math.min(3, rp.emoteT)) * 4); ctx.globalAlpha = 1; }
}

function drawVacBeam(p) {
  const range = getVacRange();
  const nx = p.x + Math.cos(p.aim) * 18, ny = p.y - 5 + Math.sin(p.aim) * 18;
  ctx.save();
  ctx.translate(nx, ny); ctx.rotate(p.aim);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, range);
  g.addColorStop(0, 'rgba(150,225,255,0.38)'); g.addColorStop(0.6, 'rgba(150,225,255,0.12)'); g.addColorStop(1, 'rgba(150,225,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, -getVacCone() / 2, getVacCone() / 2); ctx.closePath(); ctx.fill();
  const tm = performance.now() / 1000;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    const u = (tm * 1.4 + i / 12) % 1;
    const r = range * (1 - u), a = Math.sin(i * 12.9898) * (getVacCone() * 0.46);
    ctx.globalAlpha = 0.25 + 0.6 * u;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1 + u * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawShopSprite(f) {
  const img = Assets.get('shop');
  const cx = (f.x + f.w / 2) * TILE, bottom = (f.y + f.h) * TILE + 6;
  const w = 150, h = w * 0.75;
  if (img) ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
  else { ctx.fillStyle = '#8b5a3c'; ctx.fillRect(cx - 54, bottom - 70, 108, 70); ctx.fillStyle = '#c04878'; ctx.fillRect(cx - 60, bottom - 80, 120, 16); }
  if (game.nearShop && !game.shopOpen) {
    ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(cx - 58, bottom - h - 24, 116, 20);
    ctx.fillStyle = '#fff'; ctx.fillText(tr('🛒 Tap the cart / E'), cx, bottom - h - 9);
  }
}

function drawPlot(p) {
  const img = Assets.get('plot'), st = plotStage(p), tm = performance.now();
  if (p.crop && p.wet) { ctx.fillStyle = 'rgba(25,15,8,0.30)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 15, 9, 0, 0, 7); ctx.fill(); }
  if (img) ctx.drawImage(img, st * 64, 0, 64, 64, p.x - 24, p.y - 33, 48, 48);
  else { ctx.fillStyle = '#6b4429'; ctx.fillRect(p.x - 15, p.y - 8, 30, 22); if (st) { ctx.fillStyle = '#4caf50'; ctx.fillRect(p.x - 3, p.y - 8 - st * 4, 6, st * 5); } }
  if (st === 3) {
    const fi = Assets.get('food_' + p.crop), bob = Math.sin(tm * 0.005 + p.x) * 2;
    if (fi) ctx.drawImage(fi, p.x - 11, p.y - 36 + bob, 22, 22); else { ctx.fillStyle = FOODS[p.crop].color; ctx.beginPath(); ctx.arc(p.x, p.y - 22 + bob, 7, 0, 7); ctx.fill(); }
  }
}
function drawDecor(d) {
  const img = Assets.get('ranch_decor'), def = DECOR_ITEMS[d.type];
  if (img) ctx.drawImage(img, def.cell * 64, 0, 64, 64, d.x - 23, d.y - 33, 46, 46);
  else { ctx.fillStyle = '#c89060'; ctx.fillRect(d.x - 8, d.y - 18, 16, 22); }
}
function drawSpot(sp) {
  if (game.powers.glowsense) {
    const g = ctx.createLinearGradient(0, sp.y - 130, 0, sp.y);
    g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(1, 'rgba(255,240,160,0.5)');
    ctx.fillStyle = g; ctx.fillRect(sp.x - 4, sp.y - 130, 8, 130);
  }
  const tm = performance.now(), pi = Assets.get('particles'), gl = Assets.get('glow');
  ctx.fillStyle = 'rgba(70,45,25,0.55)'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 4, 11, 5, 0, 0, 7); ctx.fill();
  const pulse = 0.75 + 0.25 * Math.sin(tm * 0.006 + sp.x);
  if (gl) { ctx.globalAlpha = 0.55 * pulse; ctx.drawImage(gl, sp.x - 22, sp.y - 24, 44, 44); ctx.globalAlpha = 1; }
  if (pi) ctx.drawImage(pi, PART.spark * PARTICLE_CELL, 0, PARTICLE_CELL, PARTICLE_CELL, sp.x - 9 * pulse, sp.y - 8 - 9 * pulse + Math.sin(tm * 0.004 + sp.y) * 2, 18 * pulse, 18 * pulse);
  else { ctx.fillStyle = '#fff6a0'; ctx.fillRect(sp.x - 2, sp.y - 8, 4, 4); }
}
function drawShootingStar() {
  const f = game.sky.fall; if (!f) return;
  const u = clamp(f.t / f.dur, 0, 1), gl = Assets.get('glow');
  const hx = f.tx + 340 * (1 - u), hy = f.ty - 500 * (1 - u), len = 150, dx = 340 / 604, dy = -500 / 604;
  const g = ctx.createLinearGradient(hx, hy, hx + dx * len, hy + dy * len);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.strokeStyle = g; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * len, hy + dy * len); ctx.stroke();
  if (gl) ctx.drawImage(gl, hx - 24, hy - 24, 48, 48);
}
function drawCompass(camX, camY) {
  const ns = nearestSpot(); if (!ns || ns.d < 110) return;
  const p = game.player, px = p.x - camX, py = p.y - camY, a = Math.atan2(ns.spot.y - p.y, ns.spot.x - p.x);
  const x = px + Math.cos(a) * 64, y = py + Math.sin(a) * 64 - 8, bob = Math.sin(performance.now() * 0.006) * 2;
  ctx.save(); ctx.translate(x + Math.cos(a) * bob, y + Math.sin(a) * bob); ctx.rotate(a);
  ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = 'rgba(80,50,0,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawLabel(`${Math.round(ns.d / TILE)}`, x + Math.cos(a) * 18, y + Math.sin(a) * 18 + 4, '#fff3b0');
}
/* ---- Survival: gatherable nodes, critters, the swing arc and the lightning warning ---- */
function drawNode(n) {
  const ready = n.cd <= 0; shadow(n.x, n.y + 3, 10, 3, ready ? 0.2 : 0.08);
  ctx.save(); ctx.translate(n.x, n.y); ctx.globalAlpha = ready ? 1 : 0.3; ctx.lineCap = 'round';
  if (n.type === 'branches') {
    for (const [x0, y0, x1, y1] of [[-9, 2, 8, -3], [-6, -2, 7, 4], [-2, 5, 3, -7]]) { ctx.strokeStyle = '#5a3414'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = '#c8924a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y0 - 0.6); ctx.lineTo(x1, y1 - 0.6); ctx.stroke(); }
  } else {
    for (let i = -3; i <= 3; i++) { ctx.strokeStyle = '#2f7a2a'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(i * 2.6, 4); ctx.lineTo(i * 3.2 + i * 0.8, -9 + Math.abs(i) * 2); ctx.stroke(); ctx.strokeStyle = '#8ae05a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(i * 2.6, 3); ctx.lineTo(i * 3.2 + i * 0.8, -9 + Math.abs(i) * 2); ctx.stroke(); }
  }
  ctx.restore();
}
function drawCritter(c) {
  const img = Assets.get('critters'), frame = c.def.cell * 2 + (Math.floor(c.walk * (c.state === 'chase' ? 1 : 0.5)) % 2), jx = c.hurt > 0 ? (Math.random() - 0.5) * 4 : 0;
  shadow(c.x, c.y + 4, c.def.size * 0.9, 4.5, 0.25);
  if (img) ctx.drawImage(img, frame * 64, 0, 64, 64, c.x - 32 + jx, c.y - 54, 64, 64);
  else { ctx.fillStyle = '#a33'; ctx.beginPath(); ctx.arc(c.x, c.y - 14, c.def.size, 0, 7); ctx.fill(); }
  if (c.hurt > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.5, c.hurt * 1.5); ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 18, c.def.size, c.def.size * 0.8, 0, 0, 7); ctx.fill(); ctx.restore(); }
  if (c.hp < c.maxHp) { const w = 30, x = c.x - w / 2, y = c.y - 58; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x, y, w * Math.max(0, c.hp / c.maxHp), 3); }
  if (!inPhotoMode() && dist(c.x, c.y, game.player.x, game.player.y) < 130) drawLabel(c.def.name, c.x, c.y - 62, '#ffb0b0');
}
function drawSurvFx() {
  const s = game.surv, p = game.player;
  if (s.swing > 0) {
    const wd = weaponDef(), reach = wd ? wd.reach : 36, k = s.swing / 0.22;
    ctx.save(); ctx.translate(p.x, p.y - 10); ctx.rotate(p.aim); ctx.globalAlpha = 0.55 * k; ctx.fillStyle = '#fff6d0';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, reach + 6, -1.1, 1.1); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (s.strike) {
    const k = 1 - s.strike.t / s.strike.t0;
    ctx.save(); ctx.globalAlpha = 0.18 + 0.2 * k; ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(s.strike.x, s.strike.y, 46, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.5 + 0.5 * k; ctx.strokeStyle = '#ff6060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.strike.x, s.strike.y, 46 * (1 - 0.15 * Math.sin(k * 20)), 0, 7); ctx.stroke(); ctx.restore();
  }
}
function drawAurora() {                                                      // ribbons of light across the night sky (screen space)
  const t = performance.now() * 0.0004, k = Math.min(1, (game.time - AURORA.from) / 0.04 + 0.2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  [['#4dffb0', 0.30, 0], ['#58b8ff', 0.24, 1.7], ['#c08aff', 0.20, 3.1]].forEach(([col, a, ph], i) => {
    const base = VH * (0.12 + i * 0.07), amp = 16 + i * 6, g = ctx.createLinearGradient(0, base - 30, 0, base + 90);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a * k; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, base - 30);
    for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, base + Math.sin(x * 0.012 + t * (1.2 + i * 0.4) + ph) * amp - 30);
    for (let x = VW; x >= 0; x -= 20) ctx.lineTo(x, base + 90 + Math.sin(x * 0.01 + t * (1.0 + i * 0.3) + ph) * amp * 1.3);
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}
function drawStoryGuide(camX, camY) {
  const t = storyTarget(); if (!t) return;
  const p = game.player, tx = t.x * TILE, ty = t.y * TILE, d = dist(p.x, p.y, tx, ty);
  if (d < 320) return;                                                   // close enough: the ★ above their head does the job
  const a = Math.atan2(ty - p.y, tx - p.x), cx = VW / 2, cy = VH / 2 - 10, r = Math.min(VW, VH) * 0.36, bob = Math.sin(performance.now() * 0.005) * 2.5;
  const x = cx + Math.cos(a) * (r + bob), y = cy + Math.sin(a) * (r + bob);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#ffb347'; ctx.strokeStyle = 'rgba(90,50,0,0.85)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  drawLabel(`★ ${t.label} · ${Math.round(d / TILE)}`, x - Math.cos(a) * 4, y + (Math.sin(a) > 0 ? -16 : 22), '#ffe9c0');
}
function drawSeasonFx() {
  const s = season(), t = performance.now() / 1000, n = Math.floor([0, 14, 30][profile.settings.particles]);
  const [r, g, b, a] = s.tint; ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fillRect(0, 0, VW, VH);
  const col = { petal: 'rgba(255,182,206,0.9)', pollen: 'rgba(255,240,160,0.75)', leaf: 'rgba(224,120,40,0.9)', snow: 'rgba(255,255,255,0.9)' }[s.fx];
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const sp = s.fx === 'pollen' ? 14 : 26 + (i % 5) * 7, y = ((i * 61.3 + t * sp) % (VH + 20)) - 10;
    const x = ((i * 137.7) % VW) + Math.sin(t * 0.9 + i) * (s.fx === 'leaf' ? 22 : 12);
    if (s.fx === 'leaf') { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t + i) * 1.2); ctx.fillRect(-2.5, -1.5, 5, 3); ctx.restore(); } else { ctx.beginPath(); ctx.arc(x, y, s.fx === 'snow' ? 1.8 : 1.6, 0, 7); ctx.fill(); }
  }
}
function drawRain() {
  if (game.weather.kind === 'snow') {                                                  // winter precipitation falls slowly and sideways-drifting
    const w = game.weather; if (w.intensity < 0.03) return;
    const n = Math.floor(w.intensity * [40, 80, 140][profile.settings.particles]), t = performance.now() / 1000;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < n; i++) { const y = ((i * 47.3 + t * (50 + (i % 5) * 12)) % (VH + 20)) - 10, x = ((i * 131.9) % (VW + 30)) + Math.sin(t * 1.3 + i) * 14; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.5, 0, 7); ctx.fill(); }
    return;
  }
  const w = game.weather; if (w.intensity < 0.03) return;
  const n = Math.floor(w.intensity * [45, 95, 160][profile.settings.particles]), t = performance.now() / 1000;
  ctx.strokeStyle = 'rgba(200,222,255,0.55)'; ctx.lineWidth = 1.1; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 560 + (i % 7) * 45, y = ((i * 53.7 + t * sp) % (VH + 50)) - 25, x = ((i * 137.51) % (VW + 40)) - 20 - y * 0.12;
    ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + 11);
  }
  ctx.stroke();
}
function drawRainbow() {
  const w = game.weather; if (w.rainbow <= 0) return;
  const a = Math.min(1, w.rainbow / 6, (45 - w.rainbow) / 4 + 0.05) * 0.42;
  const cx = VW / 2, cy = VH * 0.62, R = Math.min(VW * 0.62, VH * 0.5);
  const cols = ['#ff5a5a', '#ff9a4a', '#ffe14a', '#6bdc5a', '#4ab4ff', '#6a5aff', '#b05aff'];
  ctx.lineWidth = 7; ctx.globalAlpha = Math.max(0, a);
  cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R - i * 6.5, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke(); });
  ctx.globalAlpha = 1;
}

function drawFence(fx, fy, fw, fh, st) {
  const edges = [[fx, fy, fx + fw, fy], [fx, fy + fh, fx + fw, fy + fh], [fx, fy, fx, fy + fh], [fx + fw, fy, fx + fw, fy + fh]];
  ctx.lineCap = 'butt';
  for (const [x1, y1, x2, y2] of edges) {
    const horiz = y1 === y2, len = horiz ? x2 - x1 : y2 - y1;
    if (st.id === 'stone') {                                         // little rounded stones
      for (let d = 0; d < len; d += 12) {
        const x = horiz ? x1 + d : x1, y = horiz ? y1 : y1 + d, k = hash2(Math.floor(x / 12), Math.floor(y / 12));
        ctx.fillStyle = k > 0.5 ? st.rail : st.post; ctx.beginPath(); ctx.ellipse(x + 6, y - 2, 7, 5.5, 0, 0, 7); ctx.fill();
        if (st.moss && k > 0.72) { ctx.fillStyle = '#5f9a47'; ctx.beginPath(); ctx.ellipse(x + 4, y - 5, 4, 2.2, 0, 0, 7); ctx.fill(); }
      }
      continue;
    }
    ctx.strokeStyle = st.rail; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1 - 3); ctx.lineTo(x2, y2 - 3); ctx.stroke();
    if (st.stripe) { ctx.strokeStyle = st.stripe; ctx.lineWidth = 4; ctx.setLineDash([9, 9]); ctx.beginPath(); ctx.moveTo(x1, y1 - 3); ctx.lineTo(x2, y2 - 3); ctx.stroke(); ctx.setLineDash([]); }
    if (st.id === 'picket' || st.id === 'candy') {
      const step = st.id === 'picket' ? 8 : 16;
      for (let d = 0; d < len; d += step) {
        const x = horiz ? x1 + d : x1, y = horiz ? y1 : y1 + d;
        ctx.fillStyle = st.plank; ctx.fillRect(x - 1.6, y - 11, 3.4, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 1.2, y - 11, 0.8, 12);
      }
    }
  }
  ctx.fillStyle = st.post;                                          // posts at every tile
  for (let i = 0; i <= fw / TILE; i++) { ctx.fillRect(fx + i * TILE - 2.5, fy - 9, 5, 12); ctx.fillRect(fx + i * TILE - 2.5, fy + fh - 6, 5, 12); }
  for (let j = 0; j <= fh / TILE; j++) { ctx.fillRect(fx - 2.5, fy + j * TILE - 8, 5, 12); ctx.fillRect(fx + fw - 2.5, fy + j * TILE - 8, 5, 12); }
}

function drawJumbo(j) {
  const def = SLIMES[j.type], size = jumboSize(j), tm = performance.now() / 1000, d = dist(j.x, j.y, game.player.x, game.player.y);
  if (j.state === 'gone') {                                          // a shiny puddle where it will grow back
    ctx.fillStyle = 'rgba(' + (def.glow ? '180,255,200' : '255,255,255') + ',0.22)'; ctx.beginPath(); ctx.ellipse(j.x, j.y + 10, 30, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = def.color; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(j.x, j.y + 10, 22, 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    const sp = Math.sin(tm * 3 + j.x) * 0.5 + 0.5, pi = Assets.get('particles');
    if (pi) { ctx.globalAlpha = 0.4 + sp * 0.5; ctx.drawImage(pi, PART.spark * PARTICLE_CELL, 0, PARTICLE_CELL, PARTICLE_CELL, j.x - 8, j.y - 4 - sp * 6, 16, 16); ctx.globalAlpha = 1; }
    if (d < 170) drawLabel(`💤 back in ~${Math.max(1, Math.ceil(j.timer / 60))} min`, j.x, j.y - 22, '#d8e8ff');
    return;
  }
  const img = Assets.get('jumbo_' + j.type), w = 112 * size;
  const frame = j.state === 'popping' || j.fed / j.goal > 0.85 ? 2 : j.wob > 0 ? 1 : 0;
  const pulse = j.state === 'popping' ? Math.sin(tm * 60) * 0.06 : Math.sin(tm * 2 + j.x) * 0.012 + Math.sin(tm * 22) * 0.05 * Math.min(1, j.wob);
  const jx = j.state === 'popping' ? Math.sin(tm * 80) * 2.5 : 0;
  shadow(j.x, j.y + 16 * size, w * 0.42, 9 * size, 0.3);
  ctx.save(); ctx.translate(j.x + jx, j.y + 18 * size); ctx.scale(1 + pulse, 1 - pulse * 0.8);
  if (img) ctx.drawImage(img, frame * 160, 0, 160, 160, -w / 2, -w * 0.9, w, w);
  else { ctx.fillStyle = def.color; ctx.beginPath(); ctx.ellipse(0, -w * 0.4, w * 0.45, w * 0.38, 0, 0, 7); ctx.fill(); }
  if (j.state === 'popping') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.25 * Math.sin(tm * 50); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -w * 0.4, w * 0.45, w * 0.38, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.restore();
  if (d < 200 && j.state === 'alive') drawLabel(`👑 Jumbo ${def.name}`, j.x, j.y - w * 0.95 + 18 * size, '#fff3b0');
}
function drawNpc(n) {
  const st = npcState(n.id), img = Assets.get('npcs'), tm = performance.now() / 1000, x = n.x * TILE + TILE / 2, y = n.y * TILE + TILE / 2;
  const bob = Math.abs(Math.sin(tm * 2 + n.cell)) * 1.4, size = 54;
  shadow(x, y + 12, 10, 3.5, 0.3);
  if (img) ctx.drawImage(img, n.cell * 96, 0, 96, 96, x - size / 2, y + 12 - size * 0.92 - bob, size, size);
  else { ctx.fillStyle = n.color; ctx.fillRect(x - 7, y - 24 - bob, 14, 26); }
  const sf = storyFor(n.id), ss = ensureStory();
  let glyph = !st ? '' : st.status === 'idle' ? '!' : st.status === 'active' ? (npcReady(st) ? '?' : '…') : 'z';
  let col = st && st.status === 'idle' ? '#ffd54a' : st && st.status === 'active' ? (npcReady(st) ? '#7fe36a' : '#e8e8f0') : '#8fa0b8';
  if (sf) { glyph = ss.status === 'active' ? (storyReady() ? '★' : '…') : '★'; col = ss.status === 'active' && !storyReady() ? '#e8e8f0' : '#ffb347'; }
  const by = y - 46 - bob - Math.sin(tm * 4) * 1.5;
  if (glyph) {                                                              // Wren after the story has nothing to ask, so no bubble
    ctx.fillStyle = 'rgba(30,20,40,0.82)'; ctx.beginPath(); ctx.arc(x, by, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, by + 1); ctx.textBaseline = 'alphabetic';
  }
  if (dist(x, y, game.player.x, game.player.y) < 110) drawLabel(`${n.name}${st && st.status === 'cooldown' ? ` · ${Math.ceil(st.cool / 60)} min` : ''}`, x, y - 62, '#ffffff');
}
function drawEgg(e) {
  const img = Assets.get('egg'), tm = performance.now() / 1000, near = e.t / EGG_HATCH, h = SLIMES[e.type], wob = near > 0.7 ? Math.sin(tm * (10 + near * 20)) * 0.18 * near : 0;
  shadow(e.x, e.y + 10, 11, 4, 0.25);
  ctx.save(); ctx.translate(e.x, e.y + 10); ctx.rotate(wob);
  if (img) ctx.drawImage(img, -21, -38, 42, 42); else { ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.ellipse(0, -16, 10, 13, 0, 0, 7); ctx.fill(); }
  const pa = HYBRIDS.find(x => x.id === e.type);                       // parent colours as spots on the shell
  ctx.fillStyle = SLIMES[pa.a].color; ctx.beginPath(); ctx.arc(-4, -14, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = SLIMES[pa.b].color; ctx.beginPath(); ctx.arc(4, -18, 3.4, 0, 7); ctx.fill();
  ctx.restore();
}
function drawBouncer(b) {
  const img = Assets.get('bouncer'), f = b.squash > 0.3 ? 1 : 0;
  shadow(b.x, b.y + 14, 17, 5, 0.25);
  if (img) ctx.drawImage(img, f * 64, 0, 64, 64, b.x - 28, b.y - 38 + (f ? 4 : 0), 56, 56);
  else { ctx.fillStyle = '#c04ad0'; ctx.beginPath(); ctx.ellipse(b.x, b.y - 4, 18, 11, 0, 0, 7); ctx.fill(); }
}
function drawChest(ch) {
  if (!tideChestVisible(ch)) return;
  const img = Assets.get('chest');
  shadow(ch.x, ch.y + 12, 16, 5, 0.28);
  if (img) ctx.drawImage(img, (ch.open ? 1 : 0) * 64, 0, 64, 64, ch.x - 24, ch.y - 34, 48, 48);
  else { ctx.fillStyle = '#9a5a2a'; ctx.fillRect(ch.x - 14, ch.y - 14, 28, 20); }
  if (!ch.open && ch.rich) { const gl = Assets.get('glow'); if (gl) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() * 0.005); ctx.drawImage(gl, ch.x - 24, ch.y - 40, 48, 48); ctx.globalAlpha = 1; } }
}
function drawOrb(o) {
  const img = Assets.get('skyorb'), tm = performance.now(), bob = Math.sin(tm * 0.004 + o.x) * 3, y = o.y - o.h + bob;
  shadow(o.x, o.y + 6, 8, 3, 0.16);
  ctx.strokeStyle = 'rgba(255,240,170,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(o.x, o.y + 4); ctx.lineTo(o.x, y + 14); ctx.stroke(); ctx.setLineDash([]);
  if (img) ctx.drawImage(img, o.x - 19, y - 19, 38, 38); else { ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(o.x, y, 9, 0, 7); ctx.fill(); }
}

function drawCorral(c) {
  const sz = CORRAL_SIZES[c.owned ? c.size : 0];
  const fx = c.lot.x * TILE, fy = c.lot.y * TILE, fw = sz.w * TILE, fh = sz.h * TILE;
  const sg = corralSign(c), signImg = Assets.get('sign'), props = Assets.get('corral_props');
  if (!c.owned) {                                                   // lot for sale: dashed outline + posts
    ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(fx, fy, fw, fh); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const [x, y] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) ctx.fillRect(x - 3, y - 8, 6, 12);
    ctx.globalAlpha = 0.9; if (signImg) ctx.drawImage(signImg, sg.x - 23, sg.y - 46, 46, 46); ctx.globalAlpha = 1;
    drawLabel(`🐾 $${c.price}`, sg.x, sg.y - 52, '#fff3b0');
    return;
  }
  if (c.bedding > 0) {                                              // straw patches
    const n = 8 + c.bedding * 10;
    ctx.fillStyle = c.bedding > 1 ? 'rgba(240,200,110,0.55)' : 'rgba(225,200,130,0.45)';
    for (let i = 0; i < n; i++) {
      const hx = hash2(c.id * 17 + i, 3), hy = hash2(c.id * 29 + i, 11);
      ctx.beginPath(); ctx.ellipse(fx + 14 + hx * (fw - 28), fy + 14 + hy * (fh - 28), 9, 4, hx * 3, 0, 7); ctx.fill();
    }
  }
  drawFence(fx, fy, fw, fh, FENCE_STYLES.find(f => f.id === c.fence) || FENCE_STYLES[0]);
  if (signImg) ctx.drawImage(signImg, sg.x - 23, sg.y - 46, 46, 46);
  drawLabel(`${corralPop(c)}/${corralCap(c)}`, sg.x, sg.y - 50, '#ffffff');
  if (c.feeder > 0) {                                               // trough in the top-left corner, food heap grows with stock
    const x = fx + TILE * 0.95, y = fy + TILE * 1.0;
    drawList.push({ y: y + 6, fn: () => {
      shadow(x, y + 8, 18, 5, 0.22);
      if (props) ctx.drawImage(props, 0, 0, 64, 64, x - 22, y - 30, 44, 44); else { ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x - 18, y - 12, 36, 16); }
      const types = Object.keys(c.stock);
      types.slice(0, 5).forEach((t, i) => { ctx.fillStyle = FOODS[t].color; ctx.beginPath(); ctx.arc(x - 12 + i * 6, y - 11, 3.2, 0, 7); ctx.fill(); });
      const lvl = feederTotal(c) / feederCap(c);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 15, y + 3, 30, 3); ctx.fillStyle = lvl > 0.25 ? '#7fd96a' : '#ffb347'; ctx.fillRect(x - 15, y + 3, 30 * lvl, 3);
    } });
  }
  if (c.basket > 0) {                                               // basket in the bottom-right corner
    const x = fx + fw - TILE * 0.95, y = fy + fh - TILE * 0.8, n = basketTotal(c);
    drawList.push({ y: y + 6, fn: () => {
      shadow(x, y + 8, 17, 5, 0.22);
      if (props) ctx.drawImage(props, 64, 0, 64, 64, x - 23, y - 36, 46, 46); else { ctx.fillStyle = '#c8954f'; ctx.fillRect(x - 14, y - 14, 28, 18); }
      const kinds = Object.keys(c.bin);
      kinds.slice(0, 4).forEach((t, i) => { ctx.fillStyle = SLIMES[t].plort.color; ctx.beginPath(); ctx.arc(x - 9 + i * 6, y - 15, 3.4, 0, 7); ctx.fill(); });
      if (n) drawLabel(String(n), x, y - 38, '#fff7d0');
    } });
  }
}

function drawLabel(text, x, y, color) {
  ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(text, x, y);
  ctx.direction = isRtl() ? 'rtl' : 'ltr'; ctx.fillStyle = color; ctx.fillText(tr(text), x, y);
}

/* ---------------- lighting (day/night) ---------------- */
function drawLighting(camX, camY) {
  let [r, g, b, a] = ambientAt(game.time);
  const wi = game.weather.intensity;
  if (wi > 0.01) { r = lerp(r, 70, wi * 0.5); g = lerp(g, 90, wi * 0.5); b = lerp(b, 130, wi * 0.5); a = Math.min(0.78, a + 0.17 * wi); }
  if (a < 0.015) return;
  if (!profile.settings.lighting) { ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a * 0.55})`; ctx.fillRect(0, 0, VW, VH); return; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.globalCompositeOperation = 'destination-out';
  const glow = Assets.get('glow');
  const na = nightAmount(game.time);
  const hole = (wx, wy, rad, str) => {
    const sx = (wx - camX) * LS, sy = (wy - camY) * LS, rr = rad * LS;
    if (sx < -rr || sy < -rr || sx > lightCv.width + rr || sy > lightCv.height + rr) return;
    lctx.globalAlpha = Math.min(1, str);
    if (glow) lctx.drawImage(glow, sx - rr, sy - rr, rr * 2, rr * 2);
    else { const gr = lctx.createRadialGradient(sx, sy, 0, sx, sy, rr); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); lctx.fillStyle = gr; lctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
  };
  const p = game.player;
  hole(p.x, p.y, (game.gear.lantern ? 270 : 175) + (game.powers.glowsense ? 45 : 0), 1);
  const shop = features.find(f => f.type === 'shop');
  hole((shop.x + shop.w / 2) * TILE, (shop.y + shop.h) * TILE - 20, 150, 0.95);
  for (const s of game.slimes) if (s.def.glow) hole(s.x, s.y - s.z, 85, 0.9);
  for (const pl of game.plorts) hole(pl.x, pl.y - pl.z, 34, 0.75);
  for (const d of game.decor) { const l = DECOR_ITEMS[d.type].light; if (l) hole(d.x, d.y - 14, l, 0.95); }
  for (const t of game.treasures) if (t.type === 'starshard') hole(t.x, t.y - t.z, 55, 0.9);
  for (const sp of game.spots) hole(sp.x, sp.y, game.powers.glowsense ? 70 : 34, 0.55);
  for (const o of game.orbs) if (!o.taken) hole(o.x, o.y - o.h, 40, 0.8);
  for (const j of game.jumbos) if (j.state !== 'gone' && SLIMES[j.type].glow) hole(j.x, j.y - 20, 110, 0.8);
  for (const q of game.particles) if (q.firefly) hole(q.x, q.y, 20, 0.8 * Math.min(1, q.life));
  for (const g of glowProps) hole(g.x, g.y, 100, 0.85);
  const cave = features.find(f => f.type === 'cave');
  if (na > 0.1) hole((cave.x + cave.w / 2) * TILE, (cave.y + cave.h / 2) * TILE, 150, 0.35);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  ctx.drawImage(lightCv, 0, 0, VW, VH);
}

/* ---------------- main render ---------------- */
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#1d1530'; ctx.fillRect(0, 0, VW, VH);

  const shk = game.shake > 0 ? game.shake * 16 : 0;
  const camX = Math.round(game.camera.x - VW / 2 + (shk ? (Math.random() - 0.5) * shk : 0)), camY = Math.round(game.camera.y - VH / 2 + (shk ? (Math.random() - 0.5) * shk : 0));
  const tx0 = Math.max(0, Math.floor(camX / TILE) - 1), ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const tx1 = Math.min(WORLD_W, Math.ceil((camX + VW) / TILE) + 1), ty1 = Math.min(WORLD_H, Math.ceil((camY + VH) / TILE) + 1);
  const atlas = Assets.get('tiles'), waterImg = Assets.get('water'), decorImg = Assets.get('decor');
  const tm = performance.now();

  ctx.save();
  ctx.translate(-camX, -camY);
  drawList.length = 0; glowProps.length = 0;
  renderCam.x = camX; renderCam.y = camY; cullL = camX; cullT = camY; cullR = camX + VW; cullB = camY + VH;

  // tiles
  for (let x = tx0; x < tx1; x++) for (let y = ty0; y < ty1; y++) {
    let t = world[x][y];
    const h = hash2(x, y), v = Math.min(ATLAS_VARIANTS - 1, Math.floor(h * ATLAS_VARIANTS));
    const base = t === T.BOULDER ? T.GRASS : t;
    if ((t === T.WATER || t === T.LILY) && waterImg) {
      const wf = (Math.floor(tm / 280) + x + y) % 4;   // 4 animation frames in water.png
      ctx.drawImage(waterImg, wf * ATLAS_TILE, 0, ATLAS_TILE, ATLAS_TILE, x * TILE, y * TILE, TILE + 0.6, TILE + 0.6);
    } else if (atlas) ctx.drawImage(atlas, base * ATLAS_TILE, v * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE, x * TILE, y * TILE, TILE + 0.6, TILE + 0.6);
    else { ctx.fillStyle = TILE_COLOR[base][v & 1]; ctx.fillRect(x * TILE, y * TILE, TILE + 0.6, TILE + 0.6); }
    if (t === T.LILY) {
      const li = Assets.get('lily'), bob = Math.sin(tm * 0.002 + x * 1.7 + y) * 1.2;
      if (li) ctx.drawImage(li, (h > 0.5 ? 1 : 0) * 64, 0, 64, 64, x * TILE - 6, y * TILE - 13 + bob, 48, 48);
      else { ctx.fillStyle = '#4cb85a'; ctx.beginPath(); ctx.ellipse(x * TILE + TILE / 2, y * TILE + TILE / 2, 15, 9, 0, 0, 7); ctx.fill(); }
    }
    // small scenery sprites on top of the ground (flowers, tufts, mushrooms, bushes)
    if (decorImg && (t === T.GRASS || t === T.ORCHARD || t === T.CAVE || t === T.SAND || t === T.MOSS)) {
      const d = hash2(x * 7 + 3, y * 13 + 1);
      let di = -1;
      if (t === T.GRASS && d < 0.16) di = d < 0.04 ? DECOR.flowerR : d < 0.08 ? DECOR.flowerY : d < 0.115 ? DECOR.flowerW : d < 0.15 ? DECOR.tuft : DECOR.bush;
      else if (t === T.ORCHARD && d < 0.1) di = d < 0.05 ? DECOR.flowerW : DECOR.mushroom;
      else if (t === T.CAVE && d < 0.07) di = DECOR.glowShroom;
      else if (t === T.MOSS && d < 0.12) di = d < 0.06 ? DECOR.mushroom : d < 0.09 ? DECOR.glowShroom : DECOR.flowerW;
      else if (t === T.SAND && d < 0.05) di = DECOR.reeds;
      if (di >= 0) {
        const o = hash2(x + 9, y + 4) * 8 - 4;
        ctx.drawImage(decorImg, di * DECOR_CELL, 0, DECOR_CELL, DECOR_CELL, x * TILE + 5 + o, y * TILE + 5 + o * 0.5, 26, 26);
      }
    }
    if (t === T.BOULDER) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 3;
      drawList.push({ y: cy, fn: () => { const im = Assets.get('boulder'); shadow(cx, cy, 14, 4, 0.25); if (im) ctx.drawImage(im, cx - 20, cy - 33, 40, 34); else { ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(cx, cy - 12, 12, 0, 7); ctx.fill(); } } });
    } else if (t === T.ORCHARD && h > 0.88) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 2;
      drawList.push({ y: cy, fn: () => { const im = Assets.get('tree'); shadow(cx, cy, 14, 4, 0.22); if (im) ctx.drawImage(im, cx - 26, cy - 66, 52, 65); else { ctx.fillStyle = '#4a8f34'; ctx.beginPath(); ctx.arc(cx, cy - 36, 20, 0, 7); ctx.fill(); } } });
    } else if (t === T.MOSS && h > 0.955 && !noProp.has(x * 1000 + y)) {                       // giant mushrooms (red, glowing blue, purple)
      const gi = Assets.get('grove'), cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 2, k = Math.min(2, Math.floor(hash2(x + 5, y + 9) * 3));
      if (k === 1) glowProps.push({ x: cx, y: cy - 34 });
      drawList.push({ y: cy, fn: () => { shadow(cx, cy, 16, 4.5, 0.22); if (gi) ctx.drawImage(gi, k * 64, 0, 64, 80, cx - 32, cy - 76, 64, 80); else { ctx.fillStyle = '#d04a60'; ctx.beginPath(); ctx.arc(cx, cy - 40, 18, 0, 7); ctx.fill(); } } });
    } else if (t === T.SNOW && h > 0.945 && !noProp.has(x * 1000 + y)) {                                   // Frostpeak scenery: snowy pines, rocks, crystals, the odd igloo
      const pi = Assets.get('peak'), cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 2, k = h > 0.995 ? 3 : h > 0.985 ? 2 : h > 0.97 ? 1 : 0;
      if (k === 2) glowProps.push({ x: cx, y: cy - 24 });
      drawList.push({ y: cy, fn: () => { shadow(cx, cy, 14, 4, 0.2); if (pi) ctx.drawImage(pi, k * 64, 0, 64, 80, cx - 32, cy - 74, 64, 80); else { ctx.fillStyle = '#2a7a4a'; ctx.beginPath(); ctx.arc(cx, cy - 40, 16, 0, 7); ctx.fill(); } } });
    } else if (t === T.SAND && y >= BEACH_TOP && y < seaLine(x) - 2 && h > 0.95 && !noProp.has(x * 1000 + y)) {                       // beach scenery: palms, castles, driftwood, tide-pool rocks
      const bi = Assets.get('beach'), cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 2, k = h > 0.99 ? 1 : h > 0.978 ? 2 : h > 0.964 ? 3 : 0;
      drawList.push({ y: cy, fn: () => { if (bi) ctx.drawImage(bi, k * 64, 0, 64, 80, cx - 32, cy - 74, 64, 80); else { ctx.fillStyle = '#4a9a3a'; ctx.beginPath(); ctx.arc(cx, cy - 40, 16, 0, 7); ctx.fill(); } } });
    } else if (t === T.CAVE && h > 0.9) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE - 3;
      drawList.push({ y: cy, fn: () => { const im = Assets.get('crystal'); if (im) ctx.drawImage(im, cx - 14, cy - 34, 28, 34); else { ctx.fillStyle = '#9ae'; ctx.fillRect(cx - 4, cy - 20, 8, 20); } } });
    }
  }

  for (const c of game.corrals) drawCorral(c);
  // features
  for (const f of features) {
    if (f.type === 'shop') drawList.push({ y: (f.y + f.h) * TILE, fn: () => drawShopSprite(f) });
  }

  // entities (y-sorted)
  for (const f of game.foods) if (vis(f.x, f.y)) drawList.push({ y: f.y, fn: () => drawItem(f, 'food') });
  for (const pl of game.plorts) if (vis(pl.x, pl.y)) drawList.push({ y: pl.y, fn: () => drawItem(pl, 'plort') });
  for (const t of game.treasures) if (vis(t.x, t.y)) drawList.push({ y: t.y, fn: () => drawItem(t, 'treasure') });
  for (const pt of game.plots) drawList.push({ y: pt.y + 8, fn: () => drawPlot(pt) });
  for (const d of game.decor) drawList.push({ y: d.y + 8, fn: () => drawDecor(d) });
  for (const sp of game.spots) if (vis(sp.x, sp.y)) drawList.push({ y: sp.y, fn: () => drawSpot(sp) });
  if (game.surv || game.hostSurv) {
    for (const n of game.nodes) if (vis(n.x, n.y, 40)) drawList.push({ y: n.y, fn: () => drawNode(n) });
    for (const c of game.critters) if (vis(c.x, c.y, 60)) drawList.push({ y: c.y, fn: () => drawCritter(c) });
  }
  for (const j of game.jumbos) if (vis(j.x, j.y, 160)) drawList.push({ y: j.y + (j.state === 'gone' ? -20 : 12), fn: () => drawJumbo(j) });
  for (const n of NPCS) if (vis(n.x * TILE, n.y * TILE)) drawList.push({ y: n.y * TILE + TILE / 2 + 12, fn: () => drawNpc(n) });
  if (wrenVisible()) { const w = wrenNpc(); if (vis(w.x * TILE, w.y * TILE)) { drawList.push({ y: w.y * TILE + TILE / 2 + 12, fn: () => drawNpc(w) }); glowProps.push({ x: w.x * TILE + TILE / 2 + 14, y: w.y * TILE + TILE / 2 - 6 }); } }                                // Wren and her little lantern
  for (const e of game.eggs) drawList.push({ y: e.y + 4, fn: () => drawEgg(e) });
  for (const b of game.bouncers) if (vis(b.x, b.y)) drawList.push({ y: b.y + 8, fn: () => drawBouncer(b) });
  for (const ch of game.chests) if (vis(ch.x, ch.y)) drawList.push({ y: ch.y + 6, fn: () => drawChest(ch) });
  for (const o of game.orbs) if (!o.taken && vis(o.x, o.y - o.h)) drawList.push({ y: o.y + 40, fn: () => drawOrb(o) });
  for (const s of game.slimes) if (vis(s.x, s.y)) drawList.push({ y: s.y, fn: () => drawSlimeSprite(s) });
  const p = game.player;
  if (p.sucking) drawList.push({ y: p.y - 0.5, fn: () => drawVacBeam(p) });
  drawList.push({ y: p.y, fn: () => drawPlayerSprite(p) });
  if (netActive()) {                                                      // friends (js/net.js)
    const me = NET.players.get(NET.id);
    drawList.push({ y: p.y + 0.5, fn: () => drawNetTag(me || { name: netMyName(), color: netMyColor(), story: netMyStory(), emote: NET.myEmoteT > 0 ? NET.myEmote : '', emoteT: NET.myEmoteT }, p.x, p.y, p.z, true) });
    for (const rp of NET.players.values()) if (rp.id !== NET.id && rp.seen && vis(rp.x, rp.y, 80)) drawList.push({ y: rp.y, fn: () => { drawPlayerSprite({ x: rp.x, y: rp.y, z: rp.z, aim: rp.aim, moving: rp.moving, walkT: rp.walkT, facing: rp.facing, sucking: false, gliding: false }); drawNetTag(rp, rp.x, rp.y, rp.z, false); } });
  }
  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();

  // area labels
  for (const f of features) {
    if (f.type === 'orchard') drawLabel('🌳 Orchard', (f.x + f.w / 2) * TILE, f.y * TILE - 8, '#fff7d0');
    if (f.type === 'cave') drawLabel('💎 Crystal Cave', (f.x + f.w / 2) * TILE, f.y * TILE - 12, '#d8f4ff');
    if (f.type === 'garden') drawLabel('🥕 Garden', (f.x + f.w / 2) * TILE, f.y * TILE - 4, '#eaffd0');
    if (f.type === 'grove') drawLabel(AREAS.grove.label, (f.x + f.w / 2) * TILE, (f.y + 2) * TILE, '#e8d8ff');
  }

  if (lowTideActive()) { const px = game.player.x / TILE; if (game.player.y > (BEACH_TOP - 10) * TILE) drawLabel('🌊 Low tide', game.player.x, game.player.y - 66, '#d8f4ff'); }
  drawShootingStar();
  if (game.surv) drawSurvFx();
  const it = game.interact;
  if (it && it.x !== undefined && !inPhotoMode()) {
    const bob = Math.sin(performance.now() * 0.006) * 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(it.x, it.y + 5, 17, 8, 0, 0, 7); ctx.stroke();
    drawLabel(`${it.icon} ${it.label}`, it.x, it.y - 30 + bob, '#ffffff');
  }

  // particles
  const glow = Assets.get('glow'), partImg = Assets.get('particles');
  for (const q of game.particles) {
    ctx.globalAlpha = Math.min(1, q.life);
    if (q.firefly && glow) { ctx.globalAlpha = 0.9 * Math.min(1, q.life); ctx.drawImage(glow, q.x - 8, q.y - 8, 16, 16); ctx.fillStyle = '#fff'; ctx.fillRect(q.x - 0.8, q.y - 0.8, 1.6, 1.6); }
    else if (q.spr !== undefined) { if (partImg) ctx.drawImage(partImg, q.spr * PARTICLE_CELL, 0, PARTICLE_CELL, PARTICLE_CELL, q.x - 7, q.y - 7, 14, 14); else { ctx.fillStyle = q.color; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); } }
    else { ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawLighting(camX, camY);
  drawSeasonFx(); drawRain(); drawRainbow();
  if (auroraOn) drawAurora();                                           // after the night overlay, so the ribbons really glow
  if (game.gear.compass && !inPhotoMode()) drawCompass(camX, camY);
  if (!inPhotoMode() && game.state === 'playing' && !game.visitor) drawStoryGuide(camX, camY);
  if (game.photo && game.photo.shoot) { game.photo.shoot = false; capturePhoto(); }
}
