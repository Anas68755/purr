'use strict';
/* Sound engine.
   - Served over http(s): decoded WebAudio buffers (low latency, overlapping sounds).
   - Opened straight from disk (file://): browsers block fetch(), so it transparently falls back to
     HTMLAudio elements.  Both paths expose the same API.
   - Missing files are skipped silently. */
const Sound = {
  ctx: null, master: null, wa: false,
  buffers: {}, elems: {},
  loops: {}, music: {},
  sfxOn: true, musicOn: true,
  unlocked: false, musicStarted: false,
  missing: [],

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.wa = location.protocol !== 'file:';
      } catch (e) { this.ctx = null; this.wa = false; }
    }
  },

  async load(key, url) {
    if (this.wa) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const ab = await res.arrayBuffer();
        this.buffers[key] = await new Promise((ok, bad) => this.ctx.decodeAudioData(ab, ok, bad));
        return;
      } catch (e) { /* fall through to HTMLAudio */ }
    }
    await new Promise(resolve => {
      const a = new window.Audio();
      a.preload = 'auto';
      let settled = false;
      const done = ok => { if (settled) return; settled = true; if (!ok) { delete this.elems[key]; this.missing.push(url); console.warn('[audio] missing:', url); } resolve(); };
      a.addEventListener('canplaythrough', () => done(true), { once: true });
      a.addEventListener('error', () => done(false), { once: true });
      this.elems[key] = a;
      a.src = url;
      try { a.load(); } catch (e) {}
      setTimeout(() => done(!!this.elems[key]), 3000);
    });
  },

  async loadAll(onProgress) {
    const jobs = [];
    Object.entries(SFX_FILES).forEach(([k, u]) => jobs.push(['sfx_' + k, u]));
    Object.entries(LOOP_FILES).forEach(([k, u]) => jobs.push(['loop_' + k, u]));
    Object.entries(MUSIC_FILES).forEach(([k, u]) => jobs.push(['music_' + k, u]));
    let done = 0;
    await Promise.all(jobs.map(([k, u]) => this.load(k, u).then(() => { done++; if (onProgress) onProgress(done / jobs.length); })));
  },

  loadSettings() { this.sfxOn = profile.settings.sfx; this.musicOn = profile.settings.music; },
  saveSettings() { profile.settings.sfx = this.sfxOn; profile.settings.music = this.musicOn; saveProfile(); },
  get sfxVol() { return profile.settings.sfxVol; },
  get musicVol() { return profile.settings.musicVol; },

  // Must be called from a user gesture (browsers keep audio locked until then).
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    Object.values(this.elems).forEach(a => {
      try {
        a.muted = true;
        const p = a.play();
        if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
      } catch (e) { a.muted = false; }
    });
  },

  play(name, vol = 1, rate = 1) {
    if (!this.sfxOn) return;
    const key = 'sfx_' + name;
    if (this.buffers[key]) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.buffers[key];
      s.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = vol * this.sfxVol;
      s.connect(g); g.connect(this.master);
      s.start();
    } else if (this.elems[key]) {
      try {
        const a = this.elems[key].cloneNode();
        a.volume = clamp(vol * this.sfxVol, 0, 1);
        a.playbackRate = rate;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
  },

  // continuous loop (suction). on=true starts it, on=false stops it.
  setLoop(name, on, vol = 0.5) {
    const key = 'loop_' + name;
    const want = on && this.sfxOn;
    const cur = this.loops[name];
    if (want && !cur) {
      if (this.buffers[key]) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.buffers[key]; s.loop = true;
        const g = this.ctx.createGain(); g.gain.value = vol * this.sfxVol;
        s.connect(g); g.connect(this.master); s.start();
        this.loops[name] = { s, g, vol };
      } else if (this.elems[key]) {
        const a = this.elems[key];
        a.loop = true; a.volume = clamp(vol * this.sfxVol, 0, 1);
        const p = a.play(); if (p && p.catch) p.catch(() => {});
        this.loops[name] = { a, vol };
      }
    } else if (!want && cur) {
      if (cur.s) { try { cur.s.stop(); } catch (e) {} }
      if (cur.a) { cur.a.pause(); cur.a.currentTime = 0; }
      delete this.loops[name];
    }
  },

  // change the volume of a running loop (e.g. rain fading in/out)
  setLoopVol(name, vol) {
    const cur = this.loops[name]; if (!cur) return;
    cur.vol = vol;
    if (cur.g) cur.g.gain.value = vol * this.sfxVol; else if (cur.a) cur.a.volume = clamp(vol * this.sfxVol, 0, 1);
  },

  startMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    Object.keys(MUSIC_FILES).forEach(k => {
      const key = 'music_' + k;
      if (this.buffers[key]) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.buffers[key]; s.loop = true;
        const g = this.ctx.createGain(); g.gain.value = 0;
        s.connect(g); g.connect(this.master); s.start();
        this.music[k] = { g };
      } else if (this.elems[key]) {
        const a = this.elems[key];
        a.loop = true; a.volume = 0;
        const p = a.play(); if (p && p.catch) p.catch(() => {});
        this.music[k] = { a };
      }
    });
  },

  // night: 0..1 — crossfades the day and night tracks
  updateMusic(night) {
    const base = this.musicOn ? 0.5 * this.musicVol : 0;
    const set = (k, v) => {
      const m = this.music[k]; if (!m) return;
      if (m.g) m.g.gain.value = v; else if (m.a) m.a.volume = clamp(v, 0, 1);
    };
    set('day', base * (1 - night));
    set('night', base * night);
  },

  setSfx(on) { this.sfxOn = on; if (!on) { this.setLoop('suck', false); this.setLoop('rain', false); } this.saveSettings(); },
  setMusic(on) { this.musicOn = on; this.saveSettings(); }
};
