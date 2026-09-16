import { renderSheet, confirmDelete } from './sheet.js';
import { DB } from './db.js';
import { syncRemindersToServer } from './push.js';

const timers = new Map();

export async function getAllReminders() {
  const all = await DB.getAll('reminders');
  return all.sort((a, b) => (a.id || 0) - (b.id || 0));
}

export async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export async function saveReminder(reminder) {
  if (reminder.id) {
    await DB.put('reminders', reminder);
  } else {
    const id = await DB.add('reminders', reminder);
    reminder.id = id;
  }
  if (reminder.enabled) {
    const granted = await ensurePermission();
    if (granted) scheduleReminder(reminder);
    else unscheduleReminder(reminder.id);
  } else {
    unscheduleReminder(reminder.id);
  }
  syncRemindersToServer();
  return reminder;
}

export async function deleteReminder(id) {
  unscheduleReminder(id);
  await DB.delete('reminders', id);
  syncRemindersToServer();
}

function computeFireMinutes(reminder) {
  if (reminder.mode === 'fixed') {
    const [h, m] = reminder.time.split(':').map(Number);
    return [h * 60 + m];
  }
  const [sh, sm] = reminder.startTime.split(':').map(Number);
  const [eh, em] = reminder.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const count = Math.max(1, Number(reminder.count) || 1);
  if (count === 1) return [startMin];
  const step = (endMin - startMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(startMin + step * i));
}

function nextOccurrence(minutesOfDay) {
  const now = new Date();
  for (const offsetDays of [0, 1]) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(0, minutesOfDay, 0, 0);
    if (d > now) return d;
  }
  return null;
}

function unscheduleReminder(id) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
}

export function scheduleReminder(reminder) {
  unscheduleReminder(reminder.id);
  const fireMinutes = computeFireMinutes(reminder);
  const upcoming = fireMinutes.map(nextOccurrence).filter(Boolean).sort((a, b) => a - b);
  const next = upcoming[0];
  if (!next) return;
  const delay = Math.min(next - new Date(), 2147483647);
  const t = setTimeout(async () => {
    await fireNotification(reminder.text);
    scheduleReminder(reminder);
  }, delay);
  timers.set(reminder.id, t);
}

async function fireNotification(text) {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      reg.showNotification('Напомняне', {
        body: text,
        icon: 'icons/icon-192.png',
        tag: 'reminder-' + Date.now(),
      });
      return;
    }
  }
  if (Notification.permission === 'granted') {
    new Notification('Напомняне', { body: text, icon: 'icons/icon-192.png' });
  }
}

export async function initReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const all = await getAllReminders();
  all.filter((r) => r.enabled).forEach(scheduleReminder);
  syncRemindersToServer();
}

// ---------- UI: reminders manager (self-contained overlay) ----------

