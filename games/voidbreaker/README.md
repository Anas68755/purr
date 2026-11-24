# VOID BREAKER // NEON ASCENSION — Deluxe Edition

A heavily expanded, multi-file rebuild of the original single-file **VOID BREAKER**
arcade shooter. Same neon-on-void identity, same controls — rebuilt on a modular
engine and loaded with new systems, a full synthesized soundtrack and a proper
sound-effect bank.

**v3.0 — HOLO-ARC visual rebuild:** the entire presentation layer was rewritten
from scratch on top of the unchanged game logic — a new render module draws every
ship, enemy, boss, bullet and pickup in a fresh holographic style, the effects
engine and background were rebuilt, and the HUD, screens and upgrade cards got a
brand-new design system.

**v4.0 — SINGULARITY:** a full content & systems expansion — two new boss
archetypes (**VORTEX**, **GORGON**) with brand-new bullet physics (curved shots,
prism rounds that shatter mid-flight, gravity-pull rounds), **12 new upgrade
cards** (36 total), the **BOSS RUSH** gauntlet mode, and a persistent
**commendations** (achievements) system.

**v4.1 — FLEET:** **six pilotable hull variants**, each with its own silhouette,
stat identity and a signature power on the **Q** key — pick your hull in the
start-screen hangar (click a card or cycle with ← / →; the choice is remembered):

| Hull | Role | Signature power (Q) |
| --- | --- | --- |
| **VANGUARD** | balanced interceptor | **OVERDRIVE** — 5 s of +40 % thrust and +60 % fire rate (18 s CD) |
| **RAZOR** | light striker, fast & fragile | **GHOST STEP** — blink 165 px along your vector and phase for 1.15 s (9 s CD) |
| **BASTION** | heavy gunship, slow & tough | **AEGIS BULWARK** — 4 s: absorb every hit and vaporize nearby shots (20 s CD) |
| **NOVA** | siege artillery, big slow shells | **NOVA PULSE** — 250 px shockwave: heavy damage, knockback, erases shots (14 s CD) |
| **WRAITH** | phantom hunter, crit flavor | **SWARM PROTOCOL** — fan of 6 homing missiles (12 s CD) |
| **CHRONOS** | temporal experimental | **TIME FRACTURE** — 4 s of time dilation (22 s CD) |

Also in v4.1: the magenta seeker missiles now carry a ~15 s fuse — they vent
smoke, flicker, then defuse with a fizzle instead of chasing you forever.

**v4.2 — TITAN:** the fleet, the boss roster and the upgrade pool all grow —
no size limit:

| Hull | Role | Signature power (Q) |
| --- | --- | --- |
| **VOLT** | storm striker, +crit | **STORM LANCE** — chain lightning leaps through up to 7 foes and stuns them (11 s CD) |
| **MAGNUS** | gravity warden, slow & heavy fire | **GRAVITY WELL** — collapse space: drag foes & shots into a well that implodes (16 s CD) |
| **AURORA** | lifeweaver support, +60 % shield regen | **REGENESIS** — restore a life (or bank +2000), refill shields, phase 2 s (26 s CD) |
| **ECLIPSE** | railgun sniper, heavy slow shells | **ANNIHILATOR RAIL** — 3 hypervelocity slugs that pierce the entire lane (13 s CD) |

- **Two new bosses** join the rotation: **LEVIATHAN** (void serpent — segmented
  undulating body, tide-flood fans, telegraphed maw-pull channel, fused homing
  spines, enrage twin maelstrom) and **MIRAGE** (illusionist — blink teleports
  with afterimages, mirror radial prisms, tri-lance rails, illusion doubles,
  enrage shatter storms). **XENOARCHIVIST** now requires all 10 archetypes.
- **Two new enemy classes**: **WEAVER** (blinks into your lane and quick-draws a
  3-shot fan) and **WARDEN** (tri-hex medic that mends nearby foes and pulses a
  defensive radial ring) — 11 classes total.
- **Six new upgrade cards** (42 total): **Arc Stunner** (every 10th shot EMPs &
  stuns), **Leech Protocol** (crits recharge the shield), **Orbital Lance**
  (periodic beam strike from orbit), **Proximity Ward** (kills may leave friendly
  mines), **Glass Protocol** (+60 % damage, −1 max life) and **Titanium Hull**
  (+1 max life, heals).
- **Fleet Admiral** commendation: pilot 10 different hulls; leaderboard entries
  now show which hull flew the sortie; the game-over tag names your hull.

**v5.0 — ABYSS:** the deepest expansion yet — 12 hulls, 12 bosses, 48 upgrades,
13 enemy classes and a 7-track adaptive soundtrack:

