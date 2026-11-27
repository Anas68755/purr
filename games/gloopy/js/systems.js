'use strict';
/* ---------------- helpers ---------------- */
function nearPlayer(x, y, r) { const p = game.player; return p && dist(x, y, p.x, p.y) < r; }

function spawnHeart(x, y) {
  if (game.particles.length < 420) game.particles.push({ x, y, vx: rand(-8, 8), vy: -24, color: '#ff6b9d', life: 1.3, size: 0, g: -4, spr: PART.heart });
}
function spawnParticles(x, y, n, color, o = {}) {
  const cap = [70, 180, 420][profile.settings.particles];
  for (let i = 0; i < n && game.particles.length < cap; i++) {
    game.particles.push({
      x: x + rand(-3, 3), y: y + rand(-3, 3),
      vx: rand(-1, 1) * (o.spread || 30), vy: rand(-1, 0.1) * (o.up || 45),
      color, life: o.life || 0.8, size: rand(1.5, 3), g: o.g === undefined ? 80 : o.g
    });
  }
}

function moveWithCollision(o, dx, dy, r, air = false) {
  let hit = false;
  if (dx) { if (!blockedAt(o.x + dx, o.y, r, air)) o.x += dx; else hit = true; }
  if (dy) { if (!blockedAt(o.x, o.y + dy, r, air)) o.y += dy; else hit = true; }
  return hit;
}

/* ---------------- player ---------------- */
function ringFx(x, y, color) {
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (game.particles.length < 420) game.particles.push({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 4, vx: Math.cos(a) * 46, vy: Math.sin(a) * 22, color, life: 0.5, size: 2, g: 0 }); }
}
function splashFx(x, y) {
  spawnParticles(x, y, 14, '#bfe4ff', { spread: 46, up: 80, life: 0.8 }); ringFx(x, y, '#e8f6ff');
}
function nearestDryTile(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); let best = null, bd = TILE * 1.15;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const x = tx + dx, y = ty + dy;
    if (x < 1 || y < 1 || x >= WORLD_W - 1 || y >= WORLD_H - 1 || isBlocking(x, y)) continue;
    const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2, d = dist(px, py, cx, cy);
    if (d < bd) { bd = d; best = { x: cx, y: cy }; }
  }
  return best;
}
function landPlayer(p) {
  const fall = -p.vz; p.z = 0; p.vz = 0;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), t = world[tx] ? world[tx][ty] : T.GRASS;
  if (t === T.WATER) {
    splashFx(p.x, p.y);
    if (game.powers.skipping) { p.vz = JUMP_V * 0.95; p.z = 0.5; p.djUsed = false; Sound.play('water', 0.5, 1.25); stat('skips'); return; }
    const snap = nearestDryTile(p.x, p.y);                   // edge forgiveness: a jump that lands just short grabs the pad or shore
    if (snap) { p.x = snap.x; p.y = snap.y; Sound.play('water', 0.4, 1.3); return; }
    Sound.play('water', 0.8); stat('splashes');
    const sf = p.safe || { x: p.x, y: p.y + 60 }; p.x = sf.x; p.y = sf.y;
    showAlert('💦 Splash! Back on dry land', 1600);
    return;
  }
  if (blockedAt(p.x, p.y, 7)) { const f = findFreeSpot(p.x, p.y); p.x = f.x; p.y = f.y; }
  if (fall > 140) spawnParticles(p.x, p.y + 8, 6, 'rgba(235,225,200,0.9)', { spread: 34, up: 8, life: 0.45, g: 0 });
}
function updatePlayer(dt) {
  const p = game.player;
  let mx = input.mx, my = input.my;
  if (Math.hypot(mx, my) < 0.1) {
    mx = 0; my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1;
    if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
  }
  const mag = Math.hypot(mx, my);
  p.moving = mag > 0.15;
  if (p.moving) {
    const nx = mx / mag, ny = my / mag;
    const sp = getPlayerSpeed() * 60 * Math.min(1, mag * 1.25) * dt * (p.gliding ? 1.2 : 1);
    moveWithCollision(p, nx * sp, ny * sp, 7, p.z > 0 || p.vz > 0);
    p.aim += angleDiff(Math.atan2(ny, nx), p.aim) * Math.min(1, dt * 14);
    if (Math.abs(nx) > 0.2) p.facing = nx < 0 ? -1 : 1;
    p.walkT += dt * 9;
  }
  const ma = mouseAimAngle(p);
  if (ma !== null) { p.aim = ma; if (Math.abs(Math.cos(ma)) > 0.2) p.facing = Math.cos(ma) < 0 ? -1 : 1; }
  // --- jumping: clears water and boulders in flight; lily pads, bounce mushrooms and the Jumbo powers make it worth it ---
  const pressed = input.jump && !p.jumpHeld; p.jumpHeld = input.jump;
  const grounded = !(p.z > 0 || p.vz > 0);
  if (grounded) { p.djUsed = false; if (!blockedAt(p.x, p.y, 7)) p.safe = { x: p.x, y: p.y }; }
  if (pressed) {
    if (grounded) {
      p.vz = JUMP_V * (game.powers.lift ? 1.22 : 1); Sound.play('jump', 0.7); stat('jumps'); questProgress('jump', null, 1);
      spawnParticles(p.x, p.y + 8, 5, 'rgba(235,225,200,0.9)', { spread: 26, up: 6, life: 0.4, g: 0 });
    } else if (game.powers.springy && !p.djUsed) {
      p.vz = DOUBLE_JUMP_V; p.djUsed = true; Sound.play('jump', 0.7, 1.35); stat('jumps'); questProgress('jump', null, 1);
      ringFx(p.x, p.y + 6 - p.z, '#ffffff');
    }
  }
  p.gliding = false;
  if (!grounded) {
    p.vz -= 560 * dt;
    if (game.powers.featherfall && input.jump && p.vz < 0) { p.vz = Math.max(p.vz, GLIDE_FALL); p.gliding = true; }
    p.z += p.vz * dt;
    if (p.z <= 0) landPlayer(p);
  }
  p.x = clamp(p.x, TILE, WORLD_W * TILE - TILE);
  p.y = clamp(p.y, TILE, WORLD_H * TILE - TILE);

  const k = 1 - Math.pow(0.0008, dt);
  game.camera.x = lerp(game.camera.x, p.x, k);
  game.camera.y = lerp(game.camera.y, p.y, k);
  // keep the view inside the world so no empty void shows at the edges
  const wpx = WORLD_W * TILE, hpx = WORLD_H * TILE;
  game.camera.x = wpx > VW ? clamp(game.camera.x, VW / 2, wpx - VW / 2) : wpx / 2;
  game.camera.y = hpx > VH ? clamp(game.camera.y, VH / 2, hpx - VH / 2) : hpx / 2;

  const shop = features.find(f => f.type === 'shop');
  game.nearShop = dist(p.x, p.y, (shop.x + shop.w / 2) * TILE, (shop.y + shop.h / 2) * TILE) < TILE * 2.6;
}

