'use strict';
/* =====================================================================
   SAVE MIGRATION (v5) — ranch saves carry a version number. Every release that changes the save format adds one
   step to MIGRATIONS (version N -> N+1), so a save from any release since SAVE_MIN_VERSION still loads.
   Saves from the future (newer than this build) or corrupt saves are refused, never half-loaded.
     v4 -> v5: the world grew 4x (the old map is the top-left quarter, positions stay valid), new market / story
               state, five new Jumbos, a fifth neighbour, tide chests. New-area slimes are added once.
   ===================================================================== */
const MIGRATIONS = {
  4: d => {
    d.market = null;                      // rolled fresh on load
    d.story = null;                       // the story starts at chapter 1 for older ranches
    d.populateNewAreas = true;            // the three new quarters are empty in an old save: add their wild slimes once
    return d;
  }
};
function migrateSave(d) {
  if (!d || typeof d.v !== 'number' || d.v < SAVE_MIN_VERSION || d.v > SAVE_VERSION) return null;
  while (d.v < SAVE_VERSION) { const step = MIGRATIONS[d.v]; if (!step) return null; d = step(d); d.v++; }
  return d;
}
// Reads and migrates the stored ranch. Returns null when there is no usable save.
function readSave() {
  try { return migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (e) { return null; }
}
