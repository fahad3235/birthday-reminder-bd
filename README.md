# Birthday Reminder BD

Offline, bilingual (EN / Bangla) birthday & anniversary reminder for Bangladesh.
Add the people you care about -- family, friends, colleagues -- and see at a
glance whose birthday is today, this week, or this month, and what age they
are turning. Everything stays in your browser: no account, no server, no
network requests.

## Features

- **People CRUD** -- add, edit, delete people with name, date of birth,
  relation (Family / Friend / Colleague / Other), an optional note, and an
  optional gift idea. Inline validation (name required, valid date, no
  future birthdays, length limits).
- **Upcoming birthdays** -- sorted by days until the next birthday, with
  Today / Tomorrow / This week / This month badges and the age they are
  turning ("turns 36"). Feb 29 birthdays are observed on Feb 28 in
  non-leap years (documented rule, tested).
- **Dashboard stats** -- total people, birthdays today, this week, this month.
- **All People view** -- live search by name or note, filter by birthday
  month and by relation.
- **Data portability** -- JSON export / import with strict validation
  (wrong app, wrong version, invalid person, duplicates, and future dates
  are all rejected with data left intact). Typed-`DELETE` erase-all guard.
- **Bilingual + Bengali digits** -- EN / Bangla toggle persisted in
  localStorage; numbers render in Bengali digits in BN mode.
- **Mobile-friendly** -- verified no horizontal overflow at 390px width on
  every tab. Zero network requests by design.

## Stack

Vanilla HTML + CSS + JavaScript. No frameworks, no build step, no
dependencies. Pure date math in `js/logic.js` (UTC-based, timezone-safe),
i18n strings in `js/i18n.js`, DOM glue in `js/app.js`.

## Prerequisites

Any modern browser. For tests: Node.js 18+ and Chromium
(`/opt/meta-chromium/chrome` on this VM, or any Chrome/Chromium for the
smoke test's `CHROME` constant).

## Run

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

For deterministic dates (used by tests), append `?asof=YYYY-MM-DD`, e.g.
`index.html?asof=2026-10-15`.

## Testing

```sh
node tests/unit.test.js   # 19 pure-logic checks (no browser)
node tests/smoke.mjs      # 36 headless-Chrome checks (raw CDP)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the verified results of this
release, including hand-verified numbers.

## Deployment

Static site -- copy the folder to any static host, or enable GitHub Pages
on the repo (main branch, root). No server, no environment variables.

## Limitations

- **Personal reminder only.** It does not connect to any calendar,
  contacts app, or notification service, so it cannot remind you when the
  tab is closed. Check the Upcoming tab, or export a backup.
- **Single-browser storage.** Data lives in `localStorage` on one
  browser/device. Use Export JSON to move or back it up.
- **Feb 29 rule.** Leap-day birthdays are celebrated on Feb 28 in
  non-leap years -- a common convention, not a universal rule.
- **No notifications.** Browser Notification API reminders are not
  implemented in this version.

## Status

MVP complete. 19/19 unit checks + 36/36 headless-Chrome smoke checks pass,
0 console errors, 0 page exceptions, all sources pure ASCII.
