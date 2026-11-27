'use strict';
/* Desktop controls.
   Mouse:    move = aim • hold LEFT = suck • RIGHT = throw • wheel = change slot
   Keyboard: WASD/arrows move • Space jump • Shift/J suck • K/F throw • 1-9 or Q/Tab slot • E interact • Esc menu • M music */
const input = {
  mx: 0, my: 0,
  suck: false, shoot: false, shootTap: false, jump: false,
  mouseX: 0, mouseY: 0, hasMouse: false,
  mouseSuck: false, keySuck: false, mouseShoot: false, keyShoot: false
};
const keys = {};
const syncInput = () => { input.suck = input.mouseSuck || input.keySuck; input.shoot = input.mouseShoot || input.keyShoot; };

(function mouse() {
  const cv = $('#gc');
  window.addEventListener('mousemove', e => { input.mouseX = e.clientX; input.mouseY = e.clientY; input.hasMouse = true; });
  cv.addEventListener('mousedown', e => {
    Sound.unlock(); input.mouseX = e.clientX; input.mouseY = e.clientY; input.hasMouse = true;
    if (e.button === 0) input.mouseSuck = true;
    if (e.button === 2) { input.mouseShoot = true; input.shootTap = true; }
    syncInput(); e.preventDefault();
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) input.mouseSuck = false;
    if (e.button === 2) input.mouseShoot = false;
    syncInput();
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); cyclePack(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());
})();

/* ---------------- touch / pointer controls ---------------- */
(function touchControls() {
  const zone = $('#joystickZone'), knob = $('#joystickKnob');
  let pid = null;
  function stick(e) {
    const r = zone.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const maxR = r.width / 2 - 26, len = Math.hypot(dx, dy);
    if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.mx = dx / maxR; input.my = dy / maxR;
  }
  function release() {
    pid = null; input.mx = 0; input.my = 0;
    knob.style.transform = 'translate(-50%,-50%)';
  }
  zone.addEventListener('pointerdown', e => {
    if (pid !== null) return;
    pid = e.pointerId; try { zone.setPointerCapture(pid); } catch (_) {}
    Sound.unlock(); stick(e); e.preventDefault();
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === pid) stick(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t =>
    zone.addEventListener(t, e => { if (e.pointerId === pid) release(); }));

  function hold(id, on, off, tap) {
    const b = $(id); let held = null;
    const down = e => {
      if (held !== null) return;
      held = e.pointerId; try { b.setPointerCapture(held); } catch (_) {}
      b.classList.add('pressed'); Sound.unlock();
      if (navigator.vibrate && profile.settings.vibrate) navigator.vibrate(12);
      on(); if (tap) tap(); e.preventDefault();
    };
    const up = e => { if (e.pointerId !== held) return; held = null; b.classList.remove('pressed'); off(); };
    b.addEventListener('pointerdown', down);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
  }
  hold('#suckBtn',  () => { input.suck = true;  }, () => { input.suck = false;  });
  hold('#shootBtn', () => { input.shoot = true; }, () => { input.shoot = false; }, () => { input.shootTap = true; });
  hold('#jumpBtn',  () => { input.jump = true;  }, () => { input.jump = false;  });
  window.addEventListener('blur', release);
})();

/* Mouse aim: while the mouse button is held, point the vacpack at the cursor. */
function mouseAimAngle(p) {
  if (!input.hasMouse || !(input.mouseSuck || input.mouseShoot)) return null;
  const wx = input.mouseX - VW / 2 + game.camera.x, wy = input.mouseY - VH / 2 + game.camera.y;
  return Math.atan2(wy - (p.y - 5), wx - p.x);
}


document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName || '') && e.code !== 'Escape') return;      // typing a name or a chat message must not move or jump
  keys[e.code] = true;
  Sound.unlock();
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyJ') { input.keySuck = true; syncInput(); }
  if (e.code === 'KeyK' || e.code === 'KeyF') { input.keyShoot = true; input.shootTap = true; syncInput(); }
  if (e.code === 'KeyE' && game.state === 'playing') doInteract();
  if ((e.code === 'KeyP' || e.code === 'Enter') && typeof inPhotoMode === 'function' && inPhotoMode()) photoShoot();
  if (e.code === 'Escape') escapePressed();
  if (e.code === 'KeyQ') cyclePack(-1);
  if (e.code === 'Tab') { cyclePack(1); e.preventDefault(); }
  if (e.code === 'KeyM') toggleMusic();
  if (game.state === 'playing' && game.surv) {
    if (e.code === 'KeyX') swing(); if (e.code === 'KeyR') eatSelected(); if (e.code === 'KeyT') drink(); if (e.code === 'KeyH') heal(); if (e.code === 'KeyC') openScreen('craft', {});
  }
  if (/^Digit[1-9]$/.test(e.code)) selectSlot(parseInt(e.code.slice(5), 10) - 1);
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') input.jump = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyJ') { input.keySuck = false; syncInput(); }
  if (e.code === 'KeyK' || e.code === 'KeyF') { input.keyShoot = false; syncInput(); }
});
window.addEventListener('blur', () => {
  Object.keys(keys).forEach(k => { keys[k] = false; });
  input.mouseSuck = input.keySuck = input.mouseShoot = input.keyShoot = input.jump = false; syncInput();
});