/* ---------------- item physics (plorts + food): bounded hop, ground friction ---------------- */
function stepItem(it, dt) {
  it.age = (it.age || 0) + dt;
  if (it.z === undefined) { it.z = 0; it.vz = 0; }
  if (it.z > 0 || it.vz > 0) {
    it.vz -= ITEM_GRAVITY * dt; it.z += it.vz * dt;
    if (it.z <= 0) { it.z = 0; it.vz = it.vz < -60 ? -it.vz * 0.35 : 0; }
  }
  it.vx = it.vx || 0; it.vy = it.vy || 0;
  if (it.vx || it.vy) {
    const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
    if (isBlocking(Math.floor(nx / TILE), Math.floor(ny / TILE))) { it.vx *= -0.3; it.vy *= -0.3; }
    else { it.x = nx; it.y = ny; }
    const f = Math.pow(it.z > 0 ? 0.6 : 0.004, dt);
    it.vx *= f; it.vy *= f;
    if (Math.abs(it.vx) < 0.5 && Math.abs(it.vy) < 0.5) { it.vx = 0; it.vy = 0; }
  }
  it.x = clamp(it.x, TILE, WORLD_W * TILE - TILE);
  it.y = clamp(it.y, TILE, WORLD_H * TILE - TILE);
  if (it.z === 0 && isBlocking(Math.floor(it.x / TILE), Math.floor(it.y / TILE))) {
    const s = findFreeSpot(it.x, it.y); it.x = s.x; it.y = s.y;
  }
}

