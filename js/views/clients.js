/*
 * views/clients.js — Klienter (caseload-översikt, bara handläggare).
 * Alla klienter på en gång: status nu (ute/inne) + antal väntande förslag.
 * Tryck på en klient för att välja den och hoppa in.
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var S = MS.Schedule;
  function el() { return MS.UI.el.apply(null, arguments); }

  function pendingCount(sched) {
    return (sched.requests || []).filter(function (r) { return r.status === 'pending'; }).length;
  }

  // Kompakt "nästa ändring"-text, samma röst som Idag-vyn ("Inne igen 16:00 · om 2 tim").
  function nextChangeText(st, now) {
    if (!st.changeAt) return st.state === 'ute' ? 'Inga fler ändringar planerade' : 'Inga ute-tider planerade framåt';
    var rel = S.formatRelativeDay(st.changeAt, now);
    var t = S.minToTime(st.changeAt.getHours() * 60 + st.changeAt.getMinutes());
    var when = (rel === 'idag' ? '' : rel + ' ') + t;
    return (st.state === 'ute' ? 'Inne igen ' : 'Får gå ut ') + when + ' · om ' + S.formatCountdown(st.changeAt - now);
  }

  function clientCard(c) {
    var now = new Date();
    var st = S.getStatusAt(now, c.schedule);
    var out = st.state === 'ute';
    var pending = pendingCount(c.schedule);
    var card = el('div', { class: 'cl-card' + (c.id === MS.state.clientId ? ' active' : ''),
      onclick: function () { MS.setActiveClient(c.id); MS.show('today'); } });
    card.appendChild(el('div', { class: 'cl-head' }, [
      el('span', { class: 'cl-name', text: c.name }),
      el('span', { class: 'cl-status ' + (out ? 'ute' : 'inne') }, [el('span', { class: 'cl-dot' }), out ? 'Ute nu' : 'Inne nu'])
    ]));
    card.appendChild(el('div', { class: 'cl-meta' }, [
      el('span', { class: 'cl-next', text: nextChangeText(st, now) }),
      pending > 0
        ? el('span', { class: 'cl-pending', text: pending + ' väntande förslag' })
        : el('span', { class: 'cl-none', text: 'Inga väntande förslag' })
    ]));
    return card;
  }

  function render() {
    var root = document.getElementById('view-clients');
    MS.UI.clear(root);
    var clients = MS.state.store.clients;
    var totalPending = clients.reduce(function (n, c) { return n + pendingCount(c.schedule); }, 0);
    root.appendChild(el('h2', { class: 'view-title', text: 'Klienter' }));
    root.appendChild(el('p', { class: 'view-sub', text: clients.length + ' klient' + (clients.length === 1 ? '' : 'er') + ' · ' + totalPending + ' väntande förslag totalt' }));
    // Triage: klienter med väntande förslag överst. slice() så lagringsordningen inte ändras;
    // sort är stabil (ES2019) så lika många väntande behåller inbördes ordning.
    clients.slice()
      .sort(function (a, b) { return pendingCount(b.schedule) - pendingCount(a.schedule); })
      .forEach(function (c) { root.appendChild(clientCard(c)); });

    // Inline "lägg till klient" — ersätter window.prompt, som blockeras/ser oproffsig ut i
    // iOS-standalone (hemskärms-PWA). Formuläret döljs tills man trycker "+ Ny klient".
    var addBtn = el('button', { class: 'btn-add', id: 'cl-add-btn', text: '+ Ny klient', onclick: openAdd });
    var input = el('input', { type: 'text', class: 'in-label', id: 'cl-add-input', placeholder: 'Namn på ny klient',
      onkeydown: function (e) { if (e.key === 'Enter') doAdd(); else if (e.key === 'Escape') closeAdd(); } });
    var form = el('div', { class: 'cl-add-form', id: 'cl-add-form' }, [
      input,
      el('div', { class: 'edit-actions' }, [
        el('button', { class: 'btn', text: 'Lägg till', onclick: doAdd }),
        el('button', { class: 'btn secondary', text: 'Avbryt', onclick: closeAdd })
      ])
    ]);
    form.hidden = true;
    root.appendChild(addBtn);
    root.appendChild(form);
  }

  function openAdd() {
    var f = document.getElementById('cl-add-form'), b = document.getElementById('cl-add-btn');
    if (!f) return;
    f.hidden = false; if (b) b.hidden = true;
    var inp = document.getElementById('cl-add-input'); if (inp) { inp.value = ''; inp.focus(); }
  }
  function closeAdd() {
    var f = document.getElementById('cl-add-form'), b = document.getElementById('cl-add-btn');
    if (f) f.hidden = true; if (b) b.hidden = false;
  }
  function doAdd() {
    var inp = document.getElementById('cl-add-input');
    var name = inp ? inp.value.trim() : '';
    if (!name) { if (inp) inp.focus(); return; }
    MS.addClient(name); // re-renderar Klienter-vyn (formuläret stängs) och byter till nya klienten
  }

  MS.Views = MS.Views || {};
  MS.Views.Clients = { render: render, openAdd: openAdd };
})(window.MS);
