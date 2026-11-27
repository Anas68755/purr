'use strict';
/* =====================================================================
   SLIME ALBUM (v5) — photo mode, frames & stickers to decorate your photos, and collectible badges.
   Everything lives in the profile (it survives New Game), photos are small JPEG thumbnails (max PHOTO_MAX).
   ===================================================================== */
const PHOTO_MAX = 12, PHOTO_W = 480, PHOTO_H = 270;
const renderCam = { x: 0, y: 0 };            // camera of the last rendered frame (set by render.js)

/* ---------------- badges (generated from the game's own data) ---------------- */
const BADGES = [];
SLIME_IDS.forEach(id => BADGES.push({ id: 'snap_' + id, icon: '📸', name: SLIMES[id].name + ' portrait', desc: `Take a photo with a ${SLIMES[id].name} slime in the frame.`, has: () => !!slimeEntry(id).photo, group: 'Portraits' }));
JUMBOS.forEach(j => BADGES.push({ id: 'jumbo_' + j.id, icon: '👑', name: SLIMES[j.id].name + ' Jumbo friend', desc: `Feed the ${SLIMES[j.id].name} Jumbo until it bursts.`, has: () => !!(profile.codex.jumbos && profile.codex.jumbos[j.id]), group: 'Jumbos' }));
Object.keys(PLACES).forEach(id => BADGES.push({ id: 'visit_' + id, icon: PLACES[id].icon, name: PLACES[id].name, desc: `Visit ${PLACES[id].name}.`, has: () => !!profile.codex.places[id], group: 'Places' }));
STORY.forEach((c, i) => BADGES.push({ id: 'story' + (i + 1), icon: '📖', name: `Chapter ${i + 1}: ${c.title}`, desc: `Finish chapter ${i + 1} of the story.`, has: () => getStat('storyChapters') >= i + 1, group: 'Story' }));
[
  ['photo1', '📷', 'First Snap', 'Take your first photo.', () => getStat('photos') >= 1],
  ['photo10', '🖼️', 'Photographer', 'Take 10 photos.', () => getStat('photos') >= 10],
  ['crowd', '🫂', 'Group Photo', 'Get 4 slimes into one photo.', () => getStat('bestPhotoSlimes') >= 4],
  ['species3', '🌈', 'Rainbow Shot', 'Get 3 different kinds of slime into one photo.', () => getStat('bestPhotoSpecies') >= 3],
  ['bulk1', '📦', 'Wholesaler', 'Make a bulk sale (10+ glimmers of one kind).', () => getStat('bulkSales') >= 1],
  ['bulk25', '🚚', 'Big Order', 'Sell 25 or more glimmers of one kind at once.', () => getStat('bestBulk') >= 25],
  ['sold200', '💰', 'Market Regular', 'Sell 200 glimmers in total.', () => getStat('glimmersSold') >= 200],
  ['lowtide', '🌊', 'Tide Walker', 'Open a tide-pool chest at low tide.', () => getStat('tideChests') >= 1],
  ['bottle', '🍾', 'Message Received', 'Find a drift bottle on the beach.', () => getStat('bottles') >= 1],
  ['wren', '👵', 'Tea with Wren', 'Have a chat with Wren.', () => getStat('wrenTalks') >= 1],
  ['baby', '🍼', 'Baby Photo', 'Hatch a baby slime.', () => getStat('babies') >= 1],
  ['shiny', '✨', 'Shiny Find', 'Meet a shiny slime.', () => getStat('shinies') >= 1],
  ['named', '✏️', 'Best Friends', 'Name 3 slimes.', () => getStat('named') >= 3],
  ['aurora', '🌌', 'Aurora Watcher', 'See an Aurora Night.', () => getStat('auroraNights') >= 1],
  ['story', '🏮', 'Lantern Keeper', 'Light the Heart Lantern (finish the story).', () => getStat('storyDone') >= 1]
].forEach(([id, icon, name, desc, has]) => BADGES.push({ id, icon, name, desc, has, group: 'Moments' }));

