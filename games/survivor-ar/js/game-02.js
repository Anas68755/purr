'use strict';

Render.drawTexts = function (dt) {
  const ctx = this.ctx;
  ctx.textAlign = 'center';
  Core.pools.texts.forEach(tx => {
    tx.life -= dt;
    if (tx.life <= 0) { Core.pools.texts.release(tx); return; }
    tx.y += tx.vy * dt;
    const k = Math.min(1, tx.life / (tx.maxLife * 0.5));
    ctx.globalAlpha = k;
    ctx.font = '900 ' + tx.size + 'px Tajawal, Inter, sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3; ctx.strokeText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = tx.color; ctx.fillText(tx.txt, tx.x, tx.y);
    ctx.globalAlpha = 1;
  });
};

// ─── مولدات المؤثرات ───
Render.fxParticle = function (x, y, color, type) {
  const perf = Meta.settings.perf;
  if (perf && Math.random() < 0.55) return;
  const p = Core.pools.parts.get(); if (!p) return;
  const a = Math.random() * U.TAU, sp = 30 + Math.random() * 90;
  p.x = x; p.y = y; p.color = color; p.type = type;
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - (type === 'flame' ? 60 : 0);
  p.maxLife = p.life = type === 'smoke' ? 0.8 : type === 'burst' || type === 'ring' ? 0.4 : 0.5;
  p.size = type === 'smoke' ? 5 : 3; p.grav = type === 'spark' ? 160 : 0; p.drag = 0.96; p.a = 1; p.x2 = 0; p.y2 = 0;
};
Render.fxExplosion = function (x, y, r, color) {
  const perf = Meta.settings.perf;
  const n = perf ? 6 : 14;
  for (let i = 0; i < n; i++) this.fxParticle(x + (Math.random() - 0.5) * r * 0.6, y + (Math.random() - 0.5) * r * 0.6, color, 'spark');
  const p = Core.pools.parts.get();
  if (p) { p.x = x; p.y = y; p.vx = p.vy = 0; p.color = color; p.type = 'burst'; p.maxLife = p.life = 0.35; p.size = r * 0.55; p.grav = 0; p.drag = 1; }
  this.lightSpots.push({ x, y, r: r * 1.3, t: 0.3 });
};
Render.fxZap = function (x1, y1, x2, y2, color) {
  const p = Core.pools.parts.get(); if (!p) return;
  p.x = x1; p.y = y1; p.x2 = x2; p.y2 = y2; p.vx = p.vy = 0;
  p.color = color; p.type = 'zap'; p.maxLife = p.life = 0.14; p.size = 2; p.grav = 0; p.drag = 1;
};
Render.fxSlash = function (x, y, angle, range, color) {
  const p = Core.pools.parts.get(); if (!p) return;
  p.x = x; p.y = y; p.vx = p.vy = 0; p.a = angle; p.size = range * 0.8;
  p.color = color; p.type = 'slash'; p.maxLife = p.life = 0.18; p.grav = 0; p.drag = 1;
};
Render.auraPulse = function (school, area, color) {
  if (Math.random() < 0.5) return;
  const r = Game.run, p = Core.pools.parts.get(); if (!p) return;
  p.x = r.player.x; p.y = r.player.y; p.vx = p.vy = 0;
  p.color = color; p.type = 'ring'; p.maxLife = p.life = 0.4; p.size = area * 0.4; p.grav = 0; p.drag = 1;
};
Render.fText = function (x, y, txt, color, size) {
  const tx = Core.pools.texts.get(); if (!tx) return;
  tx.x = x + (Math.random() - 0.5) * 10; tx.y = y; tx.txt = txt; tx.color = color;
  tx.size = size || 14; tx.vy = -48; tx.maxLife = tx.life = 0.8;
};
/* ══════════════════════ Systems/Progression — الخبرة والترقيات والتطور ══════════════════════ */
const Prog = AS.Prog = {
  xpCurve(lv) { return Math.floor(5 + lv * 6 + Math.pow(lv, 1.55) * 2); },

  // ─── الجواهر: خبرة/ذهب/شفاء/شظية/صندوق ───
  spawnOrb(x, y, val, type, fragId) {
    type = type || 'xp';
    const P = Core.pools.orbs;
    // عند الامتلاء: دمج القيمة في جوهرة قائمة (حماية أداء)
    if (P.free.length === 0) {
      let merged = false;
      P.forEach(o => { if (!merged && o.type === type) { o.val += val; merged = true; } });
      if (!merged && type === 'xp') { /* تجاهل */ }
      return;
    }
    const o = P.get(); if (!o) return;
    o.x = o.px = x + (Math.random() - 0.5) * 14; o.y = o.py = y + (Math.random() - 0.5) * 14;
    o.vx = o.vy = 0; o.val = val; o.type = type; o.r = 6; o.magnet = false; o.fragId = fragId || null;
  },
  dropChest(x, y) { this.spawnOrb(x, y, 1, 'chest'); UI.toast(t('chestFromElite'), 'gold'); Audio.sfx('chest'); },

  // ─── الخبرة والارتقاء (مع طابور مستويات) ───
  addXp(n) {
    const r = Game.run; if (!r) return;
    r.xp += n * r.stats.xp;
    r.challengeProg.level = Math.max(r.challengeProg.level, r.level);
    let leveled = false;
    while (r.xp >= r.xpNext) {
      r.xp -= r.xpNext; r.level++;
      r.xpNext = this.xpCurve(r.level);
      r.pendingLv++; leveled = true;
      r.lvSinceBanish++;
      if (r.lvSinceBanish % 3 === 0) r.banishCharge = 1;
    }
    if (leveled) {
      Audio.sfx('levelup'); UI.haptic(40);
      Render.fText(r.player.x, r.player.y - 34, t('lvl') + ' ' + U.num(r.level), '#7ee8fa', 18);
      Render.fxExplosion(r.player.x, r.player.y, 60, '#7ee8fa');
      Meta.stats.maxLevel = Math.max(Meta.stats.maxLevel, r.level);
      Bus.emit('level', r.level);
    }
    if (r.pendingLv > 0 && Game.state === 'playing') UI.openLevelup();
  },

  // ─── توليد خيارات شاشة الترقية: تطور أولًا ثم ترقيات/جديد/تمارين ───
  generateOptions() {
    const r = Game.run, opts = [];
    // تطور جاهز؟ (سلاح بأقصى مستوى + متطلبه موجود)
    for (const w of r.weapons) {
      if (w.lv >= w.def.maxLv && !w.evolved) {
        const evo = Data.EVO_MAP[w.id];
        if (evo && !r.banished.includes('evo:' + w.id)) {
          const reqOk = r.weapons.some(x => x.id === evo.with) || r.artifacts.includes(evo.with);
          if (reqOk) { opts.push({ kind: 'evo', id: w.id, w }); break; }
        }
      }
    }
    const cand = [];
    for (const w of r.weapons) {
      if (w.lv < w.def.maxLv && !r.banished.includes('up:' + w.id)) cand.push({ kind: 'up', id: w.id, w, weight: 3 });
    }
    if (r.weapons.length < 6) {
      for (const def of Data.WEAPONS) {
        if (r.weapons.some(w => w.id === def.id)) continue;
        if (r.banished.includes('new:' + def.id)) continue;
        cand.push({ kind: 'new', id: def.id, weight: 2.4 });
      }
    }
    for (const P of Data.PASSIVES) {
      if ((r.passives[P.id] || 0) >= P.max) continue;
      if (r.banished.includes('p:' + P.id)) continue;
      cand.push({ kind: 'p', id: P.id, weight: P.weight || 2 });
    }
    // اختيار 4 فريدة موزونة
    const picked = [];
    const pool = cand.slice();
    while (picked.length < 4 && pool.length) {
      const c = U.weighted(pool.map(p => [p, p.weight]));
      pool.splice(pool.indexOf(c), 1);
      picked.push(c);
    }
    // الخيار المثبَّت (Lock) يظهر دائمًا أولًا
    if (r.lockedId) {
      const li = picked.findIndex(p => p.kind + ':' + p.id === r.lockedId);
      if (li >= 0) { const [it] = picked.splice(li, 1); picked.unshift(it); }
    }
    for (const p of picked) opts.push(p);
    if (!opts.length) opts.push({ kind: 'gold', id: 'gold', val: 50 });
    return opts;
  },

  choose(opt) {
    const r = Game.run;
    r.lockedId = null;
    switch (opt.kind) {
      case 'evo': this.applyEvolution(opt.w); break;
      case 'new': {
        if (Combat.addWeapon(opt.id)) UI.toast(Data.weapon(opt.id)[I18N.lang() === 'ar' ? 'ar' : 'en'] + ' — ' + t('newUnlock'));
        break;
      }
      case 'up': opt.w.lv++; break;
      case 'p': r.passives[opt.id] = (r.passives[opt.id] || 0) + 1; Combat.recalcStats(r); break;
      case 'gold': r.gold += opt.val; r.goldRun += opt.val; break;
    }
    r.pendingLv = Math.max(0, r.pendingLv - 1);
    Save.mark();
    UI.closeLevelup();
    if (r.pendingLv > 0) UI.openLevelup();
  },
  banish(opt) {
    const r = Game.run;
    if (r.banishCharge <= 0) return;
    r.banishCharge = 0;
    r.banished.push(opt.kind + ':' + opt.id);
    Audio.sfx('banish');
    UI.toast(t('banish') + ': ' + Prog.optName(opt));
    UI.openLevelup(true); // إعادة توليد بنفس المستوى
  },
  skip() {
    const r = Game.run;
    r.pendingLv = Math.max(0, r.pendingLv - 1);
    this.addXp(50 / r.stats.xp); // خبرة فورية
    UI.closeLevelup();
    if (r.pendingLv > 0) UI.openLevelup();
  },
  lock(opt) {
    const r = Game.run;
    r.lockedId = r.lockedId === opt.kind + ':' + opt.id ? null : opt.kind + ':' + opt.id;
    UI.openLevelup(true);
  },
  optName(opt) {
    const ar = I18N.lang() === 'ar';
    if (opt.kind === 'evo') { const ev = Data.EVOLVED[Data.EVO_MAP[opt.id].evo]; return ar ? ev.ar : ev.en; }
    if (opt.kind === 'up' || opt.kind === 'new') { const d = Data.isEvolved(opt.id) ? Data.EVOLVED[opt.id] : Data.weapon(opt.id); return ar ? d.ar : d.en; }
    if (opt.kind === 'p') { const P = Data.passive(opt.id); return ar ? P.ar : P.en; }
    return t('kindGold');
  },

  // ─── التطور: استبدال السلاح بنسخته المتطورة ───
  applyEvolution(baseW) {
    const r = Game.run;
    const evoId = Data.EVO_MAP[baseW.id] ? Data.EVO_MAP[baseW.id].evo : null;
    if (!evoId) return;
    const idx = r.weapons.indexOf(baseW);
    if (idx >= 0) r.weapons.splice(idx, 1);
    baseW.evolved = true;
    const w = Combat.addWeapon(evoId);
    r.evolutionsRun = (r.evolutionsRun || 0) + 1;
    r.challengeProg.evolve++;
    Meta.stats.evolutions++;
    Meta.stats.maxEvolveRun = Math.max(Meta.stats.maxEvolveRun, r.evolutionsRun);
    Audio.sfx('evolve'); Game.shake(8, 0.4);
    UI.toast((I18N.lang() === 'ar' ? Data.EVOLVED[evoId].ar : Data.EVOLVED[evoId].en) + ' — ' + t('evolutionReady'), 'gold');
    Render.fxExplosion(r.player.x, r.player.y, 150, Data.EVOLVED[evoId].color);
    UI.haptic([30, 40, 60]);
    Save.mark();
  },

  // ─── الصناديق: مكافأة عشوائية مرئية ───
  openChest(orb) {
    const r = Game.run;
    Game.setState('chest');
    Audio.sfx('chest'); UI.haptic(50);
    const rewards = [];
    const roll = () => {
      const x = Math.random();
      if (x < 0.45) {
        const ups = r.weapons.filter(w => !w.evolved && w.lv < w.def.maxLv);
        if (ups.length) { const w = U.pick(ups); w.lv++; return { kind: 'up', ar: 'ترقية: ' + w.def.ar, en: 'Upgrade: ' + w.def.en, sub: '+' + U.num(w.lv) }; }
        return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 80 };
      }
      if (x < 0.75) {
        const pool = Data.ARTIFACTS.filter(a => !r.artifacts.includes(a.id) && (!a.unique || !(r.artifacts.includes(a.id))));
        if (pool.length) {
          const a = U.weighted(pool.map(p => [p, p.unique ? 0.4 : 1]));
          r.artifacts.push(a.id);
          Meta.stats.artifactsFound[a.id] = true;
          Combat.recalcStats(r);
          return { kind: 'art', ar: a.ar, en: a.en, sub: AD(a.id)[I18N.lang() === 'ar' ? 'ar' : 'en'] };
        }
        return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 100 };
      }
      return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 60 + Math.floor(Math.random() * 90) };
    };
    rewards.push(roll());
    if (r.hooks.luckyChest && Math.random() < r.hooks.luckyChest) rewards.push(roll());
    for (const rw of rewards) if (rw.kind === 'gold') { const g = Math.round(rw.val * r.stats.gold); r.gold += g; r.goldRun += g; r.challengeProg.gold += g; }
    r.challengeProg.chest++;
    Save.mark();
    UI.showChest(rewards);
  }
};

/* ══════════════════════ Systems/Achievements+Challenges ══════════════════════ */
const Ach = {
  check() {
    const M = Meta; let newly = 0;
    for (const a of Data.ACHIEVEMENTS) {
      const st = M.achievements[a.id];
      if (st && st.done) continue;
      const p = Math.min(a.target, Math.floor(a.get(M) || 0));
      if (!st) M.achievements[a.id] = { p: p, done: false };
      else st.p = p;
      if (p >= a.target) {
        M.achievements[a.id].done = true; newly++;
        UI.toast(a.icon + ' ' + t('achievementUnlocked') + ' — ' + (I18N.lang() === 'ar' ? a.dar : a.den), 'gold');
        Audio.sfx('unlock');
        this.checkUnlocks();
      }
    }
    if (newly) Save.mark();
    return newly;
  },
  // فتح الشخصيات المرتبطة بإنجاز مكتمل
  checkUnlocks() {
    for (const c of Data.CHARACTERS) {
      if (Meta.unlockedChars.includes(c.id)) continue;
      if (c.unlock.type === 'ach' && Meta.achievements[c.unlock.ach] && Meta.achievements[c.unlock.ach].done) {
        Meta.unlockedChars.push(c.id);
        UI.toast(t('charUnlocked') + ': ' + (I18N.lang() === 'ar' ? c.ar : c.en), 'gold');
      }
    }
  },
  count() { let n = 0; for (const k in Meta.achievements) if (Meta.achievements[k].done) n++; return n; }
};

