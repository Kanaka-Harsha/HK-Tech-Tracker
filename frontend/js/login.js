/**
 * login.js — Login & Signup Page Logic
 * Roadmap Tracker
 *
 * Responsibilities:
 *  - Redirect already-authenticated users to dashboard
 *  - Tab switching between Login and Sign Up panels
 *  - Validate form fields client-side before API call
 *  - Call API.login() / API.signup() and handle success / error
 *  - Store auth token in sessionStorage on successful login
 *  - Password show/hide toggles
 *  - Toast notifications for feedback
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
   DOM References — Login
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
   DOM References — Signup
   ============================================================ */
const signupForm           = document.getElementById('signup-form');
const signupNameInput      = document.getElementById('signup-name');
const signupUsernameInput  = document.getElementById('signup-username');
const signupPasswordInput  = document.getElementById('signup-password');
const signupConfirmInput   = document.getElementById('signup-confirm');
const signupNameError      = document.getElementById('signup-name-error');
const signupUsernameError  = document.getElementById('signup-username-error');
const signupPasswordError  = document.getElementById('signup-password-error');
const signupConfirmError   = document.getElementById('signup-confirm-error');
const signupAlert          = document.getElementById('signup-alert');
const signupBtn            = document.getElementById('signup-btn');
const signupBtnText        = document.getElementById('signup-btn-text');
const signupSpinner        = document.getElementById('signup-spinner');
const signupPwToggle       = document.getElementById('signup-password-toggle');
const signupPwToggleIcon   = document.getElementById('signup-password-toggle-icon');
const signupConfirmToggle  = document.getElementById('signup-confirm-toggle');
const signupConfirmIcon    = document.getElementById('signup-confirm-toggle-icon');

/* ============================================================
   DOM References — Tabs & Panels
   ============================================================ */
const tabLogin     = document.getElementById('tab-login');
const tabSignup    = document.getElementById('tab-signup');
const tabIndicator = document.getElementById('tab-indicator');
const panelLogin   = document.getElementById('panel-login');
const panelSignup  = document.getElementById('panel-signup');
const goToSignup   = document.getElementById('go-to-signup');
const goToLogin    = document.getElementById('go-to-login');

/* ============================================================
   Tab Switching
   ============================================================ */

function switchTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabSignup.classList.remove('active');
    tabSignup.setAttribute('aria-selected', 'false');
    tabIndicator.classList.remove('slide-right');
    panelLogin.classList.remove('hidden');
    panelSignup.classList.add('hidden');
    // Re-trigger panel animation
    panelLogin.style.animation = 'none';
    panelLogin.offsetHeight; // reflow
    panelLogin.style.animation = '';
  } else {
    tabSignup.classList.add('active');
    tabSignup.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    tabIndicator.classList.add('slide-right');
    panelSignup.classList.remove('hidden');
    panelLogin.classList.add('hidden');
    panelSignup.style.animation = 'none';
    panelSignup.offsetHeight;
    panelSignup.style.animation = '';
  }
}

tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));
goToSignup.addEventListener('click', () => switchTab('signup'));
goToLogin.addEventListener('click', () => switchTab('login'));

/* ============================================================
   Shared Utilities
   ============================================================ */

function showFieldError(el, msg) {
  el.textContent = msg;
  const input = el.closest('.form-group')?.querySelector('.form-input');
  if (input) input.classList.add('is-error');
}

function clearFieldError(el) {
  el.textContent = '';
  const input = el.closest('.form-group')?.querySelector('.form-input');
  if (input) input.classList.remove('is-error');
}

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
   Login Utilities
   ============================================================ */

function showLoginAlert(msg) {
  loginAlert.textContent = msg;
  loginAlert.hidden = false;
}
function hideLoginAlert() {
  loginAlert.textContent = '';
  loginAlert.hidden = true;
}

function setLoginLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtnText.textContent = isLoading ? 'Signing in…' : 'Sign In';
  if (loginSpinner) loginSpinner.hidden = !isLoading;
}

/* ============================================================
   Login Validation
   ============================================================ */

function validateLoginForm() {
  let valid = true;
  clearFieldError(usernameError);
  clearFieldError(passwordError);
  hideLoginAlert();

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
   Login Submit Handler
   ============================================================ */

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateLoginForm()) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  setLoginLoading(true);
  hideLoginAlert();

  try {
    const data = await API.login(username, password);
    const token = data.token || `token-${Date.now()}`;
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('auth_user', username);
    window.location.replace('dashboard.html');
  } catch (err) {
    const msg = err.message || 'Login failed. Please try again.';
    showLoginAlert(msg);
    showToast(msg, 'error');
    usernameInput.focus();
  } finally {
    setLoginLoading(false);
  }
});

