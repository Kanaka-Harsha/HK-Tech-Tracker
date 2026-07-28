/**
 * login.js — Login Page Logic
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Redirect already-authenticated users to dashboard
 *  - Validate form fields client-side before API call
 *  - Call API.login() and handle success / error
 *  - Store auth token in sessionStorage on success
 *  - Password show/hide toggle
 *  - Toast notifications for errors
 */

/* ============================================================
   Auth Guard — redirect if already logged in
   ============================================================ */
(function authGuard() {
  if (sessionStorage.getItem('auth_token')) {
    window.location.replace('dashboard.html');
  }
})();

/* ============================================================
   DOM References
   ============================================================ */
const loginForm      = document.getElementById('login-form');
const usernameInput  = document.getElementById('username');
const passwordInput  = document.getElementById('password');
const usernameError  = document.getElementById('username-error');
const passwordError  = document.getElementById('password-error');
const loginAlert     = document.getElementById('login-alert');
const loginBtn       = document.getElementById('login-btn');
const loginBtnText   = document.getElementById('login-btn-text');
const loginSpinner   = document.getElementById('login-spinner');
const pwToggleBtn    = document.getElementById('password-toggle');
const pwToggleIcon   = document.getElementById('password-toggle-icon');

/* ============================================================
   Utilities
   ============================================================ */

/** Show an inline field error. */
function showFieldError(el, msg) {
  el.textContent = msg;
  // Walk up to find the form-input sibling and add error class
  const input = el.previousElementSibling?.tagName === 'INPUT'
    ? el.previousElementSibling
    : el.closest('.form-group')?.querySelector('.form-input');
  if (input) input.classList.add('is-error');
}

/** Clear an inline field error. */
function clearFieldError(el) {
  el.textContent = '';
  const input = el.closest('.form-group')?.querySelector('.form-input');
  if (input) input.classList.remove('is-error');
}

/** Show / hide the global alert banner. */
function showAlert(msg) {
  loginAlert.textContent = msg;
  loginAlert.hidden = false;
}

function hideAlert() {
  loginAlert.textContent = '';
  loginAlert.hidden = true;
}

/** Set loading state on the submit button. */
function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtnText.textContent = isLoading ? 'Signing in…' : 'Sign In';
  if (loginSpinner) loginSpinner.hidden = !isLoading;
}

/** Show a toast notification. */
function showToast(msg, type = 'error') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.hidden = false;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

/* ============================================================
   Validation
   ============================================================ */

/**
 * Validate form fields. Returns true if valid.
 * @returns {boolean}
 */
function validateForm() {
  let valid = true;

  // Clear previous errors
  clearFieldError(usernameError);
  clearFieldError(passwordError);
  hideAlert();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username) {
    showFieldError(usernameError, 'Username is required.');
    valid = false;
  } else if (username.length < 2) {
    showFieldError(usernameError, 'Username must be at least 2 characters.');
    valid = false;
  }

  if (!password) {
    showFieldError(passwordError, 'Password is required.');
    valid = false;
  } else if (password.length < 4) {
    showFieldError(passwordError, 'Password must be at least 4 characters.');
    valid = false;
  }

  return valid;
}

/* ============================================================
   Form Submit Handler
   ============================================================ */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  setLoading(true);
  hideAlert();

  try {
    // API.login is defined in api.js and returns { token: string, user: {...} }
    const data = await API.login(username, password);

    const token = data.token || `token-${Date.now()}`;
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('auth_user', username);

    // Navigate to dashboard
    window.location.replace('dashboard.html');

  } catch (err) {
    // API throws an Error with a message from the server
    const msg = err.message || 'Login failed. Please try again.';
    showAlert(msg);
    showToast(msg, 'error');
    // Focus back to username for retry
    usernameInput.focus();
  } finally {
    setLoading(false);
  }
});

/* ============================================================
   Clear error on typing
   ============================================================ */
usernameInput.addEventListener('input', () => clearFieldError(usernameError));
passwordInput.addEventListener('input', () => clearFieldError(passwordError));

/* ============================================================
   Password Visibility Toggle
   ============================================================ */
if (pwToggleBtn) {
  pwToggleBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    pwToggleIcon.textContent = isHidden ? '🙈' : '👁';
    pwToggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

/* ============================================================
   Enter key support (already handled by form submit,
   but also ensure Enter on username moves to password)
   ============================================================ */
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    passwordInput.focus();
  }
});
