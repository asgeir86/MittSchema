/*
 * storage.js — laddar/sparar schemat i localStorage (allt stannar på enheten).
 * Finns inget sparat schema seedas ett exempel (halvvägshus) som du byter ut
 * mot ditt eget i nästa steg (redigeringsvyn).
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var KEY = 'mittschema.v1';

  function defaultSchedule() {
    return {
      version: 1,
      weekly: {
        1: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
        2: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
        3: [{ start: '07:00', end: '16:00', label: 'Arbete' }],
        4: [{ start: '07:00', end: '16:00', label: 'Arbete' }, { start: '16:30', end: '18:00', label: 'Inköp / ärenden' }],
        5: [{ start: '07:00', end: '15:00', label: 'Arbete' }, { start: '18:00', end: '20:00', label: 'Fritid' }],
        6: [{ start: '10:00', end: '14:00', label: 'Fritid' }, { start: '16:00', end: '17:00', label: 'Inköp' }],
        7: [{ start: '12:00', end: '15:00', label: 'Fritid' }]
      },
      overrides: {},
      permissions: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('Kunde inte läsa schema:', e); }
    var def = defaultSchedule();
    save(def);
    return def;
  }

  function save(schedule) {
    try { localStorage.setItem(KEY, JSON.stringify(schedule)); }
    catch (e) { console.warn('Kunde inte spara schema:', e); }
  }

  MS.Storage = { load: load, save: save, defaultSchedule: defaultSchedule, KEY: KEY };
})(window.MS);
