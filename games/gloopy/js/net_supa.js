'use strict';
/* =====================================================================
   SUPABASE RELAY SHIM (0.15) — js/net_supa.js
   Replaces the Cloudflare-Worker relay (worker/src/room_logic.js) with
   Supabase Realtime broadcast channels, so "Play together" needs NO
   server of your own. js/net.js keeps working unchanged: this file
   emulates the relay's WebSocket protocol.

   · js/net.js opens  new SupaRelaySocket(code)  when the server address
     is empty (default). A custom address still uses your own relay.
   · Every peer runs the relay "server" role for itself:
       - _meta heartbeats announce {uid, id, role, name, color, story}
       - the deterministic host (smallest uid) emits control messages
         (welcome / joined / left / need_world) the way the worker did
       - gameplay messages (pos/state/emote/chat/story/act/world) are
         fanned out to everyone; `to:`-addressed ones are filtered here
   · Identity comes from CloudKit (games/_shared/cloud.js); a random
     fallback uid keeps the shim working offline of the accounts layer.
   ===================================================================== */

const SUPA_URL = 'https://pjezfictphwwfogneqpw.supabase.co';
const SUPA_KEY = 'sb_publishable_GdsfxxR6cLYUIurwTURYcQ_bY4joz0t';

function supaUid() {
  try { const u = window.CloudKit && window.CloudKit.uid(); if (u) return 'u' + u.replace(/-/g, ''); } catch (e) {}
  try {
    let v = localStorage.getItem('gloopyRelayUid');
    if (!v) { v = 'r' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('gloopyRelayUid', v); }
    return v;
  } catch (e) { return 'r' + Math.random().toString(36).slice(2, 12); }
}
function supaIdOf(uid) { let h = 0; for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0; return (h % 899) + 1; }

class SupaRelaySocket {
  constructor(code) {
    this.readyState = 0;                      // 0 connecting · 1 open · 3 closed
    this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
    this._code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    // per-SOCKET identity: two tabs in one browser must be two separate players
    this._uid = supaUid() + '#' + Math.random().toString(36).slice(2, 8);
    this._id = supaIdOf(this._uid);
    this._topic = 'realtime:broadcast:gloopy-' + this._code;
    this._role = null; this._token = ''; this._my = null;
    this._peers = new Map();                  // uid → meta {uid,id,role,name,color,story,token,ts}
    this._welcomed = new Set();               // uids the host already welcomed
    this._metaTimer = null; this._hbTimer = null; this._openTimer = null;
    this._ref = 1;
    this._ws = null;
    this._connect();
  }

