/**
 * js/state.js
 * Single source of truth for all in-memory application state.
 * Data flows: DB → state → UI. Never: UI → state without going through db.js.
 */

/** @type {AppState} */
export const state = {
  tx:          [],   // Transaction[]
  debts:       [],   // Debt[]
  goals:       [],   // Goal[]
  budgets:     {},   // { [category: string]: number }
  recurring:   [],   // RecurringTransaction[]
  profile:     null, // Profile | null
  viewMonth:   '',   // YYYY-MM — currently viewed month ('' = current)
  reminderOff: '',   // YYYY-MM-DD — user dismissed reminder for this day
};

/** Reset state to blank (e.g. on sign out) */
export function resetState() {
  state.tx          = [];
  state.debts       = [];
  state.goals       = [];
  state.budgets     = {};
  state.recurring   = [];
  state.profile     = null;
  state.viewMonth   = '';
  state.reminderOff = '';
}

// ── Computed helpers ─────────────────────────────────────────────────────────

import { currentMonthStr } from './utils.js';

/** Active view month (YYYY-MM), falls back to current month */
export function getViewMonth() {
  return state.viewMonth || currentMonthStr();
}

/** Transactions for a given YYYY-MM */
export function txByMonth(ym) {
  return state.tx.filter(t => t.date.slice(0, 7) === ym);
}

/** Transactions for a specific YYYY-MM-DD */
export function txByDate(d) {
  return state.tx.filter(t => t.date === d);
}

/** Sum income from a transaction array */
export function sumInc(txs) {
  return txs.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
}

/** Sum expenses from a transaction array */
export function sumExp(txs) {
  return txs.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);
}

/** Total outstanding "I owe" amount */
export function totalIOwe() {
  return state.debts
    .filter(d => d.dir === 'owe')
    .reduce((a, d) => a + Math.max(0, Number(d.amount) - Number(d.paid)), 0);
}

/** Total outstanding "owed to me" amount */
export function totalOwedToMe() {
  return state.debts
    .filter(d => d.dir === 'owed')
    .reduce((a, d) => a + Math.max(0, Number(d.amount) - Number(d.paid)), 0);
}

/** Effective budget limit for a category */
export function getBudgetLimit(category) {
  const { DEFAULT_BUDGET_LIMITS } = await import('./constants.js').then(m => m);
  return state.budgets[category] ?? DEFAULT_BUDGET_LIMITS[category] ?? 0;
}

/** All unique months present in transactions, plus current month */
export function allMonths() {
  const set = new Set(state.tx.map(t => t.date.slice(0, 7)));
  set.add(currentMonthStr());
  return [...set].sort();
}
