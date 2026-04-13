/**
 * scripts/create-test-users.js
 *
 * Creates (or resets) the three test accounts used by the Playwright smoke suite.
 * Requires the Supabase SERVICE ROLE key (not the anon key).
 *
 * Usage:
 *   node scripts/create-test-users.js
 *
 * Prerequisites:
 *   npm install @supabase/supabase-js
 *   Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY below or in .env.test
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.test if present ──────────────────────────────────────
try {
  const envPath = resolve(process.cwd(), '.env.test');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...v] = line.trim().split('=');
    if (k && !k.startsWith('#')) process.env[k] = v.join('=');
  }
} catch { /* no .env.test — rely on real env vars */ }

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\n  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    '  Add them to .env.test or export them before running.\n' +
    '  Get the service_role key from:\n' +
    '  Supabase Dashboard → Project Settings → API → service_role\n'
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  {
    email:    process.env.TEST_FREE_EMAIL    || 'test-free@centa.app',
    password: process.env.TEST_FREE_PASS     || 'TestPass123!',
    plan:     'free',
    name:     'Test Free',
  },
  {
    email:    process.env.TEST_PRO_EMAIL     || 'test-pro@centa.app',
    password: process.env.TEST_PRO_PASS      || 'TestPass123!',
    plan:     'pro',
    name:     'Test Pro',
  },
  {
    email:    process.env.TEST_LIFETIME_EMAIL || 'test-lifetime@centa.app',
    password: process.env.TEST_LIFETIME_PASS  || 'TestPass123!',
    plan:     'lifetime',
    name:     'Test Lifetime',
  },
];

async function upsertUser({ email, password, plan, name }) {
  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);

  let userId;

  if (found) {
    // Reset password
    const { error } = await admin.auth.admin.updateUserById(found.id, { password });
    if (error) throw new Error(`Update failed for ${email}: ${error.message}`);
    userId = found.id;
    console.log(`  ✓  Updated   ${email}  (${plan})`);
  } else {
    // Create new
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) throw new Error(`Create failed for ${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`  ✓  Created   ${email}  (${plan})`);
  }

  // Set plan on profile (the handle_new_user trigger creates the row on signup,
  // but for existing DBs we upsert manually)
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      { id: userId, display_name: name, plan, onboarding_completed: true },
      { onConflict: 'id' }
    );

  if (profileErr) throw new Error(`Profile update failed for ${email}: ${profileErr.message}`);
}

console.log('\nCreating Centa test users...\n');

for (const user of TEST_USERS) {
  try {
    await upsertUser(user);
  } catch (err) {
    console.error(`  ✗  ${err.message}`);
  }
}

console.log('\nDone. You can now run:  npm test\n');
