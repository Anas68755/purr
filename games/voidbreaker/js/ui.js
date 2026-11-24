// ============================================================
// VOID BREAKER // NEON ASCENSION — ui.js  (v4.2 TITAN)
// HUD, screens, toasts, banners, settings (persisted), leaderboard,
// FPS meter, commendations panel, Boss Rush entries.
// v4.2: hull-aware leaderboard tags & game-over lines.
// ============================================================
window.VB = window.VB || {};

// ----------------------------- settings -----------------------------
VB.Settings = {
  data: {
    music: 0.7, sfx: 0.8,
    shake: true, scanlines: true, fps: false, reduced: false,
    swapControls: false,           // v5.1: touch layout — joypad right / buttons left
    haptics: true,                 // v5.2: vibration on hits/dash/pickups
    curses: [],                    // v5.2: selected nightmare curse ids
    pendingRun: null               // v5.3: challenge code armed for the next launch
  },
  load() {
    const saved = VB.U.storage.get(VB.CONFIG.STORAGE.settings, null);
    if (saved) Object.assign(this.data, saved);
  },
  save() { VB.U.storage.set(VB.CONFIG.STORAGE.settings, this.data); },
  apply() {
    VB.Audio.applyVolumes(this.data.music, this.data.sfx, false);
    VB.FX.setReduced(this.data.reduced);
    const scan = document.getElementById('scanlines');
    if (scan) scan.classList.toggle('off', !this.data.scanlines);
    const fpsBlock = document.getElementById('fpsBlock');
    if (fpsBlock) fpsBlock.style.display = this.data.fps ? 'block' : 'none';
    // v5.1: mirrored touch layout (joystick ⇄ buttons)
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('swap-controls', !!this.data.swapControls);
    }
  }
};

