/* ============================================================
   Butterleaf — bake mode and the bake log

   Bake mode is the screen you leave propped against the mixer:
   one step at a time, big type, the screen kept awake, and the
   timers for that step one tap away.
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc;

  // Where you were in each recipe, so leaving and coming back resumes.
  var place = {};
  var wasAwake = false;

  function stepsOf(r) {
    return (r.steps || []).filter(function (s) { return s && s.text; });
  }

  function at(r) {
    var n = stepsOf(r).length;
    var i = place[r.id] || 0;
    return Math.max(0, Math.min(i, Math.max(0, n - 1)));
  }

  /* ------------------------------------------------------ bake mode */

  BL.route('bake', function (screen, id) {
    var r = BL.store.get(id);
    if (!r) { BL.go('#/library', true); return; }
    var steps = stepsOf(r);
    if (!steps.length) { BL.toast('This recipe has no method to walk through'); BL.go('#/recipe/' + id, true); return; }

    if (!wasAwake) { BL.native.keepAwake(true); wasAwake = true; }

    var i = at(r);
    var s = steps[i];
    var pct = Math.round(((i + 1) / steps.length) * 100);

    screen.innerHTML =
      '<div class="view bake">' +
        '<div class="bake-top">' +
          '<button class="icon-btn ghost" data-exit>' + icon('x') + '</button>' +
          '<div class="bake-title">' + esc(r.title) + '</div>' +
          '<button class="icon-btn ghost" data-ings>' + icon('list') + '</button>' +
        '</div>' +
        '<div class="bake-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="bake-body">' +
          '<div class="bake-count">Step ' + (i + 1) + ' of ' + steps.length +
            (s.group ? ' · ' + esc(s.group) : '') + '</div>' +
          '<p class="bake-step">' + esc(s.text) + '</p>' +
          timerBlock(r, s, i) +
        '</div>' +
        '<div class="bake-foot">' +
          '<button class="btn btn-ghost" data-prev' + (i === 0 ? ' disabled' : '') + '>' + icon('back') + 'Back</button>' +
          (i === steps.length - 1
            ? '<button class="btn btn-primary" style="flex:1.4" data-finish>' + icon('check') + 'Done baking</button>'
            : '<button class="btn btn-primary" style="flex:1.4" data-next>Next' + icon('chevron') + '</button>') +
        '</div>' +
      '</div>';

    wire(screen, r, steps, i);
  });

  function timerBlock(r, s, i) {
    var label = r.title + ' · step ' + (i + 1);
    var running = liveTimerFor(label);
    if (running) {
      return '<div class="bake-timer live" data-live="' + running.id + '">' +
        '<div class="bt-left">' + icon('timer') + '</div>' +
        '<div class="grow"><div class="bt-k">Running</div>' +
          '<div class="bt-v" data-live-txt>' + fmt(BL.timers.remaining(running)) + '</div></div>' +
        '<button class="bt-stop" data-stop-timer="' + running.id + '">Stop</button></div>';
    }

    var html = '';
    var pre = BL.parse.preheatInfo(s.text);
    if (pre) {
      html += '<button class="bake-timer" data-preheat="' + pre.minutes + '">' +
        '<div class="bt-left">' + icon('thermometer') + '</div>' +
        '<div class="grow"><div class="bt-k">Preheat</div>' +
        '<div class="bt-v">Tell me in ' + pre.minutes + ' min' +
        (pre.temp ? ' — the oven should be at ' + pre.temp + '°' + pre.scale : '') + '</div></div></button>';
    }

    var mins = BL.parse.allMinutes(s.text);
    mins.slice(0, 3).forEach(function (m) {
      html += '<button class="bake-timer" data-timer="' + m + '" data-label="' + esc(label) + '">' +
        '<div class="bt-left">' + icon('timer') + '</div>' +
        '<div class="grow"><div class="bt-k">Timer</div>' +
        '<div class="bt-v">' + BL.fmtShort(m) + '</div></div></button>';
    });

    // Two or more durations in the rest of the method means a bake with
    // stages — offer to line them all up at once.
    var rest = restOfChain(r, i);
    if (rest.length > 1) {
      html += '<button class="bake-timer chain" data-chain="1">' +
        '<div class="bt-left">' + icon('list') + '</div>' +
        '<div class="grow"><div class="bt-k">Chain the rest</div>' +
        '<div class="bt-v">' + rest.length + ' timers, back to back · ' +
        BL.fmtShort(rest.reduce(function (a, x) { return a + x.mins; }, 0)) + ' total</div></div></button>';
    }

    if (!html) {
      html = '<button class="bake-timer quiet" data-custom="1">' +
        '<div class="bt-left">' + icon('timer') + '</div>' +
        '<div class="grow"><div class="bt-k">No time in this step</div>' +
        '<div class="bt-v">Set one yourself</div></div></button>';
    }
    return html;
  }

  /** The timed steps from here to the end, in order. */
  function restOfChain(r, from) {
    var out = [];
    stepsOf(r).forEach(function (s, idx) {
      if (idx < from) return;
      var m = s.minutes || BL.parse.stepMinutes(s.text);
      if (m) out.push({ mins: m, label: r.title + ' · step ' + (idx + 1) });
    });
    return out;
  }

  function liveTimerFor(label) {
    return BL.timers.list().filter(function (t) {
      return t.label === label && t.state === 'running';
    })[0] || null;
  }

  function fmt(sec) {
    var s = Math.max(0, Math.round(sec));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0');
    return m + ':' + String(x).padStart(2, '0');
  }

  function wire(screen, r, steps, i) {
    var live = screen.querySelector('[data-live]');
    if (live) {
      var tick = setInterval(function () {
        var t = BL.timers.find(live.getAttribute('data-live'));
        var el = screen.querySelector('[data-live-txt]');
        if (!t || !el || !document.body.contains(el)) { clearInterval(tick); return; }
        el.textContent = fmt(BL.timers.remaining(t));
      }, 1000);
    }

    screen.addEventListener('click', function (e) {
      var el;

      if (e.target.closest('[data-exit]')) { leave(); BL.go('#/recipe/' + r.id); return; }
      if (e.target.closest('[data-ings]')) { ingredientSheet(r); return; }

      if (e.target.closest('[data-prev]')) {
        place[r.id] = Math.max(0, i - 1);
        BL.render();
        return;
      }
      if (e.target.closest('[data-next]')) {
        place[r.id] = Math.min(steps.length - 1, i + 1);
        BL.native.vibrate(8);
        BL.render();
        return;
      }
      if (e.target.closest('[data-finish]')) { finish(r); return; }

      el = e.target.closest('[data-preheat]');
      if (el) {
        BL.timers.start(parseFloat(el.getAttribute('data-preheat')), r.title + ' · oven ready');
        BL.render();
        return;
      }

      el = e.target.closest('[data-timer]');
      if (el) {
        BL.timers.start(parseFloat(el.getAttribute('data-timer')), el.getAttribute('data-label'));
        BL.render();
        return;
      }

      if (e.target.closest('[data-chain]')) {
        BL.timers.startChain(restOfChain(r, i), r.title);
        BL.render();
        return;
      }

      if (e.target.closest('[data-custom]')) { BL.go('#/timers'); return; }

      el = e.target.closest('[data-stop-timer]');
      if (el) {
        BL.timers.remove(el.getAttribute('data-stop-timer'));
        BL.render();
        return;
      }
    });
  }

  function leave() {
    if (wasAwake) { BL.native.keepAwake(false); wasAwake = false; }
  }
  BL.leaveBakeMode = leave;

  function finish(r) {
    leave();
    delete place[r.id];
    BL.sheet(
      '<h2 class="h1" style="margin-bottom:6px">Nicely done</h2>' +
      '<p class="body" style="margin:0 0 18px">Worth writing down how it went?</p>' +
      '<textarea class="field" id="bake-note" rows="4" placeholder="Too dark at 40 min. Next time pull it at 35."></textarea>' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-primary btn-block" data-save style="margin-bottom:10px">Log this bake</button>' +
      '<button class="btn btn-ghost btn-block" data-skip>Not this time</button>',
      function (s) {
        s.querySelector('[data-save]').onclick = function () {
          var txt = (s.querySelector('#bake-note') || {}).value || '';
          BL.store.addNote(r.id, txt, { baked: true });
          BL.closeSheet();
          BL.toast('Bake logged');
          BL.go('#/log/' + r.id);
        };
        s.querySelector('[data-skip]').onclick = function () {
          BL.closeSheet();
          BL.go('#/recipe/' + r.id);
        };
      }
    );
  }

  function ingredientSheet(r) {
    var group = '';
    var rows = (r.ingredients || []).map(function (ing) {
      var head = '';
      if (ing.group && ing.group !== group) {
        group = ing.group;
        head = '<div class="ing-group" style="padding-left:0">' + esc(group) + '</div>';
      }
      var txt;
      if (ing.qty == null) txt = esc(ing.raw || ing.item);
      else {
        var d = BL.units.display(ing.qty, ing.unit, ing.item, 'original');
        txt = '<span class="qty">' + esc(d.qty + (d.unit ? ' ' + d.unit : '')) + '</span> ' + esc(ing.item || ing.raw);
      }
      return head + '<div class="bake-ing">' + txt + '</div>';
    }).join('');

    BL.sheet('<h2 class="h1" style="margin-bottom:14px">Ingredients</h2>' +
      '<div style="max-height:58vh;overflow:auto">' + (rows || '<p class="body">None listed.</p>') + '</div>' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-ghost btn-block" data-close>Close</button>',
      function (s) {
        var b = s.querySelector('[data-close]');
        if (b) b.onclick = BL.closeSheet;
      });
  }

  /* -------------------------------------------------------- the log */

  BL.route('log', function (screen, id) {
    var r = BL.store.get(id);
    if (!r) { BL.go('#/library', true); return; }
    var log = BL.store.bakeLog(id);
    var bakes = r.bakes || 0;

    screen.innerHTML = '<div class="view">' +
      '<div class="topbar sub">' +
        '<button class="icon-btn ghost" data-back>' + icon('back') + '</button>' +
        '<div style="flex:1;text-align:center">' +
          '<div class="kicker">' + esc(r.title) + '</div>' +
          '<h1 class="h1">Bake notes</h1></div>' +
        '<span style="width:40px"></span></div>' +

      '<div class="stats">' +
        '<div class="stat"><div class="v">' + bakes + '</div><div class="k">' +
          (bakes === 1 ? 'Bake' : 'Bakes') + '</div></div>' +
        '<div class="stat"><div class="v">' + (r.lastBaked ? shortDate(r.lastBaked) : '—') +
          '</div><div class="k">Last made</div></div>' +
        '<div class="stat"><div class="v">' + log.length + '</div><div class="k">' +
          (log.length === 1 ? 'Note' : 'Notes') + '</div></div>' +
      '</div>' +

      '<div class="pad" style="padding-top:20px">' +
        '<textarea class="field" id="new-note" rows="3" placeholder="What did you change? What would you do differently?"></textarea>' +
        '<div style="height:10px"></div>' +
        '<div style="display:flex;gap:10px">' +
          '<button class="btn btn-ghost" style="flex:1" data-add>' + icon('note') + 'Add note</button>' +
          '<button class="btn btn-primary" style="flex:1" data-baked>' + icon('check') + 'I baked it</button>' +
        '</div>' +
      '</div>' +

      (log.length
        ? '<div class="section-head"><h2 class="h2">History</h2></div>' +
          log.map(entry).join('')
        : '<div class="empty" style="padding:40px 30px"><h3>Nothing written down yet</h3>' +
          '<p>Every bake teaches you something about the recipe. This is where it goes.</p></div>') +

      '<div style="height:34px"></div></div>';

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }

      var box = screen.querySelector('#new-note');
      if (e.target.closest('[data-add]')) {
        var t = (box.value || '').trim();
        if (!t) { BL.toast('Write something first'); return; }
        BL.store.addNote(id, t);
        BL.render();
        return;
      }
      if (e.target.closest('[data-baked]')) {
        BL.store.addNote(id, (box.value || '').trim(), { baked: true });
        BL.native.vibrate(14);
        BL.toast('Bake logged');
        BL.render();
        return;
      }
      var d = e.target.closest('[data-del-note]');
      if (d) {
        BL.store.removeNote(id, d.getAttribute('data-del-note'));
        BL.render();
      }
    });
  });

  function entry(n) {
    return '<div class="lognote">' +
      '<div class="ln-head">' +
        '<span class="ln-when">' + longDate(n.at) + '</span>' +
        (n.baked ? '<span class="ln-tag">baked</span>' : '') +
        '<button class="ln-x" data-del-note="' + esc(n.id) + '">' + icon('x') + '</button>' +
      '</div>' +
      (n.text ? '<p class="ln-text">' + esc(n.text) + '</p>' : '') +
      '</div>';
  }

  function shortDate(ms) {
    try {
      return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    } catch (e) { return '—'; }
  }

  function longDate(ms) {
    try {
      return new Date(ms).toLocaleDateString(undefined,
        { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }
})(window.BL = window.BL || {});
