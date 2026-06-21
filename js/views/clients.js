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

  function clientCard(c) {
    var st = S.getStatusAt(new Date(), c.schedule);
    var out = st.state === 'ute';
    var pending = pendingCount(c.schedule);
    var card = el('div', { class: 'cl-card' + (c.id === MS.state.clientId ? ' active' : ''),
      onclick: function () { MS.setActiveClient(c.id); MS.show('today'); } });
    card.appendChild(el('div', { class: 'cl-head' }, [
      el('span', { class: 'cl-name', text: c.name }),
      el('span', { class: 'cl-status ' + (out ? 'ute' : 'inne') }, [el('span', { class: 'cl-dot' }), out ? 'Ute nu' : 'Inne nu'])
    ]));
    card.appendChild(el('div', { class: 'cl-meta' }, [
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
    clients.forEach(function (c) { root.appendChild(clientCard(c)); });
    root.appendChild(el('button', { class: 'btn-add', text: '+ Ny klient',
      onclick: function () {
        var name = window.prompt('Namn på ny klient:', 'Klient ' + (clients.length + 1));
        if (name) MS.addClient(name);
      } }));
  }

  MS.Views = MS.Views || {};
  MS.Views.Clients = { render: render };
})(window.MS);
