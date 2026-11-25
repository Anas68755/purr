'use strict';

/* ═══════════ v2.1 — Combat: العناصر + الحالات الـ15 + سلوكيات AI + الزعماء الصغار ═══════════ */

// ─── إصابة العدو v2.1: عناصر + إتقان + حالات موسعة + عدّادات ───
Combat.hitEnemy = function (e, raw, school, opts) {
  opts = opts || {};
  const r = Game.run, s = r.stats;
  if (!e || !e.active) return;
  const cnt = Combat.getCounters(r);
  let d = raw * s.dmg * (s.schoolMult[school] || 1);
  // — العناصر: ضعف ومقاومة لكل عدو —
  if (e.def.weak === school) d *= 1.3;
  else if (e.def.resist === school) d *= 0.65;
  if (e.isBoss) d *= s.dmgBoss;
  if (e.elite) d *= s.dmgElite;
  if (e.shieldedUp) d *= 0.4; // درع الزعيم الصغير المرتبط بالأتباع
  if (e.ghosting) d *= 0.5; // الطيفي: نصف الضرر أثناء الشبح
  if (e.vulnT > 0) d *= 1.25; // الهشاشة
  if (e.curseT > 0) d *= 1.10; // اللعنة (واثر العند)
  if (e.shockT > 0) d *= 1.15; // التصعيق
  // تكسير الجليد: البرق على مجمّد +50%
  const shatter = e.freezeT > 0 && school === 'lightning';
  if (shatter) d *= 1.5;
  // الإعدام: خطاف + ترقية دائمة
  const execTh = (r.hooks.execute ? 0.3 : 0) + s.exec;
  if (execTh > 0 && e.hp / e.maxHp < execTh) d *= 1 + (r.hooks.execute || 0) + s.exec * 1.5;
  if (r.player.hp / s.maxHp < 0.5 && r.hooks.rageLowHp) d *= (1 + r.hooks.rageLowHp);
  if (s.lowHp > 0) d *= (1 + s.lowHp * Math.max(0, 1 - r.player.hp / s.maxHp) * 100); // ساحر الدم
  if (r.berserk > 0) d *= (1 + r.berserk * 0.015);
  // هالة القط الأسود: حرجة إضافية قربه
  let critCh = s.crit;
  if (r.compState && Data.comp(r.companion).kind === 'crit' && U.dist(r.compState.x, r.compState.y, r.player.x, r.player.y) < 110) critCh += 0.05;
  let crit = false;
  if (!opts.noCrit && Math.random() < critCh) { crit = true; d *= s.critDmg; }
  if (!e.firstHit && r.hooks.firstHit) { d *= (1 + r.hooks.firstHit); e.firstHit = true; }
  e.hp -= d; e.flash = 1;
  if (shatter && e.active) { Meta.stats.shatters = (Meta.stats.shatters || 0) + 1; Render.fxExplosion(e.x, e.y, 26, '#9fd8ff'); }
  if (!opts.silent) {
    Render.fText(e.x + (Math.random() - 0.5) * 16, e.y - e.r - 8, U.num(Math.round(d)), crit ? '#f5c542' : (Data.SCHOOLS[school] ? Data.SCHOOLS[school].color : '#fff'), crit ? 19 : 14);
    Audio.sfx(crit ? 'crit' : 'hit', e.x);
  }
  cnt.dmg += d;
  Combat.addMastery(school, d);
  // امتصاص الحياة
  if (s.lifesteal > 0 && d > 3) { const h = d * s.lifesteal; r.player.hp = Math.min(s.maxHp, r.player.hp + h); cnt.ls += h; cnt.heal += h; }
  if (crit && r.hooks.critNova) { this.aoeDamage(e.x, e.y, 70, d * 0.4, school, { silent: true }); Render.fxExplosion(e.x, e.y, 70, '#f5c542'); }
  // — الحالات العنصرية الخمس الأساسية —
  const frz = (r.hooks.freezeOnHit || 0) + s.freezeHit;
  if (school === 'ice' && Math.random() < 0.12 + frz) this.applyStatus(e, 'freeze', 2);
  else if (frz > 0 && Math.random() < frz) this.applyStatus(e, 'freeze', 1.6);
  if (school === 'fire' && Math.random() < 0.15 + (r.hooks.burnOnHit || 0)) this.applyStatus(e, 'burn', 3, d * 0.12);
  if (school === 'poison') this.applyStatus(e, 'poison', 3, d * 0.1);
  if (school === 'lightning' && Math.random() < 0.2) this.applyStatus(e, 'shock', 3);
  // — الحالات الجديدة حسب المدرسة —
  if (school === 'dark' && Math.random() < 0.06) this.applyStatus(e, 'fear', 2);
  if (school === 'chaos' && Math.random() < 0.08) this.applyStatus(e, 'confuse', 2.5);
  if (school === 'light' && Math.random() < 0.08) this.applyStatus(e, 'silence', 3);
  if (school === 'void' && Math.random() < 0.05) this.applyStatus(e, 'weaken', 3);
  if (crit && school === 'physical') this.applyStatus(e, 'bleed', 3, d * 0.4);
  if (s.curseHit > 0 && Math.random() < 0.5) e.curseT = 3; // ميثاق الوارلوك
  if (opts.w && opts.w.def && opts.w.def.slowHit) this.applyStatus(e, 'slow', 2);
  if (r.hooks.chaosStrike && Math.random() < r.hooks.chaosStrike) { this.aoeDamage(e.x, e.y, 80, d * 0.6, 'chaos'); Render.fxExplosion(e.x, e.y, 80, '#ff6ea8'); }
  if (e.hp <= 0) this.killEnemy(e, school, { by: opts.by || 'player' });
};

// ─── الحالات الخمس عشرة v2.1 ───
Combat.applyStatus = function (e, type, dur, dps) {
  if (!e || !e.active) return;
  const r = Game.run, s = r.stats, dur2 = dur * (1 + s.duration * 0.5);
  switch (type) {
    case 'freeze': e.freezeT = Math.max(e.freezeT, dur2); break;
    case 'burn': {
      let d = (dps || 5) * s.burnPower;
      if (r.syn.toxic_blaze) d *= 2;
      if (r.syn.eternal_flame) d *= 1.4;
      e.burnT = Math.max(e.burnT, dur2); e.burnDps = Math.max(e.burnDps, d); break;
    }
    case 'poison': e.poisonT = Math.max(e.poisonT, dur2); e.poisonDps = Math.max(e.poisonDps, (dps || 4) * s.poisonPower); break;
    case 'shock': e.shockT = Math.max(e.shockT, dur2); break;
    case 'slow': e.slowT = Math.max(e.slowT, dur2); break;
    case 'bleed': e.bleedT = Math.max(e.bleedT || 0, dur2); e.bleedDps = Math.max(e.bleedDps || 0, dps || 4); break;
    case 'blind': e.blindT = Math.max(e.blindT || 0, dur2); break;
    case 'charm': e.charmT = Math.max(e.charmT || 0, dur2); break;
    case 'confuse': e.confuseT = Math.max(e.confuseT || 0, dur2); break;
    case 'fear': e.fearT = Math.max(e.fearT || 0, dur2); break;
    case 'silence': e.silenceT = Math.max(e.silenceT || 0, dur2); break;
    case 'weaken': e.weakenT = Math.max(e.weakenT || 0, dur2); break;
    case 'vulnerable': e.vulnT = Math.max(e.vulnT || 0, dur2); break;
    case 'curse': e.curseT = Math.max(e.curseT || 0, dur2); break;
  }
};

// ─── موت العدو v2.1: قطع قديمة + منشطرون + زعماء صغار + عدّادات ───
Combat.killEnemy = function (e, school, opts) {
  const r = Game.run;
  if (!e || !e.active) return;
  opts = opts || {};
  const cnt = Combat.getCounters(r);
  Core.pools.enemies.release(e);
  r.kills++; r.challengeProg.kills++;
  // عدّاد الإبادة السريعة (200 في 30 ثانية)
  cnt.burstK++;
  if (cnt.burstT <= 0) { cnt.burstT = 30; cnt.burstK = 1; }
  if (cnt.burstK >= 200) Meta.stats.burst200 = 1;
  if (school) { r.schoolKills[school] = (r.schoolKills[school] || 0) + 1; const ks = r.challengeProg.killSchool; ks[school] = (ks[school] || 0) + 1; }
  // نسب القتل بالحالات
  const sk = Meta.stats.statusKills;
  if (e.burnT > 0) { sk.burn = (sk.burn || 0) + 1; cnt.status.burn = (cnt.status.burn || 0) + 1; }
  if (e.poisonT > 0) sk.poison = (sk.poison || 0) + 1;
  if (e.shockT > 0) sk.shock = (sk.shock || 0) + 1;
  if (e.freezeT > 0) sk.freeze = (sk.freeze || 0) + 1;
  if (e.charmT > 0) { Meta.stats.charmKills = (Meta.stats.charmKills || 0) + 1; cnt.status.charm = 1; }
  if (Object.keys(r.syn).length >= 3) Meta.stats.synKills = (Meta.stats.synKills || 0) + 1;
  if (opts.by === 'comp') cnt.familKills++;
  Render.fxParticle(e.x, e.y, e.def.color, 'burst');
  Prog.spawnOrb(e.x, e.y, Math.ceil(e.xp));
  // تآزر العاصفة النارية: قتلات النار تشعل الأرض
  if (r.syn.firestorm && school === 'fire') this.spawnPool(e.x, e.y, 40, 'fire', 1.5, 6);
  const gChance = 0.14 + (e.freezeT > 0 && r.syn.golden_frost ? 0.4 : 0) + (r.stats.goldFind || 0);
  if (Math.random() < gChance) Prog.spawnOrb(e.x + 8, e.y, 1 + Math.floor(Math.random() * 2), 'gold');
  if (Math.random() < 0.02) Prog.spawnOrb(e.x - 8, e.y, 8, 'heal');
  if (r.hooks.explodeOnKill && Math.random() < r.hooks.explodeOnKill) { this.aoeDamage(e.x, e.y, 62, 30, 'fire'); Render.fxExplosion(e.x, e.y, 62, '#ff8a3a'); Audio.sfx('explode', e.x); }
  if (r.hooks.burningGround && Math.random() < r.hooks.burningGround) this.spawnPool(e.x, e.y, 42, 'fire', 1.6, 6);
  if ((r.hooks.poisonSpread && Math.random() < r.hooks.poisonSpread) || (r.syn.shadow_plague && e.poisonT > 0 && Math.random() < 0.3)) {
    this.aoeDamage(e.x, e.y, 55, 12, 'poison', { silent: true });
    const tmp = this.tmp2; this.hash.query(e.x, e.y, 90, tmp);
    for (const o of tmp) if (o.active && U.dist(e.x, e.y, o.x, o.y) < 90) this.applyStatus(o, 'poison', 2, 4);
    Render.fxExplosion(e.x, e.y, 55, '#8be84a');
  }
  if (r.hooks.berserk) r.berserk = Math.min(10, r.berserk + 1);
  if (r.hooks.vampire) { r.killVamp++; if (r.killVamp >= r.hooks.vampire) { r.killVamp = 0; r.player.hp = Math.min(r.stats.maxHp, r.player.hp + 1); } }
  // المنشطر: كتلة الحمم تتقسم لكتلتين أصغر
  if (e.def.behavior === 'splitter' && !e.noSplit) {
    for (let i = 0; i < 2; i++) {
      const ne = Spawn.spawnEnemy(e.defId || e.def.id || 'magmaBlob', e.x + (i ? 18 : -18), e.y + (i ? 10 : -10));
      if (ne) { ne.hp = ne.maxHp = e.maxHp * 0.35; ne.noSplit = true; ne.r = e.r * 0.65; }
    }
  }
  // النخبة
  if (e.elite) {
    r.challengeProg.elite++;
    Meta.stats.elites++;
    if (Math.random() < 0.12) Prog.spawnOrb(e.x, e.y, 1, 'shard');
    if (Math.random() < 0.1) Prog.dropChest(e.x, e.y);
    if (Math.random() < 0.06) this.dropFragment(e.x, e.y);
  }
  // الزعيم الصغير
  if (e.mini) Game.onMiniKilled(e);
  if (e.isBoss) Game.onBossKilled(e);
  Bus.emit('kill', { school: school, elite: !!e.elite, boss: !!e.isBoss });
};

// إسقاط قطعة قديمة غير مملوكة
Combat.dropFragment = function (x, y) {
  const un = Data.FRAGMENTS.filter(f => !Meta.stats.fragments[f.id]);
  if (!un.length) return;
  const f = U.pick(un);
  Prog.spawnOrb(x, y, 1, 'frag', f.id);
  UI.toast(t('fragmentFound') + ' ' + (I18N.lang() === 'ar' ? f.ar : f.en), 'gold');
  Audio.sfx('chest');
};

// ─── تلقي اللاعب للضرب v2.1: صدّ + عناصر + لعنة + نَفَس أخير ───
Combat.hurtPlayer = function (dmg, school) {
  const r = Game.run, p = r.player;
  if (p.iframe > 0 || p.dashT > 0 || Game.state !== 'playing') return;
  const cnt = Combat.getCounters(r);
  if (Math.random() < r.stats.dodge) { cnt.dodges++; Meta.stats.dodges = (Meta.stats.dodges || 0) + 1; Render.fText(p.x, p.y - 30, '✦', '#9fd8ff', 15); return; }
  if (Math.random() < r.stats.block) { cnt.blocks++; Meta.stats.blocks = (Meta.stats.blocks || 0) + 1; Render.fText(p.x, p.y - 30, '🛡', '#fff3b0', 16); Audio.sfx('freeze'); return; }
  if (r.hooks.shield30 && r.shieldT <= 0) { r.shieldT = r.hooks.shield30; Render.fText(p.x, p.y - 30, '✦', '#7ee8fa', 18); Audio.sfx('freeze'); return; }
  if (p.blessT > 0) { p.blessT = 0; Render.fText(p.x, p.y - 30, '🕊', '#fff3b0', 18); return; }
  this.hurtPlayerRaw(dmg, true, school);
};
Combat.hurtPlayerRaw = function (dmg, fx, school) {
  const r = Game.run, p = r.player, s = r.stats;
  if (Game.state !== 'playing') return;
  const cnt = Combat.getCounters(r);
  if (r.bossActive) r.perfectBroken = true;
  r.cleanT = 0; // انكسار سلسلة النجاة
  let red = dmg * 100 / (100 + s.armor * 10);
  if (s.elemResist > 0 && school && school !== 'physical') red *= (1 - s.elemResist);
  if (p.curseT > 0) red *= 1.15;
  p.hp -= red;
  if (fx) {
    r.hurtFx = 1; Game.shake(6, 0.25); Audio.sfx('hurt');
    Render.fText(p.x + (Math.random() - 0.5) * 20, p.y - 26, U.num(Math.round(red)), '#ff5964', 15);
    UI.haptic(30);
  }
    if (p.hp <= 0) {
    if (s.revive > r.reviveUsed) {
      r.reviveUsed++; p.hp = s.maxHp * 0.5; p.iframe = 2.5;
      UI.toast(t('revived'), 'gold'); Audio.sfx('evolve'); Game.shake(12, 0.5);
      Render.fxExplosion(p.x, p.y, 180, '#f5c542');
      return;
    }
    if (s.secondWind > r.swUsed) {
      r.swUsed++; p.hp = s.maxHp * 0.3; p.iframe = 2; p.blessT = 4;
      Meta.stats.secondWinds = (Meta.stats.secondWinds || 0) + 1;
      UI.toast(t('stBless') + ' ✦ ' + t('revived'), 'gold');
      Audio.sfx('evolve'); Render.fxExplosion(p.x, p.y, 150, '#fff3b0');
      return;
    }
    if (r.time < 30) Meta.stats.fastDeaths = (Meta.stats.fastDeaths || 0) + 1;
    p.hp = 0; Game.endRun(false);
  }
};

// ─── اللاعب v2.1: حالات اللاعب + عدّادات + هالة الإبطاء + تربّي القطة ───
Combat.updatePlayer = function (dt) {
  const r = Game.run, p = r.player, s = r.stats, cnt = Combat.getCounters(r);
  p.px = p.x; p.py = p.y;
  Input.update(dt);
  let mx = Input.moveVec.x, my = Input.moveVec.y;
  if (p.stunT > 0) { p.stunT -= dt; mx = 0; my = 0; }
  if (p.dashT > 0) { p.dashT -= dt; mx = p.dashVx; my = p.dashVy; }
  if (Input.consumeDash() && p.dashCd <= 0 && p.stunT <= 0) {
    p.dashT = 0.18; p.iframe = Math.max(p.iframe, 0.28);
    p.dashCd = s.dashCd; cnt.dashes++;
    const a = (mx || my) ? Math.atan2(my, mx) : Math.atan2(p.face.y, p.face.x);
    p.dashVx = Math.cos(a); p.dashVy = Math.sin(a);
    Audio.sfx('dash'); Game.shake(4, 0.15);
    if (r.hooks.waveBurst) { this.aoeDamage(p.x, p.y, 90, 20, 'physical'); Render.fxExplosion(p.x, p.y, 90, '#7ee8fa'); }
  }
  p.dashCd = Math.max(0, p.dashCd - dt);
  const spd = s.ms * (p.slowT > 0 ? 0.6 : 1) * (1 + r.berserk * 0.02) * (p.dashT > 0 ? 3.1 : 1);
  if (mx || my) { const l = Math.hypot(mx, my); p.x += (mx / l) * spd * dt; p.y += (my / l) * spd * dt; p.face = { x: mx / l, y: my / l }; cnt.still = 0; }
  else cnt.still += dt;
  Meta.stats.stillBest = Math.max(Meta.stats.stillBest || 0, Math.floor(cnt.still));
  p.animT += dt * (p.dashT > 0 ? 3 : 1);
  if (p.dashT > 0) { p.trail.push({ x: p.x, y: p.y, t: 0.3 }); if (r.hooks.dashTrail) this.aoeDamage(p.x, p.y, 34, 8 * dt * 10, 'fire', { silent: true }); }
  // أثر الأقدام الكوزمتكي
  const trId = Meta.cosmetics && Meta.cosmetics.equipped.trail, tr = trId && Data.trail(trId);
  if (tr && tr.type && (mx || my) && Math.random() < dt * 8) {
    const col = tr.rainbow ? 'hsl(' + Math.floor((performance.now() / 12) % 360) + ',90%,65%)' : tr.color;
    Render.fxParticle(p.x - p.face.x * 10, p.y - p.face.y * 10 + 8, col, tr.type);
  }
  for (let i = p.trail.length - 1; i >= 0; i--) { p.trail[i].t -= dt; if (p.trail[i].t <= 0) p.trail.splice(i, 1); }
  // التجدد والحالات
  let regen = s.regen;
  if (p.blessT > 0) { p.blessT -= dt; regen += 2; }
  p.hp = Math.min(s.maxHp, p.hp + regen * dt);
  p.iframe = Math.max(0, p.iframe - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  p.curseT = Math.max(0, (p.curseT || 0) - dt);
  p.blindT = Math.max(0, (p.blindT || 0) - dt);
  if (p.burnT > 0) { p.burnT -= dt; this.hurtPlayerRaw(p.burnDps * dt, false); }
  // سلاح الدم: إنقاذ على حافة الهاوية (عدّاد 60 ثانية تحت 10%)
  if (p.hp / s.maxHp < 0.1) { cnt.lowT = (cnt.lowT || 0) + dt; if (cnt.lowT >= 60) { Meta.stats.clutch = 1; cnt.lowT = -999; } }
  else if (cnt.lowT > 0) cnt.lowT = 0;
  if (p.hp / s.maxHp < 0.05) r.clutchFlag = true;
  // عدّادات الجولة
  if (p.hp >= s.maxHp - 0.5) cnt.fullHp += dt;
  r.cleanT = (r.cleanT || 0) + dt;
  r.cleanBest = Math.max(r.cleanBest || 0, r.cleanT);
  Meta.stats.cleanBest = Math.max(Meta.stats.cleanBest || 0, r.cleanBest);
  // هالة إبطاء سيدي الزمن + حقل الصقيع
  if (s.slowAura > 0) {
    const tmp = this.tmp;
    this.hash.query(p.x, p.y, 150, tmp);
    for (const e of tmp) if (e.active && U.dist(e.x, e.y, p.x, p.y) < 150) e.slowT = Math.max(e.slowT, 0.25);
  }
  // القطة: عدّاد المجاملة
  if (Data.comp(r.companion).id === 'cat' && r.compState && U.dist(r.compState.x, r.compState.y, p.x, p.y) < 90) Meta.stats.petCat = (Meta.stats.petCat || 0) + dt;
  if (r.hooks.shield30) r.shieldT = Math.max(-1, r.shieldT - dt);
  if (r.hooks.berserk && r.berserk > 0) r.berserk = Math.max(0, r.berserk - dt * 0.8);
  r.hurtFx = Math.max(0, r.hurtFx - dt * 2);
};

// ─── الأعداء v2.1: 19 سلوكًا + الحالات على الأعداء + الزعماء الصغار ───
Combat.updateEnemies = function (dt) {
  const r = Game.run, p = r.player, H = this.hash, tmp = this.tmp, cnt = Combat.getCounters(r);
  H.clear();
  Core.pools.enemies.forEach(e => H.insert(e));
  Core.pools.enemies.forEach(e => {
    e.px = e.x; e.py = e.y;
    e.animT += dt; e.flash = Math.max(0, e.flash - dt * 6); e.touchCd = Math.max(0, e.touchCd - dt);
    // — الضرر المستمر للحالات —
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnDps * dt; if (Math.random() < dt * 8) Render.fxParticle(e.x, e.y - 6, '#ff8a3a', 'flame'); }
    if (e.poisonT > 0) { e.poisonT -= dt; e.hp -= e.poisonDps * dt; if (Math.random() < dt * 6) Render.fxParticle(e.x, e.y - 4, '#8be84a', 'spark'); }
    if (e.bleedT > 0) { e.bleedT -= dt; e.hp -= (e.bleedDps || 4) * dt * (Math.hypot(e.vx, e.vy) > 30 ? 1.6 : 1); }
    if (e.hp <= 0) { this.killEnemy(e, e.burnT > 0 ? 'fire' : e.poisonT > 0 ? 'poison' : 'physical'); return; }
    e.freezeT = Math.max(0, e.freezeT - dt); e.slowT = Math.max(0, e.slowT - dt); e.shockT = Math.max(0, e.shockT - dt);
    e.charmT = Math.max(0, (e.charmT || 0) - dt); e.confuseT = Math.max(0, (e.confuseT || 0) - dt);
    e.fearT = Math.max(0, (e.fearT || 0) - dt); e.silenceT = Math.max(0, (e.silenceT || 0) - dt);
    e.weakenT = Math.max(0, (e.weakenT || 0) - dt); e.vulnT = Math.max(0, (e.vulnT || 0) - dt);
    e.curseT = Math.max(0, (e.curseT || 0) - dt); e.blindT = Math.max(0, (e.blindT || 0) - dt);
    const dToP = U.dist(e.x, e.y, p.x, p.y);
    if (dToP < 140 && (r.syn.cold_void || r.hooks.slowAura)) e.slowT = Math.max(e.slowT, 0.3);
    if (e.mini) this.updateMini(e, dt, dToP);
    else if (e.isBoss) this.updateBossMove(e, dt, dToP);
    else this.updateEnemyAI(e, dt, dToP);
    // — السرب (تباعد + محاذاة) ما لم يكن رعبًا أو مسحورًا —
    if (!e.isBoss && !e.mini && e.charmT <= 0 && e.fearT <= 0) {
      H.query(e.x, e.y, e.r + 26, tmp);
      let sx = 0, sy = 0, n = 0, avx = 0, avy = 0;
      for (let i = 0; i < tmp.length && n < 6; i++) {
        const o = tmp[i]; if (o === e || !o.active) continue;
        const d = U.dist2(e.x, e.y, o.x, o.y), minD = (e.r + o.r) * (e.r + o.r);
        if (d < minD && d > 0.01) { const inv = 1 / Math.sqrt(d); sx += (e.x - o.x) * inv; sy += (e.y - o.y) * inv; }
        avx += o.vx; avy += o.vy; n++;
      }
      if (n) { e.vx += (sx * 60 + (avx / n) * 0.12 - e.vx) * dt * 6; e.vy += (sy * 60 + (avy / n) * 0.12 - e.vy) * dt * 6; }
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt);
    // — التلامس مع اللاعب —
    if (dToP < e.r + 14 && e.touchCd <= 0 && e.charmT <= 0) {
      e.touchCd = 0.8;
      let dm = e.dmg * (e.weakenT > 0 ? 0.75 : 1);
      this.hurtPlayer(dm, e.def.elem);
      if (e.elite) {
        const id = e.elite.id;
        if (id === 'thorns') { const refl = 8 + (r.hooks.thorns || 0) + r.stats.thorns; cnt.thorns += refl; e.hp -= refl; e.flash = 1; if (e.hp <= 0) this.killEnemy(e, 'physical'); }
        if (id === 'burning') { p.burnT = 3; p.burnDps = 4; }
        if (id === 'freezing') p.slowT = 2;
        if (id === 'paralyzing') { p.stunT = 0.5; Render.fText(p.x, p.y - 34, t('stStun'), '#ffe95c', 14); }
        if (id === 'vampiric') { e.hp = Math.min(e.maxHp, e.hp + e.dmg * 2); Render.fText(e.x, e.y - e.r - 10, '+', '#ff5c7a', 14); }
        if (id === 'shocking') { this.hurtPlayer(6, 'lightning'); Render.fxZap(e.x, e.y, p.x, p.y, '#ffe95c'); }
      }
      // تآزر الصهارة + الأشواك
      const refl = (r.hooks.thorns || 0) + r.stats.thorns + (r.syn.magma ? 14 : 0) + (r.syn.thorn_skin ? 10 : 0);
      if (refl > 0) { cnt.thorns += refl; e.hp -= refl; e.flash = 1; if (r.syn.magma) this.applyStatus(e, 'burn', 2, 5); if (e.hp <= 0) this.killEnemy(e, 'physical'); }
    }
  });
};

