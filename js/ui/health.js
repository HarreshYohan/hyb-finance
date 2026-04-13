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

  const base      = estInc || avgInc;
  const savTarget = base * (tgtRate / 100);
  const wantsCap  = base - savTarget - totalFixed;

  panel.innerHTML = _html({
    estInc, tgtRate, fixedEx, totalFixed,
    inc, exp, net, sr, avgInc, avgExp, avgNet,
    savTarget, wantsCap, base,
  });
}

function _html({ estInc, tgtRate, fixedEx, totalFixed, inc, exp, net, sr, avgInc, avgExp, avgNet, savTarget, wantsCap, base }) {
  const hasProfile = estInc > 0;

  if (!hasProfile) return _noProfilePrompt();

  const rules = _buildRules({ avgInc, avgExp, avgNet, inc, exp, net, sr, tgtRate, totalFixed, base, savTarget, wantsCap });

  return `
    <div class="health-dashboard">
      <div class="health-dash-header">
        <div class="health-dash-title">Financial Health</div>
      </div>

      <!-- Hero KPIs -->
      <div class="health-hero-metrics">
        <div class="health-metric-card">
          <div class="health-metric-lbl">Monthly Baseline</div>
          <div class="health-metric-val">${fmtCurrency(base)}</div>
          <div class="health-metric-sub">Est. Income Pool</div>
        </div>
        <div class="health-metric-card">
          <div class="health-metric-lbl">Total Constraints</div>
          <div class="health-metric-val" style="color:var(--red)">${fmtCurrency(totalFixed)}</div>
          <div class="health-metric-sub">Fixed + Sunk Costs</div>
        </div>
      </div>

      <!-- Widget: Chunky Allocations -->
      <div class="health-visual-alloc">
        <div class="health-vb-title">Budget Allocation</div>
        ${_thickBar('Fixed Costs', totalFixed, base, 'var(--red)')}
        ${_thickBar('Savings Goal', savTarget, base, 'var(--green)')}
        ${_thickBar('Guilt-Free Spending', Math.max(0, wantsCap), base, 'var(--blue)')}
      </div>

      <!-- Widget: Insight Rules iOS Style -->
      <div class="health-section-title" style="margin-top:8px">AI Guidance</div>
      <div class="health-insight-grid">
        ${rules.map(r => `
        <div class="health-insight-card">
          <div class="health-insight-icon">${r.icon}</div>
          <div class="health-insight-content">
            <div class="health-insight-title">${r.title}</div>
            <div class="health-insight-desc">${r.text}</div>
            <span class="health-insight-tag ${r.tagClass}">${r.tag}</span>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
  `;
}

function _thickBar(label, amount, base, color) {
  const pct = base > 0 ? Math.min(100, Math.round((amount / base) * 100)) : 0;
  return `
    <div class="health-vb-row">
      <div class="health-vb-head">
        <span class="health-vb-lbl">${label}</span>
        <span class="health-vb-amt">${fmtCurrency(amount)}</span>
      </div>
      <div class="health-vb-track">
        <div class="health-vb-fill" style="width:${pct}%;background:linear-gradient(90deg, ${color}88, ${color});"></div>
      </div>
    </div>
  `;
}

function _noProfilePrompt() {
  return `
    <div class="health-dashboard" style="align-items:center;padding-top:40px">
      <div style="font-size:48px;margin-bottom:12px">🧠</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:8px">FinTech Analytics</div>
      <div style="font-size:14px;color:var(--text3);text-align:center;max-width:300px;margin-bottom:24px;line-height:1.6">
        Unlock premium financial insights and algorithmic budgeting by configuring your baseline.
      </div>
      <button class="btn-primary" style="padding:12px 32px;font-size:15px;border-radius:24px" onclick="Settings.open()">Configure Profile</button>
    </div>
  `;
}

function _buildRules({ avgInc, avgExp, avgNet, inc, exp, net, sr, tgtRate, totalFixed, base, savTarget, wantsCap }) {
  const rules = [];

  if (base > 0 && totalFixed / base > 0.6) {
    rules.push({ icon: '⚠️', title: 'High Fixed Ratios', text: `Fixed commitments isolate ${Math.round((totalFixed / base) * 100)}% of your cashflow. The healthy limit is 60%.`, tag: 'Warning', tagClass: 'h-tag-warn' });
  } else if (base > 0 && totalFixed > 0) {
    rules.push({ icon: '⚖️', title: 'Agile Obligations', text: `Your fixed overhead sits comfortably at ${Math.round((totalFixed / base) * 100)}% of your baseline.`, tag: 'Healthy', tagClass: 'h-tag-good' });
  }

  if (sr >= tgtRate) {
    rules.push({ icon: '🏆', title: 'Target Exceeded', text: `You're compounding wealth at ${sr}%, exceeding your ${tgtRate}% goal.`, tag: 'On Track', tagClass: 'h-tag-good' });
  } else if (inc > 0) {
    const gap = Math.round(inc * (tgtRate - sr) / 100);
    rules.push({ icon: '🧗', title: 'Savings Shortfall', text: `You're running ${sr}% against a ${tgtRate}% sprint. You are ${fmtCurrency(gap)} short.`, tag: 'Action Required', tagClass: 'h-tag-warn' });
  }

  if (wantsCap < 0 && base > 0) {
    rules.push({ icon: '🚨', title: 'Liquidity Squeeze', text: `After base savings and fixed ops, your available runway is negative.`, tag: 'Critical', tagClass: 'h-tag-danger' });
  } else if (wantsCap > 0 && base > 0) {
    rules.push({ icon: '🍸', title: 'Discretionary Limit', text: `Your guilt-free spending limit sits at ${fmtCurrency(wantsCap)} this month.`, tag: 'Guarded', tagClass: 'h-tag-neutral' });
  }

  if (avgNet > 0) {
    const annual = avgNet * 12;
    rules.push({ icon: '🦅', title: 'Trajectory', text: `At your 3-month velocity, you will lock ${fmtCurrency(annual)} in annual surplus.`, tag: 'Insight', tagClass: 'h-tag-neutral' });
  }

  return rules;
}
