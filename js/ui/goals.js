/**
 * js/ui/goals.js
 * Financial goals panel rendering and actions.
 */

import { state } from '../state.js';
import { fmtCurrency, fmtDate, pct, monthsUntil } from '../utils.js';
import { updateGoalSaved, deleteGoal as dbDeleteGoal } from '../db.js';
import { toast } from './toast.js';

export function renderGoals() {
  const grid = document.getElementById('goalsGrid');

  if (!state.goals.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-ico">🎯</div>
        <div class="empty-txt">No goals yet.<br>Add your first financial target.</div>
      </div>`;
    return;
  }

  grid.innerHTML = state.goals.map(g => {
    const p         = pct(g.saved, g.target);
    const rem       = g.target - g.saved;
    const months    = monthsUntil(g.deadline);
    const needPerMo = months && rem > 0 ? Math.ceil(rem / months) : null;

    return `
      <div class="goal-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <div class="goal-name">${g.name}</div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:500;color:${g.color}">${p}%</span>
        </div>
        <div class="goal-note">${g.note ?? ''}${g.deadline ? ' · By ' + fmtDate(g.deadline) : ''}</div>
        <div class="goal-stats">
          <span class="goal-saved" style="color:${g.color}">${fmtCurrency(g.saved)}</span>
          <span class="goal-target">${fmtCurrency(g.target)}</span>
        </div>
        <div class="prog-wrap" style="margin-bottom:6px">
          <div class="prog-bar" style="width:${p}%;background:${g.color}"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
          Remaining: ${fmtCurrency(rem)}${needPerMo ? ' · Need ' + fmtCurrency(needPerMo) + '/mo' : ''}
        </div>
        <div class="goal-actions">
          <button class="dbt-btn dbt-settle" style="flex:2" onclick="Goals.deposit('${g.id}')">+ Add Savings</button>
          <button class="dbt-btn dbt-edit" onclick="App.editGoal('${g.id}')">Edit</button>
          <button class="dbt-btn dbt-del"  onclick="Goals.del('${g.id}')">Del</button>
        </div>
      </div>`;
  }).join('');
}

export async function depositGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  const input = prompt(
    `Add savings to "${g.name}"\nCurrent: ${fmtCurrency(g.saved)} of ${fmtCurrency(g.target)}\n\nAmount (LKR):`
  );
  if (!input) return;
  const n = Number(input);
  if (isNaN(n) || n <= 0) { toast('Invalid amount'); return; }
  g.saved = Math.min(g.target, g.saved + n);
  const { error } = await updateGoalSaved(id, g.saved);
  if (error) { toast('Save failed'); return; }
  renderGoals();
  toast(`+${fmtCurrency(n)} added ✓`);
}

export async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  await dbDeleteGoal(id);
  renderGoals();
  toast('Removed');
}
