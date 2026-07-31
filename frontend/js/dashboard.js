/**
 * dashboard.js — Dashboard Page Logic
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Auth guard: redirect to login if no token
 *  - Fetch progress data for all roadmaps via API
 *  - Render roadmap cards dynamically with progress bars
 *  - Compute and display overall stats (total, completed, ongoing, pending)
 *  - Handle card navigation to roadmap.html?id=<roadmapId>
 *  - Handle "Add Roadmap" (modal → API.createRoadmap → refresh)
 *  - Handle "Delete Roadmap" (confirm modal → API.deleteRoadmap → refresh)
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

// Add Roadmap modal
const addRoadmapBtn      = document.getElementById('add-roadmap-btn');
const addRoadmapModal    = document.getElementById('add-roadmap-modal');
const addModalCloseBtn   = document.getElementById('add-modal-close-btn');
const addModalCancelBtn  = document.getElementById('add-modal-cancel-btn');
const addRoadmapSubmit   = document.getElementById('add-roadmap-submit-btn');
const addSubmitLabel     = document.getElementById('add-submit-label');
const roadmapIdInput     = document.getElementById('roadmap-id-input');
const roadmapNameInput   = document.getElementById('roadmap-name-input');
const roadmapIconInput   = document.getElementById('roadmap-icon-input');

// Delete Roadmap modal
const deleteRoadmapModal   = document.getElementById('delete-roadmap-modal');
const delModalCloseBtn     = document.getElementById('del-modal-close-btn');
const delModalCancelBtn    = document.getElementById('del-modal-cancel-btn');
const deleteConfirmBtn     = document.getElementById('delete-roadmap-confirm-btn');
const deleteRoadmapLabel   = document.getElementById('delete-roadmap-name-label');

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
   Modal Helpers
   ============================================================ */
function openModal(modal) {
  modal.hidden = false;
  // Trap focus — focus first input or button inside
  const focusable = modal.querySelector('input, button, [tabindex]');
  if (focusable) focusable.focus();
}

function closeModal(modal) {
  modal.hidden = true;
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

    <!-- Delete button -->
    <button class="card-delete-btn" data-roadmap-id="${escapeHtml(id)}" data-roadmap-name="${escapeHtml(name)}"
      aria-label="Delete ${escapeHtml(name)} roadmap" title="Delete roadmap">✕</button>

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

  // Navigate on click or Enter/Space (but not the delete button)
  function navigate(e) {
    if (e.target.closest('.card-delete-btn')) return;
    window.location.href = `roadmap.html?id=${id}`;
  }

  article.addEventListener('click', navigate);
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest('.card-delete-btn')) return;
      e.preventDefault();
      navigate(e);
    }
  });

  // Delete button
  const deleteBtn = article.querySelector('.card-delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(id, name);
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
  statTotalRoadmaps.textContent = items.length      || '0';
  statTotalTasks.textContent    = totalTasks        || '0';
  statCompleted.textContent     = totalCompleted    || '0';
  statOngoing.textContent       = totalOngoing      || '0';
  statPending.textContent       = totalPending      || '0';
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
    cardsLoading.hidden = true;
    showToast('Failed to load roadmap data from backend.', 'error');
    const fallback = allRoadmaps.map((roadmap) => ({
      roadmap,
      progress: { total: 0, completed: 0, ongoing: 0, pending: 0, lastUpdated: null },
    }));
    renderCards(fallback);
  }
}

/* ============================================================
   Add Roadmap — Modal Logic
   ============================================================ */

function openAddModal() {
  roadmapIdInput.value   = '';
  roadmapNameInput.value = '';
  roadmapIconInput.value = '';
  openModal(addRoadmapModal);
}

function closeAddModal() {
  closeModal(addRoadmapModal);
}

addRoadmapBtn?.addEventListener('click', openAddModal);
addModalCloseBtn?.addEventListener('click', closeAddModal);
addModalCancelBtn?.addEventListener('click', closeAddModal);

// Close on overlay click
addRoadmapModal?.addEventListener('click', (e) => {
  if (e.target === addRoadmapModal) closeAddModal();
});

// Submit — Create Roadmap
addRoadmapSubmit?.addEventListener('click', async () => {
  const id   = roadmapIdInput.value.trim().toLowerCase().replace(/\s+/g, '-');
  const name = roadmapNameInput.value.trim();
  const icon = roadmapIconInput.value.trim() || '📌';

  if (!id) {
    showToast('Please enter a Roadmap ID.', 'error');
    roadmapIdInput.focus();
    return;
  }
  if (!name) {
    showToast('Please enter a Display Name.', 'error');
    roadmapNameInput.focus();
    return;
  }

  addRoadmapSubmit.disabled = true;
  addSubmitLabel.textContent = 'Creating...';

  try {
    await API.createRoadmap({ id, name, icon });
    // Register in local theme registry so dashboard shows it immediately
    Theme.registerRoadmap(id, { name, icon, color: '#6366f1' });
    showToast(`Roadmap "${name}" created successfully!`, 'success');
    closeAddModal();
    await loadDashboard();
  } catch (err) {
    showToast(err.message || 'Failed to create roadmap.', 'error');
  } finally {
    addRoadmapSubmit.disabled = false;
    addSubmitLabel.textContent = 'Create Roadmap';
  }
});

/* ============================================================
   Delete Roadmap — Modal Logic
   ============================================================ */

let _pendingDeleteId   = null;
let _pendingDeleteName = null;

function openDeleteModal(id, name) {
  _pendingDeleteId   = id;
  _pendingDeleteName = name;
  deleteRoadmapLabel.textContent = name;
  openModal(deleteRoadmapModal);
}

function closeDeleteModal() {
  _pendingDeleteId   = null;
  _pendingDeleteName = null;
  closeModal(deleteRoadmapModal);
}

delModalCloseBtn?.addEventListener('click', closeDeleteModal);
delModalCancelBtn?.addEventListener('click', closeDeleteModal);

deleteRoadmapModal?.addEventListener('click', (e) => {
  if (e.target === deleteRoadmapModal) closeDeleteModal();
});

deleteConfirmBtn?.addEventListener('click', async () => {
  if (!_pendingDeleteId) return;

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Deleting...';

  try {
    await API.deleteRoadmap(_pendingDeleteId);
    // Remove from local theme registry
    Theme.unregisterRoadmap(_pendingDeleteId);
    showToast(`Roadmap "${_pendingDeleteName}" deleted.`, 'success');
    closeDeleteModal();
    await loadDashboard();
  } catch (err) {
    showToast(err.message || 'Failed to delete roadmap.', 'error');
  } finally {
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete';
  }
});

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