// ذكاء العدو v2.1: 19 سلوكًا
Combat.updateEnemyAI = function (e, dt, dToP) {
  const r = Game.run, p = r.player;
  const spd = e.spd * (e.freezeT > 0 ? 0.45 : e.slowT > 0 ? 0.72 : 1);
  const seek = (tx, ty) => { const a = Math.atan2((ty || p.y) - e.y, (tx || p.x) - e.x); return { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd }; };
  // مسحور: يقاتل أصحابه
  if (e.charmT > 0) {
    let tgt = null, bd = 260 * 260;
    Core.pools.enemies.forEach(o => { if (o !== e && o.active && o.charmT <= 0) { const d = U.dist2(e.x, e.y, o.x, o.y); if (d < bd) { bd = d; tgt = o; } } });
    if (tgt) { const s2 = seek(tgt.x, tgt.y); e.vx = s2.vx; e.vy = s2.vy; if (U.dist(e.x, e.y, tgt.x, tgt.y) < e.r + tgt.r + 4 && e.touchCd <= 0) { e.touchCd = 0.9; tgt.hp -= e.dmg; tgt.flash = 1; Render.fxParticle(tgt.x, tgt.y, '#ff8ad8', 'spark'); if (tgt.hp <= 0) this.killEnemy(tgt, 'dark'); } }
    else { const s2 = seek(); e.vx = s2.vx * 0.4; e.vy = s2.vy * 0.4; }
    return;
  }
  // رعب: يهرب من اللاعب
  if (e.fearT > 0) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.vx = Math.cos(a) * spd * 1.2; e.vy = Math.sin(a) * spd * 1.2; return; }
  // تشويش: تجوال عشوائي
  if (e.confuseT > 0) { e.vx = Math.cos(e.animT * 3.1) * spd * 0.8; e.vy = Math.sin(e.animT * 2.7) * spd * 0.8; return; }
  if (e.ringSpawn > 0) { e.ringSpawn -= dt; const s = seek(); e.vx = s.vx; e.vy = s.vy; return; }
  if (e.state === 'windup') { e.stateT -= dt; e.vx = 0; e.vy = 0; if (e.stateT <= 0) this.enemyAttack(e); return; }
  if (e.state === 'charge') { e.stateT -= dt; if (e.stateT <= 0) { e.state = 'walk'; e.chargeCd = 3; } return; }
  if (e.state === 'diveTele') { e.stateT -= dt; e.vx = 0; e.vy = 0; if (e.stateT <= 0) { e.state = 'dive'; e.stateT = 0.5; e.diveVx = Math.cos(e.diveA) * spd * 5; e.diveVy = Math.sin(e.diveA) * spd * 5; Audio.sfx('dash', e.x); } return; }
  if (e.state === 'dive') { e.stateT -= dt; e.vx = e.diveVx; e.vy = e.diveVy; if (e.stateT <= 0) { e.state = 'walk'; e.chargeCd = 3.5; } return; }
  const beh = e.def.behavior;
  e.chargeCd = Math.max(0, (e.chargeCd || 0) - dt);
  // هجوم بعيد مع عمى وإسكات
  const tryAttack = (rng) => {
    if (e.silenceT > 0) return false;
    if (dToP < rng && e.chargeCd <= 0) { e.state = 'windup'; e.stateT = 0.55; Audio.sfx('telegraph', e.x); return true; }
    return false;
  };
  switch (beh) {
    case 'ranged': case 'spitter': {
      const rng = e.def.range || 330;
      if (tryAttack(rng)) return;
      if (dToP < rng * 0.6) { e.vx = 0; e.vy = 0; return; }
      const s = seek(); e.vx = s.vx * 0.8; e.vy = s.vy * 0.8; return;
    }
    case 'summoner': {
      if (dToP < (e.def.range || 320) * 0.8 && e.chargeCd <= 0 && Core.pools.enemies.count() < 200) {
        e.chargeCd = e.def.atkCd || 4.5;
        for (let i = 0; i < 2; i++) { const a = Math.random() * U.TAU; Spawn.spawnEnemy(U.pick(Object.keys(Data.ENEMIES).filter(k => Data.ENEMIES[k].xp <= 2)), e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50); }
        Render.fText(e.x, e.y - e.r - 12, I18N.ct('summon'), '#ffb1b1', 12);
      }
      const s = seek(); e.vx = s.vx * 0.5; e.vy = s.vy * 0.5; return;
    }
    case 'brute': case 'charger': {
      if (dToP < 250 && e.chargeCd <= 0 && e.silenceT <= 0) { e.state = 'windup'; e.stateT = 0.7; Audio.sfx('telegraph', e.x); return; }
      const s = seek(); e.vx = s.vx; e.vy = s.vy; return;
    }
    case 'teleporter': {
      if (e.chargeCd <= 0 && dToP > 380) {
        e.chargeCd = 4.2;
        const a = Math.random() * U.TAU;
        Render.fxParticle(e.x, e.y, e.def.color, 'burst');
        e.x = p.x + Math.cos(a) * 190; e.y = p.y + Math.sin(a) * 190;
        Render.fxParticle(e.x, e.y, e.def.color, 'burst');
        return;
      }
      const s = seek(); e.vx = s.vx; e.vy = s.vy; return;
    }
    case 'orbiter': {
      const a = Math.atan2(e.y - p.y, e.x - p.x) + dt * 1.4;
      const tx = p.x + Math.cos(a) * 170, ty = p.y + Math.sin(a) * 170;
      const s = seek(tx, ty); e.vx = s.vx; e.vy = s.vy;
      if (e.chargeCd <= 0 && Math.random() < dt * 0.5) { e.chargeCd = 5; e.state = 'diveTele'; e.stateT = 0.7; e.diveA = Math.atan2(p.y - e.y, p.x - e.x); }
      return;
    }
    case 'diver': {
      if (e.chargeCd <= 0 && dToP > 200) { e.chargeCd = 4; e.state = 'diveTele'; e.stateT = 0.8; e.diveA = Math.atan2(p.y - e.y, p.x - e.x); Audio.sfx('telegraph', e.x); return; }
      const s = seek(); e.vx = s.vx * 0.7; e.vy = s.vy * 0.7; return;
    }
    case 'bomber': {
      const s = seek(); e.vx = s.vx; e.vy = s.vy;
      if (dToP < 90 && e.chargeCd <= 0) { e.chargeCd = 99; e.fuseT = 0.8; } // فتيل قبل الانفجار
      if (e.fuseT !== undefined) { e.fuseT -= dt; e.flash = 1; if (e.fuseT <= 0) { Combat.aoeDamage(e.x, e.y, 80, e.dmg * 1.4, 'fire'); Render.fxExplosion(e.x, e.y, 80, '#ff8a3a'); Audio.sfx('explode', e.x); e.hp = 0; } }
      return;
    }
    case 'healer': {
      e.healT = Math.max(0, (e.healT || 0) - dt);
      if (e.healT <= 0) {
        e.healT = 3;
        const tmp2 = Combat.tmp2;
        Combat.hash.query(e.x, e.y, 140, tmp2);
        for (const o of tmp2) if (o !== e && o.active && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08); Render.fxParticle(o.x, o.y - 8, '#5eeaa4', 'spark'); }
      }
      const s = seek(); e.vx = s.vx * 0.6; e.vy = s.vy * 0.6; return;
    }
    case 'regenerator': {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
      const s = seek(); e.vx = s.vx; e.vy = s.vy; return;
    }
    case 'berserker': {
      const rage = 1 + (1 - e.hp / e.maxHp) * 0.8;
      const s = seek(); e.vx = s.vx * rage; e.vy = s.vy * rage; return;
    }
    case 'vampiric': {
      const s = seek(); e.vx = s.vx * 1.1; e.vy = s.vy * 1.1; return;
    }
    case 'spectral': {
      e.phaseT = (e.phaseT || 0) + dt;
      e.ghosting = (e.phaseT % 4) > 2.4; // يتحول طيفيًا: نصف الضرر
      const s = seek(); e.vx = s.vx; e.vy = s.vy; return;
    }
    case 'shielded': break; // يُعالج في hitEnemy عبر الدرع (مكشوف من الخلف: تبسيط = تخفيض ثابت)
  }
  const s = seek();
  let wob = 0;
  if (beh === 'fly') wob = Math.sin(e.animT * 5) * 40;
  if (beh === 'fast') wob = Math.sin(e.animT * 2.1) * 14;
  e.vx = s.vx + Math.cos(e.animT * 2.3) * wob; e.vy = s.vy + Math.sin(e.animT * 2.9) * wob;
};

// هجوم العدو v2.1: إسكات + عمى + رشق ثلاثي + عنصر المقذوف
Combat.enemyAttack = function (e) {
  const r = Game.run, p = r.player;
  e.state = 'walk'; e.chargeCd = e.def.behavior === 'brute' || e.def.behavior === 'charger' ? 4 : e.def.atkCd || 2.5;
  if (e.silenceT > 0) return;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  if (e.def.behavior === 'ranged' || e.def.behavior === 'spitter') {
    if (e.blindT > 0 && Math.random() < 0.5) { Render.fText(e.x, e.y - e.r - 8, '✕', '#c9d4e8', 12); return; }
    const n = e.def.behavior === 'spitter' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const o = Core.pools.eproj.get(); if (!o) return;
      const aa = a + (i - (n - 1) / 2) * 0.28;
      o.x = o.px = e.x; o.y = o.py = e.y;
      o.vx = Math.cos(aa) * 240; o.vy = Math.sin(aa) * 240;
      o.r = 7; o.dmg = e.dmg; o.life = 3; o.color = e.def.color; o.kind = 'ball';
      o.school = e.def.elem || 'physical';
    }
  } else {
    e.state = 'charge'; e.stateT = 0.5;
    e.vx = Math.cos(a) * e.spd * 3.4; e.vy = Math.sin(a) * e.spd * 3.4;
  }
};

// ─── ميكانيكا الزعماء الصغار الثمانية ───
Combat.updateMini = function (e, dt, dToP) {
  const r = Game.run, p = r.player;
  const mech = e.mech;
  e.mechT = Math.max(0, (e.mechT || 0) - dt);
  // المطاردة الأساسية
  const a = Math.atan2(p.y - e.y, p.x - e.x), spd = e.spd;
  if (e.state === 'walk' || e.state === 'windup') { e.vx = Math.cos(a) * spd * 0.85; e.vy = Math.sin(a) * spd * 0.85; }
  if (e.mechT <= 0) {
    switch (mech) {
      case 'summon': e.mechT = 6; for (let i = 0; i < 4; i++) { const aa = (i / 4) * U.TAU; Spawn.spawnEnemy(U.pick(Data.WAVE_POOL[r.stageId].map(w => w[1]).flat()), e.x + Math.cos(aa) * 80, e.y + Math.sin(aa) * 80); } Render.fText(e.x, e.y - e.r - 14, I18N.ct('summon'), '#ffb1b1', 13); break;
      case 'bombard': e.mechT = 5; for (let i = 0; i < 3; i++) Waves.marks.push({ x: p.x + (Math.random() - 0.5) * 200, y: p.y + (Math.random() - 0.5) * 200, t: 1.0, r: 64, dmg: e.dmg * 0.7 }); Audio.sfx('telegraph', e.x); break;
      case 'nova': e.mechT = 5; { const tmp = Combat.tmp2; Combat.hash.query(e.x, e.y, 150, tmp); for (const o of tmp) if (o.active && U.dist(e.x, e.y, o.x, o.y) < 150) Combat.applyStatus(o, 'slow', 2); } Render.auraPulse('ice', 150, '#9fd8ff'); break;
      case 'gravity': e.mechT = 7; { const pa = Math.atan2(e.y - p.y, e.x - p.x); p.x += Math.cos(pa) * 110; p.y += Math.sin(pa) * 110; Game.shake(6, 0.3); Render.fText(p.x, p.y - 30, '⟲', '#b06cff', 20); } break;
      case 'dash': e.mechT = 4; e.state = 'charge'; e.stateT = 0.5; e.vx = Math.cos(a) * e.spd * 4; e.vy = Math.sin(a) * e.spd * 4; Audio.sfx('dash', e.x); break;
      case 'regen': e.mechT = 1; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015); break;
      case 'mirror': { const th = e.mirrorAt || (e.mirrorAt = [0.6, 0.3]); if (th.length && e.hp / e.maxHp < th[0]) { th.shift(); for (let i = 0; i < 2; i++) { const ne = Spawn.spawnEnemy(Data.WAVE_POOL[r.stageId][0][1][0], e.x + (i ? 40 : -40), e.y); if (ne) { ne.maxHp = ne.hp = e.maxHp * 0.2; ne.r = e.r * 0.7; ne.mini = true; ne.mech = 'none'; ne.spd = e.spd * 1.4; } } Render.fxExplosion(e.x, e.y, 90, e.def.color); } e.mechT = 1; break; }
      case 'shield': e.mechT = 8; { let adds = 0; Core.pools.enemies.forEach(o => { if (o.active && !o.mini && !o.isBoss && U.dist(o.x, o.y, e.x, e.y) < 220) adds++; }); e.shieldedUp = adds > 0; if (!e.shieldedUp) { for (let i = 0; i < 3; i++) Spawn.spawnEnemy(U.pick(Data.WAVE_POOL[r.stageId].map(w => w[1]).flat()), e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 120); } } break;
      default: e.mechT = 5;
    }
  }
  if (mech === 'regen') e.lastHitT = e.lastHitT || 0;
};

