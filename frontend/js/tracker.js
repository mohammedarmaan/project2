/* ============================================================
   tracker.js — Momentum Career Platform
   Handles: applications CRUD, contacts per application,
            statistics dashboard (status, source, avg days,
            response rate, rejection rate, timeline).
   Depends on: api.js
   ============================================================ */

let allApplications  = [];
let allNetworkContacts = [];   // for the contact picker
let currentContactsAppId = null;

/* ----------------------------------------------------------
   Init
   ---------------------------------------------------------- */
(async () => {
  const user = await requireAuth();
  if (!user) return;
  initSidebar(user);
  await Promise.all([loadApplications(), loadQuickStats()]);
  loadNetworkContacts(); // non-blocking — used only in contacts modal
})();

/* ----------------------------------------------------------
   Page tab switching
   ---------------------------------------------------------- */
function switchPageTab(tab) {
  document.getElementById('tabApplications').classList.toggle('active', tab === 'applications');
  document.getElementById('tabStats').classList.toggle('active', tab === 'stats');
  document.getElementById('viewApplications').classList.toggle('hidden', tab !== 'applications');
  document.getElementById('viewStats').classList.toggle('hidden', tab !== 'stats');
  if (tab === 'stats') renderStatsView();
}

/* ----------------------------------------------------------
   Load applications
   ---------------------------------------------------------- */
async function loadApplications() {
  try {
    const data = await apiFetch('/applications');
    allApplications = data.applications || [];
    document.getElementById('appCount').textContent = `(${allApplications.length})`;
    renderTable(allApplications);
  } catch (err) {
    showToast('Failed to load applications', 'error');
  }
}

/* ----------------------------------------------------------
   Quick stats row (top of applications view)
   ---------------------------------------------------------- */
async function loadQuickStats() {
  try {
    const [{ stats }, streak] = await Promise.all([
      apiFetch('/applications/stats'),
      apiFetch('/applications/streak'),
    ]);
    document.getElementById('statTotal').textContent        = stats.total ?? 0;
    document.getElementById('statInterviewing').textContent = stats.byStatus?.interviewing ?? 0;
    document.getElementById('statOffer').textContent        = stats.byStatus?.offer ?? 0;
    document.getElementById('statRejected').textContent     = stats.byStatus?.rejected ?? 0;
    document.getElementById('statStreak').textContent       = streak.currentStreak ?? 0;

    // Cache stats for the stats view
    window._cachedStats  = stats;
    window._cachedStreak = streak;
  } catch { /* non-critical */ }
}

/* ----------------------------------------------------------
   Load all network contacts (for the contact picker)
   ---------------------------------------------------------- */
async function loadNetworkContacts() {
  try {
    const data = await apiFetch('/network');
    allNetworkContacts = data.contacts || [];
  } catch { /* non-critical */ }
}

/* ----------------------------------------------------------
   Render applications table
   ---------------------------------------------------------- */
