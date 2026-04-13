/**
 * js/app.js — Main orchestrator
 */
import { initApp, handleAuth, signOut } from './auth.js';
import { state, allMonths, getViewMonth, isOwner } from './state.js';
import { monthLabel, fmtDate, fmtCurrency, todayStr } from './utils.js';
import { CATEGORY_COLOR } from './constants.js';
import { updateCache } from './cache.js';
import { renderKPIs, renderWeekGoalBar } from './ui/kpi.js';
import { renderToday }  from './ui/today.js';
import { renderBudget, saveLimit } from './ui/budget.js';
import { renderDebts, settleDebt, partialPay, deleteDebt, toggleHistory as toggleDebtHistory } from './ui/debts.js';
import { renderGoals, depositGoal, deleteGoal } from './ui/goals.js';
import { buildCharts } from './charts.js';
import { renderPlan }  from './ui/plan.js';
import { renderHealth } from './ui/health.js';
import { toast } from './ui/toast.js';
import {
  openTxModal, closeTxModal, setTxType, saveTx, deleteTx,
  showAutocomplete, pickAC,
  openDebtModal, closeDebtModal, setDebtDir, saveDebt,
  openGoalModal, closeGoalModal, saveGoal,
} from './ui/modals.js';
import { openSettings, closeSettings, addCat, removeCat, saveName, saveFinancialProfile, addFixedExpense, removeFixedExpense } from './ui/settings.js';
import { checkOnboarding, submitOnboarding } from './ui/onboarding.js';

initApp(render);

export function render() {
  _updateHeader();
  _initMonthSel();
  renderKPIs();
  renderWeekGoalBar();
  renderToday();
  renderBudget();
  renderDebts();
  renderGoals();
  _checkReminder();
  _applyOwnerMode();
  checkOnboarding();

  // Re-render active dynamic tabs so background sync / cache updates reflect immediately
  if (document.getElementById('tab-log')?.classList.contains('active')) {
    _populateLogFilters();
    _renderLog();
  }
  if (document.getElementById('tab-charts')?.classList.contains('active')) {
    buildCharts();
  }
  if (document.getElementById('tab-plan')?.classList.contains('active')) {
    renderPlan();
  }

  // Save the current state to the local cache so refreshing the page instantly loads mutations
  updateCache(state);
}

function _updateHeader() {
  const el = document.getElementById('todayLabel');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  // Display name in header
  const dn = document.getElementById('headerDisplayName');
  if (dn) {
    const name = state.profile?.display_name || state.profile?.email?.split('@')[0] || '';
    dn.textContent = name;
  }
}

function _applyOwnerMode() {
  const badge = document.getElementById('ownerBadge');
  if (badge) badge.style.display = isOwner() ? 'inline-flex' : 'none';
}

function _initMonthSel() {
  const sel = document.getElementById('monthSel');
  const cur = getViewMonth();
  sel.innerHTML = allMonths().slice(-6).map(m =>
    `<option value="${m}"${m === cur ? ' selected' : ''}>${monthLabel(m)}</option>`
  ).join('');
}

function _checkReminder() {
  const today = todayStr();
  if (state.reminderOff === today) return;
  const has = state.tx.some(t => t.date === today);
  const b   = document.getElementById('reminderBanner');
  if (!has) {
    const h = new Date().getHours();
    document.getElementById('reminderMsg').textContent =
      h < 12 ? "Morning check-in — record today's transactions."
      : h < 18 ? "Afternoon reminder — log today's transactions."
      : "End of day — have you recorded everything?";
    b?.classList.add('show');
  } else b?.classList.remove('show');
}