| Hull | Role | Signature power (Q) |
| --- | --- | --- |
| **FORGE** | siege engineer, 5 lives | **BASTION ARRAY** — deploy 3 auto-turrets that hold your lane for 6 s (17 s CD) |
| **HALCYON** | barrage bomber, big shells | **CARPET STRIKE** — walk 6 payloads across your lane; each detonates in turn and scrubs enemy fire (14 s CD) |

- **Two new bosses** close the roster: **OUROBOROS** (ring serpent — dashed
  elliptical orbit, coil spirals with curved arms, twin bite fans from head and
  mirrored tail, scale rings, enrage world-coil double spiral) and **CERBERUS**
  (triple-headed warden — staggered roar streams, hound calls that summon dive
  bombers, telegraphed slam columns with a shockwave, enrage infernal cross).
  **XENOARCHIVIST** now requires all 12 archetypes.
- **Two new enemy classes**: **PHANTOM** (phases fully intangible — untouchable
  while ghosted — and quick-draws on rematerialize) and **ZENITH** (hover,
  telegraph a dashed launch line, then dive through your lane at 3× speed) —
  13 classes total.
- **Six new upgrade cards** (48 total): **Combo Catalyst** (longer combo
  window), **Sustain Field** (power-ups last longer), **Broadside Array**
  (side volleys), **Deadeye Suite** (+50 % crit damage), **Surge Capacitor**
  (combo ×10+ overcharge) and **Guardian Ring** (orbiting wards collapse
  enemy shots).
- **Three new seamless music loops**: the **rush theme** (Boss Rush gauntlet),
  the **abyss theme** (classic waves 26+) and the **finale theme** (dual-boss
  fights). The adaptive director now tracks the live boss count and swaps
  tracks accordingly. 7 new SFX for the new fleet tech and foes.
- **4 new commendations**: ABYSS DIVER (wave 30), SINGULARITY (x50 combo),
  TAIL EATER and PACK LEADER (the new bosses); FLEET ADMIRAL now tracks 12
  hulls. Full player manual added at `docs/PLAYER_MANUAL.md`.

## Run it

**Easiest:** double-click `index.html`. Everything (fonts, audio, libraries) is
bundled locally — no internet connection needed.

> On `file://` the game automatically switches its audio engine to
> HTML5-audio mode (browsers block WebAudio decoding on local files).

**Optional (lowest audio latency):** serve the folder over HTTP instead:

```bash
cd VOIDBREAKER-DELUXE
python3 -m http.server 8080     # then open http://localhost:8080
```

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows / left-stick touch | Move |
| Space / Mouse hold / touch | Fire |
| E | Dash (i-frames, dash-through damage with Phase Engine) |
| Q | Hull signature power (per-ship cooldown) |
| Shift (hold) | Deflector shield (drains energy) |
| P | Pause |
| M | Mute |
| 1 / 2 / 3 | Pick upgrade card |
| ← / → (menu) | Cycle hull in the hangar |
| Enter | Start / restart |

On touch devices a virtual joystick appears on the left; DSH/SHD/PWR buttons on
the right; firing is automatic while steering. **Settings › Swap joystick /
buttons** converts the layout — the joypad moves to the right edge and the
action buttons mirror to the left (left-handed mode). The choice persists and
the joystick grab-zone follows whichever side it is docked on.

## v5.2 — OMEGA update

- **Nightmare Curses** — seven toggleable hardships on the start screen
  (HORDES, IRONHULL, BARRAGE, FRAGILE, NEBULA FOG, MINE BELT, SPECIAL OPS).
  Each multiplies your score; the selection persists between sessions.
- **Salvage Vault** — sorties bank salvage (score + elite/boss bounties) and
  spend it on permanent fleet upgrades: HULL CACHE, PHASE CAPACITOR,
  QUARTERMASTER (4-card drafts), VETERAN INSIGNIA, SALVAGE RIG and the
  PHOENIX COVENANT one-per-run revive.
- **Elite affixes** — from wave 9, elites carry a sigil: **AEGIS** (absorbs
  hits, then re-arms), **VOLATILE** (detonates half a second after dying) and
  **SWIFT** (50% faster).
- **Haptic feedback** toggle (Android/WebView vibration on hits, dashes and
  pickups) and an extended run debrief: elites, bosses and salvage banked.
- Three new commendations: QUARTERMASTER, VAULT TYCOON,
  DOOMED BUT GLORIOUS.

## v5.3.1 — SPAWN GATE hotfix

