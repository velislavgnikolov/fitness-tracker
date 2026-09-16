import { DB } from './db.js';

const WORKER_URL = 'https://fitness-reminders.velislav-fitness.workers.dev';
const CODE_KEY = 'backup-code';

const STORE_NAMES = [
  'foods', 'foodLog', 'exercises', 'workouts', 'workoutSets',
  'weightLog', 'settings', 'reminders', 'todos',
];

let backupTimer = null;

// Every device/browser gets its OWN backup code, generated on first use and
// kept in localStorage - so two different people opening the same link each
// get a private, empty profile and their own cloud backup, never someone
// else's data. The code is also shown to the user so they can save it
// externally: on iOS, deleting the home-screen icon wipes localStorage too,
// so this is the only thing that survives a real reinstall - restoring after
// that requires typing the saved code back in (see restoreWithCode).
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid mixups
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function getBackupCode() {
  let code = localStorage.getItem(CODE_KEY);
  if (!code) {
    code = generateCode();
    localStorage.setItem(CODE_KEY, code);
  }
  return code;
}

export function hasLocalBackupCode() {
  return !!localStorage.getItem(CODE_KEY);
}

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
      body: JSON.stringify({ backupId: getBackupCode(), data }),
    });
    localStorage.setItem('last-backup-at', new Date().toISOString());
    return true;
  } catch (e) {
    console.warn('backup failed', e);
    return false;
  }
}

export async function fetchCloudBackupForCode(code) {
  try {
    const res = await fetch(`${WORKER_URL}/backup?backupId=${encodeURIComponent(code)}`);
    const body = await res.json();
    return body.found ? body : null;
  } catch (e) {
    console.warn('backup fetch failed', e);
    return null;
  }
}

export function fetchOwnCloudBackup() {
  return fetchCloudBackupForCode(getBackupCode());
}

// Restore using a code the user typed in (e.g. one they saved before
// reinstalling). On success, this device adopts that code as its own, so
// future automatic backups keep updating the same restored profile.
export async function restoreWithCode(code) {
  const normalized = code.trim().toUpperCase();
  const backup = await fetchCloudBackupForCode(normalized);
  if (!backup) return false;
  await importAllData(backup.data);
  localStorage.setItem(CODE_KEY, normalized);
  return true;
}

// Only safe to run silently: this device already has its own saved code
// (so we're not about to hand a stranger someone else's data) but its local
// IndexedDB is empty - e.g. site data got cleared while the code survived.
export async function autoRestoreIfEmpty() {
  if (!hasLocalBackupCode()) return false;
  const empty = await isLocalDataEmpty();
  if (!empty) return false;
  const backup = await fetchOwnCloudBackup();
  if (!backup) return false;
  await importAllData(backup.data);
  return true;
}

export function lastBackupAt() {
  return localStorage.getItem('last-backup-at');
}
