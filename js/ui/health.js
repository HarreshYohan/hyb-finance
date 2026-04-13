/**
 * js/ui/health.js
 * Financial Health tab — personalised budget guidance based on
 * estimated income, fixed expenses, and actual spending patterns.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, allMonths } from '../state.js';
import { fmtCurrency } from '../utils.js';

export function renderHealth() {
  const panel = document.getElementById('tab-health');
  if (!panel) return;

  const estInc    = Number(state.profile?.estimated_income) || 0;
  const tgtRate   = Number(state.profile?.target_savings_rate) || 20;
  const fixedEx   = state.profile?.fixed_expenses ?? [];
  const totalFixed = fixedEx.reduce((s, f) => s + Number(f.amount), 0);

  const vm  = getViewMonth();
  const txs = txByMonth(vm);
  const inc = sumInc(txs);
  const exp = sumExp(txs);
  const net = inc - exp;
  const sr  = inc > 0 ? Math.round((net / inc) * 100) : 0;

  // 3-month averages
  const months = allMonths();
  const last3  = months.slice(-3);
  const avgInc = last3.reduce((s, m) => s + sumInc(txByMonth(m)), 0) / Math.max(last3.length, 1);
  const avgExp = last3.reduce((s, m) => s + sumExp(txByMonth(m)), 0) / Math.max(last3.length, 1);
  const avgNet = avgInc - avgExp;

  const base     = estInc || avgInc;
  const savTarget = base * (tgtRate / 100);
  const needsCap  = base * 0.50;
  const wantsCap  = base - savTarget - totalFixed;

  panel.innerHTML = _html({
    estInc, tgtRate, fixedEx, totalFixed,
    inc, exp, net, sr, avgInc, avgExp, avgNet,
    savTarget, needsCap, wantsCap, base,
  });
}

function _html({ estInc, tgtRate, fixedEx, totalFixed, inc, exp, net, sr, avgInc, avgExp, avgNet, savTarget, needsCap, wantsCap, base }) {
  const hasProfile = estInc > 0;

  // Budget allocation visual
  const allocationHtml = hasProfile ? `
<div class="health-section-label">Monthly Budget Allocation</div>
<div class="health-allocation-card card">
  ${_allocBar('Fixed Expenses', totalFixed, base, 'var(--red)')}
  ${_allocBar(`Savings Target (${tgtRate}%)`, savTarget, base, 'var(--green)')}
  ${_allocBar('Flexible Spending', Math.max(0, wantsCap), base, 'var(--blue)')}
  <div class="health-alloc-sum">
    <span>Accounted: ${fmtCurrency(totalFixed + savTarget + Math.max(0, wantsCap))}</span>
    <span>Income: ${fmtCurrency(base)}</span>
  </div>
</div>` : _noProfilePrompt();

  // Fixed expense breakdown
  const fixedHtml = fixedEx.length ? `
<div class="health-section-label" style="margin-top:20px">Your Fixed Monthly Commitments</div>
<div class="card">
  ${fixedEx.map(f => `
  <div class="health-fe-row">
    <span class="health-fe-name">${escHtml(f.name)}</span>
    <span class="health-fe-pct">${base > 0 ? Math.round((f.amount / base) * 100) + '%' : ''}</span>
    <span class="health-fe-amt">${fmtCurrency(f.amount)}</span>
  </div>`).join('')}
  <div class="health-fe-total">
    <span>Total fixed costs</span>
    <span>${fmtCurrency(totalFixed)}</span>
  </div>
</div>` : '';

  // Guidance rules
  const rules = _buildRules({ avgInc, avgExp, avgNet, inc, exp, net, sr, tgtRate, totalFixed, base, savTarget, wantsCap });

  // Actual vs budget comparison (this month)
  const actualHtml = hasProfile ? `
<div class="health-section-label" style="margin-top:20px">This Month vs Budget</div>
<div class="card">
  ${_actualVsBudget('Income', inc, base)}
  ${_actualVsBudget('Fixed Costs', totalFixed, totalFixed, true)}
  ${_actualVsBudget('Variable Spending', Math.max(0, exp - totalFixed), Math.max(0, wantsCap), true)}
  ${_actualVsBudget('Net Savings', net, savTarget)}
</div>` : '';

  return `
<div class="health-hero card" style="margin-bottom:16px">
  <div class="health-hero-top">
    <div>
      <div class="health-hero-title">Financial Health</div>
      <div class="health-hero-sub">Personalised guidance from your income, expenses and goals</div>
    </div>
    <button class="health-settings-btn" onclick="Settings.open()">⚙ Edit Profile</button>
  </div>
  ${hasProfile ? `
  <div class="health-stats-row">
    <div class="health-stat"><div class="health-stat-val">${fmtCurrency(base)}</div><div class="health-stat-lbl">Monthly Income</div></div>
    <div class="health-stat"><div class="health-stat-val" style="color:var(--red)">${fmtCurrency(totalFixed)}</div><div class="health-stat-lbl">Fixed Costs</div></div>
    <div class="health-stat"><div class="health-stat-val" style="color:var(--green)">${fmtCurrency(savTarget)}</div><div class="health-stat-lbl">Savings Target</div></div>
    <div class="health-stat"><div class="health-stat-val" style="color:var(--blue)">${fmtCurrency(Math.max(0, wantsCap))}</div><div class="health-stat-lbl">Flexible Budget</div></div>
  </div>` : ''}
</div>

${allocationHtml}
${fixedHtml}
${actualHtml}

<div class="health-section-label" style="margin-top:20px">Personalised Guidance</div>
<div style="display:flex;flex-direction:column;gap:8px">
  ${rules.map(r => `
  <div class="health-rule ${r.type}">
    <span class="health-rule-icon">${r.icon}</span>
    <div class="health-rule-body">
      <div class="health-rule-title">${r.title}</div>
      <div class="health-rule-text">${r.text}</div>
    </div>
    <span class="health-rule-tag ${r.type}">${r.tag}</span>
  </div>`).join('')}
</div>
`;
}

function _allocBar(label, amount, base, color) {
  const pct = base > 0 ? Math.min(100, Math.round((amount / base) * 100)) : 0;
  return `
  <div class="health-alloc-row">
    <div class="health-alloc-label">${label}</div>
    <div class="health-alloc-track">
      <div class="health-alloc-fill" style="width:${pct}%;background:${color}22;border-left:3px solid ${color}"></div>
    </div>
    <div class="health-alloc-nums">
      <span style="color:${color}">${fmtCurrency(amount)}</span>
      <span class="health-alloc-pct">${pct}%</span>
    </div>
  </div>`;
}

function _actualVsBudget(label, actual, budget, lowerIsBetter = false) {
  const diff   = actual - budget;
  const over   = budget > 0 && actual > budget;
  const color  = over ? (lowerIsBetter ? 'var(--red)' : 'var(--green)') : (lowerIsBetter ? 'var(--green)' : 'var(--text3)');
  const sign   = diff >= 0 ? '+' : '';
  return `
  <div class="health-avb-row">
    <span class="health-avb-label">${label}</span>
    <span class="health-avb-actual">${fmtCurrency(actual)}</span>
    <span class="health-avb-budget">${budget > 0 ? '/ ' + fmtCurrency(budget) : ''}</span>
    ${budget > 0 ? `<span class="health-avb-diff" style="color:${color}">${sign}${fmtCurrency(diff)}</span>` : '<span></span>'}
  </div>`;
}

function _noProfilePrompt() {
  return `
  <div class="card" style="text-align:center;padding:32px 20px">
    <div style="font-size:32px;margin-bottom:10px">💡</div>
    <div style="font-weight:600;margin-bottom:6px">Set up your financial profile</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.6">
      Enter your monthly income and savings target in Settings to unlock personalised budget allocation and guidance.
    </div>
    <button class="btn-primary" onclick="Settings.open()">Open Settings</button>
  </div>`;
}

function _buildRules({ avgInc, avgExp, avgNet, inc, exp, net, sr, tgtRate, totalFixed, base, savTarget, wantsCap }) {
  const rules = [];

  if (base > 0 && totalFixed / base > 0.6) {
    rules.push({ icon: '⚠️', title: 'High Fixed Cost Ratio', text: `Fixed expenses consume ${Math.round((totalFixed / base) * 100)}% of your income — above the recommended 60%. Review subscriptions and recurring commitments to free up cash flow.`, tag: 'Review', type: 'warn' });
  } else if (base > 0 && totalFixed > 0) {
    rules.push({ icon: '✅', title: 'Fixed Costs Manageable', text: `Fixed expenses are ${Math.round((totalFixed / base) * 100)}% of income — within the healthy 50–60% range. You have room for savings and discretionary spending.`, tag: 'Healthy', type: 'good' });
  }

  if (sr >= tgtRate) {
    rules.push({ icon: '🏆', title: `Savings Rate on Target`, text: `You're saving ${sr}% this month — meeting your ${tgtRate}% target. Consider putting surplus into a unit trust or fixed deposit.`, tag: 'On Track', type: 'good' });
  } else if (inc > 0) {
    const gap = Math.round(inc * (tgtRate - sr) / 100);
    rules.push({ icon: '💰', title: 'Boost Your Savings', text: `You're ${sr}% vs your ${tgtRate}% target — ${fmtCurrency(gap)} short. Pay yourself first: automate a transfer to savings on payday before spending on wants.`, tag: 'Action', type: 'warn' });
  }

  if (wantsCap < 0 && base > 0) {
    rules.push({ icon: '🚨', title: 'Budget Squeezed', text: `After fixed costs and savings target, your flexible spending budget is negative. Either increase income, reduce fixed costs, or lower your savings rate temporarily until income grows.`, tag: 'Critical', type: 'danger' });
  } else if (wantsCap > 0 && base > 0) {
    rules.push({ icon: '🎯', title: `Flexible Budget: ${fmtCurrency(wantsCap)}/month`, text: `This is your guilt-free spending allowance after covering all fixed costs and savings. Track daily to avoid creep — small expenses add up fast.`, tag: 'Budget', type: 'neutral' });
  }

  if (avgNet > 0) {
    const annualised = avgNet * 12;
    rules.push({ icon: '📈', title: 'Wealth Accumulation Pace', text: `At your current rate you're building ${fmtCurrency(annualised)} in annual surplus. Invested at 8% annually, this becomes ${fmtCurrency(annualised * 10.18)} over 5 years through compounding.`, tag: 'Insight', type: 'neutral' });
  }

  if (!state.debts.filter(d => d.dir === 'owe' && d.amount > d.paid).length) {
    rules.push({ icon: '✅', title: 'Debt-Free', text: 'No active debts is a powerful position. Direct what would be debt payments into an investment account. Even LKR 5,000/month compounded for 10 years grows significantly.', tag: 'Excellent', type: 'good' });
  }

  if (!state.goals.length) {
    rules.push({ icon: '🎯', title: 'Set Financial Goals', text: 'Goals with a deadline are 3× more likely to be achieved. Start with an emergency fund (3–6 months of expenses), then work toward bigger milestones.', tag: 'Tip', type: 'neutral' });
  }

  return rules;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
