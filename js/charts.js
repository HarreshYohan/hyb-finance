/**
 * js/charts.js
 * All Chart.js chart rendering. Isolated here so the rest of the app
 * never needs to know about chart instances or canvas management.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, allMonths } from './state.js';
import { monthLabel, fmtCurrency } from './utils.js';
import { CATEGORY_COLOR } from './constants.js';

const CHART_INSTANCES = {};
const MUTED = '#9B9890';
const COLORS = {
  green: 'rgba(26,127,78,.75)',
  red:   'rgba(192,57,43,.75)',
  blue:  '#1A5FA8',
};

function destroyChart(id) {
  if (CHART_INSTANCES[id]) {
    CHART_INSTANCES[id].destroy();
    delete CHART_INSTANCES[id];
  }
}

function axisDefaults() {
  return {
    ticks: { color: MUTED, font: { size: 10 } },
    grid:  { color: 'rgba(0,0,0,.04)' },
  };
}

export function buildCharts() {
  _buildIncomeExpenseChart();
  _buildCategoryChart();
  _buildDailyChart();
  _buildSavingsRateChart();
  _buildIncomeSourceChart();
  _buildYearForecastChart();
  _renderFinancialInsightCards();
}

function _buildIncomeExpenseChart() {
  const months = allMonths().slice(-6);
  const labels = months.map(monthLabel);
  const incs   = months.map(m => sumInc(txByMonth(m)));
  const exps   = months.map(m => sumExp(txByMonth(m)));

  destroyChart('ieChart');
  CHART_INSTANCES['ieChart'] = new Chart(document.getElementById('ieChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',   data: incs, backgroundColor: COLORS.green, borderRadius: 4, borderSkipped: false },
        { label: 'Expenses', data: exps, backgroundColor: COLORS.red,   borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: MUTED, font: { size: 11 }, boxWidth: 8 } } },
      scales: {
        y: { ...axisDefaults(), ticks: { callback: v => 'LKR ' + v / 1000 + 'k', color: MUTED, font: { size: 10 } } },
        x: { ...axisDefaults(), grid: { display: false } },
      },
    },
  });
}

function _buildCategoryChart() {
  const cm     = getViewMonth();
  const catMap = {};
  txByMonth(cm).filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] ?? 0) + Number(t.amount);
  });

  destroyChart('catChart');
  if (!Object.keys(catMap).length) return;

  CHART_INSTANCES['catChart'] = new Chart(document.getElementById('catChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(catMap),
      datasets: [{
        data:           Object.values(catMap),
        backgroundColor: Object.keys(catMap).map(c => CATEGORY_COLOR[c] ?? MUTED),
        borderWidth:    2,
        borderColor:    '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '55%',
      plugins: { legend: { position: 'right', labels: { color: MUTED, font: { size: 10 }, padding: 8, boxWidth: 8 } } },
    },
  });
}

function _buildDailyChart() {
  const cm = getViewMonth();
  const { year, month } = _parseYM(cm);
  const days = new Date(year, month, 0).getDate();
  const labels = [], incs = [], exps = [];

  for (let d = 1; d <= days; d++) {
    const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const txs = state.tx.filter(t => t.date === ds);
    labels.push(d);
    incs.push(sumInc(txs));
    exps.push(sumExp(txs));
  }

  destroyChart('dailyChart');
  CHART_INSTANCES['dailyChart'] = new Chart(document.getElementById('dailyChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',  data: incs, backgroundColor: 'rgba(26,127,78,.6)',  borderRadius: 2, borderSkipped: false },
        { label: 'Expense', data: exps, backgroundColor: 'rgba(192,57,43,.6)', borderRadius: 2, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: MUTED, font: { size: 11 }, boxWidth: 8 } } },
      scales: {
        y: { ...axisDefaults(), ticks: { callback: v => 'LKR ' + v / 1000 + 'k', color: MUTED, font: { size: 10 } } },
        x: { ...axisDefaults(), grid: { display: false }, ticks: { color: MUTED, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 } },
      },
    },
  });
}

function _buildSavingsRateChart() {
  const months = allMonths().slice(-6);
  const labels = months.map(monthLabel);
  const rates  = months.map(m => {
    const inc = sumInc(txByMonth(m));
    return inc ? Math.round(((inc - sumExp(txByMonth(m))) / inc) * 100) : 0;
  });

  destroyChart('srChart');
  CHART_INSTANCES['srChart'] = new Chart(document.getElementById('srChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Savings %', data: rates,
        borderColor: COLORS.blue, backgroundColor: 'rgba(26,95,168,.08)',
        fill: true, tension: .4, pointBackgroundColor: COLORS.blue, pointRadius: 4, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ...axisDefaults(), ticks: { callback: v => v + '%', color: MUTED, font: { size: 10 } }, min: 0 },
        x: { ...axisDefaults(), grid: { display: false } },
      },
    },
  });
}

function _buildIncomeSourceChart() {
  const cm     = getViewMonth();
  const srcMap = {};
  txByMonth(cm).filter(t => t.type === 'income').forEach(t => {
    srcMap[t.category] = (srcMap[t.category] ?? 0) + Number(t.amount);
  });

  destroyChart('srcChart');
  if (!Object.keys(srcMap).length) return;

  CHART_INSTANCES['srcChart'] = new Chart(document.getElementById('srcChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(srcMap),
      datasets: [{
        data: Object.values(srcMap),
        backgroundColor: Object.keys(srcMap).map(c => CATEGORY_COLOR[c] ?? MUTED),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '55%',
      plugins: { legend: { position: 'right', labels: { color: MUTED, font: { size: 10 }, padding: 8, boxWidth: 8 } } },
    },
  });
}

function _parseYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

// ── Year-end Forecast Chart ───────────────────────────────────────────────────

function _buildYearForecastChart() {
  const canvas = document.getElementById('forecastChart');
  if (!canvas) return;

  const now  = new Date();
  const year = now.getFullYear();
  const curM = now.getMonth() + 1; // 1-based

  // Gather actual monthly net savings for months elapsed this year
  const actuals = [];
  for (let m = 1; m <= curM; m++) {
    const ym  = `${year}-${String(m).padStart(2, '0')}`;
    const txs = txByMonth(ym);
    actuals.push(sumInc(txs) - sumExp(txs));
  }

  const avgNet = actuals.length
    ? actuals.reduce((s, v) => s + v, 0) / actuals.length
    : Number(state.profile?.estimated_income || 0) * 0.2;

  // Build labels Jan–Dec
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const labels  = MONTHS;

  // Actual data (only months already passed)
  const actualData = MONTHS.map((_, i) => {
    const m = i + 1;
    return m <= curM ? actuals[i] ?? null : null;
  });

  // Projection: compound monthly — use optimistic (avgNet * 1.05) and conservative (avgNet * 0.85)
  let runningOpt  = 0;
  let runningCons = 0;
  const projOpt   = MONTHS.map((_, i) => {
    const m = i + 1;
    if (m < curM) return null;
    if (m === curM) { runningOpt = actuals[curM - 1] ?? avgNet; runningCons = runningOpt; return runningOpt; }
    runningOpt  += avgNet * 1.05;
    runningCons += avgNet * 0.85;
    return runningOpt;
  });
  let currentCons = 0;
  const projCons = MONTHS.map((_, i) => {
    const m = i + 1;
    if (m < curM) return null;
    if (m === curM) {
      currentCons = actuals[curM - 1] ?? avgNet;
      return currentCons;
    }
    currentCons += avgNet * 0.85;
    return currentCons;
  });

  // Cumulative actuals
  let cum = 0;
  const cumActual = MONTHS.map((_, i) => {
    const m = i + 1;
    if (m > curM) return null;
    cum += actuals[i] ?? 0;
    return cum;
  });

  // Cumulative projection (optimistic)
  let cumProj = cum;
  const cumProjected = MONTHS.map((_, i) => {
    const m = i + 1;
    if (m < curM) return null;
    if (m === curM) return cum;
    cumProj += avgNet;
    return cumProj;
  });

  destroyChart('forecastChart');
  CHART_INSTANCES['forecastChart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Net Savings',
          data: actualData,
          backgroundColor: actualData.map(v => v === null ? 'transparent' : v >= 0 ? 'rgba(52,211,153,.75)' : 'rgba(248,113,113,.75)'),
          borderRadius: 4,
          borderSkipped: false,
          order: 2,
        },
        {
          label: 'Projected Net',
          data: cumProjected,
          type: 'line',
          borderColor: 'rgba(96,165,250,.8)',
          backgroundColor: 'rgba(96,165,250,.07)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(96,165,250,.8)',
          borderWidth: 2,
          borderDash: [4, 3],
          order: 1,
        },
        {
          label: 'Cumulative Actual',
          data: cumActual,
          type: 'line',
          borderColor: 'rgba(252,211,77,.9)',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(252,211,77,.9)',
          borderWidth: 2,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: MUTED, font: { size: 11 }, boxWidth: 10, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw !== null ? `${ctx.dataset.label}: LKR ${Math.round(ctx.raw).toLocaleString()}` : null,
          },
        },
      },
      scales: {
        y: { ...axisDefaults(), ticks: { callback: v => (v >= 0 ? '' : '-') + 'LKR ' + Math.abs(v / 1000).toFixed(0) + 'k', color: MUTED, font: { size: 10 } } },
        x: { ...axisDefaults(), grid: { display: false } },
      },
    },
  });
}

// ── Financial Insight Cards ───────────────────────────────────────────────────

function _renderFinancialInsightCards() {
  const el = document.getElementById('chartInsights');
  if (!el) return;

  const now   = new Date();
  const year  = now.getFullYear();
  const curM  = now.getMonth() + 1;
  const monthsLeft = 12 - curM;

  const ytdTxs = state.tx.filter(t => t.date.startsWith(String(year)));
  const ytdInc = sumInc(ytdTxs);
  const ytdExp = sumExp(ytdTxs);
  const ytdNet = ytdInc - ytdExp;
  const ytdRate = ytdInc > 0 ? Math.round((ytdNet / ytdInc) * 100) : 0;

  const estInc    = Number(state.profile?.estimated_income) || 0;
  const tgtRate   = Number(state.profile?.target_savings_rate) || 20;
  const avgMonNet = curM > 0 ? ytdNet / curM : 0;
  const eoyProj   = ytdNet + avgMonNet * monthsLeft;
  const eoyTarget = estInc * 12 * (tgtRate / 100);

  const cards = [
    {
      label: `${year} YTD Income`,
      value: fmtCurrency(ytdInc),
      sub: `${curM} months tracked`,
      color: 'var(--green)',
    },
    {
      label: `${year} YTD Savings`,
      value: fmtCurrency(ytdNet),
      sub: `${ytdRate}% savings rate`,
      color: ytdNet >= 0 ? 'var(--green)' : 'var(--red)',
    },
    {
      label: 'Year-End Projection',
      value: fmtCurrency(eoyProj),
      sub: `Based on ${curM}-month average`,
      color: 'var(--blue)',
    },
    {
      label: 'Savings Gap',
      value: eoyTarget > 0 ? fmtCurrency(Math.max(0, eoyTarget - eoyProj)) : '—',
      sub: eoyTarget > 0 ? `to hit ${tgtRate}% target` : 'Set income in settings',
      color: eoyTarget > 0 && eoyProj < eoyTarget ? 'var(--gold)' : 'var(--green)',
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="chart-insight-card">
      <div class="ci-label">${c.label}</div>
      <div class="ci-value" style="color:${c.color}">${c.value}</div>
      <div class="ci-sub">${c.sub}</div>
    </div>`).join('');
}