function _renderLog() {
  const type  = document.getElementById('fType')?.value  ?? 'all';
  const cat   = document.getElementById('fCat')?.value   ?? 'all';
  const month = document.getElementById('fMonth')?.value ?? 'all';
  const q     = (document.getElementById('fSearch')?.value ?? '').toLowerCase();
  let txs = [...state.tx];
  if (type  !== 'all') txs = txs.filter(t => t.type === type);
  if (cat   !== 'all') txs = txs.filter(t => t.category === cat);
  if (month !== 'all') txs = txs.filter(t => t.date.slice(0,7) === month);
  if (q) txs = txs.filter(t =>
    t.desc.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)
  );
  txs.sort((a,b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  document.getElementById('logSub').textContent = txs.length + ' transactions';
  const el = document.getElementById('logList');
  if (!txs.length) { el.innerHTML = `<div class="empty"><div class="empty-ico">🔍</div><div class="empty-txt">No transactions found.</div></div>`; return; }
  const groups = {};
  txs.forEach(t => { (groups[t.date] ??= []).push(t); });
  el.innerHTML = Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(d => {
    const g = groups[d];
    const net = g.reduce((a,t) => a + (t.type==='income' ? +t.amount : -t.amount), 0);
    return `<div class="day-group">
      <div class="day-header"><span class="day-lbl">${fmtDate(d)}</span><div class="day-line"></div><span class="day-net" style="color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${fmtCurrency(net)}</span></div>
      <table class="tx-table"><tbody>${g.sort((a,b)=>b.ts-a.ts).map(t => {
        const ic = t.type==='income';
        const cc = CATEGORY_COLOR[t.category] ?? '#5C5A55';
        return `<tr>
          <td><span class="cat-pill" style="background:${cc}18;color:${cc}">${t.category}</span></td>
          <td style="font-weight:500">${t.desc}</td>
          <td style="color:var(--text3);font-size:12px">${t.note??'—'}</td>
          <td class="${ic?'amount-in':'amount-out'}">${ic?'+':'-'}${fmtCurrency(t.amount)}</td>
          <td><div class="row-btns"><button class="row-btn" onclick="App.editTx('${t.id}')">Edit</button><button class="row-btn danger" onclick="App.delTx('${t.id}')">Del</button></div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }).join('');
}

function _populateLogFilters() {
  const months = allMonths();
  const fM = document.getElementById('fMonth');
  const sv = fM.value;
  fM.innerHTML = '<option value="all">All months</option>' +
    months.map(m => `<option value="${m}"${m===sv?' selected':''}>${monthLabel(m)}</option>`).join('');
  const cats = [...new Set(state.tx.map(t => t.category))].sort();
  const fC = document.getElementById('fCat');
  const sc = fC.value;
  fC.innerHTML = '<option value="all">All categories</option>' +
    cats.map(c => `<option value="${c}"${c===sc?' selected':''}>${c}</option>`).join('');
}

// ── Global bridges ─────────────────────────────────────────────────────────────

window.App = {
  render,
  editTx:   id => openTxModal(id),
  delTx:    id => deleteTx(id, render),
  editDebt: id => openDebtModal(id),
  editGoal: id => openGoalModal(id),
  signOut:  () => signOut(),
  changeMonth: () => { state.viewMonth = document.getElementById('monthSel').value; render(); },
  showTab: (id, _el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    // Deactivate both top tabs and bottom nav items
    document.querySelectorAll('.tab, .bnav-item').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+id)?.classList.add('active');
    // Activate all nav elements with matching data-tab (top + bottom)
    document.querySelectorAll(`[data-tab="${id}"]`).forEach(t => t.classList.add('active'));
    if (id === 'charts') buildCharts();
    if (id === 'plan')   renderPlan();
    if (id === 'health') renderHealth();
    if (id === 'log') { _populateLogFilters(); _renderLog(); }
  },
  renderLog: _renderLog,
  dismissReminder: () => {
    state.reminderOff = todayStr();
    document.getElementById('reminderBanner')?.classList.remove('show');
  },
  upgradePlan: (plan) => {
    const email = state.profile?.email ?? '';
    const cfg   = window.APP_CONFIG?.stripe;
    const link  = plan === 'pro' ? cfg?.proLink : cfg?.lifetimeLink;
    if (!link) {
      toast('Payment not configured yet — set up Stripe links in config.js');
      return;
    }
    window.open(`${link}?prefilled_email=${encodeURIComponent(email)}`, '_blank');
  },
};

window.Modals = {
  openTx: () => openTxModal(), closeTx: closeTxModal, setTxType,
  saveTx: () => saveTx(render), showAC: showAutocomplete, pickAC,
  openDebt: () => openDebtModal(), closeDebt: closeDebtModal, setDebtDir,
  saveDebt: () => saveDebt(render),
  openGoal: () => openGoalModal(), closeGoal: closeGoalModal,
  saveGoal: () => saveGoal(render),
};

window.Budget = { saveLimit };

// Debts & Goals already call window.App.render() internally after each action,
// but we keep these bridges for any external callers.
window.Debts = {
  settle:        id => settleDebt(id),
  partial:       id => partialPay(id),
  del:           id => deleteDebt(id),
  toggleHistory: id => toggleDebtHistory(id),
};

window.Goals = {
  deposit: id => depositGoal(id),
  del:     id => deleteGoal(id),
};

window.Auth = { handleAuth };

window.Settings = {
  open:                openSettings,
  close:               closeSettings,
  addCat,
  removeCat,
  saveName,
  saveFinancialProfile,
  addFixedExpense,
  removeFixedExpense,
};

window.Onboarding = {
  submit: () => submitOnboarding(render)
};

['txOverlay','debtOverlay','goalOverlay','settingsOverlay'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('.field-wrap')) document.getElementById('acList').style.display = 'none';
});

// Force calendar-only date picking — block manual keyboard entry on all date inputs
document.addEventListener('keydown', e => {
  if (e.target.type === 'date') {
    // Allow: Tab, Shift+Tab, Escape, F-keys (for screen readers & accessibility)
    const allowed = ['Tab', 'Escape', 'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
    if (!allowed.includes(e.key)) e.preventDefault();
  }
}, true);

setInterval(_checkReminder, 60_000);
