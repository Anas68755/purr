
/* ══════════════════════ Utils/ — المرافق الأساسية ══════════════════════ */
// الجذر الموحد للعبة: كل الوحدات تتعلق هنا (Namespaces بدل IIFE عملاق)
window.AS = { V: '2.0.0' };

// ─── المسجّل: بديل آمن عن console مع مخزن حلقي للوحة التصحيح ───
const Log = {
  buf: [], max: 60,
  push(kind, msg) { this.buf.push({ k: kind, m: msg, t: Date.now() }); if (this.buf.length > this.max) this.buf.shift(); },
  log(...a) { this.push('i', a.join(' ')); },
  warn(...a) { this.push('w', a.join(' ')); try { console.warn('[AS]', ...a); } catch (e) { } },
  error(...a) { this.push('e', a.join(' ')); try { console.error('[AS]', ...a); } catch (e) { } }
};

// ─── أدوات رياضية وتنسيق ───
const U = {
  TAU: Math.PI * 2,
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  // مولد عشوائي مقعّد (mulberry32) لعالم قابل للتوليد المتكرر
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  pick(arr, rng) { return arr[Math.floor((rng || Math.random)() * arr.length)]; },
  // اختيار موزون: مصفوفة [قيمة, وزن]
  weighted(pairs, rng) {
    let tot = 0; for (const p of pairs) tot += p[1];
    let r = (rng || Math.random)() * tot;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  },
  fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); },
  // هاش صحيح للبذور المقبّدة (التحديات اليومية/الأسبوعية والخلافها)
  hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  // أرقام بالصيغة العربية أو اللاتينية حسب اللغة
  num(n) {
    n = Math.floor(n);
    try { return n.toLocaleString(AS.I18N && AS.I18N.lang() === 'ar' ? 'ar-EG' : 'en-US'); } catch (e) { return '' + n; }
  },
  // أرقام عشرية بنفس قاعدة اللغة (لأزمنة التبريد مثلًا)
  numF(n, d) {
    try { return n.toLocaleString(AS.I18N && AS.I18N.lang() === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: d === undefined ? 1 : d, maximumFractionDigits: d === undefined ? 1 : d }); } catch (e) { return String(n); }
  },
  // تنسيق الوقت mm:ss
  time(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    const mm = this.num(m), ss = (s < 10 ? '0' : '') + this.num(s);
    return mm + ':' + ss;
  },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
};

// ─── ناقل الأحداث: فصل الأنظمة عن بعضها ───
const Bus = {
  map: new Map(),
  on(ev, fn) { if (!this.map.has(ev)) this.map.set(ev, []); this.map.get(ev).push(fn); },
  off(ev, fn) { const a = this.map.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  emit(ev, data) { const a = this.map.get(ev); if (a) for (let i = 0; i < a.length; i++) { try { a[i](data); } catch (e) { Log.error('Bus', ev, e && e.message); } } }
};

// ─── التجزئة المكانية: تسريع كل عمليات التصادم ───
class SpatialHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  insert(e) {
    const k = Math.floor(e.x / this.cell) + ',' + Math.floor(e.y / this.cell);
    let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); }
    a.push(e);
  }
  // يجمع المرشحين داخل دائرة (x,y,r) في المصفوفة المعطاة
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.map.get(cx + ',' + cy);
      if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  }
}

// ─── مجمّع الكائنات: يمنع الضغط على جامع القمامة ───
class Pool {
  constructor(cap, factory) {
    this.cap = cap; this.factory = factory; this.items = []; this.free = [];
    for (let i = 0; i < cap; i++) { const o = factory(); o.active = false; this.items.push(o); this.free.push(o); }
  }
  get() {
    let o = this.free.pop();
    if (!o) { if (this.items.length >= Math.floor(this.cap * 1.5)) return null; o = this.factory(); o.active = false; this.items.push(o); }
    o.active = true; return o;
  }
  release(o) { if (o && o.active) { o.active = false; this.free.push(o); } }
  count() { return this.items.length - this.free.length; }
  forEach(fn) { for (let i = 0; i < this.items.length; i++) { const o = this.items[i]; if (o.active) fn(o); } }
}

/* ══════════════════════ Core/ — حلقة اللعب والمجمعات ══════════════════════ */
const Core = {
  STEP: 1 / 60, // خطوة فيزياء ثابتة 60Hz
  Loop: {
    running: false, last: 0, acc: 0, alpha: 0, fps: 60, _frames: 0, _fpsT: 0,
    start() { this.running = true; this.last = performance.now(); this.acc = 0; requestAnimationFrame(Core.Loop.tick); },
    stop() { this.running = false; },
    tick(t) {
      const L = Core.Loop; if (!L.running) return;
      let dt = (t - L.last) / 1000; L.last = t;
      if (dt > 0.25) dt = 0.25; // كبح انفجار الزمن بعد تبديل التبويب
      L.acc += dt;
      let steps = 0;
      while (L.acc >= Core.STEP && steps < 5) { Game.fixedUpdate(Core.STEP); L.acc -= Core.STEP; steps++; }
      if (steps === 5) L.acc = 0; // تفريغ الأمان تحت الأداء الضاغط
      L.alpha = L.acc / Core.STEP;
      // عدّاد الإطارات
      L._frames++; L._fpsT += dt;
      if (L._fpsT >= 0.5) { L.fps = Math.round(L._frames / L._fpsT); L._frames = 0; L._fpsT = 0; Bus.emit('fps', L.fps); }
      // مجدول الموسيقى يعمل مع rAF دائمًا (بدل setInterval)
      if (AS.Audio) Audio.frame(dt);
      if (AS.Render) Render.draw(L.alpha, dt);
      requestAnimationFrame(Core.Loop.tick);
    }
  },
  // مجمّعات الكائنات المشتركة
  pools: {
    enemies: new Pool(420, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, hp: 0, maxHp: 0, r: 12, def: null, elite: null, state: 'walk', stateT: 0, touchCd: 0, flash: 0, freezeT: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, shockT: 0, animT: 0, isBoss: false, phase: 0, patT: 0, patIdx: 0, slowT: 0, uid: 0 })),
    proj: new Pool(560, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 8, dmg: 0, pierce: 0, life: 0, maxLife: 0, kind: 'straight', school: 'arcane', color: '#fff', w: null, hits: new Set(), angle: 0, spin: 0, home: 0, baseVx: 0, baseVy: 0, phase: 0, z: 0, tick: 0, size: 1, hitCd: 0 })),
    eproj: new Pool(360, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 7, dmg: 0, life: 0, color: '#f66', kind: 'ball' })),
    parts: new Pool(1100, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 3, color: '#fff', type: 'spark', grav: 0, drag: 0.98, x2: 0, y2: 0, a: 1 })),
    texts: new Pool(240, () => ({ active: false, x: 0, y: 0, vy: -46, life: 0, maxLife: 0.9, txt: '', color: '#fff', size: 15 })),
    orbs: new Pool(460, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, val: 1, type: 'xp', r: 6, magnet: false }))
  },
  // إعادة ضبط مواضع interpolation قبل كل خطوة فيزياء
  snapshot() {
    const p = this.pools;
    p.enemies.forEach(e => { e.px = e.x; e.py = e.y; });
    p.proj.forEach(o => { o.px = o.x; o.py = o.y; });
    p.eproj.forEach(o => { o.px = o.x; o.py = o.y; });
    p.orbs.forEach(o => { o.px = o.x; o.py = o.y; });
  },
  resetPools() {
    for (const k in this.pools) { const P = this.pools[k]; for (const o of P.items) { o.active = false; P.free.length = 0; } for (const o of P.items) P.free.push(o); }
  },
  uidSeq: 1
};
AS.Core = Core; AS.Log = Log; AS.U = U; AS.Bus = Bus;
/* ══════════════════════ Data/I18N — الترجمة المركزية ══════════════════════ */
const I18N = {
  _lang: 'ar',
  lang() { return this._lang; },
  t(key) {
    const d = this.dict[this._lang];
    return (d && d[key] !== undefined) ? d[key] : (this.dict.en[key] !== undefined ? this.dict.en[key] : key);
  },
  // تنسيق نص يحتوي {n} برقم مترجم
  tf(key, n) { return this.t(key).replace('{n}', U.num(n)); },
  setLang(l) {
    this._lang = l;
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('as_lang', l); } catch (e) { }
    Bus.emit('langChanged', l);
  },
  apply(root) {
    (root || document).querySelectorAll('[data-i]').forEach(el => { const k = el.getAttribute('data-i'); el.textContent = this.t(k); });
  },
  dict: {
    ar: {
      loading: 'جارِ التحميل…', tagline: 'انجُ من الموجات اللانهائية وأطلق سحر كانونك',
      play: 'ابدأ اللعب', characters: 'الشخصيات', talents: 'المواهب', codex: 'الموسوعة', achievements: 'الإنجازات',
      challenges: 'التحديات', history: 'السجل', settings: 'الإعدادات', install: 'ثبّت كتطبيق', made: 'لعبة ويب مستقلة بملف واحد',
      selectStage: 'اختر المرحلة', selectChar: 'اختر شخصيتك', selectCompanion: 'المرافق:', next: 'التالي: التعديلات',
      back: 'رجوع', modsTitle: 'معدّلات الصعوبة', rewardMult: 'مضاعف المكافآت:', startRun: 'ابدأ الجولة',
      levelupTitle: 'ارتقاء! اختر ترقية', banish: 'نَفِ الخيار', skip: 'تخطَّ (+50 خبرة)', banishHint: 'النَّفْي متاح كل 3 مستويات',
      chestTitle: 'صندوق كنز!', collect: 'استلم', paused: 'توقّف مؤقت', resume: 'استئناف', photoMode: 'وضع التصوير', abandon: 'اهجر الجولة',
      retry: 'جولة جديدة', share: 'شارك البطاقة', menu: 'القائمة', victory: 'انتصار!', defeat: 'سقطت في المعركة…', stageCleared: 'اكتملت المرحلة!',
      sfxVol: 'مستوى المؤثرات', musicVol: 'مستوى الموسيقى', perfMode: 'وضع الأداء (جزيئات أقل)', showFps: 'عرض عداد الإطارات',
      haptics: 'الاهتزاز اللمسي', screenShake: 'اهتزاز الشاشة', autoaim: 'التصويب التلقائي', batterySaver: 'توفير البطارية تلقائيًا',
      uiScale: 'حجم الواجهة', deadzone: 'المنطقة الميتة للعصا', fullscreen: 'ملء الشاشة', toggle: 'تبديل', debugNote: 'لوحة التصحيح (زر ~)',
      exportSave: 'تصدير الحفظ', exportB: 'تصدير', importSave: 'استيراد الحفظ', resetSave: 'مسح كل التقدم', resetB: 'مسح',
      codexEnemies: 'الأعداء', codexBosses: 'الزعماء', codexWeapons: 'الأسلحة', codexArtifacts: 'القطع',
      daily: 'اليومية', weekly: 'الأسبوعية', runsTab: 'الجولات', lbTab: 'لوحة الصدارة',
      yes: 'نعم', cancel: 'إلغاء', lvl: 'مستوى', time: 'الوقت', kills: 'القتلات', level: 'المستوى', goldEarned: 'الذهب', shardsEarned: 'الشظايا', score: 'النقاط',
      bestTime: 'أفضل زمن', danger: 'الخطر', locked: 'مقفل', unlockBy: 'تُفتح بإكمال المرحلة السابقة', startWeapon: 'سلاح البداية',
      perk: 'ميزة', unlockGold: 'اشترِ بـ{n} ذهب', unlockShards: 'اشترِ بـ{n} شظية', buy: 'شراء', notEnough: 'الموارد غير كافية',
      kindEvo: 'تطور أسلحة!', kindNew: 'سلاح جديد', kindUp: 'ترقية سلاح', kindPassive: 'تمرين', kindGold: 'مكافأة',
      maxed: 'أقصى مستوى', evolutionReady: 'تطور جاهز!', newUnlock: 'فتح جديد!', stageUnlocked: 'فُتحت مرحلة جديدة!',
      charUnlocked: 'فُتحت شخصية جديدة!', companionJoined: 'انضم مرافقك إلى المعركة!', notEnoughGold: 'لا يوجد ذهب كافٍ',
      achievementUnlocked: 'إنجاز مكتمل', challengeDone: 'تحدي مكتمل', saved: 'حُفظ', imported: 'تم استيراد الحفظ', importFailed: 'ملف الحفظ غير صالح',
      revived: 'بعثك التعويذة من جديد!', bossIncoming: 'الزعيم يقترب…', swarm: 'موجة غزيرة قادمة!', howto: 'اسحب للحركة — اندفع لتفادي الحشر',
      confirmReset: 'سيُمسح كل تقدمك الدائم نهائيًا. هل أنت متأكد؟', confirmAbandon: 'ستخسر تقدم هذه الجولة. متابعة؟',
      noRuns: 'لا جولات بعد — ابدأ مغامرتك!', noLb: 'لوحة الصدارة فارغة بعد', newRecord: 'رقم قياسي جديد!',
      achSummary: 'مكتمل {n}', codexLocked: '؟؟؟', discovered: 'مكتشف {n}', undiscovered: 'لم يُكتشف بعد',
      talentBuy: 'طوّر', talentMax: 'مكتمل', talentLockedChar: 'افتح الشخصية أولًا', weeklyBanner: 'تحدي الأسبوع يفرض هذه المعدلات — مكافآت مضاعفة!',
      weeklyNone: 'أكمل التحدي الأسبوعي للحصول على شظايا إضافية', dailyReset: 'تتجدد التحديات اليومية عند منتصف الليل', weeklyReset: 'تتجدد التحديات الأسبوعية كل اثنين',
      goldPickup: 'ذهب', healPickup: 'شفاء', shardPickup: 'شظية سحرية', chestFromElite: 'أسقط النخبة صندوقًا!',
      photoSaved: 'حُفظت اللقطة', shareSaved: 'حُفظت بطاقة المشاركة', exported: 'نُزّل ملف الحفظ', weaponSlotsFull: 'فتحات الأسلحة ممتلئة',
      summon: 'استدعاء', phaseChange: 'الزعيم يستشيط غضبًا!', endless: 'لا نهائي', waveN: 'الموجة {n}',
      batteryOn: 'بطارية منخفضة — تفعيل وضع الأداء', totalAch: 'الإنجازات'
    },
    en: {
      loading: 'Loading…', tagline: 'Survive endless waves and unleash your arcane arsenal',
      play: 'Play', characters: 'Characters', talents: 'Talents', codex: 'Codex', achievements: 'Achievements',
      challenges: 'Challenges', history: 'History', settings: 'Settings', install: 'Install App', made: 'Standalone single-file web game',
      selectStage: 'Select Stage', selectChar: 'Choose Your Hero', selectCompanion: 'Companion:', next: 'Next: Modifiers',
      back: 'Back', modsTitle: 'Difficulty Modifiers', rewardMult: 'Reward Multiplier:', startRun: 'Start Run',
      levelupTitle: 'Level Up! Choose Upgrade', banish: 'Banish', skip: 'Skip (+50 XP)', banishHint: 'Banish available every 3 levels',
      chestTitle: 'Treasure Chest!', collect: 'Collect', paused: 'Paused', resume: 'Resume', photoMode: 'Photo Mode', abandon: 'Abandon Run',
      retry: 'New Run', share: 'Share Card', menu: 'Menu', victory: 'VICTORY!', defeat: 'You have fallen…', stageCleared: 'Stage Cleared!',
      sfxVol: 'SFX Volume', musicVol: 'Music Volume', perfMode: 'Performance Mode', showFps: 'Show FPS Counter',
      haptics: 'Haptics', screenShake: 'Screen Shake', autoaim: 'Auto Aim', batterySaver: 'Auto Battery Saver',
      uiScale: 'UI Scale', deadzone: 'Joystick Deadzone', fullscreen: 'Fullscreen', toggle: 'Toggle', debugNote: 'Debug Panel (~ key)',
      exportSave: 'Export Save', exportB: 'Export', importSave: 'Import Save', resetSave: 'Wipe All Progress', resetB: 'Wipe',
      codexEnemies: 'Enemies', codexBosses: 'Bosses', codexWeapons: 'Weapons', codexArtifacts: 'Artifacts',
      daily: 'Daily', weekly: 'Weekly', runsTab: 'Runs', lbTab: 'Leaderboard',
      yes: 'Yes', cancel: 'Cancel', lvl: 'Level', time: 'Time', kills: 'Kills', level: 'Level', goldEarned: 'Gold', shardsEarned: 'Shards', score: 'Score',
      bestTime: 'Best Time', danger: 'Danger', locked: 'Locked', unlockBy: 'Unlocks by clearing previous stage', startWeapon: 'Starting Weapon',
      perk: 'Perk', unlockGold: 'Buy for {n} gold', unlockShards: 'Buy for {n} shards', buy: 'Buy', notEnough: 'Not enough resources',
      kindEvo: 'WEAPON EVOLUTION!', kindNew: 'New Weapon', kindUp: 'Weapon Upgrade', kindPassive: 'Training', kindGold: 'Bonus',
      maxed: 'Max Level', evolutionReady: 'Evolution ready!', newUnlock: 'New Unlock!', stageUnlocked: 'New stage unlocked!',
      charUnlocked: 'New character unlocked!', companionJoined: 'Your companion joined the fight!', notEnoughGold: 'Not enough gold',
      achievementUnlocked: 'Achievement completed', challengeDone: 'Challenge completed', saved: 'Saved', imported: 'Save imported', importFailed: 'Invalid save file',
      revived: 'The spell revived you!', bossIncoming: 'The boss approaches…', swarm: 'A massive wave is coming!', howto: 'Drag to move — dash to escape swarms',
      confirmReset: 'All permanent progress will be wiped. Are you sure?', confirmAbandon: 'Run progress will be lost. Continue?',
      noRuns: 'No runs yet — start your journey!', noLb: 'Leaderboard is empty', newRecord: 'NEW RECORD!',
      achSummary: '{n} done', codexLocked: '???', discovered: '{n} found', undiscovered: 'Not discovered yet',
      talentBuy: 'Upgrade', talentMax: 'MAX', talentLockedChar: 'Unlock character first', weeklyBanner: 'Weekly challenge forces these modifiers — double rewards!',
      weeklyNone: 'Play the weekly challenge for bonus shards', dailyReset: 'Daily challenges reset at midnight', weeklyReset: 'Weekly challenges reset every Monday',
      goldPickup: 'Gold', healPickup: 'Heal', shardPickup: 'Soul Shard', chestFromElite: 'An elite dropped a chest!',
      photoSaved: 'Photo saved', shareSaved: 'Share card saved', exported: 'Save file downloaded', weaponSlotsFull: 'Weapon slots are full',
      summon: 'Summon', phaseChange: 'The boss enrages!', endless: 'Endless', waveN: 'Wave {n}',
      batteryOn: 'Low battery — enabling performance mode', totalAch: 'Achievements'
    }
  }
};
AS.I18N = I18N;
const t = (k) => I18N.t(k), tf = (k, n) => I18N.tf(k, n);
/* ══════════════════════ Data/ — المراحل والشخصيات والمرافقون ══════════════════════ */
const Data = AS.Data = {};

// ─── المراحل الخمس: لوحة ألوان + أعداء + زعيم + هوية موسيقية ───
Data.STAGES = [
  {
    id: 'crypt', ar: 'المقبرة', en: 'The Crypt', descAr: 'قبور قديمة تنبض بالموتى', descEn: 'Ancient graves stirring with the dead',
    bg: '#0b0d16', tiles: ['#181d2c', '#1e2436'], speck: ['#242c44', '#131826'], decor: '#8a93b5', accent: '#7ee8fa',
    ambient: 'rgba(3,5,14,0.5)', enemyTint: '#aeb8dd',
    enemies: ['skeleton', 'ghoul', 'boneArcher', 'wraith', 'cryptBrute'], boss: 'boneKing',
    music: { root: 110, scale: [0, 3, 5, 7, 10], bpm: 96 }
  },
  {
    id: 'ice', ar: 'الكهف الجليدي', en: 'Ice Cave', descAr: 'أنفاس الصقيع تتجمد في الهواء', descEn: 'Frozen breath hangs in the air',
    bg: '#0a1220', tiles: ['#16283e', '#1c3248'], speck: ['#2a4a6a', '#0f1c2e'], decor: '#bfe8ff', accent: '#9fd8ff',
    ambient: 'rgba(6,14,30,0.4)', enemyTint: '#bfe8ff',
    enemies: ['iceBat', 'frostWolf', 'iceGolem', 'frostMage'], boss: 'frostWyrm',
    music: { root: 123, scale: [0, 2, 3, 7, 8], bpm: 104 }
  },
  {
    id: 'desert', ar: 'صحراء الرمال', en: 'Sand Desert', descAr: 'عواصف رملية تخفي مخلوقات أثرى', descEn: 'Sandstorms hide ancient horrors',
    bg: '#171208', tiles: ['#3a2f18', '#463a1e'], speck: ['#5c4c28', '#2a2210'], decor: '#e8d49a', accent: '#ffd66e',
    ambient: 'rgba(30,20,4,0.32)', enemyTint: '#ffe9b0',
    enemies: ['scarab', 'sandSnake', 'mummy', 'duneSniper'], boss: 'sandColossus',
    music: { root: 98, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 100 }
  },
  {
    id: 'flame', ar: 'معبد اللهب', en: 'Flame Temple', descAr: 'أرواح ملتهبة تحرس الأقداس', descEn: 'Burning spirits guard the sanctum',
    bg: '#1a0a06', tiles: ['#331410', '#3e1a12'], speck: ['#5c2418', '#200a08'], decor: '#ff9a5c', accent: '#ff7b3a',
    ambient: 'rgba(24,4,2,0.35)', enemyTint: '#ffb08a',
    enemies: ['fireImp', 'lavaHound', 'flameBrute', 'ashCaster'], boss: 'phoenixLord',
    music: { root: 117, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 118 }
  },
  {
    id: 'void', ar: 'الفراغ الأرجواني', en: 'Purple Void', descAr: 'ما وراء الحقيقة نفسها', descEn: 'Beyond reality itself',
    bg: '#0d0716', tiles: ['#1d1030', '#241540'], speck: ['#38206a', '#120a22'], decor: '#c99aff', accent: '#b06cff',
    ambient: 'rgba(8,2,18,0.55)', enemyTint: '#d9baff',
    enemies: ['voidSpawn', 'nullWalker', 'horrorBrute', 'voidEye'], boss: 'theDevourer',
    music: { root: 87, scale: [0, 1, 3, 6, 7, 10], bpm: 88 }
  }
];
Data.stage = (id) => Data.STAGES.find(s => s.id === id) || Data.STAGES[0];

// ─── الشخصيات العشر: كل واحدة ببداية وميزة مختلفة ───
Data.CHARACTERS = [
  { id: 'arcane', ar: 'الساحر أركان', en: 'Arcane Mage', color: '#7ee8fa', hp: 100, speed: 150, weapon: 'arcaneBolt', perkAr: '+15% خبرة', perkEn: '+15% XP', perk: { xp: 0.15 }, unlock: { type: 'free' } },
  { id: 'pyra', ar: 'لهيب المشتعلة', en: 'Pyra the Blazing', color: '#ff7b3a', hp: 95, speed: 155, weapon: 'fireball', perkAr: 'ضرر النار +20%', perkEn: '+20% fire dmg', perk: { school: 'fire', v: 0.2 }, unlock: { type: 'gold', cost: 300 } },
  { id: 'frost', ar: 'سيّدة الصقيع', en: 'Frost Witch', color: '#9fd8ff', hp: 105, speed: 145, weapon: 'frostShard', perkAr: 'فرصة 10% تجميد عند الإصابة', perkEn: '10% freeze on hit', perk: { freezeHit: 0.1 }, unlock: { type: 'gold', cost: 500 } },
  { id: 'storm', ar: 'منادي العاصفة', en: 'Storm Caller', color: '#ffe95c', hp: 90, speed: 160, weapon: 'chainLightning', perkAr: 'سرعة مقذوفات +25%', perkEn: '+25% projectile speed', perk: { projSpeed: 0.25 }, unlock: { type: 'gold', cost: 800 } },
  { id: 'shadow', ar: 'نصل الظل', en: 'Shadow Blade', color: '#a67aff', hp: 85, speed: 170, weapon: 'shadowBolt', perkAr: 'فرصة حرجة +12%', perkEn: '+12% crit chance', perk: { crit: 0.12 }, unlock: { type: 'ach', ach: 'kills_1000' } },
  { id: 'druid', ar: 'حارس الطبيعة', en: 'Nature Warden', color: '#7be07b', hp: 115, speed: 145, weapon: 'vineWhip', perkAr: 'تجدد +1/ث', perkEn: '+1 regen/s', perk: { regen: 1 }, unlock: { type: 'ach', ach: 'runs_10' } },
  { id: 'templar', ar: 'فرسان النور', en: 'Light Templar', color: '#fff3b0', hp: 130, speed: 140, weapon: 'holyRay', perkAr: 'درع +4', perkEn: '+4 armor', perk: { armor: 4 }, unlock: { type: 'ach', ach: 'bosses_5' } },
  { id: 'jester', ar: 'مهرّج الفوضى', en: 'Chaos Jester', color: '#ff6ea8', hp: 95, speed: 165, weapon: 'chaosBolt', perkAr: 'حظ +30%', perkEn: '+30% luck', perk: { luck: 0.3 }, unlock: { type: 'shards', cost: 8 } },
  { id: 'voidwalker', ar: 'سائر الفراغ', en: 'Void Walker', color: '#b06cff', hp: 100, speed: 155, weapon: 'voidRip', perkAr: 'تبريد الاندفاع -30%', perkEn: '-30% dash cooldown', perk: { dashCd: 0.3 }, unlock: { type: 'shards', cost: 15 } },
  { id: 'venom', ar: 'سمّامة الأفاعي', en: 'Venomancer', color: '#8be84a', hp: 100, speed: 150, weapon: 'poisonDagger', perkAr: 'ضرر السم +25%', perkEn: '+25% poison dmg', perk: { school: 'poison', v: 0.25 }, unlock: { type: 'ach', ach: 'evolutions_5' } }
];
Data.char = (id) => Data.CHARACTERS.find(c => c.id === id) || Data.CHARACTERS[0];

