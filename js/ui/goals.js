/**
 * js/ui/goals.js
 * Financial goals panel rendering and actions.
 */

import { state } from '../state.js';
import { fmtCurrency, fmtDate, pct, monthsUntil } from '../utils.js';
import { updateGoalSaved, deleteGoal as dbDeleteGoal } from '../db.js';
import { toast } from './toast.js';
import { quickInput, showConfirm } from './dialogs.js';

export function renderGoals() {
  const grid = document.getElementById('goalsGrid');

  if (!state.goals.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-ico">🎯</div>
        <div class="empty-txt">No goals yet.<br>Add your first financial target and start building toward it.</div>
        <button class="add-btn" style="margin-top:12px" onclick="Modals.openGoal()">+ Add Goal</button>
      </div>`;
    return;
  }

  grid.innerHTML = state.goals.map(g => {
    const p         = pct(g.saved, g.target);
    const rem       = g.target - g.saved;
    const months    = monthsUntil(g.deadline);
    const needPerMo = months && rem > 0 ? Math.ceil(rem / months) : null;
    const complete  = p >= 100;

    return `
      <div class="goal-card${complete ? ' goal-complete' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <div class="goal-name">${g.name}${complete ? ' 🎉' : ''}</div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;color:${g.color}">${p}%</span>
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
          ${complete ? 'Goal reached! 🏆' : `${fmtCurrency(rem)} to go${needPerMo ? ' · ' + fmtCurrency(needPerMo) + '/mo needed' : ''}`}
        </div>
        <div class="goal-actions">
          ${!complete ? `<button class="dbt-btn dbt-settle" style="flex:2" onclick="Goals.deposit('${g.id}')">+ Add Savings</button>` : ''}
          <button class="dbt-btn dbt-edit" onclick="App.editGoal('${g.id}')">Edit</button>
          <button class="dbt-btn dbt-del"  onclick="Goals.del('${g.id}')">Del</button>
        </div>
      </div>`;
  }).join('');
}

export function depositGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return Promise.resolve();

  return new Promise(resolve => {
    quickInput({
      title: 'Add Savings',
      sub:   `"${g.name}" — ${fmtCurrency(g.saved)} of ${fmtCurrency(g.target)} saved`,
      label: 'Amount to add (LKR)',
      onConfirm: async n => {
        g.saved = Math.min(g.target, g.saved + n);
        const { error } = await updateGoalSaved(id, g.saved);
        if (error) { toast('Save failed', 'error'); resolve(); return; }
        toast(`+${fmtCurrency(n)} added ✓`, 'success');
        window.App?.render?.();
        resolve();
      },
    });
  });
}

export function deleteGoal(id) {
  const g = state.goals.find(x => x.id === id);
  return new Promise(resolve => {
    showConfirm({
      title:     'Delete Goal',
      msg:       g ? `Delete "${g.name}"? Your saved progress will be lost.` : 'Delete this goal?',
      label:     'Delete',
      onConfirm: async () => {
        state.goals = state.goals.filter(x => x.id !== id);
        const { error } = await dbDeleteGoal(id);
        if (error) toast('Delete failed', 'error');
        else toast('Goal removed', 'success');
        window.App?.render?.();
        resolve();
      },
    });
  });
}
