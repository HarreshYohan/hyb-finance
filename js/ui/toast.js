/**
 * js/ui/toast.js
 * Lightweight toast notification system.
 */

let _timer = null;

export function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(_timer);
  _timer = setTimeout(() => el.classList.remove('show'), 2600);
}
