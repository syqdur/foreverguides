// Tab Switching Logic
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
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

// Live Launch Countdown (Nov 5, 2026, 00:00:00 CET)
function initCountdown() {
  const timerEl = document.getElementById('launchTimer');
  if (!timerEl) return;

  const launchDate = new Date('2026-11-05T00:00:00+01:00').getTime();

  function update() {
    const now = new Date().getTime();
    const diff = launchDate - now;

    if (diff <= 0) {
      timerEl.innerHTML = '<span class="dot"></span> ⚔️ FOREVER IST LIVE!';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    timerEl.innerHTML = `<span class="dot"></span> Launch in ${days}d ${hours}h ${minutes}m`;
  }

  update();
  setInterval(update, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCountdown();
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