// ─── المرافقون v2.1: 9 أنواع (ضربة/قذف/دعم/رشق/شبكة/منقار/هالة حرجة) ───
Combat.updateCompanion = function (dt) {
  const r = Game.run, p = r.player, cs = r.compState, cnt = Combat.getCounters(r);
  const def = Data.comp(r.companion);
  if (def.kind === 'none') return;
  Meta.stats.companionsUsed[def.id] = true;
  const tx = p.x - p.face.x * 46 + Math.sin(p.animT * 1.4) * 14, ty = p.y - p.face.y * 46 + Math.cos(p.animT * 1.2) * 10;
  cs.tx = U.lerp(cs.tx || tx, tx, dt * 4); cs.ty = U.lerp(cs.ty || ty, ty, dt * 4);
  cs.x = U.lerp(cs.x, cs.tx, Math.min(1, dt * 6)); cs.y = U.lerp(cs.y, cs.ty, Math.min(1, dt * 6));
  cs.cd -= dt;
  const dmgMul = (1 + r.stats.dmg * 0.3) * (1 + (r.stats.compDmg || 0));
  if (def.kind === 'support') {
    cs.healT -= dt;
    if (cs.healT <= 0) { cs.healT = 6; const h = def.heal; p.hp = Math.min(r.stats.maxHp, p.hp + h); cnt.heal += h; Render.fText(p.x, p.y - 30, '+' + U.num(h), '#ffb8e8', 14); Audio.sfx('heal'); }
    return;
  }
  if (def.kind === 'crit') return; // هالة سلبية تُعالج في hitEnemy
  if (cs.cd <= 0) {
    let best = null, bd = 360 * 360;
    Combat.hash.query(cs.x, cs.y, 360, Combat.tmp2);
    for (const e of Combat.tmp2) { const d = U.dist2(cs.x, cs.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (best) {
      const a = Math.atan2(best.y - cs.y, best.x - cs.x);
      const hit = (target, d, school) => { const hp0 = target.hp; this.hitEnemy(target, d, school, { by: 'comp' }); if (target.hp < hp0) cnt.familKills++; };
      switch (def.kind) {
        case 'melee': cs.cd = def.cd; hit(best, def.dmg * dmgMul, 'physical'); Render.fxSlash(cs.x, cs.y, a, 46, def.color); break;
        case 'ranged': cs.cd = def.cd; this.spawnProj({ x: cs.x, y: cs.y, a, spd: 400, dmg: def.dmg * dmgMul, pierce: 1, life: 1.4, r: 7, school: 'arcane', color: def.color, kind: 'straight', w: null }); break;
        case 'spray': cs.cd = def.cd; for (let i = 0; i < 3; i++) this.spawnProj({ x: cs.x, y: cs.y, a: a + (Math.random() - 0.5) * 0.5, spd: 360, dmg: def.dmg * dmgMul, pierce: 1, life: 1.1, r: 5, school: 'nature', color: def.color, kind: 'straight', w: null }); break;
        case 'web': cs.cd = def.cd; hit(best, def.dmg * dmgMul, 'nature'); Combat.applyStatus(best, 'slow', 2.5); Render.fxParticle(best.x, best.y, '#e8f0ff', 'trail'); break;
        case 'peck': cs.cd = def.cd; this.spawnProj({ x: cs.x, y: cs.y, a: a + (Math.random() - 0.5) * 0.6, spd: 320, dmg: def.dmg * dmgMul, pierce: 1, life: 2.0, r: 6, school: 'dark', color: def.color, kind: 'homing', w: null, home: 5 }); if (Math.random() < 0.15) Prog.spawnOrb(best.x, best.y, 1, 'gold'); break;
      }
      Audio.sfx('hit', cs.x);
    }
  }
};

// ─── الجواهر v2.1: التقاط القطع القديمة + عدّ الجواهر ───
Combat.updateOrbs = function (dt) {
  const r = Game.run, p = r.player, s = r.stats, cnt = Combat.getCounters(r);
  const mag = s.pickup * (r.hooks.magnet ? 2.2 : 1);
  Core.pools.orbs.forEach((o) => {
    o.px = o.x; o.py = o.y;
    const d = U.dist(o.x, o.y, p.x, p.y);
    if (o.type === 'chest') { if (d < 40) { Prog.openChest(o); Core.pools.orbs.release(o); } return; }
    if (o.type === 'frag') {
      if (d < 34) {
        Meta.stats.fragments[o.fragId] = true; cnt.frags++; Save.mark();
        Render.fxExplosion(o.x, o.y, 40, '#f5c542');
        Core.pools.orbs.release(o);
      }
      return;
    }
    if (d < mag || o.magnet) {
      o.magnet = true;
      const a = Math.atan2(p.y - o.y, p.x - o.x);
      const sp = 420 + (mag - d) * 2;
      o.x += Math.cos(a) * sp * dt; o.y += Math.sin(a) * sp * dt;
    }
    if (d < 22) {
      if (o.type === 'xp') { Prog.addXp(o.val); cnt.orbs++; }
      else if (o.type === 'gold') { const g = Math.max(1, Math.round(o.val * s.gold * (1 + s.luck * 0.5))); r.gold += g; r.goldRun += g; r.challengeProg.gold += g; Audio.sfx('gold'); }
      else if (o.type === 'heal') { const h = o.val; p.hp = Math.min(s.maxHp, p.hp + h); cnt.heal += h; Audio.sfx('heal'); Render.fText(p.x, p.y - 24, '+' + U.num(Math.round(h)), '#5eeaa4', 16); }
      else if (o.type === 'shard') { r.shards++; Audio.sfx('unlock'); Render.fText(p.x, p.y - 26, t('shardPickup'), '#b06cff', 14); }
      Core.pools.orbs.release(o);
    }
  });
};

// ─── التآزرات الدورية v2.1: بخار + تصعيق المجمّد + كسوف ───
Combat.updateSynergies = function (dt) {
  const r = Game.run, p = r.player;
  r.synT -= dt;
  if (r.synT > 0) return;
  r.synT = 0.5;
  if (r.syn.steam_burst) { this.aoeDamage(p.x, p.y, 130, 35 * r.stats.dmg, 'ice'); Render.fxExplosion(p.x, p.y, 130, '#bfe8ff'); Audio.sfx('explode'); r.syn.steamT = (r.syn.steamT || 0) + 0.5; if (r.syn.steamT < 5) r.synT = 5 - r.syn.steamT; else r.syn.steamT = 0; }
  if (r.syn.frozen_storm) {
    Core.pools.enemies.forEach(e => { if (e.freezeT > 0) { this.hitEnemy(e, 16 * r.stats.dmg, 'lightning', { noCrit: true }); Render.fxZap(p.x, p.y, e.x, e.y, '#ffe95c'); } });
  }
  // تآزر الكسوف: موجة نور/ظلام دورية
  if (r.synProcs.eclipseNova) {
    const P = r.synProcs.eclipseNova; P.t += 0.5;
    if (P.t >= 6) { P.t = 0; this.aoeDamage(p.x, p.y, 170, 55 * r.stats.dmg, 'dark'); Render.fxExplosion(p.x, p.y, 170, '#c9b8ff'); Audio.sfx('explode'); }
  }
};

// ─── الموجات v2.1: نفس التدفق + جدولة الزعماء الصغار ───
(function () {
  const wu = Waves.update.bind(Waves);
  Waves.update = function (dt) {
    wu(dt);
    const r = Game.run; if (!r) return;
    // زعيم صغير عند الدقائق 3 / 5.5 / 7.5
    const sched = [180, 330, 450];
    r.miniIdx = r.miniIdx || 0;
    if (r.miniIdx < sched.length && r.time >= sched[r.miniIdx]) {
      const pool = Data.miniFor(r.stageId);
      if (pool.length) {
        const md = pool[r.miniIdx % pool.length];
        this.spawnMini(md);
      }
      r.miniIdx++;
    }
  };
  Waves.spawnMini = function (md) {
    const r = Game.run, pos = Spawn.edgePos();
    const e = Spawn.spawnEnemy(Data.STAGES.find(s => s.id === md.stage).enemies[0], pos.x, pos.y, null, true);
    if (!e) return;
    e.def = md; e.uid = Core.uidSeq++;
    e.maxHp = e.hp = md.hp * (1 + r.stageIdx * 0.18);
    e.r = md.r; e.dmg = md.dmg; e.spd = md.spd; e.xp = md.xp;
    e.mini = true; e.mech = md.mech; e.isBoss = false;
    r.minis = r.minis || []; r.minis.push(e);
    r.miniActive = true;
    UI.toast(t('miniIncoming'), 'bad');
    UI.showBossBar(md, true);
    Audio.sfx('boss'); Game.shake(8, 0.4);
    return e;
  };
})();
// إحصاء آخر ضربة للزعيم الصغير (لميكانيكا الشفاء)
Combat.lastHit = function (e) { if (e) e.lastHitT = Game.run ? Game.run.time : 0; };
// — موت الزعيم الصغير: مكافآت وإشعال الشريط —
Game.onMiniKilled = function (e) {
  const r = this.run, cnt = Combat.getCounters(r);
  cnt.minis++;
  Meta.stats.minis = (Meta.stats.minis || 0) + 1;
  r.minis = (r.minis || []).filter(b => b !== e);
  r.miniActive = (r.minis || []).some(b => b.active);
  UI.hideBossBar();
  Audio.sfx('bossdie'); this.shake(10, 0.5); UI.haptic([60, 30, 60]);
  Render.fxExplosion(e.x, e.y, 160, e.def.color);
  Prog.spawnOrb(e.x, e.y, 1, 'shard');
  Prog.dropChest(e.x + 26, e.y);
  if (Math.random() < 0.35) Combat.dropFragment(e.x - 20, e.y);
  Save.mark();
};
/* ═══════════ v2.1 — UI: المتجر + الخزانة + موسوعة موسعة + إنجازات بفئات + تحديات موسمية ═══════════ */

// ─── وصف أثر يغطي المفاتيح الجديدة واللعنات ───
function artDesc(a) {
  const ar = I18N.lang() === 'ar', pct = Math.round(a.v * 100);
  const hookMap = {
    noRevive: ar ? 'لعنة: لا بعث في هذه الجولة' : 'Cursed: no revives',
    goldCurse: ar ? 'لعنة: الذهب -' + Math.round((a.v2 || 0.2) * 100) + '%' : 'Cursed: -' + Math.round((a.v2 || 0.2) * 100) + '% gold'
  };
  let s = '';
  if (a.k) {
    const M = ar ? {
      dmg: 'الضرر +' + pct + '%', cdRed: 'تبريد أسرع ' + pct + '%', area: 'المساحة +' + pct + '%', ms: 'الحركة +' + pct + '%',
      armor: 'الدرع +' + a.v, regen: 'التجدد +' + a.v + '/ث', crit: 'الحرجة +' + pct + '%', critDmg: 'ضرر حرج +' + pct + '%',
      xp: 'الخبرة +' + pct + '%', pickup: 'الالتقاط +' + pct + '%', luck: 'الحظ +' + pct + '%', hp: 'الصحة +' + a.v,
      amount: 'مقذوف +1', revive: 'بعث +1', gold: 'الذهب +' + pct + '%', dashCd: 'تبريد الاندفاع -' + pct + '%',
      projSpeed: 'سرعة المقذوف +' + pct + '%', dodge: 'مراوغة +' + pct + '%', dmgBoss: 'ضرر الزعماء +' + pct + '%',
      dmgElite: 'ضرر النخبة +' + pct + '%', block: 'صدّ +' + pct + '%', lifesteal: 'امتصاص حياة ' + pct + '%',
      duration: 'مدة التأثير +' + pct + '%', school: 'ضرر ' + (Data.SCHOOLS[a.sk] ? Data.SCHOOLS[a.sk].ar : '') + ' +' + pct + '%'
    } : {
      dmg: '+' + pct + '% dmg', cdRed: 'Faster cast ' + pct + '%', area: '+' + pct + '% area', ms: '+' + pct + '% move',
      armor: '+' + a.v + ' armor', regen: '+' + a.v + ' regen/s', crit: '+' + pct + '% crit', critDmg: '+' + pct + '% crit dmg',
      xp: '+' + pct + '% XP', pickup: '+' + pct + '% pickup', luck: '+' + pct + '% luck', hp: '+' + a.v + ' HP',
      amount: '+1 projectile', revive: '+1 revive', gold: '+' + pct + '% gold', dashCd: '-' + pct + '% dash cd',
      projSpeed: '+' + pct + '% proj speed', dodge: '+' + pct + '% dodge', dmgBoss: '+' + pct + '% boss dmg',
      dmgElite: '+' + pct + '% elite dmg', block: '+' + pct + '% block', lifesteal: pct + '% lifesteal',
      duration: '+' + pct + '% duration', school: '+' + pct + '% ' + (Data.SCHOOLS[a.sk] ? Data.SCHOOLS[a.sk].en : '') + ' dmg'
    };
    s = M[a.k] || '';
  }
  if (a.hook && !hookMap[a.hook]) s += (s ? ' • ' : '') + (ar ? arHook(a.hook, a.v) : enHook(a.hook, a.v));
  else if (a.hook) s += (s ? ' • ' : '') + hookMap[a.hook];
  if (a.hpPenalty) s += (s ? ' • ' : '') + (ar ? 'لعنة: الصحة القصوى ' + Math.round(a.hpPenalty * 100) + '%' : 'Cursed: max HP ' + Math.round(a.hpPenalty * 100) + '%');
  return s;
}
const RAR_K = { rare: 'rarityRare', epic: 'rarityEpic', leg: 'rarityLeg' };
const RAR_CLS = { rare: 'rar-rare', epic: 'rar-epic', leg: 'rar-leg' };

// ─── شاشة المتجر الدائم ───
UI.buildShop = function () {
  const box = this.$('mods-list'), scr = this.$('screen-shop');
  const list = scr.querySelector('.shop-list'); list.innerHTML = '';
  Data.PERM_UPGRADES.forEach(p => {
    const lv = Meta.permUpgrades[p.id] || 0, maxed = lv >= p.max;
    const el = document.createElement('div');
    el.className = 'shop-row';
    let pips = '<div class="pips">';
    for (let i = 0; i < p.max; i++) pips += '<div class="pip' + (i < lv ? ' on' : '') + '"></div>';
    pips += '</div>';
    const btn = maxed ? '<span class="tag" style="border-color:var(--ok);color:var(--ok)">' + t('maxed2') + '</span>'
      : '<button class="btn gold" style="min-height:34px;font-size:.82em">' + U.num(Data.permCost(p, lv)) + ' ◉</button>';
    el.innerHTML = '<div style="flex:1;min-width:0"><b>' + (I18N.lang() === 'ar' ? p.ar : p.en) + '</b>' +
      '<div class="dim" style="font-size:.78em">' + (I18N.lang() === 'ar' ? p.dar : p.den) + '</div>' + pips + '</div>' + btn;
    if (!maxed) el.querySelector('button').onclick = () => {
      if (Shop.buy(p)) { this.refreshMenuCurrency(); this.buildShop(); Ach.check(); }
      else { this.toast(t('notEnoughGold'), 'bad'); Audio.sfx('banish'); }
    };
    list.appendChild(el);
  });
  const g = scr.querySelector('#shop-gold'); if (g) g.textContent = U.num(Meta.gold);
};

// ─── شاشة الخزانة ───
UI._wardTab = 'skins';
UI.buildWardrobe = function () {
  const scr = this.$('screen-wardrobe'), grid = scr.querySelector('.ward-grid');
  const tabs = scr.querySelectorAll('.ward-tabs .tab');
  tabs.forEach(tb => {
    tb.classList.toggle('on', tb.getAttribute('data-w') === this._wardTab);
    tb.onclick = () => { this._wardTab = tb.getAttribute('data-w'); Audio.sfx('click'); this.buildWardrobe(); };
  });
  grid.innerHTML = '';
  const kind = this._wardTab;
  const items = kind === 'skins' ? Data.SKINS : kind === 'trails' ? Data.TRAILS : Data.SPELL_COLORS;
  const eqKey = kind === 'skins' ? 'skin' : kind === 'trails' ? 'trail' : 'color';
  items.forEach(it => {
    const owned = Wardrobe.owns(kind, it.id), eq = Meta.cosmetics.equipped[eqKey] === it.id;
    const el = document.createElement('div');
    el.className = 'skin-card' + (eq ? ' sel' : '') + (owned ? '' : ' locked');
    const prevCol = kind === 'skins' ? it.body : kind === 'trails' ? (it.color || '#2a3352') : (it.color || '#2a3352');
    let foot = '';
    if (eq) foot = '<span class="tag" style="color:var(--acc);border-color:var(--acc)">' + t('equipped') + '</span>';
    else if (owned) foot = '<button class="btn" style="min-height:30px;font-size:.78em;width:100%">' + t('equip') + '</button>';
    else foot = '<button class="btn ' + (it.cur === 'shards' ? '' : 'gold') + '" style="min-height:30px;font-size:.78em;width:100%">' + U.num(it.cost) + (it.cur === 'shards' ? ' ✦' : ' ◉') + '</button>';
    el.innerHTML = '<div class="skin-prev" style="background:radial-gradient(circle at 35% 30%,' + prevCol + ',rgba(0,0,0,.55))"></div>' +
      '<div style="font-weight:800;font-size:.85em">' + (I18N.lang() === 'ar' ? it.ar : it.en) + '</div>' +
      (it.leg ? '<div style="color:var(--gold);font-size:.7em;font-weight:800">' + t('rarityLeg') + '</div>' : '') + foot;
    const b = el.querySelector('button');
    if (b) b.onclick = () => {
      if (owned) Wardrobe.equip(kind, it.id);
      else if (Wardrobe.buy(kind, it)) { Wardrobe.equip(kind, it.id); this.toast(t('newUnlock'), 'gold'); }
      else { this.toast(it.cur === 'shards' ? t('notEnough') : t('notEnoughGold'), 'bad'); Audio.sfx('banish'); }
      this.refreshMenuCurrency(); this.buildWardrobe(); Ach.check();
    };
    grid.appendChild(el);
  });
  const g = scr.querySelector('#ward-gold'); if (g) g.textContent = U.num(Meta.gold);
  const sh = scr.querySelector('#ward-shards'); if (sh) sh.textContent = U.num(Meta.shards);
};

// ─── الشخصيات الـ14: ميزتان + كلفة ───
UI.buildChars = function () {
  const box = this.$('char-grid'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  Data.CHARACTERS.forEach(c => {
    const unlocked = Meta.unlockedChars.includes(c.id);
    const el = document.createElement('div');
    el.className = 'char-card' + (unlocked ? '' : ' locked') + (Meta.selectedChar === c.id ? ' sel' : '');
    let unlockLine = '';
    if (!unlocked) {
      if (c.unlock.type === 'gold') unlockLine = '<button class="btn gold" style="min-height:32px;font-size:.8em;margin-top:6px">' + tf('unlockGold', c.unlock.cost) + '</button>';
      else if (c.unlock.type === 'shards') unlockLine = '<button class="btn" style="min-height:32px;font-size:.8em;margin-top:6px;border-color:var(--acc2)">' + tf('unlockShards', c.unlock.cost) + '</button>';
      else { const a = Data.achievement(c.unlock.ach); unlockLine = '<div class="dim" style="font-size:.78em;margin-top:6px">' + (a ? (ar ? a.dar : a.den) : '') + '</div>'; }
    }
    const w = Data.weapon(c.weapon);
    const perkHtml = (c.perks || [c.perk]).filter(Boolean).map(p => '<div class="stat-line"><span>' + t('perk') + '</span><b>' + (ar ? p.ar : p.en) + '</b></div>').join('');
    const drawHtml = c.drawback ? '<div class="stat-line"><span>' + t('drawback') + '</span><b style="color:#ff7b86">' + (ar ? c.drawback.ar : c.drawback.en) + '</b></div>' : '';
    el.innerHTML = '<div class="row"><div style="width:26px;height:26px;border-radius:50%;background:' + c.color + ';box-shadow:0 0 10px ' + c.color + '"></div><div class="card-name">' + (ar ? c.ar : c.en) + '</div></div>' +
      '<div class="stat-line"><span>' + t('startWeapon') + '</span><b style="color:' + w.color + '">' + (ar ? w.ar : w.en) + '</b></div>' +
      perkHtml + drawHtml +
      '<div class="stat-line"><span>HP</span><b>' + U.num(c.hp) + '</b></div>' + unlockLine;
    el.onclick = (ev) => {
      if (unlocked) { Meta.selectedChar = c.id; Save.mark(); Audio.sfx('click'); this.buildChars(); return; }
      if (c.unlock.type === 'gold') {
        if (Meta.gold >= c.unlock.cost) { Meta.gold -= c.unlock.cost; Meta.stats.goldSpent += c.unlock.cost; Meta.unlockedChars.push(c.id); Save.mark(); Audio.sfx('unlock'); this.toast(t('charUnlocked') + ': ' + (ar ? c.ar : c.en), 'gold'); this.refreshMenuCurrency(); this.buildChars(); Ach.check(); }
        else { this.toast(t('notEnoughGold'), 'bad'); Audio.sfx('banish'); }
      } else if (c.unlock.type === 'shards') {
        if (Meta.shards >= c.unlock.cost) { Meta.shards -= c.unlock.cost; Meta.unlockedChars.push(c.id); Save.mark(); Audio.sfx('unlock'); this.toast(t('charUnlocked') + ': ' + (ar ? c.ar : c.en), 'gold'); this.refreshMenuCurrency(); this.buildChars(); Ach.check(); }
        else { this.toast(t('notEnough'), 'bad'); Audio.sfx('banish'); }
      }
    };
    box.appendChild(el);
  });
};

// ─── الموسوعة الموسعة: أعداء/زعماء/أسلحة/قطع/عناصر/قطع قديمة/مرافقين ───
UI.buildCodex = function () {
  const box = this.$('codex-grid'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar', tab = this._codexTab;
  let items = [], found = () => false, total = 0, cnt = 0;
  if (tab === 'enemies') { items = Object.entries(Data.ENEMIES); found = id => Meta.stats.enemiesSeen[id]; }
  else if (tab === 'bosses') { items = Object.entries(Data.BOSSES); found = id => (Meta.stats.bossKinds || {})[id]; }
  else if (tab === 'weapons') { items = Data.WEAPONS.map(w => [w.id, w]).concat(Object.entries(Data.EVOLVED).map(([id, e]) => [id, Object.assign({ ar: e.ar, en: e.en, school: e.school }, e)])); found = id => Meta.stats.weaponsFound[id]; }
  else if (tab === 'artifacts') { items = Data.ARTIFACTS.map(a => [a.id, a]); found = id => Meta.stats.artifactsFound[id]; }
  else if (tab === 'elements') {
    const ed = Meta.stats.elemDmg || {};
    Data.ELEMENTS.forEach(el => {
      const m = Data.masteryLvl(ed[el.id] || 0), cur = ed[el.id] || 0;
      const nextNeed = Math.pow(m + 1, 2) * 1500, prevNeed = Math.pow(m, 2) * 1500;
      const pct = Math.min(100, ((cur - prevNeed) / Math.max(1, nextNeed - prevNeed)) * 100);
      const weakN = Object.values(Data.ENEMIES).filter(e => e.weak === el.id).length;
      const resN = Object.values(Data.ENEMIES).filter(e => e.resist === el.id).length;
      const d = document.createElement('div');
      d.className = 'elem-card';
      d.innerHTML = '<div class="row"><span style="font-size:1.3em">' + el.icon + '</span><b style="color:' + el.color + '">' + (ar ? el.ar : el.en) + '</b><span class="spacer"></span><span class="tag">' + tf('masteryLvl', m) + '</span></div>' +
        '<div class="ds dim" style="font-size:.78em;margin-top:4px">' + (ar ? el.dar : el.den) + '</div>' +
        '<div class="dim" style="font-size:.72em;margin-top:4px">' + t('weakTo') + ': ' + U.num(weakN) + ' • ' + t('resistsTo') + ': ' + U.num(resN) + '</div>' +
        '<div class="mbar"><div style="width:' + pct + '%;background:' + el.color + '"></div></div>';
      box.appendChild(d);
    });
    let chip = this.$('codex-count');
    if (!chip) { chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'codex-count'; document.querySelector('#screen-codex .scr-head').appendChild(chip); }
    chip.textContent = t('elemHint');
    return;
  } else if (tab === 'fragments') {
    Data.FRAGMENTS.forEach(f => {
      const ok = !!Meta.stats.fragments[f.id];
      const d = document.createElement('div');
      d.className = 'frag-card codex-card' + (ok ? '' : ' lock');
      d.innerHTML = '<div class="nm" style="color:' + (ok ? 'var(--gold)' : '#5a6280') + '">' + (ok ? (ar ? f.ar : f.en) : t('codexLocked')) + '</div>' +
        '<div class="ds">' + (ok ? (ar ? f.dar : f.den) : t('fragHint')) + '</div>';
      box.appendChild(d);
    });
    let chip = this.$('codex-count');
    if (!chip) { chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'codex-count'; document.querySelector('#screen-codex .scr-head').appendChild(chip); }
    const n = Object.keys(Meta.stats.fragments).length;
    chip.textContent = tf('discovered', n) + ' / ' + U.num(Data.FRAGMENTS.length);
    return;
  } else if (tab === 'familiars') {
    Data.COMPANIONS.filter(c => c.id !== 'none').forEach(c => {
      let unlocked = c.unlockStage < 1;
      if (!unlocked) { const st = Data.STAGES[c.unlockStage - 1]; unlocked = st ? (Meta.stats.stageClears[st.id] || 0) >= 1 : false; }
      const d = document.createElement('div');
      d.className = 'codex-card' + (unlocked ? '' : ' lock');
      const kindTxt = { melee: ar ? 'ضربات قريبة' : 'Melee', ranged: ar ? 'قذف بعيد' : 'Ranged', support: ar ? 'دعم وشفاء' : 'Support', crit: ar ? 'هالة حرجة' : 'Crit Aura', spray: ar ? 'رشق سريع' : 'Rapid Spray', web: ar ? 'شباك مُبطئة' : 'Webs', peck: ar ? 'منقار تعقب' : 'Homing Peck' }[c.kind] || '';
      d.innerHTML = '<div class="nm" style="color:' + (unlocked ? c.color : '#5a6280') + '">' + (unlocked ? (ar ? c.ar : c.en) : t('codexLocked')) + '</div>' +
        '<div class="ds">' + (unlocked ? kindTxt : (ar ? 'يُفتح بإكمال مرحلة رقم ' : 'Unlocks by clearing stage ') + U.num(c.unlockStage)) + '</div>';
      box.appendChild(d);
    });
    let chip = this.$('codex-count');
    if (!chip) { chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'codex-count'; document.querySelector('#screen-codex .scr-head').appendChild(chip); }
    chip.textContent = '';
    return;
  }
  total = items.length;
  items.forEach(([id, it]) => {
    const ok = !!found(id); if (ok) cnt++;
    const el = document.createElement('div');
    const rarCls = it.rar ? ' ' + RAR_CLS[it.rar] : '';
    el.className = 'codex-card' + (ok ? '' : ' lock') + rarCls;
    const col = it.school ? (Data.SCHOOLS[it.school] ? Data.SCHOOLS[it.school].color : it.color) : (it.color || '#8b93ad');
    let sub = '';
    if (ok && tab === 'artifacts') { sub = artDesc(it); if (it.rar) sub = t(RAR_K[it.rar]) + ' • ' + sub; }
    else if (ok && (tab === 'enemies' || tab === 'bosses')) {
      sub = 'HP ' + U.num(it.hp) + ' • ' + (ar ? 'ضرر' : 'dmg') + ' ' + U.num(it.dmg || 0);
      if (it.weak) sub += '<br><span style="font-size:.9em">' + t('weakTo') + ': <b style="color:' + (Data.SCHOOLS[it.weak] ? Data.SCHOOLS[it.weak].color : '#fff') + '">' + (ar ? Data.SCHOOLS[it.weak].ar : Data.SCHOOLS[it.weak].en) + '</b> • ' + t('resistsTo') + ': <b style="color:' + (Data.SCHOOLS[it.resist] ? Data.SCHOOLS[it.resist].color : '#fff') + '">' + (ar ? Data.SCHOOLS[it.resist].ar : Data.SCHOOLS[it.resist].en) + '</b></span>';
    } else if (ok) sub = (it.school ? (ar ? Data.SCHOOLS[it.school].ar : Data.SCHOOLS[it.school].en) : '');
    el.innerHTML = '<div class="nm" style="color:' + (ok ? col : '#5a6280') + '">' + (ok ? (ar ? it.ar : it.en) : t('codexLocked')) + '</div><div class="ds">' + (ok ? sub : t('undiscovered')) + '</div>';
    box.appendChild(el);
  });
  let chip = this.$('codex-count');
  if (!chip) { chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'codex-count'; document.querySelector('#screen-codex .scr-head').appendChild(chip); }
  chip.textContent = tf('discovered', cnt) + ' / ' + U.num(total);
};

// ─── الإنجازات: تبويبات فئات + إخفاء السرية ───
UI._achCat = 'all';
UI.buildAch = function () {
  const head = document.querySelector('#screen-ach .scr-head');
  let tabs = document.getElementById('ach-cats');
  if (!tabs) {
    tabs = document.createElement('div'); tabs.className = 'tabs'; tabs.id = 'ach-cats';
    tabs.style.cssText = 'margin-bottom:8px';
    head.parentElement.insertBefore(tabs, head.parentElement.querySelector('.scroll'));
  }
  tabs.innerHTML = '';
  const mkTab = (id, label) => {
    const b = document.createElement('button');
    b.className = 'tab' + (this._achCat === id ? ' on' : '');
    b.textContent = label;
    b.onclick = () => { this._achCat = id; Audio.sfx('click'); this.buildAch(); };
    tabs.appendChild(b);
  };
  mkTab('all', t('achAll'));
  Data.ACH_CATS.forEach(c => mkTab(c.id, t(c.k) + ' ' + c.icon));
  const box = this.$('ach-list'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  let done = 0, shown = 0;
  Data.ACHIEVEMENTS.forEach(a => {
    const st = Meta.achievements[a.id] || { p: 0, done: false };
    if (st.done) done++;
    if (this._achCat !== 'all' && a.cat !== this._achCat) return;
    shown++;
    const p = Math.min(a.target, a.get(Meta) || 0);
    const hidden = a.secret && !st.done;
    const name = hidden ? '؟؟؟' : (ar ? a.ar : a.en);
    const desc = hidden ? (ar ? a.dar : a.den) : (ar ? a.dar : a.den);
    const el = document.createElement('div');
    el.className = 'ach' + (st.done ? ' done' : '') + (a.secret ? ' rar-epic' : '');
    el.innerHTML = '<div class="ic">' + (hidden ? '؟' : a.icon) + '</div><div class="info"><div class="row" style="justify-content:space-between"><b>' + name + '</b><span class="dim" style="font-size:.8em">' + U.num(p) + '/' + U.num(a.target) + '</span></div>' +
      '<div class="dim" style="font-size:.75em">' + desc + '</div><div class="pbar"><div style="width:' + (p / a.target * 100) + '%"></div></div></div>';
    box.appendChild(el);
  });
  this.$('ach-summary').textContent = tf('achSummary', done) + ' / ' + U.num(Data.ACHIEVEMENTS.length);
};

// ─── التحديات الثلاثين المعروضة: يومية 3 + أسبوعية 2 + موسمية 1 ───
UI.buildChal = function () {
  const mk = (it, box) => {
    const el = document.createElement('div');
    el.className = 'ach' + (it.done ? ' done' : '');
    el.innerHTML = '<div class="ic">' + (it.done ? '✓' : '⚑') + '</div><div class="info"><div class="row" style="justify-content:space-between"><b>' + Chal.desc(it) + '</b><span class="purple-txt" style="font-size:.85em">+' + U.num(it.reward) + ' ✦</span></div><div class="pbar"><div style="width:' + Math.min(100, it.prog / it.n * 100) + '%"></div></div></div>';
    box.appendChild(el);
  };
  const d = this.$('daily-list'); d.innerHTML = '';
  Meta.challenges.daily.list.forEach(it => mk(it, d));
  const w = this.$('weekly-list'); w.innerHTML = '';
  Meta.challenges.weekly.list.forEach(it => mk(it, w));
  const m = this.$('monthly-list'); if (m) { m.innerHTML = ''; (Meta.challenges.monthly.list || []).forEach(it => mk(it, m)); }
  this.$('chal-reset').textContent = t('dailyReset') + ' — ' + t('weeklyReset') + ' — ' + t('monthlyReset');
};

// ─── شاشة الترقية: بطاقات القطع + الندرة + اللعنة ───
UI.openLevelup = function (regen) {
  const r = Game.run;
  if (!r) return;
  Game.setState('levelup');
  this._luOpts = Prog.generateOptions();
  this._luSel = this._luOpts[0] || null;
  const box = this.$('lu-cards'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  this._luOpts.forEach((opt) => {
    const card = document.createElement('div');
    let kind = '', name = Prog.optName(opt), desc = '', color = '#7ee8fa', extraCls = '';
    if (opt.kind === 'evo') {
      kind = t('kindEvo'); color = '#f5c542'; extraCls = ' evo';
      const ev = Data.EVOLVED[Data.EVO_MAP[opt.id].evo];
      desc = ar ? ev.descAr : ev.descEn;
    } else if (opt.kind === 'new') {
      kind = t('kindNew');
      const d = Data.weapon(opt.id); color = d.color;
      desc = (ar ? Data.SCHOOLS[d.school].ar : Data.SCHOOLS[d.school].en) + ' • ' + U.num(d.dmg) + (ar ? ' ضرر' : ' dmg') + ' • ' + (ar ? 'تبريد ' : 'cd ') + U.numF(d.cd) + 's';
    } else if (opt.kind === 'up') {
      kind = t('kindUp'); color = opt.w.def.color;
      desc = (ar ? 'المستوى ' : 'Level ') + U.num(opt.w.lv) + ' → ' + U.num(opt.w.lv + 1) + ' • +' + U.num(13) + '%' + (ar ? ' ضرر' : ' dmg');
      if (opt.w.lv + 1 === 3 || opt.w.lv + 1 === 6) desc += ' • +' + U.num(1) + (ar ? ' مقذوف' : ' proj');
    } else if (opt.kind === 'p') {
      kind = t('kindPassive');
      const P = Data.passive(opt.id); color = '#b06cff';
      desc = (ar ? P.arD : P.enD) + ' (' + U.num(r.passives[opt.id] || 0) + '/' + U.num(P.max) + ')';
    } else if (opt.kind === 'gold') { kind = t('kindGold'); color = '#f5c542'; desc = '+' + U.num(opt.val) + ' ' + t('goldEarned'); }
    else if (opt.kind === 'art') {
      const a = Data.artifact(opt.id);
      kind = t('kindPassive') + (a.rar && a.rar !== 'rare' ? ' • ' + t(RAR_K[a.rar]) : '');
      color = a.rar === 'leg' ? '#f5c542' : a.rar === 'epic' ? '#b06cff' : '#4a90d9';
      desc = artDesc(a);
      if (a.cursed || a.hpPenalty) { desc = '🕯 ' + t('curseWarn') + ' ' + desc; extraCls += ' rar-leg'; }
    }
    card.className = 'lu-card' + extraCls;
    card.innerHTML = '<div class="kind" style="color:' + color + '">' + kind + '</div>' +
      '<div class="nm">' + name + '</div><div class="ds">' + desc + '</div>' +
      '<div class="pin" title="Lock">' + (r.lockedId === opt.kind + ':' + opt.id ? '◈' : '◇') + '</div>';
    card.onclick = () => { Audio.sfx('click'); Prog.choose(opt); };
    card.querySelector('.pin').onclick = (ev) => { ev.stopPropagation(); Prog.lock(opt); };
    box.appendChild(card);
  });
  const bb = this.$('lu-banish');
  bb.disabled = r.banishCharge <= 0;
  this.$('lu-charge').textContent = r.banishCharge > 0 ? '✦ ' + t('banish') : t('banishHint');
  this.showScreen('screen-levelup');
};

// ─── شريط الزعيم يدعم الصغار ───
UI.showBossBar = function (def, mini) {
  const bb = this.$('bossbar');
  bb.classList.remove('hidden');
  bb.classList.toggle('mini', !!mini);
  this.$('bossname').textContent = (mini ? t('miniBoss') + ' — ' : '') + (I18N.lang() === 'ar' ? def.ar : def.en);
};
UI.hideBossBar = function () {
  const bb = this.$('bossbar');
  bb.classList.add('hidden'); bb.classList.remove('mini');
};

// ─── تحديث HUD: شريط الصغار + شرائح حالات اللاعب ───
(function () {
  const uh = UI.updateHUD.bind(UI);
  UI.updateHUD = function () {
    uh();
    const r = Game.run; if (!r) return;
    // شريط الزعيم الصغير إن لم يوجد كبير
    if (r.miniActive && !r.bossActive) {
      const m = (r.minis || []).find(x => x.active);
      if (m) { this.$('bossbar').classList.remove('hidden'); this.$('bossbar').classList.add('mini'); this.$('bossfill').style.transform = 'scaleX(' + U.clamp(m.hp / m.maxHp, 0, 1) + ')'; if (!this._miniName) this.$('bossname').textContent = t('miniBoss') + ' — ' + (I18N.lang() === 'ar' ? m.def.ar : m.def.en); }
    } else if (!r.bossActive) this.$('bossbar').classList.add('hidden');
    // شرائح الحالات
    let row = document.getElementById('status-row');
    if (!row) { row = document.createElement('div'); row.id = 'status-row'; row.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap'; document.getElementById('hud-chips').appendChild(row); }
    const p = r.player, chips = [];
    if (p.curseT > 0) chips.push('<span class="statchip" style="color:#a67aff">🕯 ' + t('stCurse') + '</span>');
    if (p.blessT > 0) chips.push('<span class="statchip" style="color:#fff3b0">🕊 ' + t('stBless') + '</span>');
    if (p.burnT > 0) chips.push('<span class="statchip" style="color:#ff8a3a">🔥</span>');
    if (p.slowT > 0) chips.push('<span class="statchip" style="color:#9fd8ff">🐌</span>');
    if (p.blindT > 0) chips.push('<span class="statchip" style="color:#c9d4e8">👁 ' + t('stBlind') + '</span>');
    if (p.stunT > 0) chips.push('<span class="statchip" style="color:#ffe95c">⚡ ' + t('stStun') + '</span>');
    const synN = Object.keys(r.syn).length;
    if (synN) chips.push('<span class="statchip" style="color:var(--acc)">⛓ ' + U.num(synN) + '</span>');
    row.innerHTML = chips.join('');
  };
})();

// ─── إعادة بناء الشاشة المفتوحة عند تبديل اللغة فورًا ───
UI._curScreen = null;
const _showScreen = UI.showScreen.bind(UI);
UI.showScreen = function (id) { UI._curScreen = id; _showScreen(id); };
UI.refreshScreen = function () {
  Meta.stats.langSwitched = 1; Save.mark();
  I18N.apply();
  const lb = document.getElementById('btn-lang');
  if (lb) lb.textContent = I18N.lang() === 'ar' ? 'EN' : 'ع';
  const id = UI._curScreen;
  const R = {
    'screen-menu': () => { UI.refreshMenuCurrency(); },
    'screen-stages': () => UI.buildStages(),
    'screen-chars': () => { UI.buildChars(); UI.buildCompRow(); },
    'screen-mods': () => { const sel = UI.modsSel, wk = UI.weeklyOn; UI.buildMods(); UI.modsSel = sel; UI.weeklyOn = wk; UI.applyWeekly && UI.applyWeekly(); UI.updateModsMult(); if (wk) UI.applyWeekly(); },
    'screen-levelup': () => UI.openLevelup(true),
    'screen-codex': () => UI.buildCodex(),
    'screen-ach': () => UI.buildAch(),
    'screen-chal': () => UI.buildChal(),
    'screen-hist': () => UI.buildHist(),
    'screen-talents': () => UI.buildTalents(),
    'screen-settings': () => UI.bindSettings(),
    'screen-shop': () => UI.buildShop(),
    'screen-wardrobe': () => UI.buildWardrobe()
  };
  if (id && R[id]) { try { R[id](); } catch (e) { Log.warn('refresh', id, e.message); } }
};

// ─── ربط زري المتجر والخزانة + إحصاء فتح التصحيح والتصوير والتصدير ───
(function () {
  const init = UI.init.bind(UI);
  UI.init = function () {
    init();
    const $ = (id) => document.getElementById(id);
    $('btn-shop').onclick = () => { Audio.sfx('click'); UI.buildShop(); UI.showScreen('screen-shop'); };
    $('btn-wardrobe').onclick = () => { Audio.sfx('click'); UI.buildWardrobe(); UI.showScreen('screen-wardrobe'); };
    // زر رجوع إضافي للشاشتين الجديدتين
    document.querySelectorAll('#screen-shop .btn-back, #screen-wardrobe .btn-back').forEach(b => b.onclick = () => { Audio.sfx('click'); UI.showScreen('screen-menu'); UI.refreshMenuCurrency(); });
    // عدّادات الإنجازات السرية
    const _dbg = UI.toggleDebug.bind(UI);
    UI.toggleDebug = function () { Meta.stats.debugUsed = 1; Save.mark(); _dbg(); };
    const _photo = UI.photo.bind(UI);
    UI.photo = function () { Meta.stats.photoUsed = 1; Save.mark(); _photo(); };
    // فحص تكافؤ القواميس يظهر في لوحة التصحيح
    const chk = I18N.check();
    if (!chk.ok()) Log.warn('I18N missing — arOnly:', chk.arOnly.join(','), 'enOnly:', chk.enOnly.join(','));
    else Log.log('I18N sync OK (' + Object.keys(I18N.dict.ar).length + ' keys)');
  };
})();
/* ═══════════ v2.1 — Render: أشكال الأعداء الجدد + السكينات + آثار الأقدام + سماء قصر ═══════════ */

// ─── لون السحر المُرتدى ───
Render.tint = function (base) { return Wardrobe.spellTint() || base; };

// ─── خلفية قصر السماء: ثلاث طبقات (جبال سحابية، أبراج، سُحب قريبة) ───
(function () {
  const gp = Render.genParallax.bind(Render);
  Render.genParallax = function (stage) {
    gp(stage);
    if (stage.id !== 'sky') return;
    this.parallax = [];
    const defs = [
      { f: 0.12, alpha: 0.5, col: stage.tiles[0] }, { f: 0.3, alpha: 0.35, col: stage.speck[0] }, { f: 0.55, alpha: 0.22, col: stage.decor }
    ];
    defs.forEach((d, li) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const g = c.getContext('2d'), rng = U.mulberry32(7331 + li * 97);
      g.fillStyle = d.col; g.globalAlpha = 0.9;
      if (li === 0) { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(rng() * 1024, 500, 180 + rng() * 150, Math.PI, 0); g.fill(); } }
      else if (li === 1) { for (let i = 0; i < 6; i++) { const x = rng() * 1000, w = 36 + rng() * 54; g.fillRect(x, 230 + rng() * 130, w, 300); g.beginPath(); g.moveTo(x - 6, 230 + rng() * 130); g.lineTo(x + w / 2, 160 + rng() * 80); g.lineTo(x + w + 6, 230 + rng() * 130); g.fill(); } }
      else { for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(rng() * 1000, 60 + rng() * 380, 40 + rng() * 70, 12 + rng() * 12, 0, 0, U.TAU); g.fill(); } }
      this.parallax.push({ cv: c, f: d.f, alpha: d.alpha });
    });
  };
  // زخرفة بلاط السماء: دوائر سحرية ونجوم
  const gc = Render.getChunk.bind(Render);
  Render.getChunk = function (cx, cy, stage) {
    const c = gc(cx, cy, stage);
    if (stage.id === 'sky' && !c._skyDeco) {
      c._skyDeco = true;
      const g = c.getContext('2d'), rng = U.mulberry32((cx * 911) ^ (cy * 677));
      g.strokeStyle = 'rgba(207,224,255,0.22)'; g.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const x = rng() * 280 + 20, y = rng() * 280 + 20, r = 14 + rng() * 24;
        g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.stroke();
        g.beginPath(); g.arc(x, y, r * 0.55, 0, U.TAU); g.stroke();
      }
      g.fillStyle = 'rgba(255,233,92,0.5)';
      for (let i = 0; i < 3; i++) g.fillRect(rng() * 310, rng() * 310, 2.5, 2.5);
    }
    return c;
  };
})();

// ─── الجواهر: القطعة القديمة نجمة ذهبية دوّارة ───
Render.drawOrbs = function (alpha) {
  const ctx = this.ctx;
  Core.pools.orbs.forEach(o => {
    const x = U.lerp(o.px, o.x, alpha), y = U.lerp(o.py, o.y, alpha);
    if (o.type === 'chest') {
      ctx.fillStyle = '#8a5c1c'; ctx.fillRect(x - 12, y - 9, 24, 16);
      ctx.fillStyle = '#f5c542'; ctx.fillRect(x - 12, y - 12, 24, 6);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - 3, y - 4, 6, 7);
      return;
    }
    if (o.type === 'frag') {
      const a = performance.now() / 300;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? 3.5 : 8.5, aa = (i / 10) * U.TAU; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    const col = o.type === 'xp' ? '#5eeaa4' : o.type === 'gold' ? '#f5c542' : o.type === 'heal' ? '#ff8a9a' : '#b06cff';
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, o.type === 'xp' ? 4 + Math.min(3, o.val * 0.2) : 5, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1.4, y - 1.4, 1.6, 0, U.TAU); ctx.fill();
  });
};

// ─── الأعداء: الأشكال الجديدة السبعة + حلقات الحالات ───
Render.drawEnemies = function (alpha, ctx) {
  const r = Game.run, w2 = this.w / 2 + 70, h2 = this.h / 2 + 70;
  Core.pools.enemies.forEach(e => {
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha);
    const dx = x - this.cam.x, dy = y - this.cam.y;
    if (dx < -w2 || dx > w2 || dy < -h2 || dy > h2) return;
    const c = e.def.color;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.9, e.r * 0.9, e.r * 0.32, 0, 0, U.TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y);
    const wob = 1 + Math.sin(e.animT * 9) * 0.07;
    ctx.scale(2 - wob, wob);
    if (e.ghosting) ctx.globalAlpha = 0.45;
    if (e.elite) { ctx.strokeStyle = e.elite.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(0, 0, e.r + 5 + Math.sin(e.animT * 6) * 2, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = e.ghosting ? 0.45 : 1; }
    if (e.mini) { ctx.strokeStyle = '#b06cff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, 0, e.r + 7 + Math.sin(e.animT * 5) * 2, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const eyes = (s, col) => { ctx.fillStyle = col || '#141824'; const a = Math.atan2(r.player.y - y, r.player.x - x); ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.3 - s / 2, Math.sin(a) * e.r * 0.3, s, 0, U.TAU); ctx.arc(Math.cos(a) * e.r * 0.3 + s / 2 + s, Math.sin(a) * e.r * 0.3, s, 0, U.TAU); ctx.fill(); };
    switch (e.def.shape) {
      case 'crab': ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.25, e.r * 0.85, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * e.r * 0.8, -e.r * 0.3); ctx.lineTo(s * e.r * 1.5, -e.r * 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(s * e.r * 1.5, -e.r * 0.7, e.r * 0.25, 0, U.TAU); ctx.fill(); } eyes(2.2); break;
      case 'spiderE': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.8, 0, U.TAU); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.6; for (let i = 0; i < 4; i++) { const aa = 0.5 + i * 0.45 + Math.sin(e.animT * 8 + i) * 0.15; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * Math.cos(aa) * e.r * 1.7, Math.sin(aa) * e.r * 1.5 - e.r * 0.3); ctx.stroke(); } } eyes(1.8, '#3a1a4a'); break;
      case 'scorpion': ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.2, e.r * 0.75, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-e.r * 0.9, 0); ctx.quadraticCurveTo(-e.r * 1.7, -e.r * 0.4, -e.r * 1.3, -e.r * 1.1); ctx.stroke(); ctx.fillStyle = '#ffe95c'; ctx.beginPath(); ctx.arc(-e.r * 1.3, -e.r * 1.15, 2.6, 0, U.TAU); ctx.fill(); eyes(1.8); break;
      case 'vulture': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.75, 0, U.TAU); ctx.fill(); const vw = Math.sin(e.animT * 11) * 0.65; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-e.r * 1.7, -e.r * vw); ctx.lineTo(-e.r * 0.6, e.r * 0.4); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.r * 1.7, -e.r * vw); ctx.lineTo(e.r * 0.6, e.r * 0.4); ctx.fill(); ctx.fillStyle = '#ffb05c'; ctx.beginPath(); ctx.moveTo(e.r * 0.55, -2); ctx.lineTo(e.r * 1.05, 0); ctx.lineTo(e.r * 0.55, 2); ctx.fill(); eyes(1.6); break;
      case 'knight': ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-e.r * 0.75, -e.r, e.r * 1.5, e.r * 2, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-e.r * 0.75, -e.r * 0.25, e.r * 1.5, 3); ctx.fillStyle = '#8a93b5'; ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r); ctx.lineTo(0, -e.r * 1.45); ctx.lineTo(e.r * 0.5, -e.r); ctx.fill(); eyes(2, '#1a2030'); break;
      case 'gargoyle': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.8, 0, U.TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; const gw = Math.sin(e.animT * 7) * 0.5; ctx.beginPath(); ctx.moveTo(0, -e.r * 0.3); ctx.lineTo(-e.r * 1.6, -e.r * (0.7 + gw)); ctx.lineTo(-e.r * 0.7, e.r * 0.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -e.r * 0.3); ctx.lineTo(e.r * 1.6, -e.r * (0.7 + gw)); ctx.lineTo(e.r * 0.7, e.r * 0.2); ctx.fill(); eyes(2, '#ffe95c'); break;
      case 'leech': ctx.fillStyle = c; const seg = 3; for (let i = seg - 1; i >= 0; i--) { ctx.globalAlpha = (e.ghosting ? 0.4 : 1) - i * 0.18; ctx.beginPath(); ctx.arc(Math.sin(e.animT * 7 + i * 1.4) * 4, -i * 5, e.r * (1 - i * 0.2), 0, U.TAU); ctx.fill(); } ctx.globalAlpha = e.ghosting ? 0.45 : 1; eyes(1.6, '#fff'); break;
      default: // الأشكال الأصلية والزعماء (كما في النسخة الأساسية)
        ctx.fillStyle = c;
        switch (e.def.shape) {
          case 'skel': ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(0, i * 4, e.r * 0.6, 0.3, Math.PI - 0.3); ctx.stroke(); } eyes(2.2); break;
          case 'blob': ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.15, e.r * 0.85, 0, 0, U.TAU); ctx.fill(); eyes(2.4); break;
          case 'archer': ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#6b5c3a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, e.r + 5, -1.2, 1.2); ctx.stroke(); eyes(2); break;
          case 'ghost': ctx.globalAlpha = (e.ghosting ? 0.4 : 0.82); ctx.beginPath(); ctx.arc(0, -2, e.r, Math.PI, 0); ctx.quadraticCurveTo(e.r, e.r * 0.9, 0, e.r * 0.4); ctx.quadraticCurveTo(-e.r, e.r * 0.9, -e.r, -2); ctx.fill(); ctx.globalAlpha = 1; eyes(2.4, '#1a1040'); break;
          case 'brute': ctx.beginPath(); ctx.roundRect(-e.r, -e.r * 0.9, e.r * 2, e.r * 1.8, 6); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-e.r * 0.7, -e.r * 0.4, e.r * 1.4, 5); eyes(3); break;
          case 'bat': ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, U.TAU); ctx.fill(); const fl = Math.sin(e.animT * 14) * 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-e.r * 1.6, -e.r * fl); ctx.lineTo(-e.r * 0.9, e.r * 0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.r * 1.6, -e.r * fl); ctx.lineTo(e.r * 0.9, e.r * 0.5); ctx.fill(); eyes(1.8); break;
          case 'wolf': ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.25, e.r * 0.75, 0, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-e.r * 0.4, -e.r * 0.6); ctx.lineTo(-e.r * 0.2, -e.r * 1.2); ctx.lineTo(0, -e.r * 0.6); ctx.fill(); eyes(2); break;
          case 'golem': ctx.beginPath(); ctx.roundRect(-e.r * 0.9, -e.r, e.r * 1.8, e.r * 2, 8); ctx.fill(); ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, U.TAU); ctx.fill(); eyes(2.6, '#0a2030'); break;
          case 'mage': ctx.beginPath(); ctx.arc(0, 2, e.r * 0.8, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-e.r, 0); ctx.lineTo(0, -e.r * 1.6); ctx.lineTo(e.r, 0); ctx.closePath(); ctx.fill(); eyes(2, '#28100a'); break;
          case 'bug': ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.1, e.r * 0.8, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i * e.r * 0.8, 0); ctx.lineTo(i * e.r * 1.5, -4); ctx.stroke(); } eyes(1.6); break;
          case 'snake': for (let i = 2; i >= 0; i--) { ctx.fillStyle = c; ctx.globalAlpha = 1 - i * 0.2; ctx.beginPath(); ctx.arc(Math.sin(e.animT * 6 + i) * 5, -i * 6, e.r * (1 - i * 0.18), 0, U.TAU); ctx.fill(); } ctx.globalAlpha = 1; eyes(1.8); break;
          case 'mummy': ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.8)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-e.r, -e.r * 0.4 + i * e.r * 0.45); ctx.lineTo(e.r, -e.r * 0.2 + i * e.r * 0.45); ctx.stroke(); } eyes(2.2, '#3a3020'); break;
          case 'imp': ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#8a2410'; ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.7); ctx.lineTo(-e.r * 0.3, -e.r * 1.3); ctx.lineTo(-e.r * 0.1, -e.r * 0.7); ctx.fill(); ctx.beginPath(); ctx.moveTo(e.r * 0.6, -e.r * 0.7); ctx.lineTo(e.r * 0.3, -e.r * 1.3); ctx.lineTo(e.r * 0.1, -e.r * 0.7); ctx.fill(); eyes(2, '#ffe95c'); break;
          case 'eye': ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); const ea = Math.atan2(r.player.y - y, r.player.x - x); ctx.fillStyle = '#2a0a3a'; ctx.beginPath(); ctx.arc(Math.cos(ea) * e.r * 0.3, Math.sin(ea) * e.r * 0.3, e.r * 0.45, 0, U.TAU); ctx.fill(); break;
          case 'spawn': ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU + e.animT; const rr = e.r * (i % 2 ? 0.7 : 1.15); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); eyes(1.8); break;
          default: // الزعماء والزعماء الصغار: قاعدة ضخمة + تاج
            ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, e.r * 0.25, e.r * 0.7, 0, Math.PI); ctx.fill();
            eyes(4, '#1a0505');
            ctx.fillStyle = e.mini ? '#b06cff' : '#f5c542';
            for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * e.r * 0.5 - 5, -e.r * 0.95); ctx.lineTo(i * e.r * 0.5, -e.r * 1.35); ctx.lineTo(i * e.r * 0.5 + 5, -e.r * 0.95); ctx.fill(); }
            if (e.def.shape === 'bossPhoenix') { ctx.fillStyle = 'rgba(255,140,60,0.5)'; const fl2 = Math.sin(e.animT * 8) * 8; ctx.beginPath(); ctx.ellipse(-e.r * 1.2, 0, e.r * 0.5, e.r * 0.9 + fl2, 0.4, 0, U.TAU); ctx.ellipse(e.r * 1.2, 0, e.r * 0.5, e.r * 0.9 + fl2, -0.4, 0, U.TAU); ctx.fill(); }
            break;
        }
        break;
    }
    ctx.restore();
    // تحذير مسبق (تحضير + غوص)
    if (e.state === 'windup' || e.state === 'diveTele') {
      ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(r.player.x, r.player.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,220,80,0.95)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - e.r - 10);
    }
    if ((e.elite || e.mini || e.def.behavior === 'brute') && e.hp < e.maxHp) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw, 4);
      ctx.fillStyle = e.mini ? '#b06cff' : '#ff5964'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw * (e.hp / e.maxHp), 4);
    }
    if (e.flash > 0) { ctx.globalAlpha = e.flash * 0.65; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.freezeT > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(x, y, e.r + 2, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.shockT > 0 && Math.random() < 0.3) { ctx.strokeStyle = '#ffe95c'; ctx.beginPath(); ctx.moveTo(x - e.r, y - e.r); ctx.lineTo(x + e.r * 0.4, y - e.r * 0.3); ctx.stroke(); }
    if (e.vulnT > 0) { ctx.strokeStyle = '#ff9a5c'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, e.r + 3.5, 0.2, 1.35); ctx.arc(x, y, e.r + 3.5, 3.35, 4.5); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.charmT > 0) { ctx.strokeStyle = '#ff8ad8'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, e.r + 5, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.weakenT > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
  });
};