// ─── المرافقون الخمسة: يُفتحون بإكمال المراحل ───
Data.COMPANIONS = [
  { id: 'none', ar: 'بدون', en: 'None', unlockStage: -1, kind: 'none' },
  { id: 'wolf', ar: 'الذئب الرمادي', en: 'Gray Wolf', unlockStage: 1, kind: 'melee', dmg: 16, cd: 1.2, color: '#9aa4b8' },
  { id: 'ghost', ar: 'الشبح الحزين', en: 'Sorrow Ghost', unlockStage: 2, kind: 'ranged', dmg: 13, cd: 1.6, color: '#a8e6ff' },
  { id: 'golem', ar: 'الغولم الصغير', en: 'Little Golem', unlockStage: 3, kind: 'melee', dmg: 30, cd: 2.4, color: '#c8a06a' },
  { id: 'fairy', ar: 'الجنية المضيئة', en: 'Glow Fairy', unlockStage: 4, kind: 'support', dmg: 8, cd: 2, heal: 6, color: '#ffb8e8' },
  { id: 'drake', ar: 'التنين الصغير', en: 'Baby Drake', unlockStage: 5, kind: 'ranged', dmg: 22, cd: 1.8, color: '#ff8a5c' }
];
Data.comp = (id) => Data.COMPANIONS.find(c => c.id === id) || Data.COMPANIONS[0];

// ─── صفات النخبة: تعطي الأعداء المميزين قدرات خاصة ───
Data.AFFIXES = [
  { id: 'thorns', ar: 'شائك', en: 'Thorny', color: '#8be84a' },
  { id: 'burning', ar: 'حارق', en: 'Burning', color: '#ff7b3a' },
  { id: 'freezing', ar: 'مُجمّد', en: 'Freezing', color: '#9fd8ff' },
  { id: 'shocking', ar: 'مُصعِّق', en: 'Shocking', color: '#ffe95c' }
];

// ─── معدّلات الصعوبة: بدل المستويات الثلاثة الثابتة ───
Data.MODIFIERS = [
  { id: 'count', ar: 'كثافة الأعداء +35%', en: 'Enemy Density +35%', mult: 1.2 },
  { id: 'speed', ar: 'سرعة الأعداء +18%', en: 'Enemy Speed +18%', mult: 1.15 },
  { id: 'power', ar: 'قوة الأعداء +40%', en: 'Enemy Power +40%', mult: 1.3 },
  { id: 'elites', ar: 'عاصفة النخبة', en: 'Elite Storm', mult: 1.45 },
  { id: 'giant', ar: 'أعداء عملقة', en: 'Giant Enemies', mult: 1.25 },
  { id: 'doubleboss', ar: 'زعيم إضافي', en: 'Extra Boss', mult: 1.5 },
  { id: 'swarms', ar: 'موجات مضاعفة', en: 'Double Swarms', mult: 1.35 },
  { id: 'glass', ar: 'جسد زجاجي (صحتك -30%)', en: 'Glass Body (HP -30%)', mult: 1.3 }
];
Data.mod = (id) => Data.MODIFIERS.find(m => m.id === id);

// ─── شجرة المواهب: 3 فروع × 4 عقد لكل شخصية ───
Data.TALENT_BRANCHES = [
  { id: 'power', ar: 'القوة', en: 'Power', color: '#ff7b6b', nodes: [{ k: 'dmg', v: 0.05, ar: 'ضرر +5%', en: '+5% dmg' }, { k: 'dmg', v: 0.05, ar: 'ضرر +5%', en: '+5% dmg' }, { k: 'crit', v: 0.06, ar: 'حرجة +6%', en: '+6% crit' }, { k: 'area', v: 0.12, ar: 'مساحة +12%', en: '+12% area' }] },
  { id: 'speed', ar: 'السرعة', en: 'Speed', color: '#7ee8fa', nodes: [{ k: 'ms', v: 0.04, ar: 'حركة +4%', en: '+4% move' }, { k: 'dash', v: 0.1, ar: 'اندفاع أسرع', en: 'Faster dash' }, { k: 'ms', v: 0.04, ar: 'حركة +4%', en: '+4% move' }, { k: 'cd', v: 0.06, ar: 'تبريد -6%', en: '-6% cooldown' }] },
  { id: 'wisdom', ar: 'الحكمة', en: 'Wisdom', color: '#f5c542', nodes: [{ k: 'xp', v: 0.06, ar: 'خبرة +6%', en: '+6% XP' }, { k: 'pickup', v: 0.12, ar: 'التقاط +12%', en: '+12% pickup' }, { k: 'luck', v: 0.06, ar: 'حظ +6%', en: '+6% luck' }, { k: 'gold', v: 0.08, ar: 'ذهب +8%', en: '+8% gold' }] }
];
Data.talentCost = (lvl) => 120 * (lvl + 1) * (lvl + 1);

// مدارس السحر للعرض الموحد
Data.SCHOOLS = {
  fire: { ar: 'نار', en: 'Fire', color: '#ff7b3a' }, ice: { ar: 'ثلج', en: 'Ice', color: '#9fd8ff' },
  lightning: { ar: 'برق', en: 'Lightning', color: '#ffe95c' }, poison: { ar: 'سم', en: 'Poison', color: '#8be84a' },
  dark: { ar: 'ظلام', en: 'Dark', color: '#a67aff' }, light: { ar: 'نور', en: 'Light', color: '#fff3b0' },
  arcane: { ar: 'أركان', en: 'Arcane', color: '#7ee8fa' }, nature: { ar: 'طبيعة', en: 'Nature', color: '#7be07b' },
  chaos: { ar: 'فوضى', en: 'Chaos', color: '#ff6ea8' }, void: { ar: 'فراغ', en: 'Void', color: '#b06cff' },
  physical: { ar: 'فيزيائي', en: 'Physical', color: '#d8dce8' }
};
/* ══════════════════════ Data/ — الأسلحة والتطورات والتمارين ══════════════════════ */
// أنواع السلوك: proj مقذوف / homing متعقب / nova موجة دائرية / aura هالة / orbit مداري /
// chain سلسلة / melee ضربة قوسية / rain قصف / mine منطقة مزروعة / boomerang مرجوع
Data.WEAPONS = [];
function W(id, ar, en, school, kind, o) {
  Data.WEAPONS.push(Object.assign({ id, ar, en, school, kind, dmg: 15, cd: 1.2, count: 1, speed: 380, pierce: 1, life: 1.4, r: 9, area: 70, maxLv: 8, color: Data.SCHOOLS[school].color }, o));
}
// ─── مدرسة النار ───
W('fireball', 'كرة النار', 'Fireball', 'fire', 'proj', { dmg: 24, cd: 1.15, speed: 340, pierce: 1, r: 10, evo: 'plagueFire', evoWith: 'toxicCloud' });
W('flameWave', 'موجة اللهب', 'Flame Wave', 'fire', 'melee', { dmg: 18, cd: 1.6, area: 95 });
W('meteor', 'النيزك', 'Meteor', 'fire', 'rain', { dmg: 60, cd: 3.2, area: 72, evo: 'apocalypse', evoWith: 'immolate' });
W('fireNova', 'الانفجار الناري', 'Fire Nova', 'fire', 'nova', { dmg: 26, cd: 2.6, area: 150 });
W('immolate', 'الاشتعال', 'Immolate', 'fire', 'aura', { dmg: 9, cd: 0.5, area: 85 });
// ─── مدرسة الثلج ───
W('frostShard', 'شظية الصقيع', 'Frost Shard', 'ice', 'proj', { dmg: 14, cd: 0.85, speed: 420, pierce: 2, evo: 'glacialStorm', evoWith: 'thunderCall' });
W('iceNova', 'الانفجار الجليدي', 'Ice Nova', 'ice', 'nova', { dmg: 20, cd: 3.0, area: 135 });
W('blizzard', 'العاصفة الثلجية', 'Blizzard', 'ice', 'rain', { dmg: 12, cd: 2.4, count: 3, area: 55 });
W('frozenOrb', 'الكرة المتجمدة', 'Frozen Orb', 'ice', 'orbit', { dmg: 16, cd: 0, speed: 2.2, r: 13 });
// ─── مدرسة البرق ───
W('chainLightning', 'البرق المتسلسل', 'Chain Lightning', 'lightning', 'chain', { dmg: 20, cd: 1.5, area: 260, evo: 'tempestCrown', evoWith: 'staticField' });
W('stormBolt', 'قنبلة العاصفة', 'Storm Bolt', 'lightning', 'proj', { dmg: 26, cd: 1.3, speed: 520, pierce: 3 });
W('thunderCall', 'نداء الرعد', 'Thunder Call', 'lightning', 'rain', { dmg: 44, cd: 2.8, area: 60 });
W('staticField', 'حقل السكون', 'Static Field', 'lightning', 'aura', { dmg: 6, cd: 0.4, area: 110 });
W('ballLightning', 'كرة البرق', 'Ball Lightning', 'lightning', 'orbit', { dmg: 12, cd: 0, count: 2, speed: 3.4, r: 8 });
// ─── مدرسة السم ───
W('poisonDagger', 'خنجر السم', 'Poison Dagger', 'poison', 'proj', { dmg: 10, cd: 0.7, count: 2, speed: 380 });
W('toxicCloud', 'السحابة السامة', 'Toxic Cloud', 'poison', 'mine', { dmg: 8, cd: 3.0, life: 3, area: 80, evoWith: 'fireball' });
W('venomSpit', 'بصقة السم', 'Venom Spit', 'poison', 'homing', { dmg: 14, cd: 1.4, speed: 300 });
W('plagueAura', 'هالة الطاعون', 'Plague Aura', 'poison', 'aura', { dmg: 7, cd: 0.5, area: 100 });
W('acidRain', 'المطر الحمضي', 'Acid Rain', 'poison', 'rain', { dmg: 10, cd: 2.2, count: 4, area: 40 });
// ─── مدرسة الظلام ───
W('shadowBolt', 'قذيفة الظل', 'Shadow Bolt', 'dark', 'proj', { dmg: 20, cd: 1.0, speed: 360, evo: 'voidReaper', evoWith: 'soulDrain' });
W('darkPulse', 'نبض الظلام', 'Dark Pulse', 'dark', 'nova', { dmg: 24, cd: 2.8, area: 160 });
W('soulDrain', 'استنزاف الأرواح', 'Soul Drain', 'dark', 'chain', { dmg: 14, cd: 2.0, area: 240 });
W('nightmare', 'الكابوس', 'Nightmare', 'dark', 'rain', { dmg: 18, cd: 3.0, count: 2, area: 65 });
W('eclipse', 'الكسوف', 'Eclipse', 'dark', 'nova', { dmg: 40, cd: 5.0, area: 220 });
// ─── مدرسة النور ───
W('holyRay', 'شعاع النور', 'Holy Ray', 'light', 'proj', { dmg: 22, cd: 1.2, speed: 700, pierce: 4, r: 6, evo: 'judgment', evoWith: 'sanctuary' });
W('lightLance', 'رمح النور', 'Light Lance', 'light', 'proj', { dmg: 30, cd: 1.8, speed: 560, pierce: 6, r: 7 });
W('radiance', 'الإشراق', 'Radiance', 'light', 'aura', { dmg: 10, cd: 0.6, area: 120 });
W('sanctuary', 'المقدس', 'Sanctuary', 'light', 'mine', { dmg: 25, cd: 3.5, life: 2.5, area: 90, evoWith: 'holyRay' });
// ─── مدرسة الأركان ───
W('arcaneBolt', 'قذيفة أركان', 'Arcane Bolt', 'arcane', 'proj', { dmg: 16, cd: 0.75, speed: 400 });
W('arcaneMissiles', 'صواريخ أركان', 'Arcane Missiles', 'arcane', 'homing', { dmg: 12, cd: 1.6, count: 3, evo: 'arcaneAscension', evoWith: 'runeBlast' });
W('arcaneOrb', 'مدار أركان', 'Arcane Orb', 'arcane', 'orbit', { dmg: 18, cd: 0, speed: 1.6, r: 15 });
W('runeBlast', 'انفجار الرموز', 'Rune Blast', 'arcane', 'mine', { dmg: 30, cd: 2.6, life: 1.8, area: 85, evoWith: 'arcaneMissiles' });
W('manaSurge', 'اندفاع المانا', 'Mana Surge', 'arcane', 'aura', { dmg: 8, cd: 0.45, area: 95 });
// ─── مدرسة الطبيعة ───
W('vineWhip', 'سوط الكرمة', 'Vine Whip', 'nature', 'melee', { dmg: 22, cd: 1.3, area: 110, evo: 'naturesWrath', evoWith: 'earthSpike' });
W('thornSpray', 'رش الأشواك', 'Thorn Spray', 'nature', 'proj', { dmg: 8, cd: 1.1, count: 4, speed: 300 });
W('earthSpike', 'شظايا الأرض', 'Earth Spike', 'nature', 'rain', { dmg: 28, cd: 2.2, count: 3, area: 40, evoWith: 'vineWhip' });
W('beeSwarm', 'سرب النحل', 'Bee Swarm', 'nature', 'orbit', { dmg: 7, cd: 0, count: 3, speed: 4.2, r: 6 });
// ─── مدرسة الفوضى ───
W('chaosBolt', 'قذيفة الفوضى', 'Chaos Bolt', 'chaos', 'proj', { dmg: 25, cd: 1.4, speed: 320, bounce: 3, evo: 'chaosIncarnate', evoWith: 'wildSurge' });
W('prismShot', 'طلقة المنشور', 'Prism Shot', 'chaos', 'proj', { dmg: 14, cd: 1.5, count: 5, speed: 340 });
W('wildSurge', 'الاندفاع الجامح', 'Wild Surge', 'chaos', 'aura', { dmg: 15, cd: 1.8, area: 130, evoWith: 'chaosBolt' });
// ─── مدرسة الفراغ ───
W('voidRip', 'شرخ الفراغ', 'Void Rip', 'void', 'proj', { dmg: 18, cd: 0.9, speed: 650, pierce: 3, r: 7 });
W('nullSphere', 'كرة الصفر', 'Null Sphere', 'void', 'orbit', { dmg: 20, cd: 0, speed: -2.0, r: 12 });
W('singularity', 'الأحادية', 'Singularity', 'void', 'mine', { dmg: 50, cd: 5.0, life: 2.2, area: 110 });
// ─── المدرسة الفيزيائية ───
W('daggerThrow', 'قذف الخناجر', 'Dagger Throw', 'physical', 'proj', { dmg: 12, cd: 0.6, speed: 440, evo: 'bladeCyclone', evoWith: 'chakram' });
W('boomerang', 'الأدميرال المرجوع', 'Boomerang', 'physical', 'boomerang', { dmg: 16, cd: 1.7, speed: 380, life: 1.8 });
W('chakram', 'الشرارة الدائرية', 'Chakram', 'physical', 'boomerang', { dmg: 22, cd: 2.1, speed: 340, life: 2.2, r: 13, evoWith: 'daggerThrow' });
W('arrowVolley', 'رشقة السهام', 'Arrow Volley', 'physical', 'rain', { dmg: 14, cd: 2.0, count: 5, area: 30 });
W('hammerSmash', 'دمار المطرقة', 'Hammer Smash', 'physical', 'melee', { dmg: 45, cd: 2.6, area: 85 });

Data.weapon = (id) => Data.WEAPONS.find(w => w.id === id);

// ─── الأسلحة المتطورة: نسخ أقوى بشكل مرئي ووظيفي ───
Data.EVOLVED = {
  plagueFire: { ar: 'نار الطاعون', en: 'Plague Fire', school: 'fire', kind: 'proj', dmg: 55, cd: 1.0, count: 2, speed: 360, pierce: 2, r: 12, life: 1.6, color: '#c85cff', flag: 'plaguePool', descAr: 'لهب أرجواني يترك برك سُمّ مشتعلة', descEn: 'Purple flame leaving burning poison pools' },
  glacialStorm: { ar: 'العاصفة الجليدية', en: 'Glacial Storm', school: 'ice', kind: 'rain', dmg: 30, cd: 1.6, count: 3, area: 60, color: '#bff3ff', flag: 'chainFreeze', descAr: 'صقيع يتحول لبرق متجمد متسلسل', descEn: 'Frost that chains into frozen lightning' },
  tempestCrown: { ar: 'تاج العاصفة', en: 'Tempest Crown', school: 'lightning', kind: 'aura', dmg: 22, cd: 0.35, area: 150, color: '#ffe95c', flag: 'crownChain', descAr: 'عاصفة دائمة تصعق وتتسلسل', descEn: 'Permanent storm that chains and shocks' },
  voidReaper: { ar: 'حاصد الفراغ', en: 'Void Reaper', school: 'dark', kind: 'melee', dmg: 45, cd: 1.2, area: 130, color: '#a67aff', flag: 'reapHeal', descAr: 'منجل يشفيك بكل روح تحصدها', descEn: 'A scythe that heals per kill' },
  judgment: { ar: 'يوم الحساب', en: 'Judgment', school: 'light', kind: 'orbit', dmg: 40, cd: 0, count: 3, speed: 1.3, r: 18, color: '#fff3b0', flag: 'judgeBeam', descAr: 'أعمدة نور تدور حولك وتحرق', descEn: 'Rotating pillars of holy light' },
  arcaneAscension: { ar: 'صعود أركان', en: 'Arcane Ascension', school: 'arcane', kind: 'homing', dmg: 30, cd: 0.9, count: 4, speed: 330, color: '#7ee8fa', flag: 'ascendExplode', descAr: 'صواريخ تسعى وتنفجر بقوة سحرية', descEn: 'Seeking missiles with arcane detonation' },
  naturesWrath: { ar: 'غضب الطبيعة', en: "Nature's Wrath", school: 'nature', kind: 'nova', dmg: 55, cd: 2.4, area: 200, color: '#7be07b', flag: 'wrathRoots', descAr: 'أشواك كاسفة تُبطئ كل من تلمسه', descEn: 'Devastating thorns that root enemies' },
  bladeCyclone: { ar: 'إعصار النصال', en: 'Blade Cyclone', school: 'physical', kind: 'orbit', dmg: 30, cd: 0, count: 8, speed: 3.2, r: 10, color: '#e8ecf8', descAr: 'ثمانية نصال دوارة لا تتوقف', descEn: 'Eight relentless spinning blades' },
  chaosIncarnate: { ar: 'الفوضى المتجسدة', en: 'Chaos Incarnate', school: 'chaos', kind: 'proj', dmg: 45, cd: 1.0, count: 3, speed: 340, bounce: 4, r: 11, color: '#ff6ea8', flag: 'chaosBoom', descAr: 'فوضى عارمة تنفجر عشوائيًا', descEn: 'Raw chaos with random detonations' },
  apocalypse: { ar: 'الرثاء', en: 'Apocalypse', school: 'fire', kind: 'rain', dmg: 90, cd: 2.0, count: 3, area: 90, color: '#ff5c1a', flag: 'apocBurn', descAr: 'مطر نيزكي يذيبه الأرض', descEn: 'A meteor rain that melts the earth' }
};
Data.isEvolved = (id) => !!Data.EVOLVED[id];

// ─── التمارين السلبية (ترقيات القوة الدائمة داخل الجولة) ───
Data.PASSIVES = [
  { id: 'might', ar: 'الغلبة', en: 'Might', max: 5, k: 'dmg', per: 0.06, arD: 'الضرر +6%', enD: '+6% damage' },
  { id: 'haste', ar: 'العجلة', en: 'Haste', max: 5, k: 'cd', per: 0.05, arD: 'سرعة الهجوم +5%', enD: '+5% attack speed' },
  { id: 'expanse', ar: 'الاتساع', en: 'Expanse', max: 5, k: 'area', per: 0.09, arD: 'المساحة +9%', enD: '+9% area' },
  { id: 'swiftness', ar: 'الخِفّة', en: 'Swiftness', max: 5, k: 'ms', per: 0.05, arD: 'الحركة +5%', enD: '+5% move speed' },
  { id: 'shell', ar: 'الصدفة', en: 'Shell', max: 5, k: 'armor', per: 2, arD: 'الدرع +2', enD: '+2 armor' },
  { id: 'mending', ar: 'المداواة', en: 'Mending', max: 5, k: 'regen', per: 0.4, arD: 'التجدد +0.4/ث', enD: '+0.4 regen/s' },
  { id: 'precision', ar: 'الدقة', en: 'Precision', max: 5, k: 'crit', per: 0.04, arD: 'الحرجة +4%', enD: '+4% crit' },
  { id: 'insight', ar: 'البصيرة', en: 'Insight', max: 5, k: 'xp', per: 0.08, arD: 'الخبرة +8%', enD: '+8% XP' },
  { id: 'lure', ar: 'الجاذب', en: 'Lure', max: 5, k: 'pickup', per: 0.15, arD: 'مدى الالتقاط +15%', enD: '+15% pickup range' },
  { id: 'fortune', ar: 'الحظ', en: 'Fortune', max: 5, k: 'luck', per: 0.08, arD: 'الحظ +8%', enD: '+8% luck' },
  { id: 'vigor', ar: 'الحيوية', en: 'Vigor', max: 5, k: 'hp', per: 18, arD: 'الصحة القصوى +18', enD: '+18 max HP' },
  { id: 'multishot', ar: 'التعدد', en: 'Multishot', max: 2, k: 'amount', per: 1, arD: 'مقذوف +1 لكل سلاح', enD: '+1 projectile to all', weight: 0.35 }
];
Data.passive = (id) => Data.PASSIVES.find(p => p.id === id);

