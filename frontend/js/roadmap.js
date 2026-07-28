/**
 * roadmap.js — Roadmap Table Page Logic
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Auth guard: redirect to login if no token
 *  - Read roadmap ID from URL query param (?id=dsa)
 *  - Apply per-roadmap theme via Theme.applyRoadmapTheme()
 *  - Fetch rows from API and store locally
 *  - Render table rows (desktop) and mobile cards
 *  - Search, filter by status, sort alphabetically
 *  - Pagination (25 rows per page)
 *  - Add Task modal — create new row via API
 *  - Edit Task modal — update existing row via API
 *  - Delete Task modal — delete row via API
 *  - Inline status dropdown — quick status change via API
 *  - Update progress bar and counts after every change
 *  - Toast notifications for all operations
 *  - Logout
 */

'use strict';

/* ============================================================
   Auth Guard
   ============================================================ */
(function authGuard() {
  if (!sessionStorage.getItem('auth_token')) {
    window.location.replace('login.html');
  }
})();

/* ============================================================
   Constants
   ============================================================ */
const ROWS_PER_PAGE = 25;
const STATUS_VALUES = ['Pending', 'Ongoing', 'Completed'];

/* ============================================================
   State
   ============================================================ */
let state = {
  roadmapId:    '',        // e.g. 'dsa'
  allRows:      [],        // full dataset from API
  filteredRows: [],        // after search + filter + sort
  currentPage:  1,
  totalPages:   1,
  sortBy:       'default',
  filterStatus: 'all',
  searchQuery:  '',
  pendingDeleteId: null,   // row ID awaiting delete confirm
};

/* ============================================================
   DOM References
   ============================================================ */
// Navbar
const navRoadmapName = document.getElementById('navbar-roadmap-name');
const logoutBtn      = document.getElementById('logout-btn');

// Header
const roadmapIcon    = document.getElementById('roadmap-icon');
const roadmapTitle   = document.getElementById('roadmap-title');
const roadmapMeta    = document.getElementById('roadmap-meta');
const metaTotal      = document.getElementById('meta-total');
const metaUpdated    = document.getElementById('meta-updated');

// Progress
const countCompleted   = document.getElementById('count-completed');
const countOngoing     = document.getElementById('count-ongoing');
const countPending     = document.getElementById('count-pending');
const progressBarFill  = document.getElementById('progress-bar-fill');
const progressBarTrack = document.getElementById('progress-bar-track');
const progressPercent  = document.getElementById('progress-percent');

// Toolbar
const searchInput  = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const sortBy       = document.getElementById('sort-by');
const addTaskBtn   = document.getElementById('add-task-btn');

// Table / states
const tableLoading   = document.getElementById('table-loading');
const tableEmpty     = document.getElementById('table-empty');
const tableNoResults = document.getElementById('table-no-results');
const tableWrapper   = document.getElementById('table-wrapper');
const taskTbody      = document.getElementById('task-tbody');
const mobileCards    = document.getElementById('mobile-cards');

// Pagination
const pagination = document.getElementById('pagination');
const pagePrev   = document.getElementById('page-prev');
const pageNext   = document.getElementById('page-next');
const pageInfo   = document.getElementById('page-info');

// Add/Edit Modal
const taskModalOverlay = document.getElementById('task-modal-overlay');
const taskModalTitle   = document.getElementById('task-modal-title');
const taskModalClose   = document.getElementById('task-modal-close');
const taskModalCancel  = document.getElementById('task-modal-cancel');
const taskForm         = document.getElementById('task-form');
const taskId           = document.getElementById('task-id');
const fieldMainTopic   = document.getElementById('field-main-topic');
const fieldSubTopic    = document.getElementById('field-sub-topic');
const fieldDescription = document.getElementById('field-description');
const fieldStatus      = document.getElementById('field-status');
const modalSubmitText  = document.getElementById('modal-submit-text');
const modalSubmitSpinner = document.getElementById('modal-submit-spinner');
const errMainTopic     = document.getElementById('err-main-topic');
const errSubTopic      = document.getElementById('err-sub-topic');

// Delete Modal
const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const deleteModalClose   = document.getElementById('delete-modal-close');
const deleteCancel       = document.getElementById('delete-cancel');
const deleteConfirm      = document.getElementById('delete-confirm');
const deleteBtnText      = document.getElementById('delete-btn-text');
const deleteBtnSpinner   = document.getElementById('delete-btn-spinner');

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
   Helpers
   ============================================================ */

/** Escape HTML to prevent XSS. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/** Format date string to readable format. */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

