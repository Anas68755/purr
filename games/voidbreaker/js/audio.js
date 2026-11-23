// ============================================================
// VOID BREAKER // NEON ASCENSION — audio.js
// Sound engine built on Howler.js (3rd-party, MIT).
//  - html5 audio mode is forced on file:// (XHR/WebAudio decode is
//    blocked there); native WebAudio mode elsewhere for low latency.
//  - Graceful silent fallback if Howler itself failed to load.
// ============================================================
window.VB = window.VB || {};

VB.Audio = (function () {
  const CFG = VB.CONFIG.AUDIO;
  const isFile = location.protocol === 'file:';
  const html5 = isFile;                       // <audio> elements work on file://
  const available = typeof window.Howl === 'function';

  let musicVol = 0.7, sfxVol = 0.8, muted = false;
  let currentMusic = null;                    // name of playing track
  let currentMusicHowl = null;
  const howls = new Map();                    // sfx name -> Howl
  const musicHowls = new Map();               // music name -> Howl
  const lastPlayed = new Map();               // throttle map

  function makeHowl(file, loop) {
    return new Howl({
      src: [file],
      format: ['wav'],
      loop: !!loop,
      html5: html5,
      preload: true,
      volume: 1.0
    });
  }

  function sfx(name) {
    if (muted || sfxVol <= 0) return;
    const def = CFG.SFX[name];
    if (!def) return;
    const now = performance.now();
    const last = lastPlayed.get(name) || 0;
    if (now - last < (def.throttle || 0)) return;
    lastPlayed.set(name, now);

    if (!available) return fallbackPlay(def.file, def.vol * sfxVol);

    let h = howls.get(name);
    if (!h) {
      h = makeHowl(def.file, false);
      howls.set(name, h);
    }
    // slight pitch jitter so repeated shots feel alive
    const rate = 1 + (Math.random() * 0.12 - 0.06);
    const id = h.play();
    if (h.state() === 'loaded') {
      try { h.rate(rate, id); } catch (e) { /* html5 race */ }
      h.volume(def.vol * sfxVol, id);
    } else {
      h.once('play', function () {
        try { h.rate(rate, id); } catch (e) { /* noop */ }
        h.volume(def.vol * sfxVol, id);
      });
    }
  }

  function music(name) {
    if (currentMusic === name) return;
    // fade out old
    if (currentMusicHowl) {
      const old = currentMusicHowl;
      try { old.fade(old.volume(), 0, 900); } catch (e) { old.stop(); }
      setTimeout(function () { try { old.stop(); } catch (e) { /* noop */ } }, 950);
      currentMusicHowl = null;
    }
    currentMusic = name;
    if (!name || muted || musicVol <= 0) return;

    if (!available) {
      fallbackMusic(CFG.MUSIC[name]);
      return;
    }
    let h = musicHowls.get(name);
    if (!h) {
      h = makeHowl(CFG.MUSIC[name], true);
      musicHowls.set(name, h);
    }
    currentMusicHowl = h;
    const start = function () {
      if (currentMusicHowl !== h) return;      // user switched tracks meanwhile
      try {
        h.volume(0);
        h.play();
        h.fade(0, musicVol, 1200);
      } catch (e) { /* not ready yet */ }
    };
    if (h.state() === 'loaded') start();
    else h.once('load', start);
  }

  function stopMusic() {
    if (currentMusicHowl) {
      const old = currentMusicHowl;
      try { old.fade(old.volume(), 0, 800); } catch (e) { old.stop(); }
      setTimeout(function () { try { old.stop(); } catch (e) { /* noop */ } }, 850);
      currentMusicHowl = null;
    }
    currentMusic = null;
    if (fallbackAudio) { try { fallbackAudio.pause(); } catch (e) { /* noop */ } fallbackAudio = null; }
  }

  // ---- minimal <audio> fallback (used only if Howler is missing) ----
  let fallbackAudio = null;
  function fallbackPlay(file, vol) {
    try {
      const a = new Audio(file);
      a.volume = Math.min(1, Math.max(0, vol));
      a.play().catch(function () { /* autoplay blocked */ });
    } catch (e) { /* noop */ }
  }
  function fallbackMusic(file) {
    if (!file) return;
    try {
      if (fallbackAudio) { fallbackAudio.pause(); }
      fallbackAudio = new Audio(file);
      fallbackAudio.loop = true;
      fallbackAudio.volume = musicVol;
      fallbackAudio.play().catch(function () { /* autoplay blocked */ });
    } catch (e) { /* noop */ }
  }

  // ---- settings plumbing ----
  function applyVolumes(m, s, isMuted) {
    musicVol = m; sfxVol = s; muted = !!isMuted;
    if (available) {
      try { Howler.mute(muted); } catch (e) { /* noop */ }
    }
    if (currentMusicHowl && !muted) {
      try { currentMusicHowl.volume(musicVol); } catch (e) { /* noop */ }
    }
    if (fallbackAudio) fallbackAudio.volume = muted ? 0 : musicVol;
    if (muted && fallbackAudio) { try { fallbackAudio.pause(); } catch (e) { /* noop */ } fallbackAudio = null; }
  }

  /** Music director: pick track for game context.
   *  v5.0: bossCount replaces the boolean — dual fights get the finale
   *  theme, Boss Rush gets its own gauntlet track, and deep classic
   *  waves (26+) descend into the abyss theme. */
  function director(state, wave, bossN) {
    if (state === 'menu') return 'menu_theme';
    if (state === 'playing' || state === 'upgrade' || state === 'paused') {
      if (VB.Game.mode === 'rush') {
        if (bossN >= 2) return 'finale_theme';
        if (bossN === 1) return 'boss_theme';
        return 'rush_theme';
      }
      if (bossN >= 2) return 'finale_theme';
      if (bossN === 1) return 'boss_theme';
      if (wave >= 26) return 'abyss_theme';
      return (Math.floor((wave - 1) / 5) % 2 === 0) ? 'battle_a' : 'battle_b';
    }
    return null;
  }

  function init() {
    if (available) {
      try { Howler.autoUnlock = true; } catch (e) { /* noop */ }
      // If autoplay was blocked on the menu, start it after first gesture.
      try {
        Howler.on('unlock', function () {
          if (VB.Game && VB.Game.state === 'menu' && !currentMusic) {
            music('menu_theme');
          }
        });
      } catch (e) { /* noop */ }
    }
  }

  return {
    init, sfx, music, stopMusic, applyVolumes, director,
    get isReady() { return available; }
  };
})();
