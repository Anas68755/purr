// ============================================================
// VOID BREAKER // NEON ASCENSION — powerups.js
// Weighted drops: rapid / spread / shield / pierce / time / life / nuke
// ============================================================
window.VB = window.VB || {};

VB.Powerups = (function () {
  const list = [];

  function spawn(x, y, forceType) {
    const P = VB.CONFIG.POWERUPS;
    const weights = {};
    for (const k in P) weights[k] = P[k].weight;
    const type = forceType || VB.U.weightedPick(weights);
    const def = P[type];
    list.push({
      x, y, type, color: def.color, label: def.label,
      vy: 55, time: 0, size: 13
    });
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.y += p.vy * dt; p.time += dt;
      if (p.y > VB.Game.H + 30) list.splice(i, 1);
    }
  }

  function draw(ctx) {
    VB.Render.drawPowerups(ctx, list);
  }

    function collect(p) {
    const g = VB.Game;
    const P = VB.CONFIG.POWERUPS;
    // v5.3 POWER LEAK curse: active power-ups drain at double speed
    const leak = (g.curses && g.curses.overload) ? 0.5 : 1;
    VB.U.vibrate(30);   // v5.2 OMEGA: haptic pickup confirmation
    switch (p.type) {
      case 'rapid': g.timers.rapid = P.rapid.dur * leak; break;
      case 'spread': g.timers.spread = P.spread.dur * leak; break;
      case 'shield':
        g.timers.shield = P.shield.dur * leak;
        if (g.player) g.player.shieldEnergy = 100;
        VB.Audio.sfx('shield_up');
        break;
      case 'pierce': g.timers.pierce = P.pierce.dur * leak; break;
      case 'time': g.setTimeSlow(P.time.dur * leak); break;
      case 'life':
        g.lives = Math.min(g.maxLives, g.lives + 1);
        VB.Audio.sfx('powerup_life');
        break;
      case 'nuke': g.applyNuke(); break;
    }
    if (p.type !== 'shield' && p.type !== 'life' && p.type !== 'nuke') {
      VB.Audio.sfx('powerup');
    }
    if (p.type !== 'nuke') {
      VB.UI.toast(P[p.type].name + (leak < 1 ? ' — LEAKING' : ''), 'info');
      VB.FX.explosion(p.x, p.y, p.color, 8, 100);
    }
  }

  function clearAll() { list.length = 0; }

  return { list, spawn, update, draw, collect, clearAll };
})();
