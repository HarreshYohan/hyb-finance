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
  // If user hasn't completed onboarding, show the modal
  if (!state.profile.onboarding_completed) {
    const overlay = $('onboardingOverlay');
    if (overlay) overlay.classList.add('open');
  }
}

export async function submitOnboarding(onCompleteCallback) {
  const incomeInput = $('ob-income');
  const savRateInput = $('ob-savrate');
  
  const income = Number(incomeInput.value);
  const savRate = Number(savRateInput.value);

  if (!income || income <= 0) {
    toast('Please enter your estimated monthly income to continue.');
    return;
  }

  if (savRate < 0 || savRate > 100) {
    toast('Savings target must be between 0 and 100%.');
    return;
  }

  const btn = $('ob-submit');
  btn.textContent = 'Building your plan…';
  btn.disabled = true;

  const updates = {
    estimated_income: income,
    target_savings_rate: savRate,
    onboarding_completed: true
  };

  const { error } = await updateProfile(updates);

  if (error) {
    toast('Failed to save. Please check your connection and try again.');
    btn.textContent = 'Start My Plan';
    btn.disabled = false;
    return;
  }

  // Update local state instantly
  Object.assign(state.profile, updates);
  
  $('onboardingOverlay').classList.remove('open');
  toast('Welcome to Centa! Your financial engine is ready.');
  
  if (onCompleteCallback) onCompleteCallback();
}
