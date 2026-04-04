/**
 * js/ui/kpi.js
 * KPI cards and Weekly Progress bar rendering.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, totalIOwe, totalOwedToMe } from '../state.js';
import { fmtShort, fmtCurrency, getCurrentWeekDates } from '../utils.js';

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

  // Targets configured via profile settings (future: editable)
  const incTarget = 107_500; // ~430k / 4 weeks
  const savTarget = 15_000;

  const incPct = Math.min(100, Math.round((wInc / incTarget) * 100));
  const savPct = wNet > 0 ? Math.min(100, Math.round((wNet / savTarget) * 100)) : 0;
  const shortfall = incTarget - wInc;

  $('weekGoalBar').innerHTML = `
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
    <div style="font-size:11px;color:var(--text3)">Weekly income target = monthly ÷ 4 · Weekly savings target = LKR 15,000</div>
    ${shortfall > 0
      ? `<div style="margin-top:10px;padding:10px;background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:8px;font-size:12px;color:var(--gold)">💡 You need <strong>${fmtCurrency(shortfall)}</strong> more this week to hit your income target.</div>`
      : `<div style="margin-top:10px;padding:10px;background:var(--green-bg);border:1px solid var(--green-border);border-radius:8px;font-size:12px;color:var(--green)">✓ Weekly income target reached! Extra earnings go straight to savings.</div>`
    }
  `;
}

// ── Private helpers ───────────────────────────────────────────────────────────
function setText(id, v)  { const e = $(id); if (e) e.textContent = v; }
function setClass(id, c) { const e = $(id); if (e) e.className = c; }