function updateFoods(dt) {
  for (const f of game.foods) stepItem(f, dt);
  if (game.foods.length > MAX_FOODS_ON_GROUND) game.foods.splice(0, game.foods.length - MAX_FOODS_ON_GROUND);
  // a patch only regrows after its previous food was eaten / collected
  for (const patch of foodPatches) {
    if (patch.item && game.foods.indexOf(patch.item) < 0) { patch.item = null; patch.regen = rand(14, 26) * (game.powers.forager ? 0.5 : 1); }
    if (!patch.item) { patch.regen -= dt; if (patch.regen <= 0) spawnFoodFromPatch(patch); }
  }
}

function updatePlorts(dt) {
  for (const pl of game.plorts) stepItem(pl, dt);
  if (game.plorts.length > MAX_PLORTS_ON_GROUND) game.plorts.splice(0, game.plorts.length - MAX_PLORTS_ON_GROUND);
}

function updateTreasures(dt) {
  for (const t of game.treasures) stepItem(t, dt);
  if (game.treasures.length > 40) game.treasures.splice(0, game.treasures.length - 40);
}

/* ---------------- slimes ---------------- */
function penOf(s) {                       // the owned pen this slime lives in (its home spot is inside the fence)
  for (const c of game.corrals) {
    if (!c.owned) continue;
    const r = corralRect(c);
    if (s.home.x > r.x * TILE && s.home.x < (r.x + r.w) * TILE && s.home.y > r.y * TILE && s.home.y < (r.y + r.h) * TILE) return c;
  }
  return null;
}
function moveSlime(s, dx, dy) {
  const pen = penOf(s);
  if (pen) {
    const r = corralRect(pen);
    const x1 = (r.x + 0.5) * TILE, y1 = (r.y + 0.5) * TILE, x2 = (r.x + r.w - 0.5) * TILE, y2 = (r.y + r.h - 0.5) * TILE;
    const nx = clamp(s.x + dx, x1, x2), ny = clamp(s.y + dy, y1, y2);
    const hit = nx !== s.x + dx || ny !== s.y + dy;
    s.x = nx; s.y = ny;
    return hit;
  }
  return moveWithCollision(s, dx, dy, 8);
}

function slimeEat(s, food) {
  const i = game.foods.indexOf(food);
  s.target = null;
  if (i < 0) return;
  game.foods.splice(i, 1);
  const treat = !!FOODS[food.type].treat;
  s.hunger = Math.min(s.def.hunger, s.hunger + s.def.hunger * (treat ? 0.1 : 0.55));
  s.eatTimer = 1.1;
  s.makePlort = !treat && !isBaby(s) && (!s.def.rare || Math.random() < 0.65);          // babies only grow
  slimeFed(s, food.type); if (!treat) stat('foodEaten');
  spawnParticles(s.x, s.y - 6, 8, FOODS[food.type].color, { up: 60 });
  if (nearPlayer(s.x, s.y, 280)) Sound.play('eat', 0.7);
}

function producePlort(s) {
  discoverSlime(s.type, 'plort');
  const bonus = isDelighted(s) && Math.random() < (game.powers.reefcharm ? 0.8 : 0.5) + lanternBond() + lifeBonus(s);          // happy slimes sometimes give two
  const pen = penOf(s), basketOK = () => pen && pen.basket > 0 && basketTotal(pen) < basketCap(pen);
  const emit = (jx, jy) => {
    if (basketOK()) {                                           // a basket in the pen catches it
      pen.bin[s.type] = (pen.bin[s.type] || 0) + 1; stat('basketCaught');
      spawnParticles(s.x, s.y - 8, 4, s.def.plort.color, { up: 70, spread: 18, life: 0.6 });
    } else game.plorts.push({ type: s.type, x: s.x + jx, y: s.y + jy, vx: rand(-16, 16), vy: rand(-16, 16), z: 0, vz: rand(55, 90), age: 0 });
  };
  if (bonus) { emit(rand(-6, 6), rand(-4, 4)); spawnHeart(s.x, s.y - 24); }
  emit(rand(-3, 3), rand(-3, 3));
  spawnParticles(s.x, s.y - 6, 6, s.def.plort.color, { up: 55 });
  if (nearPlayer(s.x, s.y, 300)) Sound.play('plort', 0.75, rand(0.92, 1.12));
}

