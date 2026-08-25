/* ============================================================
   Butterleaf — recipe editor & importer
   ============================================================ */
(function (BL) {
  'use strict';

  var icon = BL.icon, esc = BL.esc, U = BL.units;

  /* ------------------------------------------------- image helper */

  function readImage(file, cb) {
    if (!file) return cb('');
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1400;
        var w = img.width, h = img.height;
        if (w > max || h > max) {
          var k = Math.min(max / w, max / h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var out;
        try { out = c.toDataURL('image/jpeg', 0.82); } catch (e) { out = reader.result; }
        cb(out);
      };
      img.onerror = function () { cb(''); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(''); };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------- editor */

  function blank() {
    return {
      id: BL.uid(), title: '', description: '', image: '', yield: '',
      prepMin: null, cookMin: null, totalMin: null, tags: [], categories: [],
      ingredients: [{ id: BL.uid(), raw: '' }],
      steps: [{ id: BL.uid(), text: '' }],
      notes: '', favorite: false, sourceUrl: '', sourceName: ''
    };
  }

  var draft = null;
  var isNew = false;

  function openEditor(screen, existing, brandNew) {
    draft = JSON.parse(JSON.stringify(existing));
    isNew = !!brandNew;
    if (!draft.ingredients || !draft.ingredients.length) draft.ingredients = [{ id: BL.uid(), raw: '' }];
    if (!draft.steps || !draft.steps.length) draft.steps = [{ id: BL.uid(), text: '' }];
    draft.ingredients.forEach(function (i) { if (!i.raw && !i.section) i.raw = composeRaw(i); });
    draft.ingredients = withSectionRows(draft.ingredients);

    screen.innerHTML = editorHtml();
    wireEditor(screen);

    BL.viewBack = function () {
      confirmLeave();
      return true;
    };
  }

  function composeRaw(i) {
    if (i.raw) return i.raw;
    var bits = [];
    if (i.qty != null) bits.push(U.fraction(i.qty));
    if (i.unit && i.unit !== 'each') bits.push(U.unitLabel(i.unit, i.qty));
    bits.push(i.item || '');
    var s = bits.filter(Boolean).join(' ');
    if (i.note) s += ', ' + i.note;
    return s;
  }

  function editorHtml() {
    var d = draft;
    return '<div class="view">' +
      '<div class="topbar sub">' +
        '<button class="icon-btn ghost" data-cancel>' + icon('back') + '</button>' +
        '<h1 class="h1" style="flex:1;text-align:center">' + (isNew ? 'New recipe' : 'Edit recipe') + '</h1>' +
        '<button class="icon-btn" data-save style="background:var(--accent);color:var(--accent-ink)">' + icon('check') + '</button>' +
      '</div>' +

      '<div class="pad" style="padding-top:8px">' +
        '<div class="photo-drop" data-photo>' +
          (d.image ? '<img src="' + esc(d.image) + '" alt="">' : '') +
          '<div class="ph">' + icon('camera') + '<div>Add a photo of your bake</div></div>' +
          (d.image ? '<div class="photo-actions"><button class="icon-btn" data-photo-del>' + icon('trash') + '</button></div>' : '') +
        '</div>' +
        '<input type="file" accept="image/*" id="photo-input" style="display:none">' +

        '<div style="height:22px"></div>' +

        '<div class="field-row"><label class="label">Recipe name</label>' +
          '<input class="field" id="f-title" placeholder="Sourdough focaccia" value="' + esc(d.title) + '"></div>' +

        '<div class="field-row"><label class="label">Description</label>' +
          '<textarea class="field" id="f-desc" placeholder="What makes it worth baking?">' + esc(d.description) + '</textarea></div>' +

        '<div style="display:flex;gap:10px">' +
          '<div class="field-row" style="flex:1"><label class="label">Prep</label>' +
            '<input class="field" id="f-prep" inputmode="numeric" placeholder="min" value="' + (d.prepMin || '') + '"></div>' +
          '<div class="field-row" style="flex:1"><label class="label">Bake</label>' +
            '<input class="field" id="f-cook" inputmode="numeric" placeholder="min" value="' + (d.cookMin || '') + '"></div>' +
          '<div class="field-row" style="flex:1.3"><label class="label">Makes</label>' +
            '<input class="field" id="f-yield" placeholder="12 rolls" value="' + esc(d.yield) + '"></div>' +
        '</div>' +

        '<div class="field-row"><label class="label">Tags</label>' +
          '<input class="field" id="f-tags" placeholder="Bread, Weekend" value="' + esc((d.tags || []).join(', ')) + '"></div>' +

        '<div class="field-row"><label class="label">Categories</label>' +
          '<div id="cat-chips" class="chips" style="padding:0;flex-wrap:wrap">' + catChips() + '</div></div>' +
      '</div>' +

      '<div class="section-head"><h2 class="h2">Ingredients</h2>' +
        '<button class="link" data-paste-ing>Paste a list</button></div>' +
      '<div class="pad" id="ing-list">' + draft.ingredients.map(ingRow).join('') + '</div>' +
      '<div class="pad" style="display:flex;gap:18px">' +
        '<button class="add-line" data-add-ing>' + icon('plus') + 'Add ingredient</button>' +
        '<button class="add-line" data-add-section>' + icon('list') + 'Add section</button></div>' +

      '<div class="section-head"><h2 class="h2">Method</h2>' +
        '<button class="link" data-paste-steps>Paste steps</button></div>' +
      '<div class="pad" id="step-list">' + draft.steps.map(stepRow).join('') + '</div>' +
      '<div class="pad"><button class="add-line" data-add-step>' + icon('plus') + 'Add step</button></div>' +

      '<div class="section-head"><h2 class="h2">Notes</h2></div>' +
      '<div class="pad"><textarea class="field" id="f-notes" placeholder="What you would change next time">' + esc(draft.notes || '') + '</textarea></div>' +

      '<div class="pad" style="padding-top:26px">' +
        '<button class="btn btn-primary btn-block" data-save>Save recipe</button>' +
        (isNew ? '' : '<div style="height:10px"></div><button class="btn btn-danger btn-block" data-delete>Delete recipe</button>') +
      '</div>' +
      '<div style="height:30px"></div>' +
      '</div>';
  }

  /** Inserts a visible heading row wherever the stored group changes. */
  function withSectionRows(list) {
    var out = [];
    var current = '';
    list.forEach(function (i) {
      if (i.section) { current = i.name || ''; out.push(i); return; }
      var g = i.group || '';
      if (g !== current) {
        current = g;
        if (g) out.push({ id: BL.uid(), section: true, name: g });
      }
      out.push(i);
    });
    return out;
  }

  function catChips() {
    var cats = BL.store.categories().slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    var picked = draft.categories || [];
    return cats.map(function (c) {
      var on = picked.indexOf(c.id) !== -1;
      return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-cat-toggle="' + esc(c.id) + '">' +
        esc(c.name) + '</button>';
    }).join('') +
      '<button type="button" class="chip" data-cat-add>' + icon('plus') + 'New</button>';
  }

  function ingRow(ing) {
    if (ing.section) return sectionRow(ing);
    return '<div class="ed-row" data-ing-row="' + esc(ing.id) + '">' +
      '<input class="field" data-ing-input="' + esc(ing.id) + '" placeholder="200 g bread flour" value="' + esc(ing.raw || '') + '">' +
      '<button class="del" data-ing-del="' + esc(ing.id) + '">' + icon('x') + '</button>' +
      '</div>';
  }

  function sectionRow(sec) {
    return '<div class="ed-row ed-section" data-ing-row="' + esc(sec.id) + '">' +
      '<input class="field section-f" data-section-input="' + esc(sec.id) + '" ' +
        'placeholder="Section name — Filling, Topping…" value="' + esc(sec.name || '') + '">' +
      '<button class="del" data-ing-del="' + esc(sec.id) + '">' + icon('x') + '</button>' +
      '</div>';
  }

  function stepRow(step, i) {
    return '<div class="ed-step" data-step-row="' + esc(step.id) + '">' +
      '<div class="n">' + (i + 1) + '</div>' +
      '<textarea class="field" data-step-input="' + esc(step.id) + '" rows="2" ' +
        'placeholder="Describe this step">' + esc(step.text || '') + '</textarea>' +
      '<button class="del" data-step-del="' + esc(step.id) + '">' + icon('x') + '</button>' +
      '</div>';
  }

  function renumber(screen) {
    Array.prototype.forEach.call(screen.querySelectorAll('#step-list .ed-step .n'), function (n, i) {
      n.textContent = i + 1;
    });
  }

  function collect(screen) {
    var g = function (id) { var el = screen.querySelector('#' + id); return el ? el.value : ''; };
    draft.title = g('f-title').trim();
    draft.description = g('f-desc').trim();
    draft.yield = g('f-yield').trim();
    draft.notes = g('f-notes').trim();
    draft.prepMin = parseInt(g('f-prep'), 10) || null;
    draft.cookMin = parseInt(g('f-cook'), 10) || null;
    draft.totalMin = (draft.prepMin || 0) + (draft.cookMin || 0) || null;
    draft.tags = g('f-tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean);

    var ings = [];
    var group = '';
    Array.prototype.forEach.call(screen.querySelectorAll('#ing-list [data-ing-row]'), function (row) {
      var sec = row.querySelector('[data-section-input]');
      if (sec) { group = sec.value.trim(); return; }
      var el = row.querySelector('[data-ing-input]');
      if (!el) return;
      var raw = el.value.trim();
      if (!raw) return;
      var p = U.parseIngredient(raw);
      ings.push({ id: el.getAttribute('data-ing-input'), raw: raw, qty: p.qty, qtyMax: p.qtyMax,
        unit: p.unit, item: p.item, note: p.note, group: group });
    });
    draft.ingredients = ings;

    var steps = [];
    Array.prototype.forEach.call(screen.querySelectorAll('[data-step-input]'), function (el) {
      var text = el.value.trim();
      if (!text) return;
      steps.push({ id: el.getAttribute('data-step-input'), text: text, minutes: BL.parse.stepMinutes(text) });
    });
    draft.steps = steps;
    delete draft._blob;
    return draft;
  }

  function confirmLeave() {
    BL.confirm('Discard changes?', 'Anything you typed will be lost.', 'Discard', function () {
      BL.viewBack = null;
      BL.back();
    });
  }

  function newCategorySheet(screen) {
    BL.sheet('<h2 class="h1">New category</h2>' +
      '<input class="field" id="cat-name" placeholder="Breads, Holiday, Weeknight…">' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-primary btn-block" data-make-cat>Create</button>',
      function (s) {
        var box = s.querySelector('#cat-name');
        setTimeout(function () { box.focus(); }, 250);
        s.querySelector('[data-make-cat]').onclick = function () {
          var cat = BL.store.addCategory(box.value);
          BL.closeSheet();
          if (!cat) return;
          var picked = (draft.categories || []).slice();
          if (picked.indexOf(cat.id) === -1) picked.push(cat.id);
          draft.categories = picked;
          var wrap = screen.querySelector('#cat-chips');
          if (wrap) wrap.innerHTML = catChips();
        };
      });
  }

  function wireEditor(screen) {
    var photoInput = screen.querySelector('#photo-input');

    screen.addEventListener('click', function (e) {
      var el;

      if (e.target.closest('[data-cancel]')) { confirmLeave(); return; }

      if (e.target.closest('[data-photo-del]')) {
        e.stopPropagation();
        draft.image = '';
        var d = screen.querySelector('[data-photo]');
        var img = d.querySelector('img');
        if (img) img.remove();
        var pa = d.querySelector('.photo-actions');
        if (pa) pa.remove();
        return;
      }

      if (e.target.closest('[data-photo]')) { photoInput.click(); return; }

      el = e.target.closest('[data-cat-toggle]');
      if (el) {
        var cid = el.getAttribute('data-cat-toggle');
        var picked = (draft.categories || []).slice();
        var at = picked.indexOf(cid);
        if (at === -1) picked.push(cid); else picked.splice(at, 1);
        draft.categories = picked;
        el.classList.toggle('on');
        return;
      }

      if (e.target.closest('[data-cat-add]')) {
        newCategorySheet(screen);
        return;
      }

      if (e.target.closest('[data-add-section]')) {
        var sec = { id: BL.uid(), section: true, name: '' };
        var slist2 = screen.querySelector('#ing-list');
        slist2.insertAdjacentHTML('beforeend', sectionRow(sec));
        var secInput = slist2.lastElementChild.querySelector('input');
        if (secInput) secInput.focus();
        return;
      }

      if (e.target.closest('[data-add-ing]')) {
        var ing = { id: BL.uid(), raw: '' };
        var list = screen.querySelector('#ing-list');
        list.insertAdjacentHTML('beforeend', ingRow(ing));
        var added = list.lastElementChild.querySelector('input');
        if (added) added.focus();
        return;
      }

      el = e.target.closest('[data-ing-del]');
      if (el) {
        var row = el.closest('[data-ing-row]');
        if (screen.querySelectorAll('[data-ing-row]').length > 1) row.remove();
        else row.querySelector('input').value = '';
        return;
      }

      if (e.target.closest('[data-add-step]')) {
        var st = { id: BL.uid(), text: '' };
        var slist = screen.querySelector('#step-list');
        slist.insertAdjacentHTML('beforeend',
          stepRow(st, slist.querySelectorAll('.ed-step').length));
        var ta = slist.lastElementChild.querySelector('textarea');
        if (ta) ta.focus();
        renumber(screen);
        return;
      }

      el = e.target.closest('[data-step-del]');
      if (el) {
        var srow = el.closest('[data-step-row]');
        if (screen.querySelectorAll('[data-step-row]').length > 1) srow.remove();
        else srow.querySelector('textarea').value = '';
        renumber(screen);
        return;
      }

      if (e.target.closest('[data-paste-ing]')) { pasteSheet(screen, 'ing'); return; }
      if (e.target.closest('[data-paste-steps]')) { pasteSheet(screen, 'steps'); return; }

      if (e.target.closest('[data-save]')) { save(screen); return; }

      if (e.target.closest('[data-delete]')) {
        BL.confirm('Delete this recipe?', 'This cannot be undone.', 'Delete', function () {
          BL.viewBack = null;
          BL.store.remove(draft.id);
          BL.toast('Recipe deleted');
          BL.go('#/library');
        });
      }
    });

    photoInput.addEventListener('change', function () {
      var f = photoInput.files && photoInput.files[0];
      if (!f) return;
      BL.toast('Processing photo…');
      readImage(f, function (dataUrl) {
        if (!dataUrl) { BL.toast('Could not read that image'); return; }
        draft.image = dataUrl;
        var d = screen.querySelector('[data-photo]');
        var img = d.querySelector('img');
        if (!img) {
          d.insertAdjacentHTML('afterbegin', '<img alt="">');
          img = d.querySelector('img');
          d.insertAdjacentHTML('beforeend',
            '<div class="photo-actions"><button class="icon-btn" data-photo-del>' + icon('trash') + '</button></div>');
        }
        img.src = dataUrl;
      });
    });

    screen.addEventListener('input', function (e) {
      if (e.target.matches('textarea[data-step-input]')) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight + 2, 400) + 'px';
      }
    });

    Array.prototype.forEach.call(screen.querySelectorAll('textarea[data-step-input]'), function (t) {
      t.style.height = 'auto';
      t.style.height = Math.min(t.scrollHeight + 2, 400) + 'px';
    });
  }

  function save(screen) {
    var r = collect(screen);
    if (!r.title) { BL.toast('Give it a name first'); var t = screen.querySelector('#f-title'); if (t) t.focus(); return; }
    BL.viewBack = null;
    BL.store.put(r);
    BL.native.vibrate(16);
    BL.toast('Saved to your recipe box');
    BL.go('#/recipe/' + r.id, true);
  }

  function pasteSheet(screen, kind) {
    BL.sheet(
      '<h2 class="h1">Paste ' + (kind === 'ing' ? 'ingredients' : 'steps') + '</h2>' +
      '<p class="hint" style="margin:0 0 14px">One per line. Butterleaf will split and tidy them.</p>' +
      '<textarea class="field" id="paste-box" rows="8" placeholder="' +
        (kind === 'ing' ? '2 cups flour&#10;1 tsp salt&#10;300 g water' : 'Mix the dry ingredients.&#10;Add the water and rest 30 minutes.') +
      '"></textarea><div style="height:14px"></div>' +
      '<button class="btn btn-primary btn-block" data-apply>Add them</button>',
      function (s) {
        var box = s.querySelector('#paste-box');
        setTimeout(function () { box.focus(); }, 250);
        s.querySelector('[data-apply]').onclick = function () {
          var lines = box.value.split(/\n+/).map(function (l) {
            return l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
          }).filter(Boolean);
          if (!lines.length) { BL.closeSheet(); return; }
          if (kind === 'ing') {
            var list = screen.querySelector('#ing-list');
            var firstInput = list.querySelector('input');
            if (firstInput && !firstInput.value.trim()) firstInput.closest('[data-ing-row]').remove();
            lines.forEach(function (l) {
              if (BL.parse.looksLikeHeading(l)) {
                list.insertAdjacentHTML('beforeend',
                  sectionRow({ id: BL.uid(), section: true, name: BL.parse.tidyHeading(l) }));
              } else {
                list.insertAdjacentHTML('beforeend', ingRow({ id: BL.uid(), raw: l }));
              }
            });
          } else {
            var slist = screen.querySelector('#step-list');
            var firstTa = slist.querySelector('textarea');
            if (firstTa && !firstTa.value.trim()) firstTa.closest('[data-step-row]').remove();
            lines.forEach(function (l, i) {
              slist.insertAdjacentHTML('beforeend', stepRow({ id: BL.uid(), text: l }, i));
            });
            renumber(screen);
            Array.prototype.forEach.call(slist.querySelectorAll('textarea'), function (t) {
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight + 2, 400) + 'px';
            });
          }
          BL.closeSheet();
          BL.toast(lines.length + ' lines added');
        };
      }
    );
  }

  BL.route('new', function (screen) { openEditor(screen, blank(), true); });

  BL.route('edit', function (screen, id) {
    var r = BL.store.get(id);
    if (!r) { BL.go('#/library', true); return; }
    openEditor(screen, r, false);
  });

  /* ------------------------------------------------------- import */

  var importState = { busy: false, url: '', result: null, error: '' };

  BL.route('import', function (screen) {
    if (BL.pendingSharedUrl) {
      importState = { busy: false, url: BL.pendingSharedUrl, result: null, error: '' };
      BL.pendingSharedUrl = null;
      setTimeout(function () { runImport(screen); }, 60);
    }
    screen.innerHTML = importHtml();
    wireImport(screen);
  });

  function importHtml() {
    var s = importState;
    var html = '<div class="view">' +
      '<div class="topbar sub">' +
        '<button class="icon-btn ghost" data-back>' + icon('back') + '</button>' +
        '<h1 class="h1" style="flex:1;text-align:center">Import</h1>' +
        '<span style="width:40px"></span>' +
      '</div>' +
      '<div class="pad" style="padding-top:10px">' +
        '<p class="body" style="margin:0 0 20px">Paste a link to any recipe page. Butterleaf reads the page, ' +
        'pulls out the ingredients and method, and drops it into your box — ready to edit.</p>' +
        '<label class="label">Recipe URL</label>' +
        '<input class="field" id="imp-url" placeholder="https://…" inputmode="url" autocomplete="off" value="' + esc(s.url) + '">' +
        '<div style="height:16px"></div>' +
        '<button class="btn btn-primary btn-block" data-run' + (s.busy ? ' disabled' : '') + '>' +
          (s.busy ? 'Reading the page…' : 'Fetch recipe') + '</button>';

    if (s.busy) {
      html += '<div style="display:flex;justify-content:center;padding:34px"><div class="spinner"></div></div>';
    }

    if (s.error) {
      html += '<div class="card" style="margin-top:22px;padding:18px">' +
        '<div class="kicker" style="color:var(--accent);margin-bottom:8px">Could not import</div>' +
        '<p class="body" style="margin:0 0 14px">' + esc(s.error) + '</p>' +
        '<button class="btn btn-ghost btn-block" data-manual>Paste the recipe text instead</button></div>';
    }

    if (s.result) {
      var r = s.result;
      html += '<div class="card" style="margin-top:24px">' +
        (r.imageUrl ? '<div style="aspect-ratio:16/10;overflow:hidden"><img src="' + esc(r.imageUrl) +
          '" style="width:100%;height:100%;object-fit:cover" alt=""></div>' : '') +
        '<div style="padding:18px">' +
          '<div class="kicker" style="margin-bottom:8px">' + esc(r.sourceName) + '</div>' +
          '<h2 class="h1" style="margin-bottom:8px">' + esc(r.title) + '</h2>' +
          '<p class="meta">' + r.ingredientLines.length + ' ingredients · ' + r.steps.length + ' steps' +
            (r.totalMin ? ' · ' + BL.fmtMins(r.totalMin) : '') + '</p>' +
          '<div style="height:16px"></div>' +
          '<button class="btn btn-primary btn-block" data-save-import>Save to my recipe box</button>' +
          '<div style="height:10px"></div>' +
          '<button class="btn btn-ghost btn-block" data-edit-import>Review and edit first</button>' +
        '</div></div>';
    }

    html += '</div>' +
      '<div class="section-head"><h2 class="h2">Other ways in</h2></div>' +
      '<div class="pad">' +
        '<button class="tile" data-manual><span class="ti">' + icon('note') + '</span>' +
          '<span class="grow"><div class="tt">Paste recipe text</div>' +
          '<div class="ts">For sites that block readers, or a photo you typed up</div></span></button>' +
        '<button class="tile" data-blank><span class="ti">' + icon('edit') + '</span>' +
          '<span class="grow"><div class="tt">Start from blank</div></span></button>' +
      '</div>' +
      '<p class="hint" style="padding:14px 20px 30px">Tip: in your browser, use Share → Butterleaf on any recipe page and it lands here automatically.</p>' +
      '</div>';
    return html;
  }

  function wireImport(screen) {
    screen.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { BL.back(); return; }
      if (e.target.closest('[data-run]')) { runImport(screen); return; }
      if (e.target.closest('[data-manual]')) { manualSheet(); return; }
      if (e.target.closest('[data-blank]')) { BL.go('#/new'); return; }
      if (e.target.closest('[data-save-import]')) { commitImport(false); return; }
      if (e.target.closest('[data-edit-import]')) { commitImport(true); return; }
    });
    var input = screen.querySelector('#imp-url');
    if (input) {
      input.addEventListener('input', function () { importState.url = input.value; });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); runImport(screen); }
      });
    }
  }

  function runImport(screen) {
    var url = (importState.url || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      if (/^[\w.-]+\.\w{2,}/.test(url)) url = 'https://' + url;
      else { BL.toast('Paste a full recipe link first'); return; }
    }
    importState.url = url;
    importState.busy = true;
    importState.error = '';
    importState.result = null;
    BL.render();

    BL.native.fetchUrl(url).then(function (res) {
      importState.busy = false;
      if (!res || !res.ok || !res.html) {
        importState.error = res && res.status
          ? 'That site answered with an error (' + res.status + '). Some sites block apps from reading their pages.'
          : 'Could not reach that page. Check your connection, or paste the recipe text instead.';
        BL.render();
        return;
      }
      var parsed = null;
      try { parsed = BL.parse.extract(res.html, res.finalUrl || url); } catch (e) { parsed = null; }
      if (!parsed) {
        importState.error = 'No recipe markup found on that page. You can paste the text instead and Butterleaf will sort it out.';
      } else {
        importState.result = parsed;
      }
      BL.render();
    });
  }

  function draftFromParsed(p) {
    var d = blank();
    d.title = p.title;
    d.description = p.description;
    d.yield = p.yield;
    d.prepMin = p.prepMin;
    d.cookMin = p.cookMin;
    d.totalMin = p.totalMin;
    d.tags = p.tags || [];
    d.sourceUrl = p.sourceUrl;
    d.sourceName = p.sourceName;
    d.ingredients = p.ingredientLines.map(function (entry) {
      var line = typeof entry === 'string' ? entry : entry.text;
      var group = typeof entry === 'string' ? '' : (entry.group || '');
      var parsed = U.parseIngredient(line);
      return { id: BL.uid(), raw: line, qty: parsed.qty, qtyMax: parsed.qtyMax,
        unit: parsed.unit, item: parsed.item, note: parsed.note, group: group };
    });
    d.steps = p.steps.map(function (s) {
      return { id: BL.uid(), text: s.text, group: s.group || '', minutes: BL.parse.stepMinutes(s.text) };
    });
    if (!d.ingredients.length) d.ingredients = [{ id: BL.uid(), raw: '' }];
    if (!d.steps.length) d.steps = [{ id: BL.uid(), text: '' }];
    return d;
  }

  function commitImport(thenEdit) {
    var p = importState.result;
    if (!p) return;
    var d = draftFromParsed(p);
    BL.store.put(d);
    importState = { busy: false, url: '', result: null, error: '' };

    if (p.imageUrl) {
      BL.toast('Saved — fetching the photo…');
      BL.native.fetchImage(p.imageUrl).then(function (dataUrl) {
        var saved = BL.store.get(d.id);
        if (!saved) return;
        saved.image = dataUrl || p.imageUrl;
        BL.store.put(saved);
        if (location.hash.indexOf(d.id) !== -1) BL.render();
      });
    } else {
      BL.toast('Saved to your recipe box');
    }

    BL.go(thenEdit ? '#/edit/' + d.id : '#/recipe/' + d.id, true);
  }

  /* --------------------------------------------- paste-text import */

  function manualSheet() {
    BL.sheet(
      '<h2 class="h1">Paste recipe text</h2>' +
      '<p class="hint" style="margin:0 0 14px">Paste the whole thing — title, ingredients, method. ' +
      'Butterleaf splits it where it sees an "Instructions" or "Method" heading.</p>' +
      '<textarea class="field" id="manual-box" rows="10" placeholder="Honey oat loaf&#10;&#10;Ingredients&#10;400 g bread flour&#10;…&#10;&#10;Method&#10;1. Mix…"></textarea>' +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-primary btn-block" data-apply>Create recipe</button>',
      function (s) {
        var box = s.querySelector('#manual-box');
        setTimeout(function () { box.focus(); }, 250);
        s.querySelector('[data-apply]').onclick = function () {
          var d = fromPlainText(box.value);
          if (!d) { BL.toast('Nothing to import there'); return; }
          BL.closeSheet();
          BL.store.put(d);
          BL.go('#/edit/' + d.id, true);
        };
      }
    );
  }

  function fromPlainText(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); });
    if (!lines.filter(Boolean).length) return null;

    var d = blank();
    var ing = [], steps = [];
    var mode = 'ing';
    var group = '';
    var titleFound = false;

    lines.forEach(function (line) {
      if (!line) return;
      var lower = line.toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (!titleFound && !/^ingredient/.test(lower)) {
        d.title = line.replace(/^#+\s*/, '');
        titleFound = true;
        return;
      }
      if (/^(ingredients?|you will need|what you need)$/.test(lower)) { mode = 'ing'; return; }
      if (/^(instructions?|method|directions?|steps|to make|preparation)$/.test(lower)) { mode = 'steps'; return; }

      var clean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
      if (!clean) return;

      if (mode === 'ing') {
        // a long sentence in the ingredients block is probably a step
        if (clean.length > 140 && /\.\s|\.$/.test(clean)) { steps.push(clean); mode = 'steps'; }
        else if (BL.parse.looksLikeHeading(clean)) group = BL.parse.tidyHeading(clean);
        else ing.push({ text: clean, group: group });
      } else {
        steps.push(clean);
      }
    });

    d.ingredients = ing.map(function (entry) {
      var p = U.parseIngredient(entry.text);
      return { id: BL.uid(), raw: entry.text, qty: p.qty, qtyMax: p.qtyMax, unit: p.unit,
        item: p.item, note: p.note, group: entry.group || '' };
    });
    d.steps = steps.map(function (t) {
      return { id: BL.uid(), text: t, minutes: BL.parse.stepMinutes(t) };
    });
    if (!d.ingredients.length) d.ingredients = [{ id: BL.uid(), raw: '' }];
    if (!d.steps.length) d.steps = [{ id: BL.uid(), text: '' }];
    if (!d.title) d.title = 'Untitled recipe';
    return d;
  }

  BL.fromPlainText = fromPlainText;
})(window.BL = window.BL || {});
