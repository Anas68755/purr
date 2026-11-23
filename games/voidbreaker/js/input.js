// ============================================================
// VOID BREAKER // NEON ASCENSION — input.js
// Keyboard + mouse + touch (virtual joystick, mobile buttons).
// ============================================================
window.VB = window.VB || {};

VB.Input = (function () {
  const keys = {};
  let mouseDown = false;
  let dashQueued = false;
  let powerQueued = false;                    // ship signature power (Q)
  let shieldBtnHeld = false;
  let axisVec = { x: 0, y: 0 };               // touch joystick axis
  let touchFiring = false;
  let isTouch = false;
  let canvas = null;
  let onPauseToggle = null;                   // callback from Game
  let onMuteToggle = null;

  // ---- joystick ----
  const joy = { active: false, id: null, cx: 0, cy: 0, x: 0, y: 0 };
  const JOY_MAX = 52;

  // v5.1: swappable touch layout — when Settings › "Swap joystick / buttons"
  // is enabled the joypad lives on the RIGHT half and the action buttons are
  // mirrored to the left edge (left-handed mode).
  function swapOn() {
    return !!(VB.Settings && VB.Settings.data && VB.Settings.data.swapControls);
  }
  /** is this screen-x inside the joystick grab zone for the current layout? */
  function inJoyZone(x) {
    return swapOn() ? x > window.innerWidth * 0.45
                    : x < window.innerWidth * 0.55;
  }
  /** park the joystick base at the docked position for the current layout */
  function dockJoystick() {
    const base = document.getElementById('joyBase');
    const knob = document.getElementById('joyKnob');
    if (!base) return;
    if (swapOn()) { base.style.right = '26px'; base.style.left = 'auto'; }
    else          { base.style.left = '26px';  base.style.right = 'auto'; }
    base.style.top = 'auto'; base.style.bottom = '26px';
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  }

  function joyStart(e) {
    for (const t of e.changedTouches) {
      if (inJoyZone(t.clientX) && !joy.active) {
        joy.active = true; joy.id = t.identifier;
        joy.cx = t.clientX; joy.cy = t.clientY; joy.x = 0; joy.y = 0;
        const base = document.getElementById('joyBase');
        const knob = document.getElementById('joyKnob');
        base.style.left = (joy.cx - 60) + 'px';
        base.style.top = (joy.cy - 60) + 'px';
        base.style.bottom = 'auto';
        base.style.right = 'auto';
        knob.style.transform = 'translate(-50%,-50%)';
        touchFiring = true;                     // auto-fire while steering
      }
    }
    e.preventDefault();
  }
  function joyMove(e) {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) {
        let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy;
        const d = Math.hypot(dx, dy);
        if (d > JOY_MAX) { dx = dx / d * JOY_MAX; dy = dy / d * JOY_MAX; }
        joy.x = dx / JOY_MAX; joy.y = dy / JOY_MAX;
        document.getElementById('joyKnob').style.transform =
          'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      }
    }
    e.preventDefault();
  }
  function joyEnd(e) {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) {
        joy.active = false; joy.x = 0; joy.y = 0;
        dockJoystick();   // v5.1: layout-aware docking (left by default, right when swapped)
      }
    }
    e.preventDefault();
  }

  function init(cv, hooks) {
    canvas = cv;
    onPauseToggle = hooks.onPauseToggle;
    onMuteToggle = hooks.onMuteToggle;
    isTouch = ('ontouchstart' in window) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch) document.body.classList.add('touch');

    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (e.code === 'Space') keys[' '] = true;   // layout-independent fire
      if (e.key === ' ') e.preventDefault();
      if (e.repeat) return;
      if (k === 'e') dashQueued = true;
      if (k === 'q') powerQueued = true;
      if (k === 'p' && onPauseToggle) onPauseToggle();
      if (k === 'm' && onMuteToggle) onMuteToggle();
      if (k === 'enter') hooks.onEnter && hooks.onEnter();
    });
    window.addEventListener('keyup', function (e) {
      keys[e.key.toLowerCase()] = false;
      if (e.code === 'Space') keys[' '] = false;
    });

    canvas.addEventListener('mousedown', function () { mouseDown = true; });
    window.addEventListener('mouseup', function () { mouseDown = false; });
    canvas.addEventListener('touchstart', joyStart, { passive: false });
    canvas.addEventListener('touchmove', joyMove, { passive: false });
    canvas.addEventListener('touchend', joyEnd, { passive: false });
    canvas.addEventListener('touchcancel', joyEnd, { passive: false });

    const btnDash = document.getElementById('btnDashT');
    const btnShield = document.getElementById('btnShieldT');
    const btnPower = document.getElementById('btnPowerT');
    if (btnDash) {
      btnDash.addEventListener('touchstart', function (e) { dashQueued = true; e.preventDefault(); }, { passive: false });
    }
    if (btnPower) {
      btnPower.addEventListener('touchstart', function (e) { powerQueued = true; e.preventDefault(); }, { passive: false });
    }
    if (btnShield) {
      btnShield.addEventListener('touchstart', function (e) { shieldBtnHeld = true; e.preventDefault(); }, { passive: false });
      btnShield.addEventListener('touchend', function (e) { shieldBtnHeld = false; e.preventDefault(); }, { passive: false });
    }

    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  }

  function releaseAll() {
    for (const k in keys) keys[k] = false;
    mouseDown = false;
    touchFiring = false;
    shieldBtnHeld = false;
    powerQueued = false;
    joy.active = false; joy.x = 0; joy.y = 0;
  }

  return {
    init,
    releaseAll,
    get isTouch() { return isTouch; },
    /** v5.1 test/QA hooks for the swappable touch layout */
    swapOn,
    joyZone: function (x) { return inJoyZone(x); },
    dockJoystick,

    /** normalized movement axis, joystick has priority */
    axis() {
      if (joy.active && (joy.x !== 0 || joy.y !== 0)) return { x: joy.x, y: joy.y };
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy = -1;
      if (keys['s'] || keys['arrowdown']) dy = 1;
      if (keys['a'] || keys['arrowleft']) dx = -1;
      if (keys['d'] || keys['arrowright']) dx = 1;
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
      return { x: dx, y: dy };
    },

    get firing() {
      return !!(keys[' '] || mouseDown || touchFiring);
    },

    get shieldHeld() {
      return !!(keys['shift'] || keys['shiftleft'] || keys['shiftright'] || shieldBtnHeld);
    },

    /** consume dash request (edge-triggered) */
    consumeDash() {
      const d = dashQueued;
      dashQueued = false;
      return d;
    },

    /** consume ship-power request (edge-triggered) */
    consumePower() {
      const q = powerQueued;
      powerQueued = false;
      return q;
    },

    releaseInput: releaseAll
  };
})();
