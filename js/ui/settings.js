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
  const custom = getCustomCategories();
  const plan   = getUserPlan();
  const owner  = isOwner();
  const email  = state.profile?.email ?? '—';
  const dname  = state.profile?.display_name ?? '';

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

function _updateHeaderName(name) {
  const el = document.getElementById('headerDisplayName');
  if (!el) return;

  // Prioritize provided name, fallback to email prefix, default to empty string
  const fallback = state.profile?.email?.split('@')[0] ?? '';
  el.textContent = name || fallback;
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/'/g,"&#39;").replace(/</g,'&lt;'); }