function updateSlimes(dt) {
  const p = game.player;
  for (const s of game.slimes) {
    const def = s.def;
    s.age += dt;
    s.hunger = Math.max(0, s.hunger - dt * (def.hungerRate || 1) * (game.powers.calm ? 0.75 : 1) * (game.powers.frostward ? 0.9 : 1) * traitHunger(s));
    s.joy = Math.max(0, s.joy - dt * 0.35);
    const pen0 = penOf(s);
    if (pen0 && pen0.bedding > 0) { const bd = CORRAL_UPGRADES.bedding, top = bd.top[pen0.bedding]; if (s.joy < top) s.joy = Math.min(top, s.joy + dt * bd.joy[pen0.bedding]); }
    if (s.petCd > 0) s.petCd -= dt;
    if (s.joy >= 50) { s.heartT -= dt; if (s.heartT <= 0) { s.heartT = rand(2.4, 4.2); spawnHeart(s.x + rand(-6, 6), s.y - 20); } }
    if (!slimeEntry(s.type).seen && dist(s.x, s.y, p.x, p.y) < 300) discoverSlime(s.type, 'seen');
    if (s.scared > 0) s.scared -= dt;
    if (s.cooldown > 0) s.cooldown -= dt;

    // thrown by the player: fly in an arc, then settle (and adopt the landing spot as home)
    if (s.fly > 0) {
      s.fly -= dt;
      moveSlime(s, s.fvx * dt, s.fvy * dt);
      s.fvx *= Math.pow(0.35, dt); s.fvy *= Math.pow(0.35, dt);
      s.z = Math.sin(Math.PI * clamp(1 - s.fly / s.flyMax, 0, 1)) * 34;
      if (s.fly <= 0) { s.z = 0; s.home = { x: s.x, y: s.y }; spawnParticles(s.x, s.y + 6, 5, def.color, { up: 20 }); }
      continue;
    }
    if (s.sucked > 0) { s.sucked -= dt; s.moving = false; s.z = Math.sin(s.age * 30) * 2 + 3; continue; }
    if (s.petT > 0) { s.petT -= dt; s.moving = false; s.z = Math.abs(Math.sin(s.age * 9)) * 2.5; continue; }

    let moving = false, speedMul = 0.45;
    if (s.eatTimer > 0) {
      s.eatTimer -= dt;
      if (s.eatTimer <= 0 && s.makePlort) { producePlort(s); s.makePlort = false; }
    } else {
      if (s.target && game.foods.indexOf(s.target) < 0) s.target = null;
      if (!s.target && s.cooldown <= 0) {
        const hungry = s.hunger < def.hunger * 0.6;
        let best = null, bd = 1e9;
        for (const f of game.foods) {
          if (f.z > 3 || !(FOODS[f.type].treat || def.food.includes(f.type))) continue;
          const d = dist(s.x, s.y, f.x, f.y);
          const ok = (f.thrown && d < 120) || (hungry && d < 260 * traitSight(s));   // player-thrown food is always attractive
          if (ok && d < bd) { best = f; bd = d; }
        }
        s.target = best; s.cooldown = 0.4;
      }
      if (s.scared > 0) {
        const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1;
        s.dx = dx / d; s.dy = dy / d; moving = true; speedMul = 1.8;
      } else if (s.target) {
        const dx = s.target.x - s.x, dy = s.target.y - s.y, d = Math.hypot(dx, dy) || 1;
        if (d < 13) slimeEat(s, s.target);
        else { s.dx = dx / d; s.dy = dy / d; moving = true; speedMul = 1.25; }
      } else {
        s.wanderTimer -= dt;
        if (s.wanderTimer <= 0) {
          s.wanderTimer = rand(1.4, 3.4);
          s.idle = Math.random() < 0.35;
          let ang = Math.random() * Math.PI * 2;
          if (dist(s.x, s.y, s.home.x, s.home.y) > def.home * TILE) ang = Math.atan2(s.home.y - s.y, s.home.x - s.x) + rand(-0.6, 0.6);
          s.dx = Math.cos(ang); s.dy = Math.sin(ang);
        }
        moving = !s.idle && (s.dx !== 0 || s.dy !== 0);
      }
    }
    s.moving = moving;
    if (moving && Math.abs(s.dx) > 0.15) s.facing = s.dx < 0 ? -1 : 1;

    // hop locomotion: only travels while airborne
    const prev = s.hop;
    s.hop = (s.hop + dt * def.hopRate * traitHop(s) * (moving ? 1 : 0.55) * (s.eatTimer > 0 ? 0.4 : 1)) % 1;
    const air = s.hop < 0.5;
    s.z = air ? Math.sin(s.hop / 0.5 * Math.PI) * (moving ? 8 : 3.5) : 0;
    if (moving && air) {
      const step = def.speed * speedMul * 150 * dt;
      if (moveSlime(s, s.dx * step, s.dy * step)) s.wanderTimer = 0;
    }
    if (prev < 0.5 && s.hop >= 0.5 && moving && nearPlayer(s.x, s.y, 200) && Math.random() < 0.18) Sound.play('hop', 0.35, rand(0.85, 1.2));
  }
  // soft separation (grid buckets: only neighbours in the same / adjacent 20px cells are compared, so a big herd stays cheap)
  const L = game.slimes, grid = new Map(), cs = 20;
  for (let i = 0; i < L.length; i++) { const k = Math.floor(L[i].x / cs) * 8192 + Math.floor(L[i].y / cs); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  for (let i = 0; i < L.length; i++) {
    const a = L[i], cx = Math.floor(a.x / cs), cy = Math.floor(a.y / cs);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const cell = grid.get(gx * 8192 + gy); if (!cell) continue;
      for (const j of cell) {
        if (j <= i) continue;
        const b = L[j], d = dist(a.x, a.y, b.x, b.y);
        if (d < 18 && d > 0.01 && a.fly <= 0 && b.fly <= 0) {
          const push = (18 - d) * 0.25, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
          if (!blockedAt(a.x + nx * push, a.y + ny * push, 8)) { a.x += nx * push; a.y += ny * push; }
          if (!blockedAt(b.x - nx * push, b.y - ny * push, 8)) { b.x -= nx * push; b.y -= ny * push; }
        }
      }
    }
  }
}

