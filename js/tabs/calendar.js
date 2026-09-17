import { DB, todayISO, parseDecimal } from '../db.js';
import { renderSheet, confirmDelete } from '../sheet.js';

const COLOR_SWATCHES = ['#dc2430', '#c0c6c8', '#60a5fa', '#34d399', '#fbbf24', '#14b8a6', '#f472b6', '#22d3ee'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTH_NAMES = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

let viewYear, viewMonth;
{
  const n = new Date();
  viewYear = n.getFullYear();
  viewMonth = n.getMonth();
}

export async function renderCalendar(root) {
  root.innerHTML = `
    <style>
      .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
      .cal-weekday { text-align:center; font-size:11px; color:var(--text-faint); padding-bottom:6px; }
      .cal-cell { aspect-ratio:1; border-radius:12px; background:var(--surface); border:1px solid var(--border); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; cursor:pointer; position:relative; }
      .cal-cell.empty { background:none; border:none; cursor:default; }
      .cal-cell.today { border-color:var(--accent); }
      .cal-daynum { font-size:13px; color:var(--text); }
      .cal-dots { display:flex; gap:2px; }
      .cal-dot { width:5px; height:5px; border-radius:50%; }
    </style>
    <h1 class="page-title">Календар</h1>
    <div id="calendar-shell"></div>
    <div id="modal-root"></div>
  `;
  await refreshCalendarShell(root);
}

// Refreshes only the month grid + stats, leaving any open modal (a sibling node) untouched.
async function refreshCalendarShell(root) {
  const shell = root.querySelector('#calendar-shell');
  if (!shell) return;

  const workouts = await DB.getAll('workouts');
  const byDate = {};
  workouts.forEach((w) => { (byDate[w.date] ||= []).push(w); });

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso = todayISO();

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;
  const monthWorkouts = workouts.filter((w) => w.date.startsWith(monthPrefix));
  const totalMinutes = monthWorkouts.reduce((sum, w) => sum + durationMinutes(w.startTime, w.endTime), 0);
  const totalHours = (totalMinutes / 60).toFixed(1).replace(/\.0$/, '');

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayWorkouts = byDate[iso] || [];
    const isToday = iso === todayIso;
    cells += `
      <div class="cal-cell${isToday ? ' today' : ''}" data-day="${iso}">
        <span class="cal-daynum">${day}</span>
        <div class="cal-dots">
          ${dayWorkouts.slice(0, 3).map((w) => `<span class="cal-dot" style="background:${w.color}"></span>`).join('')}
        </div>
      </div>`;
  }

  shell.innerHTML = `
    <div class="row" style="align-items:center;margin-bottom:14px;">
      <button class="btn-icon" id="prev-month">${chevron('left')}</button>
      <div style="text-align:center;flex:3;font-size:15px;">${MONTH_NAMES[viewMonth]} ${viewYear}</div>
      <button class="btn-icon" id="next-month">${chevron('right')}</button>
    </div>

    <div class="stat-row" style="margin-bottom:16px;">
      <div class="stat-tile">
        <div class="stat-value">${monthWorkouts.length}</div>
        <div class="stat-label">тренировки</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${totalHours}ч</div>
        <div class="stat-label">общо време</div>
      </div>
    </div>

    <div class="cal-grid" style="margin-bottom:8px;">
      ${WEEKDAYS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}
    </div>
    <div class="cal-grid">${cells}</div>
  `;

  shell.querySelector('#prev-month').onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } refreshCalendarShell(root); };
  shell.querySelector('#next-month').onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } refreshCalendarShell(root); };
  shell.querySelectorAll('[data-day]').forEach((cell) => {
    cell.onclick = () => openDayModal(root, cell.dataset.day);
  });
}

