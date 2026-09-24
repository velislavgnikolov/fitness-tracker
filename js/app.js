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

// iOS shrinks the visual viewport (not the layout viewport) when the on-screen
// keyboard opens. A fixed-position bottom sheet sized off 100vh doesn't know
// about that shrink, so a sheet taller than the space left above the keyboard
// gets pushed up past the top of the screen instead of just scrolling its own
// content. Track the real visible height in --app-vh so .modal-overlay/
// .modal-sheet (see css/style.css) can size themselves to it - the sheet's
// top (handle, inputs, buttons) then always stays in view, and only its
// scrollable content (e.g. the food results list) shrinks behind the keyboard.
function updateAppVh() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAppVh);
  window.visualViewport.addEventListener('scroll', updateAppVh);
} else {
  window.addEventListener('resize', updateAppVh);
}
updateAppVh();

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
