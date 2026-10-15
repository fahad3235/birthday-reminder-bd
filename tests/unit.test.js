'use strict';
/* Node unit tests for birthday-reminder-bd logic.js. Run: node tests/unit.test.js */
const assert = require('assert');
const L = require('../js/logic.js');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok - ' + name); }

// --- date parsing ---
check('parseISODate valid', () => {
  assert.deepStrictEqual(L.parseISODate('2026-10-15'), { y: 2026, m: 10, d: 15 });
});
check('parseISODate rejects bad dates', () => {
  assert.strictEqual(L.parseISODate('2026-02-30'), null);
  assert.strictEqual(L.parseISODate('2026-13-01'), null);
  assert.strictEqual(L.parseISODate('15-10-2026'), null);
  assert.strictEqual(L.parseISODate(''), null);
  assert.strictEqual(L.parseISODate(null), null);
  assert.deepStrictEqual(L.parseISODate('2024-02-29'), { y: 2024, m: 2, d: 29 });
});
check('leap years', () => {
  assert.strictEqual(L.isLeapYear(2024), true);
  assert.strictEqual(L.isLeapYear(2100), false);
  assert.strictEqual(L.isLeapYear(2000), true);
});

// --- nextBirthday ---
check('nextBirthday same day = today, age turning', () => {
  const nb = L.nextBirthday('1990-10-15', '2026-10-15');
  assert.deepStrictEqual(nb, { date: '2026-10-15', daysUntil: 0, ageTurning: 36 });
});
check('nextBirthday tomorrow', () => {
  const nb = L.nextBirthday('2000-10-16', '2026-10-15');
  assert.deepStrictEqual(nb, { date: '2026-10-16', daysUntil: 1, ageTurning: 26 });
});
check('nextBirthday rolls to next year', () => {
  const nb = L.nextBirthday('1995-01-05', '2026-10-15');
  assert.deepStrictEqual(nb, { date: '2027-01-05', daysUntil: 82, ageTurning: 32 });
});
check('nextBirthday Feb 29 observed Feb 28 in non-leap year', () => {
  const nb = L.nextBirthday('2000-02-29', '2026-02-01');
  assert.deepStrictEqual(nb, { date: '2026-02-28', daysUntil: 27, ageTurning: 26 });
});
check('nextBirthday Feb 29 kept in leap year', () => {
  const nb = L.nextBirthday('2000-02-29', '2028-02-01');
  assert.deepStrictEqual(nb, { date: '2028-02-29', daysUntil: 28, ageTurning: 28 });
});
check('nextBirthday Feb 29 just passed in non-leap year -> next Feb 28', () => {
  const nb = L.nextBirthday('2000-02-29', '2026-03-01');
  assert.strictEqual(nb.date, '2027-02-28');
  assert.strictEqual(nb.ageTurning, 27);
});
check('nextBirthday bad input null', () => {
  assert.strictEqual(L.nextBirthday('bogus', '2026-10-15'), null);
});

// --- badges ---
check('birthdayBadge categories', () => {
  assert.strictEqual(L.birthdayBadge(0, '2026-10-15', '2026-10-15'), 'today');
  assert.strictEqual(L.birthdayBadge(1, '2026-10-16', '2026-10-15'), 'tomorrow');
  assert.strictEqual(L.birthdayBadge(7, '2026-10-22', '2026-10-15'), 'week');
  assert.strictEqual(L.birthdayBadge(8, '2026-10-23', '2026-10-15'), 'month');
  assert.strictEqual(L.birthdayBadge(60, '2026-12-14', '2026-10-15'), 'later');
  assert.strictEqual(L.birthdayBadge(20, '2026-11-04', '2026-10-15'), 'later');
});

// --- sorting ---
check('sortUpcoming orders by daysUntil then name', () => {
  const people = [
    { name: 'Zara', dob: '1990-10-20' },
    { name: 'Amin', dob: '1990-10-15' },
    { name: 'Bina', dob: '1990-10-20' }
  ];
  const sorted = L.sortUpcoming(people, '2026-10-15');
  assert.deepStrictEqual(sorted.map(x => x.person.name), ['Amin', 'Bina', 'Zara']);
});