/* ---------------- vacuum ---------------- */
function inCone(dx, dy, aim) { return Math.abs(angleDiff(Math.atan2(dy, dx), aim)) < getVacCone() / 2; }

function nearestSuckable(p, range) {
  let best = null, bd = range;
  const consider = (arr, kind) => {
    for (const it of arr) {
      const d = dist(p.x, p.y, it.x, it.y);
      if (d < bd && packCanAdd(kind, it.type)) { bd = d; best = it; }
    }
  };
  consider(game.plorts, 'plort'); consider(game.foods, 'food'); consider(game.treasures, 'treasure'); consider(game.slimes, 'slime');
  return best;
}

function handleVacpack(dt) {
  const p = game.player;
  const active = input.suck && game.state === 'playing' && !game.shopOpen;
  p.sucking = active;
  Sound.setLoop('suck', active);
  if (!active) return;

  const range = getVacRange();
  // aim assist: when the stick is idle, turn toward the closest thing the vacpack could take
  if (!p.moving && profile.settings.assist) {
    const t = nearestSuckable(p, range * 1.2);
    if (t) {
      p.aim += angleDiff(Math.atan2(t.y - p.y, t.x - p.x), p.aim) * Math.min(1, dt * 12);
      if (Math.abs(Math.cos(p.aim)) > 0.2) p.facing = Math.cos(p.aim) < 0 ? -1 : 1;
    }
  }
  const nx = p.x + Math.cos(p.aim) * 16, ny = p.y - 5 + Math.sin(p.aim) * 16;
  let collected = 0, blocked = false;

  const suck = (arr, kind, strength) => {
    for (let i = arr.length - 1; i >= 0 && collected < 3; i--) {
      const it = arr[i];
      const dx = it.x - nx, dy = it.y - ny, d = Math.hypot(dx, dy);
      if (d >= range || d < 0.01 || !inCone(dx, dy, p.aim)) continue;
      if (!packCanAdd(kind, it.type)) { blocked = true; continue; }
      const heavy = kind === 'slime' ? 1 / it.def.size : 1;
      const move = Math.min((70 + (1 - d / range) * strength) * heavy * dt, d);
      it.x -= dx / d * move; it.y -= dy / d * move;
      if (kind === 'slime') it.sucked = 0.2; else { it.vx = 0; it.vy = 0; if (it.z < 5) it.z = 5; }
      if (Math.hypot(it.x - nx, it.y - ny) < 14) {
        packAdd(kind, it.type);
        arr.splice(i, 1);
        collected++;
        const col = kind === 'plort' ? SLIMES[it.type].plort.color : kind === 'food' ? FOODS[it.type].color : kind === 'treasure' ? TREASURES[it.type].color : it.def.color;
        spawnParticles(it.x, it.y, kind === 'slime' ? 9 : 5, col, { spread: 24, up: 24, life: 0.6 });
        Sound.play(kind === 'slime' ? 'capture' : 'collect', 0.8);
        if (kind === 'slime') questProgress('collect', it.type, 1);
      }
    }
  };
  suck(game.plorts, 'plort', 300);
  suck(game.foods, 'food', 300);
  suck(game.treasures, 'treasure', 300);
  suck(game.slimes, 'slime', 220);
  if (blocked && game.msgCd <= 0) { showAlert('🎒 Gulper full! Sell glimmers or upgrade Pack Space'); Sound.play('error', 0.6); game.msgCd = 2; }
}

