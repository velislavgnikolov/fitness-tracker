import { buildPushPayload } from '@block65/webcrypto-web-push';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// A single small key listing every subscribed clientId. Used instead of
// SUBS.list() so the once-a-minute cron never issues a KV list operation
// (that quota is only 1,000/day on the free tier - 1,440 cron runs alone
// would blow through it) and never has to read unrelated backup: blobs.
const SUB_INDEX_KEY = 'sub-index';

async function getSubIndex(env) {
  const raw = await env.SUBS.get(SUB_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function addToSubIndex(env, clientId) {
  const ids = await getSubIndex(env);
  if (!ids.includes(clientId)) {
    ids.push(clientId);
    await env.SUBS.put(SUB_INDEX_KEY, JSON.stringify(ids));
  }
}

async function removeFromSubIndex(env, clientId) {
  const ids = await getSubIndex(env);
  const next = ids.filter((id) => id !== clientId);
  if (next.length !== ids.length) {
    await env.SUBS.put(SUB_INDEX_KEY, JSON.stringify(next));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.clientId || !body.subscription) {
        return json({ error: 'bad request' }, 400);
      }
      const existingRaw = await env.SUBS.get(body.clientId);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const record = {
        subscription: body.subscription,
        reminders: body.reminders || [],
        timezone: body.timezone || 'Europe/Sofia',
        lastFired: existing.lastFired || {},
      };
      await env.SUBS.put(body.clientId, JSON.stringify(record));
      await addToSubIndex(env, body.clientId);
      return json({ ok: true });
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (body && body.clientId) {
        await env.SUBS.delete(body.clientId);
        await removeFromSubIndex(env, body.clientId);
      }
      return json({ ok: true });
    }

    if (url.pathname === '/backup' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body || !body.backupId || !body.data) {
        return json({ error: 'bad request' }, 400);
      }
      const payload = JSON.stringify({ data: body.data, savedAt: new Date().toISOString() });
      if (payload.length > 24 * 1024 * 1024) {
        return json({ error: 'payload too large' }, 413);
      }
      await env.SUBS.put(`backup:${body.backupId}`, payload);
      return json({ ok: true });
    }

    if (url.pathname === '/backup' && request.method === 'GET') {
      const backupId = url.searchParams.get('backupId');
      if (!backupId) return json({ error: 'missing backupId' }, 400);
      const raw = await env.SUBS.get(`backup:${backupId}`);
      if (!raw) return json({ found: false });
      const record = JSON.parse(raw);
      return json({ found: true, data: record.data, savedAt: record.savedAt });
    }

    return new Response('Fitness reminders push worker', { status: 200, headers: CORS_HEADERS });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },
};

async function runReminders(env) {
  const now = new Date();
  const clientIds = await getSubIndex(env);
  const staleIds = [];

  for (const clientId of clientIds) {
    const raw = await env.SUBS.get(clientId);
    if (!raw) { staleIds.push(clientId); continue; }
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      staleIds.push(clientId);
      continue;
    }

    const { subscription, reminders = [], timezone = 'Europe/Sofia' } = record;
    record.lastFired ||= {};

    const { hour, minute, dateKey } = getLocalParts(now, timezone);
    const nowMinutes = hour * 60 + minute;

    let changed = false;
    for (const r of reminders) {
      if (!r.enabled) continue;
      const fireMinutesList = computeFireMinutes(r);
      for (const fm of fireMinutesList) {
        if (fm !== nowMinutes) continue;
        const firedKey = `${r.id}-${dateKey}-${fm}`;
        if (record.lastFired[firedKey]) continue;
        try {
          await sendPush(env, subscription, r.text);
        } catch (e) {
          console.error('push failed', e.message);
        }
        record.lastFired[firedKey] = true;
        changed = true;
      }
    }

    // Keep lastFired from growing forever: drop entries not from today.
    const prunedFired = {};
    for (const k of Object.keys(record.lastFired)) {
      if (k.includes(`-${dateKey}-`)) prunedFired[k] = true;
    }
    record.lastFired = prunedFired;

    if (changed || Object.keys(prunedFired).length !== Object.keys(record.lastFired).length) {
      await env.SUBS.put(clientId, JSON.stringify(record));
    }
  }

  // Self-heal: drop any clientId from the index whose record is gone (e.g.
  // deleted outside the normal /unsubscribe path).
  if (staleIds.length) {
    const remaining = clientIds.filter((id) => !staleIds.includes(id));
    await env.SUBS.put(SUB_INDEX_KEY, JSON.stringify(remaining));
  }
}

function getLocalParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return { hour, minute: Number(parts.minute), dateKey: `${parts.year}-${parts.month}-${parts.day}` };
}

function computeFireMinutes(r) {
  if (r.mode === 'fixed') {
    const [h, m] = r.time.split(':').map(Number);
    return [h * 60 + m];
  }
  const [sh, sm] = r.startTime.split(':').map(Number);
  const [eh, em] = r.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const count = Math.max(1, Number(r.count) || 1);
  if (count === 1) return [startMin];
  const step = (endMin - startMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(startMin + step * i));
}

async function sendPush(env, subscription, text) {
  const vapid = {
    subject: 'mailto:velislav.nikolov@newviva.bg',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const message = {
    data: JSON.stringify({ title: 'Напомняне', body: text }),
    options: { ttl: 3600 },
  };

  const payload = await buildPushPayload(message, subscription, vapid);
  const res = await fetch(subscription.endpoint, payload);
  if (!res.ok && res.status !== 201) {
    throw new Error(`push endpoint responded ${res.status}`);
  }
}
