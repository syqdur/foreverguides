// Tab Switching Logic
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');
  const sidebar = document.getElementById('sidebarNav');
  const backdrop = document.getElementById('sidebarBackdrop');
  const menuBtn = document.getElementById('mobileMenuBtn');
  const contentPanel = document.querySelector('.content-panel');

  function showTab(targetId, updateHash) {
    const targetPane = document.getElementById(targetId);
    if (!targetPane || !targetPane.classList.contains('tab-pane')) return;

    // Deactivate all, activate target
    tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-target') === targetId));
    panes.forEach(p => p.classList.remove('active'));
    targetPane.classList.add('active');

    if (updateHash) history.replaceState(null, '', '#' + targetId);

    // Close mobile drawer if open
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      if (menuBtn) menuBtn.classList.remove('open');
    }

    // Scroll to top of content on mobile / desktop
    if (contentPanel) {
      contentPanel.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.getAttribute('data-target'), true));
  });

  // Quick-Links & Inline-Links auf andere Reiter
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-goto]');
    if (!link) return;
    e.preventDefault();
    showTab(link.getAttribute('data-goto'), true);
  });

  // Direktlinks wie #tab-ranking
  if (location.hash.length > 1) showTab(location.hash.slice(1), false);
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
}

// Copy Code Box
function copyBox(id) {
  const textarea = document.getElementById(id);
  if (!textarea) return;

  textarea.select();
  textarea.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(textarea.value).then(() => {
    const btn = textarea.parentElement.querySelector('.copy-pill');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Kopiert! ✓';
      btn.style.backgroundColor = '#22c55e';
      btn.style.color = '#000';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.backgroundColor = '';
        btn.style.color = '';
      }, 2000);
    }
  });
}

// Live Launch Countdown (Nov 5, 2026, 00:00:00 CET = Nov 4, 15:00 PST)
function initCountdown() {
  const timerEl = document.getElementById('launchTimer');
  const heroEl = document.getElementById('heroCountdown');
  if (!timerEl && !heroEl) return;

  const launchDate = new Date('2026-11-05T00:00:00+01:00').getTime();
  const pad = n => String(n).padStart(2, '0');

  function update() {
    const diff = launchDate - Date.now();

    if (diff <= 0) {
      if (timerEl) timerEl.innerHTML = '<span class="dot"></span> FOREVER IST LIVE!';
      if (heroEl) heroEl.innerHTML = '<div class="cd-cell"><span class="cd-num">LIVE!</span><span class="cd-lbl">Lok\'tar ogar</span></div>';
      return false;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (timerEl) {
      timerEl.innerHTML = `<span class="dot"></span> <span class="countdown-label">Launch in </span>${days}d ${hours}h ${minutes}m`;
    }
    if (heroEl) {
      const values = { d: days, h: pad(hours), m: pad(minutes), s: pad(seconds) };
      heroEl.querySelectorAll('[data-cd]').forEach(el => { el.textContent = values[el.dataset.cd]; });
    }
    return true;
  }

  if (update()) {
    const id = setInterval(() => { if (!update()) clearInterval(id); }, 1000);
  }
}

function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const fabBtn = document.getElementById('mobileNavFab');
  const sidebar = document.getElementById('sidebarNav');
  const backdrop = document.getElementById('sidebarBackdrop');

  function toggleMenu() {
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open', isOpen);
    if (menuBtn) menuBtn.classList.toggle('open', isOpen);
  }

  function closeMenu() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    if (menuBtn) menuBtn.classList.remove('open');
  }

  if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
  if (fabBtn) fabBtn.addEventListener('click', toggleMenu);
  if (backdrop) backdrop.addEventListener('click', closeMenu);
}

