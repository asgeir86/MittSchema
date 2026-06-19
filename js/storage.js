/*
 * storage.js — laddar/sparar schemat i localStorage (allt stannar på enheten).
 * Schema-format v2: roterande veckor.
 *   { version:2, weeks:[ {1..7:[...]} , ... ], rotationAnchorMonday:"YYYY-MM-DD", overrides:{}, permissions:[] }
 * Äldre v1 (en enda "weekly"-karta) migreras automatiskt så inget schema går förlorat.
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var KEY = 'mittschema.v1';

  function weekPattern() {
    return {
      1: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
      2: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
      3: [{ start: '07:00', end: '16:00', label: 'Arbete' }],
      4: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
      5: [{ start: '07:00', end: '15:00', label: 'Arbete' }, { start: '18:00', end: '20:00', label: 'Fritid' }],
      6: [{ start: '10:00', end: '14:00', label: 'Fritid' }, { start: '16:00', end: '17:00', label: 'Inköp' }],
      7: [{ start: '12:00', end: '15:00', label: 'Fritid' }]
    };
  }
  function todayMondayKey() { return MS.Schedule.dateKey(MS.Schedule.mondayOf(new Date())); }

  function defaultSchedule() {
    return { version: 2, weeks: [weekPattern()], weekNames: [], rotationAnchorMonday: todayMondayKey(), overrides: {}, permissions: [], requests: [], log: [] };
  }

  function migrate(s) {
    if (!s || typeof s !== 'object') return defaultSchedule();
    if (!s.weeks) s.weeks = s.weekly ? [s.weekly] : [weekPattern()];
    if (s.weekly) delete s.weekly;
    if (!s.weeks.length) s.weeks = [weekPattern()];
    if (!s.rotationAnchorMonday) s.rotationAnchorMonday = todayMondayKey();
    if (!s.overrides) s.overrides = {};
    if (!s.permissions) s.permissions = [];
    if (!s.weekNames) s.weekNames = [];
    if (!s.requests) s.requests = [];
    if (!s.log) s.log = [];
    s.version = 2;
    return s;
  }

  // Validera + migrera ett inläst objekt (importerad säkerhetskopia). Returnerar null om det inte ser ut som ett schema.
  function importFromObject(obj) {
    if (!obj || typeof obj !== 'object' || (!obj.weeks && !obj.weekly)) return null;
    var m = migrate(obj);
    save(m);
    return m;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.warn('Kunde inte läsa schema:', e); }
    var def = defaultSchedule();
    save(def);
    return def;
  }

  function save(schedule) {
    try { localStorage.setItem(KEY, JSON.stringify(schedule)); }
    catch (e) { console.warn('Kunde inte spara schema:', e); }
  }

  MS.Storage = { load: load, save: save, defaultSchedule: defaultSchedule, importFromObject: importFromObject, KEY: KEY };
})(window.MS);
