/* ============================================================
   Butterleaf — library & favorites
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc;

  var ui = { q: '', tag: '', sort: 'recent' };

  function searchBlob(r) {
    if (r._blob) return r._blob;
    var parts = [r.title || '', r.description || '', (r.tags || []).join(' '), r.sourceName || ''];
    (r.ingredients || []).forEach(function (i) { parts.push(i.item || '', i.raw || ''); });
    r._blob = parts.join(' ').toLowerCase();
    return r._blob;
  }

  function matches(r, q) {
    if (!q) return true;
    var blob = searchBlob(r);
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (tok) {
      return blob.indexOf(tok) !== -1;
    });
  }

  function allTags() {
    var seen = {}, out = [];
    BL.store.all().forEach(function (r) {
      (r.tags || []).forEach(function (t) {
        var k = t.toLowerCase();
        if (!seen[k]) { seen[k] = 1; out.push(t); }
      });
    });
    return out.sort(function (a, b) { return a.localeCompare(b); }).slice(0, 14);
  }

  function totalTime(r) {
    if (r.totalMin) return r.totalMin;
    var s = (r.prepMin || 0) + (r.cookMin || 0);
    return s || null;
  }

  function cardMeta(r) {
    var bits = [];
    var t = totalTime(r);
    if (t) bits.push(BL.fmtMins(t));
    if (r.yield) bits.push(String(r.yield).replace(/^(makes|serves)\s+/i, ''));
    if (!bits.length && r.sourceName) bits.push(r.sourceName);
    return bits.slice(0, 2).join(' · ');
  }

  function thumb(r) {
    if (r.image) return '<img src="' + esc(r.image) + '" alt="" loading="lazy">';
    var initial = (String(r.title || '?').trim()[0] || '?').toUpperCase();
    return '<div class="placeholder"><span class="initial">' + esc(initial) + '</span></div>';
  }
  BL.thumb = thumb;

  BL.recipeCard = function (r, feature) {
    return '<button class="rcard' + (feature ? ' feature span-2' : '') + '" data-open="' + esc(r.id) + '">' +
      '<div class="thumb">' + thumb(r) +
        '<span class="fav' + (r.favorite ? ' on' : '') + '" data-fav="' + esc(r.id) + '">' +
          icon(r.favorite ? 'heartFill' : 'heart') + '</span>' +
      '</div>' +
      '<h3>' + esc(r.title) + '</h3>' +
      '<div class="cmeta">' + esc(cardMeta(r)) + '</div>' +
      '</button>';
  };

  function sortRecipes(list) {
    if (ui.sort === 'az') {
      return list.sort(function (a, b) { return BL.sortTitle(a.title).localeCompare(BL.sortTitle(b.title)); });
    }
    if (ui.sort === 'time') {
      return list.sort(function (a, b) { return (totalTime(a) || 9999) - (totalTime(b) || 9999); });
    }
    return list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  }

  /* ------------------------------------------------------- library */

  BL.route('library', function (screen) {
    var all = BL.store.all();
    var tags = allTags();

    var list = all.filter(function (r) {
      if (ui.tag && (r.tags || []).map(function (t) { return t.toLowerCase(); }).indexOf(ui.tag.toLowerCase()) === -1) return false;
      return matches(r, ui.q);
    });
    list = sortRecipes(list);

    var sortLabel = ui.sort === 'az' ? 'A–Z' : (ui.sort === 'time' ? 'Quickest' : 'Recent');

    var html = '<div class="view">' +
      '<div class="topbar">' +
        '<div><div class="kicker" style="margin-bottom:6px">' + all.length + ' recipe' + (all.length === 1 ? '' : 's') + '</div>' +
        '<h1 class="display">Recipe Box</h1></div>' +
        '<div class="topbar-actions">' +
          '<button class="icon-btn ghost" data-sort title="Sort">' + icon('sliders') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="pad" style="padding-top:6px">' +
        '<div class="search">' + icon('search') +
          '<input id="q" placeholder="Search recipes and ingredients" value="' + esc(ui.q) + '" autocomplete="off">' +
          (ui.q ? '<button class="icon-btn ghost" data-clear style="width:26px;height:26px">' + icon('x') + '</button>' : '') +
        '</div>' +
      '</div>';

    if (tags.length) {
      html += '<div class="chips" style="margin-top:14px">' +
        '<button class="chip' + (!ui.tag ? ' on' : '') + '" data-tag="">All</button>' +
        tags.map(function (t) {
          return '<button class="chip' + (ui.tag.toLowerCase() === t.toLowerCase() ? ' on' : '') +
            '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div>';
    }

    if (all.length) {
      html += '<div class="meta" style="padding:14px 20px 12px">' +
        (ui.q || ui.tag ? list.length + ' match' + (list.length === 1 ? '' : 'es') : 'Sorted by ' + sortLabel.toLowerCase()) +
        '</div>';
    } else {
      html += '<div style="height:10px"></div>';
    }

    if (!all.length) {
      html += emptyLibrary();
    } else if (!list.length) {
      html += '<div class="empty"><div class="mark">' + icon('search') + '</div>' +
        '<h3>Nothing matches that</h3><p>Try a different ingredient, or clear the filters.</p>' +
        '<button class="btn btn-ghost" data-clear-all>Clear search</button></div>';
    } else {
      html += '<div class="grid">';
      list.forEach(function (r, i) {
        html += BL.recipeCard(r, i === 0 && !ui.q && !ui.tag && list.length > 2);
      });
      html += '</div>';
    }

    html += '</div>';
    screen.innerHTML = html;

    var input = screen.querySelector('#q');
    if (input) {
      input.addEventListener('input', function () {
        ui.q = input.value;
        var pos = input.selectionStart;
        BL.render();
        var again = document.getElementById('q');
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }

    screen.addEventListener('click', function (e) {
      var sort = e.target.closest('[data-sort]');
      if (sort) { sortSheet(); return; }
      var clear = e.target.closest('[data-clear], [data-clear-all]');
      if (clear) { ui.q = ''; ui.tag = ''; BL.render(); return; }
      var tag = e.target.closest('[data-tag]');
      if (tag) { ui.tag = tag.getAttribute('data-tag'); BL.render(); return; }
      handleCardClick(e);
    });
  });

  function sortSheet() {
    var opts = [['recent', 'Recently updated'], ['az', 'Alphabetical'], ['time', 'Quickest first']];
    BL.sheet('<h2 class="h1">Sort recipes</h2>' + opts.map(function (o) {
      return '<button class="tile" data-s="' + o[0] + '"><span class="ti">' +
        icon(o[0] === 'az' ? 'list' : (o[0] === 'time' ? 'clock' : 'book')) + '</span>' +
        '<span class="grow"><div class="tt">' + o[1] + '</div></span>' +
        (ui.sort === o[0] ? '<span style="color:var(--accent)">' + icon('check') + '</span>' : '') +
        '</button>';
    }).join(''), function (s) {
      s.addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]');
        if (!b) return;
        ui.sort = b.getAttribute('data-s');
        BL.closeSheet();
        BL.render();
      });
    });
  }

  function emptyLibrary() {
    return '<div class="empty">' +
      '<div class="mark">' + icon('leaf') + '</div>' +
      '<h3>Your recipe box is empty</h3>' +
      '<p>Paste a link from any recipe site and Butterleaf will lift out the ingredients and method — or write your own from scratch.</p>' +
      '<button class="btn btn-primary" data-go-import>' + icon('link') + 'Import from a link</button>' +
      '<div style="height:10px"></div>' +
      '<button class="btn btn-quiet" data-sample>Add a sample recipe to look around</button>' +
      '</div>';
  }

  function handleCardClick(e) {
    var fav = e.target.closest('[data-fav]');
    if (fav) {
      e.stopPropagation();
      var r = BL.store.get(fav.getAttribute('data-fav'));
      if (r) {
        r.favorite = !r.favorite;
        BL.store.put(r);
        BL.native.vibrate(12);
        BL.toast(r.favorite ? 'Saved to favorites' : 'Removed from favorites');
        BL.render();
      }
      return true;
    }
    var open = e.target.closest('[data-open]');
    if (open) { BL.go('#/recipe/' + open.getAttribute('data-open')); return true; }
    if (e.target.closest('[data-go-import]')) { BL.go('#/import'); return true; }
    if (e.target.closest('[data-sample]')) {
      BL.addSample();
      BL.toast('Sample recipe added');
      BL.render();
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------- favorites */

  BL.route('favorites', function (screen) {
    var favs = BL.store.all().filter(function (r) { return r.favorite; })
      .sort(function (a, b) { return BL.sortTitle(a.title).localeCompare(BL.sortTitle(b.title)); });

    var html = '<div class="view">' +
      '<div class="topbar"><div>' +
        '<div class="kicker" style="margin-bottom:6px">' + favs.length + ' saved</div>' +
        '<h1 class="display">Favorites</h1></div></div>' +
      '<div class="rule"></div>';

    if (!favs.length) {
      html += '<div class="empty"><div class="mark">' + icon('heart') + '</div>' +
        '<h3>No favorites yet</h3>' +
        '<p>Tap the heart on any recipe and it will land here, filed alphabetically.</p>' +
        '<button class="btn btn-ghost" data-lib>Browse recipes</button></div>';
    } else {
      var letter = '';
      favs.forEach(function (r) {
        var l = (BL.sortTitle(r.title)[0] || '#').toUpperCase();
        if (l !== letter) {
          letter = l;
          html += '<div class="alpha-head">' + esc(letter) + '</div>';
        }
        html += '<button class="row" data-open="' + esc(r.id) + '">' +
          '<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex:none;background:var(--surface-2)">' +
            thumb(r) + '</div>' +
          '<span class="grow"><div class="rt" style="font-family:var(--serif);font-size:17px">' + esc(r.title) + '</div>' +
          '<div class="rs">' + esc(cardMeta(r)) + '</div></span>' +
          '<span style="color:var(--accent)">' + icon('heartFill') + '</span>' +
          '</button>';
      });
    }

    html += '</div>';
    screen.innerHTML = html;

    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-lib]')) { BL.go('#/library'); return; }
      handleCardClick(e);
    });
  });

  /* -------------------------------------------------------- sample */

  BL.addSample = function () {
    var r = {
      id: BL.uid(),
      title: 'Brown Butter Chocolate Chip Cookies',
      description: 'Nutty browned butter, a long cold rest, and flaky salt on top. The cold rest is what makes them taste like a bakery cookie rather than a homemade one.',
      image: '',
      yield: '18 cookies',
      prepMin: 25,
      cookMin: 12,
      totalMin: 757,
      tags: ['Cookies', 'Chocolate'],
      favorite: false,
      sourceUrl: '',
      sourceName: 'Butterleaf sample',
      ingredients: [
        { id: 'i1', raw: '227 g unsalted butter', qty: 227, unit: 'g', item: 'unsalted butter', note: '' },
        { id: 'i2', raw: '213 g dark brown sugar, packed', qty: 213, unit: 'g', item: 'dark brown sugar', note: 'packed' },
        { id: 'i3', raw: '99 g granulated sugar', qty: 99, unit: 'g', item: 'granulated sugar', note: '' },
        { id: 'i4', raw: '2 large eggs, cold', qty: 2, unit: 'each', item: 'large eggs', note: 'cold' },
        { id: 'i5', raw: '2 tsp vanilla extract', qty: 2, unit: 'tsp', item: 'vanilla extract', note: '' },
        { id: 'i6', raw: '300 g all-purpose flour', qty: 300, unit: 'g', item: 'all-purpose flour', note: '' },
        { id: 'i7', raw: '1 tsp baking soda', qty: 1, unit: 'tsp', item: 'baking soda', note: '' },
        { id: 'i8', raw: '1 1/4 tsp kosher salt', qty: 1.25, unit: 'tsp', item: 'kosher salt', note: '' },
        { id: 'i9', raw: '280 g dark chocolate, chopped', qty: 280, unit: 'g', item: 'dark chocolate', note: 'chopped' },
        { id: 'i10', raw: 'Flaky sea salt, for finishing', qty: null, unit: null, item: 'flaky sea salt', note: 'for finishing' }
      ],
      steps: [
        { id: 's1', text: 'Brown the butter in a light-coloured pan over medium heat until the foam subsides and the milk solids smell like toasted hazelnuts, about 6 minutes. Scrape everything, including the dark bits, into a bowl and cool for 15 minutes.', minutes: 6 },
        { id: 's2', text: 'Whisk in both sugars, then the eggs one at a time, then the vanilla. Beat for a full 2 minutes — the batter should turn glossy and slightly paler.', minutes: 2 },
        { id: 's3', text: 'Fold in the flour, baking soda and salt until barely combined, then the chocolate. Stop while a few floury streaks remain.', minutes: null },
        { id: 's4', text: 'Cover and rest the dough in the fridge for at least 12 hours, up to 3 days. This is not optional if you want deep flavour and chewy edges.', minutes: 720 },
        { id: 's5', text: 'Heat the oven to 350°F / 180°C. Scoop 60 g balls onto a lined sheet, leaving room to spread. Bake 11 to 13 minutes, until the edges are set and the middles still look underdone.', minutes: 13 },
        { id: 's6', text: 'Finish with flaky salt and cool on the sheet for 10 minutes so the centres set.', minutes: 10 }
      ],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    BL.store.put(r);
    return r;
  };
})(window.BL = window.BL || {});
