/* ============================================================
   Butterleaf — tools: converter, shopping list, baker's math,
   settings
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc, U = BL.units;

  /* ---------------------------------------------------- tools hub */

  BL.route('tools', function (screen) {
    var listCount = BL.store.shopping().filter(function (i) { return !i.checked; }).length;
    var catCount = BL.store.categories().length;
    screen.innerHTML = '<div class="view">' +
      '<div class="topbar"><div>' +
        '<div class="kicker" style="margin-bottom:6px">Butterleaf</div>' +
        '<h1 class="display">Tools</h1></div></div>' +
      '<div class="rule"></div>' +
      '<div class="pad">' +
        tile('convert', 'scale', 'Baking converter', 'Cups to grams, ounces to millilitres, oven temperatures, pan sizes') +
        tile('shopping', 'cart', 'Shopping list', listCount ? listCount + ' things still to buy' : 'Build a list from any recipe') +
        tile('categories', 'list', 'Categories', catCount ? catCount + (catCount === 1 ? ' category' : ' categories') : 'Group your recipes however you like') +
        tile('bakers', 'percent', "Baker's percentages", 'Hydration, salt and starter maths for bread') +
        tile('subs', 'swap', 'Substitutions', 'No buttermilk? No cake flour? Here is what to use instead') +
        tile('settings', 'tools', 'Settings & backup', 'Theme, default units, export your recipe box') +
      '</div>' +
      '<p class="hint" style="padding:20px 20px 30px">Butterleaf keeps everything on this phone. ' +
      'Nothing is uploaded anywhere — so do take a backup now and then.</p>' +
      '</div>';

    screen.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (t) BL.go('#/' + t.getAttribute('data-go'));
    });
  });

  function tile(go, ic, title, sub) {
    return '<button class="tile" data-go="' + go + '"><span class="ti">' + icon(ic) + '</span>' +
      '<span class="grow"><div class="tt">' + title + '</div><div class="ts">' + sub + '</div></span>' +
      '<span class="chevron" style="color:var(--muted)">' + icon('chevron') + '</span></button>';
  }

  function header(title, kicker) {
    return '<div class="topbar sub">' +
      '<button class="icon-btn ghost" data-back>' + icon('back') + '</button>' +
      '<div style="flex:1;text-align:center">' +
        '<div class="kicker">' + esc(kicker) + '</div>' +
        '<h1 class="h1">' + esc(title) + '</h1></div>' +
      '<span style="width:40px"></span></div>';
  }

  /* ----------------------------------------------------- converter */

  var conv = {
    tab: 'amount',
    value: '1',
    from: 'cup',
    to: 'g',
    ing: 'flour_ap',
    oven: '350',
    ovenFrom: 'f',
    panFrom: 'r8',
    panTo: 'q913'
  };

  BL.route('convert', function (screen) {
    screen.innerHTML = '<div class="view">' +
      header('Converter', 'Measure twice') +
      '<div class="pad"><div class="seg">' +
        segBtn('amount', 'Convert') + segBtn('ingredient', 'Per cup') +
        segBtn('oven', 'Oven') + segBtn('pan', 'Pans') +
      '</div></div>' +
      '<div id="conv-body">' + body() + '</div></div>';

    wire(screen);
  });

  function segBtn(id, label) {
    return '<button data-ctab="' + id + '" class="' + (conv.tab === id ? 'on' : '') + '">' + label + '</button>';
  }

  function body() {
    if (conv.tab === 'amount') return amountPane();
    if (conv.tab === 'ingredient') return ingredientPane();
    if (conv.tab === 'oven') return ovenPane();
    return panPane();
  }

  function unitOptions(sel, filter) {
    return U.UNITS.filter(function (u) {
      return u.type !== 'count' && (!filter || filter(u));
    }).map(function (u) {
      return '<option value="' + u.id + '"' + (u.id === sel ? ' selected' : '') + '>' +
        u.many.charAt(0).toUpperCase() + u.many.slice(1) + ' (' + u.abbr + ')</option>';
    }).join('');
  }

  function ingOptions(sel) {
    return U.DENSITY.map(function (d) {
      return '<option value="' + d.key + '"' + (d.key === sel ? ' selected' : '') + '>' + esc(d.label) + '</option>';
    }).join('');
  }

  function amountPane() {
    var d = U.densityByKey(conv.ing);
    var v = parseFloat(conv.value);
    if (isNaN(v)) v = null;
    var crossing = U.unit(conv.from) && U.unit(conv.to) && U.unit(conv.from).type !== U.unit(conv.to).type;
    var result = v == null ? null : U.convert(v, conv.from, conv.to, crossing ? d.match[0] : '');

    var out;
    if (result == null) out = '—';
    else {
      var toU = U.unit(conv.to);
      var num = (conv.to === 'g' || conv.to === 'kg' || conv.to === 'ml' || conv.to === 'l')
        ? U.metricRound(result) : U.fraction(result);
      out = num + ' ' + toU.abbr;
    }

    return '<div class="conv-panel" style="padding-top:26px">' +
      '<label class="label">Amount</label>' +
      '<div class="conv-io">' +
        '<div class="conv-box"><input id="c-val" inputmode="decimal" value="' + esc(conv.value) + '"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
        '<div style="flex:1"><label class="label">From</label>' +
          '<select class="uselect" id="c-from">' + unitOptions(conv.from) + '</select></div>' +
        '<button class="swap" data-swap style="margin-top:22px">' + icon('swap') + '</button>' +
        '<div style="flex:1"><label class="label">To</label>' +
          '<select class="uselect" id="c-to">' + unitOptions(conv.to) + '</select></div>' +
      '</div>' +

      (crossing ? '<div style="margin-top:18px"><label class="label">Ingredient (needed to cross volume and weight)</label>' +
        '<select class="uselect" id="c-ing">' + ingOptions(conv.ing) + '</select></div>' : '') +

      '<div class="rule-tight" style="margin:26px 0 18px"></div>' +
      '<div class="kicker" style="margin-bottom:8px">Result</div>' +
      '<div class="conv-out">' + esc(out) + '</div>' +
      (crossing ? '<p class="hint" style="margin-top:14px">Using ' + esc(d.label.toLowerCase()) +
        ' at ' + d.gCup + ' g per cup' + (d.gTsp ? ', ' + d.gTsp + ' g per teaspoon' : '') + '.</p>' : '') +

      '<div class="section-head" style="padding-left:0;padding-right:0"><h2 class="h2">Handy equivalents</h2></div>' +
      '<table class="table"><tbody>' +
        row('1 tablespoon', '3 teaspoons · 15 ml') +
        row('1 cup', '16 tbsp · 8 fl oz · 237 ml') +
        row('½ cup', '8 tbsp · 4 fl oz · 118 ml') +
        row('⅓ cup', '5 tbsp + 1 tsp · 79 ml') +
        row('¼ cup', '4 tbsp · 59 ml') +
        row('1 stick butter', '½ cup · 8 tbsp · 113 g') +
        row('1 ounce', '28.35 g') +
        row('1 pound', '16 oz · 454 g') +
        row('1 large egg', 'about 50 g out of the shell') +
      '</tbody></table>' +
      '<div style="height:28px"></div></div>';
  }

  function row(a, b) {
    return '<tr><td>' + a + '</td><td class="num">' + b + '</td></tr>';
  }

  function ingredientPane() {
    var d = U.densityByKey(conv.ing);
    var portions = [
      ['1 cup', 1], ['¾ cup', 0.75], ['⅔ cup', 2 / 3], ['½ cup', 0.5],
      ['⅓ cup', 1 / 3], ['¼ cup', 0.25], ['1 tbsp', 1 / 16], ['1 tsp', 1 / 48]
    ];
    return '<div class="conv-panel" style="padding-top:26px">' +
      '<label class="label">Ingredient</label>' +
      '<select class="uselect" id="c-ing2">' + ingOptions(conv.ing) + '</select>' +
      '<div style="height:22px"></div>' +
      '<div class="kicker" style="margin-bottom:6px">1 cup weighs</div>' +
      '<div class="conv-out">' + d.gCup + ' g</div>' +
      '<div style="height:20px"></div>' +
      '<table class="table"><thead><tr><th>Volume</th><th style="text-align:right">Grams</th></tr></thead><tbody>' +
        portions.map(function (p) {
          var g;
          if (d.gTsp && p[0] === '1 tsp') g = d.gTsp;
          else if (d.gTsp && p[0] === '1 tbsp') g = d.gTsp * 3;
          else g = d.gCup * p[1];
          return '<tr><td>' + p[0] + '</td><td class="num">' + U.metricRound(g) + ' g</td></tr>';
        }).join('') +
      '</tbody></table>' +
      (d.each ? '<p class="hint" style="margin-top:14px">One large egg is about ' + d.each + ' g without the shell.</p>' : '') +
      '<p class="hint" style="margin-top:14px">Weights follow King Arthur Baking\'s ingredient chart — the standard most modern recipes are written to. ' +
      'Scoop-and-sweep flour can run 15–20 g heavier per cup, which is exactly why weighing wins.</p>' +
      '<div style="height:28px"></div></div>';
  }

  function ovenPane() {
    var v = parseFloat(conv.oven);
    var f, c;
    if (isNaN(v)) { f = null; c = null; }
    else if (conv.ovenFrom === 'f') { f = v; c = U.fToC(v); }
    else { c = v; f = U.cToF(v); }

    var common = [325, 350, 375, 400, 425, 450];

    return '<div class="conv-panel" style="padding-top:26px">' +
      '<div class="seg" style="margin-bottom:20px">' +
        '<button data-oven="f" class="' + (conv.ovenFrom === 'f' ? 'on' : '') + '">Fahrenheit</button>' +
        '<button data-oven="c" class="' + (conv.ovenFrom === 'c' ? 'on' : '') + '">Celsius</button>' +
      '</div>' +
      '<label class="label">Temperature</label>' +
      '<div class="conv-box"><input id="c-oven" inputmode="decimal" value="' + esc(conv.oven) + '"></div>' +
      '<div class="rule-tight" style="margin:22px 0 18px"></div>' +
      '<div style="display:flex;gap:20px">' +
        '<div style="flex:1"><div class="kicker">Fahrenheit</div><div class="conv-out">' +
          (f == null ? '—' : Math.round(f) + '°') + '</div></div>' +
        '<div style="flex:1"><div class="kicker">Celsius</div><div class="conv-out">' +
          (c == null ? '—' : Math.round(c) + '°') + '</div></div>' +
        '<div style="flex:.8"><div class="kicker">Gas</div><div class="conv-out">' +
          (f == null ? '—' : U.gasFor(Math.round(f))) + '</div></div>' +
      '</div>' +
      (f != null ? '<p class="hint" style="margin-top:16px">Fan or convection oven: drop it to about ' +
        Math.round(f - 25) + '°F / ' + Math.round(U.fToC(f) - 15) + '°C and start checking early.</p>' : '') +
      '<div class="section-head" style="padding-left:0;padding-right:0"><h2 class="h2">The usual suspects</h2></div>' +
      '<table class="table"><thead><tr><th>°F</th><th>°C</th><th style="text-align:right">Gas mark</th></tr></thead><tbody>' +
        common.map(function (t) {
          return '<tr><td>' + t + '°</td><td>' + Math.round(U.fToC(t) / 5) * 5 + '°</td>' +
            '<td class="num">' + U.gasFor(t) + '</td></tr>';
        }).join('') +
      '</tbody></table><div style="height:28px"></div></div>';
  }

  function panPane() {
    var a = U.PANS.filter(function (p) { return p.id === conv.panFrom; })[0];
    var b = U.PANS.filter(function (p) { return p.id === conv.panTo; })[0];
    var factor = a && b ? b.area / a.area : null;

    return '<div class="conv-panel" style="padding-top:26px">' +
      '<label class="label">Recipe is written for</label>' +
      '<select class="uselect" id="p-from">' + U.PANS.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === conv.panFrom ? ' selected' : '') + '>' + p.label + '</option>';
      }).join('') + '</select>' +
      '<div style="height:16px"></div>' +
      '<label class="label">You want to bake it in</label>' +
      '<select class="uselect" id="p-to">' + U.PANS.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === conv.panTo ? ' selected' : '') + '>' + p.label + '</option>';
      }).join('') + '</select>' +
      '<div class="rule-tight" style="margin:24px 0 18px"></div>' +
      '<div class="kicker" style="margin-bottom:8px">Scale the recipe by</div>' +
      '<div class="conv-out">' + (factor ? '×' + (Math.round(factor * 100) / 100) : '—') + '</div>' +
      '<p class="hint" style="margin-top:14px">' +
        (factor ? 'Multiply every ingredient by ' + (Math.round(factor * 100) / 100) +
          '. Batter depth changes bake time: if the new pan is deeper, add 5–10 minutes and test with a skewer; if shallower, start checking 10 minutes early.'
          : '') +
      '</p>' +
      '<div class="section-head" style="padding-left:0;padding-right:0"><h2 class="h2">Pan areas</h2></div>' +
      '<table class="table"><tbody>' +
        U.PANS.map(function (p) {
          return '<tr><td>' + p.label + '</td><td class="num">' + Math.round(p.area) + ' sq in</td></tr>';
        }).join('') +
      '</tbody></table><div style="height:28px"></div></div>';
  }

  function wire(screen) {
    function repaint() {
      var b = screen.querySelector('#conv-body');
      b.innerHTML = body();
      Array.prototype.forEach.call(screen.querySelectorAll('[data-ctab]'), function (t) {
        t.classList.toggle('on', t.getAttribute('data-ctab') === conv.tab);
      });
    }

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }
      var t = e.target.closest('[data-ctab]');
      if (t) { conv.tab = t.getAttribute('data-ctab'); repaint(); return; }
      if (e.target.closest('[data-swap]')) {
        var f = conv.from; conv.from = conv.to; conv.to = f;
        repaint();
        return;
      }
      var o = e.target.closest('[data-oven]');
      if (o) { conv.ovenFrom = o.getAttribute('data-oven'); repaint(); return; }
    });

    screen.addEventListener('input', function (e) {
      if (e.target.id === 'c-val') { conv.value = e.target.value; softUpdate(screen); }
      if (e.target.id === 'c-oven') { conv.oven = e.target.value; repaint(); restoreFocus(screen, '#c-oven'); }
    });

    screen.addEventListener('change', function (e) {
      if (e.target.id === 'c-from') { conv.from = e.target.value; repaint(); }
      if (e.target.id === 'c-to') { conv.to = e.target.value; repaint(); }
      if (e.target.id === 'c-ing' || e.target.id === 'c-ing2') { conv.ing = e.target.value; repaint(); }
      if (e.target.id === 'p-from') { conv.panFrom = e.target.value; repaint(); }
      if (e.target.id === 'p-to') { conv.panTo = e.target.value; repaint(); }
    });
  }

  function softUpdate(screen) {
    // recompute just the result line so the caret stays put
    var d = U.densityByKey(conv.ing);
    var v = parseFloat(conv.value);
    var crossing = U.unit(conv.from).type !== U.unit(conv.to).type;
    var result = isNaN(v) ? null : U.convert(v, conv.from, conv.to, crossing ? d.match[0] : '');
    var out = screen.querySelector('.conv-out');
    if (!out) return;
    if (result == null) { out.textContent = '—'; return; }
    var toU = U.unit(conv.to);
    var num = (conv.to === 'g' || conv.to === 'kg' || conv.to === 'ml' || conv.to === 'l')
      ? U.metricRound(result) : U.fraction(result);
    out.textContent = num + ' ' + toU.abbr;
  }

  function restoreFocus(screen, sel) {
    var el = screen.querySelector(sel);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }

  /* ------------------------------------------------- shopping list */

  function normalize(name) {
    return String(name || '').toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(fresh|large|small|medium|chopped|melted|softened|packed|sifted|room temperature|cold|warm|plus more.*)\b/g, '')
      .replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/(ies)$/, 'y').replace(/(?<=\w{4})s$/, '');
  }

  BL.shopping = {
    merge: function (list, item) {
      var key = normalize(item.item);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (normalize(e.item) !== key) continue;
        if (e.qty != null && item.qty != null && e.unit && item.unit) {
          var conv2 = U.convert(item.qty, item.unit, e.unit, item.item);
          if (conv2 != null) { e.qty += conv2; e.checked = false; return list; }
        } else if (e.qty == null && item.qty == null) {
          return list;
        }
      }
      list.push(item);
      return list;
    },
    add: function (text) {
      var p = U.parseIngredient(text);
      var list = BL.store.shopping().slice();
      BL.shopping.merge(list, { id: BL.uid(), item: p.item, qty: p.qty, unit: p.unit,
        note: p.note, from: '', checked: false });
      BL.store.saveShopping(list);
    }
  };

  BL.route('shopping', function (screen) {
    var list = BL.store.shopping();
    var open = list.filter(function (i) { return !i.checked; });
    var got = list.filter(function (i) { return i.checked; });

    function line(i, idx) {
      var d = i.qty == null ? { qty: '', unit: '' } : U.display(i.qty, i.unit, i.item, 'original');
      var amount = d.qty ? d.qty + (d.unit ? ' ' + d.unit : '') : '';
      return '<button class="ing' + (i.checked ? ' done' : '') + '" data-item="' + esc(i.id) + '">' +
        '<span class="box">' + icon('check') + '</span>' +
        '<span class="txt">' + (amount ? '<span class="qty">' + esc(amount) + '</span> ' : '') +
          esc(i.item) +
          (i.from ? '<span class="note"> · ' + esc(i.from) + '</span>' : '') + '</span>' +
        '<span class="del" data-del-item="' + esc(i.id) + '" style="color:var(--muted)">' + icon('x') + '</span>' +
        '</button>';
    }

    var html = '<div class="view">' +
      header('Shopping list', open.length + ' to buy') +
      '<div class="pad" style="padding-top:6px">' +
        '<div class="search">' + icon('plus') +
          '<input id="add-item" placeholder="Add something — “2 cups buttermilk”" autocomplete="off">' +
        '</div></div>';

    if (!list.length) {
      html += '<div class="empty"><div class="mark">' + icon('cart') + '</div>' +
        '<h3>Nothing on the list</h3>' +
        '<p>Open any recipe and tap “Add all to shopping list”, or type things in above.</p></div>';
    } else {
      html += '<div style="height:16px"></div>' + open.map(line).join('');
      if (got.length) {
        html += '<div class="section-head"><h2 class="h2" style="color:var(--muted)">In the basket</h2>' +
          '<button class="link" data-clear-checked>Clear</button></div>' + got.map(line).join('');
      }
      html += '<div class="pad" style="padding-top:24px">' +
        '<button class="btn btn-ghost btn-block" data-clear-all>Empty the whole list</button></div>';
    }

    html += '<div style="height:26px"></div></div>';
    screen.innerHTML = html;

    var input = screen.querySelector('#add-item');
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = input.value.trim();
      if (!v) return;
      BL.shopping.add(v);
      BL.render();
      var again = document.getElementById('add-item');
      if (again) again.focus();
    });

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }

      var del = e.target.closest('[data-del-item]');
      if (del) {
        e.stopPropagation();
        var id = del.getAttribute('data-del-item');
        BL.store.saveShopping(BL.store.shopping().filter(function (x) { return x.id !== id; }));
        BL.render();
        return;
      }

      var it = e.target.closest('[data-item]');
      if (it) {
        var iid = it.getAttribute('data-item');
        var l = BL.store.shopping().slice();
        l.forEach(function (x) { if (x.id === iid) x.checked = !x.checked; });
        BL.store.saveShopping(l);
        BL.native.vibrate(8);
        BL.render();
        return;
      }

      if (e.target.closest('[data-clear-checked]')) {
        BL.store.saveShopping(BL.store.shopping().filter(function (x) { return !x.checked; }));
        BL.render();
        return;
      }

      if (e.target.closest('[data-clear-all]')) {
        BL.confirm('Empty the list?', 'Everything on it will be removed.', 'Empty it', function () {
          BL.store.saveShopping([]);
          BL.render();
        });
      }
    });
  });

  /* --------------------------------------------- baker's percentages */

  var bp = { mode: 'build', flour: 500, hydration: 72, salt: 2, starter: 20, yeast: 0,
    recipeId: '', feedStarter: 50, feedRatio: '1:5:5' };

  BL.route('bakers', function (screen) {
    screen.innerHTML = '<div class="view">' +
      header("Baker's math", 'Percentages of flour') +
      '<div class="pad"><div class="seg">' +
        '<button data-bmode="build" class="' + (bp.mode === 'build' ? 'on' : '') + '">Dough</button>' +
        '<button data-bmode="analyze" class="' + (bp.mode === 'analyze' ? 'on' : '') + '">My recipe</button>' +
        '<button data-bmode="starter" class="' + (bp.mode === 'starter' ? 'on' : '') + '">Starter</button>' +
      '</div></div>' +
      '<div id="bp-body">' + bpBody() + '</div></div>';

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }
      var m = e.target.closest('[data-bmode]');
      if (m) {
        bp.mode = m.getAttribute('data-bmode');
        BL.render();
        return;
      }
      var r = e.target.closest('[data-pick-recipe]');
      if (r) { pickRecipe(); return; }
      var pre = e.target.closest('[data-preset-h]');
      if (pre) {
        bp.hydration = parseFloat(pre.getAttribute('data-preset-h'));
        refresh(screen);
      }
    });

    screen.addEventListener('input', function (e) {
      if (e.target.id === 'bp-flour') bp.flour = parseFloat(e.target.value) || 0;
      if (e.target.id === 'bp-hyd') { bp.hydration = parseFloat(e.target.value) || 0; }
      if (e.target.id === 'bp-salt') bp.salt = parseFloat(e.target.value) || 0;
      if (e.target.id === 'bp-starter') bp.starter = parseFloat(e.target.value) || 0;
      if (e.target.id === 'bp-yeast') bp.yeast = parseFloat(e.target.value) || 0;
      if (e.target.id === 'bp-fstarter') bp.feedStarter = parseFloat(e.target.value) || 0;
      if (e.target.id === 'bp-ratio') bp.feedRatio = e.target.value;
      refreshResults(screen);
    });
  });

  function refresh(screen) {
    screen.querySelector('#bp-body').innerHTML = bpBody();
  }

  function refreshResults(screen) {
    var box = screen.querySelector('#bp-out');
    if (box) box.innerHTML = bp.mode === 'starter' ? starterOut() : buildOut();
    var hv = screen.querySelector('#hyd-val');
    if (hv) hv.textContent = bp.hydration + '%';
  }

  function bpBody() {
    if (bp.mode === 'build') return buildPane();
    if (bp.mode === 'analyze') return analyzePane();
    return starterPane();
  }

  function buildPane() {
    return '<div class="pad" style="padding-top:24px">' +
      '<div class="field-row"><label class="label">Total flour (g)</label>' +
        '<input class="field" id="bp-flour" inputmode="decimal" value="' + bp.flour + '"></div>' +
      '<label class="label">Hydration <span id="hyd-val" style="color:var(--accent)">' + bp.hydration + '%</span></label>' +
      '<input class="slider" id="bp-hyd" type="range" min="50" max="100" step="1" value="' + bp.hydration + '">' +
      '<div class="chips" style="padding:6px 0 18px">' +
        [['60', 'Bagels 60%'], ['65', 'Sandwich 65%'], ['72', 'Country 72%'], ['80', 'Ciabatta 80%'], ['85', 'Focaccia 85%']]
          .map(function (p) {
            return '<button class="chip' + (String(bp.hydration) === p[0] ? ' on' : '') + '" data-preset-h="' + p[0] + '">' + p[1] + '</button>';
          }).join('') +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<div class="field-row" style="flex:1"><label class="label">Salt %</label>' +
          '<input class="field" id="bp-salt" inputmode="decimal" value="' + bp.salt + '"></div>' +
        '<div class="field-row" style="flex:1"><label class="label">Starter %</label>' +
          '<input class="field" id="bp-starter" inputmode="decimal" value="' + bp.starter + '"></div>' +
        '<div class="field-row" style="flex:1"><label class="label">Yeast %</label>' +
          '<input class="field" id="bp-yeast" inputmode="decimal" value="' + bp.yeast + '"></div>' +
      '</div>' +
      '<div id="bp-out">' + buildOut() + '</div>' +
      '<div style="height:28px"></div></div>';
  }

  function buildOut() {
    var flour = bp.flour || 0;
    // a 100% hydration starter carries half flour, half water
    var starterG = flour * bp.starter / 100;
    var starterFlour = starterG / 2;
    var starterWater = starterG / 2;
    var totalWater = flour * bp.hydration / 100;
    var addedWater = totalWater - starterWater;
    var addedFlour = flour - starterFlour;
    var salt = flour * bp.salt / 100;
    var yeast = flour * bp.yeast / 100;
    var total = flour + totalWater + salt + yeast;

    function r(label, v, note) {
      return '<tr><td>' + label + (note ? '<div class="hint">' + note + '</div>' : '') +
        '</td><td class="num">' + U.metricRound(Math.max(0, v)) + ' g</td></tr>';
    }

    return '<div class="rule-tight" style="margin:8px 0 14px"></div>' +
      '<div class="kicker" style="margin-bottom:10px">Your dough</div>' +
      '<table class="table"><tbody>' +
        r('Flour to weigh out', addedFlour, starterG > 0 ? 'Total flour minus the flour already in your starter' : '') +
        r('Water', addedWater, starterG > 0 ? 'Total water minus the water in your starter' : '') +
        (starterG > 0 ? r('Starter (100% hydration)', starterG) : '') +
        r('Salt', salt) +
        (yeast > 0 ? r('Yeast', yeast) : '') +
        '<tr><td><strong>Total dough</strong></td><td class="num"><strong>' + U.metricRound(total) + ' g</strong></td></tr>' +
      '</tbody></table>' +
      '<p class="hint" style="margin-top:14px">Baker\'s percentages are always a share of the <em>total flour</em>, ' +
      'which is why they add up to more than 100%. Two 900 g loaves need roughly 1100 g of total dough.</p>';
  }

  function analyzePane() {
    var r = bp.recipeId ? BL.store.get(bp.recipeId) : null;
    var html = '<div class="pad" style="padding-top:24px">' +
      '<button class="tile" data-pick-recipe><span class="ti">' + icon('book') + '</span>' +
        '<span class="grow"><div class="tt">' + (r ? esc(r.title) : 'Choose a recipe') + '</div>' +
        '<div class="ts">' + (r ? 'Tap to pick a different one' : 'Reads the ingredient weights and works out the percentages') +
        '</div></span></button>';

    if (r) {
      var an = analyze(r);
      if (!an.flour) {
        html += '<p class="hint" style="padding-top:14px">Butterleaf could not find a flour weight in this recipe. ' +
          'Baker\'s percentages need at least one flour measured by weight (or a volume it can convert).</p>';
      } else {
        html += '<div class="rule-tight" style="margin:20px 0 14px"></div>' +
          '<div class="kicker" style="margin-bottom:6px">Hydration</div>' +
          '<div class="conv-out">' + Math.round(an.hydration) + '%</div>' +
          '<div style="height:16px"></div>' +
          '<table class="table"><thead><tr><th>Ingredient</th><th style="text-align:right">Grams</th><th style="text-align:right">Baker\'s %</th></tr></thead><tbody>' +
          an.rows.map(function (x) {
            return '<tr><td>' + esc(x.name) + '</td><td class="num">' + U.metricRound(x.g) + '</td>' +
              '<td class="num" style="color:var(--accent)">' + (Math.round(x.pct * 10) / 10) + '%</td></tr>';
          }).join('') +
          '</tbody></table>' +
          '<p class="hint" style="margin-top:14px">Flour total ' + U.metricRound(an.flour) + ' g = 100%. ' +
          (an.skipped ? an.skipped + ' ingredient' + (an.skipped === 1 ? '' : 's') + ' could not be weighed and were left out.' : '') +
          '</p>';
      }
    }
    return html + '<div style="height:28px"></div></div>';
  }

  function analyze(r) {
    var flour = 0, water = 0, skipped = 0;
    var items = [];
    (r.ingredients || []).forEach(function (i) {
      if (i.qty == null || !i.unit) { skipped++; return; }
      var g = U.convert(i.qty, i.unit, 'g', i.item);
      if (g == null) { skipped++; return; }
      var d = U.densityFor(i.item);
      var key = d ? d.key : '';
      if (/^flour_/.test(key)) flour += g;
      if (key === 'water' || key === 'milk' || key === 'sour_cream') water += g;
      if (key === 'starter') { flour += g / 2; water += g / 2; }
      items.push({ name: i.item, g: g, key: key });
    });
    var rows = items.map(function (x) {
      return { name: x.name, g: x.g, pct: flour ? (x.g / flour) * 100 : 0 };
    }).sort(function (a, b) { return b.g - a.g; });
    return { flour: flour, water: water, hydration: flour ? (water / flour) * 100 : 0, rows: rows, skipped: skipped };
  }

  function pickRecipe() {
    var all = BL.store.all().sort(function (a, b) {
      return BL.sortTitle(a.title).localeCompare(BL.sortTitle(b.title));
    });
    if (!all.length) { BL.toast('Add a recipe first'); return; }
    BL.sheet('<h2 class="h1">Pick a recipe</h2>' + all.map(function (r) {
      return '<button class="row" data-r="' + esc(r.id) + '" style="padding-left:0;padding-right:0">' +
        '<span class="grow"><div class="rt">' + esc(r.title) + '</div>' +
        '<div class="rs">' + (r.ingredients || []).length + ' ingredients</div></span>' +
        '<span class="chevron">' + icon('chevron') + '</span></button>';
    }).join(''), function (s) {
      s.addEventListener('click', function (e) {
        var b = e.target.closest('[data-r]');
        if (!b) return;
        bp.recipeId = b.getAttribute('data-r');
        BL.closeSheet();
        BL.render();
      });
    });
  }

  function starterPane() {
    return '<div class="pad" style="padding-top:24px">' +
      '<p class="body" style="margin:0 0 20px">Feed by ratio: starter : flour : water. ' +
      '1:5:5 means five parts flour and five parts water for every part of starter you keep.</p>' +
      '<div style="display:flex;gap:10px">' +
        '<div class="field-row" style="flex:1"><label class="label">Starter kept (g)</label>' +
          '<input class="field" id="bp-fstarter" inputmode="decimal" value="' + bp.feedStarter + '"></div>' +
        '<div class="field-row" style="flex:1"><label class="label">Ratio</label>' +
          '<input class="field" id="bp-ratio" value="' + esc(bp.feedRatio) + '"></div>' +
      '</div>' +
      '<div id="bp-out">' + starterOut() + '</div>' +
      '<div style="height:28px"></div></div>';
  }

  function starterOut() {
    var parts = String(bp.feedRatio).split(/[:\s]+/).map(parseFloat);
    var s = parts[0] || 1, f = parts[1] || 1, w = parts[2] != null ? parts[2] : f;
    var keep = bp.feedStarter || 0;
    var flour = keep / s * f;
    var water = keep / s * w;
    var total = keep + flour + water;
    return '<div class="rule-tight" style="margin:8px 0 14px"></div>' +
      '<table class="table"><tbody>' +
        '<tr><td>Starter</td><td class="num">' + U.metricRound(keep) + ' g</td></tr>' +
        '<tr><td>Flour to add</td><td class="num">' + U.metricRound(flour) + ' g</td></tr>' +
        '<tr><td>Water to add</td><td class="num">' + U.metricRound(water) + ' g</td></tr>' +
        '<tr><td><strong>After feeding</strong></td><td class="num"><strong>' + U.metricRound(total) + ' g</strong></td></tr>' +
      '</tbody></table>' +
      '<p class="hint" style="margin-top:14px">Warmer kitchen, bigger ratio: 1:5:5 at 24°C peaks in about 6–8 hours, ' +
      '1:1:1 in 3–4. Use it when it has domed and just started to flatten.</p>';
  }

  /* ---------------------------------------------------- categories */

  BL.route('categories', function (screen) {
    var cats = BL.store.categories().slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    var html = '<div class="view">' +
      header('Categories', cats.length ? cats.length + (cats.length === 1 ? ' category' : ' categories') : 'Your own shelves') +
      '<div class="pad" style="padding-top:6px">' +
        '<div class="search">' + icon('plus') +
          '<input id="new-cat" placeholder="New category name" autocomplete="off">' +
        '</div></div>';

    if (!cats.length) {
      html += '<div class="empty"><div class="mark">' + icon('list') + '</div>' +
        '<h3>No categories yet</h3>' +
        '<p>Type a name above to make your first one. A recipe can sit in as many categories as you like.</p></div>';
    } else {
      html += '<div style="height:18px"></div>';
      cats.forEach(function (c) {
        var n = BL.store.countIn(c.id);
        html += '<div class="row" data-cat-row="' + esc(c.id) + '">' +
          '<button class="grow" data-open-cat="' + esc(c.id) + '" style="text-align:left;background:none">' +
            '<div class="rt" style="font-family:var(--serif);font-size:17px">' + esc(c.name) + '</div>' +
            '<div class="rs">' + (n ? n + (n === 1 ? ' recipe' : ' recipes') : 'Empty') + '</div>' +
          '</button>' +
          '<button class="icon-btn ghost" data-rename-cat="' + esc(c.id) + '">' + icon('edit') + '</button>' +
          '<button class="icon-btn ghost" data-del-cat="' + esc(c.id) + '">' + icon('trash') + '</button>' +
          '</div>';
      });
    }

    html += '<p class="hint" style="padding:24px 20px 30px">Deleting a category leaves every recipe in it untouched — ' +
      'it just stops being filed there.</p></div>';
    screen.innerHTML = html;

    var input = screen.querySelector('#new-cat');
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = input.value.trim();
      if (!v) return;
      BL.store.addCategory(v);
      BL.toast('Added ' + v);
      BL.render();
      var again = document.getElementById('new-cat');
      if (again) again.focus();
    });

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }

      var open = e.target.closest('[data-open-cat]');
      if (open) { BL.openCategory(open.getAttribute('data-open-cat')); return; }

      var ren = e.target.closest('[data-rename-cat]');
      if (ren) {
        var id = ren.getAttribute('data-rename-cat');
        renameSheet(id);
        return;
      }

      var del = e.target.closest('[data-del-cat]');
      if (del) {
        var did = del.getAttribute('data-del-cat');
        var name = BL.store.categoryName(did);
        BL.confirm('Delete "' + name + '"?', 'The recipes in it stay in your box.', 'Delete', function () {
          BL.store.removeCategory(did);
          BL.render();
        });
      }
    });
  });

  function renameSheet(id) {
    var name = BL.store.categoryName(id);
    BL.sheet('<h2 class="h1">Rename category</h2>' +
      '<input class="field" id="ren-cat" value="' + esc(name) + '">' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-primary btn-block" data-save-ren>Save</button>',
      function (s) {
        var box = s.querySelector('#ren-cat');
        setTimeout(function () { box.focus(); box.select(); }, 250);
        s.querySelector('[data-save-ren]').onclick = function () {
          BL.store.renameCategory(id, box.value);
          BL.closeSheet();
          BL.render();
        };
      });
  }

  /* ------------------------------------------------------ settings */


  /* -------------------------------------------------- substitutions */

  var subQ = '';

  BL.route('subs', function (screen) {
    var hits = BL.subs.search(subQ);
    screen.innerHTML = '<div class="view">' +
      header('Substitutions', 'When the tin is empty') +
      '<div class="pad" style="padding-top:4px">' +
        '<div class="search">' + icon('search') +
        '<input id="sub-q" placeholder="Search an ingredient" value="' + esc(subQ) + '" autocomplete="off"></div>' +
      '</div>' +
      (hits.length
        ? hits.map(subCard).join('')
        : '<div class="empty" style="padding:44px 30px"><h3>Nothing for that</h3>' +
          '<p>Try the plain name — "buttermilk", "egg", "cake flour".</p></div>') +
      '<p class="hint" style="padding:16px 20px 34px">Substitutes get you a good bake, not the same bake. ' +
      'Where the swap changes the result, the note says so.</p>' +
      '</div>';

    var box = screen.querySelector('#sub-q');
    box.addEventListener('input', function () {
      subQ = box.value;
      var pos = box.selectionStart;
      BL.render();
      var b2 = document.getElementById('sub-q');
      if (b2) { b2.focus(); try { b2.setSelectionRange(pos, pos); } catch (e) {} }
    });

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) BL.back();
    });
  });

  function subCard(e) {
    return '<div class="section-head"><h2 class="h2">' + esc(e.name) + '</h2></div>' +
      '<div class="pad">' +
        e.swaps.map(function (sw) {
          return '<div class="swapcard"><div class="sw-h">' + esc(sw[0]) + '</div>' +
            '<div class="sw-b">' + esc(sw[1]) + '</div></div>';
        }).join('') +
        (e.note ? '<p class="hint" style="padding-top:8px">' + esc(e.note) + '</p>' : '') +
      '</div>';
  }

  /** The same content, as a sheet, from a tap on an ingredient. */
  BL.subsSheet = function (item) {
    var e = BL.subs.find(item);
    if (!e) { BL.toast('No substitution on file for that'); return; }
    BL.sheet(
      '<div class="kicker" style="margin-bottom:6px">Instead of</div>' +
      '<h2 class="h1" style="margin-bottom:16px">' + esc(e.name) + '</h2>' +
      '<div style="max-height:52vh;overflow:auto">' +
        e.swaps.map(function (sw) {
          return '<div class="swapcard"><div class="sw-h">' + esc(sw[0]) + '</div>' +
            '<div class="sw-b">' + esc(sw[1]) + '</div></div>';
        }).join('') +
        (e.note ? '<p class="hint" style="padding-top:6px">' + esc(e.note) + '</p>' : '') +
      '</div>' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-ghost btn-block" data-close>Close</button>',
      function (s) {
        var b = s.querySelector('[data-close]');
        if (b) b.onclick = BL.closeSheet;
      });
  };

  BL.route('settings', function (screen) {
    var s = BL.store.settings();
    var count = BL.store.all().length;
    var snoozeMin = BL.snoozeMin();

    screen.innerHTML = '<div class="view">' +
      header('Settings', 'Butterleaf 1.0') +
      '<div class="section-head"><h2 class="h2">Appearance</h2></div>' +
      '<div class="pad"><div class="seg">' +
        ['auto', 'light', 'dark'].map(function (t) {
          return '<button data-theme="' + t + '" class="' + (s.theme === t ? 'on' : '') + '">' +
            t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
        }).join('') +
      '</div></div>' +

      '<div class="section-head"><h2 class="h2">Default units</h2></div>' +
      '<div class="pad"><div class="seg">' +
        [['original', 'As written'], ['metric', 'Metric'], ['us', 'US cups']].map(function (t) {
          return '<button data-units="' + t[0] + '" class="' + (s.units === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') +
      '</div><p class="hint" style="padding-top:10px">How ingredient amounts appear when you open a recipe. ' +
      'You can always flip it per recipe.</p></div>' +

      '<div class="section-head"><h2 class="h2">Timers</h2></div>' +
      '<div class="pad"><div class="seg">' +
        [1, 2, 5, 10, 15, 20].map(function (n) {
          return '<button data-snooze="' + n + '" class="' + (snoozeMin === n ? 'on' : '') + '">' + n + 'm</button>';
        }).join('') +
      '</div><p class="hint" style="padding-top:10px">How long Snooze waits when a bake timer goes off. ' +
      'You can still pick a different length on the alarm itself.</p></div>' +

      '<div class="section-head"><h2 class="h2">Your recipe box</h2></div>' +
      '<div class="pad">' +
        '<button class="tile" data-export><span class="ti">' + icon('download') + '</span>' +
          '<span class="grow"><div class="tt">Back up ' + count + ' recipes</div>' +
          '<div class="ts">Saves a single file you can keep anywhere</div></span></button>' +
        '<button class="tile" data-import><span class="ti">' + icon('upload') + '</span>' +
          '<span class="grow"><div class="tt">Restore from a backup</div>' +
          '<div class="ts">Merges into what you already have</div></span></button>' +
        '<button class="tile" data-sample><span class="ti">' + icon('leaf') + '</span>' +
          '<span class="grow"><div class="tt">Add the sample recipe</div></span></button>' +
      '</div>' +

      '<div class="section-head"><h2 class="h2">About</h2></div>' +
      '<div class="pad"><p class="body" style="margin:0">' +
        'Butterleaf keeps your recipes on this phone only — no account, no cloud, no tracking. ' +
        'Ingredient weights follow King Arthur Baking\'s chart. Set in TeX Gyre Pagella.' +
      '</p></div>' +
      '<div style="height:34px"></div></div>';

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }

      var t = e.target.closest('button[data-theme]');
      if (t) {
        BL.store.saveSettings({ theme: t.getAttribute('data-theme') });
        BL.applyTheme();
        BL.render();
        return;
      }
      var u = e.target.closest('button[data-units]');
      if (u) { BL.store.saveSettings({ units: u.getAttribute('data-units') }); BL.render(); return; }

      var z = e.target.closest('button[data-snooze]');
      if (z) {
        var mins = parseInt(z.getAttribute('data-snooze'), 10);
        BL.store.saveSettings({ snoozeMin: mins });
        BL.native.setSnoozeMinutes(mins);
        BL.render();
        return;
      }

      if (e.target.closest('[data-export]')) {
        BL.native.exportBackup(BL.store.exportAll());
        BL.toast('Backup ready — choose where to keep it');
        return;
      }
      if (e.target.closest('[data-import]')) { BL.native.importBackup(); return; }
      if (e.target.closest('[data-sample]')) {
        BL.addSample();
        BL.toast('Sample recipe added');
        BL.go('#/library');
      }
    });
  });
})(window.BL = window.BL || {});
