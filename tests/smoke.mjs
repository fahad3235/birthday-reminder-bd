// Headless-Chrome smoke test for birthday-reminder-bd (raw CDP, no deps).
// Usage: node tests/smoke.mjs
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..');
const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9231;
const URL = 'file://' + ROOT + '/index.html?asof=2026-10-15';

let passed = 0;
function ok(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra ? ' :: ' + extra : ''));
  passed++;
  console.log('ok - ' + name);
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT, '--no-first-run', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitForDebugger() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      if (r.ok) {
        const targets = await r.json();
        const page = targets.find(t => t.type === 'page');
        if (page) return page;
      }
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

let ws, nextId = 1;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('JS exception: ' + JSON.stringify(res.exceptionDetails));
  return res.result.value;
}

try {
  const ver = await waitForDebugger();
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      if (msg.params.type === 'error') consoleErrors.push(args);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1200);

  ok('title', (await ev('document.title')) === 'Birthday Reminder BD');
  ok('empty state', await ev(`document.getElementById('upcomingList').textContent.includes('No birthdays coming up')`));
  ok('stats zero', await ev(`document.getElementById('statTotal').textContent === '0'`));

  // Add person born today (1990-10-15) -> turns 36 today
  await ev(`document.getElementById('addBtn').click()`);
  await ev(`document.getElementById('fName').value = 'Sadia';
    document.getElementById('fDob').value = '1990-10-15';
    document.getElementById('fRelation').value = 'friend';
    document.getElementById('fGift').value = 'A novel';
    document.getElementById('personForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
  await sleep(300);
  ok('today card renders', await ev(`document.getElementById('upcomingList').textContent.includes('Sadia')`));
  ok('today card says turns 36', await ev(`document.getElementById('upcomingList').textContent.includes('turns 36')`));
  ok('today badge', await ev(`!!document.querySelector('.badge-today')`));
  ok('gift idea renders', await ev(`document.getElementById('upcomingList').textContent.includes('A novel')`));
  ok('stats: total 1, today 1', await ev(`document.getElementById('statTotal').textContent === '1' && document.getElementById('statToday').textContent === '1'`));

  // Add person in 3 days (1990-10-18) -> in 3 day(s), turns 36
  await ev(`document.getElementById('addBtn').click()`);
  await ev(`document.getElementById('fName').value = 'Karim';
    document.getElementById('fDob').value = '1990-10-18';
    document.getElementById('personForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
  await sleep(300);
  ok('second card renders', await ev(`document.getElementById('upcomingList').textContent.includes('Karim')`));
  ok('in-3-days text', await ev(`document.getElementById('upcomingList').textContent.includes('in 3 day(s)')`));
  ok('stats: week 2, month 2', await ev(`document.getElementById('statWeek').textContent === '2' && document.getElementById('statMonth').textContent === '2'`));

  // Validation: empty name shows inline error, no new card
  await ev(`document.getElementById('addBtn').click()`);
  await ev(`document.getElementById('fName').value = '';
    document.getElementById('fDob').value = '2000-01-01';
    document.getElementById('personForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
  await sleep(200);
  ok('empty-name inline error', await ev(`document.getElementById('formErrors').textContent.includes('Name is required')`));
  ok('no phantom card', await ev(`document.querySelectorAll('#upcomingList .card').length === 2`));
  await ev(`document.getElementById('cancelBtn').click()`);

  // Future DOB rejected
  await ev(`document.getElementById('addBtn').click()`);
  await ev(`document.getElementById('fName').value = 'Future';
    document.getElementById('fDob').value = '2027-01-01';
    document.getElementById('personForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
  await sleep(200);
  ok('future-dob inline error', await ev(`document.getElementById('formErrors').textContent.includes('future')`));
  await ev(`document.getElementById('cancelBtn').click()`);

  // All tab: search filters
  await ev(`document.querySelector('[data-tab="all"]').click()`);
  await sleep(200);
  await ev(`document.getElementById('searchInput').value = 'karim';
    document.getElementById('searchInput').dispatchEvent(new Event('input', {bubbles:true}))`);
  await sleep(200);
  ok('search narrows to 1', await ev(`document.querySelectorAll('#allList .card').length === 1`));
  ok('search shows Karim', await ev(`document.getElementById('allList').textContent.includes('Karim')`));
  await ev(`document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').dispatchEvent(new Event('input', {bubbles:true}))`);
  await sleep(200);
  ok('search cleared shows 2', await ev(`document.querySelectorAll('#allList .card').length === 2`));

  // Month filter: December -> empty state
  await ev(`document.getElementById('monthFilter').value = '12';
    document.getElementById('monthFilter').dispatchEvent(new Event('change', {bubbles:true}))`);
  await sleep(200);
  ok('month filter empty state', await ev(`document.getElementById('allList').textContent.includes('No people match')`));
  await ev(`document.getElementById('monthFilter').value = 'all';
    document.getElementById('monthFilter').dispatchEvent(new Event('change', {bubbles:true}))`);
  await sleep(200);

  // BN toggle: Bengali digits + title
  await ev(`document.getElementById('langBtn').click()`);
  await sleep(200);
  ok('BN title', await ev(`document.querySelector('h1').textContent.includes('\u099c\u09a8\u09cd\u09ae\u09a6\u09bf\u09a8')`));
  ok('BN digits in stats', await ev(`document.getElementById('statTotal').textContent === '\u09e8'`));
  ok('BN persists in localStorage', await ev(`localStorage.getItem('birthday-reminder-bd:lang') === 'bn'`));
  await ev(`document.getElementById('langBtn').click()`); // back to EN
  await sleep(200);

  // Persistence across reload
  await send('Page.navigate', { url: URL });
  await sleep(1200);
  ok('reload keeps 2 people', await ev(`document.querySelectorAll('#upcomingList .card').length === 2`));

  // Export/import round-trip via localStorage: wipe, import good JSON, reload
  const exported = await ev(`localStorage.getItem('birthday-reminder-bd:v1')`);
  ok('export shape has people', exported.includes('"app":"birthday-reminder-bd"'));
  await ev(`localStorage.removeItem('birthday-reminder-bd:v1')`);
  await send('Page.navigate', { url: URL });
  await sleep(1000);
  ok('wipe shows empty', await ev(`document.getElementById('statTotal').textContent === '0'`));
  await ev(`localStorage.setItem('birthday-reminder-bd:v1', ${JSON.stringify(JSON.stringify(JSON.parse(exported)))})`);
  await send('Page.navigate', { url: URL });
  await sleep(1000);
  ok('import round-trip restores 2', await ev(`document.querySelectorAll('#upcomingList .card').length === 2`));

  // Malformed import rejected with data intact (validateImport through page)
  ok('validateImport rejects wrong app', await ev(`validateImport({app:'x',version:1,people:[]}, '2026-10-15').ok === false`));
  ok('validateImport rejects future dob', await ev(`validateImport({app:'birthday-reminder-bd',version:1,people:[{name:'A',dob:'2030-01-01'}]}, '2026-10-15').ok === false`));

  // Delete flow (confirm stubbed true)
  await ev(`window.confirm = () => true`);
  await ev(`document.querySelector('#upcomingList .card .btn.danger').click()`);
  await sleep(300);
  ok('delete removes one', await ev(`document.querySelectorAll('#upcomingList .card').length === 1`));

  // Clear-all: wrong word rejected, DELETE works
  await ev(`document.querySelector('[data-tab="data"]').click()`);
  await sleep(200);
  await ev(`document.getElementById('clearInput').value = 'delete';
    document.getElementById('clearBtn').click()`);
  await sleep(200);
  ok('clear wrong word error', await ev(`document.getElementById('clearError').textContent.includes('DELETE')`));
  ok('clear wrong word keeps data', await ev(`document.getElementById('statTotal').textContent === '1'`));
  await ev(`document.getElementById('clearInput').value = 'DELETE';
    document.getElementById('clearBtn').click()`);
  await sleep(200);
  ok('clear DELETE empties', await ev(`document.getElementById('statTotal').textContent === '0'`));

  // 390px mobile: no horizontal overflow on any tab
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const tab of ['upcoming', 'all', 'data']) {
    await ev(`document.querySelector('[data-tab="${tab}"]').click()`);
    await sleep(200);
    ok('390px no overflow (' + tab + ')', await ev(`document.documentElement.scrollWidth <= 390`));
  }
  await send('Emulation.clearDeviceMetricsOverride');

  ok('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  ok('zero page exceptions', pageErrors.length === 0, pageErrors.join(' | '));
  console.log('ALL ' + passed + ' SMOKE CHECKS PASSED');
} catch (err) {
  console.error(err.message);
  console.error('SMOKE FAILED after ' + passed + ' passed checks');
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
