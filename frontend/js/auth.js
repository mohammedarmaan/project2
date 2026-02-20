/* ============================================================
   auth.js — Nexus Career Platform
   Handles login, registration, and tab switching on auth.html.
   Depends on: api.js (loaded before this script)
   ============================================================ */

/* ----------------------------------------------------------
   Tab switching — Sign In ↔ Register
   ---------------------------------------------------------- */
function switchTab(tab) {
  const isLogin = tab === 'login';

  document.getElementById('loginTab').classList.toggle('active',  isLogin);
  document.getElementById('registerTab').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('hidden',  !isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);

  document.getElementById('formTitle').textContent = isLogin
    ? 'Welcome back'
    : 'Create account';

  document.getElementById('formSubtitle').textContent = isLogin
    ? 'Sign in to your account to continue'
    : 'Start tracking your job search today';

  clearMessages();
}

/* ----------------------------------------------------------
   Inline message helpers
   ---------------------------------------------------------- */
function clearMessages() {
  ['loginMsg', 'registerMsg'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'message';
    el.textContent = '';
  });
}

function showMessage(id, text, type) {
  const el = document.getElementById(id);
  el.className = `message ${type}`;
  el.textContent = text;
}

/* ----------------------------------------------------------
   Button loading state
   ---------------------------------------------------------- */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

/* ----------------------------------------------------------
   Login handler
   ---------------------------------------------------------- */
async function handleLogin(e) {
  e.preventDefault();
  clearMessages();
  setLoading('loginBtn', true);

  try {
    await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    });

    showMessage('loginMsg', '✓ Signed in successfully. Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'tracker.html'; }, 1000);

  } catch (err) {
    showMessage('loginMsg', err.message, 'error');
    setLoading('loginBtn', false);
  }
}

/* ----------------------------------------------------------
   Register handler
   ---------------------------------------------------------- */
async function handleRegister(e) {
  e.preventDefault();
  clearMessages();
  setLoading('registerBtn', true);

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name:     document.getElementById('regName').value.trim(),
        email:    document.getElementById('regEmail').value.trim(),
        password: document.getElementById('regPassword').value,
      }),
    });

    showMessage('registerMsg', '✓ Account created! Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'tracker.html'; }, 1000);

  } catch (err) {
    showMessage('registerMsg', err.message, 'error');
    setLoading('registerBtn', false);
  }
}

/* ----------------------------------------------------------
   On page load — redirect if already authenticated
   ---------------------------------------------------------- */
(async () => {
  const user = await getCurrentUser();
  if (user) window.location.href = 'tracker.html';
})();
