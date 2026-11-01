// Alte Direktlinks auf zusammengelegte Seiten umleiten
const PANE_ALIASES = { 'tab-timeline': 'tab-leveling', 'tab-questing': 'tab-leveling' };

// Wird von Navigation, Suche und Links genutzt (in initTabs gesetzt)
let showTab = () => {};

// Seiten- und Bereichs-Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');
  const sidebar = document.getElementById('sidebarNav');
  const backdrop = document.getElementById('sidebarBackdrop');
  const menuBtn = document.getElementById('mobileMenuBtn');
  const contentPanel = document.querySelector('.content-panel');

  // Bereich aufklappen, zu dem die Seite gehört
  function openAreaFor(targetId) {
    document.querySelectorAll('.nav-area').forEach(area => {
      const owns = [...area.querySelectorAll('.nav-tab')].some(t => t.dataset.target.split(':')[0] === targetId);
      area.classList.toggle('open', owns);
      area.classList.toggle('current', owns);
    });
  }

  showTab = function (targetId, updateHash, keepScroll) {
    const [paneId, subId] = (targetId || '').split(':');
    const resolved = PANE_ALIASES[paneId] || paneId;
    const targetPane = document.getElementById(resolved);
    if (!targetPane || !targetPane.classList.contains('tab-pane')) return;

    panes.forEach(p => p.classList.remove('active'));
    targetPane.classList.add('active');
    openAreaFor(resolved);
    if (subId) activateSubtab(targetPane, subId);
    syncNav();

    if (updateHash) history.replaceState(null, '', '#' + resolved + (subId ? ':' + subId : ''));

    // Mobile-Menü schließen
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      if (menuBtn) menuBtn.classList.remove('open');
    }

    if (contentPanel && !keepScroll) contentPanel.scrollTo({ top: 0, behavior: 'smooth' });
    document.dispatchEvent(new CustomEvent('pagechange'));
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.getAttribute('data-target'), true));
  });

  // Bereichs-Button: aufklappen und erste Seite des Bereichs öffnen
  document.querySelectorAll('.nav-area-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const area = btn.closest('.nav-area');
      if (area.classList.contains('current') && !area.classList.contains('single')) {
        area.classList.toggle('open');
        return;
      }
      showTab(btn.dataset.areaTarget, true);
    });
  });

  // Quick-Links & Inline-Links auf andere Seiten
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-goto]');
    if (!link) return;
    e.preventDefault();
    showTab(link.getAttribute('data-goto'), true);
  });

  // Direktlinks wie #tab-ranking oder #tab-mage:talents
  const initial = location.hash.length > 1 ? location.hash.slice(1) : (document.querySelector('.tab-pane.active') || {}).id;
  showTab(initial, false, true);
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
}

// Menü-Markierung: Seite oder Seite:Unter-Reiter (z. B. tab-forever:zones)
function syncNav() {
  const pane = document.querySelector('.tab-pane.active');
  if (!pane) return;
  const activeSub = pane.querySelector('.subtab-btn.active');
  const full = pane.id + (activeSub ? ':' + activeSub.dataset.subtab : '');
  const tabs = [...document.querySelectorAll('.nav-tab')];
  const exact = tabs.some(t => t.dataset.target === full);
  tabs.forEach(t => t.classList.toggle('active', exact ? t.dataset.target === full : t.dataset.target === pane.id));
}

// Unter-Reiter innerhalb einer Seite (Leveling-Stufen, Klassen-Abschnitte)
function activateSubtab(pane, subId) {
  const btn = pane.querySelector(`.subtab-btn[data-subtab="${subId}"]`);
  if (!btn) return;
  pane.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
  pane.querySelectorAll('.subtab-panel').forEach(p => p.classList.toggle('active', p.dataset.subtab === subId));
}

function initSubtabs() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.subtab-btn');
    if (!btn) return;
    const pane = btn.closest('.tab-pane');
    activateSubtab(pane, btn.dataset.subtab);
    syncNav();
    history.replaceState(null, '', '#' + pane.id + ':' + btn.dataset.subtab);
    document.dispatchEvent(new CustomEvent('pagechange'));
  });
}

// Klassenseiten in Unter-Reiter gliedern: Überblick, Kampf, Talente, Ausrüstung, Trainer, Makros, Patches
const CLASS_SECTIONS = [
  ['overview', 'Überblick'],
  ['forever', 'Neu in Forever'],
  ['quest', 'Klassenquest'],
  ['combat', 'Kampf'],
  ['talents', 'Talente'],
  ['gear', 'Ausrüstung'],
  ['trainer', 'Trainer'],
  ['macros', 'Makros'],
  ['patches', 'Patches'],
];

