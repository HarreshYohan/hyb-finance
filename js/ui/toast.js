/**
 * js/ui/toast.js
 * Lightweight toast notification system.
 * Types: 'success' (green), 'error' (red), 'warning' (gold), 'default' (white)
 */

let _timer = null;

export function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show toast-${type}`;
  clearTimeout(_timer);
  // Errors stay visible longer so users can read them
  const dur = type === 'error' ? 4000 : 2600;
  _timer = setTimeout(() => el.classList.remove('show'), dur);
}
