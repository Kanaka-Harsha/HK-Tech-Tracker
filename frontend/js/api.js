/**
 * api.js — API Integration Layer
 * Roadmap Tracker
 *
 * Single source of truth for all HTTP calls.
 * Change BASE_URL to point to production when deploying.
 *
 * Usage (consumed by login.js, dashboard.js, roadmap.js):
 *   const data  = await API.login(user, pass);
 *   const rows  = await API.getRows('dsa');
 *   const added = await API.addRow('dsa', payload);
 *   await API.updateRow('dsa', id, patch);
 *   await API.deleteRow('dsa', id);
 *   const prog  = await API.getRoadmapProgress('dsa');
 *   const rm    = await API.createRoadmap({ id, name, icon });
 *   await API.deleteRoadmap('my-roadmap');
 *
 * ─────────────────────────────────────────────
 * MOCK MODE
 * Set MOCK_MODE = true to run the UI entirely
 * offline (no backend needed). All data is
 * persisted in localStorage under "mock_db".
 * ─────────────────────────────────────────────
 */

'use strict';

/* ============================================================
   Configuration
   ============================================================ */

/** Base URL for the Python backend.
 *  ⚠️  When your backend is running locally and the frontend is on Vercel,
 *      set this to your ngrok tunnel URL, e.g.:
 *      'https://abcd-1234.ngrok-free.app/api/v1'
 *  For local full-stack dev: 'http://localhost:8000/api/v1'
 */
// const BASE_URL = 'http://localhost:8000/api/v1';
const BASE_URL = 'https://casually-override-childlike.ngrok-free.dev/api/v1';

/**
 * Set to true to use in-browser mock data instead of the real API.
 * Useful for UI testing before the backend is ready.
 */
const MOCK_MODE = false;

/* ============================================================
   Auth Helper
   ============================================================ */

/**
 * Build default request headers, injecting the JWT token if present.
 * @returns {HeadersInit}
 */
function authHeaders() {
  const token = sessionStorage.getItem('auth_token');
  const headers = { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'  // Bypasses ngrok's interstitial warning page
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/* ============================================================
   Core Request Wrapper
   ============================================================ */

/**
 * Generic fetch wrapper with error handling.
 * Throws an Error with a user-friendly message on failure.
 *
 * @param {string} path      - e.g. '/auth/login'
 * @param {RequestInit} opts - fetch options
 * @returns {Promise<any>}   - parsed JSON response
 */
async function request(path, opts = {}) {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });

  // Handle non-2xx responses
  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      // Support common error payload shapes: { message }, { error }, { detail }
      errorMsg = errData.message || errData.error || errData.detail || errorMsg;
    } catch {
      // Response body was not JSON — use status text
      errorMsg = response.statusText || errorMsg;
    }

    // 401 Unauthorized — token expired or invalid; redirect to login
    if (response.status === 401) {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      window.location.replace('login.html');
    }

    throw new Error(errorMsg);
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

/* ============================================================
   Mock Database Helpers (MOCK_MODE only)
   ============================================================ */

const MOCK_USER     = { username: 'admin', password: 'admin123' };
const MOCK_DB_KEY   = 'mock_roadmap_db';
let   _mockToken    = null;
let   _mockIdSeq    = 1000;

/** Load the mock DB from localStorage. */
function mockLoad() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_DB_KEY)) || {};
  } catch {
    return {};
  }
}

/** Save the mock DB to localStorage. */
function mockSave(db) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

/**
 * Get or init a roadmap's rows array in the mock DB.
 * @param {string} roadmapId
 * @returns {{ db: Object, rows: Array }}
 */
function mockGetRows(roadmapId) {
  const db = mockLoad();
  if (!db[roadmapId]) db[roadmapId] = [];
  return { db, rows: db[roadmapId] };
}

/** Simulate network delay. */
function mockDelay(ms = 180) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ============================================================
   MOCK implementations
   ============================================================ */

