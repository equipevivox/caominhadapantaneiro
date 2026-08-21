const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bootScreen = document.querySelector('[data-boot-screen]');
const bootVideo = document.querySelector('[data-boot-video]');
const bootSkip = document.querySelector('[data-boot-skip]');
let bootFinished = false;
let bootTimeout;

function handleBootKeydown(event) {
  if (event.key === 'Escape') finishBoot();
}

function finishBoot() {
  if (bootFinished) return;
  bootFinished = true;
  window.clearTimeout(bootTimeout);
  bootScreen?.classList.add('is-leaving');
  document.body.classList.remove('boot-active');
  document.removeEventListener('keydown', handleBootKeydown);
  window.setTimeout(() => bootScreen?.remove(), reducedMotion ? 0 : 460);
}

if (!bootScreen || !bootVideo || reducedMotion) {
  finishBoot();
} else {
  const mobileSource = window.matchMedia('(orientation: portrait)').matches;
  bootVideo.src = mobileSource ? bootVideo.dataset.srcMobile : bootVideo.dataset.srcDesktop;
  bootVideo.defaultMuted = true;
  bootVideo.muted = true;

  bootVideo.addEventListener('playing', () => {
    bootScreen.classList.add('is-playing');
    if (bootSkip) bootSkip.disabled = false;
  }, { once: true });
  bootVideo.addEventListener('ended', finishBoot, { once: true });
  bootVideo.addEventListener('error', finishBoot, { once: true });
  bootSkip?.addEventListener('click', finishBoot);

  document.addEventListener('keydown', handleBootKeydown);

  bootTimeout = window.setTimeout(finishBoot, 8500);
  const playback = bootVideo.play();
  playback?.catch(() => window.setTimeout(finishBoot, 350));
}

const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');
const mobileLinks = mobileMenu?.querySelectorAll('a') ?? [];

function setMenu(open) {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  mobileMenu.hidden = !open;
  document.body.classList.toggle('menu-open', open);
}

menuToggle?.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

mobileLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 820) setMenu(false);
});

function syncHeader() {
  header?.classList.toggle('is-scrolled', window.scrollY > 10);
}

syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const revealItems = document.querySelectorAll('.reveal-on-scroll');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}
