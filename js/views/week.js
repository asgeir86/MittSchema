/*
 * views/week.js — Vecka-vyn: 3 veckor framåt som dagsrader mot en gemensam timaxel.
 * Rutnät vid 06/12/18, rundade gröna ute-pass, dagens rad markerad med nu-linje.
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

  function track(date, now, sc) {
    var tr = el('div', { class: 'wk-track' });
    [25, 50, 75].forEach(function (pct) {
      var g = el('div', { class: 'wk-grid' });
      g.style.left = pct + '%';
      tr.appendChild(g);
    });
    S.mergeWindows(S.getOutWindowsForDate(date, sc)).forEach(function (w) {
      var seg = el('div', { class: 'wk-seg' });
      seg.style.left = (w.startMin / 1440 * 100) + '%';
      seg.style.width = ((w.endMin - w.startMin) / 1440 * 100) + '%';
      tr.appendChild(seg);
    });
    if (S.dateKey(date) === S.dateKey(now)) {
      var nm = now.getHours() * 60 + now.getMinutes();
      var line = el('div', { class: 'wk-now' });
      line.style.left = (nm / 1440 * 100) + '%';
      tr.appendChild(line);
    }
    return tr;
  }

  function label(date, now) {
    var k = S.dateKey(date), t = new Date(now); t.setDate(t.getDate() + 1);
    var wd = S.weekdayShortByIso(S.isoWeekday(date));
    var dm = date.getDate() + '/' + (date.getMonth() + 1);
    var name, dt;
    if (k === S.dateKey(now)) { name = 'Idag'; dt = wd + ' ' + dm; }
    else if (k === S.dateKey(t)) { name = 'Imorgon'; dt = wd + ' ' + dm; }
    else { name = wd; dt = dm; }
    return el('div', { class: 'wk-lab' }, [
      el('span', { class: 'nm', text: name }),
      el('span', { class: 'dt', text: dt })
    ]);
  }

  function render(now) {
    now = now || new Date();
    var root = document.getElementById('view-week');
    MS.UI.clear(root);
    root.appendChild(el('h2', { class: 'view-title', text: 'Kommande veckor' }));
    root.appendChild(el('p', { class: 'view-sub', text: 'Grönt = du får vara ute. Tre veckor framåt.' }));

    root.appendChild(el('div', { class: 'wk-axis' }, [
      el('span', {}),
      el('div', { class: 'wk-scale' }, [
        el('span', { text: '00' }), el('span', { text: '06' }), el('span', { text: '12' }), el('span', { text: '18' }), el('span', { text: '24' })
      ])
    ]));

    var sc = MS.state.schedule, lastWk = null;
    for (var i = 0; i < DAYS; i++) {
      var d = new Date(now); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0);
      var wk = S.isoWeekNumber(d);
      if (wk !== lastWk) {
        var sepTxt = 'Vecka ' + wk;
        if (sc.weeks && sc.weeks.length > 1) sepTxt += ' · ' + S.weekTag(sc, S.weekIndexForDate(d, sc));
        root.appendChild(el('div', { class: 'wk-sep' }, [el('span', { text: sepTxt }), el('span', { class: 'wk-line' })]));
        lastWk = wk;
      }
      var isToday = S.dateKey(d) === S.dateKey(now);
      var lab = label(d, now);
      if (dayHasPermission(d, sc)) lab.appendChild(el('span', { class: 'wk-tag', text: 'Perm' }));
      root.appendChild(el('div', { class: 'wk-row' + (isToday ? ' today' : '') }, [lab, track(d, now, sc)]));
    }
  }

  MS.Views = MS.Views || {};
  MS.Views.Week = { render: render };
})(window.MS);
