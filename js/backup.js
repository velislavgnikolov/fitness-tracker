import { DB } from './db.js';

// Fixed backup identity: this is a single-user personal app, and the id must
// survive a full local wipe (deleting the home-screen icon clears
// localStorage too), so it can't be generated/stored on-device like the push
// client id is. A constant works fine for one user.
const BACKUP_ID = 'velislav-fitness-primary';
const WORKER_URL = 'https://fitness-reminders.velislav-fitness.workers.dev';

const STORE_NAMES = [
  'foods', 'foodLog', 'exercises', 'workouts', 'workoutSets',
  'weightLog', 'settings', 'reminders', 'todos',
];

let backupTimer = null;

export function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => { backupNow(); }, 4000);
}

export async function exportAllData() {
  const dump = {};
  for (const store of STORE_NAMES) {
    dump[store] = await DB.getAll(store);
  }
  return dump;
}

export async function importAllData(dump) {
  for (const store of STORE_NAMES) {
    const rows = dump[store];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      await DB.put(store, row);
    }
  }
}

export async function isLocalDataEmpty() {
  for (const store of ['foodLog', 'workouts', 'weightLog', 'todos', 'reminders']) {
    const rows = await DB.getAll(store);
    if (rows.length > 0) return false;
  }
  return true;
}

export async function backupNow() {
  try {
    const data = await exportAllData();
    await fetch(`${WORKER_URL}/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId: BACKUP_ID, data }),
    });
    localStorage.setItem('last-backup-at', new Date().toISOString());
    return true;
  } catch (e) {
    console.warn('backup failed', e);
    return false;
  }
}

export async function fetchCloudBackup() {
  try {
    const res = await fetch(`${WORKER_URL}/backup?backupId=${encodeURIComponent(BACKUP_ID)}`);
    const body = await res.json();
    return body.found ? body : null;
  } catch (e) {
    console.warn('backup fetch failed', e);
    return null;
  }
}

export async function restoreFromCloud() {
  const backup = await fetchCloudBackup();
  if (!backup) return false;
  await importAllData(backup.data);
  return true;
}

// If the local database looks freshly wiped (e.g. after deleting and
// re-adding the home-screen icon), pull down the last cloud backup
// automatically - there is nothing local to lose by doing so.
export async function autoRestoreIfEmpty() {
  const empty = await isLocalDataEmpty();
  if (!empty) return false;
  return restoreFromCloud();
}

export function lastBackupAt() {
  return localStorage.getItem('last-backup-at');
}
