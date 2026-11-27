'use strict';
/* =====================================================================
   PLAY TOGETHER (0.15) — visit a friend's ranch.
   · One player HOSTS (the ranch owner; their game is the truth), up to 3 friends JOIN with a 5-letter code. Max 4 players.
   · A tiny relay (worker/ — Cloudflare Worker + Durable Object) only forwards JSON messages; see worker/src/room_logic.js.
   · Host → guests: `world` once (seed, decor, plots, … + a first snapshot), then `state` snapshots 5×/s (slimes, items, Jumbos, critters,
     time, weather) and a slower "extras" block every 5 s (names, crops, decor, chests…).  Everybody → everybody: `pos` 10×/s, `emote`, `chat`, `story`.
     Guest → host: `act` (pet a slime).  The host checks every action (distance, rate).
   · A guest runs in VISITOR MODE (game.visitor): the world is rebuilt from the host's seed, the guest's own ranch is NOT touched
     (saveGame() does nothing while visiting) and is loaded again when they leave.  Visitors walk, jump, pet slimes, chat and emote.
   · Every player keeps their own story; the chapter is shown next to their name.
   ===================================================================== */
const NET_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // same alphabet as the relay's route check (no I, O, 0, 1)
const NET_CODE_RX = /^[A-HJ-NP-Z2-9]{5}$/;
const NET_EMOTES = ['❤️', '😄', '👋', '⭐', '😮', '🎉'];
const NET_PHRASES = ['Hello!', 'Nice ranch!', 'Look at this slime!', 'Follow me!', 'Thank you!', 'Bye!'];
const NET_COLORS = ['#ff8fb3', '#7fd8ff', '#ffd54a', '#9be37a', '#c59bff', '#ffa050'];
const NET_MAX_JSON = 58000;                                        // the relay drops messages above 60 KB
const NET_ERRORS = {
  'bad-hello': 'The server did not understand the connection. Check the server address.',
  'bad-token': 'Could not open the room. Please try again.',
  'room-taken': 'This room code is already in use. Please try again.',
  'no-host': 'No open ranch has that code. Check the code, or ask your friend to host first.',
  'full': 'This ranch is full (4 players).',
  'host-left': 'The host closed the ranch.',
  'lost': 'The connection was lost.',
  'timeout': 'Could not reach the server. Check the server address and your internet.',
  'bad-url': 'Type the server address first (see the setup guide).',
  'bad-code': 'The room code has 5 letters or digits.',
  'need-ranch': 'Load your ranch first (Continue or New game), then host it from the pause menu.',
  'busy': 'You are already connected.'
};