const Mock = {
  async login(username, password) {
    await mockDelay();
    if (username === MOCK_USER.username && password === MOCK_USER.password) {
      _mockToken = 'mock-token-' + Date.now();
      return { token: _mockToken };
    }
    throw new Error('Invalid username or password.');
  },

  async signup(name, user_id, user_pass) {
    await mockDelay();
    // In mock mode just accept any signup
    return { message: 'Signup Successful' };
  },

  async logout() {
    await mockDelay(80);
    _mockToken = null;
    return null;
  },

  async getRows(roadmapId) {
    await mockDelay();
    const { rows } = mockGetRows(roadmapId);
    return rows;
  },

  async addRow(roadmapId, payload) {
    await mockDelay();
    const { db, rows } = mockGetRows(roadmapId);
    const newRow = {
      id:           ++_mockIdSeq,
      main_topic:   payload.main_topic   || '',
      sub_topic:    payload.sub_topic    || '',
      description:  payload.description  || '',
      status:       payload.status       || 'Pending',
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };
    rows.push(newRow);
    db[roadmapId] = rows;
    mockSave(db);
    return newRow;
  },

  async updateRow(roadmapId, id, patch) {
    await mockDelay();
    const { db, rows } = mockGetRows(roadmapId);
    const idx = rows.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) throw new Error('Task not found.');
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
    db[roadmapId] = rows;
    mockSave(db);
    return rows[idx];
  },

  async deleteRow(roadmapId, id) {
    await mockDelay();
    const { db, rows } = mockGetRows(roadmapId);
    const idx = rows.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) throw new Error('Task not found.');
    rows.splice(idx, 1);
    db[roadmapId] = rows;
    mockSave(db);
    return null;
  },

  async getRoadmapProgress(roadmapId) {
    await mockDelay(120);
    const { rows } = mockGetRows(roadmapId);
    const total     = rows.length;
    const completed = rows.filter((r) => r.status === 'Completed').length;
    const ongoing   = rows.filter((r) => r.status === 'Ongoing').length;
    const pending   = rows.filter((r) => r.status === 'Pending').length;
    const lastRow   = [...rows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    return {
      total,
      completed,
      ongoing,
      pending,
      lastUpdated: lastRow?.updated_at || null,
    };
  },

  async getNotes(roadmapId) {
    await mockDelay();
    const db = mockLoad();
    if (!db.notes) db.notes = {};
    if (!db.notes[roadmapId]) {
      db.notes[roadmapId] = { title: '', notes: '' };
      mockSave(db);
    }
    return {
      roadmap_id: roadmapId,
      ...db.notes[roadmapId]
    };
  },

  async updateNotes(roadmapId, payload) {
    await mockDelay();
    const db = mockLoad();
    if (!db.notes) db.notes = {};
    db.notes[roadmapId] = {
      title: payload.title !== undefined ? payload.title : '',
      notes: payload.notes !== undefined ? payload.notes : ''
    };
    mockSave(db);
    return {
      roadmap_id: roadmapId,
      ...db.notes[roadmapId]
    };
  },

  async createRoadmap(payload) {
    await mockDelay();
    // Mock: just return the payload as if created
    return { message: 'Roadmap created (mock)', ...payload };
  },

  async deleteRoadmap(roadmapId) {
    await mockDelay();
    const db = mockLoad();
    delete db[roadmapId];
    mockSave(db);
    return null;
  },
};

/* ============================================================
   Real API implementations
   ============================================================ */

const Real = {
  /**
   * Authenticate with the backend.
   * POST /auth/login
   * Body: { username, password }
   * Returns: { token: string }
   */
  async login(user_id, user_pass) { // API CREATED
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_id, user_pass }),
    });
  },

  /**
   * Register a new user.
   * POST /auth/signup
   * Body: { name, user_id, user_pass }
   * Returns: { message: string }
   */
  async signup(name, user_id, user_pass) { // API CREATED
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, user_id, user_pass }),
    });
  },

  /**
   * Invalidate the current session on the backend.
   * POST /auth/logout
   * Returns: null
   */
  async logout() { // API CREATED
    return request('/auth/logout', { method: 'POST' });
  },

  /**
   * Fetch all rows for a given roadmap.
   * GET /roadmap/:roadmapId
   * Returns: Array<Row>
   */
  async getRows(roadmapId) { // API CREATED
    return request(`/roadmap/${encodeURIComponent(roadmapId)}`);
  },

  /**
   * Add a new row to a roadmap.
   * POST /roadmap/:roadmapId
   * Body: { main_topic, sub_topic, description, status }
   * Returns: Row
   */ 
  async addRow(roadmapId, payload) { // API CREATED
    return request(`/roadmap/${encodeURIComponent(roadmapId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update an existing row (full or partial).
   * PUT /roadmap/:roadmapId/:id
   * Body: Partial<Row>
   * Returns: Row
   */
  async updateRow(roadmapId, id, patch) { // API Created
    return request(`/roadmap/${encodeURIComponent(roadmapId)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  /**
   * Delete a row.
   * DELETE /roadmap/:roadmapId/:id
   * Returns: null
   */
  async deleteRow(roadmapId, id) { // API Created
    return request(`/roadmap/${encodeURIComponent(roadmapId)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get aggregated progress stats for a roadmap.
   * Used by the dashboard cards.
   * GET /roadmap/:roadmapId/progress
   * Returns: { total, completed, ongoing, pending, lastUpdated }
   */
  async getRoadmapProgress(roadmapId) { // API Created
    return request(`/roadmap/${encodeURIComponent(roadmapId)}/progress`);
  },

  /**
   * Fetch notes for a given roadmap.
   * GET /notes/:roadmapId
   */
  async getNotes(roadmapId) {
    return request(`/notes/${encodeURIComponent(roadmapId)}`);
  },

  /**
   * Update/upsert notes for a given roadmap.
   * PUT /notes/updateNote/:roadmapId
   */
  async updateNotes(roadmapId, payload) {
    return request(`/notes/updateNote/${encodeURIComponent(roadmapId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Create a new roadmap.
   * POST /roadmap/create
   * Body: { id, name, icon }
   * Returns: { message, id, name, created_at }
   */
  async createRoadmap(payload) {
    return request('/roadmap/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Delete a roadmap by its ID.
   * DELETE /roadmap/:roadmapId
   * Returns: null
   */
  async deleteRoadmap(roadmapId) {
    return request(`/roadmap/${encodeURIComponent(roadmapId)}`, {
      method: 'DELETE',
    });
  },
};

/* ============================================================
   Public API object — auto-selects Mock or Real
   ============================================================ */

/**
 * The global API object, consumed by all page scripts.
 * Switch between mock and real by toggling MOCK_MODE above.
 */
window.API = MOCK_MODE ? Mock : Real;

/* ============================================================
   Dev helper — log mode in console
   ============================================================ */
if (MOCK_MODE) {
  console.info(
    '%c[API] MOCK MODE enabled — no backend required.',
    'color:#f59e0b; font-weight:bold'
  );
  console.info('Credentials: username=admin  password=admin123');
} else {
  console.info(
    `%c[API] Real mode — backend: ${BASE_URL}`,
    'color:#6ee7b7; font-weight:bold'
  );
}
