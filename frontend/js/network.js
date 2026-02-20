/* ============================================================
   network.js — Momentum Career Platform
   Handles: contacts CRUD, statistics (total, byCompany,
            byMetAt, follow-ups due).
   Depends on: api.js
   ============================================================ */

let allContacts = [];

const MET_AT_LABELS = {
  linkedin:      'LinkedIn',
  career_fair:   'Career Fair',
  meetup:        'Meetup',
  referral:      'Referral',
  cold_outreach: 'Cold Outreach',
  other:         'Other',
};

/* ----------------------------------------------------------
   Init
   ---------------------------------------------------------- */
(async () => {
  const user = await requireAuth();
  if (!user) return;
  initSidebar(user);
  await Promise.all([loadContacts(), loadQuickStats()]);
})();

/* ----------------------------------------------------------
   Page tab switching
   ---------------------------------------------------------- */
function switchPageTab(tab) {
  document.getElementById('tabContacts').classList.toggle('active', tab === 'contacts');
  document.getElementById('tabStats').classList.toggle('active',    tab === 'stats');
  document.getElementById('viewContacts').classList.toggle('hidden', tab !== 'contacts');
  document.getElementById('viewStats').classList.toggle('hidden',    tab !== 'stats');
  if (tab === 'stats') renderStatsView();
}

/* ----------------------------------------------------------
   Load contacts
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
   Quick stats row (top of contacts view)
   ---------------------------------------------------------- */
async function loadQuickStats() {
  try {
    const stats = await apiFetch('/network/stats');
    window._cachedNetworkStats = stats;

    document.getElementById('statTotal').textContent    = stats.total ?? 0;
    document.getElementById('statLinkedIn').textContent = stats.byMetAt?.linkedin    ?? 0;
    document.getElementById('statReferral').textContent = stats.byMetAt?.referral    ?? 0;
    document.getElementById('statFair').textContent     = stats.byMetAt?.career_fair ?? 0;
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
          <span class="meta-value">${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : '—'}</span>
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
   Filter
   ---------------------------------------------------------- */
function applyFilters() {
  const name    = document.getElementById('filterName').value.toLowerCase();
  const company = document.getElementById('filterCompany').value.toLowerCase();
  const metAt   = document.getElementById('filterMetAt').value;
  renderCards(allContacts.filter(c =>
    (!name    || c.name.toLowerCase().includes(name)) &&
    (!company || (c.company || '').toLowerCase().includes(company)) &&
    (!metAt   || c.metAt === metAt)
  ));
}

/* ----------------------------------------------------------
   Add / Edit modal
   ---------------------------------------------------------- */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Contact';
  document.getElementById('submitBtn').textContent  = 'Save Contact';
  document.getElementById('editId').value           = '';
  document.getElementById('contactForm').reset();
  document.getElementById('fMetDate').value = new Date().toISOString().split('T')[0];
  openModal('modalOverlay');
}

function editContact(id) {
  const c = allContacts.find(x => x._id === id);
  if (!c) return;
  document.getElementById('modalTitle').textContent = 'Edit Contact';
  document.getElementById('submitBtn').textContent  = 'Save Changes';
  document.getElementById('editId').value           = id;
  document.getElementById('fName').value          = c.name;
  document.getElementById('fEmail').value         = c.email            || '';
  document.getElementById('fCompany').value       = c.company          || '';
  document.getElementById('fRole').value          = c.role             || '';
  document.getElementById('fMetAt').value         = c.metAt            || 'other';
  document.getElementById('fMetDate').value       = c.metDate?.split('T')[0]           || '';
  document.getElementById('fFollowUp').value      = c.followUpDate?.split('T')[0]      || '';
  document.getElementById('fLastContacted').value = c.lastContactedDate?.split('T')[0] || '';
  document.getElementById('fNotes').value         = c.notes            || '';
  openModal('modalOverlay');
}

async function deleteContact(id) {
  if (!confirm('Remove this contact from your network?')) return;
  try {
    await apiFetch(`/network/${id}`, { method: 'DELETE' });
    showToast('Contact removed');
    await Promise.all([loadContacts(), loadQuickStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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
  const metDate       = document.getElementById('fMetDate').value;
  const followUp      = document.getElementById('fFollowUp').value;
  const lastContacted = document.getElementById('fLastContacted').value;
  if (metDate)       payload.metDate           = metDate;
  if (followUp)      payload.followUpDate      = followUp;
  if (lastContacted) payload.lastContactedDate = lastContacted;

  const btn      = document.getElementById('submitBtn');
  const origText = btn.textContent;
  btn.innerHTML  = '<span class="spinner"></span>';
  btn.disabled   = true;

  try {
    await apiFetch(id ? `/network/${id}` : '/network', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    showToast(id ? '✓ Contact updated' : '✓ Contact added');
    closeModal('modalOverlay');
    await Promise.all([loadContacts(), loadQuickStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = origText;
    btn.disabled  = false;
  }
}

/* ----------------------------------------------------------
   ─── STATISTICS VIEW ─────────────────────────────────────
   ---------------------------------------------------------- */

async function renderStatsView() {
  let stats;
  try {
    stats = window._cachedNetworkStats || await apiFetch('/network/stats');
  } catch {
    showToast('Failed to load statistics', 'error');
    return;
  }

  const total      = stats.total ?? 0;
  const companies  = Object.keys(stats.byCompany || {}).filter(k => k && k !== 'unknown').length;
  const topSource  = Object.entries(stats.byMetAt || {}).sort((a,b) => b[1]-a[1])[0];
  const followDue  = allContacts.filter(c => c.followUpDate && new Date(c.followUpDate) <= new Date()).length;

  document.getElementById('s_total').textContent     = total;
  document.getElementById('s_companies').textContent = companies || '—';
  document.getElementById('s_topSource').textContent = topSource ? MET_AT_LABELS[topSource[0]] || topSource[0] : '—';
  document.getElementById('s_followups').textContent = followDue;

  renderCompanyBreakdown(stats.byCompany || {}, total);
  renderMetAtBreakdown(stats.byMetAt || {}, total);
}

/* Contacts per company */
function renderCompanyBreakdown(byCompany, total) {
  const el      = document.getElementById('companyBreakdown');
  const entries = Object.entries(byCompany)
    .filter(([k]) => k && k !== 'unknown')
    .sort((a,b) => b[1]-a[1])
    .slice(0, 10);   // top 10

  if (!entries.length) { el.innerHTML = `<div class="stats-empty">No data yet</div>`; return; }

  const max = entries[0][1];
  el.innerHTML = entries.map(([company, count]) => {
    const pct = Math.round((count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <span class="breakdown-label">${escapeHtml(company)}</span>
          <span class="breakdown-value">${count}</span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* Contacts by meeting source */
function renderMetAtBreakdown(byMetAt, total) {
  const el      = document.getElementById('metAtBreakdown');
  const entries = Object.entries(byMetAt).sort((a,b) => b[1]-a[1]);

  if (!entries.length || !total) { el.innerHTML = `<div class="stats-empty">No data yet</div>`; return; }

  const max = entries[0][1];
  el.innerHTML = entries.map(([source, count]) => {
    const pct  = Math.round((count / max) * 100);
    const share = Math.round((count / total) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-row-header">
          <span class="breakdown-label">${MET_AT_LABELS[source] || source}</span>
          <span class="breakdown-value">${count} <small style="font-weight:400;color:var(--text-light)">(${share}%)</small></span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill ${source}" style="width:${pct}%"></div>
        </div>
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