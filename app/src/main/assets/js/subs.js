/* ============================================================
   Butterleaf — substitutions
   What to reach for when the tin is empty. Ratios are per the
   amount the recipe calls for unless the note says otherwise.
   ============================================================ */
(function (BL) {
  'use strict';

  // match: words that must appear in the ingredient name for this entry to fire
  var SUBS = [
    {
      name: 'Buttermilk',
      match: ['buttermilk'],
      swaps: [
        ['Milk + acid', 'For each 1 cup: 1 tbsp lemon juice or white vinegar topped up with milk. Stand 10 minutes until it curdles.'],
        ['Yoghurt', 'Plain yoghurt thinned with milk to a pourable cream, cup for cup.'],
        ['Soured cream', 'Equal parts soured cream and milk, cup for cup.']
      ],
      note: 'Buttermilk is acidic, so it is what makes baking soda work. Plain milk alone will leave the crumb flat.'
    },
    {
      name: 'Cake flour',
      match: ['cake flour'],
      swaps: [
        ['Plain flour + cornflour', 'For each 1 cup: take 2 tbsp out of a cup of plain flour and put 2 tbsp cornflour (cornstarch) back in. Sift three times.']
      ],
      note: 'The sifting is not optional — it is what gets the lightness.'
    },
    {
      name: 'Self-raising flour',
      match: ['self-raising flour', 'self raising flour', 'self-rising flour', 'self rising flour'],
      swaps: [
        ['Plain flour + raising agents', 'For each 1 cup: 1 cup plain flour + 1½ tsp baking powder + ¼ tsp salt.']
      ]
    },
    {
      name: 'Bread flour',
      match: ['bread flour', 'strong flour'],
      swaps: [
        ['Plain flour + gluten', 'For each 1 cup: 1 cup plain flour + 1 tsp vital wheat gluten.'],
        ['Plain flour alone', 'Works, but expect a softer, less chewy crumb and a slacker dough.']
      ]
    },
    {
      name: 'Baking powder',
      match: ['baking powder'],
      swaps: [
        ['Bicarb + cream of tartar', 'For each 1 tsp: ¼ tsp bicarbonate of soda + ½ tsp cream of tartar. Mix at the last moment.'],
        ['Bicarb + buttermilk', 'For each 1 tsp: ¼ tsp bicarb, and replace ½ cup of the liquid with buttermilk.']
      ]
    },
    {
      name: 'Bicarbonate of soda',
      match: ['baking soda', 'bicarbonate of soda', 'bicarb'],
      swaps: [
        ['Baking powder', 'Use 3× the amount — 3 tsp baking powder for 1 tsp bicarb — and cut the salt a little.']
      ],
      note: 'Not a clean swap: bicarb needs an acid in the recipe, baking powder brings its own.'
    },
    {
      name: 'Egg (in baking)',
      match: ['egg', 'eggs'],
      swaps: [
        ['Flaxseed', 'For each egg: 1 tbsp ground flaxseed + 3 tbsp water, left 10 minutes to thicken.'],
        ['Apple sauce', 'For each egg: ¼ cup unsweetened apple sauce. Best in cakes and muffins.'],
        ['Mashed banana', 'For each egg: ¼ cup. It will taste of banana.'],
        ['Yoghurt', 'For each egg: ¼ cup plain yoghurt.']
      ],
      note: 'Substitutes work up to about two eggs. Past that the structure is the egg, and nothing else does the job.'
    },
    {
      name: 'Butter',
      match: ['butter'],
      swaps: [
        ['Oil', 'Use ⅞ of the amount — 7 tbsp oil for 8 tbsp butter. Cakes stay moist longer; shortbread will not work.'],
        ['Margarine or baking block', 'Cup for cup. Choose a firm block, not a soft spread.'],
        ['Coconut oil', 'Cup for cup, solid and softened. Behaves close to butter in pastry.']
      ],
      note: 'Butter is about 16% water. Swapping to pure fat gives a richer, denser result.'
    },
    {
      name: 'Soured cream',
      match: ['sour cream', 'soured cream'],
      swaps: [
        ['Greek yoghurt', 'Cup for cup, no other change.'],
        ['Crème fraîche', 'Cup for cup.']
      ]
    },
    {
      name: 'Brown sugar',
      match: ['brown sugar', 'light brown sugar', 'dark brown sugar'],
      swaps: [
        ['Caster sugar + treacle', 'For each 1 cup: 1 cup caster or granulated sugar + 1 tbsp molasses or black treacle (2 tbsp for dark brown). Rub together with your fingers.']
      ]
    },
    {
      name: 'Caster sugar',
      match: ['caster sugar', 'superfine sugar'],
      swaps: [
        ['Granulated sugar', 'Blitz granulated sugar for 20 seconds in a food processor, cup for cup.']
      ]
    },
    {
      name: 'Icing sugar',
      match: ['icing sugar', 'powdered sugar', 'confectioners sugar', "confectioners' sugar"],
      swaps: [
        ['Blitzed granulated', 'For each 1 cup: 1 cup granulated sugar + 1 tsp cornflour, blitzed fine in a blender.']
      ]
    },
    {
      name: 'Golden syrup',
      match: ['golden syrup', 'corn syrup', 'light corn syrup'],
      swaps: [
        ['Sugar syrup', 'For each 1 cup: 1¼ cups sugar dissolved in ⅓ cup hot water.'],
        ['Honey', 'Cup for cup, with a flavour of its own.']
      ]
    },
    {
      name: 'Vanilla extract',
      match: ['vanilla extract', 'vanilla essence'],
      swaps: [
        ['Vanilla bean paste', 'Half the amount.'],
        ['Vanilla pod', 'Seeds from half a pod per 1 tsp extract.'],
        ['Other extracts', 'Almond or maple at half strength if you want it, or leave it out — nothing breaks.']
      ]
    },
    {
      name: 'Cornflour',
      match: ['cornflour', 'cornstarch'],
      swaps: [
        ['Plain flour', 'Use twice as much for thickening.'],
        ['Arrowroot', 'Cup for cup. Clearer set, better for fruit fillings.']
      ]
    },
    {
      name: 'Yeast',
      match: ['yeast', 'instant yeast', 'active dry yeast', 'fresh yeast'],
      swaps: [
        ['Instant → active dry', 'Use 1¼× as much and prove it in warm liquid first.'],
        ['Dry → fresh', 'Use 3× as much fresh yeast by weight.']
      ]
    },
    {
      name: 'Double cream',
      match: ['heavy cream', 'double cream', 'whipping cream'],
      swaps: [
        ['Milk + butter', 'For each 1 cup: ¾ cup milk + ⅓ cup melted butter. Fine for baking, will not whip.'],
        ['Evaporated milk', 'Cup for cup, chilled hard, if you need something whippable.']
      ]
    },
    {
      name: 'Cream cheese',
      match: ['cream cheese'],
      swaps: [
        ['Mascarpone', 'Cup for cup, richer and less tangy.'],
        ['Strained yoghurt', 'Full-fat yoghurt hung in muslin overnight, cup for cup.']
      ]
    },
    {
      name: 'Cocoa powder',
      match: ['cocoa powder', 'cocoa', 'unsweetened cocoa'],
      swaps: [
        ['Dark chocolate', 'For each 3 tbsp cocoa: 1 oz unsweetened chocolate, and take 1 tbsp fat out of the recipe.'],
        ['Dutch ↔ natural', 'Swapping between them changes the acid. With Dutch cocoa use baking powder; with natural cocoa, bicarb.']
      ]
    },
    {
      name: 'Molasses',
      match: ['molasses', 'treacle', 'black treacle'],
      swaps: [
        ['Dark honey or maple', 'Cup for cup, lighter in flavour.'],
        ['Dark brown sugar', 'For each 1 cup: ¾ cup packed dark brown sugar dissolved in ¼ cup warm water.']
      ]
    },
    {
      name: 'Milk',
      match: ['milk', 'whole milk'],
      swaps: [
        ['Any plant milk', 'Cup for cup. Oat and soy behave closest in baking.'],
        ['Evaporated milk', 'Half evaporated milk, half water.'],
        ['Water + butter', 'For each 1 cup: 1 cup water + 1 tbsp butter.']
      ]
    },
    {
      name: 'Lemon juice',
      match: ['lemon juice'],
      swaps: [
        ['White vinegar', 'Half the amount, where it is there for acid rather than flavour.'],
        ['Lime juice', 'Cup for cup.']
      ]
    },
    {
      name: 'Honey',
      match: ['honey'],
      swaps: [
        ['Maple syrup', 'Cup for cup.'],
        ['Sugar', 'For each 1 cup honey: 1¼ cups sugar + ¼ cup extra liquid.']
      ]
    },
    {
      name: 'Salt',
      match: ['salt', 'kosher salt', 'sea salt', 'table salt'],
      swaps: [
        ['Table → Diamond kosher', 'Use twice as much by volume.'],
        ['Table → Morton kosher', 'Use 1½× as much by volume.'],
        ['By weight', 'All salts weigh the same. If the recipe gives grams, ignore all of this.']
      ]
    },
    {
      name: 'Cream of tartar',
      match: ['cream of tartar'],
      swaps: [
        ['Lemon juice or vinegar', 'For each ½ tsp: 1 tsp lemon juice or white vinegar. For stabilising egg whites only.'],
        ['Leave it out', 'If it is there with bicarb, use baking powder instead at 3× the bicarb amount.']
      ]
    }
  ];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Best matching entry for an ingredient name, or null. */
  function find(item) {
    var n = norm(item);
    if (!n) return null;
    var best = null, bestLen = 0;
    SUBS.forEach(function (e) {
      e.match.forEach(function (m) {
        var mn = norm(m);
        var re = new RegExp('(^|\\s)' + mn.replace(/\s+/g, '\\s+') + '(s?)(\\s|$)');
        if (re.test(n) && mn.length > bestLen) { best = e; bestLen = mn.length; }
      });
    });
    return best;
  }

  function search(q) {
    var n = norm(q);
    if (!n) return SUBS.slice();
    return SUBS.filter(function (e) {
      if (norm(e.name).indexOf(n) !== -1) return true;
      return e.match.some(function (m) { return norm(m).indexOf(n) !== -1; });
    });
  }

  BL.subs = { all: SUBS, find: find, search: search };
})(window.BL = window.BL || {});
