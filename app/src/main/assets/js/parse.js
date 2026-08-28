/* ============================================================
   Butterleaf — recipe extraction
   Pulls a clean recipe out of a web page: schema.org JSON-LD
   first, then microdata, then a best-effort DOM sweep.
   ============================================================ */
(function (BL) {
  'use strict';

  function decode(s) {
    if (s == null) return '';
    var t = document.createElement('textarea');
    t.innerHTML = String(s);
    return t.value;
  }

  function stripTags(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.innerHTML = String(s);
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function clean(s) {
    return stripTags(decode(s)).replace(/ /g, ' ').trim();
  }

  /** "PT1H25M" -> 85 (minutes) */
  function isoMinutes(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    var s = String(v).trim();
    var m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (m && (m[1] || m[2] || m[3])) {
      return (parseInt(m[1] || 0, 10) * 1440) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
    }
    var plain = s.match(/(\d+)\s*(hour|hr|h)/i);
    var mins = s.match(/(\d+)\s*(minute|min|m)\b/i);
    if (plain || mins) {
      return (plain ? parseInt(plain[1], 10) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
    }
    var n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }

  /** Finds a bake/rest duration inside an instruction line, in minutes. */
  function stepMinutes(text) {
    if (!text) return null;
    var s = String(text).toLowerCase();
    var re = /(\d+(?:\.\d+)?)\s*(?:(?:to|-|–|or)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?)/g;
    var best = null, m;
    while ((m = re.exec(s)) !== null) {
      var hi = parseFloat(m[2] || m[1]);
      var unit = m[3];
      var mins;
      if (/^h/.test(unit)) mins = hi * 60;
      else if (/^s/.test(unit)) mins = hi / 60;
      else mins = hi;
      if (mins >= 0.5 && mins <= 24 * 60) { best = Math.round(mins); break; }
    }
    return best;
  }


  /**
   * A step like "Preheat the oven to 350F" is a cue, not a duration — the
   * useful thing is a nudge when the oven is actually up to temperature.
   */
  function preheatInfo(text) {
    if (!text) return null;
    var s = String(text);
    if (!/\b(pre-?heat|heat the oven|heat oven)\b/i.test(s)) return null;
    var m = s.match(/(\d{2,3})\s*(?:°|deg(?:rees)?)?\s*([CF])\b/i) ||
            s.match(/(\d{2,3})\s*°/);
    var out = { minutes: 15 };
    if (m) {
      out.temp = parseInt(m[1], 10);
      out.scale = (m[2] || '').toUpperCase() || (out.temp > 200 ? 'F' : 'C');
      // A hot oven takes longer to come up than a moderate one.
      var f = out.scale === 'C' ? out.temp * 9 / 5 + 32 : out.temp;
      out.minutes = f >= 450 ? 25 : f >= 375 ? 18 : 12;
    }
    return out;
  }

  /** Every distinct duration mentioned in a step, in minutes, in order. */
  function allMinutes(text) {
    if (!text) return [];
    var s = String(text).toLowerCase();
    var re = /(\d+(?:\.\d+)?)\s*(?:(?:to|-|\u2013|or)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?)/g;
    var out = [], m;
    while ((m = re.exec(s)) !== null) {
      var hi = parseFloat(m[2] || m[1]);
      var unit = m[3];
      var mins = /^h/.test(unit) ? hi * 60 : /^s/.test(unit) ? hi / 60 : hi;
      if (mins >= 0.5 && mins <= 24 * 60) {
        mins = Math.round(mins);
        if (out.indexOf(mins) === -1) out.push(mins);
      }
    }
    return out;
  }

  function asArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }

  function typeOf(node) {
    var t = node && (node['@type'] || node.type);
    return asArray(t).map(function (x) { return String(x).toLowerCase(); });
  }

  function findRecipeNode(json) {
    var found = null;
    (function walk(n, depth) {
      if (found || n == null || depth > 8) return;
      if (Array.isArray(n)) { n.forEach(function (x) { walk(x, depth + 1); }); return; }
      if (typeof n !== 'object') return;
      if (typeOf(n).indexOf('recipe') !== -1) { found = n; return; }
      for (var k in n) if (n.hasOwnProperty(k)) walk(n[k], depth + 1);
    })(json, 0);
    return found;
  }

  function imageFrom(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var got = imageFrom(v[i]);
        if (got) return got;
      }
      return '';
    }
    if (typeof v === 'object') return v.url || v.contentUrl || imageFrom(v['@list']) || '';
    return '';
  }

  function yieldFrom(v) {
    if (v == null) return '';
    // recipeYield is routinely ["1", "1 loaf"] — the bare number tells nobody
    // anything, so take the most descriptive entry rather than the first.
    if (Array.isArray(v)) {
      var best = '';
      v.forEach(function (x) {
        var t = clean(String(x == null ? '' : x));
        if (!t) return;
        var better = /[a-z]/i.test(t) && !/[a-z]/i.test(best);
        if (!best || better || (/[a-z]/i.test(t) === /[a-z]/i.test(best) && t.length > best.length)) best = t;
      });
      return best;
    }
    return clean(String(v));
  }

  function instructionsFrom(v) {
    var out = [];
    function push(text, group) {
      var t = clean(text);
      if (!t) return;
      out.push({ text: t, group: group });
    }
    (function walk(n, group) {
      if (n == null) return;
      if (typeof n === 'string') {
        var s = decode(n);
        if (/<(li|p|br)\b/i.test(s)) {
          var d = document.createElement('div');
          d.innerHTML = s;
          var items = d.querySelectorAll('li, p');
          if (items.length) {
            Array.prototype.forEach.call(items, function (el) { push(el.textContent, group); });
            return;
          }
        }
        // plain multi-line string
        var lines = clean(s).split(/\n+/);
        if (lines.length > 1) lines.forEach(function (l) { push(l, group); });
        else push(s, group);
        return;
      }
      if (Array.isArray(n)) { n.forEach(function (x) { walk(x, group); }); return; }
      if (typeof n === 'object') {
        var types = typeOf(n);
        if (types.indexOf('howtosection') !== -1) {
          var gname = clean(n.name || '');
          walk(n.itemListElement || n.steps || n.item, gname);
          return;
        }
        if (n.itemListElement) { walk(n.itemListElement, group); return; }
        push(n.text || n.name || n.description || '', group);
      }
    })(v, '');

    // Sites that give real per-step items are left alone — splitting their
    // paragraphs turned a birthday cake into thirty-two "steps". Only when the
    // whole method arrived as one blob is there anything to break up.
    if (out.length === 1 && out[0].text.length > 400 && /\.\s/.test(out[0].text)) {
      var one = out[0];
      var parts = one.text.split(/(?<=\.)\s+(?=[A-Z])/)
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p.length > 2; });
      if (parts.length > 1) {
        out = parts.map(function (p) { return { text: p, group: one.group }; });
      }
    }
    return out;
  }

  function ingredientsFrom(v) {
    var out = [];
    asArray(v).forEach(function (x) {
      if (typeof x === 'string') {
        clean(x).split(/\n+/).forEach(function (line) {
          if (line.trim()) out.push(line.trim());
        });
      } else if (x && typeof x === 'object') {
        var t = clean(x.text || x.name || '');
        if (t) out.push(t);
      }
    });
    return out;
  }

  /* -------------------------------------------------- ingredient sections
     Recipes routinely use the same ingredient in more than one part of the
     bake — flour in the cake, the filling and the crumb topping. The headings
     are what keep those lines apart, so they are worth chasing hard.        */

  var HEADING_WORDS = /^(for the |for )?(cake|batter|dough|crust|base|filling|topping|crumble|crumb|streusel|frosting|icing|glaze|sauce|syrup|assembly|garnish|marinade|dressing|custard|ganache|buttercream|meringue|pastry|biscuit|scone|bread|cookie|brownie|cheesecake|wet ingredients|dry ingredients)\b/i;

  /** Does this line read as a section heading rather than an ingredient? */
  function looksLikeHeading(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 60) return false;
    if (/\d/.test(t) && !/^for the\b/i.test(t)) return false;   // amounts mean it's an ingredient
    if (/:$/.test(t)) return true;                              // "Filling:"
    if (/^for the\b/i.test(t)) return true;                     // "For the topping"
    var words = t.split(/\s+/);
    if (words.length <= 3 && HEADING_WORDS.test(t)) return true;
    return false;
  }

  /* Headings that name the list itself, or a neighbouring block, rather than a
     part of the bake. Left in, every allrecipes import grew a pointless
     "Ingredients" section and BBC Good Food imports grew a "Nutrition" one. */
  var NOT_A_SECTION = /^(ingredients?|instructions?|directions?|method|steps?|nutrition( facts| information)?|equipment|you will need|notes?|tips?|recipe|shopping list|substitutions?|storage|make ahead|variations?|ratings?|reviews?|advertisement)$/i;

  function isSectionName(text) {
    var t = String(text || '').replace(/[:\-–—]\s*$/, '').trim();
    return !!t && t.length < 60 && !NOT_A_SECTION.test(t);
  }

  function tidyHeading(text) {
    return String(text || '')
      .replace(/^for the\s+/i, '')
      .replace(/^for\s+/i, '')
      .replace(/[:\-–]\s*$/, '')
      .trim()
      .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function normKey(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Walks the ingredient block in the DOM and returns [{text, group}].
   * Handles the two big recipe plugins explicitly, then falls back to a
   * generic "heading followed by a list" sweep.
   */
  function ingredientGroupsFromDom(doc) {
    var out = [];

    // --- WP Recipe Maker: each group is its own container with a name
    var wprm = doc.querySelectorAll('.wprm-recipe-ingredient-group');
    if (wprm.length) {
      Array.prototype.forEach.call(wprm, function (g) {
        var nameEl = g.querySelector('.wprm-recipe-ingredient-group-name, .wprm-recipe-group-name, h3, h4, h5');
        var group = nameEl ? tidyHeading(clean(nameEl.textContent)) : '';
        if (!isSectionName(group)) group = '';
        Array.prototype.forEach.call(g.querySelectorAll('li'), function (li) {
          var t = clean(li.textContent);
          if (t) out.push({ text: t, group: group });
        });
      });
      if (out.length) return out;
    }

    // --- Tasty Recipes and friends: headings and lists as siblings
    var containers = doc.querySelectorAll(
      '.tasty-recipes-ingredients-body, .tasty-recipes-ingredients, [class*="recipe-ingredients" i], ' +
      '[class*="ingredients" i], [id*="ingredient" i]');

    for (var c = 0; c < containers.length && !out.length; c++) {
      var group = '';
      var walker = doc.createTreeWalker(containers[c], NodeFilter.SHOW_ELEMENT, null);
      var el;
      while ((el = walker.nextNode())) {
        var tag = el.tagName;
        if (/^H[2-6]$/.test(tag) || (tag === 'P' && el.children.length === 1 && el.children[0].tagName === 'STRONG')) {
          var h = clean(el.textContent);
          if (h && h.length < 60) group = isSectionName(h) ? tidyHeading(h) : '';
          continue;
        }
        if (tag === 'STRONG' && el.parentElement && el.parentElement.tagName === 'P' &&
            clean(el.parentElement.textContent) === clean(el.textContent)) {
          continue; // handled by the P branch above
        }
        if (tag === 'LI') {
          if (el.querySelector('li')) continue;              // nested list wrapper
          var t = clean(el.textContent);
          if (t && t.length < 220) out.push({ text: t, group: group });
        }
      }
      // a single unnamed group tells us nothing — keep looking
      if (out.length && !out.some(function (x) { return x.group; })) out = [];
    }

    return out;
  }

  /**
   * Attaches DOM-derived section names to the (usually cleaner) JSON-LD lines,
   * and promotes any heading lines that JSON-LD included inline.
   */
  function applyGroups(lines, domItems) {
    // headings that arrived inside the JSON-LD list itself
    var promoted = [];
    var current = '';
    var sawInline = false;
    lines.forEach(function (line) {
      if (looksLikeHeading(line)) {
        current = tidyHeading(line);
        sawInline = true;
        return;
      }
      promoted.push({ text: line, group: current });
    });
    if (sawInline && promoted.length) return promoted;

    if (!domItems.length) return lines.map(function (l) { return { text: l, group: '' }; });

    var domGroups = {};
    domItems.forEach(function (d) {
      var k = normKey(d.text);
      if (k && !(k in domGroups)) domGroups[k] = d.group || '';
    });

    var matched = 0;
    var merged = lines.map(function (l) {
      var k = normKey(l);
      var g = domGroups[k];
      if (g === undefined) {
        // try a looser containment match — plugins often append notes
        for (var key in domGroups) {
          if (key.length > 6 && (key.indexOf(k) === 0 || k.indexOf(key) === 0)) { g = domGroups[key]; break; }
        }
      }
      if (g !== undefined) matched++;
      return { text: l, group: g || '' };
    });

    var named = merged.filter(function (m) { return m.group; }).length;
    if (matched >= lines.length * 0.5 && named) return merged;

    // JSON-LD and the DOM disagree — trust the DOM, it has the sections
    var domNamed = domItems.filter(function (d) { return d.group; }).length;
    if (domNamed && domItems.length >= lines.length) return domItems;

    return lines.map(function (l) { return { text: l, group: '' }; });
  }

  function fromJsonLd(doc) {
    var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      var raw = scripts[i].textContent;
      if (!raw) continue;
      var json = null;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        try {
          json = JSON.parse(raw.replace(/[ -]+/g, ' ').replace(/,\s*([}\]])/g, '$1'));
        } catch (e2) { continue; }
      }
      var node = findRecipeNode(json);
      if (node) return node;
    }
    return null;
  }

  function fromMicrodata(doc) {
    var scope = doc.querySelector('[itemtype*="schema.org/Recipe" i]');
    if (!scope) return null;
    function prop(name, all) {
      var sel = '[itemprop="' + name + '" i]';
      if (all) return Array.prototype.slice.call(scope.querySelectorAll(sel));
      return scope.querySelector(sel);
    }
    function val(el) {
      if (!el) return '';
      if (el.hasAttribute('content')) return el.getAttribute('content');
      if (el.tagName === 'IMG') return el.getAttribute('src') || '';
      if (el.tagName === 'TIME' && el.hasAttribute('datetime')) return el.getAttribute('datetime');
      if (el.tagName === 'META') return el.getAttribute('content') || '';
      return el.textContent || '';
    }
    var node = {
      name: clean(val(prop('name'))),
      description: clean(val(prop('description'))),
      image: val(prop('image')),
      recipeYield: clean(val(prop('recipeYield'))),
      prepTime: val(prop('prepTime')),
      cookTime: val(prop('cookTime')),
      totalTime: val(prop('totalTime')),
      recipeIngredient: prop('recipeIngredient', true).concat(prop('ingredients', true)).map(val),
      recipeInstructions: prop('recipeInstructions', true).map(val)
    };
    return node.name || node.recipeIngredient.length ? node : null;
  }

  function fromHeuristics(doc) {
    var ing = [];
    var sels = [
      '[class*="ingredient" i] li', '[id*="ingredient" i] li',
      'ul[class*="ingredient" i] li', '[class*="wprm-recipe-ingredient" i]',
      '[class*="tasty-recipes-ingredients" i] li'
    ];
    for (var i = 0; i < sels.length && ing.length < 3; i++) {
      ing = Array.prototype.slice.call(doc.querySelectorAll(sels[i]))
        .map(function (el) { return clean(el.textContent); })
        .filter(function (t) { return t && t.length < 200; });
    }
    var steps = [];
    var ssels = [
      '[class*="instruction" i] li', '[id*="instruction" i] li',
      '[class*="direction" i] li', '[class*="method" i] li',
      '[class*="wprm-recipe-instruction" i]', '[class*="tasty-recipes-instructions" i] li'
    ];
    for (var j = 0; j < ssels.length && steps.length < 2; j++) {
      steps = Array.prototype.slice.call(doc.querySelectorAll(ssels[j]))
        .map(function (el) { return clean(el.textContent); })
        .filter(function (t) { return t && t.length > 3; });
    }
    if (!ing.length && !steps.length) return null;
    var titleEl = doc.querySelector('h1') || doc.querySelector('title');
    var ogImg = doc.querySelector('meta[property="og:image"]');
    var ogDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    return {
      name: titleEl ? clean(titleEl.textContent || titleEl.content) : '',
      description: ogDesc ? clean(ogDesc.getAttribute('content')) : '',
      image: ogImg ? ogImg.getAttribute('content') : '',
      recipeIngredient: ing,
      recipeInstructions: steps
    };
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function absolutise(src, base) {
    if (!src) return '';
    try { return new URL(src, base).href; } catch (e) { return src; }
  }

  /**
   * @param {string} html raw page source
   * @param {string} url  the page's URL
   * @returns {object|null} a draft recipe ready for the editor
   */
  function extract(html, url) {
    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) { return null; }

    var node = fromJsonLd(doc) || fromMicrodata(doc) || fromHeuristics(doc);
    if (!node) return null;

    var rawIngredients = ingredientsFrom(node.recipeIngredient || node.ingredients);
    var domItems = [];
    try { domItems = ingredientGroupsFromDom(doc); } catch (e) { domItems = []; }
    if (!rawIngredients.length && domItems.length) {
      rawIngredients = domItems.map(function (d) { return d.text; });
    }
    var ingredients = applyGroups(rawIngredients, domItems);
    var steps = instructionsFrom(node.recipeInstructions);
    if (!ingredients.length && !steps.length) return null;

    var prep = isoMinutes(node.prepTime);
    var cook = isoMinutes(node.cookTime);
    var total = isoMinutes(node.totalTime);
    if (!total && (prep || cook)) total = (prep || 0) + (cook || 0);

    var img = absolutise(imageFrom(node.image), url);
    if (!img) {
      // Structured data often omits the photo even when the page has one.
      var og = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
      if (og) img = absolutise(og.getAttribute('content') || '', url);
    }
    var title = clean(node.name) || clean((doc.querySelector('h1') || {}).textContent) || 'Untitled recipe';
    title = title.replace(/\s*[|–—-]\s*[^|–—-]{0,40}$/, function (m) {
      // trim trailing " | Site Name" style suffixes only when they look like branding
      return /recipe|kitchen|baking|food|blog|\.com/i.test(m) ? '' : m;
    }).trim();

    var tags = [];
    ['recipeCategory', 'recipeCuisine', 'keywords'].forEach(function (k) {
      asArray(node[k]).forEach(function (t) {
        String(clean(t)).split(/,\s*/).forEach(function (piece) {
          var p = piece.trim();
          if (p && p.length < 26 && tags.length < 8 &&
              tags.map(function (x) { return x.toLowerCase(); }).indexOf(p.toLowerCase()) === -1) {
            tags.push(p);
          }
        });
      });
    });

    return {
      title: title,
      description: clean(node.description).slice(0, 600),
      imageUrl: img,
      yield: yieldFrom(node.recipeYield),
      prepMin: prep || null,
      cookMin: cook || null,
      totalMin: total || null,
      ingredientLines: ingredients,
      steps: steps,
      tags: tags,
      sourceUrl: url,
      sourceName: hostOf(url)
    };
  }

  BL.parse = {
    extract: extract,
    looksLikeHeading: looksLikeHeading,
    tidyHeading: tidyHeading,
    isoMinutes: isoMinutes,
    stepMinutes: stepMinutes,
    preheatInfo: preheatInfo,
    allMinutes: allMinutes,
    clean: clean,
    hostOf: hostOf
  };
})(window.BL = window.BL || {});