- **Critical fix (the invisible-war bug):** a refactor had dropped `speed`,
  `w` and `h` from the enemy spawn template, so every hull spawned with an
  undefined drive and size and its position decayed to NaN — enemies were
  invisible, every bullet vanished on an unseen hitbox while the score
  climbed, and the pilot took phantom contact damage anywhere (worst near
  the top edge). The spawn template is restored; enemies descend, render,
  fire and die properly again.
- **The Spawn Gate:** hulls are now fully inert while still gliding in from
  the spawn band — untargetable, unhittable, unable to fire, drop mines,
  heal or ram. Turrets, homing shots, nukes, gravity wells, mines and
  splash damage all honour the gate; enemies can no longer fire from above
  the top edge, and a downward chevron now pings each lane before a hull
  descends. Weaver blinks stay inside the arena.

## v5.3 — HORIZON update

- **Card Evolution** — max out both cards of a fusion pair and the next
  draft offers a golden **EVOLVED** card: **OMEGA ARRAY** (Twin Cannons +
  Fire Rate), **SINGULARITY CORE** (Fusion Warheads + Singularity Rounds,
  kills implode), **NANO SWARM** (Orbital Drone + Buzz Saws, 5-drone swarm),
  **AEGIS CITADEL** (Aegis Regen + Aegis Reversal, blocks detonate a
  counter-nova), **WARP DRIVER** (Phase Engine + Ghost Shell, half dash CD)
  and **STORM CHORUS** (Arc Conductor + Death Blossom, wider chains).
- **Seeded runs & Challenge Codes** — every sortie now runs on a mulberry32
  seed that drives the wave director, spawn positions, elite rolls, boss
  pairs, power-up drops and score zones. The debrief shows the run's
  `SEED.CCC.M` code; load any code on the start screen (or hit Copy Code to
  share your curse loadout) and every pilot flies the exact same gauntlet.
- **Daily Void** — one calendar-seeded sortie per day for everyone. The seed
  is derived from the date, so all pilots fight the identical wave script;
  your best daily score and wave are remembered on the start screen.
- **The 13th hull** — a classified `???` tile sits sealed in the hangar.
  Reach **wave 20 with 2+ curses active** to unseal **OMEGA**, the rewrite
  engine whose signature power grants 5 seconds of rapid + spread + piercing
  + time dilation all at once.
- **Sortie debrief timeline** — the game-over screen now draws a per-wave
  bar chart: kills per wave, red bars for waves where you took damage, a
  dimmed bar for the unfinished wave.
- **Three new curses** — GRAVITY WELL (−20% thrust), REGEN HIVE (lesser foes
  slowly mend their hulls) and POWER LEAK (power-ups last half as long).
- **Four new commendations** — GENE FORGE, OMEGA PROTOCOL, DAY BREAKER and
  CODE RUNNER. Draft hotkeys now cover the 4th card slot (1–4).

## What's new in this edition

**Audio (the big one)** — the original was silent. This edition ships a fully
procedural soundtrack and SFX bank (all synthesized, no copyrighted material):
- 7 seamless stereo music loops: menu theme, two battle themes, boss theme,
  rush gauntlet theme, abyss deep-wave theme, dual-boss finale theme
- ~40 sound effects: weapons, impacts, crits, explosions, mines, klaxon, UI,
  plus the v5.0 bank (turret, bomb, broadside, ward, roar, dive, phase)
- Adaptive music director (menu / battle A-B / boss / rush / abyss / finale
  keyed to mode, wave depth and the live boss count), volume sliders, mute

**Enemies & bosses**
- 13 enemy classes (6 original + new **Shielder** with a regenerating frontal
  shield, **Bomber** that lays mines, **Sniper** with a telegraphed laser sight,
  v4.2's **Weaver** blink-duelist and **Warden** squad medic, and v5.0's
  **Phantom** phase-shifter and **Zenith** dive-bomber)