const badgeCount = () => BADGES.filter(b => profile.badges && profile.badges[b.id]).length;
function checkBadges() {
  if (!profile.badges) profile.badges = {};
  for (const b of BADGES) {
    if (profile.badges[b.id] || !b.has()) continue;
    profile.badges[b.id] = Date.now(); profileDirty = true;
    showToast(b.icon, 'New badge: ' + b.name, b.desc);
  }
}

/* ---------------- frames & stickers ---------------- */
const FRAMES = [
  { id: 'plain',  name: 'Polaroid',        need: () => true,                                     hint: 'Always available' },
  { id: 'meadow', name: 'Meadow flowers',  need: () => badgeCount() >= 3,                        hint: 'Collect 3 badges' },
  { id: 'starry', name: 'Starry night',    need: () => badgeCount() >= 8,                        hint: 'Collect 8 badges' },
  { id: 'candy',  name: 'Candy stripes',   need: () => badgeCount() >= 14,                       hint: 'Collect 14 badges' },
  { id: 'shell',  name: 'Seashells',       need: () => !!profile.badges && !!profile.badges.visit_beach, hint: 'Visit the Sunny Shore' },
  { id: 'shroom', name: 'Mushroom ring',   need: () => !!profile.badges && !!profile.badges.visit_grove, hint: 'Visit the Mushroom Grove' },
  { id: 'gold',   name: 'Golden frame',    need: () => badgeCount() >= 30,                       hint: 'Collect 30 badges' }
];
const STICKERS = [
  { id: '', name: 'None', ch: '', need: () => true, hint: '' },
  { id: 'star', name: 'Star', ch: '⭐', need: () => true, hint: 'Always available' },
  { id: 'blossom', name: 'Blossom', ch: '🌸', need: () => badgeCount() >= 3, hint: 'Collect 3 badges' },
  { id: 'shroom', name: 'Mushroom', ch: '🍄', need: () => !!profile.badges && !!profile.badges.visit_grove, hint: 'Visit the Mushroom Grove' },
  { id: 'shell', name: 'Shell', ch: '🐚', need: () => !!profile.badges && !!profile.badges.visit_beach, hint: 'Visit the Sunny Shore' },
  { id: 'crown', name: 'Crown', ch: '👑', need: () => BADGES.some(b => b.id.startsWith('jumbo_') && profile.badges && profile.badges[b.id]), hint: 'Pop a Jumbo' },
  { id: 'heart', name: 'Heart', ch: '💖', need: () => badgeCount() >= 10, hint: 'Collect 10 badges' },
  { id: 'lantern', name: 'Lantern', ch: '🏮', need: () => !!profile.badges && !!profile.badges.story, hint: 'Finish the story' }
];
const frameDef = id => FRAMES.find(f => f.id === id) || FRAMES[0];
const stickerDef = id => STICKERS.find(f => f.id === id) || STICKERS[0];
const albumState = () => profile.album || (profile.album = { photos: [], frame: 'plain', sticker: '' });

