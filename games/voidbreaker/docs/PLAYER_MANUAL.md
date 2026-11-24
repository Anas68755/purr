# VOID BREAKER // NEON ASCENSION — Player Manual (v5.0 ABYSS)

Welcome to the abyss, pilot. This manual covers every hull, enemy, boss,
upgrade and system in the Deluxe Edition. Everything runs locally — open
`index.html` and fly.

---

## 1. Getting started

| Step | Action |
| --- | --- |
| 1 | Double-click `index.html` (or serve the folder with `python3 -m http.server` for lowest audio latency) |
| 2 | Pick a hull in the SELECT HANGAR — click a card or cycle with ← / → |
| 3 | Press **Launch** (Classic Ascension) or **Boss Rush** (pure boss gauntlet) |
| 4 | Your best score, top-5 sorties, settings, hull choice and commendations are saved automatically |

On `file://` the audio engine automatically falls back to HTML5 audio mode;
over HTTP it uses WebAudio for the lowest latency.

**On phones and short screens** the hangar becomes a horizontal swipe
carousel — flick it left / right to browse all 12 hulls, then tap **Launch**.
The menu scrolls vertically for the leaderboard and commendations; every
action stays reachable and nothing overlaps, in any orientation.

## 2. Controls

| Input | Action |
| --- | --- |
| WASD / Arrows / left stick | Move |
| Space / Mouse hold / touch | Fire |
| **E** | Dash — brief invulnerability, i-frames, dash-through damage with Phase Engine |
| **Q** | Hull signature power (each hull has its own cooldown) |
| Shift (hold) | Deflector shield — drains energy, blocks shots & contact |
| **P** | Pause |
| **M** | Mute |
| **1 / 2 / 3** | Pick an upgrade card during the draft |
| ← / → (menu) | Cycle hull in the hangar |
| Enter | Start / restart |

Touch devices get a virtual joystick plus DSH / SHD / PWR buttons; firing is
automatic while steering.

**Left-handed mode** — *Settings › Swap joystick / buttons* converts between
joypad and button positions: the virtual joystick moves to the right edge and
the DSH/SHD/PWR buttons mirror to the left. The setting is saved locally and
applies instantly, mid-run too; the joystick spawn zone always follows the side
the pad is docked on.

## 3. The fleet — 12 pilotable hulls

Every hull trades base stats (speed, fire rate, hull cells, damage, caliber,
crit chance) and carries a **signature power** on **Q**.

### Original six (v4.1)

| Hull | Role | Stats | Signature power (Q) |
| --- | --- | --- | --- |
| **VANGUARD** | balanced interceptor | standard | **OVERDRIVE** — 5 s of +40 % thrust and +60 % fire rate. 18 s CD |
| **RAZOR** | light striker | +18 % speed, −8 % fire rate, 3 lives | **GHOST STEP** — blink 165 px along your vector, phase 1.15 s. 9 s CD |
| **BASTION** | heavy gunship | −15 % speed, +8 % fire rate, 5 lives | **AEGIS BULWARK** — 4 s: absorb every hit, vaporize shots that come near. 20 s CD |
| **NOVA** | siege artillery | +1 dmg, big caliber | **NOVA PULSE** — 250 px shockwave: heavy damage, knockback, erases shots. 14 s CD |
| **WRAITH** | phantom hunter | +10 % crit | **SWARM PROTOCOL** — fan of 6 phasing homing missiles. 12 s CD |
| **CHRONOS** | temporal experimental | standard | **TIME FRACTURE** — 4 s of time dilation for everything else. 22 s CD |

### TITAN four (v4.2)

| Hull | Role | Stats | Signature power (Q) |
| --- | --- | --- | --- |
| **VOLT** | storm striker | +8 % speed, +5 % crit | **STORM LANCE** — chain lightning leaps through up to 7 foes and stuns them. 11 s CD |
| **MAGNUS** | gravity warden | −10 % speed, +5 % fire rate | **GRAVITY WELL** — drag foes & shots into a well that implodes. 16 s CD |
| **AURORA** | lifeweaver support | −10 % fire rate, +60 % shield regen | **REGENESIS** — restore a life (or bank +2000), refill shields, phase 2 s. 26 s CD |
| **ECLIPSE** | railgun sniper | −20 % fire rate, +2 dmg, big caliber | **ANNIHILATOR RAIL** — 3 hypervelocity slugs that pierce the entire lane. 13 s CD |

