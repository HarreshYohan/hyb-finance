/**
 * js/ui/onboarding.js
 * First-time user setup questionnaire to fuel the financial engine.
 */

import { state } from '../state.js';
import { updateProfile } from '../db.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);

export function checkOnboarding() {
  if (!state.profile) return;
  if (!state.profile.onboarding_completed) {
    const overlay = $('onboardingOverlay');
    if (overlay) overlay.classList.add('open');
  }
}

export async function submitOnboarding(onCompleteCallback) {
  const incomeInput  = $('ob-income');
  const savRateInput = $('ob-savrate');
  const investInput  = $('ob-invest');

  const income      = Number(incomeInput.value);
  const savRate     = Number(savRateInput.value);
  const investEnabled = investInput ? investInput.checked : true;

  if (!income || income <= 0) {
    toast('Please enter your estimated monthly income to continue.', 'warning');
    return;
  }
  if (savRate < 0 || savRate > 100) {
    toast('Savings target must be between 0 and 100%.', 'warning');
    return;
  }

  const btn = $('ob-submit');
  btn.textContent = 'Building your plan…';
  btn.disabled = true;

  // Only send columns that are guaranteed to exist.
  // investment_enabled requires running the latest schema migration.
  // We try to include it and fall back gracefully if the column is missing.
  const coreUpdates = {
    estimated_income:     income,
    target_savings_rate:  savRate,
    onboarding_completed: true,
  };

  let { error } = await updateProfile({ ...coreUpdates, investment_enabled: investEnabled });

  if (error) {
    // Column may not exist yet on older deployments — retry without it
    if (error.message && error.message.includes('investment_enabled')) {
      const retry = await updateProfile(coreUpdates);
      error = retry.error;
    }
  }

  if (error) {
    toast('Failed to save. Please check your connection and try again.', 'error');
    btn.textContent = 'Start My Plan';
    btn.disabled = false;
    return;
  }

  // Update local state instantly — investment_enabled lives in state even if not in DB yet
  Object.assign(state.profile, coreUpdates, { investment_enabled: investEnabled });

  import('../cache.js').then(c => c.updateCache(state)).catch(() => {});

  $('onboardingOverlay').classList.remove('open');
  toast('Welcome to Centa! Your financial engine is ready.', 'success');

  if (onCompleteCallback) onCompleteCallback();
}
