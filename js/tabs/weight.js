import { DB, todayISO, parseDecimal, toISODateLocal } from '../db.js';
import { renderSheet } from '../sheet.js';

const RANGES = [
  { id: '30', label: '30д', days: 30 },
  { id: '90', label: '90д', days: 90 },
  { id: 'all', label: 'Всички', days: null },
];
let activeRange = '30';

export async function renderWeight(root) {
  const all = (await DB.getAll('weightLog')).sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = all.find((e) => e.date === todayISO());
  const latest = all[all.length - 1];
  const prev = all[all.length - 2];
  const diff = latest && prev ? latest.weightKg - prev.weightKg : null;

  const range = RANGES.find((r) => r.id === activeRange);
  const filtered = range.days ? all.slice(-range.days) : all;

  const weeks = groupByWeek(all).sort((a, b) => b.start.localeCompare(a.start));

  root.innerHTML = `
    <h1 class="page-title">Тегло</h1>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:baseline;gap:10px;">
        <div style="font-size:32px;font-family:'Space Grotesk',sans-serif;font-weight:600;">${latest ? latest.weightKg.toFixed(1) : '—'} <span style="font-size:14px;color:var(--text-dim);font-weight:400;">кг</span></div>
        ${diff != null ? `<span style="font-size:13px;color:${diff <= 0 ? 'var(--success)' : 'var(--danger)'};">${diff > 0 ? '+' : ''}${diff.toFixed(1)}кг</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text-faint);margin-top:2px;">${latest ? fmtShort(latest.date) : 'Няма записи'}</div>
    </div>

    <div class="row" style="margin-bottom:14px;">
      ${RANGES.map((r) => `<button class="btn ${r.id === activeRange ? 'btn-primary' : 'btn-ghost'}" data-range="${r.id}" style="padding:9px;font-size:13px;">${r.label}</button>`).join('')}
    </div>

    ${filtered.length >= 2 ? rangeStats(filtered) : ''}

    <div class="card" style="margin-bottom:16px;">
      ${filtered.length >= 2 ? weightChart(filtered) : `<div class="empty-state">Нужни са поне 2 записа за графика.</div>`}
    </div>

    ${weeks.length ? `
      <div class="section-heading">Средно тегло по седмици</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
        ${weeks.map((wk) => `
          <div class="card" data-week-start="${wk.start}" style="padding:10px 6px;text-align:center;cursor:pointer;">
            <div style="font-size:10.5px;color:var(--text-faint);margin-bottom:4px;">${fmtWeekRange(wk.start, wk.end)}</div>
            <div style="font-size:16px;font-family:'Space Grotesk',sans-serif;font-weight:600;">${wk.avg.toFixed(1)}</div>
            <div style="font-size:10px;color:var(--text-faint);">кг</div>
          </div>`).join('')}
      </div>
    ` : ''}

    <div class="field" style="margin-bottom:18px;">
      <label>Тегло днес (кг)</label>
      <div class="row">
        <input type="text" inputmode="decimal" id="weight-input" value="${todayEntry ? todayEntry.weightKg : ''}" placeholder="напр. 78.4">
        <button class="btn btn-primary" id="save-weight" style="flex:0 0 auto;">Запази</button>
      </div>
    </div>

    <div class="section-heading">История</div>
    <div class="card">
      ${all.length
        ? all.slice().reverse().slice(0, 7).map((e) => `
          <div class="list-row">
            <span style="font-size:13px;color:var(--text-dim);">${fmtShort(e.date)}</span>
            <span>${e.weightKg.toFixed(1)} кг</span>
          </div>`).join('')
        : `<div class="empty-state">Все още няма записи.</div>`}
    </div>

    <div id="modal-root"></div>
  `;

  root.querySelectorAll('[data-range]').forEach((btn) => {
    btn.onclick = () => { activeRange = btn.dataset.range; renderWeight(root); };
  });

  root.querySelectorAll('[data-week-start]').forEach((cell) => {
    cell.onclick = () => openWeekDetail(root, weeks.find((wk) => wk.start === cell.dataset.weekStart));
  });

  root.querySelector('#save-weight').onclick = async () => {
    const val = parseDecimal(root.querySelector('#weight-input').value);
    if (!val) return;
    const date = todayISO();
    if (todayEntry) {
      await DB.put('weightLog', { ...todayEntry, weightKg: val });
    } else {
      await DB.add('weightLog', { date, weightKg: val });
    }
    renderWeight(root);
  };
}

function openWeekDetail(root, week) {
  const modalRoot = root.querySelector('#modal-root');
  const weights = week.entries.map((e) => e.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const change = week.entries.length > 1 ? week.entries[week.entries.length - 1].weightKg - week.entries[0].weightKg : null;

  renderSheet(modalRoot, `
    <div class="modal-handle"></div>
    <h3 style="margin-bottom:14px;">${fmtWeekRange(week.start, week.end)}</h3>
    <div class="stat-row" style="margin-bottom:14px;">
      <div class="stat-tile">
        <div class="stat-value">${week.avg.toFixed(1)}</div>
        <div class="stat-label">средно</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${min.toFixed(1)}–${max.toFixed(1)}</div>
        <div class="stat-label">мин–макс</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value" style="${change != null ? `color:${change <= 0 ? 'var(--success)' : 'var(--danger)'};` : ''}">${change != null ? `${change > 0 ? '+' : ''}${change.toFixed(1)}` : '—'}</div>
        <div class="stat-label">промяна</div>
      </div>
    </div>
    <div class="card">
      ${week.entries.slice().reverse().map((e) => `
        <div class="list-row">
          <span style="font-size:13px;color:var(--text-dim);">${fmtShort(e.date)}</span>
          <span>${e.weightKg.toFixed(1)} кг</span>
        </div>`).join('')}
    </div>
  `, () => { modalRoot.innerHTML = ''; });
}

function groupByWeek(entries) {
  const map = {};
  entries.forEach((e) => {
    const start = weekStartIso(e.date);
    (map[start] ||= []).push(e);
  });
  return Object.keys(map).map((start) => {
    const weekEntries = map[start].slice().sort((a, b) => a.date.localeCompare(b.date));
    const avg = weekEntries.reduce((s, e) => s + e.weightKg, 0) / weekEntries.length;
    return { start, end: weekEndIso(start), entries: weekEntries, avg };
  });
}

function weekStartIso(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // Monday-first
  d.setDate(d.getDate() - dow);
  return toISODateLocal(d);
}

function weekEndIso(startIso) {
  const d = new Date(startIso + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return toISODateLocal(d);
}

function fmtWeekRange(startIso, endIso) {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(endIso + 'T00:00:00');
  const sMonth = s.toLocaleDateString('bg-BG', { month: 'short' });
  const eMonth = e.toLocaleDateString('bg-BG', { month: 'short' });
  if (sMonth === eMonth) return `${s.getDate()}–${e.getDate()} ${eMonth}`;
  return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth}`;
}

