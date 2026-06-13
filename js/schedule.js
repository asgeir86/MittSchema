/*
 * schedule.js — ren, deterministisk schemalogik (ingen DOM, inga sidoeffekter).
 * Allt tidsberoende skickas in (now), så logiken går att testa och återanvända
 * senare i den tvåsidiga versionen (handläggare/klient).
 *
 * Datamodell (sparas i localStorage):
 *   {
 *     version: 1,
 *     weekly:   { 1..7: [ {start:"07:00", end:"16:00", label:"Arbete"} ] },  // 1=mån .. 7=sön
 *     overrides:{ "YYYY-MM-DD": [ {start,end,label} ] },                      // ersätter veckomönstret den dagen
 *     permissions: [ {start:"YYYY-MM-DDTHH:mm", end:"...", label:"Permission"} ]
 *   }
 * "Ute-fönster" = tider då du FÅR vara ute (grönt). Övrig tid = inne (rött).
 */
window.MS = window.MS || {};
(function (MS) {
  'use strict';

  var WEEKDAY_LONG  = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  var WEEKDAY_SHORT = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  var MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // "07:30" -> 450 (minuter sedan midnatt)
  function parseTime(str) {
    var p = String(str).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  // 450 -> "07:30" (1440 -> "24:00" tillåts som sluttid)
  function minToTime(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return pad2(h) + ':' + pad2(m);
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  // JS getDay(): sön=0..lör=6  ->  ISO: mån=1..sön=7
  function isoWeekday(date) { return (date.getDay() + 6) % 7 + 1; }

  // Skapar ett Date på samma dygn som ref, vid angivet minutvärde (1440 = midnatt nästa dygn).
  function makeDate(ref, minutes) {
    var d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    d.setMinutes(minutes);
    return d;
  }

  function formatDateLong(date) {
    return WEEKDAY_LONG[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
  }

  // "idag" / "imorgon" / "lör 14 juni" relativt now
  function formatRelativeDay(date, now) {
    var k = dateKey(date);
    if (k === dateKey(now)) return 'idag';
    var t = new Date(now); t.setDate(t.getDate() + 1);
    if (k === dateKey(t)) return 'imorgon';
    return WEEKDAY_SHORT[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
  }

  // millisekunder -> "2 tim 15 min" / "45 min" / "1 dygn 3 tim"
  function formatCountdown(ms) {
    var min = Math.round(ms / 60000);
    if (min < 1) return 'strax';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + ' tim' + (m ? ' ' + m + ' min' : '');
    var d = Math.floor(h / 24); h = h % 24;
    return d + ' dygn' + (h ? ' ' + h + ' tim' : '');
  }

  // Sorterade ute-fönster för en given dag (override > veckomönster), med etiketter bevarade.
  // Permission-perioder som överlappar dagen läggs till som ute-fönster.
  function getOutWindowsForDate(date, schedule) {
    var key = dateKey(date), base;
    if (schedule.overrides && schedule.overrides[key]) {
      base = schedule.overrides[key];
    } else {
      var wd = isoWeekday(date);
      var pat = weekPatternForDate(date, schedule);
      base = (pat && pat[wd]) ? pat[wd] : [];
    }
    var wins = base.map(function (w) {
      return { startMin: parseTime(w.start), endMin: parseTime(w.end), label: w.label || 'Ute' };
    });

    if (schedule.permissions && schedule.permissions.length) {
      var dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      var dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      schedule.permissions.forEach(function (p) {
        var ps = new Date(p.start), pe = new Date(p.end);
        if (pe > dayStart && ps < dayEnd) {
          var s = Math.max(0, Math.round((Math.max(ps, dayStart) - dayStart) / 60000));
          var e = Math.min(1440, Math.round((Math.min(pe, dayEnd) - dayStart) / 60000));
          if (e > s) wins.push({ startMin: s, endMin: e, label: p.label || 'Permission', permission: true });
        }
      });
    }
    return wins.sort(function (a, b) { return a.startMin - b.startMin || a.endMin - b.endMin; });
  }

  // Slår ihop överlappande/angränsande fönster till sammanhängande täckning (för status/tidslinje).
  function mergeWindows(wins) {
    var sorted = wins.slice().sort(function (a, b) { return a.startMin - b.startMin || a.endMin - b.endMin; });
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      var w = sorted[i], last = out[out.length - 1];
      if (last && w.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, w.endMin);
      } else {
        out.push({ startMin: w.startMin, endMin: w.endMin });
      }
    }
    return out;
  }

  // Status vid 'now': ute/inne + när nästa ändring sker (söker upp till 14 dagar framåt).
  function getStatusAt(now, schedule) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var windows = getOutWindowsForDate(now, schedule);
    var merged = mergeWindows(windows);

    var i, w;
    for (i = 0; i < merged.length; i++) {
      w = merged[i];
      if (nowMin >= w.startMin && nowMin < w.endMin) {
        return { state: 'ute', windows: windows, changeAt: makeDate(now, w.endMin), changeTo: 'inne' };
      }
    }
    for (i = 0; i < merged.length; i++) {
      if (merged[i].startMin > nowMin) {
        return { state: 'inne', windows: windows, changeAt: makeDate(now, merged[i].startMin), changeTo: 'ute' };
      }
    }
    for (var d = 1; d <= 14; d++) {
      var fut = new Date(now); fut.setDate(fut.getDate() + d); fut.setHours(0, 0, 0, 0);
      var fm = mergeWindows(getOutWindowsForDate(fut, schedule));
      if (fm.length) {
        return { state: 'inne', windows: windows, changeAt: makeDate(fut, fm[0].startMin), changeTo: 'ute' };
      }
    }
    return { state: 'inne', windows: windows, changeAt: null, changeTo: null };
  }

  // Permission-statistik för den kalendermånad 'date' ligger i (räknas på startdatum).
  function permissionStatsForMonth(date, schedule) {
    var y = date.getFullYear(), m = date.getMonth(), count = 0, hours = 0;
    (schedule.permissions || []).forEach(function (p) {
      var ps = new Date(p.start);
      if (ps.getFullYear() === y && ps.getMonth() === m) {
        count++;
        hours += (new Date(p.end) - ps) / 3600000;
      }
    });
    return { count: count, hours: Math.round(hours), maxCount: 4, maxHours: 72 };
  }

  function weekdayLongByIso(iso) { return WEEKDAY_LONG[iso % 7]; }
  function weekdayShortByIso(iso) { return WEEKDAY_SHORT[iso % 7]; }

  // ISO-veckonummer (måndag = veckans första dag).
  function isoWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // torsdagen i veckan
    var firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
    return 1 + Math.round((d - firstThu) / 6048e5);
  }

  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  // Rotationsindex (0-baserat) för datumets vecka, givet anchor-måndagen.
  function weekIndexForDate(date, schedule) {
    var weeks = schedule.weeks;
    if (!weeks || weeks.length <= 1) return 0;
    var L = weeks.length;
    var anchor = schedule.rotationAnchorMonday ? new Date(schedule.rotationAnchorMonday + 'T00:00') : date;
    var diff = Math.round((mondayOf(date) - mondayOf(anchor)) / 6048e5);
    return ((diff % L) + L) % L;
  }

  // Veckomönstret (1..7) som gäller för datumet (roterande schema + bakåtkompatibilitet).
  function weekPatternForDate(date, schedule) {
    var weeks = schedule.weeks;
    if (!weeks || !weeks.length) return schedule.weekly || {};
    return weeks[weekIndexForDate(date, schedule)] || {};
  }

  // Sätt anchor så att innevarande vecka får mönster-index k.
  function setCurrentWeekIndex(schedule, k) {
    var m = mondayOf(new Date());
    m.setDate(m.getDate() - k * 7);
    schedule.rotationAnchorMonday = dateKey(m);
  }

  MS.Schedule = {
    parseTime: parseTime,
    minToTime: minToTime,
    dateKey: dateKey,
    isoWeekday: isoWeekday,
    formatDateLong: formatDateLong,
    formatRelativeDay: formatRelativeDay,
    formatCountdown: formatCountdown,
    getOutWindowsForDate: getOutWindowsForDate,
    mergeWindows: mergeWindows,
    getStatusAt: getStatusAt,
    permissionStatsForMonth: permissionStatsForMonth,
    weekdayLongByIso: weekdayLongByIso,
    weekdayShortByIso: weekdayShortByIso,
    isoWeekNumber: isoWeekNumber,
    mondayOf: mondayOf,
    weekIndexForDate: weekIndexForDate,
    weekPatternForDate: weekPatternForDate,
    setCurrentWeekIndex: setCurrentWeekIndex
  };
})(window.MS);