const Chal = {
  dayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  weekKey() { const d = new Date(); const on = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil((((d - on) / 86400000) + on.getDay() + 1) / 7); return d.getFullYear() + 'W' + wk; },
  ensure() {
    const M = Meta;
    if (M.challenges.daily.date !== this.dayKey()) {
      const rng = U.mulberry32(U.hash32(this.dayKey()) ^ 0x9E3779B9);
      const types = Data.CHALLENGE_TYPES.slice();
      const list = [];
      for (let i = 0; i < 3 && types.length; i++) {
        const T = types.splice(Math.floor(rng() * types.length), 1)[0];
        list.push(this.mk(T, Math.round(U.lerp(T.d[0], T.d[1], rng())), 2, rng));
      }
      M.challenges.daily = { date: this.dayKey(), list };
      Save.mark();
    }
    if (M.challenges.weekly.week !== this.weekKey()) {
      const rng = U.mulberry32(U.hash32(this.weekKey()) ^ 0x85EBCA6B);
      const types = Data.CHALLENGE_TYPES.slice();
      const T = types.splice(Math.floor(rng() * types.length), 1)[0];
      M.challenges.weekly = { week: this.weekKey(), list: [this.mk(T, Math.round(U.lerp(T.w[0], T.w[1], rng())), 6, rng)] };
      Save.mark();
    }
  },
  mk(T, n, reward, rng) {
    const it = { tid: T.id, n, prog: 0, done: false, reward };
    if (T.id === 'schoolkill') it.school = Data.CHALLENGE_SCHOOLS[Math.floor(rng() * Data.CHALLENGE_SCHOOLS.length)];
    return it;
  },
  desc(it) {
    const T = Data.CHALLENGE_TYPES.find(x => x.id === it.tid), ar = I18N.lang() === 'ar';
    let s = ar ? T.ar : T.en;
    s = s.replace('{n}', U.num(it.n));
    if (it.school) s = s.replace('{s}', ar ? Data.SCHOOLS[it.school].ar : Data.SCHOOLS[it.school].en);
    return s;
  },
  // دمج تقدم الجولة في التحديات النشطة (يُستدعى عند انتهاء الجولة)
  mergeRun(r) {
    this.ensure();
    const cp = r.challengeProg;
    const grab = (it) => {
      const T = Data.CHALLENGE_TYPES.find(x => x.id === it.tid);
      let v = 0;
      switch (T.ev) {
        case 'kills': v = cp.kills; break; case 'gold': v = cp.gold; break;
        case 'level': v = cp.level; break; case 'elite': v = cp.elite; break;
        case 'time': v = Math.floor(r.time / 60); break; case 'boss': v = cp.boss; break;
        case 'evolve': v = cp.evolve; break; case 'chest': v = cp.chest; break;
        case 'killSchool': v = (cp.killSchool[it.school] || 0); break;
      }
      return T.max ? v : v;
    };
    const feed = (store) => {
      for (const it of store.list) {
        if (it.done) continue;
        const v = it.tid === 'time' ? Math.floor(r.time / 60) : grab(it);
        const T = Data.CHALLENGE_TYPES.find(x => x.id === it.tid);
        if (T.max) it.prog = Math.max(it.prog, v); else it.prog += v;
        if (it.prog >= it.n) {
          it.done = true; Meta.shards += it.reward;
          Meta.stats.challengesDone++;
          if (store === Meta.challenges.daily) Meta.stats.dailiesDone++;
          UI.toast(t('challengeDone') + ' +' + U.num(it.reward) + ' ' + t('shardPickup'), 'gold');
          Audio.sfx('unlock');
        }
      }
    };
    feed(Meta.challenges.daily); feed(Meta.challenges.weekly);
    Save.mark();
  }
};
AS.Ach = Ach; AS.Chal = Chal;
/* ══════════════════════ UI/ — طبقة الواجهة (DOM منفصلة عن Canvas) ══════════════════════ */
const UI = AS.UI = {
  modsSel: new Set(), weeklyOn: false, debugOpen: false, _luOpts: [], _codexTab: 'enemies',

  $(id) { return document.getElementById(id); },
  init() {
    I18N._lang = Meta.lang || 'ar';
    I18N.setLang(I18N._lang);
    // أزرار القائمة الرئيسية
    this.$('btn-play').onclick = () => { Audio.init(); Audio.resume(); Audio.sfx('click'); this.buildStages(); this.showScreen('screen-stages'); };
    this.$('btn-chars').onclick = () => { Audio.sfx('click'); this.buildChars(); this.buildCompRow(); this.showScreen('screen-chars'); };
    this.$('btn-talents').onclick = () => { Audio.sfx('click'); this.buildTalents(); this.showScreen('screen-talents'); };
    this.$('btn-codex').onclick = () => { Audio.sfx('click'); this.buildCodex(); this.showScreen('screen-codex'); };
    this.$('btn-ach').onclick = () => { Audio.sfx('click'); this.buildAch(); this.showScreen('screen-ach'); };
    this.$('btn-chal').onclick = () => { Audio.sfx('click'); Chal.ensure(); this.buildChal(); this.showScreen('screen-chal'); };
    this.$('btn-hist').onclick = () => { Audio.sfx('click'); this.buildHist(); this.showScreen('screen-hist'); };
    this.$('btn-settings').onclick = () => { Audio.sfx('click'); this.bindSettings(); this.showScreen('screen-settings'); };
    this.$('btn-lang').onclick = () => {
      const nl = I18N.lang() === 'ar' ? 'en' : 'ar';
      I18N.setLang(nl); Meta.lang = nl; Save.mark();
      this.$('btn-lang').textContent = nl === 'ar' ? 'EN' : 'ع';
      I18N.apply(); this.refreshMenuCurrency();
    };
    this.$('btn-install').onclick = async () => { if (Game._installEvt) { Game._installEvt.prompt(); Game._installEvt = null; this.$('btn-install').classList.add('hidden'); } };
    // أزرار أثناء اللعب
    this.$('btn-pause').onclick = () => Bus.emit('pauseToggle');
    this.$('btn-photo').onclick = () => this.photo();
    this.$('btn-photo2').onclick = () => { this.photo(); };
    this.$('btn-resume').onclick = () => Bus.emit('pauseToggle');
    this.$('btn-abandon').onclick = () => this.confirm(t('confirmAbandon'), () => Game.endRun(false, true));
    this.$('btn-retry').onclick = () => { this.showScreen(null); Game.retryRun(); };
    this.$('btn-sum-menu').onclick = () => { this.showScreen('screen-menu'); Game.setState('menu'); };
    this.$('btn-share').onclick = () => this.shareCard();
    this.$('btn-start').onclick = () => { Audio.sfx('click'); Game.startRun([...this.modsSel], this.weeklyOn); };
    this.$('btn-to-mods').onclick = () => { Audio.sfx('click'); this.buildMods(); this.showScreen('screen-mods'); };
    this.$('btn-chest-ok').onclick = () => { Audio.sfx('click'); this.$('screen-chest').classList.add('hidden'); Game.setState('playing'); };
    // شاشة الترقية
    this.$('lu-banish').onclick = () => { if (this._luSel) Prog.banish(this._luSel); };
    this.$('lu-skip').onclick = () => Prog.skip();
    // أزرار الرجوع العامة
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = () => { Audio.sfx('click'); this.showScreen('screen-menu'); this.refreshMenuCurrency(); });
    // تبويبات الموسوعة والسجل
    document.querySelectorAll('#codex-tabs .tab').forEach(tb => tb.onclick = () => {
      document.querySelectorAll('#codex-tabs .tab').forEach(x => x.classList.remove('on')); tb.classList.add('on');
      this._codexTab = tb.getAttribute('data-t'); this.buildCodex();
    });
    this.$('tab-runs').onclick = () => { this.$('tab-runs').classList.add('on'); this.$('tab-lb').classList.remove('on'); this.$('hist-list').classList.remove('hidden'); this.$('lb-list').classList.add('hidden'); };
    this.$('tab-lb').onclick = () => { this.$('tab-lb').classList.add('on'); this.$('tab-runs').classList.remove('on'); this.$('lb-list').classList.remove('hidden'); this.$('hist-list').classList.add('hidden'); };
    // تأكيد عام
    this.$('confirm-yes').onclick = () => { this.$('screen-confirm').classList.add('hidden'); if (this._onYes) this._onYes(); };
    this.$('confirm-no').onclick = () => this.$('screen-confirm').classList.add('hidden');
    // لوحة التصحيح
    Bus.on('toggleDebug', () => this.toggleDebug());
    this.$('btn-dbg').onclick = () => this.toggleDebug();
    // ملء الشاشة
    this.$('btn-full').onclick = () => Bus.emit('toggleFullscreen');
    Bus.on('toggleFullscreen', () => {
      try {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
        else document.exitFullscreen().catch(() => { });
      } catch (e) { }
    });
    this.$('btn-lang').textContent = I18N.lang() === 'ar' ? 'EN' : 'ع';
    this.refreshMenuCurrency();
    Log.log('UI ready');
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (id) this.$(id).classList.remove('hidden');
  },
  refreshMenuCurrency() {
    this.$('menu-gold').textContent = U.num(Meta.gold);
    this.$('menu-shards').textContent = U.num(Meta.shards);
    this.$('talent-gold').textContent = U.num(Meta.gold);
  },
  toast(msg, cls) {
    const box = this.$('toasts'), el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : ''); el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2400);
    while (box.children.length > 4) box.firstChild.remove();
  },
  haptic(p) { try { if (Meta.settings.haptics && navigator.vibrate) navigator.vibrate(p); } catch (e) { } },
  confirm(text, onYes) { this.$('confirm-text').textContent = text; this._onYes = onYes; this.$('screen-confirm').classList.remove('hidden'); },

  // ─── العصا اللمسية ───
  showJoystick(x, y) {
    const b = this.$('joy-base'); b.style.display = 'block';
    b.style.left = (x - 60) + 'px'; b.style.top = (y - 60) + 'px';
    const k = this.$('joy-knob'); k.style.transform = 'translate(0,0)';
  },
  moveJoystick(vec, cl, max) {
    this.$('joy-knob').style.transform = 'translate(' + (vec.x * cl) + 'px,' + (vec.y * cl) + 'px)';
  },
  hideJoystick() { this.$('joy-base').style.display = 'none'; },

  // ─── HUD ───
  updateHUD() {
    const r = Game.run; if (!r) return;
    const p = r.player, s = r.stats;
    this.$('hpfill').style.transform = 'scaleX(' + U.clamp(p.hp / s.maxHp, 0, 1) + ')';
    this.$('hptext').textContent = U.num(Math.ceil(p.hp)) + '/' + U.num(s.maxHp);
    this.$('xpfill').style.transform = 'scaleX(' + U.clamp(r.xp / r.xpNext, 0, 1) + ')';
    this.$('timer').textContent = U.time(r.time);
    this.$('kills').textContent = U.num(r.kills);
    this.$('gold-run').textContent = U.num(r.goldRun);
    this.$('shard-run').textContent = U.num(r.shards);
    this.$('lvl-chip').textContent = U.num(r.level);
    if (r.bossActive) {
      const b = r.bosses.find(x => x.active);
      if (b) this.$('bossfill').style.transform = 'scaleX(' + U.clamp(b.hp / b.maxHp, 0, 1) + ')';
      else this.hideBossBar();
    }
    // أغطية التبريد في فتحات الأسلحة
    for (const w of r.weapons) {
      const el = this.$('slot-cd-' + w.id);
      if (el && w.def.kind !== 'orbit') el.style.height = U.clamp(w.timer / Combat.weaponCd(w), 0, 1) * 100 + '%';
      const sl = this.$('slot-' + w.id); if (sl) sl.classList.toggle('ready', w.def.kind === 'orbit' || w.timer <= 0.12);
    }
  },
  refreshSlots() {
    const r = Game.run, box = this.$('slots');
    box.innerHTML = '';
    if (!r) return;
    for (const w of r.weapons) {
      const d = document.createElement('div');
      d.className = 'slot'; d.id = 'slot-' + w.id;
      d.style.borderColor = w.def.color; d.style.color = w.def.color;
      d.title = (I18N.lang() === 'ar' ? w.def.ar : w.def.en);
      d.innerHTML = '<span>' + (I18N.lang() === 'ar' ? w.def.ar : w.def.en).charAt(0) + '</span><div class="cd" id="slot-cd-' + w.id + '" style="height:0"></div><span class="lv">' + U.num(w.lv) + '</span>';
      box.appendChild(d);
    }
    const comp = Data.comp(r.companion);
    if (comp.kind !== 'none') {
      const d = document.createElement('div');
      d.className = 'slot'; d.style.borderColor = comp.color; d.style.color = comp.color;
      d.title = (I18N.lang() === 'ar' ? comp.ar : comp.en);
      d.innerHTML = '<span>' + (I18N.lang() === 'ar' ? comp.ar : comp.en).charAt(0) + '</span>';
      box.appendChild(d);
    }
  },
  showBossBar(def) { this.$('bossbar').classList.remove('hidden'); this.$('bossname').textContent = I18N.lang() === 'ar' ? def.ar : def.en; },
  hideBossBar() { this.$('bossbar').classList.add('hidden'); },

  // ─── قائمة المراحل ───
  buildStages() {
    const box = this.$('stage-list'); box.innerHTML = '';
    Data.STAGES.forEach((st, i) => {
      const unlocked = Meta.unlockedStages.includes(st.id);
      const el = document.createElement('div');
      el.className = 'stage-card' + (unlocked ? '' : ' locked') + (Meta.selectedStage === st.id ? ' sel' : '');
      el.innerHTML = '<div class="bgp" style="background:linear-gradient(150deg,' + st.tiles[0] + ',' + st.bg + ')"></div>' +
        '<div class="card-name" style="color:' + st.accent + '">' + (I18N.lang() === 'ar' ? st.ar : st.en) + '</div>' +
        '<div class="dim" style="font-size:.85em">' + (I18N.lang() === 'ar' ? st.descAr : st.descEn) + '</div>' +
        '<div class="stat-line"><span>' + t('danger') + ' ' + '★'.repeat(i + 1) + '</span><span>' + t('bestTime') + ': ' + U.time(Meta.stats.bestTime) + '</span></div>' +
        (unlocked ? '' : '<div class="dim" style="margin-top:6px;font-size:.8em">✖ ' + t('unlockBy') + '</div>');
      el.onclick = () => {
        if (!unlocked) { Audio.sfx('banish'); return; }
        Meta.selectedStage = st.id; Save.mark(); Audio.sfx('click');
        this.buildChars(); this.buildCompRow(); this.showScreen('screen-chars');
      };
      box.appendChild(el);
    });
  },

  // ─── قائمة الشخصيات ───
  buildChars() {
    const box = this.$('char-grid'); box.innerHTML = '';
    Data.CHARACTERS.forEach(c => {
      const unlocked = Meta.unlockedChars.includes(c.id);
      const el = document.createElement('div');
      el.className = 'char-card' + (unlocked ? '' : ' locked') + (Meta.selectedChar === c.id ? ' sel' : '');
      let unlockLine = '';
      if (!unlocked) {
        if (c.unlock.type === 'gold') unlockLine = '<button class="btn gold" style="min-height:32px;font-size:.8em;margin-top:6px">' + tf('unlockGold', c.unlock.cost) + '</button>';
        else if (c.unlock.type === 'shards') unlockLine = '<button class="btn" style="min-height:32px;font-size:.8em;margin-top:6px;border-color:var(--acc2)">' + tf('unlockShards', c.unlock.cost) + '</button>';
        else { const a = Data.achievement(c.unlock.ach); unlockLine = '<div class="dim" style="font-size:.78em;margin-top:6px">' + (a ? (I18N.lang() === 'ar' ? a.dar : a.den) : '') + '</div>'; }
      }
      const w = Data.weapon(c.weapon);
      el.innerHTML = '<div class="row"><div style="width:26px;height:26px;border-radius:50%;background:' + c.color + ';box-shadow:0 0 10px ' + c.color + '"></div><div class="card-name">' + (I18N.lang() === 'ar' ? c.ar : c.en) + '</div></div>' +
        '<div class="stat-line"><span>' + t('startWeapon') + '</span><b style="color:' + w.color + '">' + (I18N.lang() === 'ar' ? w.ar : w.en) + '</b></div>' +
        '<div class="stat-line"><span>' + t('perk') + '</span><b>' + (I18N.lang() === 'ar' ? c.perkAr : c.perkEn) + '</b></div>' +
        '<div class="stat-line"><span>HP</span><b>' + U.num(c.hp) + '</b></div>' + unlockLine;
      el.onclick = (ev) => {
        if (unlocked) { Meta.selectedChar = c.id; Save.mark(); Audio.sfx('click'); this.buildChars(); return; }
        // الشراء/الفتح
        if (c.unlock.type === 'gold') {
          if (Meta.gold >= c.unlock.cost) { Meta.gold -= c.unlock.cost; Meta.unlockedChars.push(c.id); Save.mark(); Audio.sfx('unlock'); this.toast(t('charUnlocked') + ': ' + (I18N.lang() === 'ar' ? c.ar : c.en), 'gold'); this.refreshMenuCurrency(); this.buildChars(); Ach.check(); }
          else { this.toast(t('notEnoughGold'), 'bad'); Audio.sfx('banish'); }
        } else if (c.unlock.type === 'shards') {
          if (Meta.shards >= c.unlock.cost) { Meta.shards -= c.unlock.cost; Meta.unlockedChars.push(c.id); Save.mark(); Audio.sfx('unlock'); this.toast(t('charUnlocked') + ': ' + (I18N.lang() === 'ar' ? c.ar : c.en), 'gold'); this.refreshMenuCurrency(); this.buildChars(); }
          else { this.toast(t('notEnough'), 'bad'); Audio.sfx('banish'); }
        }
      };
      box.appendChild(el);
    });
  },
  buildCompRow() {
    const box = this.$('comp-row'); box.innerHTML = '';
    Data.COMPANIONS.forEach(cp => {
      // يُفتح المرافق بإكمال المرحلة ذات الرقم unlockStage في الترتيب
      let unlocked = cp.unlockStage < 1;
      if (!unlocked) {
        const st = Data.STAGES[cp.unlockStage - 1];
        unlocked = st ? (Meta.stats.stageClears[st.id] || 0) >= 1 : false;
      }
      const el = document.createElement('div');
      el.className = 'chip' + (unlocked ? '' : ' locked');
      el.style.cursor = 'pointer';
      el.style.borderColor = Meta.selectedComp === cp.id ? cp.color : '';
      el.innerHTML = '<i class="dot" style="background:' + (unlocked ? cp.color : '#333') + '"></i>' + (I18N.lang() === 'ar' ? cp.ar : cp.en) + (unlocked ? '' : ' ✖');
      el.onclick = () => {
        if (!unlocked) { Audio.sfx('banish'); return; }
        Meta.selectedComp = cp.id; Save.mark(); Audio.sfx('click'); this.buildCompRow();
      };
      box.appendChild(el);
    });
  },

  // ─── شاشة المعدّلات ───
  buildMods() {
    this.modsSel = new Set(); this.weeklyOn = false;
    const box = this.$('mods-list'); box.innerHTML = '';
    // تحدي الأسبوع: معدلات مقعّدة من تاريخ الأسبوع
    const wkBtn = document.createElement('div');
    wkBtn.className = 'mod-row'; wkBtn.id = 'mod-weekly';
    wkBtn.innerHTML = '<div style="flex:1"><b style="color:var(--acc2)">' + t('weekly') + '</b><div class="dim" style="font-size:.8em">' + t('weeklyBanner') + '</div></div><div class="switch"></div>';
    wkBtn.onclick = () => { this.weeklyOn = !this.weeklyOn; wkBtn.querySelector('.switch').classList.toggle('on', this.weeklyOn); this.applyWeekly(); this.updateModsMult(); Audio.sfx('click'); };
    box.appendChild(wkBtn);
    Data.MODIFIERS.forEach(m => {
      const el = document.createElement('div');
      el.className = 'mod-row'; el.id = 'mod-' + m.id;
      el.innerHTML = '<div style="flex:1">' + (I18N.lang() === 'ar' ? m.ar : m.en) + '</div><span class="tag gold-txt">×' + m.mult.toFixed(2) + '</span><div class="switch"></div>';
      el.onclick = () => {
        if (this.weeklyOn) return;
        el.classList.toggle('on');
        el.querySelector('.switch').classList.toggle('on', el.classList.contains('on'));
        if (el.classList.contains('on')) this.modsSel.add(m.id); else this.modsSel.delete(m.id);
        this.updateModsMult(); Audio.sfx('click');
      };
      box.appendChild(el);
    });
    this.updateModsMult();
  },
  applyWeekly() {
    const rng = U.mulberry32(U.hash32(Chal.weekKey()) ^ 0x9E3779B9);
    const ids = Data.MODIFIERS.map(m => m.id);
    const forced = new Set();
    for (let i = 0; i < 3; i++) forced.add(ids[Math.floor(rng() * ids.length)]);
    Data.MODIFIERS.forEach(m => {
      const el = this.$('mod-' + m.id); if (!el) return;
      const on = this.weeklyOn ? forced.has(m.id) : this.modsSel.has(m.id);
      el.classList.toggle('on', on);
      el.querySelector('.switch').classList.toggle('on', on);
      el.style.opacity = this.weeklyOn && !on ? 0.4 : 1;
    });
    if (this.weeklyOn) { this.modsSel = forced; this.$('weekly-banner').classList.remove('hidden'); this.$('weekly-banner').textContent = t('weeklyBanner'); }
    else this.$('weekly-banner').classList.add('hidden');
  },
  updateModsMult() {
    let mult = 1;
    this.modsSel.forEach(id => { const m = Data.mod(id); if (m) mult *= m.mult; });
    if (this.weeklyOn) mult *= 1.5;
    this.$('mods-mult').textContent = '×' + mult.toFixed(2);
  }
};
/* ══════════════════════ UI/ — النوافذ والقوائم المتقدمة ══════════════════════ */
// ─── شاشة الترقية: Banish / Skip / Lock ───
UI.openLevelup = function (regen) {
  const r = Game.run;
  if (!r) return;
  Game.setState('levelup');
  this._luOpts = Prog.generateOptions();
  this._luSel = this._luOpts[0] || null;
  const box = this.$('lu-cards'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  this._luOpts.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'lu-card' + (opt.kind === 'evo' ? ' evo' : '');
    let kind = '', name = Prog.optName(opt), desc = '', color = '#7ee8fa';
    if (opt.kind === 'evo') {
      kind = t('kindEvo'); color = '#f5c542';
      const ev = Data.EVOLVED[Data.EVO_MAP[opt.id].evo];
      desc = ar ? ev.descAr : ev.descEn;
    } else if (opt.kind === 'new') {
      kind = t('kindNew');
      const d = Data.weapon(opt.id);
      color = d.color;
      desc = (ar ? Data.SCHOOLS[d.school].ar : Data.SCHOOLS[d.school].en) + ' • ' + U.num(d.dmg) + (ar ? ' ضرر' : ' dmg') + ' • ' + (ar ? 'تبريد ' : 'cd ') + U.numF(d.cd) + 's';
    } else if (opt.kind === 'up') {
      kind = t('kindUp'); color = opt.w.def.color;
      desc = (ar ? 'المستوى ' : 'Level ') + U.num(opt.w.lv) + ' → ' + U.num(opt.w.lv + 1) + ' • +' + U.num(13) + '%' + (ar ? ' ضرر' : ' dmg');
      if (opt.w.lv + 1 === 3 || opt.w.lv + 1 === 6) desc += ' • +' + U.num(1) + (ar ? ' مقذوف' : ' proj');
    } else if (opt.kind === 'p') {
      kind = t('kindPassive');
      const P = Data.passive(opt.id);
      color = '#b06cff';
      desc = (ar ? P.arD : P.enD) + ' (' + U.num(r.passives[opt.id] || 0) + '/' + U.num(P.max) + ')';
    } else if (opt.kind === 'gold') { kind = t('kindGold'); color = '#f5c542'; desc = '+' + U.num(opt.val) + ' ' + t('goldEarned'); }
    card.innerHTML = '<div class="kind" style="color:' + color + '">' + kind + '</div>' +
      '<div class="nm">' + name + '</div><div class="ds">' + desc + '</div>' +
      '<div class="pip-row">' + (opt.kind === 'up' || opt.kind === 'p' ? '' : '') + '</div>' +
      '<div class="pin" title="Lock">' + (r.lockedId === opt.kind + ':' + opt.id ? '◈' : '◇') + '</div>';
    card.onclick = () => { Audio.sfx('click'); Prog.choose(opt); };
    card.querySelector('.pin').onclick = (ev) => { ev.stopPropagation(); Prog.lock(opt); };
    box.appendChild(card);
  });
  // حالة النَّفْي
  const bb = this.$('lu-banish');
  bb.disabled = r.banishCharge <= 0;
  this.$('lu-charge').textContent = r.banishCharge > 0 ? '✦ ' + t('banish') : t('banishHint');
  this.showScreen('screen-levelup');
};
UI.closeLevelup = function () { this.showScreen(null); Game.setState('playing'); };

// ─── نافذة الصندوق ───
UI.showChest = function (rewards) {
  const box = this.$('chest-body'); box.innerHTML = '';
  rewards.forEach(rw => {
    const el = document.createElement('div');
    el.className = 'codex-card'; el.style.textAlign = 'center';
    const ar = I18N.lang() === 'ar';
    const nm = rw.kind === 'gold' ? '+' + U.num(rw.val || 0) + ' ' + (ar ? 'ذهب' : 'Gold') : (ar ? rw.ar : rw.en);
    el.innerHTML = '<div class="nm" style="color:var(--gold);font-size:1.15em">' + nm + '</div>' + (rw.sub ? '<div class="ds">' + rw.sub + '</div>' : '');
    box.appendChild(el);
  });
  this.showScreen('screen-chest');
};

// ─── ملخص الجولة ───
UI.showSummary = function (d) {
  const ar = I18N.lang() === 'ar';
  this.$('sum-title').textContent = d.win ? (d.stage ? t('stageCleared') : t('victory')) : t('defeat');
  this.$('sum-title').style.color = d.win ? 'var(--gold)' : 'var(--hp)';
  const cells = [
    [t('time'), U.time(d.time)], [t('kills'), U.num(d.kills)], [t('level'), U.num(d.level)],
    [t('goldEarned'), U.num(d.gold)], [t('shardsEarned'), U.num(d.shards)], [t('score'), U.num(d.score)]
  ];
  this.$('sum-stats').innerHTML = cells.map(c => '<div class="sum-cell"><div class="v">' + c[1] + '</div><div class="k">' + c[0] + '</div></div>').join('');
  const extra = [];
  if (d.newRecord) extra.push('<div class="toast gold" style="position:static">' + t('newRecord') + '</div>');
  (d.achNew || []).forEach(nm => extra.push('<div class="ach done"><div class="ic">✦</div><div class="info"><b>' + nm + '</b></div></div>'));
  this.$('sum-ach').innerHTML = extra.join('');
  this.showScreen('screen-summary');
};

// ─── الإعدادات ───
UI._settingsBound = false;
UI.bindSettings = function () {
  const S = Meta.settings, $ = (id) => this.$(id);
  $('set-sfx').value = Math.round(S.sfx * 100); $('set-music').value = Math.round(S.music * 100);
  $('set-scale').value = Math.round(S.uiScale * 100); $('set-dz').value = Math.round(S.deadzone * 100);
  const sw = (id, on) => $(id).classList.toggle('on', !!on);
  sw('set-perf', S.perf); sw('set-fps', S.fps); sw('set-hapt', S.haptics); sw('set-shake', S.shake); sw('set-aim', S.autoaim); sw('set-bat', S.batterySaver);
  $('fps').classList.toggle('hidden', !S.fps);
  if (this._settingsBound) return;
  this._settingsBound = true;
  $('set-sfx').oninput = (e) => { S.sfx = e.target.value / 100; Audio.setVolumes(); Save.mark(); };
  $('set-music').oninput = (e) => { S.music = e.target.value / 100; Audio.setVolumes(); Save.mark(); };
  $('set-scale').oninput = (e) => { S.uiScale = e.target.value / 100; document.documentElement.style.setProperty('--ui', S.uiScale); Save.mark(); };
  $('set-dz').oninput = (e) => { S.deadzone = e.target.value / 100; Save.mark(); };
  const mkSwitch = (id, key, fn) => {
    $(id).onclick = () => {
      S[key] = !S[key]; $(id).classList.toggle('on', S[key]); Save.mark(); Audio.sfx('click');
      if (fn) fn();
    };
  };
  mkSwitch('set-perf', 'perf', () => { Render.resize(); });
  mkSwitch('set-fps', 'fps', () => { $('fps').classList.toggle('hidden', !S.fps); });
  mkSwitch('set-hapt', 'haptics'); mkSwitch('set-shake', 'shake');
  mkSwitch('set-aim', 'autoaim'); mkSwitch('set-bat', 'batterySaver');
  // تصدير/استيراد/مسح
  $('btn-export').onclick = () => {
    try {
      const blob = new Blob([Save.exportSave()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'arcane-save.json'; a.click();
      this.toast(t('exported'), 'gold');
    } catch (e) { this.toast(t('importFailed'), 'bad'); }
  };
  $('file-import').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      if (Save.importSave(String(rd.result))) { this.toast(t('imported'), 'gold'); setTimeout(() => location.reload(), 600); }
      else this.toast(t('importFailed'), 'bad');
    };
    rd.readAsText(f);
  };
  $('btn-reset').onclick = () => this.confirm(t('confirmReset'), async () => { await Save.wipe(); location.reload(); });
  document.documentElement.style.setProperty('--ui', S.uiScale);
};

// ─── الموسوعة ───
UI.buildCodex = function () {
  const box = this.$('codex-grid'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar', tab = this._codexTab;
  let items = [], found = (id) => false, total = 0, cnt = 0;
  if (tab === 'enemies') { items = Object.entries(Data.ENEMIES); found = id => Meta.stats.enemiesSeen[id]; total = items.length; }
  else if (tab === 'bosses') { items = Object.entries(Data.BOSSES); found = id => (Meta.stats.bossKinds || {})[id]; total = items.length; }
  else if (tab === 'weapons') { items = Data.WEAPONS.map(w => [w.id, w]).concat(Object.entries(Data.EVOLVED).map(([id, e]) => [id, Object.assign({ ar: e.ar, en: e.en, school: e.school }, e)])); found = id => Meta.stats.weaponsFound[id]; total = items.length; }
  else { items = Data.ARTIFACTS.map(a => [a.id, a]); found = id => Meta.stats.artifactsFound[id]; total = items.length; }
  items.forEach(([id, it]) => {
    const ok = !!found(id); if (ok) cnt++;
    const el = document.createElement('div');
    el.className = 'codex-card' + (ok ? '' : ' lock');
    const col = it.school ? (Data.SCHOOLS[it.school] ? Data.SCHOOLS[it.school].color : it.color) : (it.color || '#8b93ad');
    let sub = '';
    if (ok && tab === 'artifacts') sub = AD(id)[ar ? 'ar' : 'en'].split(': ')[1] || '';
    else if (ok && (tab === 'enemies' || tab === 'bosses')) sub = 'HP ' + U.num(it.hp) + ' • ' + (ar ? 'ضرر' : 'dmg') + ' ' + U.num(it.dmg || 0);
    else if (ok) sub = (it.school ? (ar ? Data.SCHOOLS[it.school].ar : Data.SCHOOLS[it.school].en) : '');
    el.innerHTML = '<div class="nm" style="color:' + (ok ? col : '#5a6280') + '">' + (ok ? (ar ? it.ar : it.en) : t('codexLocked')) + '</div><div class="ds">' + (ok ? sub : t('undiscovered')) + '</div>';
    box.appendChild(el);
  });
  let chip = this.$('codex-count');
  if (!chip) { chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'codex-count'; document.querySelector('#screen-codex .scr-head').appendChild(chip); }
  chip.textContent = tf('discovered', cnt) + ' / ' + U.num(total);
};

// ─── الإنجازات ───
UI.buildAch = function () {
  const box = this.$('ach-list'); box.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  let done = 0;
  Data.ACHIEVEMENTS.forEach(a => {
    const st = Meta.achievements[a.id] || { p: 0, done: false };
    if (st.done) done++;
    const p = Math.min(a.target, a.get(Meta) || 0);
    const el = document.createElement('div');
    el.className = 'ach' + (st.done ? ' done' : '');
    el.innerHTML = '<div class="ic">' + a.icon + '</div><div class="info"><div class="row" style="justify-content:space-between"><b>' + (ar ? a.dar : a.den) + '</b><span class="dim" style="font-size:.8em">' + U.num(p) + '/' + U.num(a.target) + '</span></div><div class="pbar"><div style="width:' + (p / a.target * 100) + '%"></div></div></div>';
    box.appendChild(el);
  });
  this.$('ach-summary').textContent = tf('achSummary', done) + ' / ' + U.num(Data.ACHIEVEMENTS.length);
};

// ─── التحديات ───
UI.buildChal = function () {
  const ar = I18N.lang() === 'ar';
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
  this.$('chal-reset').textContent = t('dailyReset') + ' — ' + t('weeklyReset');
};

// ─── السجل ولوحة الصدارة ───
UI.buildHist = function () {
  const ar = I18N.lang() === 'ar';
  const rh = this.$('hist-list'); rh.innerHTML = '';
  if (!Meta.history.length) rh.innerHTML = '<div class="dim">' + t('noRuns') + '</div>';
  Meta.history.forEach(h => {
    const el = document.createElement('div');
    el.className = 'ach' + (h.win ? ' done' : '');
    const ch = Data.char(h.char), st = Data.stage(h.stage);
    el.innerHTML = '<div class="ic">' + (h.win ? '♛' : '☠') + '</div><div class="info"><div class="row" style="justify-content:space-between"><b>' + (ar ? ch.ar : ch.en) + ' — ' + (ar ? st.ar : st.en) + '</b><span class="dim">' + new Date(h.d).toLocaleDateString() + '</span></div><div class="dim" style="font-size:.82em">' + t('time') + ' ' + U.time(h.time) + ' • ' + t('kills') + ' ' + U.num(h.kills) + ' • ' + t('level') + ' ' + U.num(h.level) + ' • ' + t('score') + ' ' + U.num(h.score) + '</div></div>';
    rh.appendChild(el);
  });
  const lb = this.$('lb-list'); lb.innerHTML = '';
  if (!Meta.leaderboard.length) lb.innerHTML = '<div class="dim">' + t('noLb') + '</div>';
  Meta.leaderboard.forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'ach';
    const ch = Data.char(h.char), st = Data.stage(h.stage);
    el.innerHTML = '<div class="ic">' + U.num(i + 1) + '</div><div class="info"><div class="row" style="justify-content:space-between"><b>' + (ar ? ch.ar : ch.en) + ' • ' + (ar ? st.ar : st.en) + '</b><span class="gold-txt">' + U.num(h.score) + '</span></div><div class="dim" style="font-size:.82em">' + U.time(h.time) + ' • ' + t('kills') + ' ' + U.num(h.kills) + '</div></div>';
    lb.appendChild(el);
  });
};

// ─── المواهب ───
UI._talentChar = null;
UI.buildTalents = function () {
  const tabs = this.$('talent-chars'); tabs.innerHTML = '';
  const ar = I18N.lang() === 'ar';
  if (!this._talentChar || !Meta.unlockedChars.includes(this._talentChar)) this._talentChar = Meta.unlockedChars[0] || 'arcane';
  Data.CHARACTERS.forEach(c => {
    if (!Meta.unlockedChars.includes(c.id)) return;
    const b = document.createElement('button');
    b.className = 'tab' + (this._talentChar === c.id ? ' on' : '');
    b.textContent = ar ? c.ar : c.en;
    b.style.color = this._talentChar === c.id ? c.color : '';
    b.onclick = () => { this._talentChar = c.id; this.buildTalents(); Audio.sfx('click'); };
    tabs.appendChild(b);
  });
  const tree = this.$('talent-tree'); tree.innerHTML = '';
  const cid = this._talentChar;
  if (!Meta.talents[cid]) Meta.talents[cid] = { power: 0, speed: 0, wisdom: 0 };
  Data.TALENT_BRANCHES.forEach(br => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const title = document.createElement('div');
    title.className = 'scr-title'; title.style.cssText = 'font-size:1em;color:' + br.color + ';text-align:center';
    title.textContent = ar ? br.ar : br.en;
    col.appendChild(title);
    const lvl = Meta.talents[cid][br.id] || 0;
    br.nodes.forEach((n, i) => {
      const node = document.createElement('div');
      const owned = i < lvl, next = i === lvl;
      node.className = 'talent-node' + (owned ? ' max' : '');
      node.innerHTML = '<div style="font-size:.85em;font-weight:800">' + (ar ? n.ar : n.en) + '</div>' +
        '<div class="pip-row" style="justify-content:center">' + br.nodes.map((_, j) => '<div class="pip' + (j < lvl ? ' on' : '') + '" style="background:' + (j < lvl ? br.color : '') + '"></div>').join('') + '</div>' +
        (next ? '<button class="btn gold" style="min-height:30px;font-size:.8em;margin-top:6px;width:100%">' + t('talentBuy') + ' — ' + U.num(Data.talentCost(lvl)) + '</button>' : (owned ? '<div class="dim" style="font-size:.75em">✓</div>' : '<div class="dim" style="font-size:.75em">—</div>'));
      if (next) node.querySelector('button').onclick = () => {
        const cost = Data.talentCost(Meta.talents[cid][br.id] || 0);
        if (Meta.gold >= cost) {
          Meta.gold -= cost; Meta.talents[cid][br.id] = lvl + 1;
          Meta.stats.talentsBought++;
          Save.mark(); Audio.sfx('unlock'); this.refreshMenuCurrency(); this.buildTalents(); Ach.check();
        } else { this.toast(t('notEnoughGold'), 'bad'); Audio.sfx('banish'); }
      };
      col.appendChild(node);
    });
    tree.appendChild(col);
  });
  this.refreshMenuCurrency();
};