// متطلبات التطور: سلاح أساس ← (سلاح/عنصر مساعد) ← النسخة المتطورة
Data.EVO_MAP = {};
for (const w of Data.WEAPONS) if (w.evo) Data.EVO_MAP[w.id] = { evo: w.evo, with: w.evoWith };
/* ══════════════════════ Data/ — الأعداء والزعماء ══════════════════════ */
// السلوك: walk مشي / fast سريع / ranged يقذف / brute ضخم يندفع / swarm سرب / fly طائر متعرج
Data.ENEMIES = {
  // — المقبرة —
  skeleton: { ar: 'هيكل عظمي', en: 'Skeleton', hp: 14, spd: 52, dmg: 9, r: 12, xp: 1, color: '#d8dce8', shape: 'skel', behavior: 'walk' },
  ghoul: { ar: 'غول', en: 'Ghoul', hp: 10, spd: 78, dmg: 8, r: 11, xp: 1, color: '#7ba05c', shape: 'blob', behavior: 'fast' },
  boneArcher: { ar: 'رامي العظام', en: 'Bone Archer', hp: 12, spd: 44, dmg: 12, r: 11, xp: 2, color: '#c9b995', shape: 'archer', behavior: 'ranged', range: 330, atkCd: 2.4 },
  wraith: { ar: 'طيف', en: 'Wraith', hp: 16, spd: 92, dmg: 11, r: 12, xp: 2, color: '#8fa8d8', shape: 'ghost', behavior: 'fly' },
  cryptBrute: { ar: 'جبار القبور', en: 'Crypt Brute', hp: 70, spd: 38, dmg: 18, r: 20, xp: 4, color: '#8a93b5', shape: 'brute', behavior: 'brute' },
  // — الكهف الجليدي —
  iceBat: { ar: 'خفاش الثلج', en: 'Ice Bat', hp: 12, spd: 98, dmg: 8, r: 10, xp: 1, color: '#9fd8ff', shape: 'bat', behavior: 'fly' },
  frostWolf: { ar: 'ذئب الصقيع', en: 'Frost Wolf', hp: 20, spd: 95, dmg: 12, r: 12, xp: 2, color: '#bfe0ff', shape: 'wolf', behavior: 'fast' },
  iceGolem: { ar: 'غولم جليدي', en: 'Ice Golem', hp: 90, spd: 34, dmg: 20, r: 22, xp: 5, color: '#7fb8e8', shape: 'golem', behavior: 'brute' },
  frostMage: { ar: 'ساحر الصقيع', en: 'Frost Mage', hp: 16, spd: 42, dmg: 14, r: 12, xp: 3, color: '#8fc8ff', shape: 'mage', behavior: 'ranged', range: 360, atkCd: 2.6 },
  // — صحراء الرمال —
  scarab: { ar: 'جُعران', en: 'Scarab', hp: 8, spd: 88, dmg: 6, r: 8, xp: 1, color: '#d8b45c', shape: 'bug', behavior: 'swarm' },
  sandSnake: { ar: 'أفعى الرمال', en: 'Sand Snake', hp: 18, spd: 105, dmg: 11, r: 10, xp: 2, color: '#c8a05c', shape: 'snake', behavior: 'fast' },
  mummy: { ar: 'مومياء', en: 'Mummy', hp: 55, spd: 40, dmg: 15, r: 17, xp: 3, color: '#e8dcb8', shape: 'mummy', behavior: 'walk' },
  duneSniper: { ar: 'قنّص الكثبان', en: 'Dune Sniper', hp: 15, spd: 46, dmg: 16, r: 11, xp: 3, color: '#b89868', shape: 'archer', behavior: 'ranged', range: 400, atkCd: 2.8 },
  // — معبد اللهب —
  fireImp: { ar: 'نارينيّ', en: 'Fire Imp', hp: 14, spd: 92, dmg: 10, r: 10, xp: 1, color: '#ff8a5c', shape: 'imp', behavior: 'swarm' },
  lavaHound: { ar: 'كلب الحمم', en: 'Lava Hound', hp: 30, spd: 100, dmg: 14, r: 13, xp: 2, color: '#ff6a3a', shape: 'wolf', behavior: 'fast' },
  flameBrute: { ar: 'جبار اللهب', en: 'Flame Brute', hp: 110, spd: 40, dmg: 24, r: 23, xp: 6, color: '#e85c2a', shape: 'brute', behavior: 'brute' },
  ashCaster: { ar: 'ساحر الرماد', en: 'Ash Caster', hp: 20, spd: 44, dmg: 18, r: 12, xp: 3, color: '#d8886a', shape: 'mage', behavior: 'ranged', range: 380, atkCd: 2.2 },
  // — الفراغ الأرجواني —
  voidSpawn: { ar: 'نسل الفراغ', en: 'Void Spawn', hp: 16, spd: 86, dmg: 12, r: 9, xp: 1, color: '#b06cff', shape: 'spawn', behavior: 'swarm' },
  nullWalker: { ar: 'سائر الصفر', en: 'Null Walker', hp: 40, spd: 62, dmg: 16, r: 14, xp: 3, color: '#9a5cff', shape: 'ghost', behavior: 'walk' },
  horrorBrute: { ar: 'جبار الرعب', en: 'Horror Brute', hp: 140, spd: 42, dmg: 28, r: 24, xp: 7, color: '#7a3cff', shape: 'brute', behavior: 'brute' },
  voidEye: { ar: 'عين الفراغ', en: 'Void Eye', hp: 22, spd: 40, dmg: 20, r: 13, xp: 3, color: '#c99aff', shape: 'eye', behavior: 'ranged', range: 420, atkCd: 2.0 }
};
Data.enemy = (id) => Data.ENEMIES[id];

// ─── الزعماء: 3 مراحل بأنماط هجوم متغيرة (توقيعات مختلفة لا مجرد HP) ───
// الأنماط: radial حلقة مقذوفات / charge اندفاع / summon استدعاء / spiral دوامة /
// slam دقات أرضية / volley رشقة موجهة / beam شعاع دوّار
Data.BOSSES = {
  boneKing: {
    ar: 'ملك العظام', en: 'Bone King', hp: 2400, spd: 46, dmg: 26, r: 34, xp: 120, color: '#d8dce8', shape: 'bossSkel',
    phases: [
      { until: 1.0, patterns: ['volley', 'summon'], rate: 2.2 },
      { until: 0.62, patterns: ['charge', 'radial'], rate: 1.9 },
      { until: 0.30, patterns: ['spiral', 'summon', 'charge'], rate: 1.5 }
    ]
  },
  frostWyrm: {
    ar: 'أفعى الصقيع', en: 'Frost Wyrm', hp: 3200, spd: 52, dmg: 30, r: 36, xp: 160, color: '#9fd8ff', shape: 'bossWyrm',
    phases: [
      { until: 1.0, patterns: ['spiral', 'volley'], rate: 2.0 },
      { until: 0.62, patterns: ['charge', 'slam'], rate: 1.8 },
      { until: 0.30, patterns: ['spiral', 'radial', 'charge'], rate: 1.4 }
    ]
  },
  sandColossus: {
    ar: 'عملاق الرمال', en: 'Sand Colossus', hp: 4200, spd: 38, dmg: 36, r: 42, xp: 200, color: '#e8c88a', shape: 'bossColossus',
    phases: [
      { until: 1.0, patterns: ['slam', 'summon'], rate: 2.4 },
      { until: 0.62, patterns: ['charge', 'slam', 'volley'], rate: 2.0 },
      { until: 0.30, patterns: ['spiral', 'charge', 'slam'], rate: 1.6 }
    ]
  },
  phoenixLord: {
    ar: 'سيد العنقاء', en: 'Phoenix Lord', hp: 5400, spd: 60, dmg: 40, r: 36, xp: 260, color: '#ff8a3a', shape: 'bossPhoenix',
    phases: [
      { until: 1.0, patterns: ['radial', 'charge'], rate: 1.9 },
      { until: 0.62, patterns: ['spiral', 'summon'], rate: 1.7 },
      { until: 0.30, patterns: ['beam', 'radial', 'charge'], rate: 1.4 }
    ]
  },
  theDevourer: {
    ar: 'الالتهم', en: 'The Devourer', hp: 7200, spd: 55, dmg: 46, r: 44, xp: 350, color: '#b06cff', shape: 'bossDevourer',
    phases: [
      { until: 1.0, patterns: ['radial', 'summon'], rate: 1.9 },
      { until: 0.62, patterns: ['beam', 'charge', 'slam'], rate: 1.7 },
      { until: 0.30, patterns: ['spiral', 'beam', 'summon', 'radial'], rate: 1.3 }
    ]
  }
};
Data.boss = (id) => Data.BOSSES[id];

// ─── تدفق الموجات: متى يدخل كل عدو الساحة (بالدقائق) ───
Data.WAVE_POOL = {
  crypt: [[0, ['skeleton']], [1.5, ['ghoul', 'skeleton']], [3, ['boneArcher']], [5, ['wraith']], [7, ['cryptBrute']]],
  ice: [[0, ['iceBat']], [1.5, ['frostWolf']], [3, ['frostMage']], [6, ['iceGolem']]],
  desert: [[0, ['scarab']], [2, ['sandSnake']], [4, ['mummy']], [6, ['duneSniper']]],
  flame: [[0, ['fireImp']], [2, ['lavaHound']], [4, ['ashCaster']], [6, ['flameBrute']]],
  void: [[0, ['voidSpawn']], [2, ['nullWalker']], [4.5, ['voidEye']], [7, ['horrorBrute']]]
};
// لحظات موجات السرب الدائرية (دقيقة، العدد)
Data.SWARM_EVENTS = [[3, 26], [6, 38], [9, 52]];
/* ══════════════════════ Data/ — القطع الأثرية والتزامنات ══════════════════════ */
// القطع: تأثير إحصائي مباشر (k/v) أو خطّاف سلوكي (hook)
Data.ARTIFACTS = [
  { id: 'band_might', ar: 'رباط القوة', en: 'Band of Might', k: 'dmg', v: 0.10 },
  { id: 'hourglass', ar: 'الساعة الرملية', en: 'Reversed Hourglass', k: 'cd', v: 0.08 },
  { id: 'prism_lens', ar: 'عدسة المنشور', en: 'Prism Lens', k: 'area', v: 0.10 },
  { id: 'wind_boots', ar: 'نعال الريح', en: 'Wind Boots', k: 'ms', v: 0.08 },
  { id: 'iron_plate', ar: 'الصفيحة الحديدية', en: 'Iron Plate', k: 'armor', v: 3 },
  { id: 'moon_dew', ar: 'ندى القمر', en: 'Moon Dew', k: 'regen', v: 0.6 },
  { id: 'hawk_eye', ar: 'عين الصقر', en: "Hawk's Eye", k: 'crit', v: 0.06 },
  { id: 'executioner_seal', ar: 'ختم الجلاد', en: "Executioner's Seal", k: 'critDmg', v: 0.25 },
  { id: 'scholar_scroll', ar: 'لفيفة العالِم', en: "Scholar's Scroll", k: 'xp', v: 0.10 },
  { id: 'lodestone', ar: 'حجر المغنطيس', en: 'Lodestone', k: 'pickup', v: 0.25 },
  { id: 'rabbit_foot', ar: 'قدم الأرنب', en: "Rabbit's Foot", k: 'luck', v: 0.12 },
  { id: 'heart_stone', ar: 'حجر القلب', en: 'Heart Stone', k: 'hp', v: 20 },
  { id: 'twin_sigil', ar: 'ختم التوأم', en: 'Twin Sigil', k: 'amount', v: 1, unique: true },
  { id: 'phoenix_feather', ar: 'ريشة العنقاء', en: 'Phoenix Feather', k: 'revive', v: 1, unique: true },
  { id: 'merchant_ring', ar: 'خاتم التاجر', en: "Merchant's Ring", k: 'gold', v: 0.15 },
  { id: 'void_compass', ar: 'بوصلة الفراغ', en: 'Void Compass', k: 'dashCd', v: 0.15 },
  { id: 'quick_quiver', ar: 'الجعبة السريعة', en: 'Quick Quiver', k: 'projSpeed', v: 0.15 },
  { id: 'silk_cloak', ar: 'عباءة الحرير', en: 'Silk Cloak', k: 'dodge', v: 0.08 },
  { id: 'crown_slayer', ar: 'تاج الصياد', en: "Slayer's Crown", k: 'dmgBoss', v: 0.15 },
  { id: 'hunter_mark', ar: 'علامة الصياد', en: "Hunter's Mark", k: 'dmgElite', v: 0.20 },
  { id: 'ember_glove', ar: 'قفاز الجمر', en: 'Ember Glove', k: 'school', v: 0.15, sk: 'fire' },
  { id: 'frost_glove', ar: 'قفاز الصقيع', en: 'Frost Glove', k: 'school', v: 0.15, sk: 'ice' },
  { id: 'storm_glove', ar: 'قفاز العاصفة', en: 'Storm Glove', k: 'school', v: 0.15, sk: 'lightning' },
  { id: 'venom_glove', ar: 'قفاز السموم', en: 'Venom Glove', k: 'school', v: 0.15, sk: 'poison' },
  { id: 'holy_glove', ar: 'قفاز النور', en: 'Radiant Glove', k: 'school', v: 0.15, sk: 'light' },
  { id: 'arcane_core', ar: 'نواة أركان', en: 'Arcane Core', k: 'school', v: 0.15, sk: 'arcane' },
  { id: 'bomb_charm', ar: 'تعويذة القنبلة', en: 'Bomb Charm', hook: 'explodeOnKill', v: 0.12 },
  { id: 'fire_brand', ar: 'سوار اللهيب', en: 'Blazing Band', hook: 'burnOnHit', v: 0.2 },
  { id: 'ice_brand', ar: 'سوار التجمد', en: 'Frost Band', hook: 'freezeOnHit', v: 0.08 },
  { id: 'cactus_amulet', ar: 'تميمة الصبار', en: 'Cactus Amulet', hook: 'thorns', v: 8 },
  { id: 'orb_magnet', ar: 'مغنطيس الجواهب', en: 'Orb Magnet', hook: 'magnet', v: 1 },
  { id: 'aegis_ward', ar: 'جلباب الأيجس', en: 'Aegis Ward', hook: 'shield30', v: 30 },
  { id: 'midas_fang', ar: 'ناب ميداس', en: "Midas' Fang", hook: 'doubleGold', v: 0.10 },
  { id: 'leech_ring', ar: 'خاتم العلقة', en: 'Leech Ring', hook: 'lifesteal', v: 0.03 },
  { id: 'rage_heart', ar: 'قلب الغضب', en: 'Rage Heart', hook: 'rageLowHp', v: 0.18 },
  { id: 'glass_skull', ar: 'الجمجمة الزجاجية', en: 'Glass Skull', hook: 'glass', v: 1 },
  { id: 'berserk_totem', ar: 'تميمة الهيجان', en: 'Berserker Totem', hook: 'berserk', v: 0.02 },
  { id: 'fire_trail', ar: 'أثر النار', en: 'Flame Trail', hook: 'dashTrail', v: 1 },
  { id: 'pierce_rune', ar: 'رمز الاختراق', en: 'Piercing Rune', hook: 'pierceBonus', v: 1 },
  { id: 'first_strike', ar: 'الضربة الأولى', en: 'First Strike', hook: 'firstHit', v: 0.4 },
  { id: 'shock_wave', ar: 'موجة الصدمة', en: 'Shockwave', hook: 'waveBurst', v: 1 },
  { id: 'frost_field', ar: 'حقل الصقيع', en: 'Frost Field', hook: 'slowAura', v: 0.12 },
  { id: 'crit_storm', ar: 'عاصفة الحرجة', en: 'Crit Storm', hook: 'critNova', v: 0.2 },
  { id: 'reaper_edge', ar: 'حد الحاصد', en: "Reaper's Edge", hook: 'execute', v: 0.30 },
  { id: 'echo_charm', ar: 'تميمة الصدى', en: 'Echo Charm', hook: 'echo', v: 0.15 },
  { id: 'wildfire_ash', ar: 'رماد الحريق', en: 'Wildfire Ash', hook: 'burningGround', v: 0.15 },
  { id: 'plague_seed', ar: 'بذرة الطاعون', en: 'Plague Seed', hook: 'poisonSpread', v: 0.25 },
  { id: 'blood_pact', ar: 'ميثاق الدم', en: 'Blood Pact', hook: 'vampire', v: 25 },
  { id: 'soul_net', ar: 'شبكة الأرواح', en: 'Soul Net', hook: 'soulCollector', v: 0.3 },
  { id: 'lucky_charm', ar: 'تميمة الحظ', en: 'Lucky Charm', hook: 'luckyChest', v: 0.3 }
];
Data.artifact = (id) => Data.ARTIFACTS.find(a => a.id === id);
const AD = (id) => { const a = Data.artifact(id); return { ar: a.ar + ': ' + (a.hook ? arHook(a.hook, a.v) : statAr(a.k, a.v, a.sk)), en: a.en + ': ' + (a.hook ? enHook(a.hook, a.v) : statEn(a.k, a.v, a.sk)) }; };
function statAr(k, v, sk) { const m = { dmg: 'الضرر +' + Math.round(v * 100) + '%', cd: 'تبريد أسرع ' + Math.round(v * 100) + '%', area: 'المساحة +' + Math.round(v * 100) + '%', ms: 'الحركة +' + Math.round(v * 100) + '%', armor: 'الدرع +' + v, regen: 'التجدد +' + v + '/ث', crit: 'الحرجة +' + Math.round(v * 100) + '%', critDmg: 'ضرر حرج +' + Math.round(v * 100) + '%', xp: 'الخبرة +' + Math.round(v * 100) + '%', pickup: 'الالتقاط +' + Math.round(v * 100) + '%', luck: 'الحظ +' + Math.round(v * 100) + '%', hp: 'الصحة +' + v, amount: 'مقذوف +1', revive: 'بعث +1', gold: 'الذهب +' + Math.round(v * 100) + '%', dashCd: 'تبريد الاندفاع -' + Math.round(v * 100) + '%', projSpeed: 'سرعة المقذوف +' + Math.round(v * 100) + '%', dodge: 'مراوغة +' + Math.round(v * 100) + '%', dmgBoss: 'ضرر الزعماء +' + Math.round(v * 100) + '%', dmgElite: 'ضرر النخبة +' + Math.round(v * 100) + '%', school: 'ضرر ' + Data.SCHOOLS[sk].ar + ' +' + Math.round(v * 100) + '%' }; return m[k] || ''; }
function statEn(k, v, sk) { const m = { dmg: '+' + Math.round(v * 100) + '% dmg', cd: 'Faster cast ' + Math.round(v * 100) + '%', area: '+' + Math.round(v * 100) + '% area', ms: '+' + Math.round(v * 100) + '% move', armor: '+' + v + ' armor', regen: '+' + v + ' regen/s', crit: '+' + Math.round(v * 100) + '% crit', critDmg: '+' + Math.round(v * 100) + '% crit dmg', xp: '+' + Math.round(v * 100) + '% XP', pickup: '+' + Math.round(v * 100) + '% pickup', luck: '+' + Math.round(v * 100) + '% luck', hp: '+' + v + ' HP', amount: '+1 projectile', revive: '+1 revive', gold: '+' + Math.round(v * 100) + '% gold', dashCd: '-' + Math.round(v * 100) + '% dash cd', projSpeed: '+' + Math.round(v * 100) + '% proj speed', dodge: '+' + Math.round(v * 100) + '% dodge', dmgBoss: '+' + Math.round(v * 100) + '% boss dmg', dmgElite: '+' + Math.round(v * 100) + '% elite dmg', school: '+' + Math.round(v * 100) + '% ' + Data.SCHOOLS[sk].en + ' dmg' }; return m[k] || ''; }
function arHook(h, v) { return { explodeOnKill: 'فرصة ' + Math.round(v * 100) + '% انفجار عند القتل', burnOnHit: 'فرصة ' + Math.round(v * 100) + '% إشعال', freezeOnHit: 'فرصة ' + Math.round(v * 100) + '% تجميد', thorns: 'شوك يعكس ' + v + ' ضرر', magnet: 'جذب الجواهب عن بُعد', shield30: 'درع يصد ضربة كل 30ث', doubleGold: 'فرصة ' + Math.round(v * 100) + '% ذهب مضاعف', lifesteal: 'امتصاص حياة ' + Math.round(v * 100) + '%', rageLowHp: '+' + Math.round(v * 100) + '% ضرر تحت نصف الصحة', glass: 'ضرر +25% لكن صحة -20%', berserk: 'سرعة تتراكم مع كل قتلة', dashTrail: 'الاندفاع يترك لهبًا', pierceBonus: 'مقذوفات تخترق +1', firstHit: 'أول ضربة لكل عدو +' + Math.round(v * 100) + '%', waveBurst: 'الاندفاع يطلق موجة صادمة', slowAura: 'إبطاء الأعداء القريبين ' + Math.round(v * 100) + '%', critNova: 'الضربات الحرجة تنفجر', execute: '+' + Math.round(v * 100) + '% ضرر للمرتحقين بالموت', echo: 'فرصة ' + Math.round(v * 100) + '% إلقاء مزدوج', burningGround: 'القتلات تترك نارًا', poisonSpread: 'السم ينتشر عند الموت', vampire: '+1 صحة كل ' + v + ' قتلة', soulCollector: '+30% خبرة من النخبة', luckyChest: 'فرصة ' + Math.round(v * 100) + '% مكافأة صندوق إضافية' }[h] || ''; }
function enHook(h, v) { return { explodeOnKill: Math.round(v * 100) + '% chance to explode on kill', burnOnHit: Math.round(v * 100) + '% chance to burn', freezeOnHit: Math.round(v * 100) + '% chance to freeze', thorns: 'Thorns reflect ' + v, magnet: 'Distant orb magnet', shield30: 'Block a hit every 30s', doubleGold: Math.round(v * 100) + '% double gold', lifesteal: Math.round(v * 100) + '% lifesteal', rageLowHp: '+' + Math.round(v * 100) + '% dmg below 50% HP', glass: '+25% dmg, -20% HP', berserk: 'Stacking speed per kill', dashTrail: 'Dash leaves fire', pierceBonus: 'Projectiles pierce +1', firstHit: 'First hit per enemy +' + Math.round(v * 100) + '%', waveBurst: 'Dash releases shockwave', slowAura: 'Slow nearby enemies ' + Math.round(v * 100) + '%', critNova: 'Crits explode', execute: '+' + Math.round(v * 100) + '% dmg to low HP', echo: Math.round(v * 100) + '% double cast', burningGround: 'Kills leave fire', poisonSpread: 'Poison spreads on death', vampire: '+1 HP per ' + v + ' kills', soulCollector: '+30% XP from elites', luckyChest: Math.round(v * 100) + '% bonus chest reward' }[h] || ''; }

// ─── التزامنات: تفاعلات بين المدارس المملوكة ───
Data.SYNERGIES = [
  { id: 'steam_burst', ar: 'بخار حارق', en: 'Steam Burst', req: { schools: ['fire', 'ice'] }, eff: { type: 'nova', cd: 5, dmg: 35, area: 130, school: 'ice' }, descAr: 'انفجار بخار دوري حولك', descEn: 'Periodic steam nova around you' },
  { id: 'toxic_blaze', ar: 'احتراق سام', en: 'Toxic Blaze', req: { schools: ['fire', 'poison'] }, eff: { type: 'flag', flag: 'burnBoost', v: 2 }, descAr: 'الإشعال يضر ضعفين', descEn: 'Burn damage doubled' },
  { id: 'frozen_storm', ar: 'عاصفة متجمدة', en: 'Frozen Storm', req: { schools: ['ice', 'lightning'] }, eff: { type: 'flag', flag: 'frozenZap', v: 1 }, descAr: 'المجمّدون يتصعقون باستمرار', descEn: 'Frozen enemies get zapped' },
  { id: 'shadow_plague', ar: 'طاعون الظل', en: 'Shadow Plague', req: { schools: ['dark', 'poison'] }, eff: { type: 'flag', flag: 'plagueBurst', v: 0.2 }, descAr: 'المسمومون ينفجرون عند الموت', descEn: 'Poisoned enemies explode on death' },
  { id: 'purifying_light', ar: 'نور مُطهِّر', en: 'Purifying Light', req: { schools: ['light', 'poison'] }, eff: { type: 'flag', flag: 'poisonHeal', v: 0.1 }, descAr: 'كل سم متفجر يشفاك', descEn: 'Poison ticks heal you' },
  { id: 'spirit_army', ar: 'جيش الأشباح', en: 'Spirit Army', req: { schools: ['dark', 'arcane'] }, eff: { type: 'stat', k: 'amount', v: 1 }, descAr: 'مقذوف +1 لكل الأسلحة', descEn: '+1 projectile to all weapons' },
  { id: 'wild_fury', ar: 'غضب برّي', en: 'Wild Fury', req: { schools: ['nature', 'physical'] }, eff: { type: 'stat', k: 'dmg', v: 0.12 }, descAr: 'الضرر +12%', descEn: '+12% damage' },
  { id: 'chain_reaction', ar: 'تفاعل متسلسل', en: 'Chain Reaction', req: { schools: ['chaos', 'lightning'] }, eff: { type: 'flag', flag: 'chainBonus', v: 2 }, descAr: 'البرق يقفز قفزتين إضافيتين', descEn: 'Chains jump 2 more times' },
  { id: 'cold_void', ar: 'الفراغ البارد', en: 'Cold Void', req: { schools: ['void', 'ice'] }, eff: { type: 'flag', flag: 'slowAura2', v: 0.1 }, descAr: 'هالة إبطاء دائمة حولك', descEn: 'Permanent slowing aura' },
  { id: 'eternal_flame', ar: 'النار الأبدية', en: 'Eternal Flame', req: { schools: ['fire', 'arcane'] }, eff: { type: 'flag', flag: 'burnFast', v: 1 }, descAr: 'النار تحترق أسرع', descEn: 'Burns tick faster' },
  { id: 'golden_frost', ar: 'الصقيع الذهبي', en: 'Golden Frost', req: { schools: ['ice', 'light'] }, eff: { type: 'flag', flag: 'frozenGold', v: 1 }, descAr: 'المجمّدون يسقطون ذهبًا مضاعفًا', descEn: 'Frozen kills drop double gold' },
  { id: 'arcane_bloom', ar: 'تفتّح سحري', en: 'Arcane Bloom', req: { schools: ['arcane', 'nature'] }, eff: { type: 'stat', k: 'area', v: 0.18 }, descAr: 'المساحة +18%', descEn: '+18% area' },
  { id: 'dark_arsenal', ar: 'ترسانة الظلام', en: 'Dark Arsenal', req: { schools: ['dark', 'physical'] }, eff: { type: 'stat', k: 'crit', v: 0.08 }, descAr: 'الحرجة +8%', descEn: '+8% crit' },
  { id: 'twin_storms', ar: 'عواصف توأم', en: 'Twin Storms', req: { schools: ['lightning', 'void'] }, eff: { type: 'stat', k: 'projSpeed', v: 0.15 }, descAr: 'سرعة المقذوفات +15%', descEn: '+15% projectile speed' },
  { id: 'thorn_skin', ar: 'جلد الشوك', en: 'Thorn Skin', req: { schools: ['nature', 'fire'] }, eff: { type: 'flag', flag: 'thorns2', v: 10 }, descAr: 'شوك يلسع من يلمسك', descEn: 'Thorns punish contact' },
  { id: 'healing_well', ar: 'بئر الشفاء', en: 'Healing Well', req: { schools: ['light', 'nature'] }, eff: { type: 'stat', k: 'regen', v: 1 }, descAr: 'التجدد +1/ث', descEn: '+1 regen/s' },
  { id: 'giantbane', ar: 'قاتل العمالقة', en: 'Giantbane', req: { schools: ['physical', 'arcane'] }, eff: { type: 'stat', k: 'dmgBoss', v: 0.2 }, descAr: 'ضرر الزعماء +20%', descEn: '+20% boss damage' },
  { id: 'soul_harvest', ar: 'حصاد الأرواح', en: 'Soul Harvest', req: { schools: ['dark', 'void'] }, eff: { type: 'stat', k: 'xp', v: 0.15 }, descAr: 'الخبرة +15%', descEn: '+15% XP' },
  { id: 'chaos_vortex', ar: 'دوامة الفوضى', en: 'Chaos Vortex', req: { schools: ['chaos', 'void'] }, eff: { type: 'flag', flag: 'chaosStrike', v: 0.08 }, descAr: 'فرصة 8% انفجار فوضوي', descEn: '8% chaos blast on hit' },
  { id: 'tri_unity', ar: 'اتحاد المدارس', en: 'Tri-Unity', req: { schoolsAny: 3 }, eff: { type: 'stat', k: 'dmg', v: 0.10 }, descAr: 'امتلك 3 مدارس: الضرر +10%', descEn: 'Own 3 schools: +10% damage' }
];

