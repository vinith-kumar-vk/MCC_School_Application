// login.js - MCC-MRF Admin Login Logic

document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (data.authenticated) {
      window.location.href = '/dashboard.html';
      return;
    }
  } catch (e) {}

  // Toggle password
  const togglePwd = document.getElementById('togglePwd');
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  if (togglePwd) {
    togglePwd.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      eyeIcon.innerHTML = isHidden
        ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    });
  }

  // Login form submit
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    let isValid = true;

    if (!username) {
      showError('err_username', 'Please enter your username.');
      document.getElementById('username').classList.add('input-error');
      isValid = false;
    }
    if (!password) {
      showError('err_password', 'Please enter your password.');
      document.getElementById('password').classList.add('input-error');
      isValid = false;
    }
    if (!isValid) return;

    const loginBtn = document.getElementById('loginBtn');
    const globalError = document.getElementById('globalError');
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        globalError.textContent = '';
        window.location.href = '/dashboard.html';
      } else {
        globalError.textContent = data.message || 'Invalid username or password.';
        document.getElementById('password').value = '';
        document.getElementById('username').classList.add('input-error');
        document.getElementById('password').classList.add('input-error');
      }
    } catch (err) {
      globalError.textContent = 'Network error. Please try again.';
    } finally {
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
    }
  });

  // Clear errors on input
  document.querySelectorAll('.lf-input').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('input-error');
      clearErrors();
    });
  });
});

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.lf-error').forEach(el => el.textContent = '');
  document.getElementById('globalError').textContent = '';
  document.querySelectorAll('.lf-input').forEach(el => el.classList.remove('input-error'));
}
