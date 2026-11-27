'use strict';
/* =====================================================================
   I18N (0.11) — English ⇄ العربية (RTL).
   The game's text lives in English in the code; Arabic is applied at the moment text reaches the screen:
     · every DOM text node (menus, HUD, toasts, alerts, tooltips) is translated by a MutationObserver,
     · canvas text (labels above heads, signs) goes through tr().
   Dictionaries (js/ar_*.js) map English → Arabic. Three kinds of entry:
     "Exact sentence"            → replaces that text everywhere it appears (also as a fragment inside longer text);
     "Sold {n} glimmers"         → {n} = a number (replaced inside longer text);
     "{x} and {y} are happy"     → {x}/{y} = any text, the WHOLE string must match; captures are translated too.
   Missing translation = the English stays (nothing breaks). `I18N.misses` lists what is still untranslated (see tools/i18n_report.js).
   ===================================================================== */
const I18N = { lang: 'en', dict: Object.create(null), exact: Object.create(null), anchored: [], numeric: [], rx: null, cache: new Map(), misses: new Set(), collect: false, observer: null };
const I18N_LATIN = /[A-Za-z]/;
const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function i18nAdd(obj) {
  for (const k in obj) {
    const v = obj[k];
    if (!/\{\w+\}/.test(k)) { I18N.dict[k] = v; continue; }
    const names = [], anyText = /\{[a-z]\w*\}/.test(k.replace(/\{n\d*\}/g, ''));
    const src = escRx(k).replace(/\\\{(\w+)\\\}/g, (_, n) => { names.push(n); return /^n\d*$/.test(n) ? '(\\d+(?:[.,]\\d+)?)' : '([^\\d]+?)'; });         // {x} never swallows digits, so “Pet {x}” cannot hijack “Pet slimes 5 times”
    const entry = { key: k, names, val: v, rx: new RegExp(anyText ? '^' + src + '$' : src, anyText ? 's' : 'g') };
    (anyText ? I18N.anchored : I18N.numeric).push(entry);
  }
  I18N.anchored.sort((a, b) => b.key.length - a.key.length); I18N.numeric.sort((a, b) => b.key.length - a.key.length);
  I18N.rx = null; I18N.cache.clear();
}
// entries that are only used when the WHOLE text matches (slime names, proper nouns): never replaced inside longer sentences
function i18nAddExact(obj) { Object.assign(I18N.exact, obj); I18N.cache.clear(); }
function i18nBuild() {                                    // long sentences are replaced BEFORE number templates (so “Harvest {n} crops” cannot cut a longer sentence in two)
  const mk = list => list.length ? new RegExp('(?<![A-Za-z\\u0600-\\u06FF])(?:' + list.map(escRx).join('|') + ')(?![A-Za-z\\u0600-\\u06FF])', 'g') : /$^/;
  const keys = Object.keys(I18N.dict).filter(k => k.length > 1 || /[A-Za-z]/.test(k)).sort((a, b) => b.length - a.length);
  I18N.rxLong = mk(keys.filter(k => k.length >= 28)); I18N.rx = mk(keys.filter(k => k.length < 28));
}
const fill = (e, m) => e.val.replace(/\{(\w+)\}/g, (_, n) => { const i = e.names.indexOf(n); return i < 0 ? '{' + n + '}' : (/^n\d*$/.test(n) ? m[i + 1] : tr(m[i + 1])); });

function trCore(s) {
  const ps = s.match(/^(.*?)(\s*\(\d+\/\d+\) → \$\d+)$/s);                      // order progress suffix: “… (1/3) → $40”
  if (ps && ps[1]) return trCore(ps[1]) + ps[2].replace('→', '←');
  if (s in I18N.exact) return I18N.exact[s];
  if (s in I18N.dict) return I18N.dict[s];
  const em = s.match(/^([^A-Za-z]*)([A-Za-z].*?[A-Za-z.!?])([^A-Za-z]*)$/s);                  // “✨ Pebbles”, “Mochi 🎈”: emoji around a known word
  if (em && (em[1] || em[3]) && (em[2] in I18N.exact || em[2] in I18N.dict)) return em[1] + (I18N.exact[em[2]] || I18N.dict[em[2]]) + em[3];
  for (const e of I18N.anchored) { const m = s.match(e.rx); if (m) return fill(e, m); }
  if (!I18N.rx) i18nBuild();
  let out = s.replace(I18N.rxLong, k => I18N.dict[k]);
  for (const e of I18N.numeric) out = out.replace(e.rx, (...m) => fill(e, m));
  out = out.replace(I18N.rx, k => I18N.dict[k]);
  return out;
}
function tr(s) {
  if (I18N.lang === 'en' || typeof s !== 'string' || !I18N_LATIN.test(s)) return s;
  let r = I18N.cache.get(s); if (r !== undefined) return r;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
  r = core ? lead + trCore(core) + trail : s;
  if (I18N.collect && I18N_LATIN.test(r.replace(/[xX]\d|\b[A-Z]\b|OK/g, '')) && I18N.dict[core] !== core) I18N.misses.add(s.trim());
  if (I18N.cache.size > 6000) I18N.cache.clear();
  I18N.cache.set(s, r); return r;
}