/* ══════════════════════ Data/ — الإنجازات (83+) والتحديات ══════════════════════ */
Data.ACHIEVEMENTS = [];
(function () {
  const A = Data.ACHIEVEMENTS;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  // مولّد الرتب: اسم فئة + ترقيم روماني، ووظيفة قياس التقدم من بيانات الحفظ
  const mk = (arr, key, cat, icon, dar, den, get) => arr.forEach((n, i) => A.push({ id: key + '_' + n, cat, icon, n, ar: dar + ' ' + roman[i], en: den + ' ' + roman[i], get, target: n }));
  mk([50, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], 'kills', 'قتل', '⚔', 'قاتل الأعداء', 'Enemy Slayer', m => m.stats.kills);
  A.slice(-10).forEach((a, i) => { a.dar = 'اقتل ' + ['50', '200', '500', '1,000', '2,500', '5,000', '10,000', '25,000', '50,000', '100,000'][i] + ' عدوًا'; a.den = 'Slay ' + a.dar.split(' ')[1] + ' enemies'; });
  mk([5, 10, 15, 20, 25, 30, 35, 40, 45, 50], 'level', 'مستوى', '★', 'ارتقاء المستوى', 'Level Ascendant', m => m.stats.maxLevel);
  A.slice(-10).forEach((a, i) => { a.dar = 'اوصل للمستوى ' + a.n + ' في جولة واحدة'; a.den = 'Reach level ' + a.n + ' in one run'; });
  mk([1, 5, 10, 25, 50, 100], 'runs', 'جولات', '▶', 'محارب متمرس', 'Seasoned Warrior', m => m.stats.runs);
  A.slice(-6).forEach(a => { a.dar = 'العب ' + a.n + ' جولات'; a.den = 'Play ' + a.n + ' runs'; });
  mk([100, 500, 1000, 5000, 10000, 50000], 'gold', 'ثروة', '◉', 'جامع الكنوز', 'Treasure Hoarder', m => m.stats.totalGold);
  A.slice(-6).forEach(a => { a.dar = 'اجمع ' + a.n + ' ذهبًا إجمالًا'; a.den = 'Earn ' + a.n + ' gold total'; });
  mk([100, 300, 600, 1000, 2000], 'killrun', 'مذبحة', '☠', 'موجة الدم', 'Blood Wave', m => m.stats.maxKillsRun);
  A.slice(-5).forEach(a => { a.dar = 'اقتل ' + a.n + ' عدوًا في جولة واحدة'; a.den = 'Kill ' + a.n + ' in one run'; });
  mk([5, 8, 10, 12, 15], 'time', 'صمود', '⌛', 'صامد', 'Endurer', m => Math.floor(m.stats.bestTime / 60));
  A.slice(-5).forEach(a => { a.dar = 'انجُ ' + a.n + ' دقائق في جولة'; a.den = 'Survive ' + a.n + ' minutes'; });
  mk([1, 3, 5, 10], 'evolutions', 'تطور', '✦', 'المُطوِّر', 'Evolver', m => m.stats.evolutions);
  A.slice(-4).forEach(a => { a.dar = 'طوّر ' + a.n + ' أسلحة إجمالًا'; a.den = 'Evolve ' + a.n + ' weapons total'; });
  mk([1, 2, 3], 'evolverun', 'قمة', '◈', 'الصعود الكبير', 'Grand Ascension', m => m.stats.maxEvolveRun);
  A.slice(-3).forEach(a => { a.dar = 'طوّر ' + a.n + ' أسلحة في جولة واحدة'; a.den = 'Evolve ' + a.n + ' weapons in one run'; });
  mk([1, 3, 5, 10, 15], 'bosses', 'زعماء', '♛', 'قاتل الزعماء', 'Boss Slayer', m => m.stats.bosses);
  A.slice(-5).forEach(a => { a.dar = 'اقتل ' + a.n + ' زعيمًا'; a.den = 'Defeat ' + a.n + ' bosses'; });
  const stageIcons = ['▦', '❄', '≋', '▲', '◉'];
  Data.STAGES.forEach((s, i) => A.push({ id: 'stage_' + s.id, cat: 'مراحل', icon: stageIcons[i] || '▲', n: 1, dar: 'أكمل مرحلة ' + s.ar, en: 'Clear ' + s.en, get: m => (m.stats.stageClears[s.id] || 0) }));
  mk([5, 15, 30, 40], 'wpn', 'ترسانة', '✧', 'جامع الأسلحة', 'Weapon Collector', m => Object.keys(m.stats.weaponsFound).length);
  A.slice(-4).forEach(a => { a.dar = 'اكتشف ' + a.n + ' سلاحًا مختلفًا'; a.den = 'Discover ' + a.n + ' weapons'; });
  mk([5, 15, 30, 45], 'art', 'آثار', '⬟', 'عالم الآثار', 'Relic Hunter', m => Object.keys(m.stats.artifactsFound).length);
  A.slice(-4).forEach(a => { a.dar = 'اعثر على ' + a.n + ' قطعة أثرية'; a.den = 'Find ' + a.n + ' artifacts'; });
  mk([1, 3, 5], 'comp', 'رفاق', '☉', 'رابط العهود', 'Bond Keeper', m => Object.keys(m.stats.companionsUsed).length);
  A.slice(-3).forEach(a => { a.dar = 'قاتل بمرافق ' + a.n + ' مختلفة'; a.den = 'Fight with ' + a.n + ' companions'; });
  mk([3, 5, 10], 'chars', 'أبطال', '♞', 'قائد الفرق', 'Roster Master', m => m.unlockedChars.length);
  A.slice(-3).forEach(a => { a.dar = 'افتح ' + a.n + ' شخصيات'; a.den = 'Unlock ' + a.n + ' characters'; });
  mk([1, 5, 15, 30], 'talent', 'مواهب', '✚', 'المُنير', 'Enlightened', m => m.stats.talentsBought);
  A.slice(-4).forEach(a => { a.dar = 'اشترِ ' + a.n + ' موهبة'; a.den = 'Buy ' + a.n + ' talents'; });
  mk([1, 5, 15], 'chal', 'تحديات', '⚑', 'متحدّي القدر', 'Fate Challenger', m => m.stats.challengesDone);
  A.slice(-3).forEach(a => { a.dar = 'أكمل ' + a.n + ' تحديات'; a.den = 'Complete ' + a.n + ' challenges'; });
  mk([1, 7, 30], 'daily', 'دؤوب', '☀', 'النجوم الدؤوب', 'Daily Star', m => m.stats.dailiesDone);
  A.slice(-3).forEach(a => { a.dar = 'أكمل ' + a.n + ' تحديات يومية'; a.den = 'Complete ' + a.n + ' dailies'; });
})();
Data.achievement = (id) => Data.ACHIEVEMENTS.find(a => a.id === id);

// ─── قوالب التحديات اليومية/الأسبوعية ───
Data.CHALLENGE_TYPES = [
  { id: 'kills', ar: 'اقتل {n} عدوًا', en: 'Slay {n} enemies', d: [150, 600], w: [800, 1500], ev: 'kills' },
  { id: 'gold', ar: 'اجمع {n} ذهبًا', en: 'Collect {n} gold', d: [120, 400], w: [600, 1000], ev: 'gold' },
  { id: 'level', ar: 'اوصل للمستوى {n}', en: 'Reach level {n}', d: [8, 14], w: [15, 22], ev: 'level' },
  { id: 'elite', ar: 'اقتل {n} من النخبة', en: 'Kill {n} elites', d: [3, 8], w: [12, 20], ev: 'elite' },
  { id: 'time', ar: 'انجُ {n} دقائق في جولة', en: 'Survive {n} minutes', d: [4, 8], w: [10, 12], ev: 'time', max: true },
  { id: 'boss', ar: 'اقتل {n} زعيمًا', en: 'Defeat {n} bosses', d: [1, 1], w: [2, 3], ev: 'boss' },
  { id: 'evolve', ar: 'طوّر {n} سلاحًا', en: 'Evolve {n} weapons', d: [1, 1], w: [2, 3], ev: 'evolve' },
  { id: 'chest', ar: 'افتح {n} صناديق', en: 'Open {n} chests', d: [2, 4], w: [6, 10], ev: 'chest' },
  { id: 'schoolkill', ar: 'اقتل {n} بأسلحة {s}', en: 'Kill {n} with {s} weapons', d: [60, 150], w: [300, 500], ev: 'killSchool' }
];
Data.CHALLENGE_SCHOOLS = ['fire', 'ice', 'lightning', 'poison', 'dark', 'nature'];
/* ══════════════════════ Systems/Save — الحفظ الدائم عبر IndexedDB ══════════════════════ */
// كائن الحفظ العالمي: تشير إليه كل الأنظمة عبر «Meta» مباشرة
let Meta = null;
const Save = {
  db: null, driver: 'ls', Meta: null, _dirty: false, _saveTimer: 0, _ready: false,

  // الهيكل الافتراضي للحفظ (يُدمج عميقًا مع القديم للتوافق المستقبلي)
  defaults() {
    return {
      ver: 2, createdAt: Date.now(),
      lang: 'ar',
      settings: { sfx: 0.7, music: 0.5, perf: false, fps: false, haptics: true, shake: true, uiScale: 1, deadzone: 0.15, autoaim: true, batterySaver: true },
      gold: 0, shards: 0,
      unlockedChars: ['arcane'], unlockedCompanions: ['none'], unlockedStages: ['crypt'], selectedChar: 'arcane', selectedStage: 'crypt', selectedComp: 'none',
      talents: {},
      stats: {
        kills: 0, runs: 0, totalGold: 0, bestTime: 0, evolutions: 0, maxEvolveRun: 0, bosses: 0, elites: 0,
        maxLevel: 0, maxKillsRun: 0, talentsBought: 0, challengesDone: 0, dailiesDone: 0, deaths: 0, victories: 0, playTime: 0,
        stageClears: {}, weaponsFound: {}, artifactsFound: {}, enemiesSeen: {}, companionsUsed: {}
      },
      achievements: {}, history: [], leaderboard: [],
      challenges: { daily: { date: '', list: [] }, weekly: { week: '', list: [] } }
    };
  },

  // دمج عميق لتفادي فقدان الحقول الجديدة مع الحفظ القديم
  merge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) this.merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  },

  open() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      // v2.2: نسخة 2 تضيف مخزن skin_images لصور السكنات المخصصة
      const upgrade = (db) => { if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); if (!db.objectStoreNames.contains('skin_images')) db.createObjectStore('skin_images'); };
      try {
        const req = indexedDB.open('ArcaneSurvivorDB', 2);
        req.onupgradeneeded = () => upgrade(req.result);
        req.onsuccess = () => {
          this.db = req.result;
          // تحصين: قاعدة قديمة بنسخة أقل أو بلا مخازن ← إعادة فتح بنسخة أعلى لإنشائها
          if (!this.db.objectStoreNames.contains('meta') || !this.db.objectStoreNames.contains('skin_images')) {
            const v = this.db.version;
            this.db.close();
            const req2 = indexedDB.open('ArcaneSurvivorDB', Math.max(2, v + 1));
            req2.onupgradeneeded = () => upgrade(req2.result);
            req2.onsuccess = () => { this.db = req2.result; this.driver = 'idb'; finish(true); };
            req2.onerror = () => { this.driver = 'ls'; finish(false); };
            return;
          }
          this.driver = 'idb'; finish(true);
        };
        req.onerror = () => { this.driver = 'ls'; finish(false); };
        setTimeout(() => { if (!done) { done = true; this.driver = 'ls'; resolve(false); } }, 2500);
      } catch (e) { this.driver = 'ls'; resolve(false); }
    });
  },

  idbGet() {
    return new Promise((resolve) => {
      if (!this.db) return resolve(null);
      try {
        const tx = this.db.transaction('meta', 'readonly');
        const rq = tx.objectStore('meta').get('main');
        rq.onsuccess = () => resolve(rq.result || null);
        rq.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },
  idbSet(val) {
    return new Promise((resolve) => {
      if (!this.db) return resolve(false);
      try {
        const tx = this.db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(val, 'main');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },

  // ── v2.2: دوال مخازن عامة (تستخدمها صور السكنات في مخزن skin_images) ──
  storeGet(store, key) {
    return new Promise((resolve) => {
      if (!this.db || this.driver !== 'idb' || !this.db.objectStoreNames.contains(store)) return resolve(null);
      try {
        const rq = this.db.transaction(store, 'readonly').objectStore(store).get(key);
        rq.onsuccess = () => resolve(rq.result === undefined ? null : rq.result);
        rq.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },
  storePut(store, key, val) {
    return new Promise((resolve) => {
      if (!this.db || this.driver !== 'idb' || !this.db.objectStoreNames.contains(store)) return resolve(false);
      try {
        const tx = this.db.transaction(store, 'readwrite');
        tx.objectStore(store).put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },
  storeDel(store, key) {
    return new Promise((resolve) => {
      if (!this.db || this.driver !== 'idb' || !this.db.objectStoreNames.contains(store)) return resolve(false);
      try {
        const tx = this.db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },
  storeClear(store) {
    return new Promise((resolve) => {
      if (!this.db || this.driver !== 'idb' || !this.db.objectStoreNames.contains(store)) return resolve(false);
      try {
        const tx = this.db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },

  async load() {
    await this.open();
    let raw = null;
    if (this.driver === 'idb') raw = await this.idbGet();
    if (!raw) {
      // احتياطي: التحقق من الحفظ القديم في localStorage
      try { const ls = localStorage.getItem('as_meta_v2'); if (ls) raw = JSON.parse(ls); } catch (e) { }
    }
    this.Meta = this.merge(this.defaults(), raw || {});
    if (!raw && I18N) { try { const l = localStorage.getItem('as_lang'); if (l) this.Meta.lang = l; } catch (e) { } }
    this._ready = true;
    Meta = this.Meta; // الربط العالمي الذي تعتمده كل الأنظمة
    AS.Meta = Meta;
    return Meta;
  },

  // حفظ مؤجَّل قصير (debounce) لتقليل الكتابات
  mark() { this._dirty = true; },
  async flush() {
    if (!this._dirty || !this.Meta) return;
    this._dirty = false;
    if (this.driver === 'idb') await this.idbSet(this.Meta);
    else { try { localStorage.setItem('as_meta_v2', JSON.stringify(this.Meta)); } catch (e) { } }
  },
  // يعمل بصمت دون setInterval — يُستدعى من حلقة rAF
  tick(dt) {
    this._saveTimer += dt;
    if (this._saveTimer >= 20) { this._saveTimer = 0; if (this._dirty) { this.flush(); Bus.emit('autosaved'); } }
    else if (this._dirty && this._saveTimer > 0.8) this.flush();
  },

  // ─── تصدير/استيراد بصيغة JSON مع مجموع تحقق fnv1a ───
  exportSave() {
    const json = JSON.stringify(this.Meta);
    const wrap = { v: 2, chk: U.fnv1a(json), data: json };
    return btoa(unescape(encodeURIComponent(JSON.stringify(wrap))));
  },
  importSave(str) {
    try {
      const wrap = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!wrap || wrap.v !== 2 || U.fnv1a(wrap.data) !== wrap.chk) return false;
      const parsed = JSON.parse(wrap.data);
      this.Meta = this.merge(this.defaults(), parsed);
      Meta = this.Meta; AS.Meta = Meta;
      this._dirty = true; this.flush();
      return true;
    } catch (e) { return false; }
  },
  async wipe() {
    this.Meta = this.defaults();
    Meta = this.Meta; AS.Meta = Meta;
    this._dirty = true; await this.flush();
  }
};
AS.Save = Save;
/* ══════════════════════ Systems/Audio — موسيقى ومؤثرات إجرائية بالكامل ══════════════════════ */
const Audio = {
  ctx: null, ok: false, master: null, musicBus: null, sfxBus: null, mFilter: null,
  layers: {}, droneOsc: [], noiseBuf: null, stageCfg: null, step: 0, nextT: 0,
  intensity: 0, bossOn: false, hpPct: 1, _count: 0, _started: false,

  // تُستدعى عند أول تفاعل من المستخدم (سياسة المتصفحات)
  init() {
    if (this.ok) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.mFilter = this.ctx.createBiquadFilter(); this.mFilter.type = 'lowpass'; this.mFilter.frequency.value = 18000;
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = Meta.settings.music * 0.6;
      this.musicBus.connect(this.mFilter); this.mFilter.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = Meta.settings.sfx; this.sfxBus.connect(this.master);
      // عازل ضوضاء أبيض معاد الاستخدام لكل المؤثرات
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // طبقات الموسيقى الست مع كسب منفصل لكل واحدة
      for (const n of ['drone', 'bass', 'arp', 'pad', 'perc', 'boss']) {
        const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.musicBus); this.layers[n] = g;
      }
      // الدرون: موجتان منخفضتان مستمرتان تُعاد معايرتهما لكل مرحلة
      for (let i = 0; i < 2; i++) {
        const o = this.ctx.createOscillator(); o.type = i ? 'sawtooth' : 'triangle';
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
        o.connect(f); f.connect(this.layers.drone); o.start();
        this.droneOsc.push({ o, f });
      }
      this.ok = true; this.nextT = this.ctx.currentTime + 0.1;
      Log.log('Audio initialized');
    } catch (e) { Log.warn('Audio init failed', e.message); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { }); },

  setVolumes() {
    if (!this.ok) return;
    this.musicBus.gain.setTargetAtTime(Meta.settings.music * 0.6, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(Meta.settings.sfx, this.ctx.currentTime, 0.1);
  },

  // هوية موسيقية لكل مرحلة: جذر + سلم + إيقاع
  setStage(stage) {
    this.stageCfg = stage ? stage.music : null;
    if (this.ok && this.stageCfg) {
      const t = this.ctx.currentTime;
      this.droneOsc.forEach((d, i) => { d.o.frequency.setTargetAtTime(this.stageCfg.root * (i ? 1.005 : 0.5), t, 0.5); });
    }
  },
  setMood(intensity, boss, hpPct) { this.intensity = intensity; this.bossOn = boss; this.hpPct = hpPct; },

  frame() {
    if (!this.ok || this.ctx.state !== 'running') return;
    this._count = 0;
    // تنعيم كسب الطبقات حسب الموقف القتالي وصحة اللاعب
    const g = this.layers, tgt = {
      drone: 0.16, bass: 0.10 + this.intensity * 0.08,
      arp: this.intensity * 0.16, pad: 0.06 + (1 - this.intensity) * 0.05,
      perc: 0.05 + this.intensity * 0.14, boss: this.bossOn ? 0.2 : 0
    };
    for (const k in tgt) g[k].gain.setTargetAtTime(tgt[k], this.ctx.currentTime, 0.4);
    this.mFilter.frequency.setTargetAtTime(this.hpPct < 0.35 ? 1400 : 18000, this.ctx.currentTime, 0.3);
    if (!this.stageCfg) return;
    // المجدول: يخطط للأحداث القادمة ب lookahead لتجنب التقطيع
    const spb = 60 / this.stageCfg.bpm, s16 = spb / 4;
    if (this.nextT < this.ctx.currentTime) this.nextT = this.ctx.currentTime + 0.05;
    while (this.nextT < this.ctx.currentTime + 0.22) {
      this.scheduleStep(this.step, this.nextT, s16);
      this.step = (this.step + 1) % 64; this.nextT += s16;
    }
  },

  scheduleStep(st, t, s16) {
    const sc = this.stageCfg.scale, root = this.stageCfg.root;
    const deg = (i) => root * Math.pow(2, sc[i % sc.length] / 12 + Math.floor(i / sc.length));
    if (st % 4 === 0) this.tone({ f: deg(st % 8 === 0 ? 0 : 2) / 2, at: t, dur: s16 * 3.2, type: 'triangle', v: 0.5, dest: this.layers.bass });
    if (st % 8 === 0) this.kick(t, st % 32 === 0 ? 0.9 : 0.6);
    if (st % 8 === 4 && this.intensity > 0.3) this.hat(t, 0.5);
    if (st % 2 === 1 && this.intensity > 0.12) {
      const i = (st * 7 + Math.floor(st / 16)) % 12;
      this.pluck(deg(i) * 2, t, this.layers.arp);
    }
    if (st === 0 || st === 32) {
      for (let i = 0; i < 3; i++) this.tone({ f: deg(i * 2), at: t, dur: s16 * 14, type: 'sine', v: 0.10, dest: this.layers.pad });
    }
    if (this.bossOn) { // طبقة الزعيم: باس قيادة مزدوج السرعة
      if (st % 2 === 0) this.tone({ f: root / 2, at: t, dur: s16 * 1.6, type: 'sawtooth', v: 0.35, dest: this.layers.boss });
    }
  },
  kick(t, v) {
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gn.gain.setValueAtTime(v * 0.9, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(gn); gn.connect(this.layers.perc); o.start(t); o.stop(t + 0.2);
  },
  hat(t, v) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const gn = this.ctx.createGain(); gn.gain.setValueAtTime(v * 0.25, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(gn); gn.connect(this.layers.perc); s.start(t, Math.random()); s.stop(t + 0.07);
  },
  pluck(f, t, dest) {
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    gn.gain.setValueAtTime(0.28, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + 0.25);
  },
  tone(o) {
    if (!this.ok) return;
    const t = o.at || this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gn = this.ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.dur || 0.15));
    const v = o.v || 0.3;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(v, t + (o.attack || 0.006));
    gn.gain.exponentialRampToValueAtTime(0.001, t + (o.dur || 0.15));
    let node = gn;
    if (o.pan !== undefined && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = U.clamp(o.pan, -1, 1); gn.connect(p); node = p; }
    osc.connect(gn); node.connect(o.dest || this.sfxBus);
    osc.start(t); osc.stop(t + (o.dur || 0.15) + 0.05);
  },
  noise(o) {
    if (!this.ok) return;
    const t = o.at || this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 800, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + o.dur);
    const gn = this.ctx.createGain(); gn.gain.setValueAtTime(o.v || 0.25, t); gn.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
    let node = gn;
    if (o.pan !== undefined && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = U.clamp(o.pan, -1, 1); gn.connect(p); node = p; }
    s.connect(f); f.connect(gn); node.connect(o.dest || this.sfxBus);
    s.start(t, Math.random()); s.stop(t + o.dur + 0.05);
  },

  // مؤثرات صوتية مُسمّاة مع pan مكاني حسب موضع الحدث على الشاشة
  sfx(name, wx) {
    if (!this.ok || this._count > 7 || this.ctx.state !== 'running') return;
    this._count++;
    const P = (wx === undefined || !Game.run) ? 0 : U.clamp((wx - Game.run.player.x) / 420, -1, 1);
    const S = Data.SCHOOLS, sc = { fire: 220, ice: 480, lightning: 620, poison: 300, dark: 180, light: 560, arcane: 420, nature: 260, chaos: 380, void: 150, physical: 340 };
    switch (name) {
      case 'click': this.tone({ f: 660, f2: 520, type: 'square', v: 0.12, dur: 0.06 }); break;
      case 'shoot': { const base = this.lastSchool ? sc[this.lastSchool] : 380; this.tone({ f: base * 1.5, f2: base, type: 'triangle', v: 0.07, dur: 0.09, pan: P }); break; }
      case 'hit': this.noise({ f: 1600, f2: 300, v: 0.09, dur: 0.07, pan: P }); break;
      case 'crit': this.tone({ f: 880, f2: 1320, type: 'square', v: 0.12, dur: 0.1, pan: P }); break;
      case 'hurt': this.tone({ f: 180, f2: 70, type: 'sawtooth', v: 0.3, dur: 0.25 }); this.noise({ f: 900, f2: 200, v: 0.25, dur: 0.2 }); break;
      case 'dash': this.noise({ f: 400, f2: 3200, ft: 'bandpass', v: 0.2, dur: 0.22 }); break;
      case 'pickup': this.tone({ f: 780, f2: 1240, type: 'sine', v: 0.1, dur: 0.09, pan: P }); break;
      case 'gold': this.tone({ f: 988, v: 0.12, dur: 0.07 }); this.tone({ f: 1319, v: 0.1, dur: 0.12, at: this.ctx.currentTime + 0.06 }); break;
      case 'levelup': [523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', v: 0.22, dur: 0.16, at: this.ctx.currentTime + i * 0.09 })); break;
      case 'evolve': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'sine', v: 0.2, dur: 0.3, at: this.ctx.currentTime + i * 0.08 })); this.noise({ f: 300, f2: 4000, v: 0.15, dur: 0.5 }); break;
      case 'chest': [659, 784, 988].forEach((f, i) => this.tone({ f, type: 'triangle', v: 0.18, dur: 0.25, at: this.ctx.currentTime + i * 0.1 })); break;
      case 'boss': this.tone({ f: 110, f2: 40, type: 'sawtooth', v: 0.4, dur: 0.9 }); this.noise({ f: 500, f2: 80, v: 0.3, dur: 0.9 }); break;
      case 'bossdie': this.noise({ f: 2000, f2: 60, v: 0.4, dur: 1.1 }); this.tone({ f: 90, f2: 30, type: 'sine', v: 0.5, dur: 1.0 }); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'triangle', v: 0.25, dur: 0.35, at: this.ctx.currentTime + i * 0.13 })); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone({ f, type: 'sine', v: 0.25, dur: 0.4, at: this.ctx.currentTime + i * 0.18 })); break;
      case 'banish': this.tone({ f: 600, f2: 150, type: 'sawtooth', v: 0.15, dur: 0.3 }); break;
      case 'unlock': this.tone({ f: 784, v: 0.2, dur: 0.15 }); this.tone({ f: 1175, v: 0.2, dur: 0.3, at: this.ctx.currentTime + 0.12 }); break;
      case 'heal': this.tone({ f: 520, f2: 780, type: 'sine', v: 0.15, dur: 0.2 }); break;
      case 'freeze': this.tone({ f: 1400, f2: 2100, type: 'sine', v: 0.08, dur: 0.12, pan: P }); break;
      case 'explode': this.noise({ f: 1200, f2: 100, v: 0.28, dur: 0.35, pan: P }); this.tone({ f: 120, f2: 50, v: 0.25, dur: 0.3, pan: P }); break;
      case 'zap': this.tone({ f: 900, f2: 200, type: 'sawtooth', v: 0.1, dur: 0.08, pan: P }); break;
      case 'telegraph': this.tone({ f: 220, f2: 330, type: 'square', v: 0.08, dur: 0.15, pan: P }); break;
    }
  }
};
AS.Audio = Audio;
/* ══════════════════════ Systems/Input — لوحة، لمس، عصا، ذراع تحكم ══════════════════════ */
const Input = {
  moveVec: { x: 0, y: 0 }, aimVec: { x: 0, y: 0 }, aimHoldT: 0,
  dashQueued: false, abilities: [false, false, false, false, false, false, false, false],
  keys: new Set(), joyId: null, aimId: null, joyOrigin: { x: 0, y: 0 }, joyVec: { x: 0, y: 0 },
  gpPrev: {}, _lastTapT: 0,

  init() {
    // ─── لوحة المفاتيح ───
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && Game.state === 'playing') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === ' ') this.dashQueued = true;
      if (k >= '1' && k <= '8') this.abilities[+k - 1] = true;
      if (k === 'escape' || k === 'p') Bus.emit('pauseToggle');
      if (k === '`' || k === '~') Bus.emit('toggleDebug');
      if (k === 'f') Bus.emit('toggleFullscreen');
      Audio.init(); Audio.resume();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.joyId = null; this.aimId = null; UI.hideJoystick(); });

    // ─── اللمس: أول إصبع عصا ديناميكية، إصبع ثانٍ تصويب يدوي ───
    const isBtn = (el) => el && el.closest && el.closest('button, input, .switch, a');
    window.addEventListener('touchstart', (e) => {
      Audio.init(); Audio.resume();
      if (Game.state !== 'playing') return;
      for (const tch of e.changedTouches) {
        if (isBtn(tch.target)) continue;
        if (this.joyId === null) {
          this.joyId = tch.identifier; this.joyOrigin = { x: tch.clientX, y: tch.clientY };
          this.joyVec = { x: 0, y: 0 }; UI.showJoystick(tch.clientX, tch.clientY);
          e.preventDefault();
        } else if (this.aimId === null) {
          this.aimId = tch.identifier;
          this.setAimFromScreen(tch.clientX, tch.clientY);
          e.preventDefault();
        }
      }
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (Game.state !== 'playing') return;
      for (const tch of e.changedTouches) {
        if (tch.identifier === this.joyId) {
          const dx = tch.clientX - this.joyOrigin.x, dy = tch.clientY - this.joyOrigin.y;
          const len = Math.hypot(dx, dy), max = 52;
          const cl = Math.min(len, max);
          const nx = len > 1 ? dx / len : 0, ny = len > 1 ? dy / len : 0;
          this.joyVec = { x: nx * (cl / max), y: ny * (cl / max) };
          UI.moveJoystick(this.joyVec, cl, max);
          e.preventDefault();
        } else if (tch.identifier === this.aimId) {
          this.setAimFromScreen(tch.clientX, tch.clientY);
          e.preventDefault();
        }
      }
    }, { passive: false });
    const endTouch = (e) => {
      for (const tch of e.changedTouches) {
        if (tch.identifier === this.joyId) { this.joyId = null; this.joyVec = { x: 0, y: 0 }; UI.hideJoystick(); }
        if (tch.identifier === this.aimId) this.aimId = null;
      }
    };
    window.addEventListener('touchend', endTouch); window.addEventListener('touchcancel', endTouch);
    // منع قائمة السياق أثناء اللعب
    window.addEventListener('contextmenu', (e) => { if (Game.state === 'playing') e.preventDefault(); });

    // ─── زر الاندفاع اللمسي ───
    const dashBtn = document.getElementById('btn-dash');
    dashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.dashQueued = true; Audio.resume(); }, { passive: false });
    dashBtn.addEventListener('mousedown', () => { this.dashQueued = true; });

    // نقرة مزدوجة بالفأرة = تصويب يدوي نحو المؤشر
    const cv = document.getElementById('game');
    cv.addEventListener('mousedown', (e) => {
      Audio.init(); Audio.resume();
      if (Game.state !== 'playing') return;
      const now = performance.now();
      if (now - this._lastTapT < 300) this.setAimFromScreen(e.clientX, e.clientY);
      this._lastTapT = now;
    });
  },

  // تحويل نقطة شاشة إلى اتجاه تصويب (اللاعب دائمًا بمركز الشاشة)
  setAimFromScreen(sx, sy) {
    const w = window.innerWidth, h = window.innerHeight;
    const dx = sx - w / 2, dy = sy - h / 2, len = Math.hypot(dx, dy) || 1;
    this.aimVec = { x: dx / len, y: dy / len }; this.aimHoldT = 2.2;
  },

  // يُقرأ في كل خطوة فيزياء ثابتة
  update(dt) {
    let mx = 0, my = 0;
    // لوحة المفاتيح
    const K = this.keys;
    if (K.has('a') || K.has('arrowleft')) mx -= 1;
    if (K.has('d') || K.has('arrowright')) mx += 1;
    if (K.has('w') || K.has('arrowup')) my -= 1;
    if (K.has('s') || K.has('arrowdown')) my += 1;
    // العصا اللمسية مع منطقة ميتة قابلة للضبط
    const dz = Meta.settings.deadzone;
    const jx = Math.abs(this.joyVec.x) > dz ? this.joyVec.x : 0;
    const jy = Math.abs(this.joyVec.y) > dz ? this.joyVec.y : 0;
    if (jx || jy) { mx = jx; my = jy; }
    // ذراع التحكم (Gamepad): عصا يسرى حركة، يمنى تصويب، A اندفاع
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.hypot(ax, ay) > 0.22) { mx = ax; my = ay; }
        const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
        if (Math.hypot(rx, ry) > 0.35) { this.aimVec = { x: rx, y: ry }; this.aimHoldT = 0.4; }
        const btn = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        if (btn(0) && !this.gpPrev[0]) this.dashQueued = true;
        for (let b = 2; b <= 5; b++) if (btn(b) && !this.gpPrev[b]) this.abilities[b - 2] = true;
        if (btn(9) && !this.gpPrev[9]) Bus.emit('pauseToggle');
        for (let i = 0; i < 16; i++) this.gpPrev[i] = btn(i);
        break;
      }
    } catch (e) { }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.moveVec = { x: mx, y: my };
    if (this.aimHoldT > 0) this.aimHoldT -= dt;
  },

  consumeDash() { const d = this.dashQueued; this.dashQueued = false; return d; },
  consumeAbility(i) { const a = this.abilities[i]; this.abilities[i] = false; return a; }
};
AS.Input = Input;
/* ══════════════════════ Systems/Spawn+Waves — التوليد والموجات والزعماء ══════════════════════ */
const Spawn = {
  // توليد عدو مع تحجيم زمني/مرحلي ومعدّلات الصعوبة
  spawnEnemy(typeId, x, y, affix, skipRecord) {
    const r = Game.run, def = Data.enemy(typeId);
    const e = Core.pools.enemies.get();
    if (!e) return null;
    const t = r.time, mods = r.mods;
    const hpMul = (1 + (t / 60) * 0.5) * (1 + r.stageIdx * 0.35) * (mods.power ? 1.4 : 1) * r.adapt;
    e.def = def; e.uid = Core.uidSeq++;
    e.x = e.px = x; e.y = e.py = y; e.vx = 0; e.vy = 0;
    e.maxHp = e.hp = def.hp * hpMul * (affix ? 4.5 : 1);
    e.r = def.r * (mods.giant ? 1.5 : 1) * (affix ? 1.35 : 1);
    e.dmg = def.dmg * (1 + t / 300) * (mods.power ? 1.3 : 1);
    e.spd = def.spd * (mods.speed ? 1.18 : 1) * (1 + r.stageIdx * 0.04);
    e.xp = def.xp * (affix ? 8 : 1);
    e.elite = affix || null; e.isBoss = false;
    e.state = 'walk'; e.stateT = 0; e.touchCd = 0; e.flash = 0;
    e.freezeT = 0; e.burnT = 0; e.burnDps = 0; e.poisonT = 0; e.poisonDps = 0; e.shockT = 0; e.slowT = 0;
    e.animT = Math.random() * 6; e.phase = 0; e.patT = 2; e.patIdx = 0; e.hitT = 0;
    e.firstHit = false; e.ringSpawn = 0; e.chargeCd = 0; e.bossId = null;
    if (!skipRecord) { Meta.stats.enemiesSeen[typeId] = true; Save.mark(); }
    return e;
  },
  // توليد عند حلقة حول اللاعب خارج مجال الرؤية (spawn ديناميكي لا عشوائي مطلق)
  edgePos(rng) {
    const r = Game.run, zoom = 1;
    const rad = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 70;
    const a = (rng || Math.random)() * U.TAU;
    return { x: r.player.x + Math.cos(a) * rad, y: r.player.y + Math.sin(a) * rad };
  },
  spawnAtPlayer(typeId, rng, affix) {
    const p = this.edgePos(rng);
    return this.spawnEnemy(typeId, p.x, p.y, affix);
  },
  // موجة سرب دائرية كلاسيكية
  spawnRing(count) {
    const r = Game.run, pool = Data.WAVE_POOL[r.stageId].map(w => w[1]).flat();
    const rad = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 60;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * U.TAU + Math.random() * 0.2;
      const typeId = U.pick(pool);
      const e = this.spawnEnemy(typeId, r.player.x + Math.cos(a) * rad, r.player.y + Math.sin(a) * rad, null);
      if (e) e.ringSpawn = 1.5; // يتحرك للداخل بثبات أولًا
    }
  },
  // الزعيم مع مضاعفات المعدّلات
  spawnBoss() {
    const r = Game.run, bd = Data.BOSSES[r.stage.boss];
    const p = this.edgePos();
    const e = this.spawnEnemy(r.stage.enemies[0], p.x, p.y, null, true);
    if (!e) return null;
    e.isBoss = true; e.def = bd; e.uid = Core.uidSeq++; e.bossId = r.stage.boss;
    e.maxHp = e.hp = bd.hp * (1 + r.stageIdx * 0.15) * (r.mods.power ? 1.3 : 1);
    e.r = bd.r; e.dmg = bd.dmg; e.spd = bd.spd; e.xp = bd.xp;
    e.state = 'walk'; e.patT = 1.5; e.phase = 0; e.spiralAng = 0; e.beamAng = 0; e.beamT = 0;
    r.bossActive = true; r.bosses.push(e);
    UI.showBossBar(bd); Audio.sfx('boss'); Game.shake(10, 0.5);
    UI.toast(I18N.t('bossIncoming'), 'bad');
    return e;
  }
};

