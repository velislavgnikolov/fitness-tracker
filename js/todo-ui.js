import { DB } from './db.js';
import { renderSheet } from './sheet.js';

const COLOR_SWATCHES = ['#dc2430', '#c0c6c8', '#60a5fa', '#34d399', '#fbbf24', '#14b8a6', '#f472b6', '#22d3ee'];

export async function openTodoList() {
  let overlay = document.getElementById('todo-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'todo-overlay';
    document.body.appendChild(overlay);
  }

  function close() {
    overlay.innerHTML = '';
  }

  async function drawList() {
    const todos = (await DB.getAll('todos')).sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.id || 0) - (b.id || 0);
    });

    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">Задачи</h3>
      ${todos.length ? todos.map(todoRow).join('') : `<div class="empty-state">Все още няма задачи.</div>`}
      <button class="btn btn-primary btn-block" id="add-todo-btn" style="margin-top:12px;">+ Нова задача</button>
    `, close);

    overlay.querySelector('#add-todo-btn').onclick = () => drawForm(null);

    overlay.querySelectorAll('[data-toggle-todo]').forEach((el) => {
      el.onclick = async () => {
        const t = todos.find((x) => x.id === Number(el.dataset.toggleTodo));
        await DB.put('todos', { ...t, done: !t.done });
        drawList();
      };
    });
    overlay.querySelectorAll('[data-edit-todo]').forEach((el) => {
      el.onclick = () => {
        const t = todos.find((x) => x.id === Number(el.dataset.editTodo));
        drawForm(t);
      };
    });
    overlay.querySelectorAll('[data-del-todo]').forEach((el) => {
      el.onclick = async (ev) => {
        ev.stopPropagation();
        await DB.delete('todos', Number(el.dataset.delTodo));
        drawList();
      };
    });
  }

  function drawForm(existing) {
    const isEdit = !!existing;
    let selectedColor = existing?.color || COLOR_SWATCHES[0];

    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">${isEdit ? 'Редакция на задача' : 'Нова задача'}</h3>
      <div class="field">
        <label>Текст</label>
        <textarea id="todo-text" rows="3" placeholder="напр. Купи протеин">${existing ? escapeHtml(existing.text) : ''}</textarea>
      </div>
      <div class="field">
        <label>Цвят</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${COLOR_SWATCHES.map((c) => `<button type="button" class="swatch-pick" data-color="${c}" style="width:30px;height:30px;border-radius:50%;background:${c};border:2px solid ${existing?.color === c || (!existing && c === COLOR_SWATCHES[0]) ? '#fff' : 'transparent'};"></button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="save-todo-btn" style="margin-top:8px;">Запази</button>
      ${isEdit ? `<button class="btn btn-ghost btn-block" id="delete-todo-btn" style="margin-top:8px;color:var(--danger);">Изтрий</button>` : ''}
      <button class="btn btn-ghost btn-block" id="cancel-todo-btn" style="margin-top:8px;">Назад</button>
    `, close);

    overlay.querySelectorAll('.swatch-pick').forEach((b) => {
      b.onclick = () => {
        selectedColor = b.dataset.color;
        overlay.querySelectorAll('.swatch-pick').forEach((x) => x.style.border = '2px solid transparent');
        b.style.border = '2px solid #fff';
      };
    });

    overlay.querySelector('#cancel-todo-btn').onclick = () => drawList();

    const delBtn = overlay.querySelector('#delete-todo-btn');
    if (delBtn) delBtn.onclick = async () => { await DB.delete('todos', existing.id); drawList(); };

    overlay.querySelector('#save-todo-btn').onclick = async () => {
      const text = overlay.querySelector('#todo-text').value.trim();
      if (!text) return;
      if (isEdit) {
        await DB.put('todos', { ...existing, text, color: selectedColor });
      } else {
        await DB.add('todos', { text, color: selectedColor, done: false });
      }
      drawList();
    };
  }

  drawList();
}

function todoRow(t) {
  return `
    <div class="card" style="margin-bottom:10px;border-left:3px solid ${t.color};display:flex;align-items:flex-start;gap:10px;">
      <button data-toggle-todo="${t.id}" style="flex-shrink:0;margin-top:2px;width:22px;height:22px;border-radius:7px;border:1.5px solid ${t.done ? t.color : 'var(--border-strong)'};background:${t.done ? t.color : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;">
        ${t.done ? checkIcon() : ''}
      </button>
      <div data-edit-todo="${t.id}" style="flex:1;min-width:0;cursor:pointer;">
        <div style="font-size:14.5px;white-space:pre-wrap;word-break:break-word;${t.done ? 'text-decoration:line-through;color:var(--text-faint);' : ''}">${escapeHtml(t.text)}</div>
      </div>
      <button data-del-todo="${t.id}" class="icon-btn" style="flex-shrink:0;">${trashIcon()}</button>
    </div>`;
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function checkIcon() { return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16131f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`; }
function trashIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"></path></svg>`; }

export function todoIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8 12l2.5 2.5L16 9"></path></svg>`;
}
