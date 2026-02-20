/* ============================================================
   network.js — Nexus Career Platform
   Network contacts: load, render, filter, add, edit, delete.
   Depends on: api.js (loaded before this script)
   ============================================================ */

/* In-memory store */
let allContacts = [];

/* Human-readable "met at" labels */
const MET_AT_LABELS = {
  linkedin:      'LinkedIn',
  career_fair:   'Career Fair',
  meetup:        'Meetup',
  referral:      'Referral',
  cold_outreach: 'Cold Outreach',
  other:         'Other',
};

/* ----------------------------------------------------------
   Initialise page
   ---------------------------------------------------------- */
(async () => {
  const user = await requireAuth();   // redirects if not logged in
  if (!user) return;

  initSidebar(user);
  await Promise.all([loadContacts(), loadStats()]);
})();

/* ----------------------------------------------------------
   Load contacts from API
   ---------------------------------------------------------- */
async function loadContacts() {
  try {
    const data = await apiFetch('/network');
    allContacts = data.contacts || [];
    document.getElementById('contactCount').textContent = `(${allContacts.length})`;
    renderCards(allContacts);
  } catch (err) {
    showToast('Failed to load contacts', 'error');
  }
}

/* ----------------------------------------------------------
   Load network stats
   ---------------------------------------------------------- */
async function loadStats() {
  try {
    const stats = await apiFetch('/network/stats');
    document.getElementById('statTotal').textContent    = stats.total                  ?? 0;
    document.getElementById('statLinkedIn').textContent = stats.byMetAt?.linkedin      ?? 0;
    document.getElementById('statReferral').textContent = stats.byMetAt?.referral      ?? 0;
    document.getElementById('statFair').textContent     = stats.byMetAt?.career_fair   ?? 0;
  } catch { /* non-critical */ }
}

/* ----------------------------------------------------------
   Render contact cards
   ---------------------------------------------------------- */
function renderCards(contacts) {
  const grid = document.getElementById('contactsGrid');

  if (!contacts.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🤝</div>
        <h3>No contacts yet</h3>
        <p>Build your network by adding your first contact.</p>
        <button class="btn btn-primary" onclick="openAddModal()">+ Add Contact</button>
      </div>`;
    return;
  }

  grid.innerHTML = contacts.map((c, i) => {
    const fuClass = followUpClass(c.followUpDate);
    const fuLabel = c.followUpDate ? formatDate(c.followUpDate) : null;

    return `
    <div class="contact-card" style="animation-delay:${i * 0.04}s">

      <div class="card-actions">
        <button class="icon-btn"        onclick="editContact('${c._id}')"   title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteContact('${c._id}')" title="Delete">🗑️</button>
      </div>

      <div class="card-header">
        <div class="contact-avatar">${c.name[0].toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(c.name)}</div>
          ${c.role    ? `<div class="contact-role">${escapeHtml(c.role)}</div>` : ''}
          ${c.company ? `<div class="contact-company">@ ${escapeHtml(c.company)}</div>` : ''}
        </div>
      </div>

      <span class="met-at-badge">${MET_AT_LABELS[c.metAt] || c.metAt}</span>

      <div class="card-meta">
        <div class="meta-item">
          <span class="meta-label">Email</span>
          <span class="meta-value">${
            c.email
              ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`
              : '—'
          }</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Met</span>
          <span class="meta-value">${formatDate(c.metDate)}</span>
        </div>
        ${fuLabel ? `
        <div class="meta-item">
          <span class="meta-label">Follow-Up</span>
          <span class="followup-badge ${fuClass}">${fuLabel}</span>
        </div>` : ''}
        ${c.lastContactedDate ? `
        <div class="meta-item">
          <span class="meta-label">Last Contact</span>
          <span class="meta-value">${formatDate(c.lastContactedDate)}</span>
        </div>` : ''}
      </div>

      ${c.notes ? `<div class="card-divider"></div><div class="notes-preview">${escapeHtml(c.notes)}</div>` : ''}
    </div>`;
  }).join('');
}

