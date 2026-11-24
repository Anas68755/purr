# Clash of Kingdoms (multi-file)
Open `index.html` in a browser - no build step or server needed.

```
index.html      page markup + script loading order
css/style.css   styles
assets/*.png    sprites: buildings (b_), troops (t_), spells (s_), obstacles (o_), icons (i_), rubble, grass tile
js/config.js    buildings, troops, spells, leagues, obstacles, achievements
js/state.js     state, settings, economy helpers, save migration, tick
js/fx.js        particles (dust, sparkles) and the day/night tint
js/village.js   village UI: build, upgrade, panels
js/train.js     Barracks training queue (troops + spells) and Army panel
js/progress.js  leagues, achievements, obstacles
js/battle.js    battle engine (pathing, defenses, traps, heroes), enemy villages, battle UI
js/raid.js      raids on your village (headless run of the same engine), replay log
js/render.js    canvas drawing, sprite animation, game loop
js/extras.js    daily quests, campaign, Clan Castle
js/view.js      tap / drag / pinch / wheel zoom input
js/settings.js  settings panel
js/sfx.js       sound effects, generated background music, volume + mute
js/main.js      startup, raid timers
```
Third-party (CDN): Howler.js 2.2.4 (audio), canvas-confetti 1.9.3 (victory), Google Font "Lilita One".
To run fully offline, download those files into a `vendor/` folder and change the `<script>`/`<link>` URLs. The game still works if they fail to load (just without sound/confetti).
Progress is saved in localStorage.

## Regenerating the art
`python tools/generate_sprites.py` (needs `pip install pillow`) redraws every PNG in `assets/` and writes `tools/preview.png`. Edit the draw functions to restyle sprites.

## v3 additions
Raids on your village (shield after), XP & levels, floating damage numbers, screen shake, upgrade progress bars, storage meters, save export/import.

## v4 additions
Laboratory (build it at Town Hall 2; research troop levels), Barbarian King rage ability, deploy cursor.

## v5 additions
js/extras.js: daily quests (📜), 10-stage campaign (🗺️), Clan Castle reinforcements (build at Town Hall 2, tap it > Troops).

## v6 additions
- **Troops/heroes:** P.E.K.K.A, Healer, Minion; Archer Queen (Town Hall 2) with a Royal Cloak button (invisible 5s, heals, summons 3 archers).
- **Training:** build Barracks (one item at a time each, +25% speed/level). Queue troops and spells, pay gold to speed up or cancel for a refund. Old saves get a free Barracks.
- **Defenses/traps:** Inferno Tower (damage ramps on one target), Wizard Tower (splash), upgradeable hidden Bombs. They appear in enemy villages and your own - and fight raiders on your village.
- **Pathing:** troops follow a cost field around buildings; walls are passable at a high cost, so they use gaps and only breach when that is the shortest way. Enemy walls now have gaps (some villages are sealed).
- **Raids are simulated** with the real battle engine, so walls, gaps, towers and bombs matter. 📼 lists the last 10 raids with a log.
- **Progression:** Bronze-Crystal leagues with one-time rank-up bonuses (🏆), trees/rocks to clear for gold + XP, 24 achievements with progress bars.
- **Rebalance** (tuned with scripted bot play: raids vs typical bases at each Town Hall, bot armies vs all 10 campaign stages): raid size table `RB` in raid.js (shield 10 min, ~1 raid per 20 min), quest rewards scale with Town Hall, campaign bonus per star = `CB(i)` and stages get tougher (+9% defense damage, +7% HP per stage). Constants are at the top of raid.js / extras.js.
- **Feel:** building sway, troop walk/attack animation, defense recoil + muzzle flash, dust/debris on collapse, sparkles on collect, day/night from your local clock, background music (calm at home, driving in battle).
- **QoL:** x5 deploy, zoom/pan (pinch, drag, wheel, +/- buttons), settings panel (sound, music/effects volume, battle speed, day/night, animations, particles, shake, export/import, reset). Settings are saved separately from the game save.
- **Loot Cart:** loot that does not fit your storage (and 25% of what raiders steal) waits in a cart at the bottom-left of the village (or via the 🛒 button). Collect it when there is room; capacity is 3000 x Town Hall per resource.

## Cloud save (optional)
Sign in from ⚙️ Settings → ☁️ Cloud save with any `xxx@xxx.xxx` address (fake allowed) and a password. Needs a free Supabase project: see `CLOUD_SETUP.md`. Without configuration the game runs fully offline.
