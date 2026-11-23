/* purr runtime splitter — loads a legacy single-file game and separates
   its <style>/<script> blocks into live DOM resources, preserving order. */
(function () {
  'use strict';
  if (window.__PURR_SPLIT_DONE__) return;
  window.__PURR_SPLIT_DONE__ = true;

  var me = document.currentScript;
  var SRC = me && me.getAttribute('data-src');
  if (!SRC) return;

  function fail(msg) {
    var b = document.body;
    if (b) b.innerHTML =
      '<p style="color:#eee;font:16px sans-serif;padding:2rem">' + msg +
      ' <a style="color:#7ab8ff" href="' + SRC + '">Open the game directly</a>.</p>';
  }

  function cloneAttrs(from, to) {
    for (var i = 0; i < from.attributes.length; i++) {
      var a = from.attributes[i];
      to.setAttribute(a.name, a.value);
    }
  }

  function run(text) {
    var bodyEl = document.body;
    if (!bodyEl) { fail('DOM not ready.'); return; }
    var doc = new DOMParser().parseFromString(text, 'text/html');

    // mirror the legacy document's <html> and <body> attributes
    if (doc.documentElement.hasAttributes()) cloneAttrs(doc.documentElement, document.documentElement);
    if (doc.body && doc.body.hasAttributes()) cloneAttrs(doc.body, bodyEl);
    if (doc.title) document.title = doc.title;

    bodyEl.innerHTML = '';   // drop the loading splash

    var queue = [];

    // head: copy meta/link nodes, inject styles live, queue scripts
    Array.prototype.forEach.call(doc.head ? doc.head.children : [], function (el) {
      var tag = el.tagName.toLowerCase();
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'script') {
        if (el.hasAttribute('src') || (type && type !== 'importmap' && type !== 'application/json')) {
          queue.push(el);
        } else if (type === 'importmap' || type === 'application/json') {
          var keep = document.createElement('script');
          keep.type = type;
          keep.textContent = el.textContent;
          document.head.appendChild(keep);          // importmap/json must exist before modules run
        }
        return;
      }
      if (tag === 'base') return;                    // our <base> already matches
      document.head.appendChild(document.importNode(el, true));
    });

    // body: copy everything except scripts, queue the scripts in order
    Array.prototype.forEach.call(doc.body ? doc.body.children : [], function (el) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'script') { queue.push(el); return; }
      if (tag === 'style') {
        document.head.appendChild(document.importNode(el, true));
        return;
      }
      bodyEl.appendChild(document.importNode(el, true));
    });

    // run queued scripts sequentially (order = original document order)
    queue.forEach(function (el) {
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (el.hasAttribute('src')) {
        var s = document.createElement('script');
        cloneAttrs(el, s);
        s.async = false;                             // keep execution order for externals
        bodyEl.appendChild(s);
        return;
      }
      var s2 = document.createElement('script');
      if (type) s2.setAttribute('type', type);       // 'module' etc.
      cloneAttrs(el, s2);
      s2.removeAttribute('src');
      s2.textContent = el.textContent;
      bodyEl.appendChild(s2);                        // classic inline executes here, in order
    });

    // late-registered lifecycle listeners: replay what already fired
    if (document.readyState === 'interactive') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    } else if (document.readyState === 'complete') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
    }
  }

  // fetch starts right away; DOM work waits until <body> exists
  var pending = fetch(SRC, { cache: 'force-cache' });

  function boot() {
    pending.then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(run).catch(function (e) {
      fail('Could not load the game (' + e.message + ').');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