function renderTable(apps) {
  const tbody = document.getElementById('appTableBody');
  if (!apps.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="7">
      <div class="empty-state">
        <div class="emoji">📭</div>
        <h3>No applications yet</h3>
        <p>Start tracking by adding your first job application.</p>
        <button class="btn btn-primary" onclick="openAddModal()">+ Add Application</button>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => {
    const contactCount = (app.contacts || []).length;
    const pillClass    = contactCount > 0 ? 'contacts-pill' : 'contacts-pill empty';
    const pillLabel    = contactCount > 0
      ? `${contactCount} contact${contactCount > 1 ? 's' : ''}`
      : '+ Link contact';

    return `<tr>
      <td class="company-cell">${escapeHtml(app.company)}</td>
      <td class="role-cell">${escapeHtml(app.role)}</td>
      <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
      <td style="color:var(--text-mid)">${sourceLabel(app.source)}</td>
      <td style="color:var(--text-mid)">${formatDate(app.dateApplied)}</td>
      <td>
        <span class="${pillClass}" onclick="openContactsModal('${app._id}')">${pillLabel}</span>
      </td>
      <td>
        <div class="action-group">
          <button class="icon-btn"        onclick="editApp('${app._id}')"   title="Edit">✏️</button>
          <button class="icon-btn danger" onclick="deleteApp('${app._id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ----------------------------------------------------------
   Filter
   ---------------------------------------------------------- */
function applyFilters() {
  const company = document.getElementById('filterCompany').value.toLowerCase();
  const status  = document.getElementById('filterStatus').value;
  const source  = document.getElementById('filterSource').value;
  renderTable(allApplications.filter(a =>
    (!company || a.company.toLowerCase().includes(company)) &&
    (!status  || a.status === status) &&
    (!source  || a.source === source)
  ));
}

/* ----------------------------------------------------------
   Add / Edit modal
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Application';
  document.getElementById('submitBtn').textContent  = 'Save Application';
  document.getElementById('editId').value           = '';
  document.getElementById('appForm').reset();
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  openModal('modalOverlay');
}

function editApp(id) {
  const app = allApplications.find(a => a._id === id);
  if (!app) return;
  document.getElementById('modalTitle').textContent = 'Edit Application';
  document.getElementById('submitBtn').textContent  = 'Save Changes';
  document.getElementById('editId').value           = id;
  document.getElementById('fCompany').value = app.company;
  document.getElementById('fRole').value    = app.role;
  document.getElementById('fStatus').value  = app.status;
  document.getElementById('fSource').value  = app.source;
  document.getElementById('fDate').value    = app.dateApplied?.split('T')[0] || '';
  document.getElementById('fNotes').value   = app.notes || '';
  document.getElementById('fSalary').value  = app.salaryRange?.min
    ? `${app.salaryRange.min}–${app.salaryRange.max}` : '';
  openModal('modalOverlay');
}

async function deleteApp(id) {
  if (!confirm('Delete this application?')) return;
  try {
    await apiFetch(`/applications/${id}`, { method: 'DELETE' });
    showToast('Application deleted');
    await Promise.all([loadApplications(), loadQuickStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = {
    company:     document.getElementById('fCompany').value.trim(),
    role:        document.getElementById('fRole').value.trim(),
    status:      document.getElementById('fStatus').value,
    source:      document.getElementById('fSource').value,
    dateApplied: document.getElementById('fDate').value,
    notes:       document.getElementById('fNotes').value.trim(),
  };

  const btn      = document.getElementById('submitBtn');
  const origText = btn.textContent;
  btn.innerHTML  = '<span class="spinner"></span>';
  btn.disabled   = true;

  try {
    await apiFetch(id ? `/applications/${id}` : '/applications', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    showToast(id ? '✓ Application updated' : '✓ Application added');
    closeModal('modalOverlay');
    await Promise.all([loadApplications(), loadQuickStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled  = false;
  }
}

/* ----------------------------------------------------------
   ─── CONTACTS MODAL ──────────────────────────────────────
   ---------------------------------------------------------- */

async function openContactsModal(appId) {
  currentContactsAppId = appId;
  const app = allApplications.find(a => a._id === appId);
  if (!app) return;

  document.getElementById('contactsModalTitle').textContent = `Contacts — ${app.company}`;
  document.getElementById('contactsModalSub').textContent   = app.role;

  renderLinkedContacts(app.contacts || []);
  populateContactPicker(app.contacts || []);
  openModal('contactsOverlay');
}

/* Render the list of already-linked contacts */
function renderLinkedContacts(contacts) {
  const list = document.getElementById('contactsList');
  if (!contacts.length) {
    list.innerHTML = `<div class="no-contacts-msg">No contacts linked yet. Link one below.</div>`;
    return;
  }
  list.innerHTML = contacts.map(c => `
    <div class="contact-linked-row">
      <div class="contact-linked-avatar">${(c.name || '?')[0].toUpperCase()}</div>
      <div class="contact-linked-info">
        <div class="contact-linked-name">${escapeHtml(c.name)}</div>
        <div class="contact-linked-meta">${[c.role, c.email].filter(Boolean).join(' · ')}</div>
      </div>
      <button class="icon-btn danger" onclick="unlinkContact('${c.networkId || ''}')" title="Unlink">✕</button>
    </div>
  `).join('');
}

/* Populate the network contact picker, excluding already-linked ones */
function populateContactPicker(linkedContacts) {
  const linkedIds = new Set(linkedContacts.map(c => c.networkId).filter(Boolean));
  const sel = document.getElementById('contactPickerSelect');
  sel.innerHTML = `<option value="">— Choose from your network —</option>` +
    allNetworkContacts
      .filter(nc => !linkedIds.has(nc._id))
      .map(nc => `<option value="${nc._id}">${escapeHtml(nc.name)}${nc.company ? ` (${escapeHtml(nc.company)})` : ''}</option>`)
      .join('');
}

/* Link an existing network contact to this application */
async function linkContact() {
  const networkId = document.getElementById('contactPickerSelect').value;
  if (!networkId) { showToast('Please select a contact', 'error'); return; }

  const nc = allNetworkContacts.find(c => c._id === networkId);
  if (!nc) return;

  const app = allApplications.find(a => a._id === currentContactsAppId);
  if (!app) return;

  const updatedContacts = [
    ...(app.contacts || []),
    { networkId: nc._id, name: nc.name, email: nc.email || '', role: nc.role || '' },
  ];

  try {
    await apiFetch(`/applications/${currentContactsAppId}`, {
      method: 'PUT',
      body: JSON.stringify({ contacts: updatedContacts }),
    });
    showToast('✓ Contact linked');
    await loadApplications();
    // Re-open with fresh data
    const updatedApp = allApplications.find(a => a._id === currentContactsAppId);
    renderLinkedContacts(updatedApp?.contacts || []);
    populateContactPicker(updatedApp?.contacts || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* Unlink a contact from this application */
async function unlinkContact(networkId) {
  if (!networkId) return;
  const app = allApplications.find(a => a._id === currentContactsAppId);
  if (!app) return;

  const updatedContacts = (app.contacts || []).filter(c => c.networkId !== networkId);

  try {
    await apiFetch(`/applications/${currentContactsAppId}`, {
      method: 'PUT',
      body: JSON.stringify({ contacts: updatedContacts }),
    });
    showToast('Contact unlinked');
    await loadApplications();
    const updatedApp = allApplications.find(a => a._id === currentContactsAppId);
    renderLinkedContacts(updatedApp?.contacts || []);
    populateContactPicker(updatedApp?.contacts || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* Add a brand-new contact to the network AND link it */
async function addNewContact() {
  const name = document.getElementById('newContactName').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }

  const app = allApplications.find(a => a._id === currentContactsAppId);
  if (!app) return;

  try {
    // 1. Create network contact via the "from-application" route
    const { contact } = await apiFetch('/network/from-application', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email:   document.getElementById('newContactEmail').value.trim(),
        company: app.company,
        role:    document.getElementById('newContactRole').value.trim(),
        metAt:   document.getElementById('newContactMetAt').value,
        notes:   document.getElementById('newContactNotes').value.trim(),
      }),
    });

    // 2. Link the new contact to this application
    const updatedContacts = [
      ...(app.contacts || []),
      { networkId: contact._id, name: contact.name, email: contact.email || '', role: contact.role || '' },
    ];
    await apiFetch(`/applications/${currentContactsAppId}`, {
      method: 'PUT',
      body: JSON.stringify({ contacts: updatedContacts }),
    });

    showToast('✓ Contact added & linked');

    // Clear the new-contact form
    ['newContactName','newContactEmail','newContactRole','newContactNotes'].forEach(id => {
      document.getElementById(id).value = '';
    });

    await Promise.all([loadApplications(), loadNetworkContacts()]);
    const updatedApp = allApplications.find(a => a._id === currentContactsAppId);
    renderLinkedContacts(updatedApp?.contacts || []);
    populateContactPicker(updatedApp?.contacts || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ----------------------------------------------------------
   ─── STATISTICS VIEW ─────────────────────────────────────
   ---------------------------------------------------------- */

async function renderStatsView() {
  // Use cached data if available, otherwise fetch fresh
  let stats, streak;
  try {
    if (window._cachedStats) {
      stats  = window._cachedStats;
      streak = window._cachedStreak;
    } else {
      ([{ stats }, streak] = await Promise.all([
        apiFetch('/applications/stats'),
        apiFetch('/applications/streak'),
      ]));
    }
  } catch {
    showToast('Failed to load statistics', 'error');
    return;
  }

  const total     = stats.total ?? 0;
  const rejected  = stats.byStatus?.rejected ?? 0;
  const responded = total - (stats.byStatus?.applied ?? 0);

  // KPI cards
  document.getElementById('s_total').textContent         = total;
  document.getElementById('s_responseRate').textContent  = total ? `${Math.round((responded / total) * 100)}%` : '—';
  document.getElementById('s_rejectionRate').textContent = total ? `${Math.round((rejected  / total) * 100)}%` : '—';
  document.getElementById('s_offerRate').textContent     = total ? `${Math.round(((stats.byStatus?.offer ?? 0) / total) * 100)}%` : '—';
  document.getElementById('s_longestStreak').textContent = streak?.longestStreak ?? '—';

  renderStatusBreakdown(stats.byStatus || {}, total);
  renderAvgDays(stats.avgDaysPerStage || {});
  renderSourceBreakdown(stats.bySource || []);
  renderTimeline();
}

/* Status breakdown bars */
function renderStatusBreakdown(byStatus, total) {
  const ORDER  = ['applied','screening','interviewing','offer','rejected','withdrawn'];
  const el     = document.getElementById('statusBreakdown');

  if (!total) { el.innerHTML = `<div class="stats-empty">No data yet</div>`; return; }

  el.innerHTML = ORDER.map(status => {
    const count = byStatus[status] ?? 0;
    const pct   = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <span class="breakdown-label">${status}</span>
          <span class="breakdown-value">${count} <small style="font-weight:400;color:var(--text-light)">(${pct}%)</small></span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill ${status}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* Average days per stage */
function renderAvgDays(avgDaysPerStage) {
  const el     = document.getElementById('avgDaysBreakdown');
  const stages = Object.entries(avgDaysPerStage).filter(([, v]) => v > 0);

  if (!stages.length) { el.innerHTML = `<div class="stats-empty">Not enough data yet</div>`; return; }

  const max = Math.max(...stages.map(([, v]) => v));
  el.innerHTML = stages.map(([stage, days]) => {
    const pct = Math.round((days / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <span class="breakdown-label">${stage}</span>
          <span class="breakdown-value">${days}d</span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* Source breakdown */
function renderSourceBreakdown(bySource) {
  const el = document.getElementById('sourceBreakdown');
  if (!bySource.length) { el.innerHTML = `<div class="stats-empty">No data yet</div>`; return; }

  const max = Math.max(...bySource.map(s => s.total));
  el.innerHTML = bySource.map(s => {
    const pct = Math.round((s.total / max) * 100);
    const rr  = Math.round(s.responseRate ?? 0);
    return `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <span class="breakdown-label">${sourceLabel(s._id)}</span>
          <span class="breakdown-value">${s.total}</span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="breakdown-sublabel">Response rate: ${rr}%</span>
      </div>`;
  }).join('');
}

/* Applications over time — last 8 months */
function renderTimeline() {
  const el = document.getElementById('timelineChart');
  if (!allApplications.length) {
    el.innerHTML = `<div class="stats-empty" style="width:100%">No data yet</div>`;
    return;
  }

  // Build month buckets — last 8 months
  const buckets = {};
  for (let i = 7; i >= 0; i--) {
    const d   = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    buckets[key] = 0;
  }

  allApplications.forEach(app => {
    const d   = new Date(app.dateApplied);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    if (key in buckets) buckets[key]++;
  });

  const max = Math.max(...Object.values(buckets), 1);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  el.innerHTML = Object.entries(buckets).map(([key, count]) => {
    const [, m]  = key.split('-');
    const label  = months[parseInt(m) - 1];
    const height = Math.max(Math.round((count / max) * 100), count > 0 ? 4 : 0);
    return `
      <div class="timeline-bar-wrap">
        <div class="timeline-bar" style="height:${height}%" data-tip="${count} app${count !== 1 ? 's' : ''}"></div>
        <div class="timeline-label">${label}</div>
      </div>`;
  }).join('');
}

/* ----------------------------------------------------------
   Utility
   ---------------------------------------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}