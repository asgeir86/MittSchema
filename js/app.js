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

  MS.state = { schedule: null, current: 'today', role: 'klient' };
  var VIEWS = ['today', 'schedule', 'week', 'requests'];

  function renderCurrent() {
    var v = MS.state.current;
    if (v === 'today') MS.Views.Today.render();
    else if (v === 'schedule') MS.Views.Schedule.render();
    else if (v === 'week') MS.Views.Week.render();
    else if (v === 'requests') MS.Views.Requests.render();
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

  function init() {
    MS.state.schedule = MS.Storage.load();
    MS.state.role = loadRole();
    Array.prototype.forEach.call(document.querySelectorAll('.nav .nav-item'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.role-btn'), function (b) {
      b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); });
    });
    applyRoleUI(MS.state.role);
    show('today');
    // Idag-vyn har nedräkning -> uppdatera var 30:e sekund när den visas.
    setInterval(function () { if (MS.state.current === 'today') MS.Views.Today.render(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderCurrent(); });
  }

  document.addEventListener('DOMContentLoaded', init);
  MS.show = show;
})(window.MS);
