'use strict';
/* Pure logic for birthday-reminder-bd. No DOM, no storage, no network.
   All dates are ISO "YYYY-MM-DD" handled in UTC so results never depend on
   the viewer's timezone. Bengali strings live in i18n.js, not here. */

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  // m: 1-12
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// Strict ISO date validation. Returns {y, m, d} or null.
function parseISODate(str) {
  if (typeof str !== 'string') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return null;
  var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  return { y: y, m: mo, d: d };
}

function toUTC(parts) {
  return Date.UTC(parts.y, parts.m - 1, parts.d);
}

function isoOfUTC(ms) {
  var dt = new Date(ms);
  var y = dt.getUTCFullYear();
  var m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  var d = String(dt.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// Whole days from date a (ISO) to date b (ISO). b - a.
function daysBetween(aISO, bISO) {
  var a = parseISODate(aISO), b = parseISODate(bISO);
  if (!a || !b) return null;
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// Next birthday on/after asofISO for someone born on dobISO.
// Feb 29 birthdays are observed on Feb 28 in non-leap years (documented rule).
// Returns { date, daysUntil, ageTurning } or null on bad input.
function nextBirthday(dobISO, asofISO) {
  var dob = parseISODate(dobISO);
  var asof = parseISODate(asofISO);
  if (!dob || !asof) return null;
  var year = asof.y;
  for (var i = 0; i < 3; i++) {
    var day = dob.d;
    if (dob.m === 2 && dob.d === 29 && !isLeapYear(year)) day = 28;
    var cand = { y: year, m: dob.m, d: day };
    if (toUTC(cand) >= toUTC(asof)) {
      return {
        date: isoOfUTC(toUTC(cand)),
        daysUntil: Math.round((toUTC(cand) - toUTC(asof)) / 86400000),
        ageTurning: year - dob.y
      };
    }
    year++;
  }
  return null; // unreachable
}

// Badge category for an upcoming birthday.
function birthdayBadge(daysUntil, nextDateISO, asofISO) {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  if (daysUntil <= 7) return 'week';
  var n = parseISODate(nextDateISO), a = parseISODate(asofISO);
  if (n && a && n.y === a.y && n.m === a.m) return 'month';
  return 'later';
}

// People sorted by days until next birthday, then by name (locale-independent).
function sortUpcoming(people, asofISO) {
  var withNext = people.map(function (p) {
    var nb = nextBirthday(p.dob, asofISO);
    return { person: p, next: nb };
  }).filter(function (x) { return x.next !== null; });
  withNext.sort(function (a, b) {
    if (a.next.daysUntil !== b.next.daysUntil) return a.next.daysUntil - b.next.daysUntil;
    return a.person.name < b.person.name ? -1 : (a.person.name > b.person.name ? 1 : 0);
  });
  return withNext;
}

var RELATIONS = ['family', 'friend', 'colleague', 'other'];

// Validate one person record. Returns array of error keys (empty = valid).
function validatePerson(p, asofISO) {
  var errs = [];
  if (!p || typeof p !== 'object') return ['invalid'];
  if (typeof p.name !== 'string' || p.name.trim().length === 0) errs.push('nameRequired');
  if (p.name && p.name.trim().length > 80) errs.push('nameTooLong');
  var dob = parseISODate(p.dob);
  if (!dob) {
    errs.push('dobInvalid');
  } else if (asofISO) {
    if (daysBetween(p.dob, asofISO) < 0) errs.push('dobFuture');
    if (dob.y < 1900) errs.push('dobTooOld');
  }
  if (p.relation && RELATIONS.indexOf(p.relation) === -1) errs.push('relationInvalid');
  if (p.note != null && typeof p.note !== 'string') errs.push('noteInvalid');
  if (p.note && p.note.length > 300) errs.push('noteTooLong');
  if (p.giftIdea != null && typeof p.giftIdea !== 'string') errs.push('giftInvalid');
  if (p.giftIdea && p.giftIdea.length > 200) errs.push('giftTooLong');
  return errs;
}

// Dashboard counts for a people list at asofISO.
function dashboardStats(people, asofISO) {
  var upcoming = sortUpcoming(people, asofISO);
  var stats = { total: people.length, today: 0, week: 0, month: 0 };
  upcoming.forEach(function (x) {
    var b = birthdayBadge(x.next.daysUntil, x.next.date, asofISO);
    if (b === 'today') stats.today++;
    if (x.next.daysUntil <= 7) stats.week++;
    var n = parseISODate(x.next.date), a = parseISODate(asofISO);
    if (n && a && n.y === a.y && n.m === a.m) stats.month++;
  });
  return stats;
}

// Strict import validation. Accepts the exact export shape:
// { app: "birthday-reminder-bd", version: 1, exportedAt: ISO, people: [...] }
// Returns { ok: true, people } or { ok: false, errors: [keys] }.
function validateImport(data, asofISO) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['notObject'] };
  if (data.app !== 'birthday-reminder-bd') return { ok: false, errors: ['wrongApp'] };
  if (data.version !== 1) return { ok: false, errors: ['wrongVersion'] };
  if (!Array.isArray(data.people)) return { ok: false, errors: ['peopleNotArray'] };
  if (data.people.length > 500) return { ok: false, errors: ['tooMany'] };
  var seen = new Set();
  var clean = [];
  for (var i = 0; i < data.people.length; i++) {
    var p = data.people[i];
    var errs = validatePerson(p, asofISO);
    if (errs.length) return { ok: false, errors: ['personInvalid', String(i)] };
    var key = p.name.trim().toLowerCase() + '|' + p.dob;
    if (seen.has(key)) return { ok: false, errors: ['duplicate'] };
    seen.add(key);
    clean.push({
      id: typeof p.id === 'string' && p.id ? p.id : 'imp-' + i + '-' + Date.now(),
      name: p.name.trim(),
      dob: p.dob,
      relation: p.relation || 'other',
      note: p.note || '',
      giftIdea: p.giftIdea || ''
    });
  }
  return { ok: true, people: clean };
}

// Convert Western digits 0-9 in a string to Bengali digits.
function toBengaliDigits(str) {
  var map = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  return String(str).replace(/[0-9]/g, function (ch) { return map[Number(ch)]; });
}

// Format an ISO date for display. In Bengali mode digits become Bengali digits
// and month names come from the BN month table (in i18n.js, passed in).
function formatDate(iso, lang, monthNames) {
  var p = parseISODate(iso);
  if (!p) return iso;
  var out = monthNames[p.m - 1] + ' ' + p.d + ', ' + p.y;
  return lang === 'bn' ? toBengaliDigits(out) : out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isLeapYear: isLeapYear, daysInMonth: daysInMonth, parseISODate: parseISODate,
    toUTC: toUTC, isoOfUTC: isoOfUTC, daysBetween: daysBetween,
    nextBirthday: nextBirthday, birthdayBadge: birthdayBadge,
    sortUpcoming: sortUpcoming, RELATIONS: RELATIONS,
    validatePerson: validatePerson, dashboardStats: dashboardStats,
    validateImport: validateImport, toBengaliDigits: toBengaliDigits,
    formatDate: formatDate
  };
}
