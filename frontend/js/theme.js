/**
 * theme.js — Dark/Light Mode Toggle + Per-Roadmap Theme Injection
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Read saved theme from localStorage on page load
 *  - Apply [data-theme] to <html> immediately (no flash)
 *  - Handle theme toggle button clicks
 *  - Apply per-roadmap accent color via [data-roadmap] on <body>
 *  - Export helpers for other scripts to use
 */

/* ============================================================
   Roadmap Metadata Registry
   Central source of truth: id, display name, emoji icon, theme key
   ============================================================ */
const ROADMAP_META = {
  dsa:          { name: 'DSA',              icon: '🧩', color: '#7c3aed' },
  terraform:    { name: 'Terraform',        icon: '⚙️',  color: '#2563eb' },
  linux:        { name: 'Linux',            icon: '🐧', color: '#16a34a' },
  dbms:         { name: 'DBMS',             icon: '🗄️',  color: '#0891b2' },
  os:           { name: 'Operating Systems',icon: '💻', color: '#dc2626' },
  oops:         { name: 'OOPS',             icon: '🔷', color: '#db2777' },
  cn:           { name: 'Computer Networks',icon: '🌐', color: '#4f46e5' },
  cloud:        { name: 'Cloud',            icon: '☁️',  color: '#0ea5e9' },
  aws:          { name: 'AWS',              icon: '🟠', color: '#ea580c' },
  systemdesign: { name: 'System Design',   icon: '🏗️',  color: '#0d9488' },
};

/* ============================================================
   Theme Initialization (runs immediately on script load)
   ============================================================ */
(function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
})();

/**
 * Apply a theme to the document root.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateToggleIcon(theme);
}

/**
 * Update the theme toggle button icon to reflect current mode.
 * @param {'dark'|'light'} theme
 */
function updateToggleIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  // Sun = currently dark (click to go light) | Moon = currently light (click to go dark)
  icon.textContent = theme === 'dark' ? '☀' : '☾';
  icon.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

/**
 * Toggle between dark and light themes.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   Theme Toggle Button — Bind on DOMContentLoaded
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
    // Set initial icon state (in case inline script ran before DOM ready)
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    updateToggleIcon(current);
  }
});

/* ============================================================
   Roadmap Theme Application
   Called by roadmap.js to apply per-roadmap color accent
   ============================================================ */

/**
 * Apply the roadmap's accent color theme to the <body>.
 * Sets [data-roadmap] attribute which triggers CSS variable overrides.
 * @param {string} roadmapId - e.g. 'dsa', 'terraform'
 */
function applyRoadmapTheme(roadmapId) {
  const id = roadmapId.toLowerCase();
  if (!ROADMAP_META[id]) return;
  document.body.setAttribute('data-roadmap', id);
}

/**
 * Get metadata for a roadmap by its ID.
 * @param {string} roadmapId
 * @returns {{ name: string, icon: string, color: string } | null}
 */
function getRoadmapMeta(roadmapId) {
  return ROADMAP_META[roadmapId?.toLowerCase()] || null;
}

/**
 * Get all roadmap metadata entries as an array.
 * @returns {Array<{ id: string, name: string, icon: string, color: string }>}
 */
function getAllRoadmaps() {
  return Object.entries(ROADMAP_META).map(([id, meta]) => ({ id, ...meta }));
}

/**
 * Dynamically register a new roadmap into the local registry.
 * Used after a successful API.createRoadmap call so the dashboard
 * can show the new card immediately without a full page refresh.
 * @param {string} id
 * @param {{ name: string, icon: string, color: string }} meta
 */
function registerRoadmap(id, meta) {
  ROADMAP_META[id.toLowerCase()] = {
    name:  meta.name  || id,
    icon:  meta.icon  || '📌',
    color: meta.color || '#6366f1',
  };
}

/**
 * Remove a roadmap from the local registry.
 * Used after a successful API.deleteRoadmap call.
 * @param {string} id
 */
function unregisterRoadmap(id) {
  delete ROADMAP_META[id.toLowerCase()];
}

// Expose to global scope for use by other scripts
window.Theme = {
  apply: applyTheme,
  toggle: toggleTheme,
  applyRoadmapTheme,
  getRoadmapMeta,
  getAllRoadmaps,
  registerRoadmap,
  unregisterRoadmap,
};
