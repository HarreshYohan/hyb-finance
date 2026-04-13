/**
 * js/ui/plan.js
 * My Plan tab — AI-powered financial health, deep analysis, and upgrade tiers.
 * Sections: owner banner → hero → insights → spending breakdown →
 *           savings projection → debt timeline → goal forecasts → pricing tiers
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, allMonths, isOwner, getUserPlan } from '../state.js';
import { fmtCurrency } from '../utils.js';
import { CATEGORY_COLOR } from '../constants.js';
import { renderInvestmentSection } from './invest.js';

let _raf = null;
let _pts = [];

// ── Public entry point ────────────────────────────────────────────────────────

export function renderPlan() {
  const panel = document.getElementById('tab-plan');
  if (!panel) return;

  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }

  const vm  = getViewMonth();
  const txs = txByMonth(vm);
  const inc = sumInc(txs);
  const exp = sumExp(txs);
  const net = inc - exp;
  const rate = inc > 0 ? (net / inc) * 100 : 0;

  const months = allMonths();
  const recent = months.slice(-3);
  const avgInc = recent.reduce((s, m) => s + sumInc(txByMonth(m)), 0) / Math.max(recent.length, 1);
  const avgExp = recent.reduce((s, m) => s + sumExp(txByMonth(m)), 0) / Math.max(recent.length, 1);
  const avgNet = avgInc - avgExp;

  const totalDebt = state.debts
    .filter(d => d.dir === 'owe')
    .reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.paid)), 0);

  const goalAvgPct = state.goals.length
    ? state.goals.reduce((s, g) => s + Math.min(1, Number(g.saved) / Math.max(Number(g.target), 1)), 0)
      / state.goals.length * 100
    : 50;

  const estInc   = Number(state.profile?.estimated_income) || 0;
  const tgtRate  = Number(state.profile?.target_savings_rate) || 20;

  const score    = _calcScore(rate, totalDebt, avgInc, goalAvgPct, state.tx.length);
  const insights = _buildInsights({ inc, exp, net, rate, avgInc, avgExp, avgNet, totalDebt });

  panel.innerHTML = _html({ score, inc, exp, net, rate, insights, txs, avgNet, avgInc, estInc, tgtRate });

  requestAnimationFrame(() => {
    _animateCounter('planHealthNum', Math.round(score), 1300);
    _animateArc(Math.round(score));
    _initCanvas(score);
  });
}

// ── Score ─────────────────────────────────────────────────────────────────────

function _calcScore(rate, debt, avgInc, goalPct, txCount) {
  if (txCount === 0) return 20;
  let s = 45;
  if (rate >= 25)      s += 22;
  else if (rate >= 15) s += 14;
  else if (rate >= 5)  s += 6;
  else if (rate < 0)   s -= 18;
  if (debt === 0)                                       s += 12;
  else if (avgInc > 0 && debt / (avgInc * 12) < 0.25)  s += 5;
  else if (avgInc > 0 && debt / (avgInc * 12) > 1)     s -= 12;
  if (goalPct >= 60)      s += 10;
  else if (goalPct >= 25) s += 5;
  if (txCount >= 30) s += 5;
  return Math.min(100, Math.max(5, Math.round(s)));
}

function _scoreColor(s) {
  return s >= 75 ? '#1A7F4E' : s >= 50 ? '#B8860B' : '#C0392B';
}

function _scoreLabel(s) {
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 55) return 'Fair';
  if (s >= 35) return 'Needs Work';
  return 'Critical';
}

// ── Insights ──────────────────────────────────────────────────────────────────

function _buildInsights({ inc, exp, net, rate, avgInc, avgExp, avgNet, totalDebt }) {
  const ins = [];

  if (inc === 0 && exp === 0) {
    return [{ icon: '📊', title: 'No data yet', text: 'Start recording transactions to unlock your personalised financial analysis and AI-powered recommendations.', tag: 'Get Started', type: 'neutral' }];
  }

  // Savings rate
  if (rate >= 25) {
    ins.push({ icon: '🏆', title: 'Outstanding Savings Rate', text: `Saving ${rate.toFixed(1)}% of income — top-tier discipline. Invest your surplus into index funds or fixed deposits to compound wealth passively.`, tag: 'Excellent', type: 'positive' });
  } else if (rate >= 15) {
    ins.push({ icon: '💡', title: 'Healthy Savings Momentum', text: `${rate.toFixed(1)}% is solid. Push toward 25% by auditing subscriptions and discretionary spend — the gap compounds dramatically over time.`, tag: 'On Track', type: 'positive' });
  } else if (rate >= 5) {
    ins.push({ icon: '⚡', title: 'Low Savings Rate', text: `At ${rate.toFixed(1)}%, you're saving but not enough for real security. Apply the 50/30/20 rule: 50% needs, 30% wants, 20% savings minimum.`, tag: 'Improve', type: 'warning' });
  } else if (rate >= 0) {
    ins.push({ icon: '⚠️', title: 'Barely Breaking Even', text: `Spending almost everything earned. Even 5% saved consistently creates an emergency buffer in months. Identify your top 3 expenses and cut each by 10%.`, tag: 'Action Needed', type: 'warning' });
  } else {
    ins.push({ icon: '🚨', title: 'Spending Exceeds Income', text: `A deficit of ${fmtCurrency(Math.abs(net))} this month. Unsustainable — review largest categories immediately and set a hard daily spending cap.`, tag: 'Critical', type: 'danger' });
  }

  // Expense ratio
  if (inc > 0 && exp / inc > 0.9 && rate >= 0) {
    ins.push({ icon: '📉', title: 'Expenses Too High', text: `Spending ${((exp / inc) * 100).toFixed(0)}% of income. Above 80% leaves no buffer for emergencies or investment. Trim variable costs first.`, tag: 'Warning', type: 'warning' });
  }

  // Debt
  if (totalDebt > 0) {
    const sev = avgInc > 0 ? totalDebt / avgInc : 99;
    if (sev > 6) {
      ins.push({ icon: '💳', title: 'Critical Debt Load', text: `${fmtCurrency(totalDebt)} outstanding is 6× your monthly income. Use the debt avalanche — minimums everywhere, every extra rupee on the highest-interest debt.`, tag: 'Priority', type: 'danger' });
    } else {
      ins.push({ icon: '💳', title: `${sev > 2 ? 'Significant' : 'Manageable'} Debt`, text: `${fmtCurrency(totalDebt)} at ${sev.toFixed(1)}× monthly income. Pay 20% above the minimum monthly to significantly reduce total interest paid.`, tag: sev > 2 ? 'Action' : 'Monitor', type: sev > 2 ? 'warning' : 'neutral' });
    }
  } else {
    ins.push({ icon: '✅', title: 'Zero Outstanding Debt', text: 'Debt-free is a powerful position. Redirect what would have been debt payments into an investment account and watch it compound.', tag: 'Excellent', type: 'positive' });
  }

  // Goals
  if (!state.goals.length) {
    ins.push({ icon: '🎯', title: 'Set Concrete Goals', text: 'Goals with a name and deadline are 3× more likely to succeed. Start with an emergency fund (3–6 months expenses), then layer in bigger targets.', tag: 'Start Here', type: 'neutral' });
  } else {
    ins.push({ icon: '🎯', title: `${state.goals.length} Active Goal${state.goals.length > 1 ? 's' : ''}`, text: 'Automate transfers to goal accounts on payday so money is allocated before you can spend it. LKR 500/day = LKR 180k/year.', tag: 'On Track', type: 'positive' });
  }

  // Trend
  if (avgInc > 0) {
    ins.push({ icon: '📈', title: '3-Month Trend', text: `Average net ${avgNet >= 0 ? '+' : ''}${fmtCurrency(avgNet)}/month. ${avgNet >= 0 ? 'Consistently building surplus — automate investments now.' : 'Consistent deficit erodes savings fast. Review one recurring cost this week.'}`, tag: '3-Month View', type: avgNet >= 0 ? 'positive' : 'danger' });
  }

  // Emergency fund
  const mSpend = avgExp || exp;
  if (mSpend > 0) {
    ins.push({ icon: '🛡️', title: 'Emergency Fund Target', text: `Build ${fmtCurrency(mSpend * 6)} (6 months expenses) in a liquid savings account. This is your financial immune system — complete this before investing aggressively.`, tag: 'Foundation', type: 'neutral' });
  }

  if (rate >= 20 && totalDebt === 0) {
    ins.push({ icon: '📊', title: 'Ready to Invest', text: 'Strong savings + no debt — you\'re positioned to invest. A unit trust or index fund compounding at 8% annually turns 10× over 30 years.', tag: 'Next Level', type: 'positive' });
  }

  return ins;
}

// ── Category breakdown ────────────────────────────────────────────────────────

function _spendingBreakdown(txs) {
  const expTxs = txs.filter(t => t.type === 'expense');
  const total  = expTxs.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return '';

  const bycat = {};
  expTxs.forEach(t => { bycat[t.category] = (bycat[t.category] ?? 0) + t.amount; });
  const sorted = Object.entries(bycat).sort(([, a], [, b]) => b - a).slice(0, 8);

  return `
<div class="plan-section-label" style="margin-top:28px">Spending Breakdown</div>
<div class="card plan-breakdown-card">
  ${sorted.map(([cat, amt]) => {
    const pct   = Math.round((amt / total) * 100);
    const color = CATEGORY_COLOR[cat] ?? '#5C5A55';
    return `
    <div class="plan-cat-row">
      <div class="plan-cat-name">
        <span class="plan-cat-dot" style="background:${color}"></span>
        <span>${cat}</span>
      </div>
      <div class="plan-cat-track">
        <div class="plan-cat-fill" style="width:${pct}%;background:${color}22;border-left:3px solid ${color}"></div>
      </div>
      <div class="plan-cat-nums">
        <span>${fmtCurrency(amt)}</span>
        <span class="plan-cat-pct">${pct}%</span>
      </div>
    </div>`;
  }).join('')}
  <div class="plan-cat-total">
    Total expenses: <strong>${fmtCurrency(total)}</strong>
  </div>
</div>`;
}

// ── Savings projection ────────────────────────────────────────────────────────

function _savingsProjection(monthlySavings) {
  if (monthlySavings <= 0) return '';
  const r = 0.07 / 12; // 7% annual → monthly
  const fv = n => monthlySavings * ((Math.pow(1 + r, n) - 1) / r);

  return `
<div class="plan-section-label" style="margin-top:28px">Savings Projection</div>
<div class="card plan-proj-card">
  <div class="plan-proj-note">At <strong>${fmtCurrency(monthlySavings)}/month</strong> with 7% annual growth (conservative estimate)</div>
  <div class="plan-proj-grid">
    ${[['1 Year', 12], ['3 Years', 36], ['5 Years', 60], ['10 Years', 120]].map(([label, n]) => `
    <div class="plan-proj-item">
      <div class="plan-proj-period">${label}</div>
      <div class="plan-proj-val">${fmtCurrency(fv(n))}</div>
    </div>`).join('')}
  </div>
</div>`;
}

// ── Debt payoff timeline ──────────────────────────────────────────────────────

function _debtTimeline() {
  const active = state.debts.filter(d => d.dir === 'owe' && Number(d.amount) > Number(d.paid));
  if (!active.length) return '';

  return `
<div class="plan-section-label" style="margin-top:28px">Debt Payoff Timeline</div>
<div class="card">
  ${active.map(d => {
    const remaining = Number(d.amount) - Number(d.paid);
    const pct       = Math.round((Number(d.paid) / Number(d.amount)) * 100);
    const monthly   = Math.max(remaining * 0.05, 500);
    const months    = Math.ceil(remaining / monthly);
    const eta       = new Date();
    eta.setMonth(eta.getMonth() + months);
    const etaStr    = eta.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    return `
    <div class="plan-debt-item">
      <div class="plan-debt-head">
        <span class="plan-debt-name">${d.name}</span>
        <span class="plan-debt-eta">${etaStr} est.</span>
      </div>
      <div class="prog-wrap" style="margin:6px 0">
        <div class="prog-bar" style="width:${pct}%;background:var(--red)"></div>
      </div>
      <div class="plan-debt-nums">
        <span>${fmtCurrency(Number(d.paid))} paid · ${fmtCurrency(remaining)} remaining</span>
        <span>${months} months at min payment</span>
      </div>
    </div>`;
  }).join('')}
</div>`;
}

// ── Goal forecasts ────────────────────────────────────────────────────────────

function _goalForecasts(avgNet) {
  if (!state.goals.length) return '';

  return `
<div class="plan-section-label" style="margin-top:28px">Goal Forecasts</div>
<div class="plan-goals-grid">
  ${state.goals.map(g => {
    const remaining = Number(g.target) - Number(g.saved);
    const pct       = Math.min(100, Math.round((Number(g.saved) / Number(g.target)) * 100));
    let eta = '';
    if (remaining <= 0) {
      eta = '🎉 Complete';
    } else if (avgNet > 0) {
      const contribution = avgNet * 0.3; // assume 30% of net goes to goals
      const months = Math.ceil(remaining / Math.max(contribution, 1));
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      eta = `~${d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    } else {
      eta = 'Increase savings to forecast';
    }
    return `
    <div class="plan-goal-card">
      <div class="plan-goal-top">
        <div class="plan-goal-name">${g.name}</div>
        <div class="plan-goal-pct" style="color:${g.color ?? 'var(--green)'}">${pct}%</div>
      </div>
      <div class="prog-wrap" style="margin:7px 0">
        <div class="prog-bar" style="width:${pct}%;background:${g.color ?? 'var(--green)'}"></div>
      </div>
      <div class="plan-goal-row">
        <span>${fmtCurrency(Number(g.saved))} of ${fmtCurrency(Number(g.target))}</span>
        <span class="plan-goal-eta">${eta}</span>
      </div>
    </div>`;
  }).join('')}
</div>`;
}

// ── Target Wealth Architecture ────────────────────────────────────────────────

function _buildTargetPlan(estInc, tgtRate) {
  if (estInc <= 0) return '';
  const saveAmt = estInc * (tgtRate / 100);
  const needsAmt = estInc * 0.50; // 50% needs
  const wantsAmt = estInc - saveAmt - needsAmt; // Remainder for wants

  return `
<div class="plan-section-label" style="margin-top:28px">Your Wealth Architecture</div>
<div class="plan-pricing-sub">Based on your estimated income of ${fmtCurrency(estInc)}</div>
<div class="card">
  <div class="plan-alloc-row">
    <div class="plan-alloc-left"><span class="plan-cat-dot" style="background:var(--red)"></span><span>Core Needs (50%)</span></div>
    <span class="plan-alloc-val">${fmtCurrency(needsAmt)}</span>
  </div>
  <div class="plan-alloc-row">
    <div class="plan-alloc-left"><span class="plan-cat-dot" style="background:var(--blue)"></span><span>Wants & Discretionary (~${Math.round((wantsAmt/estInc)*100)}%)</span></div>
    <span class="plan-alloc-val">${fmtCurrency(wantsAmt)}</span>
  </div>
  <div class="plan-alloc-row">
    <div class="plan-alloc-left"><span class="plan-cat-dot" style="background:var(--green)"></span><span>Target Savings (${tgtRate}%)</span></div>
    <span class="plan-alloc-val green" style="font-weight:600">${fmtCurrency(saveAmt)}</span>
  </div>
</div>`;
}

// ── Pricing tiers ─────────────────────────────────────────────────────────────

function _tiersHTML() {
  const plan = getUserPlan();
  const owner = isOwner();

  const tiers = [
    {
      id: 'free', name: 'Free', price: 'LKR 0', period: 'forever',
      badge: null, hl: false,
      features: [
        [true,  '50 transactions / month'],
        [true,  '3 savings goals'],
        [true,  '5 debt records'],
        [true,  'Basic charts & calendar'],
        [false, 'AI financial insights'],
        [false, 'Unlimited transactions'],
        [false, 'CSV export & reporting'],
        [false, 'Priority support'],
      ],
      cta: plan === 'free' ? 'Current Plan' : 'Free Plan',
      ctaStyle: 'ghost',
      onclick: '',
    },
    {
      id: 'pro', name: 'Pro', price: 'LKR 490', period: '/ month',
      badge: 'Most Popular', hl: true,
      features: [
        [true,  'Unlimited transactions'],
        [true,  'Unlimited goals & debts'],
        [true,  'Full AI insights & analysis'],
        [true,  'Advanced charts & trends'],
        [true,  'CSV export'],
        [true,  'Recurring transactions'],
        [true,  'Budget alerts'],
        [false, 'Priority support'],
      ],
      cta: plan === 'pro' || owner ? '✓ Your Plan' : 'Upgrade to Pro',
      ctaStyle: plan === 'pro' || owner ? 'current' : 'primary',
      onclick: plan !== 'pro' && !owner ? `onclick="App.upgradePlan('pro')"` : '',
    },
    {
      id: 'lifetime', name: 'Lifetime', price: 'LKR 3,990', period: 'one-time',
      badge: 'Best Value', hl: false,
      features: [
        [true, 'Everything in Pro'],
        [true, 'Pay once — own forever'],
        [true, 'All future features included'],
        [true, 'Priority support'],
        [true, 'Early access to new features'],
        [true, 'Dedicated onboarding session'],
        [true, 'Custom categories (unlimited)'],
        [true, 'Multi-account support'],
      ],
      cta: plan === 'lifetime' || owner ? '👑 Your Plan' : 'Get Lifetime Access',
      ctaStyle: plan === 'lifetime' || owner ? 'current' : 'gold',
      onclick: plan !== 'lifetime' && !owner ? `onclick="App.upgradePlan('lifetime')"` : '',
    },
  ];

  return tiers.map(t => `
    <div class="plan-tier${t.hl ? ' tier-hl' : ''}">
      ${t.badge ? `<div class="tier-badge-pill">${t.badge}</div>` : ''}
      <div class="tier-name">${t.name}</div>
      <div class="tier-price-row">
        <span class="tier-price">${t.price}</span>
        <span class="tier-period">${t.period}</span>
      </div>
      <ul class="tier-feature-list">
        ${t.features.map(([ok, text]) => `
        <li class="tier-feature${ok ? '' : ' feat-dim'}">
          <span class="feat-check">${ok ? '✓' : '✕'}</span>
          <span>${text}</span>
        </li>`).join('')}
      </ul>
      <button class="tier-cta tier-cta-${t.ctaStyle}" ${t.onclick}>${t.cta}</button>
    </div>
  `).join('');
}

// ── Master HTML ───────────────────────────────────────────────────────────────

function _html({ score, inc, exp, net, rate, insights, txs, avgNet, avgInc, estInc, tgtRate }) {
  const circ   = 2 * Math.PI * 52;
  const color  = _scoreColor(score);
  const label  = _scoreLabel(score);
  const owner  = isOwner();
  const plan   = getUserPlan();

  return `
${owner ? `
<div class="plan-owner-banner">
  <span class="plan-owner-crown">👑</span>
  <div>
    <div class="plan-owner-title">Owner Mode — All features unlocked</div>
    <div class="plan-owner-sub">Welcome back. You have full Lifetime access, permanently.</div>
  </div>
</div>` : ''}

<div class="plan-hero-wrap">
  <canvas id="planBgCanvas" aria-hidden="true"></canvas>
  <div class="plan-hero-inner">
    <div class="plan-score-wrap">
      <svg class="plan-score-svg" viewBox="0 0 130 130" aria-hidden="true">
        <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
        <circle id="planArc" cx="65" cy="65" r="52" fill="none" stroke="${color}"
          stroke-width="10" stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
          stroke-linecap="round" transform="rotate(-90 65 65)"/>
      </svg>
      <div class="plan-score-center">
        <div class="plan-score-num" id="planHealthNum">0</div>
        <div class="plan-score-lbl">${label}</div>
      </div>
    </div>
    <div class="plan-hero-copy">
      <div class="plan-hero-eyebrow">Financial Health Score</div>
      <div class="plan-hero-title">Your Money Plan</div>
      <div class="plan-hero-sub">AI analysis from your real transaction data</div>
      <div class="plan-hero-stats">
        <div class="plan-stat"><div class="plan-stat-val green">${fmtCurrency(inc)}</div><div class="plan-stat-lbl">Income</div></div>
        <div class="plan-stat"><div class="plan-stat-val red">${fmtCurrency(exp)}</div><div class="plan-stat-lbl">Expenses</div></div>
        <div class="plan-stat"><div class="plan-stat-val ${net >= 0 ? 'green' : 'red'}">${fmtCurrency(Math.abs(net))}</div><div class="plan-stat-lbl">${net >= 0 ? 'Saved' : 'Deficit'}</div></div>
        <div class="plan-stat"><div class="plan-stat-val gold">${rate.toFixed(1)}%</div><div class="plan-stat-lbl">Savings Rate</div></div>
      </div>
    </div>
  </div>
</div>

<div class="plan-section-label" style="margin-top:20px">AI Insights</div>
<div class="plan-insights-grid">
  ${insights.map((ins, i) => `
  <div class="plan-insight-card" style="animation-delay:${i * 60}ms">
    <div class="plan-ins-icon">${ins.icon}</div>
    <div class="plan-ins-body">
      <div class="plan-ins-title">${ins.title}</div>
      <div class="plan-ins-text">${ins.text}</div>
    </div>
    <div class="plan-ins-badge ${ins.type}">${ins.tag}</div>
  </div>`).join('')}
</div>

${_buildTargetPlan(estInc, tgtRate)}
${_spendingBreakdown(txs)}
${_savingsProjection(Math.max(0, avgNet))}
${_debtTimeline()}
${_goalForecasts(avgNet)}

${(state.profile?.investment_enabled !== false) ? renderInvestmentSection({ avgNet, estInc, tgtRate }) : ''}

<div class="plan-section-label" style="margin-top:28px">Choose Your Plan</div>
<div class="plan-pricing-sub">Unlock everything Centa has to offer</div>
<div class="plan-tiers-grid">${_tiersHTML()}</div>

<div class="plan-payment-note">
  <strong>How purchasing works:</strong> Click an upgrade button → complete payment via Stripe →
  your account is automatically upgraded. Sign out and back in if the plan doesn't update immediately.
  Questions? Contact <a href="mailto:support@centa.app">support@centa.app</a>
</div>
`;
}

// ── Animations ────────────────────────────────────────────────────────────────

function _animateCounter(id, target, dur) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / dur, 1);
    el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function _animateArc(score) {
  const arc  = document.getElementById('planArc');
  if (!arc) return;
  const circ = 2 * Math.PI * 52;
  const tgt  = circ * (1 - score / 100);
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / 1300, 1);
    arc.style.strokeDashoffset = String(circ - (1 - Math.pow(1 - t, 3)) * (circ - tgt));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Canvas particle-mesh ──────────────────────────────────────────────────────

function _initCanvas(score) {
  const canvas = document.getElementById('planBgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const resize = () => {
    canvas.width  = canvas.offsetWidth  || 600;
    canvas.height = canvas.offsetHeight || 180;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  _pts = Array.from({ length: 55 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.8 + 0.7,
  }));

  const rgb = score >= 75 ? '74,222,128' : score >= 50 ? '252,211,77' : '248,113,113';

  const draw = () => {
    if (!document.getElementById('planBgCanvas')) { ro.disconnect(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of _pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},.55)`;
      ctx.fill();
    }
    for (let i = 0; i < _pts.length; i++) {
      for (let j = i + 1; j < _pts.length; j++) {
        const dx = _pts[i].x - _pts[j].x;
        const dy = _pts[i].y - _pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(_pts[i].x, _pts[i].y);
          ctx.lineTo(_pts[j].x, _pts[j].y);
          ctx.strokeStyle = `rgba(${rgb},${0.18 * (1 - d / 110)})`;
          ctx.lineWidth   = 0.6;
          ctx.stroke();
        }
      }
    }
    _raf = requestAnimationFrame(draw);
  };
  _raf = requestAnimationFrame(draw);
}
