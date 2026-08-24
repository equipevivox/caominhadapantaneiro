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
  document.removeEventListener('pointerdown', unlockBootAudio);
  document.removeEventListener('keydown', unlockBootAudio);
  window.setTimeout(() => bootScreen?.remove(), reducedMotion ? 0 : 460);
}

function unlockBootAudio() {
  if (!bootVideo || bootFinished) return;
  bootVideo.muted = false;
  bootVideo.volume = 0.5;
  bootVideo.play().catch(() => {
    bootVideo.muted = true;
  });
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
  document.addEventListener('pointerdown', unlockBootAudio, { once: true });
  document.addEventListener('keydown', unlockBootAudio, { once: true });

  bootTimeout = window.setTimeout(finishBoot, 8500);
  const playback = bootVideo.play();
  playback?.catch(() => {
    bootVideo.muted = true;
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

const customScrollbar = document.querySelector('[data-custom-scrollbar]');
const scrollbarThumb = document.querySelector('[data-scrollbar-thumb]');
if (customScrollbar && scrollbarThumb) document.documentElement.classList.add('custom-scrollbar-ready');
let smoothScrollFrame = 0;
let smoothScrollTarget = window.scrollY;
let smoothScrollStart = window.scrollY;
let smoothScrollStartedAt = 0;
let isSmoothScrolling = false;
let scrollbarMetrics = { maxScroll: 0, travel: 0 };
let scrollbarDragStart = null;

const getMaxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

const cancelSmoothScroll = () => {
  window.cancelAnimationFrame(smoothScrollFrame);
  smoothScrollFrame = 0;
  smoothScrollStartedAt = 0;
  isSmoothScrolling = false;
};

const runSmoothScroll = (timestamp) => {
  const distance = smoothScrollTarget - smoothScrollStart;
  const progress = Math.min(1, Math.max(0, (timestamp - smoothScrollStartedAt) / 420));
  const easedProgress = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  if (progress >= 1 || Math.abs(distance) < 0.5) {
    window.scrollTo(0, smoothScrollTarget);
    smoothScrollFrame = 0;
    smoothScrollStartedAt = 0;
    isSmoothScrolling = false;
    return;
  }

  window.scrollTo(0, smoothScrollStart + distance * easedProgress);
  smoothScrollFrame = window.requestAnimationFrame(runSmoothScroll);
};

const hasScrollableParent = (element) => {
  let current = element instanceof Element ? element : null;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return true;
    current = current.parentElement;
  }

  return false;
};

window.addEventListener('wheel', (event) => {
  if (reducedMotion || document.body.classList.contains('boot-active') || document.body.classList.contains('menu-open')) return;
  if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY) || hasScrollableParent(event.target)) return;

  event.preventDefault();
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
  const maxScroll = getMaxScroll();
  smoothScrollStart = window.scrollY;
  smoothScrollTarget = Math.min(maxScroll, Math.max(0, smoothScrollTarget + event.deltaY * unit));
  smoothScrollStartedAt = performance.now();

  if (!smoothScrollFrame) {
    isSmoothScrolling = true;
    smoothScrollFrame = window.requestAnimationFrame(runSmoothScroll);
  }
}, { passive: false });

const syncCustomScrollbar = () => {
  if (!customScrollbar || !scrollbarThumb) return;

  const viewportHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  const trackHeight = Math.max(0, viewportHeight - 6);
  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  const thumbHeight = maxScroll > 0 ? Math.max(48, trackHeight * (viewportHeight / documentHeight)) : trackHeight;
  const travel = Math.max(0, trackHeight - thumbHeight);
  const offset = maxScroll > 0 ? travel * (window.scrollY / maxScroll) : 0;

  scrollbarMetrics = { maxScroll, travel };
  customScrollbar.classList.toggle('is-scrollable', maxScroll > 1);
  customScrollbar.style.setProperty('--scrollbar-thumb-height', `${thumbHeight}px`);
  customScrollbar.style.setProperty('--scrollbar-thumb-offset', `${offset}px`);

  if (!isSmoothScrolling && !scrollbarDragStart) smoothScrollTarget = window.scrollY;
};

scrollbarThumb?.addEventListener('pointerdown', (event) => {
  if (!scrollbarMetrics.maxScroll || !scrollbarMetrics.travel) return;
  cancelSmoothScroll();
  scrollbarDragStart = { pointerY: event.clientY, scrollY: window.scrollY };
  scrollbarThumb.setPointerCapture(event.pointerId);
  event.preventDefault();
});

scrollbarThumb?.addEventListener('pointermove', (event) => {
  if (!scrollbarDragStart) return;
  const pointerDelta = event.clientY - scrollbarDragStart.pointerY;
  const scrollDelta = (pointerDelta / scrollbarMetrics.travel) * scrollbarMetrics.maxScroll;
  smoothScrollTarget = Math.min(scrollbarMetrics.maxScroll, Math.max(0, scrollbarDragStart.scrollY + scrollDelta));
  window.scrollTo(0, smoothScrollTarget);
});

const finishScrollbarDrag = (event) => {
  if (!scrollbarDragStart) return;
  scrollbarDragStart = null;
  if (scrollbarThumb?.hasPointerCapture(event.pointerId)) scrollbarThumb.releasePointerCapture(event.pointerId);
};

scrollbarThumb?.addEventListener('pointerup', finishScrollbarDrag);
scrollbarThumb?.addEventListener('pointercancel', finishScrollbarDrag);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (reducedMotion) return;
    const selector = link.getAttribute('href');
    const destination = selector && selector !== '#' ? document.querySelector(selector) : null;
    if (!destination) return;

    event.preventDefault();
    cancelSmoothScroll();
    const headerOffset = header?.offsetHeight ?? 98;
    const destinationY = destination.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, destinationY), behavior: 'smooth' });
    window.history.pushState(null, '', selector);
  });
});

syncCustomScrollbar();
window.addEventListener('scroll', syncCustomScrollbar, { passive: true });
window.addEventListener('resize', syncCustomScrollbar);
window.addEventListener('load', syncCustomScrollbar);

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