/* ---------------- DOM ---------------- */
const I18N_ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
function trTextNode(n) {
  const cur = n.data;
  if (n.__ar !== undefined && cur === n.__ar) return;             // already our translation
  if (!I18N_LATIN.test(cur) && n.__en === undefined) return;
  if (n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-notr]')) return;      // player names and typed chat are never translated
  n.__en = cur;
  const t = I18N.lang === 'en' ? cur : tr(cur);
  n.__ar = t; if (t !== cur) n.data = t;
}
function trElementAttrs(el) {
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const key = 'data-en-' + a, en = el.hasAttribute(key) ? el.getAttribute(key) : el.getAttribute(a);
    if (!el.hasAttribute(key)) { if (!I18N_LATIN.test(en)) continue; el.setAttribute(key, en); }
    el.setAttribute(a, I18N.lang === 'en' ? en : tr(en));
  }
}
function trDom(root) {
  if (!root || typeof document === 'undefined' || !document.createTreeWalker) return;
  const base = root.nodeType === 3 ? root.parentNode : root;
  if (root.nodeType === 3) { trTextNode(root); return; }
  if (base.nodeType !== 1) return;
  const w = document.createTreeWalker(base, 5);                    // text + element nodes
  let n = w.currentNode;
  if (n.nodeType === 1) trElementAttrs(n);
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) { if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; trTextNode(n); }
    else trElementAttrs(n);
  }
}
function i18nFlush() { if (I18N.observer) { const recs = I18N.observer.takeRecords(); handleMutations(recs); } }
function handleMutations(recs) {
  if (I18N.lang === 'en' && !recs.some(r => r.type === 'childList')) return;
  for (const r of recs) {
    if (r.type === 'characterData') trTextNode(r.target);
    else for (const n of r.addedNodes) trDom(n);
  }
}
function i18nStartObserver() {
  if (I18N.observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  I18N.observer = new MutationObserver(handleMutations);
  I18N.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/* ---------------- language switch ---------------- */
const i18nAuto = () => (typeof navigator !== 'undefined' && /^ar/i.test(navigator.language || '')) ? 'ar' : 'en';
function setLang(l) {
  if (l !== 'ar') l = 'en';
  I18N.lang = l; I18N.cache.clear();
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.lang = l; document.documentElement.dir = 'ltr';
  if (document.body) { document.body.classList.toggle('rtl', l === 'ar'); i18nStartObserver(); trDom(document.body); }
}
// settings.lang: -1 = follow the browser, 0 = English, 1 = العربية
function applyLanguage() {
  const v = profile.settings.lang;
  setLang(v === 1 ? 'ar' : v === 0 ? 'en' : i18nAuto());
}
const isRtl = () => I18N.lang === 'ar';

// Lists every static string (names, descriptions, story…) found in the given {label: object} map that has no Arabic yet.
function i18nCoverage(sources) {
  const missing = new Map(), prev = I18N.lang; I18N.lang = 'ar'; I18N.cache.clear();
  const SKIP_KEYS = ['color', 'dark', 'icon', 'cell', 'id', 'kind', 'key', 'what', 'area', 'npc', 'badge', 'ch', 'food', 'type', 'stat', 'treasure', 'power', 'fav'];
  const add = (src, s) => {
    if (typeof s !== 'string' || !/[A-Za-z]{2}/.test(s) || /^(#[0-9a-f]{3,8}|[a-z0-9_]+|assets\/.*|[a-z]+\.[a-z]+)$/.test(s)) return;
    if (/[A-Za-z]{2}/.test(tr(s))) { if (!missing.has(src)) missing.set(src, new Set()); missing.get(src).add(s); }
  };
  const walk = (src, v, d = 0) => {
    if (d > 6 || v == null || typeof v === 'function') return;
    if (typeof v === 'string') return add(src, v);
    if (Array.isArray(v)) return v.forEach(x => walk(src, x, d + 1));
    if (typeof v === 'object') for (const k in v) { if (SKIP_KEYS.includes(k) && typeof v[k] === 'string') continue; walk(src, v[k], d + 1); }
  };
  for (const k in sources) walk(k, sources[k]);
  I18N.lang = prev; I18N.cache.clear();
  return missing;
}