// ─── لوحة التصحيح ───
UI.toggleDebug = function () {
  this.debugOpen = !this.debugOpen;
  this.$('debug-panel').classList.toggle('hidden', !this.debugOpen);
};
UI.updateDebug = function () {
  if (!this.debugOpen) return;
  const r = Game.run, L = Core.Loop;
  let s = 'AS2 DEBUG — fps:' + L.fps + ' state:' + Game.state + '\n';
  if (r) {
    s += 'time:' + U.time(r.time) + ' lvl:' + r.level + ' kills:' + r.kills + ' adapt:' + r.adapt.toFixed(2) + '\n';
    s += 'enemies:' + Core.pools.enemies.count() + ' proj:' + Core.pools.proj.count() + ' parts:' + Core.pools.parts.count() + ' orbs:' + Core.pools.orbs.count() + '\n';
    s += 'pos:' + Math.round(r.player.x) + ',' + Math.round(r.player.y) + ' seed:' + r.seed + '\n';
    s += 'hp:' + Math.ceil(r.player.hp) + '/' + r.stats.maxHp + ' dmg:' + r.stats.dmg.toFixed(2) + ' cdR:' + r.stats.cdRed.toFixed(2) + '\n';
    s += 'hooks:' + Object.keys(r.hooks).join(',') + '\n';
    s += 'syn:' + Object.keys(r.syn).filter(k => k !== 'steamT').join(',');
  } else s += 'no run';
  s += '\n--- log ---\n' + Log.buf.slice(-8).map(l => l.k + ': ' + l.m).join('\n');
  this.$('debug-panel').textContent = s;
};

// ─── وضع التصوير وبطاقة المشاركة ───
UI.captureBase = function () {
  const cv = document.createElement('canvas');
  cv.width = 1000; cv.height = 620;
  const g = cv.getContext('2d');
  const src = Render.cv;
  // اقتصاد لقطة اللعبة بنسبة العرض
  const scale = Math.max(1000 / src.width, 540 / src.height);
  const sw = 1000 / scale, sh = 540 / scale;
  const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
  g.drawImage(src, sx, sy, sw, sh, 0, 0, 1000, 540);
  return { cv, g };
};
UI.photo = function () {
  try {
    const r = Game.run; if (!r) return;
    const { cv, g } = this.captureBase();
    g.fillStyle = 'rgba(8,10,22,0.88)'; g.fillRect(0, 540, 1000, 80);
    g.fillStyle = '#7ee8fa'; g.font = '800 22px Tajawal, Inter, sans-serif'; g.textAlign = 'left';
    const ar = I18N.lang() === 'ar'; g.direction = ar ? 'rtl' : 'ltr';
    const line = (ar ? r.stage.ar : r.stage.en) + ' • ' + U.time(r.time) + ' • ' + t('kills') + ' ' + U.num(r.kills) + ' • ' + t('lvl') + ' ' + U.num(r.level);
    g.fillText(line, 20, 588);
    g.fillStyle = '#f5c542'; g.font = '700 16px Tajawal, Inter, sans-serif';
    g.fillText('ARCANE SURVIVOR 2.0', 20, 612);
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png'); a.download = 'arcane-photo.png'; a.click();
    this.toast(t('photoSaved'));
    this.haptic(20);
  } catch (e) { Log.warn('photo failed', e.message); }
};
UI.shareCard = function () {
  try {
    const r = Game._lastSummary || Game.run; if (!r) return;
    const ar = I18N.lang() === 'ar';
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 560;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 1000, 560);
    grad.addColorStop(0, '#141a36'); grad.addColorStop(1, '#0a0c14');
    g.fillStyle = grad; g.fillRect(0, 0, 1000, 560);
    g.strokeStyle = '#2a3352'; g.lineWidth = 3; g.strokeRect(14, 14, 972, 532);
    g.textAlign = 'center'; g.fillStyle = '#7ee8fa'; g.font = '900 44px Tajawal, Inter, sans-serif';
    g.fillText('ARCANE SURVIVOR 2.0', 500, 84);
    const ch = Data.char(r.charId), st = Data.stage(r.stageId);
    g.fillStyle = ch.color; g.font = '800 30px Tajawal, Inter, sans-serif';
    g.fillText((ar ? ch.ar : ch.en) + ' — ' + (ar ? st.ar : st.en), 500, 140);
    g.fillStyle = r.win ? '#f5c542' : '#ff5964';
    g.font = '900 54px Tajawal, Inter, sans-serif';
    g.fillText(r.win ? t('victory') : U.time(r.time), 500, 230);
    const stats = [[t('time'), U.time(r.time)], [t('kills'), U.num(r.kills)], [t('level'), U.num(r.level)], [t('goldEarned'), U.num(r.goldRun !== undefined ? r.goldRun : r.gold)], [t('shardsEarned'), U.num(r.shards)], [t('score'), U.num(r.score)]];
    stats.forEach((s2, i) => {
      const x = 180 + (i % 3) * 320, y = 320 + Math.floor(i / 3) * 110;
      g.fillStyle = '#e8ecf8'; g.font = '900 40px Tajawal, Inter, sans-serif'; g.fillText(String(s2[1]), x, y);
      g.fillStyle = '#8b93ad'; g.font = '600 20px Tajawal, Inter, sans-serif'; g.fillText(s2[0], x, y + 32);
    });
    g.fillStyle = '#5a6280'; g.font = '600 16px Tajawal, Inter, sans-serif';
    g.fillText('single-file web roguelite', 500, 534);
    const send = (blob) => {
      const file = new File([blob], 'arcane-run.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Arcane Survivor 2.0' }).catch(() => { });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'arcane-run.png'; a.click();
        this.toast(t('shareSaved'));
      }
    };
    cv.toBlob((b) => { if (b) send(b); });
    this.haptic(20);
  } catch (e) { Log.warn('share failed', e.message); }
};
/* ══════════════════════ Game/ — آلة الحالة والحلقة والإقلاع ══════════════════════ */
const Game = AS.Game = {
  state: 'boot', run: null, _hudT: 0, _installEvt: null, _lastSetup: null, _lastSummary: null, _achSnap: null,

  setState(s) {
    this.state = s;
    const hud = document.getElementById('hud'), touch = document.getElementById('touch-ui');
    const inRun = ['playing', 'paused', 'levelup', 'chest'].includes(s);
    hud.classList.toggle('hidden', !inRun);
    const touchMode = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    touch.classList.toggle('hidden', !(s === 'playing' && touchMode));
    if (s === 'menu') UI.showScreen('screen-menu');
  },
  shake(mag, dur) { Render.shake(mag, dur); },

  // ─── بدء جولة جديدة ───
  startRun(mods, weekly) {
    Audio.init(); Audio.resume();
    const r = Combat.newRun(Meta.selectedChar, Meta.selectedStage, mods, weekly);
    this.run = r; this._lastSetup = { mods: mods || [], weekly: !!weekly };
    this._achSnap = new Set(Object.keys(Meta.achievements).filter(k => Meta.achievements[k].done));
    Core.resetPools();
    Render.chunks.clear(); Render.genParallax(r.stage);
    Render.cam = { x: 0, y: 0 };
    Waves.marks = [];
    UI.refreshSlots(); UI.showScreen(null);
    this.setState('playing');
    Audio.setStage(r.stage);
    UI.toast(t('howto'));
    Save.mark();
    Log.log('Run started', r.charId, r.stageId, 'seed', r.seed);
  },
  retryRun() { const L = this._lastSetup || { mods: [], weekly: false }; this.startRun(L.mods, L.weekly); },

  // ─── الخطوة الثابتة 60Hz: ترتيب الأنظمة محدد بعناية ───
  fixedUpdate(dt) {
    Save.tick(dt);
    if (this.state !== 'playing' || !this.run) return;
    const r = this.run;
    r.time += dt;
    Core.snapshot();
    Combat.rebuildHash();
    Waves.update(dt);
    Combat.updatePlayer(dt);
    Combat.updateEnemies(dt);
    Combat.updateProjectiles(dt);
    Combat.updateEProjectiles(dt);
    Combat.updateOrbs(dt);
    Combat.updateCompanion(dt);
    Combat.updateWeapons(dt);
    Combat.updateSynergies(dt);
    Audio.setMood(U.clamp(Core.pools.enemies.count() / 120, 0, 1), r.bossActive, r.player.hp / r.stats.maxHp);
    this._hudT += dt;
    if (this._hudT >= 0.1) { this._hudT = 0; UI.updateHUD(); UI.updateDebug(); }
  },

  togglePause() {
    if (this.state === 'playing') { this.setState('paused'); UI.showScreen('screen-pause'); Audio.sfx('click'); }
    else if (this.state === 'paused') { this.setState('playing'); UI.showScreen(null); Audio.sfx('click'); }
  },

  // ─── موت الزعيم: مكافآت ونهاية المرحلة ───
  onBossKilled(boss) {
    const r = this.run;
    r.bossesKilled++; r.challengeProg.boss++;
    Meta.stats.bosses++;
    if (!Meta.stats.bossKinds) Meta.stats.bossKinds = {};
    Meta.stats.bossKinds[boss.bossId || r.stage.boss] = true;
    UI.hideBossBar();
    this.shake(16, 0.7); Audio.sfx('bossdie'); UI.haptic([80, 40, 120]);
    Render.fxExplosion(boss.x, boss.y, 220, boss.def.color);
    Prog.spawnOrb(boss.x, boss.y, 1, 'shard');
    Prog.dropChest(boss.x + 30, boss.y);
    Save.mark();
    if (!r.bosses.some(b => b.active)) {
      r.bossActive = false;
      setTimeout(() => { if (Game.state === 'playing') this.endRun(true); }, 900);
    }
  },

  // ─── نهاية الجولة: مكافآت دائمة + سجل + ملخص ───
  endRun(win, abandoned) {
    if (this.state === 'over' || !this.run) return;
    const r = this.run;
    this.setState('over');
    let mult = 1;
    Object.keys(r.mods).forEach(id => { const m = Data.mod(id); if (m) mult *= m.mult; });
    if (r.weekly) mult *= 1.5;
    // المكافآت الدائمة (ذهب الجولة + مكافأة الفوز، كله بمضاعف المعدّلات)
    const goldFinal = Math.max(0, Math.round((r.goldRun + (win ? 150 + r.stageIdx * 80 : 0)) * mult));
    Meta.gold += goldFinal;
    const shardEarn = r.shards + (win ? 1 + r.stageIdx : (r.bossesKilled > 0 ? 1 : 0));
    Meta.shards += shardEarn;
    // الإحصاءات الدائمة
    const M = Meta.stats;
    M.runs++; M.kills += r.kills; M.totalGold += Math.max(0, goldFinal);
    M.playTime += r.time;
    M.bestTime = Math.max(M.bestTime, r.time);
    M.maxKillsRun = Math.max(M.maxKillsRun, r.kills);
    if (win) {
      M.victories++;
      M.stageClears[r.stageId] = (M.stageClears[r.stageId] || 0) + 1;
      const idx = Data.STAGES.indexOf(r.stage);
      const next = Data.STAGES[idx + 1];
      if (next && !Meta.unlockedStages.includes(next.id)) {
        Meta.unlockedStages.push(next.id);
        UI.toast(t('stageUnlocked') + ': ' + (I18N.lang() === 'ar' ? next.ar : next.en), 'gold');
      }
    } else M.deaths++;
    // النتيجة والسجل
    const score = r.kills * 10 + r.level * 120 + Math.floor(r.time) * 3 + r.goldRun + r.bossesKilled * 500 + (win ? 2000 : 0);
    const newRecord = score > (M.bestScore || 0);
    if (newRecord) M.bestScore = score;
    Meta.history.unshift({ d: Date.now(), char: r.charId, stage: r.stageId, time: r.time, kills: r.kills, level: r.level, score, win });
    if (Meta.history.length > 50) Meta.history.length = 50;
    Meta.leaderboard.push({ score, char: r.charId, stage: r.stageId, time: r.time, kills: r.kills, win });
    Meta.leaderboard.sort((a, b) => b.score - a.score);
    if (Meta.leaderboard.length > 20) Meta.leaderboard.length = 20;
    Chal.mergeRun(r);
    UI.hideBossBar();
    Save.mark(); Save.flush();
    Ach.check();
    // إنجازات مكتملة خلال هذه الجولة
    const achNew = [];
    for (const a of Data.ACHIEVEMENTS) {
      const st = Meta.achievements[a.id];
      if (st && st.done && this._achSnap && !this._achSnap.has(a.id)) achNew.push(I18N.lang() === 'ar' ? a.dar : a.den);
    }
    Audio.sfx(win ? 'win' : 'lose');
    this._lastSummary = { charId: r.charId, stageId: r.stageId, time: r.time, kills: r.kills, level: r.level, goldRun: Math.max(0, goldFinal), shards: shardEarn, score, win, stage: win };
    UI.showSummary({ win, stage: win, time: r.time, kills: r.kills, level: r.level, gold: Math.max(0, goldFinal), shards: shardEarn, score, newRecord, achNew });
    Log.log('Run ended', win ? 'victory' : 'defeat', 'score', score);
  },

  // ─── PWA: manifest ديناميكي + Service Worker بأفضل جهد ───
  initPWA() {
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
        name: 'Arcane Survivor 2.0', short_name: 'ArcaneS2', start_url: location.href.split('#')[0], scope: './',
        display: 'standalone', orientation: 'any', background_color: '#0a0c14', theme_color: '#0a0c14',
        icons: [{ src: icon.toDataURL('image/png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
      };
      document.getElementById('manifest-link').href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
    } catch (e) { Log.warn('manifest failed', e.message); }
    // ملاحظة: تسجيل SW من ملف واحد ممكن فقط عبر استضافة HTTP؛ المحاولة آمنة وتُتجاهل عند الفشل
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      try {
        const swCode = "self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.open('as2-v1').then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n&&n.ok)c.put(e.request,n.clone());return n;})).catch(()=>fetch(e.request))))});";
        const url = URL.createObjectURL(new Blob([swCode], { type: 'text/javascript' }));
        navigator.serviceWorker.register(url).catch(() => { });
      } catch (e) { }
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); this._installEvt = e;
      document.getElementById('btn-install').classList.remove('hidden');
    });
  },

  // ─── توفير البطارية التلقائي ───
  initBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then((b) => {
      const check = () => {
        if (b.level < 0.2 && !b.charging && !Meta.settings.perf && Meta.settings.batterySaver) {
          Meta.settings.perf = true; Render.resize(); Save.mark();
          UI.toast(t('batteryOn'), 'bad');
        }
      };
      b.addEventListener('levelchange', check);
      b.addEventListener('chargingchange', check);
      check();
    }).catch(() => { });
  },

  // ─── الإقلاع ───
  async boot() {
    Log.log('Booting Arcane Survivor 2.0 v' + AS.V);
    Render.init();
    await Save.load();
    UI.init();
    document.documentElement.style.setProperty('--ui', Meta.settings.uiScale);
    Input.init();
    this.initPWA();
    this.initBattery();
    Bus.on('pauseToggle', () => this.togglePause());
    // اختيار الترقية بلوحة المفاتيح 1-4
    window.addEventListener('keydown', (e) => {
      if (this.state === 'levelup' && e.key >= '1' && e.key <= '4') {
        const o = UI._luOpts[+e.key - 1]; if (o) Prog.choose(o);
      }
    });
    // إيقاف تلقائي عند مغادرة التبويب
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });
    // حفظ عند الإغلاق
    window.addEventListener('pagehide', () => { Save.mark(); Save.flush(); });
    this.setState('menu');
    Core.Loop.start();
    const bt = document.getElementById('boot');
    bt.style.transition = 'opacity .4s'; bt.style.opacity = '0';
    setTimeout(() => bt.remove(), 450);
    Log.log('Ready. Achievements:', Data.ACHIEVEMENTS.length, 'Weapons:', Data.WEAPONS.length, 'Artifacts:', Data.ARTIFACTS.length);
  }
};

// ─── نقطة الانطلاق ───
Game.boot();
/* ═══════════ v2.1 — I18N: معاملات، جمع، تواريخ، أرقام، كاش كانفس، فحص التكافؤ ═══════════ */
(function () {
  // نصوص الواجهة الجديدة تُدمج في القاموسين معًا من قائمة واحدة ← تكافؤ مضمون 100%
  const STR = [
    // الوصف الرسمي (يُستخدم في شاشة البداية وPWA)
    ['game_tagline', 'انجُ من جحافل الظلام، وطوّر سحرك حتى تصبح أسطورة.', 'Survive endless hordes, evolve your magic, become the legend.'],
    ['game_description', 'لعبة بقاء سريعة الإيقاع تمزج بين السحر والتطوّر اللانهائي.\nاجمع الأسلحة، افتح التآزرات، واسحق جيوش الظلام قبل أن تسحقك.', 'A fast-paced roguelite blending arcane magic and endless evolution.\nCollect weapons, unlock synergies, and crush the dark hordes before they crush you.'],
    // المتجر والخزانة
    ['shop', 'المتجر', 'Shop'], ['wardrobe', 'الخزانة', 'Wardrobe'],
    ['permTitle', 'الترقيات الدائمة', 'Permanent Upgrades'],
    ['permDesc', 'ترقيات تُشترى بالذهب وتبقى معك إلى الأبد في كل الجولات.', 'Gold-purchased upgrades that stay with you forever across all runs.'],
    ['equip', 'ارتدِ', 'Equip'], ['equipped', 'مُرتدى', 'Equipped'], ['owned', 'مملوك', 'Owned'],
    ['skinsTab', 'الأزياء', 'Skins'], ['trailsTab', 'آثار الأقدام', 'Footprint Trails'], ['colorsTab', 'ألوان السحر', 'Spell Colors'],
    ['drawback', 'الكلفة', 'Drawback'], ['perks2', 'الصفات', 'Perks'],
    // موسوعة
    ['elementsTab', 'العناصر', 'Elements'], ['fragmentsTab', 'القطع القديمة', 'Ancient Fragments'], ['codexFamiliars', 'المرافقون', 'Familiars'],
    ['mastery', 'الإتقان', 'Mastery'], ['masteryLvl', 'إتقان {n}', 'Mastery {n}'],
    ['weakTo', 'ضعف', 'Weak to'], ['resistsTo', 'يقاوم', 'Resists'], ['elemHint', 'كل عدو ضعيف أمام عنصر ويقاوم آخر — الإتقان يمنح ضررًا إضافيًا.', 'Every enemy is weak to one element and resists another — mastery grants bonus damage.'],
    ['fragmentLore', 'الأسطورة', 'Lore'], ['fragHint', 'تسقط من النخبة والزعماء الصغار والزعماء الكبار.', 'Dropped by elites, mini-bosses and bosses.'],
    // التحديات الموسمية
    ['monthly', 'الموسمية', 'Monthly'], ['monthlyReset', 'تتجدد التحديات الموسمية أول كل شهر', 'Seasonal challenges reset on the 1st of each month'],
    ['weeklyCount', 'اختر تحديين أسبوعيين', 'Two weekly challenges'],
    // الندرة واللعنات
    ['rarityRare', 'نادر', 'Rare'], ['rarityEpic', 'ملحمي', 'Epic'], ['rarityLeg', 'أسطوري', 'Legendary'], ['rarityCommon', 'عادي', 'Common'],
    ['curseWarn', 'ملعونة!', 'Cursed!'], ['cursedOwned', 'قطع ملعونة', 'Cursed artifacts'],
    // الزعماء الصغار
    ['miniBoss', 'زعيم صغير', 'Mini-Boss'], ['miniIncoming', 'زعيم صغير يقترب!', 'A mini-boss approaches!'],
    // القطع القديمة والإتقان
    ['fragmentFound', 'قطعة قديمة!', 'Ancient fragment!'],
    // الحالات الجديدة (تظهر في الموسوعة وأعلى الأعداء)
    ['stBleed', 'نزيف', 'Bleed'], ['stBlind', 'عمى', 'Blind'], ['stCharm', 'سحر', 'Charm'], ['stConfuse', 'تشويش', 'Confuse'],
    ['stFear', 'رعب', 'Fear'], ['stSilence', 'إسكات', 'Silence'], ['stWeaken', 'إضعاف', 'Weaken'],
    ['stVulnerable', 'هشاشة', 'Vulnerable'], ['stCurse', 'لعنة', 'Curse'], ['stBless', 'بركة', 'Bless'], ['stStun', 'تشنج', 'Stun'],
    // فئات الإنجازات
    ['achAll', 'الكل', 'All'],
    ['catSurvival', 'الصمود', 'Survival'], ['catKills', 'القتل', 'Kills'], ['catLevels', 'المستويات', 'Levels'],
    ['catBosses', 'الزعماء', 'Bosses'], ['catStreaks', 'السلاسل', 'Streaks'], ['catHealth', 'الصحة', 'Health'],
    ['catSpells', 'الأسلحة', 'Spells'], ['catSyn', 'التآزرات', 'Synergies'], ['catArtifacts', 'الآثار', 'Artifacts'],
    ['catGold', 'الذهب', 'Gold'], ['catClasses', 'الأبطال', 'Classes'], ['catDifficulty', 'الصعوبة', 'Difficulty'],
    ['catSecret', 'سرية', 'Secret'], ['secretHint', 'إنجاز سري — اكتشفه بنفسك', 'Secret achievement — discover it yourself'],
    // ملخص الجولة الموسّع
    ['casts', 'الإلقاءات', 'Casts'], ['dashes', 'الاندفاعات', 'Dashes'], ['dmgDealt', 'الضرر', 'Damage'],
    ['minisKilled', 'زعماء صغار', 'Mini-Bosses'], ['fragsRun', 'قطع قديمة', 'Fragments'],
    // عناصر التقدّم في المتجر
    ['permLvl', 'المستوى', 'Level'], ['maxed2', 'مكتمل', 'MAX'],
    // لوحة التصحيح
    ['dbgLangOk', 'القاموسان متكافئان تمامًا ✓', 'Dictionaries fully in sync ✓'],
    ['dbgLangMissing', 'مفاتيح ناقصة', 'Missing keys'],
    // صيَغ الجمع (tn)
    ['kills_count_zero', 'لا قتلات', 'no kills'],
    ['kills_count_one', 'قتلة واحدة', '1 kill'],
    ['kills_count_two', 'قتلتان', '2 kills'],
    ['kills_count_few', '{n} قتلات', '{n} kills'],
    ['kills_count_many', '{n} قتلة', '{n} kills'],
    ['kills_count_other', '{n} قتلة', '{n} kills'],
    ['minute_count_one', 'دقيقة واحدة', '1 minute'],
    ['minute_count_two', 'دقيقتان', '2 minutes'],
    ['minute_count_few', '{n} دقائق', '{n} minutes'],
    ['minute_count_many', '{n} دقيقة', '{n} minutes'],
    ['minute_count_other', '{n} دقيقة', '{n} minutes'],
    ['shard_count_one', 'شظية واحدة', '1 shard'],
    ['shard_count_two', 'شظيتان', '2 shards'],
    ['shard_count_few', '{n} شظايا', '{n} shards'],
    ['shard_count_many', '{n} شظية', '{n} shards'],
    ['shard_count_other', '{n} شظية', '{n} shards']
  ];
  for (const s of STR) { I18N.dict.ar[s[0]] = s[1]; I18N.dict.en[s[0]] = s[2]; }

  // ─── t(key, params): دعم المتغيرات {n} {s}… ───
  const _t = I18N.t.bind(I18N);
  I18N.t = function (key, params) {
    let s = _t(key);
    if (params) for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
    return s;
  };

  // ─── tn(key, count): صيَغ الجمع عربي (صفر/واحد/اثنان/قليل/كثير) وإنجليزي (one/other) ───
  I18N.tn = function (key, count) {
    const L = this._lang, d = this.dict[L] || {}, de = this.dict.en;
    let form;
    if (L === 'ar') form = count === 0 ? 'zero' : count === 1 ? 'one' : count === 2 ? 'two' : (count >= 3 && count <= 10) ? 'few' : 'many';
    else form = count === 1 ? 'one' : 'other';
    const kf = key + '_' + form;
    let s;
    if (d[kf] !== undefined) s = d[kf];
    else if (de[kf] !== undefined) s = de[kf];
    else if (d[key] !== undefined) s = d[key];
    else if (de[key] !== undefined) s = de[key];
    else s = key;
    return String(s).split('{n}').join(U.num(count));
  };

  // ─── td(date): عربي = ميلادي + هجري + وقت 24h | إنجليزي = ISO + وقت 12h ───
  I18N.td = function (d, opts) {
    opts = opts || {};
    try {
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return '';
      if (this._lang === 'ar') {
        let out;
        try { out = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); }
        catch (e) { out = dt.toLocaleDateString('ar-EG'); }
        try { out += ' — ' + new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt); } catch (e) { }
        if (opts.time !== false) {
          try { out += ' • ' + new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false }).format(dt); } catch (e) { }
        }
        return out;
      }
      const iso = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      if (opts.time === false) return iso;
      let time;
      try { time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(dt); }
      catch (e) { time = dt.getHours() + ':' + String(dt.getMinutes()).padStart(2, '0'); }
      return iso + ' ' + time;
    } catch (e) { return String(d); }
  };

  // ─── tn2(num): تنسيق الأرقام حسب اللغة (٠١٢٣ / 0123) ───
  I18N.tn2 = function (n) { return U.num(n); };

  // ─── كاش نصوص الكانفس: لا تُبنى السلاسل كل إطار ───
  I18N._cc = {};
  I18N.ct = function (key) {
    let v = this._cc[key];
    if (v === undefined) { v = this.t(key); this._cc[key] = v; }
    return v;
  };

  // ─── فحص التكافؤ: مفاتيح موجودة بقاموس وناقصة بالآخر ───
  I18N.check = function () {
    const ar = this.dict.ar, en = this.dict.en;
    return {
      arOnly: Object.keys(ar).filter(k => en[k] === undefined),
      enOnly: Object.keys(en).filter(k => ar[k] === undefined),
      ok() { return this.arOnly.length === 0 && this.enOnly.length === 0; }
    };
  };

  // ─── apply يدعم data-i18n (إضافة إلى data-i القديم) ───
  const _apply = I18N.apply.bind(I18N);
  I18N.apply = function (root) {
    _apply(root);
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n'), v = this.t(k);
      if (v.indexOf('\n') >= 0) el.style.whiteSpace = 'pre-line';
      el.textContent = v;
    });
  };

  // ─── عند تبديل اللغة: تفريغ كاش الكانفس + إعادة بناء الشاشة المفتوحة فورًا ───
  const _setLang = I18N.setLang.bind(I18N);
  I18N.setLang = function (l) {
    I18N._cc = {};
    _setLang(l);
    try { Meta.lang = l; Save.mark(); } catch (e) { }
    if (typeof UI !== 'undefined' && UI.refreshScreen) UI.refreshScreen();
  };
  AS.I18N = I18N;
})();
/* ═══════════ v2.1 — Data: المرحلة السادسة + العناصر + الحالات + المتجر + القطع القديمة + الكوزمتك ═══════════ */

