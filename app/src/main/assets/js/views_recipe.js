/* ============================================================
   Butterleaf — recipe detail
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc, U = BL.units;

  var state = { id: null, scale: 1, system: 'original', tab: 'ing', checkedIng: {}, checkedStep: {}, awake: false };

  var SCALES = [[0.5, '½'], [1, '1×'], [1.5, '1½'], [2, '2×'], [3, '3×']];

  function totalTime(r) {
    return r.totalMin || ((r.prepMin || 0) + (r.cookMin || 0)) || null;
  }

  function scaledYield(r) {
    if (!r.yield) return '';
    var m = String(r.yield).match(/([\d.]+)/);
    if (!m || state.scale === 1) return r.yield;
    var n = parseFloat(m[1]) * state.scale;
    return String(r.yield).replace(m[1], U.fraction(n));
  }

  BL.route('recipe', function (screen, id) {
    var r = BL.store.get(id);
    if (!r) { BL.go('#/library', true); return; }

    if (state.id !== id) {
      state = { id: id, scale: 1, system: BL.store.settings().units || 'original',
        tab: 'ing', checkedIng: {}, checkedStep: {}, awake: false };
    }

    screen.innerHTML = view(r);
    wire(screen, r);
  });

  function view(r) {
    var t = totalTime(r);
    var hasImg = !!r.image;

    var html = '<div class="view">';

    html += '<div class="hero' + (hasImg ? '' : ' noimg') + '">';
    if (hasImg) html += '<div class="img"><img src="' + esc(r.image) + '" alt=""></div><div class="scrim"></div>';
    html += '<div class="hero-nav">' +
      '<button class="icon-btn" data-back>' + icon('back') + '</button>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="icon-btn' + (r.favorite ? ' on' : '') + '" data-fav>' + icon(r.favorite ? 'heartFill' : 'heart') + '</button>' +
        '<button class="icon-btn" data-menu>' + icon('more') + '</button>' +
      '</div></div>';
    html += '<div class="htext">' +
      (r.sourceName ? '<div class="kicker" style="margin-bottom:8px">' + esc(r.sourceName) + '</div>' : '') +
      '<h1 class="display">' + esc(r.title) + '</h1></div>';
    html += '</div>';

    if (r.description) {
      html += '<p class="body" style="padding:18px 20px 0;margin:0">' + esc(r.description) + '</p>';
    }

    html += '<div class="stats">' +
      (r.prepMin ? stat(BL.fmtShort(r.prepMin), 'Prep') : '') +
      (r.cookMin ? stat(BL.fmtShort(r.cookMin), 'Bake') : '') +
      (t ? stat(BL.fmtShort(t), 'Total') : '') +
      (r.yield ? stat(esc(scaledYield(r)), 'Makes') : '') +
      '</div>';

    html += '<div style="padding:18px 20px 0"><div class="seg">' +
      '<button data-tab="ing" class="' + (state.tab === 'ing' ? 'on' : '') + '">Ingredients</button>' +
      '<button data-tab="steps" class="' + (state.tab === 'steps' ? 'on' : '') + '">Method</button>' +
      '</div></div>';

    html += state.tab === 'ing' ? ingredientsPane(r) : stepsPane(r);

    if (r.notes) {
      html += '<div class="section-head"><h2 class="h2">Notes</h2></div>' +
        '<p class="body" style="padding:0 20px;white-space:pre-wrap;margin:0">' + esc(r.notes) + '</p>';
    }

    html += '<div style="padding:28px 20px 10px;display:flex;gap:10px">' +
      '<button class="btn btn-ghost" style="flex:1" data-edit>' + icon('edit') + 'Edit</button>' +
      (r.sourceUrl ? '<button class="btn btn-ghost" style="flex:1" data-source>' + icon('link') + 'Source</button>' : '') +
      '</div>';

    html += '</div>';
    return html;
  }

  function stat(v, k) {
    return '<div class="stat"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
  }

  function ingredientsPane(r) {
    var html = '<div class="sticky-bar" style="margin-top:16px">' +
      '<div class="chips" style="padding:0 0 10px">' +
        '<span class="kicker" style="align-self:center;padding-right:4px">Batch</span>' +
        SCALES.map(function (s) {
          return '<button class="chip' + (state.scale === s[0] ? ' on' : '') + '" data-scale="' + s[0] + '">' + s[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="seg">' +
        '<button data-sys="original" class="' + (state.system === 'original' ? 'on' : '') + '">As written</button>' +
        '<button data-sys="metric" class="' + (state.system === 'metric' ? 'on' : '') + '">Metric</button>' +
        '<button data-sys="us" class="' + (state.system === 'us' ? 'on' : '') + '">US cups</button>' +
      '</div></div>';

    var group = '';
    (r.ingredients || []).forEach(function (ing, idx) {
      if (ing.group && ing.group !== group) {
        group = ing.group;
        html += '<div class="ing-group">' + esc(group) + '</div>';
      }
      var checked = state.checkedIng[idx] ? ' done' : '';
      var d = U.display(ing.qty == null ? null : ing.qty * state.scale, ing.unit, ing.item, state.system);
      var qtyText = d.qty ? (d.qty + (d.unit ? ' ' + d.unit : '')) : '';
      html += '<button class="ing' + checked + '" data-ing="' + idx + '">' +
        '<span class="box">' + icon('check') + '</span>' +
        '<span class="txt">' +
          (qtyText ? '<span class="qty">' + esc(qtyText) + '</span> ' : '') +
          esc(ing.item || ing.raw) +
          (ing.note ? '<span class="note">, ' + esc(ing.note) + '</span>' : '') +
        '</span></button>';
    });

    if (!(r.ingredients || []).length) {
      html += '<div class="empty" style="padding:34px 30px"><p>No ingredients listed yet.</p></div>';
    }

    html += '<div style="padding:20px">' +
      '<button class="btn btn-ghost btn-block" data-tolist>' + icon('cart') + 'Add all to shopping list</button></div>';

    var flourNote = scalingNote(r);
    if (flourNote) html += '<p class="hint" style="padding:0 20px 6px">' + flourNote + '</p>';

    return html;
  }

  function scalingNote(r) {
    if (state.system === 'original') return '';
    var unknown = (r.ingredients || []).filter(function (i) {
      return i.qty != null && i.unit && U.unit(i.unit) &&
        U.unit(i.unit).type === 'vol' && state.system === 'metric' && !U.densityFor(i.item);
    });
    if (state.system === 'metric' && unknown.length) {
      return 'Ingredients without a known density are shown in millilitres rather than grams.';
    }
    return '';
  }

  function stepsPane(r) {
    var html = '<div style="height:12px"></div>';
    var group = '';
    (r.steps || []).forEach(function (s, idx) {
      if (s.group && s.group !== group) {
        group = s.group;
        html += '<div class="ing-group">' + esc(group) + '</div>';
      }
      var mins = s.minutes || BL.parse.stepMinutes(s.text);
      html += '<div class="step' + (state.checkedStep[idx] ? ' done' : '') + '" data-step="' + idx + '">' +
        '<div class="n">' + (idx + 1) + '</div>' +
        '<div class="grow"><div class="stext">' + esc(s.text) + '</div>' +
          (mins ? '<button class="timer-chip" data-timer="' + mins + '" data-label="' +
            esc(r.title) + ' · step ' + (idx + 1) + '">' + icon('timer') + 'Timer · ' + BL.fmtShort(mins) + '</button>' : '') +
        '</div></div>';
    });
    if (!(r.steps || []).length) {
      html += '<div class="empty" style="padding:34px 30px"><p>No method written yet.</p></div>';
    }
    html += '<div style="padding:20px 20px 0"><button class="btn btn-ghost btn-block" data-awake>' +
      icon('bell') + (state.awake ? 'Screen staying on' : 'Keep screen on while I bake') + '</button></div>';
    return html;
  }

  /* ---------------------------------------------------------- wire */

  function wire(screen, r) {
    screen.addEventListener('click', function (e) {
      var el;

      if (e.target.closest('[data-back]')) { BL.back(); return; }

      if (e.target.closest('[data-fav]')) {
        r.favorite = !r.favorite;
        BL.store.put(r);
        BL.native.vibrate(12);
        BL.render();
        return;
      }

      if (e.target.closest('[data-menu]')) { menu(r); return; }
      if (e.target.closest('[data-edit]')) { BL.go('#/edit/' + r.id); return; }
      if (e.target.closest('[data-source]')) { openSource(r); return; }

      el = e.target.closest('[data-tab]');
      if (el) { state.tab = el.getAttribute('data-tab'); BL.render(); return; }

      el = e.target.closest('[data-scale]');
      if (el) { state.scale = parseFloat(el.getAttribute('data-scale')); BL.render(); return; }

      el = e.target.closest('[data-sys]');
      if (el) { state.system = el.getAttribute('data-sys'); BL.render(); return; }

      el = e.target.closest('[data-ing]');
      if (el) {
        var i = el.getAttribute('data-ing');
        state.checkedIng[i] = !state.checkedIng[i];
        el.classList.toggle('done');
        BL.native.vibrate(8);
        return;
      }

      el = e.target.closest('[data-timer]');
      if (el) {
        e.stopPropagation();
        BL.timers.start(parseFloat(el.getAttribute('data-timer')), el.getAttribute('data-label'));
        return;
      }

      el = e.target.closest('[data-step]');
      if (el) {
        var s = el.getAttribute('data-step');
        state.checkedStep[s] = !state.checkedStep[s];
        el.classList.toggle('done');
        return;
      }

      if (e.target.closest('[data-awake]')) {
        state.awake = !state.awake;
        BL.native.keepAwake(state.awake);
        BL.toast(state.awake ? 'Screen will stay on' : 'Screen can sleep again');
        BL.render();
        return;
      }

      if (e.target.closest('[data-tolist]')) { addAllToList(r); return; }
    });
  }

  function openSource(r) {
    BL.sheet('<h2 class="h1">Original recipe</h2>' +
      '<p class="body" style="word-break:break-all;margin:0 0 20px">' + esc(r.sourceUrl) + '</p>' +
      '<a class="btn btn-primary btn-block" href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">Open in browser</a>');
  }

  function addAllToList(r) {
    var list = BL.store.shopping().slice();
    var added = 0;
    (r.ingredients || []).forEach(function (ing) {
      if (!ing.item && !ing.raw) return;
      var qty = ing.qty == null ? null : ing.qty * state.scale;
      BL.shopping.merge(list, {
        id: BL.uid(),
        item: ing.item || ing.raw,
        qty: qty,
        unit: ing.unit || null,
        note: ing.note || '',
        from: r.title,
        checked: false
      });
      added++;
    });
    BL.store.saveShopping(list);
    BL.native.vibrate(14);
    BL.toast(added + ' ingredients added to your list');
  }

  function menu(r) {
    BL.sheet(
      '<h2 class="h1">' + esc(r.title) + '</h2>' +
      '<button class="tile" data-m="edit"><span class="ti">' + icon('edit') + '</span>' +
        '<span class="grow"><div class="tt">Edit recipe</div></span></button>' +
      '<button class="tile" data-m="dup"><span class="ti">' + icon('book') + '</span>' +
        '<span class="grow"><div class="tt">Duplicate</div><div class="ts">Make a variation without losing the original</div></span></button>' +
      '<button class="tile" data-m="list"><span class="ti">' + icon('cart') + '</span>' +
        '<span class="grow"><div class="tt">Add to shopping list</div></span></button>' +
      '<button class="tile" data-m="del"><span class="ti" style="background:var(--accent-wash)">' + icon('trash') + '</span>' +
        '<span class="grow"><div class="tt" style="color:var(--accent)">Delete recipe</div></span></button>',
      function (s) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-m]');
          if (!b) return;
          var m = b.getAttribute('data-m');
          BL.closeSheet();
          if (m === 'edit') BL.go('#/edit/' + r.id);
          if (m === 'list') addAllToList(r);
          if (m === 'dup') {
            var copy = JSON.parse(JSON.stringify(r));
            copy.id = BL.uid();
            copy.title = r.title + ' (variation)';
            copy.favorite = false;
            delete copy._blob;
            copy.createdAt = Date.now();
            BL.store.put(copy);
            BL.go('#/edit/' + copy.id);
          }
          if (m === 'del') {
            BL.confirm('Delete this recipe?', 'This cannot be undone.', 'Delete', function () {
              BL.store.remove(r.id);
              BL.toast('Recipe deleted');
              BL.go('#/library');
            });
          }
        });
      }
    );
  }
})(window.BL = window.BL || {});