### ABYSS two (v5.0)

| Hull | Role | Stats | Signature power (Q) |
| --- | --- | --- | --- |
| **FORGE** | siege engineer | −12 % speed, −5 % fire rate, 5 lives | **BASTION ARRAY** — deploy 3 auto-turrets that hold your lane and sweep their aim for 6 s. 17 s CD |
| **HALCYON** | barrage bomber | −10 % speed, −10 % fire rate, +1 dmg, big caliber | **CARPET STRIKE** — walk 6 payloads across your lane; each detonates in turn, damaging foes and scrubbing enemy fire. 14 s CD |

**Hangar tips**

- The stat chips on each card (SPD / RIF / HUL / DMG / CRT / CAL / RGN) summarize
  the trade-offs at a glance.
- Each hull's little canvas previews its silhouette; hulls also tint your HUD
  power bar and engine plumes.
- FLEET ADMIRAL commendation requires piloting all 12 hulls at least once.

## 4. Enemy bestiary — 13 classes

| Class | Behavior | Counter-play |
| --- | --- | --- |
| **Grunt** | straight diver, single shots | basics |
| **Zigzag** | sine weaver | track its period |
| **Homing** | seeks you; fires magenta missiles | missiles defuse after ~15 s — kite until they fizzle |
| **Splitter** | splits into two minis on death | kill it away from your lane |
| **Flanker** | side entry with a warning chevron | respect the blink |
| **Tank** | slow, armored 3-shot fan | pierce / crit / power through |
| **Shielder** | frontal arc shield that regenerates | flank from behind or the side |
| **Bomber** | lays armed mines | clear mines early |
| **Sniper** | telegraphed laser sight → fast shot | move after the lock |
| **Weaver** *(v4.2)* | blinks into your lane, quick-draw fan | keep moving after its blink |
| **Warden** *(v4.2)* | mends nearby foes, radial defense pulse | focus it first |
| **Phantom** *(v5.0)* | phases out of reach periodically — untouchable while ghosted, quick-draws on rematerialize | punish it in the tangible windows |
| **Zenith** *(v5.0)* | hovers, telegraphs, then dives through your lane at 3× speed | sidestep the dashed launch line |

**Elite variants** appear from wave 7: golden halo, 2.5× HP, slightly slower,
2.5× score, guaranteed power-up drop.

## 5. Boss archive — 12 archetypes

All bosses enrage at 30 % HP (faster fire, denser patterns, red flash).

| Boss | Signature patterns |
| --- | --- |
| **DREADNOUGHT** | fan spray, delayed aimed rail bursts, radial ring, rotating spiral |
| **SERAPH** | twin-arm spiral, bullet walls with a gap, 4-way cross bursts, flanker summons |
| **HYDRA** | triple venom fans, homing orbs, telegraphed coil dash trailing toxin |
| **TEMPEST** | blink repositioning, telegraphed lightning columns, chain-bolt fans, 4-arm static spiral |
| **MONOLITH** | rotating beam sweeps, mortar rings, mine volleys, frontal FORTIFY that blocks bullets |
| **ARCHON** | judgment ring volleys, twin wing lasers, void summons, 3-arm ascendant spiral |
| **VORTEX** *(v4.0)* | gravity pull, curved debris spirals, event-horizon implosions, singularity bursts |
| **GORGON** *(v4.0)* | five hair-turret fans, prism volleys that shatter mid-flight, gaze sweeps, prism storms |
| **LEVIATHAN** *(v4.2)* | tide floods, telegraphed maw-pull, fused homing spines (they defuse), twin maelstrom |
| **MIRAGE** *(v4.2)* | blink afterimages, mirror radial prisms, tri-lance rails, illusion doubles, shatter storms |
| **OUROBOROS** *(v5.0)* | rides a dashed elliptical orbit; coil spirals with curved arms, twin bite fans from head **and** tail, scale rings, enrage world-coil double spiral with weaver escorts |
| **CERBERUS** *(v5.0)* | three chained heads; staggered triple roar streams, hound calls that summon ZENITH dive bombers, telegraphed slam columns + shockwave, enrage infernal cross with prisms |

