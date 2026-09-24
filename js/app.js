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

// Lock background scroll/movement while any bottom sheet is open, so nothing
// behind it can ever be seen shifting around - especially with the keyboard
// open, where iOS's own viewport panning made plain overflow:hidden on body
// unreliable (tried and reverted). Taking body fully out of flow with
// position:fixed is the robust version of the same lock: there's no scroll
// position left for a touch or the keyboard to disturb. Also hides the tab
// bar and FAB outright, so there's nothing else fixed-position behind the
// sheet that could visibly jump around while the keyboard opens/closes.
let lockedScrollTop = 0;
new MutationObserver(() => {
  const hasModal = !!document.querySelector('.modal-overlay');
  const isLocked = document.body.classList.contains('modal-locked');
  if (hasModal && !isLocked) {
    lockedScrollTop = document.body.scrollTop;
    document.body.classList.add('modal-locked');
    document.body.style.top = `-${lockedScrollTop}px`;
  } else if (!hasModal && isLocked) {
    document.body.classList.remove('modal-locked');
    document.body.style.top = '';
    document.body.scrollTop = lockedScrollTop;
  }
}).observe(document.body, { childList: true, subtree: true });

// Extra safety net on top of the lock above: block any touch-drag that
// isn't inside the open sheet, so nothing behind it can rubber-band/bounce
// even for a frame. Touches inside .modal-sheet are left alone, so its own
// content keeps scrolling exactly as smoothly as before.
document.addEventListener('touchmove', (e) => {
  if (!document.body.classList.contains('modal-locked')) return;
  if (!e.target.closest('.modal-sheet')) {
    e.preventDefault();
  }
}, { passive: false });

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
