/*
 * storage.js — localStorage. Format v3: flera klienter (caseload).
 *   { version:3, clients:[ {id, name, schedule} ], activeClientId }
 * Varje schedule har v2-shape (roterande veckor). Migrerar automatiskt:
 *   v1 (weekly) / v2 (weeks) enskilt schema -> v3 med en klient (inget går förlorat).
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
  function genId() { return 'c' + Date.now() + Math.floor(Math.random() * 1000); }

  function defaultSchedule() {
    return { version: 2, weeks: [weekPattern()], weekNames: [], rotationAnchorMonday: todayMondayKey(), overrides: {}, permissions: [], requests: [], log: [] };
  }

  // Migrera ETT schema (v1/v2) till v2-shape.
  function migrateSchedule(s) {
    if (!s || typeof s !== 'object') return defaultSchedule();
    if (!s.weeks) s.weeks = s.weekly ? [s.weekly] : [weekPattern()];
    if (s.weekly) delete s.weekly;
    if (!s.weeks.length) s.weeks = [weekPattern()];
    if (!s.rotationAnchorMonday) s.rotationAnchorMonday = todayMondayKey();
    if (!s.weekNames) s.weekNames = [];
    if (!s.overrides) s.overrides = {};
    if (!s.permissions) s.permissions = [];
    if (!s.requests) s.requests = [];
    if (!s.log) s.log = [];
    s.version = 2;
    return s;
  }

  function defaultStore() {
    var id = genId();
    return { version: 3, clients: [{ id: id, name: 'Min klient', schedule: defaultSchedule() }], activeClientId: id };
  }

  // Migrera hela lagringen till v3.
  function migrateStore(obj) {
    if (!obj || typeof obj !== 'object') return defaultStore();
    if (obj.clients && obj.clients.length) {
      obj.clients.forEach(function (c) {
        c.schedule = migrateSchedule(c.schedule);
        if (!c.id) c.id = genId();
        if (!c.name) c.name = 'Klient';
      });
      if (!obj.activeClientId || !obj.clients.some(function (c) { return c.id === obj.activeClientId; })) {
        obj.activeClientId = obj.clients[0].id;
      }
      obj.version = 3;
      return obj;
    }
    // Enskilt schema (v1/v2) -> wrappa som en klient (bevarar all data).
    if (obj.weeks || obj.weekly) {
      var id = genId();
      return { version: 3, clients: [{ id: id, name: 'Min klient', schedule: migrateSchedule(obj) }], activeClientId: id };
    }
    return defaultStore();
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrateStore(JSON.parse(raw));
    } catch (e) { console.warn('Kunde inte läsa lagring:', e); }
    var def = defaultStore();
    save(def);
    return def;
  }

  function save(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { console.warn('Kunde inte spara:', e); }
  }

  // Validera + migrera ett importerat ENSKILT schema (säkerhetskopia). null om ogiltigt. Sparar EJ.
  function importFromObject(obj) {
    if (!obj || typeof obj !== 'object' || (!obj.weeks && !obj.weekly)) return null;
    return migrateSchedule(obj);
  }

  MS.Storage = { load: load, save: save, defaultSchedule: defaultSchedule, defaultStore: defaultStore, importFromObject: importFromObject, KEY: KEY };
})(window.MS);