/* ---------------- shooting ---------------- */
function handleShoot(dt) {
  game.shootCd -= dt;
  const want = input.shoot || input.shootTap;
  input.shootTap = false;
  if (!want || game.shootCd > 0 || game.shopOpen) return;
  game.shootCd = 0.22;
  const p = game.player;
  if (!game.pack.length) {
    if (game.msgCd <= 0) { showAlert('Gulper empty — hold ● to suck things up'); Sound.play('error', 0.6); game.msgCd = 1.5; }
    return;
  }
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim), tm = getThrowMult();
  const x = p.x + ca * 18, y = p.y - 4 + sa * 18;
  const sel = game.pack[game.selected];
  if (sel && sel.kind === 'slime') {                            // a full pen turns new slimes away
    const spot = findFreeSpot(x, y), pen = corralAt(spot.x + ca * 74 * tm, spot.y + sa * 74 * tm);
    if (pen && corralPop(pen) >= corralCap(pen)) {
      showAlert(`${pen.name} is full (${corralCap(pen)}/${corralCap(pen)}) — Roomier Pen adds space`, 2600); Sound.play('error', 0.6); game.shootCd = 0.6; return;
    }
  }
  const item = packTake(game.selected);
  if (item.kind === 'slime') {
    const spot = findFreeSpot(x, y);
    const s = createSlime(item.type, spot.x, spot.y);
    s.fly = s.flyMax = 0.5; s.fvx = ca * 190 * tm; s.fvy = sa * 190 * tm; s.eatTimer = 0;
    s.hunger = SLIMES[item.type].hunger * 0.5;
    game.slimes.push(s);
  } else {
    const it = { type: item.type, x, y, vx: ca * 230 * tm, vy: sa * 230 * tm, z: 8, vz: 70, age: 0 };
    if (item.kind === 'plort') game.plorts.push(it); else if (item.kind === 'treasure') game.treasures.push(it); else { it.thrown = true; game.foods.push(it); }
  }
  Sound.play('shoot', 0.8);
  spawnParticles(x, y, 4, '#ffffff', { spread: 20, up: 15, life: 0.4, g: 0 });
  if (navigator.vibrate && profile.settings.vibrate) navigator.vibrate(15);
}

/* ---------------- time, particles, fireflies ---------------- */
function updateTime(dt) {
  game.time += dt / DAY_LENGTHS[profile.settings.dayLen];
  if (game.time >= 1) {
    game.time -= 1; game.day++;
    rollPrices(false); newDayReset(); statMax('bestDay', game.day);
    showAlert(`☀️ Day ${game.day} — new glimmering spots appeared, market prices changed`, 3200);
  }
}

function updateParticles(dt) {
  if (game.msgCd > 0) game.msgCd -= dt;
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const q = game.particles[i];
    if (q.firefly) {
      q.phase += dt * 1.6; q.x += Math.sin(q.phase) * 9 * dt; q.y += q.vy * dt; q.life -= dt * 0.22;
    } else {
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= Math.pow(0.1, dt); q.life -= dt * 1.5;
    }
    if (q.life <= 0) game.particles.splice(i, 1);
  }
}

function updateFireflies(dt) {
  if (nightAmount(game.time) < 0.5) return;
  let n = 0; for (const q of game.particles) if (q.firefly) n++;
  if (n < 34 && Math.random() < dt * 2) {
    const p = game.player;
    game.particles.push({ x: p.x + rand(-240, 240), y: p.y + rand(-170, 170), vx: 0, vy: rand(-7, 7), color: '#fff6a0',
                          life: rand(3, 6), size: rand(1.2, 2.2), firefly: true, phase: rand(0, 6.28), g: 0 });
  }
}