// ─── اللاعب: السكينات + ألوان السحر ───
Render.drawPlayer = function (alpha, ctx) {
  const r = Game.run, p = r.player, ch = Data.char(r.charId);
  if (!ch) return;
  let body = ch.color, cloak = '#0d1020';
  const skId = Meta.cosmetics && Meta.cosmetics.equipped.skin;
  if (skId) { const sk = Data.skin(skId); if (sk && sk.ch === r.charId) { body = sk.body; cloak = sk.cloak; } }
  const x = U.lerp(p.px, p.x, alpha), y = U.lerp(p.py, p.y, alpha);
  for (const g of p.trail) {
    ctx.globalAlpha = g.t * 1.8; ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (p.iframe > 0 && Math.floor(p.iframe * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 13, 12, 4.5, 0, 0, U.TAU); ctx.fill();
  const bob = Math.sin(p.animT * 10) * 1.8;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, 13, 0, U.TAU); ctx.fill();
  ctx.fillStyle = 'rgba(8,10,20,0.4)'; ctx.beginPath(); ctx.arc(0, 2, 13, 0.15, Math.PI - 0.15); ctx.fill();
  ctx.fillStyle = cloak; ctx.beginPath(); ctx.arc(0, -4, 9, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.face.x * 3 - 2.5, -1, 1.8, 0, U.TAU); ctx.arc(p.face.x * 3 + 2.5, -1, 1.8, 0, U.TAU); ctx.fill();
  const w0 = r.weapons[0];
  const wc = this.tint(w0 ? w0.def.color : '#7ee8fa');
  ctx.strokeStyle = '#6b5c3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-p.face.x * 4, 2); ctx.lineTo(p.face.x * 17, p.face.y * 17 - 6); ctx.stroke();
  ctx.fillStyle = wc; ctx.globalAlpha = 0.85 + Math.sin(p.animT * 8) * 0.15; ctx.beginPath(); ctx.arc(p.face.x * 17, p.face.y * 17 - 6, 4.5, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  if (p.dashT > 0) { ctx.strokeStyle = 'rgba(126,232,250,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, 0, U.TAU); ctx.stroke(); }
  if (p.blessT > 0) { ctx.strokeStyle = 'rgba(255,243,176,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(performance.now() / 200) * 2, 0, U.TAU); ctx.stroke(); }
  if (p.curseT > 0) { ctx.strokeStyle = 'rgba(166,122,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 21, 0, U.TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
};

// ─── المرافقون الجدد ───
Render.drawCompanion = function (alpha) {
  const r = Game.run, def = Data.comp(r.companion);
  if (def.kind === 'none') return;
  const cs = r.compState, x = cs.x, y = cs.y;
  const ctx = this.ctx, tN = performance.now();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 9, 3, 0, 0, U.TAU); ctx.fill();
  ctx.fillStyle = def.color;
  switch (def.id) {
    case 'wolf': ctx.beginPath(); ctx.ellipse(x, y, 11, 7, 0, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y - 6); ctx.lineTo(x - 2, y - 12); ctx.lineTo(x, y - 6); ctx.fill(); break;
    case 'ghost': ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, 9, Math.PI, 0); ctx.quadraticCurveTo(x + 9, y + 9, x, y + 6); ctx.quadraticCurveTo(x - 9, y + 9, x - 9, y); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'golem': ctx.beginPath(); ctx.roundRect(x - 8, y - 9, 16, 18, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 5); break;
    case 'fairy': ctx.globalAlpha = 0.7 + Math.sin(tN / 200) * 0.3; ctx.beginPath(); ctx.arc(x, y, 5, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(x - 7, y - 4, 5, 2.5, 0.6, 0, U.TAU); ctx.ellipse(x + 7, y - 4, 5, 2.5, -0.6, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'drake': ctx.beginPath(); ctx.arc(x, y, 8, 0, U.TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,138,92,0.6)'; const fw = Math.sin(tN / 90) * 4; ctx.beginPath(); ctx.ellipse(x - 10, y - 2 + fw, 6, 3, 0.5, 0, U.TAU); ctx.ellipse(x + 10, y - 2 + fw, 6, 3, -0.5, 0, U.TAU); ctx.fill(); break;
    case 'cat': ctx.beginPath(); ctx.ellipse(x, y, 9, 6, 0, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x - 5, y - 6, 4, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#ff8ad8'; ctx.beginPath(); ctx.moveTo(x - 7, y - 9); ctx.lineTo(x - 6, y - 12); ctx.lineTo(x - 5, y - 9); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y - 9); ctx.lineTo(x - 3, y - 12); ctx.lineTo(x - 2, y - 9); ctx.fill(); ctx.fillStyle = '#ffe95c'; ctx.beginPath(); ctx.arc(x - 6, y - 6, 1, 0, U.TAU); ctx.arc(x - 4, y - 6, 1, 0, U.TAU); ctx.fill(); break;
    case 'squirrel': ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0, 0, U.TAU); ctx.fill(); ctx.fillStyle = 'rgba(200,138,74,0.8)'; ctx.beginPath(); ctx.ellipse(x + 8, y - 4, 3, 5, 0.5, 0, U.TAU); ctx.fill(); ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(x - 5, y - 4, 3.4, 0, U.TAU); ctx.fill(); break;
    case 'spider': ctx.beginPath(); ctx.arc(x, y, 5.5, 0, U.TAU); ctx.fill(); ctx.strokeStyle = def.color; ctx.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const aa = 0.5 + i * 0.5 + Math.sin(tN / 300 + i) * 0.12; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * Math.cos(aa) * 11, y + Math.sin(aa) * 9 - 2); ctx.stroke(); } } break;
    case 'raven': ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0.2, 0, U.TAU); ctx.fill(); const rw = Math.sin(tN / 110) * 3; ctx.fillStyle = 'rgba(74,74,102,0.7)'; ctx.beginPath(); ctx.ellipse(x - 7, y - 3 + rw, 5, 2.4, 0.4, 0, U.TAU); ctx.ellipse(x + 7, y - 3 + rw, 5, 2.4, -0.4, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#ffb05c'; ctx.beginPath(); ctx.moveTo(x + 6, y - 1); ctx.lineTo(x + 10, y); ctx.lineTo(x + 6, y + 1.4); ctx.fill(); ctx.globalAlpha = 1; break;
  }
};

// ─── المقذوفات بلون السحر المُرتدى ───
Render.drawProjectiles = function (alpha, ctx, perf) {
  Core.pools.proj.forEach(pr => {
    const x = U.lerp(pr.px, pr.x, alpha), y = U.lerp(pr.py, pr.y, alpha);
    const col = this.tint(pr.color);
    switch (pr.kind) {
      case 'straight': case 'bounce': case 'homing': {
        if (!perf) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, pr.r * 1.9, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, pr.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - pr.r * 0.25, y - pr.r * 0.25, pr.r * 0.4, 0, U.TAU); ctx.fill();
        break;
      }
      case 'boomerang': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pr.angle);
        ctx.fillStyle = col; ctx.fillRect(-pr.r, -3, pr.r * 2, 6); ctx.fillRect(-3, -pr.r, 6, pr.r * 2);
        ctx.restore(); break;
      }
      case 'ring': {
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case 'rain': {
        const gy = pr.y;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(pr.x, gy, pr.r * 0.7, pr.r * 0.25, 0, 0, U.TAU); ctx.fill();
        const fy = gy - pr.z;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pr.x, fy, pr.r * 0.6, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(pr.x, fy - 30); ctx.lineTo(pr.x, fy - 10); ctx.stroke();
        break;
      }
      case 'mine': {
        const k = 0.5 + Math.sin(performance.now() / 150) * 0.2;
        if (pr.mode === 'tick') { ctx.fillStyle = col; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.6 * k + 10, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
        else if (pr.mode === 'pull') { ctx.fillStyle = '#1a0a2e'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.4, 0, U.TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * (0.3 + 0.6 * (1 - pr.life / pr.maxLife)), 0, U.TAU); ctx.stroke(); }
        else { ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.life * 3); ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(-8, -8, 16, 16); ctx.restore(); ctx.globalAlpha = 1; }
        break;
      }
      case 'pool': {
        ctx.fillStyle = col; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.r, pr.r * 0.55, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
    }
  });
};
/* ═══════════ v2.1 — Main: دمج العدّادات + PWA بالوصف الرسمي + ملخص موسّع ═══════════ */
AS.V = '2.1.0';

