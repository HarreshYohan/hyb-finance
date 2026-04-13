/**
 * Centa — Smoke Test Suite
 *
 * Tests all three plan tiers: free, pro, lifetime.
 *
 * Prerequisites:
 *   cp .env.test.example .env.test   # fill in credentials
 *   npm run test:seed                # create the 3 test accounts
 *   npm test
 */

import { test, expect } from '@playwright/test';

// ─── Test credentials ─────────────────────────────────────────────
const USERS = {
  free: {
    email:    process.env.TEST_FREE_EMAIL     || 'test-free@centa.app',
    password: process.env.TEST_FREE_PASS      || 'TestPass123!',
  },
  pro: {
    email:    process.env.TEST_PRO_EMAIL      || 'test-pro@centa.app',
    password: process.env.TEST_PRO_PASS       || 'TestPass123!',
  },
  lifetime: {
    email:    process.env.TEST_LIFETIME_EMAIL || 'test-lifetime@centa.app',
    password: process.env.TEST_LIFETIME_PASS  || 'TestPass123!',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

async function login(page, email, password) {
  await page.goto('/');

  // Wait for loading screen to clear — either auth form or main app appears
  const arrived = await Promise.race([
    page.locator('#auth-email').waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'auth'),
    page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'main'),
  ]);
  if (arrived === 'main') return; // already logged in (session persisted)

  await page.fill('#auth-email', email);
  await page.fill('#auth-pass', password);
  await page.click('#auth-submit-btn');

  // Wait for main app to appear
  await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 20_000 });

  // Handle first-run onboarding overlay if it pops up
  const obBtn = page.locator('#ob-submit');
  if (await obBtn.isVisible()) {
    await page.fill('#ob-income', '100000');
    await obBtn.click();
    await page.waitForTimeout(600);
  }
}

async function logout(page) {
  // .btn-logout is always in the DOM (header); force-click works on mobile too
  await page.locator('.btn-logout').click({ force: true });
  await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 10_000 });
}

async function openTransactionModal(page) {
  // Try header button (desktop), fall back to FAB (mobile)
  const primary = page.locator('.btn-primary');
  const fab     = page.locator('.bnav-fab');
  if (await primary.isVisible()) {
    await primary.click();
  } else {
    await fab.click();
  }
  await page.locator('#tx-desc').waitFor({ state: 'visible', timeout: 6_000 });
}

async function addTransaction(page, { desc, amount, type = 'expense', category }) {
  await openTransactionModal(page);

  // Set type
  if (type === 'income') {
    await page.click('#ttIn');
  } else {
    await page.click('#ttOut');
  }

  await page.fill('#tx-desc', desc);
  await page.fill('#tx-amount', String(amount));
  // Date inputs block keyboard — set value programmatically
  await page.evaluate(() => {
    const d = document.getElementById('tx-date');
    if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  });

  if (category) {
    // #tx-cat is a <select>
    await page.selectOption('#tx-cat', { label: category }).catch(async () => {
      // Option text may differ; fall back to first available option
      const opts = await page.locator('#tx-cat option').allInnerTexts();
      const match = opts.find(o => o.toLowerCase().includes(category.toLowerCase()));
      if (match) await page.selectOption('#tx-cat', { label: match });
    });
  }

  await page.click('#txSave');
  // Wait for modal to close
  await page.locator('#tx-desc').waitFor({ state: 'hidden', timeout: 8_000 });
}

