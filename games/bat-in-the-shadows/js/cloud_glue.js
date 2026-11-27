'use strict';
/* ============================================================
   BAT IN THE SHADOWS — cloud glue (v2.3)
   Leaderboard + cloud save through the shared PURR Cloud Kit
   (games/_shared/cloud.js). Zero changes to game code: this file
   only reads/writes the game's own localStorage keys, submits the
   best score when it grows, mirrors a tiny save blob (settings +
   best) to the cloud, and shows the global top 5 on the game-over
   screen. Everything fails soft offline.
   ============================================================ */
(function () {
  const GAME = 'bat';
  const SYNC = 'batCloudSync_v1';
  const KEYS = ['batSettings_v2', 'batHighScore'];
  const SCORE_KEYS = [{ k: 'batHighScore', meta: () => ({}) }];
  const BOARD_SEL = '#gameoverScreen';

  let lastSent = {}, lastBlobStr = '';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function blob() { const o = { v: 1 }; KEYS.forEach(k => { o[k] = lsGet(k); }); return o; }

  async function kit() {
    const K = window.CloudKit; if (!K) return null;
    await K.ready();
    return K.online() ? K : null;
  }

  function pushBlob(force) {
    const b = blob(); const s = JSON.stringify(b);
    if (!force && s === lastBlobStr) return;
    lastBlobStr = s;
    kit().then(K => {
      if (!K) return;
      let m = {}; try { m = JSON.parse(localStorage.getItem(SYNC)) || {}; } catch (e) {}
      const now = Date.now();
      if (!force && now - (m.pushedAt || 0) < 45000) return;
      m.pushedAt = now; lsSet(SYNC, JSON.stringify(m));
      K.saveCloud(GAME, b);
    }).catch(() => {});
  }

  function submitScores() {
    kit().then(K => {
      if (!K) return;
      SCORE_KEYS.forEach(sk => {
        const v = parseInt(lsGet(sk.k) || '0', 10) || 0;
        if (v <= 0 || v <= (lastSent[sk.k] || 0)) return;
        lastSent[sk.k] = v;
        K.submitScore(GAME, K.name() || 'Player', v, sk.meta());
      });
    }).catch(() => {});
  }

  function fillBoard() {
    const box = document.getElementById('cloudBoard');
    const K = window.CloudKit;
    if (!box || !K) return;
    K.ready().then(async () => {
      if (!K.online()) { box.innerHTML = '<small style="opacity:.55">☁ cloud offline</small>'; return; }
      const rows = await K.topScores(GAME, 5);
      const me = (K.name() || 'Player').replace(/"/g, '');
      let html = '<div style="opacity:.75;font-size:12px;margin:0 0 3px">☁ Global top 5 · <input id="cloudName" maxlength="16" value="' + me +
        '" style="width:110px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:6px;color:inherit;padding:0 6px;font:inherit"></div>';
      if (!rows.length) html += '<div style="opacity:.6">No cloud scores yet — be the first!</div>';
      rows.forEach((r, i) => {
        html += '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span style="opacity:.85">' + (i + 1) + '. ' +
          String(r.player || 'Player').replace(/[<>&]/g, '') + '</span><b>' + r.score + '</b></div>';
      });
      box.innerHTML = html;
      const inp = document.getElementById('cloudName');
      if (inp) inp.addEventListener('change', () => { K.setName(inp.value); });
    }).catch(() => {});
  }

  /* fresh device: no local data + a cloud save → restore it and reload once */
  async function restoreIfMissing() {
    if (!KEYS.every(k => !lsGet(k))) return;
    try { if (sessionStorage.getItem(SYNC + '_r') === '1') return; } catch (e) {}
    const K = await kit(); if (!K) return;
    let row = null;
    try { row = await K.loadCloud(GAME); } catch (e) {}
    if (!row || !row.data) return;
    let touched = false;
    KEYS.forEach(k => { if (!lsGet(k) && typeof row.data[k] === 'string' && row.data[k]) { lsSet(k, row.data[k]); touched = true; } });
    if (touched) {
      try { sessionStorage.setItem(SYNC + '_r', '1'); } catch (e) {}
      location.reload();
    }
  }

  function tick() { pushBlob(false); submitScores(); }

  window.addEventListener('load', () => { restoreIfMissing(); tick(); });
  window.addEventListener('pagehide', () => { pushBlob(true); submitScores(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pushBlob(true); submitScores(); } });
  setInterval(tick, 60000);

  function watchBoard() {
    const ov = document.querySelector(BOARD_SEL);
    if (!ov || !window.MutationObserver) return;
    new MutationObserver(() => {
      const shown = !ov.classList.contains('hidden') && ov.style.display !== 'none';
      if (shown) fillBoard();
    }).observe(ov, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchBoard); else watchBoard();
})();
