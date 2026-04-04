/**
 * js/ui/kpi.js
 * KPI cards and Weekly Progress bar rendering.
 * All targets are derived from the user's own data — no hardcoded income values.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, totalIOwe, totalOwedToMe } from '../state.js';
import { fmtShort, fmtCurrency, getCurrentWeekDates, currentMonthStr } from '../utils.js';

const $ = id => document.getElementById(id);

export function renderKPIs() {
  const txs = txByMonth(getViewMonth());
  const inc = sumInc(txs);
  const exp = sumExp(txs);
  const net = inc - exp;
  const sr  = inc > 0 ? Math.round((net / inc) * 100) : 0;
  const owe  = totalIOwe();
  const owed = totalOwedToMe();

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

  setText('k-minc-h', `${txs.filter(t => t.type === 'income').length} entries`);
  setText('k-mexp-h', `${txs.filter(t => t.type === 'expense').length} entries`);
  setText('k-net-h',  `${sr}% savings rate`);
  setText('k-owe-h',  `${state.debts.filter(d => d.dir === 'owe' && (d.amount - d.paid) > 0).length} debts`);
  setText('k-owed-h', `${state.debts.filter(d => d.dir === 'owed' && (d.amount - d.paid) > 0).length} receivables`);
}

export function renderWeekGoalBar() {
  const dates   = getCurrentWeekDates();
  const weekTxs = state.tx.filter(t => dates.includes(t.date));
  const wInc    = sumInc(weekTxs);
  const wExp    = sumExp(weekTxs);
  const wNet    = wInc - wExp;

  // Derive targets from the user's own last 3 months of income — no hardcoded values.
  const incTarget = _computeWeeklyIncomeTarget();
  const savTarget = _computeWeeklySavingsTarget(incTarget);

  const el = $('weekGoalBar');
  if (!el) return;

  if (!incTarget) {
    // New user — not enough history yet
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
    <div style="font-size:13px;font-weight:600;margin-bottom:10px">This Week's Progress</div>
    <div class="wg-row">
      <div class="wg-label">Income target</div>
      <div class="wg-track"><div class="wg-fill" style="width:${incPct}%;background:var(--green)"></div></div>
      <div class="wg-nums">${fmtCurrency(wInc)} / ${fmtCurrency(incTarget)}</div>
    </div>
    <div class="wg-row" style="margin-bottom:4px">
      <div class="wg-label">Savings target</div>
      <div class="wg-track"><div class="wg-fill" style="width:${savPct}%;background:var(--blue)"></div></div>
      <div class="wg-nums">${fmtCurrency(wNet)} / ${fmtCurrency(savTarget)}</div>
    </div>
    <div style="font-size:11px;color:var(--text3)">
      Weekly targets based on your average income · Savings target = 20% of weekly income
    </div>
    ${shortfall > 0
      ? `<div style="margin-top:10px;padding:10px;background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:8px;font-size:12px;color:var(--gold)">💡 ${fmtCurrency(shortfall)} more needed this week to hit your target.</div>`
      : `<div style="margin-top:10px;padding:10px;background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;font-size:12px;color:var(--green)">✓ Weekly income target reached! Keep it up.</div>`
    }`;
}

// ── Private — target computation ──────────────────────────────────────────────

/** Compute weekly income target from user's own last 3 months of income avg ÷ 4 */
function _computeWeeklyIncomeTarget() {
  if (!state.tx.length) return 0;
  const now = new Date();

  // Collect up to last 3 calendar months that have income
  const months = [];
  for (let m = 1; m <= 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthsWithIncome = months.filter(ym =>
    state.tx.some(t => t.date.slice(0, 7) === ym && t.type === 'income')
  );
  if (!monthsWithIncome.length) return 0;

  const totalIncome = monthsWithIncome.reduce((sum, ym) =>
    sum + sumInc(state.tx.filter(t => t.date.slice(0, 7) === ym)), 0
  );

  const monthlyAvg = totalIncome / monthsWithIncome.length;
  return Math.round(monthlyAvg / 4); // weekly ÷ 4
}

/** Savings target = 20% of weekly income (standard personal finance guideline) */
function _computeWeeklySavingsTarget(weeklyIncome) {
  return Math.round(weeklyIncome * 0.20);
}

// ── Private helpers ───────────────────────────────────────────────────────────
function setText(id, v)  { const e = $(id); if (e) e.textContent = v; }
function setClass(id, c) { const e = $(id); if (e) e.className = c; }