const Waves = {
  marks: [], // مؤشرات الضربات المرصودة (telegraphs) الأرضية
  update(dt) {
    const r = Game.run; if (!r) return;
    // ─── صعوبة تكيّفية: تراقب براعة اللاعب وتستجيب ───
    r.adaptT += dt;
    if (r.adaptT > 8) {
      r.adaptT = 0;
      const hpPct = r.player.hp / r.stats.maxHp;
      const killRate = r.kills / Math.max(30, r.time);
      if (hpPct > 0.75 && killRate > 0.8) r.adapt = Math.min(1.4, r.adapt + 0.06);
      else if (hpPct < 0.3) r.adapt = Math.max(0.7, r.adapt - 0.08);
    }
    // ─── مؤقتات المؤشرات الأرضية ───
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]; m.t -= dt;
      if (m.t <= 0) {
        Combat.aoeDamage(m.x, m.y, m.r, m.dmg, 'dark');
        Render.fxExplosion(m.x, m.y, m.r, '#ff5964');
        this.marks.splice(i, 1);
      }
    }
    // ─── توليد مستمر منحني بالزمن ───
    const t = r.time;
    const base = U.lerp(0.95, 0.24, U.clamp(t / 540, 0, 1));
    r.spawnT -= dt;
    if (r.spawnT <= 0) {
      r.spawnT = base / (r.mods.count ? 1.35 : 1) / r.adapt;
      const cap = Meta.settings.perf ? 170 : 260;
      if (Core.pools.enemies.count() < cap) {
        const batch = 1 + Math.floor(t / 150) + (r.mods.swarms ? Math.floor(t / 200) : 0);
        const pool = this.currentPool();
        for (let i = 0; i < Math.min(batch, 6); i++) {
          const affix = Math.random() < this.eliteChance() ? this.pickAffix() : null;
          Spawn.spawnAtPlayer(U.weighted(pool.map(id => [id, 1])), null, affix);
        }
      }
    }
    // ─── أحداث السرب الدائرية ───
    for (const [min, cnt] of Data.SWARM_EVENTS) {
      const at = min * 60;
      if (!r.swarmDone[min] && t >= at) {
        r.swarmDone[min] = true;
        Spawn.spawnRing(r.mods.swarms ? cnt * 2 : cnt);
        UI.toast(I18N.t('swarm'), 'bad'); Audio.sfx('boss');
      }
    }
    // ─── الزعيم عند الدقيقة 10 ───
    if (!r.bossWarned && t >= 595) { r.bossWarned = true; UI.toast(I18N.t('bossIncoming'), 'bad'); }
    if (!r.bossSpawned && t >= 600) {
      r.bossSpawned = true;
      Spawn.spawnBoss();
      if (r.mods.doubleboss) setTimeout(() => { if (Game.state === 'playing') Spawn.spawnBoss(); }, 400);
    }
  },
  currentPool() {
    const r = Game.run, waves = Data.WAVE_POOL[r.stageId];
    let list = [];
    for (const [min, ids] of waves) if (r.time / 60 >= min) list = list.concat(ids);
    return list.length ? list : waves[0][1];
  },
  eliteChance() {
    const r = Game.run;
    if (r.mods.elites) return 0.15;
    return Math.min(0.09, 0.012 + (r.time / 60) * 0.008) + (r.stats.luck > 0.5 ? 0.01 : 0);
  },
  pickAffix() { return U.pick(Data.AFFIXES); },

  // ─── آلة أنماط الزعيم: 3 مراحل بتوقيعات مختلفة ───
  updateBoss(e, dt) {
    const r = Game.run, p = r.player;
    const hpPct = e.hp / e.maxHp;
    // انتقال المراحل: هدير + موجة صادمة + غضب
    const ph = e.def.phases[e.phase];
    if (ph && hpPct <= ph.until) {
      e.phase = Math.min(e.def.phases.length - 1, e.phase + 1);
      if (e.phase > 0) {
        Audio.sfx('boss'); Game.shake(14, 0.6);
        UI.toast(I18N.t('phaseChange'), 'bad');
        Combat.aoeDamage(e.x, e.y, 90, 0, 'void'); // موجة دفع بصرية بلا ضرر
        e.patT = 0.8;
      }
    }
    e.patT -= dt;
    const cur = e.def.phases[e.phase];
    if (e.state === 'windup') {
      e.stateT -= dt;
      if (e.stateT <= 0) this.execBossPattern(e, cur.patterns[e.patIdx % cur.patterns.length]);
      return;
    }
    if (e.state === 'charging') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'walk'; e.vx = 0; e.vy = 0; e.patT = cur.rate; }
      return;
    }
    if (e.patT <= 0) {
      // هجوم جديد: توقيع تحذيري ثم التنفيذ
      e.state = 'windup'; e.stateT = 0.6; e.patIdx++;
      Audio.sfx('telegraph', e.x);
    }
    if (e.beamT > 0) e.beamT -= dt;
  },
  execBossPattern(e, pat) {
    const r = Game.run, p = r.player;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    const shoot = (a, spd, dmg, color, rr) => {
      const o = Core.pools.eproj.get(); if (!o) return;
      o.x = o.px = e.x + Math.cos(a) * e.r; o.y = o.py = e.y + Math.sin(a) * e.r;
      o.vx = Math.cos(a) * spd; o.vy = Math.sin(a) * spd;
      o.r = rr || 8; o.dmg = dmg; o.life = 4; o.color = color || '#ff8a8a'; o.kind = 'ball';
    };
    switch (pat) {
      case 'radial': { const n = 14 + e.phase * 4; for (let i = 0; i < n; i++) shoot((i / n) * U.TAU + e.spiralAng, 150 + e.phase * 30, e.dmg * 0.6, e.def.color); e.spiralAng += 0.35; e.state = 'walk'; e.patT = e.def.phases[e.phase].rate; break; }
      case 'volley': { for (let i = -1; i <= 1; i++) shoot(ang + i * 0.22, 260, e.dmg * 0.7, e.def.color); e.state = 'walk'; e.patT = e.def.phases[e.phase].rate * 0.8; break; }
      case 'spiral': { for (let i = 0; i < 6; i++) shoot(e.spiralAng + i * (U.TAU / 6), 190, e.dmg * 0.55, e.def.color); e.spiralAng += 0.5; e.state = 'walk'; e.patT = e.def.phases[e.phase].rate * 0.55; break; }
      case 'charge': { e.state = 'charging'; e.stateT = 0.55; e.vx = Math.cos(ang) * e.spd * 4.2; e.vy = Math.sin(ang) * e.spd * 4.2; Audio.sfx('dash', e.x); break; }
      case 'summon': {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * U.TAU;
          Spawn.spawnEnemy(U.pick(Data.WAVE_POOL[r.stageId].map(w => w[1]).flat()), e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90, null);
        }
        Render.fText(e.x, e.y - e.r - 14, I18N.t('summon'), '#ffb1b1', 14);
        e.state = 'walk'; e.patT = e.def.phases[e.phase].rate * 1.2; break;
      }
      case 'slam': {
        for (let i = 0; i < 3 + e.phase; i++) {
          const tx = p.x + (Math.random() - 0.5) * 220, ty = p.y + (Math.random() - 0.5) * 220;
          this.marks.push({ x: tx, y: ty, t: 1.0, r: 70, dmg: e.dmg * 0.8 });
        }
        Audio.sfx('telegraph', e.x); e.state = 'walk'; e.patT = e.def.phases[e.phase].rate; break;
      }
      case 'beam': { e.beamT = 2.2; e.beamAng = ang; e.state = 'walk'; e.patT = e.def.phases[e.phase].rate * 1.4; break; }
      default: e.state = 'walk'; e.patT = 2;
    }
  }
};
AS.Spawn = Spawn; AS.Waves = Waves;
/* ══════════════════════ Systems/Combat — نواة القتال والإحصائيات ══════════════════════ */
const Combat = AS.Combat = {};

// ─── إنشاء جولة جديدة: كل بيانات الجولة الحية في كائن واحد ───
Combat.newRun = function (charId, stageId, modIds, weekly) {
  const stage = Data.stage(stageId);
  const stageIdx = Data.STAGES.indexOf(stage);
  const mods = {}; (modIds || []).forEach(id => mods[id] = true);
  const c = Data.char(charId);
  const run = {
    charId, stageId, stage, stageIdx, mods, weekly: !!weekly,
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, rng: null,
    player: { x: 0, y: 0, px: 0, py: 0, hp: 1, face: { x: 1, y: 0 }, animT: 0, dashT: 0, dashCd: 0, iframe: 0, burnT: 0, burnDps: 0, slowT: 0, trail: [] },
    time: 0, kills: 0, level: 1, xp: 0, xpNext: 13, gold: 0, goldRun: 0, shards: 0,
    weapons: [], passives: {}, artifacts: [], stats: {}, hooks: {}, syn: {}, schoolKills: {},
    bossActive: false, bossSpawned: false, bosses: [], bossesKilled: 0, bossWarned: false,
    adapt: 1, adaptT: 0, spawnT: 1.2, swarmDone: {},
    lvSinceBanish: 0, banishCharge: 0, pendingLv: 0, banished: [], lockedId: null,
    challengeProg: { kills: 0, gold: 0, level: 1, elite: 0, time: 0, boss: 0, evolve: 0, chest: 0, killSchool: {} },
    shieldT: 0, berserk: 0, synT: 2, killVamp: 0, hurtFx: 0, reviveUsed: 0, swUsed: 0, clutchFlag: false, cleanT: 0, cleanBest: 0,
    companion: Meta.selectedComp, compState: { x: 40, y: 0, cd: 1, tx: 0, ty: 0, healT: 5 }
  };
  run.rng = U.mulberry32(run.seed);
  run.player.hp = c.hp;
  this.addWeapon(c.weapon, run); // سلاح البداية قبل ربط الجولة عالميًا
  this.recalcStats(run);
  run.player.hp = run.stats.maxHp;
  return run;
};