- **Elite variants** from wave 7 — golden halo, 2.5x HP, guaranteed drop
- **Twelve boss archetypes**, all with an enrage phase at 30% HP:
  - **DREADNOUGHT** — fans, aimed rail bursts, radial rings, rotating spiral
  - **SERAPH** — twin-arm spirals, bullet walls with a gap, cross bursts, summons
  - **HYDRA** — three-headed venom serpent: triple aimed fans, homing venom
    orbs, telegraphed coil dash trailing a toxin wall
  - **TEMPEST** — storm caller: blinks around the arena, telegraphed lightning
    columns, chain-bolt fans, 4-arm static spirals
  - **MONOLITH** — armored fortress: rotating beam sweeps, mortar ring
    bombardment, mine volleys, frontal FORTIFY window that blocks bullets
  - **ARCHON** — final ascendant: judgment ring volleys, twin wing lasers,
    void summons, 3-arm ascendant spiral
  - **VORTEX** *(v4.0)* — gravity maelstrom: constantly drags you inward, curved
    debris spirals, telegraphed event-horizon implosions whose bullets converge
    in a spiral bend, enrage singularity bursts
  - **GORGON** *(v4.0)* — prism hydra: five writhing hair-turret fans, prism
    volleys that SHATTER into fragment sprays mid-flight, sweeping gaze beams,
    enrage prism storms
  - **LEVIATHAN** *(v4.2)* — void serpent: segmented undulating body, tide-flood
    fans, telegraphed maw-pull that drags you into a radial snap, fused homing
    spines (with a fuse), enrage twin maelstrom
  - **MIRAGE** *(v4.2)* — illusionist: blink teleports with afterimage rings,
    mirror radial + shattering prisms, tri-lance mirrored rails, illusion
    doubles, enrage shatter storms
  - **OUROBOROS** *(v5.0)* — ring serpent: dashed elliptical orbit, coil
    spirals with curved arms, twin bite fans from head and mirrored tail,
    scale rings, enrage world-coil double spiral with weaver escorts
  - **CERBERUS** *(v5.0)* — triple-headed warden: staggered roar streams,
    hound calls summoning dive bombers, telegraphed slam columns + shockwave,
    enrage infernal cross with prisms
- **Dual-boss ascension fights**: fixed pairs at waves 20 / 40 / 60
  (DREADNOUGHT+SERAPH, TEMPEST+HYDRA, MONOLITH+ARCHON), then random pairs
  from wave 80 onward

**Modes**
- **Classic Ascension** — the full wave campaign
- **BOSS RUSH** *(v4.0)* — a pure boss gauntlet: every wave is a boss (a random
  dual pair every 4th fight), HP ramps steeply, an upgrade draft after every
  kill, score zones still rotate through — how far into the gauntlet can you get?

**Systems**
- **48 upgrade cards** drafted 1-of-3 after every wave, with keyboard
  shortcuts. Beyond the original 12:
  - **Twin Cannons** — extra angled cannon pairs (up to 8 streams)
  - **Rail Accelerator** — faster, harder-hitting bullets
  - **Ricochet Rounds** — bullets bounce off walls & the bottom edge
  - **Fusion Warheads** — kills detonate, splashing nearby enemies
  - **Marked Prey** — elites & bosses take +15% damage per level
  - **Nova Pulse** — dashing releases a damaging shockwave
  - **Static Aura** — enemies that touch you get burned
  - **Chrono Field** — enemy bullets fly 10% slower per level
  - **Adrenaline Core** — critical lives grant fire-rate & speed surge
  - **Phoenix Protocol** — cheat death once per boss wave
  - **Fortune Module** — +15% score and +25% power-up drops per level
  - **Salvage Drones** — every 25 (then 15) kills grants a bonus life
  - v4.0 additions:
    **Cryo Rounds** (hits chill foes), **Arc Conductor** (kills lightning-zap
    neighbors), **Executioner** (finish foes under 12% HP), **Death Blossom**
    (kills may spray petal shots), **Singularity Rounds** (every 6th shot pulls
    foes in), **Focus Lens** (stand still to stack damage), **Buzz Saws**
    (orbiting contact blades), **Ghost Shell** (longer dash phasing),
    **Retaliation Matrix** (counter-nova when hit), **Aegis Reversal**
    (blocked shots recharge the shield), **Ablative Plating** (negate one hit
    every 25s), **Overclock Reactor** (fast-start each wave)
- **Commendations** *(v4.0)* — persistent achievements (kills, combos, boss
  bestiary, flawless waves, gauntlet progress…) with unlock toasts and a
  start-screen panel — v5.0 brings the count to 17 (Fleet Admiral now pilots
  all 12 hulls)
- Budget-based wave director with special waves: **Swarm**, **Minefield**,
  **Elite Squad**
- New **Time Dilation** power-up, mine blasts now damage enemies too
- Pause-safe delayed bullet queue, crits with gold numbers, hit-stop slow-mo on
  boss kills, recurring 2x score zones

