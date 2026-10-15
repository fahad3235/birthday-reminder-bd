'use strict';
/* App glue for birthday-reminder-bd. Pure date math lives in logic.js. */

(function () {
  var LS_PEOPLE = 'birthday-reminder-bd:v1';
  var LS_LANG = 'birthday-reminder-bd:lang';

  function asofToday() {
    var q = new URLSearchParams(window.location.search).get('asof');
    if (q && parseISODate(q)) return q;
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  var ASOF = asofToday();

  var state = { people: [], lang: 'en', tab: 'upcoming', editingId: null,
    search: '', month: 'all', relation: 'all' };

  function load() {
    try {
      var raw = localStorage.getItem(LS_PEOPLE);
      if (raw) {
        var res = validateImport(JSON.parse(raw), ASOF);
        if (res.ok) state.people = res.people;
      }
    } catch (e) { state.people = []; }
    var lang = localStorage.getItem(LS_LANG);
    if (lang === 'bn' || lang === 'en') state.lang = lang;
  }
  function save() {
    localStorage.setItem(LS_PEOPLE, JSON.stringify({
      app: 'birthday-reminder-bd', version: 1, exportedAt: ASOF, people: state.people
    }));
  }
  function saveLang() { localStorage.setItem(LS_LANG, state.lang); }

  function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key; }
  function num(n) { return state.lang === 'bn' ? toBengaliDigits(String(n)) : String(n); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthName(m, short) {
    var arr = short ? t('monthsShort') : t('months');
    return arr[m - 1];
  }
  function fmtDate(iso) {
    var p = parseISODate(iso);
    if (!p) return esc(iso);
    var out = monthName(p.m) + ' ' + p.d + ', ' + p.y;
    return state.lang === 'bn' ? toBengaliDigits(out) : out;
  }
  function badgeText(badge) {
    return { today: t('badgeToday'), tomorrow: t('badgeTomorrow'), week: t('badgeWeek'),
      month: t('badgeMonth'), later: t('badgeLater') }[badge] || badge;
  }
  function relText(rel) {
    return { family: t('relFamily'), friend: t('relFriend'),
      colleague: t('relColleague'), other: t('relOther') }[rel] || rel;
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.add('hidden'); }, 3000);
  }

  function applyStaticText() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    // Rebuild month-filter options in the current language, keeping selection.
    var sel = document.getElementById('monthFilter');
    var keep = sel.value;
    sel.querySelectorAll('option[data-month]').forEach(function (o) { o.remove(); });
    t('months').forEach(function (name, i) {
      var opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.setAttribute('data-month', '1');
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.value = keep;
    document.getElementById('langBtn').textContent = t('langBtn');
    document.title = t('title');
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  }

  function agePhrase(age) {
    return state.lang === 'bn' ? num(age) + ' ' + t('turns') : t('turns') + ' ' + num(age);
  }

  function upcomingCard(item) {
    var p = item.person, nb = item.next;
    var badge = birthdayBadge(nb.daysUntil, nb.date, ASOF);
    var when;
    if (nb.daysUntil === 0) when = t('todayIs') + ' ' + agePhrase(nb.ageTurning);
    else if (nb.daysUntil === 1) when = t('tomorrowIs') + ' ' + agePhrase(nb.ageTurning);
    else if (state.lang === 'bn') when = num(nb.daysUntil) + ' ' + t('days') + ' \u09aa\u09b0\u09c7 ' + num(nb.ageTurning) + ' ' + t('turns');
    else when = t('inDays') + ' ' + num(nb.daysUntil) + ' ' + t('days') + ', ' + t('turns') + ' ' + num(nb.ageTurning);
    var extra = '';
    if (p.giftIdea) extra += '<div class="meta"><strong>' + esc(t('giftLabel')) + '</strong> ' + esc(p.giftIdea) + '</div>';
    if (p.note) extra += '<div class="meta"><strong>' + esc(t('noteLabel')) + '</strong> ' + esc(p.note) + '</div>';
    return '<article class="card" data-id="' + esc(p.id) + '">' +
      '<div class="card-head"><h3>' + esc(p.name) + '</h3>' +
      '<span class="badge badge-' + badge + '">' + esc(badgeText(badge)) + '</span></div>' +
      '<div class="when">' + esc(when) + '</div>' +
      '<div class="meta">' + esc(t('bornLabel')) + ' ' + fmtDate(p.dob) +
      ' &middot; ' + esc(relText(p.relation)) + '</div>' + extra +
      '<div class="card-actions"><button class="btn small" data-act="edit">' + esc(t('edit')) +
      '</button><button class="btn small danger" data-act="del">' + esc(t('delete')) + '</button></div></article>';
  }

  function render() {
    applyStaticText();
    var stats = dashboardStats(state.people, ASOF);
    document.getElementById('statTotal').textContent = num(stats.total);
    document.getElementById('statToday').textContent = num(stats.today);
    document.getElementById('statWeek').textContent = num(stats.week);
    document.getElementById('statMonth').textContent = num(stats.month);

    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    ['upcoming', 'all', 'data'].forEach(function (tab) {
      document.getElementById('panel-' + tab).classList.toggle('hidden', state.tab !== tab);
    });

    // Upcoming panel
    var up = sortUpcoming(state.people, ASOF);
    var upEl = document.getElementById('upcomingList');
    upEl.innerHTML = up.length
      ? up.map(upcomingCard).join('')
      : '<p class="empty">' + esc(t('emptyUpcoming')) + '</p>';

    // All panel: filters
    var q = state.search.trim().toLowerCase();
    var filtered = state.people.filter(function (p) {
      if (q && (p.name.toLowerCase().indexOf(q) === -1) &&
          (p.note || '').toLowerCase().indexOf(q) === -1) return false;
      if (state.relation !== 'all' && p.relation !== state.relation) return false;
      if (state.month !== 'all') {
        var nb = nextBirthday(p.dob, ASOF);
        if (!nb || parseISODate(nb.date).m !== Number(state.month)) return false;
      }
      return true;
    });
    var allEl = document.getElementById('allList');
    if (!state.people.length) {
      allEl.innerHTML = '<p class="empty">' + esc(t('emptyAll')) + '</p>';
    } else if (!filtered.length) {
      allEl.innerHTML = '<p class="empty">' + esc(t('emptySearch')) + '</p>';
    } else {
      allEl.innerHTML = filtered.map(function (p) {
        var nb = nextBirthday(p.dob, ASOF);
        return '<article class="card" data-id="' + esc(p.id) + '">' +
          '<div class="card-head"><h3>' + esc(p.name) + '</h3>' +
          '<span class="badge badge-later">' + esc(fmtDate(nb.date)) + '</span></div>' +
          '<div class="meta">' + esc(t('bornLabel')) + ' ' + fmtDate(p.dob) +
          ' &middot; ' + esc(relText(p.relation)) +
          ' &middot; ' + (state.lang === 'bn'
            ? num(nb.daysUntil) + ' ' + t('days') + ' \u09aa\u09b0\u09c7 ' + num(nb.ageTurning) + ' ' + t('turns')
            : t('turns') + ' ' + num(nb.ageTurning) + ' ' + t('inDays') + ' ' + num(nb.daysUntil) + ' ' + t('days')) + '</div>' +
          (p.note ? '<div class="meta"><strong>' + esc(t('noteLabel')) + '</strong> ' + esc(p.note) + '</div>' : '') +
          (p.giftIdea ? '<div class="meta"><strong>' + esc(t('giftLabel')) + '</strong> ' + esc(p.giftIdea) + '</div>' : '') +
          '<div class="card-actions"><button class="btn small" data-act="edit">' + esc(t('edit')) +
          '</button><button class="btn small danger" data-act="del">' + esc(t('delete')) + '</button></div></article>';
      }).join('');
    }

    // Data panel
    document.getElementById('dataCount').textContent = t('dataCount').replace('{n}', num(state.people.length));
  }

  function errKeyToMsg(key) {
    var map = { nameRequired: 'errNameRequired', nameTooLong: 'errNameTooLong',
      dobInvalid: 'errDobInvalid', dobFuture: 'errDobFuture', dobTooOld: 'errDobTooOld',
      noteTooLong: 'errNoteTooLong', giftTooLong: 'errGiftTooLong' };
    return t(map[key] || 'errDobInvalid');
  }

  function openForm(person) {
    state.editingId = person ? person.id : null;
    document.getElementById('formTitle').textContent = t('addPerson');
    document.getElementById('fName').value = person ? person.name : '';
    document.getElementById('fDob').value = person ? person.dob : '';
    document.getElementById('fRelation').value = person ? person.relation : 'family';
    document.getElementById('fNote').value = person ? person.note : '';
    document.getElementById('fGift').value = person ? person.giftIdea : '';
    document.getElementById('formErrors').textContent = '';
    document.getElementById('personForm').classList.remove('hidden');
    document.getElementById('fName').focus();
  }
  function closeForm() {
    document.getElementById('personForm').classList.add('hidden');
    state.editingId = null;
  }

  function onSubmit(e) {
    e.preventDefault();
    var p = {
      id: state.editingId || ('p-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36)),
      name: document.getElementById('fName').value.trim(),
      dob: document.getElementById('fDob').value,
      relation: document.getElementById('fRelation').value,
      note: document.getElementById('fNote').value.trim(),
      giftIdea: document.getElementById('fGift').value.trim()
    };
    var errs = validatePerson(p, ASOF);
    if (errs.length) {
      document.getElementById('formErrors').textContent = errs.map(errKeyToMsg).join(' ');
      return;
    }
    if (state.editingId) {
      var idx = state.people.findIndex(function (x) { return x.id === state.editingId; });
      if (idx >= 0) state.people[idx] = p;
    } else {
      state.people.push(p);
    }
    save(); closeForm(); render(); toast(t('savedMsg'));
  }

  function onListClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var card = e.target.closest('.card');
    var p = state.people.find(function (x) { return x.id === card.dataset.id; });
    if (!p) return;
    if (btn.dataset.act === 'edit') openForm(p);
    if (btn.dataset.act === 'del') {
      if (window.confirm(t('confirmDelete'))) {
        state.people = state.people.filter(function (x) { return x.id !== p.id; });
        save(); render(); toast(t('deletedMsg'));
      }
    }
  }

  function onExport() {
    var blob = new Blob([JSON.stringify({
      app: 'birthday-reminder-bd', version: 1, exportedAt: ASOF, people: state.people
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'birthday-reminder-bd.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onImportFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (err) { toast(t('importFailed').replace('{reason}', 'bad JSON')); return; }
      var res = validateImport(parsed, ASOF);
      if (!res.ok) {
        toast(t('importFailed').replace('{reason}', res.errors.join(', ')));
        return;
      }
      state.people = res.people;
      save(); render();
      toast(t('importDone').replace('{n}', num(res.people.length)));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function onClear() {
    var input = document.getElementById('clearInput');
    if (input.value !== 'DELETE') {
      document.getElementById('clearError').textContent = t('errDeleteWord');
      return;
    }
    document.getElementById('clearError').textContent = '';
    input.value = '';
    state.people = [];
    save(); render(); toast(t('clearedMsg'));
  }

  function init() {
    load();
    document.getElementById('addBtn').addEventListener('click', function () { openForm(null); });
    document.getElementById('cancelBtn').addEventListener('click', closeForm);
    document.getElementById('personForm').addEventListener('submit', onSubmit);
    document.getElementById('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      saveLang(); render();
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.dataset.tab; render(); });
    });
    document.getElementById('searchInput').addEventListener('input', function (e) {
      state.search = e.target.value; render();
    });
    document.getElementById('monthFilter').addEventListener('change', function (e) {
      state.month = e.target.value; render();
    });
    document.getElementById('relationFilter').addEventListener('change', function (e) {
      state.relation = e.target.value; render();
    });
    document.getElementById('upcomingList').addEventListener('click', onListClick);
    document.getElementById('allList').addEventListener('click', onListClick);
    document.getElementById('exportBtn').addEventListener('click', onExport);
    document.getElementById('importFile').addEventListener('change', onImportFile);
    document.getElementById('clearBtn').addEventListener('click', onClear);
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