/** Get CSS badge class for a status. */
function getBadgeClass(status) {
  const map = { Completed: 'badge-completed', Ongoing: 'badge-ongoing', Pending: 'badge-pending' };
  return map[status] || 'badge-pending';
}

/** Get row CSS class for a status. */
function getRowClass(status) {
  return status === 'Completed' ? 'row-completed' : '';
}

/** Check if device is mobile. */
function isMobile() {
  return window.innerWidth <= 768;
}

/* ============================================================
   Progress Bar
   ============================================================ */

/**
 * Recalculate and update the progress bar + counts from current allRows.
 */
function updateProgress() {
  const rows = state.allRows;
  const total     = rows.length;
  const completed = rows.filter(r => r.status === 'Completed').length;
  const ongoing   = rows.filter(r => r.status === 'Ongoing').length;
  const pending   = rows.filter(r => r.status === 'Pending').length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  countCompleted.textContent = completed;
  countOngoing.textContent   = ongoing;
  countPending.textContent   = pending;
  metaTotal.textContent      = total;

  progressBarFill.style.width = `${pct}%`;
  progressBarTrack.setAttribute('aria-valuenow', pct);
  progressPercent.textContent = `${pct}%`;
}

/* ============================================================
   Filter + Search + Sort
   ============================================================ */

/**
 * Apply current search, filter, and sort to allRows → filteredRows.
 * Then re-render the table.
 */
function applyFilters() {
  let rows = [...state.allRows];

  // 1. Filter by status
  if (state.filterStatus !== 'all') {
    rows = rows.filter(r => r.status === state.filterStatus);
  }

  // 2. Search (main_topic, sub_topic, description)
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    rows = rows.filter(r =>
      (r.main_topic   || '').toLowerCase().includes(q) ||
      (r.sub_topic    || '').toLowerCase().includes(q) ||
      (r.description  || '').toLowerCase().includes(q)
    );
  }

  // 3. Sort
  if (state.sortBy === 'main_topic') {
    rows.sort((a, b) => (a.main_topic || '').localeCompare(b.main_topic || ''));
  } else if (state.sortBy === 'sub_topic') {
    rows.sort((a, b) => (a.sub_topic || '').localeCompare(b.sub_topic || ''));
  } else if (state.sortBy === 'status') {
    const order = { Pending: 0, Ongoing: 1, Completed: 2 };
    rows.sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0));
  }
  // 'default' = insertion order (no sort)

  state.filteredRows = rows;
  state.currentPage  = 1;
  state.totalPages   = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  renderView();
}

/* ============================================================
   Table Rendering (Desktop)
   ============================================================ */

/**
 * Build a single <tr> for the task table.
 * @param {Object} row - task object
 * @param {number} index - display index (1-based)
 */
function buildTableRow(row, index) {
  const tr = document.createElement('tr');
  tr.setAttribute('data-id', row.id);
  tr.className = getRowClass(row.status);

  const badgeClass = getBadgeClass(row.status);
  const statusOptions = STATUS_VALUES.map(s =>
    `<option value="${s}"${s === row.status ? ' selected' : ''}>${s}</option>`
  ).join('');

  tr.innerHTML = `
    <td class="col-num">${index}</td>
    <td class="col-main">${escapeHtml(row.main_topic)}</td>
    <td class="col-sub">${escapeHtml(row.sub_topic)}</td>
    <td class="col-desc" title="${escapeHtml(row.description)}">${escapeHtml(row.description || '—')}</td>
    <td class="col-status">
      <span class="badge ${badgeClass}">${escapeHtml(row.status)}</span>
    </td>
    <td class="col-actions">
      <div class="action-group">
        <button
          class="btn-icon"
          data-action="edit"
          data-id="${row.id}"
          aria-label="Edit task: ${escapeHtml(row.main_topic)}"
          title="Edit"
        >✏</button>
        <button
          class="btn-icon btn-icon--danger"
          data-action="delete"
          data-id="${row.id}"
          aria-label="Delete task: ${escapeHtml(row.main_topic)}"
          title="Delete"
        >🗑</button>
        <select
          class="status-dropdown"
          data-action="status"
          data-id="${row.id}"
          data-status="${row.status}"
          aria-label="Change status for ${escapeHtml(row.main_topic)}"
        >${statusOptions}</select>
      </div>
    </td>
  `;

  return tr;
}

/* ============================================================
   Mobile Card Rendering
   ============================================================ */

/**
 * Build a single mobile task card element.
 * @param {Object} row
 * @param {number} index
 */
