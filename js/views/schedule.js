/*
 * views/schedule.js — Schema-vyn: redigera veckoschema, avvikelser per dag och permission.
 * Alla ändringar sparas direkt i localStorage (MS.Storage.save).
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var S = MS.Schedule;
  function el() { return MS.UI.el.apply(null, arguments); }
  function save() { MS.Storage.save(MS.state.schedule); }
  function rerender() { render(); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dtLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function sectionTitle(t) { return el('h3', { class: 'view-section', text: t }); }

  // En rad för ett ute-fönster i arrayen arr på index i.
  function windowRow(arr, i) {
    var w = arr[i];
    var row = el('div', { class: 'win-row' });
    if (S.parseTime(w.start) >= S.parseTime(w.end)) row.classList.add('invalid');
    var start = el('input', { type: 'time', class: 'in-time', value: w.start,
      onchange: function (e) { w.start = e.target.value; save(); rerender(); } });
    var end = el('input', { type: 'time', class: 'in-time', value: w.end,
      onchange: function (e) { w.end = e.target.value; save(); rerender(); } });
    var label = el('input', { type: 'text', class: 'in-label', value: w.label || '',
      placeholder: 'Etikett (t.ex. Arbete)', list: 'label-suggestions',
      onchange: function (e) { w.label = e.target.value; save(); } });
    var del = el('button', { class: 'btn-del', 'aria-label': 'Ta bort tid', text: '✕',
      onclick: function () { arr.splice(i, 1); save(); rerender(); } });
    [start, el('span', { class: 'dash', text: '–' }), end, label, del]
      .forEach(function (x) { row.appendChild(x); });
    return row;
  }

  // Redigerare för en array av fönster (veckodag eller avvikelse).
  function windowEditor(arr) {
    var frag = document.createDocumentFragment();
    if (!arr.length) frag.appendChild(el('p', { class: 'muted-note', text: 'Inga ute-tider – inne hela dygnet.' }));
    for (var i = 0; i < arr.length; i++) frag.appendChild(windowRow(arr, i));
    frag.appendChild(el('button', { class: 'btn-add', text: '+ Lägg till tid',
      onclick: function () { arr.push({ start: '09:00', end: '12:00', label: '' }); save(); rerender(); } }));
    return frag;
  }

  function dayBlock(iso) {
    var sc = MS.state.schedule;
    sc.weekly[iso] = sc.weekly[iso] || [];
    var card = el('div', { class: 'day-card' });
    card.appendChild(el('div', { class: 'day-head' }, [el('span', { class: 'day-name', text: S.weekdayLongByIso(iso) })]));
    card.appendChild(windowEditor(sc.weekly[iso]));
    return card;
  }

  function overridesBlock() {
    var sc = MS.state.schedule;
    sc.overrides = sc.overrides || {};
    var wrap = el('div');

    var dateInput = el('input', { type: 'date' });
    var addBtn = el('button', { class: 'btn', text: 'Lägg till',
      onclick: function () {
        var v = dateInput.value;
        if (!v) return;
        if (!sc.overrides[v]) {
          var iso = S.isoWeekday(new Date(v + 'T00:00'));
          sc.overrides[v] = (sc.weekly[iso] || []).map(function (w) {
            return { start: w.start, end: w.end, label: w.label };
          });
        }
        save(); rerender();
      } });
    wrap.appendChild(el('div', { class: 'add-row' }, [dateInput, addBtn]));

    var keys = Object.keys(sc.overrides).sort();
    if (!keys.length) {
      wrap.appendChild(el('p', { class: 'muted-note', text: 'Inga avvikelser inlagda. Lägg till en dag som skiljer sig från veckoschemat.' }));
    }
    keys.forEach(function (k) {
      var card = el('div', { class: 'ovr-card' });
      var d = new Date(k + 'T00:00');
      card.appendChild(el('div', { class: 'ovr-head' }, [
        el('span', { class: 'day-name', text: S.formatDateLong(d) }),
        el('button', { class: 'btn-del', 'aria-label': 'Ta bort avvikelse', text: '✕',
          onclick: function () { delete sc.overrides[k]; save(); rerender(); } })
      ]));
      card.appendChild(windowEditor(sc.overrides[k]));
      wrap.appendChild(card);
    });
    return wrap;
  }

  function permissionBlock() {
    var sc = MS.state.schedule;
    sc.permissions = sc.permissions || [];
    var wrap = el('div');

    var st = S.permissionStatsForMonth(new Date(), sc);
    var over = st.count > st.maxCount || st.hours > st.maxHours;
    wrap.appendChild(el('p', { class: 'perm-info' + (over ? ' warn' : ''),
      text: 'Denna månad: ' + st.count + ' av ' + st.maxCount + ' tillfällen · ' + st.hours + ' av ' + st.maxHours + ' tim' +
        (over ? '  (över gränsen!)' : '') }));

    sc.permissions
      .map(function (p, idx) { return { p: p, idx: idx }; })
      .sort(function (a, b) { return a.p.start < b.p.start ? -1 : 1; })
      .forEach(function (it) {
        var p = it.p, idx = it.idx;
        var card = el('div', { class: 'perm-card' });
        card.appendChild(el('div', { class: 'ovr-head' }, [
          el('span', { class: 'day-name', text: 'Permission' }),
          el('button', { class: 'btn-del', 'aria-label': 'Ta bort permission', text: '✕',
            onclick: function () { sc.permissions.splice(idx, 1); save(); rerender(); } })
        ]));
        card.appendChild(el('div', { class: 'win-row' }, [
          el('span', { class: 'dash wide', text: 'Från' }),
          el('input', { type: 'datetime-local', value: p.start,
            onchange: function (e) { p.start = e.target.value; save(); rerender(); } })
        ]));
        card.appendChild(el('div', { class: 'win-row' }, [
          el('span', { class: 'dash wide', text: 'Till' }),
          el('input', { type: 'datetime-local', value: p.end,
            onchange: function (e) { p.end = e.target.value; save(); rerender(); } })
        ]));
        var hrs = Math.round((new Date(p.end) - new Date(p.start)) / 3600000);
        if (hrs > 0) card.appendChild(el('p', { class: 'perm-dur', text: hrs + ' tim' }));
        wrap.appendChild(card);
      });

    wrap.appendChild(el('button', { class: 'btn-add', text: '+ Lägg till permission',
      onclick: function () {
        var s = new Date(); s.setHours(18, 0, 0, 0);
        var e = new Date(s); e.setDate(e.getDate() + 1);
        sc.permissions.push({ start: dtLocal(s), end: dtLocal(e), label: 'Permission' });
        save(); rerender();
      } }));
    return wrap;
  }

  function resetBlock() {
    var wrap = el('div', { class: 'section' });
    wrap.appendChild(el('button', { class: 'btn secondary', text: 'Återställ exempelschema',
      onclick: function () {
        if (window.confirm('Ersätta ditt schema med exempelschemat? Detta går inte att ångra.')) {
          MS.state.schedule = MS.Storage.defaultSchedule(); save(); rerender();
        }
      } }));
    return wrap;
  }

  function render() {
    var root = document.getElementById('view-schedule');
    MS.UI.clear(root);
    root.appendChild(el('h2', { class: 'view-title', text: 'Mitt schema' }));
    root.appendChild(el('p', { class: 'view-sub', text: 'Tider då du får vara ute. Allt sparas direkt på din telefon.' }));

    root.appendChild(sectionTitle('Veckoschema'));
    for (var iso = 1; iso <= 7; iso++) root.appendChild(dayBlock(iso));

    root.appendChild(sectionTitle('Avvikelser (enskilda dagar)'));
    root.appendChild(overridesBlock());

    root.appendChild(sectionTitle('Permission (72 tim/mån, max 4 tillfällen)'));
    root.appendChild(permissionBlock());

    root.appendChild(resetBlock());
  }

  MS.Views = MS.Views || {};
  MS.Views.Schedule = { render: render };
})(window.MS);
