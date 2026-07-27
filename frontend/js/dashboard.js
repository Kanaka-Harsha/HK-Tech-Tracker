/**
 * dashboard.js — Dashboard Page Logic
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Auth guard: redirect to login if no token
 *  - Fetch progress data for all 10 roadmaps via API
 *  - Render roadmap cards dynamically with progress bars
 *  - Compute and display overall stats (total, completed, ongoing, pending)
 *  - Handle card navigation to roadmap.html?id=<roadmapId>
 *  - Handle logout
 *  - Toast notifications
 */

/* ============================================================
   Auth Guard
   ============================================================ */
(function authGuard() {
  if (!sessionStorage.getItem('auth_token')) {
    window.location.replace('login.html');
  }
})();

/* ============================================================
   DOM References
   ============================================================ */
const cardsGrid      = document.getElementById('cards-grid');
const cardsLoading   = document.getElementById('cards-loading');
const logoutBtn      = document.getElementById('logout-btn');

// Stats
const statTotalRoadmaps = document.getElementById('stat-total-roadmaps');
const statTotalTasks    = document.getElementById('stat-total-tasks');
const statCompleted     = document.getElementById('stat-completed');
const statOngoing       = document.getElementById('stat-ongoing');
const statPending       = document.getElementById('stat-pending');

/* ============================================================
   Toast Utility
   ============================================================ */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.hidden = false;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

/* ============================================================
   Card Rendering
   ============================================================ */

/**
 * Create a single roadmap card element.
 * @param {Object} roadmap - { id, name, icon, color }
 * @param {Object} progress - { total, completed, ongoing, pending, lastUpdated }
 * @returns {HTMLElement}
 */
function createRoadmapCard(roadmap, progress) {
  const { id, name, icon } = roadmap;
  const { total = 0, completed = 0, ongoing = 0, pending = 0, lastUpdated = null } = progress;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const updatedStr = lastUpdated
    ? formatDate(lastUpdated)
    : 'No tasks yet';

  const article = document.createElement('article');
  article.className = 'roadmap-card';
  article.setAttribute('data-roadmap', id);
  article.setAttribute('tabindex', '0');
  article.setAttribute('role', 'link');
  article.setAttribute('aria-label', `Open ${name} roadmap — ${pct}% complete`);

  article.innerHTML = `
    <!-- Arrow hint (appears on hover via CSS) -->
    <span class="card-arrow" aria-hidden="true">→</span>

    <!-- Card Header -->
    <div class="card-header">
      <div class="card-icon" aria-hidden="true">${icon}</div>
      <div class="card-title-group">
        <h2 class="card-title">${escapeHtml(name)}</h2>
        <p class="card-last-updated">Updated ${escapeHtml(updatedStr)}</p>
      </div>
    </div>

    <!-- Task Counts -->
    <div class="card-stats">
      <span class="card-stat card-stat--completed">
        <strong>${completed}</strong> Completed
      </span>
      <span class="card-stat card-stat--ongoing">
        <strong>${ongoing}</strong> Ongoing
      </span>
      <span class="card-stat card-stat--pending">
        <strong>${pending}</strong> Pending
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="card-progress" aria-label="${pct}% complete">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: 0%"></div>
      </div>
      <span class="progress-label">${pct}%</span>
    </div>
  `;

  // Navigate on click or Enter/Space
  function navigate() {
    window.location.href = `roadmap.html?id=${id}`;
  }

  article.addEventListener('click', navigate);
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate();
    }
  });

  // Animate progress bar after a short delay (for visual effect)
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = article.querySelector('.progress-bar-fill');
      if (fill) fill.style.width = `${pct}%`;
    }, 100);
  });

  return article;
}

/**
 * Render all roadmap cards into the grid.
 * @param {Array<{ roadmap, progress }>} items
 */
function renderCards(items) {
  cardsLoading.hidden = true;
  cardsGrid.hidden = false;
  cardsGrid.innerHTML = '';

  let totalTasks = 0, totalCompleted = 0, totalOngoing = 0, totalPending = 0;

  items.forEach(({ roadmap, progress }) => {
    const card = createRoadmapCard(roadmap, progress);
    cardsGrid.appendChild(card);

    totalTasks     += progress.total     || 0;
    totalCompleted += progress.completed || 0;
    totalOngoing   += progress.ongoing   || 0;
    totalPending   += progress.pending   || 0;
  });

  // Update stats bar
  statTotalTasks.textContent = totalTasks   || '0';
  statCompleted.textContent  = totalCompleted || '0';
  statOngoing.textContent    = totalOngoing  || '0';
  statPending.textContent    = totalPending  || '0';
}

/* ============================================================
   Data Loading
   ============================================================ */

/**
 * Fetch progress for all roadmaps and render the dashboard.
 */
async function loadDashboard() {
  // Show loading, hide grid
  cardsLoading.hidden = false;
  cardsGrid.hidden = true;

  const allRoadmaps = Theme.getAllRoadmaps(); // from theme.js
  const items = [];

  try {
    // Fetch progress for each roadmap in parallel
    const results = await Promise.allSettled(
      allRoadmaps.map((roadmap) =>
        API.getRoadmapProgress(roadmap.id)
          .then((progress) => ({ roadmap, progress }))
          .catch(() => ({
            roadmap,
            progress: { total: 0, completed: 0, ongoing: 0, pending: 0, lastUpdated: null },
          }))
      )
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        items.push(result.value);
      }
    });

    renderCards(items);

  } catch (err) {
    // If overall fetch fails, still render cards with empty progress
    const fallback = allRoadmaps.map((roadmap) => ({
      roadmap,
      progress: { total: 0, completed: 0, ongoing: 0, pending: 0, lastUpdated: null },
    }));
    renderCards(fallback);
    showToast('Could not connect to backend. Showing empty progress.', 'error');
  }
}

/* ============================================================
   Logout
   ============================================================ */
logoutBtn?.addEventListener('click', () => {
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_user');
  window.location.replace('login.html');
});

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Format a date string to a short readable format.
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/* ============================================================
   Init
   ============================================================ */
document.addEventListener('DOMContentLoaded', loadDashboard);
