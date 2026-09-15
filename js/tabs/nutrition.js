import { DB, todayISO, fmtDateHuman, toISODateLocal } from '../db.js';
import { searchOpenFoodFacts } from '../food-api.js';
import { openRemindersManager } from '../reminders.js';

let currentDate = todayISO();

export async function renderNutrition(root) {
  const [allLogs, goals] = await Promise.all([
    DB.getAll('foodLog'),
    getGoals(),
  ]);

  const logs = allLogs.filter((l) => l.date === currentDate);
  const totals = sumLogs(logs);

  const todayIso = todayISO();
  const streak = computeStreak(allLogs, todayIso);
  const last7 = computeLast7(allLogs, todayIso);
  const avg7 = Math.round(last7.reduce((s, d) => s + d.kcal, 0) / 7);
  const kcalPct = pct(totals.kcal, goals.kcalGoal);
  const remaining = goals.kcalGoal - totals.kcal;

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <h1 class="page-title" style="margin:0;">Храна</h1>
      <button class="icon-btn" id="reminder-btn" title="Напомняне">${bellIcon()}</button>
    </div>

    <div class="row" style="align-items:center;margin-bottom:14px;">
      <button class="btn-icon" id="prev-day">${chevron('left')}</button>
      <div style="text-align:center;flex:3;font-size:14px;color:var(--text-dim);text-transform:capitalize;">${fmtDateHuman(currentDate)}</div>
      <button class="btn-icon" id="next-day">${chevron('right')}</button>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;gap:16px;">
        ${donutRing(kcalPct)}
        <div style="flex:1;min-width:0;">
          <div style="font-size:24px;font-family:'Space Grotesk',sans-serif;font-weight:600;line-height:1.1;">${Math.round(totals.kcal)} <span style="font-size:13px;color:var(--text-faint);font-weight:400;">/ ${goals.kcalGoal} kcal</span></div>
          <div style="font-size:12.5px;color:${remaining >= 0 ? 'var(--text-faint)' : 'var(--danger)'};margin-top:3px;">${remaining >= 0 ? `остават ${Math.round(remaining)} kcal` : `${Math.round(-remaining)} kcal над целта`}</div>
        </div>
        <button class="icon-btn" id="edit-goals">${gearIcon()}</button>
      </div>
      <div style="margin-top:16px;">
        ${macroBar('Протеин', totals.protein, goals.proteinGoal, 'var(--accent)')}
        ${macroBar('Въглехидрати', totals.carbs, goals.carbsGoal, 'var(--silver)')}
        ${macroBar('Мазнини', totals.fat, goals.fatGoal, '#8a8f91')}
      </div>
    </div>

    <div class="stat-row" style="margin-top:14px;">
      <div class="stat-tile">
        <div class="stat-value">${streak}</div>
        <div class="stat-label">${streak === 1 ? 'ден поред' : 'дни поред'}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${avg7}</div>
        <div class="stat-label">средно / 7 дни</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${logs.length}</div>
        <div class="stat-label">записа днес</div>
      </div>
    </div>

    <div class="section-heading">Последните 7 дни</div>
    <div class="card">${weekBarChart(last7, goals.kcalGoal, todayIso)}</div>

    <div class="section-heading">Дневник</div>
    <div class="card" id="log-list">
      ${logs.length ? logs.map(logRow).join('') : `<div class="empty-state">Няма въведени храни за този ден.</div>`}
    </div>

    <button class="fab" id="add-food-fab">${plusIcon()}</button>
    <div id="modal-root"></div>
  `;

  root.querySelector('#prev-day').onclick = () => { currentDate = shiftDate(currentDate, -1); renderNutrition(root); };
  root.querySelector('#next-day').onclick = () => { currentDate = shiftDate(currentDate, 1); renderNutrition(root); };
  root.querySelector('#edit-goals').onclick = () => openGoalsModal(root);
  root.querySelector('#add-food-fab').onclick = () => openAddFoodModal(root);
  root.querySelector('#reminder-btn').onclick = () => openRemindersManager();

  root.querySelectorAll('[data-delete-log]').forEach((btn) => {
    btn.onclick = async () => {
      await DB.delete('foodLog', Number(btn.dataset.deleteLog));
      renderNutrition(root);
    };
  });
}

function sumLogs(logs) {
  return logs.reduce(
    (acc, l) => { acc.kcal += l.kcal; acc.protein += l.protein; acc.carbs += l.carbs; acc.fat += l.fat; return acc; },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function computeStreak(allLogs, todayIso) {
  const dates = new Set(allLogs.map((l) => l.date));
  let streak = 0;
  let cursor = todayIso;
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function computeLast7(allLogs, todayIso) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const iso = shiftDate(todayIso, -i);
    const kcal = allLogs.filter((l) => l.date === iso).reduce((s, l) => s + l.kcal, 0);
    days.push({ date: iso, kcal });
  }
  return days;
}

function donutRing(percent) {
  const r = 38, c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c * (1 - clamped / 100);
  const color = percent > 100 ? 'var(--danger)' : 'var(--accent)';
  return `
    <div style="position:relative;width:88px;height:88px;flex-shrink:0;">
      <svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg);">
        <circle cx="44" cy="44" r="${r}" fill="none" stroke="var(--surface-strong)" stroke-width="7"></circle>
        <circle cx="44" cy="44" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" style="transition:stroke-dashoffset 0.4s ease;"></circle>
      </svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:600;">${Math.round(percent)}%</div>
    </div>`;
}

function weekBarChart(days, goal, todayIso) {
  const maxVal = Math.max(goal, ...days.map((d) => d.kcal), 1);
  const h = 84;
  const bars = days.map((d) => {
    const barH = d.kcal === 0 ? 3 : Math.max(4, (d.kcal / maxVal) * h);
    const over = d.kcal > goal;
    const label = new Date(d.date + 'T00:00:00').toLocaleDateString('bg-BG', { weekday: 'narrow' });
    const isToday = d.date === todayIso;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;">
        <div style="width:100%;height:${h}px;display:flex;align-items:flex-end;justify-content:center;">
          <div style="width:60%;height:${barH.toFixed(0)}px;border-radius:5px;background:${over ? 'var(--danger)' : 'var(--accent)'};opacity:${d.kcal === 0 ? 0.15 : 1};"></div>
        </div>
        <div style="font-size:10px;font-weight:${isToday ? '600' : '400'};color:${isToday ? 'var(--text)' : 'var(--text-faint)'};text-transform:uppercase;">${label}</div>
      </div>`;
  }).join('');
  return `<div style="display:flex;gap:8px;align-items:flex-end;">${bars}</div>`;
}

