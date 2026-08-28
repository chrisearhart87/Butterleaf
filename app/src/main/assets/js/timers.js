/* ============================================================
   Butterleaf — bake timers
   Multiple concurrent timers, each backed by a real Android
   alarm so it rings even when the app is closed.
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc;

  var timers = [];
  var ticking = null;
  var audioCtx = null;
  var chimeStop = null;

  var PRESETS = [
    { m: 5, label: 'Quick check' },
    { m: 10, label: 'Cool on sheet' },
    { m: 12, label: 'Cookies' },
    { m: 20, label: 'Cake layers' },
    { m: 25, label: 'Loaf bake' },
    { m: 30, label: 'Bench rest' },
    { m: 45, label: 'Autolyse' },
    { m: 60, label: 'Proof' },
    { m: 90, label: 'Long proof' },
    { m: 240, label: 'Bulk ferment' }
  ];

  // Starting several timers in quick succession used to fire one shade sync
  // each; coalesce them so a burst crosses the bridge once.
  var shadeSoon = null;
  function save() {
    BL.store.saveTimers(timers);
    if (shadeSoon) clearTimeout(shadeSoon);
    shadeSoon = setTimeout(function () { shadeSoon = null; pushToShade(); }, 120);
  }

  /** Hands the live timers to Android so they show in the notification shade. */
  function pushToShade() {
    var live = timers.filter(function (t) { return t.state === 'running' || t.state === 'paused'; })
      .map(function (t) {
        return {
          id: t.id,
          label: t.label || 'Bake timer',
          endAt: t.state === 'paused' ? Date.now() + (t.leftSec || 0) * 1000 : t.endAt,
          leftSec: remaining(t),
          paused: t.state === 'paused'
        };
      });
    BL.native.syncTimers(live);
  }

  function remaining(t) {
    if (t.state === 'paused') return Math.max(0, Math.round(t.leftSec));
    return Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function ensureTick() {
    if (ticking) return;
    ticking = setInterval(function () {
      var anyRunning = false;
      timers.forEach(function (t) {
        if (t.state === 'running') {
          anyRunning = true;
          if (remaining(t) <= 0 && t.state !== 'done') {
            t.state = 'done';
            t.doneAt = Date.now();
            onFinish(t);
          }
        }
      });
      paintTick();
      if (!anyRunning && !timers.some(function (t) { return t.state === 'done'; })) {
        clearInterval(ticking);
        ticking = null;
      }
    }, 500);
  }

  function onFinish(t) {
    save();   // a finished timer drops out of the shade; the alarm takes over
    BL.native.vibrate(600);
    chime();
    BL.toast('⏱ ' + (t.label || 'Timer') + ' — time\'s up');
    if (location.hash !== '#/timers') BL.render();
  }

  function chime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var count = 0;
      clearInterval(chimeStop);
      chimeStop = setInterval(function () {
        if (count++ > 11) { clearInterval(chimeStop); return; }
        [880, 1320].forEach(function (f, i) {
          var o = audioCtx.createOscillator();
          var g = audioCtx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          var start = audioCtx.currentTime + i * 0.16;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.32, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
          o.connect(g).connect(audioCtx.destination);
          o.start(start);
          o.stop(start + 0.55);
        });
      }, 900);
    } catch (e) {}
  }

  function stopChime() { clearInterval(chimeStop); chimeStop = null; }

  /* ------------------------------------------------------- public */

  var api = {
    init: function () {
      timers = (BL.store.timers() || []).filter(function (t) {
        return t && (t.state !== 'done' || (Date.now() - (t.doneAt || 0) < 6 * 3600 * 1000));
      });
      timers.forEach(function (t) {
        if (t.state === 'running' && remaining(t) <= 0) { t.state = 'done'; t.doneAt = t.endAt; }
      });
      save();
      if (timers.some(function (t) { return t.state === 'running'; })) ensureTick();

      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) api.reconcile();
      });
    },

    list: function () { return timers; },
    find: function (id) { return find(id); },
    remaining: function (t) { return remaining(t); },

    /**
     * Start a run of stages back to back.
     *
     * Every stage gets its own alarm scheduled up front at its own finish time,
     * so a multi-stage bake keeps moving even if the app is closed the whole
     * afternoon — nothing has to wake up to arm the next one.
     */
    startChain: function (stages, baseLabel) {
      stages = (stages || []).filter(function (s) { return s && s.mins > 0; });
      if (!stages.length) return [];
      var chainId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var at = Date.now();
      var made = [];
      stages.forEach(function (st, i) {
        at += Math.round(st.mins * 60) * 1000;
        var t = {
          id: 't' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5),
          label: st.label || ((baseLabel ? baseLabel + ' · ' : '') + 'stage ' + (i + 1)),
          totalSec: Math.round(st.mins * 60),
          endAt: at,
          state: 'running',
          createdAt: Date.now(),
          chainId: chainId,
          stage: i + 1,
          stages: stages.length
        };
        timers.unshift(t);
        BL.native.scheduleAlarm(t.id, t.endAt, t.label);
        made.push(t);
      });
      save();
      ensureTick();
      BL.native.vibrate(16);
      BL.toast(made.length + ' timers set, back to back');
      if (location.hash === '#/timers') BL.render();
      return made;
    },

    /** Picks up anything stopped from the notification shade. */
    reconcile: function () {
      var cancelled = BL.native.takeCancelledTimers();
      var changed = false;
      if (cancelled && cancelled.length) {
        timers = timers.filter(function (t) { return cancelled.indexOf(t.id) === -1; });
        changed = true;
      }
      timers.forEach(function (t) {
        if (t.state === 'running' && remaining(t) <= 0) {
          t.state = 'done';
          t.doneAt = t.endAt;
          changed = true;
        }
      });
      if (changed) {
        save();
        if (location.hash === '#/timers') BL.render();
      }
      return changed;
    },

    start: function (minutes, label) {
      var sec = Math.round(minutes * 60);
      if (!(sec > 0)) return null;
      var t = {
        id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        label: label || (BL.fmtMins(minutes) + ' timer'),
        totalSec: sec,
        endAt: Date.now() + sec * 1000,
        state: 'running',
        createdAt: Date.now()
      };
      timers.unshift(t);
      save();
      ensureTick();
      BL.native.scheduleAlarm(t.id, t.endAt, t.label);
      BL.native.vibrate(14);
      BL.toast('Timer set for ' + BL.fmtMins(minutes));
      if (location.hash === '#/timers') BL.render();
      return t;
    },

    pause: function (id) {
      var t = find(id);
      if (!t || t.state !== 'running') return;
      t.leftSec = remaining(t);
      t.state = 'paused';
      BL.native.cancelAlarm(t.id);
      save();
    },

    resume: function (id) {
      var t = find(id);
      if (!t || t.state !== 'paused') return;
      t.endAt = Date.now() + t.leftSec * 1000;
      t.state = 'running';
      BL.native.scheduleAlarm(t.id, t.endAt, t.label);
      save();
      ensureTick();
    },

    addMinutes: function (id, mins) {
      var t = find(id);
      if (!t) return;
      if (t.state === 'done') {
        BL.native.stopAlarm(t.id);
        t.state = 'running';
        t.endAt = Date.now() + mins * 60000;
        t.totalSec = mins * 60;
        BL.native.scheduleAlarm(t.id, t.endAt, t.label);
      } else if (t.state === 'paused') {
        t.leftSec += mins * 60;
        t.totalSec += mins * 60;
      } else {
        t.endAt += mins * 60000;
        t.totalSec += mins * 60;
        BL.native.scheduleAlarm(t.id, t.endAt, t.label);
      }
      save();
      ensureTick();
    },

    reset: function (id) {
      var t = find(id);
      if (!t) return;
      BL.native.stopAlarm(t.id);
      t.endAt = Date.now() + t.totalSec * 1000;
      t.state = 'running';
      delete t.doneAt;
      BL.native.scheduleAlarm(t.id, t.endAt, t.label);
      save();
      ensureTick();
    },

    remove: function (id) {
      var t = find(id);
      if (t) BL.native.cancelAlarm(t.id);
      timers = timers.filter(function (x) { return x.id !== id; });
      stopChime();
      save();
    },

    stopChime: stopChime
  };

  function find(id) {
    for (var i = 0; i < timers.length; i++) if (timers[i].id === id) return timers[i];
    return null;
  }

  BL.timers = api;

  /* --------------------------------------------------------- view */

  function ring(t) {
    var left = remaining(t);
    var pct = t.totalSec ? Math.max(0, Math.min(1, left / t.totalSec)) : 0;
    var C = 2 * Math.PI * 52;
    return '<div class="ring">' +
      '<svg viewBox="0 0 120 120">' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="6"/>' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="6" ' +
          'stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" ' +
          'stroke-dashoffset="' + ((1 - pct) * C).toFixed(1) + '" data-ring="' + t.id + '"/>' +
      '</svg>' +
      '<div class="rtxt" data-left="' + t.id + '">' + (t.state === 'done' ? 'Done' : fmt(left)) + '</div>' +
      '</div>';
  }

  function card(t) {
    var done = t.state === 'done';
    return '<div class="timer' + (done ? ' done' : '') + '" data-t="' + t.id + '">' +
      ring(t) +
      '<div class="tlabel">' + esc(t.label) + '</div>' +
      '<div class="tctl">' +
        (done
          ? '<button class="pri" data-act="reset" title="Run again">' + icon('reset') + '</button>'
          : (t.state === 'running'
            ? '<button data-act="pause">' + icon('pause') + '</button>'
            : '<button class="pri" data-act="resume">' + icon('play') + '</button>')) +
        '<button data-act="plus" title="Add a minute">' + icon('plus') + '</button>' +
        '<button data-act="del">' + icon('trash') + '</button>' +
      '</div></div>';
  }

  function paintTick() {
    timers.forEach(function (t) {
      var el = document.querySelector('[data-left="' + t.id + '"]');
      if (!el) return;
      var left = remaining(t);
      el.textContent = t.state === 'done' ? 'Done' : fmt(left);
      var r = document.querySelector('[data-ring="' + t.id + '"]');
      if (r) {
        var C = 2 * Math.PI * 52;
        var pct = t.totalSec ? Math.max(0, Math.min(1, left / t.totalSec)) : 0;
        r.setAttribute('stroke-dashoffset', ((1 - pct) * C).toFixed(1));
      }
      var cardEl = document.querySelector('[data-t="' + t.id + '"]');
      if (cardEl) cardEl.classList.toggle('done', t.state === 'done');
    });
  }

  BL.route('timers', function (screen) {
    var running = timers.filter(function (t) { return t.state !== 'done'; });
    var done = timers.filter(function (t) { return t.state === 'done'; });

    var html = '<div class="view">' +
      '<div class="topbar"><div>' +
        '<div class="kicker" style="margin-bottom:6px">' +
          (running.length ? running.length + ' running' : 'Nothing on the clock') + '</div>' +
        '<h1 class="display">Timers</h1></div></div>';

    if (done.length) {
      html += '<div class="section-head"><h2 class="h2" style="color:var(--accent)">Finished</h2>' +
        '<button class="link" data-clear-done>Clear</button></div>' +
        '<div class="tgrid">' + done.map(card).join('') + '</div>';
    }

    if (running.length) {
      html += '<div class="section-head"><h2 class="h2">Running</h2></div>' +
        '<div class="tgrid">' + running.map(card).join('') + '</div>';
    }

    html += '<div class="section-head"><h2 class="h2">Set a timer</h2></div>' +
      '<div class="dial">' +
        '<div class="dial-col"><input class="field" id="t-h" inputmode="numeric" placeholder="0" maxlength="2" style="border:none;border-bottom:1px solid var(--line);border-radius:0">' +
          '<div class="k">hours</div></div>' +
        '<div class="dial-sep">:</div>' +
        '<div class="dial-col"><input class="field" id="t-m" inputmode="numeric" placeholder="20" maxlength="2" style="border:none;border-bottom:1px solid var(--line);border-radius:0">' +
          '<div class="k">minutes</div></div>' +
        '<div class="dial-sep">:</div>' +
        '<div class="dial-col"><input class="field" id="t-s" inputmode="numeric" placeholder="00" maxlength="2" style="border:none;border-bottom:1px solid var(--line);border-radius:0">' +
          '<div class="k">seconds</div></div>' +
      '</div>' +
      '<div class="pad" style="padding-top:18px">' +
        '<input class="field" id="t-label" placeholder="What is it for? (optional)">' +
        '<div style="height:12px"></div>' +
        '<button class="btn btn-primary btn-block" data-start>' + icon('timer') + 'Start timer</button>' +
      '</div>' +
      '<div class="section-head"><h2 class="h2">Quick starts</h2></div>' +
      '<div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">' +
        PRESETS.map(function (p) {
          return '<button class="chip" data-preset="' + p.m + '" data-plabel="' + esc(p.label) + '">' +
            esc(p.label) + ' · ' + BL.fmtShort(p.m) + '</button>';
        }).join('') +
      '</div>';

    if (!BL.native.canScheduleExact()) {
      html += '<div class="pad" style="padding-top:24px"><div class="card" style="padding:16px">' +
        '<div class="kicker" style="color:var(--accent);margin-bottom:6px">Alarms are limited</div>' +
        '<p class="hint" style="margin:0 0 12px">Android is not letting Butterleaf set exact alarms, so a timer may ring late if the app is closed.</p>' +
        '<button class="btn btn-ghost btn-block" data-exact>Fix in settings</button></div></div>';
    }

    html += '<div style="height:26px"></div></div>';
    screen.innerHTML = html;

    if (done.length) stopChimeOnInteract(screen);

    screen.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (el) {
        var id = el.closest('[data-t]').getAttribute('data-t');
        var act = el.getAttribute('data-act');
        stopChime();
        if (act === 'pause') api.pause(id);
        if (act === 'resume') api.resume(id);
        if (act === 'plus') api.addMinutes(id, 1);
        if (act === 'reset') api.reset(id);
        if (act === 'del') api.remove(id);
        BL.render();
        return;
      }
      if (e.target.closest('[data-clear-done]')) {
        stopChime();
        timers.filter(function (t) { return t.state === 'done'; }).forEach(function (t) { api.remove(t.id); });
        BL.render();
        return;
      }
      var p = e.target.closest('[data-preset]');
      if (p) {
        api.start(parseFloat(p.getAttribute('data-preset')), p.getAttribute('data-plabel'));
        BL.render();
        return;
      }
      if (e.target.closest('[data-start]')) {
        var h = parseInt((screen.querySelector('#t-h') || {}).value, 10) || 0;
        var m = parseInt((screen.querySelector('#t-m') || {}).value, 10) || 0;
        var s = parseInt((screen.querySelector('#t-s') || {}).value, 10) || 0;
        var mins = h * 60 + m + s / 60;
        if (mins <= 0) { BL.toast('Set a time first'); return; }
        var label = (screen.querySelector('#t-label') || {}).value || '';
        api.start(mins, label.trim() || (BL.fmtMins(Math.round(mins)) + ' timer'));
        BL.render();
        return;
      }
      if (e.target.closest('[data-exact]')) BL.native.openExactAlarmSettings();
    });

    ensureTick();
  });

  function stopChimeOnInteract(screen) {
    screen.addEventListener('touchstart', stopChime, { once: true, passive: true });
  }
})(window.BL = window.BL || {});
