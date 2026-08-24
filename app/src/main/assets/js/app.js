/* ============================================================
   Butterleaf — shell: icons, router, sheets, native bridge
   ============================================================ */
(function (BL) {
  'use strict';

  /* ------------------------------------------------------- icons */

  var I = {};
  function icon(name, size) {
    var p = I[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '>' + p + '</svg>';
  }
  I.search = '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>';
  I.plus = '<path d="M12 5v14M5 12h14"/>';
  I.minus = '<path d="M5 12h14"/>';
  I.heart = '<path d="M12 20.5S3.8 15.4 3.8 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.2 2.3c0 5.5-8.2 10.6-8.2 10.6z"/>';
  I.heartFill = '<path d="M12 20.5S3.8 15.4 3.8 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.2 2.3c0 5.5-8.2 10.6-8.2 10.6z" fill="currentColor" stroke="currentColor"/>';
  I.clock = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>';
  I.timer = '<path d="M10 2.8h4"/><circle cx="12" cy="13.5" r="7.7"/><path d="M12 9.6v4.2"/><path d="M17.6 8.2l1.5-1.5"/>';
  I.book = '<path d="M4.5 4.5A1.5 1.5 0 0 1 6 3h13v15H6a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M4.5 19.5A1.5 1.5 0 0 1 6 18h13v3H6a1.5 1.5 0 0 1-1.5-1.5z"/>';
  I.scale = '<path d="M12 4v16"/><path d="M6.5 8h11"/><path d="M4 15.5a3 3 0 0 0 5 0L6.5 8 4 15.5z"/><path d="M15 15.5a3 3 0 0 0 5 0L17.5 8 15 15.5z"/>';
  I.cart = '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M3 4h2l2.4 10.4a1.6 1.6 0 0 0 1.6 1.2h7.7a1.6 1.6 0 0 0 1.6-1.2L20 7.5H6"/>';
  I.tools = '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>';
  I.chevron = '<path d="M9 5l7 7-7 7"/>';
  I.back = '<path d="M15 5l-7 7 7 7"/>';
  I.check = '<path d="M5 12.5l4.5 4.5L19 7"/>';
  I.camera = '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>';
  I.trash = '<path d="M4 6.5h16"/><path d="M9.5 6.5V4.8h5v1.7"/><path d="M6.5 6.5l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.2"/>';
  I.play = '<path d="M8 5.5l11 6.5-11 6.5z"/>';
  I.pause = '<path d="M9 5v14M15 5v14"/>';
  I.reset = '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4.5V9h4.5"/>';
  I.x = '<path d="M6 6l12 12M18 6L6 18"/>';
  I.link = '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.7 6.6"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4"/>';
  I.edit = '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/>';
  I.share = '<path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M5 14v5.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V14"/>';
  I.sliders = '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>';
  I.percent = '<path d="M6 18L18 6"/><circle cx="7.8" cy="7.8" r="2.4"/><circle cx="16.2" cy="16.2" r="2.4"/>';
  I.swap = '<path d="M7 8h11l-3-3"/><path d="M17 16H6l3 3"/>';
  I.thermometer = '<path d="M14 14.8V5.5a2 2 0 1 0-4 0v9.3a4 4 0 1 0 4 0z"/>';
  I.download = '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>';
  I.upload = '<path d="M12 20V9"/><path d="M8 12l4-4 4 4"/><path d="M5 5h14"/>';
  I.leaf = '<path d="M12 3c6 4.5 7 10.5 0 18-7-7.5-6-13.5 0-18z"/><path d="M12 6.5v12"/><path d="M12 11l3-2.4M12 14.5l3.2-2.4M12 11L9 8.6M12 14.5L8.8 12"/>';
  I.wheat = '<path d="M12 21V9"/><path d="M12 12c0-2 1.5-3.5 3.5-3.5C15.5 10.5 14 12 12 12z"/><path d="M12 12c0-2-1.5-3.5-3.5-3.5C8.5 10.5 10 12 12 12z"/><path d="M12 8c0-2 1.5-3.5 3.5-3.5C15.5 6.5 14 8 12 8z"/><path d="M12 8c0-2-1.5-3.5-3.5-3.5C8.5 6.5 10 8 12 8z"/>';
  I.list = '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>';
  I.moon = '<path d="M20 14.5A8 8 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5z"/>';
  I.more = '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>';
  I.bell = '<path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15z"/><path d="M10 21h4"/>';
  I.note = '<path d="M6 3.5h9L19 8v12.5H6z"/><path d="M14.5 3.5V8H19"/><path d="M9 13h7M9 16.5h5"/>';

  BL.icon = icon;

  /* -------------------------------------------------- native shim */

  var pendingFetch = {};
  var pendingImage = {};

  var N = window.Native || null;
  var native = {
    isAndroid: !!(N && N.platform && N.platform() === 'android'),

    toast: function (m) { BL.toast(m); },

    vibrate: function (ms) {
      if (N && N.vibrate) N.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    },

    keepAwake: function (on) { if (N && N.keepAwake) N.keepAwake(!!on); },

    fetchUrl: function (url) {
      return new Promise(function (resolve) {
        if (N && N.fetchUrl) {
          var id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
          pendingFetch[id] = resolve;
          N.fetchUrl(url, id);
          setTimeout(function () {
            if (pendingFetch[id]) { delete pendingFetch[id]; resolve({ ok: false, error: 'timed out' }); }
          }, 30000);
        } else {
          fetch(url).then(function (r) {
            return r.text().then(function (t) { return { ok: r.ok, status: r.status, html: t, finalUrl: url }; });
          }).then(resolve).catch(function (e) { resolve({ ok: false, error: String(e) }); });
        }
      });
    },

    fetchImage: function (url) {
      return new Promise(function (resolve) {
        if (N && N.fetchImage) {
          var id = 'i' + Date.now() + Math.random().toString(36).slice(2, 7);
          pendingImage[id] = resolve;
          N.fetchImage(url, id);
          setTimeout(function () {
            if (pendingImage[id]) { delete pendingImage[id]; resolve(''); }
          }, 30000);
        } else {
          resolve('');
        }
      });
    },

    scheduleAlarm: function (id, at, label) { if (N && N.scheduleAlarm) N.scheduleAlarm(id, at, label || 'Bake timer'); },
    cancelAlarm: function (id) { if (N && N.cancelAlarm) N.cancelAlarm(id); },
    canScheduleExact: function () { return N && N.canScheduleExact ? N.canScheduleExact() : true; },
    openExactAlarmSettings: function () { if (N && N.openExactAlarmSettings) N.openExactAlarmSettings(); },
    exportBackup: function (json) {
      if (N && N.exportBackup) { N.exportBackup(json); return; }
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'butterleaf-backup.json';
      a.click();
    },
    importBackup: function () { if (N && N.importBackup) N.importBackup(); else BL.toast('File import needs the app'); },
    exit: function () { if (N && N.exitApp) N.exitApp(); }
  };
  BL.native = native;

  window.__onFetch = function (id, json) {
    var r = pendingFetch[id];
    if (!r) return;
    delete pendingFetch[id];
    try { r(JSON.parse(json)); } catch (e) { r({ ok: false, error: 'bad response' }); }
  };
  window.__onImage = function (id, dataUrl) {
    var r = pendingImage[id];
    if (!r) return;
    delete pendingImage[id];
    r(dataUrl || '');
  };
  window.__setInsets = function (top, bottom) {
    document.documentElement.style.setProperty('--sat', Math.max(top, 8) + 'px');
    document.documentElement.style.setProperty('--sab', Math.max(bottom, 8) + 'px');
  };
  window.__setTheme = function (mode) {
    BL.systemTheme = mode;
    BL.applyTheme();
  };
  window.__onSharedUrl = function (url) {
    BL.pendingSharedUrl = url;
    BL.go('#/import');
  };
  window.__onImport = function (json) {
    try {
      var res = BL.store.importAll(json, 'merge');
      BL.toast('Restored ' + res.added + ' recipes' + (res.updated ? ', updated ' + res.updated : ''));
      BL.render();
    } catch (e) {
      BL.toast('That file could not be read');
    }
  };

  /* ------------------------------------------------------- theme */

  BL.systemTheme = 'light';
  BL.applyTheme = function () {
    var pref = BL.store.settings ? BL.store.settings().theme : 'auto';
    var mode = pref === 'auto' ? BL.systemTheme : pref;
    document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
  };

  /* ------------------------------------------------------- toast */

  var toastTimer = null;
  BL.toast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2400);
  };

  /* ------------------------------------------------------- sheet */

  BL.sheet = function (html, onMount) {
    var sheet = document.getElementById('sheet');
    var veil = document.getElementById('veil');
    sheet.innerHTML = '<div class="handle"></div><div class="sheet-body">' + html + '</div>';
    sheet.classList.add('on');
    veil.classList.add('on');
    BL.sheetOpen = true;
    if (onMount) onMount(sheet);
  };
  BL.closeSheet = function () {
    document.getElementById('sheet').classList.remove('on');
    document.getElementById('veil').classList.remove('on');
    BL.sheetOpen = false;
  };

  BL.confirm = function (title, message, confirmLabel, onYes) {
    BL.sheet(
      '<h2 class="h1">' + BL.esc(title) + '</h2>' +
      '<p class="body" style="margin:0 0 22px">' + BL.esc(message) + '</p>' +
      '<button class="btn btn-primary btn-block" data-yes style="margin-bottom:10px">' + BL.esc(confirmLabel) + '</button>' +
      '<button class="btn btn-ghost btn-block" data-no>Cancel</button>',
      function (s) {
        s.querySelector('[data-yes]').onclick = function () { BL.closeSheet(); onYes(); };
        s.querySelector('[data-no]').onclick = BL.closeSheet;
      }
    );
  };

  /* ------------------------------------------------------ helpers */

  BL.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  BL.uid = function () {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  BL.fmtMins = function (m) {
    if (!m && m !== 0) return '';
    m = Math.round(m);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' hr ' + r + ' min' : h + (h === 1 ? ' hour' : ' hours');
  };

  /** Compact form for tight spots: 45 min · 1h 20m · 12h */
  BL.fmtShort = function (m) {
    if (!m && m !== 0) return '';
    m = Math.round(m);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + 'h ' + r + 'm' : h + 'h';
  };

  BL.sortTitle = function (t) {
    return String(t || '').toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
  };

  /* ------------------------------------------------------- router */

  var routes = {};
  BL.route = function (name, fn) { routes[name] = fn; };

  BL.stack = [];
  BL.go = function (hash, replace) {
    if (BL.sheetOpen) BL.closeSheet();
    if (replace) location.replace(hash);
    else location.hash = hash;
  };
  BL.back = function () {
    if (BL.stack.length > 1) history.back();
    else BL.go('#/library', true);
  };

  window.__onBack = function () {
    if (BL.sheetOpen) { BL.closeSheet(); return true; }
    if (BL.viewBack && BL.viewBack()) return true;
    var h = location.hash;
    if (h === '#/library' || h === '' || h === '#/') {
      BL.native.exit();
      return true;
    }
    BL.back();
    return true;
  };

  function parseHash() {
    var h = (location.hash || '#/library').replace(/^#/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'library', arg: parts[1] ? decodeURIComponent(parts[1]) : null, parts: parts };
  }

  BL.render = function () {
    var r = parseHash();
    var fn = routes[r.name] || routes.library;
    BL.viewBack = null;

    // Swap in a clean #screen node so listeners from the previous view
    // cannot pile up and fire twice.
    var old = document.getElementById('screen');
    var screen = old.cloneNode(false);
    old.parentNode.replaceChild(screen, old);

    fn(screen, r.arg, r.parts);
    screen.scrollTop = 0;
    paintNav(r.name);
  };

  /* ---------------------------------------------------------- nav */

  var NAV = [
    { name: 'library', label: 'Recipes', icon: 'book', hash: '#/library' },
    { name: 'favorites', label: 'Favorites', icon: 'heart', hash: '#/favorites' },
    { name: '__fab' },
    { name: 'timers', label: 'Timers', icon: 'timer', hash: '#/timers' },
    { name: 'tools', label: 'Tools', icon: 'tools', hash: '#/tools' }
  ];

  function buildNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(function (n) {
      if (n.name === '__fab') {
        return '<div class="fab-slot" style="flex:1">' +
          '<button id="fab" aria-label="Add a recipe">' + icon('plus') + '</button></div>';
      }
      return '<button data-nav="' + n.name + '" data-hash="' + n.hash + '">' +
        '<span class="dot"></span>' + icon(n.icon) + '<span>' + n.label + '</span></button>';
    }).join('');

    nav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hash]');
      if (b) { BL.go(b.getAttribute('data-hash')); return; }
      if (e.target.closest('#fab')) BL.addSheet();
    });
  }

  function paintNav(active) {
    var map = { recipe: 'library', edit: 'library', 'new': 'library', import: 'library',
      convert: 'tools', shopping: 'tools', bakers: 'tools', settings: 'tools', starter: 'tools' };
    var key = map[active] || active;
    Array.prototype.forEach.call(document.querySelectorAll('#nav [data-nav]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-nav') === key);
    });
  }

  BL.addSheet = function () {
    BL.sheet(
      '<h2 class="h1">Add a recipe</h2>' +
      '<button class="tile" data-go="#/import"><span class="ti">' + icon('link') + '</span>' +
      '<span class="grow"><div class="tt">Import from a link</div>' +
      '<div class="ts">Paste a URL — we lift the recipe out of the page</div></span></button>' +
      '<button class="tile" data-go="#/new"><span class="ti">' + icon('edit') + '</span>' +
      '<span class="grow"><div class="tt">Write it myself</div>' +
      '<div class="ts">A blank page for your own bake</div></span></button>',
      function (s) {
        s.addEventListener('click', function (e) {
          var t = e.target.closest('[data-go]');
          if (t) { BL.closeSheet(); BL.go(t.getAttribute('data-go')); }
        });
      }
    );
  };

  /* -------------------------------------------------------- boot */

  function boot() {
    buildNav();
    document.getElementById('veil').addEventListener('click', BL.closeSheet);

    BL.store.init().then(function () {
      BL.applyTheme();
      BL.timers.init();
      window.addEventListener('hashchange', function () {
        BL.stack.push(location.hash);
        BL.render();
      });
      if (!location.hash) location.replace('#/library');
      BL.render();
      document.body.classList.add('ready');
    }).catch(function (e) {
      document.getElementById('screen').innerHTML =
        '<div class="empty"><h3>Something went wrong</h3><p>' + BL.esc(String(e)) + '</p></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.BL = window.BL || {});
