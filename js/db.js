/**
 * js/db.js
 * All Supabase database operations. Single place for every read/write.
 * Returns { data, error } — callers handle errors, never throws.
 */

import { state } from './state.js';

const { url, anonKey } = window.APP_CONFIG.supabase;
export const db = window.supabase.createClient(url, anonKey);

// ── Sync (read all user data into state) ──────────────────────────────────────

export async function syncAll() {
  const userId = state.profile?.id;
  if (!userId) return;

  const [txRes, debtsRes, goalsRes, budRes, recRes] = await Promise.all([
    db.from('transactions').select('*').order('date', { ascending: false }),
    db.from('debts').select('*').order('created_at', { ascending: false }),
    db.from('goals').select('*').order('created_at', { ascending: false }),
    db.from('budgets').select('*'),
    db.from('recurring_transactions').select('*').eq('active', true),
  ]);

  state.tx = (txRes.data ?? []).map(mapTx);
  state.debts = (debtsRes.data ?? []).map(mapDebt);
  state.goals = (goalsRes.data ?? []).map(mapGoal);
  state.recurring = (recRes.data ?? []).map(mapRecurring);

  state.budgets = {};
  (budRes.data ?? []).forEach(b => {
    state.budgets[b.category] = Number(b.limit_amount);
  });
}

export async function fetchProfile() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  let { data } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (!data) {
    // Profile should have been auto-created by trigger, but just in case:
    const { data: created } = await db.from('profiles').upsert({ id: user.id }).select().single();
    data = created;
  }
  state.profile = { ...data, email: user.email };
  return data;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function upsertTransaction(entry) {
  const { data, error } = await db.from('transactions').upsert({
    id:        entry.id,
    user_id:   state.profile.id,
    desc_text: entry.desc,
    amount:    entry.amount,
    type:      entry.type,
    date:      entry.date,
    category:  entry.category,
    note:      entry.note ?? null,
    tags:      entry.tags ?? [],
  });
  return { data, error };
}

export async function deleteTransaction(id) {
  return db.from('transactions').delete().eq('id', id);
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function upsertDebt(entry) {
  const { data, error } = await db.from('debts').upsert({
    id:        entry.id,
    user_id:   state.profile.id,
    name:      entry.name,
    desc_text: entry.desc ?? null,
    amount:    entry.amount,
    paid:      entry.paid,
    dir:       entry.dir,
    category:  entry.category ?? null,
    due:       entry.due ?? null,
  });
  return { data, error };
}

export async function updateDebtPaid(id, paid) {
  return db.from('debts').update({ paid }).eq('id', id);
}

export async function deleteDebt(id) {
  return db.from('debts').delete().eq('id', id);
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function upsertGoal(entry) {
  const { data, error } = await db.from('goals').upsert({
    id:       entry.id,
    user_id:  state.profile.id,
    name:     entry.name,
    target:   entry.target,
    saved:    entry.saved,
    color:    entry.color ?? '#1A7F4E',
    deadline: entry.deadline ?? null,
    note:     entry.note ?? null,
  });
  return { data, error };
}

export async function updateGoalSaved(id, saved) {
  return db.from('goals').update({ saved }).eq('id', id);
}

export async function deleteGoal(id) {
  return db.from('goals').delete().eq('id', id);
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function upsertBudget(category, limit_amount) {
  return db.from('budgets').upsert(
    { user_id: state.profile.id, category, limit_amount },
    { onConflict: 'user_id, category' }
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function updateProfile(updates) {
  return db.from('profiles').update(updates).eq('id', state.profile.id);
}

// ── Row mappers (DB shape → app shape) ───────────────────────────────────────

function mapTx(t) {
  return {
    id:       t.id,
    desc:     t.desc_text,
    amount:   Number(t.amount),
    type:     t.type,
    date:     t.date,
    category: t.category,
    note:     t.note,
    tags:     t.tags ?? [],
    ts:       new Date(t.created_at).getTime(),
  };
}

function mapDebt(d) {
  return {
    id:       d.id,
    name:     d.name,
    desc:     d.desc_text,
    amount:   Number(d.amount),
    paid:     Number(d.paid),
    dir:      d.dir,
    category: d.category,
    due:      d.due,
    ts:       new Date(d.created_at).getTime(),
  };
}

function mapGoal(g) {
  return {
    id:       g.id,
    name:     g.name,
    note:     g.note,
    target:   Number(g.target),
    saved:    Number(g.saved),
    color:    g.color ?? '#1A7F4E',
    deadline: g.deadline,
  };
}

function mapRecurring(r) {
  return {
    id:        r.id,
    desc:      r.desc_text,
    amount:    Number(r.amount),
    type:      r.type,
    category:  r.category,
    frequency: r.frequency,
    nextDue:   r.next_due,
    active:    r.active,
    note:      r.note,
  };
}
