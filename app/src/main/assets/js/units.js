/* ============================================================
   Butterleaf — measurement engine
   Quantity parsing, pretty fractions, and baking-grade
   volume <-> weight conversion using ingredient densities.
   ============================================================ */
(function (BL) {
  'use strict';

  /* ---------------------------------------------------------- units */

  // ml values are US customary. Weight in grams.
  var UNITS = [
    { id: 'tsp',   type: 'vol',  ml: 4.92892,  abbr: 'tsp',   one: 'teaspoon',   many: 'teaspoons',
      names: ['tsp', 'tsps', 't', 'teaspoon', 'teaspoons', 'teaspoonful'] },
    { id: 'tbsp',  type: 'vol',  ml: 14.78676, abbr: 'tbsp',  one: 'tablespoon', many: 'tablespoons',
      names: ['tbsp', 'tbsps', 'tbs', 'tb', 'T', 'tablespoon', 'tablespoons'] },
    { id: 'floz',  type: 'vol',  ml: 29.5735,  abbr: 'fl oz', one: 'fluid ounce', many: 'fluid ounces',
      names: ['fl oz', 'floz', 'fl. oz.', 'fluid ounce', 'fluid ounces'] },
    { id: 'cup',   type: 'vol',  ml: 236.588,  abbr: 'cup',   one: 'cup',        many: 'cups',
      names: ['cup', 'cups', 'c'] },
    { id: 'pint',  type: 'vol',  ml: 473.176,  abbr: 'pint',  one: 'pint',       many: 'pints',
      names: ['pint', 'pints', 'pt'] },
    { id: 'quart', type: 'vol',  ml: 946.353,  abbr: 'quart', one: 'quart',      many: 'quarts',
      names: ['quart', 'quarts', 'qt'] },
    { id: 'gal',   type: 'vol',  ml: 3785.41,  abbr: 'gal',   one: 'gallon',     many: 'gallons',
      names: ['gallon', 'gallons', 'gal'] },
    { id: 'ml',    type: 'vol',  ml: 1,        abbr: 'ml',    one: 'millilitre', many: 'millilitres',
      names: ['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres', 'cc'] },
    { id: 'l',     type: 'vol',  ml: 1000,     abbr: 'L',     one: 'litre',      many: 'litres',
      names: ['l', 'liter', 'litre', 'liters', 'litres'] },

    { id: 'g',     type: 'mass', g: 1,         abbr: 'g',     one: 'gram',       many: 'grams',
      names: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'] },
    { id: 'kg',    type: 'mass', g: 1000,      abbr: 'kg',    one: 'kilogram',   many: 'kilograms',
      names: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'] },
    { id: 'oz',    type: 'mass', g: 28.3495,   abbr: 'oz',    one: 'ounce',      many: 'ounces',
      names: ['oz', 'ozs', 'ounce', 'ounces'] },
    { id: 'lb',    type: 'mass', g: 453.592,   abbr: 'lb',    one: 'pound',      many: 'pounds',
      names: ['lb', 'lbs', 'pound', 'pounds', '#'] },
    { id: 'stick', type: 'mass', g: 113.4,     abbr: 'stick', one: 'stick',      many: 'sticks',
      names: ['stick', 'sticks'] },

    // countable / loose units: never converted, only scaled
    { id: 'each',   type: 'count', abbr: '',        one: '',         many: '',         names: [] },
    { id: 'clove',  type: 'count', abbr: 'clove',   one: 'clove',    many: 'cloves',   names: ['clove', 'cloves'] },
    { id: 'pinch',  type: 'count', abbr: 'pinch',   one: 'pinch',    many: 'pinches',  names: ['pinch', 'pinches'] },
    { id: 'dash',   type: 'count', abbr: 'dash',    one: 'dash',     many: 'dashes',   names: ['dash', 'dashes'] },
    { id: 'package',type: 'count', abbr: 'pkg',     one: 'package',  many: 'packages', names: ['package', 'packages', 'pkg', 'pkgs', 'packet', 'packets', 'envelope', 'envelopes'] },
    { id: 'can',    type: 'count', abbr: 'can',     one: 'can',      many: 'cans',     names: ['can', 'cans', 'tin', 'tins'] },
    { id: 'slice',  type: 'count', abbr: 'slice',   one: 'slice',    many: 'slices',   names: ['slice', 'slices'] },
    { id: 'sheet',  type: 'count', abbr: 'sheet',   one: 'sheet',    many: 'sheets',   names: ['sheet', 'sheets'] },
    { id: 'bunch',  type: 'count', abbr: 'bunch',   one: 'bunch',    many: 'bunches',  names: ['bunch', 'bunches'] },
    { id: 'handful',type: 'count', abbr: 'handful', one: 'handful',  many: 'handfuls', names: ['handful', 'handfuls'] },
    { id: 'drop',   type: 'count', abbr: 'drop',    one: 'drop',     many: 'drops',    names: ['drop', 'drops'] }
  ];

  var BY_ID = {};
  UNITS.forEach(function (u) { BY_ID[u.id] = u; });

  var NAME_MAP = {};
  UNITS.forEach(function (u) {
    u.names.forEach(function (n) { NAME_MAP[n.toLowerCase().replace(/\./g, '')] = u.id; });
    NAME_MAP[u.id] = u.id;
  });

  function unit(id) { return BY_ID[id] || null; }

  function unitLabel(id, qty) {
    var u = unit(id);
    if (!u || u.id === 'each') return '';
    if (u.type === 'count') return (Math.abs(qty) > 1 ? u.many : u.one);
    // "cup", "pint", "stick" are written out in full, so they take a plural;
    // "tsp", "g", "ml" are abbreviations and never do.
    if (u.abbr === u.one) return (Math.abs(qty) > 1 ? u.many : u.one);
    return u.abbr;
  }

  function matchUnit(word) {
    if (!word) return null;
    var w = String(word).toLowerCase().trim().replace(/\.$/, '').replace(/\./g, '');
    return NAME_MAP[w] || null;
  }

  /* ------------------------------------------------------ densities
     Grams per US cup, from King Arthur Baking's ingredient weight
     chart (with per-teaspoon figures for the small stuff). These are
     the numbers serious bakers weigh by.                            */

  var DENSITY = [
    { key: 'flour_ap',      label: 'Flour, all-purpose',      gCup: 120, match: ['all purpose flour', 'all-purpose flour', 'plain flour', 'ap flour', 'flour'] },
    { key: 'flour_bread',   label: 'Flour, bread',            gCup: 120, match: ['bread flour', 'strong flour', 'high gluten flour'] },
    { key: 'flour_cake',    label: 'Flour, cake',             gCup: 113, match: ['cake flour'] },
    { key: 'flour_pastry',  label: 'Flour, pastry',           gCup: 106, match: ['pastry flour'] },
    { key: 'flour_ww',      label: 'Flour, whole wheat',      gCup: 113, match: ['whole wheat flour', 'wholemeal flour', 'whole-wheat flour'] },
    { key: 'flour_rye',     label: 'Flour, rye',              gCup: 106, match: ['rye flour'] },
    { key: 'flour_semolina',label: 'Flour, semolina',         gCup: 163, match: ['semolina'] },
    { key: 'flour_almond',  label: 'Flour, almond',           gCup: 96,  match: ['almond flour', 'almond meal', 'ground almonds'] },
    { key: 'flour_00',      label: 'Flour, "00"',             gCup: 116, match: ['00 flour', 'tipo 00'] },
    { key: 'cornstarch',    label: 'Cornstarch',              gCup: 113, match: ['cornstarch', 'corn starch', 'cornflour'] },
    { key: 'cornmeal',      label: 'Cornmeal',                gCup: 156, match: ['cornmeal', 'polenta'] },
    { key: 'oats',          label: 'Oats, rolled',            gCup: 90,  match: ['rolled oats', 'old-fashioned oats', 'old fashioned oats', 'oats', 'oatmeal'] },

    { key: 'sugar',         label: 'Sugar, granulated',       gCup: 198, match: ['granulated sugar', 'white sugar', 'caster sugar', 'superfine sugar', 'sugar'] },
    { key: 'sugar_brown',   label: 'Sugar, brown (packed)',   gCup: 213, match: ['brown sugar', 'light brown sugar', 'dark brown sugar', 'muscovado'] },
    { key: 'sugar_powder',  label: "Sugar, confectioners'",   gCup: 113, match: ['confectioners sugar', "confectioners' sugar", 'powdered sugar', 'icing sugar'] },
    { key: 'honey',         label: 'Honey',                   gCup: 336, match: ['honey'] },
    { key: 'molasses',      label: 'Molasses',                gCup: 340, match: ['molasses', 'treacle'] },
    { key: 'maple',         label: 'Maple syrup',             gCup: 312, match: ['maple syrup'] },
    { key: 'corn_syrup',    label: 'Corn syrup',              gCup: 340, match: ['corn syrup', 'golden syrup', 'glucose syrup'] },

    { key: 'butter',        label: 'Butter',                  gCup: 227, match: ['butter', 'unsalted butter', 'salted butter'] },
    { key: 'oil',           label: 'Oil, vegetable',          gCup: 198, match: ['vegetable oil', 'canola oil', 'olive oil', 'oil'] },
    { key: 'shortening',    label: 'Shortening',              gCup: 191, match: ['shortening', 'lard', 'crisco'] },

    { key: 'water',         label: 'Water',                   gCup: 227, match: ['water'] },
    { key: 'milk',          label: 'Milk',                    gCup: 227, match: ['milk', 'whole milk', 'buttermilk', 'skim milk'] },
    { key: 'cream',         label: 'Cream, heavy',            gCup: 227, match: ['heavy cream', 'whipping cream', 'double cream', 'cream'] },
    { key: 'sour_cream',    label: 'Sour cream / yogurt',     gCup: 227, match: ['sour cream', 'yogurt', 'yoghurt', 'creme fraiche'] },
    { key: 'cream_cheese',  label: 'Cream cheese',            gCup: 227, match: ['cream cheese', 'mascarpone'] },
    { key: 'ricotta',       label: 'Ricotta',                 gCup: 227, match: ['ricotta'] },
    { key: 'cheese_grated', label: 'Cheese, grated',          gCup: 113, match: ['grated cheese', 'shredded cheese', 'parmesan', 'cheddar', 'mozzarella'] },
    { key: 'egg',           label: 'Egg, large (each 50 g)',  gCup: 243, each: 50, match: ['egg', 'eggs', 'large egg', 'large eggs'] },

    { key: 'cocoa',         label: 'Cocoa powder',            gCup: 85,  match: ['cocoa powder', 'cocoa', 'cacao powder', 'dutch process cocoa'] },
    { key: 'choc_chips',    label: 'Chocolate chips',         gCup: 170, match: ['chocolate chips', 'chocolate chunks', 'chips'] },
    { key: 'nuts',          label: 'Nuts, chopped',           gCup: 113, match: ['chopped nuts', 'walnuts', 'pecans', 'almonds', 'hazelnuts', 'nuts'] },
    { key: 'coconut',       label: 'Coconut, shredded',       gCup: 85,  match: ['shredded coconut', 'desiccated coconut', 'coconut'] },
    { key: 'raisins',       label: 'Raisins / dried fruit',   gCup: 149, match: ['raisins', 'sultanas', 'currants', 'dried cranberries', 'dried fruit'] },
    { key: 'peanut_butter', label: 'Peanut butter',           gCup: 270, match: ['peanut butter', 'almond butter', 'nut butter'] },
    { key: 'jam',           label: 'Jam / preserves',         gCup: 320, match: ['jam', 'preserves', 'jelly', 'marmalade'] },
    { key: 'pumpkin',       label: 'Pumpkin purée',           gCup: 227, match: ['pumpkin puree', 'pumpkin purée', 'applesauce', 'apple sauce'] },
    { key: 'starter',       label: 'Sourdough starter',       gCup: 227, match: ['sourdough starter', 'starter', 'levain', 'poolish', 'biga'] },

    // small stuff — teaspoon-level accuracy matters more than cups
    { key: 'salt_table',    label: 'Salt, table',             gCup: 288, gTsp: 6,   match: ['table salt', 'fine salt', 'salt', 'sea salt'] },
    { key: 'salt_kosher_d', label: 'Salt, Diamond kosher',    gCup: 128, gTsp: 2.8, match: ['diamond crystal', 'diamond kosher'] },
    { key: 'salt_kosher_m', label: "Salt, Morton kosher",     gCup: 240, gTsp: 4.8, match: ['kosher salt', 'morton kosher'] },
    { key: 'baking_powder', label: 'Baking powder',           gCup: 192, gTsp: 4,   match: ['baking powder'] },
    { key: 'baking_soda',   label: 'Baking soda',             gCup: 288, gTsp: 6,   match: ['baking soda', 'bicarbonate of soda', 'bicarb'] },
    { key: 'yeast_instant', label: 'Yeast, instant',          gCup: 149, gTsp: 3.1, match: ['instant yeast', 'rapid rise yeast', 'active dry yeast', 'dry yeast', 'yeast'] },
    { key: 'vanilla',       label: 'Vanilla extract',         gCup: 208, gTsp: 4.3, match: ['vanilla extract', 'vanilla', 'almond extract', 'extract'] },
    { key: 'cinnamon',      label: 'Spices, ground',          gCup: 132, gTsp: 2.6, match: ['cinnamon', 'nutmeg', 'ginger', 'cardamom', 'cloves ground', 'spice', 'espresso powder'] }
  ];

  var DENS_BY_KEY = {};
  DENSITY.forEach(function (d) { DENS_BY_KEY[d.key] = d; });

  /** Best-guess density record for a free-text ingredient name. */
  function densityFor(name) {
    if (!name) return null;
    var n = String(name).toLowerCase();
    var best = null, bestLen = 0;
    for (var i = 0; i < DENSITY.length; i++) {
      var d = DENSITY[i];
      for (var j = 0; j < d.match.length; j++) {
        var m = d.match[j];
        if (n.indexOf(m) !== -1 && m.length > bestLen) { best = d; bestLen = m.length; }
      }
    }
    return best;
  }

  /* ------------------------------------------------------ fractions */

  var GLYPH = {
    '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
    '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
    '1/6': '⅙', '5/6': '⅚', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘'
  };
  var UNGLYPH = {
    '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
    '⅙': 1 / 6, '⅚': 5 / 6, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 0.1
  };

  /** Renders a decimal as a cook-friendly fraction: 1.5 -> 1½ */
  function fraction(v) {
    if (v == null || isNaN(v)) return '';
    if (v === 0) return '0';
    var neg = v < 0; v = Math.abs(v);
    var whole = Math.floor(v + 1e-9);
    var rem = v - whole;
    var denoms = [2, 3, 4, 6, 8, 16];
    var bestErr = Infinity, bestN = 0, bestD = 1;
    for (var i = 0; i < denoms.length; i++) {
      var d = denoms[i];
      var n = Math.round(rem * d);
      var err = Math.abs(rem - n / d);
      if (err < bestErr - 1e-12) { bestErr = err; bestN = n; bestD = d; }
    }
    var tol = v < 1 ? 0.012 : 0.02;
    if (bestErr > tol) {
      // no clean fraction — show a tidy decimal instead
      var dec = v >= 100 ? Math.round(v) : (v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
      return (neg ? '-' : '') + String(dec);
    }
    if (bestN === bestD) { whole += 1; bestN = 0; }
    var out = '';
    if (bestN === 0) out = String(whole);
    else {
      var g = gcd(bestN, bestD); bestN /= g; bestD /= g;
      var key = bestN + '/' + bestD;
      var glyph = GLYPH[key];
      // "1½" is unambiguous, but "1" + "1/16" would read as eleven sixteenths
      if (glyph) out = whole > 0 ? (whole + glyph) : glyph;
      else out = whole > 0 ? (whole + ' ' + key) : key;
    }
    return (neg ? '-' : '') + out;
  }

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  /** Rounds a metric weight/volume the way a baker would write it. */
  function metricRound(v) {
    if (v == null || isNaN(v)) return '';
    if (v >= 1000) return String(Math.round(v / 10) * 10);
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return String(Math.round(v * 2) / 2);
    if (v >= 1) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 100) / 100);
  }

  /* ------------------------------------------------- text parsing */

  var NUM_WORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5, quarter: 0.25
  };

  function parseNumber(tok) {
    if (tok == null) return null;
    var s = String(tok).trim();
    if (!s) return null;
    // unicode fraction glyphs, possibly attached to a whole number (1½)
    var glyphMatch = s.match(/^(\d*)\s*([¼-¾⅐-⅞])$/);
    if (glyphMatch) {
      var w = glyphMatch[1] ? parseInt(glyphMatch[1], 10) : 0;
      return w + (UNGLYPH[glyphMatch[2]] || 0);
    }
    // mixed number: 1 1/2  or 1-1/2
    var mixed = s.match(/^(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
    var frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
    var dec = s.match(/^\d*\.?\d+$/);
    if (dec) return parseFloat(s);
    var word = NUM_WORDS[s.toLowerCase()];
    if (word != null) return word;
    return null;
  }

  /**
   * Parses "1 1/2 cups all-purpose flour, sifted" into structured parts.
   * Returns { qty, qtyMax, unit, item, note, raw }.
   */
  function parseIngredient(line) {
    var raw = String(line || '').replace(/\s+/g, ' ').trim();
    var out = { raw: raw, qty: null, qtyMax: null, unit: null, item: raw, note: '' };
    if (!raw) return out;

    var s = raw.replace(/^[-*•–]\s*/, '');

    // trailing note after a comma or in parentheses at the end
    var noteMatch = s.match(/,\s*([^,]{2,60})$/);
    if (noteMatch && /\b(chopped|sifted|melted|softened|room temperature|divided|packed|plus more|beaten|toasted|optional|finely|coarsely|cubed|sliced|grated|rinsed|drained|warmed|cooled|at room temp)\b/i.test(noteMatch[1])) {
      out.note = noteMatch[1].trim();
      s = s.slice(0, noteMatch.index).trim();
    }

    // leading quantity (supports ranges: 2-3, 2 to 3)
    var numRe = '(?:\\d+\\s*[-–]\\s*\\d+(?:\\s*\\/\\s*\\d+)?|\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d*\\.?\\d+|[¼-¾⅐-⅞]|\\d+\\s*[¼-¾⅐-⅞])';
    var m = s.match(new RegExp('^(' + numRe + ')\\s*(?:to|–|-)?\\s*(' + numRe + ')?\\s*(.*)$', 'i'));

    var rest = s;
    if (m) {
      var first = m[1], second = m[2];
      var q1 = parseNumber(first);
      if (q1 == null) {
        var parts = first.split(/[-–]/);
        if (parts.length === 2) { q1 = parseNumber(parts[0]); out.qtyMax = parseNumber(parts[1]); }
      }
      if (q1 != null) {
        out.qty = q1;
        if (second != null) {
          var q2 = parseNumber(second);
          if (q2 != null && q2 > q1) out.qtyMax = q2;
          else if (q2 != null) out.qty = q1 + q2; // e.g. "1 1/2" split oddly
        }
        rest = m[3] || '';
      }
    } else {
      var wordM = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozen)\s+(.*)$/i);
      if (wordM && NUM_WORDS[wordM[1].toLowerCase()] != null) {
        out.qty = NUM_WORDS[wordM[1].toLowerCase()];
        rest = wordM[2];
      }
    }

    // Everything after the note was split off — this is what the recipe
    // actually says, and it is what we fall back to when there is no amount.
    var asWritten = rest.trim();

    // unit word (allow "fl oz" two-worders)
    var two = rest.match(/^(fl\.?\s*oz\.?)\s+(.*)$/i);
    if (two) {
      out.unit = 'floz';
      rest = two[2];
    } else {
      var w = rest.match(/^([A-Za-z.]+)\b\.?\s*(.*)$/);
      if (w) {
        var uid = matchUnit(w[1]);
        if (uid) {
          out.unit = uid;
          rest = w[2];
          // "cups of flour"
          rest = rest.replace(/^of\s+/i, '');
        }
      }
    }

    // parenthetical metric hint: "1 cup (120 g) flour"
    var paren = rest.match(/^\(([^)]*)\)\s*(.*)$/);
    if (paren) {
      rest = paren[2];
      if (!out.note) out.note = paren[1].trim();
    }

    out.item = rest.trim() || raw;

    // No number anywhere? Then "pinch", "handful", "to taste" are part of the
    // ingredient, not a measurement — keep the line exactly as written.
    if (out.qty == null) {
      out.unit = null;
      out.item = asWritten || raw;
    } else if (!out.unit) {
      out.unit = 'each';
    }
    return out;
  }

  /* ---------------------------------------------------- conversion */

  /** Convert between any two units, using density when crossing vol<->mass. */
  function convert(value, fromId, toId, ingredientName) {
    var f = unit(fromId), t = unit(toId);
    if (!f || !t || value == null || isNaN(value)) return null;
    if (f.type === 'count' || t.type === 'count') return f.id === t.id ? value : null;

    if (f.type === t.type) {
      if (f.type === 'vol') return value * f.ml / t.ml;
      return value * f.g / t.g;
    }

    var d = densityFor(ingredientName);
    if (!d) return null;
    var gPerMl = d.gCup / 236.588;

    if (f.type === 'vol' && t.type === 'mass') {
      var ml = value * f.ml;
      var grams;
      if (d.gTsp && f.id === 'tsp') grams = value * d.gTsp;
      else if (d.gTsp && f.id === 'tbsp') grams = value * d.gTsp * 3;
      else grams = ml * gPerMl;
      return grams / t.g;
    }
    if (f.type === 'mass' && t.type === 'vol') {
      var g = value * f.g;
      return (g / gPerMl) / t.ml;
    }
    return null;
  }

  /** Picks a nice metric unit for an ingredient amount. */
  function toMetric(qty, unitId, itemName) {
    var u = unit(unitId);
    if (!u || qty == null) return null;
    if (u.type === 'count') return null;
    if (u.type === 'mass') {
      var g = qty * u.g;
      return g >= 1000 ? { qty: g / 1000, unit: 'kg' } : { qty: g, unit: 'g' };
    }
    var d = densityFor(itemName);
    if (d) {
      var grams = convert(qty, unitId, 'g', itemName);
      if (grams != null && grams >= 1) {
        return grams >= 1000 ? { qty: grams / 1000, unit: 'kg' } : { qty: grams, unit: 'g' };
      }
    }
    var ml = qty * u.ml;
    if (ml < 15 && (unitId === 'tsp' || unitId === 'tbsp')) return { qty: qty, unit: unitId };
    return ml >= 1000 ? { qty: ml / 1000, unit: 'l' } : { qty: ml, unit: 'ml' };
  }

  /** Picks a nice US unit for an ingredient amount. */
  function toUS(qty, unitId, itemName) {
    var u = unit(unitId);
    if (!u || qty == null) return null;
    if (u.type === 'count') return null;

    if (u.type === 'vol') {
      // Kitchen ladder, not a general-purpose one: measuring cups go down to a
      // quarter cup, so stay in cups to there and only then drop to spoons.
      // No quarts or gallons — nobody measures a bake in quarts, and "4 cups"
      // beats "1 quart" at the bench every time.
      var ml = qty * u.ml;
      if (ml >= 59) return { qty: ml / 236.588, unit: 'cup' };
      if (ml >= 14) return { qty: ml / 14.78676, unit: 'tbsp' };
      return { qty: ml / 4.92892, unit: 'tsp' };
    }

    var d = densityFor(itemName);
    if (!d) {
      var g = qty * u.g;
      return g >= 454 ? { qty: g / 453.592, unit: 'lb' } : { qty: g / 28.3495, unit: 'oz' };
    }
    var cups = convert(qty, unitId, 'cup', itemName);
    if (cups == null) return null;
    if (cups >= 0.24) return { qty: cups, unit: 'cup' };
    var tbsp = cups * 16;
    if (tbsp >= 1) return { qty: tbsp, unit: 'tbsp' };
    return { qty: tbsp * 3, unit: 'tsp' };
  }

  /** Formats a quantity + unit for display in the chosen system. */
  function display(qty, unitId, itemName, system) {
    if (qty == null) return { qty: '', unit: unitId ? unitLabel(unitId, 1) : '' };
    var u = unit(unitId) || BY_ID.each;
    var target = null;

    if (system === 'metric' && u.type !== 'count') target = toMetric(qty, unitId, itemName);
    else if (system === 'us' && u.type !== 'count') target = toUS(qty, unitId, itemName);

    var q = target ? target.qty : qty;
    var uid = target ? target.unit : unitId;
    var uu = unit(uid) || BY_ID.each;

    var text;
    if (uu.type === 'mass' && (uid === 'g' || uid === 'kg')) text = metricRound(q);
    else if (uid === 'ml' || uid === 'l') text = metricRound(q);
    else text = fraction(q);

    return { qty: text, unit: unitLabel(uid, q), unitId: uid, value: q };
  }

  /* ------------------------------------------------ oven & pans */

  var GAS_MARKS = [
    { mark: '¼', f: 225, c: 110 }, { mark: '½', f: 250, c: 130 },
    { mark: '1', f: 275, c: 140 }, { mark: '2', f: 300, c: 150 },
    { mark: '3', f: 325, c: 165 }, { mark: '4', f: 350, c: 180 },
    { mark: '5', f: 375, c: 190 }, { mark: '6', f: 400, c: 200 },
    { mark: '7', f: 425, c: 220 }, { mark: '8', f: 450, c: 230 },
    { mark: '9', f: 475, c: 240 }
  ];

  function fToC(f) { return (f - 32) * 5 / 9; }
  function cToF(c) { return c * 9 / 5 + 32; }
  function gasFor(f) {
    var best = GAS_MARKS[0], bd = Infinity;
    GAS_MARKS.forEach(function (g) {
      var d = Math.abs(g.f - f);
      if (d < bd) { bd = d; best = g; }
    });
    return bd <= 20 ? best.mark : '—';
  }

  var PANS = [
    { id: 'r8', label: '8" round', area: Math.PI * 16, depth: 2 },
    { id: 'r9', label: '9" round', area: Math.PI * 20.25, depth: 2 },
    { id: 'r10', label: '10" round', area: Math.PI * 25, depth: 2 },
    { id: 's8', label: '8" square', area: 64, depth: 2 },
    { id: 's9', label: '9" square', area: 81, depth: 2 },
    { id: 'q913', label: '9×13" pan', area: 117, depth: 2 },
    { id: 'q811', label: '8×11" pan', area: 88, depth: 2 },
    { id: 'loaf85', label: '8½×4½" loaf', area: 38.25, depth: 2.75 },
    { id: 'loaf9', label: '9×5" loaf', area: 45, depth: 2.75 },
    { id: 'bundt', label: '10" bundt (12 cup)', area: 78.5, depth: 3.5 },
    { id: 'tube', label: '9" tube pan', area: 63.6, depth: 4 },
    { id: 'sheet', label: 'Half sheet 13×18"', area: 234, depth: 1 },
    { id: 'muffin12', label: '12-cup muffin tin', area: 42, depth: 1.5 },
    { id: 'pie9', label: '9" pie plate', area: 63.6, depth: 1.5 },
    { id: 'spring9', label: '9" springform', area: 63.6, depth: 2.75 }
  ];

  BL.units = {
    UNITS: UNITS, DENSITY: DENSITY, GAS_MARKS: GAS_MARKS, PANS: PANS,
    unit: unit, unitLabel: unitLabel, matchUnit: matchUnit,
    densityFor: densityFor, densityByKey: function (k) { return DENS_BY_KEY[k]; },
    fraction: fraction, metricRound: metricRound, parseNumber: parseNumber,
    parseIngredient: parseIngredient, convert: convert,
    toMetric: toMetric, toUS: toUS, display: display,
    fToC: fToC, cToF: cToF, gasFor: gasFor
  };
})(window.BL = window.BL || {});
