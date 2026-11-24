// ============================================================
// VOID BREAKER // NEON ASCENSION — upgrades.js  (v5.3 HORIZON)
// Between-wave upgrade draft: 48 enhancements, pick 1 of 3.
// Tiers: core stats / weapons / drones / defense / utility / economy.
// v5.3: CARD EVOLUTION — max out two paired cards and the next draft
// offers a golden EVOLVED card that fuses them into something greater.
// ============================================================
window.VB = window.VB || {};

VB.Upgrades = (function () {

  const POOL = [
    // ---- core stats ----
    { id: 'damage',     icon: 'DMG', name: 'Damage Up',        desc: 'Bullet damage +1',                     color: '#ff5470', max: 9 },
    { id: 'fireRate',   icon: 'RTE', name: 'Fire Rate Up',     desc: 'Faster shooting',                      color: '#ffc857', max: 7 },
    { id: 'speed',      icon: 'SPD', name: 'Thrusters',        desc: 'Movement speed +20',                   color: '#58f6ff', max: 6 },
    { id: 'shieldRegen',icon: 'REG', name: 'Aegis Regen',      desc: 'Shield recharges faster',              color: '#58f6ff', max: 5 },
    { id: 'bulletSize', icon: 'SIZ', name: 'Heavy Rounds',     desc: 'Larger bullets',                       color: '#ff8a3d', max: 5 },
    { id: 'extraLife',  icon: '+HP', name: 'Reinforce',        desc: 'Gain 1 life (up to 6)',                color: '#4dffa6', max: 2 },
    // ---- weapons ----
    { id: 'piercing',   icon: 'PRC', name: 'Piercing Shots',   desc: 'Bullets pass through +1 enemy',        color: '#c86bff', max: 3 },
    { id: 'crit',       icon: 'CRT', name: 'Critical Matrix',  desc: '+8% crit chance (2.5x damage)',        color: '#ffc857', max: 5 },
    { id: 'twinShot',   icon: 'TWN', name: 'Twin Cannons',     desc: '+1 extra cannon pair per level',       color: '#ff8a3d', max: 3 },
    { id: 'velocity',   icon: 'VEL', name: 'Rail Accelerator', desc: 'Bullet speed +20%, damage +0.5',       color: '#58f6ff', max: 3 },
    { id: 'ricochet',   icon: 'RCH', name: 'Ricochet Rounds',  desc: 'Bullets bounce off walls +1 time',     color: '#c86bff', max: 2 },
    { id: 'explosive',  icon: 'BOOM',name: 'Fusion Warheads',  desc: 'Kills explode, splash nearby foes',    color: '#ff8a3d', max: 3 },
    { id: 'bountyHunter',icon:'MRK', name: 'Marked Prey',      desc: 'Elites & bosses take +15% damage',     color: '#ff5470', max: 3 },
    // ---- weapons (v4.0) ----
    { id: 'cryo',       icon: 'CRY', name: 'Cryo Rounds',      desc: 'Hits chill foes: -18% speed & fire',   color: '#8fe8ff', max: 3 },
    { id: 'arc',        icon: 'ARC', name: 'Arc Conductor',    desc: 'Kills lightning-zap nearby foes',      color: '#ffe08a', max: 3 },
    { id: 'execute',    icon: 'EXE', name: 'Executioner',      desc: 'Foes under 12% HP die on hit',         color: '#ff5470', max: 2 },
    { id: 'blossom',    icon: 'BLM', name: 'Death Blossom',    desc: 'Kills may burst into petal shots',     color: '#ff7ab8', max: 3 },
    { id: 'singularity',icon: 'SNG', name: 'Singularity Rounds',desc: 'Every 6th shot warps space, pulling foes', color: '#c86bff', max: 2 },
    { id: 'focus',      icon: 'FCS', name: 'Focus Lens',       desc: 'Stand still to stack +damage',         color: '#58f6ff', max: 3 },
    // ---- drones & missiles ----
    { id: 'drones',     icon: 'ORB', name: 'Orbital Drone',    desc: 'A drone orbits and auto-fires',        color: '#58f6ff', max: 3 },
    { id: 'homing',     icon: 'MSL', name: 'Seeker Pods',      desc: 'Homing missiles every few seconds',    color: '#ffc857', max: 3 },
    { id: 'buzzsaw',    icon: 'SAW', name: 'Buzz Saws',        desc: 'Orbiting saw blades shred on contact', color: '#ff9a54', max: 3 },
    // ---- defense & utility ----
    { id: 'magnetRange',icon: 'MAG', name: 'Magnet Core',      desc: 'Attract nearby power-ups',             color: '#ff9a54', max: 3 },
    { id: 'dashMaster', icon: 'DSH', name: 'Phase Engine',     desc: 'Dash cooldown -12%, dash hurts',       color: '#ff8a3d', max: 3 },
    { id: 'shockwave',  icon: 'NVA', name: 'Nova Pulse',       desc: 'Dashing blasts nearby enemies',        color: '#ffc857', max: 3 },
    { id: 'thorns',     icon: 'AUR', name: 'Static Aura',      desc: 'Contact burns attackers (2+2/lv)',     color: '#8fb7ff', max: 3 },
    { id: 'timeWarp',   icon: 'CHR', name: 'Chrono Field',     desc: 'Enemy bullets fly 10% slower',         color: '#58a6ff', max: 3 },
    { id: 'overdrive',  icon: 'OVD', name: 'Adrenaline Core',  desc: 'Low lives: faster fire & movement',    color: '#ff5470', max: 2 },
    { id: 'secondWind', icon: 'PHX', name: 'Phoenix Protocol', desc: 'Cheat death once per boss wave',       color: '#4dffa6', max: 1 },
    // ---- defense & utility (v4.0) ----
    { id: 'ghostDash',  icon: 'GHO', name: 'Ghost Shell',      desc: 'Dash phasing lasts +0.5s per level',   color: '#eafcff', max: 2 },
    { id: 'retaliation',icon: 'RTB', name: 'Retaliation Matrix',desc: 'Taking damage fires a counter-nova',  color: '#ff8a3d', max: 2 },
    { id: 'reflect',    icon: 'RVN', name: 'Aegis Reversal',   desc: 'Shield-blocked shots recharge it',     color: '#58f6ff', max: 2 },
    { id: 'ablative',   icon: 'ABL', name: 'Ablative Plating', desc: 'Every 25s negate the next hit',        color: '#8fb7ff', max: 2 },
    { id: 'overclock',  icon: 'OC',  name: 'Overclock Reactor',desc: 'First 4s of a wave: faster fire',      color: '#ffc857', max: 2 },
    // ---- economy ----
    { id: 'goldRush',   icon: 'GLD', name: 'Fortune Module',   desc: '+15% score, +25% power-up drops',      color: '#ffc857', max: 3 },
    { id: 'salvage',    icon: 'SLV', name: 'Salvage Drones',   desc: 'Every 25 kills grants +1 life',        color: '#4dffa6', max: 2 },
    // ---- v4.2 TITAN ----
    { id: 'stunner',    icon: 'EMP', name: 'Arc Stunner',      desc: 'Every 10th shot EMPs & stuns nearby foes', color: '#ffe86b', max: 2 },
    { id: 'vampire',    icon: 'LCH', name: 'Leech Protocol',   desc: 'Crit hits recharge your shield',       color: '#6effc4', max: 2 },
    { id: 'orbital',    icon: 'OBT', name: 'Orbital Lance',    desc: 'A beam strikes the nearest foe every 8s', color: '#c86bff', max: 3 },
    { id: 'proximity',  icon: 'WRD', name: 'Proximity Ward',   desc: 'Kills may leave a friendly mine',      color: '#6effc4', max: 3 },
    { id: 'glassCannon',icon: 'GLS', name: 'Glass Protocol',   desc: '+60% damage, but max lives -1',        color: '#ff5470', max: 1 },
    { id: 'platedHull', icon: 'TIT', name: 'Titanium Hull',    desc: '+1 max life, heal 1',                  color: '#8fb7ff', max: 2 },
    // ---- v5.0 ABYSS ----
    { id: 'comboMaster',icon: 'CMB', name: 'Combo Catalyst',   desc: 'Combo window +0.6s per level',         color: '#58ffd1', max: 3 },
    { id: 'sustained',  icon: 'SUS', name: 'Sustain Field',    desc: 'Power-up timers drain 20% slower',     color: '#8fe8ff', max: 3 },
    { id: 'barrage',    icon: 'BRD', name: 'Broadside Array',  desc: 'Side cannons volley every few seconds',color: '#ff9a54', max: 3 },
    { id: 'deadEye',    icon: 'DEA', name: 'Deadeye Suite',    desc: 'Critical hits deal +50% damage',       color: '#ffc857', max: 3 },
    { id: 'overchargeCap',icon:'SRG',name: 'Surge Capacitor',  desc: 'Combo x10+: faster fire & thrust',     color: '#ffe86b', max: 2 },
    { id: 'guardianRing',icon:'GRD', name: 'Guardian Ring',    desc: 'Orbiting wards collapse enemy shots',  color: '#e8f0ff', max: 2 }
  ];

  function byId(id) {
    for (const u of POOL) if (u.id === id) return u;
    return null;
  }

  // ---------------- v5.3 HORIZON: CARD EVOLUTION -------------------------
  // Each evolution fuses two specific cards, both at MAX level, into one
  // golden card with bespoke wiring across player/bullets/game code.
  const EVOLUTIONS = [
    { id: 'omegaArray',     name: 'OMEGA ARRAY',      icon: 'OMA', color: '#ffc857',
      parents: ['twinShot', 'fireRate'],
      desc: 'Every cannon, one trigger: +1 cannon pair, 25% faster trigger, +1 damage.', max: 1 },
    { id: 'singularityCore', name: 'SINGULARITY CORE', icon: 'SGC', color: '#c86bff',
      parents: ['explosive', 'singularity'],
      desc: 'Every kill implodes — yanks foes inward and scours them with a heavy blast.', max: 1 },
    { id: 'nanoSwarm',      name: 'NANO SWARM',       icon: 'NSW', color: '#58f6ff',
      parents: ['drones', 'buzzsaw'],
      desc: '+2 drones (max 5), saws grow a blade, drones fire 40% faster.', max: 1 },
    { id: 'aegisCitadel',   name: 'AEGIS CITADEL',    icon: 'AGC', color: '#8fb7ff',
      parents: ['shieldRegen', 'reflect'],
      desc: 'Shield regenerates twice as fast; every block detonates a counter-nova.', max: 1 },
    { id: 'warpDriver',     name: 'WARP DRIVER',      icon: 'WRD', color: '#4dffa6',
      parents: ['dashMaster', 'ghostDash'],
      desc: 'Dash cooldown halved, phasing +1s, dash contact damage quadrupled.', max: 1 },
    { id: 'stormChorus',    name: 'STORM CHORUS',     icon: 'STC', color: '#ffe08a',
      parents: ['arc', 'blossom'],
      desc: 'Kills chain lightning twice as far and sprays four extra petals.', max: 1 }
  ];

  function evoById(id) {
    for (const ev of EVOLUTIONS) if (ev.id === id) return ev;
    return null;
  }

  /** an evolution is craftable once both parent cards sit at MAX level */
  function evoReady(ev, levels) {
    if ((levels[ev.id] || 0) >= ev.max) return false;
    return ev.parents.every(function (pid) {
      const def = byId(pid);
      return def && (levels[pid] || 0) >= def.max;
    });
  }

  function offer() {
    const g = VB.Game;
    g.state = 'upgrade';
    g.upgradePending = true;

    // choose 3 distinct upgrades that are not maxed
    // (v5.2 QUARTERMASTER vault perk: drafts offer a 4th card)
    const slots = 3 + (VB.Vault ? VB.Vault.draftSlots() - 3 : 0);
    const avail = POOL.filter(function (u) {
      return (g.upgrades[u.id] || 0) < u.max;
    });
    const choices = [];
    const poolCopy = avail.slice();
    while (choices.length < slots && poolCopy.length) {
      const i = Math.floor(Math.random() * poolCopy.length);
      choices.push(poolCopy.splice(i, 1)[0]);
    }

    // v5.3: if an evolution is craftable, it takes an extra golden slot
    let evoOffered = null;
    for (const ev of EVOLUTIONS) {
      if (evoReady(ev, g.upgrades)) { evoOffered = ev; break; }
    }

    const container = document.getElementById('upgradeCards');
    container.innerHTML = '';
    const allChoices = evoOffered ? choices.concat([evoOffered]) : choices;
    allChoices.forEach(function (up, idx) {
      const isEvo = !!evoById(up.id);
      const lvl = g.upgrades[up.id] || 0;
      // level pips: filled = owned, pulsing = next
      let pips = '';
      for (let i = 0; i < up.max; i++) {
        pips += '<span class="pip' + (i < lvl ? ' on' : (i === lvl ? ' next' : '')) + '"></span>';
      }
      const card = document.createElement('div');
      card.className = 'upgrade-card' + (isEvo ? ' evolve' : '');
      card.style.setProperty('--c', up.color);
      card.style.setProperty('--c-soft', up.color + '59');
      card.style.setProperty('--c-faint', up.color + '1f');
      if (isEvo) {
        const names = up.parents.map(function (pid) {
          const pd = byId(pid); return pd ? pd.name : pid;
        });
        card.innerHTML =
          '<span class="card-key">' + (idx + 1) + '</span>' +
          '<span class="card-evo">EVOLVED</span>' +
          '<div class="card-medal"><span>' + up.icon + '</span></div>' +
          '<div class="upgrade-name">' + up.name + '</div>' +
          '<div class="upgrade-desc">' + up.desc + '</div>' +
          '<div class="evo-parents">' + names.join(' + ') + '</div>';
      } else {
        card.innerHTML =
          '<span class="card-key">' + (idx + 1) + '</span>' +
          '<span class="card-lvl">LV ' + lvl + '</span>' +
          '<div class="card-medal"><span>' + up.icon + '</span></div>' +
          '<div class="upgrade-name">' + up.name + '</div>' +
          '<div class="upgrade-desc">' + up.desc + '</div>' +
          '<div class="card-pips">' + pips + '</div>';
      }
      card.addEventListener('click', function () { apply(up.id, allChoices); });
      container.appendChild(card);
    });

    VB.Audio.sfx('ui_open');
    document.getElementById('upgradeScreen').classList.add('show');
    // subheader flips to evolution mode so the golden card reads as special
    const sub = document.getElementById('upgradeSub');
    if (sub) {
      sub.textContent = evoOffered
        ? 'EVOLUTION AVAILABLE — ' + evoOffered.name + ' is craftable'
        : 'Choose your enhancement — click or press 1 / 2 / 3';
    }
    g._upgradeChoices = allChoices;
  }

  /** keyboard shortcut while drafting */
  function pickByIndex(idx) {
    const g = VB.Game;
    if (g.state !== 'upgrade' || !g._upgradeChoices) return;
    const up = g._upgradeChoices[idx];
    if (up) apply(up.id, g._upgradeChoices);
  }

  function apply(id, choices) {
    const g = VB.Game;
    g.upgrades[id] = (g.upgrades[id] || 0) + 1;
    if (id === 'extraLife') g.lives = Math.min(g.maxLives, g.lives + 1);
    if (id === 'shieldRegen' && g.player) g.player.shieldEnergy = 100;
    if (id === 'drones') {
      if (g.player && g.player.drones.length < 3) {
        g.player.drones.push({ angle: Math.random() * Math.PI * 2 });
      }
    }
    // v4.2 Titanium Hull: raise the ceiling and patch the plating
    if (id === 'platedHull') {
      g.maxLives = Math.min(9, g.maxLives + 1);
      g.lives = Math.min(g.maxLives, g.lives + 1);
    }
    // v4.2 Glass Protocol: raw power at the cost of a hull cell
    if (id === 'glassCannon') {
      g.maxLives = Math.max(2, g.maxLives - 1);
      g.lives = Math.min(g.lives, g.maxLives);
    }
    // ---------------- v5.3 CARD EVOLUTION wirings ----------------
    if (evoById(id)) {
      if (id === 'nanoSwarm' && g.player) {
        // two extra drones join the orbit (cap raised to 5)
        while (g.player.drones.length < 5) {
          g.player.drones.push({ angle: Math.random() * Math.PI * 2 });
        }
      }
      if (id === 'aegisCitadel' && g.player) g.player.shieldEnergy = 100;
      if (VB.Achievements) VB.Achievements.on('evolve');
      VB.FX.screenFlash(0.3, '#ffc857');
      VB.FX.ring(g.player ? g.player.x : 0, g.player ? g.player.y : 0, '#ffc857', 220, 0.6);
      VB.Audio.sfx('orbital');
    }
    VB.Player.refreshStats();

    const up = evoById(id) || byId(id);
    VB.UI.toast(up.name + (evoById(id) ? ' — EVOLVED' : ' (Lv' + g.upgrades[id] + ')'),
      evoById(id) ? 'milestone' : 'info');
    VB.Audio.sfx('ui_pick');

    document.getElementById('upgradeScreen').classList.remove('show');
    g.upgradePending = false;
    g._upgradeChoices = null;
    g.state = 'playing';
    g.musicCheck();
    VB.Waves.startWave(VB.Waves.wave + 1);
  }

  return { offer, apply, pickByIndex, POOL, EVOLUTIONS, evoById, evoReady };
})();