// ─── المرحلة السادسة: قصر السماء ───
Data.STAGES.push({
  id: 'sky', ar: 'قصر السماء', en: 'Sky Palace', descAr: 'أبراج عائمة فوق عاصفة أبدية', descEn: 'Floating towers above an eternal storm',
  bg: '#0c1020', tiles: ['#1a2138', '#212a48'], speck: ['#33406b', '#131a30'], decor: '#cfe0ff', accent: '#ffe95c',
  ambient: 'rgba(8,12,28,0.42)', enemyTint: '#dfe8ff',
  enemies: ['skyKnight', 'stormHarpy', 'cloudSage', 'gargoyle', 'skyGolem'], boss: 'skyEmpress',
  music: { root: 131, scale: [0, 2, 4, 7, 9], bpm: 112 }
});

// ─── نظام العناصر العشرة: لكل عدو ضعف ومقاومة، وللاعب إتقان يتنامى ───
Data.ELEMENTS = [
  { id: 'fire', icon: '🔥', color: '#ff7b3a', ar: 'النار', en: 'Fire', dar: 'ذاوب واحرق كل ما يقف في طريقك؛ الجمر يلاحق الهاربين.', den: 'Melt and burn everything in your path; embers hunt the fleeing.' },
  { id: 'ice', icon: '❄', color: '#9fd8ff', ar: 'الثلج', en: 'Ice', dar: 'جمّد الخصوم مكانيًا ثم حطّمهم ألف شظية.', den: 'Freeze foes solid, then shatter them to splinters.' },
  { id: 'lightning', icon: '⚡', color: '#ffe95c', ar: 'البرق', en: 'Lightning', dar: 'أقواس سريعة تقفز بين الأجساد القريبة.', den: 'Swift arcs that leap between clustered bodies.' },
  { id: 'poison', icon: '☠', color: '#8be84a', ar: 'السم', en: 'Poison', dar: 'سموم تُنهك الأعداء ببطء لا يملكون معه دوا.', den: 'Toxins that wither enemies beyond remedy.' },
  { id: 'dark', icon: '🌑', color: '#a67aff', ar: 'الظلام', en: 'Dark', dar: 'اسحب الأرواح من الجياش وأطعمها الظلام.', den: 'Drain the living of their souls and feed the dark.' },
  { id: 'light', icon: '✨', color: '#fff3b0', ar: 'النور', en: 'Holy', dar: 'نور يطهّر كل ظلمة ويحمي المؤمن به.', den: 'Radiance that purges shadow and shields its bearer.' },
  { id: 'arcane', icon: '◈', color: '#7ee8fa', ar: 'الأركان', en: 'Arcane', dar: 'سحر خالص لا يرحم ولا يعرف التوقف.', den: 'Pure magic that neither pities nor pauses.' },
  { id: 'nature', icon: '🌿', color: '#7be07b', ar: 'الطبيعة', en: 'Nature', dar: 'الأرض نفسها تنهض وتقاتل إلى جانبك.', den: 'The wild itself rises to fight beside you.' },
  { id: 'chaos', icon: '🎲', color: '#ff6ea8', ar: 'الفوضى', en: 'Chaos', dar: 'عشوائية مذهلة… لا تعرف ماذا ستفعل قبل أن تفعلَه.', den: 'Spectacularly unpredictable — even to itself.' },
  { id: 'void', icon: '◉', color: '#b06cff', ar: 'الفراغ', en: 'Void', dar: 'ما تلتهمه الفراغ لا يعود أبدًا.', den: 'What the Void consumes never returns.' }
];
Data.element = (id) => Data.ELEMENTS.find(e => e.id === id);
// درجة إتقان اللاعب بعنصر ما من إجمالي الضرر المسدد به
Data.masteryLvl = (dmg) => Math.floor(Math.sqrt(Math.max(0, dmg || 0) / 1500));

// ─── الحالات الخمس عشرة (للموسوعة والأيقونات) ───
Data.STATUS_INFO = [
  { id: 'freeze', icon: '❄', color: '#9fd8ff', ar: 'التجميد', en: 'Freeze', dar: 'يوقف العدو تامًا؛ الضربات البرقية تحطّمه (تكسير).', den: 'Halts the enemy; lightning hits shatter it.' },
  { id: 'burn', icon: '🔥', color: '#ff8a3a', ar: 'الإشعال', en: 'Burn', dar: 'ضرر ناري مستمر يذوب في اللحم.', den: 'Continuous fire damage searing the flesh.' },
  { id: 'poison', icon: '☠', color: '#8be84a', ar: 'التسمم', en: 'Poison', dar: 'ضرر متزايد يتسرب مع الزمن.', den: 'Lingering damage that seeps over time.' },
  { id: 'shock', icon: '⚡', color: '#ffe95c', ar: 'التصعيق', en: 'Shock', dar: 'يزيد الضرر المتلقى +15% ويشل أحيانًا.', den: 'Takes +15% damage and sometimes paralyzes.' },
  { id: 'slow', icon: '🐌', color: '#9fd8ff', ar: 'الإبطاء', en: 'Slow', dar: 'خفض سرعة الحركة 28%.', den: 'Reduces movement speed by 28%.' },
  { id: 'bleed', icon: '🩸', color: '#ff5c7a', ar: 'النزيف', en: 'Bleed', dar: 'نزيف يشتد كلما تحرك المصاب.', den: 'Worsens as the victim moves.' },
  { id: 'blind', icon: '👁', color: '#c9d4e8', ar: 'العمى', en: 'Blind', dar: 'نصف هجمات المصاب تُخطئ هدفها.', den: 'Half of the victim attacks miss.' },
  { id: 'charm', icon: '💗', color: '#ff8ad8', ar: 'السحر', en: 'Charm', dar: 'يقلب العدو لصفّك مؤقتًا فيقاتل رفاقه.', den: 'Turns the enemy ally to fight its own kind.' },
  { id: 'confuse', icon: '🌀', color: '#c99aff', ar: 'التشويش', en: 'Confuse', dar: 'يتوهج المصاب ويجري عشوائيًا.', den: 'The victim staggers in random directions.' },
  { id: 'fear', icon: '😱', color: '#b06cff', ar: 'الرعب', en: 'Fear', dar: 'يهرب المصاب منك بكل ما أوتي.', den: 'The victim flees from you in terror.' },
  { id: 'silence', icon: '✖', color: '#8b93ad', ar: 'الإسكات', en: 'Silence', dar: 'يمنع الهجمات الخاصة للمصاب.', den: 'Blocks the victim special attacks.' },
  { id: 'weaken', icon: '⬇', color: '#8b93ad', ar: 'الإضعاف', en: 'Weaken', dar: 'يخفض ضرر المصاب 25%.', den: 'Victim deals 25% less damage.' },
  { id: 'vulnerable', icon: '🎯', color: '#ff9a5c', ar: 'الهشاشة', en: 'Vulnerable', dar: 'يتلقى المصاب ضررًا زائدًا 25%.', den: 'Victim takes 25% extra damage.' },
  { id: 'curse', icon: '🕯', color: '#a67aff', ar: 'اللعنة', en: 'Curse', dar: 'على العدو: +10% ضرر متلقى. على اللاعب: +15% ضرر.', den: 'On enemies: +10% damage taken. On you: +15% damage taken.' },
  { id: 'bless', icon: '🕊', color: '#fff3b0', ar: 'البركة', en: 'Bless', dar: 'تجدد +2/ث وصدّ لضربة قادمة.', den: '+2 regen/s and blocks one incoming hit.' }
];

// ─── المتجر: 25 ترقية دائمة (11 أساس + 14 جديدة) تُشترى بالذهب ───
Data.PERM_UPGRADES = [
  { id: 'hp', k: 'hp', per: 12, cost: 110, max: 5, ar: 'الحياة القصوى', en: 'Max HP', dar: '+12 صحة قصوى لكل مستوى', den: '+12 max HP per level' },
  { id: 'dmg', k: 'dmg', per: 0.03, cost: 140, max: 5, ar: 'القوة الغامرة', en: 'Raw Power', dar: '+3% ضرر لكل مستوى', den: '+3% damage per level' },
  { id: 'haste', k: 'cdRed', per: 0.025, cost: 150, max: 5, ar: 'سرعة الإلقاء', en: 'Cast Speed', dar: '-2.5% تبريد لكل مستوى', den: '-2.5% cooldowns per level' },
  { id: 'ms', k: 'ms', per: 0.025, cost: 120, max: 5, ar: 'خفة القدم', en: 'Fleet Foot', dar: '+2.5% حركة لكل مستوى', den: '+2.5% move speed per level' },
  { id: 'armor', k: 'armor', per: 1.5, cost: 160, max: 5, ar: 'الجِلد المتين', en: 'Tough Hide', dar: '+1.5 درع لكل مستوى', den: '+1.5 armor per level' },
  { id: 'regen', k: 'regen', per: 0.3, cost: 150, max: 5, ar: 'التجدد', en: 'Regeneration', dar: '+0.3 تجدد/ث لكل مستوى', den: '+0.3 regen/s per level' },
  { id: 'crit', k: 'crit', per: 0.02, cost: 180, max: 5, ar: 'الدقة القاتلة', en: 'Lethal Precision', dar: '+2% حرجة لكل مستوى', den: '+2% crit per level' },
  { id: 'xp', k: 'xp', per: 0.04, cost: 130, max: 5, ar: 'شغف التعلم', en: 'Thirst for Knowledge', dar: '+4% خبرة لكل مستوى', den: '+4% XP per level' },
  { id: 'luck', k: 'luck', per: 0.04, cost: 160, max: 5, ar: 'نجوم الحظ', en: 'Lucky Stars', dar: '+4% حظ لكل مستوى', den: '+4% luck per level' },
  { id: 'pickup', k: 'pickup', per: 0.08, cost: 110, max: 5, ar: 'الجاذب الأرضي', en: 'Magnetism', dar: '+8% مدى الالتقاط لكل مستوى', den: '+8% pickup range per level' },
  { id: 'dash', k: 'dashCd', per: 0.04, cost: 140, max: 5, ar: 'اندفاعات متتابعة', en: 'Rapid Dashes', dar: '-4% تبريد الاندفاع لكل مستوى', den: '-4% dash cooldown per level' },
  // — الأربعة عشر الجديدة —
  { id: 'lifesteal', k: 'lifesteal', per: 0.004, cost: 280, max: 5, ar: 'امتصاص الحياة', en: 'Lifesteal', dar: '+0.4% من الضرر يتحول صحة لكل مستوى', den: 'Heal for 0.4% of damage per level' },
  { id: 'thorns', k: 'thorns', per: 3, cost: 220, max: 5, ar: 'الدرع الشوكي', en: 'Thorns', dar: 'يعكس +3 ضرر لكل مستوى', den: 'Reflect +3 damage per level' },
  { id: 'manaflow', k: 'cdRed', per: 0.008, cost: 240, max: 5, ar: 'تدفق المانا', en: 'Mana Flow', dar: '-0.8% تبريد إضافي لكل مستوى', den: '-0.8% extra cooldown reduction per level' },
  { id: 'dodge', k: 'dodge', per: 0.015, cost: 260, max: 5, ar: 'المراوغة', en: 'Dodge', dar: '+1.5% فرصة مراوغة لكل مستوى', den: '+1.5% dodge chance per level' },
  { id: 'block', k: 'block', per: 0.02, cost: 260, max: 5, ar: 'الصدّ', en: 'Block', dar: '+2% فرصة صد الضربة لكل مستوى', den: '+2% block chance per level' },
  { id: 'elemres', k: 'elemResist', per: 0.03, cost: 240, max: 5, ar: 'مقاومة العناصر', en: 'Elemental Resist', dar: '-3% من الضرر العنصري لكل مستوى', den: '-3% elemental damage per level' },
  { id: 'projspeed', k: 'projSpeed', per: 0.04, cost: 180, max: 5, ar: 'سرعة المقذوفات', en: 'Projectile Speed', dar: '+4% سرعة مقذوفات لكل مستوى', den: '+4% projectile speed per level' },
  { id: 'area', k: 'area', per: 0.03, cost: 200, max: 5, ar: 'اتساع التأثير', en: 'Area Size', dar: '+3% مساحة لكل مستوى', den: '+3% area per level' },
  { id: 'duration', k: 'duration', per: 0.05, cost: 220, max: 5, ar: 'مدة التأثير', en: 'Duration', dar: '+5% عمر الحقول والبرك لكل مستوى', den: '+5% field duration per level' },
  { id: 'critdmg', k: 'critDmg', per: 0.06, cost: 240, max: 5, ar: 'الضرر الحرج', en: 'Crit Damage', dar: '+6% ضرر حرج لكل مستوى', den: '+6% crit damage per level' },
  { id: 'execute', k: 'exec', per: 0.02, cost: 300, max: 5, ar: 'عتبة الإعدام', en: 'Execute Threshold', dar: '+2% ضرر إضافي للمرتحقين بالموت لكل مستوى', den: '+2% dmg to low-HP foes per level' },
  { id: 'secondwind', k: 'secondWind', per: 1, cost: 2800, max: 1, ar: 'نَفَس أخير', en: 'Second Wind', dar: 'مرة بالجولة: تنجو من الموت بـ30% صحة', den: 'Once per run: survive death at 30% HP' },
  { id: 'goldfinder', k: 'goldFind', per: 0.06, cost: 200, max: 5, ar: 'باحث الذهب', en: 'Gold Finder', dar: '+6% فرصة إسقاط ذهب لكل مستوى', den: '+6% gold drop chance per level' },
  { id: 'xphunter', k: 'xpHunt', per: 0.05, cost: 210, max: 5, ar: 'صياد الخبرة', en: 'XP Hunter', dar: '+5% خبرة من القتلات لكل مستوى', den: '+5% XP from kills per level' }
];
Data.permCost = (p, lv) => Math.round((p.cost || 100) * Math.pow(1.65, lv || 0));
Data.perm = (id) => Data.PERM_UPGRADES.find(p => p.id === id);

// ─── 30 قطعة قديمة: تُجمع من النخبة والزعماء وتُقرأ في الموسوعة ───
Data.FRAGMENTS = [
  { id: 'f1', st: 'crypt', ar: 'رقعة الجرة الأولى', en: 'First Urn Shard', dar: '«حفرنا قبورنا بأيدينا قبل أن يموت اللهب.»', den: '"We dug our graves with our own hands, before the flames came."' },
  { id: 'f2', st: 'crypt', ar: 'فانون الكاهن الأعمى', en: 'Blind Priest Scroll', dar: '«الملك العظام لم يكن ملكًا يومًا؛ كان واعظًا نسي أن يموت.»', den: '"The Bone King was never a king. He was a priest who forgot to die."' },
  { id: 'f3', st: 'crypt', ar: 'نقش على نعش زجاجي', en: 'Glass Sarcophagus Etching', dar: '«من ينام تحت المقبرة يحلم بأصدقاء لم يلتقِهم بعد.»', den: '"He who sleeps beneath the crypt dreams of friends not yet met."' },
  { id: 'f4', st: 'crypt', ar: 'جرس قبر مشقق', en: 'Cracked Grave Bell', dar: '«رنّ الجرس مرتين: مرة للحياة، ومرة للعودة.»', den: 'Ring the bell twice: once for life, once for the return.' },
  { id: 'f5', st: 'crypt', ar: 'شهادة دفن معدنية', en: 'Burial Plaque', dar: '«هنا يرقد من هزم الموت، ثم هزمه الموت.»', den: '"Here lies the one who defeated death. Then death defeated him."' },
  { id: 'f6', st: 'ice', ar: 'حلية جليدية مشفورة', en: 'Frozen Cipher Amulet', dar: '«الجبل يراقب. الجبل ينتظر. الجبل لا يرحم.»', den: 'The mountain watches. The mountain waits. The mountain shows no mercy.' },
  { id: 'f7', st: 'ice', ar: 'شهادة حارس الجليد', en: 'Warden Oathstone', dar: '«تعهدنا بحراسة البرد حتى يعود الشتاء الأخير.»', den: '"We swore to guard the cold until the last winter returns."' },
  { id: 'f8', st: 'ice', ar: 'خرائط مبتلعة', en: 'Swallowed Maps', dar: '«الخرائط تكذب؛ الكهف يرسم نفسه من جديد كل ليلة.»', den: 'The maps lie. The cave redraws itself every night.' },
  { id: 'f9', st: 'ice', ar: 'قلب تنين متجمد', en: 'Frozen Wyrm Heart', dar: '«ما زال ينبض. لا تسأل كيف.»', den: 'It still beats. Do not ask how.' },
  { id: 'f10', st: 'ice', ar: 'رسالة أخيرة من المستكشف', en: "Explorer's Last Letter", dar: '«إذا وجدت هذا فأنا حي، لكن الدفء هنا فخّ أشد من البرد.»', den: 'If you find this, I am alive. But warmth here is a crueler trap than frost.' },
  { id: 'f11', st: 'desert', ar: 'لوح فرعوني متآكل', en: 'Eroded Pharaoh Tablet', dar: '«بنينا أعمدة الرمل لتخفي ما لا يُرى.»', den: 'We raised pillars of sand to hide what must not be seen.' },
  { id: 'f12', st: 'desert', ar: 'زجاجة عاصفة مختومة', en: 'Sealed Storm Vial', dar: '«لا تفتحها أبدًا؛ الجن الذي بداخلها أعرف اسمك الآن.»', den: 'Never open it. The djinn inside knows your name now.' },
  { id: 'f13', st: 'desert', ar: 'عملة من مملكة غارقة', en: 'Sunken Kingdom Coin', dar: '«وجهها لقائد جيش لا تذكر السجلات اسمه.»', den: 'Its face bears a general the records refuse to name.' },
  { id: 'f14', st: 'desert', ar: 'جدول مواعيد النجوم', en: 'Star Ledger', dar: '«النجوم تخطئ أحيانًا؛ والصحراء تصحح خطأها بالدم.»', den: 'The stars are sometimes wrong; the desert corrects them in blood.' },
  { id: 'f15', st: 'desert', ar: 'خرطوش عملاق مكسور', en: 'Shattered Colossus Cartouche', dar: '«استيقظ العملاق ذات فجر، ورأى ما بناه البشر فأعاد النوم.»', den: 'The colossus woke one dawn, saw what men had built, and chose to sleep again.' },
  { id: 'f16', st: 'flame', ar: 'لوح تعاهد ناري', en: 'Ember Covenant Slab', dar: '«قدمنا قلوبنا لللهب، فمنحنا ألسنة من نار.»', den: 'We offered our hearts to the flame; it gave us tongues of fire.' },
  { id: 'f17', st: 'flame', ar: 'ريشة العنقاء المحترقة', en: 'Scorched Phoenix Feather', dar: '«تحترق لتولد؛ نحن نحترق فقط.»', den: 'It burns to be reborn. We simply burn.' },
  { id: 'f18', st: 'flame', ar: 'دفتر كاهن المعبد', en: 'Temple Priest Journal', dar: '«اليوم أخمدنا الشعلة الكبرى بالدماء. غدًا نفتحها بدمائنا.»', den: 'Today we smothered the Great Flame with blood. Tomorrow we feed it ours.' },
  { id: 'f19', st: 'flame', ar: 'جمر يحفظ صوتًا', en: 'Voice-Holding Ember', dar: '«أقربه من أذنك تسمع نعيًا عمره ألف عام.»', den: 'Hold it to your ear: a thousand-year-old lament still sings.' },
  { id: 'f20', st: 'flame', ar: 'ختم سيد العنقاء', en: "Phoenix Lord's Seal", dar: '«من يحمل الختم لا يموت؛ لكنه يتوقف عن العيش.»', den: 'Whoever bears the seal cannot die — but stops living.' },
  { id: 'f21', st: 'void', ar: 'مرآة لا تعكس', en: 'Reflectless Mirror', dar: '«نظرت إلى المرآة فرأت من خلفك.»', den: 'I stared into the mirror and saw what stood behind me.' },
  { id: 'f22', st: 'void', ar: 'بذرة نجمة ميتة', en: 'Dead Star Seed', dar: '«ازرعها وسيغطس العالم في ليلة بلا فجر.»', den: 'Plant it, and the world sinks into a dawnless night.' },
  { id: 'f23', st: 'void', ar: 'صفحة ممزقة من كتاب الفراغ', en: 'Void Tome Torn Page', dar: '«الكلمة الثامنة لا تُكتب؛ من كتبها أُتبعها عن الوجود.»', den: 'The eighth word must never be written. Those who wrote it were unwritten.' },
  { id: 'f24', st: 'void', ar: 'عين محنطة تتابعك', en: 'Watchful Stuffed Eye', dar: '«تنتظر أن تنام. لا تنم أبدًا هنا.»', den: 'It waits for you to sleep. Never sleep here.' },
  { id: 'f25', st: 'void', ar: 'ساعة تدع للخلف', en: 'Backwards Clock', dar: '«تشير إلى اللحظة التي ستفقد فيها كل شيء.»', den: 'It points to the moment you lose everything.' },
  { id: 'f26', st: 'sky', ar: 'ريشة هاربية ذهبية', en: 'Golden Harpy Plume', dar: '«القصر يطفو بغناء الطيور؛ إن توقف الغناء…»', den: 'The palace floats on the birds song. If the singing stops…' },
  { id: 'f27', st: 'sky', ar: 'دفتر أوامر الإمبراطورة', en: "Empress' Order Book", dar: '«أمرت بسحب السماء عن العالم كي لا يجد أعداؤها سماءً يعودون إليها.»', den: 'She ordered the sky withdrawn, so her enemies would have no sky to return to.' },
  { id: 'f28', st: 'sky', ar: 'جرس برونزي بلا باب', en: 'Doorless Bronze Bell', dar: '«يقرع وحده كلما سقط حارس من الأبراج.»', den: 'It rings by itself whenever a tower guard falls.' },
  { id: 'f29', st: 'sky', ar: 'خريطة سُحب مقعّرة', en: 'Convex Cloud Map', dar: '«المسافة هنا لا تُقاس بالأميال بل بالأغاني.»', den: 'Distance here is not measured in miles, but in songs.' },
  { id: 'f30', st: 'sky', ar: 'تاج الصواعق الأصغر', en: 'Lesser Crown of Storms', dar: '«تاج أصغر لرأس أكبر؛ أعداء الإمبراطورة يزنون طنًا من برق.»', den: 'A smaller crown for a bigger head. The Empress enemies weigh a ton of lightning.' }
];
Data.fragment = (id) => Data.FRAGMENTS.find(f => f.id === id);

