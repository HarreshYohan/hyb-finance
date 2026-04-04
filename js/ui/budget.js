/**
 * js/ui/budget.js
 * Budget limits panel + weekly cash flow grid rendering.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp } from '../state.js';
import { fmtCurrency, getCurrentWeekDates, todayStr } from '../utils.js';
import { EXPENSE_CATEGORIES, DEFAULT_BUDGET_LIMITS } from '../constants.js';
import { upsertBudget } from '../db.js';
import { toast } from './toast.js';

export function renderBudget() {
  _renderBudgetRows();
  _renderWeekGrid();
}

function _renderBudgetRows() {
  const txs   = txByMonth(getViewMonth()).filter(t => t.type === 'expense');
  const spent = {};
  txs.forEach(t => { spent[t.category] = (spent[t.category] ?? 0) + Number(t.amount); });

  document.getElementById('budgetRows').innerHTML = EXPENSE_CATEGORIES.map(cat => {
    const lim    = state.budgets[cat] ?? DEFAULT_BUDGET_LIMITS[cat] ?? 0;
    const s      = spent[cat] ?? 0;
    const p      = lim > 0 ? Math.min(100, Math.round((s / lim) * 100)) : 0;
    const over   = s > lim && lim > 0;
    const barCol = over ? 'var(--red)' : p > 75 ? 'var(--orange)' : 'var(--green)';
    const stTxt  = lim > 0 ? (over ? `Over by ${fmtCurrency(s - lim)}` : `${fmtCurrency(lim - s)} left`) : 'No limit';
    const stCol  = over ? 'var(--red)' : p > 75 ? 'var(--orange)' : 'var(--green)';
    const safeId = cat.replace(/\s/g, '_');
    return `
      <div class="budget-row">
        <div class="budget-cat">${cat}</div>
        <div class="budget-bar-wrap"><div class="budget-bar" style="width:${p}%;background:${barCol}"></div></div>
        <div class="budget-nums">${fmtCurrency(s)} /
          <span class="limit-edit">
            <input class="limit-input" id="lim-${safeId}" type="number" value="${lim}"
              onkeydown="if(event.key==='Enter') Budget.saveLimit('${cat}')">
            <button class="limit-save-btn" onclick="Budget.saveLimit('${cat}')">Set</button>
          </span>
        </div>
        <div class="budget-status" style="color:${stCol}">${stTxt}</div>
      </div>`;
  }).join('');
}

export async function saveLimit(cat) {
  const el = document.getElementById('lim-' + cat.replace(/\s/g, '_'));
  const v  = Number(el.value);
  if (isNaN(v) || v < 0) { toast('Enter a valid amount'); return; }
  state.budgets[cat] = v;
  const { error } = await upsertBudget(cat, v);
  if (error) { toast('Save failed — try again'); return; }
  _renderBudgetRows();
  toast('Limit updated ✓');
}

function _renderWeekGrid() {
  const dates    = getCurrentWeekDates();
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today    = todayStr();

  document.getElementById('weekGrid').innerHTML = dates.map((d, i) => {
    const txs    = state.tx.filter(t => t.date === d);
    const net    = sumInc(txs) - sumExp(txs);
    const isToday  = d === today;
    const isFuture = d > today;
    let valHtml;
    if (isFuture)    valHtml = `<div class="wd-val zero">—</div>`;
    else if (!txs.length) valHtml = `<div class="wd-val zero">No tx</div>`;
    else valHtml = `<div class="wd-val ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}">${net > 0 ? '+' : ''}${fmtCurrency(net)}</div>`;

    return `
      <div class="week-day${isToday ? ' today-col' : ''}">
        <div class="wd-name">${dayNames[i]}</div>
        <div style="font-size:9px;color:var(--text3);margin-bottom:4px">${d.slice(5)}</div>
        ${valHtml}
        ${!isFuture && txs.length ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${txs.length} tx</div>` : ''}
      </div>`;
  }).join('');
}
