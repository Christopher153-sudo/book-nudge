/* =============================================
   BookNudge — script.js
   CRUD, notifications, confetti, toasts
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ───────────────────────────────────────────────────────
  const bookGrid       = document.getElementById('book-grid');
  const emptyState     = document.getElementById('empty-state');
  const modalOverlay   = document.getElementById('modal-overlay');
  const modalTitle     = document.getElementById('modal-title');
  const bookForm       = document.getElementById('book-form');
  const editIdInput    = document.getElementById('edit-id');
  const titleInput     = document.getElementById('book-title');
  const authorInput    = document.getElementById('book-author');
  const timeInput      = document.getElementById('book-time');
  const submitBtn      = document.getElementById('btn-submit');
  const quoteText      = document.getElementById('quote-text');
  const quoteAuthor    = document.getElementById('quote-author');
  const toastContainer = document.getElementById('toast-container');
  const confettiCanvas = document.getElementById('confetti-canvas');
  const notifBanner    = document.getElementById('notif-banner');
  const notifEnable    = document.getElementById('notif-enable');
  const notifDismiss   = document.getElementById('notif-dismiss');

  // Book emoji pool for cards
  const bookEmojis = ['📕', '📗', '📘', '📙', '📓', '📔', '📒', '📖', '📚', '🧾'];

  // ── State ──────────────────────────────────────────────────────────
  let books = [];
  let notifiedTimes = {}; // prevent duplicate notifications within the same minute

  // ── Init ───────────────────────────────────────────────────────────
  loadBooks();
  loadQuote();
  checkNotifPermission();

  // ── Notification banner ────────────────────────────────────────────
  function checkNotifPermission() {
    if (!('Notification' in window)) {
      notifBanner.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      notifBanner.classList.add('hidden');
    }
  }

  notifEnable.addEventListener('click', async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('🔔 Notifications enabled! I\'ll remind you to read.');
    }
    notifBanner.classList.add('hidden');
  });

  notifDismiss.addEventListener('click', () => {
    notifBanner.classList.add('hidden');
  });

  // ── Load quote ─────────────────────────────────────────────────────
  async function loadQuote() {
    try {
      const res = await fetch('/api/quote');
      const data = await res.json();
      quoteText.textContent = `${data.emoji} "${data.text}"`;
      quoteAuthor.textContent = `— ${data.author}`;
    } catch {
      quoteText.textContent = '📖 "Reading is dreaming with open eyes."';
      quoteAuthor.textContent = '— Anonymous';
    }
  }

  // Refresh quote every 30 seconds
  setInterval(loadQuote, 30000);

  // ── CRUD: Load books ──────────────────────────────────────────────
  async function loadBooks() {
    try {
      const res = await fetch('/api/books');
      books = await res.json();
      renderBooks();
    } catch (err) {
      showToast('😰 Failed to load books. Is the server running?');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  function renderBooks() {
    if (books.length === 0) {
      emptyState.style.display = 'block';
      bookGrid.innerHTML = '';
      return;
    }

    emptyState.style.display = 'none';
    const today = new Date().toISOString().split('T')[0];

    bookGrid.innerHTML = books.map((book, i) => {
      const emoji = bookEmojis[i % bookEmojis.length];
      const readToday = book.last_read === today;
      const streakBadge = getStreakBadge(book.streak);

      return `
        <div class="book-card" style="animation-delay: ${i * 0.08}s" data-id="${book.id}">
          <div class="book-card-header">
            <span class="book-emoji">${emoji}</span>
            <div class="book-actions">
              <button class="action-btn edit" title="Edit" onclick="editBook(${book.id})">✏️</button>
              <button class="action-btn delete" title="Delete" onclick="deleteBook(${book.id}, '${book.title.replace(/'/g, "\\'")}')">🗑️</button>
            </div>
          </div>
          <h3 class="book-title">${escapeHtml(book.title)}</h3>
          ${book.author ? `<p class="book-author">by ${escapeHtml(book.author)}</p>` : '<p class="book-author">Unknown author</p>'}
          <div class="book-reminder">🔔 Daily at ${formatTime(book.reminder_time)}</div>
          <div class="streak-section">
            <div class="streak-info">
              <span class="streak-number">${book.streak}</span>
              <span class="streak-label">Day Streak</span>
            </div>
            <span class="streak-badge">${streakBadge}</span>
          </div>
          <button class="btn-read ${readToday ? 'done' : ''}" onclick="${readToday ? '' : `markRead(${book.id})`}" ${readToday ? 'disabled' : ''}>
            ${readToday ? '✅ Already read today!' : '📖 Mark as Read Today'}
          </button>
          <p class="total-days">${book.total_days_read} total day${book.total_days_read !== 1 ? 's' : ''} read${book.best_streak > 1 ? ` · Best streak: ${book.best_streak}` : ''}</p>
        </div>
      `;
    }).join('');
  }

  function getStreakBadge(streak) {
    if (streak >= 30) return '🏆';
    if (streak >= 14) return '🔥';
    if (streak >= 7)  return '⭐';
    if (streak >= 3)  return '🌱';
    if (streak >= 1)  return '✨';
    return '💤';
  }

  function formatTime(time) {
    if (!time) return '9:00 AM';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Modal ──────────────────────────────────────────────────────────
  function openModal(editMode = false) {
    modalOverlay.classList.add('open');
    if (editMode) {
      modalTitle.textContent = '✏️ Edit Book';
      submitBtn.textContent = '📝 Save Changes';
    } else {
      modalTitle.textContent = '📖 Add a New Book';
      submitBtn.textContent = '📚 Add to Shelf';
      bookForm.reset();
      editIdInput.value = '';
      timeInput.value = '09:00';
    }
    setTimeout(() => titleInput.focus(), 200);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  // Open modal buttons
  document.getElementById('btn-add-book').addEventListener('click', () => openModal(false));
  document.getElementById('btn-add-empty').addEventListener('click', () => openModal(false));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // ── Form submit ────────────────────────────────────────────────────
  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editIdInput.value;
    const payload = {
      title: titleInput.value.trim(),
      author: authorInput.value.trim(),
      reminder_time: timeInput.value || '09:00',
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/books/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }

      if (res.ok) {
        showToast(id ? '✏️ Book updated!' : '📚 Book added to your shelf!');
        closeModal();
        loadBooks();
      } else {
        const err = await res.json();
        showToast(`😬 ${err.error || 'Something went wrong'}`);
      }
    } catch {
      showToast('😰 Network error. Is the server running?');
    }
  });

  // ── Edit book ──────────────────────────────────────────────────────
  window.editBook = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;
    editIdInput.value = book.id;
    titleInput.value = book.title;
    authorInput.value = book.author || '';
    timeInput.value = book.reminder_time || '09:00';
    openModal(true);
  };

  // ── Delete book ────────────────────────────────────────────────────
  window.deleteBook = async function(id, title) {
    if (!confirm(`Remove "${title}" from your shelf? 📚`)) return;
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('🗑️ Book removed from shelf.');
        loadBooks();
      }
    } catch {
      showToast('😰 Failed to delete.');
    }
  };

  // ── Mark as read ───────────────────────────────────────────────────
  window.markRead = async function(id) {
    try {
      const res = await fetch(`/api/books/${id}/read`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || '📖 Nice! Keep reading!');
        launchConfetti();
        loadBooks();

        // Animate the streak number
        setTimeout(() => {
          const card = document.querySelector(`[data-id="${id}"]`);
          if (card) {
            const num = card.querySelector('.streak-number');
            if (num) num.classList.add('fire');
          }
        }, 300);
      }
    } catch {
      showToast('😰 Failed to mark as read.');
    }
  };

  // ── Toast ──────────────────────────────────────────────────────────
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ── Confetti 🎉 ───────────────────────────────────────────────────
  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#c0694f', '#d4a84b', '#7a9e7e', '#3e2c1c', '#f5ead6', '#d48570'];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 150;

    function animate() {
      frame++;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.rotation += p.rotationSpeed;
        if (frame > maxFrames - 30) {
          p.opacity -= 0.03;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    animate();
  }

  // ── Notification scheduler ─────────────────────────────────────────
  function checkReminders() {
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    books.forEach(book => {
      if (book.reminder_time === currentTime) {
        const key = `${book.id}-${today}-${currentTime}`;
        if (notifiedTimes[key]) return; // already notified this minute

        notifiedTimes[key] = true;

        const messages = [
          `📖 Time to read "${book.title}"!`,
          `🔔 Hey! "${book.title}" is calling your name.`,
          `📚 Your book "${book.title}" misses you!`,
          `✨ Reading time! "${book.title}" awaits.`,
          `👀 "${book.title}" isn't going to read itself!`,
        ];

        const msg = messages[Math.floor(Math.random() * messages.length)];
        const streakMsg = book.streak > 0 ? ` 🔥 ${book.streak}-day streak!` : '';

        new Notification('BookNudge 📚', {
          body: msg + streakMsg,
          icon: '📖',
          tag: `booknudge-${book.id}`,
        });
      }
    });
  }

  // Check every 30 seconds
  setInterval(checkReminders, 30000);
  // Also check immediately
  setTimeout(checkReminders, 2000);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

});