**Dual-boss ascension fights**: fixed pairs at waves 20 / 40 / 60
(DREADNOUGHT+SERAPH, TEMPEST+HYDRA, MONOLITH+ARCHON), then random pairs from
wave 80 onward. The music director swaps to the **finale theme** whenever two
ascendants are live.

## 6. Upgrades — 48 cards

Drafted 1-of-3 after every cleared wave (and after every Boss Rush kill).
Pick with click or 1 / 2 / 3. Levels are shown as pips.

### Core stats

- **Damage Up** (×9) — bullet damage +1
- **Fire Rate Up** (×7) — faster shooting
- **Thrusters** (×6) — movement speed +20
- **Aegis Regen** (×5) — shield recharges faster
- **Heavy Rounds** (×5) — larger bullets
- **Reinforce** (×2) — gain 1 life (up to 6)

### Weapons

- **Piercing Shots** (×3) — bullets pass through +1 enemy
- **Critical Matrix** (×5) — +8 % crit chance (2.5× damage)
- **Twin Cannons** (×3) — extra angled cannon pairs
- **Rail Accelerator** (×3) — bullet speed +20 %, damage +0.5
- **Ricochet Rounds** (×2) — bullets bounce off walls
- **Fusion Warheads** (×3) — kills explode, splash nearby foes
- **Marked Prey** (×3) — elites & bosses take +15 % damage
- **Cryo Rounds** (×3) — hits chill foes: −18 % speed & fire
- **Arc Conductor** (×3) — kills lightning-zap neighbors
- **Executioner** (×2) — foes under 12 % HP die on hit
- **Death Blossom** (×3) — kills may burst into petal shots
- **Singularity Rounds** (×2) — every 6th shot pulls foes in
- **Focus Lens** (×3) — stand still to stack +damage
- **Deadeye Suite** (×3) *(v5.0)* — critical hits deal +50 % damage per level
- **Broadside Array** (×3) *(v5.0)* — side cannons volley every few seconds

### Drones & missiles

- **Orbital Drone** (×3) — a drone orbits and auto-fires
- **Seeker Pods** (×3) — homing missiles every few seconds
- **Buzz Saws** (×3) — orbiting saw blades shred on contact

### Defense & utility

- **Magnet Core** (×3) — attract nearby power-ups
- **Phase Engine** (×3) — dash cooldown −12 %, dash hurts
- **Nova Pulse** (×3) — dashing blasts nearby enemies
- **Static Aura** (×3) — contact burns attackers
- **Chrono Field** (×3) — enemy bullets fly 10 % slower
- **Adrenaline Core** (×2) — low lives: faster fire & movement
- **Phoenix Protocol** (×1) — cheat death once per boss wave
- **Ghost Shell** (×2) — dash phasing lasts +0.5 s per level
- **Retaliation Matrix** (×2) — taking damage fires a counter-nova
- **Aegis Reversal** (×2) — shield-blocked shots recharge it
- **Ablative Plating** (×2) — every 25 s negate the next hit
- **Overclock Reactor** (×2) — first 4 s of a wave: faster fire
- **Guardian Ring** (×2) *(v5.0)* — orbiting wards collapse enemy shots
- **Combo Catalyst** (×3) *(v5.0)* — combo window +0.6 s per level
- **Sustain Field** (×3) *(v5.0)* — power-up timers drain 20 % slower
- **Surge Capacitor** (×2) *(v5.0)* — combo ×10+: faster fire & thrust

### Economy

- **Fortune Module** (×3) — +15 % score, +25 % power-up drops
- **Salvage Drones** (×2) — every 25 (then 15) kills grants +1 life
- **Glass Protocol** (×1) — +60 % damage, but max lives −1
- **Titanium Hull** (×2) — +1 max life, heal 1

## 7. Power-ups

