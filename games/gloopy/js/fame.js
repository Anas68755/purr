'use strict';
/* =====================================================================
   RANCH FAME (0.17) — js/fame.js
   Global leaderboard for Gloopy Meadow, powered by the shared PURR
   Cloud Kit (games/_shared/cloud.js → the `scores` table).
   The score is lifetime money earned (profile.stats.moneyEarned):
   it only ever goes up, so re-sending is safe and deduped client-side.
   Fails soft: with no cloud the screen just says so and nothing breaks.
   ===================================================================== */
(function () {
  const GAME = 'gloopy';
  const kit = () => (typeof window.CloudKit === 'undefined' ? null : window.CloudKit);

  let lastSent = -1, lastTry = 0, lastFail = '';

  function myScore() { return (typeof getStat === 'function' ? getStat('moneyEarned') : 0) | 0; }
  function myName() { return (profile.settings.playerName || '').trim().slice(0, 16) || 'Rancher'; }

  async function submit(force) {
    const K = kit();
    if (!K || !K.online()) { lastFail = 'cloud offline'; return false; }
    const s = myScore();
    if (s <= 0) { lastFail = 'lifetime earnings are $0 — earn some money first'; return false; }
    if (!force && s <= lastSent) { lastFail = 'this score was already uploaded'; return false; }
    const now = Date.now();
    if (!force && now - lastTry < 60000) { lastFail = 'auto-upload runs at most once a minute'; return false; }
    lastTry = now;
    const meta = {
      day: getStat('bestDay') | 0,
      charm: getStat('maxCharm') | 0,
      codex: (typeof codexDonePieces === 'function') ? codexDonePieces() : 0
    };
    const r = await K.submitScore(GAME, myName(), s, meta);
    if (r && r.ok) { lastSent = Math.max(lastSent, s); lastFail = ''; return true; }
    lastFail = (r && r.error) ? ('server said: ' + r.error) : 'the server did not accept the upload';
    return false;
  }

  /* 1/s from metaTick: upload new earnings at most once a minute. */
  function fameTick() { const now = Date.now(); if (now - lastTry >= 60000) submit(false); }

  async function loadBoard(el) {
    if (!el) return;
    const K = kit();
    if (!K) { el.innerHTML = '<small>Cloud not loaded — check your connection.</small>'; return; }
    await K.ready();
    if (!K.online()) { el.innerHTML = '<small>Cloud offline — the board will be back when the connection is.</small>'; return; }
    const rows = await K.topScores(GAME, 10);
    K.renderBoard(el, rows, r => {
      const m = r.meta || {}, bits = [];
      if (m.day) bits.push('day ' + m.day);
      if (m.codex) bits.push('codex ' + m.codex);
      return (r.player || 'Rancher') + (bits.length ? '  ·  ' + bits.join(' · ') : '');
    });
  }

  /* ---------------- the screen (SCREENS lives in js/menus.js) ---------------- */
  if (typeof SCREENS !== 'undefined') {
    SCREENS.fame = {
      title: () => '🏆 Ranch Fame',
      html: () => {
        const K = kit(), online = !!(K && K.online());
        let h = `<div class="summary">💰 <b>$${myScore()}</b> lifetime earnings<small>The board ranks total money earned. It uploads while you play${online ? '' : ' — cloud offline right now'}.</small></div>`;
        h += `<div class="ssec">Your name</div>
          <input class="netinp" id="fameName" maxlength="16" placeholder="Rancher" aria-label="Leaderboard name" value="${esc(profile.settings.playerName || '')}">
          <p class="note">Shown on the board. The same name is used when you play together.</p>`;
        h += `<div id="fameBoard" class="mlist"><small>…</small></div>`;
        h += `<div class="mlist">${btn('famesend', '☁️ Send my score now', '', online ? 'primary' : 'disabled')}</div>`;
        return h;
      },
      after: () => {
        const el = document.getElementById('fameBoard');
        if (el) loadBoard(el);
        /* opportunistic upload when the screen opens (respects the throttle) */
        submit(false).then(ok => { if (ok && el) loadBoard(el); });
      }
    };
  }

  /* buttons + the name field (menus.js ignores actions it does not know) */
  const mb = document.getElementById('mBody');
  if (mb) {
    mb.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.dataset.act !== 'famesend') return;
      Sound.play('click');
      submit(true).then(ok => {
        if (ok) {
          const el = document.getElementById('fameBoard');
          if (el) loadBoard(el);                       /* show yourself on the board right away */
          showAlert('☁️ Score sent to the board', 2200);
        } else {
          const online = !!(kit() && kit().online());
          const msg = !online ? 'Cloud offline — try later'
            : (lastFail || 'could not send — try again');
          showAlert('⚠️ ' + msg, 2800);
        }
      });
    });
    mb.addEventListener('change', e => {
      if (!e.target || e.target.id !== 'fameName') return;
      profile.settings.playerName = netClean(e.target.value, 16);
      saveProfile();
    });
  }

  window.CloudFame = { tick: fameTick, submitNow: () => submit(true), name: myName };
})();