// ─── دمج عدّادات الجولة في الإحصاءات الدائمة عند الانتهاء ───
(function () {
  const _endRun = Game.endRun.bind(Game);
  Game.endRun = function (win, abandoned) {
    const r = this.run;
    if (r) {
      const cnt = Combat.getCounters(r), M = Meta.stats;
      M.casts = (M.casts || 0) + (cnt.casts || 0);
      M.dashes = (M.dashes || 0) + (cnt.dashes || 0);
      M.dmgDealt = (M.dmgDealt || 0) + Math.floor(cnt.dmg || 0);
      M.healTotal = (M.healTotal || 0) + Math.floor(cnt.heal || 0);
      M.blocks = (M.blocks || 0) + (cnt.blocks || 0);
      M.lsTotal = (M.lsTotal || 0) + Math.floor(cnt.ls || 0);
      M.thornsDmg = (M.thornsDmg || 0) + Math.floor(cnt.thorns || 0);
      for (const k in (cnt.status || {})) M.statusKills[k] = (M.statusKills[k] || 0) + cnt.status[k];
      M.artRunBest = Math.max(M.artRunBest || 0, (r.artifacts || []).length);
      M.synRunBest = Math.max(M.synRunBest || 0, Object.keys(r.syn || {}).length);
      M.dashRunBest = Math.max(M.dashRunBest || 0, cnt.dashes || 0);
      const cursedN = (r.artifacts || []).filter(id => { const a = Data.artifact(id); return a && (a.cursed || a.hpPenalty); }).length;
      M.cursedRunBest = Math.max(M.cursedRunBest || 0, cursedN);
      M.classesPlayed[r.charId] = true;
      // سلسلة الانتصارات والأيام
      if (win) M.winStreak = (M.winStreak || 0) + 1; else M.winStreak = 0;
      M.streakBest = Math.max(M.streakBest || 0, M.winStreak);
      const dk = new Date().toISOString().slice(0, 10);
      M.days[dk] = 1;
      M.stageTime = M.stageTime || {};
      M.stageTime[r.stageId] = Math.max(M.stageTime[r.stageId] || 0, Math.floor(r.time));
      if (r.stageId === 'void' && r.time >= 900) M.void15 = 1;
      for (const cid in (Meta.talents || {})) for (const br in Meta.talents[cid]) if (Meta.talents[cid][br] >= 4) M.talentMaxed = 1;
      if (win) {
        M.classWins[r.charId] = (M.classWins[r.charId] || 0) + 1;
        const modsN = Object.keys(r.mods || {}).filter(k => r.mods[k]).length;
        if (modsN >= 3) M.modsWin3 = 1;
        if (modsN >= 5) M.modsWin5 = 1;
        if (r.stageId === 'sky') M.skyWin = 1;
        if (r.clutchFlag) M.clutchWin = 1;
        if ((r.weapons || []).length === 1 && r.level >= 15) M.minimalist = 1;
        if ((r.weapons || []).filter(w => w.evolved).length >= 2) M.dualEvo = 1;
      }
      // حفظ عدّادات الملخص قبل إعادة الضبط
      this._runCounters = { casts: cnt.casts || 0, dashes: cnt.dashes || 0, minis: cnt.minis || 0, frags: cnt.frags || 0 };
      Save.mark();
    }
    _endRun(win, abandoned);
    if (this._lastSummary && this._runCounters) Object.assign(this._lastSummary, this._runCounters);
  };

  // إنجاز «بلا خدش» عند قتل الزعيم
  const _obk = Game.onBossKilled.bind(Game);
  Game.onBossKilled = function (boss) {
    const r = this.run;
    if (r && !r.perfectBroken) Meta.stats.perfectBoss = (Meta.stats.perfectBoss || 0) + 1;
    _obk(boss);
  };

  // عدّاد الإلقاءات
  const fw = Combat.fireWeapon.bind(Combat);
  Combat.fireWeapon = function (w) {
    const r = Game.run;
    if (r) Combat.getCounters(r).casts++;
    fw(w);
  };
})();