  /* ---------------- raw realtime connection ---------------- */
  _connect() {
    let ws;
    try {
      ws = new WebSocket(SUPA_URL.replace(/^https:/, 'wss:') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPA_KEY) + '&vsn=1.0.0');
    } catch (e) { this._closed(); return; }
    this._ws = ws;
    this._openTimer = setTimeout(() => { if (this.readyState === 0) { try { ws.close(); } catch (e) {} this._closed(); } }, 12000);
    ws.onopen = () => {
      this._raw({ topic: this._topic, event: 'phx_join', ref: String(this._ref++),
        payload: { config: { broadcast: { self: false }, presence: { key: this._uid } } } });
      this._hbTimer = setInterval(() => this._raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(this._ref++) }), 25000);
    };
    ws.onmessage = ev => { try { this._onRaw(JSON.parse(ev.data)); } catch (e) {} };
    ws.onclose = () => this._closed();
    ws.onerror = () => { /* onclose follows */ };
  }

  _raw(obj) { try { if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify(obj)); } catch (e) {} }

  _onRaw(m) {
    if (!m || typeof m !== 'object') return;
    if (m.event === 'phx_reply') {
      const ok = m.payload && m.payload.status === 'ok';
      if (ok && this.readyState === 0) {
        this.readyState = 1;
        if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
        if (this.onopen) this.onopen();
      }
      return;
    }
    if (m.event === 'broadcast' && m.payload && m.payload.event === 'msg') {
      const env = m.payload.payload;
      if (env && env.uid !== this._uid) this._onPeerMsg(env);
    }
  }

  _closed() {
    if (this._metaTimer) { clearInterval(this._metaTimer); this._metaTimer = null; }
    if (this._hbTimer) { clearInterval(this._hbTimer); this._hbTimer = null; }
    if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
    if (this.readyState !== 3) {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    }
  }

  /* ------------- WebSocket-emulation API for js/net.js ------------- */
  send(str) {
    if (this.readyState !== 1) return;
    let m; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello') { this._onHello(m); return; }
    // plain fan-out (pos/state/emote/chat/story/act/world)
    this._fan({ msg: m, from: this._id, uid: this._uid });
  }

  close() { try { this._ws && this._ws.close(1000, 'bye'); } catch (e) {} this._closed(); }

  /* ------------------------- relay logic ------------------------- */
  _meta() {
    return {
      uid: this._uid, id: this._id, role: this._role, token: this._token,
      name: (this._my && this._my.name) || '', color: (this._my && this._my.color) || '',
      story: (this._my && this._my.story) || null, ts: Date.now()
    };
  }

  _onHello(h) {
    this._role = h.role === 'host' ? 'host' : 'guest';
    this._token = h.token || '';
    this._my = { name: h.name, color: h.color, story: h.story };
    // announce myself right away, then heartbeat
    this._fan({ msg: { t: '_meta', meta: this._meta() }, from: this._id, uid: this._uid });
    if (this._metaTimer) clearInterval(this._metaTimer);
    this._metaTimer = setInterval(() => {
      if (this.readyState !== 1) return;
      this._fan({ msg: { t: '_meta', meta: this._meta() }, from: this._id, uid: this._uid });
      this._prune();
    }, 2500);
    if (this._role === 'host') {
      // short window to notice another live host with a different token
      setTimeout(() => {
        if (this.readyState !== 1 || this._role !== 'host') return;
        const clash = [...this._peers.values()].some(p => p.role === 'host' && p.token && p.token !== this._token);
        if (clash) { this._emit({ t: 'error', reason: 'room-taken' }); return; }
        this._emit({ t: 'welcome', id: this._id, hostId: this._id, max: 4, players: this._roster() });
        this._welcomed.add(this._uid);
      }, 2000);
    } else {
      // wait for a host; then the host's welcome arrives on its own
      setTimeout(() => {
        if (this.readyState !== 1 || this._role !== 'guest') return;
        if (!this._hasHost()) this._emit({ t: 'error', reason: 'no-host' });
      }, 4000);
    }
  }

  _hasHost() { return [...this._peers.values()].some(p => p.role === 'host' && Date.now() - p.ts < 11000); }

  _roster() {
    const list = [{ id: this._id, name: (this._my && this._my.name) || '', color: (this._my && this._my.color) || '', role: 'host', story: (this._my && this._my.story) || null }];
    for (const p of this._peers.values()) {
      if (Date.now() - p.ts > 11000) continue;
      list.push({ id: p.id, name: p.name, color: p.color, role: p.role === 'host' ? 'host' : 'guest', story: p.story || null });
    }
    return list.slice(0, 8);
  }

  _onPeerMsg(env) {
    const m = env.msg;
    if (!m || typeof m.t !== 'string') return;

    if (m.t === '_meta') {
      const meta = m.meta || {};
      if (!meta.uid) return;
      this._peers.set(meta.uid, Object.assign({}, meta, { ts: Date.now() }));
      if (meta.role === 'host') this._sawHost = true;
      // host duties: welcome the newcomer, tell everyone, ask for the world hand-shake
      if (this._role === 'host' && meta.role === 'guest' && !this._welcomed.has(meta.uid)) {
        this._welcomed.add(meta.uid);
        const joinedMsg = { t: 'joined', player: { id: meta.id, name: meta.name, color: meta.color, role: 'guest', story: meta.story || null } };
        // 1) the relay hands the newcomer its own welcome (addressed, so only it applies it)
        this._fan({ msg: { t: 'welcome', to: meta.id, id: meta.id, hostId: this._id, max: 4, players: this._roster() }, from: this._id, uid: this._uid });
        // 2) everyone (incl. the host itself) learns about the new guest
        this._fan({ msg: joinedMsg, from: this._id, uid: this._uid });
        this._emit(joinedMsg);
        // 3) host asks itself for the world snapshot for that guest (game replies with world)
        this._emit({ t: 'need_world', for: meta.id });
      }
      return;
    }

    // to-addressed messages (welcome/world) only reach their target
    if (typeof m.to === 'number' && m.to !== this._id) return;

    // deliver gameplay messages with the relay-style `from` field
    const out = Object.assign({}, m, { from: typeof env.from === 'number' ? env.from : supaIdOf(env.uid) });
    this._emit(out);
  }

  _prune() {
    if (this._role !== 'host') {
      // guests notice a vanished host
      if (this._sawHost && !this._hasHost() && this.readyState === 1) this._emit({ t: 'closed' });
    } else {
      for (const [uid, p] of this._peers) {
        if (Date.now() - p.ts > 11000) {
          this._peers.delete(uid);
          this._welcomed.delete(uid);
          const leftMsg = { t: 'left', id: p.id };
          this._fan({ msg: leftMsg, from: this._id, uid: this._uid });
          this._emit(leftMsg);
        }
      }
    }
  }

  _fan(payload) { this._raw({ topic: this._topic, event: 'broadcast', ref: null, payload: { event: 'msg', payload } }); }
  _emit(msg) { if (this.onmessage) this.onmessage({ data: JSON.stringify(msg) }); }
}
