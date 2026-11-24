PSYCHOTIC CORRIDOR (multi-file build)

  index.html        page + HUD markup
  css/style.css     all styling, analog-horror layers
  js/sfx-data.js    embedded base64 sound effects (classic script)
  js/main.js        the whole game (ES module, three.js loaded from CDN)

RUN: browsers block ES modules opened straight from disk (file://) in Chrome/Edge.
Serve the folder instead, e.g.:   python3 -m http.server 8000   -> http://localhost:8000
(or just open psychotic-corridor.html, the single-file build, which works by double-click).
Needs internet for three.js (CDN) on first load.

CONTROLS: WASD move, mouse look, F flashlight, SHIFT sprint, P/Esc pause.
Noise (running, door slams, bumping props) draws the monster. Amber safe lights heal you but burn out.
Mobile: left stick move, drag right side to look, double-tap right side then push stick to sprint.
