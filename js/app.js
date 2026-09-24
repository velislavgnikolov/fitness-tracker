import { DB } from './db.js';
import { DEFAULT_EXERCISES } from './exercises-seed.js';
import { renderNutrition } from './tabs/nutrition.js';
import { renderCalendar } from './tabs/calendar.js';
import { renderExercises } from './tabs/exercises.js';
import { renderWeight } from './tabs/weight.js';
import { initReminders } from './reminders.js';
import { loadTheme } from './theme.js';
import { autoRestoreIfEmpty, scheduleBackup } from './backup.js';

const root = document.getElementById('view-root');

const TABS = {
  nutrition: renderNutrition,
  calendar: renderCalendar,
  exercises: renderExercises,
  weight: renderWeight,
};

async function seedExercisesIfEmpty() {
  const existing = await DB.getAll('exercises');
  if (existing.length === 0) {
    for (const ex of DEFAULT_EXERCISES) {
      await DB.add('exercises', { ...ex, custom: false });
    }
  }
}

// The old single "Ръце" category was split into "Бицепс"/"Трицепс". Reclassify
// any exercise still tagged with the removed 'arms' id so it doesn't vanish
// from the exercises list for people who already seeded their database.
async function migrateArmsCategory() {
  const existing = await DB.getAll('exercises');
  const stale = existing.filter((e) => e.muscleGroup === 'arms');
  for (const ex of stale) {
    const isTriceps = /трицепс|френска|успоредка/i.test(ex.name);
    await DB.put('exercises', { ...ex, muscleGroup: isTriceps ? 'triceps' : 'biceps' });
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  TABS[tab](root);
  localStorage.setItem('active-tab', tab);
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Prevent iOS double-tap-to-zoom: even in standalone/home-screen mode, a fast
// double tap can still trigger a zoom gesture that desyncs fixed-position
// elements (like the tab bar) from where touches actually land.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Lock background scroll/movement while any bottom sheet is open, so dragging
// to dismiss it can't also scroll the page underneath. `body` is the app's
// actual scroll container (html never scrolls), so this just freezes it.
new MutationObserver(() => {
  const hasModal = !!document.querySelector('.modal-overlay');
  document.body.style.overflowY = hasModal ? 'hidden' : '';
}).observe(document.body, { childList: true, subtree: true });

// iOS keeps allowing touch-driven scroll/bounce of the page behind a modal
// even with body{overflow-y:hidden} - especially with a focused input and
// the keyboard open. Belt-and-braces: block any touchmove that isn't inside
// the open sheet itself, so the background truly can't move while the
// sheet's own content keeps scrolling exactly as smoothly as before.
document.addEventListener('touchmove', (e) => {
  if (!document.querySelector('.modal-overlay')) return;
  if (!e.target.closest('.modal-sheet')) {
    e.preventDefault();
  }
}, { passive: false });

// When the on-screen keyboard opens, iOS both shrinks AND pans the visual
// viewport (to keep the caret visible) without moving the layout viewport
// that position:fixed elements are anchored to. Only tracking the shrunk
// height (a previous attempt) left the fixed sheet's top-left origin
// pinned to the now-scrolled-away layout origin - wrong position, not just
// wrong size, which is what caused the sheet to hide its top and reveal
// page content in the gap left behind. Tracking both offsetTop and height
// keeps the sheet glued exactly to whatever part of the page is actually
// visible, keyboard or not.
function updateViewportVars() {
  const vv = window.visualViewport;
  if (!vv) return;
  document.documentElement.style.setProperty('--app-vh', `${vv.height}px`);
  document.documentElement.style.setProperty('--app-vh-offset', `${vv.offsetTop}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateViewportVars);
  window.visualViewport.addEventListener('scroll', updateViewportVars);
  updateViewportVars();
}

async function init() {
  window.addEventListener('db-write', scheduleBackup);

  await loadTheme();
  await autoRestoreIfEmpty();
  await seedExercisesIfEmpty();
  await migrateArmsCategory();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('SW registration failed', e);
    }
  }

  initReminders();

  const startTab = localStorage.getItem('active-tab') || 'nutrition';
  switchTab(startTab);
}

init();