// ─── إعادة حساب الإحصائيات: الشخصية + المواهب + التمارين + القطع + التزامنات ───
Combat.recalcStats = function (r) {
  const c = Data.char(r.charId);
  const s = {
    maxHp: c.hp, ms: c.speed, dmg: 1, cdRed: 0, area: 1, projSpeed: 1, amount: 0,
    crit: 0.05, critDmg: 1.5, pickup: 70, xp: 1, luck: 0, armor: 0, regen: 0.2,
    gold: 1, dashCd: 2.2, dodge: 0, dmgBoss: 1, dmgElite: 1, revive: 0, schoolMult: {}, freezeHit: 0
  };
  const applyTalent = (branch, lvl) => { // عقد الفرع تُطبق تراكميًا حسب المستوى
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
  // ميزة الشخصية الخاصة
  const pk = c.perk;
  if (pk.school) s.schoolMult[pk.school] = (s.schoolMult[pk.school] || 1) + pk.v;
  if (pk.xp) s.xp += pk.xp; if (pk.crit) s.crit += pk.crit; if (pk.regen) s.regen += pk.regen;
  if (pk.armor) s.armor += pk.armor; if (pk.luck) s.luck += pk.luck; if (pk.projSpeed) s.projSpeed += pk.projSpeed;
  if (pk.dashCd) s.dashCd *= (1 - pk.dashCd); if (pk.freezeHit) s.freezeHit += pk.freezeHit;
  // التمارين السلبية
  for (const pid in r.passives) {
    const P = Data.passive(pid), lv = r.passives[pid]; if (!P) continue;
    if (P.k === 'dmg') s.dmg += P.per * lv; else if (P.k === 'cd') s.cdRed += P.per * lv;
    else if (P.k === 'area') s.area += P.per * lv; else if (P.k === 'ms') s.ms *= (1 + P.per * lv);
    else if (P.k === 'armor') s.armor += P.per * lv; else if (P.k === 'regen') s.regen += P.per * lv;
    else if (P.k === 'crit') s.crit += P.per * lv; else if (P.k === 'xp') s.xp += P.per * lv;
    else if (P.k === 'pickup') s.pickup *= (1 + P.per * lv); else if (P.k === 'luck') s.luck += P.per * lv;
    else if (P.k === 'hp') s.maxHp += P.per * lv; else if (P.k === 'amount') s.amount += P.per * lv;
  }
  // القطع الأثرية: إحصاء أو خطّاف
  r.hooks = {};
  for (const aid of r.artifacts) {
    const a = Data.artifact(aid); if (!a) continue;
    if (a.k) {
      if (a.k === 'school') s.schoolMult[a.sk] = (s.schoolMult[a.sk] || 1) + a.v;
      else if (a.k === 'ms') s.ms *= (1 + a.v); else if (a.k === 'pickup') s.pickup *= (1 + a.v);
      else if (a.k === 'dashCd') s.dashCd *= (1 - a.v); else s[a.k] = (s[a.k] || 0) + a.v;
    }
    if (a.hook) r.hooks[a.hook] = (r.hooks[a.hook] || 0) + a.v;
  }
  // التزامنات النشطة
  r.syn = {};
  const schools = {};
  for (const w of r.weapons) schools[w.def.school] = (schools[w.def.school] || 0) + 1;
  for (const syn of Data.SYNERGIES) {
    let on = false;
    if (syn.req.schools) on = syn.req.schools.every(sc => schools[sc] > 0);
    else if (syn.req.schoolsAny) on = Object.keys(schools).length >= syn.req.schoolsAny;
    if (on) {
      r.syn[syn.id] = true;
      const ef = syn.eff;
      if (ef.type === 'stat') { if (ef.k === 'dmg') s.dmg += ef.v; else if (ef.k === 'area') s.area += ef.v; else if (ef.k === 'crit') s.crit += ef.v; else if (ef.k === 'projSpeed') s.projSpeed += ef.v; else if (ef.k === 'regen') s.regen += ef.v; else if (ef.k === 'dmgBoss') s.dmgBoss += ef.v; else if (ef.k === 'xp') s.xp += ef.v; else if (ef.k === 'amount') s.amount += ef.v; }
    }
  }
  if (r.mods.glass) s.maxHp = Math.floor(s.maxHp * 0.7);
  if (r.hooks.glass) s.maxHp = Math.floor(s.maxHp * 0.8);
  const oldMax = r.stats.maxHp;
  r.stats = s;
  if (oldMax && s.maxHp > oldMax) r.player.hp += s.maxHp - oldMax;
  r.player.hp = Math.min(r.player.hp, s.maxHp);
};

// ─── التصويب: تلقائي نحو أقرب عدو أو يدوي (بلمس ثانٍ/عصا يمنى) ───
Combat.getAim = function () {
  const r = Game.run;
  if (Input.aimHoldT > 0) {
    const a = Math.atan2(Input.aimVec.y, Input.aimVec.x);
    r.player.face = { x: Math.cos(a), y: Math.sin(a) };
    return a;
  }
  let best = null, bd = 720 * 720;
  Core.pools.enemies.forEach(e => { const d = U.dist2(r.player.x, r.player.y, e.x, e.y); if (d < bd) { bd = d; best = e; } });
  if (best) {
    const a = Math.atan2(best.y - r.player.y, best.x - r.player.x);
    r.player.face = { x: Math.cos(a), y: Math.sin(a) };
    return a;
  }
  return Math.atan2(r.player.face.y, r.player.face.x);
};

// ─── إضافة سلاح للجولة (مع مرجع اختياري أثناء التأسيس) ───
Combat.addWeapon = function (id, runRef) {
  const r = runRef || Game.run;
  const def = Data.isEvolved(id) ? Data.EVOLVED[id] : Data.weapon(id);
  if (!def) return null;
  const w = { id, def, lv: 1, timer: 0.3, angle: Math.random() * U.TAU, tick: 0, evolved: Data.isEvolved(id) };
  r.weapons.push(w);
  Meta.stats.weaponsFound[id] = true; Save.mark();
  this.recalcStats(r);
  return w;
};

// ─── قوة السلاح الحالية حسب مستواه ───
Combat.weaponDmg = function (w) { return w.def.dmg * Math.pow(1.13, w.lv - 1); };
Combat.weaponCount = function (w) {
  const r = Game.run;
  let n = w.def.count || 1;
  if (['proj', 'homing', 'rain', 'boomerang', 'melee'].includes(w.def.kind)) n += (w.lv >= 3 ? 1 : 0) + (w.lv >= 6 ? 1 : 0) + r.stats.amount;
  return Math.min(n, 10);
};
Combat.weaponCd = function (w) { return Math.max(0.12, w.def.cd * (1 - Game.run.stats.cdRed)); };
Combat.weaponArea = function (w) { return w.def.area * Game.run.stats.area; };

// ─── إطلاق سلاح حسب نوع سلوكه ───
Combat.fireWeapon = function (w) {
  const r = Game.run, s = r.stats, def = w.def;
  const dmg = this.weaponDmg(w), cnt = this.weaponCount(w), area = this.weaponArea(w);
  const aim = this.getAim();
  Audio.lastSchool = def.school;
  switch (def.kind) {
    case 'proj': {
      const spread = def.bounce ? 0.5 : 0.14;
      for (let i = 0; i < cnt; i++) {
        const a = aim + (i - (cnt - 1) / 2) * spread;
        this.spawnProj({ x: r.player.x, y: r.player.y, a, spd: def.speed * s.projSpeed, dmg, pierce: (def.pierce || 1) + (r.hooks.pierceBonus || 0), life: def.life, r: def.r, school: def.school, color: def.color, kind: def.bounce ? 'bounce' : 'straight', w, flag: def.flag });
      }
      Audio.sfx('shoot', r.player.x); break;
    }
    case 'homing': {
      for (let i = 0; i < cnt; i++) {
        const a = aim + (Math.random() - 0.5) * 1.6;
        this.spawnProj({ x: r.player.x, y: r.player.y, a, spd: def.speed * s.projSpeed, dmg, pierce: 1, life: 2.4, r: def.r || 8, school: def.school, color: def.color, kind: 'homing', w, home: 4.5, flag: def.flag });
      }
      Audio.sfx('shoot', r.player.x); break;
    }
    case 'boomerang': {
      for (let i = 0; i < cnt; i++) {
        const a = aim + (i - (cnt - 1) / 2) * 0.3;
        this.spawnProj({ x: r.player.x, y: r.player.y, a, spd: def.speed * s.projSpeed, dmg, pierce: 99, life: def.life, r: def.r, school: def.school, color: def.color, kind: 'boomerang', w });
      }
      break;
    }
    case 'nova': {
      this.spawnProj({ x: r.player.x, y: r.player.y, a: 0, spd: 0, dmg, pierce: 99, life: def.area / 280 + 0.25, r: 12, school: def.school, color: def.color, kind: 'ring', w, grow: 300, maxR: area, flag: def.flag });
      Audio.sfx('explode', r.player.x); break;
    }
    case 'aura': {
      this.aoeDamage(r.player.x, r.player.y, area, dmg, def.school, { silent: true });
      Render.auraPulse(def.school, area, def.color);
      if (def.school === 'fire' && r.hooks.burnOnHit) { } // الإشعال يُطبق في hitEnemy
      break;
    }
    case 'orbit': { w.tick = 0; break; } // تدار ضمن تحديث الكيانات
    case 'chain': {
      let jumps = 3;
      if (r.syn.chain_reaction) jumps += 2; // تزامن الفوضى+البرق يضيف قفزتين
      let src = { x: r.player.x, y: r.player.y }, hitUids = new Set();
      for (let j = 0; j < jumps; j++) {
        const maxR = j === 0 ? 300 : 210;
        let best = null, bd = maxR * maxR;
        Core.pools.enemies.forEach(e => {
          if (hitUids.has(e.uid) || e.hp <= 0) return;
          const d = U.dist2(src.x, src.y, e.x, e.y);
          if (d < (j === 0 ? 300 * 300 : 210 * 210) && (!best || d < bd)) { bd = d; best = e; }
        });
        if (!best) break;
        hitUids.add(best.uid);
        this.hitEnemy(best, dmg * Math.pow(0.85, j), def.school);
        Render.fxZap(src.x, src.y, best.x, best.y, def.color);
        this.applyStatus(best, 'shock', 3);
        src = best; Audio.sfx('zap', best.x);
      }
      break;
    }
    case 'melee': {
      const range = area, arc = def.flag === 'reapHeal' ? Math.PI * 2 : 1.15;
      Core.pools.enemies.forEach(e => {
        const d = U.dist(r.player.x, r.player.y, e.x, e.y);
        if (d > range + e.r) return;
        if (arc < Math.PI) {
          const a = Math.atan2(e.y - r.player.y, e.x - r.player.x), da = Math.abs(((a - aim + Math.PI * 3) % U.TAU) - Math.PI);
          if (da > arc) return;
        }
        this.hitEnemy(e, dmg, def.school);
        const ka = Math.atan2(e.y - r.player.y, e.x - r.player.x);
        e.vx += Math.cos(ka) * 160; e.vy += Math.sin(ka) * 160;
      });
      Render.fxSlash(r.player.x, r.player.y, aim, range, def.color);
      break;
    }
    case 'rain': {
      for (let i = 0; i < cnt; i++) {
        const tx = r.player.x + (Math.random() - 0.5) * area * 2.2, ty = r.player.y + (Math.random() - 0.5) * area * 2.2;
        this.spawnProj({ x: tx, y: ty, a: 0, spd: 0, dmg, pierce: 99, life: 0.55, r: area * 0.45, school: def.school, color: def.color, kind: 'rain', w, z: 360, flag: def.flag });
      }
      break;
    }
    case 'mine': {
      for (let i = 0; i < cnt; i++) {
        const a = Math.random() * U.TAU, d = 30 + Math.random() * area;
        const mode = def.id === 'toxicCloud' ? 'tick' : (def.id === 'singularity' ? 'pull' : 'boom');
        this.spawnProj({ x: r.player.x + Math.cos(a) * d, y: r.player.y + Math.sin(a) * d, a: 0, spd: 0, dmg, pierce: 99, life: def.life, r: area, school: def.school, color: def.color, kind: 'mine', w, mode, tick: 0 });
      }
      break;
    }
  }
};

// توليد مقذوف من المجمّع
Combat.spawnProj = function (o) {
  const p = Core.pools.proj.get(); if (!p) return null;
  p.x = p.px = o.x; p.y = p.py = o.y;
  p.vx = Math.cos(o.a) * o.spd; p.vy = Math.sin(o.a) * o.spd;
  p.baseVx = p.vx; p.baseVy = p.vy;
  p.dmg = o.dmg; p.pierce = o.pierce; p.life = p.maxLife = o.life;
  p.r = o.r; p.school = o.school; p.color = o.color; p.kind = o.kind; p.w = o.w;
  p.home = o.home || 0; p.flag = o.flag || null; p.grow = o.grow || 0; p.maxR = o.maxR || 0;
  p.z = o.z || 0; p.mode = o.mode || ''; p.tick = 0; p.angle = o.a; p.spin = 0; p.hits.clear(); p.hitCd = 0;
  return p;
};

// تحديث مؤقتات الأسلحة + الإلقاء المزدوج (صدى) + المفاتيح اليدوية 1-8
Combat.updateWeapons = function (dt) {
  const r = Game.run;
  for (const w of r.weapons) {
    if (w.def.kind === 'orbit') { w.angle += (w.def.speed || 2) * dt; w.tick -= dt; if (w.tick <= 0) { this.orbitTick(w); w.tick = 0.3; } continue; }
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = this.weaponCd(w);
      this.fireWeapon(w);
      if (r.hooks.echo && Math.random() < r.hooks.echo) this.fireWeapon(w);
    }
  }
  for (let i = 0; i < 8; i++) {
    if (Input.consumeAbility(i) && r.weapons[i]) {
      const w = r.weapons[i];
      if (w.def.kind !== 'orbit') { w.timer = this.weaponCd(w); this.fireWeapon(w); }
    }
  }
};

// ضرر المدارات: موجة صغيرة حول كل شفرة
Combat.orbitTick = function (w) {
  const r = Game.run, n = Math.min(this.weaponCount(w), 10), rad = 78 + w.lv * 4;
  const dmg = this.weaponDmg(w) * 0.45;
  for (let i = 0; i < n; i++) {
    const a = w.angle + (i / n) * U.TAU;
    const bx = r.player.x + Math.cos(a) * rad, by = r.player.y + Math.sin(a) * rad;
    this.aoeDamage(bx, by, (w.def.r || 9) + 14, dmg, w.def.school, { silent: true });
  }
};
/* ══════════════════════ Systems/Combat — تحديث الكيانات الحية ══════════════════════ */
Combat.tmp = []; Combat.tmp2 = [];
Combat.hash = new SpatialHash(96);