// Live-Patchnotes aus data/patchnotes.json (stündlich per GitHub Action aktualisiert)
function initPatchnotes() {
  const list = document.getElementById('pnList');
  const status = document.getElementById('pnStatus');
  if (!list) return;

  const fmtDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  const TYPE_ICON = { buff: '▲', nerf: '▼', change: '●' };
  // "3 statt 2 Ränge" → vorher (durchgestrichen) → jetzt (hervorgehoben)
  const WAS_NOW = /(\d[\d.,]*\s*(?:%|Sek\.|Min\.|Sek|Min|Ränge|Rang|Punkte|Meter|m)?)\s+statt\s+(\d[\d.,]*\s*(?:%|Sek\.|Min\.|Sek|Min|Ränge|Rang|Punkte|Meter|m)?)/g;

  function richText(text) {
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(WAS_NOW, (match, now, was, offset) => {
      frag.appendChild(document.createTextNode(text.slice(last, offset)));
      const span = el('span', 'was-now');
      span.appendChild(el('del', null, was.trim()));
      span.appendChild(document.createTextNode(' → '));
      span.appendChild(el('ins', null, now.trim()));
      frag.appendChild(span);
      last = offset + match.length;
      return match;
    });
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function changeList(changes, showGroup) {
    const ul = el('ul', 'live-lines');
    changes.forEach(c => {
      const li = el('li', 'live-' + c.type);
      li.appendChild(el('span', 'live-icon', TYPE_ICON[c.type] || '●'));
      const body = el('span');
      const label = [showGroup ? c.group_de : null, c.spec && c.spec !== 'Allgemein' ? c.spec : null].filter(Boolean).join(' · ');
      if (c.spell) body.appendChild(el('strong', null, c.spell));
      if (label) body.appendChild(el('span', 'live-spec', ` (${label})`));
      body.appendChild(document.createTextNode(c.spell ? ': ' : ''));
      body.appendChild(richText(c.text));
      li.appendChild(body);
      ul.appendChild(li);
    });
    return ul;
  }

  // Kästen auf den Klassenseiten: die letzten Builds mit Änderungen für diese Klasse/Völker
  function renderLiveBoxes(items, fetchedAt) {
    document.querySelectorAll('[data-live-group]').forEach(box => {
      const groups = box.dataset.liveGroup.split(',');
      const multi = groups.length > 1;
      const relevant = items
        .map(item => ({ item, changes: (item.changes || []).filter(c => groups.includes(c.group)) }))
        .filter(x => x.changes.length)
        .slice(0, 3);
      box.textContent = '';
      if (!relevant.length) return;

      const panel = el('div', 'live-panel');
      const head = el('div', 'live-head');
      head.appendChild(el('h4', null, '⚡ Live-Änderungen' + (box.dataset.liveTitle ? ': ' + box.dataset.liveTitle : '')));
      head.appendChild(el('span', 'live-stamp', 'automatisch übernommen · Stand ' + fetchedAt));
      panel.appendChild(head);

      // Neuester Build offen, ältere eingeklappt
      relevant.forEach(({ item, changes }, idx) => {
        const title = item.title.replace(/,\s*\d{1,2}\.\s+\S+\s+\d{4}$/, '');
        const wrap = el('details', 'live-fold');
        wrap.open = idx === 0;
        const sub = el('summary', 'live-build');
        sub.appendChild(el('span', 'pn-badge ' + item.kind, item.date ? fmtDate(item.date) : '–'));
        sub.appendChild(document.createTextNode(` ${title} · ${changes.length} Änderung${changes.length === 1 ? '' : 'en'}`));
        wrap.appendChild(sub);
        wrap.appendChild(changeList(changes, multi));
        panel.appendChild(wrap);
      });

      const more = el('a', 'accent-link pn-more', 'Alle Patchnotes ansehen');
      more.href = '#tab-patchnotes';
      more.dataset.goto = 'tab-patchnotes';
      panel.appendChild(more);
      box.appendChild(panel);
    });
  }

  // Patch-Hinweise für die allgemeinen Guides: Stichwortsuche in den Build-Zusammenfassungen
  const TOPICS = {
    questing:    { title: 'Questing-Route', re: /\bquest|erfahrung|respawn|startgebiet|zephras|brachland|durotar|mulgore|tirisfal|wegekreuz|höchststufe/i },
    timeline:    { title: 'Stufen-Fahrplan', re: /erfahrung|höchststufe|dungeon|\breiten\b|reitfertigkeit|doppelte spezialisierung/i },
    rules:       { title: 'Grundlagen', re: /erfahrung|erholung|dungeon|questlog|briefkasten|\bpost\b|umskill/i },
    buffs:       { title: 'Buffs & Camps', re: /zelt|lagerfeuer|\bcamp|schlafsack|erholung|\bkochen\b|kochkunst|elixier/i },
    sleepingbag: { title: 'Schlafsack', re: /schlafsack|sleeping bag/i },
    gold:        { title: 'Mount-Gold', re: /\breiten\b|reitfertigkeit|reitlehrer|\bgold\b|auktionshaus|händlerpreis|kürschner|bergbau|kräuterkunde|\bberufe?\b/i },
    addons:      { title: 'Addons & UI', re: /\baddons?\b|benutzeroberfläche|cooldown manager|gamepad|interface/i },
  };
  // Satzgrenzen, aber nicht nach Datumsangaben wie "22. Oktober"
  const SENTENCE_SPLIT = /(?<=[^\d\s][.!?])\s+(?=[A-ZÄÖÜ„"])/;

  function renderTopicBoxes(items, fetchedAt) {
    document.querySelectorAll('[data-live-topic]').forEach(box => {
      const topic = TOPICS[box.dataset.liveTopic];
      box.textContent = '';
      if (!topic) return;

      const hits = [];
      items.forEach(item => {
        const sentences = (item.summary || '').split(SENTENCE_SPLIT).filter(s => topic.re.test(s));
        if (sentences.length) hits.push({ item, sentences });
      });
      if (!hits.length) return;

      const panel = el('div', 'live-panel topic-panel');
      const head = el('div', 'live-head');
      head.appendChild(el('h4', null, `📯 Patch-Hinweise: ${topic.title}`));
      head.appendChild(el('span', 'live-stamp', 'automatisch erkannt · Stand ' + fetchedAt));
      panel.appendChild(head);
      panel.appendChild(el('p', 'topic-note', 'Diese Einträge aus den Patchnotes betreffen vermutlich diesen Guide. Der Guide-Text selbst wird von Hand nachgezogen.'));

      hits.slice(0, 4).forEach(({ item, sentences }, idx) => {
        const title = item.title.replace(/,\s*\d{1,2}\.\s+\S+\s+\d{4}$/, '');
        const wrap = el('details', 'live-fold');
        wrap.open = idx === 0;
        const sub = el('summary', 'live-build');
        sub.appendChild(el('span', 'pn-badge ' + item.kind, item.date ? fmtDate(item.date) : '–'));
        sub.appendChild(document.createTextNode(' ' + title));
        wrap.appendChild(sub);
        const ul = el('ul', 'live-lines');
        sentences.forEach(s => {
          const li = el('li', 'live-change');
          li.appendChild(el('span', 'live-icon', '●'));
          const body = el('span');
          body.appendChild(richText(s));
          li.appendChild(body);
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        panel.appendChild(wrap);
      });

      if (hits.length > 4) panel.appendChild(el('p', 'topic-note', `+ ${hits.length - 4} ältere Treffer in den Patchnotes`));
      const more = el('a', 'accent-link pn-more', 'Alle Patchnotes ansehen');
      more.href = '#tab-patchnotes';
      more.dataset.goto = 'tab-patchnotes';
      panel.appendChild(more);
      box.appendChild(panel);
    });
  }

  function render(items) {
    list.textContent = '';
    const newest = items.length ? items[0].date : null;
    items.forEach(item => {
      const row = el('div', 'news-item pn-row' + (item.date === newest ? ' is-new' : ''));
      row.dataset.kind = item.kind;
      row.appendChild(el('div', 'news-date', item.date ? fmtDate(item.date) : '–'));

      const card = el('div', 'card pn-item');
      const head = el('h4');
      // Datum steht schon links, daher aus dem Titel entfernen ("Build 1.60.1.70707, 30. Oktober 2026")
      const title = item.title.replace(/,\s*\d{1,2}\.\s+\S+\s+\d{4}$/, '');
      head.appendChild(el('span', 'pn-badge ' + item.kind, item.kind === 'hotfix' ? 'HOTFIX' : 'BUILD'));
      if (title.toLowerCase() !== item.kind) head.appendChild(document.createTextNode(' ' + title));
      if (item.translated) head.appendChild(el('span', 'pn-badge mt', 'ÜBERSETZT'));
      card.appendChild(head);
      card.appendChild(el('p', null, item.summary));

      if (item.changes && item.changes.length) {
        const det = el('details', 'pn-details');
        det.appendChild(el('summary', null, `${item.changes.length} Einzeländerungen anzeigen`));
        const byGroup = {};
        item.changes.forEach(c => { (byGroup[c.group_de] = byGroup[c.group_de] || []).push(c); });
        Object.keys(byGroup).forEach(group => {
          det.appendChild(el('h5', 'pn-group', group));
          det.appendChild(changeList(byGroup[group], false));
        });
        card.appendChild(det);
      }

      const more = el('a', 'accent-link pn-more', 'Alle Details auf foreverchanges.pro ↗');
      more.href = item.link;
      more.target = '_blank';
      more.rel = 'noopener';
      card.appendChild(more);

      row.appendChild(card);
      list.appendChild(row);
    });
  }

  document.querySelectorAll('[data-pn-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.pnFilter;
      document.querySelectorAll('[data-pn-filter]').forEach(b => b.classList.toggle('active', b === btn));
      list.querySelectorAll('.pn-row').forEach(row => {
        row.style.display = kind === 'all' || row.dataset.kind === kind ? '' : 'none';
      });
    });
  });

  fetch('data/patchnotes.json?t=' + Date.now())
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const when = data.fetched_at ? new Date(data.fetched_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'unbekannt';
      render(data.items || []);
      renderLiveBoxes(data.items || [], when);
      renderTopicBoxes(data.items || [], when);
      status.textContent = `${(data.items || []).length} Einträge · zuletzt abgeglichen: ${when}`;
    })
    .catch(() => {
      status.textContent = 'Patchnotes konnten nicht geladen werden.';
      const card = el('div', 'notice red');
      card.appendChild(el('p', null, 'Die Patchnotes sind gerade nicht verfügbar. Direkt ansehen: '));
      const a = el('a', 'accent-link', 'foreverchanges.pro/de/patch-notes ↗');
      a.href = 'https://foreverchanges.pro/de/patch-notes';
      a.target = '_blank';
      a.rel = 'noopener';
      card.firstChild.appendChild(a);
      list.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCountdown();
  initMobileMenu();
  initPatchnotes();
});
// Function to copy text from macro blocks
function copyMacro(btn) {
  const codeEl = btn.closest('.macro-box').querySelector('.macro-code');
  if (!codeEl) return;

  const text = codeEl.innerText.trim();
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Kopiert! ✓';
    btn.style.background = '#22c55e';
    btn.style.color = '#000';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}
