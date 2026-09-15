const DB_NAME = 'fitness-tracker';
const DB_VERSION = 2;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('foods')) {
        const s = db.createObjectStore('foods', { keyPath: 'id', autoIncrement: true });
        s.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('foodLog')) {
        const s = db.createObjectStore('foodLog', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('exercises')) {
        const s = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        s.createIndex('muscleGroup', 'muscleGroup');
      }
      if (!db.objectStoreNames.contains('workouts')) {
        const s = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('workoutSets')) {
        const s = db.createObjectStore('workoutSets', { keyPath: 'id', autoIncrement: true });
        s.createIndex('workoutId', 'workoutId');
      }
      if (!db.objectStoreNames.contains('weightLog')) {
        const s = db.createObjectStore('weightLog', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const DB = {
  async add(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.add(value));
  },
  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.put(value));
  },
  async get(storeName, id) {
    const store = await tx(storeName);
    return wrap(store.get(id));
  },
  async getAll(storeName) {
    const store = await tx(storeName);
    return wrap(store.getAll());
  },
  async getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    return wrap(store.index(indexName).getAll(value));
  },
  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.delete(id));
  },
  async clearStore(storeName) {
    const store = await tx(storeName, 'readwrite');
    return wrap(store.clear());
  },
};

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function fmtDateHuman(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', weekday: 'short' });
}