function rangeStats(entries) {
  const weights = entries.map((e) => e.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const avg = weights.reduce((s, w) => s + w, 0) / weights.length;
  const change = entries[entries.length - 1].weightKg - entries[0].weightKg;
  const changeColor = change <= 0 ? 'var(--success)' : 'var(--danger)';
  return `
    <div class="stat-row" style="margin-bottom:14px;">
      <div class="stat-tile">
        <div class="stat-value" style="color:${changeColor};">${change > 0 ? '+' : ''}${change.toFixed(1)}</div>
        <div class="stat-label">промяна (кг)</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${avg.toFixed(1)}</div>
        <div class="stat-label">средно</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${min.toFixed(1)}–${max.toFixed(1)}</div>
        <div class="stat-label">мин–макс</div>
      </div>
    </div>`;
}

function weightChart(entries) {
  const w = 320, h = 160, padL = 34, padR = 10, padT = 14, padB = 22;
  const weights = entries.map((e) => e.weightKg);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;
  const stepX = (w - padL - padR) / Math.max(1, entries.length - 1);

  const xy = entries.map((e, i) => [
    padL + i * stepX,
    padT + (h - padT - padB) - ((e.weightKg - min) / range) * (h - padT - padB),
  ]);

  const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xy[xy.length - 1][0].toFixed(1)},${h - padB} L${xy[0][0].toFixed(1)},${h - padB} Z`;

  // moving average trend (window 5)
  const trend = entries.map((_, i) => {
    const win = entries.slice(Math.max(0, i - 4), i + 1);
    return win.reduce((s, e) => s + e.weightKg, 0) / win.length;
  });
  const trendXY = trend.map((val, i) => [
    padL + i * stepX,
    padT + (h - padT - padB) - ((val - min) / range) * (h - padT - padB),
  ]);
  const trendPath = trendXY.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  const gridLines = [0, 0.5, 1].map((t) => {
    const y = padT + t * (h - padT - padB);
    const val = (max - t * range).toFixed(1);
    return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"></line>
            <text x="4" y="${y + 4}" fill="var(--text-faint)" font-size="9">${val}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block;">
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"></stop>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#wfill)"></path>
      <path d="${trendPath}" fill="none" stroke="var(--silver)" stroke-width="1.6" stroke-dasharray="4 3"></path>
      <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.2"></path>
      ${xy.length <= 60 ? xy.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="#f2f1ed"></circle>`).join('') : ''}
    </svg>`;
}

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}