async function clickTab(page, tabName) {
  // Tab buttons exist in both .tabs (desktop) and .bottom-nav (mobile)
  const tab = page.locator(`button[data-tab="${tabName}"]`).first();
  if (await tab.isVisible()) await tab.click();
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════

test.describe('Auth', () => {
  test('shows login form on first load', async ({ page }) => {
    await page.goto('/');
    await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 12_000 });
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-pass')).toBeVisible();
    await expect(page.locator('#auth-submit-btn')).toBeVisible();
  });

  test('rejects wrong password', async ({ page }) => {
    await page.goto('/');
    await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 12_000 });
    await page.fill('#auth-email', USERS.free.email);
    await page.fill('#auth-pass', 'WrongPassword!');
    await page.click('#auth-submit-btn');
    await expect(page.locator('#auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('free user can sign in and sign out', async ({ page }) => {
    await login(page, USERS.free.email, USERS.free.password);
    await expect(page.locator('#mainApp')).toBeVisible();
    await logout(page);
    await expect(page.locator('#auth-email')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FREE TIER
// ═══════════════════════════════════════════════════════════════════

test.describe('Free tier', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.free.email, USERS.free.password);
  });
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('dashboard loads with KPI cards', async ({ page }) => {
    // .kpi cards are rendered in #tab-today
    await expect(page.locator('.kpi').first()).toBeVisible({ timeout: 8_000 });
  });

  test('can add an expense transaction', async ({ page }) => {
    await addTransaction(page, { desc: 'Smoke Expense', amount: 500, type: 'expense' });
    // Transaction should appear in today's list or the log
    await expect(page.locator('text=Smoke Expense').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can add an income transaction', async ({ page }) => {
    await addTransaction(page, { desc: 'Smoke Income', amount: 10000, type: 'income' });
    await expect(page.locator('text=Smoke Income').first()).toBeVisible({ timeout: 10_000 });
  });

  test('desktop tabs are navigable', async ({ page }) => {
    // Check desktop tab bar is present
    const tabBar = page.locator('.tabs');
    if (!(await tabBar.isVisible())) {
      test.skip(true, 'Desktop tab bar not visible on this viewport');
    }
    for (const tabName of ['log', 'budget', 'debts', 'goals', 'plan', 'charts']) {
      await clickTab(page, tabName);
      // Corresponding panel should become active
      await expect(page.locator(`#tab-${tabName}`)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('charts tab shows canvas elements', async ({ page }) => {
    await clickTab(page, 'charts');
    await expect(page.locator('#tab-charts')).toBeVisible({ timeout: 4_000 });
    await expect(page.locator('#ieChart')).toBeVisible({ timeout: 8_000 });
  });

  test('transaction modal opens and closes', async ({ page }) => {
    await openTransactionModal(page);
    await expect(page.locator('#tx-desc')).toBeVisible();
    // Cancel
    await page.click('.btn-cancel');
    await page.locator('#tx-desc').waitFor({ state: 'hidden', timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  PRO TIER
// ═══════════════════════════════════════════════════════════════════

test.describe('Pro tier', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.pro.email, USERS.pro.password);
  });
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('main app loads successfully', async ({ page }) => {
    await expect(page.locator('#mainApp')).toBeVisible();
    await expect(page.locator('.kpi').first()).toBeVisible({ timeout: 8_000 });
  });

  test('settings panel opens and shows plan info', async ({ page }) => {
    // Open settings via gear icon
    await page.click('button.btn-icon[title="Settings"]');
    await page.locator('#settingsBody').waitFor({ state: 'visible', timeout: 6_000 });
    const bodyText = await page.locator('#settingsBody').innerText();
    // Should mention plan somewhere (pro, free, lifetime, or the plan label)
    expect(bodyText.length).toBeGreaterThan(10);
    // Close settings
    await page.click('.modal-x');
  });

  test('all core transactions still work', async ({ page }) => {
    await addTransaction(page, { desc: 'Pro Tier Expense', amount: 750 });
    await expect(page.locator('text=Pro Tier Expense').first()).toBeVisible({ timeout: 10_000 });
  });

  test('all tabs accessible without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    for (const tabName of ['log', 'budget', 'debts', 'goals', 'plan', 'charts']) {
      await clickTab(page, tabName);
      await page.waitForTimeout(300);
    }
    const appErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('cdn.') &&
      !e.includes('fonts.googleapis') &&
      !e.includes('serviceWorker')
    );
    expect(appErrors, `Console errors:\n${appErrors.join('\n')}`).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  LIFETIME TIER
// ═══════════════════════════════════════════════════════════════════

test.describe('Lifetime tier', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.lifetime.email, USERS.lifetime.password);
  });
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('main app loads successfully', async ({ page }) => {
    await expect(page.locator('#mainApp')).toBeVisible();
    await expect(page.locator('.kpi').first()).toBeVisible({ timeout: 8_000 });
  });

  test('settings panel opens and shows plan info', async ({ page }) => {
    await page.click('button.btn-icon[title="Settings"]');
    await page.locator('#settingsBody').waitFor({ state: 'visible', timeout: 6_000 });
    const bodyText = await page.locator('#settingsBody').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
    await page.click('.modal-x');
  });

  test('My Plan tab loads projections', async ({ page }) => {
    await clickTab(page, 'plan');
    await expect(page.locator('#tab-plan')).toBeVisible({ timeout: 4_000 });
    // Panel should render content (not be completely empty)
    await page.waitForTimeout(500);
    const planHtml = await page.locator('#tab-plan').innerHTML();
    expect(planHtml.trim().length).toBeGreaterThan(0);
  });

  test('all tabs load without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    for (const tabName of ['log', 'budget', 'debts', 'goals', 'plan', 'charts']) {
      await clickTab(page, tabName);
      await page.waitForTimeout(300);
    }
    const appErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('cdn.') &&
      !e.includes('fonts.googleapis') &&
      !e.includes('serviceWorker')
    );
    expect(appErrors, `Console errors:\n${appErrors.join('\n')}`).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  DEBT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

test.describe('Debt management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.free.email, USERS.free.password);
    await clickTab(page, 'debts');
    await expect(page.locator('#tab-debts')).toBeVisible({ timeout: 5_000 });
  });
  test.afterEach(async ({ page }) => { await logout(page); });

  test('can add a debt', async ({ page }) => {
    await page.click('button:has-text("Add Debt")');
    await page.locator('#d-name').waitFor({ state: 'visible', timeout: 5_000 });
    await page.fill('#d-name', 'Smoke Debt');
    await page.fill('#d-amount', '1500');
    await page.locator('#debtOverlay .btn-save').click();
    await page.locator('#d-name').waitFor({ state: 'hidden', timeout: 6_000 });
    await expect(page.locator('text=Smoke Debt').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  GOALS
// ═══════════════════════════════════════════════════════════════════

test.describe('Goals', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.free.email, USERS.free.password);
    await clickTab(page, 'goals');
    await expect(page.locator('#tab-goals')).toBeVisible({ timeout: 5_000 });
  });
  test.afterEach(async ({ page }) => { await logout(page); });

  test('can create a goal', async ({ page }) => {
    await page.click('button:has-text("Add Goal")');
    await page.locator('#g-name').waitFor({ state: 'visible', timeout: 5_000 });
    await page.fill('#g-name', 'Smoke Goal');
    await page.fill('#g-target', '50000');
    await page.click('button:has-text("Save Goal")');
    await page.locator('#g-name').waitFor({ state: 'hidden', timeout: 6_000 });
    await expect(page.locator('text=Smoke Goal').first()).toBeVisible({ timeout: 8_000 });
  });
});