// ─── الكوزمتك: 40 سكين + 20 أثر أقدام + 15 لون سحر ───
Data.SKINS = [
  { id: 'sk_arcane_1', ch: 'arcane', ar: 'أركان الكلاسيكي', en: 'Classic Arcane', body: '#7ee8fa', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_arcane_2', ch: 'arcane', ar: 'عالم النجوم', en: 'Star Scholar', body: '#8fd4ff', cloak: '#1a2c5c', cost: 600, cur: 'gold' },
  { id: 'sk_arcane_3', ch: 'arcane', ar: 'حارس الأبعاد', en: 'Dimension Warden', body: '#5ee0e8', cloak: '#0a3040', cost: 2200, cur: 'gold' },
  { id: 'sk_pyra_1', ch: 'pyra', ar: 'لهيب كلاسيكي', en: 'Classic Blaze', body: '#ff7b3a', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_pyra_2', ch: 'pyra', ar: 'قلب البركان', en: 'Volcano Heart', body: '#ff5c1a', cloak: '#3a1008', cost: 600, cur: 'gold' },
  { id: 'sk_pyra_3', ch: 'pyra', ar: 'عنقاء غاضبة', en: 'Wrathful Phoenix', body: '#ffb05c', cloak: '#5c1a08', cost: 2600, cur: 'gold', leg: true },
  { id: 'sk_frost_1', ch: 'frost', ar: 'سيدة الصقيع', en: 'Classic Frost', body: '#9fd8ff', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_frost_2', ch: 'frost', ar: 'ملكة الشتاء', en: 'Winter Queen', body: '#c8ecff', cloak: '#16324c', cost: 700, cur: 'gold' },
  { id: 'sk_frost_3', ch: 'frost', ar: 'الصفر المطلق', en: 'Absolute Zero', body: '#e8fbff', cloak: '#0a1e30', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_storm_1', ch: 'storm', ar: 'منادي العواصف', en: 'Classic Stormcaller', body: '#ffe95c', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_storm_2', ch: 'storm', ar: 'ابن الرعد', en: 'Thunderborn', body: '#fff3a0', cloak: '#2c2c10', cost: 700, cur: 'gold' },
  { id: 'sk_storm_3', ch: 'storm', ar: 'تاج العاصفة', en: 'Tempest Crown', body: '#fdfd96', cloak: '#404014', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_shadow_1', ch: 'shadow', ar: 'نصل الظل', en: 'Classic Shadow', body: '#a67aff', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_shadow_2', ch: 'shadow', ar: 'قاتل الفجر', en: 'Dusk Stalker', body: '#8a5cff', cloak: '#140a2c', cost: 700, cur: 'gold' },
  { id: 'sk_shadow_3', ch: 'shadow', ar: 'حاصد الأرواح', en: 'Soul Reaper', body: '#c9b8ff', cloak: '#1c0a3c', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_druid_1', ch: 'druid', ar: 'سيد الوحوش', en: 'Classic Beastlord', body: '#7be07b', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_druid_2', ch: 'druid', ar: 'زهرة الغابة', en: 'Forest Bloom', body: '#a8e88a', cloak: '#12320f', cost: 700, cur: 'gold' },
  { id: 'sk_druid_3', ch: 'druid', ar: 'شجرة العالم', en: 'World Tree', body: '#5cc85c', cloak: '#0a2410', cost: 2200, cur: 'gold' },
  { id: 'sk_templar_1', ch: 'templar', ar: 'البالادين', en: 'Classic Paladin', body: '#fff3b0', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_templar_2', ch: 'templar', ar: 'درع الفجر', en: 'Dawnshield', body: '#ffeaa0', cloak: '#40340f', cost: 700, cur: 'gold' },
  { id: 'sk_templar_3', ch: 'templar', ar: 'المسيّاف المقدس', en: 'Holy Avenger', body: '#fffbe0', cloak: '#584418', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_jester_1', ch: 'jester', ar: 'مهرّج الفوضى', en: 'Classic Jester', body: '#ff6ea8', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_jester_2', ch: 'jester', ar: 'نرد مشطور', en: 'Split Dice', body: '#ff8ac0', cloak: '#2c0c1c', cost: 700, cur: 'gold' },
  { id: 'sk_jester_3', ch: 'jester', ar: 'ملك الجنون', en: 'Madness King', body: '#ffb0d0', cloak: '#40142c', cost: 2200, cur: 'gold' },
  { id: 'sk_void_1', ch: 'voidwalker', ar: 'سائر الفراغ', en: 'Classic Voidwalker', body: '#b06cff', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_void_2', ch: 'voidwalker', ar: 'ظل النجوم', en: 'Starshade', body: '#9a5cff', cloak: '#180a30', cost: 700, cur: 'gold' },
  { id: 'sk_void_3', ch: 'voidwalker', ar: 'أفق الحدث', en: 'Event Horizon', body: '#d0a0ff', cloak: '#240a44', cost: 2600, cur: 'gold', leg: true },
  { id: 'sk_venom_1', ch: 'venom', ar: 'سمّامة الأفاعي', en: 'Classic Venomancer', body: '#8be84a', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_venom_2', ch: 'venom', ar: 'أم الأفاعي', en: 'Serpent Mother', body: '#a8f06a', cloak: '#14320c', cost: 700, cur: 'gold' },
  { id: 'sk_venom_3', ch: 'venom', ar: 'وباء متجول', en: 'Wandering Plague', body: '#6ac83a', cloak: '#0c2408', cost: 2200, cur: 'gold' },
  { id: 'sk_assassin_1', ch: 'assassin', ar: 'الحاشي الصامت', en: 'Classic Assassin', body: '#c8d2e8', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_assassin_2', ch: 'assassin', ar: 'ظل منتصف الليل', en: 'Midnight Shade', body: '#8a93b5', cloak: '#0a0c18', cost: 700, cur: 'gold' },
  { id: 'sk_assassin_3', ch: 'assassin', ar: 'أخمص الموت', en: "Death's Heel", body: '#e8ecf8', cloak: '#161a2c', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_chrono_1', ch: 'chrono', ar: 'سيد الزمن', en: 'Classic Chronomancer', body: '#c9b8ff', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_chrono_2', ch: 'chrono', ar: 'ساعاتي عجيب', en: 'Odd Clockmaker', body: '#e8dcb8', cloak: '#2c2410', cost: 700, cur: 'gold' },
  { id: 'sk_chrono_3', ch: 'chrono', ar: 'مفكك الزمن', en: 'Timeline Breaker', body: '#f0e8ff', cloak: '#3c3058', cost: 2600, cur: 'gold', leg: true },
  { id: 'sk_blood_1', ch: 'bloodmage', ar: 'ساحر الدم', en: 'Classic Bloodmage', body: '#ff5c7a', cloak: '#0d1020', cost: 0, cur: 'gold' },
  { id: 'sk_blood_2', ch: 'bloodmage', ar: 'وشاح الدموع الحمر', en: 'Crimson Weeper', body: '#e84a6a', cloak: '#300a14', cost: 700, cur: 'gold' },
  { id: 'sk_blood_3', ch: 'bloodmage', ar: 'قلب مصفى', en: 'Distilled Heart', body: '#ff8aa0', cloak: '#40101c', cost: 2400, cur: 'gold', leg: true },
  { id: 'sk_warlock_1', ch: 'warlock', ar: 'متعهّد الظلام', en: 'Classic Warlock', body: '#8a5cff', cloak: '#0d1020', cost: 0, cur: 'gold' }
];
Data.skin = (id) => Data.SKINS.find(s => s.id === id);

Data.TRAILS = [
  { id: 'tr_none', ar: 'بدون', en: 'None', color: null, type: null, cost: 0, cur: 'gold' },
  { id: 'tr_ember', ar: 'جمر متوهج', en: 'Glowing Embers', color: '#ff7b3a', type: 'flame', cost: 400, cur: 'gold' },
  { id: 'tr_frost', ar: 'بلورات ثلجية', en: 'Frost Crystals', color: '#9fd8ff', type: 'trail', cost: 400, cur: 'gold' },
  { id: 'tr_petal', ar: 'بتلات ورد', en: 'Rose Petals', color: '#ff8ad8', type: 'trail', cost: 500, cur: 'gold' },
  { id: 'tr_shadow', ar: 'دخان ظل', en: 'Shadow Smoke', color: '#8a5cff', type: 'smoke', cost: 500, cur: 'gold' },
  { id: 'tr_star', ar: 'غبار نجمي', en: 'Stardust', color: '#fff3b0', type: 'spark', cost: 600, cur: 'gold' },
  { id: 'tr_blood', ar: 'قطرات دم', en: 'Blood Drops', color: '#ff5c7a', type: 'trail', cost: 600, cur: 'gold' },
  { id: 'tr_ink', ar: 'حبر عرّاف', en: 'Augur Ink', color: '#4a4a66', type: 'smoke', cost: 600, cur: 'gold' },
  { id: 'tr_rainbow', ar: 'طيف قوس قزح', en: 'Prism Spectrum', color: '#7ee8fa', type: 'spark', cost: 1200, cur: 'shards', rainbow: true },
  { id: 'tr_gold', ar: 'رذاذ ذهبي', en: 'Golden Spray', color: '#f5c542', type: 'spark', cost: 900, cur: 'gold' },
  { id: 'tr_void', ar: 'فتحات الفراغ', en: 'Void Rifts', color: '#b06cff', type: 'trail', cost: 900, cur: 'gold' },
  { id: 'tr_lightning', ar: 'شرر كهربائي', en: 'Static Sparks', color: '#ffe95c', type: 'spark', cost: 900, cur: 'gold' },
  { id: 'tr_bubble', ar: 'فقاعات سحرية', en: 'Arcane Bubbles', color: '#8fd4ff', type: 'trail', cost: 800, cur: 'gold' },
  { id: 'tr_feather', ar: 'ريش رمادي', en: 'Gray Feathers', color: '#c8d2e8', type: 'trail', cost: 800, cur: 'gold' },
  { id: 'tr_smoke', ar: 'دخان خبيث', en: 'Foul Smoke', color: '#7a8a6a', type: 'smoke', cost: 700, cur: 'gold' },
  { id: 'tr_leaf', ar: 'أوراق شجر', en: 'Drifting Leaves', color: '#7be07b', type: 'trail', cost: 700, cur: 'gold' },
  { id: 'tr_sparkle', ar: 'تألق مقمر', en: 'Moon Sparkle', color: '#e8f0ff', type: 'spark', cost: 800, cur: 'gold' },
  { id: 'tr_rune', ar: 'رموز متوهجة', en: 'Glowing Runes', color: '#7ee8fa', type: 'trail', cost: 1000, cur: 'shards' },
  { id: 'tr_slime', ar: 'مخاط لزج', en: 'Sticky Slime', color: '#8be84a', type: 'trail', cost: 700, cur: 'gold' },
  { id: 'tr_moon', ar: 'هلال مضيء', en: 'Crescent Glow', color: '#dfe8ff', type: 'ring', cost: 1400, cur: 'shards' }
];
Data.trail = (id) => Data.TRAILS.find(x => x.id === id);

Data.SPELL_COLORS = [
  { id: 'cl_default', ar: 'افتراضي', en: 'Default', color: null, cost: 0, cur: 'gold' },
  { id: 'cl_crimson', ar: 'قرمزي', en: 'Crimson', color: '#ff4a5c', cost: 500, cur: 'gold' },
  { id: 'cl_azure', ar: 'أزرق لازوردي', en: 'Azure', color: '#4aa8ff', cost: 500, cur: 'gold' },
  { id: 'cl_emerald', ar: 'زمردي', en: 'Emerald', color: '#4ae88a', cost: 500, cur: 'gold' },
  { id: 'cl_gold', ar: 'ذهبي', en: 'Gilded', color: '#ffd24a', cost: 700, cur: 'gold' },
  { id: 'cl_rose', ar: 'وردي', en: 'Rose', color: '#ff8ac0', cost: 500, cur: 'gold' },
  { id: 'cl_amber', ar: 'عنبري', en: 'Amber', color: '#ffb05c', cost: 500, cur: 'gold' },
  { id: 'cl_jade', ar: 'يشمي', en: 'Jade', color: '#5ce8b8', cost: 600, cur: 'gold' },
  { id: 'cl_sapphire', ar: 'ياقوتي أزرق', en: 'Sapphire', color: '#5c6aff', cost: 600, cur: 'gold' },
  { id: 'cl_violet', ar: 'بنفسجي', en: 'Violet', color: '#b06cff', cost: 600, cur: 'gold' },
  { id: 'cl_obsidian', ar: 'أسود بركاني', en: 'Obsidian', color: '#5a5a7a', cost: 700, cur: 'gold' },
  { id: 'cl_pearl', ar: 'لؤلؤي', en: 'Pearl', color: '#f0f4ff', cost: 700, cur: 'gold' },
  { id: 'cl_toxic', ar: 'سام فاقع', en: 'Toxic', color: '#b8ff3a', cost: 700, cur: 'gold' },
  { id: 'cl_sunset', ar: 'غروب', en: 'Sunset', color: '#ff7a5c', cost: 800, cur: 'gold' },
  { id: 'cl_cosmic', ar: 'كوكبي', en: 'Cosmic', color: '#c99aff', cost: 1200, cur: 'shards' }
];
Data.spellColor = (id) => Data.SPELL_COLORS.find(c => c.id === id);
/* ═══════════ v2.1 — Data: 32 سلاحًا جديدًا + 15 تطورًا + 14 شخصية بميزتين + 4 مرافقين ═══════════ */

// ─── 32 سلاحًا جديدًا عبر المصنع W() المعرّف في p05 (80 سلاحًا إجمالًا) ───
// — النار (3) —
W('cinderOrbs', 'مدارات الجمر', 'Cinder Orbs', 'fire', 'orbit', { dmg: 13, cd: 0, count: 2, speed: 2.8, r: 10 });
W('flameSerpent', 'الثعبان الملتهب', 'Flame Serpent', 'fire', 'homing', { dmg: 17, cd: 1.5, speed: 300 });
W('magmaMines', 'ألغام الحمم', 'Magma Mines', 'fire', 'mine', { dmg: 34, cd: 2.8, life: 2.0, area: 78 });
// — الثلج (3) —
W('icicleVolley', 'رشقة المسلال', 'Icicle Volley', 'ice', 'proj', { dmg: 12, cd: 1.0, count: 3, speed: 430, pierce: 2 });
W('frostbiteAura', 'هالة الصقيع', 'Frostbite Aura', 'ice', 'aura', { dmg: 8, cd: 0.5, area: 100 });
W('glacialSpikes', 'شصوص الأنهار', 'Glacial Spikes', 'ice', 'rain', { dmg: 30, cd: 2.6, count: 2, area: 50 });
// — البرق (3) —
W('teslaOrb', 'كرة تسلا', 'Tesla Orb', 'lightning', 'orbit', { dmg: 11, cd: 0, count: 3, speed: 3.6, r: 9 });
W('ionStorm', 'عاصفة الأيونات', 'Ion Storm', 'lightning', 'rain', { dmg: 20, cd: 2.2, count: 3, area: 55 });
W('stormSigil', 'ختم العاصفة', 'Storm Sigil', 'lightning', 'mine', { dmg: 38, cd: 2.6, life: 1.8, area: 70 });
// — السم (3) —
W('sporeMines', 'ألغام الأبواغ', 'Spore Mines', 'poison', 'mine', { dmg: 22, cd: 2.4, life: 2.4, area: 82 });
W('plagueFang', 'ناب الطاعون', 'Plague Fang', 'poison', 'homing', { dmg: 15, cd: 1.3, speed: 310 });
W('venomNova', 'انفجار السموم', 'Venom Nova', 'poison', 'nova', { dmg: 24, cd: 2.8, area: 145 });
// — الظلام (3) —
W('shadowClones', 'استنساخ الظلال', 'Shadow Clones', 'dark', 'orbit', { dmg: 16, cd: 0, count: 2, speed: -2.4, r: 12 });
W('demonFang', 'ناب الشيطان', 'Demon Fang', 'dark', 'proj', { dmg: 30, cd: 1.35, speed: 480, pierce: 2, r: 11 });
W('doomSigil', 'ختم الهلاك', 'Doom Sigil', 'dark', 'mine', { dmg: 42, cd: 3.2, life: 2.2, area: 88 });
// — النور (3) —
W('lightSpear', 'رمح النور المثقوب', 'Light Spear', 'light', 'proj', { dmg: 26, cd: 1.5, speed: 640, pierce: 5, r: 7 });
W('holyChain', 'سلسلة النور', 'Holy Chain', 'light', 'chain', { dmg: 18, cd: 1.8, area: 240 });
W('aegisNova', 'انفجار الأيجس', 'Aegis Nova', 'light', 'nova', { dmg: 28, cd: 3.0, area: 155 });
// — الأركان (3) —
W('arcaneSpiral', 'حلزون أركان', 'Arcane Spiral', 'arcane', 'proj', { dmg: 10, cd: 0.9, count: 4, speed: 380 });
W('gravityWell', 'بئر الجاذبية', 'Gravity Well', 'arcane', 'mine', { dmg: 36, cd: 4.2, life: 2.4, area: 105, mineMode: 'pull' });
W('timeShackle', 'قيد الزمن', 'Time Shackle', 'arcane', 'proj', { dmg: 14, cd: 1.1, speed: 420, pierce: 1, slowHit: true });
// — الطبيعة (3) —
W('thornShield', 'درع الأشواك', 'Thorn Shield', 'nature', 'orbit', { dmg: 9, cd: 0, count: 4, speed: 3.0, r: 8 });
W('sunBloom', 'تفتّح الشمس', 'Sun Bloom', 'nature', 'nova', { dmg: 26, cd: 3.2, area: 160 });
W('rootGrasp', 'قبضة الجذور', 'Root Grasp', 'nature', 'aura', { dmg: 7, cd: 0.6, area: 115 });
// — الفوضى (2) —
W('diceBolt', 'قذيفة النرد', 'Dice Bolt', 'chaos', 'proj', { dmg: 27, cd: 1.3, speed: 350, bounce: 2 });
W('jesterDaggers', 'خناجر المهرّج', 'Jester Daggers', 'chaos', 'boomerang', { dmg: 14, cd: 1.4, speed: 420, life: 1.6, r: 9 });
// — الفراغ (3) —
W('voidTendril', 'ليكة الفراغ', 'Void Tendril', 'void', 'homing', { dmg: 19, cd: 1.5, speed: 290 });
W('entropyField', 'حقل الأنتروبيا', 'Entropy Field', 'void', 'aura', { dmg: 9, cd: 0.55, area: 108 });
W('riftSpike', 'شصوص الشرخ', 'Rift Spikes', 'void', 'rain', { dmg: 26, cd: 2.4, count: 2, area: 45 });
// — الفيزيائية (3) —
W('crossbow', 'المقلاع المتقاطع', 'Crossbow', 'physical', 'proj', { dmg: 24, cd: 1.2, speed: 620, pierce: 4, r: 6 });
W('ironFang', 'ناب الحديد', 'Iron Fang', 'physical', 'melee', { dmg: 26, cd: 1.1, area: 95 });
W('whirlBlade', 'الشفرة الدوارة', 'Whirl Blade', 'physical', 'boomerang', { dmg: 20, cd: 1.9, speed: 360, life: 2.0, r: 12 });
Log.log('Weapons total:', Data.WEAPONS.length);

// ─── 15 تطورًا جديدًا (إجمالي 25): أزواج + متطلبات قطع محفّزة ───
// تجهيز الأزواج على الأسلحة القديمة
const pairEvo = (a, b, evoId) => { const wa = Data.weapon(a), wb = Data.weapon(b); if (wa) { wa.evo = evoId; wa.evoWith = b; } if (wb) { wb.evoWith = a; } };
pairEvo('flameWave', 'fireNova', 'infernoTide');
pairEvo('iceNova', 'frozenOrb', 'absoluteZero');
pairEvo('stormBolt', 'ballLightning', 'thunderGod');
pairEvo('venomSpit', 'plagueAura', 'hydraVenom');
pairEvo('darkPulse', 'nightmare', 'dreadSovereign');
pairEvo('lightLance', 'radiance', 'divineSpear');
pairEvo('arcaneOrb', 'manaSurge', 'manaVortex');
pairEvo('thornSpray', 'beeSwarm', 'swarmLord');
pairEvo('prismShot', 'boomerang', 'prismTempest');
pairEvo('voidRip', 'nullSphere', 'realityTear');
// التطويرات الفردية بمحفّز قطعة أثرية (المحفزات تُعرّف في p25)
const soloEvo = (a, cat, evoId) => { const w = Data.weapon(a); if (w) { w.evo = evoId; w.evoWith = cat; } };
soloEvo('hammerSmash', 'titan_core', 'titanCrusher');
soloEvo('arrowVolley', 'wind_charm', 'arrowStorm');
soloEvo('singularity', 'void_shard', 'eventHorizon');
soloEvo('blizzard', 'eternal_ice', 'winterfall');
soloEvo('acidRain', 'venom_gland', 'acidDeluge');

Object.assign(Data.EVOLVED, {
  infernoTide: { ar: 'موجة الجحيم', en: 'Inferno Tide', school: 'fire', kind: 'melee', dmg: 42, cd: 1.3, area: 130, color: '#ff5c1a', flag: 'apocBurn', descAr: 'مد جحيمي يترك أرضًا تحترق خلفه', descEn: 'An infernal sweep that leaves burning ground' },
  absoluteZero: { ar: 'الصفر المطلق', en: 'Absolute Zero', school: 'ice', kind: 'nova', dmg: 45, cd: 2.6, area: 190, color: '#e8fbff', flag: 'chainFreeze', descAr: 'صقيع مطلق يجمد ويكسر كل ما يلمسه', descEn: 'Absolute cold that freezes and shatters all it touches' },
  thunderGod: { ar: 'إله الرعد', en: 'Thunder God', school: 'lightning', kind: 'proj', dmg: 42, cd: 1.1, count: 3, speed: 560, pierce: 3, r: 10, color: '#fdfd96', descAr: 'صلبان رعدية تخترق الصفوف كاملة', descEn: 'Thunder lances that pierce whole ranks' },
  hydraVenom: { ar: 'سم الهيدرا', en: 'Hydra Venom', school: 'poison', kind: 'homing', dmg: 24, cd: 1.0, count: 4, speed: 320, color: '#8be84a', descAr: 'أنياب تسعى للجيوش وتسممها كلها', descEn: 'Seeking fangs that poison entire packs' },
  dreadSovereign: { ar: 'سيّد الهول', en: 'Dread Sovereign', school: 'dark', kind: 'nova', dmg: 50, cd: 2.4, area: 200, color: '#8a5cff', descAr: 'موجة رعب تجمد القلوب وتفتح الأرواح', descEn: 'A wave of dread that stops hearts and opens souls' },
  divineSpear: { ar: 'رمح الإله', en: 'Divine Spear', school: 'light', kind: 'proj', dmg: 48, cd: 1.4, speed: 800, pierce: 8, r: 8, color: '#fffbe0', descAr: 'رمح نوراني يطهّر ثمانية أعداء في رمشة', descEn: 'A holy spear that purges eight foes in a blink' },
  manaVortex: { ar: 'دوامة المانا', en: 'Mana Vortex', school: 'arcane', kind: 'orbit', dmg: 30, cd: 0, count: 4, speed: 1.4, r: 16, color: '#7ee8fa', flag: 'ascendExplode', descAr: 'أرباع مانا تدور وتنفجر بمن تلمسهم', descEn: 'Orbiting mana shards that detonate on contact' },
  swarmLord: { ar: 'سيّد الأشواك', en: 'Swarm Lord', school: 'nature', kind: 'orbit', dmg: 14, cd: 0, count: 6, speed: 4.6, r: 7, color: '#7be07b', descAr: 'ستة ألف أنشوكة تدور حولك بلا رحمة', descEn: 'Six spinning thorns with no mercy' },
  prismTempest: { ar: 'عاصفة المنشور', en: 'Prism Tempest', school: 'chaos', kind: 'boomerang', dmg: 30, cd: 1.6, speed: 400, life: 2.0, r: 14, color: '#ff6ea8', descAr: 'شفرات طيفية ترجع إليك دائمًا', descEn: 'Spectral blades that always come home' },
  realityTear: { ar: 'تمزق الواقع', en: 'Reality Tear', school: 'void', kind: 'proj', dmg: 34, cd: 0.8, speed: 700, pierce: 6, r: 9, color: '#b06cff', descAr: 'شقوق في النسيج تبتلع الصفوف', descEn: 'Tears in the fabric that swallow ranks' },
  titanCrusher: { ar: 'دكّة العمالقة', en: 'Titan Crusher', school: 'physical', kind: 'melee', dmg: 85, cd: 2.4, area: 110, color: '#d8dce8', descAr: 'مطرقة تهز الأرض وتفتت العظام', descEn: 'A hammer that quakes the earth and splinters bone' },
  arrowStorm: { ar: 'عاصفة السهام', en: 'Arrow Storm', school: 'physical', kind: 'rain', dmg: 22, cd: 1.6, count: 7, area: 45, color: '#e8ecf8', descAr: 'مطر من السهام لا يترك فجوة للهروب', descEn: 'A rain of arrows leaving no gap to escape' },
  eventHorizon: { ar: 'أفق الحدث', en: 'Event Horizon', school: 'void', kind: 'mine', dmg: 70, cd: 4.5, life: 2.6, area: 130, color: '#8a3cff', descAr: 'ثقب أسود مصغر يلتهم كل ما يقترب', descEn: 'A miniature black hole that devours all nearby' },
  winterfall: { ar: 'سقوط الشتاء', en: 'Winterfall', school: 'ice', kind: 'rain', dmg: 26, cd: 1.8, count: 4, area: 70, color: '#c8ecff', descAr: 'شتاء دائم يمحو ما يقف في مكانه', descEn: 'An endless winter that erases whatever stands still' },
  acidDeluge: { ar: 'الوابل الحمضي', en: 'Acid Deluge', school: 'poison', kind: 'rain', dmg: 18, cd: 1.7, count: 5, area: 60, color: '#b8ff3a', flag: 'plaguePool', descAr: 'حمض يذيب الدروع ويترك بركًا خانقة', descEn: 'Acid that melts armor and leaves choking pools' }
});
// إعادة بناء خريطة التطور لتشمل الجدد
Data.EVO_MAP = {};
for (const w of Data.WEAPONS) if (w.evo) Data.EVO_MAP[w.id] = { evo: w.evo, with: w.evoWith };
Log.log('Evolutions total:', Object.keys(Data.EVOLVED).length);

// ─── الشخصيات الـ14: هويات جديدة + ميزتان لكل شخصية + فتح بالشظايا للسبعة ───
const setPerks = (id, p1, p2, patch) => {
  const c = Data.char(id); if (!c) return;
  c.perk = p1; c.perks = [p1, p2].filter(Boolean);
  if (patch) Object.assign(c, patch);
};
// إعادة صياغة ثلاث شخصيات قائمة بهويات مطلوبة + إضافة الميزة الثانية للجميع
setPerks('druid', { k: 'compDmg', v: 0.5, ar: 'قوة المرافقين +50%', en: 'Companions +50% dmg' }, { k: 'regen', v: 1, ar: 'تجدد +1/ث', en: '+1 regen/s' }, { ar: 'سيد الوحوش', en: 'Druid the Beastlord', startComp: 'wolf', unlock: { type: 'shards', cost: 12 } });
setPerks('templar', { k: 'block', v: 0.12, ar: 'صدّ 12% من الضربات', en: 'Block 12% of hits' }, { k: 'healLv', v: 8, ar: '+8 صحة عند كل ارتقاء', en: '+8 HP on level up' }, { ar: 'البالادين', en: 'Paladin the Aegis', unlock: { type: 'shards', cost: 10 } });
setPerks('storm', { k: 'chain', v: 2, ar: 'قفزتا برق إضافيتان', en: '+2 chain jumps' }, { k: 'school', sk: 'lightning', v: 0.25, ar: 'ضرر البرق +25%', en: '+25% lightning dmg' }, { ar: 'منادي العواصف', en: 'Stormcaller', unlock: { type: 'shards', cost: 12 } });
setPerks('arcane', { k: 'xp', v: 0.15, ar: 'خبرة +15%', en: '+15% XP' }, { k: 'area', v: 0.10, ar: 'مساحة +10%', en: '+10% area' });
setPerks('pyra', { k: 'school', sk: 'fire', v: 0.2, ar: 'ضرر النار +20%', en: '+20% fire dmg' }, { k: 'burnPower', v: 0.25, ar: 'ضرر الإشعال +25%', en: '+25% burn dmg' });
setPerks('frost', { k: 'freezeHit', v: 0.1, ar: '10% تجميد عند الإصابة', en: '10% freeze on hit' }, { k: 'school', sk: 'ice', v: 0.15, ar: 'ضرر الثلج +15%', en: '+15% ice dmg' });
setPerks('shadow', { k: 'crit', v: 0.12, ar: 'حرجة +12%', en: '+12% crit' }, { k: 'school', sk: 'dark', v: 0.15, ar: 'ضرر الظلام +15%', en: '+15% dark dmg' });
setPerks('jester', { k: 'luck', v: 0.3, ar: 'حظ +30%', en: '+30% luck' }, { k: 'school', sk: 'chaos', v: 0.15, ar: 'ضرر الفوضى +15%', en: '+15% chaos dmg' });
setPerks('voidwalker', { k: 'dashCd', v: 0.3, ar: 'تبريد الاندفاع -30%', en: '-30% dash cd' }, { k: 'school', sk: 'void', v: 0.15, ar: 'ضرر الفراغ +15%', en: '+15% void dmg' });
setPerks('venom', { k: 'school', sk: 'poison', v: 0.25, ar: 'ضرر السم +25%', en: '+25% poison dmg' }, { k: 'poisonPower', v: 0.25, ar: 'قوة التسمم +25%', en: '+25% poison power' });
// الأربعة الجدد
Data.CHARACTERS.push(
  { id: 'assassin', ar: 'الحاشي الصامت', en: 'The Silent Assassin', color: '#c8d2e8', hp: 88, speed: 172, weapon: 'daggerThrow',
    perk: { k: 'crit', v: 0.15, ar: 'حرجة +15%', en: '+15% crit' },
    perks: [{ k: 'crit', v: 0.15, ar: 'حرجة +15%', en: '+15% crit' }, { k: 'exec', v: 0.18, ar: 'إعدام من يعانق الموت (18% صحة)', en: 'Execute foes below 18% HP' }],
    unlock: { type: 'shards', cost: 15 } },
  { id: 'chrono', ar: 'سيد الزمن', en: 'Chronomancer', color: '#c9b8ff', hp: 95, speed: 150, weapon: 'timeShackle',
    perk: { k: 'cd', v: 0.12, ar: 'تبريد -12%', en: '-12% cooldowns' },
    perks: [{ k: 'cd', v: 0.12, ar: 'تبريد -12%', en: '-12% cooldowns' }, { k: 'slowAura', v: 0.1, ar: 'هالة إبطاء 10% حولك', en: '10% slow aura around you' }],
    unlock: { type: 'shards', cost: 18 } },
  { id: 'bloodmage', ar: 'ساحر الدم', en: 'Bloodmage', color: '#ff5c7a', hp: 105, speed: 148, weapon: 'soulDrain',
    perk: { k: 'lifesteal', v: 0.02, ar: 'امتصاص حياة 2%', en: '2% lifesteal' },
    perks: [{ k: 'lifesteal', v: 0.02, ar: 'امتصاص حياة 2%', en: '2% lifesteal' }, { k: 'lowHp', v: 0.008, ar: '+0.8% ضرر لكل 1% صحة مفقودة', en: '+0.8% dmg per 1% missing HP' }],
    unlock: { type: 'shards', cost: 20 } },
  { id: 'warlock', ar: 'متعهّد الظلام', en: 'Warlock', color: '#8a5cff', hp: 82, speed: 152, weapon: 'demonFang',
    perk: { k: 'dmg', v: 0.3, ar: 'ضرر +30% (ميثاق الشيطان)', en: '+30% dmg (demon pact)' },
    perks: [{ k: 'dmg', v: 0.3, ar: 'ضرر +30% (ميثاق الشيطان)', en: '+30% dmg (demon pact)' }, { k: 'curseHit', v: 0.1, ar: 'ضرباتك تلعن الأعداء: +10% ضرر متلقى', en: 'Hits curse enemies: +10% dmg taken' }],
    drawback: { k: 'hp', v: -25, ar: 'الصحة القصوى -25', en: '-25 max HP' },
    unlock: { type: 'shards', cost: 25 } }
);
Log.log('Characters total:', Data.CHARACTERS.length);

// ─── المرافقون الجدد الأربعة (إجمالي 8 + الجنية) ───
Data.COMPANIONS.push(
  { id: 'cat', ar: 'القط الأسود', en: 'Shadow Cat', unlockStage: 6, kind: 'crit', dmg: 0, cd: 0, color: '#3a3a52' },
  { id: 'squirrel', ar: 'السنجاب المقاتل', en: 'Battle Squirrel', unlockStage: 4, kind: 'spray', dmg: 6, cd: 0.55, color: '#c88a4a' },
  { id: 'spider', ar: 'العنكبوت النسّاج', en: 'Web Spider', unlockStage: 3, kind: 'web', dmg: 8, cd: 1.8, color: '#7a8a6a' },
  { id: 'raven', ar: 'الغراب العرّاف', en: 'Augur Raven', unlockStage: 5, kind: 'peck', dmg: 12, cd: 1.4, color: '#4a4a66' }
);
Log.log('Companions total:', Data.COMPANIONS.length - 1);
/* ═══════════ v2.1 — Data: 19 عدوًا جديدًا + 8 زعماء صغار + زعيم السماء + موجات ═══════════ */
// السلوكيات الجديدة: summoner مستدعي / spitter راشق ثلاثي / shielded مدرّع / teleporter منقلب /
// charger صادم / orbiter حوّام / splitter منشطر / healer معالج / bomber مفجّر / vampiric مصاص /
// diver مُقحم / berserker مهووس / regenerator متجدد / spectral طيفي

// ─── الأعداء الجدد (19 ← الإجمالي 40) مع العنصر والضعف والمقاومة ───
const E2 = (id, ar, en, o) => { Data.ENEMIES[id] = Object.assign({ ar, en, color: '#fff', shape: 'blob', behavior: 'walk' }, o); };
// — المقبرة —
E2('graveHound', 'كلب القبور', 'Grave Hound', { hp: 16, spd: 108, dmg: 9, r: 10, xp: 1, color: '#8a93b5', shape: 'wolf', behavior: 'fast', weak: 'fire', resist: 'dark', elem: 'dark' });
E2('necroAcolyte', 'تلميذ التعاويذ', 'Necro Acolyte', { hp: 20, spd: 40, dmg: 13, r: 12, xp: 3, color: '#9a8ad8', shape: 'mage', behavior: 'summoner', range: 320, atkCd: 4.5, weak: 'holy', resist: 'dark', elem: 'dark' });
E2('graveGhast', 'شبح القبور', 'Grave Ghast', { hp: 24, spd: 70, dmg: 12, r: 12, xp: 2, color: '#b8c4e8', shape: 'ghost', behavior: 'spectral', weak: 'light', resist: 'physical', elem: 'dark' });
// — الكهف الجليدي —
E2('frostSpider', 'عنكبوت الصقيع', 'Frost Spider', { hp: 18, spd: 64, dmg: 10, r: 11, xp: 2, color: '#8fc8ff', shape: 'spiderE', behavior: 'spitter', range: 300, atkCd: 2.8, weak: 'fire', resist: 'ice', elem: 'ice' });
E2('glacierCrab', 'سلطعون الأنهار', 'Glacier Crab', { hp: 80, spd: 36, dmg: 16, r: 17, xp: 4, color: '#7fb8e8', shape: 'crab', behavior: 'shielded', weak: 'lightning', resist: 'ice', elem: 'ice' });
// — صحراء الرمال —
E2('dustWraith', 'طيف الغبار', 'Dust Wraith', { hp: 22, spd: 60, dmg: 13, r: 12, xp: 3, color: '#d8c89a', shape: 'ghost', behavior: 'teleporter', weak: 'ice', resist: 'fire', elem: 'dark' });
E2('sandScorpion', 'عقرب الرمال', 'Sand Scorpion', { hp: 34, spd: 82, dmg: 15, r: 13, xp: 3, color: '#c8a05c', shape: 'scorpion', behavior: 'charger', weak: 'ice', resist: 'poison', elem: 'poison' });
E2('curseVulture', 'نسر اللعنة', 'Curse Vulture', { hp: 26, spd: 92, dmg: 12, r: 12, xp: 2, color: '#a08a6a', shape: 'vulture', behavior: 'orbiter', weak: 'lightning', resist: 'dark', elem: 'dark' });
// — معبد اللهب —
E2('magmaBlob', 'كتلة الحمم', 'Magma Blob', { hp: 44, spd: 46, dmg: 14, r: 15, xp: 3, color: '#ff6a3a', shape: 'blob', behavior: 'splitter', weak: 'ice', resist: 'fire', elem: 'fire' });
E2('emberPriest', 'كاهن الجمر', 'Ember Priest', { hp: 30, spd: 42, dmg: 12, r: 12, xp: 4, color: '#ff9a5c', shape: 'mage', behavior: 'healer', weak: 'ice', resist: 'fire', elem: 'fire' });
E2('cinderBat', 'خفاش الجمر', 'Cinder Bat', { hp: 14, spd: 100, dmg: 10, r: 10, xp: 1, color: '#ff8a5c', shape: 'bat', behavior: 'bomber', weak: 'ice', resist: 'fire', elem: 'fire' });
// — الفراغ الأرجواني —
E2('voidLeech', 'علقة الفراغ', 'Void Leech', { hp: 20, spd: 96, dmg: 11, r: 10, xp: 2, color: '#9a5cff', shape: 'leech', behavior: 'vampiric', weak: 'light', resist: 'dark', elem: 'void' });
E2('riftStalker', 'مطارد الشروخ', 'Rift Stalker', { hp: 30, spd: 74, dmg: 16, r: 12, xp: 3, color: '#8a3cff', shape: 'spawn', behavior: 'diver', weak: 'holy', resist: 'void', elem: 'void' });
E2('chaosMaw', 'فم الفوضى', 'Chaos Maw', { hp: 90, spd: 48, dmg: 22, r: 20, xp: 6, color: '#ff6ea8', shape: 'brute', behavior: 'berserker', weak: 'holy', resist: 'chaos', elem: 'chaos' });
// — قصر السماء —
E2('skyKnight', 'فارس السماء', 'Sky Knight', { hp: 46, spd: 58, dmg: 16, r: 14, xp: 3, color: '#cfe0ff', shape: 'knight', behavior: 'shielded', weak: 'lightning', resist: 'physical', elem: 'light' });
E2('stormHarpy', 'هاربية العاصفة', 'Storm Harpy', { hp: 24, spd: 112, dmg: 13, r: 11, xp: 2, color: '#ffe95c', shape: 'bat', behavior: 'fly', weak: 'ice', resist: 'lightning', elem: 'lightning' });
E2('cloudSage', 'حكيم السحاب', 'Cloud Sage', { hp: 28, spd: 44, dmg: 15, r: 12, xp: 3, color: '#dfe8ff', shape: 'mage', behavior: 'spitter', range: 380, atkCd: 2.4, weak: 'void', resist: 'lightning', elem: 'lightning' });
E2('gargoyle', 'غرغول الحرس', 'Gargoyle', { hp: 40, spd: 66, dmg: 18, r: 13, xp: 3, color: '#8a93b5', shape: 'gargoyle', behavior: 'diver', weak: 'holy', resist: 'physical', elem: 'dark' });
E2('skyGolem', 'غولم الأبراج', 'Tower Golem', { hp: 120, spd: 36, dmg: 22, r: 22, xp: 6, color: '#aebadd', shape: 'golem', behavior: 'regenerator', weak: 'fire', resist: 'physical', elem: 'light' });

// ─── إسناد عناصر الأعداء القدامى تلقائيًا (ضعف/مقاومة/عنصر هجوم) بحتميًا من الاسم ───
(function () {
  const POOL = ['fire', 'ice', 'lightning', 'poison', 'dark', 'light', 'arcane', 'nature', 'chaos', 'void'];
  for (const id in Data.ENEMIES) {
    const e = Data.ENEMIES[id];
    if (e.weak) continue;
    const h = U.hash32(id);
    e.weak = POOL[h % POOL.length];
    e.resist = POOL[(h >> 4) % POOL.length];
    if (e.resist === e.weak) e.resist = POOL[(h >> 8) % POOL.length];
    e.elem = e.resist;
  }
})();
Log.log('Enemies total:', Object.keys(Data.ENEMIES).length);

// ─── 8 زعماء صغار بميكانيكا فريدة تظهر منتصف الجولة ───
// الميكانيكا: summon استدعاء / bombard قصف / nova هالة إبطاء / gravity جذب /
// dash اندفاعات متتابعة / regen شفاء ذاتي / mirror استنساخ / shield درع مرتبط
Data.MINIBOSSES = [
  { id: 'graveBaron', stage: 'crypt', ar: 'بارون المقابر', en: 'Grave Baron', hp: 950, spd: 56, dmg: 22, r: 26, xp: 45, color: '#b8c4e8', shape: 'bossSkel', mech: 'summon', weak: 'fire', resist: 'dark' },
  { id: 'boneTyrant', stage: 'crypt', ar: 'طاغية العظام', en: 'Bone Tyrant', hp: 1150, spd: 50, dmg: 26, r: 28, xp: 55, color: '#d8dce8', shape: 'bossColossus', mech: 'bombard', weak: 'holy', resist: 'physical' },
  { id: 'frostWarden', stage: 'ice', ar: 'حارس الصقيع', en: 'Frost Warden', hp: 1350, spd: 52, dmg: 28, r: 27, xp: 60, color: '#9fd8ff', shape: 'bossWyrm', mech: 'nova', weak: 'fire', resist: 'ice' },
  { id: 'stormDjinn', stage: 'desert', ar: 'جنّي العاصفة', en: 'Storm Djinn', hp: 1500, spd: 64, dmg: 30, r: 26, xp: 70, color: '#ffd66e', shape: 'bossDevourer', mech: 'gravity', weak: 'void', resist: 'lightning' },
  { id: 'duneColossus', stage: 'desert', ar: 'طاغية الكثبان', en: 'Dune Tyrant', hp: 1700, spd: 44, dmg: 32, r: 30, xp: 80, color: '#e8c88a', shape: 'bossColossus', mech: 'dash', weak: 'ice', resist: 'physical' },
  { id: 'flameHerald', stage: 'flame', ar: 'منادي اللهيب', en: 'Flame Herald', hp: 1900, spd: 58, dmg: 34, r: 28, xp: 90, color: '#ff8a3a', shape: 'bossPhoenix', mech: 'regen', weak: 'ice', resist: 'fire' },
  { id: 'voidHerald', stage: 'void', ar: 'منادي الفراغ', en: 'Void Herald', hp: 2100, spd: 60, dmg: 36, r: 29, xp: 100, color: '#b06cff', shape: 'bossDevourer', mech: 'mirror', weak: 'light', resist: 'void' },
  { id: 'skySentinel', stage: 'sky', ar: 'حارس الأبراج', en: 'Sky Sentinel', hp: 2400, spd: 54, dmg: 38, r: 30, xp: 115, color: '#cfe0ff', shape: 'bossSkel', mech: 'shield', weak: 'lightning', resist: 'physical' }
];
Data.miniFor = (stageId) => Data.MINIBOSSES.filter(m => m.stage === stageId);

// ─── الزعيم الكبير السادس: إمبراطورة السماء (3 مراحل بتوقيعات مختلفة) ───
Data.BOSSES.skyEmpress = {
  ar: 'إمبراطورة السماء', en: 'Sky Empress', hp: 9200, spd: 62, dmg: 50, r: 40, xp: 420, color: '#ffe95c', shape: 'bossPhoenix',
  phases: [
    { until: 1.0, patterns: ['volley', 'summon'], rate: 1.8 },
    { until: 0.62, patterns: ['spiral', 'beam', 'charge'], rate: 1.6 },
    { until: 0.30, patterns: ['radial', 'beam', 'summon', 'slam'], rate: 1.3 }
  ]
};

// ─── توسيع تدفق الموجات: الأعداء الجدد يدخلون لاحقًا + قصر السماء ───
Data.WAVE_POOL.crypt.push([9, ['graveHound', 'graveGhast']], [11, ['necroAcolyte']]);
Data.WAVE_POOL.ice.push([8, ['frostSpider']], [10, ['glacierCrab']]);
Data.WAVE_POOL.desert.push([8, ['dustWraith', 'curseVulture']], [10, ['sandScorpion']]);
Data.WAVE_POOL.flame.push([8, ['magmaBlob', 'cinderBat']], [10, ['emberPriest']]);
Data.WAVE_POOL.void.push([9, ['voidLeech', 'riftStalker']], [11, ['chaosMaw']]);
Data.WAVE_POOL.sky = [[0, ['stormHarpy']], [2, ['skyKnight']], [3.5, ['cloudSage']], [5, ['gargoyle']], [7, ['skyGolem']]];
Data.SWARM_EVENTS.push([12, 70], [14, 90]);

// ─── صفات النخبة الإضافية: المشلول والمصاص (الإجمالي 6) ───
Data.AFFIXES.push(
  { id: 'paralyzing', ar: 'مشلول', en: 'Paralyzing', color: '#ffe95c' },
  { id: 'vampiric', ar: 'مصاص', en: 'Vampiric', color: '#ff5c7a' }
);
/* ═══════════ v2.1 — Data: 20 أثرية بندرات ولعنات + 8 تآزرات + 150 إنجازًا + 40 تحديًا ═══════════ */

// ─── 20 قطعة أثرية جديدة (الإجمالي 70) مع ندرة ولعنات ───
const A2 = (o) => Data.ARTIFACTS.push(o);
A2({ id: 'titan_core', ar: 'نواة العملاق', en: 'Titan Core', k: 'dmg', v: 0.18, rar: 'leg' });
A2({ id: 'wind_charm', ar: 'تميمة الريح', en: 'Wind Charm', k: 'projSpeed', v: 0.12, rar: 'rare' });
A2({ id: 'void_shard', ar: 'شظية الفراغ', en: 'Void Shard', k: 'school', sk: 'void', v: 0.18, rar: 'epic' });
A2({ id: 'eternal_ice', ar: 'الجليد الأبدي', en: 'Eternal Ice', k: 'school', sk: 'ice', v: 0.18, rar: 'epic' });
A2({ id: 'venom_gland', ar: 'غدة السموم', en: 'Venom Gland', k: 'school', sk: 'poison', v: 0.18, rar: 'rare' });
A2({ id: 'uranium_core', ar: 'نواة اليورانيوم', en: 'Uranium Core', k: 'dmg', v: 0.22, hpPenalty: -0.15, cursed: true, rar: 'leg' });
A2({ id: 'vampires_fang', ar: 'ناب المصاص', en: "Vampire's Fang", hook: 'lifesteal', v: 0.05, rar: 'epic' });
A2({ id: 'thorn_mail', ar: 'درع الشوك', en: 'Thorn Mail', hook: 'thorns', v: 12, rar: 'rare' });
A2({ id: 'monks_focus', ar: 'بؤرة الراهب', en: "Monk's Focus", k: 'cdRed', v: 0.07, rar: 'rare' });
A2({ id: 'phantom_veil', ar: 'قناع الشبح', en: 'Phantom Veil', k: 'dodge', v: 0.10, rar: 'epic' });
A2({ id: 'bulwark_heart', ar: 'قلب الحصن', en: 'Bulwark Heart', k: 'block', v: 0.08, rar: 'epic' });
A2({ id: 'sage_codex', ar: 'مصنف الحكيم', en: "Sage's Codex", k: 'xp', v: 0.15, rar: 'epic' });
A2({ id: 'alchemists_flask', ar: 'قارورة الخيميائي', en: "Alchemist's Flask", k: 'regen', v: 1.2, rar: 'rare' });
A2({ id: 'storm_in_a_bottle', ar: 'عاصفة في قارورة', en: 'Storm in a Bottle', k: 'cdRed', v: 0.12, rar: 'leg' });
A2({ id: 'gravity_band', ar: 'رباط الجاذبية', en: 'Gravity Band', k: 'pickup', v: 0.30, rar: 'rare' });
A2({ id: 'phoenix_ash', ar: 'رماد العنقاء', en: 'Phoenix Ash', hook: 'shield30', v: 20, rar: 'leg' });
A2({ id: 'cursed_crown', ar: 'التاج الملعون', en: 'Cursed Crown', k: 'dmg', v: 0.15, hpPenalty: -0.10, cursed: true, rar: 'epic' });
A2({ id: 'blood_relic', ar: 'أثر الدم', en: 'Blood Relic', k: 'lifesteal', v: 0.03, hpPenalty: -0.12, cursed: true, rar: 'epic' });
A2({ id: 'focus_crystal', ar: 'بلورة التركيز', en: 'Focus Crystal', k: 'area', v: 0.12, rar: 'rare' });
A2({ id: 'chronometer', ar: 'المزولة', en: 'Chronometer', k: 'duration', v: 0.20, rar: 'epic' });
A2({ id: 'doom_pact', ar: 'ميثاق الهلاك', en: 'Doom Pact', k: 'dmg', v: 0.20, hook: 'noRevive', v2: 1, cursed: true, rar: 'epic' });
A2({ id: 'hungering_void', ar: 'فراغ جائع', en: 'Hungering Void', k: 'school', sk: 'void', v: 0.25, hook: 'goldCurse', v2: 0.2, cursed: true, rar: 'leg' });
// ندرة القطع القديمة (توزيع ثابت)
(function () {
  const epic = ['twin_sigil', 'phoenix_feather', 'glass_skull', 'berserk_totem', 'first_strike', 'echo_charm', 'reaper_edge', 'crit_storm', 'shock_wave', 'plague_seed', 'blood_pact', 'wildfire_ash'];
  const leg = ['phoenix_feather', 'glass_skull', 'reaper_edge', 'echo_charm', 'blood_pact', 'lucky_charm'];
  for (const a of Data.ARTIFACTS) { if (a.rar) continue; a.rar = leg.includes(a.id) ? 'leg' : epic.includes(a.id) ? 'epic' : 'rare'; }
})();
Log.log('Artifacts total:', Data.ARTIFACTS.length);

// ─── 8 تآزرات جديدة + إعادة تسمية اثنين بأسماء مطلوبة أقوى ───
const SYN2 = [
  { id: 'eclipse', ar: 'الكسوف', en: 'Eclipse', req: { schools: ['light', 'dark'] }, eff: { type: 'stat', k: 'dmg', v: 0.15 }, descAr: 'دمج أضداد النور والظلام: ضرر +15% وموجة كسوف دورية', descEn: 'Merging light and dark opposites: +15% dmg and periodic eclipse nova', proc: 'eclipseNova' },
  { id: 'firestorm', ar: 'العاصفة النارية', en: 'Firestorm', req: { schools: ['fire', 'nature'] }, eff: { type: 'stat', k: 'area', v: 0.15 }, descAr: 'النار والريح معًا: القتلات تشعل الأرض', descEn: 'Fire and wind united: kills ignite the ground', proc: 'firestormGround' },
  { id: 'judgment', ar: 'يوم الحساب', en: 'Judgment', req: { schools: ['void', 'light'] }, eff: { type: 'stat', k: 'dmgBoss', v: 0.25 }, descAr: 'قضاء الفراغ المقدس: ضرر الزعماء +25%', descEn: 'Sacred void decree: +25% boss damage' },
  { id: 'magma', ar: 'الصهارة', en: 'Magma', req: { schools: ['physical', 'fire'] }, eff: { type: 'flag', flag: 'thorns2', v: 14 }, descAr: 'الأرض والنار: جلد صخري يحرق من يلمسك', descEn: 'Earth and fire: molten skin punishes contact' },
  { id: 'bloom', ar: 'الإزهار', en: 'Bloom', req: { schools: ['nature', 'ice'] }, eff: { type: 'stat', k: 'regen', v: 1.5 }, descAr: 'حياة تنبت في البرد: تجدد +1.5/ث', descEn: 'Life blooming in frost: +1.5 regen/s' },
  { id: 'warp', ar: 'الانبعاج', en: 'Warp', req: { schools: ['arcane', 'void'] }, eff: { type: 'stat', k: 'projSpeed', v: 0.20 }, descAr: 'ثني الزمان والمكان: مقذوفات أسرع 20%', descEn: 'Bending time and space: +20% projectile speed' },
  { id: 'psionic', ar: 'التخاطر', en: 'Psionic', req: { schools: ['arcane', 'dark'] }, eff: { type: 'stat', k: 'crit', v: 0.10 }, descAr: 'عقل يتسلل للأرواح: حرجة +10%', descEn: 'A mind that seeps into souls: +10% crit' },
  { id: 'balance', ar: 'الميزان', en: 'Balance', req: { schools: ['chaos', 'light'] }, eff: { type: 'stat', k: 'luck', v: 0.2 }, descAr: 'نظام يولد من الفوضى: حظ +20%', descEn: 'Order born from chaos: +20% luck' }
];
for (const s of SYN2) Data.SYNERGIES.push(s);
const fs = Data.SYNERGIES.find(s => s.id === 'frozen_storm');
if (fs) { fs.ar = 'الرعد المتجمد'; fs.en = 'Frozen Thunder'; fs.descAr = 'البرق يجمد من يصعقه، والمجمّد يتصعق'; fs.descEn = 'Lightning freezes its victims; frozen foes get zapped'; }
const sp = Data.SYNERGIES.find(s => s.id === 'shadow_plague');
if (sp) { sp.ar = 'السم الدموي'; sp.en = 'Hemotoxin'; sp.eff.v = 0.3; sp.descAr = 'السم الدموي ينفجر عند الموت بقوة أعلى'; sp.descEn = 'Hemotoxin detonates the fallen with greater force'; }
Log.log('Synergies total:', Data.SYNERGIES.length);

/* ─── الإنجازات: 150 عبر 13 فئة (20 سرية) مع الحفاظ على معرفات القديم ─── */
Data.ACH_CATS = [
  { id: 'survival', k: 'catSurvival', icon: '⌛' }, { id: 'kills', k: 'catKills', icon: '⚔' },
  { id: 'levels', k: 'catLevels', icon: '★' }, { id: 'bosses', k: 'catBosses', icon: '♛' },
  { id: 'streaks', k: 'catStreaks', icon: '🔥' }, { id: 'health', k: 'catHealth', icon: '❤' },
  { id: 'spells', k: 'catSpells', icon: '✧' }, { id: 'synergies', k: 'catSyn', icon: '⛓' },
  { id: 'artifacts', k: 'catArtifacts', icon: '⬟' }, { id: 'gold', k: 'catGold', icon: '◉' },
  { id: 'classes', k: 'catClasses', icon: '♞' }, { id: 'difficulty', k: 'catDifficulty', icon: '☠' },
  { id: 'secret', k: 'catSecret', icon: '؟' }
];
Data.ACHIEVEMENTS.length = 0;
(function () {
  const A = Data.ACHIEVEMENTS, R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const cnt = (m, f) => { try { return f(m); } catch (e) { return 0; } };
  // mk: يبني سلسلة رتب لفئة؛ df(dar, den) دالة نص الوصف بأخذ الرقم
  const mk = (cat, icon, key, arr, df, get, secret) => arr.forEach((n, i) => {
    const d = df(n);
    A.push({ id: key + '_' + n, cat, icon, n, target: n, ar: d[0] + ' ' + R[i], en: d[1] + ' ' + R[i], dar: d[0], den: d[1], get: (m) => get(m, n), secret: !!secret });
  });
  const N = (n) => U.num(n);
  // — الصمود 12 —
  mk('survival', '⌛', 'time', [5, 8, 10, 12, 15, 20, 25, 30], n => ['انجُ ' + N(n) + ' دقائق', 'Survive ' + N(n) + ' minutes'], m => Math.floor((m.stats.bestTime || 0) / 60));
  mk('survival', '🛡', 'nohit', [2, 4, 6], n => ['انجُ ' + N(n) + ' دقائق دون أي ضرر', 'Survive ' + N(n) + ' minutes without damage'], m => Math.floor((m.stats.cleanBest || 0) / 60));
  A.push({ id: 'lowhp_1', cat: 'survival', icon: '💔', n: 1, target: 1, ar: 'على حافة الهاوية', en: 'On the Brink', dar: 'انجُ 60 ثانية وصحتك تحت 10%', den: 'Survive 60s below 10% HP', get: m => (m.stats.clutch || 0) });
  // — القتل 14 —
  mk('kills', '⚔', 'kills', [50, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], n => ['اقتل ' + N(n) + ' عدوًا', 'Slay ' + N(n) + ' enemies'], m => (m.stats.kills || 0));
  mk('kills', '👑', 'elites', [10, 100, 500], n => ['اقتل ' + N(n) + ' من النخبة', 'Kill ' + N(n) + ' elites'], m => (m.stats.elites || 0));
  mk('kills', '☠', 'killrun', [1000], n => ['اقتل ' + N(n) + ' في جولة واحدة', 'Kill ' + N(n) + ' in one run'], m => (m.stats.maxKillsRun || 0));
  // — المستويات 10 —
  mk('levels', '★', 'level', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], n => ['اوصل للمستوى ' + N(n), 'Reach level ' + N(n)], m => (m.stats.maxLevel || 0));
  // — الزعماء 12 —
  mk('bosses', '♛', 'bosses', [1, 3, 5, 10, 15, 25, 50], n => ['اقتل ' + N(n) + ' زعيمًا كبيرًا', 'Defeat ' + N(n) + ' major bosses'], m => (m.stats.bosses || 0));
  mk('bosses', '🦹', 'minis', [1, 10, 50], n => ['اسحق ' + N(n) + ' زعيمًا صغيرًا', 'Crush ' + N(n) + ' mini-bosses'], m => (m.stats.minis || 0));
  A.push({ id: 'perfect_1', cat: 'bosses', icon: '✨', n: 1, target: 1, ar: 'بلا خدش', en: 'Untouched', dar: 'اقتل زعيمًا دون أن تتلقى أي ضرر منه', den: 'Kill a boss without taking damage from it', get: m => (m.stats.perfectBoss || 0) });
  A.push({ id: 'bosskinds_6', cat: 'bosses', icon: '🗂', n: 6, target: 6, ar: 'أرشيف الجبابرة', en: 'Tyrant Archive', dar: 'اقتل الأزعماء الستة الكبار', den: 'Defeat all six major bosses', get: m => Object.keys(m.stats.bossKinds || {}).length });
  // — السلاسل 8 —
  mk('streaks', '🔥', 'streak', [2, 3, 5, 7, 10], n => ['فاز ' + N(n) + ' جولات متتالية', 'Win ' + N(n) + ' runs in a row'], m => (m.stats.winStreak || 0));
  mk('streaks', '📅', 'days', [3, 7, 30], n => ['العب في ' + N(n) + ' أيام مختلفة', 'Play on ' + N(n) + ' different days'], m => Object.keys(m.stats.days || {}).length);
  // — الصحة 10 —
  mk('health', '❤', 'heal', [1000, 10000, 100000], n => ['استرجع ' + N(n) + ' صحة إجمالًا', 'Restore ' + N(n) + ' HP total'], m => Math.floor(m.stats.healTotal || 0));
  A.push({ id: 'block_100', cat: 'health', icon: '🛡', n: 100, target: 100, ar: 'الجدار الحي', en: 'Living Wall', dar: 'اصدّ 100 ضربة', den: 'Block 100 hits', get: m => (m.stats.blocks || 0) });
  A.push({ id: 'dodge_100', cat: 'health', icon: '💨', n: 100, target: 100, ar: 'لا تلمسني', en: 'Untouchable', dar: 'راوغ 100 ضربة', den: 'Dodge 100 hits', get: m => (m.stats.dodges || 0) });
  A.push({ id: 'ls_5000', cat: 'health', icon: '🩸', n: 5000, target: 5000, ar: 'قشة الحياة', en: 'Life Straw', dar: 'امتص ' + N(5000) + ' صحة بالامتصاص', den: 'Lifesteal ' + N(5000) + ' HP total', get: m => Math.floor(m.stats.lsTotal || 0) });
  A.push({ id: 'sw_5', cat: 'health', icon: '🌬', n: 5, target: 5, ar: 'لا أستسلم', en: 'Never Surrender', dar: 'نشّط النَفَس الأخير 5 مرات', den: 'Trigger Second Wind 5 times', get: m => (m.stats.secondWinds || 0) });
  A.push({ id: 'armor_25', cat: 'health', icon: '🪨', n: 25, target: 25, ar: 'قلعة متنقلة', en: 'Walking Fortress', dar: 'اوصل للدرع 25 في جولة', den: 'Reach 25 armor in a run', get: m => (m.stats.armorBest || 0) });
  A.push({ id: 'fullhp_300', cat: 'health', icon: '💚', n: 300, target: 300, ar: 'قلب لا يعرف الجروح', en: 'Unbroken Heart', dar: 'ابقَ بصحة كاملة 300 ثانية إجمالًا', den: 'Spend 300s at full HP total', get: m => Math.floor(m.stats.fullHpTime || 0) });
  A.push({ id: 'thorns_5000', cat: 'health', icon: '🌵', n: 5000, target: 5000, ar: 'لا تلمس الأشواك', en: 'Thorn Embrace', dar: 'اعكس ' + N(5000) + ' ضررًا بالأشواك', den: 'Reflect ' + N(5000) + ' damage with thorns', get: m => Math.floor(m.stats.thornsDmg || 0) });
  // — الأسلحة 12 —
  mk('spells', '✧', 'casts', [1000, 10000, 100000], n => ['ألقِ ' + N(n) + ' تعويذة', 'Cast ' + N(n) + ' spells'], m => (m.stats.casts || 0));
  mk('spells', '✦', 'evolutions', [1, 3, 5, 10], n => ['طوّر ' + N(n) + ' أسلحة', 'Evolve ' + N(n) + ' weapons'], m => (m.stats.evolutions || 0));
  mk('spells', '◈', 'evolverun', [1, 3], n => ['طوّر ' + N(n) + ' أسلحة في جولة', 'Evolve ' + N(n) + ' weapons in one run'], m => (m.stats.maxEvolveRun || 0));
  mk('spells', '📚', 'wpn', [15, 30, 45], n => ['اكتشف ' + N(n) + ' سلاحًا', 'Discover ' + N(n) + ' weapons'], m => Object.keys(m.stats.weaponsFound || {}).length);
  // — التآزرات 8 —
  mk('synergies', '⛓', 'syn', [1, 5, 10, 20], n => ['فعّل ' + N(n) + ' تآزرًا مختلفًا', 'Activate ' + N(n) + ' synergies'], m => Object.keys(m.stats.synFound || {}).length);
  mk('synergies', '🔗', 'synrun', [3, 5, 8], n => ['فعّل ' + N(n) + ' تآزرات في جولة', 'Run with ' + N(n) + ' synergies'], m => (m.stats.synRunBest || 0));
  A.push({ id: 'synkill_500', cat: 'synergies', icon: '💫', n: 500, target: 500, ar: 'انسجام قاتل', en: 'Deadly Harmony', dar: 'اقتل 500 عدو وبينك 3 تآزرات نشطة', den: 'Kill 500 enemies with 3+ synergies active', get: m => (m.stats.synKills || 0) });
  // — الآثار 10 —
  mk('artifacts', '⬟', 'art', [5, 15, 30, 45], n => ['اعثر على ' + N(n) + ' قطعة أثرية', 'Find ' + N(n) + ' artifacts'], m => Object.keys(m.stats.artifactsFound || {}).length);
  mk('artifacts', '🌟', 'leg', [1, 5], n => ['امتلك ' + N(n) + ' قطعة أسطورية', 'Own ' + N(n) + ' legendary artifacts'], m => (m.stats.legendaries || 0));
  A.push({ id: 'cursed_5', cat: 'artifacts', icon: '🕯', n: 5, target: 5, ar: 'عاقد مع الظلام', en: 'Pact with Darkness', dar: 'احمل 5 قطع ملعونة في جولة واحدة', den: 'Hold 5 cursed artifacts in one run', get: m => (m.stats.cursedRunBest || 0) });
  A.push({ id: 'artrun_8', cat: 'artifacts', icon: '🎒', n: 8, target: 8, ar: 'حقيبة الآثاري', en: "Relic Satchel", dar: 'اجمع 8 قطع في جولة واحدة', den: 'Gather 8 artifacts in one run', get: m => (m.stats.artRunBest || 0) });
  mk('artifacts', '📜', 'frag', [10, 30], n => ['اجمع ' + N(n) + ' قطعة قديمة', 'Collect ' + N(n) + ' ancient fragments'], m => Object.keys(m.stats.fragments || {}).length);
  // — الذهب 10 —
  mk('gold', '◉', 'gold', [100, 500, 1000, 5000, 10000, 50000, 100000], n => ['اجمع ' + N(n) + ' ذهبًا إجمالًا', 'Earn ' + N(n) + ' gold total'], m => (m.stats.totalGold || 0));
  A.push({ id: 'spend_50000', cat: 'gold', icon: '💸', n: 50000, target: 50000, ar: 'سخيّ بلا حساب', en: 'Reckless Spender', dar: 'أنفق 50,000 ذهبًا في المتجر والمواهب', den: 'Spend 50,000 gold on shops', get: m => (m.stats.goldSpent || 0) });
  A.push({ id: 'perm_40', cat: 'gold', icon: '🏗', n: 40, target: 40, ar: 'معمّر الترقيات', en: 'Upgrade Architect', dar: 'اشترِ 40 مستوى ترقية دائمة', den: 'Buy 40 permanent upgrade levels', get: m => (m.stats.permLevels || 0) });
  A.push({ id: 'talent_30', cat: 'gold', icon: '✚', n: 30, target: 30, ar: 'المُنير الأكبر', en: 'Grand Enlightened', dar: 'اشترِ 30 موهبة', den: 'Buy 30 talents', get: m => (m.stats.talentsBought || 0) });
  // — الأبطال 14 —
  mk('classes', '♞', 'chars', [3, 5, 10, 14], n => ['افتح ' + N(n) + ' شخصيات', 'Unlock ' + N(n) + ' characters'], m => (m.unlockedChars || []).length);
  A.push({ id: 'play_10', cat: 'classes', icon: '🎭', n: 10, target: 10, ar: 'ممثل متنوع', en: 'Versatile Actor', dar: 'العب بعشر شخصيات مختلفة', den: 'Play 10 different characters', get: m => Object.keys(m.stats.classesPlayed || {}).length });
  for (const cid of ['druid', 'templar', 'storm', 'assassin', 'chrono', 'bloodmage', 'warlock']) {
    const c = Data.char(cid);
    A.push({ id: 'win_' + cid, cat: 'classes', icon: '🏆', n: 1, target: 1, ar: 'افز بـ' + c.ar, en: 'Win as ' + c.en, dar: 'أكمل جولة ناجحة بشخصية ' + c.ar, den: 'Clear a successful run as ' + c.en, get: m => ((m.stats.classWins || {})[cid] || 0) });
  }
  mk('classes', '☉', 'comp', [1, 5], n => ['قاتل بـ' + N(n) + ' مرافقين مختلفين', 'Fight with ' + N(n) + ' different familiars'], m => Math.max(0, Object.keys(m.stats.companionsUsed || {}).filter(k => k !== 'none').length - 0));
  // — الصعوبة 10 —
  Data.STAGES.forEach((s, i) => A.push({ id: 'stage_' + s.id, cat: 'difficulty', icon: ['▦', '❄', '≋', '▲', '◉', '☁'][i] || '▲', n: 1, target: 1, ar: 'أكمل مرحلة ' + s.ar, en: 'Clear ' + s.en, dar: 'أكمل مرحلة ' + s.ar + ' بنجاح', den: 'Successfully clear ' + s.en, get: m => ((m.stats.stageClears || {})[s.id] || 0) }));
  mk('difficulty', '☠', 'mods', [3, 5], n => ['افز مع ' + N(n) + ' معدّلات صعوبة', 'Win with ' + N(n) + ' modifiers'], (m, n) => (m.stats['modsWin' + n] || 0));
  A.push({ id: 'weekly_win', cat: 'difficulty', icon: '⭐', n: 1, target: 1, ar: 'سيّد الأسبوع', en: 'Weekly Master', dar: 'أكمل تحدي الأسبوع', den: 'Complete the weekly challenge', get: m => (m.stats.weeklyWin || 0) });
  A.push({ id: 'monthly_win', cat: 'difficulty', icon: '🌙', n: 1, target: 1, ar: 'أسطورة الشهر', en: 'Monthly Legend', dar: 'أكمل تحدي الشهر', den: 'Complete the monthly challenge', get: m => (m.stats.monthlyWin || 0) });
  // — السرية 20 —
  const S = (id, icon, ar, en, dar, den, get) => A.push({ id, cat: 'secret', icon, n: 1, target: 1, ar, en, dar, den, get, secret: true });
  S('sec_dieFast', '💀', 'موت تعليمي', 'A Learning Death', 'مُت في أول 30 ثانية… يبدو أنك تعلمت درسًا', 'Die within the first 30 seconds', m => (m.stats.fastDeaths || 0));
  S('sec_still', '🗿', 'تمثال حي', 'Living Statue', 'ابقَ واقفًا 3 دقائق في جولة واحدة', 'Stand still for 3 minutes in one run', m => (m.stats.stillBest >= 180 ? 1 : 0));
  S('sec_clutch', '🃏', 'خروج من القبيرة', 'Out of the Grave', 'افز بجولة بعد أن كانت صحتك تحت 5%', 'Win a run after dropping below 5% HP', m => (m.stats.clutchWin || 0));
  S('sec_dualEvo', '⚔', 'سلاحان متطوران', 'Twin Ascendants', 'امتلك سلاحين متطورين في جولة واحدة', 'Own two evolved weapons in one run', m => (m.stats.dualEvo || 0));
  S('sec_burst200', '🌪', 'إبادة فورية', 'Instant Erasure', 'اقتل 200 عدو خلال 30 ثانية', 'Kill 200 enemies within 30 seconds', m => (m.stats.burst200 || 0));
  S('sec_zoo', '🐾', 'سفارية كاملة', 'Full Safari', 'قاتل بكل أنواع المرافقين الثمانية', 'Fight with all eight familiar types', m => (Object.keys(m.stats.companionsUsed || {}).filter(k => k !== 'none').length >= 8 ? 1 : 0));
  S('sec_charmer', '💗', 'قلوب مخلوعة', 'Bewitched Hearts', 'اقتل 50 عدوًا مسحورًا يقاتل في صفك', 'Kill 50 charmed enemies fighting for you', m => (m.stats.charmKills || 0));
  S('sec_shatter', '🔨', 'تكسير الجليد', 'Shattermaster', 'حطّم 100 عدو مجمّد بضربات البرق', 'Shatter 100 frozen enemies with lightning', m => (m.stats.shatters || 0));
  S('sec_cursedWin', '🕯', 'بركة ملعونة', 'Cursed Blessing', 'افز بجولة وأنت حامل قطعة ملعونة', 'Win a run while holding a cursed artifact', m => (m.stats.cursedWin || 0));
  S('sec_minimal', '🧘', 'زاهد', 'Ascetic', 'اوصل للمستوى 15 بسلاح البداية وحده', 'Reach level 15 with only your starting weapon', m => (m.stats.minimalist || 0));
  S('sec_photo', '📷', 'المصوّر الرسمي', 'Official Photographer', 'استخدم وضع التصوير', 'Use photo mode', m => (m.stats.photoUsed || 0));
  S('sec_export', '💾', 'أمانة الحفظ', 'Save Keeper', 'صدّر ملف حفظك', 'Export your save file', m => (m.stats.exportUsed || 0));
  S('sec_debug', '🐛', 'خلف الستارة', 'Behind the Curtain', 'افتح لوحة التصحيح', 'Open the debug panel', m => (m.stats.debugUsed || 0));
  S('sec_polyglot', '🌐', 'ثنائي اللسان', 'Polyglot', 'بدّل لغة اللعبة ذهابًا وإيابًا', 'Switch the game language', m => (m.stats.langSwitched || 0));
  S('sec_cat', '🐈', 'ربّ القطة', 'Cat Person', 'اقترب من القط الأسود 120 ثانية إجمالًا', 'Stay near the Shadow Cat for 120s total', m => Math.floor(m.stats.petCat || 0));
  S('sec_voidwalk', '◉', 'ما زلت هنا', 'Still Here', 'انجُ 15 دقيقة في الفراغ الأرجواني', 'Survive 15 minutes in the Purple Void', m => (m.stats.void15 || 0));
  S('sec_dash100', '💨', 'أرجل خفيفة', 'Fleet Feet', 'اندفع 100 مرة في جولة واحدة', 'Dash 100 times in one run', m => (m.stats.dashRunBest || 0));
  S('sec_talentMax', '🌳', 'فرع مكتمل', 'Full Branch', 'أكمل فرعًا كاملًا من شجرة المواهب', 'Max out one talent branch', m => (m.stats.talentMaxed || 0));
  S('sec_legend', '👑', 'أسلوب أسطوري', 'Legendary Style', 'ارتدِ سكينًا أسطوريًا', 'Equip a legendary skin', m => (m.stats.legendEquipped || 0));
  S('sec_skyWin', '☁', 'قمة السماء', 'Sky Summit', 'أكمل مرحلة قصر السماء', 'Clear the Sky Palace', m => (m.stats.skyWin || 0));
})();
// إصلاح أي رمز تالف محتمل في أسماء السرية
(function () { const a = Data.achievement('sec_minimal'); if (a && !/زاهد/.test(a.ar)) a.ar = 'زاهد'; })();
Log.log('Achievements total:', Data.ACHIEVEMENTS.length);

/* ─── التحديات: 20 يومية + 10 أسبوعية + 10 موسمية = 40 ─── */
const CD = (id, ev, ar, en, d, extra) => Object.assign({ id, ev, ar, en, d, period: 'daily', reward: 2 }, extra);
const CW = (id, ev, ar, en, w, extra) => Object.assign({ id, ev, ar, en, w, period: 'weekly', reward: 6 }, extra);
const CM = (id, ev, ar, en, m, extra) => Object.assign({ id, ev, ar, en, m, period: 'monthly', reward: 15 }, extra);
Data.CHALLENGE_DEFS = {
  daily: [
    CD('kills', 'kills', 'اقتل {n} عدوًا', 'Slay {n} enemies', [150, 600]),
    CD('gold', 'gold', 'اجمع {n} ذهبًا', 'Collect {n} gold', [120, 400]),
    CD('level', 'level', 'اوصل للمستوى {n}', 'Reach level {n}', [8, 14], { max: true }),
    CD('elite', 'elite', 'اقتل {n} من النخبة', 'Kill {n} elites', [3, 8]),
    CD('time', 'time', 'انجُ {n} دقائق في جولة', 'Survive {n} minutes', [4, 8], { max: true }),
    CD('boss', 'boss', 'اقتل {n} زعيمًا', 'Defeat {n} bosses', [1, 1]),
    CD('evolve', 'evolve', 'طوّر {n} سلاحًا', 'Evolve {n} weapons', [1, 1]),
    CD('chest', 'chest', 'افتح {n} صناديق', 'Open {n} chests', [2, 4]),
    CD('schoolkill', 'killSchool', 'اقتل {n} بأسلحة {s}', 'Kill {n} with {s} weapons', [60, 150], { school: true }),
    CD('dash', 'dash', 'اندفع {n} مرة', 'Dash {n} times', [30, 80]),
    CD('casts', 'casts', 'ألقِ {n} تعويذة', 'Cast {n} spells', [300, 800]),
    CD('heal', 'heal', 'استرجع {n} صحة', 'Restore {n} HP', [200, 600]),
    CD('fragment', 'fragment', 'اجمع {n} قطعة قديمة', 'Collect {n} fragments', [1, 1]),
    CD('mini', 'mini', 'اسحق {n} زعيمًا صغيرًا', 'Crush {n} mini-bosses', [1, 2]),
    CD('elemkill', 'elemKill', 'اقتل {n} بعنصر {s}', 'Kill {n} with {s} element', [80, 200], { school: true }),
    CD('burnkill', 'statusBurn', 'اقتل {n} عدو مشتعلًا', 'Kill {n} burning enemies', [40, 120]),
    CD('orbs', 'orbs', 'اجمع {n} جوهرة خبرة', 'Collect {n} XP orbs', [150, 400]),
    CD('familkill', 'familKill', 'ليقتل مرافقك {n} عدوًا', 'Your familiar kills {n} enemies', [30, 80]),
    CD('clean', 'clean', 'انجُ {n} دقائق دون ضرر', 'Go {n} minutes without damage', [2, 5], { max: true }),
    CD('fullhp', 'fullhp', 'ابقَ بصحة كاملة {n} دقائق', 'Stay at full HP for {n} minutes', [1, 3], { max: true })
  ],
  weekly: [
    CW('kills', 'kills', 'اقتل {n} عدوًا هذا الأسبوع', 'Slay {n} enemies this week', [800, 1500]),
    CW('level', 'level', 'اوصل للمستوى {n}', 'Reach level {n}', [15, 22], { max: true }),
    CW('time', 'time', 'انجُ {n} دقيقة في جولة', 'Survive {n} minutes', [10, 12], { max: true }),
    CW('boss', 'boss', 'اسحق {n} زعماء', 'Defeat {n} bosses', [2, 3]),
    CW('evolve', 'evolve', 'طوّر {n} أسلحة', 'Evolve {n} weapons', [2, 3]),
    CW('chest', 'chest', 'افتح {n} صناديق', 'Open {n} chests', [6, 10]),
    CW('schoolkill', 'killSchool', 'اقتل {n} بأسلحة {s}', 'Kill {n} with {s} weapons', [300, 500], { school: true }),
    CW('elite', 'elite', 'اصطد {n} من النخبة', 'Hunt {n} elites', [12, 20]),
    CW('casts', 'casts', 'ألقِ {n} تعويذة', 'Cast {n} spells', [2000, 4000]),
    CW('minis', 'mini', 'اسحق {n} زعماء صغار', 'Crush {n} mini-bosses', [3, 5])
  ],
  monthly: [
    CM('kills', 'kills', 'اقتل {n} عدوًا هذا الشهر', 'Slay {n} enemies this month', [5000, 5000]),
    CM('boss', 'boss', 'اسحق {n} زعماء', 'Defeat {n} bosses', [15, 15]),
    CM('level', 'level', 'اوصل للمستوى {n}', 'Reach level {n}', [35, 40], { max: true }),
    CM('time', 'time', 'انجُ {n} دقيقة', 'Survive {n} minutes', [15, 20], { max: true }),
    CM('evolve', 'evolve', 'طوّر {n} أسلحة', 'Evolve {n} weapons', [5, 5]),
    CM('fragment', 'fragment', 'اجمع {n} قطع قديمة', 'Collect {n} fragments', [5, 5]),
    CM('elite', 'elite', 'اصطد {n} من النخبة', 'Hunt {n} elites', [50, 50]),
    CM('mastery', 'mastery', 'اوصل لإتقان {n} في أي عنصر', 'Reach mastery {n} in any element', [5, 5], { max: true }),
    CM('victories', 'victories', 'افز بـ{n} جولات', 'Win {n} runs', [8, 12]),
    CM('shards', 'shards', 'اجمع {n} شظية روح', 'Earn {n} soul shards', [30, 30])
  ]
};
Data.CHALLENGE_TYPES = [].concat(Data.CHALLENGE_DEFS.daily, Data.CHALLENGE_DEFS.weekly, Data.CHALLENGE_DEFS.monthly);
Data.CHALLENGE_SCHOOLS = ['fire', 'ice', 'lightning', 'poison', 'dark', 'nature', 'arcane', 'void'];

// إعادة بناء Chal: ضمان + دمج + وصف بتشمل الموسمية
Chal.monthKey = function () { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };
Chal.ensure = function () {
  const M = Meta;
  if (!M.challenges) M.challenges = {};
  if (!M.challenges.daily || M.challenges.daily.date !== this.dayKey()) {
    const rng = U.mulberry32(U.hash32(this.dayKey()) ^ 0x9E3779B9);
    const pool = Data.CHALLENGE_DEFS.daily.slice();
    const list = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const T = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      list.push(this.mk(T, Math.round(U.lerp(T.d[0], T.d[1], rng())), T.reward, rng));
    }
    M.challenges.daily = { date: this.dayKey(), list };
    Save.mark();
  }
  if (!M.challenges.weekly || M.challenges.weekly.week !== this.weekKey()) {
    const rng = U.mulberry32(U.hash32(this.weekKey()) ^ 0x85EBCA6B);
    const pool = Data.CHALLENGE_DEFS.weekly.slice();
    const list = [];
    for (let i = 0; i < 2 && pool.length; i++) {
      const T = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      list.push(this.mk(T, Math.round(U.lerp(T.w[0], T.w[1], rng())), T.reward, rng));
    }
    M.challenges.weekly = { week: this.weekKey(), list };
    Save.mark();
  }
  if (!M.challenges.monthly || M.challenges.monthly.month !== this.monthKey()) {
    const rng = U.mulberry32(U.hash32(this.monthKey()) ^ 0xC2B2AE35);
    const pool = Data.CHALLENGE_DEFS.monthly.slice();
    const T = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    M.challenges.monthly = { month: this.monthKey(), list: [this.mk(T, Math.round(U.lerp(T.m[0], T.m[1], rng())), T.reward, rng)] };
    Save.mark();
  }
};
Chal.mk = function (T, n, reward, rng) {
  const it = { tid: T.id, n, prog: 0, done: false, reward };
  if (T.school) it.school = Data.CHALLENGE_SCHOOLS[Math.floor(rng() * Data.CHALLENGE_SCHOOLS.length)];
  return it;
};
Chal.desc = function (it) {
  const T = Data.CHALLENGE_TYPES.find(x => x.id === it.tid), ar = I18N.lang() === 'ar';
  if (!T) return it.tid;
  let s = ar ? T.ar : T.en;
  s = s.split('{n}').join(U.num(it.n));
  if (it.school) s = s.split('{s}').join(ar ? Data.SCHOOLS[it.school].ar : Data.SCHOOLS[it.school].en);
  return s;
};
Chal.mergeRun = function (r) {
  this.ensure();
  const cp = r.challengeProg, c = r.counters || {};
  const st = c.status || {};
  const val = (ev, it) => {
    switch (ev) {
      case 'kills': return cp.kills; case 'gold': return cp.gold;
      case 'level': return cp.level; case 'elite': return cp.elite;
      case 'time': return Math.floor(r.time / 60); case 'boss': return cp.boss;
      case 'evolve': return cp.evolve; case 'chest': return cp.chest;
      case 'killSchool': return (cp.killSchool || {})[it.school] || 0;
      case 'dash': return c.dashes || 0; case 'casts': return c.casts || 0;
      case 'heal': return Math.floor(c.heal || 0); case 'fragment': return c.frags || 0;
      case 'mini': return c.minis || 0;
      case 'elemKill': return (r.schoolKills || {})[it.school] || 0;
      case 'statusBurn': return st.burn || 0;
      case 'orbs': return c.orbs || 0; case 'familKill': return c.familKills || 0;
      case 'clean': return Math.floor((r.cleanBest || 0) / 60);
      case 'fullhp': return Math.floor((c.fullHp || 0) / 60);
      case 'mastery': { let mx = 0; const ed = (Meta.stats && Meta.stats.elemDmg) || {}; for (const k in ed) mx = Math.max(mx, Data.masteryLvl(ed[k])); return mx; }
      case 'victories': return r.win ? 1 : 0;
      case 'shards': return r.shards || 0;
      default: return 0;
    }
  };
  const defOf = (tid) => Data.CHALLENGE_TYPES.find(x => x.id === tid);
  const feed = (store, isMonthly) => {
    if (!store || !store.list) return;
    for (const it of store.list) {
      if (it.done) continue;
      const T = defOf(it.tid); if (!T) continue;
      const v = val(T.ev, it);
      if (T.max) it.prog = Math.max(it.prog, v); else it.prog += v;
      if (it.prog >= it.n) {
        it.done = true; Meta.shards += it.reward;
        Meta.stats.challengesDone = (Meta.stats.challengesDone || 0) + 1;
        if (store === Meta.challenges.daily) Meta.stats.dailiesDone = (Meta.stats.dailiesDone || 0) + 1;
        if (store === Meta.challenges.weekly) Meta.stats.weeklyWin = 1;
        if (isMonthly) Meta.stats.monthlyWin = (Meta.stats.monthlyWin || 0) + 1;
        UI.toast(t('challengeDone') + ' +' + U.num(it.reward) + ' ' + t('shardPickup'), 'gold');
        Audio.sfx('unlock');
      }
    }
  };
  feed(Meta.challenges.daily, false); feed(Meta.challenges.weekly, false); feed(Meta.challenges.monthly, true);
  Save.mark();
};
/* ═══════════ v2.1 — Systems: حفظ موسّع + إحصاءات كاملة + متجر دائم + خزانة + إتقان ═══════════ */

// ─── توسعة هيكل الحفظ الافتراضي (توافق تام مع الحفظ القديم عبر الدمج العميق) ───
(function () {
  const oldDefaults = Save.defaults.bind(Save);
  Save.defaults = function () {
    const d = oldDefaults();
    d.permUpgrades = {};
    d.cosmetics = { skins: [], trails: ['tr_none'], colors: ['cl_default'], equipped: { skin: null, trail: 'tr_none', color: 'cl_default' } };
    d.challenges.monthly = { month: '', list: [] };
    Object.assign(d.stats, {
      casts: 0, dashes: 0, dmgDealt: 0, healTotal: 0, blocks: 0, dodges: 0, lsTotal: 0, thornsDmg: 0, secondWinds: 0,
      minis: 0, perfectBoss: 0, cleanBest: 0, fullHpTime: 0, clutch: 0, clutchWin: 0, lowHpSurvive: 0,
      winStreak: 0, streakBest: 0, days: {}, synFound: {}, synRunBest: 0, synKills: 0, synActive: 0,
      legendaries: 0, cursedRunBest: 0, artRunBest: 0, fragments: {},
      elemDmg: {}, permLevels: 0, goldSpent: 0, classesPlayed: {}, classWins: {},
      modsWin3: 0, modsWin5: 0, weeklyWin: 0, monthlyWin: 0,
      fastDeaths: 0, stillBest: 0, dualEvo: 0, burst200: 0, charmKills: 0, shatters: 0, cursedWin: 0,
      minimalist: 0, photoUsed: 0, exportUsed: 0, debugUsed: 0, langSwitched: 0, petCat: 0,
      void15: 0, dashRunBest: 0, talentMaxed: 0, legendEquipped: 0, skyWin: 0, armorBest: 0, statusKills: {}
    });
    return d;
  };
})();

// ─── عدّادات الجولة الحية (تُدمج في الحفظ عند نهاية الجولة) ───
Combat.getCounters = function (r) {
  if (!r.counters) r.counters = { casts: 0, dashes: 0, dmg: 0, heal: 0, blocks: 0, dodges: 0, ls: 0, thorns: 0, status: {}, fullHp: 0, still: 0, minis: 0, frags: 0, orbs: 0, familKills: 0, clean: 0, burstK: 0, burstT: 0 };
  return r.counters;
};

// ─── إتقان العناصر: تسجيل الضرر لكل عنصر (يُحفظ مباشرة في الميتا) ───
Combat.addMastery = function (school, dmg) {
  if (!school || school === 'physical' || dmg <= 0) return;
  const ed = Meta.stats.elemDmg = Meta.stats.elemDmg || {};
  ed[school] = (ed[school] || 0) + dmg;
  if ((ed[school] | 0) % 400 === 0) Save.mark();
};

// ─── إعادة حساب الإحصاءات v2.1: الشخصية + المواهب + المتجر الدائم + الإتقان + العناصر ───
Combat.recalcStats = function (r) {
  const c = Data.char(r.charId);
  const s = {
    maxHp: c.hp, ms: c.speed, dmg: 1, cdRed: 0, area: 1, projSpeed: 1, amount: 0,
    crit: 0.05, critDmg: 1.5, pickup: 70, xp: 1, luck: 0, armor: 0, regen: 0.2,
    gold: 1, dashCd: 2.2, dodge: 0, dmgBoss: 1, dmgElite: 1, revive: 0, schoolMult: {}, freezeHit: 0,
    // v2.1
    lifesteal: 0, thorns: 0, block: 0, exec: 0, elemResist: 0, duration: 0, burnPower: 1, poisonPower: 1,
    slowAura: 0, lowHp: 0, curseHit: 0, compDmg: 0, chain: 0, healLv: 0, goldFind: 0, xpHunt: 0, secondWind: 0
  };
  // المواهب (شجرة الشخصية)
  const applyTalent = (branch, lvl) => {
    const B = Data.TALENT_BRANCHES.find(b => b.id === branch);
    for (let i = 0; i < Math.min(lvl, 4); i++) {
      const n = B.nodes[i];
      if (n.k === 'dmg') s.dmg += n.v; else if (n.k === 'crit') s.crit += n.v;
      else if (n.k === 'area') s.area += n.v; else if (n.k === 'ms') s.ms *= (1 + n.v);
      else if (n.k === 'dash') s.dashCd *= (1 - n.v); else if (n.k === 'cd') s.cdRed += n.v;
      else if (n.k === 'xp') s.xp += n.v; else if (n.k === 'pickup') s.pickup *= (1 + n.v);
      else if (n.k === 'luck') s.luck += n.v; else if (n.k === 'gold') s.gold += n.v;
    }
  };
  const tl = Meta.talents[r.charId] || {};
  applyTalent('power', tl.power || 0); applyTalent('speed', tl.speed || 0); applyTalent('wisdom', tl.wisdom || 0);
  // ميزات الشخصية (ميزتان لكل شخصية + كلفة اختيارية)
  const perks = (c.perks && c.perks.length ? c.perks : (c.perk ? [c.perk] : []));
  for (const pk of perks) Combat.applyPerk(s, pk);
  if (c.drawback) Combat.applyPerk(s, c.drawback);
  // المتجر الدائم
  const pu = Meta.permUpgrades || {};
  for (const P of Data.PERM_UPGRADES) {
    const lv = pu[P.id] || 0; if (!lv) continue;
    const v = P.per * lv;
    if (P.k === 'hp') s.maxHp += v; else if (P.k === 'dmg') s.dmg += v;
    else if (P.k === 'cdRed') s.cdRed += v; else if (P.k === 'ms') s.ms *= (1 + v);
    else if (P.k === 'armor') s.armor += v; else if (P.k === 'regen') s.regen += v;
    else if (P.k === 'crit') s.crit += v; else if (P.k === 'xp') s.xp += v;
    else if (P.k === 'luck') s.luck += v; else if (P.k === 'pickup') s.pickup *= (1 + v);
    else if (P.k === 'dashCd') s.dashCd *= (1 - v); else if (P.k === 'lifesteal') s.lifesteal += v;
    else if (P.k === 'thorns') s.thorns += v; else if (P.k === 'dodge') s.dodge += v;
    else if (P.k === 'block') s.block += v; else if (P.k === 'elemResist') s.elemResist += v;
    else if (P.k === 'projSpeed') s.projSpeed += v; else if (P.k === 'area') s.area += v;
    else if (P.k === 'duration') s.duration += v; else if (P.k === 'critDmg') s.critDmg += v;
    else if (P.k === 'exec') s.exec += v; else if (P.k === 'secondWind') s.secondWind += v;
    else if (P.k === 'goldFind') s.goldFind += v; else if (P.k === 'xpHunt') s.xpHunt += v;
  }
  // التمارين السلبية داخل الجولة
  for (const pid in r.passives) {
    const P = Data.passive(pid), lv = r.passives[pid]; if (!P) continue;
    if (P.k === 'dmg') s.dmg += P.per * lv; else if (P.k === 'cd') s.cdRed += P.per * lv;
    else if (P.k === 'area') s.area += P.per * lv; else if (P.k === 'ms') s.ms *= (1 + P.per * lv);
    else if (P.k === 'armor') s.armor += P.per * lv; else if (P.k === 'regen') s.regen += P.per * lv;
    else if (P.k === 'crit') s.crit += P.per * lv; else if (P.k === 'xp') s.xp += P.per * lv;
    else if (P.k === 'pickup') s.pickup *= (1 + P.per * lv); else if (P.k === 'luck') s.luck += P.per * lv;
    else if (P.k === 'hp') s.maxHp += P.per * lv; else if (P.k === 'amount') s.amount += P.per * lv;
  }
  // القطع الأثرية: إحصاء أو خطّاف أو كلفة
  r.hooks = {};
  for (const aid of r.artifacts) {
    const a = Data.artifact(aid); if (!a) continue;
    if (a.k) {
      if (a.k === 'school') s.schoolMult[a.sk] = (s.schoolMult[a.sk] || 1) + a.v;
      else if (a.k === 'ms') s.ms *= (1 + a.v); else if (a.k === 'pickup') s.pickup *= (1 + a.v);
      else if (a.k === 'dashCd') s.dashCd *= (1 - a.v);
      else if (a.k === 'cdRed') s.cdRed += a.v;
      else if (a.k === 'lifesteal') s.lifesteal += a.v;
      else if (a.k === 'block') s.block += a.v;
      else s[a.k] = (s[a.k] || 0) + a.v;
    }
    if (a.hpPenalty) s.maxHp = Math.floor(s.maxHp * (1 + a.hpPenalty));
    if (a.hook) r.hooks[a.hook] = (r.hooks[a.hook] || 0) + (a.v2 !== undefined && a.hook !== 'lifesteal' && a.hook !== 'thorns' && a.hook !== 'shield30' ? a.v2 : a.v);
    if (a.hook === 'lifesteal' || a.hook === 'thorns' || a.hook === 'shield30') r.hooks[a.hook] = Math.max(r.hooks[a.hook], a.v);
  }
  // إتقان العناصر: +1% ضرر لكل مستوى إتقان بمدرسة العنصر
  const ed = (Meta.stats && Meta.stats.elemDmg) || {};
  for (const el in ed) {
    const m = Data.masteryLvl(ed[el]);
    if (m > 0) s.schoolMult[el] = (s.schoolMult[el] || 1) + m * 0.01;
  }
  // التزامنات النشطة
  r.syn = {}; r.synProcs = {};
  const schools = {};
  for (const w of r.weapons) schools[w.def.school] = (schools[w.def.school] || 0) + 1;
  for (const syn of Data.SYNERGIES) {
    let on = false;
    if (syn.req.schools) on = syn.req.schools.every(sc => schools[sc] > 0);
    else if (syn.req.schoolsAny) on = Object.keys(schools).length >= syn.req.schoolsAny;
    if (on) {
      r.syn[syn.id] = true;
      if (syn.proc) r.synProcs[syn.proc] = { t: 0 };
      Meta.stats.synFound[syn.id] = true;
      const ef = syn.eff;
      if (ef.type === 'stat') {
        if (ef.k === 'dmg') s.dmg += ef.v; else if (ef.k === 'area') s.area += ef.v;
        else if (ef.k === 'crit') s.crit += ef.v; else if (ef.k === 'projSpeed') s.projSpeed += ef.v;
        else if (ef.k === 'regen') s.regen += ef.v; else if (ef.k === 'dmgBoss') s.dmgBoss += ef.v;
        else if (ef.k === 'xp') s.xp += ef.v; else if (ef.k === 'amount') s.amount += ef.v;
        else if (ef.k === 'luck') s.luck += ef.v;
      } else if (ef.type === 'flag') r.hooks[ef.flag] = (r.hooks[ef.flag] || 0) + ef.v;
    }
  }
  if (r.mods.glass) s.maxHp = Math.floor(s.maxHp * 0.7);
  if (r.hooks.glass) s.maxHp = Math.floor(s.maxHp * 0.8);
  if (r.hooks.noRevive) s.revive = 0;
  if (r.hooks.goldCurse) s.gold *= (1 - r.hooks.goldCurse);
  s.dodge = Math.min(0.6, s.dodge); s.block = Math.min(0.5, s.block); s.elemResist = Math.min(0.75, s.elemResist);
  const oldMax = r.stats.maxHp;
  r.stats = s;
  if (oldMax && s.maxHp > oldMax) r.player.hp += s.maxHp - oldMax;
  r.player.hp = Math.min(r.player.hp, s.maxHp);
  Meta.stats.armorBest = Math.max(Meta.stats.armorBest || 0, s.armor);
};

// تطبيق مفتاح ميزة موحّد
Combat.applyPerk = function (s, pk) {
  if (!pk) return;
  const v = pk.v || 0;
  switch (pk.k) {
    case 'school': s.schoolMult[pk.sk] = (s.schoolMult[pk.sk] || 1) + v; break;
    case 'xp': s.xp += v; break; case 'crit': s.crit += v; break;
    case 'regen': s.regen += v; break; case 'armor': s.armor += v; break;
    case 'luck': s.luck += v; break; case 'projSpeed': s.projSpeed += v; break;
    case 'dashCd': s.dashCd *= (1 - v); break; case 'freezeHit': s.freezeHit += v; break;
    case 'cd': s.cdRed += v; break; case 'area': s.area += v; break;
    case 'dmg': s.dmg += v; break; case 'hp': s.maxHp += v; break;
    case 'block': s.block += v; break; case 'lifesteal': s.lifesteal += v; break;
    case 'exec': s.exec += v; break; case 'compDmg': s.compDmg += v; break;
    case 'burnPower': s.burnPower += v; break; case 'poisonPower': s.poisonPower += v; break;
    case 'slowAura': s.slowAura += v; break; case 'lowHp': s.lowHp += v; break;
    case 'curseHit': s.curseHit += v; break; case 'chain': s.chain += v; break;
    case 'healLv': s.healLv += v; break;
  }
};

// ─── المتجر الدائم: شراء مستوى ───
const Shop = AS.Shop = {
  buy(p) {
    const lv = Meta.permUpgrades[p.id] || 0;
    if (lv >= p.max) return false;
    const cost = Data.permCost(p, lv);
    if (Meta.gold < cost) return false;
    Meta.gold -= cost;
    Meta.stats.goldSpent = (Meta.stats.goldSpent || 0) + cost;
    Meta.stats.permLevels = (Meta.stats.permLevels || 0) + 1;
    Meta.permUpgrades[p.id] = lv + 1;
    Save.mark(); Audio.sfx('unlock');
    return true;
  }
};

// ─── الخزانة: شراء وارتداء الكوزمتك ───
const Wardrobe = AS.Wardrobe = {
  owns(kind, id) { const cs = Meta.cosmetics; return kind === 'skins' ? cs.skins.includes(id) : kind === 'trails' ? cs.trails.includes(id) : kind === 'colors' ? cs.colors.includes(id) : false; },
  buy(kind, item) {
    if (this.owns(kind, item.id)) return true;
    const cost = item.cost || 0;
    if (item.cur === 'shards') { if (Meta.shards < cost) return false; Meta.shards -= cost; }
    else { if (Meta.gold < cost) return false; Meta.gold -= cost; }
    Meta.stats.goldSpent = (Meta.stats.goldSpent || 0) + (item.cur === 'shards' ? 0 : cost);
    Meta.cosmetics[kind].push(item.id);
    Save.mark(); Audio.sfx('unlock');
    return true;
  },
  equip(kind, id) {
    if (!this.owns(kind, id)) return;
    Meta.cosmetics.equipped[kind === 'skins' ? 'skin' : kind === 'trails' ? 'trail' : 'color'] = id;
    if (kind === 'skins') { const sk = Data.skin(id); if (sk && sk.leg) Meta.stats.legendEquipped = 1; }
    Save.mark(); Audio.sfx('click');
  },
  // اللون الفعلي للمقذوفات (لون السحر المُرتدى)
  spellTint() {
    const id = Meta.cosmetics && Meta.cosmetics.equipped.color;
    const c = id && Data.spellColor(id);
    return c && c.color ? c.color : null;
  }
};

// ─── مدة التأثير: تمديد عمر الحقول والبرك بالمدة المكتسبة ───
(function () {
  const sp = Combat.spawnProj.bind(Combat);
  Combat.spawnProj = function (o) {
    const p = sp(o);
    if (p) {
      const r = Game.run;
      if (r && (o.kind === 'mine' || o.kind === 'pool') && r.stats.duration) { p.life += p.maxLife * r.stats.duration; p.maxLife = p.life; }
      if (p.kind === 'mine' && o.w && o.w.def && o.w.def.mineMode && p.mode === 'boom') p.mode = o.w.def.mineMode;
    }
    return p;
  };
})();

// ─── خيارات الارتقاء: تضيف القطع الأثرية (والمحفزات المطلوبة للتطوير) ───
(function () {
  const gen = Prog.generateOptions.bind(Prog);
  Prog.generateOptions = function () {
    const opts = gen();
    const r = Game.run;
    if (r) {
      const pool = Data.ARTIFACTS.filter(a => !r.artifacts.includes(a.id) && !r.banished.includes('art:' + a.id));
      // فرصة 30% لتحل قطعة أثرية محل خيار واحد (مهم للمحفزات والتطور)
      if (opts.length >= 3 && pool.length && Math.random() < 0.3) {
        const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        opts[opts.length - 1] = { kind: 'art', id: a.id };
      }
      while (opts.length < 4 && pool.length) {
        const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        opts.push({ kind: 'art', id: a.id });
      }
    }
    return opts;
  };
  const choose = Prog.choose.bind(Prog);
  Prog.choose = function (opt) {
    if (opt.kind === 'art') {
      const r = Game.run, a = Data.artifact(opt.id);
      if (a && !r.artifacts.includes(a.id)) {
        r.artifacts.push(a.id);
        Meta.stats.artifactsFound[a.id] = true;
        if (a.rar === 'leg') Meta.stats.legendaries = (Meta.stats.legendaries || 0) + 1;
        Combat.recalcStats(r);
        Audio.sfx('unlock');
        UI.toast((I18N.lang() === 'ar' ? a.ar : a.en) + ' — ' + t('newUnlock'), a.cursed ? 'bad' : 'gold');
      }
      r.lockedId = null;
      r.pendingLv = Math.max(0, r.pendingLv - 1);
      Save.mark(); UI.closeLevelup();
      if (r.pendingLv > 0) UI.openLevelup();
      return;
    }
    choose(opt);
  };
  // اسم الخيار يشمل القطع
  const optName = Prog.optName.bind(Prog);
  Prog.optName = function (opt) {
    if (opt.kind === 'art') { const a = Data.artifact(opt.id); return a ? (I18N.lang() === 'ar' ? a.ar : a.en) : '?'; }
    return optName(opt);
  };
})();

// ─── الصناديق: وزن بالندرة + إظهار اللعنة ───
Prog.openChest = function (orb) {
  const r = Game.run;
  Game.setState('chest');
  Audio.sfx('chest'); UI.haptic(50);
  const rewards = [];
  const roll = () => {
    const x = Math.random();
    if (x < 0.42) {
      const ups = r.weapons.filter(w => !w.evolved && w.lv < w.def.maxLv);
      if (ups.length) { const w = U.pick(ups); w.lv++; return { kind: 'up', ar: 'ترقية: ' + w.def.ar, en: 'Upgrade: ' + w.def.en, sub: '+' + U.num(w.lv) }; }
      return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 80 };
    }
    if (x < 0.78) {
      const pool = Data.ARTIFACTS.filter(a => !r.artifacts.includes(a.id));
      if (pool.length) {
        const a = U.weighted(pool.map(p => [p, p.rar === 'leg' ? 0.25 : p.rar === 'epic' ? 0.6 : 1]));
        r.artifacts.push(a.id);
        Meta.stats.artifactsFound[a.id] = true;
        if (a.rar === 'leg') Meta.stats.legendaries = (Meta.stats.legendaries || 0) + 1;
        Combat.recalcStats(r);
        return { kind: 'art', ar: a.ar, en: a.en, sub: artDesc(a), cursed: !!(a.cursed || a.hpPenalty), rar: a.rar };
      }
      return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 100 };
    }
    return { kind: 'gold', ar: 'ذهب', en: 'Gold', val: 60 + Math.floor(Math.random() * 90) };
  };
  rewards.push(roll());
  if (r.hooks.luckyChest && Math.random() < r.hooks.luckyChest) rewards.push(roll());
  for (const rw of rewards) if (rw.kind === 'gold') { const g = Math.round(rw.val * r.stats.gold); r.gold += g; r.goldRun += g; r.challengeProg.gold += g; }
  r.challengeProg.chest++;
  Save.mark();
  UI.showChest(rewards);
};