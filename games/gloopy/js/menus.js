'use strict';
/* =====================================================================
   MENUS — one modal that shows a stack of screens.
   Opening a screen while playing pauses the game; closing the last
   screen resumes it.  Everything is plain HTML built from data, so
   adding a screen = adding an entry to SCREENS.
   ===================================================================== */
const menuStack = [];
let resumeAfter = false;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------------- stack handling ---------------- */
function openScreen(name, opts) {
  if (!menuStack.length) {
    if (game.state === 'playing') {
      game.state = 'paused'; resumeAfter = true;
      Sound.setLoop('suck', false); input.suck = input.shoot = input.keySuck = input.mouseSuck = false;
      if (game.shopOpen) closeShop();
      saveGame();
    } else resumeAfter = false;
  }
  menuStack.push({ name, opts: opts || {} });
  $('#modal').classList.remove('hidden');
  renderScreen();
  Sound.play('click', 0.6);
}
function backScreen() { menuStack.pop(); if (menuStack.length) renderScreen(); else closeModal(); Sound.play('click', 0.5); }
function closeModal() {
  menuStack.length = 0;
  $('#modal').classList.add('hidden');
  if (resumeAfter) { resumeAfter = false; if (game.state === 'paused') { game.state = 'playing'; lastTime = performance.now(); } }
}
function escapePressed() {
  if (inPhotoMode()) { exitPhotoMode(); return; }
  if (menuStack.length) backScreen();
  else if (game.state === 'playing') openScreen('pause');
}
const openPlantMenu = plot => openScreen('plant', { plot });
function currentScreen() { return menuStack[menuStack.length - 1]; }

function renderScreen(keepScroll) {
  const cur = currentScreen(); if (!cur) return;
  const sc = SCREENS[cur.name], body = $('#mBody'), top = body.scrollTop;
  $('#mTitle').textContent = tr(sc.title(cur.opts));
  $('#mBack').textContent = menuStack.length > 1 ? '←' : '✕';
  body.innerHTML = sc.html(cur.opts);
  if (isRtl()) trDom(body);
  body.scrollTop = keepScroll ? top : 0;
  if (sc.after) sc.after(cur.opts);
}

/* ---------------- small html helpers ---------------- */
const btn = (act, label, extra = '', cls = '') => `<button class="mbtn ${cls}" data-act="${act}" ${extra}>${label}</button>`;
const toggleRow = (k, label, hint) => {
  const on = profile.settings[k];
  return `<div class="srow"><div class="slabel">${label}${hint ? `<small>${hint}</small>` : ''}</div>
    <button class="switch${on ? ' on' : ''}" data-act="tg" data-k="${k}" role="switch" aria-checked="${on}"><i></i></button></div>`;
};
const sliderRow = (k, label) => `<div class="srow"><div class="slabel">${label} <span class="sval" id="v_${k}">${Math.round(profile.settings[k] * 100)}%</span></div>
  <input type="range" min="0" max="100" value="${Math.round(profile.settings[k] * 100)}" data-k="${k}"></div>`;
const segRow = (k, label, options, offset = 0) => `<div class="srow"><div class="slabel">${label}</div><div class="seg">${options.map((o, i) =>
  `<button class="${profile.settings[k] === i + offset ? 'on' : ''}" data-act="seg" data-k="${k}" data-v="${i + offset}">${o}</button>`).join('')}</div></div>`;
const bar = (v, g, cls = '') => `<div class="pbar ${cls}"><i style="width:${pct(v, g)}%"></i></div>`;
const foodIco = id => iconHTML('food', id);


/* the story card (talk lines, request, progress and buttons) shared by the neighbours and by Wren */
function storyPanelHtml(sp, sts) {
  let h = '';
  const [sv, sg] = storyValue();
  h += `<div class="summary story">📖 <b>${esc(STORY[sts.ch].title)}</b> · step ${sts.step + 1}/${STORY[sts.ch].steps.length}${(sp.talk || []).map(t => `<small class="talk">“${esc(t)}”</small>`).join('')}<small>${esc(sp.text)}</small>${sp.kind === 'choice' ? '' : `<small>Reward: $${sp.reward.money}</small>`}${sts.status === 'active' && sp.kind !== 'choice' ? bar(sv, sg) + `<small>${sv} / ${sg}</small>` : ''}</div>`;
  if (sp.kind === 'choice' && sts.status === 'active') {
    h += (sp.options || []).map(o => btn('storychoose', o.label + (sts.choice === o.id ? ' ✓' : ''), `data-id="${o.id}"`, sts.choice === o.id ? 'primary' : 'quiet')).join('');
    h += sts.choice ? `<p class="note">${esc(sp.options.find(o => o.id === sts.choice).text)}</p>` + btn('storyhandin', '★ This is my choice', '', 'primary') : '<p class="note">Choose how the light stays. You can change your mind until you confirm.</p>';
  } else h += sts.status === 'idle' ? btn('storyaccept', '★ I will help!', '', 'primary') : btn('storyhandin', storyReady() ? '★ Hand in' : '⏳ Not yet…', storyReady() ? '' : 'disabled', storyReady() ? 'primary' : 'quiet');
  return h;
}

