/*
 * views/week.js — Vecka-vyn: överblick 3 veckor framåt med grön/röd mini-tidslinje per dag.
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var S = MS.Schedule;
  var DAYS = 21;
  function el() { return MS.UI.el.apply(null, arguments); }

  function dayHasPermission(date, sc) {
    var ds = new Date(date); ds.setHours(0, 0, 0, 0);
    var de = new Date(ds); de.setDate(de.getDate() + 1);
    return (sc.permissions || []).some(function (p) {
      return new Date(p.end) > ds && new Date(p.start) < de;
    });
  }

  function miniBar(date, now, sc) {
    var bar = el('div', { class: 'mini-bar' });
    S.mergeWindows(S.getOutWindowsForDate(date, sc)).forEach(function (w) {
      var seg = el('div', { class: 'seg' });
      seg.style.left = (w.startMin / 1440 * 100) + '%';
      seg.style.width = ((w.endMin - w.startMin) / 1440 * 100) + '%';
      bar.appendChild(seg);
    });
    if (S.dateKey(date) === S.dateKey(now)) {
      var nm = now.getHours() * 60 + now.getMinutes();
      var mk = el('div', { class: 'mini-now' });
      mk.style.left = (nm / 1440 * 100) + '%';
      bar.appendChild(mk);
    }
    return bar;
  }

  function labelText(date, now) {
    var k = S.dateKey(date), t = new Date(now); t.setDate(t.getDate() + 1);
    if (k === S.dateKey(now)) return 'Idag';
    if (k === S.dateKey(t)) return 'Imorgon';
    return S.weekdayShortByIso(S.isoWeekday(date)) + ' ' + date.getDate() + '/' + (date.getMonth() + 1);
  }

  function render(now) {
    now = now || new Date();
    var root = document.getElementById('view-week');
    MS.UI.clear(root);
    root.appendChild(el('h2', { class: 'view-title', text: 'Kommande veckor' }));
    root.appendChild(el('p', { class: 'view-sub', text: 'Grönt = du får vara ute, rött = inne. Tre veckor framåt.' }));

    var sc = MS.state.schedule, lastWk = null;
    for (var i = 0; i < DAYS; i++) {
      var d = new Date(now); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0);
      var wk = S.isoWeekNumber(d);
      if (wk !== lastWk) {
        var sepTxt = 'Vecka ' + wk;
        if (sc.weeks && sc.weeks.length > 1) sepTxt += ' · schema ' + (S.weekIndexForDate(d, sc) + 1);
        root.appendChild(el('div', { class: 'week-sep', text: sepTxt }));
        lastWk = wk;
      }

      var isToday = S.dateKey(d) === S.dateKey(now);
      var lab = el('div', { class: 'week-label' }, [
        el('span', { class: isToday ? 'wl-strong' : '', text: labelText(d, now) })
      ]);
      if (dayHasPermission(d, sc)) lab.appendChild(el('span', { class: 'perm-tag', text: 'Perm' }));

      root.appendChild(el('div', { class: 'week-row' + (isToday ? ' today-row' : '') }, [lab, miniBar(d, now, sc)]));
    }
  }

  MS.Views = MS.Views || {};
  MS.Views.Week = { render: render };
})(window.MS);
