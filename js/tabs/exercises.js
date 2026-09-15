import { DB } from '../db.js';
import { MUSCLE_GROUPS } from '../exercises-seed.js';

export async function renderExercises(root) {
  const exercises = await DB.getAll('exercises');
  const byGroup = {};
  MUSCLE_GROUPS.forEach((g) => byGroup[g.id] = []);
  exercises.forEach((e) => { (byGroup[e.muscleGroup] ||= []).push(e); });

  root.innerHTML = `
    <h1 class="page-title">Тренировки</h1>

    ${MUSCLE_GROUPS.map((g) => `
      <div class="section-heading" style="display:flex;align-items:center;gap:8px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block;"></span>
        ${g.label}
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

  root.querySelectorAll('[data-open-ex]').forEach((row) => {
    row.onclick = () => openExerciseHistory(root, Number(row.dataset.openEx), row.dataset.exName);
  });

  root.querySelector('#add-ex-fab').onclick = () => openAddExercise(root);
}

function exerciseRow(e) {
  return `<div class="list-row" data-open-ex="${e.id}" data-ex-name="${escapeHtml(e.name)}" style="cursor:pointer;">
    <span style="font-size:14.5px;">${escapeHtml(e.name)}</span>
    ${chevron('right')}
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

  const maxByDate = {};
  sets.forEach((s) => { maxByDate[s.date] = Math.max(maxByDate[s.date] || 0, s.weight); });
  const points = Object.entries(maxByDate);

  modalRoot.innerHTML = `<div class="modal-overlay"><div class="modal-sheet">
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">${escapeHtml(name)}</h3>
    ${points.length ? `<div class="card" style="margin-bottom:14px;">${sparkline(points)}</div>` : ''}
    ${sets.length
      ? `<div class="card">${sets.slice().reverse().slice(0, 30).map((s) => `
          <div class="list-row"><span style="font-size:13px;color:var(--text-dim);">${fmtShort(s.date)}</span><span>${s.reps} × ${s.weight}кг</span></div>
        `).join('')}</div>`
      : `<div class="empty-state">Все още няма история за това упражнение.</div>`}
  </div></div>`;

  modalRoot.querySelector('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) modalRoot.innerHTML = ''; };
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
  const dots = coords.map((c) => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3" fill="#d31c2b"></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100px;display:block;">
    <path d="${path}" fill="none" stroke="#d31c2b" stroke-width="2"></path>
    ${dots}
  </svg>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:4px;">
    <span>${fmtShort(points[0][0])}</span><span>макс ${max}кг</span><span>${fmtShort(points[points.length - 1][0])}</span>
  </div>`;
}

function openAddExercise(root) {
  const modalRoot = root.querySelector('#modal-root');
  modalRoot.innerHTML = `<div class="modal-overlay"><div class="modal-sheet">
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">Ново упражнение</h3>
    <div class="field"><label>Име</label><input type="text" id="new-ex-name"></div>
    <div class="field">
      <label>Мускулна група</label>
      <select id="new-ex-group">${MUSCLE_GROUPS.map((g) => `<option value="${g.id}">${g.label}</option>`).join('')}</select>
    </div>
    <button class="btn btn-primary btn-block" id="save-new-ex">Запази</button>
  </div></div>`;

  modalRoot.querySelector('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#save-new-ex').onclick = async () => {
    const name = modalRoot.querySelector('#new-ex-name').value.trim();
    if (!name) return;
    const muscleGroup = modalRoot.querySelector('#new-ex-group').value;
    await DB.add('exercises', { name, muscleGroup, custom: true });
    modalRoot.innerHTML = '';
    renderExercises(root);
  };
}

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function chevron(dir) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
function plusIcon() { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`; }
