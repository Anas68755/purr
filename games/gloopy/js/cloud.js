'use strict';
/* =====================================================================
   GLOOPY CLOUD (0.16) — cloud save + cloud identity for Gloopy Meadow.
   Uses the shared PURR CloudKit client (games/_shared/cloud.js).
   · Cloud save: the ranch save (gloopyMeadow_save) is mirrored to the
     `saves` table (game 'gloopy', slot 'main'). Newest timestamp wins;
     the game keeps working fully offline when the cloud is unreachable.
   · Multiplayer identity: a stable uid per browser for the relay shim.
   ===================================================================== */
const GloopyCloud = (() => {
  const SYNC_KEY = 'gloopyCloud_sync';        // { pushedAt, lastPushData }
  let lastPush = 0;
  let lastPayload = null;
  let pendingForce = false;

  function syncMeta() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } }
  function setSyncMeta(v) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(v)); } catch (e) {} }

  const on = () => !!(window.CloudKit && window.CloudKit.online && window.CloudKit.online());

  /* Called by saveGame() after the local save was written. */
  function pushSave(saveObj, force) {
    try {
      if (!saveObj || typeof saveObj !== 'object') return;
      lastPayload = saveObj;
      const now = Date.now();
      if (!force && now - lastPush < 60000) return;       // at most one push per minute
      lastPush = now;
      setSyncMeta(Object.assign(syncMeta(), { pushedAt: now }));
      window.CloudKit.saveCloud('gloopy', saveObj);
    } catch (e) { /* offline — ignore */ }
  }

  /* Periodic + page-hide flush with fresh data. */
  function flush() {
    if (lastPayload) pushSave(lastPayload, true);
  }

  /* Called once at boot, before the main menu renders. If the cloud copy
     is newer than the last push we made, it restores over the local save
     (e.g. you played on another device). Returns 'restored' | 'kept' | null. */
  async function pullLatest() {
    try {
      if (!window.CloudKit) return null;
      const remote = await window.CloudKit.loadCloud('gloopy');
      if (!remote || !remote.data || typeof remote.data !== 'object') return null;
      if (!remote.data || typeof remote.data.v !== 'number') return null;   // not a gloopy save
      const meta = syncMeta();
      const pushedAt = meta.pushedAt || 0;
      const remoteAt = new Date(remote.updated_at || 0).getTime() || 0;
      // Only restore when the cloud copy is newer than anything we pushed ourselves.
      if (remoteAt > pushedAt + 5000) {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(remote.data)); } catch (e) { return null; }
        setSyncMeta({ pushedAt: Date.now() });
        return 'restored';
      }
      return 'kept';
    } catch (e) { return null; }
  }

  /* Delete the cloud copy (used when the player wipes their ranch). */
  async function wipe() {
    try { if (window.CloudKit) await window.CloudKit.deleteCloud('gloopy'); setSyncMeta({}); } catch (e) {}
  }

  return { pushSave, flush, pullLatest, wipe, on };
})();