/* ---------------- photo mode ---------------- */
function enterPhotoMode() {
  if (game.state !== 'playing' && game.state !== 'paused') return;
  game.photo = { on: true, flash: 0, shoot: false };
  document.body.classList.add('photo');
  const ui = $('#photoUI'); if (ui) ui.style.display = 'flex';
  refreshPhotoUI();
}
function exitPhotoMode() {
  game.photo = null; document.body.classList.remove('photo');
  const ui = $('#photoUI'); if (ui) ui.style.display = 'none';
}
const inPhotoMode = () => !!(game.photo && game.photo.on);
function refreshPhotoUI() {
  const a = albumState(), f = $('#photoFrameName'), st = $('#photoStickerName'), n = $('#photoCount');
  if (f) f.textContent = frameDef(a.frame).name;
  if (st) st.textContent = stickerDef(a.sticker).ch || '—';
  if (n) n.textContent = `${a.photos.length}/${PHOTO_MAX}`;
}
function cyclePhotoOption(kind, dir) {
  const a = albumState(), list = (kind === 'frame' ? FRAMES : STICKERS).filter(x => x.need()), key = kind === 'frame' ? 'frame' : 'sticker';
  let i = list.findIndex(x => x.id === a[key]); if (i < 0) i = 0;
  a[key] = list[(i + dir + list.length) % list.length].id; profileDirty = true; refreshPhotoUI(); Sound.play('click', 0.5);
}
function photoShoot() {
  if (!inPhotoMode()) return;
  if (albumState().photos.length >= PHOTO_MAX) { showAlert('📔 Album full — delete a photo in ☰ → Slime Album', 2600); Sound.play('error', 0.6); return; }
  game.photo.shoot = true;
}

// Called at the end of render() while the game canvas still holds the finished frame.
function capturePhoto() {
  const a = albumState(), cw = canvas.width, ch = canvas.height;
  let cropW = cw, cropH = Math.round(cw * 9 / 16);
  if (cropH > ch) { cropH = ch; cropW = Math.round(ch * 16 / 9); }
  const sx = Math.round((cw - cropW) / 2), sy = Math.round((ch - cropH) / 2);
  // who is in the picture? (CSS px of the crop rectangle in world space)
  const vx0 = renderCam.x + sx / DPR, vy0 = renderCam.y + sy / DPR, vx1 = vx0 + cropW / DPR, vy1 = vy0 + cropH / DPR;
  const inShot = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  const types = game.slimes.filter(s => s.fly <= 0 && inShot(s.x, s.y)).map(s => s.type);
  const jumbos = game.jumbos.filter(j => j.state !== 'gone' && inShot(j.x, j.y)).map(j => j.id);
  let img = '';
  try {
    const cv = document.createElement('canvas'); cv.width = PHOTO_W; cv.height = PHOTO_H;
    const c = cv.getContext('2d');
    c.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, PHOTO_W, PHOTO_H);
    drawPhotoFrame(c, PHOTO_W, PHOTO_H, a.frame);
    const stk = stickerDef(a.sticker); if (stk.ch) { c.font = '44px serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(stk.ch, PHOTO_W - 22, 20); }
    c.font = 'bold 13px Arial'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(22, PHOTO_H - 42, 190, 20); c.fillStyle = '#fff';
    c.fillText(tr(`Day ${game.day} · ${season().name} · ${areaName()}`), 28, PHOTO_H - 28);
    img = cv.toDataURL('image/jpeg', 0.72) || '';
  } catch (e) { img = ''; }
  const species = [...new Set(types)];
  a.photos.unshift({ id: Math.random().toString(36).slice(2, 8), day: game.day, season: season().id, area: areaName(), slimes: species, count: types.length, jumbos, frame: a.frame, sticker: a.sticker, img });
  species.forEach(t => { const e = slimeEntry(t); if (!e.photo) { e.photo = true; } });
  stat('photos'); statMax('bestPhotoSlimes', types.length); statMax('bestPhotoSpecies', species.length);
  profileDirty = true; achDirty = true; saveProfile();
  game.photo.flash = 0.35; Sound.play('capture', 0.8);
  const fl = $('#flash'); if (fl) { fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 160); }
  showAlert(species.length ? `📸 Captured ${species.map(t => SLIMES[t].name).join(', ')}!` : '📸 Nice view!', 1800);
  refreshPhotoUI();
}
function areaName() {
  const p = game.player, ar = areaAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  if (ar) return PLACES[ar].name;
  const pl = currentPlaces().filter(x => x !== 'shop')[0]; return pl ? PLACES[pl].name : 'The Meadow';
}
function deletePhoto(id) { const a = albumState(); a.photos = a.photos.filter(p => p.id !== id); profileDirty = true; saveProfile(); }