/* ---------------- screens ---------------- */
const SCREENS = {
  pause: {
    title: () => 'Paused',
    html: () => `<div class="mlist">
      ${btn('resume', '▶ Resume', '', 'primary')}
      ${btn('open', '📜 Journal — orders &amp; stats', 'data-to="journal"')}
      ${btn('open', '📋 Challenges' + (boardClaimable() ? ` <span class="badge">${boardClaimable()}</span>` : ''), 'data-to="challenges"')}
      ${btn('open', '⚡ Powers' + (Object.keys(game.powers).length ? ` <span class="badge">${Object.keys(game.powers).length}</span>` : ''), 'data-to="powers"')}
      ${btn('open', '🐾 Corrals — buy &amp; upgrade', 'data-to="corrals"')}
      ${btn('open', '🪴 Decorate the ranch' + (stockCount() ? ` <span class="badge">${stockCount()}</span>` : ''), 'data-to="decorate"')}
      ${btn('open', '📔 Slime Album — photos, frames &amp; badges' + (badgeCount() ? ` <span class="badge">${badgeCount()}</span>` : ''), 'data-to="album"')}
      ${game.surv ? btn('open', '🛠️ Crafting — tools, armour &amp; supplies', 'data-to="craft"') : ''}
      ${btn('open', '🐾 My slimes — names, traits &amp; babies', 'data-to="slimes"')}
      ${btn('open', '🌐 Play together' + (netActive() ? ' <span class="badge">●</span>' : ''), 'data-to="together"')}
      ${btn('open', '🗺️ World map', 'data-to="map"')}
      ${btn('open', '📖 Codex', 'data-to="codex"')}
      ${btn('open', '🏆 Achievements', 'data-to="achievements"')}
      ${btn('open', '👑 Ranch Fame', 'data-to="fame"')}
      ${btn('open', '⚙️ Settings', 'data-to="settings"')}
      ${btn('open', '❓ How to play', 'data-to="help"')}
      ${btn('exit', '💾 Save &amp; back to title', '', 'quiet')}
    </div>`
  },

  settings: {
    title: () => '⚙️ Settings',
    html: () => `
      <div class="ssec">Sound</div>
      ${toggleRow('sfx', '🔊 Sound effects')}${sliderRow('sfxVol', 'Effects volume')}
      ${toggleRow('music', '🎵 Music')}${sliderRow('musicVol', 'Music volume')}
      <div class="ssec">Controls</div>
      ${toggleRow('assist', '🎯 Aim assist', 'The gulper turns toward nearby things when you stand still')}
      ${toggleRow('vibrate', '📳 Vibration', 'Phones only')}
      ${toggleRow('lefty', '✋ Left-handed layout', 'Mirrors the stick and buttons')}
      ${toggleRow('hints', '💡 Hints', 'Short tips while you play')}
      <div class="ssec">Look &amp; feel</div>
      ${toggleRow('lighting', '🌙 Night lighting', 'Turn off if your device feels warm')}
      ${segRow('lang', '🌍 Language', ['Auto', 'English', 'العربية'], -1)}
      ${segRow('particles', '✨ Particles &amp; rain', ['Low', 'Medium', 'High'])}
      ${segRow('dayLen', '⏳ Day length', ['Calm · 6 min', 'Normal · 4 min', 'Quick · 2½ min'])}
      <div class="ssec">Data</div>
      <div class="mlist">
        ${btn('askdelsave', '🗑️ Delete ranch save', '', 'quiet')}
        ${btn('askresetmeta', '♻️ Reset achievements, codex &amp; stats', '', 'quiet')}
      </div>`
  },

  achievements: {
    title: () => '🏆 Achievements',
    html: () => {
      const done = ACHIEVEMENTS.filter(a => profile.ach[a.id]).length;
      let h = `<div class="summary"><b>${done} / ${ACHIEVEMENTS.length}</b> unlocked${bar(done, ACHIEVEMENTS.length, 'gold')}</div>`;
      const sorted = ACHIEVEMENTS.slice().sort((a, b) => (profile.ach[b.id] ? 1 : 0) - (profile.ach[a.id] ? 1 : 0));
      for (const a of sorted) {
        const un = !!profile.ach[a.id], [cur, goal] = achProgress(a);
        h += `<div class="arow${un ? ' done' : ''}"><span class="aico">${un ? a.icon : '🔒'}</span>
          <div class="ainfo"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${un ? '' : bar(cur, goal)}</div>
          <span class="areward">${un ? '✓' : `${cur >= 1000 ? Math.round(cur / 100) / 10 + 'k' : Math.floor(cur)}/${goal >= 1000 ? goal / 1000 + 'k' : goal}`}<small>+$${a.reward}</small></span></div>`;
      }
      return h;
    }
  },

  album: {
    title: () => '📔 Slime Album',
    html: o => {
      const tab = o.tab || 'photos', a = albumState(), nb = badgeCount();
      let h = `<div class="summary"><b>🏅 ${nb} / ${BADGES.length}</b> badges · <b>📷 ${a.photos.length} / ${PHOTO_MAX}</b> photos${bar(nb, BADGES.length, 'gold')}</div>
        <div class="tabs">${[['photos', '📷 Photos'], ['frames', '🖼️ Frames'], ['badges', '🏅 Badges']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
      if (tab === 'photos') {
        h += btn('photomode', '📷 Photo mode — walk around and take pictures', '', 'primary');
        h += '<p class="note">Frame slimes, Jumbos and scenery, then press the shutter. Every kind of slime you catch on camera earns a portrait badge. Photos stay in your album when you start a new ranch.</p>';
        h += a.photos.length ? '<div class="photogrid">' + a.photos.map(p => `<div class="ph" data-act="viewphoto" data-id="${p.id}">${p.img ? `<img src="${p.img}" alt="">` : '<span class="noimg">📷</span>'}<small>Day ${p.day} · ${esc(p.area)}</small></div>`).join('') + '</div>' : '<p class="empty">No photos yet. Try photo mode!</p>';
      } else if (tab === 'frames') {
        h += '<div class="ssec">Frames</div>';
        for (const f of FRAMES) { const ok = f.need(), cur = a.frame === f.id; h += `<div class="arow${cur ? ' done' : ''}"><span class="aico">${ok ? '🖼️' : '🔒'}</span><div class="ainfo"><b>${f.name}${cur ? ' ✓' : ''}</b><small>${ok ? 'Unlocked' : esc(f.hint)}</small></div>${ok && !cur ? btn('selframe', 'USE', `data-id="${f.id}"`, 'inline') : ''}</div>`; }
        h += '<div class="ssec">Stickers</div>';
        for (const f of STICKERS.filter(x => x.id !== '')) { const ok = f.need(), cur = a.sticker === f.id; h += `<div class="arow${cur ? ' done' : ''}"><span class="aico">${ok ? f.ch : '🔒'}</span><div class="ainfo"><b>${f.name}${cur ? ' ✓' : ''}</b><small>${ok ? 'Unlocked' : esc(f.hint)}</small></div>${ok && !cur ? btn('selsticker', 'USE', `data-id="${f.id}"`, 'inline') : ''}</div>`; }
        if (a.sticker) h += btn('selsticker', 'No sticker', 'data-id=""', 'quiet');
      } else {
        for (const g of ['Portraits', 'Jumbos', 'Places', 'Story', 'Moments']) {
          const list = BADGES.filter(b => b.group === g), have = list.filter(b => profile.badges && profile.badges[b.id]).length;
          h += `<div class="ssec">${g} · ${have}/${list.length}</div><div class="badgegrid">` + list.map(b => { const on = !!(profile.badges && profile.badges[b.id]); return `<div class="bdg${on ? ' on' : ''}" title="${esc(b.desc)}"><span>${on ? b.icon : '❔'}</span><small>${on ? esc(b.name) : '???'}</small></div>`; }).join('') + '</div>';
        }
        h += '<p class="note">Badges are keepsakes — no coins, just bragging rights and new frames &amp; stickers for your photos.</p>';
      }
      return h;
    }
  },

  slimes: {
    title: () => '🐾 My slimes',
    html: o => {
      const tab = o.tab || 'all', all = game.slimes.map((s, i) => ({ s, i }));
      const babies = all.filter(x => isBaby(x.s)).length, shiny = all.filter(x => x.s.shiny).length, named = all.filter(x => x.s.named).length;
      const list = (tab === 'babies' ? all.filter(x => isBaby(x.s)) : tab === 'shiny' ? all.filter(x => x.s.shiny) : tab === 'named' ? all.filter(x => x.s.named) : all)
        .sort((a, b) => SLIME_IDS.indexOf(a.s.type) - SLIME_IDS.indexOf(b.s.type) || a.s.name.localeCompare(b.s.name));
      let h = `<div class="summary"><b>🐾 ${all.length} slimes</b> · ✏️ ${named} named · 🍼 ${babies} babies · ✨ ${shiny} shiny<small>Pet, feed and name them. Two delighted slimes of the same kind in a pen can share an egg.</small></div>
        <div class="tabs">${[['all', 'All'], ['babies', '🍼 Babies'], ['shiny', '✨ Shiny'], ['named', '✏️ Named']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
      if (!list.length) return h + '<p class="empty">No slimes here yet.</p>';
      h += list.map(({ s, i }) => {
        const tr = TRAITS[s.trait], pen = penOf(s), where = pen ? 'in a pen' : (areaAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) ? PLACES[areaAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE))].name : 'in the meadow');
        return `<div class="arow slimecard"><span class="sl-ico" style="background-image:url(assets/images/slimes/${s.type}.png)"></span><div class="ainfo">
          <b>${s.shiny ? '✨ ' : ''}${esc(s.name)}</b> <small>${SLIMES[s.type].name}${isBaby(s) ? ' · 🍼 baby ' + Math.round((1 - s.growT / BABY_TIME) * 100) + '%' : ''} · ${tr.icon} ${tr.name} · likes ${FOODS[s.likes].name}</small>
          <small>${isDelighted(s) ? '😍 delighted' : s.joy > 20 ? '🙂 happy' : '😐 calm'} · ${where}</small>
          <small class="trait">${esc(tr.desc)}</small>
          <div class="rnrow"><input id="rn${i}" class="rn" maxlength="14" value="${esc(s.name)}" aria-label="Name"><button class="mbtn inline" data-act="rename" data-id="${i}">Rename</button></div></div></div>`;
      }).join('');
      return h;
    }
  },

  craft: {
    title: () => '🛠️ Crafting',
    html: () => {
      const s = game.surv; if (!s) return '<p class="empty">Crafting belongs to the Survival ranch.</p>';
      const costText = r => Object.keys(r.cost).map(k => k === 'food' ? Object.keys(r.cost.food).map(f => `${FOODS[f].name} ${r.cost.food[f]} <i>(${packCount('food', f)})</i>`).join(' ') : `${MATS[k].icon} ${r.cost[k]} <i>(${matCount(k)})</i>`).join(' · ');
      let h = `<div class="summary"><b>🎒 Materials</b> ${Object.keys(MATS).map(k => `${MATS[k].icon} ${MATS[k].name} ${s.mats[k]}`).join(' · ')}<small>Gather wood and fibre from branches and tufts, break boulders for stone, and get hide from critters.</small></div>`;
      h += `<div class="summary"><b>Equipped</b> ${s.weapon ? recipe(s.weapon).icon + ' ' + recipe(s.weapon).name : '✊ Bare hands'} · ${s.armor ? recipe(s.armor).icon + ' ' + recipe(s.armor).name : 'No armour'}${s.pick ? ' · ⛏️ Pickaxe' : ''}${s.hasCanteen ? ' · 🫙 Canteen ' + s.canteen + '/' + SURV.canteenMax : ''}<small>🍲 ${s.stew} stews · 🩹 ${s.bandage} bandages</small></div>`;
      for (const r of RECIPES) {
        const gear = r.kind === 'weapon' || r.kind === 'armor' || r.kind === 'tool', owned = gear && s.owned[r.id], equipped = s.weapon === r.id || s.armor === r.id;
        const act = owned ? (r.kind === 'tool' ? '<span class="owned">OWNED</span>' : btn('equip', equipped ? 'EQUIPPED ✓' : 'EQUIP', `data-id="${r.id}"`, equipped ? 'primary' : 'quiet')) : btn('craft', 'BUILD', `data-id="${r.id}" ${canAfford(r) ? '' : 'disabled'}`, 'inline');
        h += `<div class="arow${owned ? ' done' : ''}"><span class="aico">${r.icon}</span><div class="ainfo"><b>${r.name}</b><small>${r.desc}</small><small>${costText(r)}</small></div>${act}</div>`;
      }
      return h + '<p class="note">Open this screen any time with C. Eat with R, drink with T, bandage with H, swing with X.</p>';
    }
  },

  wren: {
    title: () => '👵 Wren',
    html: o => {
      const sp = storyFor('wren'), sts = ensureStory();
      let h = `<div class="arow"><span class="npc-face" style="background-image:url(${IMAGE_FILES.npcs});background-position:-${WREN.cell * 64}px 0"></span><div class="ainfo"><b>${WREN.name}</b><small>${WREN.title}</small></div></div>`;
      if (sp) return h + storyPanelHtml(sp, sts);
      const lines = wrenLines(), i = (o && o.i ? o.i : 0) % lines.length;
      return h + `<p class="note big">“${esc(lines[i])}”</p>` + btn('wrenmore', '💬 Keep chatting', `data-id="${i + 1}"`, 'primary');
    }
  },

  photo: {
    title: () => '📷 Photo',
    html: o => {
      const p = albumState().photos.find(x => x.id === o.id); if (!p) return '<p class="empty">This photo is gone.</p>';
      return `${p.img ? `<img class="bigphoto" src="${p.img}" alt="">` : ''}<p class="note big">Day ${p.day} · ${SEASONS.find(x => x.id === p.season).name} · ${esc(p.area)}</p>
        <p class="note">${p.slimes.length ? 'In the picture: ' + p.slimes.map(t => SLIMES[t].name).join(', ') : 'Just scenery.'}${p.jumbos.length ? ' · Jumbo: ' + p.jumbos.map(t => SLIMES[t].name).join(', ') : ''}</p>
        <div class="mlist">${p.img ? `<a class="mbtn primary" href="${p.img}" download="gloopy-meadow-${p.id}.jpg">💾 Save to device</a>` : ''}${btn('delphoto', '🗑️ Delete photo', `data-id="${p.id}"`, 'danger')}</div>`;
    }
  },

  map: {
    title: () => '🗺️ World map',
    html: () => `<canvas id="mapCv" class="mapcv" width="${WORLD_W}" height="${WORLD_H}"></canvas>
      <div class="ssec">🪧 Signposts — travel for $${TRAVEL_COST}</div>${WAYPOINTS.map(w => waypointOpen(w) ? btn('travel', `${w.icon} ${w.name}`, `data-id="${w.id}" ${game.money < TRAVEL_COST ? 'disabled' : ''}`, 'quiet') : `<div class="arow"><span class="aico">🔒</span><div class="ainfo"><b>${w.name}</b><small>Walk there once to unlock this signpost.</small></div></div>`).join('')}
      <p class="note">The original meadow is in the top-left. 🍄 Mushroom Grove far east · 🌼 Sunny Prairie south-east · 🌬️ Windy Fields south-west · 🏖️ Sunny Shore along the south coast. ⚪ you · 💬 neighbours · 👑 Jumbos you have met.</p>`,
    after: () => drawWorldMap()
  },

  codex: {
    title: () => '📖 Codex',
    html: o => {
      const tab = o.tab || 'slimes', done = codexDonePieces(), total = codexTotalPieces();
      const tabs = [['slimes', '🐙 Slimes'], ['foods', '🥕 Food'], ['treasures', '🏺 Treasures'], ['places', '🗺️ Places']];
      let h = `<div class="summary"><b>${pct(done, total)}%</b> complete${bar(done, total)}</div>
        <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
      if (tab === 'slimes') h += SLIME_IDS.map(slimeCard).join('');
      else if (tab === 'foods') h += Object.keys(FOODS).map(foodCard).join('');
      else if (tab === 'treasures') h += Object.keys(TREASURES).map(treasureCard).join('');
      else h += Object.keys(PLACES).map(placeCard).join('');
      return h;
    }
  },

  journal: {
    title: () => '📜 Journal',
    html: o => {
      const tab = o.tab || 'orders';
      let h = `<div class="tabs">${[['orders', '📜 Orders'], ['story', '📖 Story'], ['market', '📊 Market'], ['calendar', '🗓️ Calendar'], ['specials', '💬 Neighbours'], ['stats', '📊 Stats']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
      if (tab === 'orders') {
        h += '<p class="note">Three orders at a time. Finish one and a new one appears. Orders pay well!</p>';
        for (const o2 of game.orders) {
          h += `<div class="arow"><span class="aico">${orderIcon(o2)}</span><div class="ainfo"><b>${esc(o2.desc)}</b>${bar(o2.progress, o2.amount)}</div>
            <span class="areward">${Math.min(o2.progress, o2.amount)}/${o2.amount}<small>+$${o2.reward}</small></span></div>`;
        }
      } else if (tab === 'story') {
        const st = ensureStory(), doneSteps = st.done ? STORY_STEPS : STORY.slice(0, st.ch).reduce((a, c) => a + c.steps.length, 0) + st.step;
        h += `<div class="summary"><b>📖 The Heart Lantern</b> · ${st.done ? 'complete!' : 'chapter ' + (st.ch + 1) + ' of ' + STORY.length + (st.ch >= 5 ? ' · Act II' : ' · Act I')}${bar(doneSteps, STORY_STEPS, 'gold')}<small>Talk to the neighbour with a ★ above their head.</small></div>`;
        h += `<div class="summary story"><b>Your story</b>${STORY_PROLOGUE.map(t => `<small class="talk">${esc(t)}</small>`).join('')}</div>`;
        STORY.forEach((c, i) => {
          const state = st.done || i < st.ch ? 'done' : i === st.ch ? 'now' : 'locked';
          h += `<div class="arow${state === 'done' ? ' done' : ''}"><span class="aico">${state === 'done' ? '✅' : state === 'now' ? '📖' : '🔒'}</span><div class="ainfo"><b>${i + 1}. ${state === 'locked' ? '???' : esc(c.title)}</b>`;
          if (state === 'locked') h += '<small>Finish the previous chapter first.</small>';
          else if (state === 'done') h += `<small>${esc(c.recap)}</small><small class="lore">🔖 <b>${esc(c.lore.title)}</b> — ${esc(c.lore.text)}</small>`;
          else { h += `<small>${esc(c.intro)}</small>`;
            c.steps.forEach((sp, k) => { const done = k < st.step, cur = k === st.step;
              h += `<small>${done ? '✔' : cur ? '▶' : '·'} ${npcDef(sp.npc).name}${done || cur ? ': ' + esc(sp.text) : ''}</small>`;
              if (cur && st.status === 'active' && sp.kind !== 'choice') { const [v, g] = storyValue(); h += bar(v, g) + `<small>${v} / ${g}</small>`; } }); }
          h += '</div></div>';
        });
        if (st.done) h += `<div class="summary story"><b>🏮 Epilogue${st.ending === 'release' ? ' — the light set free' : ' — the lantern kept'}</b>${storyEpilogue().map(t => `<small class="talk">${esc(t)}</small>`).join('')}</div>`;
      } else if (tab === 'market') {
        const mk = ensureMarket(), ev = marketEvent();
        h += `<div class="summary"><b>🔥 In demand: ${mk.demand ? SLIMES[mk.demand.id].name + ' ×' + mk.demand.mult : '—'}</b>${ev ? `<small>${ev.icon} ${ev.name} — ${esc(ev.desc)}${mk.event.type ? ' (' + SLIMES[mk.event.type].name + ')' : ''}</small>` : '<small>No special market event today.</small>'}<small>Market average ×${mk.avg.toFixed(2)} · prices are re-balanced every dawn.</small></div>`;
        h += '<p class="note">Bulk bonus: 10+ → +5% · 25+ → +10% · 50+ → +15%. Each glimmer you sell lowers its price a little (recovers overnight).</p>';
        for (const id of Object.keys(SLIMES).filter(i => slimeEntry(i).seen || !NEW_SLIMES.includes(i))) {
          const tr = game.trends[id] || 0;
          h += `<div class="arow"><span class="aico">${tr > 0 ? '📈' : tr < 0 ? '📉' : '➖'}</span><div class="ainfo"><b>${SLIMES[id].name}</b><small>$${salePrice(id)} · drift ×${(game.prices[id] || 1).toFixed(2)}${marketTags(id).length ? ' · ' + marketTags(id).join(' · ') : ''}</small></div></div>`;
        }
        h += `<p class="note">🌊 Next low tide at the Sunny Shore: ${daysUntilLowTide() === 0 ? 'today!' : 'in ' + daysUntilLowTide() + ' day' + (daysUntilLowTide() > 1 ? 's' : '')}.</p>`;
      } else if (tab === 'calendar') {
        const s = season(), d = dayInSeason();
        h += `<div class="summary"><b>${s.icon} ${s.name}</b> · day ${d} of ${SEASON_DAYS}${bar(d, SEASON_DAYS, 'gold')}<small>${esc(s.blurb)}</small></div>
          <div class="arow"><span class="aico">${FOODS[s.crop] ? '🌱' : ''}</span><div class="ainfo"><b>In season: ${FOODS[s.crop].name}</b><small>Grows 1.5× faster${seasonOf() === 3 ? ' (other crops are slower in winter)' : ''}.</small></div></div>
          <div class="arow"><span class="aico">💎</span><div class="ainfo"><b>Glimmers +25%: ${s.slimes.map(i => SLIMES[i].name).join(', ')}</b><small>Sell these while the season lasts.</small></div></div>`;
        for (const k of Object.keys(SEASON_EVENTS)) { const e = SEASON_EVENTS[k], n = daysUntilEvent(k);
          h += `<div class="arow"><span class="aico">${e.icon}</span><div class="ainfo"><b>${e.name}</b><small>${n === 0 ? 'Today!' : 'in ' + n + ' day' + (n > 1 ? 's' : '')} · every ${SEASON_DAYS * SEASONS.length} days (${SEASONS[e.season].name}, day ${e.day})</small></div></div>`; }
        h += '<p class="note">' + SEASONS.map(x => `${x.icon} ${x.name}`).join(' → ') + ' → repeat</p>';
      } else if (tab === 'specials') {
        h += '<p class="note">Your neighbours have special requests. Finish one and they will have a new one after 10 minutes.</p>';
        for (const n of NPCS) {
          const st = npcState(n.id), q = npcQuest(st), [cur, goal] = npcValue(st);
          const line = st.status === 'cooldown' ? `New request in ~${Math.max(1, Math.ceil(st.cool / 60))} min` : st.status === 'idle' ? 'Has a request for you!' : esc(q.text);
          h += `<div class="arow"><span class="npc-face sm" style="background-image:url(${IMAGE_FILES.npcs});background-position:-${n.cell * 48}px 0"></span><div class="ainfo"><b>${n.name}</b><small>${line}</small>${st.status === 'active' ? bar(cur, goal) : ''}</div><span class="areward">${st.done}<small>done</small></span></div>`;
        }
      } else {
        const rows = [
          ['📅', 'Current day', game.day], ['⏱️', 'Time on the ranch', fmtTime(getStat('playSeconds'))], ['💰', 'Earned in total', '$' + getStat('moneyEarned')],
          ['🐙', 'Slimes on the ranch', game.slimes.length], ['😊', 'Delighted right now', game.slimes.filter(isDelighted).length], ['🏡', 'Ranch charm', charm()],
          ['💎', 'Glimmers collected', getStat('glimmersCollected')], ['🌀', 'Slimes caught', getStat('slimesCaught')], ['🤚', 'Slimes petted', getStat('pets')],
          ['🥕', 'Crops harvested', getStat('harvests')], ['⛏️', 'Spots dug up', getStat('digs')], ['🌧️', 'Rainy days seen', getStat('rains')],
          ['🌠', 'Star shards found', getStat('shards')], ['📜', 'Orders completed', getStat('ordersDone')],
          ['🐾', 'Corrals owned', ownedCorrals() + '/' + CORRAL_LOTS.length], ['🍬', 'Treats given', getStat('treatsGiven')],
          ['💥', 'Jumbos popped', getStat('jumbosPopped')], ['🦘', 'Jumps', getStat('jumps')], ['☁️', 'Sky orbs caught', getStat('skyOrbs')], ['💬', 'Neighbour quests', getStat('npcQuests')]
        ];
        h += '<div class="stats">' + rows.map(r => `<div class="stat"><span>${r[0]}</span><b>${r[2]}</b><small>${r[1]}</small></div>`).join('') + '</div>';
      }
      return h;
    }
  },

  challenges: {
    title: () => '📋 Challenges',
    html: () => {
      const b = game.board, st = effStreak();
      const row = (c, i, w) => { const p = chProgress(c), rdy = chReady(c);
        return `<div class="arow${c.claimed ? ' done' : ''}"><span class="aico">${c.claimed ? '✅' : c.icon}</span><div class="ainfo"><b>${esc(c.text)}</b>${c.claimed ? '<small>Claimed</small>' : bar(p, c.amount)}<small>${c.claimed ? '' : `${p} / ${c.amount} · +$${w ? c.reward.money : Math.round(c.reward.money * (1 + Math.min(0.5, st * 0.1)))} · ${c.reward.tokens}⭐`}</small></div>${c.claimed ? '' : btn('claimch', rdy ? 'CLAIM' : '…', `data-w="${w ? 1 : 0}" data-i="${i}" ${rdy ? '' : 'disabled'}`, 'inline')}</div>`; };
      let h = `<div class="summary"><b>⭐ ${b.tokens}</b> star tokens · <b>🔥 ${st}</b> day streak${st ? ` (+${Math.min(50, st * 10)}% coins on dailies)` : ''}<small>New daily challenges every dawn; weekly ones every 7 days (next in ${7 - dayInSeason() + 1} day${7 - dayInSeason() ? 's' : ''}). Finish one daily each day to keep your streak!</small></div>`;
      h += '<div class="ssec">Today</div>' + b.daily.map((c, i) => row(c, i, false)).join('') + (b.allBonus ? '<p class="note">🎉 All three done today — bonus claimed!</p>' : '<p class="note">All three today: +2⭐ and +$50 bonus.</p>');
      h += '<div class="ssec">This week</div>' + b.weekly.map((c, i) => row(c, i, true)).join('');
      h += '<div class="ssec">Spend your stars</div>' + REDEEM.map(r => `<div class="arow"><span class="aico">${r.icon}</span><div class="ainfo"><b>${esc(r.name)}</b></div>${btn('redeem', r.cost + '⭐', `data-id="${r.id}" ${b.tokens >= r.cost ? '' : 'disabled'}`, 'inline')}</div>`).join('');
      return h;
    }
  },

  powers: {
    title: () => '⚡ Powers',
    html: () => {
      const n = Object.keys(game.powers).length;
      let h = `<div class="summary"><b>${n} / ${Object.keys(POWERS).length}</b> powers${bar(n, Object.keys(POWERS).length, 'gold')}</div>
        <p class="note">Jumbo slimes live out in the meadow. Throw them the food their kind eats — nobody knows how much they want, but it is <i>a lot</i>. When one bursts it showers you with treasure and teaches you a power. It grows back after 20–30 minutes.</p>`;
      for (const cfg of JUMBOS) {
        const pw = POWERS[cfg.power], own = !!game.powers[cfg.power], j = game.jumbos.find(x => x.id === cfg.id), def = SLIMES[cfg.id];
        const seen = slimeEntry(cfg.id).seen;
        h += `<div class="arow${own ? ' done' : ''}"><span class="aico">${own ? pw.icon : '🔒'}</span>
          <div class="ainfo"><b>${own ? pw.name : '???'}</b><small>${own ? esc(pw.desc) : `A ${seen ? def.name : 'mysterious'} Jumbo knows this one. Home: ${seen ? def.habitat : '???'}.`}</small>
          <small>${j.state === 'gone' ? '💤 regrowing — about ' + Math.max(1, Math.ceil(j.timer / 60)) + ' min' : j.state === 'popping' ? '💥 about to pop!' : '👑 ' + def.name + ' Jumbo · eats ' + def.food.map(f => FOODS[f].name).join(', ')}</small></div></div>`;
      }
      return h;
    }
  },

  npc: {
    title: o => { const d = npcDef(o.id); return '💬 ' + d.name; },
    html: o => {
      const d = npcDef(o.id), st = npcState(o.id), q = npcQuest(st), r = q.reward;
      const rew = `+$${r.money}${r.treasure ? ' + ' + TREASURES[r.treasure[0]].name + (r.treasure[1] > 1 ? ' ×' + r.treasure[1] : '') : ''}`;
      const sp = storyFor(d.id), sts = ensureStory();
      let h = `<div class="arow"><span class="npc-face" style="background-image:url(${IMAGE_FILES.npcs});background-position:-${d.cell * 64}px 0"></span><div class="ainfo"><b>${d.name}</b><small>${d.title}</small></div></div>`;
      if (sp) {
        h += storyPanelHtml(sp, sts);
        h += '<div class="ssec">Everyday request</div>';
      }
      if (st.status === 'cooldown') return h + `<p class="note big">“Thank you again! I will need a little time to think of something else.”</p><p class="note">New request in about <b>${Math.max(1, Math.ceil(st.cool / 60))} min</b>.</p>`;
      h += `<p class="note big">“${st.status === 'idle' ? esc(d.hello) + '”<br><br>“' : ''}${esc(q.text)}”</p>`;
      const [cur, goal] = npcValue(st);
      h += `<div class="summary">Reward: <b>${rew}</b>${st.status === 'active' ? bar(cur, goal) + `<small>${cur} / ${goal}</small>` : ''}</div>`;
      if (st.status === 'idle') h += btn('npcaccept', '✅ I will help!', `data-id="${d.id}"`, 'primary');
      else h += btn('npchandin', npcReady(st) ? '🎁 Hand in' : '⏳ Not yet…', `data-id="${d.id}" ${npcReady(st) ? '' : 'disabled'}`, npcReady(st) ? 'primary' : 'quiet');
      return h;
    }
  },

  corrals: {
    title: () => '🐾 Corrals',
    html: () => `<p class="note">Throw slimes into a pen and they stay put. Upgrade each pen on its own: roomier fences, feeders, glimmer baskets, cosy bedding and fence styles. Walk up to a corral's sign and tap ✋ to manage it, or open it from here.</p>` +
      game.corrals.map(c => {
        const ups = Object.keys(CORRAL_UPGRADES).map(k => `${CORRAL_UPGRADES[k].icon}${c[k]}`).join(' ');
        return `<div class="arow"><span class="aico">${c.owned ? '🐾' : '🪧'}</span>
          <div class="ainfo"><b>${c.name}</b><small>${c.owned ? `${corralPop(c)}/${corralCap(c)} slimes · ${ups}` : `For sale · holds ${CORRAL_SIZES[0].cap} slimes to start`}</small></div>
          ${btn('opencorral', c.owned ? 'MANAGE' : '$' + c.price, `data-id="${c.id}" ${!c.owned && game.money < c.price ? 'disabled' : ''}`, 'inline')}</div>`;
      }).join('')
  },

  corral: {
    title: o => '🐾 ' + game.corrals[o.id].name,
    html: o => {
      const c = game.corrals[o.id];
      if (!c.owned) return `<p class="note big">A fenced pen for your slimes. Slimes thrown inside stay inside, and you can upgrade the pen with feeders, baskets, bedding and fence styles.</p>
        <div class="arow"><span class="aico">🐾</span><div class="ainfo"><b>${c.name}</b><small>Holds ${CORRAL_SIZES[0].cap} slimes to start</small></div>
        ${btn('buycorral', '$' + c.price, `data-id="${c.id}" ${game.money < c.price ? 'disabled' : ''}`, 'inline')}</div>`;
      const pop = corralPop(c), cap = corralCap(c);
      let h = `<div class="summary"><b>${pop} / ${cap}</b> slimes in this pen${bar(pop, cap)}</div>`;
      const inPen = game.slimes.filter(sl => penOf(sl) === c);
      if (inPen.length) h += `<div class="chips pen">${inPen.map(sl => `<span class="chip${isDelighted(sl) ? ' on' : ''}">${isDelighted(sl) ? '😊' : '🙂'} ${SLIMES[sl.type].name}</span>`).join('')}</div>`;
      const pairNow = bondPair(c), egg = game.eggs.find(e => e.corral === c.id);
      h += `<div class="arow"><span class="aico">🥚</span><div class="ainfo"><b>Breeding</b><small>${egg ? `An egg is hatching… ${Math.round(egg.t / EGG_HATCH * 100)}%${corralPop(c) >= corralCap(c) ? ' (waiting for room)' : ''}` : c.eggCd > 0 ? `Resting for ${Math.ceil(c.eggCd)}s` : pairNow ? `${SLIMES[pairNow[0].type].name} + ${SLIMES[pairNow[1].type].name} are bonding…` : 'Two delighted slimes of different kinds living together may share an egg.'}</small></div></div>`;
      h += '<div class="ssec">Upgrades for this pen</div>';
      for (const k of Object.keys(CORRAL_UPGRADES)) {
        const u = CORRAL_UPGRADES[k], lv = c[k], cost = corralUpgradeCost(c, k), maxed = cost === null;
        h += `<div class="arow"><span class="aico">${u.icon}</span><div class="ainfo"><b>${u.name} <span class="pips">${pips(lv, u.max)}</span></b><small>${esc(u.desc(Math.min(lv, u.max - 1)))}</small></div>
          ${btn('upcorral', maxed ? 'MAX' : '$' + cost, `data-k="${k}" ${maxed || game.money < cost ? 'disabled' : ''}`, 'inline')}</div>`;
      }
      if (c.feeder > 0) {
        h += `<div class="ssec">🥣 Feeder stock — ${feederTotal(c)} / ${feederCap(c)}</div>${bar(feederTotal(c), feederCap(c))}`;
        const stocked = Object.keys(c.stock).map(t => `<span class="chip on">${FOODS[t].name} ×${c.stock[t]}</span>`).join('');
        h += `<div class="chips pen">${stocked || '<span class="chip">empty</span>'}</div>`;
        const loadable = Object.keys(FOODS).filter(t => !FOODS[t].treat && packCount('food', t) > 0);
        if (loadable.length) h += '<div class="mlist">' + loadable.map(t => btn('loadfeed', `${foodIco(t)} Load ${FOODS[t].name} (you have ${packCount('food', t)})`, `data-id="${t}" ${feederTotal(c) >= feederCap(c) ? 'disabled' : ''}`, 'quiet')).join('') + '</div>';
        else h += '<p class="note">Pick up food with the gulper, then come back to load it. Slimes get their favourite first.</p>';
      }
      if (c.basket > 0) {
        h += `<div class="ssec">🧺 Glimmer basket — ${basketTotal(c)} / ${basketCap(c)}</div>${bar(basketTotal(c), basketCap(c))}`;
        const held = Object.keys(c.bin).map(t => `<span class="chip on">${SLIMES[t].name} ×${c.bin[t]}</span>`).join('');
        h += `<div class="chips pen">${held || '<span class="chip">empty</span>'}</div>` + btn('collect', '🧺 Collect everything', `${basketTotal(c) ? '' : 'disabled'}`, 'primary');
      }
      h += '<div class="ssec">Fence style</div><div class="seg wrap">' + FENCE_STYLES.map(f => {
        const own = c.fences.includes(f.id), cur = c.fence === f.id;
        return `<button class="${cur ? 'on' : ''}" data-act="fence" data-id="${f.id}" ${!own && game.money < f.cost ? 'disabled' : ''}>${f.name}${cur ? ' ✓' : own ? '' : ' · $' + f.cost}</button>`;
      }).join('') + '</div>';
      return h;
    }
  },

  decorate: {
    title: () => '🪴 Decorate',
    html: () => {
      let h = `<p class="note">Charm makes slimes happier: <b>${charm()}</b> charm = ${Math.round((joyMult() - 1) * 100)}% more joy (max 50%). Placed ${game.decor.length}/${MAX_DECOR}. Buy decorations at the market; tap ✋ next to one to pick it up again.</p>`;
      let any = false;
      for (const id of Object.keys(DECOR_ITEMS)) {
        const d = DECOR_ITEMS[id], n = game.stock[id] || 0; if (!n) continue; any = true;
        h += `<div class="arow"><span class="decor-ico" style="background-image:url(${IMAGE_FILES.ranch_decor});background-position:-${d.cell * 40}px 0"></span>
          <div class="ainfo"><b>${d.name} ×${n}</b><small>${d.blurb} +${d.charm} charm</small></div>${btn('place', 'PLACE', `data-id="${id}"`, 'inline')}</div>`;
      }
      if (!any) h += '<p class="empty">Nothing in stock. Visit the market 🏪 to buy lanterns, benches and more.</p>';
      else h += '<p class="note">“Place” puts it one step in front of you.</p>';
      return h;
    }
  },

  plant: {
    title: () => '🌱 Plant something',
    html: () => `<p class="note">Seeds cost a little; a harvest gives 3 food. Water your plants for faster growth — rain helps too!</p>` +
      Object.keys(CROPS).map(id => `<div class="arow">${foodIco(id)}<div class="ainfo"><b>${FOODS[id].name}${id === season().crop ? ' 🌟' : ''}</b><small>${id === season().crop ? 'In season: 1.5× faster · ' : ''}Ready in about ${Math.round(CROPS[id].time / 60 * 10) / 10} min · ${CROPS[id].time}s</small></div>
        ${btn('plantcrop', `$${CROPS[id].seed}`, `data-id="${id}" ${game.money < CROPS[id].seed ? 'disabled' : ''}`, 'inline')}</div>`).join('')
  },

  together: {
    title: () => '🌐 Play together',
    html: () => {
      const s = profile.settings, live = netActive(), conn = NET.status === 'connecting';
      const story = st => st && st.done ? 'Story finished ✓' : `Story ${Math.min((st && st.total) || 9, ((st && st.ch) | 0) + 1)}/${(st && st.total) || 9}`;
      let h = '';
      if (NET.err) h += `<div class="neterr">⚠️ ${esc(netErrText(NET.err))}</div>`;
      if (conn) {
        h += `<div class="summary">⏳ Connecting…<small>${NET.role === 'host' ? 'Opening your ranch' : 'Looking for the ranch ' + esc(NET.code)}</small></div>` + btn('netleave', '✕ Cancel', '', 'quiet');
        return h;
      }
      if (!live) {
        const canHost = game.state !== 'menu' && !!game.player && !game.visitor;
        h += `<p class="note">Visit a friend's ranch and play together. One player hosts (the ranch owner) and up to 3 friends join with a 5-letter code. Visitors can pet slimes, chat and emote. Everyone keeps their own save and their own story.</p>
          <div class="ssec">You</div>
          <input class="netinp" id="netName" maxlength="14" placeholder="Your name" aria-label="Your name" value="${esc(s.playerName || '')}">
          <div class="swatches">${NET_COLORS.map((c, i) => `<button data-act="netcolor" data-id="${i}" class="${s.playerColor === i ? 'on' : ''}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>
          <div class="ssec">Server</div>
          <input class="netinp" id="netUrl" maxlength="120" placeholder="Empty = built-in cloud relay (Supabase)" aria-label="Server address" value="${esc(s.netUrl || '')}" autocapitalize="none" autocomplete="off" spellcheck="false">
          <p class="note">No server needed! Leave the address empty to use the built-in free cloud relay. Advanced: you can host your own relay worker and paste its address here — everyone who plays together must use the same address.</p>
          <div class="ssec">Host</div>
          ${canHost ? btn('nethost', '🏠 Host my ranch', '', 'primary') : '<p class="note">Load your ranch first (Continue or New game), then open ☰ → Play together to host it.</p>'}
          <div class="ssec">Join a friend</div>
          <input class="netinp code" id="netCode" maxlength="5" placeholder="ABCDE" aria-label="Room code" autocapitalize="characters" autocomplete="off" spellcheck="false">
          ${btn('netjoin', '🚪 Join', '', canHost ? '' : 'primary')}`;
        return h;
      }
      const host = NET.status === 'host';
      if (host) h += `<div class="summary">Your ranch is open. Tell your friends this code:</div><div class="netcode" id="netCodeShow">${esc(NET.code)}</div>${btn('netcopy', '📋 Copy code', '', 'quiet')}`;
      else h += `<div class="summary">🏡 Visiting the ranch of <b data-notr>${esc((NET.players.get(NET.hostId) || {}).name || '')}</b><small>Room ${esc(NET.code)}</small></div>`;
      h += `<div class="ssec">Players ${NET.players.size}/${NET.max}</div>`;
      for (const p of [...NET.players.values()].sort((a, b) => a.id - b.id)) {
        h += `<div class="netrow"><span class="dot" style="background:${esc(p.color)}"></span><span class="who" data-notr>${esc(p.name)}</span><small>${p.role === 'host' ? '🏠 Ranch owner' : ''}${p.id === NET.id ? ' · You' : ''}</small><small>📖 ${esc(story(p.story))}</small></div>`;
      }
      h += `<div class="ssec">Emotes</div><div class="emotes">${NET_EMOTES.map(e => `<button data-act="netemote" data-id="${e}" aria-label="Emote">${e}</button>`).join('')}</div>
        <div class="ssec">Chat</div><div class="phrases">${NET_PHRASES.map((t, i) => `<button data-act="netsay" data-id="${i}">${t}</button>`).join('')}</div>
        <div class="chatlog">${NET.chat.length ? NET.chat.map(c => `<div><b data-notr style="color:${esc(c.color)}">${esc(c.name)}</b>: <span${NET_PHRASES.includes(c.text) ? '' : ' data-notr'}>${esc(c.text)}</span></div>`).join('') : '<small>No messages yet.</small>'}</div>
        <input class="netinp" id="netChat" maxlength="120" placeholder="Type a message…" aria-label="Chat message" autocomplete="off">
        ${btn('netsendchat', '💬 Send')}
        <div class="ssec"></div>
        ${btn('netleave', host ? '🚪 Close my ranch' : '🚪 Leave and go home', '', 'quiet')}`;
      if (host) h += '<p class="note">While you have a menu open your ranch is paused for everyone.</p>';
      return h;
    }
  },

  help: {
    title: () => '❓ How to play',
    html: () => isRtl() ? helpAr() : `
      <div class="ssec">The loop</div>
      <p class="note">🌀 <b>Hold ●</b> to gulp up slimes, glimmers and food. <b>Tap ▶</b> to throw whatever is selected (tap a slot to choose). Throw food near a slime to feed it — fed slimes make 💎 glimmers. Sell glimmers at the 🏪 market.</p>
      <div class="ssec">Jumping &amp; Jumbos</div>
      <p class="note">↑ <b>Jump</b> clears water and boulders in flight. Hop along the 🪷 lily pads to reach the pond islands and their chests. Step on a 🍄 bounce mushroom to launch high and catch floating ☁️ sky orbs. 👑 Jumbo slimes want lots of food — throw it to them! Each gives a permanent ⚡ power.</p>
      <div class="ssec">Neighbours</div>
      <p class="note">💬 Five neighbours around the map have special quests (look for the ! above their heads). Finish one and they have a new request 10 minutes later.</p>
      <div class="ssec">Challenges</div>
      <p class="note">📋 Three daily and two weekly challenges (☰ → Challenges). Claim them for coins and ⭐ star tokens; finish one daily each day to build a 🔥 streak with bonus coins. Spend stars on treats, a Star Shard or a Mystery Crate.</p>
      <div class="ssec">Market, story &amp; world</div>
      <p class="note">📈 Every dawn one glimmer is <b>in demand</b> and some days have a market event. Sell 10+ of a kind at once for a <b>bulk bonus</b>; selling lowers a price a little. 📖 The <b>story</b> (☰ → Journal) is told by the four neighbours — look for a ★. 🗺️ The world is four times bigger: the <b>Mushroom Grove</b>, <b>Sunny Prairie</b>, <b>Windy Fields</b> and the <b>Sunny Shore</b> (low tide every 6 days!). 📔 <b>Photo mode</b> and badges are in the Slime Album.</p>
      <div class="ssec">Survival ranch</div>
      <p class="note">🏕️ Choose <b>NEW SURVIVAL RANCH</b> on the title screen. Watch ❤️ health, 🍖 hunger, 💧 thirst and ⚡ stamina. Eat (R), drink at ponds (T), bandage (H), swing (X), craft (C). Gather 🪵 wood and 🌿 fibre, break boulders for 🪨 stone, get 🧶 hide from critters. Critters roam outside the ranch (more at night) and thunderstorms strike with a red warning ring. If you faint you wake at the ranch and lose 25% of your money.</p>
      <div class="ssec">Slimes are individuals</div>
      <p class="note">🐾 Every slime has its own <b>name</b>, <b>personality</b> and <b>favourite food</b>, and a rare chance of being <b>shiny</b> ✨. Rename them and keep track of everyone in ☰ → My slimes. Two <b>delighted</b> slimes of the same kind in a pen may share an egg that hatches into a <b>baby</b> 🍼 — it grows up in about three minutes and inherits personality and shininess.</p>
      <div class="ssec">Hybrids</div>
      <p class="note">🥚 Keep two <i>different</i>, delighted slimes together in a corral (feed favourites, pet them, add bedding) and they may share an egg. It hatches in a minute into a hybrid with its own look and a better glimmer. Six hybrids to find — check the Codex.</p>
      <div class="ssec">Corrals</div>
      <p class="note">🐾 Walk up to a corral sign and tap ✋ to buy or manage it. Throw slimes in to keep them there (pens have a capacity). Each pen has its own Roomier Pen, Auto-Feeder, Glimmer Basket, Cosy Bedding and fence style. 🍬 Slime Treats are a quick joy boost for any slime.</p>
      <div class="ssec">Relax &amp; explore</div>
      <p class="note">✋ <b>Interact</b> when it lights up: pet slimes (happy slimes sometimes give two glimmers), plant and harvest in the 🥕 garden, dig up ✨ glimmering spots, shop, and place decorations.<br>
      🌧️ Rain waters the garden. 🌠 On clear nights a shooting star may bring a Star Shard — or a Star slime.<br>
      📖 The Codex fills in as you discover slimes, foods and places. 🏆 Achievements pay small bonuses.</p>
      <div class="ssec">Controls</div>
      <p class="note"><b>Touch:</b> stick = move · ● gulp · ▶ throw · ↑ jump · ✋ interact · ☰ menu.<br>
      <b>Keyboard:</b> WASD/arrows move · Space jump · Shift/J gulp · K/F throw · E interact · Q/Tab or 1–9 select slot · Esc menu · M music.<br>
      <b>Mouse:</b> hold left = gulp toward the cursor · right = throw · wheel = slot.</p>
      <div class="ssec">Play together 🌐</div>
      <p class="note">Open ☰ → <b>Play together</b>. One player hosts their ranch and gets a 5-letter code; up to 3 friends type it to visit. Visitors walk, jump, pet slimes, chat and send emotes ❤️. Every player keeps their own save and story, and the story chapter 📖 is shown next to their name. When the host opens a menu the ranch pauses for everyone. Connecting runs over the built-in cloud relay — nothing to set up.</p>
      <div class="ssec">About</div>
      <p class="note">${GAME_TITLE} is an original game. All art and sound are generated placeholders (see ASSETS.md) — replace any file to restyle it.</p>`
  },

  confirm: {
    title: o => o.title || 'Are you sure?',
    html: o => `<p class="note big">${o.text}</p><div class="mlist">${btn('confirmyes', o.yesLabel || 'Yes', '', 'danger')}${btn('back', 'Cancel', '', 'quiet')}</div>`
  }
};

/* ---------------- codex cards ---------------- */
function slimeCard(id) {
  const d = SLIMES[id], e = slimeEntry(id), diet = d.food.map(f => e.ate[f] ? foodIco(f) : '<span class="unk">?</span>').join('');
  const chip = (on, t) => `<span class="chip${on ? ' on' : ''}">${on ? '✓ ' : ''}${t}</span>`;
  return `<div class="cdx${e.seen ? '' : ' locked'}">
    <span class="cdx-img${e.seen ? '' : ' dark'}" style="background-image:url(${IMAGE_FILES['slime_' + id]})"></span>
    <div class="cdx-info"><b>${e.seen ? d.name + ' slime' : '???'}${d.rare && e.seen ? ' ✨' : ''}</b>
      <div class="chips">${chip(e.seen, 'Seen')}${chip(e.caught, 'Caught')}${chip(e.plort, 'Glimmer')}${chip(e.delighted, 'Delighted')}</div>
      <small>Home: ${e.seen ? d.habitat : '???'}</small>${d.hybrid && e.seen ? `<small>Born from: ${SLIMES[d.hybrid[0]].name} + ${SLIMES[d.hybrid[1]].name}</small>` : ''}
      <small>Eats: <span class="diet">${diet}</span></small>
      <small>Favourite: ${e.ate[d.fav] ? foodIco(d.fav) + ' ' + FOODS[d.fav].name : '???'}</small>
      <small>Glimmer worth: ${e.plort ? '$' + d.plort.value : '???'}</small>
      <small class="blurb">${e.caught ? esc(d.blurb) : 'Catch one to read its story.'}</small></div></div>`;
}
function foodCard(id) {
  const got = profile.codex.foods[id], eaters = SLIME_IDS.filter(s => slimeEntry(s).ate[id]);
  return `<div class="cdx${got ? '' : ' locked'}">${iconHTML('food', id, 'lg')}<div class="cdx-info"><b>${got ? FOODS[id].name : '???'}</b>
    <small>${got ? (CROPS[id] ? 'Grows in the garden · seeds $' + CROPS[id].seed : FOODS[id].treat ? 'Sold at the market · pure joy, no glimmer' : 'Found in the wild') : 'Pick one up to discover it.'}</small>
    <small>${got ? 'Market price: $' + FOODS[id].price + ' each' : ''}</small>
    <small>${got ? 'Enjoyed by: ' + (FOODS[id].treat ? 'every slime' : eaters.length ? eaters.map(s => SLIMES[s].name).join(', ') : 'nobody you know yet') : ''}</small></div></div>`;
}
function treasureCard(id) {
  const got = profile.codex.treasures[id];
  return `<div class="cdx${got ? '' : ' locked'}">${iconHTML('treasure', id, 'lg')}<div class="cdx-info"><b>${got ? TREASURES[id].name : '???'}</b>
    <small>${got ? esc(TREASURES[id].blurb) : esc(TREASURES[id].hint || 'Dig up the glimmering spots.')}</small>
    <small>${got ? 'Worth $' + TREASURES[id].value : ''}</small></div></div>`;
}
function placeCard(id) {
  const got = profile.codex.places[id];
  return `<div class="cdx${got ? '' : ' locked'}"><span class="ico lg" style="--c:#e8d8a8;font-size:22px">${got ? PLACES[id].icon : '❔'}</span>
    <div class="cdx-info"><b>${got ? PLACES[id].name : '???'}</b><small>${got ? PLACES[id].blurb : 'Not visited yet.'}</small></div></div>`;
}
function orderIcon(o) { return { sell: '💰', collect: '🌀', harvest: '🥕', dig: '⛏️', pet: '🤚', feedfav: '❤️' }[o.kind] || '📜'; }

/* ---------------- actions ---------------- */
function applySettings() {
  const s = profile.settings;
  document.body.classList.toggle('lefty', !!s.lefty);
  applyLanguage();
  Sound.sfxOn = s.sfx; Sound.musicOn = s.music;
  refreshSoundButtons();
}
function showMainMenu() {
  game.state = 'menu';
  $('#menu').style.display = 'flex';
  const c = $('#continueBtn'); if (hasSave()) { c.style.display = 'inline-block'; c.disabled = false; } else c.style.display = 'none';
  Sound.setLoop('rain', false); Sound.setLoop('suck', false);
  Sound.updateMusic(0);
}
function askConfirm(title, text, yesLabel, yes) { openScreen('confirm', { title, text, yesLabel, yes }); }
function tryNewGame(survival) {
  if (hasSave()) askConfirm(survival ? 'Start a new Survival ranch?' : 'Start a new ranch?', 'Your saved ranch will be replaced. Achievements, codex and settings are kept.', survival ? 'Start Survival ranch' : 'Start new ranch', () => { closeModal(); startGame(true, !!survival); });
  else startGame(true, !!survival);
}

$('#mBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const cur = currentScreen(); if (!cur) return;
  const k = b.dataset.k, v = b.dataset.v, id = b.dataset.id;
  switch (b.dataset.act) {
    case 'open': openScreen(b.dataset.to); break;
    case 'back': backScreen(); break;
    case 'resume': closeModal(); break;
    case 'exit': if (game.visitor) { netLeave(null, true); break; } if (netBusy()) netLeave(null); saveGame(); saveProfile(); closeModal(); game.state = 'paused'; showMainMenu(); break;
    case 'netcolor': profile.settings.playerColor = parseInt(id, 10); saveProfile(); renderScreen(true); break;
    case 'nethost': netReadInputs(); netHost(); renderScreen(true); break;
    case 'netjoin': { netReadInputs(); const c = document.getElementById('netCode'); netJoin(c ? c.value : ''); renderScreen(true); break; }
    case 'netleave': netLeave(null); renderScreen(true); break;
    case 'netemote': netEmote(id); break;
    case 'netsay': netSay(NET_PHRASES[parseInt(id, 10)]); break;
    case 'netsendchat': { const c = document.getElementById('netChat'); if (c && netSay(c.value)) c.value = ''; break; }
    case 'netcopy': { try { navigator.clipboard.writeText(NET.code); showAlert('📋 Code copied', 1400); } catch (_) { showAlert('Code: ' + NET.code, 3000); } break; }
    case 'tab': cur.opts.tab = v; Sound.play('click', 0.5); renderScreen(); break;
    case 'tg': profile.settings[k] = !profile.settings[k]; if (k === 'sfx') Sound.setSfx(profile.settings.sfx); else if (k === 'music') Sound.setMusic(profile.settings.music);
               applySettings(); saveProfile(); Sound.play('click', 0.6); renderScreen(true); break;
    case 'seg': profile.settings[k] = parseInt(v, 10); saveProfile(); if (k === 'lang') applyLanguage(); Sound.play('click', 0.6); renderScreen(true); break;
    case 'claimch': { const w = b.dataset.w === '1', c = (w ? game.board.weekly : game.board.daily)[parseInt(b.dataset.i, 10)]; claimChallenge(c, w); renderScreen(true); break; }
    case 'redeem': redeemToken(id); renderScreen(true); break;
    case 'travel': if (travelTo(id)) closeModal(); else renderScreen(true); break;
    case 'rename': { const inp = document.getElementById('rn' + id), s = game.slimes[parseInt(id, 10)]; if (inp && s && renameSlime(s, inp.value)) { Sound.play('collect', 0.5); showAlert(`✏️ ${s.name}`, 1200); } renderScreen(true); break; }
    case 'craft': craft(id); renderScreen(true); break;
    case 'equip': equip(id); renderScreen(true); break;
    case 'photomode': closeModal(); enterPhotoMode(); break;
    case 'viewphoto': openScreen('photo', { id }); break;
    case 'delphoto': deletePhoto(id); backScreen(); break;
    case 'selframe': albumState().frame = id; profileDirty = true; saveProfile(); renderScreen(true); break;
    case 'selsticker': albumState().sticker = id; profileDirty = true; saveProfile(); renderScreen(true); break;
    case 'wrenmore': cur.opts = { i: parseInt(id, 10) }; renderScreen(true); break;
    case 'storyaccept': storyAccept(); renderScreen(true); break;
    case 'storyhandin': storyHandIn(); renderScreen(true); break;
    case 'storychoose': storyChoose(id); renderScreen(true); break;
    case 'npcaccept': npcAccept(npcState(id)); renderScreen(true); break;
    case 'npchandin': npcHandIn(npcState(id)); renderScreen(true); break;
    case 'opencorral': openScreen('corral', { id: parseInt(id, 10) }); break;
    case 'buycorral': buyCorral(game.corrals[parseInt(id, 10)]); renderScreen(true); break;
    case 'upcorral': upgradeCorral(game.corrals[cur.opts.id], k); renderScreen(true); break;
    case 'fence': buyFence(game.corrals[cur.opts.id], id); renderScreen(true); break;
    case 'loadfeed': loadFeeder(game.corrals[cur.opts.id], id); renderScreen(true); break;
    case 'collect': collectBasket(game.corrals[cur.opts.id]); renderScreen(true); break;
    case 'place': { closeModal(); placeDecor(id); break; }
    case 'plantcrop': { const plot = cur.opts.plot; closeModal(); plantCrop(plot, id); break; }
    case 'askdelsave': askConfirm('Delete ranch save?', 'This removes your saved ranch (slimes, garden, decorations). Achievements and codex stay.', 'Delete save', () => { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} try { if (typeof GloopyCloud !== 'undefined') GloopyCloud.wipe(); } catch (_) {} backScreen(); showAlert('Ranch save deleted'); if (game.state === 'menu') showMainMenu(); }); break;
    case 'askresetmeta': askConfirm('Reset progress?', 'Achievements, codex entries and lifetime stats will be cleared. Settings and your ranch stay.', 'Reset', () => {
        profile.ach = {}; profile.badges = {}; profile.stats = {}; profile.codex = { slimes: {}, foods: {}, treasures: {}, places: {}, jumbos: {} }; saveProfile(); achDirty = true; backScreen(); showAlert('Progress reset'); }); break;
    case 'confirmyes': { const f = cur.opts.yes; if (f) f(); break; }
  }
});
$('#mBody').addEventListener('input', e => {
  const r = e.target.closest('input[type=range]'); if (!r) return;
  const k = r.dataset.k; profile.settings[k] = r.value / 100;
  const lab = document.getElementById('v_' + k); if (lab) lab.textContent = r.value + '%';
  if (k === 'musicVol') Sound.updateMusic(nightAmount(game.time || 0.3));
});
function netReadInputs() {
  const n = document.getElementById('netName'), u = document.getElementById('netUrl');
  if (n) profile.settings.playerName = netClean(n.value, 14);
  if (u) profile.settings.netUrl = String(u.value || '').trim().slice(0, 120);
  saveProfile();
}
function netRefreshScreen() {                                           // redraw the Together screen but keep what is being typed
  const cur = currentScreen(); if (!cur || cur.name !== 'together') return;
  const keep = {}, act = document.activeElement;
  for (const id of ['netName', 'netUrl', 'netCode', 'netChat']) { const el = document.getElementById(id); if (el) keep[id] = el.value; }
  renderScreen(true);
  for (const id in keep) { const el = document.getElementById(id); if (el) { el.value = keep[id]; if (act && act.id === id && el.focus) el.focus(); } }
}
$('#mBody').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target || !e.target.id) return;
  if (e.target.id === 'netChat') { if (netSay(e.target.value)) e.target.value = ''; }
  else if (e.target.id === 'netCode') { netReadInputs(); netJoin(e.target.value); renderScreen(true); }
});
$('#mBody').addEventListener('change', e => {
  if (e.target && (e.target.id === 'netName' || e.target.id === 'netUrl')) { netReadInputs(); return; }
  const r = e.target.closest('input[type=range]'); if (!r) return;
  saveProfile(); if (r.dataset.k === 'sfxVol') Sound.play('collect', 0.8);
});
$('#mBack').addEventListener('click', backScreen);
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') { /* tap outside = back */ backScreen(); } });

/* title screen + HUD entry points */
$('#newBtn').addEventListener('click', () => tryNewGame(false));
$('#survBtn').addEventListener('click', () => tryNewGame(true));
$('#netBtn').addEventListener('click', () => openScreen('together'));
if ($('#fameBtn')) $('#fameBtn').addEventListener('click', () => openScreen('fame'));
$('#continueBtn').addEventListener('click', () => startGame(false));
$('#settingsBtn').addEventListener('click', () => openScreen('settings'));
$('#achBtn').addEventListener('click', () => openScreen('achievements'));
$('#codexBtn').addEventListener('click', () => openScreen('codex'));
$('#helpBtn').addEventListener('click', () => openScreen('help'));
$('#btnMenu').addEventListener('click', () => { Sound.unlock(); if (game.state === 'playing') openScreen('pause'); });
$('#questBox').addEventListener('click', () => { if (game.state === 'playing') openScreen('journal', { tab: 'orders' }); });
$('#questBox').style.pointerEvents = 'auto';

/* ---------------- world map (drawn on a 1px-per-tile canvas, scaled by CSS) ---------------- */
function drawWorldMap() {
  const cv = document.getElementById('mapCv'); if (!cv || !cv.getContext) return;
  const c = cv.getContext('2d'); if (!c) return;
  for (let x = 0; x < WORLD_W; x++) for (let y = 0; y < WORLD_H; y++) { const t = world[x][y]; c.fillStyle = (TILE_COLOR[t] || TILE_COLOR[T.GRASS])[0]; c.fillRect(x, y, 1, 1); }
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (const n of NPCS) c.fillRect(n.x - 1, n.y - 1, 3, 3);
  if (wrenVisible()) { const t = wrenTile(); c.fillStyle = '#ffb6e6'; c.fillRect(t.x - 1.5, t.y - 1.5, 4, 4); }
  c.fillStyle = '#ffd54a';
  for (const j of game.jumbos) if (slimeEntry(j.id).seen && j.state !== 'gone') c.fillRect(j.x - 1.5, j.y - 1.5, 4, 4);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#d02060'; c.lineWidth = 1.2;
  const px = game.player.x / TILE, py = game.player.y / TILE; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill(); c.stroke();
}
