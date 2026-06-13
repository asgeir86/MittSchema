/*
 * views/today.js — Idag-vyn. Status (grön/röd), tidslinje, ute-tider, permission.
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  var S = MS.Schedule;
  function el(id) { return document.getElementById(id); }

  function render(now) {
    now = now || new Date();
    var schedule = MS.state.schedule;

    el('today-date').textContent = S.formatDateLong(now);

    var status = S.getStatusAt(now, schedule);
    var isOut = status.state === 'ute';
    var card = el('status-card');
    card.classList.toggle('ute', isOut);
    card.classList.toggle('inne', !isOut);
    el('status-emoji').textContent = isOut ? '🟢' : '🔴';
    el('status-title').textContent = isOut ? 'Du får vara ute' : 'Du måste vara inne';

    var sub;
    if (status.changeAt) {
      var rel = S.formatRelativeDay(status.changeAt, now);
      var t = S.minToTime(status.changeAt.getHours() * 60 + status.changeAt.getMinutes());
      var when = (rel === 'idag' ? '' : rel + ' ') + t;
      sub = (isOut ? 'Inne igen ' : 'Får gå ut ') + when + ' · om ' + S.formatCountdown(status.changeAt - now);
    } else {
      sub = isOut ? 'Inga fler ändringar planerade' : 'Inga ute-tider planerade framåt';
    }
    el('status-sub').textContent = sub;

    renderTimeline(now, schedule);
    renderWindowList(status.windows);
    renderPermission(now, schedule);
  }

  function renderTimeline(now, schedule) {
    var bar = el('timeline-bar');
    bar.innerHTML = '';
    S.mergeWindows(S.getOutWindowsForDate(now, schedule)).forEach(function (w) {
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.left = (w.startMin / 1440 * 100) + '%';
      seg.style.width = ((w.endMin - w.startMin) / 1440 * 100) + '%';
      bar.appendChild(seg);
    });
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var marker = document.createElement('div');
    marker.className = 'now-marker';
    marker.style.left = (nowMin / 1440 * 100) + '%';
    bar.appendChild(marker);
  }

  function renderWindowList(windows) {
    var ul = el('window-list');
    ul.innerHTML = '';
    if (!windows.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Inga ute-tider idag – du ska vara inne hela dygnet.';
      ul.appendChild(li);
      return;
    }
    windows.forEach(function (w) {
      var row = document.createElement('li');
      if (w.permission) row.classList.add('perm');
      var time = document.createElement('span');
      time.className = 'win-time';
      time.textContent = S.minToTime(w.startMin) + '–' + S.minToTime(w.endMin);
      var label = document.createElement('span');
      label.className = 'win-label';
      label.textContent = w.label || 'Ute';
      row.appendChild(time);
      row.appendChild(label);
      ul.appendChild(row);
    });
  }

  function renderPermission(now, schedule) {
    var st = S.permissionStatsForMonth(now, schedule);
    el('perm-summary').textContent =
      'Permission denna månad: ' + st.count + ' av ' + st.maxCount + ' tillfällen · ' +
      st.hours + ' av ' + st.maxHours + ' tim';
  }

  MS.Views = MS.Views || {};
  MS.Views.Today = { render: render };
})(window.MS);
