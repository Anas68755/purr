'use strict';
/* Image loader. Every file in IMAGE_FILES is loaded up-front; a file that fails to load is
   simply absent (Assets.get returns null) and the renderer draws a vector fallback instead. */
const Assets = {
  img: {},
  missing: [],

  get(key) { return this.img[key] || null; },

  loadOne(key) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => { this.img[key] = im; resolve(true); };
      im.onerror = () => { this.missing.push(IMAGE_FILES[key]); console.warn('[assets] missing image:', IMAGE_FILES[key]); resolve(false); };
      im.src = IMAGE_FILES[key];
    });
  },

  // tinted copy of one sprite-sheet cell (white sprites -> any colour), cached
  _tints: {},
  tint(key, cell, cellW, color) {
    const id = key + cell + color;
    if (this._tints[id]) return this._tints[id];
    const src = this.get(key);
    if (!src) return null;
    const c = document.createElement('canvas');
    c.width = cellW; c.height = src.height;
    const x = c.getContext('2d');
    x.drawImage(src, cell * cellW, 0, cellW, src.height, 0, 0, cellW, src.height);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    this._tints[id] = c;
    return c;
  },

  async loadAll(onProgress) {
    const keys = Object.keys(IMAGE_FILES);
    let done = 0;
    await Promise.all(keys.map(k => this.loadOne(k).then(() => { done++; if (onProgress) onProgress(done / keys.length); })));
  }
};