function drawPhotoFrame(c, w, h, id) {
  const B = 16;
  const border = col => { c.fillStyle = col; c.fillRect(0, 0, w, B); c.fillRect(0, h - B, w, B); c.fillRect(0, 0, B, h); c.fillRect(w - B, 0, B, h); };
  const dots = (n, col, rf, fn) => { c.fillStyle = col; for (let i = 0; i < n; i++) fn(i, i / n); };
  if (id === 'meadow') {
    border('#6cc060');
    const cols = ['#ff7aa8', '#ffe27a', '#ffffff', '#ff9a5a'];
    for (let i = 0; i < 34; i++) { const t = i / 34, x = t * w, ys = [6, h - 8]; for (const y of ys) { c.fillStyle = cols[i % 4]; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.fillStyle = '#ffd54a'; c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); } }
    for (let i = 0; i < 18; i++) { const y = (i / 18) * h; for (const x of [6, w - 8]) { c.fillStyle = cols[(i + 1) % 4]; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.fillStyle = '#ffd54a'; c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); } }
  } else if (id === 'starry') {
    border('#1c2250'); c.fillStyle = '#ffe27a';
    for (let i = 0; i < 60; i++) { const t = i / 60, x = (Math.sin(i * 12.9) * 0.5 + 0.5) * w, y = i % 2 ? 6 + (i % 3) * 3 : h - 10 + (i % 3) * 2; c.fillRect(x, y, 2.4, 2.4); }
    for (let i = 0; i < 24; i++) { const y = (Math.sin(i * 7.7) * 0.5 + 0.5) * h; c.fillRect(i % 2 ? 4 : w - 10, y, 2.4, 2.4); }
  } else if (id === 'candy') {
    border('#ffffff'); c.fillStyle = '#ff6b9d';
    for (let x = -B; x < w + B; x += 22) { c.save(); c.beginPath(); c.rect(0, 0, w, B); c.rect(0, h - B, w, B); c.rect(0, 0, B, h); c.rect(w - B, 0, B, h); c.clip(); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 11, 0); c.lineTo(x + 11 - h * 0.4, h); c.lineTo(x - h * 0.4, h); c.fill(); c.restore(); }
  } else if (id === 'shell') {
    border('#f0dcaa'); c.strokeStyle = '#e08a6a'; c.lineWidth = 1.6;
    for (let i = 0; i < 20; i++) { const x = 10 + i * (w - 20) / 19; for (const y of [8, h - 8]) { c.beginPath(); c.arc(x, y, 5, Math.PI, 0); c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 5); c.stroke(); } }
    c.fillStyle = '#7fd0d8'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(8, 20 + i * 30, 3, 0, 7); c.arc(w - 8, 20 + i * 30, 3, 0, 7); c.fill(); }
  } else if (id === 'shroom') {
    border('#5a3a7a');
    for (let i = 0; i < 16; i++) { const x = 12 + i * (w - 24) / 15; for (const y of [8, h - 6]) { c.fillStyle = '#ff6a80'; c.beginPath(); c.ellipse(x, y, 8, 5, 0, Math.PI, 0); c.fill(); c.fillStyle = '#fff3dc'; c.fillRect(x - 1.5, y, 3, 4); c.beginPath(); c.arc(x - 2.5, y - 2.5, 1.2, 0, 7); c.fill(); } }
  } else if (id === 'gold') {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#e0a820'); g.addColorStop(1, '#fff0a0'); border(g);
    c.strokeStyle = '#8a5a10'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); c.strokeRect(B, B, w - 2 * B, h - 2 * B);
    c.fillStyle = '#ff5577'; for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
  } else {                                                                   // polaroid
    border('#fffdf6'); c.fillStyle = '#fffdf6'; c.fillRect(0, h - 34, w, 34); c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.strokeRect(B, B, w - 2 * B, h - B - 34);
  }
}
