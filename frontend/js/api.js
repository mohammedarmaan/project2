/* ============================================================
   api.js — Nexus Career Platform
   Shared fetch helpers and auth utilities.
   Imported by: auth.js, tracker.js, network.js
   ============================================================ */

const API = 'http://localhost:3000/api';

/* ----------------------------------------------------------
   Core fetch wrapper
   Adds credentials, JSON headers, and throws on HTTP errors.
   ---------------------------------------------------------- */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/* ----------------------------------------------------------
   Auth helpers
   ---------------------------------------------------------- */

/** Returns the current user object, or null if not logged in. */
async function getCurrentUser() {
  try {
    const data = await apiFetch('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Auth guard — redirects to auth.html if not logged in.
 * Returns the user object on success.
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'auth.html';
    return null;
  }
  return user;
}

/** Log the current user out and redirect to auth.html. */
async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  window.location.href = 'auth.html';
}

/* ----------------------------------------------------------
   Toast notification
   ---------------------------------------------------------- */

/**
 * Show a toast message.
 * @param {string} msg
 * @param {'success'|'error'} type
 */
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3200);
}

/* ----------------------------------------------------------
   Sidebar initialisation
   Populates user avatar + name, and wires the logout button.
   ---------------------------------------------------------- */
function initSidebar(user) {
  const avatarEl = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('userName');

  if (avatarEl) avatarEl.textContent = user.name[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = user.name;

  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

/* ----------------------------------------------------------
   Modal helpers
   ---------------------------------------------------------- */

/** Open a modal overlay by its element or id. */
function openModal(overlayId) {
  const el = typeof overlayId === 'string'
    ? document.getElementById(overlayId)
    : overlayId;
  if (el) el.classList.add('open');
}

/** Close a modal overlay. */
function closeModal(overlayId) {
  const el = typeof overlayId === 'string'
    ? document.getElementById(overlayId)
    : overlayId;
  if (el) el.classList.remove('open');
}

/** Close modal when clicking the backdrop (not the modal box itself). */
function closeModalOnBackdrop(event, overlayId) {
  const overlay = typeof overlayId === 'string'
    ? document.getElementById(overlayId)
    : overlayId;
  if (event.target === overlay) closeModal(overlay);
}

/* ----------------------------------------------------------
   Formatting utilities
   ---------------------------------------------------------- */

/** Format an ISO date string → "Jan 1, 2025" */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Return the CSS class suffix for a follow-up date urgency. */
function followUpClass(iso) {
  if (!iso) return null;
  const daysUntil = (new Date(iso) - Date.now()) / 86_400_000;
  if (daysUntil < 0)   return 'followup-overdue';
  if (daysUntil <= 7)  return 'followup-soon';
  return 'followup-ok';
}

/** Human-readable source labels for applications and network. */
const SOURCE_LABELS = {
  linkedin:         'LinkedIn',
  company_website:  'Website',
  referral:         'Referral',
  job_board:        'Job Board',
  recruiter:        'Recruiter',
  career_fair:      'Career Fair',
  meetup:           'Meetup',
  cold_outreach:    'Cold Outreach',
  other:            'Other',
};

function sourceLabel(key) {
  return SOURCE_LABELS[key] || key;
}
