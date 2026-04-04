/**
 * js/utils.js
 * Pure, side-effect-free utility functions.
 * No DOM access. No imports from other app modules.
 */

import { CURRENCY, MONTH_LABELS } from './constants.js';

/** Compact unique ID */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Today's date string YYYY-MM-DD */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Current month string YYYY-MM */
export function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

/** Parse YYYY-MM to { year, month } numbers */
export function parseYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

/** Human-readable month label: "Apr 2026" */
export function monthLabel(ym) {
  const { year, month } = parseYM(ym);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/** Short readable date: "Fri, 4 Apr" */
export function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** Long readable date: "Fri, 4 Apr 2026" */
export function fmtDateLong(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Format a number as "LKR 12,000" */
export function fmtCurrency(n) {
  return `${CURRENCY} ${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** Compact format: "LKR 1.2M", "LKR 430k", "LKR 800" */
export function fmtShort(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${CURRENCY} ${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${CURRENCY} ${(a / 1_000).toFixed(0)}k`;
  return `${CURRENCY} ${Math.round(a)}`;
}

/** Returns ISO date strings Mon–Sun for the current week */
export function getCurrentWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay() || 7; // Mon = 1
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Days until a deadline date (negative = overdue) */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date();
  return Math.ceil(diff / 86_400_000);
}

/** Months until a date */
export function monthsUntil(dateStr) {
  if (!dateStr) return null;
  return Math.max(1, Math.ceil(daysUntil(dateStr) / 30));
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Percentage, clamped 0–100 */
export function pct(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}
