# VOID BREAKER // NEON ASCENSION — Changelog

## v5.3.1 — SPAWN GATE (hotfix)

*The invisible-war hotfix: what spawns above the screen now stays above
the screen until it is meant to arrive.*

### Critical fix — the NaN ghost fleet
- A refactor had dropped `speed`, `w` and `h` from the enemy spawn
  template. Every hull spawned with an undefined drive and size, so its
  position decayed to **NaN**: enemies were never drawn (invisible), never
  really died where you shot, and their NaN hit-radius made *every*
  bullet-collision and every contact check pass.
- Symptoms this caused, all now fixed:
  - "enemies are invisible" — hulls decayed to NaN coordinates and were
    never rendered;
  - "enemies being auto-attacked without being seen or in bullet's sight"
    — every player bullet collided with the first NaN hull on its very
    first frame, so shots vanished at the muzzle while the score climbed;
  - "the ship keeps reading the damage counter" — the NaN contact check
    never skipped, so an unseen hull damaged the pilot every i-frame
    window, anywhere on the field;
  - "near the top of the screen the ship takes damage" — the spawn band
    interacted with the arena while the hulls were still off-screen.
- Spawn template restored (`speed: D.speed(wave), w: D.w, h: D.h`); live
  verified: hulls descend, render, fire, die and score properly again.

### The Spawn Gate (defense in depth)
- Every hull now carries an `entered` flag and is fully **inert while
  still gliding in from the spawn band** — untargetable, unhittable,
  unable to fire, drop mines, heal or ram. It activates with a small
  materialize ring the moment its center is inside the arena.
- Turrets, orbital lances, drones and homing missiles no longer lock
  hulls that are still off-screen (`nearestEnemy` filters the gate).
- Enemies can no longer fire from 20 px above the top edge (the old
  `y > -20` firing window is gone; snipers still hold fire until their
  hover line, bombers only drop mines once entered).
- A diving/enemy hull can no longer ram the pilot during entrance —
  bosses already docked at y ≥ 110 keep their own entrance rule, and the
  contact loop now honours the same flag.
- Area effects honour the gate too: nukes, gravity wells (pull +
  implosion), friendly mines, mine blasts, Fusion Warheads splash and
  Singularity Rounds pull all ignore hulls that are still entering.
- Weaver blinks are clamped inside the arena (no more blinking
  half-off-screen), and wardens cannot pulse heals from the spawn band.
- New top-edge spawn ping: a downward chevron in the hull's colour blinks
  at the lane where a hull is about to descend — side flankers keep their
  existing side warning.

## v5.3 — HORIZON

*Every sortie is now a shared fate: seeded runs, golden evolutions and the
Daily Void. One classified hull waits in the hangar.*

### Card Evolution
- Six fusion pairs: max out **both** parent cards and the next draft adds a
  golden **EVOLVED** card (drafts grow to a 4th slot, hotkeys 1–4).
- **OMEGA ARRAY** (Twin Cannons + Fire Rate): +1 cannon pair, 25 % faster
  trigger, +1 damage on every barrel.
- **SINGULARITY CORE** (Fusion Warheads + Singularity Rounds): every kill
  implodes — yanks nearby foes inward and scours them with a heavy blast.
- **NANO SWARM** (Orbital Drone + Buzz Saws): +2 drones (5 total), one extra
  saw blade, drones fire 40 % faster, blades grow.
- **AEGIS CITADEL** (Aegis Regen + Aegis Reversal): shield recharges twice
  as fast; every shield block detonates a counter-nova.
- **WARP DRIVER** (Phase Engine + Ghost Shell): dash cooldown halved,
  phasing stretched +1 s, dash impact ×4.
- **STORM CHORUS** (Arc Conductor + Death Blossom): lightning chains twice
  as far, +4 petals per burst.

### Seeded runs & Challenge Codes
- Every run now draws a seed (mulberry32) that drives the wave director:
  budgets, spawn types & positions, elite/affix rolls, boss pairs, power-up
  drops and score-zone placement. Cosmetic effects never touch the stream.
