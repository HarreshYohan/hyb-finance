/**
 * js/ui/kpi.js
 * KPI cards, Weekly Progress bar, and Smart Alerts strip rendering.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, totalIOwe, totalOwedToMe, allMonths } from '../state.js';
import { fmtShort, fmtCurrency, getCurrentWeekDates } from '../utils.js';
import { DEFAULT_BUDGET_LIMITS } from '../constants.js';

const $ = id => document.getElementById(id);

export function renderKPIs() {
  const vm  = getViewMonth();
  const txs = txByMonth(vm);
  const inc = sumInc(txs);
  const exp = sumExp(txs);
  const net = inc - exp;
  const sr  = inc > 0 ? Math.round((net / inc) * 100) : 0;
  const owe  = totalIOwe();
  const owed = totalOwedToMe();

  // Trend vs previous month
  const months   = allMonths();
  const vmIdx    = months.indexOf(vm);
  const prevMonth = vmIdx > 0 ? months[vmIdx - 1] : null;
  const prevTxs  = prevMonth ? txByMonth(prevMonth) : [];
  const prevInc  = sumInc(prevTxs);
  const prevExp  = sumExp(prevTxs);
  const prevNet  = prevInc - prevExp;

  setText('k-minc', fmtShort(inc));
  setClass('k-minc', 'kpi-val green');
  setText('k-mexp', fmtShort(exp));
  setClass('k-mexp', 'kpi-val red');
  setText('k-net', fmtShort(net));
  setClass('k-net', `kpi-val ${net >= 0 ? 'green' : 'red'}`);
  setText('k-owe', fmtShort(owe));
  setClass('k-owe', 'kpi-val red');
  setText('k-owed', fmtShort(owed));
  setClass('k-owed', 'kpi-val green');

  // Hints with trend badge
  const incTrend  = _trendBadge(inc, prevInc);
  const expTrend  = _trendBadge(exp, prevExp, true); // inverse: lower exp is good
  const netTrend  = _trendBadge(net, prevNet);

  setHtml('k-minc-h', `${txs.filter(t => t.type === 'income').length} entries${incTrend}`);
  setHtml('k-mexp-h', `${txs.filter(t => t.type === 'expense').length} entries${expTrend}`);
  setHtml('k-net-h',  `${sr}% savings rate${netTrend}`);
  setText('k-owe-h',  `${state.debts.filter(d => d.dir === 'owe' && (d.amount - d.paid) > 0).length} debts`);
  setText('k-owed-h', `${state.debts.filter(d => d.dir === 'owed' && (d.amount - d.paid) > 0).length} receivables`);

  // Smart alerts strip
  _renderSmartAlerts({ inc, exp, net, sr, txs });
}

// ── Smart Alerts ──────────────────────────────────────────────────────────────

function _renderSmartAlerts({ inc, exp, net, sr, txs }) {
  const el = $('smartAlerts');
  if (!el) return;

  const alerts = [];
  const today  = new Date().toISOString().slice(0, 10);

  // 1. Budget over-limit categories
  const spent = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    spent[t.category] = (spent[t.category] ?? 0) + t.amount;
  });
  Object.entries(spent).forEach(([cat, s]) => {
    const lim = state.budgets[cat] ?? DEFAULT_BUDGET_LIMITS[cat] ?? 0;
    if (lim <= 0) return;
    const pct = s / lim;
    if (pct >= 1) {
      alerts.push({ icon: '🚨', text: `<strong>${cat}</strong> over budget by ${fmtCurrency(s - lim)}`, type: 'alert-danger' });
    } else if (pct >= 0.8) {
      alerts.push({ icon: '⚠️', text: `<strong>${cat}</strong> at ${Math.round(pct * 100)}% of budget`, type: 'alert-warn' });
    }
  });

  // 2. Overdue debts
  const overdue = state.debts.filter(d => d.due && d.due < today && d.dir === 'owe' && (d.amount - d.paid) > 0);
  if (overdue.length) {
    alerts.push({ icon: '💳', text: `${overdue.length} overdue debt${overdue.length > 1 ? 's' : ''} — <strong>${fmtCurrency(overdue.reduce((s, d) => s + d.amount - d.paid, 0))}</strong> past due`, type: 'alert-danger' });
  }

  // 3. Savings rate vs target
  const tgtRate = Number(state.profile?.target_savings_rate) || 20;
  if (inc > 0 && sr < tgtRate) {
    const gap = Math.round(inc * (tgtRate - sr) / 100);
    alerts.push({ icon: '📊', text: `Savings rate ${sr}% — ${fmtCurrency(gap)} short of ${tgtRate}% target`, type: 'alert-info' });
  }

  // 4. Goals nearing deadline (within 60 days)
  const urgentGoals = state.goals.filter(g => {
    if (!g.deadline || g.saved >= g.target) return false;
    const days = Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date()) / 86_400_000);
    return days >= 0 && days <= 60;
  });
  urgentGoals.forEach(g => {
    const days = Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date()) / 86_400_000);
    const rem  = g.target - g.saved;
    alerts.push({ icon: '🎯', text: `<strong>${g.name}</strong> deadline in ${days} days — ${fmtCurrency(rem)} remaining`, type: 'alert-warn' });
  });

  // 5. No transactions today (positive prompt)
  const todayTxs = state.tx.filter(t => t.date === today);
  if (!todayTxs.length && new Date().getHours() >= 9) {
    alerts.push({ icon: '📝', text: 'No transactions recorded today — tap <strong>+ Add</strong> to log them', type: 'alert-info' });
  }

  if (!alerts.length) {
    el.innerHTML = `<div class="alert-item alert-good"><span class="alert-icon">✅</span><span>All on track — no alerts today. Keep it up!</span></div>`;
    return;
  }

  el.innerHTML = alerts.slice(0, 4).map(a =>
    `<div class="alert-item ${a.type}"><span class="alert-icon">${a.icon}</span><span>${a.text}</span></div>`
  ).join('');
}

export function renderWeekGoalBar() {
  const dates   = getCurrentWeekDates();
  const weekTxs = state.tx.filter(t => dates.includes(t.date));
  const wInc    = sumInc(weekTxs);
  const wExp    = sumExp(weekTxs);
  const wNet    = wInc - wExp;

  const incTarget = _computeWeeklyIncomeTarget();
  const savTarget = _computeWeeklySavingsTarget(incTarget);

  const el = $('weekGoalBar');
  if (!el) return;

  if (!incTarget) {
    el.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">This Week's Progress</div>
      <div style="font-size:12px;color:var(--text3);padding:12px;background:var(--surface2);border-radius:8px;text-align:center">
        📊 Add a few income transactions to unlock your personalised weekly targets.
      </div>`;
    return;
  }

  const incPct    = Math.min(100, Math.round((wInc / incTarget) * 100));
  const savPct    = wNet > 0 ? Math.min(100, Math.round((wNet / savTarget) * 100)) : 0;
  const shortfall = incTarget - wInc;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600">This Week's Progress</div>
      <div style="font-size:11px;color:var(--text3)">Week avg: ${fmtCurrency(wNet >= 0 ? wNet : 0)} net</div>
    </div>
    <div class="wg-row">
      <div class="wg-label">Income</div>
      <div class="wg-track"><div class="wg-fill" style="width:${incPct}%;background:var(--green)"></div></div>
      <div class="wg-nums">${fmtCurrency(wInc)} / ${fmtCurrency(incTarget)}</div>
    </div>
    <div class="wg-row">
      <div class="wg-label">Savings</div>
      <div class="wg-track"><div class="wg-fill" style="width:${savPct}%;background:var(--blue)"></div></div>
      <div class="wg-nums">${fmtCurrency(Math.max(0, wNet))} / ${fmtCurrency(savTarget)}</div>
    </div>
    <div class="wg-row" style="margin-bottom:4px">
      <div class="wg-label">Expenses</div>
      <div class="wg-track"><div class="wg-fill" style="width:${Math.min(100,Math.round(wExp/incTarget*100))}%;background:var(--red)"></div></div>
      <div class="wg-nums">${fmtCurrency(wExp)}</div>
    </div>
    ${shortfall > 0
      ? `<div class="wg-hint warn">💡 ${fmtCurrency(shortfall)} more income needed this week to hit target</div>`
      : `<div class="wg-hint good">✓ Weekly income target reached!</div>`
    }`;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _trendBadge(cur, prev, inverse = false) {
  if (!prev || prev === 0) return '';
  const delta = ((cur - prev) / prev) * 100;
  if (Math.abs(delta) < 2) return '';
  const up    = delta > 0;
  const good  = inverse ? !up : up;
  const color = good ? 'var(--green)' : 'var(--red)';
  const arrow = up ? '↑' : '↓';
  return ` <span style="font-size:10px;color:${color};font-weight:600">${arrow}${Math.abs(Math.round(delta))}%</span>`;
}

function _computeWeeklyIncomeTarget() {
  if (!state.tx.length) return 0;
  const now    = new Date();
  const months = [];
  for (let m = 1; m <= 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const withIncome = months.filter(ym => state.tx.some(t => t.date.slice(0, 7) === ym && t.type === 'income'));
  if (!withIncome.length) return 0;
  const total = withIncome.reduce((s, ym) => s + sumInc(state.tx.filter(t => t.date.slice(0, 7) === ym)), 0);
  return Math.round(total / withIncome.length / 4);
}

function _computeWeeklySavingsTarget(weeklyIncome) {
  return Math.round(weeklyIncome * 0.20);
}

function setText(id, v)  { const e = $(id); if (e) e.textContent = v; }
function setClass(id, c) { const e = $(id); if (e) e.className = c; }
function setHtml(id, v)  { const e = $(id); if (e) e.innerHTML = v; }
