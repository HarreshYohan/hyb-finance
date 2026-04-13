/**
 * js/ui/settings.js
 * Settings modal — account info, custom categories, plan status.
 */

import { state, isOwner, getUserPlan } from '../state.js';
import { getCustomCategories, addCustomCategory, removeCustomCategory } from '../categories.js';
import { updateProfile } from '../db.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);

export function openSettings() {
  _render();
  $('settingsOverlay').classList.add('open');
}

export function closeSettings() {
  $('settingsOverlay').classList.remove('open');
}

function _render() {
  const custom  = getCustomCategories();
  const plan    = getUserPlan();
  const owner   = isOwner();
  const email   = state.profile?.email ?? '—';
  const dname   = state.profile?.display_name ?? '';
  const estInc  = state.profile?.estimated_income ?? 0;
  const tgtRate = state.profile?.target_savings_rate ?? 20;
  const fixedEx = state.profile?.fixed_expenses ?? [];

  const planLabel = plan === 'lifetime' ? '👑 Lifetime'
                  : plan === 'pro'      ? '⚡ Pro'
                  :                       'Free';

  $('settingsBody').innerHTML = `
    ${owner ? `<div class="settings-owner-banner">
      <span>👑</span>
      <div>
        <div style="font-weight:600;font-size:13px">Owner Mode Active</div>
        <div style="font-size:11px;opacity:.75">All premium features permanently unlocked</div>
      </div>
    </div>` : ''}

    <div class="settings-section">
      <div class="settings-sec-title">Account</div>
      <div class="settings-row">
        <span class="settings-lbl">Email</span>
        <span class="settings-val mono">${email}</span>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Plan</span>
        <span class="settings-val"><span class="plan-status-pill ${plan}">${planLabel}</span></span>
      </div>
      <div class="settings-row settings-row-input">
        <span class="settings-lbl">Display name</span>
        <div class="settings-inline">
          <input class="settings-txt-input" id="dn-input" value="${_esc(dname)}" placeholder="Your name" maxlength="40">
          <button class="settings-action-btn" onclick="Settings.saveName()">Save</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-sec-title">Financial Profile</div>
      <div class="settings-row settings-row-input">
        <span class="settings-lbl">Estimated Monthly Income (LKR)</span>
        <div class="settings-inline">
          <input class="settings-txt-input" id="est-income-input" type="number" min="0" value="${estInc}" placeholder="e.g. 150000">
          <button class="settings-action-btn" onclick="Settings.saveFinancialProfile()">Save</button>
        </div>
      </div>
      <div class="settings-row settings-row-input" style="margin-top:6px">
        <span class="settings-lbl">Target Savings Rate (%)</span>
        <div class="settings-inline">
          <input class="settings-txt-input" id="tgt-rate-input" type="number" min="0" max="100" value="${tgtRate}" placeholder="20">
          <button class="settings-action-btn" onclick="Settings.saveFinancialProfile()">Save</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-sec-title">Fixed Monthly Expenses</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5">
        Enter your recurring fixed costs (rent, utilities, subscriptions). These help Centa give you accurate budget guidance.
      </div>
      <div id="fixed-expenses-list">${_fixedExpenseRows(fixedEx)}</div>
      <div class="settings-add-row" style="margin-top:10px">
        <input class="settings-txt-input" id="fe-name" placeholder="Expense name (e.g. Rent)" style="flex:2">
        <input class="settings-txt-input" id="fe-amount" type="number" min="0" placeholder="Amount" style="flex:1;min-width:90px">
        <button class="settings-action-btn" onclick="Settings.addFixedExpense()">+ Add</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-sec-title">Custom Income Categories</div>
      <div class="settings-chips" id="chips-income">${_chips('income', custom.income)}</div>
      <div class="settings-add-row">
        <input class="settings-txt-input" id="add-income-cat" placeholder="New category name…" maxlength="30"
          onkeydown="if(event.key==='Enter') Settings.addCat('income')">
        <button class="settings-action-btn" onclick="Settings.addCat('income')">+ Add</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-sec-title">Custom Expense Categories</div>
      <div class="settings-chips" id="chips-expense">${_chips('expense', custom.expense)}</div>
      <div class="settings-add-row">
        <input class="settings-txt-input" id="add-expense-cat" placeholder="New category name…" maxlength="30"
          onkeydown="if(event.key==='Enter') Settings.addCat('expense')">
        <button class="settings-action-btn" onclick="Settings.addCat('expense')">+ Add</button>
      </div>
    </div>

    <div class="settings-section settings-danger-zone">
      <button class="settings-signout-btn" onclick="App.signOut()">Sign Out</button>
    </div>
  `;
}