| Drop | Effect |
| --- | --- |
| **R** Rapid Fire | much faster shooting for 6 s |
| **S** Spread Shot | 5-way spread for 6 s |
| **D** Deflector | free shield + full energy for 8 s |
| **P** Piercing | shots pierce for 8 s |
| **T** Time Dilation | 4 s of world slow-mo |
| **+** +1 Life | restores a hull cell |
| **N** Void Nuke | clears the screen, heavy boss damage |

Drops scale with wave number and Fortune Module; elites always drop.

## 8. Scoring, combos & zones

- Kills add `score × combo`; the combo window is 2.5 s (+0.6 s per Combo
  Catalyst level).
- **Score zones** (gold hexagons) spawn regularly — kills inside are worth ×2.
- Milestones toast at 10k / 25k / 50k / 100k / 250k / 500k / 1M points and
  50 / 100 / 200 / 500 / 1000 kills.
- Boss kill: +5000 plus the boss score value, chained secondary explosions and
  a slow-mo hit-stop.

## 9. Modes

- **Classic Ascension** — full wave campaign; bosses every 5th wave; special
  waves (Swarm / Minefield / Elite Squad) rotate on every 3rd normal wave;
  difficulty and music evolve — waves 26+ descend into the **abyss theme**.
- **BOSS RUSH** — every wave is a boss; a random dual pair every 4th fight;
  steep HP ramp; an upgrade draft after every kill; the gauntlet plays its own
  **rush theme**.

## 10. Commendations (17)

FIRST BLOOD · CENTURION · EXTERMINATOR · BOSS SLAYER · XENOARCHIVIST (all 12
archetypes) · CHAIN REACTION (x15 combo) · UNBROKEN (x30) · SINGULARITY (x50)
· DEEP DIVER (wave 10) · ABYSSAL (wave 20) · ABYSS DIVER (wave 30) · VOID
RICHES (100k) · GAUNTLET RUNNER (4 rush fights) · UNTOUCHABLE (wave 5
flawless) · FLEET ADMIRAL (all 12 hulls) · TAIL EATER (defeat OUROBOROS) ·
PACK LEADER (defeat CERBERUS)

## 11. Strategy corner

- **Combo is king.** Kills within the window multiply score. Combo Catalyst +
  Surge Capacitor turn a hot streak into a run-defining economy.
- **Phantoms reward patience.** Their ghost windows are fixed rhythm — unload
  the instant they re-materialize (the quick-draw fan is telegraphed by the
  materialize ring).
- **Zenith dives are dodge-by-default.** The dashed line shows the locked
  vector 0.3 s before launch; a light strafe beats it every time.
- **OUROBOROS orbits are readable.** Its tail mirrors its head across the
  arena center — the twin bite hits both points, so stand off-axis.
- **CERBERUS slams track you once.** Columns lock at telegraph; keep drifting
  and the shockwave ring is the only real threat.
- **FORGE turrets hold lanes.** Drop the BASTION ARRAY near wave center and
  play around them — they aim themselves, but they expire in 6 s with a
  flicker warning.
- **HALCYON erases bullet spam.** Each CARPET STRIKE detonation scrubs enemy
  shots in a 115 px radius — save a payload walk for bullet-wall moments.
- **Boss Rush drafting** favors survivability early (Titanium Hull, Ablative
  Plating) since HP ramps steeply; offense scales through Damage + Deadeye +
  Marked Prey.

## 12. Settings & data

- Music / SFX volume sliders, screen shake, CRT scanlines, FPS counter,
  reduced effects — all persisted in `localStorage`
- **Swap joystick / buttons** (v5.1) — converts the touch layout between
  joypad-left/buttons-right (default) and joypad-right/buttons-left
  (left-handed); persisted with the rest of the settings
- Top-5 leaderboard, best score per mode
- The selected hull persists across sessions
- Pause-on-blur keeps runs safe when you tab away

## 13. Tech notes

- Plain classic `<script>` modules on one `VB` namespace — no build step.
- Rendering fully separated from logic (`render.js` owns all draw calls).
- All audio is 44.1 kHz 16-bit PCM WAV synthesized with numpy; music loops are
  seamless by construction (circular placement at the loop boundary).
- 7 stereo music loops: menu, battle A/B, boss, rush, abyss, finale.
- Works from `file://` (HTML5 audio fallback) or any static HTTP server.