// ─── اللاعب: حركة، اندفاع، تجدد، حالات ───
Combat.updatePlayer = function (dt) {
  const r = Game.run, p = r.player, s = r.stats;
  p.px = p.x; p.py = p.y;
  Input.update(dt);
  let mx = Input.moveVec.x, my = Input.moveVec.y;
  if (p.dashT > 0) { p.dashT -= dt; mx = p.dashVx; my = p.dashVy; }
  if (Input.consumeDash() && p.dashCd <= 0) {
    p.dashT = 0.18; p.iframe = Math.max(p.iframe, 0.28);
    p.dashCd = s.dashCd;
    const a = (mx || my) ? Math.atan2(my, mx) : Math.atan2(p.face.y, p.face.x);
    p.dashVx = Math.cos(a); p.dashVy = Math.sin(a);
    Audio.sfx('dash'); Game.shake(4, 0.15);
    if (r.hooks.waveBurst) { this.aoeDamage(p.x, p.y, 90, 20, 'physical'); Render.fxExplosion(p.x, p.y, 90, '#7ee8fa'); }
  }
  p.dashCd = Math.max(0, p.dashCd - dt);
  const spd = s.ms * (p.slowT > 0 ? 0.6 : 1) * (1 + r.berserk * 0.02) * (p.dashT > 0 ? 3.1 : 1);
  if (mx || my) { const l = Math.hypot(mx, my); p.x += (mx / l) * spd * dt; p.y += (my / l) * spd * dt; p.face = { x: mx / l, y: my / l }; }
  p.animT += dt * (p.dashT > 0 ? 3 : 1);
  // أثر الاندفاع والحركي
  if (p.dashT > 0) { p.trail.push({ x: p.x, y: p.y, t: 0.3 }); if (r.hooks.dashTrail) this.aoeDamage(p.x, p.y, 34, 8 * dt * 10, 'fire', { silent: true }); }
  for (let i = p.trail.length - 1; i >= 0; i--) { p.trail[i].t -= dt; if (p.trail[i].t <= 0) p.trail.splice(i, 1); }
  // تجدد وحالات
  p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
  p.iframe = Math.max(0, p.iframe - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  if (p.burnT > 0) { p.burnT -= dt; this.hurtPlayerRaw(p.burnDps * dt, false); }
  if (r.hooks.shield30) r.shieldT = Math.max(-1, r.shieldT - dt);
  if (r.hooks.berserk && r.berserk > 0) r.berserk = Math.max(0, r.berserk - dt * 0.8);
  r.hurtFx = Math.max(0, r.hurtFx - dt * 2);
};

// ─── الأعداء: سلوكيات + سرب + نخبة + زعماء ───
Combat.updateEnemies = function (dt) {
  const r = Game.run, p = r.player, H = this.hash, tmp = this.tmp;
  H.clear();
  Core.pools.enemies.forEach(e => H.insert(e));
  Core.pools.enemies.forEach(e => {
    e.px = e.x; e.py = e.y;
    e.animT += dt; e.flash = Math.max(0, e.flash - dt * 6); e.touchCd = Math.max(0, e.touchCd - dt);
    // ضرر الحالات المستمرة
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnDps * dt; if (Math.random() < dt * 8) Render.fxParticle(e.x, e.y - 6, '#ff8a3a', 'flame'); }
    if (e.poisonT > 0) { e.poisonT -= dt; e.hp -= e.poisonDps * dt; if (Math.random() < dt * 6) Render.fxParticle(e.x, e.y - 4, '#8be84a', 'spark'); }
    if (e.hp <= 0) { this.killEnemy(e, e.burnT > 0 ? 'fire' : 'poison'); return; }
    e.freezeT = Math.max(0, e.freezeT - dt); e.slowT = Math.max(0, e.slowT - dt); e.shockT = Math.max(0, e.shockT - dt);
    const dToP = U.dist(e.x, e.y, p.x, p.y);
    // هالة الإبطاء (تزامن الفراغ البارد + قطعة حقل الصقيع)
    if (dToP < 140 && (r.syn.cold_void || r.hooks.slowAura)) e.slowT = Math.max(e.slowT, 0.3);
    if (e.isBoss) { this.updateBossMove(e, dt, dToP); }
    else this.updateEnemyAI(e, dt, dToP);
    // السرب: تباعد + محاذاة بسيطة عبر العينة المجاورة
    if (!e.isBoss) {
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
    // تلامس اللاعب: ضرر + صفات النخبة
    if (dToP < e.r + 14 && e.touchCd <= 0) {
      e.touchCd = 0.8;
      this.hurtPlayer(e.dmg);
      if (e.elite) {
        if (e.elite.id === 'thorns' || r.syn.thorn_skin) { const refl = (e.elite.id === 'thorns' ? 8 : 0) + (r.syn.thorn_skin ? 10 : 0) + (r.hooks.thorns || 0); e.hp -= refl; e.flash = 1; if (e.hp <= 0) this.killEnemy(e, 'physical'); }
        if (e.elite.id === 'burning') { p.burnT = 3; p.burnDps = 4; }
        if (e.elite.id === 'freezing') p.slowT = 2;
        if (e.elite.id === 'shocking') { this.hurtPlayer(6); Render.fxZap(e.x, e.y, p.x, p.y, '#ffe95c'); }
      }
      if (r.hooks.thorns || r.syn.thorn_skin) { const refl = (r.hooks.thorns || 0) + (r.syn.thorn_skin ? 10 : 0); e.hp -= refl; e.flash = 1; if (e.hp <= 0) this.killEnemy(e, 'physical'); }
    }
  });
};

// ذكاء العدو العادي حسب سلوكه
Combat.updateEnemyAI = function (e, dt, dToP) {
  const r = Game.run, p = r.player;
  const spd = e.spd * (e.freezeT > 0 ? 0.45 : e.slowT > 0 ? 0.72 : 1);
  const seek = () => { const a = Math.atan2(p.y - e.y, p.x - e.x); return { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd }; };
  // توليد الحلقات: يتقدم نحو اللاعب بثبات أولًا
  if (e.ringSpawn > 0) { e.ringSpawn -= dt; const s = seek(); e.vx = s.vx; e.vy = s.vy; return; }
  if (e.state === 'windup') { e.stateT -= dt; e.vx = 0; e.vy = 0; if (e.stateT <= 0) this.enemyAttack(e); return; }
  if (e.state === 'charge') { e.stateT -= dt; if (e.stateT <= 0) { e.state = 'walk'; e.chargeCd = 3; } return; }
  const beh = e.def.behavior;
  if (beh === 'ranged') {
    e.chargeCd = Math.max(0, (e.chargeCd || 0) - dt);
    if (dToP < e.def.range && e.chargeCd <= 0) { e.state = 'windup'; e.stateT = 0.55; Audio.sfx('telegraph', e.x); return; }
    if (dToP < e.def.range * 0.6) { e.vx = 0; e.vy = 0; return; } // يحافظ على المسافة
    const s = seek(); e.vx = s.vx * 0.8; e.vy = s.vy * 0.8; return;
  }
  if (beh === 'brute') {
    e.chargeCd = Math.max(0, (e.chargeCd || 0) - dt);
    if (dToP < 250 && e.chargeCd <= 0) { e.state = 'windup'; e.stateT = 0.7; Audio.sfx('telegraph', e.x); return; }
    const s = seek(); e.vx = s.vx; e.vy = s.vy; return;
  }
  const s = seek();
  let wob = 0;
  if (beh === 'fly') wob = Math.sin(e.animT * 5) * 40; // طيران متعرج
  e.vx = s.vx + Math.cos(e.animT * 2.3) * wob; e.vy = s.vy + Math.sin(e.animT * 2.9) * wob;
};

// تنفيذ هجوم العدو بعد التحذير المسبق
Combat.enemyAttack = function (e) {
  const r = Game.run, p = r.player;
  e.state = 'walk'; e.chargeCd = e.def.behavior === 'brute' ? 4 : e.def.atkCd || 2.5;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  if (e.def.behavior === 'ranged') {
    const o = Core.pools.eproj.get(); if (!o) return;
    o.x = o.px = e.x; o.y = o.py = e.y;
    o.vx = Math.cos(a) * 240; o.vy = Math.sin(a) * 240;
    o.r = 7; o.dmg = e.dmg; o.life = 3; o.color = e.def.color; o.kind = 'ball';
  } else { // الاندفاع
    e.state = 'charge'; e.stateT = 0.5;
    e.vx = Math.cos(a) * e.spd * 3.4; e.vy = Math.sin(a) * e.spd * 3.4;
  }
};

// الزعيم: مطاردة + شعاع دوّار + أنماط من Waves
Combat.updateBossMove = function (e, dt, dToP) {
  const r = Game.run, p = r.player;
  Waves.updateBoss(e, dt);
  const spd = e.spd * (1 + e.phase * 0.25);
  if (e.state === 'walk' || e.state === 'windup') {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.vx = Math.cos(a) * spd * 0.8; e.vy = Math.sin(a) * spd * 0.8;
  }
  // شعاع الزعيم: خط دوّار يضر اللاعب عند التقاطع
  if (e.beamT > 0) {
    e.beamAng += dt * 1.3;
    const bx = Math.cos(e.beamAng), by = Math.sin(e.beamAng);
    const proj = (p.x - e.x) * bx + (p.y - e.y) * by;
    if (proj > 0 && proj < 540) {
      const px = e.x + bx * proj, py = e.y + by * proj;
      if (U.dist(px, py, p.x, p.y) < 24) this.hurtPlayer(e.dmg * 0.5);
    }
    if (Math.random() < dt * 30) Render.fxParticle(e.x + bx * (100 + Math.random() * 400), e.y + by * (100 + Math.random() * 400), e.def.color, 'spark');
  }
  e.beamT = Math.max(0, e.beamT - dt);
};

// ─── المقذوفات الصادرة عن اللاعب ───
Combat.updateProjectiles = function (dt) {
  const r = Game.run, H = this.hash, tmp = this.tmp;
  Core.pools.proj.forEach((pr) => {
    pr.px = pr.x; pr.py = pr.y;
    pr.life -= dt;
    if (pr.life <= 0) { this.endProj(pr); return; }
    switch (pr.kind) {
      case 'straight': case 'bounce': case 'homing': {
        if (pr.kind === 'homing') { // تعقب أقرب عدو
          let best = null, bd = 260 * 260;
          H.query(pr.x, pr.y, 260, tmp);
          for (const e of tmp) { const d = U.dist2(pr.x, pr.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
          if (best) {
            const ta = Math.atan2(best.y - pr.y, best.x - pr.x), ca = Math.atan2(pr.vy, pr.vx);
            let da = ((ta - ca + Math.PI * 3) % U.TAU) - Math.PI;
            const na = ca + U.clamp(da, -pr.home * dt, pr.home * dt), sp = Math.hypot(pr.vx, pr.vy);
            pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
          }
        }
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        if (Math.random() < dt * 20) Render.fxParticle(pr.x, pr.y, pr.color, 'trail');
        break;
      }
      case 'boomerang': {
        const half = pr.maxLife / 2;
        if (pr.life > half) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.vx *= 0.985; pr.vy *= 0.985; }
        else { // عودة إلى اللاعب
          pr.hits.clear();
          const a = Math.atan2(r.player.y - pr.y, r.player.x - pr.x), sp = Math.hypot(pr.baseVx, pr.baseVy);
          pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
          pr.x += pr.vx * dt; pr.y += pr.vy * dt;
          if (U.dist(pr.x, pr.y, r.player.x, r.player.y) < 24) { Core.pools.proj.release(pr); return; }
        }
        pr.angle += dt * 18;
        break;
      }
      case 'ring': {
        pr.r += pr.grow * dt; pr.angle += dt;
        H.query(pr.x, pr.y, pr.r + 40, tmp);
        for (const e of tmp) {
          if (pr.hits.has(e.uid) || !e.active) continue;
          if (U.dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) { pr.hits.add(e.uid); this.hitEnemy(e, pr.dmg, pr.school, { proj: pr }); if (pr.flag === 'wrathRoots') e.slowT = 1.5; }
        }
        break;
      }
      case 'rain': {
        pr.z -= 640 * dt;
        if (pr.z <= 0) { // الهبوط: انفجار مساحي
          this.aoeDamage(pr.x, pr.y, pr.r, pr.dmg, pr.school);
          Render.fxExplosion(pr.x, pr.y, pr.r, pr.color);
          Audio.sfx('explode', pr.x);
          if (pr.flag === 'apocBurn' || pr.flag === 'plaguePool') this.spawnPool(pr.x, pr.y, pr.r * 0.8, pr.school, 2, pr.dmg * 0.15);
          if (pr.flag === 'chainFreeze') H.query(pr.x, pr.y, 150, tmp).forEach(e => { if (U.dist(pr.x, pr.y, e.x, e.y) < 150) this.applyStatus(e, 'freeze', 1.6); });
          Core.pools.proj.release(pr); return;
        }
        break;
      }
      case 'mine': {
        if (pr.mode === 'tick') { // سحابة سامة/حقل متواصل
          pr.tick -= dt;
          if (pr.tick <= 0) { pr.tick = 0.5; this.aoeDamage(pr.x, pr.y, pr.r, pr.dmg, pr.school, { silent: true }); if (pr.school === 'poison') H.query(pr.x, pr.y, pr.r, tmp).forEach(e => { if (U.dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) this.applyStatus(e, 'poison', 2, pr.dmg * 0.4); }); }
          if (Math.random() < dt * 10) Render.fxParticle(pr.x + (Math.random() - 0.5) * pr.r, pr.y + (Math.random() - 0.5) * pr.r, pr.color, 'smoke');
        } else if (pr.mode === 'pull') { // أحادية الفراغ: تجاذب ثم انفجار
          H.query(pr.x, pr.y, pr.r + 60, tmp);
          for (const e of tmp) { if (!e.active) continue; const a = Math.atan2(pr.y - e.y, pr.x - e.x); e.vx += Math.cos(a) * 190 * dt; e.vy += Math.sin(a) * 190 * dt; }
          pr.tick -= dt;
          if (pr.tick <= 0) { pr.tick = 0.4; this.aoeDamage(pr.x, pr.y, pr.r * 0.7, pr.dmg * 0.25, pr.school, { silent: true }); }
        } else { // رموز تنفجر عند الاقتراب
          H.query(pr.x, pr.y, pr.r * 0.55, tmp);
          let trig = false;
          for (const e of tmp) if (U.dist(pr.x, pr.y, e.x, e.y) < pr.r * 0.5 + e.r) { trig = true; break; }
          if (trig) { this.aoeDamage(pr.x, pr.y, pr.r, pr.dmg, pr.school); Render.fxExplosion(pr.x, pr.y, pr.r, pr.color); Core.pools.proj.release(pr); return; }
        }
        break;
      }
      case 'pool': { // برك النار/السم المتطورة
        pr.tick -= dt;
        if (pr.tick <= 0) { pr.tick = 0.45; this.aoeDamage(pr.x, pr.y, pr.r, pr.dmg, pr.school, { silent: true }); H.query(pr.x, pr.y, pr.r, tmp).forEach(e => { if (U.dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) { if (pr.school === 'fire') this.applyStatus(e, 'burn', 1.5, pr.dmg * 0.8); else this.applyStatus(e, 'poison', 1.5, pr.dmg * 0.8); } }); }
        if (Math.random() < dt * 8) Render.fxParticle(pr.x + (Math.random() - 0.5) * pr.r * 1.6, pr.y + (Math.random() - 0.5) * pr.r * 1.6, pr.color, pr.school === 'fire' ? 'flame' : 'smoke');
        break;
      }
    }
    // تصادم المقذوفات المباشرة
    if (['straight', 'bounce', 'homing'].includes(pr.kind)) {
      H.query(pr.x, pr.y, pr.r + 42, tmp);
      for (const e of tmp) {
        if (pr.hits.has(e.uid) || !e.active) continue;
        const rr = pr.r + e.r;
        if (U.dist2(pr.x, pr.y, e.x, e.y) < rr * rr) {
          pr.hits.add(e.uid);
          this.hitEnemy(e, pr.dmg, pr.school, { proj: pr });
          if (pr.flag === 'ascendExplode') { this.aoeDamage(pr.x, pr.y, 55, pr.dmg * 0.5, pr.school); Render.fxExplosion(pr.x, pr.y, 55, pr.color); }
          if (pr.flag === 'plaguePool') this.spawnPool(pr.x, pr.y, 46, pr.school, 1.8, pr.dmg * 0.12);
          if (pr.kind === 'bounce' && pr.bouncesLeft === undefined) pr.bouncesLeft = pr.w ? (pr.w.def.bounce || 0) + (pr.w.lv >= 5 ? 1 : 0) : 0;
          if (pr.kind === 'bounce' && pr.bouncesLeft > 0) { // ارتداد نحو عدو آخر
            pr.bouncesLeft--;
            let nb = null, bd = 240 * 240;
            H.query(pr.x, pr.y, 240, tmp);
            for (const o of tmp) { if (o === e || pr.hits.has(o.uid)) continue; const d = U.dist2(pr.x, pr.y, o.x, o.y); if (d < bd) { bd = d; nb = o; } }
            if (nb) { const a = Math.atan2(nb.y - pr.y, nb.x - pr.x), sp = Math.hypot(pr.baseVx, pr.baseVy); pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; }
            else { Core.pools.proj.release(pr); return; }
          } else {
            pr.pierce--;
            if (pr.pierce < 0) { Core.pools.proj.release(pr); return; }
          }
          break;
        }
      }
    }
  });
};
// نهاية المقذوف: انفجار الرموز المزروعة
Combat.endProj = function (pr) {
  if (pr.kind === 'mine' && pr.mode !== 'tick') { this.aoeDamage(pr.x, pr.y, pr.r, pr.dmg, pr.school); Render.fxExplosion(pr.x, pr.y, pr.r, pr.color); }
  if (pr.kind === 'mine' && pr.mode === 'pull') { this.aoeDamage(pr.x, pr.y, pr.r * 1.2, pr.dmg, pr.school); Render.fxExplosion(pr.x, pr.y, pr.r * 1.2, pr.color); Audio.sfx('explode', pr.x); }
  Core.pools.proj.release(pr);
};
// بركة حالية (نار طاعون/رماد حريق)
Combat.spawnPool = function (x, y, r, school, life, dmg) {
  const p = Core.pools.proj.get(); if (!p) return;
  p.x = p.px = x; p.y = p.py = y; p.vx = p.vy = 0;
  p.r = r; p.dmg = dmg; p.pierce = 99; p.life = p.maxLife = life; p.kind = 'pool'; p.school = school;
  p.color = school === 'fire' ? '#c85cff' : '#8be84a'; p.w = null; p.mode = 'tick'; p.tick = 0.3; p.hits.clear();
};

// ─── مقذوفات الأعداء ───
Combat.updateEProjectiles = function (dt) {
  const r = Game.run, p = r.player;
  Core.pools.eproj.forEach((o) => {
    o.px = o.x; o.py = o.y;
    o.life -= dt;
    if (o.life <= 0) { Core.pools.eproj.release(o); return; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (U.dist2(o.x, o.y, p.x, p.y) < (o.r + 13) * (o.r + 13)) { this.hurtPlayer(o.dmg); Core.pools.eproj.release(o); return; }
  });
};

// ─── الجواهر: خبرة/ذهب/شفاء/صناديق مع مغنطيس ───
Combat.updateOrbs = function (dt) {
  const r = Game.run, p = r.player, s = r.stats;
  const mag = s.pickup * (r.hooks.magnet ? 2.2 : 1);
  Core.pools.orbs.forEach((o) => {
    o.px = o.x; o.py = o.y;
    const d = U.dist(o.x, o.y, p.x, p.y);
    if (o.type === 'chest') { if (d < 40) { Prog.openChest(o); Core.pools.orbs.release(o); } return; }
    if (d < mag || o.magnet) {
      o.magnet = true;
      const a = Math.atan2(p.y - o.y, p.x - o.x);
      const sp = 420 + (mag - d) * 2;
      o.x += Math.cos(a) * sp * dt; o.y += Math.sin(a) * sp * dt;
    }
    if (d < 22) {
      if (o.type === 'xp') Prog.addXp(o.val);
      else if (o.type === 'gold') { const g = Math.max(1, Math.round(o.val * s.gold * (1 + s.luck * 0.5))); r.gold += g; r.goldRun += g; r.challengeProg.gold += g; Audio.sfx('gold'); }
      else if (o.type === 'heal') { p.hp = Math.min(s.maxHp, p.hp + o.val); Audio.sfx('heal'); Render.fText(p.x, p.y - 24, '+' + Math.round(o.val), '#5eeaa4', 16); }
      else if (o.type === 'shard') { r.shards++; Audio.sfx('unlock'); Render.fText(p.x, p.y - 26, t('shardPickup'), '#b06cff', 14); }
      Core.pools.orbs.release(o);
    }
  });
};

// ─── المرافق: يتبع ويقاتل باستقلال ───
Combat.updateCompanion = function (dt) {
  const r = Game.run, p = r.player, cs = r.compState;
  const def = Data.comp(r.companion);
  if (def.kind === 'none') return;
  const tx = p.x - p.face.x * 46 + Math.sin(p.animT * 1.4) * 14, ty = p.y - p.face.y * 46 + Math.cos(p.animT * 1.2) * 10;
  cs.tx = U.lerp(cs.tx || tx, tx, dt * 4); cs.ty = U.lerp(cs.ty || ty, ty, dt * 4);
  cs.x = U.lerp(cs.x, cs.tx, Math.min(1, dt * 6)); cs.y = U.lerp(cs.y, cs.ty, Math.min(1, dt * 6));
  cs.cd -= dt;
  if (def.kind === 'support') {
    cs.healT -= dt;
    if (cs.healT <= 0) { cs.healT = 6; p.hp = Math.min(r.stats.maxHp, p.hp + def.heal); Render.fText(p.x, p.y - 30, '+' + def.heal, '#ffb8e8', 14); Audio.sfx('heal'); }
  }
  if (cs.cd <= 0) {
    let best = null, bd = 360 * 360;
    Combat.hash.query(cs.x, cs.y, 360, Combat.tmp2);
    for (const e of Combat.tmp2) { const d = U.dist2(cs.x, cs.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (best) {
      cs.cd = def.cd;
      if (def.kind === 'melee') { this.hitEnemy(best, def.dmg * (1 + r.stats.dmg * 0.3), 'physical'); Render.fxSlash(cs.x, cs.y, Math.atan2(best.y - cs.y, best.x - cs.x), 46, def.color); }
      else if (def.kind === 'ranged') {
        const pr = this.spawnProj({ x: cs.x, y: cs.y, a: Math.atan2(best.y - cs.y, best.x - cs.x), spd: 400, dmg: def.dmg * (1 + r.stats.dmg * 0.3), pierce: 1, life: 1.4, r: 7, school: 'arcane', color: def.color, kind: 'straight', w: null });
      }
      Audio.sfx('hit', cs.x);
    }
  }
};

// ─── التزامنات الدورية: بخار/تصعيق المجمّد ───
Combat.updateSynergies = function (dt) {
  const r = Game.run, p = r.player;
  r.synT -= dt;
  if (r.synT > 0) return;
  r.synT = 0.5;
  if (r.syn.steam_burst) { this.aoeDamage(p.x, p.y, 130, 35 * r.stats.dmg, 'ice'); Render.fxExplosion(p.x, p.y, 130, '#bfe8ff'); Audio.sfx('explode'); r.syn.steamT = (r.syn.steamT || 0) + 0.5; if (r.syn.steamT < 5) r.synT = 5 - r.syn.steamT; else r.syn.steamT = 0; }
  if (r.syn.frozen_storm) {
    const tmp = this.tmp;
    Core.pools.enemies.forEach(e => { if (e.freezeT > 0) { this.hitEnemy(e, 10 * r.stats.dmg, 'lightning', { noCrit: true }); Render.fxZap(p.x, p.y, e.x, e.y, '#ffe95c'); } });
  }
};
/* ══════════════════════ Systems/Combat — الضرر والحالات والقتل ══════════════════════ */

// بناء التجزئة المكانية مرة واحدة في بداية كل خطوة فيزياء
Combat.rebuildHash = function () {
  const H = this.hash; H.clear();
  Core.pools.enemies.forEach(e => { if (e.active) H.insert(e); });
};

// ─── إصابة عدو: حساب نهائي مع حرجة ومدارس وحالات ───
Combat.hitEnemy = function (e, raw, school, opts) {
  opts = opts || {};
  const r = Game.run, s = r.stats;
  if (!e || !e.active) return;
  let d = raw * s.dmg * (s.schoolMult[school] || 1);
  if (e.isBoss) d *= s.dmgBoss;
  if (e.elite) d *= s.dmgElite;
  if (e.shockT > 0) d *= 1.15;
  if (e.hp / e.maxHp < 0.3 && r.hooks.execute) d *= (1 + r.hooks.execute);
  if (r.player.hp / s.maxHp < 0.5 && r.hooks.rageLowHp) d *= (1 + r.hooks.rageLowHp);
  if (r.berserk > 0) d *= (1 + r.berserk * 0.015);
  let crit = false;
  if (!opts.noCrit && Math.random() < s.crit) { crit = true; d *= s.critDmg; }
  if (!e.firstHit && r.hooks.firstHit) { d *= (1 + r.hooks.firstHit); e.firstHit = true; }
  e.hp -= d; e.flash = 1;
  if (!opts.silent) {
    Render.fText(e.x + (Math.random() - 0.5) * 16, e.y - e.r - 8, String(Math.round(d)), crit ? '#f5c542' : (Data.SCHOOLS[school] ? Data.SCHOOLS[school].color : '#fff'), crit ? 19 : 14);
    Audio.sfx(crit ? 'crit' : 'hit', e.x);
  }
  if (crit && r.hooks.critNova) { this.aoeDamage(e.x, e.y, 70, d * 0.4, school, { silent: true }); Render.fxExplosion(e.x, e.y, 70, '#f5c542'); }
  // تطبيق حالات العناصر
  const frz = (r.hooks.freezeOnHit || 0) + s.freezeHit;
  if (school === 'ice' && Math.random() < 0.12 + frz) this.applyStatus(e, 'freeze', 2);
  else if (frz > 0 && Math.random() < frz) this.applyStatus(e, 'freeze', 1.6);
  if (school === 'fire' && Math.random() < 0.15 + (r.hooks.burnOnHit || 0)) this.applyStatus(e, 'burn', 3, d * 0.12);
  if (school === 'poison') this.applyStatus(e, 'poison', 3, d * 0.1);
  if (school === 'lightning' && Math.random() < 0.2) this.applyStatus(e, 'shock', 3);
  if (r.hooks.lifesteal && Math.random() < r.hooks.lifesteal) r.player.hp = Math.min(s.maxHp, r.player.hp + 1);
  if (r.hooks.chaosStrike && Math.random() < r.hooks.chaosStrike) { this.aoeDamage(e.x, e.y, 80, d * 0.6, 'chaos'); Render.fxExplosion(e.x, e.y, 80, '#ff6ea8'); }
  if (e.hp <= 0) this.killEnemy(e, school);
};

// حالات العناصر: تجميد/إشعال/سم/تصعيق
Combat.applyStatus = function (e, type, dur, dps) {
  if (!e || !e.active) return;
  const r = Game.run;
  if (type === 'freeze') e.freezeT = Math.max(e.freezeT, dur);
  else if (type === 'burn') {
    let d = dps || 5;
    if (r.syn.toxic_blaze) d *= 2;
    if (r.syn.eternal_flame) d *= 1.4;
    e.burnT = Math.max(e.burnT, dur); e.burnDps = Math.max(e.burnDps, d);
  } else if (type === 'poison') { e.poisonT = Math.max(e.poisonT, dur); e.poisonDps = Math.max(e.poisonDps, dps || 4); }
  else if (type === 'shock') e.shockT = Math.max(e.shockT, dur);
};

// ─── ضرر مساحي: يستعلم التجزئة ويضرب كل من في الدائرة ───
Combat.aoeDamage = function (x, y, radius, dmg, school, opts) {
  opts = opts || {};
  const tmp = this.tmp2;
  this.hash.query(x, y, radius + 40, tmp);
  for (let i = 0; i < tmp.length; i++) {
    const e = tmp[i];
    if (!e.active) continue;
    const rr = radius + e.r;
    if (U.dist2(x, y, e.x, e.y) < rr * rr) this.hitEnemy(e, dmg, school, opts);
  }
};

// ─── موت العدو: جواهر، خطافيات، نخبة، زعيم ───
Combat.killEnemy = function (e, school) {
  const r = Game.run;
  if (!e || !e.active) return;
  Core.pools.enemies.release(e);
  r.kills++; r.challengeProg.kills++;
  if (school) { r.schoolKills[school] = (r.schoolKills[school] || 0) + 1; const ks = r.challengeProg.killSchool; ks[school] = (ks[school] || 0) + 1; }
  Render.fxParticle(e.x, e.y, e.def.color, 'burst');
  Prog.spawnOrb(e.x, e.y, Math.ceil(e.xp));
  // إسقاط الذهب والشفاء
  const gChance = 0.14 + (e.freezeT > 0 && r.syn.golden_frost ? 0.4 : 0);
  if (Math.random() < gChance) Prog.spawnOrb(e.x + 8, e.y, 1 + Math.floor(Math.random() * 2), 'gold');
  if (Math.random() < 0.02) Prog.spawnOrb(e.x - 8, e.y, 8, 'heal');
  // خطافيات القطع
  if (r.hooks.explodeOnKill && Math.random() < r.hooks.explodeOnKill) { this.aoeDamage(e.x, e.y, 62, 30, 'fire'); Render.fxExplosion(e.x, e.y, 62, '#ff8a3a'); Audio.sfx('explode', e.x); }
  if (r.hooks.burningGround && Math.random() < r.hooks.burningGround) this.spawnPool(e.x, e.y, 42, 'fire', 1.6, 6);
  if ((r.hooks.poisonSpread && Math.random() < r.hooks.poisonSpread) || (r.syn.shadow_plague && e.poisonT > 0 && Math.random() < 0.2)) {
    this.aoeDamage(e.x, e.y, 55, 12, 'poison', { silent: true });
    const tmp = this.tmp2; this.hash.query(e.x, e.y, 90, tmp);
    for (const o of tmp) if (o.active && U.dist(e.x, e.y, o.x, o.y) < 90) this.applyStatus(o, 'poison', 2, 4);
    Render.fxExplosion(e.x, e.y, 55, '#8be84a');
  }
  if (r.hooks.berserk) r.berserk = Math.min(10, r.berserk + 1);
  if (r.hooks.vampire) { r.killVamp++; if (r.killVamp >= r.hooks.vampire) { r.killVamp = 0; r.player.hp = Math.min(r.stats.maxHp, r.player.hp + 1); } }
  // النخبة: صندوق وشظايا وتتبع التحديات
  if (e.elite) {
    r.challengeProg.elite++;
    Meta.stats.elites++;
    if (Math.random() < 0.12) Prog.spawnOrb(e.x, e.y, 1, 'shard');
    if (Math.random() < 0.1) Prog.dropChest(e.x, e.y);
  }
  if (e.isBoss) Game.onBossKilled(e);
  Bus.emit('kill', { school: school, elite: !!e.elite, boss: !!e.isBoss });
};

// ─── تلقي اللاعب للضرب: مراوغة، درع، بعث ───
Combat.hurtPlayer = function (dmg) {
  const r = Game.run, p = r.player;
  if (p.iframe > 0 || p.dashT > 0 || Game.state !== 'playing') return;
  if (Math.random() < r.stats.dodge) { Render.fText(p.x, p.y - 30, '✦', '#9fd8ff', 15); return; }
  if (r.hooks.shield30 && r.shieldT <= 0) { r.shieldT = r.hooks.shield30; Render.fText(p.x, p.y - 30, '✦', '#7ee8fa', 18); Audio.sfx('freeze'); return; }
  this.hurtPlayerRaw(dmg, true);
};
Combat.hurtPlayerRaw = function (dmg, fx) {
  const r = Game.run, p = r.player, s = r.stats;
  if (Game.state !== 'playing') return;
  const red = dmg * 100 / (100 + s.armor * 10);
  p.hp -= red;
  if (fx) {
    r.hurtFx = 1; Game.shake(6, 0.25); Audio.sfx('hurt');
    Render.fText(p.x + (Math.random() - 0.5) * 20, p.y - 26, String(Math.round(red)), '#ff5964', 15);
    UI.haptic(30);
  }
  if (p.hp <= 0) {
    if (s.revive > r.reviveUsed) {
      r.reviveUsed++; p.hp = s.maxHp * 0.5; p.iframe = 2.5;
      UI.toast(t('revived'), 'gold'); Audio.sfx('evolve'); Game.shake(12, 0.5);
      Render.fxExplosion(p.x, p.y, 180, '#f5c542');
      return;
    }
    p.hp = 0; Game.endRun(false);
  }
};
/* ══════════════════════ Systems/Render — كل الرسم البصري ══════════════════════ */
const Render = {
  cv: null, ctx: null, w: 0, h: 0, dpr: 1,
  lightCv: null, lightCtx: null, fxCv: null, fxCtx: null,
  cam: { x: 0, y: 0 }, shakeT: 0, shakeDur: 0, shakeMag: 0,
  chunks: new Map(), parallax: [], lightSpots: [],

  init() {
    this.cv = document.getElementById('game');
    this.ctx = this.cv.getContext('2d');
    this.lightCv = document.createElement('canvas'); this.lightCtx = this.lightCv.getContext('2d');
    this.fxCv = document.createElement('canvas'); this.fxCtx = this.fxCv.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    this.dpr = (Meta && Meta.settings && Meta.settings.perf) ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cv.width = Math.floor(this.w * this.dpr); this.cv.height = Math.floor(this.h * this.dpr);
    this.lightCv.width = Math.floor(this.w / 2); this.lightCv.height = Math.floor(this.h / 2);
    this.fxCv.width = this.cv.width; this.fxCv.height = this.cv.height;
  },

  shake(mag, dur) { if (!Meta || !Meta.settings.shake) return; this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, dur); this.shakeDur = Math.max(this.shakeDur, dur); },

  // ─── توليد طبقات الخلفية الثلاث لكل مرحلة ───
  genParallax(stage) {
    this.parallax = [];
    const defs = [
      { f: 0.12, alpha: 0.5, col: stage.tiles[0] }, { f: 0.3, alpha: 0.35, col: stage.speck[0] }, { f: 0.55, alpha: 0.22, col: stage.decor }
    ];
    defs.forEach((d, li) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const g = c.getContext('2d'), rng = U.mulberry32(stage.id.charCodeAt(0) * 77 + li * 13);
      g.fillStyle = d.col; g.globalAlpha = 0.9;
      const silh = (n, hMin, hMax, jag) => { // سلاسل جبال/أعمدة ظلية
        g.beginPath(); g.moveTo(0, 512);
        for (let i = 0; i <= n; i++) { const x = (i / n) * 1024, y = 512 - (hMin + rng() * (hMax - hMin)); g.lineTo(x, y); if (jag) g.lineTo(x + 1024 / n / 2, y + rng() * 60 - 30); }
        g.lineTo(1024, 512); g.closePath(); g.fill();
      };
      switch (stage.id) {
        case 'crypt': if (li === 0) silh(6, 120, 240, false); else for (let i = 0; i < 8; i++) g.fillRect(rng() * 1000, 300 + rng() * 120, 24 + rng() * 20, 80 + rng() * 90); break;
        case 'ice': if (li === 0) silh(9, 160, 320, true); else for (let i = 0; i < 10; i++) { const x = rng() * 1000, y = 260 + rng() * 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y - 60 - rng() * 80); g.lineTo(x + 36, y); g.fill(); } break;
        case 'desert': if (li === 0) { for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(rng() * 1024, 470, 160 + rng() * 120, Math.PI, 0); g.fill(); } } else for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(rng() * 1024, 430 + rng() * 60, 90 + rng() * 70, Math.PI, 0); g.fill(); } break;
        case 'flame': if (li === 0) silh(5, 200, 300, false); else for (let i = 0; i < 9; i++) g.fillRect(rng() * 1000, 200 + rng() * 180, 30 + rng() * 26, 120 + rng() * 100); break;
        case 'void': for (let i = 0; i < 12; i++) { const x = rng() * 1000, y = rng() * 400 + 40; g.beginPath(); g.ellipse(x, y, 20 + rng() * 40, 10 + rng() * 18, rng() * 3, 0, U.TAU); g.fill(); } break;
      }
      this.parallax.push({ cv: c, f: d.f, alpha: d.alpha });
    });
  },

  // ─── بلاط الأرضية: قطع 320px مخزّنة مؤقتًا ───
  CHUNK: 320,
  getChunk(cx, cy, stage) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    if (this.chunks.size > 42) { const k0 = this.chunks.keys().next().value; this.chunks.delete(k0); }
    c = document.createElement('canvas'); c.width = this.CHUNK; c.height = this.CHUNK;
    const g = c.getContext('2d');
    const rng = U.mulberry32((cx * 73856093) ^ (cy * 19349663) ^ (Data.STAGES.indexOf(stage) * 7919));
    g.fillStyle = stage.tiles[0]; g.fillRect(0, 0, 320, 320);
    for (let i = 0; i < 5; i++) { g.fillStyle = stage.tiles[1]; g.globalAlpha = 0.5; g.fillRect(rng() * 300, rng() * 300, 30 + rng() * 90, 24 + rng() * 70); }
    g.globalAlpha = 1;
    for (let i = 0; i < 34; i++) { g.fillStyle = rng() > 0.5 ? stage.speck[0] : stage.speck[1]; g.fillRect(rng() * 318, rng() * 318, 2 + rng() * 4, 2 + rng() * 3); }
    // زخارف خاصة بكل مرحلة
    g.strokeStyle = stage.decor; g.fillStyle = stage.decor; g.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const x = rng() * 300 + 10, y = rng() * 300 + 10;
      switch (stage.id) {
        case 'crypt':
          if (rng() > 0.5) { g.globalAlpha = 0.55; g.fillRect(x, y, 10, 14); g.fillRect(x - 2, y - 3, 14, 4); } // شاهد قبور
          else { g.globalAlpha = 0.4; for (let j = 0; j < 3; j++) { g.beginPath(); g.moveTo(x + j * 5, y); g.lineTo(x + j * 5 + 2, y - 7); g.stroke(); } } // عشب يابس
          break;
        case 'ice':
          g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + 4); g.stroke();
          if (rng() > 0.6) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 5, y); g.lineTo(x + 10, y + 8); g.closePath(); g.fill(); }
          break;
        case 'desert':
          g.globalAlpha = 0.35; g.beginPath(); g.arc(x, y, 12 + rng() * 10, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
          break;
        case 'flame':
          g.globalAlpha = 0.6; g.strokeStyle = '#ff6a2a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 6); g.lineTo(x + 4, y + 14); g.stroke(); g.strokeStyle = stage.decor;
          break;
        case 'void':
          g.globalAlpha = 0.4 + rng() * 0.5; g.beginPath(); g.arc(x, y, 1 + rng() * 1.6, 0, U.TAU); g.fill();
          if (rng() > 0.8) { g.beginPath(); g.arc(x, y, 5, 0, U.TAU); g.stroke(); }
          break;
      }
    }
    g.globalAlpha = 1;
    this.chunks.set(key, c);
    return c;
  },

  // ─── الإطار الرئيسي ───
  draw(alpha, dt) {
    const ctx = this.ctx, r = Game.run;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!r || Game.state === 'menu') { this.drawMenu(dt); return; }
    const p = r.player;
    // كاميرا ناعمة + اهتزاز
    const tx = U.lerp(p.px, p.x, alpha), ty = U.lerp(p.py, p.y, alpha);
    this.cam.x = U.lerp(this.cam.x, tx, Math.min(1, dt * 7)); this.cam.y = U.lerp(this.cam.y, ty, Math.min(1, dt * 7));
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const m = this.shakeMag * (this.shakeT / this.shakeDur); sx = (Math.random() - 0.5) * m * 2; sy = (Math.random() - 0.5) * m * 2; if (this.shakeT <= 0) this.shakeMag = 0; }
    const stage = r.stage, perf = Meta.settings.perf;
    ctx.fillStyle = stage.bg; ctx.fillRect(0, 0, this.w, this.h);
    // Parallax: ثلاث طبقات تتحرك بسرعات مختلفة
    if (!perf || this.parallax.length) {
      for (const L of this.parallax) {
        const off = ((this.cam.x * L.f) % 1024 + 1024) % 1024;
        ctx.globalAlpha = L.alpha;
        ctx.drawImage(L.cv, -off, this.h * 0.18 - 40); ctx.drawImage(L.cv, 1024 - off, this.h * 0.18 - 40);
        ctx.globalAlpha = 1;
      }
    }
    // التحويل العالمي
    ctx.save();
    ctx.translate(this.w / 2 + sx, this.h / 2 + sy);
    ctx.translate(-this.cam.x, -this.cam.y);
    // البلاط المرئي فقط
    const CH = this.CHUNK;
    const c0x = Math.floor((this.cam.x - this.w / 2) / CH), c1x = Math.floor((this.cam.x + this.w / 2) / CH);
    const c0y = Math.floor((this.cam.y - this.h / 2) / CH), c1y = Math.floor((this.cam.y + this.h / 2) / CH);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) ctx.drawImage(this.getChunk(cx, cy, stage), cx * CH, cy * CH);
    // مؤشرات الضربات المرصودة
    for (const m of Waves.marks) {
      const k = 1 - m.t;
      ctx.strokeStyle = 'rgba(255,89,100,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, U.TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,89,100,0.22)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * k, 0, U.TAU); ctx.fill();
    }
    this.drawOrbs(alpha);
    this.drawEnemies(alpha, ctx);
    this.drawCompanion(alpha);
    this.drawPlayer(alpha, ctx);
    this.drawProjectiles(alpha, ctx, perf);
    Core.pools.eproj.forEach(o => {
      const x = U.lerp(o.px, o.x, alpha), y = U.lerp(o.py, o.y, alpha);
      ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(x, y, o.r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - 2, y - 2, o.r * 0.4, 0, U.TAU); ctx.fill();
    });
    this.drawParticles(dt);
    this.drawTexts(dt);
    ctx.restore();
    // الإضاءة الديناميكية
    if (!perf && stage.ambient) this.drawLights(stage, sx, sy);
    // انحراف لوني عند الأذي + وميض أحمر
    const hud = document.getElementById('hurt-fx');
    hud.style.opacity = r.hurtFx > 0 ? String(Math.min(0.9, r.hurtFx)) : '0';
    if (!perf && r.hurtFx > 0.15) this.aberration(r.hurtFx);
    this.drawBossArrow(ctx);
  },

  // إضاءة: طبقة عتمة تُفتح ثقوبها حول مصادر الضوء
  drawLights(stage, sx, sy) {
    const L = this.lightCtx, r = Game.run;
    const s = 0.5;
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = stage.ambient;
    L.fillRect(0, 0, this.w * s, this.h * s);
    L.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, rad, str) => {
      const x = (wx - this.cam.x + this.w / 2 + sx) * s, y = (wy - this.cam.y + this.h / 2 + sy) * s;
      if (x < -rad || y < -rad || x > this.w * s + rad || y > this.h * s + rad) return;
      const g = L.createRadialGradient(x, y, 0, x, y, rad * s);
      g.addColorStop(0, 'rgba(0,0,0,' + str + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g; L.beginPath(); L.arc(x, y, rad * s, 0, U.TAU); L.fill();
    };
    hole(r.player.x, r.player.y, 260, 0.95);
    Core.pools.proj.forEach(pr => { if (pr.school === 'fire' || pr.school === 'void') hole(pr.x, pr.y, 90, 0.8); });
    Core.pools.enemies.forEach(e => { if (e.burnT > 0) hole(e.x, e.y, 60, 0.6); });
    for (const ls of this.lightSpots) hole(ls.x, ls.y, ls.r, 0.85);
    this.lightSpots = this.lightSpots.filter(l => (l.t -= 0.016) > 0);
    this.ctx.drawImage(this.lightCv, 0, 0, this.w, this.h);
  },

  // انحراف لوني رخيص: نسخة حمراء/سماوية بإزاحة متقابلة
  aberration(k) {
    const F = this.fxCtx, main = this.ctx;
    F.globalCompositeOperation = 'source-over';
    F.clearRect(0, 0, this.fxCv.width, this.fxCv.height);
    F.drawImage(this.cv, 0, 0);
    F.globalCompositeOperation = 'multiply';
    F.fillStyle = '#ff0004'; F.fillRect(0, 0, this.fxCv.width, this.fxCv.height);
    main.globalCompositeOperation = 'lighter'; main.globalAlpha = 0.25 * k;
    main.drawImage(this.fxCv, -5, 0, this.w, this.h);
    F.globalCompositeOperation = 'source-over';
    F.clearRect(0, 0, this.fxCv.width, this.fxCv.height);
    F.drawImage(this.cv, 0, 0);
    F.globalCompositeOperation = 'multiply';
    F.fillStyle = '#00f6ff'; F.fillRect(0, 0, this.fxCv.width, this.fxCv.height);
    main.drawImage(this.fxCv, 5, 0, this.w, this.h);
    main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
  },

  drawBossArrow(ctx) {
    const r = Game.run;
    if (!r || !r.bossActive) return;
    for (const b of r.bosses) {
      if (!b.active) continue;
      const sxp = b.x - this.cam.x + this.w / 2, syp = b.y - this.cam.y + this.h / 2;
      if (sxp > 30 && sxp < this.w - 30 && syp > 30 && syp < this.h - 30) continue;
      const a = Math.atan2(b.y - r.player.y, b.x - r.player.x);
      const ex = this.w / 2 + Math.cos(a) * (Math.min(this.w, this.h) / 2 - 34), ey = this.h / 2 + Math.sin(a) * (Math.min(this.w, this.h) / 2 - 34);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = b.def.color; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },

  // خلفية القائمة: جسيمات عائمة ونجوم
  drawMenu(dt) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#0a0c1a'); g.addColorStop(0.6, '#10142c'); g.addColorStop(1, '#0a0c14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    if (!this._menuParts) { this._menuParts = []; for (let i = 0; i < 60; i++) this._menuParts.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: 0.6 + Math.random() * 2.2, v: 8 + Math.random() * 26, c: Math.random() > 0.5 ? '#7ee8fa' : '#b06cff' }); }
    const tN = performance.now() / 1000;
    for (const pt of this._menuParts) {
      pt.y -= pt.v * dt; if (pt.y < -8) { pt.y = this.h + 8; pt.x = Math.random() * this.w; }
      ctx.globalAlpha = 0.35 + Math.sin(tN * 2 + pt.x) * 0.25;
      ctx.fillStyle = pt.c; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.s, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};
AS.Render = Render;
/* ══════════════════════ Systems/Render — رسم الكيانات والمؤثرات ══════════════════════ */
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
    const col = o.type === 'xp' ? '#5eeaa4' : o.type === 'gold' ? '#f5c542' : o.type === 'heal' ? '#ff8a9a' : '#b06cff';
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, o.type === 'xp' ? 4 + Math.min(3, o.val * 0.2) : 5, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1.4, y - 1.4, 1.6, 0, U.TAU); ctx.fill();
  });
};

