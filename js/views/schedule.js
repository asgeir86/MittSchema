/*
 * views/schedule.js — Schema-vyn.
 *  - Tryck "Ändra" på en tid -> redigera start/slut/etikett och tryck KLAR (inget sparas innan dess,
 *    så tidshjulet kastar inte ut dig mitt i).
 *  - Roterande veckoschema: flera veckor (t.ex. förmiddag/kväll) + "Den här veckan är ..."-väljare.
 *  - "Kopiera till …": fyll andra dagar med samma tider.
 * Allt sparas i localStorage (MS.Storage.save).
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var S = MS.Schedule;

  // Vy-tillstånd (lever mellan omritningar)
  var editWeek = 0;        // vilken veckaflik som redigeras
  var editTarget = null;   // nyckel för raden som redigeras, t.ex. "w|0|1|2" eller "o|2026-06-20|0"
  var editIsNew = false;   // om raden nyss lades till (Avbryt tar då bort den)
  var copyPanelKey = null; // "w|<vecka>|<iso>" för dagen vars kopiera-panel är öppen

  function el() { return MS.UI.el.apply(null, arguments); }
  function save() { MS.Storage.save(MS.state.schedule); }
  function rerender() { render(); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dtLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function deepCopyWindows(arr) {
    return (arr || []).map(function (w) { return { start: w.start, end: w.end, label: w.label }; });
  }
  function sectionTitle(t) { return el('h3', { class: 'view-section', text: t }); }

  function ensureModel(sc) {
    if (!sc.weeks) sc.weeks = sc.weekly ? [sc.weekly] : [{}];
    if (!sc.weeks.length) sc.weeks = [{}];
    if (!sc.rotationAnchorMonday) sc.rotationAnchorMonday = S.dateKey(S.mondayOf(new Date()));
    sc.overrides = sc.overrides || {};
    sc.permissions = sc.permissions || [];
  }

  /* ---- Veckorotation ---- */
  function weekTabs(sc) {
    var wrap = el('div', { class: 'week-tabs' });
    var curIdx = S.weekIndexForDate(new Date(), sc);
    sc.weeks.forEach(function (_, i) {
      var btn = el('button', { class: 'wtab' + (i === editWeek ? ' active' : ''),
        onclick: function () { editWeek = i; editTarget = null; copyPanelKey = null; rerender(); } }, ['Vecka ' + (i + 1)]);
      if (sc.weeks.length > 1 && i === curIdx) btn.appendChild(el('span', { class: 'wtab-now', text: ' • nu' }));
      wrap.appendChild(btn);
    });
    wrap.appendChild(el('button', { class: 'wtab add', text: '+ Lägg till vecka',
      onclick: function () {
        var copy = {};
        for (var d = 1; d <= 7; d++) copy[d] = deepCopyWindows(sc.weeks[editWeek][d]);
        sc.weeks.push(copy);
        editWeek = sc.weeks.length - 1;
        editTarget = null; copyPanelKey = null;
        save(); rerender();
      } }));
    return wrap;
  }

  function phaseControl(sc) {
    if (sc.weeks.length <= 1) return el('div');
    var wrap = el('div', { class: 'phase-row' });
    wrap.appendChild(el('span', { class: 'phase-label', text: 'Den här veckan är:' }));
    var curIdx = S.weekIndexForDate(new Date(), sc);
    var sel = el('select', { onchange: function (e) { S.setCurrentWeekIndex(sc, parseInt(e.target.value, 10)); save(); rerender(); } });
    sc.weeks.forEach(function (_, i) {
      var opt = el('option', { value: String(i), text: 'Vecka ' + (i + 1) });
      if (i === curIdx) opt.selected = true;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
    wrap.appendChild(el('button', { class: 'btn-mini danger', text: 'Ta bort Vecka ' + (editWeek + 1),
      onclick: function () {
        if (window.confirm('Ta bort Vecka ' + (editWeek + 1) + ' ur rotationen?')) {
          sc.weeks.splice(editWeek, 1);
          if (editWeek >= sc.weeks.length) editWeek = sc.weeks.length - 1;
          editTarget = null; copyPanelKey = null;
          save(); rerender();
        }
      } }));
    return wrap;
  }

  /* ---- En dag i veckoschemat ---- */
  function dayBlock(sc, weekIdx, iso) {
    sc.weeks[weekIdx][iso] = sc.weeks[weekIdx][iso] || [];
    var arr = sc.weeks[weekIdx][iso];
    var dayKey = 'w|' + weekIdx + '|' + iso;
    var card = el('div', { class: 'day-card' });
    var head = el('div', { class: 'day-head' }, [el('span', { class: 'day-name', text: S.weekdayLongByIso(iso) })]);
    if (arr.length) {
      head.appendChild(el('button', { class: 'btn-mini', text: 'Kopiera till…',
        onclick: function () { copyPanelKey = (copyPanelKey === dayKey) ? null : dayKey; rerender(); } }));
    }
    card.appendChild(head);
    card.appendChild(windowEditor(arr, 'w|' + weekIdx + '|' + iso + '|'));
    if (copyPanelKey === dayKey) card.appendChild(copyPanel(sc, weekIdx, iso, arr));
    return card;
  }

  function copyPanel(sc, weekIdx, sourceIso, arr) {
    var panel = el('div', { class: 'copy-panel' });
    panel.appendChild(el('p', { class: 'muted-note', text: 'Kopiera dessa tider till:' }));
    var checks = {};
    var days = el('div', { class: 'copy-days' });
    for (var iso = 1; iso <= 7; iso++) {
      if (iso === sourceIso) continue;
      var cb = el('input', { type: 'checkbox' });
      checks[iso] = cb;
      days.appendChild(el('label', { class: 'copy-day' }, [cb, ' ' + S.weekdayShortByIso(iso)]));
    }
    panel.appendChild(days);
    var quick = el('div', { class: 'copy-quick' });
    quick.appendChild(el('button', { class: 'btn-mini', text: 'Vardagar (mån–fre)',
      onclick: function () { [1, 2, 3, 4, 5].forEach(function (d) { if (checks[d]) checks[d].checked = true; }); } }));
    quick.appendChild(el('button', { class: 'btn-mini', text: 'Alla dagar',
      onclick: function () { for (var d in checks) checks[d].checked = true; } }));
    panel.appendChild(quick);
    var actions = el('div', { class: 'edit-actions' });
    actions.appendChild(el('button', { class: 'btn', text: 'Kopiera',
      onclick: function () {
        for (var iso in checks) { if (checks[iso].checked) sc.weeks[weekIdx][iso] = deepCopyWindows(arr); }
        copyPanelKey = null; save(); rerender();
      } }));
    actions.appendChild(el('button', { class: 'btn secondary', text: 'Avbryt',
      onclick: function () { copyPanelKey = null; rerender(); } }));
    panel.appendChild(actions);
    return panel;
  }

  /* ---- Redigerare för en lista ute-fönster ---- */
  function windowEditor(arr, keyPrefix) {
    var frag = document.createDocumentFragment();
    if (!arr.length) frag.appendChild(el('p', { class: 'muted-note', text: 'Inga ute-tider – inne hela dygnet.' }));
    for (var i = 0; i < arr.length; i++) frag.appendChild(windowRow(arr, i, keyPrefix));
    frag.appendChild(el('button', { class: 'btn-add', text: '+ Lägg till tid',
      onclick: function () {
        arr.push({ start: '09:00', end: '12:00', label: '' });
        editTarget = keyPrefix + (arr.length - 1);
        editIsNew = true;
        save(); rerender();
      } }));
    return frag;
  }

  function windowRow(arr, i, keyPrefix) {
    var key = keyPrefix + i;
    if (editTarget === key) return windowRowEdit(arr, i);
    var w = arr[i];
    var row = el('div', { class: 'win-row ro' });
    if (S.parseTime(w.start) >= S.parseTime(w.end)) row.classList.add('invalid');
    row.appendChild(el('span', { class: 'ro-time', text: w.start + '–' + w.end }));
    row.appendChild(el('span', { class: 'ro-label', text: w.label || 'Ute' }));
    row.appendChild(el('button', { class: 'btn-mini', text: 'Ändra',
      onclick: function () { editTarget = key; editIsNew = false; rerender(); } }));
    row.appendChild(el('button', { class: 'btn-del', 'aria-label': 'Ta bort tid', text: '✕',
      onclick: function () { arr.splice(i, 1); save(); rerender(); } }));
    return row;
  }

  function windowRowEdit(arr, i) {
    var w = arr[i];
    var wrap = el('div', { class: 'win-edit' });
    var startI = el('input', { type: 'time', class: 'in-time', value: w.start });
    var endI = el('input', { type: 'time', class: 'in-time', value: w.end });
    var labelI = el('input', { type: 'text', class: 'in-label', value: w.label || '', placeholder: 'Etikett (t.ex. Arbete)', list: 'label-suggestions' });
    var err = el('p', { class: 'edit-err', text: '' });
    wrap.appendChild(el('div', { class: 'win-row' }, [startI, el('span', { class: 'dash', text: '–' }), endI]));
    wrap.appendChild(labelI);
    wrap.appendChild(err);
    var actions = el('div', { class: 'edit-actions' });
    actions.appendChild(el('button', { class: 'btn', text: 'Klar',
      onclick: function () {
        var s = startI.value, e = endI.value;
        if (!s || !e) { err.textContent = 'Fyll i både start- och sluttid.'; return; }
        if (S.parseTime(s) >= S.parseTime(e)) { err.textContent = 'Sluttiden måste vara efter starttiden.'; return; }
        arr[i] = { start: s, end: e, label: labelI.value };
        editTarget = null; editIsNew = false; save(); rerender();
      } }));
    actions.appendChild(el('button', { class: 'btn secondary', text: 'Avbryt',
      onclick: function () {
        if (editIsNew) arr.splice(i, 1);
        editTarget = null; editIsNew = false; save(); rerender();
      } }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ---- Avvikelser (enskilda dagar) ---- */
  function overridesBlock(sc) {
    var wrap = el('div');
    var dateInput = el('input', { type: 'date' });
    var addBtn = el('button', { class: 'btn', text: 'Lägg till',
      onclick: function () {
        var v = dateInput.value;
        if (!v) return;
        if (!sc.overrides[v]) {
          var d = new Date(v + 'T00:00');
          var pat = S.weekPatternForDate(d, sc);
          sc.overrides[v] = deepCopyWindows(pat[S.isoWeekday(d)]);
        }
        save(); rerender();
      } });
    wrap.appendChild(el('div', { class: 'add-row' }, [dateInput, addBtn]));

    var keys = Object.keys(sc.overrides).sort();
    if (!keys.length) wrap.appendChild(el('p', { class: 'muted-note', text: 'Inga avvikelser inlagda. Lägg till en dag som skiljer sig från veckoschemat.' }));
    keys.forEach(function (k) {
      var card = el('div', { class: 'ovr-card' });
      var d = new Date(k + 'T00:00');
      card.appendChild(el('div', { class: 'ovr-head' }, [
        el('span', { class: 'day-name', text: S.formatDateLong(d) }),
        el('button', { class: 'btn-del', 'aria-label': 'Ta bort avvikelse', text: '✕',
          onclick: function () { delete sc.overrides[k]; save(); rerender(); } })
      ]));
      card.appendChild(windowEditor(sc.overrides[k], 'o|' + k + '|'));
      wrap.appendChild(card);
    });
    return wrap;
  }

  /* ---- Permission ---- */
  function permissionBlock(sc) {
    var wrap = el('div');
    var st = S.permissionStatsForMonth(new Date(), sc);
    var over = st.count > st.maxCount || st.hours > st.maxHours;
    wrap.appendChild(el('p', { class: 'perm-info' + (over ? ' warn' : ''),
      text: 'Denna månad: ' + st.count + ' av ' + st.maxCount + ' tillfällen · ' + st.hours + ' av ' + st.maxHours + ' tim' + (over ? '  (över gränsen!)' : '') }));

    sc.permissions.map(function (p, idx) { return { p: p, idx: idx }; })
      .sort(function (a, b) { return a.p.start < b.p.start ? -1 : 1; })
      .forEach(function (it) {
        var p = it.p, idx = it.idx;
        var card = el('div', { class: 'perm-card' });
        var startI = el('input', { type: 'datetime-local', value: p.start });
        var endI = el('input', { type: 'datetime-local', value: p.end });
        var err = el('p', { class: 'edit-err', text: '' });
        card.appendChild(el('div', { class: 'ovr-head' }, [
          el('span', { class: 'day-name', text: 'Permission' }),
          el('button', { class: 'btn-del', 'aria-label': 'Ta bort permission', text: '✕',
            onclick: function () { sc.permissions.splice(idx, 1); save(); rerender(); } })
        ]));
        card.appendChild(el('div', { class: 'win-row' }, [el('span', { class: 'dash wide', text: 'Från' }), startI]));
        card.appendChild(el('div', { class: 'win-row' }, [el('span', { class: 'dash wide', text: 'Till' }), endI]));
        card.appendChild(err);
        var hrs = Math.round((new Date(p.end) - new Date(p.start)) / 3600000);
        card.appendChild(el('p', { class: 'perm-dur', text: hrs > 0 ? hrs + ' tim' : '' }));
        card.appendChild(el('button', { class: 'btn-mini', text: 'Spara',
          onclick: function () {
            var s = startI.value, e = endI.value;
            if (!s || !e) { err.textContent = 'Fyll i både från och till.'; return; }
            if (new Date(e) <= new Date(s)) { err.textContent = 'Till måste vara efter från.'; return; }
            p.start = s; p.end = e; save(); rerender();
          } }));
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
          MS.state.schedule = MS.Storage.defaultSchedule();
          editWeek = 0; editTarget = null; copyPanelKey = null;
          save(); rerender();
        }
      } }));
    return wrap;
  }

  function render() {
    var sc = MS.state.schedule;
    ensureModel(sc);
    if (editWeek >= sc.weeks.length) editWeek = sc.weeks.length - 1;
    if (editWeek < 0) editWeek = 0;

    var root = document.getElementById('view-schedule');
    MS.UI.clear(root);
    root.appendChild(el('h2', { class: 'view-title', text: 'Mitt schema' }));
    root.appendChild(el('p', { class: 'view-sub', text: 'Tider då du får vara ute. Allt sparas direkt på din telefon.' }));

    root.appendChild(sectionTitle('Veckoschema'));
    root.appendChild(weekTabs(sc));
    root.appendChild(phaseControl(sc));
    for (var iso = 1; iso <= 7; iso++) root.appendChild(dayBlock(sc, editWeek, iso));

    root.appendChild(sectionTitle('Avvikelser (enskilda dagar)'));
    root.appendChild(overridesBlock(sc));

    root.appendChild(sectionTitle('Permission (72 tim/mån, max 4 tillfällen)'));
    root.appendChild(permissionBlock(sc));

    root.appendChild(resetBlock());
  }

  MS.Views = MS.Views || {};
  MS.Views.Schedule = { render: render };
})(window.MS);