/* ============================================================
   Signup Utilities
   ============================================================ */

function showSignupAlert(msg) {
  signupAlert.textContent = msg;
  signupAlert.hidden = false;
}
function hideSignupAlert() {
  signupAlert.textContent = '';
  signupAlert.hidden = true;
}

function setSignupLoading(isLoading) {
  signupBtn.disabled = isLoading;
  signupBtnText.textContent = isLoading ? 'Creating account…' : 'Create Account';
  if (signupSpinner) signupSpinner.hidden = !isLoading;
}

/* ============================================================
   Signup Validation
   ============================================================ */

function validateSignupForm() {
  let valid = true;
  clearFieldError(signupNameError);
  clearFieldError(signupUsernameError);
  clearFieldError(signupPasswordError);
  clearFieldError(signupConfirmError);
  hideSignupAlert();

  const name     = signupNameInput.value.trim();
  const username = signupUsernameInput.value.trim();
  const password = signupPasswordInput.value;
  const confirm  = signupConfirmInput.value;

  if (!name) {
    showFieldError(signupNameError, 'Full name is required.');
    valid = false;
  } else if (name.length < 2) {
    showFieldError(signupNameError, 'Name must be at least 2 characters.');
    valid = false;
  }

  if (!username) {
    showFieldError(signupUsernameError, 'Username is required.');
    valid = false;
  } else if (username.length < 2) {
    showFieldError(signupUsernameError, 'Username must be at least 2 characters.');
    valid = false;
  }

  if (!password) {
    showFieldError(signupPasswordError, 'Password is required.');
    valid = false;
  } else if (password.length < 4) {
    showFieldError(signupPasswordError, 'Password must be at least 4 characters.');
    valid = false;
  }

  if (!confirm) {
    showFieldError(signupConfirmError, 'Please confirm your password.');
    valid = false;
  } else if (password && confirm !== password) {
    showFieldError(signupConfirmError, 'Passwords do not match.');
    valid = false;
  }

  return valid;
}

/* ============================================================
   Signup Submit Handler
   ============================================================ */

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateSignupForm()) return;

  const name     = signupNameInput.value.trim();
  const username = signupUsernameInput.value.trim();
  const password = signupPasswordInput.value;

  setSignupLoading(true);
  hideSignupAlert();

  try {
    await API.signup(name, username, password);
    showToast('Account created! Please sign in.', 'success');
    // Clear signup fields and switch to login
    signupForm.reset();
    switchTab('login');
    // Pre-fill the username in the login form for convenience
    usernameInput.value = username;
    passwordInput.focus();
  } catch (err) {
    const msg = err.message || 'Signup failed. Please try again.';
    showSignupAlert(msg);
    showToast(msg, 'error');
  } finally {
    setSignupLoading(false);
  }
});

/* ============================================================
   Clear errors on typing
   ============================================================ */
usernameInput.addEventListener('input', () => clearFieldError(usernameError));
passwordInput.addEventListener('input', () => clearFieldError(passwordError));
signupNameInput.addEventListener('input', () => clearFieldError(signupNameError));
signupUsernameInput.addEventListener('input', () => clearFieldError(signupUsernameError));
signupPasswordInput.addEventListener('input', () => clearFieldError(signupPasswordError));
signupConfirmInput.addEventListener('input', () => clearFieldError(signupConfirmError));

/* ============================================================
   Password Visibility Toggles
   ============================================================ */

function setupPasswordToggle(toggleBtn, toggleIcon, inputEl) {
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', () => {
    const isHidden = inputEl.type === 'password';
    inputEl.type = isHidden ? 'text' : 'password';
    toggleIcon.textContent = isHidden ? '🙈' : '👁';
    toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

setupPasswordToggle(pwToggleBtn, pwToggleIcon, passwordInput);
setupPasswordToggle(signupPwToggle, signupPwToggleIcon, signupPasswordInput);
setupPasswordToggle(signupConfirmToggle, signupConfirmIcon, signupConfirmInput);

/* ============================================================
   Enter key — move focus to next field in login form
   ============================================================ */
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    passwordInput.focus();
  }
});
