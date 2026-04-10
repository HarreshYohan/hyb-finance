/**
 * js/ui/modals.js
 * All modal open/close logic and form save handlers.
 * Data flow: validate → DB write → update local state → close modal → render.
 * Never update local state before confirming the DB write succeeded.
 */

import { state } from '../state.js';
import { uid, todayStr } from '../utils.js';
import { getIncomeCategories, getExpenseCategories } from '../categories.js';
import {
  upsertTransaction, deleteTransaction,
  upsertDebt, upsertGoal,
} from '../db.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);

// ── Transaction Modal ─────────────────────────────────────────────────────────

let _editTxId  = null;
let _txTypeVal = 'income';

export function openTxModal(id = null) {
  _editTxId = id;
  const t   = id ? state.tx.find(x => x.id === id) : null;
  setTxType(t?.type ?? 'income');
  $('tx-desc').value   = t?.desc   ?? '';
  $('tx-amount').value = t?.amount ?? '';
  $('tx-date').value   = t?.date   ?? todayStr();
  $('tx-note').value   = t?.note   ?? '';
  $('txTitle').textContent = id ? 'Edit Transaction' : 'Add Transaction';
  if (t) $('tx-cat').value = t.category;
  $('txOverlay').classList.add('open');
  setTimeout(() => $('tx-desc').focus(), 80);
}

export function closeTxModal() {
  $('txOverlay').classList.remove('open');
  $('acList').style.display = 'none';
}

export function setTxType(type) {
  _txTypeVal = type;
  const cats = type === 'income' ? getIncomeCategories() : getExpenseCategories();
  $('tx-cat').innerHTML = cats.map(c => `<option>${c}</option>`).join('');
  $('ttIn').className  = 'type-toggle' + (type === 'income'  ? ' sel-in'  : '');
  $('ttOut').className = 'type-toggle' + (type === 'expense' ? ' sel-out' : '');
  const btn = $('txSave');
  btn.className   = 'btn-save ' + (type === 'income' ? 'in' : 'out');
  btn.textContent = 'Save ' + (type === 'income' ? 'Income' : 'Expense');
}

export async function saveTx(onSaved) {
  const desc   = $('tx-desc').value.trim();
  const amount = Number($('tx-amount').value);
  const date   = $('tx-date').value;
  const cat    = $('tx-cat').value;
  const note   = $('tx-note').value.trim();

  if (!desc)            { toast('Enter a description', 'warning'); return; }
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'warning'); return; }
  if (!date)            { toast('Select a date', 'warning'); return; }

  const btn      = $('txSave');
  const origText = btn.textContent;
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  const entry = {
    id:       _editTxId ?? uid(),
    desc, amount, date, category: cat, note,
    type:     _txTypeVal,
    ts:       Date.now(),
  };

  const { error } = await upsertTransaction(entry);

  btn.textContent = origText;
  btn.disabled    = false;

  if (error) {
    toast('Save failed — check your connection and try again', 'error');
    return; // keep modal open, don't update local state
  }

  // DB confirmed — now update local state
  if (_editTxId) {
    const i = state.tx.findIndex(t => t.id === _editTxId);
    if (i >= 0) state.tx[i] = entry;
  } else {
    state.tx.push(entry);
  }

  closeTxModal();
  onSaved?.();
  toast(_editTxId ? 'Updated ✓' : 'Saved ✓', 'success');
}