// ─── ملخص الجولة: خلايا إضافية (إلقاءات/اندفاعات/زعماء صغار/قطع) ───
(function () {
  const _ss = UI.showSummary.bind(UI);
  UI.showSummary = function (d) {
    _ss(d);
    const rc = Game._runCounters || {};
    const extra = [];
    if (rc.casts) extra.push([t('casts'), U.num(rc.casts)]);
    if (rc.dashes) extra.push([t('dashes'), U.num(rc.dashes)]);
    if (rc.minis) extra.push([t('minisKilled'), U.num(rc.minis)]);
    if (rc.frags) extra.push([t('fragsRun'), U.num(rc.frags)]);
    if (extra.length) {
      const box = document.getElementById('sum-stats');
      if (box) box.insertAdjacentHTML('beforeend', extra.map(c => '<div class="sum-cell"><div class="v">' + c[1] + '</div><div class="k">' + c[0] + '</div></div>').join(''));
    }
  };
})();

// ─── PWA: manifest بالوصف الرسمي ثنائي اللغة ───
Game.initPWA = function () {
  try {
    const icon = document.createElement('canvas'); icon.width = icon.height = 512;
    const g = icon.getContext('2d');
    g.fillStyle = '#0a0c14'; g.fillRect(0, 0, 512, 512);
    const rg = g.createRadialGradient(256, 240, 40, 256, 240, 240);
    rg.addColorStop(0, '#1d7f8f'); rg.addColorStop(1, 'rgba(10,12,20,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#7ee8fa'; g.lineWidth = 14;
    g.beginPath(); g.arc(256, 240, 150, 0, U.TAU); g.stroke();
    g.strokeStyle = '#b06cff'; g.lineWidth = 9;
    g.beginPath(); g.arc(256, 240, 108, 0.4, U.TAU - 0.4); g.stroke();
    g.fillStyle = '#f5c542';
    g.beginPath(); g.moveTo(256, 120); g.lineTo(296, 250); g.lineTo(216, 250); g.closePath(); g.fill();
    g.fillRect(238, 250, 36, 90);
    const manifest = {
      name: 'Arcane Survivor 2.0', short_name: 'ArcaneS2',
      description: 'A fast-paced roguelite blending arcane magic and endless evolution. Collect weapons, unlock synergies, and crush the dark hordes before they crush you.',
      start_url: location.href.split('#')[0], scope: './',
      display: 'standalone', orientation: 'any', background_color: '#0a0c14', theme_color: '#0a0c14',
      icons: [{ src: icon.toDataURL('image/png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
    };
    document.getElementById('manifest-link').href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
  } catch (e) { Log.warn('manifest failed', e.message); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      const swCode = "self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.open('as2-v2').then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n&&n.ok)c.put(e.request,n.clone());return n;})).catch(()=>fetch(e.request))))});";
      const url = URL.createObjectURL(new Blob([swCode], { type: 'text/javascript' }));
      navigator.serviceWorker.register(url).catch(() => { });
    } catch (e) { }
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); this._installEvt = e;
    document.getElementById('btn-install').classList.remove('hidden');
  });
};

// ─── تصدير الحفظ: عدّاد الإنجاز السري ───
(function () {
  const exp = Save.exportSave.bind(Save);
  Save.exportSave = function () { try { Meta.stats.exportUsed = 1; Save.mark(); } catch (e) { } return exp(); };
})();

// ─── فحص نهائي عند الإقلاع ───
(function () {
  const boot = Game.boot.bind(Game);
  Game.boot = async function () {
    Log.log('Arcane Survivor v' + AS.V + ' — expansion loaded');
    Log.log('Content: chars ' + Data.CHARACTERS.length + ' | weapons ' + Data.WEAPONS.length +
      ' | evolutions ' + Object.keys(Data.EVOLVED).length + ' | enemies ' + Object.keys(Data.ENEMIES).length +
      ' | minis ' + Data.MINIBOSSES.length + ' | bosses ' + Object.keys(Data.BOSSES).length +
      ' | artifacts ' + Data.ARTIFACTS.length + ' | synergies ' + Data.SYNERGIES.length +
      ' | achievements ' + Data.ACHIEVEMENTS.length + ' | challenges ' + Data.CHALLENGE_TYPES.length +
      ' | stages ' + Data.STAGES.length + ' | familiars ' + (Data.COMPANIONS.length - 1) +
      ' | fragments ' + Data.FRAGMENTS.length + ' | skins ' + Data.SKINS.length);
    return boot();
  };
})();
/* ═══════════ v2.2 — I18N: مفاتيح خزانة السكنات المخصصة (تكافؤ عربي/إنجليزي مضمون) ═══════════ */
(function () {
  // نمط p21: قائمة واحدة [مفتاح، عربي، إنجليزي] تُدمج في القاموسين معًا ← صفر نواقص
  const STR = [
    // التبويبات وشريط الأدوات
    ['wdTabPlayer', 'الشخصيات', 'Characters'], ['wdTabWeapons', 'الأسلحة', 'Weapons'],
    ['wdTabEnemies', 'الأعداء', 'Enemies'], ['wdTabFamiliars', 'المرافقون', 'Familiars'],
    ['wdTabEffects', 'التأثيرات', 'Effects'],
    ['wdAdd', '+ سكن جديد', '+ New Skin'], ['wdClean', 'حذف غير المستخدمة', 'Delete Unused'],
    ['wdReset', 'إعادة تعيين الكل', 'Reset All'], ['wdEdit', 'تعديل', 'Edit'],
    ['wdDup', 'تكرار', 'Duplicate'], ['wdDel', 'حذف', 'Delete'], ['wdApply', 'ارتدِ', 'Apply'],
    // عداد التخزين
    ['wdStore', 'تخزين', 'Storage'], ['wdStoreTxt', '{k} مستخدمة · {n} صورة', '{k} used · {n} images'],
    ['wdStoreWarn', 'اقتربت من حد التخزين! احذف السكنات غير المستخدمة', 'Storage almost full! Delete unused skins'],
    ['cleanedToast', 'حُذف {n} سكن غير مستخدم', 'Deleted {n} unused skins'],
    ['nothingToClean', 'لا توجد سكنات غير مستخدمة', 'No unused skins to delete'],
    ['wdResetDone', 'أُعيد ضبط الخزانة بالكامل', 'Wardrobe fully reset'],
    // نافذة السكن
    ['wdEditTitle', 'تعديل السكن', 'Edit Skin'],
    ['wdName', 'الاسم', 'Name'], ['wdKind', 'المصدر', 'Source'],
    ['wdEmoji', 'إيموجي', 'Emoji'], ['wdImage', 'صورة', 'Image'],
    ['wdDrop', 'اسحب صورة هنا أو انقر للاختيار', 'Drop an image here or click to browse'],
    ['wdCompressing', 'جارٍ ضغط الصورة…', 'Compressing image…'],
    ['wdCat', 'الفئة', 'Category'], ['wdTarget', 'الهدف', 'Target'],
    ['wdUnlock', 'شرط الفتح', 'Unlock Condition'],
    ['wdUnNone', 'مفتوح دائمًا', 'Always unlocked'], ['wdUnLevel', 'بالمستوى', 'By level'],
    ['wdUnGold', 'بالذهب', 'By gold'], ['wdUnAch', 'بالإنجاز', 'By achievement'],
    ['wdUnStreak', 'بسلسلة انتصارات', 'By win streak'], ['wdUnRuns', 'بعدد الجولات', 'By runs played'],
    ['wdUnSecret', 'سرّي (؟؟؟)', 'Secret (???)'],
    ['wdSave', 'حفظ', 'Save'], ['wdReplaceImg', 'استبدال الصورة', 'Replace Image'],
    ['wdSecretHint', 'صيغة الشرط السري: statKey:N مثل kills:1000 أو ach:bosses_50', 'Secret format: statKey:N like kills:1000 or ach:bosses_50'],
    // أخطاء وتنبيهات
    ['imgTooBig', 'الصورة كبيرة جدًا، جرّب صورة أصغر', 'Image is too large, try a smaller one'],
    ['imgBad', 'تعذّر قراءة الصورة', 'Could not read the image'],
    ['wdNameReq', 'أدخل اسمًا للسكن', 'Enter a skin name'],
    ['wdNeedData', 'أضف إيموجي أو صورة أولًا', 'Add an emoji or image first'],
    ['wdNeedTarget', 'اختر هدفًا صالحًا', 'Pick a valid target'],
    ['skinSaved', 'حُفظ السكن', 'Skin saved'],
    ['skinDeleted', 'حُذف السكن', 'Skin deleted'],
    ['appliedToast', 'وُرّد السكن!', 'Skin applied!'],
    ['clearedSkin', 'أُزيل السكن المُرتدى', 'Skin removed'],
    // حالات البطاقة
    ['wdActive', 'نشط', 'Active'], ['wdUnlocked', 'مفتوح', 'Unlocked'],
    ['wdLocked', 'مقفل', 'Locked'], ['wdBuiltin', 'أساسي', 'Built-in'], ['wdCustom', 'مخصص', 'Custom'],
    ['skinUnlockedToast', 'سكن جديد مفتوح: {n}!', 'New skin unlocked: {n}!'],
    ['confirmDelSkin', 'سيُحذف هذا السكن نهائيًا. لا يمكن التراجع. متابعة؟', 'This skin will be permanently deleted. This cannot be undone. Continue?'],
    ['confirmClean', 'سيُحذف {n} سكن غير مُرتدى نهائيًا. متابعة؟', '{n} unequipped skins will be permanently deleted. Continue?'],
    ['confirmResetSkins', 'ستُحذف كل السكنات المخصصة وحالات الفتح نهائيًا. متابعة؟', 'All custom skins and unlock states will be permanently deleted. Continue?'],
    ['confirmBuySkin', 'شراء هذا السكن بـ{n} ذهب؟', 'Buy this skin for {n} gold?'],
    // نصوص شروط الفتح
    ['wdUnlockLevel', 'يُفتح عند المستوى {n}', 'Unlocks at level {n}'],
    ['wdUnlockGold', 'اشترِ بـ{n} ذهب', 'Buy for {n} gold'],
    ['wdUnlockAch', 'بالإنجاز: {n}', 'Requires achievement: {n}'],
    ['wdUnlockStreak', '{n} انتصارات متتالية', '{n} wins in a row'],
    ['wdUnlockRuns', 'العب {n} جولات', 'Play {n} runs'],
    ['wdUnlockSecret', '؟؟؟', '???'],
    // حالات فارغة وأقسام
    ['wdNoCustom', 'لا سكنات مخصصة بعد — اضغط «+ سكن جديد»', 'No custom skins yet — tap "+ New Skin"'],
    ['wdSecSkins', 'أزياء الشخصيات', 'Character Skins'], ['wdSecTrails', 'آثار الأقدام', 'Footprint Trails'],
    ['wdSecColors', 'ألوان السحر', 'Spell Colors'], ['wdSecCustom', 'سكناتك المخصصة', 'Your Custom Skins'],
    ['wdHintSlot', 'اضغط لإضافة سكن', 'Tap to add a skin'],
    ['wdTrailTarget', 'أثر الأقدام', 'Footprint Trail'], ['wdColorTarget', 'لون السحر', 'Spell Color'],
    ['wdDefaultSkin', 'الافتراضي', 'Default'], ['wdAchNone', 'لا إنجازات بعد', 'No achievements yet']
  ];
  const ar = {}, en = {};
  for (const s of STR) { ar[s[0]] = s[1]; en[s[0]] = s[2]; }
  Object.assign(I18N.dict.ar, ar);
  Object.assign(I18N.dict.en, en);
  // فحص التكافؤ: لوحة التصحيح تعرض أي فرق إن وجد
  try { if (typeof I18N.check === 'function') I18N.check(); } catch (e) { }
})();

// ─── حقن المعرّفات في تعريفات الأعداء والزعماء (تعريفاتها مفاتيح بلا حقل id داخلي)
// يلزم لاستهداف سكنات الأعداء عبر e.def.id دون تعديل منظومت التوليد ───
(function () {
  try {
    for (const k in Data.ENEMIES) { const d = Data.ENEMIES[k]; if (d && !d.id) d.id = k; }
    for (const k in Data.BOSSES) { const d = Data.BOSSES[k]; if (d && !d.id) d.id = k; }
    Data.MINIBOSSES.forEach(m => { if (m && !m.id && m.ar) m.id = m.ar; });
  } catch (e) { Log.warn('enemy id injection', e.message); }
})();
/* ═══════════ v2.2 — Skins/ — نظام السكنات المخصصة: تخزين هجين ذكي ═══════════
   localStorage  : تعريفات السكنات (الإيموجي) + حالة الفتح + الارتداء (صغير الحجم)
   IndexedDB     : صور السكنات المضغوطة في مخزن skin_images (يدعم عشرات MB)
   loadSkin()    : موحّدة — تحاول الذاكرة ثم localStorage ثم IndexedDB                */
const Skins = AS.Skins = {
  DEF_KEY: 'arc_skins', UNLOCK_KEY: 'arc_skins_unlocked', STATE_KEY: 'arc_skins_state',
  IMG_STORE: 'skin_images', LS_LIMIT: 5 * 1024 * 1024, LS_WARN: 4 * 1024 * 1024,
  defs: {},            // id → تعريف السكن المخصص
  unlocked: {},        // id → timestamp الفتح (مفتاح arc_skins_unlocked المطلوب)
  state: { active: {}, totalSpent: 0 },
  imgCache: new Map(), // id → {url, cv, ready} صور فكّ التشفير
  spriteCache: new Map(), // id → كانفس سبرايت 128px للرسم على الواقع
  _any: { enemy: false }, // رايات سريعة تُحدّث عند التغيير (بدل فحص المفاتيح كل إطار)
  _warned: false,

  /* ─── القراءة والكتابة الآمنة ─── */
  lsJSON(key, fb) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; } catch (e) { return fb; } },
  saveDefs() { try { localStorage.setItem(this.DEF_KEY, JSON.stringify(this.defs)); return true; } catch (e) { this.warnFull(); return false; } },
  saveUnlocked() { try { localStorage.setItem(this.UNLOCK_KEY, JSON.stringify(this.unlocked)); } catch (e) { } },
  saveState() { try { localStorage.setItem(this.STATE_KEY, JSON.stringify(this.state)); } catch (e) { } },
  warnFull() {
    if (AS.UI && !this._warned) { this._warned = true; try { UI.toast(t('wdStoreWarn'), 'bad'); } catch (e) { } setTimeout(() => { this._warned = false; }, 8000); }
    Log.warn('Skins storage full');
  },

  /* ─── التحميل عند الإقلاع ─── */
  loadAll() {
    this.defs = this.lsJSON(this.DEF_KEY, {}) || {};
    this.unlocked = this.lsJSON(this.UNLOCK_KEY, {}) || {};
    const st = this.lsJSON(this.STATE_KEY, null);
    this.state = (st && typeof st === 'object' && st.active) ? st : { active: {}, totalSpent: 0 };
    // تنظيف الإشارات المعلّقة (سكن محذوف ظل مرتدى)
    for (const k in this.state.active) { const id = this.state.active[k]; if (id && !this.defs[id]) delete this.state.active[k]; }
    this.preloadImages();
    this.recountAny();
    Log.log('Skins: ' + Object.keys(this.defs).length + ' custom, ' + Object.keys(this.unlocked).length + ' unlocked');
  },
  recountAny() { try { this._any.enemy = Object.keys(this.state.active).some(k => String(k).indexOf('enemy:') === 0); } catch (e) { } },

  /* ─── loadSkin الموحّدة: الذاكرة ← localStorage ← IndexedDB ─── */
  loadSkin(id) {
    const def = this.defs[id];
    if (!def) return Promise.resolve(null);
    if (def.type === 'emoji' || (def.data && def.data.length)) return Promise.resolve(def.data);
    const c = this.imgCache.get(id);
    if (c && c.url) return Promise.resolve(c.url);
    return Save.storeGet(this.IMG_STORE, id).then(url => {
      if (url) { this.imgCache.set(id, { url, cv: null, ready: false }); this.buildMaster(def, url); }
      return url || null;
    });
  },
  // تحميل كل الصور دفعة واحدة عند الإقلاع ليكون العرض فوريًا في الواجهة
  preloadImages() {
    for (const id in this.defs) { const d = this.defs[id]; if (d.type === 'image' && !this.imgCache.has(id)) this.loadSkin(id); }
  },
  // بناء سبرايت 128px من رابط بيانات
  buildMaster(def, url) {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
        const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
        const k = Math.min(128 / img.width, 128 / img.height, 1), w = img.width * k, h = img.height * k;
        g.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        this.imgCache.set(def.id, { url, cv, ready: true });
        this.spriteCache.delete(def.id);
        Bus.emit('skinsLoaded');
      } catch (e) { Log.warn('skin master', e.message); }
    };
    img.onerror = () => Log.warn('skin image failed', def.id);
    img.src = url;
  },

  /* ─── ضغط الصور تلقائيًا: 128px كحد أقصى + WEBP 0.85 (بديل PNG) ─── */
  compressImage(file) {
    return new Promise((resolve) => {
      if (!file || !/^image\//.test(file.type || '')) return resolve({ err: 'imgBad' });
      if (file.size > 15 * 1024 * 1024) return resolve({ err: 'imgTooBig' });
      const finish = (bmp, revoke) => {
        try {
          const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
          if (!w || !h) { if (revoke) URL.revokeObjectURL(revoke); return resolve({ err: 'imgBad' }); }
          const k = Math.min(1, 128 / Math.max(w, h));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
          const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.drawImage(bmp, 0, 0, cv.width, cv.height);
          let out = '';
          try { out = cv.toDataURL('image/webp', 0.85); } catch (e) { }
          // بعض المتصفحات تتجاهل webp وتُرجع png — تحقق من الترويسة
          if (!out || !out.startsWith('data:image/webp')) { try { out = cv.toDataURL('image/png'); } catch (e2) { } }
          if (revoke) URL.revokeObjectURL(revoke);
          if (!out) return resolve({ err: 'imgBad' });
          // سقف صارم: dataURL حتى ~700KB مضمون في كل المحركات
          if (out.length > 700000) return resolve({ err: 'imgTooBig' });
          resolve({ url: out, bytes: Math.floor(out.length * 0.75) });
        } catch (e) { resolve({ err: 'imgBad' }); }
      };
      if (window.createImageBitmap) {
        createImageBitmap(file).then(bmp => finish(bmp, null)).catch(() => {
          const u = URL.createObjectURL(file), im = new Image();
          im.onload = () => finish(im, u); im.onerror = () => { URL.revokeObjectURL(u); resolve({ err: 'imgBad' }); };
          im.src = u;
        });
      } else {
        const u = URL.createObjectURL(file), im = new Image();
        im.onload = () => finish(im, u); im.onerror = () => { URL.revokeObjectURL(u); resolve({ err: 'imgBad' }); };
        im.src = u;
      }
    });
  },

  /* ─── CRUD ─── */
  uid() { return 'cst_' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); },
  add(def) {
    const id = this.uid();
    const d = Object.assign({ id, name: 'Skin', type: 'emoji', data: '✨', category: 'player', target: 'arcane', unlock: { type: 'none', value: null }, isDefault: false, createdAt: Date.now() }, def, { id, isDefault: false });
    const img = d._img; delete d._img; // بيانات الصورة الخام لا تُخزّن في التعريف
    this.defs[id] = d;
    if (d.unlock && d.unlock.type === 'none') this.unlocked[id] = Date.now();
    if (d.type === 'image' && img) {
      // الصورة: IndexedDB أولًا؛ وإن لم يتوفر تُحفظ dataURL صغيرة في التعريف نفسه
      Save.storePut(this.IMG_STORE, id, img).then(ok => {
        this.imgCache.set(id, { url: img, cv: null, ready: false });
        this.buildMaster(d, img);
        if (!ok) { d.data = img; this.saveDefs(); } // احتياطي localStorage للصور الصغيرة
      });
    }
    this.saveDefs(); this.saveUnlocked();
    return d;
  },
  update(id, patch) {
    const d = this.defs[id]; if (!d) return null;
    Object.assign(d, patch, { id });
    if (d.type === 'image' && d._img) {
      const url = d._img; delete d._img;
      Save.storePut(this.IMG_STORE, id, url).then(ok => { if (!ok) d.data = url; this.saveDefs(); });
      this.imgCache.set(id, { url, cv: null, ready: false });
      this.buildMaster(d, url);
    }
    this.saveDefs(); return d;
  },
  remove(id) {
    const d = this.defs[id]; if (!d || d.isDefault) return false;
    delete this.defs[id]; delete this.unlocked[id];
    for (const k in this.state.active) if (this.state.active[k] === id) delete this.state.active[k];
    this.imgCache.delete(id); this.spriteCache.delete(id);
    Save.storeDel(this.IMG_STORE, id);
    this.saveDefs(); this.saveUnlocked(); this.saveState(); this.recountAny();
    return true;
  },
  duplicate(id) {
    const d = this.defs[id]; if (!d) return null;
    const copy = JSON.parse(JSON.stringify(d));
    copy.name = d.name + ' *'; copy.createdAt = Date.now();
    copy.unlock = { type: 'none', value: null }; // النسخة مفتوحة فورًا
    const nd = this.add(copy);
    if (nd.type === 'image') this.loadSkin(id).then(url => { if (url) Save.storePut(this.IMG_STORE, nd.id, url); });
    return nd;
  },
  resetAll() {
    this.defs = {}; this.unlocked = {}; this.state = { active: {}, totalSpent: 0 };
    this.imgCache.clear(); this.spriteCache.clear();
    try { localStorage.removeItem(this.DEF_KEY); localStorage.removeItem(this.UNLOCK_KEY); localStorage.removeItem(this.STATE_KEY); } catch (e) { }
    Save.storeClear(this.IMG_STORE);
    this.recountAny();
  },

  /* ─── الأهداف المتاحة لكل فئة ─── */
  targetsFor(cat) {
    const ar = I18N.lang() === 'ar';
    const lbl = (o) => ({ id: o.id, label: ar ? o.ar : o.en });
    try {
      switch (cat) {
        case 'player': return Data.CHARACTERS.map(lbl);
        case 'weapon': return Data.WEAPONS.map(lbl);
        case 'enemy': {
          const out = [];
          for (const id in Data.ENEMIES) out.push(lbl(Object.assign({ id }, Data.ENEMIES[id])));
          Data.MINIBOSSES.forEach(m => out.push(lbl(m)));
          for (const id in Data.BOSSES) out.push(lbl(Object.assign({ id }, Data.BOSSES[id])));
          return out;
        }
        case 'familiar': return Data.COMPANIONS.filter(c => c.kind !== 'none').map(lbl);
        case 'effect': return [{ id: 'trail', label: t('wdTrailTarget') }, { id: 'color', label: t('wdColorTarget') }];
      }
    } catch (e) { }
    return [];
  },
  targetKey(cat, target) { return cat === 'effect' ? String(target) : cat + ':' + target; },
  targetName(cat, target) {
    const ar = I18N.lang() === 'ar';
    try {
      if (cat === 'effect') return target === 'trail' ? t('wdTrailTarget') : t('wdColorTarget');
      if (cat === 'player') { const c = Data.char(target); return c ? (ar ? c.ar : c.en) : target; }
      if (cat === 'weapon') { const w = Data.weapon(target); return w ? (ar ? w.ar : w.en) : target; }
      if (cat === 'familiar') { const c = Data.comp(target); return c ? (ar ? c.ar : c.en) : target; }
      if (cat === 'enemy') { const e = Data.enemy(target) || Data.boss(target) || Data.MINIBOSSES.find(m => m.id === target); return e ? (ar ? e.ar : e.en) : target; }
    } catch (e) { }
    return String(target);
  },

  /* ─── الارتداء ─── */
  activeFor(key) { const id = this.state.active[key]; return (id && this.defs[id]) ? this.defs[id] : null; },
  isActive(id) { for (const k in this.state.active) if (this.state.active[k] === id) return true; return false; },
  setActive(cat, target, id) {
    const key = this.targetKey(cat, target);
    if (id == null) delete this.state.active[key];
    else this.state.active[key] = id;
    // إزاحة التداخل مع الكوزمتك المدمجة (أثر/لون) — أحدهما فقط يفعل
    if (key === 'trail' && id) { Meta.cosmetics.equipped.trail = 'tr_none'; Save.mark(); }
    if (key === 'color' && id) { Meta.cosmetics.equipped.color = 'cl_default'; Save.mark(); }
    this.saveState(); this.recountAny();
  },
  clearActive(id) { for (const k in this.state.active) if (this.state.active[k] === id) { delete this.state.active[k]; this.saveState(); } this.recountAny(); },

  /* ─── الفتح بالتقدم ─── */
  isUnlocked(id) {
    const d = this.defs[id]; if (!d) return true;
    if (!d.unlock || d.unlock.type === 'none') return true;
    return !!this.unlocked[id];
  },
  conditionText(d) {
    const u = d.unlock || { type: 'none' };
    switch (u.type) {
      case 'none': return t('wdUnNone');
      case 'level': return tf('wdUnlockLevel', u.value || 1);
      case 'gold': return tf('wdUnlockGold', u.value || 0);
      case 'streak': return tf('wdUnlockStreak', u.value || 1);
      case 'runs': return tf('wdUnlockRuns', u.value || 1);
      case 'achievement': {
        const a = Data.ACHIEVEMENTS.find(x => x.id === u.value);
        return tf('wdUnlockAch', a ? (I18N.lang() === 'ar' ? a.dar || a.ar : a.den || a.en) : u.value);
      }
      case 'secret': return t('wdUnlockSecret');
    }
    return '';
  },
  evalSecret(v) {
    if (!v) return false;
    if (String(v).startsWith('ach:')) return !!Meta.achievements[v.slice(4)];
    const i = String(v).lastIndexOf(':');
    if (i < 1) return false;
    const k = String(v).slice(0, i), n = Number(String(v).slice(i + 1));
    return ((Meta.stats || {})[k] || 0) >= n;
  },
  evalCond(d) {
    const u = d.unlock || {}, v = u.value;
    switch (u.type) {
      case 'level': return (Meta.stats.maxLevel || 0) >= (v || 1);
      case 'streak': return (Meta.stats.streakBest || 0) >= (v || 1);
      case 'runs': return (Meta.stats.runs || 0) >= (v || 1);
      case 'achievement': return !!Meta.achievements[v];
      case 'secret': return this.evalSecret(v);
      case 'gold': return false; // تُشترى يدويًا
    }
    return false;
  },
  unlockNow(id, celebrate) {
    if (this.unlocked[id]) return;
    this.unlocked[id] = Date.now(); this.saveUnlocked();
    const d = this.defs[id];
    if (d && celebrate) {
      this.celebrate(d);
      try { UI.toast('🎉 ' + t('skinUnlockedToast').replace('{n}', d.name), 'gold'); UI.haptic(60); } catch (e) { }
      try { Ach.check(); } catch (e) { }
    }
  },
  buyCustom(d) {
    const cost = (d.unlock && d.unlock.value) || 0;
    if (Meta.gold < cost) { try { UI.toast(t('notEnoughGold'), 'bad'); Audio.sfx('banish'); } catch (e) { } return false; }
    Meta.gold -= cost;
    Meta.stats.goldSpent = (Meta.stats.goldSpent || 0) + cost;
    this.state.totalSpent = (this.state.totalSpent || 0) + cost;
    Save.mark(); this.saveState();
    this.unlockNow(d.id, true);
    return true;
  },
  // يُستدعى بعد الارتقاء/الإنجاز/الجولات/فتح الخزانة
  checkUnlocks() {
    let changed = false;
    for (const id in this.defs) {
      const d = this.defs[id];
      if (this.unlocked[id] || !d.unlock) continue;
      const ty = d.unlock.type;
      if (ty === 'none' || ty === 'gold') continue;
      if (this.evalCond(d)) { this.unlockNow(id, true); changed = true; }
    }
    return changed;
  },

  /* ─── إدارة الحصة ─── */
  quota() {
    let ls = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) { }
    let imgs = 0, imgBytes = 0;
    for (const id in this.defs) { const d = this.defs[id]; if (d.type === 'image') { imgs++; imgBytes += d.bytes || ((d.data || '').length * 0.75); } }
    return { ls, imgs, imgBytes, pct: Math.min(1, ls / this.LS_LIMIT), warn: ls > this.LS_WARN, kb: Math.round(ls / 1024) };
  },
  unusedIds() {
    const used = new Set(Object.values(this.state.active));
    const out = [];
    for (const id in this.defs) if (!used.has(id)) out.push(id);
    return out;
  },
  cleanCount() { return this.unusedIds().length; },
  cleanUnused() {
    const ids = this.unusedIds();
    ids.forEach(id => this.remove(id));
    return ids.length;
  },

  /* ─── سبرايت الرسم: إيموجي/صورة → كانفس 128 مرة واحد ─── */
  _kicked: null,
  master(def) {
    if (!def) return null;
    const hit = this.spriteCache.get(def.id);
    if (hit) return hit;
    if (def.type === 'emoji' && def.data) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      const g = cv.getContext('2d');
      g.font = "96px 'Segoe UI Emoji','Noto Color Emoji',sans-serif";
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(def.data, 64, 70);
      this.spriteCache.set(def.id, cv);
      return cv;
    }
    const c = this.imgCache.get(def.id);
    if (c && c.ready && c.cv) { this.spriteCache.set(def.id, c.cv); return c.cv; }
    // حمل كسول: الصورة لم تصل بعد من IndexedDB (إقلاع متسارع) — اطلبها مرة واحدة
    if (!this._kicked) this._kicked = new Set();
    if (!this._kicked.has(def.id)) { this._kicked.add(def.id); this.loadSkin(def.id); }
    return null;
  },
  // HTML للمعاينة في البطاقات (مزامنيًا مع احتياطي، ويُحدّث عند جاهزية الصور)
  previewHTML(def, px) {
    if (!def) return '';
    const s = px || 64;
    if (def.type === 'emoji') return '<span style="font-size:' + Math.round(s * 0.62) + 'px;line-height:1">' + U.esc(def.data) + '</span>';
    const c = this.imgCache.get(def.id);
    if (c && c.url) return '<img src="' + c.url + '" alt="" style="width:100%;height:100%;object-fit:contain">';
    return '<span style="opacity:.4;font-size:' + Math.round(s * 0.4) + 'px">🖼</span>';
  },
  // معاينة حية أثناء التحرير (قبل الحفظ)
  livePreview(data, type, url) {
    if (type === 'emoji') return '<span style="font-size:inherit;line-height:1">' + U.esc(data || '') + '</span>';
    if (url) return '<img src="' + url + '" style="width:100%;height:100%;object-fit:contain" alt="">';
    return '<span style="opacity:.4">🖼</span>';
  }
};
AS.Skins = Skins;
Skins.loadAll();
// ─── تحصين: الصور تُحمّل من IndexedDB بعد جهوزية اتصال قاعدة البيانات في الإقلاع ───
(function () {
  const sl = Save.load.bind(Save);
  Save.load = async function () {
    const m = await sl();
    try { Skins.preloadImages(); } catch (e) { }
    return m;
  };
})();
/* ═══════════ v2.2 — تطبيق السكنات المخصصة على محرك الرسم + محرك الفتح ═══════════ */