function buildMobileCard(row, index) {
  const div = document.createElement('div');
  div.className = 'mobile-task-card';
  div.setAttribute('data-id', row.id);

  const badgeClass = getBadgeClass(row.status);
  const statusOptions = STATUS_VALUES.map(s =>
    `<option value="${s}"${s === row.status ? ' selected' : ''}>${s}</option>`
  ).join('');

  div.innerHTML = `
    <div class="mobile-card-row">
      <div class="mobile-card-topics">
        <p class="mobile-card-num">#${index}</p>
        <p class="mobile-card-main">${escapeHtml(row.main_topic)}</p>
        <p class="mobile-card-sub">${escapeHtml(row.sub_topic)}</p>
      </div>
      <span class="badge ${badgeClass}">${escapeHtml(row.status)}</span>
    </div>
    ${row.description
      ? `<p class="mobile-card-desc">${escapeHtml(row.description)}</p>`
      : ''}
    <div class="mobile-card-footer">
      <select
        class="status-dropdown"
        data-action="status"
        data-id="${row.id}"
        data-status="${row.status}"
        aria-label="Change status for ${escapeHtml(row.main_topic)}"
      >${statusOptions}</select>
      <div class="mobile-card-actions">
        <button
          class="btn-icon"
          data-action="edit"
          data-id="${row.id}"
          aria-label="Edit task: ${escapeHtml(row.main_topic)}"
          title="Edit"
        >✏</button>
        <button
          class="btn-icon btn-icon--danger"
          data-action="delete"
          data-id="${row.id}"
          aria-label="Delete task"
          title="Delete"
        >🗑</button>
      </div>
    </div>
  `;

  return div;
}

/* ============================================================
   Main Render Function
   ============================================================ */

/**
 * Render the current page of filteredRows into the table and mobile cards.
 * Shows the correct empty state based on context.
 */
function renderView() {
  const rows = state.filteredRows;
  const total = state.allRows.length;

  // --- Show correct state ---
  tableLoading.hidden   = true;

  if (total === 0) {
    // No tasks at all
    tableEmpty.hidden     = false;
    tableNoResults.hidden = true;
    tableWrapper.hidden   = true;
    mobileCards.hidden    = true;
    pagination.hidden     = true;
    return;
  }

  if (rows.length === 0) {
    // Tasks exist but none match filter/search
    tableEmpty.hidden     = true;
    tableNoResults.hidden = false;
    tableWrapper.hidden   = true;
    mobileCards.hidden    = true;
    pagination.hidden     = true;
    return;
  }

  // --- Paginate ---
  const start = (state.currentPage - 1) * ROWS_PER_PAGE;
  const end   = start + ROWS_PER_PAGE;
  const pageRows = rows.slice(start, end);

  tableEmpty.hidden     = true;
  tableNoResults.hidden = true;

  // --- Render Desktop Table ---
  taskTbody.innerHTML = '';
  pageRows.forEach((row, i) => {
    taskTbody.appendChild(buildTableRow(row, start + i + 1));
  });
  tableWrapper.hidden = false;

  // --- Render Mobile Cards ---
  mobileCards.innerHTML = '';
  pageRows.forEach((row, i) => {
    mobileCards.appendChild(buildMobileCard(row, start + i + 1));
  });
  mobileCards.hidden = false;

  // --- Pagination ---
  updatePagination();
}

/* ============================================================
   Pagination
   ============================================================ */

