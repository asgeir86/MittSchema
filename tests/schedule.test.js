/*
 * tests/schedule.test.js — fristående regressionstest för den deterministiska
 * schemalogiken (js/schedule.js). Inga beroenden. Kör med:  node tests/schedule.test.js
 *
 * schedule.js är en IIFE som hänger på window.MS. Vi shimmar window i Node.
 */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'schedule.js'), 'utf8');
// SÄKERHET: eval körs ENBART på vår egen, betrodda källfil (js/schedule.js) som läses
// från repo:t — ingen extern/användardata. Detta är bara ett sätt att köra browser-IIFE:n
// i Node för testning. Ingen säkerhetsrisk i detta sammanhang.
// eslint-disable-next-line no-eval
eval(code);
const S = global.window.MS.Schedule;

let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  if (actual === expected) { pass++; }
  else { fail++; console.error('FAIL: ' + msg + '\n  förväntat: ' + expected + '\n  faktiskt:  ' + actual); }
}
// Lokalt "YYYY-MM-DD HH:mm" för läsbar jämförelse (oberoende av tidszon).
function fmt(d) {
  if (!d) return String(d);
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// --- Schema: permission 2026-06-27 18:00 -> 2026-06-30 18:00 (löper över två midnätter) ---
const sched = {
  version: 1,
  weekly: {}, // inga vanliga ute-fönster — isolerar permission-beteendet
  overrides: {},
  permissions: [{ start: '2026-06-27T18:00', end: '2026-06-30T18:00', label: 'Permission' }]
};

// BUGG-FALLET: mitt i permissionen, strax före midnatt mellan 06-28 och 06-29.
// Ute ska fortsätta över midnatt; nästa ändring är när permissionen FAKTISKT slutar (06-30 18:00).
(function () {
  const now = new Date(2026, 5, 28, 23, 50); // 28 juni 23:50 lokal tid
  const st = S.getStatusAt(now, sched);
  eq(st.state, 'ute', 'mitt i permission ska vara ute');
  eq(st.changeTo, 'inne', 'nästa ändring ska vara till inne (vid permissionens slut)');
  eq(fmt(st.changeAt), '2026-06-30 18:00', 'nästa ändring ska vara permissionens verkliga slut, inte midnatt');
})();

// KONTROLL 1: heldygn mitt i permissionen, status mitt på dagen — fortsatt ute till verkligt slut.
(function () {
  const now = new Date(2026, 5, 29, 12, 0); // 29 juni 12:00, ett heldygn av permission
  const st = S.getStatusAt(now, sched);
  eq(st.state, 'ute', 'heldygn av permission ska vara ute kl 12');
  eq(fmt(st.changeAt), '2026-06-30 18:00', 'nästa ändring = permissionens slut');
})();

// KONTROLL 2: vanligt dagfönster som slutar mitt på dagen — får INTE påverkas av midnattslogiken.
(function () {
  const s2 = { version: 1, weekly: { 1: [{ start: '08:00', end: '16:00', label: 'Arbete' }] }, overrides: {}, permissions: [] };
  const now = new Date(2026, 5, 22, 10, 0); // måndag 22 juni 10:00 (isoWeekday=1)
  const st = S.getStatusAt(now, s2);
  eq(st.state, 'ute', 'inom arbetsfönster ska vara ute');
  eq(st.changeTo, 'inne', 'efter arbetsfönster blir det inne');
  eq(fmt(st.changeAt), '2026-06-22 16:00', 'ändring vid 16:00 samma dag');
})();

// KONTROLL 3: ute-fönster som slutar exakt vid midnatt MEN nästa dygn är inne — då ska 00:00 gälla.
(function () {
  const s3 = { version: 1, weekly: { 1: [{ start: '20:00', end: '24:00', label: 'Kväll' }] }, overrides: {}, permissions: [] };
  const now = new Date(2026, 5, 22, 23, 30); // måndag 22 juni 23:30, fönster 20–24, tisdag saknar fönster
  const st = S.getStatusAt(now, s3);
  eq(st.state, 'ute', 'inom kvällsfönster ska vara ute');
  eq(st.changeTo, 'inne', 'blir inne när kvällsfönstret slutar');
  eq(fmt(st.changeAt), '2026-06-23 00:00', 'ute slutar vid midnatt när nästa dygn är inne');
})();

console.log('\n' + pass + ' OK, ' + fail + ' fel');
process.exit(fail ? 1 : 0);
