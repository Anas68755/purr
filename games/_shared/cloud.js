/* ============================================================================
   PURR Cloud Kit v1 — one tiny Supabase client shared by every game on this site.

   · Identity: anonymous sign-in (Supabase GoTrue). One identity per browser,
     created silently on first use, refreshed automatically. No emails, no UI.
   · Leaderboards: CloudKit.submitScore() / CloudKit.topScores()
   · Cloud saves: CloudKit.saveCloud() / CloudKit.loadCloud()
   · Fail-soft by design: if the cloud is unreachable (offline, project paused,
     anonymous sign-ins disabled) every call resolves to null/[] and the games
     keep working exactly as before, from localStorage only.

   Plain fetch, zero dependencies. The publishable key below is PUBLIC by design;
   protection comes from Row Level Security on the server (see supabase_setup.sql).
   ============================================================================ */
(function () {
  'use strict';

  var URL = 'https://pjezfictphwwfogneqpw.supabase.co';
  var KEY = 'sb_publishable_GdsfxxR6cLYUIurwTURYcQ_bY4joz0t';

  var SESSION_KEY = 'purrCloudSession_v1';
  var NAME_KEY = 'purrPlayerName_v1';

  var session = null;          // { at, rt, exp, uid }
  var readyPromise = null;
  var lastSubmit = {};         // game → { score, t } (dedupe)

  /* ------------------------------------------------ tiny localStorage helpers */
  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  /* ------------------------------------------------------------------- fetch */
  function baseHeaders(tok) {
    var h = { 'apikey': KEY, 'Content-Type': 'application/json' };
    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
  }

  function raw(path, opts, tok) {
    opts = opts || {};
    opts.headers = Object.assign(baseHeaders(tok), opts.headers || {});
    return fetch(URL + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* empty body */ }
        if (!r.ok) {
          var err = new Error((j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status));
          err.status = r.status; err.body = j;
          throw err;
        }
        return j;
      });
    });
  }

  /* ---------------------------------------------------------------- session */
  function setSession(j) {
    session = {
      at: j.access_token,
      rt: j.refresh_token,
      exp: Date.now() + (((j.expires_in || 3600) - 60) * 1000),
      uid: (j.user && j.user.id) || (session && session.uid)
    };
    lsSet(SESSION_KEY, session);
  }

  function keepSession() { lsSet(SESSION_KEY, session); }

  async function refreshToken() {
    if (!session || !session.rt) throw new Error('no session');
    var j = await raw('/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: JSON.stringify({ refresh_token: session.rt }) });
    setSession(j);
  }

  /** Resolve once the browser has a cloud identity (or definitively doesn't). */
  function ensure() {
    if (!readyPromise) {
      readyPromise = (async function () {
        session = lsGet(SESSION_KEY);
        if (session && session.rt && (!session.at || Date.now() > session.exp)) {
          try { await refreshToken(); } catch (e) { session = null; keepSession(); }
        }
        if (!session || !session.rt) {
          try {
            var j = await raw('/auth/v1/signup', { method: 'POST', body: '{}' });
            setSession(j);
          } catch (e) {
            // anonymous sign-ins disabled, or project paused / offline → local-only mode
            session = null;
          }
        }
        return !!session;
      })();
    }
    return readyPromise;
  }

  /** Authenticated REST call; auto-refreshes once on 401; null when offline. */
  async function call(path, opts) {
    await ensure();
    if (!session) return null;
    try {
      return await raw(path, opts, session.at);
    } catch (e) {
      if (e.status === 401) {
        try {
          await refreshToken();
          return await raw(path, opts, session.at);
        } catch (e2) { return null; }
      }
      throw e;
    }
  }

  /* ------------------------------------------------------------------ names */
  function cleanName(s) {
    s = String(s == null ? '' : s).replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return s || '';
  }

  function playerName() {
    return cleanName(lsGet(NAME_KEY) || '');
  }

  /** Ask once for a display name (shared across all games), return a safe name. */
  function askName(fallback, question) {
    var n = playerName();
    if (!n && typeof window !== 'undefined' && typeof window.prompt === 'function') {
      try {
        var typed = window.prompt(question || 'Enter your leaderboard name (max 16 characters):', fallback || 'Player');
        n = cleanName(typed);
        if (n) lsSet(NAME_KEY, n);
      } catch (e) { /* prompt blocked */ }
    }
    return n || cleanName(fallback) || 'Player';
  }

  function setName(n) { n = cleanName(n); if (n) lsSet(NAME_KEY, n); return n; }

  /* ----------------------------------------------------------- leaderboards */
  /** Submit a score. Resolves {ok:true, id?} or {ok:false, error} — never throws. */
  async function submitScore(game, player, score, meta) {
    score = Math.max(0, Math.min(999999999, Math.floor(Number(score) || 0)));
    var dedupeKey = String(game);
    var now = Date.now();
    if (lastSubmit[dedupeKey] && lastSubmit[dedupeKey].score === score && now - lastSubmit[dedupeKey].t < 20000) {
      return { ok: true, deduped: true };
    }
    try {
      var j = await call('/rest/v1/scores', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          game: String(game).slice(0, 40),
          player: cleanName(player) || 'Player',
          score: score,
          meta: (meta && typeof meta === 'object') ? meta : {}
        })
      });
      lastSubmit[dedupeKey] = { score: score, t: now };
      return { ok: true, id: j && j[0] && j[0].id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /** Top N for one game: [{ player, score, meta, created_at }] or []. */
  async function topScores(game, limit) {
    try {
      var j = await call('/rest/v1/scores?select=player,score,meta,created_at&game=eq.' +
        encodeURIComponent(game) + '&order=score.desc,created_at.asc&limit=' + (limit || 10));
      return Array.isArray(j) ? j : [];
    } catch (e) {
      return [];
    }
  }

  /** How many stored runs beat this score (0 = you are #1). null when offline. */
  async function betterCount(game, score) {
    try {
      var j = await call('/rest/v1/scores?select=score&game=eq.' +
        encodeURIComponent(game) + '&score=gt.' + Math.floor(Number(score) || 0) + '&limit=1000');
      return Array.isArray(j) ? j.length : null;
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------ cloud saves */
  /** Push a JSON-able save. Resolves true/false. */
  async function saveCloud(game, data, slot) {
    await ensure();
    if (!session) return false;
    try {
      await call('/rest/v1/saves?on_conflict=user_id,game,slot', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: session.uid,
          game: String(game).slice(0, 40),
          slot: String(slot || 'main').slice(0, 20),
          data: data,
          updated_at: new Date().toISOString()
        })
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Load a save: { data, updated_at } or null. */
  async function loadCloud(game, slot) {
    await ensure();
    if (!session) return null;
    try {
      var j = await call('/rest/v1/saves?select=data,updated_at&user_id=eq.' + session.uid +
        '&game=eq.' + encodeURIComponent(game) + '&slot=eq.' + encodeURIComponent(slot || 'main') + '&limit=1');
      return (Array.isArray(j) && j[0]) ? j[0] : null;
    } catch (e) {
      return null;
    }
  }

  /** Delete a save (e.g. after a reset so the cloud does not resurrect it). */
  async function deleteCloud(game, slot) {
    await ensure();
    if (!session) return false;
    try {
      await call('/rest/v1/saves?user_id=eq.' + session.uid +
        '&game=eq.' + encodeURIComponent(game) + '&slot=eq.' + encodeURIComponent(slot || 'main'),
        { method: 'DELETE' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ export */
  window.CloudKit = {
    /** true once the browser holds a working cloud identity (call after ready()). */
    ready: ensure,
    online: function () { return !!session; },
    uid: function () { return session ? session.uid : null; },
    name: playerName,
    askName: askName,
    setName: setName,
    submitScore: submitScore,
    topScores: topScores,
    betterCount: betterCount,
    saveCloud: saveCloud,
    loadCloud: loadCloud,
    deleteCloud: deleteCloud,
    /** Render "name …… score" rows into a container; shared look for every game. */
    renderBoard: function (el, rows, format) {
      if (!el) return;
      if (!rows.length) { el.innerHTML = '<div style="opacity:.6">No cloud scores yet — be the first!</div>'; return; }
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var label = format ? format(r) : r.player;
        html += '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0">' +
          '<span style="opacity:.75">' + (i + 1) + '. ' + escapeHtml(label) + '</span>' +
          '<b>' + escapeHtml(String(r.score)) + '</b></div>';
      }
      el.innerHTML = html;
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
