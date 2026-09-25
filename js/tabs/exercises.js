import { DB, todayISO } from '../db.js';
import { MUSCLE_GROUPS, SPORT_GROUP_ID } from '../exercises-seed.js';
import { renderSheet, confirmDelete } from '../sheet.js';
import { renderMuscleMap } from '../muscle-map.js';

const BODY_MAP_GROUPS = MUSCLE_GROUPS.filter((g) => g.id !== 'cardio' && g.id !== SPORT_GROUP_ID);

const SPORT_COLORS = ['#fb923c', '#f472b6', '#22d3ee', '#a3e635', '#facc15', '#60a5fa'];
const TIME_RANGES = [
  { id: 'week', label: 'Седмица', days: 7 },
  { id: 'month', label: 'Месец', days: 30 },
  { id: '90d', label: '90 дни', days: 90 },
  { id: 'always', label: 'Винаги', days: null },
];
let timeRange = 'always';

export async function renderExercises(root) {
  const [exercises, allSets, workouts] = await Promise.all([
    DB.getAll('exercises'),
    DB.getAll('workoutSets'),
    DB.getAll('workouts'),
  ]);
  const byGroup = {};
  MUSCLE_GROUPS.forEach((g) => byGroup[g.id] = []);
  exercises.forEach((e) => { (byGroup[e.muscleGroup] ||= []).push(e); });

  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const weekAgoIso = shiftDate(todayISO(), -6);
  const recentSets = allSets.filter((s) => s.date >= weekAgoIso);
  const groupCounts = {};
  recentSets.forEach((s) => {
    const ex = exerciseById[s.exerciseId];
    if (ex) groupCounts[ex.muscleGroup] = (groupCounts[ex.muscleGroup] || 0) + 1;
  });

  const volumeByGroup = {};
  let grandTotalVolume = 0;
  allSets.forEach((s) => {
    const vol = (s.reps || 0) * (s.weight || 0);
    grandTotalVolume += vol;
    const ex = exerciseById[s.exerciseId];
    if (ex) volumeByGroup[ex.muscleGroup] = (volumeByGroup[ex.muscleGroup] || 0) + vol;
  });

  // Time distribution: a workout counts as "Фитнес" unless it has at least
  // one sport-category exercise logged, in which case its whole duration
  // goes to that sport instead (each sport tracked separately).
  const setsByWorkout = {};
  allSets.forEach((s) => { (setsByWorkout[s.workoutId] ||= []).push(s); });
  const rangeDef = TIME_RANGES.find((r) => r.id === timeRange) || TIME_RANGES[TIME_RANGES.length - 1];
  const rangeCutoffIso = rangeDef.days != null ? shiftDate(todayISO(), -(rangeDef.days - 1)) : null;
  const rangeWorkouts = rangeCutoffIso ? workouts.filter((w) => w.date >= rangeCutoffIso) : workouts;
  let fitnessMinutes = 0;
  const sportMinutes = {};
  rangeWorkouts.forEach((w) => {
    const sportSets = (setsByWorkout[w.id] || []).filter((s) => s.duration != null);
    if (sportSets.length) {
      sportSets.forEach((s) => { sportMinutes[s.exerciseName] = (sportMinutes[s.exerciseName] || 0) + (s.duration || 0); });
    } else {
      fitnessMinutes += durationMinutes(w.startTime, w.endTime);
    }
  });
  const sportEntries = Object.entries(sportMinutes).sort((a, b) => b[1] - a[1]);

  // Muscle map: how many separate workouts this week (Mon-Sun) touched each
  // muscle group - a workout with both chest and triceps exercises counts
  // once for each, not twice for either.
  const weekStartIso = mondayOf(todayISO());
  const weekWorkoutIds = new Set(workouts.filter((w) => w.date >= weekStartIso).map((w) => w.id));
  const weekGroupCounts = {};
  const touchedByWorkout = {};
  allSets.forEach((s) => {
    if (!weekWorkoutIds.has(s.workoutId)) return;
    const ex = exerciseById[s.exerciseId];
    if (!ex || ex.muscleGroup === 'cardio' || ex.muscleGroup === SPORT_GROUP_ID) return;
    const key = `${s.workoutId}:${ex.muscleGroup}`;
    if (touchedByWorkout[key]) return;
    touchedByWorkout[key] = true;
    weekGroupCounts[ex.muscleGroup] = (weekGroupCounts[ex.muscleGroup] || 0) + 1;
  });

  root.innerHTML = `
    <h1 class="page-title">Тренировки</h1>

    <div class="stat-row" style="margin-bottom:10px;">
      <div class="stat-tile">
        <div class="stat-value">${recentSets.length}</div>
        <div class="stat-label">серии / 7 дни</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${new Set(recentSets.map((s) => s.exerciseId)).size}</div>
        <div class="stat-label">упражнения</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${fmtVolume(grandTotalVolume)}</div>
        <div class="stat-label">общо вдигнати кг</div>
      </div>
    </div>

    <div class="section-heading">Тренирани мускули тази седмица</div>
    <div class="card" style="margin-bottom:16px;">
      <div id="muscle-map-root"></div>
    </div>

    ${recentSets.length ? `<div class="card" style="margin-bottom:16px;">${distributionBar(groupCounts)}</div>` : ''}

    ${workouts.length ? `
      <div class="section-heading">Разпределение на времето</div>
      <div class="row" style="margin-bottom:8px;">
        ${TIME_RANGES.map((r) => `<button class="btn ${r.id === timeRange ? 'btn-primary' : 'btn-ghost'}" data-time-range="${r.id}" style="font-size:11.5px;padding:8px 4px;">${r.label}</button>`).join('')}
      </div>
      <div class="card" style="margin-bottom:16px;">
        ${(fitnessMinutes || sportEntries.length)
          ? timeDistributionChart(fitnessMinutes, sportEntries)
          : `<div class="empty-state" style="padding:8px;">Няма тренировки в този период.</div>`}
      </div>
    ` : ''}

    ${MUSCLE_GROUPS.map((g) => `
      <div class="section-heading" style="display:flex;align-items:center;justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block;"></span>
          ${g.label}
        </span>
        ${volumeByGroup[g.id] ? `<span style="text-transform:none;letter-spacing:0;font-size:11.5px;">${fmtVolume(volumeByGroup[g.id])} кг общо</span>` : ''}
      </div>
      <div class="card">
        ${(byGroup[g.id] || []).length
          ? byGroup[g.id].map((e) => exerciseRow(e)).join('')
          : `<div class="empty-state" style="padding:16px;">Няма упражнения тук.</div>`}
      </div>
    `).join('')}

    <button class="fab" id="add-ex-fab">${plusIcon()}</button>
    <div id="modal-root"></div>
  `;

  renderMuscleMap(root.querySelector('#muscle-map-root'), weekGroupCounts, BODY_MAP_GROUPS);

  root.querySelectorAll('[data-open-ex]').forEach((row) => {
    row.onclick = () => openExerciseHistory(root, Number(row.dataset.openEx), row.dataset.exName);
  });
  root.querySelectorAll('[data-edit-ex]').forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      openEditExercise(root, Number(btn.dataset.editEx));
    };
  });
  root.querySelectorAll('[data-time-range]').forEach((btn) => {
    btn.onclick = () => {
      timeRange = btn.dataset.timeRange;
      renderExercises(root);
    };
  });

  root.querySelector('#add-ex-fab').onclick = () => openAddExercise(root);
}

