'use strict';
/* ============================================================
   VOID BREAKER — cloud glue (v5.4 HORIZON)
   Leaderboard + cloud save through the shared PURR Cloud Kit
   (games/_shared/cloud.js). Zero changes to game code: reads and
   writes only the game's own localStorage keys, submits new local
   top-5 runs to the global board, mirrors the vault / bests /
   local board / achievements to the cloud, and appends the global
   top 5 under the local "TOP SORTIES" list on the game-over
   screen. Everything fails soft offline.
   ============================================================ */
(function () {
  const GAME = 'voidbreaker';
  const SYNC = 'vbCloudSync_v1';
  const KEYS = ['vb_omega_vault', 'vb_ascension_best', 'vb_ascension_best_rush', 'vb_ascension_board', 'vb_ascension_achv'];
  const BOARD_KEY = 'vb_ascension_board';
  const BOARD_SEL = '#gameOverScreen';

  let lastBlobStr = '';
  let submitted = {};                       // run signature → true
  try { submitted = JSON.parse(localStorage.getItem(SYNC + '_sent') || '{}') || {}; } catch (e) {}

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

  /* submit local top-5 runs that have not been sent yet */
  function submitRuns() {
    kit().then(K => {
      if (!K) return;
      let runs = [];
      try { runs = JSON.parse(lsGet(BOARD_KEY) || '[]') || []; } catch (e) {}
      if (!Array.isArray(runs)) return;
      let dirty = false;
      for (const r of runs.slice(0, 5)) {
        if (!r || typeof r.s !== 'number' || r.s <= 0) continue;
        const sig = [r.s, r.w, r.k, r.m].join('|');
        if (submitted[sig]) continue;
        submitted[sig] = true; dirty = true;
        K.submitScore(GAME, K.name() || 'Player', Math.floor(r.s), {
          wave: r.w | 0, kills: r.k | 0, mode: r.m || 'classic'
        }).then(res => { if (!(res && res.ok)) submitted[sig] = false; }).catch(() => { submitted[sig] = false; });
      }
      if (dirty) { try { lsSet(SYNC + '_sent', JSON.stringify(submitted)); } catch (e) {} }
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
      let html = '<div class="lb-title">☁ GLOBAL TOP 5</div>';
      html += '<div style="opacity:.7;font-size:11px;margin:0 0 4px">callsign <input id="cloudName" maxlength="16" value="' + me +
        '" style="width:110px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:6px;color:inherit;padding:0 6px;font:inherit"></div>';
      if (!rows.length) html += '<div style="opacity:.6">No cloud sorties yet — fly one!</div>';
      rows.forEach((r, i) => {
        const m = r.meta || {};
        html += '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span style="opacity:.85">' + (i + 1) + '. ' +
          String(r.player || 'Player').replace(/[<>&]/g, '') +
          (m.wave ? ' <small style="opacity:.6">w' + m.wave + '</small>' : '') +
          (m.mode && m.mode !== 'classic' ? ' <small style="opacity:.6">' + String(m.mode).replace(/[<>&]/g, '') + '</small>' : '') +
          '</span><b>' + r.score + '</b></div>';
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

  function tick() { pushBlob(false); submitRuns(); }

  window.addEventListener('load', () => { restoreIfMissing(); tick(); });
  window.addEventListener('pagehide', () => { pushBlob(true); submitRuns(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pushBlob(true); submitRuns(); } });
  setInterval(tick, 60000);

  function watchBoard() {
    const ov = document.querySelector(BOARD_SEL);
    if (!ov || !window.MutationObserver) return;
    new MutationObserver(() => {
      const shown = !ov.classList.contains('hidden') && ov.style.display !== 'none';
      if (shown) { submitRuns(); fillBoard(); }
    }).observe(ov, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchBoard); else watchBoard();
})();