async function openDayModal(root, iso) {
  const modalRoot = root.querySelector('#modal-root');
  const [dayWorkouts, exercises] = await Promise.all([
    DB.getAllByIndex('workouts', 'date', iso),
    DB.getAll('exercises'),
  ]);

  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));

  async function draw() {
    const workouts = await DB.getAllByIndex('workouts', 'date', iso);
    const setsPerWorkout = {};
    for (const w of workouts) {
      setsPerWorkout[w.id] = await DB.getAllByIndex('workoutSets', 'workoutId', w.id);
    }
    const setsById = Object.fromEntries(Object.values(setsPerWorkout).flat().map((s) => [s.id, s]));

    renderSheet(modalRoot, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">${fmtIso(iso)}</h3>

      ${workouts.map((w) => workoutBlock(w, setsPerWorkout[w.id] || [], exById)).join('') || `<div class="empty-state">Няма тренировка за този ден.</div>`}

      <button class="btn btn-primary btn-block" id="add-workout-btn" style="margin-top:10px;">+ Добави тренировка</button>
    `, () => { modalRoot.innerHTML = ''; });

    modalRoot.querySelector('#add-workout-btn').onclick = () => openWorkoutForm(null);

    modalRoot.querySelectorAll('[data-edit-workout]').forEach((btn) => {
      btn.onclick = async () => {
        const w = workouts.find((x) => x.id === Number(btn.dataset.editWorkout));
        openWorkoutForm(w);
      };
    });
    modalRoot.querySelectorAll('[data-del-workout]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirmDelete('Да изтрия ли цялата тренировка с всички серии?')) return;
        const id = Number(btn.dataset.delWorkout);
        const sets = await DB.getAllByIndex('workoutSets', 'workoutId', id);
        for (const s of sets) await DB.delete('workoutSets', s.id);
        await DB.delete('workouts', id);
        draw();
        refreshCalendarShell(root);
      };
    });
    modalRoot.querySelectorAll('[data-add-exercise]').forEach((btn) => {
      btn.onclick = () => openExercisePicker(Number(btn.dataset.addExercise));
    });
    modalRoot.querySelectorAll('[data-del-set]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirmDelete('Да изтрия ли тази серия?')) return;
        await DB.delete('workoutSets', Number(btn.dataset.delSet));
        draw();
      };
    });
    modalRoot.querySelectorAll('[data-edit-set]').forEach((btn) => {
      btn.onclick = () => openSetEditForm(setsById[Number(btn.dataset.editSet)]);
    });
  }

  function openSetEditForm(set) {
    renderSheet(modalRoot, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">${escapeHtml(set.exerciseName)}</h3>
      <div class="row">
        <div class="field"><label>Повторения</label><input type="text" inputmode="decimal" id="edit-set-reps" value="${set.reps}"></div>
        <div class="field"><label>Кг</label><input type="text" inputmode="decimal" id="edit-set-weight" value="${set.weight}"></div>
      </div>
      <button class="btn btn-primary btn-block" id="save-set-edit" style="margin-bottom:8px;">Запази</button>
      <button class="btn btn-ghost btn-block" id="cancel-set-edit">Отказ</button>
    `, draw);

    modalRoot.querySelector('#cancel-set-edit').onclick = () => draw();
    modalRoot.querySelector('#save-set-edit').onclick = async () => {
      await DB.put('workoutSets', {
        ...set,
        reps: parseDecimal(modalRoot.querySelector('#edit-set-reps').value),
        weight: parseDecimal(modalRoot.querySelector('#edit-set-weight').value),
      });
      draw();
    };
  }

  function openWorkoutForm(existing) {
    const isEdit = !!existing;
    renderSheet(modalRoot, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">${isEdit ? 'Редакция' : 'Нова'} тренировка</h3>
      <div class="field"><label>От</label><input type="time" id="w-start" value="${existing?.startTime || '18:00'}"></div>
      <div class="field"><label>До</label><input type="time" id="w-end" value="${existing?.endTime || '19:00'}"></div>
      <div class="field"><label>Какво тренира</label><input type="text" id="w-label" placeholder="напр. Гърди и трицепс" value="${existing ? escapeHtml(existing.label) : ''}"></div>
      <div class="field">
        <label>Цвят</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${COLOR_SWATCHES.map((c) => `<button class="swatch-pick" data-color="${c}" style="width:30px;height:30px;border-radius:50%;background:${c};border:2px solid ${existing?.color === c ? '#fff' : 'transparent'};"></button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="save-workout" style="margin-top:12px;">Запази</button>
      ${isEdit ? `<button class="btn btn-ghost btn-block" id="cancel-form" style="margin-top:8px;">Отказ</button>` : ''}
    `, draw);

    let selectedColor = existing?.color || COLOR_SWATCHES[0];
    modalRoot.querySelectorAll('.swatch-pick').forEach((b) => {
      b.onclick = () => {
        selectedColor = b.dataset.color;
        modalRoot.querySelectorAll('.swatch-pick').forEach((x) => x.style.border = '2px solid transparent');
        b.style.border = '2px solid #fff';
      };
    });
    const cancelBtn = modalRoot.querySelector('#cancel-form');
    if (cancelBtn) cancelBtn.onclick = () => draw();

    modalRoot.querySelector('#save-workout').onclick = async () => {
      const label = modalRoot.querySelector('#w-label').value.trim() || 'Тренировка';
      const startTime = modalRoot.querySelector('#w-start').value;
      const endTime = modalRoot.querySelector('#w-end').value;
      if (isEdit) {
        await DB.put('workouts', { ...existing, label, startTime, endTime, color: selectedColor });
      } else {
        await DB.add('workouts', { date: iso, label, startTime, endTime, color: selectedColor });
      }
      draw();
      refreshCalendarShell(root);
    };
  }

  async function openExercisePicker(workoutId) {
    const allExercises = await DB.getAll('exercises');
    renderSheet(modalRoot, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">Избери упражнение</h3>
      <div class="field"><input type="text" id="ex-filter" placeholder="Търси упражнение..."></div>
      <div id="ex-list">${allExercises.map((e, i) => exercisePickRow(e, i)).join('')}</div>
    `, draw);

    const filterInput = modalRoot.querySelector('#ex-filter');
    filterInput.oninput = () => {
      const q = filterInput.value.toLowerCase();
      const filtered = allExercises.filter((e) => e.name.toLowerCase().includes(q));
      modalRoot.querySelector('#ex-list').innerHTML = filtered.map((e, i) => exercisePickRow(e, i)).join('');
      bindPickRows(filtered);
    };
    bindPickRows(allExercises);

    function bindPickRows(list) {
      modalRoot.querySelectorAll('[data-pick-ex]').forEach((row) => {
        row.onclick = () => openSetEntry(workoutId, list[Number(row.dataset.pickEx)]);
      });
    }
  }

  function openSetEntry(workoutId, exercise) {
    let setsDraft = [{ reps: '', weight: '' }];
    function drawForm() {
      renderSheet(modalRoot, `
        <div class="modal-handle"></div>
        <h3 style="margin-bottom:14px;">${escapeHtml(exercise.name)}</h3>
        <div id="sets-rows">
          ${setsDraft.map((s, i) => `
            <div class="row" style="margin-bottom:8px;align-items:center;">
              <div class="field" style="margin-bottom:0;"><input type="text" inputmode="decimal" placeholder="Повторения" data-set-reps="${i}" value="${s.reps}"></div>
              <div class="field" style="margin-bottom:0;"><input type="text" inputmode="decimal" placeholder="Кг" data-set-weight="${i}" value="${s.weight}"></div>
            </div>`).join('')}
        </div>
        <button class="btn btn-ghost btn-block" id="add-set-row" style="margin:8px 0 14px;">+ Серия</button>
        <button class="btn btn-primary btn-block" id="save-sets">Запази</button>
      `, draw);

      modalRoot.querySelectorAll('[data-set-reps]').forEach((inp) => inp.oninput = () => setsDraft[Number(inp.dataset.setReps)].reps = inp.value);
      modalRoot.querySelectorAll('[data-set-weight]').forEach((inp) => inp.oninput = () => setsDraft[Number(inp.dataset.setWeight)].weight = inp.value);
      modalRoot.querySelector('#add-set-row').onclick = () => { setsDraft.push({ reps: '', weight: '' }); drawForm(); };
      modalRoot.querySelector('#save-sets').onclick = async () => {
        for (const s of setsDraft) {
          if (s.reps === '' && s.weight === '') continue;
          await DB.add('workoutSets', {
            workoutId,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            reps: parseDecimal(s.reps),
            weight: parseDecimal(s.weight),
            date: iso,
          });
        }
        draw();
      };
    }
    drawForm();
  }

  draw();
}

function workoutBlock(w, sets, exById) {
  const grouped = {};
  sets.forEach((s) => { (grouped[s.exerciseName] ||= []).push(s); });

  return `
    <div class="card" style="border-left:3px solid ${w.color};margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:500;">${escapeHtml(w.label)}</div>
          <div style="font-size:12px;color:var(--text-faint);">${w.startTime} – ${w.endTime}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="icon-btn" data-edit-workout="${w.id}">${editIcon()}</button>
          <button class="icon-btn" data-del-workout="${w.id}">${trashIcon()}</button>
        </div>
      </div>

      ${Object.keys(grouped).length ? `<div style="margin-top:10px;">` + Object.entries(grouped).map(([name, list]) => `
        <div style="margin-bottom:8px;">
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:3px;">${escapeHtml(name)}</div>
          ${list.map((s) => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:2px 0;">
            <span>${s.reps} × ${s.weight}кг</span>
            <span style="display:flex;gap:2px;">
              <button class="icon-btn" data-edit-set="${s.id}" style="padding:2px;">${editIcon()}</button>
              <button class="icon-btn" data-del-set="${s.id}" style="padding:2px;">${trashIcon()}</button>
            </span>
          </div>`).join('')}
        </div>`).join('') + `</div>` : ''}

      <button class="btn btn-ghost btn-block" data-add-exercise="${w.id}" style="margin-top:8px;font-size:13px;padding:9px;">+ Упражнение</button>
    </div>`;
}

function exercisePickRow(e, i) {
  return `<div class="list-row" data-pick-ex="${i}" style="cursor:pointer;">
    <span style="font-size:14px;">${escapeHtml(e.name)}</span>
    ${chevron('right')}
  </div>`;
}

function durationMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function fmtIso(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function chevron(dir) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
function trashIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"></path></svg>`; }
function editIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`; }
