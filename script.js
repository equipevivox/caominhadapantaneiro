const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bootScreen = document.querySelector('[data-boot-screen]');
const bootVideo = document.querySelector('[data-boot-video]');
let bootFinished = false;
let bootTimeout;

function finishBoot() {
  if (bootFinished) return;
  bootFinished = true;
  window.clearTimeout(bootTimeout);
  bootScreen?.classList.add('is-leaving');
  document.body.classList.remove('boot-active');
  document.removeEventListener('pointerdown', enableBootAudio);
  document.removeEventListener('keydown', enableBootAudio);
  window.setTimeout(() => bootScreen?.remove(), reducedMotion ? 0 : 460);
}

function enableBootAudio() {
  if (!bootVideo || bootFinished) return;
  bootVideo.muted = false;
  bootVideo.volume = 0.5;
  bootScreen?.classList.remove('needs-audio');
}

if (!bootScreen || !bootVideo || reducedMotion) {
  finishBoot();
} else {
  const mobileSource = window.matchMedia('(orientation: portrait)').matches;
  bootVideo.src = mobileSource ? bootVideo.dataset.srcMobile : bootVideo.dataset.srcDesktop;
  bootVideo.defaultMuted = false;
  bootVideo.muted = false;
  bootVideo.volume = 0.5;

  bootVideo.addEventListener('ended', finishBoot, { once: true });
  bootVideo.addEventListener('error', finishBoot, { once: true });
  document.addEventListener('pointerdown', enableBootAudio, { once: true });
  document.addEventListener('keydown', enableBootAudio, { once: true });

  bootTimeout = window.setTimeout(finishBoot, 8500);
  const playback = bootVideo.play();
  playback?.catch(() => {
    bootVideo.muted = true;
    bootScreen.classList.add('needs-audio');
    bootVideo.play().catch(() => window.setTimeout(finishBoot, 350));
  });
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

const revealItems = document.querySelectorAll('.reveal-on-scroll:not(.timeline-item)');
const timelineItems = document.querySelectorAll('.timeline-item.reveal-on-scroll');
const timeline = document.querySelector('.timeline');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
  timelineItems.forEach((item) => item.classList.add('is-visible'));
  timeline?.style.setProperty('--timeline-progress', '1');
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

  const timelineObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    },
    { rootMargin: '-10% 0px -10% 0px', threshold: 0.18 }
  );

  timelineItems.forEach((item) => timelineObserver.observe(item));
}

let timelineFrame;

const updateTimelineProgress = () => {
  if (!timeline || reducedMotion) return;

  cancelAnimationFrame(timelineFrame);
  timelineFrame = requestAnimationFrame(() => {
    const bounds = timeline.getBoundingClientRect();
    const startLine = window.innerHeight * 0.72;
    const progress = Math.min(1, Math.max(0, (startLine - bounds.top) / Math.max(bounds.height, 1)));
    timeline.style.setProperty('--timeline-progress', progress.toFixed(4));
  });
};

updateTimelineProgress();
window.addEventListener('scroll', updateTimelineProgress, { passive: true });
window.addEventListener('resize', updateTimelineProgress);
