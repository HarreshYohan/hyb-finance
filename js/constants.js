/**
 * js/constants.js
 * All static application data — categories, colors, default limits.
 * No logic here. Never import from other app modules.
 * Designed to be globally applicable for any personal finance user.
 */

export const CURRENCY = window.APP_CONFIG?.app?.defaultCurrency ?? 'LKR';

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Consulting',
  'Business',
  'Investment',
  'Rental Income',
  'Bonus',
  'Side Income',
  'Gift',
  'Other Income',
];

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Housing & Rent',
  'Transport',
  'Utilities',
  'Health & Medical',
  'Groceries',
  'Entertainment',
  'Clothing & Shopping',
  'Education',
  'Subscriptions',
  'Debt Payment',
  'Insurance',
  'Personal Care',
  'Travel',
  'Charity',
  'Other',
];

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const CATEGORY_COLOR = Object.freeze({
  // Income
  'Salary':          '#1A7F4E',
  'Freelance':       '#1A5FA8',
  'Consulting':      '#6B3DB8',
  'Business':        '#B8860B',
  'Investment':      '#1A7F4E',
  'Rental Income':   '#6B3DB8',
  'Bonus':           '#B8860B',
  'Side Income':     '#1A5FA8',
  'Gift':            '#B8860B',
  'Other Income':    '#5C5A55',
  // Expense
  'Food & Dining':   '#C0392B',
  'Housing & Rent':  '#A93226',
  'Transport':       '#B8860B',
  'Utilities':       '#1A5FA8',
  'Health & Medical':'#1A7F4E',
  'Groceries':       '#C0392B',
  'Entertainment':   '#C05A00',
  'Clothing & Shopping': '#6B3DB8',
  'Education':       '#1A5FA8',
  'Subscriptions':   '#8E4EC6',
  'Debt Payment':    '#C0392B',
  'Insurance':       '#5C5A55',
  'Personal Care':   '#B8860B',
  'Travel':          '#1A5FA8',
  'Charity':         '#1A7F4E',
  'Other':           '#5C5A55',
});

// Default budget limits are intentionally 0 — each user sets their own.
// This prevents any hardcoded cultural or income bias.
export const DEFAULT_BUDGET_LIMITS = Object.freeze(
  Object.fromEntries(EXPENSE_CATEGORIES.map(cat => [cat, 0]))
);

export const DEBT_CATEGORIES = [
  'Personal Loan',
  'Business Loan',
  'Credit Card',
  'Mortgage',
  'Family',
  'Friend',
  'Client Payment',
  'Other',
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
  FREE_MAX_TRANSACTIONS_PER_MONTH: 50,
  FREE_MAX_GOALS: 3,
  FREE_MAX_DEBTS: 5,
});
