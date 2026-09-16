import { DB } from './db.js';

const VAPID_PUBLIC_KEY = 'BGDPyYK2Y7uu7A3Amph04dItKlU6brjcFhqjmaSP3-8ZhSunST-jEqWJrGKd28EEzRXDMAWU1tqvF_s_CjzFWAQ';
const WORKER_URL = 'https://fitness-reminders.velislav-fitness.workers.dev';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getClientId() {
  let id = localStorage.getItem('push-client-id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem('push-client-id', id);
  }
  return id;
}

export async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return sub;
  } catch (e) {
    console.warn('push subscribe failed', e);
    return null;
  }
}

export async function syncRemindersToServer() {
  try {
    const sub = await ensurePushSubscription();
    if (!sub) return false;
    const reminders = await DB.getAll('reminders');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: getClientId(),
        subscription: sub.toJSON(),
        reminders: reminders.filter((r) => r.enabled),
        timezone,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('push sync failed', e);
    return false;
  }
}