// ─── الاحتفال بفتح سكن: طبقة منبثقة + نغمة + اهتزاز ───
Skins.celebrate = function (d) {
  if (!d) return;
  const el = document.getElementById('wd-celebrate');
  if (!el) return;
  const prev = el.querySelector('#wdc-prev'), name = el.querySelector('#wdc-name');
  if (prev) {
    prev.innerHTML = Skins.previewHTML(d, 96);
    if (d.type === 'image') prev.style.background = 'rgba(245,197,66,.12)'; else prev.style.background = '';
  }
  if (name) name.textContent = d.name;
  el.classList.remove('hidden');
  try { Audio.sfx('unlock'); } catch (e) { }
  clearTimeout(this._celT);
  this._celT = setTimeout(() => el.classList.add('hidden'), 2600);
};

// ─── اللاعب: سكن مخصص (إيموجي/صورة) بدل الجسم المتجهي ───
(function () {
  Render._vecPlayer = Render.drawPlayer;
  Render.drawPlayer = function (alpha, ctx) {
    const r = Game.run;
    if (!r || !r.player) return;
    this.emitTrail(); // أثر الأقدام المخصص (يعمل مع المسارين)
    const d = Skins.activeFor('player:' + r.charId);
    if (!d || !Skins.isUnlocked(d.id)) return Render._vecPlayer.call(this, alpha, ctx);
    const cv = Skins.master(d);
    if (!cv) return Render._vecPlayer.call(this, alpha, ctx);
    const p = r.player, ch = Data.char(r.charId);
    const x = U.lerp(p.px, p.x, alpha), y = U.lerp(p.py, p.y, alpha);
    // أثر الاندفاع المحفوظ
    for (const g of p.trail) {
      ctx.globalAlpha = Math.max(0, g.t) * 1.8; ctx.fillStyle = ch.color;
      ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 13, 12, 4.5, 0, 0, U.TAU); ctx.fill();
    if (p.iframe > 0 && Math.floor(p.iframe * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    const bob = Math.sin(p.animT * 10) * 1.8, s = 36;
    ctx.drawImage(cv, x - s / 2, y - s / 2 + bob, s, s);
    ctx.globalAlpha = 1;
    if (p.dashT > 0) { ctx.strokeStyle = 'rgba(126,232,250,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, 0, U.TAU); ctx.stroke(); }
    if (p.blessT > 0) { ctx.strokeStyle = 'rgba(255,243,176,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(performance.now() / 200) * 2, 0, U.TAU); ctx.stroke(); }
    if (p.curseT > 0) { ctx.strokeStyle = 'rgba(166,122,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 21, 0, U.TAU); ctx.stroke(); }
  };
})();

// ─── أثر الأقدام المخصص: جسيمات إيموجي خلف اللاعب أثناء الحركة ───
(function () {
  const last = { x: 0, y: 0, init: false };
  Skins.trailParts = [];
  Render.emitTrail = function () {
    const r = Game.run;
    if (!r || !r.player) { return; }
    const d = Skins.activeFor('trail');
    const list = Skins.trailParts;
    // إdecay الجسيمات كل إطار
    for (let i = list.length - 1; i >= 0; i--) { list[i].t -= 0.028; if (list[i].t <= 0) list.splice(i, 1); }
    if (!d || !Skins.isUnlocked(d.id)) return;
    const cv = Skins.master(d); if (!cv) return;
    const p = r.player;
    if (!last.init) { last.x = p.x; last.y = p.y; last.init = true; }
    const moved = U.dist(last.x, last.y, p.x, p.y);
    if (moved > 9 && list.length < 40 && Math.random() < 0.5) {
      last.x = p.x; last.y = p.y;
      list.push({ x: p.x - p.face.x * 8, y: p.y + 8, t: 1, cv });
    }
  };
  Render.drawTrailParts = function (ctx) {
    const list = Skins.trailParts;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      ctx.globalAlpha = g.t * 0.75;
      const s = 10 + g.t * 10;
      ctx.drawImage(g.cv, g.x - s / 2, g.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };
  // رسمها مع طبقة الجواهر (قبل الأعداء) لتظهر تحت الكيانات
  const dr = Render.drawOrbs.bind(Render);
  Render.drawOrbs = function (alpha) {
    if (Skins.trailParts.length && Game.run) { this.drawTrailParts(this.ctx); }
    return dr(alpha);
  };
})();

// ─── الأعداء: سكن مخصص لكل نوع (مع الحلقات والحالات كما هي) ───
(function () {
  Render._vecEnemy = Render.drawEnemies;
  Render.drawEnemies = function (alpha, ctx) {
    // مسار سريع: لا سكنات أعداء مُرتداة ← الرسم الأصلي مباشرة (بدون تخصيص ذاكرة كل إطار)
    if (!Skins._any.enemy) {
      return Render._vecEnemy.call(this, alpha, ctx);
    }
    const P = Core.pools.enemies, hidden = [];
    P.items.forEach(e => {
      if (e.active && Skins.activeFor('enemy:' + e.def.id)) { e.active = false; hidden.push(e); }
    });
    try { Render._vecEnemy.call(this, alpha, ctx); }
    finally { hidden.forEach(e => { e.active = true; }); }
    const r = Game.run;
    for (const e of hidden) this.drawSkinEnemy(e, alpha, ctx, r);
  };
  // رسم عدو بسكن مخصص: ظل + حلقات نخبة/صغير + سبرايت + كل تراكبات الحالات
  Render.drawSkinEnemy = function (e, alpha, ctx, r) {
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha);
    const w2 = this.w / 2 + 70, h2 = this.h / 2 + 70;
    const dx = x - this.cam.x, dy = y - this.cam.y;
    if (dx < -w2 || dx > w2 || dy < -h2 || dy > h2) return;
    const d = Skins.activeFor('enemy:' + e.def.id);
    const cv = d && Skins.master(d);
    if (!cv) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.9, e.r * 0.9, e.r * 0.32, 0, 0, U.TAU); ctx.fill();
    const wob = 1 + Math.sin(e.animT * 9) * 0.07;
    ctx.save(); ctx.translate(x, y); ctx.scale(2 - wob, wob);
    if (e.ghosting) ctx.globalAlpha = 0.45;
    if (e.elite) { ctx.strokeStyle = e.elite.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(0, 0, e.r + 5 + Math.sin(e.animT * 6) * 2, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = e.ghosting ? 0.45 : 1; }
    if (e.mini) { ctx.strokeStyle = '#b06cff'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, 0, e.r + 7 + Math.sin(e.animT * 5) * 2, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const s = e.r * 2.6;
    ctx.drawImage(cv, -s / 2, -s / 2, s, s);
    ctx.restore(); ctx.globalAlpha = 1;
    // تحذير مسبق
    if (e.state === 'windup' || e.state === 'diveTele') {
      ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(r.player.x, r.player.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,220,80,0.95)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - e.r - 10);
    }
    if ((e.elite || e.mini || e.def.behavior === 'brute') && e.hp < e.maxHp) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw, 4);
      ctx.fillStyle = e.mini ? '#b06cff' : '#ff5964'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw * (e.hp / e.maxHp), 4);
    }
    if (e.flash > 0) { ctx.globalAlpha = e.flash * 0.65; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.freezeT > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(x, y, e.r + 2, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.shockT > 0 && Math.random() < 0.3) { ctx.strokeStyle = '#ffe95c'; ctx.beginPath(); ctx.moveTo(x - e.r, y - e.r); ctx.lineTo(x + e.r * 0.4, y - e.r * 0.3); ctx.stroke(); }
    if (e.vulnT > 0) { ctx.strokeStyle = '#ff9a5c'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, e.r + 3.5, 0.2, 1.35); ctx.arc(x, y, e.r + 3.5, 3.35, 4.5); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.charmT > 0) { ctx.strokeStyle = '#ff8ad8'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, e.r + 5, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.weakenT > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
  };
})();

// ─── المرافقون: سكن مخصص بدل الرسم المتجهي ───
(function () {
  Render._vecComp = Render.drawCompanion;
  Render.drawCompanion = function (alpha) {
    const r = Game.run;
    if (!r) return;
    const d = Skins.activeFor('familiar:' + r.companion);
    const cv = (d && Skins.isUnlocked(d.id)) ? Skins.master(d) : null;
    if (!cv) return Render._vecComp.call(this, alpha);
    const cs = r.compState, x = cs.x, y = cs.y, ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 9, 3, 0, 0, U.TAU); ctx.fill();
    const s = 24 + Math.sin(performance.now() / 300) * 1.5;
    ctx.drawImage(cv, x - s / 2, y - s / 2, s, s);
  };
})();

// ─── المقذوفات: سبرايت السلاح المخصص فوق الرسم الأصلي ───
(function () {
  Render._vecProj = Render.drawProjectiles;
  Render.drawProjectiles = function (alpha, ctx, perf) {
    Render._vecProj.call(this, alpha, ctx, perf);
    Core.pools.proj.forEach(pr => {
      const wid = pr.w && pr.w.def && pr.w.def.id;
      if (!wid) return;
      const d = Skins.activeFor('weapon:' + wid);
      if (!d || !Skins.isUnlocked(d.id)) return;
      const cv = Skins.master(d); if (!cv) return;
      const x = U.lerp(pr.px, pr.x, alpha), y = U.lerp(pr.py, pr.y, alpha);
      const s = pr.r * 2.7;
      if (pr.kind === 'rain') { ctx.drawImage(cv, x - s / 2, (y - pr.z) - s / 2, s, s); }
      else if (pr.kind === 'boomerang') { ctx.save(); ctx.translate(x, y); ctx.rotate(pr.angle); ctx.drawImage(cv, -s / 2, -s / 2, s, s); ctx.restore(); }
      else if (pr.kind === 'straight' || pr.kind === 'bounce' || pr.kind === 'homing' || pr.kind === 'ring') { ctx.drawImage(cv, x - s / 2, y - s / 2, s, s); }
    });
  };
})();

// ─── لون السحر المخصص: يتقدم على اللون المدمج ───
(function () {
  const baseTint = Render.tint;
  Render.tint = function (c) {
    const d = Skins.activeFor('color');
    if (d && Skins.isUnlocked(d.id) && d.type === 'emoji' && d.data) return baseTint.call(this, c);
    if (d && Skins.isUnlocked(d.id) && /^#[0-9a-fA-F]{3,8}$/.test(d.data || '')) return d.data;
    return baseTint.call(this, c);
  };
})();

/* ─── محرك الفتح: يُفحص بعد الارتقاء والإنجازات وفتح الشاشات ─── */
(function () {
  if (AS.Prog && Prog.choose) {
    const ch = Prog.choose.bind(Prog);
    Prog.choose = function (o) { const res = ch(o); try { Skins.checkUnlocks(); } catch (e) { } return res; };
  }
  if (AS.Ach && Ach.check) {
    const ac = Ach.check.bind(Ach);
    Ach.check = function () { const res = ac(); try { Skins.checkUnlocks(); } catch (e) { } return res; };
  }
  if (AS.UI && UI.showScreen) {
    const ss = UI.showScreen.bind(UI);
    UI.showScreen = function (id) {
      try { if (id === 'screen-menu' || id === 'screen-wardrobe') Skins.checkUnlocks(); } catch (e) { }
      return ss(id);
    };
  }
  Bus.on('langChanged', () => { try { Skins.spriteCache.clear(); } catch (e) { } });
})();
/* ═══════════ v2.2 — UI: خزانة السكنات المخصصة (تبويبات + بطاقات + نافذة سكن) ═══════════ */
(function () {
  const $ = (id) => document.getElementById(id);
  const ar = () => I18N.lang() === 'ar';
  const QUICK = ['🧙', '🥷', '🧛', '🧚', '🐉', '🐺', '👻', '💀', '🤖', '🐱', '🦇', '🕷️', '🪄', '⚔️', '🛡️', '🔥', '❄️', '⚡', '☄️', '🌟'];

  // ─── عناصر كل تبويب: قائمة أوصاف بطاقات ───
  UI.wardItems = function (tab) {
    const out = [];
    const L = (label) => out.push({ kind: 'head', label });
    if (tab === 'player') {
      const cs = Data.CHARACTERS;
      cs.forEach(c => {
        L((ar() ? c.ar : c.en));
        Data.SKINS.filter(s => s.ch === c.id).forEach(s => out.push({ kind: 'builtin', item: s, cat: 'skin', target: c.id }));
        for (const id in Skins.defs) { const d = Skins.defs[id]; if (d.category === 'player' && d.target === c.id) out.push({ kind: 'custom', def: d }); }
      });
    } else if (tab === 'weapon') {
      L(t('kindNew') + ' — ' + t('wdHintSlot'));
      Data.WEAPONS.forEach(w => {
        const d = Object.values(Skins.defs).find(x => x.category === 'weapon' && x.target === w.id);
        out.push({ kind: 'slot', cat: 'weapon', target: w.id, def: d || null, item: w });
      });
    } else if (tab === 'enemy') {
      L(t('codexEnemies') + ' — ' + t('wdHintSlot'));
      for (const id in Data.ENEMIES) {
        const d = Object.values(Skins.defs).find(x => x.category === 'enemy' && x.target === id);
        out.push({ kind: 'slot', cat: 'enemy', target: id, def: d || null, item: Data.ENEMIES[id] });
      }
      if (Data.MINIBOSSES.length) {
        L(t('codexBosses'));
        Data.MINIBOSSES.forEach(m => {
          const d = Object.values(Skins.defs).find(x => x.category === 'enemy' && x.target === m.id);
          out.push({ kind: 'slot', cat: 'enemy', target: m.id, def: d || null, item: m });
        });
      }
      for (const id in Data.BOSSES) {
        const d = Object.values(Skins.defs).find(x => x.category === 'enemy' && x.target === id);
        out.push({ kind: 'slot', cat: 'enemy', target: id, def: d || null, item: Data.BOSSES[id] });
      }
    } else if (tab === 'familiar') {
      Data.COMPANIONS.filter(c => c.kind !== 'none').forEach(c => {
        const d = Object.values(Skins.defs).find(x => x.category === 'familiar' && x.target === c.id);
        out.push({ kind: 'slot', cat: 'familiar', target: c.id, def: d || null, item: c });
      });
    } else if (tab === 'effect') {
      L(t('wdSecTrails'));
      Data.TRAILS.forEach(s => out.push({ kind: 'builtin', item: s, cat: 'trail', target: 'trail' }));
      for (const id in Skins.defs) { const d = Skins.defs[id]; if (d.category === 'effect' && d.target === 'trail') out.push({ kind: 'custom', def: d }); }
      L(t('wdSecColors'));
      Data.SPELL_COLORS.forEach(s => out.push({ kind: 'builtin', item: s, cat: 'color', target: 'color' }));
      for (const id in Skins.defs) { const d = Skins.defs[id]; if (d.category === 'effect' && d.target === 'color') out.push({ kind: 'custom', def: d }); }
    }
    return out;
  };

  // ─── بطاقة سكن واحدة ───
  UI.wardCard = function (it) {
    const el = document.createElement('div');
    if (it.kind === 'head') { el.className = 'wd-sechead'; el.textContent = it.label; return el; }
    if (it.kind === 'builtin') return this.wardBuiltinCard(it, el);
    if (it.kind === 'slot') return this.wardSlotCard(it, el);
    return this.wardCustomCard(it, el);
  };

  // بطاقة كوزمتك مدمجة (أزياء/آثار/ألوان)
  UI.wardBuiltinCard = function (it, el) {
    const s = it.item, owns = Wardrobe.owns(it.cat, s.id);
    const eqKey = it.cat === 'skin' ? 'skin' : it.cat === 'trail' ? 'trail' : 'color';
    const eq = Meta.cosmetics.equipped[eqKey] === s.id;
    el.className = 'wd-card' + (eq ? ' active' : '') + (owns ? '' : ' locked');
    const col = s.body || s.color || '#2a3352';
    el.innerHTML =
      '<div class="wd-badge">' + (eq ? '⭐' : owns ? '✅' : '🔒') + '</div>' +
      '<div class="wd-prev" style="background:radial-gradient(circle at 35% 30%,' + col + ',rgba(0,0,0,.55))"></div>' +
      '<div class="wd-name">' + U.esc(ar() ? s.ar : s.en) + '</div>' +
      '<div class="wd-sub">' + t('wdBuiltin') + (s.leg ? ' · ' + t('rarityLeg') : '') + '</div>';
    const acts = document.createElement('div'); acts.className = 'wd-acts';
    const b = document.createElement('button');
    b.className = 'btn' + (owns ? '' : ' gold');
    b.style.minHeight = '30px';
    b.textContent = eq ? t('equipped') : owns ? t('equip') : U.num(s.cost || 0) + (s.cur === 'shards' ? ' ✦' : ' ◉');
    b.onclick = () => {
      Audio.sfx('click');
      const kind = it.cat === 'skin' ? 'skins' : it.cat === 'trail' ? 'trails' : 'colors';
      const effTarget = it.cat === 'trail' ? 'trail' : 'color';
      if (eq) {
        // إزالة الارتداء (الأثر واللون فقط — الأزياء تبقى مُرتداة)
        if (it.cat === 'trail') Wardrobe.equip('trails', 'tr_none');
        else if (it.cat === 'color') Wardrobe.equip('colors', 'cl_default');
      } else if (owns) {
        Wardrobe.equip(kind, s.id);
        if (it.cat !== 'skin') Skins.setActive('effect', effTarget, null); // إزاحة السكن المخصص إن وجد
        try { UI.toast(t('appliedToast'), 'ok'); } catch (e) { }
      } else if (Wardrobe.buy(it.cat, s)) {
        Wardrobe.equip(kind, s.id);
        if (it.cat !== 'skin') Skins.setActive('effect', effTarget, null);
        UI.toast(t('newUnlock'), 'gold');
      } else {
        UI.toast(s.cur === 'shards' ? t('notEnough') : t('notEnoughGold'), 'bad'); Audio.sfx('banish');
      }
      this.refreshMenuCurrency(); this.buildWardrobe(); Ach.check();
    };
    acts.appendChild(b); el.appendChild(acts);
    return el;
  };

  // بطاقة خانة فارغة (سلاح/عدو/مرافق بلا سكن مخصص)
  UI.wardSlotCard = function (it, el) {
    const d = it.def;
    if (d) return this.wardCustomCard({ kind: 'custom', def: d }, el);
    const w = it.item, col = w.color || '#2a3352';
    el.className = 'wd-card';
    el.innerHTML =
      '<div class="wd-prev" style="background:radial-gradient(circle at 35% 30%,' + col + ',rgba(0,0,0,.5))"><span style="font-size:1.6em;opacity:.65">＋</span></div>' +
      '<div class="wd-name">' + U.esc(ar() ? w.ar : w.en) + '</div>' +
      '<div class="wd-sub">' + t('wdHintSlot') + '</div>';
    el.onclick = () => { Audio.sfx('click'); this.openSkinModal(null, it.cat, it.target); };
    return el;
  };

  // بطاقة سكن مخصص
  UI.wardCustomCard = function (it, el) {
    const d = it.def, unlocked = Skins.isUnlocked(d.id);
    const active = Skins.isActive(d.id);
    el.className = 'wd-card' + (active ? ' active' : '') + (unlocked ? '' : ' locked');
    el.innerHTML =
      '<div class="wd-badge">' + (active ? '⭐' : unlocked ? '✅' : '🔒') + '</div>' +
      '<div class="wd-prev">' + Skins.previewHTML(d, 64) + '</div>' +
      '<div class="wd-name">' + U.esc(d.name) + '</div>' +
      '<div class="wd-sub">' + (unlocked ? t('wdCustom') + ' · ' + Skins.targetName(d.category, d.target) : U.esc(Skins.conditionText(d))) + '</div>';
    const acts = document.createElement('div'); acts.className = 'wd-acts';
    const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : ''); b.style.minHeight = '30px'; b.textContent = txt; b.onclick = (ev) => { ev.stopPropagation(); fn(); }; acts.appendChild(b); return b; };
    if (active) {
      mk('⭐', 'ghost', () => {
        Audio.sfx('click'); Skins.setActive(d.category, d.target, null);
        this.buildWardrobe();
      });
    } else if (unlocked) {
      mk(t('wdApply'), 'gold', () => {
        Audio.sfx('unlock'); Skins.setActive(d.category, d.target, d.id);
        try { UI.toast(t('appliedToast'), 'ok'); } catch (e) { }
        this.buildWardrobe();
      });
    } else if (d.unlock && d.unlock.type === 'gold') {
      mk(U.num(d.unlock.value) + ' ◉', 'gold', () => {
        Audio.sfx('click');
        this.confirm(tf('confirmBuySkin', d.unlock.value || 0), () => {
          if (Skins.buyCustom(d)) { this.refreshMenuCurrency(); }
          this.buildWardrobe();
        });
      });
    } else {
      mk('🔒', 'ghost', () => { UI.toast(Skins.conditionText(d), 'dim'); Audio.sfx('banish'); });
    }
    mk(t('wdEdit'), 'ghost', () => { Audio.sfx('click'); this.openSkinModal(d.id); });
    mk(t('wdDup'), 'ghost', () => { Audio.sfx('click'); Skins.duplicate(d.id); this.buildWardrobe(); });
    mk(t('wdDel'), 'ghost danger', () => {
      Audio.sfx('click');
      this.confirm(t('confirmDelSkin'), () => { Skins.remove(d.id); UI.toast(t('skinDeleted'), 'dim'); this.buildWardrobe(); });
    });
    el.appendChild(acts);
    return el;
  };

  // ─── عداد التخزين ───
  UI.buildStorageMeter = function () {
    const q = Skins.quota();
    const fill = $('wd-store-fill'), txt = $('wd-store-txt');
    if (fill) {
      fill.style.transform = 'scaleX(' + Math.max(0.02, q.pct) + ')';
      fill.style.background = q.warn ? 'var(--danger)' : 'var(--ok)';
    }
    if (txt) txt.textContent = t('wdStoreTxt').replace('{k}', U.num(q.kb) + 'KB').replace('{n}', U.num(q.imgs));
    if (q.warn) UI.toast(t('wdStoreWarn'), 'bad');
  };

  // ─── بناء شاشة الخزانة كاملة ───
  UI._wdTab = 'player';
  UI.buildWardrobe = function () {
    const grid = $('wd-grid');
    if (!grid) return;
    const tabs = $('wd-tabs').querySelectorAll('.tab');
    tabs.forEach(tb => {
      tb.classList.toggle('on', tb.getAttribute('data-w') === this._wdTab);
      tb.onclick = () => { this._wdTab = tb.getAttribute('data-w'); Audio.sfx('click'); this.buildWardrobe(); };
    });
    $('wd-add').onclick = () => { Audio.sfx('click'); this.openSkinModal(null); };
    $('wd-clean').onclick = () => {
      Audio.sfx('click');
      const n = Skins.cleanCount();
      if (!n) { this.toast(t('nothingToClean'), 'dim'); return; }
      this.confirm(tf('confirmClean', n), () => { const c = Skins.cleanUnused(); this.toast(tf('cleanedToast', c), 'ok'); this.buildWardrobe(); });
    };
    $('wd-reset').onclick = () => {
      Audio.sfx('click');
      this.confirm(t('confirmResetSkins'), () => { Skins.resetAll(); this.buildWardrobe(); this.toast(t('wdResetDone'), 'ok'); });
    };
    this.buildStorageMeter();
    grid.innerHTML = '';
    const items = this.wardItems(this._wdTab);
    if (this._wdTab === 'player' && !Object.keys(Skins.defs).some(k => Skins.defs[k].category === 'player')) {
      // لا نُخفي الأزياء المدمجة — تلميح فقط أعلى القائمة
      const hint = document.createElement('div'); hint.className = 'wd-sechead'; hint.textContent = t('wdNoCustom');
      grid.appendChild(hint);
    }
    items.forEach(it => grid.appendChild(this.wardCard(it)));
    const g = $('ward-gold'); if (g) g.textContent = U.num(Meta.gold);
    const sh = $('ward-shards'); if (sh) sh.textContent = U.num(Meta.shards);
  };

  /* ═══════ نافذة إضافة/تعديل سكن ═══════ */
  UI._skinEditId = null;
  UI._skinTmp = { type: 'emoji', data: '', url: '', bytes: 0 };

  UI.openSkinModal = function (editId, presetCat, presetTarget) {
    this._skinEditId = editId || null;
    const d = editId ? Skins.defs[editId] : null;
    this._skinTmp = { type: d ? d.type : 'emoji', data: d ? d.data : '', url: d ? ((Skins.imgCache.get(d.id) || {}).url || '') : '', bytes: d ? (d.bytes || 0) : 0 };
    // الحقول
    $('wdm-title').textContent = d ? t('wdEditTitle') : t('wdAdd');
    $('wdm-name').value = d ? d.name : '';
    this.setSkinKind(this._skinTmp.type);
    $('wdm-emoji').value = d && d.type === 'emoji' ? d.data : '';
    // الفئة والهدف
    const catSel = $('wdm-cat');
    const cat = d ? d.category : (presetCat || 'player');
    catSel.value = cat;
    catSel.onchange = () => { this.fillSkinTargets(catSel.value, null); this.updateSkinUnlockUI(); };
    this.fillSkinTargets(cat, d ? d.target : (presetTarget || null));
    // شرط الفتح
    const u = d ? (d.unlock || { type: 'none' }) : { type: 'none' };
    $('wdm-utype').value = u.type || 'none';
    $('wdm-uval').value = (u.type && u.type !== 'none' && u.type !== 'achievement' && u.type !== 'secret' && u.value) ? u.value : '';
    $('wdm-uach').value = u.type === 'achievement' ? (u.value || '') : '';
    $('wdm-uval').placeholder = u.type === 'secret' ? 'kills:1000' : '10';
    this.updateSkinUnlockUI();
    // لوحة الإيموجي السريعة
    const q = $('wdm-quick'); q.innerHTML = '';
    QUICK.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = e;
      b.onclick = () => { $('wdm-emoji').value = e; this.updateSkinPreviews(); };
      q.appendChild(b);
    });
    this.updateSkinPreviews();
    UI.showScreen('screen-skin');
  };

  UI.setSkinKind = function (k) {
    this._skinTmp.type = k;
    $('wdm-k-emoji').classList.toggle('on', k === 'emoji');
    $('wdm-k-image').classList.toggle('on', k === 'image');
    $('wdm-emoji-box').classList.toggle('hidden', k !== 'emoji');
    $('wdm-img-box').classList.toggle('hidden', k !== 'image');
  };

  UI.fillSkinTargets = function (cat, selected) {
    const sel = $('wdm-target');
    sel.innerHTML = '';
    Skins.targetsFor(cat).forEach(o => {
      const op = document.createElement('option');
      op.value = o.id; op.textContent = o.label;
      sel.appendChild(op);
    });
    if (selected) sel.value = selected;
  };

  UI.updateSkinUnlockUI = function () {
    const ty = $('wdm-utype').value;
    $('wdm-uval').classList.toggle('hidden', !(ty === 'level' || ty === 'gold' || ty === 'streak' || ty === 'runs' || ty === 'secret'));
    $('wdm-uach').classList.toggle('hidden', ty !== 'achievement');
    $('wdm-uhint').textContent = ty === 'secret' ? t('wdSecretHint') : (ty === 'gold' ? tf('wdUnlockGold', Number($('wdm-uval').value) || 0) : '');
    if (ty === 'secret') $('wdm-uval').placeholder = 'kills:1000'; else $('wdm-uval').placeholder = '10';
  };

  UI.updateSkinPreviews = function () {
    const tp = this._skinTmp;
    const data = tp.type === 'emoji' ? ($('wdm-emoji').value || '') : tp.url;
    const html = Skins.livePreview(data, tp.type, tp.url);
    $('wdm-pv32').innerHTML = html; $('wdm-pv96').innerHTML = html;
  };

  UI.bindSkinModal = function () {
    // نوع المصدر
    $('wdm-k-emoji').onclick = () => { Audio.sfx('click'); this.setSkinKind('emoji'); this.updateSkinPreviews(); };
    $('wdm-k-image').onclick = () => { Audio.sfx('click'); this.setSkinKind('image'); this.updateSkinPreviews(); };
    $('wdm-emoji').oninput = () => this.updateSkinPreviews();
    // شرط الفتح
    $('wdm-utype').onchange = () => this.updateSkinUnlockUI();
    $('wdm-uval').oninput = () => this.updateSkinUnlockUI();
    // قائمة الإنجازات
    const ach = $('wdm-uach'); ach.innerHTML = '';
    const list = Data.ACHIEVEMENTS.filter(a => !a.secret);
    if (!list.length) { const op = document.createElement('option'); op.value = ''; op.textContent = t('wdAchNone'); ach.appendChild(op); }
    list.forEach(a => {
      const op = document.createElement('option');
      op.value = a.id; op.textContent = (ar() ? (a.dar || a.ar) : (a.den || a.en));
      ach.appendChild(op);
    });
    // رفع الصورة: نقرة + سحب وإفلات
    const drop = $('wdm-drop'), file = $('wdm-file');
    drop.onclick = () => file.click();
    file.onchange = () => { if (file.files && file.files[0]) this.handleSkinFile(file.files[0]); file.value = ''; };
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) this.handleSkinFile(f);
    });
    // حفظ
    $('wdm-save').onclick = () => this.saveSkinModal();
    // إلغاء عبر أزرار btn-back داخل النافذة
    document.querySelectorAll('#screen-skin .btn-back').forEach(b => b.onclick = () => { Audio.sfx('click'); UI.showScreen('screen-wardrobe'); UI.buildWardrobe(); });
  };

  UI.handleSkinFile = function (f) {
    $('wdm-drop').querySelector('span').textContent = t('wdCompressing');
    Skins.compressImage(f).then(res => {
      $('wdm-drop').querySelector('span').textContent = t('wdDrop');
      if (res.err) { UI.toast(t(res.err), 'bad'); Audio.sfx('banish'); return; }
      this._skinTmp.url = res.url; this._skinTmp.bytes = res.bytes || 0; this._skinTmp.data = res.url;
      this.updateSkinPreviews();
      Audio.sfx('click');
    });
  };

  UI.saveSkinModal = function () {
    const name = ($('wdm-name').value || '').trim();
    if (!name) { UI.toast(t('wdNameReq'), 'bad'); return; }
    const cat = $('wdm-cat').value, target = $('wdm-target').value;
    if (!target) { UI.toast(t('wdNeedTarget'), 'bad'); return; }
    const ty = $('wdm-utype').value;
    let unlock = { type: 'none', value: null };
    if (ty === 'achievement') unlock = { type: 'achievement', value: $('wdm-uach').value || null };
    else if (ty === 'secret') unlock = { type: 'secret', value: ($('wdm-uval').value || '').trim() || null };
    else if (ty !== 'none') unlock = { type: ty, value: Number($('wdm-uval').value) || 1 };
    const tp = this._skinTmp;
    if (tp.type === 'emoji' && !($('wdm-emoji').value || '').trim()) { UI.toast(t('wdNeedData'), 'bad'); return; }
    if (tp.type === 'image' && !tp.url) { UI.toast(t('wdNeedData'), 'bad'); return; }
    const payload = {
      name, type: tp.type, category: cat, target, unlock,
      data: tp.type === 'emoji' ? $('wdm-emoji').value.trim() : '',
      bytes: tp.bytes || 0
    };
    if (tp.type === 'image') payload._img = tp.url;
    if (this._skinEditId) {
      Skins.update(this._skinEditId, payload);
      // تغيير النوع من صورة إلى إيموجي: نظّف الصورة المخزنة
      if (tp.type === 'emoji') { Save.storeDel(Skins.IMG_STORE, this._skinEditId); Skins.imgCache.delete(this._skinEditId); Skins.spriteCache.delete(this._skinEditId); }
    } else {
      Skins.add(payload);
    }
    UI.toast(t('skinSaved'), 'ok'); Audio.sfx('unlock');
    UI.showScreen('screen-wardrobe'); UI.buildWardrobe();
  };

  // ─── ربط الخزانة عند الإقلاع + إعادة البناء عند تغيير اللغة/جاهزية الصور ───
  (function () {
    const init = UI.init.bind(UI);
    UI.init = function () {
      init();
      UI.bindSkinModal();
      // الصور تُحمّل الآن بعد اكتمال الحفظ وواجهة المستخدم (اتصال IndexedDB جاهز)
      try { Skins.preloadImages(); } catch (e) { }
      // زر اللغة يبني من جديد لتسميات الأهداف
      Bus.on('langChanged', () => {
        if (!$('screen-wardrobe').classList.contains('hidden')) UI.buildWardrobe();
        if (!$('screen-skin').classList.contains('hidden')) { const id = UI._skinEditId; UI.openSkinModal(id); }
      });
      Bus.on('skinsLoaded', () => {
        if (!$('screen-wardrobe').classList.contains('hidden')) UI.buildWardrobe();
      });
    };
  })();
})();
