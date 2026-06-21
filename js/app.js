/*
 * app.js — bootstrap + enkel vy-router + delade UI-hjälpare (MS.UI).
 * Laddas sist. Vyerna (MS.Views.*) definieras i js/views/.
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';

  // Liten DOM-byggare: el('div', {class:'x', onclick:fn}, [barn ...])
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!attrs.hasOwnProperty(k)) continue;
      var v = attrs[k];
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v;
      else if (v != null) n.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  MS.UI = { el: el, clear: clear };

  MS.state = { store: null, schedule: null, clientId: null, current: 'today', role: 'klient' };
  var VIEWS = ['today', 'schedule', 'week', 'requests', 'clients'];

  // ---- Klienter (caseload) + lagring på store-nivå ----
  function save() { MS.Storage.save(MS.state.store); }
  MS.save = save;

  function activeClient() {
    var s = MS.state.store;
    return s.clients.filter(function (c) { return c.id === MS.state.clientId; })[0] || s.clients[0];
  }
  function useClient(id) {
    MS.state.clientId = id;
    MS.state.store.activeClientId = id;
    MS.state.schedule = activeClient().schedule;
  }
  function setActiveClient(id) { useClient(id); save(); renderClientBar(); renderCurrent(); }
  MS.setActiveClient = setActiveClient;

  function addClient(name) {
    var id = 'c' + Date.now() + Math.floor(Math.random() * 1000);
    MS.state.store.clients.push({ id: id, name: name || ('Klient ' + (MS.state.store.clients.length + 1)), schedule: MS.Storage.defaultSchedule() });
    useClient(id); save(); renderClientBar(); renderCurrent();
  }
  MS.addClient = addClient;

  // Byt ut aktiv klients schema (reset / importerad backup) utan att tappa store-referensen.
  function replaceActiveSchedule(sched) {
    activeClient().schedule = sched;
    MS.state.schedule = sched;
    save();
  }
  MS.replaceActiveSchedule = replaceActiveSchedule;

  function wireClientBar() {
    var sel = document.getElementById('client-select');
    if (sel) sel.addEventListener('change', function (e) { setActiveClient(e.target.value); });
    var add = document.getElementById('client-add');
    if (add) add.addEventListener('click', function () {
      var name = window.prompt('Namn på ny klient:', 'Klient ' + (MS.state.store.clients.length + 1));
      if (name) addClient(name);
    });
  }
  function renderClientBar() {
    var sel = document.getElementById('client-select');
    if (!sel) return;
    clear(sel);
    MS.state.store.clients.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      if (c.id === MS.state.clientId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderCurrent() {
    var v = MS.state.current;
    if (v === 'today') MS.Views.Today.render();
    else if (v === 'schedule') MS.Views.Schedule.render();
    else if (v === 'week') MS.Views.Week.render();
    else if (v === 'requests') MS.Views.Requests.render();
    else if (v === 'clients') MS.Views.Clients.render();
  }

  function show(name) {
    MS.state.current = name;
    VIEWS.forEach(function (v) {
      document.getElementById('view-' + v).classList.toggle('hidden', v !== name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav .nav-item'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === name);
    });
    renderCurrent();
    window.scrollTo(0, 0);
  }

  var ROLE_KEY = 'mittschema.role';
  function loadRole() { try { var r = localStorage.getItem(ROLE_KEY); return (r === 'handlaggare' || r === 'klient') ? r : 'klient'; } catch (e) { return 'klient'; } }
  function saveRole(r) { try { localStorage.setItem(ROLE_KEY, r); } catch (e) {} }

  // Demo-rollväxel: formar om nav + vyer (i skarp produkt = inloggning, inte en knapp).
  function applyRoleUI(role) {
    var app = document.querySelector('.app');
    app.classList.toggle('role-klient', role === 'klient');
    app.classList.toggle('role-handlaggare', role === 'handlaggare');
    Array.prototype.forEach.call(document.querySelectorAll('.role-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-role') === role);
    });
    var lbl = document.querySelector('[data-view="requests"] .lbl');
    if (lbl) lbl.textContent = (role === 'klient') ? 'Ansökningar' : 'Förslag';
  }

  function setRole(role) {
    MS.state.role = role;
    saveRole(role);
    applyRoleUI(role);
    // Klienten saknar Schema-fliken -> hoppa till Idag om man stod där.
    if (role === 'klient' && MS.state.current === 'schedule') show('today');
    else renderCurrent();
  }
  MS.setRole = setRole;

  // Spårbarhet: lägg en händelse i loggen (vem/vad/när).
  function logEvent(action, detail) {
    var sc = MS.state.schedule;
    sc.log = sc.log || [];
    sc.log.push({ ts: new Date().toISOString(), role: MS.state.role, action: action, detail: detail });
    save();
  }
  MS.logEvent = logEvent;

  function init() {
    MS.state.store = MS.Storage.load();
    useClient(MS.state.store.activeClientId);
    MS.state.role = loadRole();
    Array.prototype.forEach.call(document.querySelectorAll('.nav .nav-item'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.role-btn'), function (b) {
      b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); });
    });
    wireClientBar();
    applyRoleUI(MS.state.role);
    renderClientBar();
    show('today');
    // Idag-vyn har nedräkning -> uppdatera var 30:e sekund när den visas.
    setInterval(function () { if (MS.state.current === 'today') MS.Views.Today.render(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderCurrent(); });
  }

  document.addEventListener('DOMContentLoaded', init);
  MS.show = show;
})(window.MS);
