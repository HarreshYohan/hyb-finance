/**
 * js/constants.js
 * All static application data — categories, colors, default limits.
 * No logic here. Never import from other app modules.
 */

export const CURRENCY = window.APP_CONFIG?.app?.defaultCurrency ?? 'LKR';

export const INCOME_CATEGORIES = [
  'Salary', 'Tuition', 'HYB Web Dev', 'Consulting', 'Freelance', 'Bonus', 'Other Income',
];

export const EXPENSE_CATEGORIES = [
  'Food', 'Housing', 'Transport', 'Utilities', 'Health',
  'HYB Tools', 'Entertainment', 'Clothing', 'Education', 'Debt Payment', 'Other',
];

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const CATEGORY_COLOR = Object.freeze({
  // Income
  Salary:         '#1A7F4E',
  Tuition:        '#1A7F4E',
  'HYB Web Dev':  '#1A5FA8',
  Consulting:     '#6B3DB8',
  Freelance:      '#B8860B',
  Bonus:          '#B8860B',
  'Other Income': '#5C5A55',
  // Expense
  Food:           '#C0392B',
  Housing:        '#A93226',
  Transport:      '#B8860B',
  Utilities:      '#1A5FA8',
  Health:         '#1A7F4E',
  'HYB Tools':    '#6B3DB8',
  Entertainment:  '#C0392B',
  Clothing:       '#C05A00',
  Education:      '#1A5FA8',
  'Debt Payment': '#C0392B',
  Other:          '#5C5A55',
});

export const DEFAULT_BUDGET_LIMITS = Object.freeze({
  Food:           18000,
  Housing:        30000,
  Transport:       8000,
  Utilities:       4000,
  Health:          4000,
  'HYB Tools':     3000,
  Entertainment:   6000,
  Clothing:        5000,
  Education:       2000,
  'Debt Payment': 10000,
  Other:           5000,
});

export const DEBT_CATEGORIES = [
  'Personal Loan', 'Business', 'Family', 'Friend', 'Client Payment', 'Other',
];

export const RECURRENCE_FREQUENCIES = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
];

export const MONTH_LABELS = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
];

// Plans — used for feature gating
export const PLANS = Object.freeze({
  FREE:     'free',
  PRO:      'pro',
  LIFETIME: 'lifetime',
});

export const PRO_LIMITS = Object.freeze({
  FREE_MAX_TRANSACTIONS_PER_MONTH: 30,
  FREE_MAX_GOALS: 2,
  FREE_MAX_DEBTS: 3,
});
