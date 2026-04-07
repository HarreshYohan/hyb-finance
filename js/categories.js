/**
 * js/categories.js
 * Manages built-in + user-defined categories.
 * Custom additions are persisted to localStorage under 'centa_cats'.
 * Built-in categories are never modifiable or removable.
 */

import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './constants.js';

const KEY = 'centa_cats';

function _load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { income: [], expense: [] };
  } catch {
    return { income: [], expense: [] };
  }
}

function _save(cats) {
  try { localStorage.setItem(KEY, JSON.stringify(cats)); } catch {}
}

/** All income categories (built-in + custom) */
export function getIncomeCategories() {
  const { income } = _load();
  return [...INCOME_CATEGORIES, ...income.filter(c => !INCOME_CATEGORIES.includes(c))];
}

/** All expense categories (built-in + custom) */
export function getExpenseCategories() {
  const { expense } = _load();
  return [...EXPENSE_CATEGORIES, ...expense.filter(c => !EXPENSE_CATEGORIES.includes(c))];
}

/** Both combined */
export function getAllCategories() {
  return [...getIncomeCategories(), ...getExpenseCategories()];
}

/** Returns only the user-added custom categories { income: [], expense: [] } */
export function getCustomCategories() {
  return _load();
}

/**
 * Add a custom category.
 * @returns {boolean} false if it already exists (built-in or custom)
 */
export function addCustomCategory(type, name) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const base = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const cats = _load();
  const arr  = cats[type] ?? [];
  if (base.includes(trimmed) || arr.includes(trimmed)) return false;
  arr.push(trimmed);
  cats[type] = arr;
  _save(cats);
  return true;
}

/** Remove a custom category (no-op if it's a built-in category) */
export function removeCustomCategory(type, name) {
  const base = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (base.includes(name)) return; // protect built-ins
  const cats = _load();
  cats[type] = (cats[type] ?? []).filter(c => c !== name);
  _save(cats);
}