function updatePagination() {
  const { currentPage, totalPages } = state;

  if (totalPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  pagePrev.disabled = currentPage <= 1;
  pageNext.disabled = currentPage >= totalPages;
}

pagePrev?.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

pageNext?.addEventListener('click', () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

/* ============================================================
   Action Delegation
   Handles clicks on edit/delete buttons and status dropdown changes
   in both the desktop table and mobile cards using event delegation.
   ============================================================ */

function handleActionClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  if (action === 'edit')   openEditModal(id);
  if (action === 'delete') openDeleteModal(id);
}

async function handleStatusChange(e) {
  const select = e.target.closest('select[data-action="status"]');
  if (!select) return;

  const id        = select.dataset.id;
  const newStatus = select.value;
  const oldStatus = select.dataset.status;

  if (newStatus === oldStatus) return;

  try {
    await API.updateRow(state.roadmapId, id, { status: newStatus });

    // Update local state
    const row = state.allRows.find(r => String(r.id) === String(id));
    if (row) {
      row.status = newStatus;
      select.dataset.status = newStatus;
    }

    updateProgress();
    applyFilters();
    showToast(`Status updated to "${newStatus}"`, 'success');

  } catch (err) {
    // Revert dropdown to previous value
    select.value = oldStatus;
    showToast('Failed to update status. Please try again.', 'error');
  }
}

// Attach to both table tbody and mobile cards via document delegation
document.addEventListener('click',  handleActionClick);
document.addEventListener('change', handleStatusChange);

/* ============================================================
   Add / Edit Modal
   ============================================================ */

/** Reset modal form to blank state for adding. */
function resetModalForm() {
  taskForm.reset();
  taskId.value = '';
  errMainTopic.textContent = '';
  errSubTopic.textContent  = '';
  fieldMainTopic.classList.remove('is-error');
  fieldSubTopic.classList.remove('is-error');
  taskModalTitle.textContent = 'Add Task';
  modalSubmitText.textContent = 'Save Task';
}

/** Open modal pre-filled with existing row data for editing. */
function openEditModal(id) {
  const row = state.allRows.find(r => String(r.id) === String(id));
  if (!row) return;

  resetModalForm();
  taskModalTitle.textContent  = 'Edit Task';
  modalSubmitText.textContent = 'Update Task';
  taskId.value                = row.id;
  fieldMainTopic.value        = row.main_topic   || '';
  fieldSubTopic.value         = row.sub_topic    || '';
  fieldDescription.value      = row.description  || '';
  fieldStatus.value           = row.status       || 'Pending';

  openModal(taskModalOverlay);
  fieldMainTopic.focus();
}

/** Open modal blank for adding. */
addTaskBtn?.addEventListener('click', () => {
  resetModalForm();
  openModal(taskModalOverlay);
  fieldMainTopic.focus();
});

/** Modal close / cancel */
taskModalClose?.addEventListener('click',  () => closeModal(taskModalOverlay));
taskModalCancel?.addEventListener('click', () => closeModal(taskModalOverlay));

/** Form validation */
function validateTaskForm() {
  let valid = true;

  errMainTopic.textContent = '';
  errSubTopic.textContent  = '';
  fieldMainTopic.classList.remove('is-error');
  fieldSubTopic.classList.remove('is-error');

  if (!fieldMainTopic.value.trim()) {
    errMainTopic.textContent = 'Main Topic is required.';
    fieldMainTopic.classList.add('is-error');
    valid = false;
  }

  if (!fieldSubTopic.value.trim()) {
    errSubTopic.textContent = 'Sub Topic is required.';
    fieldSubTopic.classList.add('is-error');
    valid = false;
  }

  return valid;
}

/** Form submit — handles both Add and Edit */
taskForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateTaskForm()) return;

  const isEdit = Boolean(taskId.value);
  const payload = {
    main_topic:  fieldMainTopic.value.trim(),
    sub_topic:   fieldSubTopic.value.trim(),
    description: fieldDescription.value.trim(),
    status:      fieldStatus.value,
  };

  // Show spinner
  modalSubmitText.hidden   = true;
  modalSubmitSpinner.hidden = false;
  document.getElementById('task-modal-submit').disabled = true;

  try {
    if (isEdit) {
      // Update existing row
      const updated = await API.updateRow(state.roadmapId, taskId.value, payload);
      const idx = state.allRows.findIndex(r => String(r.id) === String(taskId.value));
      if (idx !== -1) state.allRows[idx] = { ...state.allRows[idx], ...updated };
      showToast('Task updated successfully.', 'success');

    } else {
      // Create new row
      const created = await API.addRow(state.roadmapId, payload);
      state.allRows.push(created);

      // Flash new row after render
      setTimeout(() => {
        const newTr = taskTbody.querySelector(`tr[data-id="${created.id}"]`);
        if (newTr) newTr.classList.add('row-new');
      }, 100);

      showToast('Task added successfully.', 'success');
    }

    closeModal(taskModalOverlay);
    updateProgress();
    applyFilters();

  } catch (err) {
    showToast(err.message || 'Failed to save task. Please try again.', 'error');
  } finally {
    modalSubmitText.hidden    = false;
    modalSubmitSpinner.hidden = true;
    document.getElementById('task-modal-submit').disabled = false;
  }
});

/* ============================================================
   Delete Modal
   ============================================================ */

function openDeleteModal(id) {
  state.pendingDeleteId = id;
  openModal(deleteModalOverlay);
  deleteConfirm.focus();
}

deleteModalClose?.addEventListener('click', () => {
  state.pendingDeleteId = null;
  closeModal(deleteModalOverlay);
});

deleteCancel?.addEventListener('click', () => {
  state.pendingDeleteId = null;
  closeModal(deleteModalOverlay);
});

