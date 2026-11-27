'use strict';
function update(dt) {
  if (game.visitor) { updateVisitor(dt); return; }          // visiting a friend's ranch: the host's snapshots drive the world (js/net.js)
  updatePlayer(dt);
  updateSurvival(dt);
  updateSlimes(dt);
  updateFoods(dt);
  updatePlorts(dt);
  updateTreasures(dt);
  updatePlots(dt);
  updateCorrals(dt);
  updateBreeding(dt);
  updateLife(dt);
  updateJumbos(dt);
  updateJumpToys(dt);
  updateWeather(dt);
  updateSky(dt);
  updateParticles(dt);
  if (profile.settings.particles > 0) updateFireflies(dt);
  updateTime(dt);
  handleVacpack(dt);
  handleShoot(dt);
  findInteract();
  game.tickT += dt;
  if (game.tickT >= 1) { game.tickT -= 1; featuresTick(); }
  if (game.shopOpen && !game.nearShop) closeShop();
  Sound.updateMusic(nightAmount(game.time));
  netTick(dt);
}

let lastTime = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (game.state !== 'playing') {                            // menus open: a connected game keeps talking (and a visitor keeps watching)
    if (game.state === 'paused' && netActive()) { if (game.visitor) { updateVisitor(dt, true); render(); } else netTick(dt); }
    return;
  }
  update(dt);
  render();
  updateHUD();
}

function startGame(fresh, survival) {
  Sound.unlock(); Sound.startMusic();
  if (fresh) resetGame(Math.floor(Math.random() * 1e9));
  else if (!loadGame()) resetGame(Math.floor(Math.random() * 1e9));
  if (fresh && survival) startSurvival();
  $('#menu').style.display = 'none';
  menuStack.length = 0; $('#modal').classList.add('hidden');
  game.state = 'playing';
  const tut = $('#tutorial');
  if (profile.settings.hints) { tut.style.display = 'block'; setTimeout(() => { tut.style.display = 'none'; }, 9000); }
  applySettings(); refreshSoundButtons();
  try { if (typeof CloudFame !== 'undefined') CloudFame.submitNow(); } catch (e) {}
  Sound.play('click');
  lastTime = performance.now();
}

async function boot() {
  Sound.init(); Sound.loadSettings(); applySettings(); refreshSoundButtons();
  const bar = $('#loadFill'), label = $('#loadLabel');
  let pi = 0, pa = 0;
  const show = () => { const v = (pi + pa) / 2; bar.style.width = Math.round(v * 100) + '%'; label.textContent = `Loading… ${Math.round(v * 100)}%`; };
  await Promise.all([
    Assets.loadAll(p => { pi = p; show(); }),
    Sound.loadAll(p => { pa = p; show(); })
  ]);
  const miss = Assets.missing.length + Sound.missing.length;
  label.textContent = miss ? `Ready (${miss} asset file${miss > 1 ? 's' : ''} missing — using fallbacks)` : 'Ready!';
  $('#loader').classList.add('done');
  // Cloud save: restore a newer cloud ranch (other device) before the menu decides about "Continue".
  try { if (typeof GloopyCloud !== 'undefined') await GloopyCloud.pullLatest(); } catch (e) {}
  $('#newBtn').disabled = false; $('#survBtn').disabled = false; if ($('#netBtn')) $('#netBtn').disabled = false; if ($('#fameBtn')) $('#fameBtn').disabled = false;
  if (hasSave()) { const c = $('#continueBtn'); c.style.display = 'inline-block'; c.disabled = false; }
  refreshSoundButtons();
  if (Assets.get('ui_coin')) { const c = document.querySelector('#coinIco'); if (c) { c.src = IMAGE_FILES.ui_coin; c.style.display = 'inline-block'; const em = document.querySelector('#coinEmoji'); if (em) em.style.display = 'none'; } }
  const logo = Assets.get('logo');
  if (logo) { $('#logoImg').src = IMAGE_FILES.logo; $('#logoImg').style.display = 'block'; $('#logoText').style.display = 'none'; }
}


setInterval(() => { saveGame(); if (profileDirty) saveProfile(); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); saveProfile(); try { if (typeof GloopyCloud !== 'undefined') GloopyCloud.flush(); } catch (e) {} Sound.setLoop('suck', false); } else lastTime = performance.now(); });
window.addEventListener('pagehide', () => { saveGame(); saveProfile(); try { if (typeof GloopyCloud !== 'undefined') GloopyCloud.flush(); } catch (e) {} });

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));   // offline play once hosted

// photo mode buttons
$('#photoExit').addEventListener('click', exitPhotoMode);
$('#shutterBtn').addEventListener('click', () => { Sound.unlock(); photoShoot(); });
$('#frameBtn').addEventListener('click', () => cyclePhotoOption('frame', 1));
$('#stickerBtn').addEventListener('click', () => cyclePhotoOption('sticker', 1));


// survival buttons
[['#atkBtn', () => swing()], ['#eatBtn', () => eatSelected()], ['#drinkBtn', () => drink()], ['#healBtn', () => heal()], ['#craftBtn', () => openScreen('craft', {})]].forEach(([id, fn]) =>
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); if (game.state === 'playing' && game.surv) fn(); }));

requestAnimationFrame(loop);
boot();