function logRow(l) {
  return `
    <div class="list-row">
      <div>
        <div style="font-size:14.5px;">${escapeHtml(l.foodName)}</div>
        <div style="font-size:12px;color:var(--text-faint);">${l.qtyLabel} · ${Math.round(l.kcal)} kcal · Б${Math.round(l.protein)} В${Math.round(l.carbs)} М${Math.round(l.fat)}</div>
      </div>
      <button class="icon-btn" data-delete-log="${l.id}">${trashIcon()}</button>
    </div>`;
}

async function getGoals() {
  const g = await DB.get('settings', 'goals');
  return g || { id: 'goals', kcalGoal: 2200, proteinGoal: 150, carbsGoal: 220, fatGoal: 70 };
}

function pct(val, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((val / goal) * 100));
}

function macroBar(label, val, goal, color) {
  return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-dim);margin-bottom:5px;">
        <span>${label}</span><span>${Math.round(val)} / ${goal}g</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct(val, goal)}%;background:${color};"></div>
      </div>
    </div>`;
}

function shiftDate(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toISODateLocal(d);
}

// ---------- Add food modal ----------

function openAddFoodModal(root) {
  const modalRoot = root.querySelector('#modal-root');
  let step = 'search';
  let selectedFood = null;
  let searchResults = [];
  let localMatches = [];
  let currentQuery = '';

  function close() { modalRoot.innerHTML = ''; }

  async function runLocalSearch(q) {
    const all = await DB.getAll('foods');
    localMatches = q ? all.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) : all.slice(-10).reverse();
    renderResults();
  }

  async function runOnlineSearch(q) {
    const btn = modalRoot.querySelector('#online-search-btn');
    if (btn) btn.textContent = 'Търсене...';
    try {
      searchResults = await searchOpenFoodFacts(q);
    } catch (e) {
      searchResults = [];
    }
    if (btn) btn.textContent = 'Търси онлайн (Open Food Facts)';
    renderResults();
  }

  function renderResults() {
    const area = modalRoot.querySelector('#results-area');
    if (!area) return;
    area.innerHTML = `
      ${localMatches.length ? `<div class="section-heading">Моите храни</div>` : ''}
      ${localMatches.map((f, i) => foodResultRow(f, 'local', i)).join('')}
      ${searchResults.length ? `<div class="section-heading">Резултати онлайн</div>` : ''}
      ${searchResults.map((f, i) => foodResultRow(f, 'online', i)).join('')}
    `;
    area.querySelectorAll('[data-pick-food]').forEach((el) => {
      el.onclick = async () => {
        const idx = Number(el.dataset.pickFood);
        const kind = el.dataset.kind;
        if (kind === 'local') {
          selectedFood = localMatches[idx];
        } else {
          const f = searchResults[idx];
          const id = await DB.add('foods', f);
          selectedFood = { ...f, id };
        }
        step = 'quantity';
        draw();
      };
    });
  }

  function drawSearchShell() {
    modalRoot.innerHTML = sheetWrap(`
      <div class="field">
        <input type="text" id="food-search" placeholder="Търси храна..." autocomplete="off" value="${escapeHtml(currentQuery)}">
      </div>
      <button class="btn btn-ghost btn-block" id="online-search-btn" style="margin-bottom:14px;">Търси онлайн (Open Food Facts)</button>
      <button class="btn btn-ghost btn-block" id="manual-add-btn" style="margin-bottom:14px;">Ръчно въвеждане на храна</button>
      <div id="results-area"></div>
    `);
    const input = modalRoot.querySelector('#food-search');
    input.focus();
    const pos = currentQuery.length;
    input.setSelectionRange(pos, pos);
    input.oninput = () => {
      currentQuery = input.value;
      runLocalSearch(currentQuery.trim());
    };
    modalRoot.querySelector('#online-search-btn').onclick = () => {
      const q = input.value.trim();
      if (q) runOnlineSearch(q);
    };
    modalRoot.querySelector('#manual-add-btn').onclick = () => { step = 'manual'; draw(); };
    modalRoot.querySelector('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) close(); };
    renderResults();
  }

  function draw() {
    if (step === 'search') {
      drawSearchShell();
    } else if (step === 'manual') {
      modalRoot.innerHTML = sheetWrap(`
        <h3 style="margin-bottom:14px;">Нова храна</h3>
        <div class="field"><label>Име</label><input type="text" id="m-name"></div>
        <div class="field">
          <label>Мерна единица</label>
          <select id="m-unit">
            <option value="g">На 100 грама</option>
            <option value="serving">За 1 порция</option>
          </select>
        </div>
        <div class="row">
          <div class="field"><label>Калории</label><input type="number" id="m-kcal" inputmode="decimal"></div>
          <div class="field"><label>Протеин (g)</label><input type="number" id="m-protein" inputmode="decimal"></div>
        </div>
        <div class="row">
          <div class="field"><label>Въглехидрати (g)</label><input type="number" id="m-carbs" inputmode="decimal"></div>
          <div class="field"><label>Мазнини (g)</label><input type="number" id="m-fat" inputmode="decimal"></div>
        </div>
        <button class="btn btn-primary btn-block" id="save-manual">Запази и продължи</button>
      `);
      modalRoot.querySelector('#save-manual').onclick = async () => {
        const name = modalRoot.querySelector('#m-name').value.trim();
        if (!name) return;
        const food = {
          name,
          unit: modalRoot.querySelector('#m-unit').value,
          kcal100: Number(modalRoot.querySelector('#m-kcal').value) || 0,
          protein100: Number(modalRoot.querySelector('#m-protein').value) || 0,
          carbs100: Number(modalRoot.querySelector('#m-carbs').value) || 0,
          fat100: Number(modalRoot.querySelector('#m-fat').value) || 0,
          source: 'custom',
        };
        const id = await DB.add('foods', food);
        selectedFood = { ...food, id };
        step = 'quantity';
        draw();
      };
    } else if (step === 'quantity') {
      const unitLabel = selectedFood.unit === 'serving' ? 'Брой порции' : 'Грамове';
      modalRoot.innerHTML = sheetWrap(`
        <h3 style="margin-bottom:6px;">${escapeHtml(selectedFood.name)}</h3>
        <p style="color:var(--text-faint);font-size:13px;margin:0 0 14px;">${selectedFood.unit === 'serving' ? 'На 1 порция' : 'На 100г'}: ${selectedFood.kcal100} kcal · Б${selectedFood.protein100} В${selectedFood.carbs100} М${selectedFood.fat100}</p>
        <div class="field">
          <label>${unitLabel}</label>
          <input type="number" id="qty-input" inputmode="decimal" value="${selectedFood.unit === 'serving' ? '1' : '100'}">
        </div>
        <div class="card" id="qty-preview" style="margin-bottom:16px;"></div>
        <button class="btn btn-primary btn-block" id="confirm-add">Добави в дневника</button>
      `);
      const qtyInput = modalRoot.querySelector('#qty-input');
      const preview = modalRoot.querySelector('#qty-preview');
      function updatePreview() {
        const qty = Number(qtyInput.value) || 0;
        const factor = selectedFood.unit === 'serving' ? qty : qty / 100;
        preview.innerHTML = `${Math.round(selectedFood.kcal100 * factor)} kcal · Б${round1(selectedFood.protein100 * factor)} В${round1(selectedFood.carbs100 * factor)} М${round1(selectedFood.fat100 * factor)}`;
      }
      qtyInput.oninput = updatePreview;
      updatePreview();

      modalRoot.querySelector('#confirm-add').onclick = async () => {
        const qty = Number(qtyInput.value) || 0;
        const factor = selectedFood.unit === 'serving' ? qty : qty / 100;
        await DB.add('foodLog', {
          date: currentDate,
          foodId: selectedFood.id ?? null,
          foodName: selectedFood.name,
          qtyLabel: selectedFood.unit === 'serving' ? `${qty} порция` : `${qty}г`,
          kcal: selectedFood.kcal100 * factor,
          protein: selectedFood.protein100 * factor,
          carbs: selectedFood.carbs100 * factor,
          fat: selectedFood.fat100 * factor,
        });
        close();
        renderNutrition(root);
      };
    }
  }

  draw();
  runLocalSearch('');
}

function foodResultRow(f, kind, idx) {
  const unitLabel = f.unit === 'serving' ? 'порция' : '100г';
  return `
    <div class="list-row" data-pick-food="${idx}" data-kind="${kind}" style="cursor:pointer;">
      <div>
        <div style="font-size:14px;">${escapeHtml(f.name)}</div>
        <div style="font-size:12px;color:var(--text-faint);">${unitLabel}: ${f.kcal100} kcal · Б${f.protein100} В${f.carbs100} М${f.fat100}${f.brand ? ' · ' + escapeHtml(f.brand) : ''}</div>
      </div>
      ${chevron('right')}
    </div>`;
}

function sheetWrap(inner) {
  return `<div class="modal-overlay"><div class="modal-sheet"><div class="modal-handle"></div>${inner}</div></div>`;
}

function round1(n) { return Math.round(n * 10) / 10; }
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- Goals modal ----------
async function openGoalsModal(root) {
  const modalRoot = root.querySelector('#modal-root');
  const goals = await getGoals();
  modalRoot.innerHTML = sheetWrap(`
    <h3 style="margin-bottom:14px;">Дневни цели</h3>
    <div class="field"><label>Калории</label><input type="number" id="g-kcal" value="${goals.kcalGoal}"></div>
    <div class="row">
      <div class="field"><label>Протеин (g)</label><input type="number" id="g-protein" value="${goals.proteinGoal}"></div>
      <div class="field"><label>Въглехидрати (g)</label><input type="number" id="g-carbs" value="${goals.carbsGoal}"></div>
    </div>
    <div class="field"><label>Мазнини (g)</label><input type="number" id="g-fat" value="${goals.fatGoal}"></div>
    <button class="btn btn-primary btn-block" id="save-goals">Запази</button>
  `);
  modalRoot.querySelector('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#save-goals').onclick = async () => {
    await DB.put('settings', {
      id: 'goals',
      kcalGoal: Number(modalRoot.querySelector('#g-kcal').value) || 0,
      proteinGoal: Number(modalRoot.querySelector('#g-protein').value) || 0,
      carbsGoal: Number(modalRoot.querySelector('#g-carbs').value) || 0,
      fatGoal: Number(modalRoot.querySelector('#g-fat').value) || 0,
    });
    modalRoot.innerHTML = '';
    renderNutrition(root);
  };
}


function chevron(dir) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
function plusIcon() { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`; }
function trashIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"></path></svg>`; }
function gearIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`; }
function bellIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`; }
