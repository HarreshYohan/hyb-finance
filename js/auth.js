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
    const { data: { session } } = await db?.auth?.getSession() || { data: { session: null } };
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
  db?.auth?.onAuthStateChange(async (event, session) => {
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

export async function handleGoogleAuth() {
  const btn = $('auth-submit-btn');
  btn.disabled = true;
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    btn.disabled = false;
    showAuthError(error.message);
  }
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
  _startAuthCanvas();
}

// ── Auth canvas particle mesh ─────────────────────────────────────────────────

let _authRaf = null;

function _startAuthCanvas() {
  const canvas = $('authCanvas');
  if (!canvas || _authRaf) return;
  const ctx = canvas.getContext('2d');

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const pts = Array.from({ length: 70 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r:  Math.random() * 1.5 + 0.5,
  }));

  const draw = () => {
    if (!$('authCanvas')) { _authRaf = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(159, 232, 112, 0.4)';
      ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(159, 232, 112, ${0.15 * (1 - d / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    _authRaf = requestAnimationFrame(draw);
  };
  _authRaf = requestAnimationFrame(draw);
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
