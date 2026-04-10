/**
 * js/ui/today.js
 * Today's entries panel + calendar widget + mini goal/debt summary.
 */

import { state, txByDate, txByMonth, sumInc, sumExp, getViewMonth } from '../state.js';
import { todayStr, fmtDate, fmtCurrency } from '../utils.js';

export function renderToday() {
  const today = todayStr();
  document.getElementById('todaySubLabel').textContent = fmtDate(today);
  _renderTodayList(today);
  _renderCalendar();
  _renderMiniSummary();
}

// ── Today's transactions list ─────────────────────────────────────────────────

function _renderTodayList(today) {
  const txs = txByDate(today).sort((a, b) => b.ts - a.ts);
  const el  = document.getElementById('todayList');

  if (!txs.length) {
    el.innerHTML = `
      <div class="empty" style="padding:24px 20px">
        <div class="empty-ico">📋</div>
        <div class="empty-txt">Nothing recorded yet today.<br>Tap <strong>+ Add</strong> to log your first entry.</div>
      </div>`;
    return;
  }

  const todayInc = sumInc(txs);
  const todayExp = sumExp(txs);
  const todayNet = todayInc - todayExp;

  el.innerHTML = `
    <div class="today-summary-bar">
      <div class="tsb-item"><span class="tsb-lbl">In</span><span class="tsb-val green">+${fmtCurrency(todayInc)}</span></div>
      <div class="tsb-sep"></div>
      <div class="tsb-item"><span class="tsb-lbl">Out</span><span class="tsb-val red">-${fmtCurrency(todayExp)}</span></div>
      <div class="tsb-sep"></div>
      <div class="tsb-item"><span class="tsb-lbl">Net</span><span class="tsb-val ${todayNet >= 0 ? 'green' : 'red'}">${todayNet >= 0 ? '+' : ''}${fmtCurrency(todayNet)}</span></div>
    </div>
    ${txs.map(txRow).join('')}`;
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

// ── Mini summary (goals + debts snapshot) ────────────────────────────────────

function _renderMiniSummary() {
  const el = document.getElementById('miniSummary');
  if (!el) return;

  const vm  = getViewMonth();
  const txs = txByMonth(vm);
  const inc = sumInc(txs);
  const exp = sumExp(txs);
  const net = inc - exp;
  const sr  = inc > 0 ? Math.round((net / inc) * 100) : 0;

  // Active goals — top 3
  const goals = state.goals
    .filter(g => g.saved < g.target)
    .slice(0, 3);

  // Overdue debts
  const today   = todayStr();
  const overdue = state.debts.filter(d => d.due && d.due < today && d.dir === 'owe' && (d.amount - d.paid) > 0);

  el.innerHTML = `
    <div class="mini-summary-grid">
      <div class="ms-card">
        <div class="ms-label">Month Savings Rate</div>
        <div class="ms-val ${sr >= 20 ? 'green' : sr >= 10 ? 'gold' : 'red'}">${sr}%</div>
        <div class="ms-sub">Target: ${Number(state.profile?.target_savings_rate) || 20}%</div>
      </div>
      <div class="ms-card">
        <div class="ms-label">Active Goals</div>
        <div class="ms-val">${state.goals.length}</div>
        <div class="ms-sub">${state.goals.filter(g => g.saved >= g.target).length} complete</div>
      </div>
      <div class="ms-card">
        <div class="ms-label">Debts Outstanding</div>
        <div class="ms-val ${overdue.length ? 'red' : ''}">${state.debts.filter(d => d.dir === 'owe' && (d.amount - d.paid) > 0).length}</div>
        <div class="ms-sub">${overdue.length ? `${overdue.length} overdue` : 'All on time'}</div>
      </div>
    </div>
    ${goals.length ? `
    <div class="ms-goals-label">Goals in progress</div>
    ${goals.map(g => {
      const p   = Math.min(100, Math.round((g.saved / g.target) * 100));
      return `
      <div class="ms-goal-row">
        <span class="ms-goal-name">${g.name}</span>
        <div class="ms-goal-track"><div class="ms-goal-fill" style="width:${p}%;background:${g.color}"></div></div>
        <span class="ms-goal-pct" style="color:${g.color}">${p}%</span>
      </div>`;
    }).join('')}` : ''}`;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function _renderCalendar() {
  const { year, month } = _parseViewMonth();
  const today     = todayStr();
  const firstDow  = new Date(year, month - 1, 1).getDay();
  const daysInMo  = new Date(year, month, 0).getDate();

  document.getElementById('calDayLabels').innerHTML =
    ['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div class="cal-day-lbl">${d}</div>`).join('');

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  for (let i = 0; i < firstDow; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="cal-cell empty"></div>');
  }

  for (let d = 1; d <= daysInMo; d++) {
    const ds   = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const txs  = txByDate(ds);
    const hasI = txs.some(t => t.type === 'income');
    const hasE = txs.some(t => t.type === 'expense');
    const future = ds > today;

    let cls = 'cal-cell';
    if (future)          cls += ' future';
    else if (hasI && hasE) cls += ' has-both';
    else if (hasI)       cls += ' has-in';
    else if (hasE)       cls += ' has-exp';
    else                 cls += ' no-rec';
    if (ds === today)    cls += ' today';

    const totalDay = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const title = txs.length && !future
      ? `${fmtDate(ds)} · ${txs.length} tx · ${totalDay >= 0 ? '+' : ''}${fmtCurrency(totalDay)}`
      : '';

    grid.insertAdjacentHTML('beforeend',
      `<div class="${cls}" title="${title}" onclick="${!future && txs.length ? `App.showTab('log',this)` : ''}">${d}</div>`);
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
