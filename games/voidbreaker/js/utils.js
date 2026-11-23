// ============================================================
// VOID BREAKER // NEON ASCENSION — utils.js
// v5.3 HORIZON: seeded run RNG (mulberry32) + challenge codes.
// ============================================================
window.VB = window.VB || {};

VB.U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },

  // ---- v5.3 HORIZON: seeded randomness ---------------------------------
  // When a run seed is armed (challenge codes / Daily Void / shared run
  // codes) the director-level rolls below become fully deterministic:
  // same code -> same wave script, same foes, same elite & drop rolls.
  // Combat noise (crits, particles) keeps using raw Math.random.
  RNG: (function () {
    let s = 0;                 // 32-bit mulberry32 state
    let active = false;
    function seed(n) { s = (n >>> 0) || 1; active = true; }
    function clear() { active = false; }
    function next() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** seeded roll when a run is armed, raw Math.random otherwise */
    function float() { return active ? next() : Math.random(); }
    return { seed, clear, next, float, get active() { return active; } };
  })(),

  rand(a, b) { return a + VB.U.RNG.float() * (b - a); },
  /** v5.3: cosmetic-only random range — NEVER touches the run seed stream,
   *  so particle noise cannot perturb challenge-code determinism */
  frand(a, b) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(this.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(VB.U.RNG.float() * arr.length)]; },

  /** weightedPick({key: weight, ...}) -> key */
  weightedPick(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = VB.U.RNG.float() * total;
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return Object.keys(weights)[0];
  },

  // ---- v5.3 HORIZON: challenge codes ------------------------------------
  // Format:  SEED.CCC.M   — SEED is 6 base-36 chars, CCC is one digit per
  // active curse (index into CONFIG.CURSES key order), M is C (classic) or
  // R (boss rush).  e.g.  "K7X2PQ.0134.C" replays seed + curses + mode.
  code: {
    SEED_CHARS: 6,
    newSeed() { return Math.floor(Math.random() * 2176782336); },   // 36^6
    encode(seed, curseIds, mode) {
      const keys = Object.keys(VB.CONFIG.CURSES);
      let digits = '';
      for (const id of curseIds) {
        const i = keys.indexOf(id);
        if (i >= 0) digits += String(i);
      }
      const s = (((seed % 2176782336) + 2176782336) % 2176782336)
        .toString(36).toUpperCase().padStart(this.SEED_CHARS, '0');
      // '-' = curse-free sortie ('0' alone would mean HORDES)
      return s + '.' + (digits || '-') + '.' + (mode === 'rush' ? 'R' : 'C');
    },
    /** parse 'SEED.CCC.M' -> {seed, curses:[ids], mode} or null */
    decode(str) {
      if (!str) return null;
      const t = String(str).trim().toUpperCase().replace(/\s+/g, '');
      const m = t.match(/^([0-9A-Z]{6})\.(-?[0-9]*)\.([CR])$/);
      if (!m) return null;
      const seed = parseInt(m[1], 36);
      if (!isFinite(seed)) return null;
      const keys = Object.keys(VB.CONFIG.CURSES);
      const curses = [];
      if (m[2] !== '-' && m[2] !== '') {
        for (const ch of m[2]) {
          const i = Number(ch);
          if (i >= keys.length) return null;
          curses.push(keys[i]);
        }
      }
      return { seed, curses, mode: m[3] === 'R' ? 'rush' : 'classic' };
    },
    /** daily seed — same for every pilot on the same calendar day */
    dailySeed(d) {
      const t = d || new Date();
      const ymd = t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
      // xorshift-style stir so consecutive days give unrelated streams
      let h = (ymd ^ 0x5DEECE66) >>> 0;
      h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0;
      h ^= h >>> 15;
      return h % 2176782336;
    },
    dailyStamp(d) {
      const t = d || new Date();
      return t.getFullYear() + '-' +
        String(t.getMonth() + 1).padStart(2, '0') + '-' +
        String(t.getDate()).padStart(2, '0');
    }
  },

  angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },

  /** '#rrggbb' + alpha -> 'rgba(r,g,b,a)' */
  hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  },

  fmt(n) { return Math.floor(n).toLocaleString('en-US'); },

  fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  },

  storage: {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
    }
  },

  /** v5.2 OMEGA: haptic feedback (Android WebView / supported browsers).
   *  No-op unless the setting is on and navigator.vibrate exists. */
  vibrate(ms) {
    try {
      if (VB.Settings && VB.Settings.data.haptics &&
          navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* unsupported */ }
  }
};