// -------------------------------- ui --------------------------------
VB.UI = (function () {
  const el = {};
  let displayScore = 0;
  let fpsAccum = 0, fpsFrames = 0, fpsValue = 60;
  let bannerTimer = null, bossBannerTimer = null;

  function cache() {
    const ids = ['hud', 'hudScore', 'hudCombo', 'hudWave', 'hudFps', 'comboBar',
      'shieldBar', 'dashBar', 'powerBar', 'powerFill', 'powerName', 'livesBar', 'comboPopup', 'waveAnnounce',
      'bossAnnounce', 'toastContainer', 'bossBar', 'bossName', 'bossBarFill',
      'startScreen', 'gameOverScreen', 'pauseScreen', 'settingsScreen', 'vaultScreen',
      'finalScore', 'statWave', 'statKills', 'statMaxCombo', 'statHighScore',
      'statAccuracy', 'statTime', 'newBestBanner', 'startBest',
      'startLeaderboard', 'overLeaderboard', 'upgradeScreen',
      'puRapid', 'puSpread', 'puShield', 'puPierce', 'puTime', 'errlog',
      'achvGrid', 'overModeTag', 'curseRow', 'curseMult',
      'vaultBank', 'vaultList', 'statElites', 'statBosses', 'statSalvage', 'vaultLine',
      'dailyStatus', 'debriefChart', 'runCodeLine'];
    for (const id of ids) el[id] = document.getElementById(id);
  }

  function toast(text, type) {
    if (!el.toastContainer) return;
    while (el.toastContainer.children.length > 4) el.toastContainer.removeChild(el.toastContainer.firstChild);
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = text;
    el.toastContainer.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 2500);
  }

  function announce(text, cls) {
    if (!el.waveAnnounce) return;
    el.waveAnnounce.textContent = text;
    el.waveAnnounce.className = cls ? cls : '';
    el.waveAnnounce.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      el.waveAnnounce.classList.remove('show');
    }, 2000);
  }

  function bossBanner(name) {
    if (!el.bossAnnounce) return;
    el.bossAnnounce.textContent = 'WARNING — ' + name;
    el.bossAnnounce.classList.add('show');
    clearTimeout(bossBannerTimer);
    bossBannerTimer = setTimeout(function () {
      el.bossAnnounce.classList.remove('show');
    }, 2400);
  }

  function comboPop(text) {
    if (!el.comboPopup) return;
    el.comboPopup.textContent = text;
    el.comboPopup.classList.add('show');
    setTimeout(function () { el.comboPopup.classList.remove('show'); }, 600);
  }

  function bossBar(name, ratio) {
    if (!el.bossBar) return;
    el.bossBar.style.display = 'block';
    el.bossName.textContent = name;
    el.bossBarFill.style.width = Math.max(0, ratio * 100) + '%';
  }
  function bossBarHide() {
    if (el.bossBar) el.bossBar.style.display = 'none';
  }

  function updateWave(w) {
    if (el.hudWave) el.hudWave.textContent = w;
  }

  // ----------------------------------------------------------- HUD ---
  function updateHUD(dt) {
    const g = VB.Game;
    // eased score counter
    displayScore += (g.score - displayScore) * Math.min(1, dt * 10);
    if (Math.abs(g.score - displayScore) < 1) displayScore = g.score;
    el.hudScore.textContent = VB.U.fmt(displayScore);

    el.hudCombo.textContent = 'x' + g.combo;
    el.comboBar.style.width = VB.U.clamp(g.comboTimer / VB.CONFIG.COMBO_WINDOW, 0, 1) * 100 + '%';

    const p = g.player;
    if (p) {
      el.shieldBar.style.width = VB.U.clamp(p.shieldEnergy / 100, 0, 1) * 100 + '%';
      el.dashBar.style.width = Math.max(0, 1 - p.dashCd / p.dashCdMax) * 100 + '%';
      // v4.1 FLEET: signature power charge
      if (el.powerFill) {
        const pmax = p.powerCdMax || 1;
        const frac = p.powerT > 0 ? 1 : Math.max(0, 1 - p.powerCd / pmax);
        el.powerFill.style.width = (frac * 100) + '%';
        el.powerFill.classList.toggle('active', p.powerT > 0 || p.powerCd <= 0);
      }
      if (el.powerName && p.ship) el.powerName.textContent = p.ship.power.name;
    }

    let pips = '';
    for (let i = 0; i < g.maxLives; i++) {
      pips += '<div class="life-pip' + (i >= g.lives ? ' lost' : '') + '"></div>';
    }
    el.livesBar.innerHTML = pips;

    el.puRapid.classList.toggle('active', g.timers.rapid > 0);
    el.puSpread.classList.toggle('active', g.timers.spread > 0);
    el.puShield.classList.toggle('active', g.timers.shield > 0);
    el.puPierce.classList.toggle('active', g.timers.pierce > 0);
    el.puTime.classList.toggle('active', g.timeSlowTimer > 0);

    // boss bar live update
    const bosses = VB.Enemies.list.filter(function (e) { return e.type === 'boss'; });
    if (bosses.length > 0) {
      const hp = bosses.reduce(function (s, b) { return s + Math.max(0, b.hp); }, 0);
      const maxHp = bosses.reduce(function (s, b) { return s + b.maxHp; }, 0);
      const name = bosses.length > 1 ? 'TWIN ASCENDANTS' : bosses[0].name;
      bossBar(name, maxHp > 0 ? hp / maxHp : 0);
    } else if (el.bossBar.style.display !== 'none') {
      bossBarHide();
    }
  }

  function fpsTick(dt) {
    fpsAccum += dt; fpsFrames++;
    if (fpsAccum >= 0.25) {
      fpsValue = Math.round(fpsFrames / fpsAccum);
      fpsAccum = 0; fpsFrames = 0;
      if (el.hudFps) el.hudFps.textContent = fpsValue;
    }
  }

  // ------------------------------------------------------- screens ---
  function showScreen(name) {
    const map = {
      start: el.startScreen, gameover: el.gameOverScreen,
      pause: el.pauseScreen, settings: el.settingsScreen,
      vault: el.vaultScreen
    };
    for (const k in map) {
      if (k === name) map[k].classList.remove('hidden');
      else if (k !== 'settings' || name !== null) map[k].classList.add('hidden');
    }
    if (name !== 'settings') el.settingsScreen.classList.add('hidden');
    // v5.1.1: dim out touch controls while any menu/pause/settings screen is up
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('menu-open', name !== null && name !== undefined);
    }
  }

  function renderLeaderboard(listEl, board) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!board.length) {
      const li = document.createElement('li');
      li.innerHTML = '<span>no sorties logged yet</span>';
      listEl.appendChild(li);
      return;
    }
    board.forEach(function (entry) {
      const tag = entry.m === 'rush'
        ? '<i class="lb-tag rush">RUSH</i> '
        : '';
      // v4.2: show which hull flew the sortie
      let hullTag = '';
      if (entry.h && VB.Ships && VB.Ships.SHIPS[entry.h]) {
        hullTag = ' <i class="lb-tag hull" style="color:' +
          VB.Ships.SHIPS[entry.h].color + '">' + VB.Ships.SHIPS[entry.h].name + '</i>';
      }
      const li = document.createElement('li');
      li.innerHTML = '<b>' + VB.U.fmt(entry.s) + '</b><span>' + tag + hullTag + ' W' + entry.w +
        ' &middot; ' + VB.U.fmt(entry.k) + ' kills</span>';
      listEl.appendChild(li);
    });
  }

  // ------------------------- v5.2 OMEGA -------------------------
  // nightmare curse chips on the start screen
  function initCurses() {
    if (!el.curseRow) return;
    el.curseRow.innerHTML = '';
    for (const id in VB.CONFIG.CURSES) {
      const def = VB.CONFIG.CURSES[id];
      const chip = document.createElement('div');
      chip.className = 'curse';
      chip.dataset.id = id;
      chip.title = def.desc;
      chip.innerHTML = '<span class="curse-name">' + def.name + '</span>' +
        '<span class="curse-mult">&times;' + def.mult + '</span>';
      chip.addEventListener('click', function () {
        const sel = VB.Settings.data.curses;
        const i = sel.indexOf(id);
        if (i === -1) sel.push(id); else sel.splice(i, 1);
        VB.Settings.save();
        refreshCurses();
        VB.Audio.sfx('ui_click');
      });
      el.curseRow.appendChild(chip);
    }
    refreshCurses();
  }

  function refreshCurses() {
    if (!el.curseRow) return;
    const sel = VB.Settings.data.curses;
    const chips = el.curseRow.querySelectorAll('.curse');
    chips.forEach(function (c) {
      c.classList.toggle('on', sel.indexOf(c.dataset.id) !== -1);
    });
    if (el.curseMult) {
      let m = 1;
      for (const id of sel) m *= VB.CONFIG.CURSES[id].mult;
      el.curseMult.textContent = sel.length
        ? 'CURSE SCORE ×' + m.toFixed(2)
        : 'NO CURSES — BASE SCORE';
      el.curseMult.classList.toggle('hot', sel.length > 0);
    }
  }

  // salvage vault screen
  function renderVault() {
    if (!el.vaultList) return;
    el.vaultBank.textContent = VB.U.fmt(VB.Vault.bank);
    el.vaultList.innerHTML = '';
    for (const id in VB.CONFIG.VAULT.ITEMS) {
      const def = VB.CONFIG.VAULT.ITEMS[id];
      const lv = VB.Vault.level(id);
      const maxed = lv >= def.max;
      const price = maxed ? null : VB.Vault.cost(id);
      const afford = !maxed && VB.Vault.bank >= price;
      let pips = '';
      for (let i = 0; i < def.max; i++) {
        pips += '<span class="pip' + (i < lv ? ' on' : '') + '"></span>';
      }
      const row = document.createElement('div');
      row.className = 'vault-item' + (maxed ? ' maxed' : '');
      row.innerHTML =
        '<div class="vault-info">' +
          '<div class="vault-name">' + def.name + '</div>' +
          '<div class="vault-desc">' + def.desc + '</div>' +
          '<div class="card-pips">' + pips + '</div>' +
        '</div>' +
        '<div class="vault-buy">' +
          (maxed
            ? '<span class="vault-max">MAXED</span>'
            : '<button class="btn small" ' + (afford ? '' : 'disabled') + '>' +
                VB.U.fmt(price) + ' SLV</button>') +
        '</div>';
      if (!maxed) {
        row.querySelector('button').addEventListener('click', function () {
          if (VB.Vault.buy(id)) {
            VB.UI.toast(def.name + ' LV' + VB.Vault.level(id), 'milestone');
            renderVault();
            refreshStart();
          } else {
            VB.Audio.sfx('ui_hover');
          }
        });
      }
      el.vaultList.appendChild(row);
    }
  }

  function refreshStart() {
    const best = VB.U.storage.get(VB.CONFIG.STORAGE.best, 0);
    const bestRush = VB.U.storage.get(VB.CONFIG.STORAGE.bestRush, 0);
    el.startBest.textContent = 'BEST ' + VB.U.fmt(best) +
      (bestRush > 0 ? ' &middot; RUSH ' + VB.U.fmt(bestRush) : '');
    renderLeaderboard(el.startLeaderboard, VB.U.storage.get(VB.CONFIG.STORAGE.board, []));
    if (VB.Achievements) VB.Achievements.renderPanel(el.achvGrid);
    // v5.2: keep the vault chip + curse selection in sync
    const vaultBtn = document.getElementById('vaultBtn');
    if (vaultBtn) vaultBtn.textContent = VB.Vault.bankLabel();
    refreshCurses();
    refreshDaily();
  }

  // ------------------- v5.3 HORIZON -------------------
  // Daily Void status chip under the launch buttons
  function refreshDaily() {
    if (!el.dailyStatus) return;
    const d = VB.U.storage.get(VB.CONFIG.STORAGE.daily, null);
    const stamp = VB.U.code.dailyStamp();
    if (d && d.date === stamp) {
      el.dailyStatus.textContent = 'TODAY: ' + VB.U.fmt(d.score) + ' PTS · W' + d.wave;
      el.dailyStatus.classList.add('done');
    } else {
      el.dailyStatus.textContent = stamp + ' — NOT FLOWN YET';
      el.dailyStatus.classList.remove('done');
    }
  }

  // challenge code row: load a friend's seed, or copy a fresh one
  function bindCodeRow() {
    const input = document.getElementById('codeInput');
    const applyBtn = document.getElementById('codeApply');
    const copyBtn = document.getElementById('codeCopy');
    if (!input || !applyBtn) return;
    function applyCode() {
      const raw = input.value;
      const parsed = VB.U.code.decode(raw);
      if (!parsed) {
        VB.UI.toast('UNKNOWN CODE — format SEED.CCC.M', 'danger');
        VB.Audio.sfx('ui_hover');
        return;
      }
      VB.Settings.data.pendingRun = { seed: parsed.seed, curses: parsed.curses, mode: parsed.mode };
      VB.Settings.data.curses = parsed.curses.slice();
      VB.Settings.save();
      refreshCurses();
      VB.Audio.sfx('ui_pick');
      VB.UI.toast('CODE LOCKED — ' + raw.toUpperCase() +
        (parsed.mode === 'rush' ? ' · PRESS BOSS RUSH' : ' · PRESS LAUNCH'), 'milestone');
    }
    applyBtn.addEventListener('click', applyCode);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') applyCode();
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      const code = VB.U.code.encode(VB.U.code.newSeed(), VB.Settings.data.curses, 'classic');
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code);
          copied = true;
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch (err) { copied = false; }
      VB.UI.toast(copied ? 'CODE COPIED — ' + code : 'CODE — ' + code, 'milestone');
      VB.Audio.sfx('ui_click');
    });
  }

  // debrief timeline: one bar per cleared wave (kills up, red tick = hit)
  function renderDebrief(waveLog) {
    if (!el.debriefChart) return;
    el.debriefChart.innerHTML = '';
    if (!waveLog || !waveLog.length) {
      const empty = document.createElement('div');
      empty.className = 'tl-empty';
      empty.textContent = 'No waves cleared — the void keeps its secrets.';
      el.debriefChart.appendChild(empty);
      return;
    }
    let maxK = 1;
    for (const x of waveLog) if (x.k > maxK) maxK = x.k;
    for (const entry of waveLog) {
      const bar = document.createElement('div');
      bar.className = 'tl-bar' + (entry.hit ? ' hit' : '') + (entry.partial ? ' partial' : '');
      const hPct = Math.max(10, Math.round(entry.k / maxK * 100));
      bar.innerHTML =
        '<div class="tl-kills">' + entry.k + '</div>' +
        '<div class="tl-fill" style="height:' + hPct + '%"></div>' +
        '<div class="tl-wave">W' + entry.w + (entry.hit ? ' <i class="tl-hittick"></i>' : '') + '</div>';
      el.debriefChart.appendChild(bar);
    }
  }

  function showGameOver(stats) {
    el.finalScore.textContent = VB.U.fmt(stats.score);
    el.statWave.textContent = stats.wave;
    el.statKills.textContent = stats.kills;
    el.statMaxCombo.textContent = 'x' + stats.maxCombo;
    el.statAccuracy.textContent = stats.accuracy + '%';
    el.statTime.textContent = VB.U.fmtTime(stats.time);
    el.statHighScore.textContent = VB.U.fmt(stats.best);
    // v5.2 OMEGA debrief: elites / bosses / salvage banked
    if (el.statElites) el.statElites.textContent = stats.elites;
    if (el.statBosses) el.statBosses.textContent = stats.bosses;
    if (el.statSalvage) el.statSalvage.textContent = '+' + stats.salvage;
    if (el.vaultLine) {
      el.vaultLine.textContent = 'SALVAGE BANKED +' + VB.U.fmt(stats.salvage) +
        ' · VAULT ' + VB.U.fmt(VB.Vault.bank);
      el.vaultLine.classList.toggle('gain', stats.salvage > 0);
    }
    el.newBestBanner.classList.toggle('hidden', !stats.newBest);
    if (el.overModeTag) {
      el.overModeTag.textContent = (stats.mode === 'rush' ? 'BOSS RUSH GAUNTLET' : 'CLASSIC ASCENSION') +
        (stats.hull ? ' — ' + stats.hull : '') +
        (stats.curseN > 0 ? ' — ' + stats.curseN + ' CURSES ×' + stats.curseMult.toFixed(2) : '');
      el.overModeTag.classList.toggle('rush', stats.mode === 'rush');
      el.overModeTag.classList.toggle('cursed', stats.curseN > 0);
    }
    renderLeaderboard(el.overLeaderboard, VB.U.storage.get(VB.CONFIG.STORAGE.board, []));
    // v5.3 HORIZON debrief: sortie timeline + the run's share code
    renderDebrief(stats.waveLog);
    if (el.runCodeLine) {
      if (stats.source === 'daily') {
        el.runCodeLine.textContent = 'DAILY VOID ' + VB.U.code.dailyStamp() +
          ' — every pilot flies the same gauntlet today';
        el.runCodeLine.className = 'run-code daily';
      } else {
        el.runCodeLine.textContent = 'RUN CODE ' + stats.runCode +
          ' — load it on the start screen to fly this exact gauntlet';
        el.runCodeLine.className = 'run-code';
      }
    }
    showScreen('gameover');
  }

  // ------------------------------------------------------ settings ---
  function bindSettings() {
    const d = VB.Settings.data;
    const music = document.getElementById('setMusic');
    const sfx = document.getElementById('setSfx');
    const shake = document.getElementById('setShake');
    const scan = document.getElementById('setScan');
    const fps = document.getElementById('setFps');
    const red = document.getElementById('setReduced');
    const swap = document.getElementById('setSwap');
    const hap = document.getElementById('setHaptics');

    music.value = Math.round(d.music * 100);
    sfx.value = Math.round(d.sfx * 100);
    shake.checked = d.shake; scan.checked = d.scanlines;
    fps.checked = d.fps; red.checked = d.reduced;
    if (swap) swap.checked = !!d.swapControls;
    if (hap) hap.checked = !!d.haptics;
    document.getElementById('setMusicVal').textContent = music.value;
    document.getElementById('setSfxVal').textContent = sfx.value;

    music.addEventListener('input', function () {
      d.music = music.value / 100;
      document.getElementById('setMusicVal').textContent = music.value;
      VB.Settings.apply(); VB.Settings.save();
    });
    sfx.addEventListener('input', function () {
      d.sfx = sfx.value / 100;
      document.getElementById('setSfxVal').textContent = sfx.value;
      VB.Settings.apply(); VB.Settings.save();
      VB.Audio.sfx('ui_click');
    });
    shake.addEventListener('change', function () { d.shake = shake.checked; VB.Settings.apply(); VB.Settings.save(); });
    scan.addEventListener('change', function () { d.scanlines = scan.checked; VB.Settings.apply(); VB.Settings.save(); });
    fps.addEventListener('change', function () { d.fps = fps.checked; VB.Settings.apply(); VB.Settings.save(); });
    red.addEventListener('change', function () { d.reduced = red.checked; VB.Settings.apply(); VB.Settings.save(); });
    if (hap) hap.addEventListener('change', function () {
      d.haptics = hap.checked;
      VB.Settings.apply(); VB.Settings.save();
      if (d.haptics) VB.U.vibrate(30);
      VB.Audio.sfx('ui_click');
    });
    if (swap) swap.addEventListener('change', function () {
      d.swapControls = swap.checked;
      VB.Settings.apply(); VB.Settings.save();
      if (VB.Input && VB.Input.dockJoystick) VB.Input.dockJoystick();
      VB.UI.toast(swap.checked ? 'TOUCH LAYOUT: JOYPAD RIGHT / BUTTONS LEFT' : 'TOUCH LAYOUT: JOYPAD LEFT / BUTTONS RIGHT', 'info');
      VB.Audio.sfx('ui_click');
    });
  }

  function err(msg) {
    if (el.errlog) {
      el.errlog.textContent = (el.errlog.textContent + ' | ' + msg).slice(-300);
    }
  }

  function init() {
    cache();
    VB.Settings.load();
    bindSettings();
    bindCodeRow();
    VB.Settings.apply();
    initCurses();
    refreshStart();
  }

  return {
    init, toast, announce, bossBanner, comboPop,
    bossBar, bossBarHide, updateWave, updateHUD, fpsTick,
    showScreen, refreshStart, showGameOver, err,
    renderVault, refreshCurses, refreshDaily, renderDebrief
  };
})();
