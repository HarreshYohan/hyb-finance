/**
 * js/charts.js
 * All Chart.js chart rendering. Isolated here so the rest of the app
 * never needs to know about chart instances or canvas management.
 */

import { state, getViewMonth, txByMonth, sumInc, sumExp, allMonths } from './state.js';
import { monthLabel } from './utils.js';
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
