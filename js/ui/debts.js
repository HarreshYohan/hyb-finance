/**
 * js/ui/debts.js
 * Debt & receivables panel rendering and actions.
 */

import { state, totalIOwe, totalOwedToMe } from '../state.js';
import { fmtCurrency, fmtDate, todayStr } from '../utils.js';
import { updateDebtPaid, deleteDebt as dbDeleteDebt } from '../db.js';
import { toast } from './toast.js';
import { quickInput, showConfirm } from './dialogs.js';

export function renderDebts() {
  const owe  = totalIOwe();
  const owed = totalOwedToMe();

  document.getElementById('ds-owe').textContent  = fmtCurrency(owe);
  document.getElementById('ds-owed').textContent = fmtCurrency(owed);
  document.getElementById('ds-owe-h').textContent  =
    state.debts.filter(d => d.dir === 'owe'  && (d.amount - d.paid) > 0).length + ' active';
  document.getElementById('ds-owed-h').textContent =
    state.debts.filter(d => d.dir === 'owed' && (d.amount - d.paid) > 0).length + ' active';

  const sorted = [...state.debts].sort((a, b) => b.ts - a.ts);
  const grid   = document.getElementById('debtGrid');

  if (!sorted.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-ico">✨</div>
        <div class="empty-txt">No debts recorded.<br>Clean balance sheet.</div>
        <button class="add-btn" style="margin-top:12px" onclick="Modals.openDebt()">+ Add Debt</button>
      </div>`;
    return;
  }

  grid.innerHTML = sorted.map(d => {
    const rem     = Math.max(0, Number(d.amount) - Number(d.paid));
    const pctPaid = Math.min(100, Math.round((Number(d.paid) / Number(d.amount)) * 100));
    const settled = rem <= 0;
    const overdue = d.due && d.due < todayStr() && !settled;
    const col     = d.dir === 'owe' ? 'var(--red)' : 'var(--green)';

    return `
      <div class="debt-card ${d.dir}${settled ? ' debt-settled' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="debt-tag ${d.dir}">${d.dir === 'owe' ? '↑ I OWE' : '↓ OWED TO ME'}</span>
          <span style="font-size:11px;color:var(--text3)">${d.category ?? ''}</span>
        </div>
        <div class="debt-name">${d.name}</div>
        <div class="debt-desc">${d.desc ?? '—'}${settled ? ' · Settled ✓' : ''}</div>
        <div class="debt-amount" style="color:${col}">${fmtCurrency(rem)}</div>
        <div class="debt-due${overdue ? ' overdue' : ''}">
          ${d.due ? (overdue ? '⚠ Overdue — ' : 'Due ') + fmtDate(d.due) : 'No due date'}
        </div>
        <div class="prog-wrap" style="margin:8px 0">
          <div class="prog-bar" style="width:${pctPaid}%;background:${col}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:10px">
          <span>Paid: ${fmtCurrency(d.paid)}</span>
          <span>${pctPaid}% · Total: ${fmtCurrency(d.amount)}</span>
        </div>
        <div class="debt-actions">
          ${!settled ? `
            <button class="dbt-btn dbt-settle" onclick="Debts.settle('${d.id}')">✓ Settle</button>
            <button class="dbt-btn dbt-partial" onclick="Debts.partial('${d.id}')">+ Pay</button>
          ` : ''}
          <button class="dbt-btn dbt-edit" onclick="App.editDebt('${d.id}')">Edit</button>
          <button class="dbt-btn dbt-del"  onclick="Debts.del('${d.id}')">Remove</button>
        </div>
      </div>`;
  }).join('');
}

export function settleDebt(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return Promise.resolve();
  const rem = Number(d.amount) - Number(d.paid);

  return new Promise(resolve => {
    showConfirm({
      title:     'Settle Debt',
      msg:       `Mark "${d.name}" (${fmtCurrency(rem)} remaining) as fully settled?`,
      label:     'Mark Settled',
      danger:    false,
      onConfirm: async () => {
        d.paid = d.amount;
        const { error } = await updateDebtPaid(id, d.paid);
        if (error) { toast('Save failed', 'error'); resolve(); return; }
        toast('Marked as settled ✓', 'success');
        window.App?.render?.();
        resolve();
      },
    });
  });
}

export function partialPay(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return Promise.resolve();
  const rem = Number(d.amount) - Number(d.paid);

  return new Promise(resolve => {
    quickInput({
      title: 'Record Payment',
      sub:   `"${d.name}" — ${fmtCurrency(rem)} remaining`,
      label: 'Amount paid (LKR)',
      onConfirm: async n => {
        d.paid = Math.min(Number(d.amount), Number(d.paid) + n);
        const { error } = await updateDebtPaid(id, d.paid);
        if (error) { toast('Save failed', 'error'); resolve(); return; }
        toast(`${fmtCurrency(n)} recorded ✓`, 'success');
        window.App?.render?.();
        resolve();
      },
    });
  });
}

export function deleteDebt(id) {
  const d = state.debts.find(x => x.id === id);
  return new Promise(resolve => {
    showConfirm({
      title:     'Remove Debt',
      msg:       d ? `Remove "${d.name}"? This cannot be undone.` : 'Remove this debt record?',
      label:     'Remove',
      onConfirm: async () => {
        state.debts = state.debts.filter(x => x.id !== id);
        const { error } = await dbDeleteDebt(id);
        if (error) toast('Delete failed', 'error');
        else toast('Removed', 'success');
        window.App?.render?.();
        resolve();
      },
    });
  });
}