export async function openRemindersManager() {
  let overlay = document.getElementById('reminders-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reminders-overlay';
    document.body.appendChild(overlay);
  }

  async function drawList() {
    const reminders = await getAllReminders();
    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">Напомняния</h3>
      ${reminders.length
        ? reminders.map(reminderRow).join('')
        : `<div class="empty-state">Все още няма напомняния.</div>`}
      <button class="btn btn-primary btn-block" id="add-reminder-btn" style="margin-top:12px;">+ Ново напомняне</button>
    `, close);

    overlay.querySelector('#add-reminder-btn').onclick = () => drawForm(null);

    overlay.querySelectorAll('[data-toggle-reminder]').forEach((el) => {
      el.onclick = async () => {
        const r = reminders.find((x) => x.id === Number(el.dataset.toggleReminder));
        r.enabled = !r.enabled;
        await saveReminder(r);
        drawList();
      };
    });
    overlay.querySelectorAll('[data-edit-reminder]').forEach((el) => {
      el.onclick = () => {
        const r = reminders.find((x) => x.id === Number(el.dataset.editReminder));
        drawForm(r);
      };
    });
    overlay.querySelectorAll('[data-del-reminder]').forEach((el) => {
      el.onclick = async () => {
        if (!confirmDelete('Да изтрия ли това напомняне?')) return;
        await deleteReminder(Number(el.dataset.delReminder));
        drawList();
      };
    });
  }

  function close() {
    overlay.innerHTML = '';
  }

  function drawForm(existing) {
    const isEdit = !!existing;
    let mode = existing?.mode || 'fixed';

    function formHtml() {
      return `
        <div class="modal-handle"></div>
        <h3 style="margin-bottom:14px;">${isEdit ? 'Редакция' : 'Ново'} напомняне</h3>

        <div class="field">
          <label>Какво да напомня</label>
          <input type="text" id="rem-text" placeholder="напр. Изпий вода" value="${existing ? escapeHtml(existing.text) : ''}">
        </div>

        <div class="field">
          <label>Тип разписание</label>
          <div class="row">
            <button type="button" class="btn ${mode === 'fixed' ? 'btn-primary' : 'btn-ghost'}" id="mode-fixed" style="font-size:13px;">Определен час</button>
            <button type="button" class="btn ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}" id="mode-range" style="font-size:13px;">Диапазон + повторения</button>
          </div>
        </div>

        <div id="mode-fields"></div>

        <div class="field" style="margin-top:4px;">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="rem-enabled" ${existing?.enabled !== false ? 'checked' : ''} style="width:auto;">
            Активно
          </label>
        </div>

        <button class="btn btn-primary btn-block" id="save-reminder-btn" style="margin-top:8px;">Запази</button>
        ${isEdit ? `<button class="btn btn-ghost btn-block" id="delete-reminder-btn" style="margin-top:8px;color:var(--danger);">Изтрий напомнянето</button>` : ''}
        <button class="btn btn-ghost btn-block" id="cancel-reminder-btn" style="margin-top:8px;">Назад</button>
      `;
    }

    function modeFieldsHtml() {
      if (mode === 'fixed') {
        return `<div class="field"><label>Час</label><input type="time" id="rem-time" value="${existing?.time || '09:00'}"></div>`;
      }
      return `
        <div class="row">
          <div class="field"><label>От</label><input type="time" id="rem-start" value="${existing?.startTime || '08:00'}"></div>
          <div class="field"><label>До</label><input type="time" id="rem-end" value="${existing?.endTime || '20:00'}"></div>
        </div>
        <div class="field"><label>Пъти на ден</label><input type="number" id="rem-count" min="1" max="24" value="${existing?.count || 3}"></div>
      `;
    }

    renderSheet(overlay, formHtml(), close);
    overlay.querySelector('#mode-fields').innerHTML = modeFieldsHtml();
    bindForm();

    function bindForm() {
      overlay.querySelector('#cancel-reminder-btn').onclick = () => drawList();
      overlay.querySelector('#mode-fixed').onclick = () => { mode = 'fixed'; refreshModeUI(); };
      overlay.querySelector('#mode-range').onclick = () => { mode = 'range'; refreshModeUI(); };

      const delBtn = overlay.querySelector('#delete-reminder-btn');
      if (delBtn) delBtn.onclick = async () => {
        if (!confirmDelete('Да изтрия ли това напомняне?')) return;
        await deleteReminder(existing.id);
        drawList();
      };

      overlay.querySelector('#save-reminder-btn').onclick = async () => {
        const text = overlay.querySelector('#rem-text').value.trim();
        if (!text) return;
        const enabled = overlay.querySelector('#rem-enabled').checked;
        let reminder;
        if (mode === 'fixed') {
          reminder = {
            ...(existing || {}),
            text, mode, enabled,
            time: overlay.querySelector('#rem-time').value || '09:00',
          };
        } else {
          reminder = {
            ...(existing || {}),
            text, mode, enabled,
            startTime: overlay.querySelector('#rem-start').value || '08:00',
            endTime: overlay.querySelector('#rem-end').value || '20:00',
            count: Number(overlay.querySelector('#rem-count').value) || 1,
          };
        }
        await saveReminder(reminder);
        drawList();
      };
    }

    function refreshModeUI() {
      overlay.querySelector('#mode-fixed').className = `btn ${mode === 'fixed' ? 'btn-primary' : 'btn-ghost'}`;
      overlay.querySelector('#mode-range').className = `btn ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}`;
      overlay.querySelector('#mode-fields').innerHTML = modeFieldsHtml();
    }
  }

  drawList();
}

function reminderRow(r) {
  const schedule = r.mode === 'fixed'
    ? `Всеки ден в ${r.time}`
    : `${r.count}× между ${r.startTime}–${r.endTime}`;
  return `
    <div class="card" style="margin-bottom:10px;opacity:${r.enabled ? '1' : '0.5'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;cursor:pointer;" data-edit-reminder="${r.id}">
          <div style="font-size:14.5px;">${escapeHtml(r.text)}</div>
          <div style="font-size:12px;color:var(--text-faint);margin-top:2px;">${schedule}</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="icon-btn" data-toggle-reminder="${r.id}" title="Вкл/Изкл">${r.enabled ? onIcon() : offIcon()}</button>
          <button class="icon-btn" data-del-reminder="${r.id}">${trashIcon()}</button>
        </div>
      </div>
    </div>`;
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function trashIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"></path></svg>`; }
function onIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M9 12l2 2 4-4"></path></svg>`; }
function offIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle></svg>`; }
