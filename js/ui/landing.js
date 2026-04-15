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

  initScrollAnimations();
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  initFeatureSwiper();
}

function initFeatureSwiper() {
  const swiper = $('featureSwiper');
  const dots = document.querySelectorAll('.l-dot');
  if (!swiper || !dots.length) return;

  swiper.addEventListener('scroll', () => {
    const slideWidth = swiper.querySelector('.l-feature-card').offsetWidth + 24;
    const scrollPos = swiper.scrollLeft;
    const index = Math.round(scrollPos / slideWidth);

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  });

  // Dot clicking
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index);
      const slideWidth = swiper.querySelector('.l-feature-card').offsetWidth + 24;
      swiper.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
    });
  });
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
    document.querySelector('.l-why-section')?.scrollIntoView({ behavior: 'smooth' });
  }
};