- The game-over debrief shows the sortie's **RUN CODE** (`SEED.CCC.M`).
- Start screen: **ENTER CHALLENGE CODE** field + **Load** (arms the seed,
  curses and mode) and **Copy Code** (shares your curse loadout as a fresh
  seed). Same code on any device with the same screen aspect = same gauntlet.

### Daily Void
- New start-screen button: one calendar-seeded sortie per day for every
  pilot — identical wave script worldwide. Best daily score and wave are
  remembered under the buttons.

### The 13th hull — OMEGA
- A classified `???` tile sits sealed in the hangar; the hangar cycle and
  selection reject it until unsealed.
- Unseal condition: **reach wave 20 (classic) with 2+ curses active**.
- OMEGA (REWRITE ENGINE, +5 % crit): **OMEGA PROTOCOL** grants 5 s of rapid
  fire + spread + piercing + time dilation at once (22 s CD).

### Sortie debrief timeline
- The game-over screen draws a per-wave bar chart: kills per wave, red bars
  where you took damage, a dimmed bar for the unfinished wave, plus the
  RUN CODE line beneath it.

### Nightmare roster
- Three new curses: **GRAVITY WELL** (−20 % thrust, ×1.30), **REGEN HIVE**
  (lesser foes mend 4 % hulls every 2 s, ×1.35) and **POWER LEAK**
  (power-up durations halved, ×1.25). Ten curses total.

### Commendations
- Four new: **GENE FORGE** (craft any evolution), **OMEGA PROTOCOL** (unseal
  the classified hull), **DAY BREAKER** (fly the Daily Void) and
  **CODE RUNNER** (finish a challenge-code sortie). 24 total.

## v5.1 — MIRRORED DECK

*Left-handed ascension. Convert between joypad and button positions.*

### Menu refit (Android hotfix)
- Main menu, pause, game-over, settings and upgrade screens no longer clip
  or overlap on short (phone-landscape) screens: the old centered flexbox
  layout cut off the top of overflowing menus, and `touch-action: none` on
  `<body>` blocked touch scrolling entirely — the Launch button was
  unreachable on Android. Both fixed (`touch-action` moved to the canvas,
  overlays use safe centering that degrades into a scrollable column).
- Phone layout: hull hangar becomes a horizontal swipe carousel (scroll
  snap), Launch / Boss Rush / Settings sit above the fold, leaderboard and
  commendations flow below, settings switch to a two-column grid, touch
  pads hide while any menu is open.
- Verified at 568×320, 640×360, 740×360, 851×393, 915×412 and desktop —
  zero element overlaps, all actions hittable (automated bounding-box QA).

### Swappable touch layout
- New persisted setting: **Settings › Swap joystick / buttons**.
- OFF (default): virtual joypad docked bottom-left, DSH/SHD/PWR buttons
  bottom-right — the classic layout.
- ON: the joypad mirrors to the bottom-right edge and the action buttons
  mirror to the left — full left-handed mode.
- The joystick grab-zone follows the layout (left ~55 % of the screen by
  default, right ~45 % when swapped), so steering still starts wherever the
  pad visually sits.
- Applies instantly — mid-run, from pause or from the main menu — and is
  saved to `localStorage` with the rest of the settings. Toggling shows a
  HUD toast confirming the active layout.
- `VB.Input` now exposes `dockJoystick()`, `swapOn()` and `joyZone(x)`
  (layout-aware docking / grab-zone queries, used by the settings binding
  and covered by headless QA).

## v5.0 — ABYSS

*The fleet goes deeper. No size limit.*

### New hulls (10 → 12)
- **FORGE** — siege engineer. **BASTION ARRAY**: deploys 3 auto-turrets that
  hold the lane for 6 s, sweeping their aim toward the nearest target
  (turrets are world objects rendered by the ship-FX layer). 17 s CD.
- **HALCYON** — barrage bomber. **CARPET STRIKE**: walks 6 payloads across the
  lane; each telegraphs, then detonates in sequence — damaging foes and
  scrubbing enemy fire in a 115 px radius. 14 s CD.

### New bosses (10 → 12)
- **OUROBOROS** — ring serpent riding a dashed elliptical orbit: coil spirals
  with curved arms, twin bite fans fired from both head and mirrored tail,
  scale rings with a fast aimed pair, enrage world-coil double spiral with
  weaver escorts. Procedural segmented body trails the orbit.