function shiftDate(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function distributionBar(groupCounts) {
  const total = Object.values(groupCounts).reduce((s, n) => s + n, 0) || 1;
  const active = MUSCLE_GROUPS.filter((g) => groupCounts[g.id]);
  const segments = active.map((g) => `<div style="width:${((groupCounts[g.id] / total) * 100).toFixed(1)}%;background:${g.color};height:100%;"></div>`).join('');
  const legend = active.map((g) => `
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-faint);">
      <span style="width:7px;height:7px;border-radius:50%;background:${g.color};display:inline-block;"></span>${g.label}
    </div>`).join('');
  return `
    <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--surface-strong);">${segments}</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">${legend}</div>`;
}

function timeDistributionChart(fitnessMinutes, sportEntries) {
  const segments = [
    { label: 'Фитнес', minutes: fitnessMinutes, color: 'var(--accent)' },
    ...sportEntries.map(([name, minutes], i) => ({ label: name, minutes, color: SPORT_COLORS[i % SPORT_COLORS.length] })),
  ].filter((seg) => seg.minutes > 0);
  const total = segments.reduce((s, seg) => s + seg.minutes, 0) || 1;
  const bars = segments.map((seg) => `<div style="width:${((seg.minutes / total) * 100).toFixed(1)}%;background:${seg.color};height:100%;"></div>`).join('');
  const legend = segments.map((seg) => `
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-faint);">
      <span style="width:7px;height:7px;border-radius:50%;background:${seg.color};display:inline-block;"></span>${seg.label} · ${fmtHoursMinutes(seg.minutes)}
    </div>`).join('');
  return `
    <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--surface-strong);">${bars}</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">${legend}</div>`;
}

function durationMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function fmtHoursMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h === 0 ? `${m}м` : `${h}ч ${m}м`;
}

