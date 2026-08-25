/* ============================================================
   Butterleaf — persistence
   IndexedDB-backed recipe box with an in-memory mirror so the
   UI can render synchronously.
   ============================================================ */
(function (BL) {
  'use strict';

  var DB_NAME = 'butterleaf';
  var DB_VERSION = 1;
  var db = null;
  var recipesById = {};
  var kv = {};
  var listeners = [];

  var DEFAULT_SETTINGS = {
    theme: 'auto',          // auto | light | dark
    units: 'original',      // original | us | metric
    keepAwake: true,
    saltStyle: 'salt_table'
  };

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('recipes')) d.createObjectStore('recipes', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function loadAll() {
    return new Promise(function (resolve) {
      var out = [];
      var req = tx('recipes', 'readonly').openCursor();
      req.onsuccess = function (e) {
        var c = e.target.result;
        if (c) { out.push(c.value); c.continue(); }
        else {
          out.forEach(function (r) { recipesById[r.id] = r; });
          resolve();
        }
      };
      req.onerror = function () { resolve(); };
    });
  }

  function loadKv() {
    return new Promise(function (resolve) {
      var s = tx('kv', 'readonly');
      var keys = ['settings', 'shopping', 'timers', 'seeded', 'categories'];
      var left = keys.length;
      keys.forEach(function (k) {
        var r = s.get(k);
        r.onsuccess = function () { kv[k] = r.result; if (--left === 0) resolve(); };
        r.onerror = function () { if (--left === 0) resolve(); };
      });
    });
  }

  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  function saveCategories(list) {
    kv.categories = list;
    try { tx('kv', 'readwrite').put(list, 'categories'); } catch (e) {}
    notify();
  }

  var api = {
    init: function () {
      return open().then(loadAll).then(loadKv).then(function () {
        if (!kv.settings) kv.settings = Object.assign({}, DEFAULT_SETTINGS);
        else kv.settings = Object.assign({}, DEFAULT_SETTINGS, kv.settings);
        if (!kv.shopping) kv.shopping = [];
        if (!kv.timers) kv.timers = [];
        if (!kv.categories) kv.categories = [];
      });
    },

    onChange: function (fn) { listeners.push(fn); },

    /* ------------------------------------------------------ recipes */

    all: function () {
      var out = [];
      for (var id in recipesById) if (recipesById.hasOwnProperty(id)) out.push(recipesById[id]);
      return out;
    },

    get: function (id) { return recipesById[id] || null; },

    put: function (recipe) {
      recipe.updatedAt = Date.now();
      if (!recipe.createdAt) recipe.createdAt = recipe.updatedAt;
      recipesById[recipe.id] = recipe;
      try { tx('recipes', 'readwrite').put(recipe); } catch (e) {}
      notify();
      return recipe;
    },

    remove: function (id) {
      delete recipesById[id];
      try { tx('recipes', 'readwrite').delete(id); } catch (e) {}
      notify();
    },

    /* ----------------------------------------------------------- kv */

    settings: function () { return kv.settings; },

    saveSettings: function (patch) {
      kv.settings = Object.assign({}, kv.settings, patch || {});
      try { tx('kv', 'readwrite').put(kv.settings, 'settings'); } catch (e) {}
      notify();
      return kv.settings;
    },

    /* --------------------------------------------------- categories */

    categories: function () { return kv.categories || []; },

    categoryName: function (id) {
      var all = kv.categories || [];
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name;
      return '';
    },

    addCategory: function (name) {
      name = String(name || '').trim();
      if (!name) return null;
      var all = (kv.categories || []).slice();
      var existing = all.filter(function (c) {
        return c.name.toLowerCase() === name.toLowerCase();
      })[0];
      if (existing) return existing;
      var cat = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name };
      all.push(cat);
      saveCategories(all);
      return cat;
    },

    renameCategory: function (id, name) {
      name = String(name || '').trim();
      if (!name) return;
      var all = (kv.categories || []).map(function (c) {
        return c.id === id ? { id: c.id, name: name } : c;
      });
      saveCategories(all);
    },

    removeCategory: function (id) {
      saveCategories((kv.categories || []).filter(function (c) { return c.id !== id; }));
      api.all().forEach(function (r) {
        if (r.categories && r.categories.indexOf(id) !== -1) {
          r.categories = r.categories.filter(function (x) { return x !== id; });
          api.put(r);
        }
      });
    },

    countIn: function (id) {
      return api.all().filter(function (r) {
        return (r.categories || []).indexOf(id) !== -1;
      }).length;
    },

    setRecipeCategories: function (recipeId, ids) {
      var r = recipesById[recipeId];
      if (!r) return;
      r.categories = ids.slice();
      api.put(r);
    },

    shopping: function () { return kv.shopping || []; },

    saveShopping: function (list) {
      kv.shopping = list;
      try { tx('kv', 'readwrite').put(list, 'shopping'); } catch (e) {}
      notify();
    },

    timers: function () { return kv.timers || []; },

    saveTimers: function (list) {
      kv.timers = list;
      try { tx('kv', 'readwrite').put(list, 'timers'); } catch (e) {}
    },

    flag: function (name, value) {
      if (arguments.length === 1) return kv[name];
      kv[name] = value;
      try { tx('kv', 'readwrite').put(value, name); } catch (e) {}
      return value;
    },

    /* ------------------------------------------------------- backup */

    exportAll: function () {
      return JSON.stringify({
        app: 'Butterleaf',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: api.all(),
        shopping: api.shopping(),
        categories: api.categories(),
        settings: api.settings()
      });
    },

    importAll: function (json, mode) {
      var data = JSON.parse(json);
      if (!data || !data.recipes) throw new Error('That file is not a Butterleaf backup.');
      var added = 0, updated = 0;
      if (mode === 'replace') {
        api.all().forEach(function (r) { api.remove(r.id); });
      }
      data.recipes.forEach(function (r) {
        if (!r || !r.id) return;
        if (recipesById[r.id]) updated++; else added++;
        recipesById[r.id] = r;
        try { tx('recipes', 'readwrite').put(r); } catch (e) {}
      });
      if (data.shopping && mode === 'replace') api.saveShopping(data.shopping);
      if (data.categories && data.categories.length) {
        var have = {};
        (kv.categories || []).forEach(function (c) { have[c.name.toLowerCase()] = true; });
        var merged = (kv.categories || []).slice();
        data.categories.forEach(function (c) {
          if (c && c.id && c.name && !have[c.name.toLowerCase()]) merged.push(c);
        });
        saveCategories(merged);
      }
      notify();
      return { added: added, updated: updated };
    }
  };

  BL.store = api;
})(window.BL = window.BL || {});