const NET = {
  status: 'off',            // off · connecting · host · guest
  role: null, code: '', id: 0, hostId: 0, max: 4, token: '', err: '', cameFrom: 'ranch',
  players: new Map(),       // id → { id, name, color, role, story, x, y, tx, ty, z, tz, aim, moving, walkT, facing, seen, emote, emoteT, say, sayT }
  chat: [],                 // last lines: { name, color, text }
  ws: null, make: url => url.indexOf('supabase:') === 0 ? new SupaRelaySocket(url.slice(9)) : new WebSocket(url),
  posT: 0, stateT: 0, extraT: 0, storyT: 0, seq: 0, namedMax: 0, lastStory: '', chatCd: 0, tries: 0, timer: null, rt: null,
  dl: 240, wt: null, myEmote: null, myEmoteT: 0, hint: 0, tideT: 0
};
const netActive = () => NET.status === 'host' || NET.status === 'guest';
const netBusy = () => NET.status !== 'off';
const netOthers = () => { let n = 0; for (const p of NET.players.values()) if (p.id !== NET.id) n++; return n; };
const nf = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const nr = v => Math.round(nf(v)), nr1 = v => Math.round(nf(v) * 10) / 10;
const netClean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const netMyName = () => netClean(profile.settings.playerName, 14) || 'Rancher';
function netMyColor() {
  let i = profile.settings.playerColor;
  if (!(i >= 0 && i < NET_COLORS.length)) { i = Math.floor(Math.random() * NET_COLORS.length); profile.settings.playerColor = i; }
  return NET_COLORS[i];
}
function netNormUrl(u) {
  u = String(u || '').trim().replace(/\s+/g, '');
  if (!u) return '';
  u = u.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  if (!/^wss?:\/\//i.test(u)) u = 'wss://' + u;
  u = u.replace(/\/+$/, '').replace(/\/room\/[A-Za-z0-9]*$/, '').replace(/\/health$/, '').replace(/\/+$/, '');
  return /^wss?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(u) ? u : '';
}
const netNormCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function netRandomCode() { let s = ''; for (let i = 0; i < 5; i++) s += NET_CODE_CHARS[Math.floor(Math.random() * NET_CODE_CHARS.length)]; return s; }
function netRandomToken() {
  const a = new Uint8Array(18);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  return Array.from(a, b => (b % 36).toString(36)).join('');
}
function netSetVisitClass(on) { try { if (document.body && document.body.classList) document.body.classList.toggle('visiting', !!on); const b = document.getElementById('visitBar'); if (b) b.textContent = on ? '🏡 ' + 'Visiting' + ' ' + ((NET.players.get(NET.hostId) || {}).name || '') : ''; } catch (e) { /* no DOM */ } }
const netErrText = r => NET_ERRORS[r] || 'Something went wrong with the connection.';

/* ---------------- my story, as shown to the others ---------------- */
function netStoryRaw() {
  if ((game.state === 'menu' || !game.story) && !game.visitor) { try { const d = readSave(); if (d && d.story) return d.story; } catch (e) { /* no save */ } }
  return game.story || null;
}
function netMyStory() {
  const st = netStoryRaw() || { ch: 0, step: 0, done: false };
  const total = STORY.length;
  return { ch: Math.max(0, Math.min(total, st.ch | 0)), step: Math.max(0, st.step | 0), done: !!st.done || (st.ch | 0) >= total, total };
}
const netStoryLabel = s => `📖 ${s && s.done ? (s.total || 9) : Math.min((s && s.total) || 9, ((s && s.ch) | 0) + 1)}/${(s && s.total) || 9}`;

/* ---------------- connection ---------------- */
function netSend(obj) {
  const ws = NET.ws; if (!ws || ws.readyState !== 1) return false;
  const s = JSON.stringify(obj); if (s.length > NET_MAX_JSON) return false;
  try { ws.send(s); return true; } catch (e) { return false; }
}
function netStatusChanged() {
  const cur = typeof currentScreen === 'function' ? currentScreen() : null;
  if (cur && cur.name === 'together') netRefreshScreen();
}
function netFail(reason, keepSession) {
  NET.err = reason;
  const wasVisitor = game.visitor;
  netClose();
  if (wasVisitor) netRestoreOwn(false);
  if (typeof showAlert === 'function') showAlert('🌐 ' + netErrText(reason), 3600);
  netStatusChanged();
}
function netClose() {
  const ws = NET.ws; NET.ws = null;
  if (NET.timer) { clearTimeout(NET.timer); NET.timer = null; } if (NET.rt) { clearTimeout(NET.rt); NET.rt = null; }
  if (ws) { try { ws.close(1000, 'bye'); } catch (e) { /* closed */ } }
  NET.status = 'off'; NET.role = null; NET.id = 0; NET.hostId = 0; NET.players.clear(); NET.chat.length = 0; NET.wt = null; NET.tries = 0;
  NET.myEmote = null; NET.namedMax = 0; NET.lastStory = ''; netSetVisitClass(false);
}
function netConnect(role, code) {
  const base = netNormUrl(profile.settings.netUrl);
  // Empty address = built-in Supabase cloud relay (no server needed). A custom address uses your own relay worker.
  const cloudRelay = !base && typeof SupaRelaySocket === 'function';
  if (!base && !cloudRelay) { NET.err = 'bad-url'; netStatusChanged(); return false; }
  if (!NET_CODE_RX.test(code)) { NET.err = 'bad-code'; netStatusChanged(); return false; }
  NET.err = ''; NET.status = 'connecting'; NET.role = role; NET.code = code;
  let ws;
  try { ws = NET.make(base ? `${base}/room/${code}` : `supabase:${code}`); } catch (e) { netFail('timeout'); return false; }
  NET.ws = ws;
  ws.onopen = () => {
    if (NET.ws !== ws) return;
    netSend({ t: 'hello', role, token: role === 'host' ? NET.token : undefined, name: netMyName(), color: netMyColor(), story: netMyStory() });
  };
  ws.onmessage = e => { if (NET.ws === ws) netOnMessage(e.data); };
  ws.onclose = () => { if (NET.ws === ws) netOnClose(); };
  ws.onerror = () => { /* onclose follows */ };
  NET.timer = setTimeout(() => { if (NET.ws === ws && NET.status === 'connecting') netFail('timeout'); }, 12000);
  netStatusChanged();
  return true;
}
function netHost() {
  if (netBusy()) { NET.err = 'busy'; return false; }
  if (!game.player || game.visitor || game.state === 'menu') { NET.err = 'need-ranch'; netStatusChanged(); return false; }
  NET.token = netRandomToken(); NET.tries = 0;
  return netConnect('host', netRandomCode());
}
function netJoin(code) {
  if (netBusy()) { NET.err = 'busy'; return false; }
  code = netNormCode(code);
  NET.cameFrom = game.state === 'menu' ? 'title' : 'ranch';
  if (NET.cameFrom === 'ranch') saveGame();                           // your ranch is saved first; it is loaded again when you leave
  return netConnect('guest', code);
}
// leave the session. A guest goes back to their own ranch (or the title screen).
function netLeave(msg, toTitle) {
  const wasVisitor = game.visitor;
  netClose(); NET.err = msg || '';
  if (wasVisitor) netRestoreOwn(!!toTitle);
  if (msg && typeof showAlert === 'function') showAlert('🌐 ' + netErrText(msg), 3200);
  netStatusChanged();
}
function netRestoreOwn(toTitle) {
  game.visitor = false; game.hostSurv = false;
  if (typeof Sound !== 'undefined') Sound.setLoop('rain', false);
  if (!toTitle && NET.cameFrom !== 'title' && loadGame()) {
    if (typeof closeModal === 'function') closeModal();
    game.state = 'playing'; if (typeof lastTime !== 'undefined') lastTime = performance.now();
  } else {
    if (typeof closeModal === 'function') closeModal();
    showMainMenu();
  }
}
function netOnClose() {
  const was = NET.status, role = NET.role;
  if (was === 'off') return;
  NET.ws = null;
  if (role === 'host' && (was === 'host' || (was === 'connecting' && NET.tries > 0)) && NET.tries < 3) {     // the host tries to reopen the same ranch code
    NET.tries++; const code = NET.code, tries = NET.tries;
    NET.status = 'connecting'; NET.players.clear(); netStatusChanged();
    if (NET.timer) { clearTimeout(NET.timer); NET.timer = null; }
    NET.rt = setTimeout(() => { NET.rt = null; if (NET.status === 'connecting') netConnect('host', code); }, 1500 * tries);
    return;
  }
  netFail(was === 'connecting' ? 'timeout' : 'lost');
}

/* ---------------- incoming messages ---------------- */
function netOnMessage(raw) {
  if (typeof raw !== 'string' || raw.length > 400000) return;
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  try { netHandle(m); } catch (e) { console.error('net message', m.t, e); }
}
function netPlayer(info) {
  const old = NET.players.get(info.id) || {};
  const p = Object.assign({ x: 0, y: 0, tx: 0, ty: 0, z: 0, tz: 0, aim: 0, moving: false, walkT: 0, facing: 1, seen: false, emote: '', emoteT: 0, say: '', sayT: 0, lastAct: 0 }, old, {
    id: info.id | 0, name: netClean(info.name, 14) || 'Guest', color: /^#[0-9a-fA-F]{6}$/.test(info.color) ? info.color : '#ffcc66', role: info.role === 'host' ? 'host' : 'guest',
    story: info.story || old.story || { ch: 0, step: 0, done: false, total: 9 }
  });
  NET.players.set(p.id, p); return p;
}
function netHandle(m) {
  switch (m.t) {
    case 'welcome': {
      if (NET.status !== 'connecting') return;
      if (NET.timer) { clearTimeout(NET.timer); NET.timer = null; }
      NET.id = m.id | 0; NET.hostId = m.hostId | 0; NET.max = m.max | 0 || 4; NET.players.clear();
      for (const info of (m.players || []).slice(0, 8)) netPlayer(info);
      if (NET.role === 'host') {
        NET.status = 'host'; NET.namedMax = 0; NET.extraT = 0; NET.stateT = 0; NET.lastStory = JSON.stringify(netMyStory());
        if (NET.tries === 0) showToast('🌐', 'Your ranch is open!', 'Share the code with your friends: ' + NET.code);
        else showAlert('🌐 Back online. Friends can join again with the same code.', 2600);
        NET.tries = 0;
      }
      netStatusChanged(); break;
    }
    case 'joined': { const p = netPlayer(m.player || {}); showToast('🙂', 'A friend joined!', p.name + ' — say hello with an emote!'); netStatusChanged(); break; }
    case 'left': { const p = NET.players.get(m.id | 0); NET.players.delete(m.id | 0); if (p) showAlert('👋 ' + p.name + ' left the ranch', 2200); netStatusChanged(); break; }
    case 'closed': if (NET.role === 'guest') netLeave('host-left'); break;
    case 'error': {
      const r = String(m.reason || '');
      if (r === 'room-taken' && NET.role === 'host' && NET.tries < 3 && NET.status === 'connecting') { const code = netRandomCode(); NET.tries++; try { NET.ws && NET.ws.close(); } catch (e) { /* */ } NET.ws = null; netConnect('host', code); return; }
      netFail(r); break;
    }
    case 'need_world': if (NET.status === 'host') netSend({ t: 'world', to: m.for | 0, data: Object.assign(netWorldData(), { snap: netSnapshot(true) }) }); break;
    case 'world': if (NET.role === 'guest' && m.from === NET.hostId && m.data && !game.visitor) netEnterVisit(m.data); break;
    case 'state': if (game.visitor && m.from === NET.hostId) netApplySnap(m); break;
    case 'pos': { const p = NET.players.get(m.from | 0); if (!p || p.id === NET.id) return; netApplyPos(p, m); break; }
    case 'emote': { const p = NET.players.get(m.from | 0); if (p && NET_EMOTES.includes(m.e)) { p.emote = m.e; p.emoteT = 3; } break; }
    case 'chat': { const p = NET.players.get(m.from | 0); const text = netClean(m.text, 120); if (p && text) netAddChat(p, text); break; }
    case 'story': { const p = NET.players.get(m.from | 0); if (p && m.story) { p.story = { ch: nf(m.story.ch) | 0, step: nf(m.story.step) | 0, done: !!m.story.done, total: nf(m.story.total, 9) | 0 || 9 }; netStatusChanged(); } break; }
    case 'act': if (NET.status === 'host') netHostAct(m); break;
  }
}
function netApplyPos(p, m) {
  p.tx = Math.max(0, Math.min(WORLD_W * TILE, nf(m.x))); p.ty = Math.max(0, Math.min(WORLD_H * TILE, nf(m.y))); p.tz = Math.max(0, Math.min(400, nf(m.z)));
  p.aim = nf(m.a); p.moving = !!m.m; p.facing = m.f < 0 ? -1 : 1;
  if (!p.seen) { p.seen = true; p.x = p.tx; p.y = p.ty; p.z = p.tz; }
}
function netAddChat(p, text) {
  NET.chat.push({ name: p.name, color: p.color, text }); if (NET.chat.length > 6) NET.chat.shift();
  p.say = text; p.sayT = 6; netStatusChanged();
}

/* ---------------- sending: me ---------------- */
function netSendPos() {
  const p = game.player; if (!p) return;
  netSend({ t: 'pos', x: nr(p.x), y: nr(p.y), z: nr(p.z), a: Math.round(p.aim * 100) / 100, m: p.moving ? 1 : 0, f: p.facing < 0 ? -1 : 1 });
}
function netEmote(e) {
  if (!netActive() || !NET_EMOTES.includes(e)) return false;
  NET.myEmote = e; NET.myEmoteT = 3; netSend({ t: 'emote', e }); return true;
}
function netSay(text) {
  text = netClean(text, 120); if (!text || !netActive() || NET.chatCd > 0) return false;
  NET.chatCd = 0.8;
  const me = NET.players.get(NET.id) || { name: netMyName(), color: netMyColor() };
  me.say = text; me.sayT = 6; NET.chat.push({ name: me.name, color: me.color, text }); if (NET.chat.length > 6) NET.chat.shift();
  netSend({ t: 'chat', text }); netStatusChanged(); return true;
}

/* ---------------- the host's world + snapshots ---------------- */
function netSlimeFlags(s) { return (s.moving ? 1 : 0) | (s.facing < 0 ? 2 : 0) | (s.fly > 0 ? 4 : 0) | (s.eatTimer > 0 ? 8 : 0) | (s.petT > 0 ? 16 : 0) | (s.sucked > 0 || s.scared > 0 ? 32 : 0); }
const netNameRow = s => [s.nid, s.name, s.trait, s.shiny ? 1 : 0, isBaby(s) ? 1 : 0, nr(s.growT || 0), s.likes];
function netWorldData() {                                          // everything slow-changing about the ranch (sent once, then every ~5 s)
  const p = game.player;
  return {
    v: 1, seed: worldSeed, surv: game.surv ? 1 : 0, hp: [nr(p.x), nr(p.y)],
    broken: game.surv ? game.surv.broken.slice(0, 500) : [], nodeCd: game.surv && game.nodes ? game.nodes.map(n => nr(n.cd)) : [],
    decor: game.decor.slice(0, 600).map(d => [d.type, nr(d.x), nr(d.y)]),
    plots: game.plots.map(pl => pl.crop ? [pl.crop, nr(pl.t), pl.wet ? 1 : 0] : 0),
    corrals: game.corrals.map(c => [c.owned ? 1 : 0, c.size | 0, c.fence || 'wood']),
    chests: game.chests.map(c => c.open ? 1 : 0), orbs: game.orbs.map(o => o.taken ? 1 : 0),
    spots: game.spots.slice(0, 120).map(s => [nr(s.x), nr(s.y), s.tide ? 1 : s.aurora ? 2 : 0]),
    eggs: game.eggs.slice(0, 40).map(e => [e.type, nr(e.x), nr(e.y), nr1(e.t)]),
    names: game.slimes.map(netNameRow)
  };
}
function netSnapshot(all) {                                         // fast-changing things, compact arrays
  const w = game.weather, m = {
    t: 'state', q: ++NET.seq, tm: Math.round(game.time * 10000) / 10000, d: game.day, dl: DAY_LENGTHS[profile.settings.dayLen],
    wr: w.raining ? 1 : 0, wk: w.kind, wi: Math.round(w.intensity * 100) / 100,
    s: game.slimes.map(s => [s.nid, s.type, nr(s.x), nr(s.y), nr1(s.z), nr(s.joy), netSlimeFlags(s)]),
    f: game.foods.map(f => [f.type, nr(f.x), nr(f.y), nr(f.z || 0)]),
    p: game.plorts.map(f => [f.type, nr(f.x), nr(f.y), nr(f.z || 0)]),
    tr: game.treasures.map(f => [f.type, nr(f.x), nr(f.y), nr(f.z || 0)]),
    j: game.jumbos.map(j => [j.id, j.state, j.fed | 0, j.goal | 0]),
    c: game.surv && game.critters ? game.critters.map(c => [c.id, c.kind, nr(c.x), nr(c.y), nr(c.hp), c.state === 'chase' ? 1 : 0]) : []
  };
  const fresh = game.slimes.filter(s => s.nid > NET.namedMax);
  if (fresh.length) m.nn = fresh.map(netNameRow);
  if (game.slimes.length) NET.namedMax = Math.max(NET.namedMax, ...game.slimes.map(s => s.nid));
  return m;
}
function netSendState(extras) {
  const m = netSnapshot();
  if (extras) m.x = netWorldData();
  if (!netSend(m)) { delete m.x; delete m.nn; netSend(m); }          // too big? at least the live part still goes out
}
// the host validates what a guest asks for
function netHostAct(m) {
  const g = NET.players.get(m.from | 0); if (!g || g.role === 'host') return;
  const now = performance.now();
  if (now - g.lastAct < 350) return; g.lastAct = now;
  if (m.a === 'pet') {
    const s = game.slimes.find(x => x.nid === (m.n | 0)); if (!s || s.fly > 0) return;
    if (dist(g.tx, g.ty, s.x, s.y) > 150) return;
    petSlime(s, { x: g.tx, y: g.ty });
  }
}

/* ---------------- guest: enter visitor mode and apply what the host sends ---------------- */
function netEnterVisit(data) {
  const story = upgradeStory(netStoryRaw());
  resetGame(nf(data.seed, 1) | 0);
  game.visitor = true; game.hostSurv = !!data.surv; game.story = story; game.slimes = []; game.foods = []; game.plorts = []; game.treasures = []; game.spots = []; game.decor = []; game.eggs = [];
  NET.dl = DAY_LENGTHS[1]; NET.tideT = 0; NET.hint = 0;
  if (data.snap) netApplySnap(data.snap);
  netApplyWorld(data);
  const hp = Array.isArray(data.hp) ? data.hp : [19.5 * TILE, 43.5 * TILE];
  const sp = findFreeSpot(nf(hp[0], 700) + 40, nf(hp[1], 1500) + 10);
  game.player = createPlayer(sp.x, sp.y); game.camera.x = sp.x; game.camera.y = sp.y;
  NET.status = 'guest'; netSetVisitClass(true);
  if (game.state === 'menu') { const mn = $('#menu'); if (mn) mn.style.display = 'none'; Sound.unlock(); Sound.startMusic(); }
  if (typeof closeModal === 'function') closeModal();
  game.state = 'playing'; if (typeof lastTime !== 'undefined') lastTime = performance.now();
  showToast('🏡', 'Visiting ' + ((NET.players.get(NET.hostId) || {}).name || ''), 'Pet slimes, chat and emote. Your own ranch stays safe.');
  netSendPos(); netStatusChanged();
}
function netApplyWorld(d) {
  if (!d || typeof d !== 'object') return;
  const arr = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
  game.decor = arr(d.decor, 600).filter(a => Array.isArray(a) && DECOR_ITEMS[a[0]]).map(a => ({ type: a[0], x: nf(a[1]), y: nf(a[2]) }));
  arr(d.plots, 400).forEach((a, i) => { const pl = game.plots[i]; if (!pl) return; if (Array.isArray(a) && CROPS[a[0]]) { pl.crop = a[0]; pl.t = nf(a[1]); pl.wet = !!a[2]; } else { pl.crop = null; pl.t = 0; pl.wet = false; } });
  let tilesChanged = false;
  arr(d.corrals, 40).forEach((a, i) => { const c = game.corrals[i]; if (!c || !Array.isArray(a)) return; const o = !!a[0] || i === 0, sz = Math.max(0, Math.min(CORRAL_SIZES.length - 1, a[1] | 0)); if (c.owned !== o || c.size !== sz) { c.owned = o; c.size = sz; tilesChanged = true; } c.fence = String(a[2] || 'wood').slice(0, 12); });
  if (tilesChanged) applyCorralTiles();
  arr(d.chests, 80).forEach((o, i) => { if (game.chests[i]) game.chests[i].open = !!o; });
  arr(d.orbs, 200).forEach((o, i) => { if (game.orbs[i]) game.orbs[i].taken = !!o; });
  game.spots = arr(d.spots, 120).filter(a => Array.isArray(a)).map(a => { const s = { x: nf(a[0]), y: nf(a[1]) }; if (a[2] === 1) s.tide = true; if (a[2] === 2) s.aurora = true; return s; });
  game.eggs = arr(d.eggs, 40).filter(a => Array.isArray(a) && SLIMES[a[0]]).map(a => ({ id: 'n' + a[1] + '_' + a[2], corral: 0, type: a[0], x: nf(a[1]), y: nf(a[2]), t: nf(a[3]) }));
  if (d.surv) {                                                    // the host plays a survival ranch: show the same gathered / broken things
    for (const k of arr(d.broken, 500)) { const [x, y] = String(k).split(',').map(Number); if (world[x] && world[x][y] === T.BOULDER) world[x][y] = baseTileAt(x, y); }
    arr(d.nodeCd, 600).forEach((cd, i) => { if (game.nodes && game.nodes[i]) game.nodes[i].cd = nf(cd); });
  }
  if (d.names) netApplyNames(d.names);
}
function netApplyNames(list) {
  const by = new Map(game.slimes.map(s => [s.nid, s]));
  for (const a of arr0(list, 300)) {
    if (!Array.isArray(a)) continue; const s = by.get(a[0] | 0); if (!s) continue;
    s.name = netClean(a[1], 14) || s.name; if (TRAITS[a[2]]) s.trait = a[2]; s.shiny = !!a[3]; s.stage = a[4] ? 'baby' : 'adult'; s.growT = Math.max(0, Math.min(BABY_TIME, nf(a[5]))); if (typeof a[6] === 'string' && FOODS[a[6]]) s.likes = a[6];
  }
}
const arr0 = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
function netApplySnap(m) {
  game.time = Math.max(0, Math.min(0.9999, nf(m.tm, game.time))); game.day = Math.max(1, nf(m.d, game.day) | 0); NET.dl = Math.max(60, Math.min(900, nf(m.dl, 240)));
  const w = game.weather; w.raining = !!m.wr; w.kind = m.wk === 'snow' || m.wk === 'storm' ? m.wk : 'rain'; if (!NET.wt) w.intensity = m.wr ? nf(m.wi) : 0; NET.wt = true;
  const by = new Map(game.slimes.map(s => [s.nid, s])), keep = new Set();
  for (const a of arr0(m.s, 200)) {
    if (!Array.isArray(a) || !SLIMES[a[1]]) continue;
    const nid = a[0] | 0, x = nf(a[2]), y = nf(a[3]), f = a[6] | 0;
    let s = by.get(nid);
    if (!s) { s = createSlime(a[1], x, y); s.nid = nid; s.shiny = false; s.noted = true; s.tx = x; s.ty = y; s.tz = 0; game.slimes.push(s); by.set(nid, s); }
    keep.add(nid);
    s.tx = x; s.ty = y; s.tz = nf(a[4]); s.joy = nf(a[5]); s.moving = !!(f & 1); s.facing = f & 2 ? -1 : 1; s.fly = f & 4 ? 0.1 : 0; s.eatTimer = f & 8 ? 0.2 : 0; s.sucked = f & 32 ? 0.1 : 0;
    if (f & 16 && !s.petNow) { s.petT = 0.9; for (let i = 0; i < 3; i++) spawnHeart(s.x + rand(-10, 10), s.y - 18 - i * 6); }
    s.petNow = !!(f & 16);
  }
  if (keep.size !== game.slimes.length) game.slimes = game.slimes.filter(s => keep.has(s.nid));
  if (m.nn) netApplyNames(m.nn);
  const items = (list, table) => arr0(list, 300).filter(a => Array.isArray(a) && table[a[0]]).map(a => ({ type: a[0], x: nf(a[1]), y: nf(a[2]), z: nf(a[3]), vx: 0, vy: 0, vz: 0, age: 0 }));
  game.foods = items(m.f, FOODS); game.plorts = items(m.p, SLIMES); game.treasures = items(m.tr, TREASURES);
  for (const a of arr0(m.j, 40)) {
    if (!Array.isArray(a)) continue; const j = game.jumbos.find(x => x.id === a[0]); if (!j) continue;
    j.state = a[1] === 'popping' || a[1] === 'gone' ? a[1] : 'alive'; j.fed = nf(a[2]) | 0; j.goal = Math.max(1, nf(a[3], j.goal) | 0); if (j.state === 'popping') j.wob = 0.3;
  }
  if (game.hostSurv) {
    const old = new Map((game.critters || []).map(c => [c.id, c]));
    game.critters = arr0(m.c, 40).filter(a => Array.isArray(a) && CRITTERS[a[1]]).map(a => {
      const c = old.get(a[0]) || { id: a[0], kind: a[1], def: CRITTERS[a[1]], x: nf(a[2]), y: nf(a[3]), walk: Math.random() * 6, hurt: 0, z: 0, vx: 0, vy: 0 };
      c.tx = nf(a[2]); c.ty = nf(a[3]); c.maxHp = c.def.hp; c.hp = nf(a[4]); c.state = a[5] ? 'chase' : 'wander'; return c;
    });
  }
  if (m.x) netApplyWorld(m.x);
}

/* ---------------- per-frame ---------------- */
function netRemotes(dt) {
  for (const p of NET.players.values()) {
    if (p.id === NET.id) { if (p.sayT > 0) p.sayT -= dt; continue; }
    if (!p.seen) continue;
    const k = Math.min(1, dt * 12), dx = p.tx - p.x, dy = p.ty - p.y;
    if (dx * dx + dy * dy > 90000) { p.x = p.tx; p.y = p.ty; } else { p.x += dx * k; p.y += dy * k; }
    p.z += (p.tz - p.z) * k;
    if (p.moving) p.walkT += dt * 9;
    if (p.emoteT > 0) p.emoteT -= dt; if (p.sayT > 0) p.sayT -= dt;
  }
  if (NET.myEmoteT > 0) NET.myEmoteT -= dt;
  if (NET.chatCd > 0) NET.chatCd -= dt;
}
function netTick(dt) {
  if (!netActive()) return;
  NET.posT += dt; NET.storyT += dt;
  if (NET.posT >= 0.1) { NET.posT = 0; if (netOthers() > 0) netSendPos(); }
  if (NET.status === 'host' && netOthers() > 0) {
    NET.stateT += dt; NET.extraT += dt;
    if (NET.stateT >= 0.2) { NET.stateT = 0; const ex = NET.extraT >= 5; if (ex) NET.extraT = 0; netSendState(ex); }
  }
  if (NET.storyT >= 1) {
    NET.storyT = 0; const st = JSON.stringify(netMyStory());
    if (st !== NET.lastStory) { NET.lastStory = st; netSend({ t: 'story', story: JSON.parse(st) }); const me = NET.players.get(NET.id); if (me) { me.story = JSON.parse(st); netStatusChanged(); } }
  }
  netRemotes(dt);
}

/* a visitor's world: only the player, the camera, remote friends and things that follow the host's snapshots */
function updateVisitor(dt, still) {
  if (!still) updatePlayer(dt);
  const w = game.weather;
  for (const s of game.slimes) {
    const def = s.def; s.age += dt;
    const dx = s.tx - s.x, dy = s.ty - s.y;
    if (dx * dx + dy * dy > 40000) { s.x = s.tx; s.y = s.ty; } else { const k = Math.min(1, dt * 9); s.x += dx * k; s.y += dy * k; }
    if (s.petT > 0) { s.petT -= dt; s.moving = false; s.z = Math.abs(Math.sin(s.age * 9)) * 2.5; continue; }
    if (s.fly > 0) { s.z = s.tz; continue; }
    s.hop = (s.hop + dt * def.hopRate * traitHop(s) * (s.moving ? 1 : 0.55) * (s.eatTimer > 0 ? 0.4 : 1)) % 1;
    s.z = s.hop < 0.5 ? Math.sin(s.hop / 0.5 * Math.PI) * (s.moving ? 8 : 3.5) : 0;
  }
  for (const c of game.critters || []) {
    if (c.tx !== undefined) { const dx = c.tx - c.x, dy = c.ty - c.y, k = Math.min(1, dt * 9); if (dx * dx + dy * dy > 40000) { c.x = c.tx; c.y = c.ty; } else { c.x += dx * k; c.y += dy * k; } c.walk += dt * (c.state === 'chase' ? 6 : 2.5); }
  }
  for (const j of game.jumbos) j.wob = Math.max(0, j.wob - dt);
  game.time = Math.min(0.9999, game.time + dt / NET.dl);
  w.intensity += ((w.raining ? 1 : 0) - w.intensity) * Math.min(1, dt * 0.8);
  if (w.rainbow > 0) w.rainbow -= dt;
  const wet = w.kind !== 'snow'; Sound.setLoop('rain', wet && w.intensity > 0.04, 0.5); Sound.setLoopVol('rain', wet ? 0.5 * w.intensity : 0);
  updateParticles(dt);
  if (profile.settings.particles > 0) updateFireflies(dt);
  netVisitorHints(dt);
  netFindInteract();
  NET.tideT += dt; if (NET.tideT >= 1) { NET.tideT = 0; syncTide(true); syncAurora(true); }
  if (game.shopOpen) closeShop();
  Sound.updateMusic(nightAmount(game.time));
  netTick(dt);
}
function netVisitorHints(dt) {                                       // buttons for things only the ranch owner can do
  if (NET.hint > 0) NET.hint -= dt;
  if ((input.suck || input.shoot || input.shootTap) && NET.hint <= 0) { NET.hint = 2.5; showAlert('Visitors can pet slimes, chat and emote', 2200); }
  input.shootTap = false;
}
function netFindInteract() {
  const p = game.player; let best = null, bd = 34;
  for (const s of game.slimes) { if (s.fly > 0) continue; const d = dist(p.x, p.y, s.x, s.y); if (d < bd) { bd = d; best = { kind: 'pet', obj: s, icon: '🤚', label: 'Pet ' + s.name, x: s.x, y: s.y }; } }
  game.interact = best;
}
function netInteract() {
  const it = game.interact;
  if (!it || it.kind !== 'pet') { showAlert('Visitors can pet slimes, chat and emote', 2200); Sound.play('error', 0.4); return; }
  const s = it.obj; if (s.petLocal > performance.now()) return; s.petLocal = performance.now() + 1200;
  netSend({ t: 'act', a: 'pet', n: s.nid });
  for (let i = 0; i < 2; i++) spawnHeart(s.x + rand(-10, 10), s.y - 18 - i * 6);
  Sound.play('pet', 0.6);
}
