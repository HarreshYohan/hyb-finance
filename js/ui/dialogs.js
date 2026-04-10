/**
 * js/ui/dialogs.js
 * Reusable dialog helpers that replace browser prompt() and confirm().
 * Requires #quickInputOverlay and #confirmOverlay in the HTML.
 */

import { toast } from './toast.js';

// ── Quick numeric input (replaces prompt()) ───────────────────────────────────

export function quickInput({ title, sub = '', label = 'Amount (LKR)', onConfirm }) {
  const overlay = document.getElementById('quickInputOverlay');
  const inp     = document.getElementById('qiInput');

  document.getElementById('qiTitle').textContent = title;
  document.getElementById('qiSub').textContent   = sub;
  document.getElementById('qiLabel').textContent = label;
  inp.value = '';

  const doConfirm = () => {
    const val = Number(inp.value);
    if (!val || val <= 0) { toast('Enter a valid amount', 'warning'); return; }
    overlay.classList.remove('open');
    onConfirm(val);
  };

  document.getElementById('qiConfirm').onclick = doConfirm;
  document.getElementById('qiClose').onclick   = () => overlay.classList.remove('open');
  inp.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };

  overlay.classList.add('open');
  setTimeout(() => inp.focus(), 80);
}

// ── Confirm dialog (replaces confirm()) ──────────────────────────────────────

export function showConfirm({ title = 'Are you sure?', msg = '', label = 'Confirm', danger = true, onConfirm }) {
  const overlay = document.getElementById('confirmOverlay');

  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;

  const btn  = document.getElementById('confirmOk');
  btn.textContent   = label;
  btn.style.background = danger ? 'var(--red)' : 'var(--green)';
  btn.style.color      = '#000';

  btn.onclick = () => { overlay.classList.remove('open'); onConfirm(); };
  document.getElementById('confirmCancel').onclick = () => overlay.classList.remove('open');

  overlay.classList.add('open');
}
