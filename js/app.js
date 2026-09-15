import { DB } from './db.js';
import { DEFAULT_EXERCISES } from './exercises-seed.js';
import { renderNutrition } from './tabs/nutrition.js';
import { renderCalendar } from './tabs/calendar.js';
import { renderExercises } from './tabs/exercises.js';
import { renderWeight } from './tabs/weight.js';
import { initReminders } from './reminders.js';
import { loadTheme } from './theme.js';

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

async function init() {
  await loadTheme();
  await seedExercisesIfEmpty();

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