// ─── الأعداء: أشكال إجرائية مميزة لكل نوع ───
Render.drawEnemies = function (alpha, ctx) {
  const r = Game.run, w2 = this.w / 2 + 70, h2 = this.h / 2 + 70;
  Core.pools.enemies.forEach(e => {
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha);
    const dx = x - this.cam.x, dy = y - this.cam.y;
    if (dx < -w2 || dx > w2 || dy < -h2 || dy > h2) return; // قص خارج الشاشة
    const c = e.def.color;
    // ظل أرضي
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.9, e.r * 0.9, e.r * 0.32, 0, 0, U.TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y);
    const wob = 1 + Math.sin(e.animT * 9) * 0.07;
    ctx.scale(2 - wob, wob);
    if (e.elite) { ctx.strokeStyle = e.elite.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(0, 0, e.r + 5 + Math.sin(e.animT * 6) * 2, 0, U.TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const eyes = (s, col) => { ctx.fillStyle = col || '#141824'; const a = Math.atan2(r.player.y - y, r.player.x - x); ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.3 - s / 2, Math.sin(a) * e.r * 0.3, s, 0, U.TAU); ctx.arc(Math.cos(a) * e.r * 0.3 + s / 2 + s, Math.sin(a) * e.r * 0.3, s, 0, U.TAU); ctx.fill(); };
    switch (e.def.shape) {
      case 'skel': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(0, i * 4, e.r * 0.6, 0.3, Math.PI - 0.3); ctx.stroke(); } eyes(2.2); break;
      case 'blob': ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.15, e.r * 0.85, 0, 0, U.TAU); ctx.fill(); eyes(2.4); break;
      case 'archer': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#6b5c3a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, e.r + 5, -1.2, 1.2); ctx.stroke(); eyes(2); break;
      case 'ghost': ctx.globalAlpha = 0.82; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -2, e.r, Math.PI, 0); ctx.quadraticCurveTo(e.r, e.r * 0.9, 0, e.r * 0.4); ctx.quadraticCurveTo(-e.r, e.r * 0.9, -e.r, -2); ctx.fill(); ctx.globalAlpha = 1; eyes(2.4, '#1a1040'); break;
      case 'brute': ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-e.r, -e.r * 0.9, e.r * 2, e.r * 1.8, 6); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-e.r * 0.7, -e.r * 0.4, e.r * 1.4, 5); eyes(3); break;
      case 'bat': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, U.TAU); ctx.fill(); const fl = Math.sin(e.animT * 14) * 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-e.r * 1.6, -e.r * fl); ctx.lineTo(-e.r * 0.9, e.r * 0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.r * 1.6, -e.r * fl); ctx.lineTo(e.r * 0.9, e.r * 0.5); ctx.fill(); eyes(1.8); break;
      case 'wolf': ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.25, e.r * 0.75, 0, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-e.r * 0.4, -e.r * 0.6); ctx.lineTo(-e.r * 0.2, -e.r * 1.2); ctx.lineTo(0, -e.r * 0.6); ctx.fill(); eyes(2); break;
      case 'golem': ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-e.r * 0.9, -e.r, e.r * 1.8, e.r * 2, 8); ctx.fill(); ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, U.TAU); ctx.fill(); eyes(2.6, '#0a2030'); break;
      case 'mage': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 2, e.r * 0.8, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-e.r, 0); ctx.lineTo(0, -e.r * 1.6); ctx.lineTo(e.r, 0); ctx.closePath(); ctx.fill(); eyes(2, '#28100a'); break;
      case 'bug': ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.1, e.r * 0.8, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i * e.r * 0.8, 0); ctx.lineTo(i * e.r * 1.5, -4); ctx.stroke(); } eyes(1.6); break;
      case 'snake': for (let i = 2; i >= 0; i--) { ctx.fillStyle = c; ctx.globalAlpha = 1 - i * 0.2; ctx.beginPath(); ctx.arc(Math.sin(e.animT * 6 + i) * 5, -i * 6, e.r * (1 - i * 0.18), 0, U.TAU); ctx.fill(); } ctx.globalAlpha = 1; eyes(1.8); break;
      case 'mummy': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.8)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-e.r, -e.r * 0.4 + i * e.r * 0.45); ctx.lineTo(e.r, -e.r * 0.2 + i * e.r * 0.45); ctx.stroke(); } eyes(2.2, '#3a3020'); break;
      case 'imp': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#8a2410'; ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.7); ctx.lineTo(-e.r * 0.3, -e.r * 1.3); ctx.lineTo(-e.r * 0.1, -e.r * 0.7); ctx.fill(); ctx.beginPath(); ctx.moveTo(e.r * 0.6, -e.r * 0.7); ctx.lineTo(e.r * 0.3, -e.r * 1.3); ctx.lineTo(e.r * 0.1, -e.r * 0.7); ctx.fill(); eyes(2, '#ffe95c'); break;
      case 'eye': ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); const ea = Math.atan2(r.player.y - y, r.player.x - x); ctx.fillStyle = '#2a0a3a'; ctx.beginPath(); ctx.arc(Math.cos(ea) * e.r * 0.3, Math.sin(ea) * e.r * 0.3, e.r * 0.45, 0, U.TAU); ctx.fill(); break;
      case 'spawn': ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU + e.animT; const rr = e.r * (i % 2 ? 0.7 : 1.15); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); eyes(1.8); break;
      default: // أشكال الزعماء: قاعدة ضخمة + تاج
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(0, e.r * 0.25, e.r * 0.7, 0, Math.PI); ctx.fill();
        eyes(4, '#1a0505');
        ctx.fillStyle = '#f5c542'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * e.r * 0.5 - 5, -e.r * 0.95); ctx.lineTo(i * e.r * 0.5, -e.r * 1.35); ctx.lineTo(i * e.r * 0.5 + 5, -e.r * 0.95); ctx.fill(); }
        if (e.def.shape === 'bossPhoenix') { ctx.fillStyle = 'rgba(255,140,60,0.5)'; const fl = Math.sin(e.animT * 8) * 8; ctx.beginPath(); ctx.ellipse(-e.r * 1.2, 0, e.r * 0.5, e.r * 0.9 + fl, 0.4, 0, U.TAU); ctx.ellipse(e.r * 1.2, 0, e.r * 0.5, e.r * 0.9 + fl, -0.4, 0, U.TAU); ctx.fill(); }
        break;
    }
    ctx.restore();
    // تحذير مسبق واضح قبل الهجمات الخطيرة
    if (e.state === 'windup') {
      ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(r.player.x, r.player.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,220,80,0.95)'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - e.r - 10);
    }
    // شريط صحة مصغر للنخبة والوحوش الكبيرة
    if ((e.elite || e.def.behavior === 'brute') && e.hp < e.maxHp) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw, 4);
      ctx.fillStyle = '#ff5964'; ctx.fillRect(x - bw / 2, y - e.r - 10, bw * (e.hp / e.maxHp), 4);
    }
    // وميض الإصابة وحالة التجمد
    if (e.flash > 0) { ctx.globalAlpha = e.flash * 0.65; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.freezeT > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(x, y, e.r + 2, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (e.shockT > 0 && Math.random() < 0.3) { ctx.strokeStyle = '#ffe95c'; ctx.beginPath(); ctx.moveTo(x - e.r, y - e.r); ctx.lineTo(x + e.r * 0.4, y - e.r * 0.3); ctx.stroke(); }
  });
};

Render.drawPlayer = function (alpha, ctx) {
  const r = Game.run, p = r.player, ch = Data.char(r.charId);
  if (!ch) return;
  const x = U.lerp(p.px, p.x, alpha), y = U.lerp(p.py, p.y, alpha);
  // أشباح الاندفاع (motion blur)
  for (const g of p.trail) {
    ctx.globalAlpha = g.t * 1.8; ctx.fillStyle = ch.color;
    ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (p.iframe > 0 && Math.floor(p.iframe * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 13, 12, 4.5, 0, 0, U.TAU); ctx.fill();
  const bob = Math.sin(p.animT * 10) * 1.8;
  ctx.save(); ctx.translate(x, y + bob);
  // الجسد والعباءة
  ctx.fillStyle = ch.color; ctx.beginPath(); ctx.arc(0, 0, 13, 0, U.TAU); ctx.fill();
  ctx.fillStyle = 'rgba(8,10,20,0.4)'; ctx.beginPath(); ctx.arc(0, 2, 13, 0.15, Math.PI - 0.15); ctx.fill();
  ctx.fillStyle = '#0d1020'; ctx.beginPath(); ctx.arc(0, -4, 9, Math.PI, 0); ctx.fill(); // القلنسوة
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.face.x * 3 - 2.5, -1, 1.8, 0, U.TAU); ctx.arc(p.face.x * 3 + 2.5, -1, 1.8, 0, U.TAU); ctx.fill();
  // العصا السحرية بضوء مدرسة السلاح الأول
  const w0 = r.weapons[0];
  const wc = w0 ? w0.def.color : '#7ee8fa';
  ctx.strokeStyle = '#6b5c3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-p.face.x * 4, 2); ctx.lineTo(p.face.x * 17, p.face.y * 17 - 6); ctx.stroke();
  ctx.fillStyle = wc; ctx.globalAlpha = 0.85 + Math.sin(p.animT * 8) * 0.15; ctx.beginPath(); ctx.arc(p.face.x * 17, p.face.y * 17 - 6, 4.5, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  if (p.dashT > 0) { ctx.strokeStyle = 'rgba(126,232,250,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, 0, U.TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
};

Render.drawCompanion = function (alpha) {
  const r = Game.run, def = Data.comp(r.companion);
  if (def.kind === 'none') return;
  const cs = r.compState, x = cs.x, y = cs.y;
  const ctx = this.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 9, 3, 0, 0, U.TAU); ctx.fill();
  ctx.fillStyle = def.color;
  switch (def.id) {
    case 'wolf': ctx.beginPath(); ctx.ellipse(x, y, 11, 7, 0, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y - 6); ctx.lineTo(x - 2, y - 12); ctx.lineTo(x, y - 6); ctx.fill(); break;
    case 'ghost': ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, 9, Math.PI, 0); ctx.quadraticCurveTo(x + 9, y + 9, x, y + 6); ctx.quadraticCurveTo(x - 9, y + 9, x - 9, y); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'golem': ctx.beginPath(); ctx.roundRect(x - 8, y - 9, 16, 18, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 5); break;
    case 'fairy': ctx.globalAlpha = 0.7 + Math.sin(performance.now() / 200) * 0.3; ctx.beginPath(); ctx.arc(x, y, 5, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(x - 7, y - 4, 5, 2.5, 0.6, 0, U.TAU); ctx.ellipse(x + 7, y - 4, 5, 2.5, -0.6, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'drake': ctx.beginPath(); ctx.arc(x, y, 8, 0, U.TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,138,92,0.6)'; const fw = Math.sin(performance.now() / 90) * 4; ctx.beginPath(); ctx.ellipse(x - 10, y - 2 + fw, 6, 3, 0.5, 0, U.TAU); ctx.ellipse(x + 10, y - 2 + fw, 6, 3, -0.5, 0, U.TAU); ctx.fill(); break;
  }
};

Render.drawProjectiles = function (alpha, ctx, perf) {
  Core.pools.proj.forEach(pr => {
    const x = U.lerp(pr.px, pr.x, alpha), y = U.lerp(pr.py, pr.y, alpha);
    switch (pr.kind) {
      case 'straight': case 'bounce': case 'homing': {
        if (!perf) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4; ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(x, y, pr.r * 1.9, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(x, y, pr.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - pr.r * 0.25, y - pr.r * 0.25, pr.r * 0.4, 0, U.TAU); ctx.fill();
        break;
      }
      case 'boomerang': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pr.angle);
        ctx.fillStyle = pr.color; ctx.fillRect(-pr.r, -3, pr.r * 2, 6); ctx.fillRect(-3, -pr.r, 6, pr.r * 2);
        ctx.restore(); break;
      }
      case 'ring': {
        ctx.strokeStyle = pr.color; ctx.lineWidth = 5; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 0.18; ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
      case 'rain': {
        const gy = pr.y; // ظل الهدف على الأرض
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(pr.x, gy, pr.r * 0.7, pr.r * 0.25, 0, 0, U.TAU); ctx.fill();
        const fy = gy - pr.z;
        ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, fy, pr.r * 0.6, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(pr.x, fy - 30); ctx.lineTo(pr.x, fy - 10); ctx.stroke();
        break;
      }
      case 'mine': {
        const k = 0.5 + Math.sin(performance.now() / 150) * 0.2;
        if (pr.mode === 'tick') { ctx.fillStyle = pr.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.6 * k + 10, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
        else if (pr.mode === 'pull') { ctx.fillStyle = '#1a0a2e'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.4, 0, U.TAU); ctx.fill(); ctx.strokeStyle = pr.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * (0.3 + 0.6 * (1 - pr.life / pr.maxLife)), 0, U.TAU); ctx.stroke(); }
        else { ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.life * 3); ctx.fillStyle = pr.color; ctx.globalAlpha = 0.85; ctx.fillRect(-8, -8, 16, 16); ctx.restore(); ctx.globalAlpha = 1; }
        break;
      }
      case 'pool': {
        ctx.fillStyle = pr.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.r, pr.r * 0.55, 0, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1;
        break;
      }
    }
  });
};

// ─── الجزيئات والأرقام العائمة ───
Render.drawParticles = function (dt) {
  const ctx = this.ctx;
  Core.pools.parts.forEach(pt => {
    pt.life -= dt;
    if (pt.life <= 0) { Core.pools.parts.release(pt); return; }
    const k = pt.life / pt.maxLife;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += pt.grav * dt;
    pt.vx *= pt.drag; pt.vy *= pt.drag;
    switch (pt.type) {
      case 'spark': ctx.strokeStyle = pt.color; ctx.globalAlpha = k; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03); ctx.stroke(); break;
      case 'smoke': ctx.fillStyle = pt.color; ctx.globalAlpha = k * 0.3; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (2 - k), 0, U.TAU); ctx.fill(); break;
      case 'flame': ctx.fillStyle = pt.color; ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * k, 0, U.TAU); ctx.fill(); break;
      case 'trail': ctx.fillStyle = pt.color; ctx.globalAlpha = k * 0.7; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, U.TAU); ctx.fill(); break;
      case 'burst': ctx.strokeStyle = pt.color; ctx.globalAlpha = k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - k), 0, U.TAU); ctx.stroke(); break;
      case 'ring': ctx.strokeStyle = pt.color; ctx.globalAlpha = k * 0.6; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (2.2 - k * 1.4), 0, U.TAU); ctx.stroke(); break;
      case 'zap': ctx.strokeStyle = pt.color; ctx.globalAlpha = k; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo((pt.x + pt.x2) / 2 + (Math.random() - 0.5) * 12, (pt.y + pt.y2) / 2 + (Math.random() - 0.5) * 12); ctx.lineTo(pt.x2, pt.y2); ctx.stroke(); break;
      case 'slash': ctx.strokeStyle = pt.color; ctx.globalAlpha = k; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, pt.a - 0.9 + (1 - k) * 1.2, pt.a + 0.9 - (1 - k) * 0.4); ctx.stroke(); break;
    }
    ctx.globalAlpha = 1;
  });
};