export async function deleteTx(id, onDeleted) {
  // Use custom confirm overlay instead of browser confirm()
  const { showConfirm } = await import('./dialogs.js');
  const t = state.tx.find(x => x.id === id);
  showConfirm({
    title:     'Delete Transaction',
    msg:       t ? `Delete "${t.desc}" (${t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()})?` : 'Delete this transaction?',
    label:     'Delete',
    onConfirm: async () => {
      state.tx = state.tx.filter(t => t.id !== id);
      const { error } = await deleteTransaction(id);
      if (error) toast('Delete failed', 'error');
      else toast('Deleted', 'success');
      onDeleted?.();
    },
  });
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

export function showAutocomplete(val) {
  const list = $('acList');
  if (!val || val.length < 2) { list.style.display = 'none'; return; }

  const hist = {};
  state.tx.forEach(t => {
    if (t.desc.toLowerCase().includes(val.toLowerCase()))
      hist[t.desc] = { cat: t.category, type: t.type, amount: t.amount };
  });

  const entries = Object.entries(hist).slice(0, 5);
  if (!entries.length) { list.style.display = 'none'; return; }

  list.innerHTML = entries.map(([desc, d]) =>
    `<div class="ac-item" onclick="Modals.pickAC('${esc(desc)}',${d.amount},'${d.cat}','${d.type}')">
      <span>${desc}</span><span>${d.amount.toLocaleString()}</span>
    </div>`
  ).join('');
  list.style.display = 'block';
}

export function pickAC(desc, amount, cat, type) {
  $('tx-desc').value   = desc;
  $('tx-amount').value = amount;
  setTxType(type);
  setTimeout(() => { $('tx-cat').value = cat; }, 50);
  $('acList').style.display = 'none';
}

// ── Debt Modal ────────────────────────────────────────────────────────────────

let _editDebtId = null;
let _debtDirVal = 'owe';

export function openDebtModal(id = null) {
  _editDebtId = id;
  const d = id ? state.debts.find(x => x.id === id) : null;
  setDebtDir(d?.dir ?? 'owe');
  $('d-name').value   = d?.name   ?? '';
  $('d-amount').value = d?.amount ?? '';
  $('d-paid').value   = d?.paid   ?? 0;
  $('d-due').value    = d?.due    ?? '';
  $('d-desc').value   = d?.desc   ?? '';
  $('debtModalTitle').textContent = id ? 'Edit Debt' : 'Add Debt';
  if (d) $('d-cat').value = d.category;
  $('debtOverlay').classList.add('open');
}

export function closeDebtModal() { $('debtOverlay').classList.remove('open'); }

export function setDebtDir(dir) {
  _debtDirVal = dir;
  $('dttOwe').className  = 'type-toggle' + (dir === 'owe'  ? ' sel-out' : '');
  $('dttOwed').className = 'type-toggle' + (dir === 'owed' ? ' sel-in'  : '');
}

export async function saveDebt(onSaved) {
  const name   = $('d-name').value.trim();
  const amount = Number($('d-amount').value);
  if (!name)   { toast('Enter a name', 'warning'); return; }
  if (!amount) { toast('Enter a valid amount', 'warning'); return; }

  const btn      = document.querySelector('#debtOverlay .btn-save');
  const origText = btn?.textContent;
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  const entry = {
    id:       _editDebtId ?? uid(),
    name, amount,
    paid:     Number($('d-paid').value)  || 0,
    due:      $('d-due').value           || null,
    category: $('d-cat').value,
    desc:     $('d-desc').value.trim(),
    dir:      _debtDirVal,
    ts:       Date.now(),
  };

  const { error } = await upsertDebt(entry);

  if (btn) { btn.textContent = origText; btn.disabled = false; }

  if (error) {
    toast('Save failed — check your connection', 'error');
    return;
  }

  if (_editDebtId) {
    const i = state.debts.findIndex(d => d.id === _editDebtId);
    if (i >= 0) state.debts[i] = entry;
  } else {
    state.debts.push(entry);
  }

  closeDebtModal();
  onSaved?.();
  toast('Saved ✓', 'success');
}

// ── Goal Modal ────────────────────────────────────────────────────────────────

let _editGoalId = null;

export function openGoalModal(id = null) {
  _editGoalId = id;
  const g = id ? state.goals.find(x => x.id === id) : null;
  $('g-name').value     = g?.name     ?? '';
  $('g-target').value   = g?.target   ?? '';
  $('g-saved').value    = g?.saved    ?? 0;
  $('g-deadline').value = g?.deadline ?? '';
  $('g-color').value    = g?.color    ?? '#1A7F4E';
  $('g-note').value     = g?.note     ?? '';
  $('goalOverlay').classList.add('open');
}

export function closeGoalModal() { $('goalOverlay').classList.remove('open'); }

export async function saveGoal(onSaved) {
  const name   = $('g-name').value.trim();
  const target = Number($('g-target').value);
  if (!name)   { toast('Enter a goal name', 'warning'); return; }
  if (!target) { toast('Enter a target amount', 'warning'); return; }

  const btn      = document.querySelector('#goalOverlay .btn-save');
  const origText = btn?.textContent;
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  const entry = {
    id:       _editGoalId ?? uid(),
    name, target,
    saved:    Number($('g-saved').value) || 0,
    deadline: $('g-deadline').value      || null,
    color:    $('g-color').value,
    note:     $('g-note').value.trim(),
  };

  const { error } = await upsertGoal(entry);

  if (btn) { btn.textContent = origText; btn.disabled = false; }

  if (error) {
    toast('Save failed — check your connection', 'error');
    return;
  }

  if (_editGoalId) {
    const i = state.goals.findIndex(g => g.id === _editGoalId);
    if (i >= 0) state.goals[i] = entry;
  } else {
    state.goals.push(entry);
  }

  closeGoalModal();
  onSaved?.();
  toast('Goal saved ✓', 'success');
}

// ── Private ───────────────────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/'/g, "\\'"); }
