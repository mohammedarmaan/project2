/* ============================================================
   tracker.js — Momentum Career Platform
   Application tracker: load, render, filter, add, edit, delete.
   Depends on: api.js (loaded before this script)
   ============================================================ */

/* In-memory store for the current user's applications */
let allApplications = [];

/* ----------------------------------------------------------
   Initialise page
   ---------------------------------------------------------- */
(async () => {
  const user = await requireAuth();   // redirects to auth.html if not logged in
  if (!user) return;

  initSidebar(user);
  await Promise.all([loadApplications(), loadStats()]);
})();

/* ----------------------------------------------------------
   Load applications from API
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
   Load stats (totals + streak)
   ---------------------------------------------------------- */
async function loadStats() {
  try {
    const [{ stats }, streak] = await Promise.all([
      apiFetch('/applications/stats'),
      apiFetch('/applications/streak'),
    ]);

    document.getElementById('statTotal').textContent        = stats.total           ?? 0;
    document.getElementById('statInterviewing').textContent = stats.byStatus?.interviewing ?? 0;
    document.getElementById('statOffer').textContent        = stats.byStatus?.offer        ?? 0;
    document.getElementById('statStreak').textContent       = streak.currentStreak         ?? 0;
  } catch { /* non-critical */ }
}

/* ----------------------------------------------------------
   Render applications table
   ---------------------------------------------------------- */
function renderTable(apps) {
  const tbody = document.getElementById('appTableBody');

  if (!apps.length) {
    tbody.innerHTML = `
      <tr class="loading-row"><td colspan="6">
        <div class="empty-state">
          <div class="emoji">📭</div>
          <h3>No applications yet</h3>
          <p>Start tracking by adding your first job application.</p>
          <button class="btn btn-primary" onclick="openAddModal()">+ Add Application</button>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => `
    <tr>
      <td class="company-cell">${escapeHtml(app.company)}</td>
      <td class="role-cell">${escapeHtml(app.role)}</td>
      <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
      <td style="color:var(--text-mid)">${sourceLabel(app.source)}</td>
      <td style="color:var(--text-mid)">${formatDate(app.dateApplied)}</td>
      <td>
        <div class="action-group">
          <button class="icon-btn"        onclick="editApp('${app._id}')"   title="Edit">✏️</button>
          <button class="icon-btn danger" onclick="deleteApp('${app._id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ----------------------------------------------------------
   Filter (client-side, no extra API call)
   ---------------------------------------------------------- */
function applyFilters() {
  const company = document.getElementById('filterCompany').value.toLowerCase();
  const status  = document.getElementById('filterStatus').value;
  const source  = document.getElementById('filterSource').value;

  const filtered = allApplications.filter(a =>
    (!company || a.company.toLowerCase().includes(company)) &&
    (!status  || a.status  === status) &&
    (!source  || a.source  === source)
  );

  renderTable(filtered);
}

/* ----------------------------------------------------------
   Modal: open for add
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('modalTitle').textContent  = 'Add Application';
  document.getElementById('submitBtn').textContent   = 'Save Application';
  document.getElementById('editId').value            = '';
  document.getElementById('appForm').reset();

  // Default date to today
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];

  openModal('modalOverlay');
}

/* ----------------------------------------------------------
   Modal: open for edit — pre-fill fields
   ---------------------------------------------------------- */
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
    ? `${app.salaryRange.min}–${app.salaryRange.max}`
    : '';

  openModal('modalOverlay');
}

/* ----------------------------------------------------------
   Delete application
   ---------------------------------------------------------- */
async function deleteApp(id) {
  if (!confirm('Delete this application?')) return;

  try {
    await apiFetch(`/applications/${id}`, { method: 'DELETE' });
    showToast('Application deleted');
    await Promise.all([loadApplications(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ----------------------------------------------------------
   Form submit — create or update
   ---------------------------------------------------------- */
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

  const submitBtn = document.getElementById('submitBtn');
  const origText  = submitBtn.textContent;

  submitBtn.innerHTML  = '<span class="spinner"></span>';
  submitBtn.disabled   = true;

  try {
    const url    = id ? `/applications/${id}` : '/applications';
    const method = id ? 'PUT' : 'POST';

    await apiFetch(url, { method, body: JSON.stringify(payload) });

    showToast(id ? '✓ Application updated' : '✓ Application added');
    closeModal('modalOverlay');
    await Promise.all([loadApplications(), loadStats()]);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.innerHTML = origText;
    submitBtn.disabled  = false;
  }
}

/* ----------------------------------------------------------
   Utility: escape HTML to prevent XSS in rendered content
   ---------------------------------------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
