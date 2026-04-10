/**
 * js/auth.js
 * Authentication lifecycle — init, sign in/up, sign out.
 * Controls visibility of authPage vs mainApp.
 */

import { db, syncAll, fetchProfile } from './db.js';
import { state, resetState } from './state.js';

const $ = id => document.getElementById(id);

// ── Lifecycle ────────────────────────────────────────────────────────────────

export async function initApp(onReady) {
  showLoading(true);
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      await _onSignedIn(onReady);
    } else {
      showAuthPage();
    }
  } catch (err) {
    console.error('[Auth] initApp error:', err);
    showAuthPage();
  } finally {
    showLoading(false);
  }

  // Listen for auth state changes (tab focus, token refresh, etc.)
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await _onSignedIn(onReady);
    } else if (event === 'SIGNED_OUT') {
      _onSignedOut();
    }
  });
}

async function _onSignedIn(onReady) {
  await fetchProfile();
  showMainApp();
  // syncAll will call onReady() instantly from cache, then again after network fetch
  syncAll(onReady);
}

function _onSignedOut() {
  resetState();
  showAuthPage();
}

// ── Sign In / Sign Up ────────────────────────────────────────────────────────

export async function handleAuth() {
  const email    = $('auth-email').value.trim();
  const password = $('auth-pass').value;
  const btn      = $('auth-submit-btn');

  if (!email || !password) return showAuthError('Please enter your email and password.');
  hideAuthError();

  btn.textContent = 'Please wait…';
  btn.disabled = true;

  // Try sign in first
  let { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error && error.message.toLowerCase().includes('invalid login')) {
    // User might not exist — try sign up
    const res = await db.auth.signUp({ email, password });
    if (res.error) {
      if (res.error.message.toLowerCase().includes('already registered')) {
        return setAuthBtnReady(btn, 'Incorrect password for this email address.');
      }
      return setAuthBtnReady(btn, res.error.message);
    }
    // If a session exists immediately → email confirmation is OFF → auto-logged in
    if (res.data?.session) {
      btn.disabled = false;
      return; // onAuthStateChange fires → app loads
    }
    // Email confirmation is ON — user must click the link first
    setAuthBtnReady(btn, '');
    showAuthError('Account created! Check your email inbox (and spam folder) and click the confirmation link before signing in.');
    return;
  } else if (error) {
    return setAuthBtnReady(btn, error.message);
  }

  btn.disabled = false;
  // onAuthStateChange will fire and handle the rest
}

export async function signOut() {
  await db.auth.signOut();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showAuthPage() {
  $('authPage').style.display = 'flex';
  $('mainApp').style.display  = 'none';
  $('auth-email').value       = '';
  $('auth-pass').value        = '';
  hideAuthError();
}

function showMainApp() {
  $('authPage').style.display = 'none';
  $('mainApp').style.display  = 'block';
}

function showLoading(show) {
  const el = $('loadingScreen');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showAuthError(msg) {
  const el = $('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAuthError() {
  const el = $('auth-error');
  if (el) el.style.display = 'none';
}

function setAuthBtnReady(btn, errorMsg) {
  btn.textContent = 'Sign In / Sign Up';
  btn.disabled = false;
  if (errorMsg) showAuthError(errorMsg);
}