**Presentation & QoL — the v3.0 HOLO-ARC rebuild**
- New `render.js` module: every entity redrawn from scratch in a holographic
  style — dark glass bodies with colored energy tints, triple-pass holo strokes
  (soft glow / core line / white hairline), animated sub-structures
  - Player: per-hull silhouettes (manta VANGUARD, needle RAZOR, pronged BASTION,
    faceted NOVA, scythe-wing WRAITH, reactor CHRONOS, twin-prong VOLT,
    ring-hauler MAGNUS, swept-wing AURORA, needle-rail ECLIPSE) with hull-tinted
    glow, banking tilt, twin engine plumes, dash afterimages, hexagonal shield
    bubble (wider hull-tinted dome during AEGIS BULWARK), rotating halo while a
    power is active, cooldown sweeps for dash & power, orbital drone ring
  - 11 enemy classes with brand-new silhouettes, idle hologram sway, turret
    tracking, orbiting nodes, payload blinks, rotating elite brackets, stun
    arcs, weaver materialize flashes, warden mend auras
  - 6 bosses rebuilt as layered machines: DREADNOUGHT's rotating cannon-pod
    gear ring, SERAPH's wing blades + halo, HYDRA's undulating tail and jawed
    heads, TEMPEST's arc-lightning nodes, MONOLITH's armor plates and hazard
    chevrons, ARCHON's tick ring + dashed crown + blade wings — plus gradient
    lightning-column and lighthouse-beam telegraphs
  - v4.0: VORTEX's logarithmic spiral arms, debris ring and dark event-horizon
    eye with an accretion glint; GORGON's faceted crystal hull, writhing hair
    turrets and slit-pupil gaze; event-horizon implosion telegraphs; rotating
    prism shards and gravity-swirl bullet auras; orbiting buzz-saw blades
- New effects engine: additive sparks & orbs, spinning polygon shards, outlined
  pop-scaling damage numbers, blinking chevron warnings, shockwave rings
- New background: deep gradient, drifting nebulae, aurora bands, three parallax
  mote layers (dot / plus / diamond), wireframe debris, scrolling perspective
  floor grid, shooting streaks
- New HUD: corner-cut glass panels with bracket accents, striped combo bar,
  chevron life pips, segmented boss bar with diamond name markers, hexagonal
  power-up chips
- New screens: scan-swept title with hollow-stroke wordmark, corner-bracket
  viewport frame, sheen-sweep buttons, upgrade cards with rotated medallions and
  level pips, restyled settings — all in the Chakra Petch + Share Tech Mono pair
- Settings screen (music/SFX volume, screen shake, CRT scanlines, FPS counter,
  reduced effects, swap joystick / buttons touch layout) — persisted locally
- Top-5 local leaderboard + best score, expanded end-of-run stats (accuracy,
  time survived)
- Mobile touch controls, pause-on-blur, reduced-motion support

## Project structure

```
VOIDBREAKER-DELUXE/
├── index.html            entry point & UI markup
├── css/style.css         all styling (HOLO-ARC design system)
├── js/
│   ├── config.js         balance tables, palette, audio registry
│   ├── utils.js          math/helpers
│   ├── audio.js          Howler-powered sound engine
│   ├── input.js          keyboard / mouse / touch joystick
│   ├── ships.js          hull variants (12), signature powers, hangar UI
│   ├── render.js         v3.0 from-scratch entity renderer (holo style)
│   ├── fx.js             particles, shake, flash, background engine
│   ├── achievements.js   v4.0 commendations (persistent)
│   ├── player.js         ship, weapons, drones, saws, dash, shield (logic)
│   ├── enemies.js        13 enemy classes + elites (logic)
│   ├── boss.js           12 boss archetypes & attack scripting
│   ├── bullets.js        bullets, missiles, mines, collisions, bullet physics
│   ├── powerups.js       7 power-up types
│   ├── waves.js          wave director, boss rotation, Boss Rush mode
│   ├── upgrades.js       draft system (48 cards)
│   ├── ui.js             HUD, screens, settings, leaderboard
│   └── game.js           state machine, game modes & main loop
├── vendor/howler.min.js  3rd-party: Howler.js 2.2.4 (MIT)
├── docs/                 player manual & changelog
├── assets/
│   ├── audio/            7 music loops + ~40 SFX (16-bit WAV, synthesized)
│   └── fonts/            Chakra Petch + Share Tech Mono + Orbitron (SIL OFL)
└── README.md
```

## Technical notes

- Plain classic `<script>` modules on a single `VB` namespace — no build step,
  no framework; works from `file://`.
- Rendering is fully separated from logic: gameplay modules own state and
  simulation only, `render.js` owns every draw call (delegated from the
  modules' thin `draw()` shims).
- All audio is 44.1 kHz 16-bit PCM WAV, generated procedurally with numpy
  (chiptune/synthwave synthesis: supersaws, FM drums, sidechain pumping,
  wrap-around delay lines so the loops are perfectly seamless).
- High-score, leaderboard, settings and the selected hull persist in `localStorage`.
