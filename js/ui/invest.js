/**
 * js/ui/invest.js
 * Investment Module — shows safe investment options and 12-month projections 
 * tailored to Sri Lankan market based on user's net savings average.
 */

import { fmtCurrency } from '../utils.js';

const INVESTMENTS = [
  {
    id: 'fd',
    title: 'Licensed Bank Fixed Deposit',
    risk: 'low',
    riskLabel: 'Very Low Risk',
    annualReturn: [0.09, 0.11], // 9% - 11%
    minAmount: 'LKR 10,000',
    desc: 'Capital absolutely safe if bank is reputed. Great for your emergency fund.'
  },
  {
    id: 'tbill',
    title: 'Treasury Bills / Bonds',
    risk: 'low',
    riskLabel: 'Very Low Risk',
    annualReturn: [0.10, 0.12], // 10% - 12%
    minAmount: 'LKR 100,000',
    desc: 'Government-backed and virtually risk-free. Interest paid upfront (bills) or semi-annually (bonds).'
  },
  {
    id: 'ut-income',
    title: 'Unit Trust (Fixed Income)',
    risk: 'med',
    riskLabel: 'Low-Med Risk',
    annualReturn: [0.08, 0.12], // 8% - 12%
    minAmount: 'LKR 1,000',
    desc: 'Pools money to buy FDs and corporate debt. Highly liquid (withdraw in 2 days).'
  },
  {
    id: 'ut-growth',
    title: 'Unit Trust (Equity/Growth)',
    risk: 'high',
    riskLabel: 'High Risk',
    annualReturn: [0.12, 0.18], // 12% - 18% (variable)
    minAmount: 'LKR 1,000',
    desc: 'Invests in the stock market. Highly volatile but best for long-term wealth building.'
  }
];

function calc12MonthFutureValue(monthlyContribution, annualRate) {
  if (monthlyContribution <= 0) return 0;
  const r = annualRate / 12;
  const n = 12;
  // Compound interest formula for regular monthly investments: FV = P * [((1 + r)^n - 1) / r]
  return monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
}

export function renderInvestmentSection(avgNetOptions) {
  const avgNet = Math.max(0, avgNetOptions.avgNet || 0);
  const estInc = avgNetOptions.estInc || 0;
  const tgtRate = avgNetOptions.tgtRate || 20;

  // Let's assume the user will invest whatever their target savings rate suggests, 
  // or their actual net if it's higher/zero
  let monthlyInvestment = estInc * (tgtRate / 100);
  if (avgNet > monthlyInvestment) monthlyInvestment = avgNet;

  if (monthlyInvestment <= 0) {
    return `
    <div class="plan-section-label" style="margin-top:24px">Investment Suggestions</div>
    <div class="card empty" style="padding:40px 20px;">
      <div class="empty-ico">🌱</div>
      <div class="empty-txt">Build a positive monthly surplus to unlock investment projections.</div>
    </div>`;
  }

  const baseInvestAmount = fmtCurrency(monthlyInvestment);

  const cardsHtml = INVESTMENTS.map(inv => {
    // Pick conservative rate from their range
    const estRate = inv.annualReturn[0]; 
    const fv12 = calc12MonthFutureValue(monthlyInvestment, estRate);
    const totalContributed = monthlyInvestment * 12;
    const profit = fv12 - totalContributed;

    return `
    <div class="invest-card">
      <div class="inv-header">
        <div class="inv-title">${inv.title}</div>
        <div class="inv-risk ${inv.risk}">${inv.riskLabel}</div>
      </div>
      <div class="inv-stats">
        <div>
          <div class="inv-stat-lbl">Expected Return</div>
          <div class="inv-stat-val">${(inv.annualReturn[0]*100).toFixed(0)} - ${(inv.annualReturn[1]*100).toFixed(0)}% p.a.</div>
        </div>
        <div>
          <div class="inv-stat-lbl">Min. Investment</div>
          <div class="inv-stat-val">${inv.minAmount}</div>
        </div>
      </div>
      
      <div class="inv-proj">
        <div class="inv-proj-title">12-Month Projection</div>
        <div class="inv-proj-val">${fmtCurrency(fv12)}</div>
        <div class="inv-proj-desc">Based on investing <strong>${baseInvestAmount}/mo</strong>. Includes ${fmtCurrency(profit)} earned in interest.</div>
      </div>
      
      <div style="font-size:12px; color:var(--text3); margin-top:12px; line-height:1.4;">
        ${inv.desc}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="plan-section-label" style="margin-top:24px">Investment Opportunities</div>

    ${cardsHtml}

    <div class="inv-disclaimer">
      <strong>⚠️ Disclaimer:</strong> These are educational suggestions only, not financial advice. 
      Returns are not guaranteed and past performance does not indicate future results. 
      Always consult a licensed financial advisor before making investment decisions.
    </div>
  `;
}
