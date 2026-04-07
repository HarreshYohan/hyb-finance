/**
 * config.example.js
 *
 * Copy this file to `config.js` and fill in your real values.
 * config.js is in .gitignore — NEVER commit real credentials.
 */
window.APP_CONFIG = {
  supabase: {
    url:     'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  },
  app: {
    name: 'Centa',
    version: '1.0.0',
    defaultCurrency: 'LKR',
  },
  /**
   * Owner mode — set this to YOUR login email.
   * When signed in with this email, all premium features are unlocked
   * permanently with no subscription needed.
   */
  owner: {
    email: '', // e.g. 'you@example.com'
  },
  /**
   * Stripe payment links — create Payment Links in your Stripe Dashboard.
   * Users who purchase are redirected back and their plan is updated in
   * Supabase via a webhook → Edge Function (see docs/stripe-setup.md).
   */
  stripe: {
    proLink:      '', // Stripe Payment Link URL for Pro plan (LKR 490/mo)
    lifetimeLink: '', // Stripe Payment Link URL for Lifetime plan (LKR 3,990)
  },
};