// --- validation ---
check('validatePerson accepts valid record', () => {
  assert.deepStrictEqual(L.validatePerson(
    { name: 'Sadia', dob: '2000-05-01', relation: 'friend', note: '', giftIdea: '' }, '2026-10-15'), []);
});
check('validatePerson rejects bad records', () => {
  assert.ok(L.validatePerson({ name: '  ', dob: '2000-05-01' }, '2026-10-15').includes('nameRequired'));
  assert.ok(L.validatePerson({ name: 'X'.repeat(81), dob: '2000-05-01' }, '2026-10-15').includes('nameTooLong'));
  assert.ok(L.validatePerson({ name: 'A', dob: '2026-02-30' }, '2026-10-15').includes('dobInvalid'));
  assert.ok(L.validatePerson({ name: 'A', dob: '2027-01-01' }, '2026-10-15').includes('dobFuture'));
  assert.ok(L.validatePerson({ name: 'A', dob: '1899-01-01' }, '2026-10-15').includes('dobTooOld'));
  assert.ok(L.validatePerson({ name: 'A', dob: '2000-05-01', relation: 'alien' }, '2026-10-15').includes('relationInvalid'));
});

// --- dashboard stats ---
check('dashboardStats counts', () => {
  const people = [
    { name: 'Today', dob: '1990-10-15' },
    { name: 'Week', dob: '1990-10-18' },
    { name: 'Month', dob: '1990-10-30' },
    { name: 'Later', dob: '1990-12-25' }
  ];
  assert.deepStrictEqual(L.dashboardStats(people, '2026-10-15'),
    { total: 4, today: 1, week: 2, month: 3 });
});

// --- import validation ---
check('validateImport accepts good export', () => {
  const res = L.validateImport({ app: 'birthday-reminder-bd', version: 1, exportedAt: '2026-10-15',
    people: [{ name: 'Sadia', dob: '2000-05-01', relation: 'friend' }] }, '2026-10-15');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.people[0].name, 'Sadia');
  assert.strictEqual(res.people[0].note, '');
});
check('validateImport rejects bad shapes', () => {
  assert.strictEqual(L.validateImport(null, '2026-10-15').ok, false);
  assert.strictEqual(L.validateImport({ app: 'other', version: 1, people: [] }, '2026-10-15').ok, false);
  assert.strictEqual(L.validateImport({ app: 'birthday-reminder-bd', version: 2, people: [] }, '2026-10-15').ok, false);
  assert.strictEqual(L.validateImport({ app: 'birthday-reminder-bd', version: 1, people: 'no' }, '2026-10-15').ok, false);
  assert.strictEqual(L.validateImport({ app: 'birthday-reminder-bd', version: 1,
    people: [{ name: 'A', dob: '2030-01-01' }] }, '2026-10-15').ok, false);
  const dup = { app: 'birthday-reminder-bd', version: 1, people: [
    { name: 'A', dob: '2000-01-01' }, { name: 'a', dob: '2000-01-01' }] };
  assert.strictEqual(L.validateImport(dup, '2026-10-15').ok, false);
});

// --- Bengali digits + formatting ---
check('toBengaliDigits', () => {
  assert.strictEqual(L.toBengaliDigits('36'), '\u09e9\u09ec');
  assert.strictEqual(L.toBengaliDigits('2026-10-15'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e6-\u09e7\u09eb');
  assert.strictEqual(L.toBengaliDigits('abc'), 'abc');
});
check('formatDate EN and BN', () => {
  assert.strictEqual(L.formatDate('2000-05-01', 'en', ['January', 'February', 'March', 'April', 'May']),
    'May 1, 2000');
  assert.strictEqual(L.formatDate('2000-05-01', 'bn', ['x', 'x', 'x', 'x', '\u09ae\u09c7']),
    '\u09ae\u09c7 \u09e7, \u09e8\u09e6\u09e6\u09e6');
});

console.log('ALL ' + passed + ' UNIT CHECKS PASSED');