- **CERBERUS** — triple-headed warden: staggered triple roar streams, hound
  calls that summon ZENITH dive bombers, telegraphed slam columns with a
  landing shockwave, enrage infernal cross with prism shards.

### New enemy classes (11 → 13)
- **PHANTOM** — phase shifter: periodically goes fully intangible (untouchable
  by bullets, contact and saws), quick-draws on rematerialize. Elites ghost
  longer and more often.
- **ZENITH** — dive bomber: enters, hovers & strafes, telegraphs a dashed
  launch line, locks the vector 0.3 s before a 3×-speed dive through the lane.

### New upgrade cards (42 → 48)
- **Combo Catalyst** — combo window +0.6 s per level
- **Sustain Field** — power-up timers drain 20 % slower per level
- **Broadside Array** — scheduled perpendicular side volleys
- **Deadeye Suite** — critical hits deal +50 % damage per level
- **Surge Capacitor** — combo ×10+: faster fire & thrust
- **Guardian Ring** — orbiting wards that collapse enemy shots

### New music (4 → 7 loops) & SFX
- **rush_theme** — Boss Rush gauntlet (150 BPM, 51 s)
- **abyss_theme** — deep classic waves 26+ (90 BPM, 40 s)
- **finale_theme** — dual-boss fights (140 BPM, 41 s)
- Adaptive director rework: boss count (not a boolean) drives theme choice —
  duals get the finale, Boss Rush gets the gauntlet theme, deep waves get the
  abyss theme.
- 7 new SFX: turret, bomb, broadside, ward, roar, dive, phase.

### Systems & polish
- New bullet physics/API: `guardianSweep` (ward bullet collapse), `e.ghost`
  phase flag honored by bullets, contact damage and saws.
- Crit damage now scales with Deadeye Suite.
- Commendations: 4 new (**ABYSS DIVER**, **SINGULARITY**, **TAIL EATER**,
  **PACK LEADER**); XENOARCHIVIST and FLEET ADMIRAL now track 12.
- Full player manual added at `docs/PLAYER_MANUAL.md`.

---

## v4.2 — TITAN
- 4 new hulls: **VOLT** (STORM LANCE chain lightning + stun), **MAGNUS**
  (GRAVITY WELL drag & implode), **AURORA** (REGENESIS heal/shield/phase),
  **ECLIPSE** (ANNIHILATOR RAIL piercing slugs).
- 2 new bosses: **LEVIATHAN** (segmented void serpent, maw-pull, fused spines)
  and **MIRAGE** (blink illusionist, mirror prisms, illusion doubles).
- 2 new enemies: **WEAVER** (blink duelist), **WARDEN** (squad medic).
- 6 new upgrades: Arc Stunner, Leech Protocol, Orbital Lance, Proximity Ward,
  Glass Protocol, Titanium Hull (42 total).
- Fleet Admiral commendation, hull-aware run logs & leaderboard, MAGNUS well
  rendering hook.

## v4.1 — FLEET
- 6 pilotable hulls with signature powers on Q (VANGUARD / RAZOR / BASTION /
  NOVA / WRAITH / CHRONOS), hangar UI on the start screen, persistent selection.
- Magenta seeker missiles now defuse after ~15 s (vent → flicker → fizzle).

## v4.0 — SINGULARITY
- Bosses **VORTEX** (gravity maelstrom) & **GORGON** (prism hydra); curved
  shots, prism shattering, gravity-pull rounds.
- BOSS RUSH gauntlet mode; dual-boss ascension fights; commendations system;
  12 new upgrades (36 total); elite squads, swarm & minefield special waves.

## v3.0 — HOLO-ARC
- Complete visual rebuild: new render module, effects engine, background,
  HUD, screens and upgrade cards; logic untouched.

## v2.0 — DELUXE
- Multi-file modular rebuild of the original single-file game on one `VB`
  namespace; Howler.js audio; new enemies (shielder/bomber/sniper), elites,
  mines, score zones, power-up system, settings, leaderboard.

## v1.0 — ORIGIN
- Single-file VOID BREAKER: waves, bosses, upgrades, neon-on-void arcade
  shooting.