function classSectionFor(heading) {
  if (/^\s*neu in forever/i.test(heading)) return 'forever';
  if (/^\s*klassenquest/i.test(heading)) return 'quest';
  if (/trainer/i.test(heading)) return 'trainer';
  if (/makro/i.test(heading)) return 'macros';
  if (/talent/i.test(heading)) return 'talents';
  if (/zauberst|stäbe|stab-|waffe|fernkampf|2-hand|zweihand|ausrüstung/i.test(heading)) return 'gear';
  if (/kampf/i.test(heading)) return 'combat';
  return 'overview';
}

function initClassSubtabs() {
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (!pane.querySelector('.class-meta-rating')) return;

    const buckets = {};
    CLASS_SECTIONS.forEach(([id]) => { buckets[id] = []; });
    [...pane.children].forEach(child => {
      if (child.classList.contains('guide-chapter')) {
        const h3 = child.querySelector('h3');
        buckets[classSectionFor(h3 ? h3.textContent : '')].push(child);
      } else if (child.classList.contains('class-note') || child.classList.contains('live-changes')) {
        buckets.patches.push(child);
      }
    });

    const bar = document.createElement('div');
    bar.className = 'subtabs';
    bar.setAttribute('role', 'tablist');
    pane.querySelector('.class-meta-rating').after(bar);

    let first = true;
    let anchor = bar;
    CLASS_SECTIONS.forEach(([id, label]) => {
      if (!buckets[id].length) return;
      const btn = document.createElement('button');
      btn.className = 'subtab-btn' + (first ? ' active' : '');
      btn.dataset.subtab = id;
      btn.textContent = label;
      bar.appendChild(btn);

      const panel = document.createElement('div');
      panel.className = 'subtab-panel' + (first ? ' active' : '');
      panel.dataset.subtab = id;
      buckets[id].forEach(node => panel.appendChild(node));
      anchor.after(panel);
      anchor = panel;
      first = false;
    });
  });
}

// "Auf dieser Seite": Überschriften der sichtbaren Seite als Sprungliste (nur breite Bildschirme)
function initToc() {
  const toc = document.createElement('nav');
  toc.className = 'page-toc';
  toc.setAttribute('aria-label', 'Auf dieser Seite');
  document.body.appendChild(toc);

  function visible(el) {
    return !el.closest('.subtab-panel:not(.active)') && !el.closest('details:not([open])');
  }

  function build() {
    const pane = document.querySelector('.tab-pane.active');
    toc.textContent = '';
    if (!pane) return;
    const heads = [...pane.querySelectorAll('.guide-chapter > h3')].filter(visible);
    if (heads.length < 3) { toc.classList.remove('show'); return; }
    const title = document.createElement('span');
    title.className = 'page-toc-title';
    title.textContent = 'Auf dieser Seite';
    toc.appendChild(title);
    heads.forEach(h => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = h.textContent.trim();
      a.addEventListener('click', e => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      toc.appendChild(a);
    });
    toc.classList.add('show');
  }

  document.addEventListener('pagechange', build);
  build();
}

