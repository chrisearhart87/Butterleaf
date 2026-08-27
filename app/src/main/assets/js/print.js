/* ============================================================
   Butterleaf — the printable recipe card

   Builds a standalone A4 page and hands it to Android's print
   stack, which is also where "Save as PDF" lives. Everything is
   inline: the print WebView has no access to our stylesheet.
   ============================================================ */
(function (BL) {
  'use strict';

  var esc = BL.esc;

  var CSS =
    '@page{size:A4;margin:18mm 16mm}' +
    '*{box-sizing:border-box}' +
    'body{margin:0;font:13px/1.62 Georgia,"Times New Roman",serif;color:#14100d;background:#fff}' +
    '.kick{font:10px/1 Helvetica,Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#8f877e;margin-bottom:10px}' +
    'h1{font-size:31px;line-height:1.12;margin:0 0 8px;font-weight:400}' +
    '.src{font:11px/1.4 Helvetica,Arial,sans-serif;color:#8f877e;margin:0 0 16px}' +
    '.desc{margin:0 0 18px;color:#554e47;font-style:italic}' +
    '.rule{border:0;border-top:1px solid #14100d;margin:0 0 16px}' +
    '.hair{border:0;border-top:1px solid #e9e3da;margin:20px 0 16px}' +
    '.facts{display:flex;gap:26px;margin:0 0 20px;padding:0;list-style:none;' +
      'font:11px/1.5 Helvetica,Arial,sans-serif}' +
    '.facts b{display:block;font:15px/1.3 Georgia,serif;font-weight:400;color:#14100d}' +
    '.facts span{letter-spacing:.14em;text-transform:uppercase;color:#8f877e}' +
    '.cols{display:flex;gap:26px;align-items:flex-start}' +
    '.ing{flex:0 0 37%}' +
    '.method{flex:1}' +
    'h2{font:10px/1 Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;' +
      'color:#8f877e;margin:0 0 12px;font-weight:600}' +
    '.grp{font:10px/1 Helvetica,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;' +
      'color:#c21e4f;margin:16px 0 8px}' +
    '.grp:first-child{margin-top:0}' +
    'ul.i{margin:0;padding:0;list-style:none}' +
    'ul.i li{padding:0 0 7px 14px;text-indent:-14px}' +
    'ul.i li:before{content:"·";padding-right:8px;color:#c21e4f}' +
    'ol.s{margin:0;padding:0;list-style:none;counter-reset:s}' +
    'ol.s li{counter-increment:s;position:relative;padding:0 0 13px 30px;break-inside:avoid}' +
    'ol.s li:before{content:counter(s);position:absolute;left:0;top:1px;' +
      'font:10px/18px Helvetica,Arial,sans-serif;width:18px;height:18px;text-align:center;' +
      'border:1px solid #e9e3da;border-radius:50%;color:#8f877e}' +
    '.notes{margin-top:18px;padding:12px 14px;background:#f7f4ef;border-left:2px solid #c21e4f;' +
      'break-inside:avoid;white-space:pre-wrap}' +
    '.foot{margin-top:26px;padding-top:10px;border-top:1px solid #e9e3da;' +
      'font:10px/1.5 Helvetica,Arial,sans-serif;color:#8f877e;display:flex;justify-content:space-between}';

  function fact(v, k) {
    return v ? '<li><b>' + esc(v) + '</b><span>' + esc(k) + '</span></li>' : '';
  }

  function ingredientHtml(r, scale, system) {
    var group = '';
    var out = '';
    (r.ingredients || []).forEach(function (ing) {
      if (ing.group && ing.group !== group) {
        group = ing.group;
        out += (out ? '</ul>' : '') + '<div class="grp">' + esc(group) + '</div><ul class="i">';
      } else if (!out) {
        out += '<ul class="i">';
      }
      var line;
      if (ing.qty == null) {
        line = esc(ing.raw || ing.item);
      } else {
        var d = BL.units.display(ing.qty * scale, ing.unit, ing.item, system);
        line = (d.qty ? '<b style="font-weight:400;color:#c21e4f">' +
          esc(d.qty + (d.unit ? ' ' + d.unit : '')) + '</b> ' : '') +
          esc(ing.item || ing.raw) +
          (ing.note ? ', <i>' + esc(ing.note) + '</i>' : '');
      }
      out += '<li>' + line + '</li>';
    });
    return out ? out + '</ul>' : '<p style="color:#8f877e">No ingredients listed.</p>';
  }

  function stepsHtml(r) {
    var group = '';
    var out = '';
    (r.steps || []).forEach(function (s) {
      if (!s || !s.text) return;
      if (s.group && s.group !== group) {
        group = s.group;
        out += (out ? '</ol>' : '') + '<div class="grp">' + esc(group) + '</div><ol class="s">';
      } else if (!out) {
        out += '<ol class="s">';
      }
      out += '<li>' + esc(s.text) + '</li>';
    });
    return out ? out + '</ol>' : '<p style="color:#8f877e">No method written.</p>';
  }

  /**
   * @param opts.scale  batch multiplier to bake into the card (default 1)
   * @param opts.system 'original' | 'metric' | 'us'
   */
  BL.recipeCardHtml = function (r, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var system = opts.system || 'original';
    var total = r.totalMin || ((r.prepMin || 0) + (r.cookMin || 0)) || null;

    var yieldText = r.yield || '';
    if (yieldText && scale !== 1) {
      var m = String(yieldText).match(/([\d.]+)/);
      if (m) yieldText = String(yieldText).replace(m[1], BL.units.fraction(parseFloat(m[1]) * scale));
    }

    var log = BL.store.bakeLog(r.id);
    var recent = log.filter(function (n) { return n.text; }).slice(0, 3);

    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>' + esc(r.title) + '</title><style>' + CSS + '</style></head><body>' +
      '<div class="kick">Butterleaf' + (scale !== 1 ? ' · ' + scale + '× batch' : '') + '</div>' +
      '<h1>' + esc(r.title) + '</h1>' +
      (r.sourceName ? '<p class="src">' + esc(r.sourceName) +
        (r.sourceUrl ? ' — ' + esc(r.sourceUrl) : '') + '</p>' : '') +
      '<hr class="rule">' +
      (r.description ? '<p class="desc">' + esc(r.description) + '</p>' : '') +
      (r.prepMin || r.cookMin || total || yieldText
        ? '<ul class="facts">' +
            fact(r.prepMin ? BL.fmtShort(r.prepMin) : '', 'Prep') +
            fact(r.cookMin ? BL.fmtShort(r.cookMin) : '', 'Bake') +
            fact(total ? BL.fmtShort(total) : '', 'Total') +
            fact(yieldText, 'Makes') +
          '</ul>'
        : '') +
      '<div class="cols">' +
        '<div class="ing"><h2>Ingredients</h2>' + ingredientHtml(r, scale, system) + '</div>' +
        '<div class="method"><h2>Method</h2>' + stepsHtml(r) + '</div>' +
      '</div>' +
      (r.notes ? '<div class="notes"><b>Notes</b><br>' + esc(r.notes) + '</div>' : '') +
      (recent.length
        ? '<hr class="hair"><h2>From the bake log</h2>' +
          recent.map(function (n) {
            return '<p style="margin:0 0 8px"><b style="font-weight:400;color:#8f877e">' +
              esc(new Date(n.at).toLocaleDateString(undefined,
                { day: 'numeric', month: 'short', year: 'numeric' })) + '</b> — ' + esc(n.text) + '</p>';
          }).join('')
        : '') +
      '<div class="foot"><span>' + esc(r.title) + '</span>' +
      '<span>' + (r.bakes ? 'Baked ' + r.bakes + (r.bakes === 1 ? ' time' : ' times') + ' · ' : '') +
      'Butterleaf</span></div>' +
      '</body></html>';
  };

  BL.printRecipe = function (r, opts) {
    var html = BL.recipeCardHtml(r, opts);
    var ok = BL.native.printHtml(html, r.title);
    if (!ok) BL.toast('Printing is not available here');
  };
})(window.BL = window.BL || {});
