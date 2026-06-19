/*
 * views/requests.js — Förslag-vyn (demo av tvåsidiga flödet på en enhet).
 *  - Klient: skicka ändringsförslag (ändrad tid en dag) + ansök om 72h-permission.
 *  - Handläggare: se inkomna förslag och Godkänn/Avslå. Godkänt slår igenom i schemat.
 * I skarp produkt är klient och handläggare skilda roller på olika enheter (backend behövs då).
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
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function uid() { return 'r' + Date.now() + Math.floor(Math.random() * 1000); }
  function sectionTitle(t) { return el('h3', { class: 'view-section', text: t }); }

  function addRequest(req) {
    var sc = MS.state.schedule;
    sc.requests = sc.requests || [];
    sc.requests.push(req);
    save(); rerender();
  }

  function changeForm() {
    var card = el('div', { class: 'req-form' });
    var date = el('input', { type: 'date' });
    var start = el('input', { type: 'time', class: 'in-time', value: '09:00' });
    var end = el('input', { type: 'time', class: 'in-time', value: '10:00' });
    var label = el('input', { type: 'text', class: 'in-label', placeholder: 'Orsak/etikett (t.ex. Läkarbesök)', list: 'label-suggestions' });
    var note = el('input', { type: 'text', class: 'in-label', placeholder: 'Meddelande till handläggaren (valfritt)' });
    var err = el('p', { class: 'edit-err', text: '' });
    card.appendChild(el('p', { class: 'req-form-title', text: 'Föreslå ändrad tid en dag' }));
    card.appendChild(el('div', { class: 'add-row' }, [date]));
    card.appendChild(el('div', { class: 'win-row' }, [start, el('span', { class: 'dash', text: '–' }), end]));
    card.appendChild(label);
    card.appendChild(note);
    card.appendChild(err);
    card.appendChild(el('button', { class: 'btn', text: 'Skicka förslag',
      onclick: function () {
        if (!date.value) { err.textContent = 'Välj ett datum.'; return; }
        if (S.parseTime(start.value) >= S.parseTime(end.value)) { err.textContent = 'Sluttiden måste vara efter starttiden.'; return; }
        addRequest({ id: uid(), type: 'change', status: 'pending', created: new Date().toISOString(),
          date: date.value, windows: [{ start: start.value, end: end.value, label: label.value || 'Ute' }], note: note.value });
      } }));
    return card;
  }

  function permissionForm() {
    var card = el('div', { class: 'req-form' });
    var s = new Date(); s.setHours(18, 0, 0, 0);
    var e = new Date(s); e.setDate(e.getDate() + 1);
    var start = el('input', { type: 'datetime-local', value: dtLocal(s) });
    var end = el('input', { type: 'datetime-local', value: dtLocal(e) });
    var note = el('input', { type: 'text', class: 'in-label', placeholder: 'Meddelande (valfritt)' });
    var err = el('p', { class: 'edit-err', text: '' });
    card.appendChild(el('p', { class: 'req-form-title', text: 'Ansök om permission (72h)' }));
    card.appendChild(el('div', { class: 'win-row' }, [el('span', { class: 'dash wide', text: 'Från' }), start]));
    card.appendChild(el('div', { class: 'win-row' }, [el('span', { class: 'dash wide', text: 'Till' }), end]));
    card.appendChild(note);
    card.appendChild(err);
    card.appendChild(el('button', { class: 'btn', text: 'Skicka ansökan',
      onclick: function () {
        if (!start.value || !end.value) { err.textContent = 'Fyll i från och till.'; return; }
        if (new Date(end.value) <= new Date(start.value)) { err.textContent = 'Till måste vara efter från.'; return; }
        addRequest({ id: uid(), type: 'permission', status: 'pending', created: new Date().toISOString(),
          start: start.value, end: end.value, note: note.value });
      } }));
    return card;
  }

  function reqDescription(r) {
    if (r.type === 'change') {
      var w = (r.windows && r.windows[0]) || {};
      return 'Ändrad tid ' + r.date + ': ' + (w.start || '') + '–' + (w.end || '') + (w.label ? ' (' + w.label + ')' : '');
    }
    return 'Permission ' + String(r.start || '').replace('T', ' ') + ' – ' + String(r.end || '').replace('T', ' ');
  }

  function statusBadge(status) {
    var map = { pending: 'Väntar', approved: 'Godkänd', denied: 'Avslagen' };
    return el('span', { class: 'req-badge ' + status, text: map[status] || status });
  }

  function queue() {
    var sc = MS.state.schedule;
    sc.requests = sc.requests || [];
    var wrap = el('div');
    if (!sc.requests.length) { wrap.appendChild(el('p', { class: 'muted-note', text: 'Inga förslag ännu. Skicka ett ovan så dyker det upp här.' })); return wrap; }
    var sorted = sc.requests.slice().sort(function (a, b) {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return (a.created < b.created) ? 1 : -1;
    });
    sorted.forEach(function (r) {
      var card = el('div', { class: 'req-card' });
      card.appendChild(el('div', { class: 'req-head' }, [
        el('span', { class: 'req-type', text: r.type === 'change' ? 'Ändringsförslag' : 'Permissionsansökan' }),
        statusBadge(r.status)
      ]));
      card.appendChild(el('p', { class: 'req-desc', text: reqDescription(r) }));
      if (r.note) card.appendChild(el('p', { class: 'req-note', text: '”' + r.note + '”' }));
      if (r.status === 'pending') {
        var actions = el('div', { class: 'edit-actions' });
        actions.appendChild(el('button', { class: 'btn', text: 'Godkänn',
          onclick: function () { S.applyRequest(sc, r); r.status = 'approved'; save(); rerender(); } }));
        actions.appendChild(el('button', { class: 'btn secondary', text: 'Avslå',
          onclick: function () { r.status = 'denied'; save(); rerender(); } }));
        card.appendChild(actions);
      }
      wrap.appendChild(card);
    });
    return wrap;
  }

  function render() {
    var root = document.getElementById('view-requests');
    MS.UI.clear(root);
    root.appendChild(el('h2', { class: 'view-title', text: 'Förslag & ansökningar' }));
    root.appendChild(el('p', { class: 'view-sub', text: 'Demo av det tvåsidiga flödet: klienten skickar, handläggaren beslutar. Godkänt slår igenom i schemat. (I skarpt läge är detta skilda roller på olika enheter.)' }));
    root.appendChild(sectionTitle('Skicka (klient)'));
    root.appendChild(changeForm());
    root.appendChild(permissionForm());
    root.appendChild(sectionTitle('Inkomna förslag (handläggare)'));
    root.appendChild(queue());
  }

  MS.Views = MS.Views || {};
  MS.Views.Requests = { render: render };
})(window.MS);
