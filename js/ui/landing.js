/**
 * js/ui/landing.js
 * Logic for the Landing Page / Hero Section
 */

const $ = id => document.getElementById(id);

export function showLandingPage() {
  const lp = $('landingPage');
  if (lp) {
    lp.style.display = 'flex';
    lp.classList.add('open');
  }
  
  // Animate mock bars if visible
  setTimeout(() => {
    const bars = document.querySelectorAll('.l-mock-bar');
    bars.forEach((bar, i) => {
      const h = bar.style.height;
      bar.style.height = '0';
      setTimeout(() => bar.style.height = h, i * 100);
    });
  }, 500);
}

export function hideLandingPage() {
  const lp = $('landingPage');
  if (lp) lp.style.display = 'none';
}

export function getStarted() {
  hideLandingPage();
  const ap = $('authPage');
  if (ap) ap.style.display = 'flex';
}

export function learnMore() {
  window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
}

// Global bridge
window.Landing = {
  getStarted: () => {
    hideLandingPage();
    $('authPage').style.display = 'flex';
  },
  learnMore: () => {
    // Current landing page is one screen, but we could add more sections
    document.querySelector('.l-stats-grid')?.scrollIntoView({ behavior: 'smooth' });
  }
};