function _fixedExpenseRows(list) {
  if (!list.length) return `<div style="font-size:12px;color:var(--text3)">No fixed expenses added yet.</div>`;
  return `<div style="display:flex;flex-direction:column;gap:0">` +
    list.map((fe, i) => `
      <div class="fe-row">
        <span class="fe-name">${_esc(fe.name)}</span>
        <span class="fe-amt">LKR ${Number(fe.amount).toLocaleString()}</span>
        <button class="chip-del" onclick="Settings.removeFixedExpense(${i})" style="margin-left:6px">✕</button>
      </div>`).join('') +
    `</div>`;
}

function _chips(type, list) {
  if (!list.length) return `<span class="settings-empty">No custom categories yet</span>`;
  return list.map(c => `
    <span class="settings-chip">
      ${_esc(c)}
      <button class="chip-del" onclick="Settings.removeCat('${type}','${_esc(c)}')" aria-label="Remove">✕</button>
    </span>
  `).join('');
}

export function addCat(type) {
  const inputId = `add-${type}-cat`;
  const el = $(inputId);
  if (!el) return;
  const name = el.value.trim();
  if (!name) { toast('Enter a category name'); return; }
  if (!addCustomCategory(type, name)) { toast('Category already exists'); return; }
  el.value = '';
  _refreshChips(type);
  toast('Category added ✓');
}

export function removeCat(type, name) {
  removeCustomCategory(type, name);
  _refreshChips(type);
}

function _refreshChips(type) {
  const el = $(`chips-${type}`);
  if (!el) return;
  const { income, expense } = getCustomCategories();
  el.innerHTML = _chips(type, type === 'income' ? income : expense);
}

export async function saveName() {
  const name = $('dn-input')?.value.trim() ?? '';
  const { error } = await updateProfile({ display_name: name });
  if (error) { toast('Save failed — try again'); return; }
  if (state.profile) state.profile.display_name = name;
  _updateHeaderName(name);
  toast('Name updated ✓');
}

export async function saveFinancialProfile() {
  const income  = Number($('est-income-input')?.value) || 0;
  const rate    = Number($('tgt-rate-input')?.value) || 20;
  if (rate < 0 || rate > 100) { toast('Savings rate must be 0–100'); return; }
  const { error } = await updateProfile({ estimated_income: income, target_savings_rate: rate });
  if (error) { toast('Save failed — try again'); return; }
  if (state.profile) { state.profile.estimated_income = income; state.profile.target_savings_rate = rate; }
  toast('Financial profile updated ✓');
  window.App?.render?.();
}

export async function addFixedExpense() {
  const name   = $('fe-name')?.value.trim();
  const amount = Number($('fe-amount')?.value);
  if (!name || !amount || amount <= 0) { toast('Enter a name and amount'); return; }
  const list = [...(state.profile?.fixed_expenses ?? []), { name, amount }];
  const { error } = await updateProfile({ fixed_expenses: list });
  if (error) { toast('Save failed — try again'); return; }
  if (state.profile) state.profile.fixed_expenses = list;
  if ($('fe-name'))   $('fe-name').value   = '';
  if ($('fe-amount')) $('fe-amount').value = '';
  const el = $('fixed-expenses-list');
  if (el) el.innerHTML = _fixedExpenseRows(list);
  toast('Fixed expense added ✓');
  window.App?.render?.();
}

export async function removeFixedExpense(idx) {
  const list = (state.profile?.fixed_expenses ?? []).filter((_, i) => i !== idx);
  const { error } = await updateProfile({ fixed_expenses: list });
  if (error) { toast('Remove failed — try again'); return; }
  if (state.profile) state.profile.fixed_expenses = list;
  const el = $('fixed-expenses-list');
  if (el) el.innerHTML = _fixedExpenseRows(list);
  toast('Removed ✓');
  window.App?.render?.();
}

function _updateHeaderName(name) {
  const el = document.getElementById('headerDisplayName');
  if (!el) return;

  // Prioritize provided name, fallback to email prefix, default to empty string
  const fallback = state.profile?.email?.split('@')[0] ?? '';
  el.textContent = name || fallback;
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/'/g,"&#39;").replace(/</g,'&lt;'); }