/* ----------------------------------------------------------
   Filter (client-side)
   ---------------------------------------------------------- */
function applyFilters() {
  const name    = document.getElementById('filterName').value.toLowerCase();
  const company = document.getElementById('filterCompany').value.toLowerCase();
  const metAt   = document.getElementById('filterMetAt').value;

  const filtered = allContacts.filter(c =>
    (!name    || c.name.toLowerCase().includes(name)) &&
    (!company || (c.company || '').toLowerCase().includes(company)) &&
    (!metAt   || c.metAt === metAt)
  );

  renderCards(filtered);
}

/* ----------------------------------------------------------
   Modal: open for add
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Contact';
  document.getElementById('submitBtn').textContent  = 'Save Contact';
  document.getElementById('editId').value           = '';
  document.getElementById('contactForm').reset();

  // Default met date to today
  document.getElementById('fMetDate').value = new Date().toISOString().split('T')[0];

  openModal('modalOverlay');
}

/* ----------------------------------------------------------
   Modal: open for edit — pre-fill fields
   ---------------------------------------------------------- */
function editContact(id) {
  const c = allContacts.find(x => x._id === id);
  if (!c) return;

  document.getElementById('modalTitle').textContent = 'Edit Contact';
  document.getElementById('submitBtn').textContent  = 'Save Changes';
  document.getElementById('editId').value           = id;

  document.getElementById('fName').value         = c.name;
  document.getElementById('fEmail').value        = c.email           || '';
  document.getElementById('fCompany').value      = c.company         || '';
  document.getElementById('fRole').value         = c.role            || '';
  document.getElementById('fMetAt').value        = c.metAt           || 'other';
  document.getElementById('fMetDate').value      = c.metDate?.split('T')[0]          || '';
  document.getElementById('fFollowUp').value     = c.followUpDate?.split('T')[0]     || '';
  document.getElementById('fLastContacted').value= c.lastContactedDate?.split('T')[0]|| '';
  document.getElementById('fNotes').value        = c.notes           || '';

  openModal('modalOverlay');
}

/* ----------------------------------------------------------
   Delete contact
   ---------------------------------------------------------- */
async function deleteContact(id) {
  if (!confirm('Remove this contact from your network?')) return;

  try {
    await apiFetch(`/network/${id}`, { method: 'DELETE' });
    showToast('Contact removed');
    await Promise.all([loadContacts(), loadStats()]);
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
    name:    document.getElementById('fName').value.trim(),
    email:   document.getElementById('fEmail').value.trim(),
    company: document.getElementById('fCompany').value.trim(),
    role:    document.getElementById('fRole').value.trim(),
    metAt:   document.getElementById('fMetAt').value,
    notes:   document.getElementById('fNotes').value.trim(),
  };

  // Only include date fields if they have values
  const metDate       = document.getElementById('fMetDate').value;
  const followUp      = document.getElementById('fFollowUp').value;
  const lastContacted = document.getElementById('fLastContacted').value;
  if (metDate)       payload.metDate           = metDate;
  if (followUp)      payload.followUpDate      = followUp;
  if (lastContacted) payload.lastContactedDate = lastContacted;

  const submitBtn = document.getElementById('submitBtn');
  const origText  = submitBtn.textContent;

  submitBtn.innerHTML = '<span class="spinner"></span>';
  submitBtn.disabled  = true;

  try {
    const url    = id ? `/network/${id}` : '/network';
    const method = id ? 'PUT' : 'POST';

    await apiFetch(url, { method, body: JSON.stringify(payload) });

    showToast(id ? '✓ Contact updated' : '✓ Contact added');
    closeModal('modalOverlay');
    await Promise.all([loadContacts(), loadStats()]);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.innerHTML = origText;
    submitBtn.disabled  = false;
  }
}

/* ----------------------------------------------------------
   Utility: escape HTML
   ---------------------------------------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