deleteConfirm?.addEventListener('click', async () => {
  const id = state.pendingDeleteId;
  if (!id) return;

  deleteBtnText.hidden    = true;
  deleteBtnSpinner.hidden = false;
  deleteConfirm.disabled  = true;

  try {
    await API.deleteRow(state.roadmapId, id);

    // Remove from local state
    state.allRows = state.allRows.filter(r => String(r.id) !== String(id));

    state.pendingDeleteId = null;
    closeModal(deleteModalOverlay);
    updateProgress();
    applyFilters();
    showToast('Task deleted.', 'success');

  } catch (err) {
    showToast(err.message || 'Failed to delete task. Please try again.', 'error');
  } finally {
    deleteBtnText.hidden    = false;
    deleteBtnSpinner.hidden = true;
    deleteConfirm.disabled  = false;
  }
});

/* ============================================================
   Modal Open / Close Helpers
   ============================================================ */

function openModal(overlay) {
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  // Trap focus inside modal on Escape
  overlay.addEventListener('keydown', trapEscape);
}

function closeModal(overlay) {
  overlay.hidden = true;
  document.body.style.overflow = '';
  overlay.removeEventListener('keydown', trapEscape);
}

function trapEscape(e) {
  if (e.key === 'Escape') {
    // Close whichever modal is open
    if (!taskModalOverlay.hidden)   closeModal(taskModalOverlay);
    if (!deleteModalOverlay.hidden) closeModal(deleteModalOverlay);
  }
}

// Close modal on overlay backdrop click (outside modal box)
taskModalOverlay?.addEventListener('click', (e) => {
  if (e.target === taskModalOverlay) closeModal(taskModalOverlay);
});

deleteModalOverlay?.addEventListener('click', (e) => {
  if (e.target === deleteModalOverlay) closeModal(deleteModalOverlay);
});

/* ============================================================
   Toolbar Event Listeners
   ============================================================ */

// Debounce search input for performance
let searchDebounce;
searchInput?.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  }, 280);
});

filterStatus?.addEventListener('change', (e) => {
  state.filterStatus = e.target.value;
  applyFilters();
});

sortBy?.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  applyFilters();
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
   Responsive: re-render on resize crossing 768px boundary
   ============================================================ */
let lastIsMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== lastIsMobile) {
    lastIsMobile = nowMobile;
    renderView();
  }
});

/* ============================================================
   Initial Data Load
   ============================================================ */

/**
 * Parse ?id= from the URL and return the roadmap ID.
 * @returns {string|null}
 */
function getRoadmapIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id')?.toLowerCase() || null;
}

/**
 * Set up page header with roadmap metadata.
 * @param {string} roadmapId
 */
function setupPageHeader(roadmapId) {
  const meta = Theme.getRoadmapMeta(roadmapId);
  if (!meta) {
    navRoadmapName.textContent = 'Unknown Roadmap';
    roadmapTitle.textContent   = 'Unknown Roadmap';
    return;
  }

  document.title           = `${meta.name} — Roadmap Tracker`;
  navRoadmapName.textContent = meta.name;
  roadmapTitle.textContent   = meta.name;
  roadmapIcon.textContent    = meta.icon;
}

/**
 * Main init: load roadmap ID, apply theme, fetch data, render.
 */
async function init() {
  const roadmapId = getRoadmapIdFromUrl();

  if (!roadmapId || !Theme.getRoadmapMeta(roadmapId)) {
    // Unknown roadmap — redirect home
    showToast('Unknown roadmap. Redirecting to dashboard.', 'error');
    setTimeout(() => window.location.replace('dashboard.html'), 1500);
    return;
  }

  state.roadmapId = roadmapId;

  // Apply roadmap color theme
  Theme.applyRoadmapTheme(roadmapId);

  // Set page header metadata
  setupPageHeader(roadmapId);

  // Show loading state initially
  tableLoading.hidden   = false;
  tableEmpty.hidden     = true;
  tableNoResults.hidden = true;
  tableWrapper.hidden   = true;
  mobileCards.hidden    = true;
  pagination.hidden     = true;

  try {
    const rows = await API.getRows(roadmapId);
    state.allRows = rows || [];

    // Hide loading spinner now that fetch is complete
    tableLoading.hidden = true;

    // Set last updated from most recent row if available
    if (rows.length > 0 && rows[0].updated_at) {
      metaUpdated.textContent = formatDate(rows[0].updated_at);
    } else {
      metaUpdated.textContent = '—';
    }

    updateProgress();
    applyFilters();

  } catch (err) {
    tableLoading.hidden = true;
    state.allRows = [];
    // Still render empty state
    updateProgress();
    applyFilters();
    showToast('Could not load tasks. Check if the backend is running.', 'error');
  }
}

/* ============================================================
   Bootstrap
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);
