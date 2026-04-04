/**
 * js/ui/today.js
 * Today's entries panel + calendar widget rendering.
 */

import { state, txByDate, sumInc, sumExp } from '../state.js';
import { todayStr, fmtDate, fmtCurrency } from '../utils.js';
import { openTxModal } from './modals.js';

export function renderToday() {
  const today = todayStr();
  document.getElementById('todaySubLabel').textContent = fmtDate(today);
  _renderTodayList(today);
  _renderCalendar();
}

function _renderTodayList(today) {
  const txs = txByDate(today).sort((a, b) => b.ts - a.ts);
  const el  = document.getElementById('todayList');

  if (!txs.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-ico">📋</div>
        <div class="empty-txt">No transactions yet today.<br>Tap <strong>+ Add</strong> to record your first entry.</div>
      </div>`;
    return;
  }
  el.innerHTML = txs.map(txRow).join('');
}

function txRow(t) {
  const isInc = t.type === 'income';
  const badge = isInc
    ? 'background:var(--green-bg);color:var(--green)'
    : 'background:var(--red-bg);color:var(--red)';
  return `
    <div class="tx-row">
      <div class="tx-badge" style="${badge}">${isInc ? 'IN' : 'OUT'}</div>
      <div class="tx-info">
        <div class="tx-desc">${escHtml(t.desc)}</div>
        <div class="tx-meta">${escHtml(t.category)}${t.note ? ' · ' + escHtml(t.note) : ''}</div>
      </div>
      <div class="tx-amount ${isInc ? 'amount-in' : 'amount-out'}">${isInc ? '+' : '-'}${fmtCurrency(t.amount)}</div>
      <div class="row-btns">
        <button class="row-btn" onclick="App.editTx('${t.id}')">Edit</button>
        <button class="row-btn danger" onclick="App.delTx('${t.id}')">Del</button>
      </div>
    </div>`;
}

function _renderCalendar() {
  const { year, month } = _parseViewMonth();
  const today = todayStr();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  document.getElementById('calDayLabels').innerHTML =
    ['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div class="cal-day-lbl">${d}</div>`).join('');

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  for (let i = 0; i < firstDow; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="cal-cell empty"></div>');
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const txs = txByDate(ds);
    const hasI = txs.some(t => t.type === 'income');
    const hasE = txs.some(t => t.type === 'expense');
    const future = ds > today;

    let cls = 'cal-cell';
    if (future)       cls += ' future';
    else if (hasI && hasE) cls += ' has-both';
    else if (hasI)    cls += ' has-in';
    else if (hasE)    cls += ' has-exp';
    else              cls += ' no-rec';
    if (ds === today) cls += ' today';

    const title = txs.length && !future
      ? `${fmtDate(ds)} · ${txs.length} tx`
      : '';
    grid.insertAdjacentHTML('beforeend',
      `<div class="${cls}" title="${title}">${d}</div>`);
  }
}

function _parseViewMonth() {
  const ym = state.viewMonth || new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
