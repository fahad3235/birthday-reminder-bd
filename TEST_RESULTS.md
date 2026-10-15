# TEST_RESULTS.md \u2014 birthday-reminder-bd (run #63, 2026-10-15)

## Unit tests \u2014 19/19 PASS

`node tests/unit.test.js` \u2014 pure-logic checks on `js/logic.js`, no browser.

Hand-verified values asserted:

- `nextBirthday('1990-10-15', '2026-10-15')` -> `{ date: '2026-10-15', daysUntil: 0, ageTurning: 36 }`
- `nextBirthday('2000-10-16', '2026-10-15')` -> `{ date: '2026-10-16', daysUntil: 1, ageTurning: 26 }`
- `nextBirthday('1995-01-05', '2026-10-15')` -> `{ date: '2027-01-05', daysUntil: 82, ageTurning: 32 }`
- Feb 29 -> Feb 28 in non-leap year: `nextBirthday('2000-02-29', '2026-02-01')` ->
  `{ date: '2026-02-28', daysUntil: 27, ageTurning: 26 }`
- Feb 29 kept in leap year: `nextBirthday('2000-02-29', '2028-02-01')` ->
  `{ date: '2028-02-29', daysUntil: 28, ageTurning: 28 }`
- Feb 29 just passed in a non-leap year rolls to the next observed Feb 28:
  `nextBirthday('2000-02-29', '2026-03-01')` -> `2027-02-28`, age 27.
- Badge boundaries: 0 -> today, 1 -> tomorrow, 7 -> week, 8 (same month) -> month,
  20 (next month) -> later.
- Dashboard stats on 4 people (today / +3d / +15d / +71d):
  `{ total: 4, today: 1, week: 2, month: 3 }`.
- Import validation rejects: non-object, wrong app, wrong version,
  non-array people, invalid person (future DOB), duplicate name+DOB.
- Bengali digits: `'36'` -> Bengali '36', `'2026-10-15'` -> Bengali '2026-10-15'.

One test-side fix during the run: the initial expectation for
`nextBirthday('2000-02-29', '2026-03-01')` was `2028-02-29`; the correct
next *observed* birthday is `2027-02-28` (Feb 28 in the non-leap year 2027).
The app logic was correct; the test was fixed.

## Headless-Chrome smoke \u2014 36/36 PASS

`node tests/smoke.mjs` \u2014 raw CDP against `/opt/meta-chromium/chrome`,
`file://\u2026/index.html?asof=2026-10-15`. 0 console errors, 0 page exceptions.

Covered: empty state, stats zero -> add person born today (card shows
"turns 36", Today badge, gift idea, stats 1/1) -> add person +3d ("in 3
day(s)", stats week 2 / month 2) -> empty-name inline error, no phantom card
-> future-DOB inline error -> All-tab search narrows 2->1->2 -> month filter
(December -> "No people match") -> BN toggle (Bengali title + digits '2' in Bengali,
lang persisted) -> reload persistence -> export shape -> wipe -> import
round-trip restores 2 -> `validateImport` rejects wrong-app / future-DOB ->
delete removes one -> clear-all rejects wrong word, accepts `DELETE` ->
390px no-overflow on all three tabs.

One genuine app fix during the run: the Today/Tomorrow cards did not show
the turning age ("Today is their birthday!" with no age). Fixed in
`js/app.js` \u2014 they now read "Today is their birthday! turns 36".

## Hygiene

- All source files pure ASCII (Bengali emitted as `\uXXXX` escapes);
  verified with `grep -rP '[^\x00-\x7F]'` -> zero matches.
- Zero network requests by design (static file:// page, no CDN).
- localStorage keys: `birthday-reminder-bd:v1` (data), `birthday-reminder-bd:lang`.