function exerciseRow(e) {
  return `<div class="list-row">
    <span data-open-ex="${e.id}" data-ex-name="${escapeHtml(e.name)}" style="flex:1;font-size:14.5px;cursor:pointer;">${escapeHtml(e.name)}</span>
    <button class="icon-btn" data-edit-ex="${e.id}" title="Редактирай">${editIcon()}</button>
  </div>`;
}

async function openExerciseHistory(root, exerciseId, name) {
  const modalRoot = root.querySelector('#modal-root');
  const allSets = await DB.getAllByIndex('workoutSets', 'exerciseId', exerciseId).catch(() => []);
  // workoutSets store has no direct index on exerciseId in schema v1 -> filter manually as fallback
  let sets = allSets;
  if (!sets || !sets.length) {
    const all = await DB.getAll('workoutSets');
    sets = all.filter((s) => s.exerciseId === exerciseId);
  }
  sets.sort((a, b) => a.date.localeCompare(b.date));

  const ex = await DB.get('exercises', exerciseId);
  if (ex && ex.muscleGroup === SPORT_GROUP_ID) {
    const totalMinutes = sets.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgMinutes = sets.length ? Math.round(totalMinutes / sets.length) : 0;
    renderSheet(modalRoot, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:14px;">${escapeHtml(name)}</h3>
      ${sets.length ? `
        <div class="stat-row" style="margin-bottom:14px;">
          <div class="stat-tile">
            <div class="stat-value">${fmtHoursMinutes(totalMinutes)}</div>
            <div class="stat-label">общо време</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${sets.length}</div>
            <div class="stat-label">тренировки</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${avgMinutes} мин</div>
            <div class="stat-label">средно на тренировка</div>
          </div>
        </div>` : ''}
      ${sets.length
        ? `<div class="card">${sets.slice().reverse().slice(0, 30).map((s) => `
            <div class="list-row"><span style="font-size:13px;color:var(--text-dim);">${fmtShort(s.date)}</span><span>${s.duration} мин</span></div>
          `).join('')}</div>`
        : `<div class="empty-state">Все още няма история за това упражнение.</div>`}
    `, () => { modalRoot.innerHTML = ''; });
    return;
  }

  const maxByDate = {};
  sets.forEach((s) => { maxByDate[s.date] = Math.max(maxByDate[s.date] || 0, s.weight); });
  const points = Object.entries(maxByDate);
  const totalVolume = sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
  const maxWeight = sets.length ? Math.max(...sets.map((s) => s.weight || 0)) : 0;
  const totalReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);

  renderSheet(modalRoot, `
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">${escapeHtml(name)}</h3>
    ${sets.length ? `
      <div class="stat-row" style="margin-bottom:14px;">
        <div class="stat-tile">
          <div class="stat-value">${fmtVolume(totalVolume)}</div>
          <div class="stat-label">общо вдигнати кг</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">${maxWeight}</div>
          <div class="stat-label">макс. кг</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">${sets.length}</div>
          <div class="stat-label">серии общо</div>
        </div>
        <div class="stat-tile">
          <div class="stat-value">${fmtVolume(totalReps)}</div>
          <div class="stat-label">общо повторения</div>
        </div>
      </div>` : ''}
    ${points.length ? `<div class="card" style="margin-bottom:14px;">${sparkline(points)}</div>` : ''}
    ${sets.length
      ? `<div class="card">${sets.slice().reverse().slice(0, 30).map((s) => `
          <div class="list-row"><span style="font-size:13px;color:var(--text-dim);">${fmtShort(s.date)}</span><span>${s.reps} × ${s.weight}кг</span></div>
        `).join('')}</div>`
      : `<div class="empty-state">Все още няма история за това упражнение.</div>`}
  `, () => { modalRoot.innerHTML = ''; });
}

function sparkline(points) {
  const w = 300, h = 100, pad = 10;
  const weights = points.map((p) => p[1]);
  const min = Math.min(...weights), max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p[1] - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const dots = coords.map((c) => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3" fill="var(--accent)"></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100px;display:block;">
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"></path>
    ${dots}
  </svg>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:4px;">
    <span>${fmtShort(points[0][0])}</span><span>макс ${max}кг</span><span>${fmtShort(points[points.length - 1][0])}</span>
  </div>`;
}

function openAddExercise(root) {
  const modalRoot = root.querySelector('#modal-root');
  function close() { modalRoot.innerHTML = ''; }

  renderSheet(modalRoot, `
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">Ново упражнение</h3>
    <div class="field"><label>Име</label><input type="text" id="new-ex-name"></div>
    <div class="field">
      <label>Мускулна група</label>
      <select id="new-ex-group">${MUSCLE_GROUPS.map((g) => `<option value="${g.id}">${g.label}</option>`).join('')}</select>
    </div>
    <button class="btn btn-primary btn-block" id="save-new-ex">Запази</button>
  `, close);

  modalRoot.querySelector('#save-new-ex').onclick = async () => {
    const name = modalRoot.querySelector('#new-ex-name').value.trim();
    if (!name) return;
    const muscleGroup = modalRoot.querySelector('#new-ex-group').value;
    await DB.add('exercises', { name, muscleGroup, custom: true });
    close();
    renderExercises(root);
  };
}

async function openEditExercise(root, id) {
  const modalRoot = root.querySelector('#modal-root');
  const ex = await DB.get('exercises', id);
  function close() { modalRoot.innerHTML = ''; }

  renderSheet(modalRoot, `
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">Редакция на упражнение</h3>
    <div class="field"><label>Име</label><input type="text" id="edit-ex-name" value="${escapeHtml(ex.name)}"></div>
    <div class="field">
      <label>Мускулна група</label>
      <select id="edit-ex-group">${MUSCLE_GROUPS.map((g) => `<option value="${g.id}" ${g.id === ex.muscleGroup ? 'selected' : ''}>${g.label}</option>`).join('')}</select>
    </div>
    <button class="btn btn-primary btn-block" id="save-edit-ex" style="margin-bottom:8px;">Запази</button>
    <button class="btn btn-ghost btn-block" id="delete-ex-btn" style="margin-bottom:8px;color:var(--danger);">Изтрий упражнението</button>
    <button class="btn btn-ghost btn-block" id="cancel-edit-ex">Отказ</button>
  `, close);

  modalRoot.querySelector('#cancel-edit-ex').onclick = close;
  modalRoot.querySelector('#save-edit-ex').onclick = async () => {
    const name = modalRoot.querySelector('#edit-ex-name').value.trim();
    if (!name) return;
    const muscleGroup = modalRoot.querySelector('#edit-ex-group').value;
    await DB.put('exercises', { ...ex, name, muscleGroup });
    close();
    renderExercises(root);
  };
  modalRoot.querySelector('#delete-ex-btn').onclick = async () => {
    if (!confirmDelete('Да изтрия ли това упражнение? Историята от вече записани тренировки с него ще остане.')) return;
    await DB.delete('exercises', id);
    close();
    renderExercises(root);
  };
}

function fmtVolume(n) {
  return Math.round(n).toLocaleString('bg-BG');
}

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function plusIcon() { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`; }
function editIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`; }