// Suche über alle Seiten (Strg+K)
function initSearch() {
  const input = document.getElementById('siteSearch');
  const box = document.getElementById('searchResults');
  if (!input || !box) return;

  const paneTitle = pane => {
    const nav = document.querySelector(`.nav-tab[data-target="${pane.id}"]`);
    const h2 = pane.querySelector('.pane-header h2');
    return nav ? nav.textContent.replace(/LIVE|NEU/g, '').trim() : (h2 ? h2.textContent.trim() : '');
  };

  // Index: Überschriften und Karten-Titel, jeweils mit dem Text des umgebenden Blocks
  const index = [];
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.querySelectorAll('.pane-header h2, h3, h4, .tier-chip b, .route-info h4, td:first-child strong').forEach(el => {
      const label = el.textContent.trim();
      if (!label || el.closest('.live-changes')) return;
      const block = el.closest('.card, .guide-chapter, .tier-chip, tr, .timeline-block, .route-item, .sub-box') || el;
      index.push({ label, text: (label + ' ' + block.textContent).toLowerCase(), el, pane, where: paneTitle(pane), isPage: el.tagName === 'H2' });
    });
  });

  let results = [];
  let cursor = 0;

  function go(hit) {
    const sub = hit.el.closest('.subtab-panel');
    showTab(hit.pane.id + (sub ? ':' + sub.dataset.subtab : ''), true, true);
    setTimeout(() => {
      hit.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hit.el.classList.add('search-flash');
      setTimeout(() => hit.el.classList.remove('search-flash'), 1800);
    }, 60);
    input.value = '';
    box.hidden = true;
  }

  function render() {
    box.textContent = '';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = 'Keine Treffer';
      box.appendChild(empty);
    }
    results.forEach((hit, i) => {
      const row = document.createElement('button');
      row.className = 'search-hit' + (i === cursor ? ' active' : '');
      const b = document.createElement('b');
      b.textContent = hit.label;
      const s = document.createElement('small');
      s.textContent = hit.where;
      row.append(b, s);
      row.addEventListener('mousedown', e => { e.preventDefault(); go(hit); });
      box.appendChild(row);
    });
    box.hidden = false;
  }

  input.addEventListener('input', () => {
    const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) { box.hidden = true; return; }
    const seen = new Set();
    results = index
      .filter(h => terms.every(t => h.text.includes(t)))
      // Seitentitel zuerst, dann Treffer im Titel, dann Treffer im Text
      .map(h => ({ h, score: (terms.every(t => h.label.toLowerCase().includes(t)) ? 2 : 0) + (h.isPage ? 1 : 0) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.h)
      .filter(h => { const k = h.label + h.where; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 12);
    cursor = 0;
    render();
  });

  input.addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { cursor = Math.min(cursor + 1, results.length - 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { cursor = Math.max(cursor - 1, 0); render(); e.preventDefault(); }
    if (e.key === 'Enter' && results[cursor]) { go(results[cursor]); e.preventDefault(); }
    if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebarNav');
      if (window.innerWidth <= 900 && sidebar && !sidebar.classList.contains('open')) {
        document.getElementById('mobileMenuBtn').click();
      }
      input.focus();
      input.select();
    }
  });
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
      head.appendChild(el('h4', null, 'Live-Änderungen' + (box.dataset.liveTitle ? ': ' + box.dataset.liveTitle : '')));
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

      // Abzeichen am Reiter "Patches" der Klassenseite: Anzahl im neuesten Build
      const tab = box.closest('.tab-pane') && box.closest('.tab-pane').querySelector('.subtab-btn[data-subtab="patches"]');
      if (tab && !tab.querySelector('.subtab-badge')) {
        tab.appendChild(el('span', 'subtab-badge', String(relevant[0].changes.length)));
        tab.title = `${relevant[0].changes.length} Änderungen im neuesten Build (${fmtDate(relevant[0].item.date)})`;
      }
    });
  }

  // Patch-Hinweise für die allgemeinen Guides: Stichwortsuche in den Build-Zusammenfassungen
  const TOPICS = {
    leveling:    { title: 'Leveling', re: /\bquest|erfahrung|respawn|startgebiet|zephras|brachland|durotar|mulgore|tirisfal|wegekreuz|höchststufe|dungeon|\breiten\b|reitfertigkeit|doppelte spezialisierung/i },
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

      // Eingeklappt als eine Zeile: "📯 3 Patch-Hinweise seit 30. Okt. 2026 – anzeigen"
      const panel = el('details', 'topic-line');
      const line = el('summary', null);
      line.appendChild(el('span', 'topic-horn', '📯'));
      line.appendChild(document.createTextNode(
        ` ${hits.length} Patch-Hinweis${hits.length === 1 ? '' : 'e'} seit ${hits[hits.length - 1].item.date ? fmtDate(hits[hits.length - 1].item.date) : '–'}`));
      line.appendChild(el('span', 'topic-latest', ' · neuester: ' + (hits[0].item.date ? fmtDate(hits[0].item.date) : '–')));
      line.appendChild(el('span', 'topic-open', 'anzeigen'));
      panel.appendChild(line);
      const inner = el('div', 'topic-body');
      panel.appendChild(inner);
      inner.appendChild(el('p', 'topic-note', `Automatisch erkannt (Stand ${fetchedAt}). Betrifft vermutlich diesen Guide, der Text selbst wird von Hand nachgezogen.`));

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
        inner.appendChild(wrap);
      });

      if (hits.length > 4) inner.appendChild(el('p', 'topic-note', `+ ${hits.length - 4} ältere Treffer in den Patchnotes`));
      const more = el('a', 'accent-link pn-more', 'Alle Patchnotes ansehen');
      more.href = '#tab-patchnotes';
      more.dataset.goto = 'tab-patchnotes';
      inner.appendChild(more);
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
  initClassSubtabs();
  initSubtabs();
  initTabs();
  initCountdown();
  initMobileMenu();
  initPatchnotes();
  initToc();
  initSearch();
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
