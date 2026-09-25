// Swipeable front/back body diagram showing how many times each muscle
// group was trained this week - color intensity grows with the count
// (capped at 3+), no coloring means untouched this week.
//
// The body art itself (js/body-front.svg, js/body-back.svg) is derived from
// "Muscles front and back.svg" on Wikimedia Commons (CC BY-SA 4.0) - each
// muscle-belly shape's fill was replaced with a __ZONE__ placeholder token
// so it can be recolored per zone at render time; everything else (bone,
// tendon, fiber-line detail) is untouched original artwork.

let showBack = false;
let svgTemplateCache = null; // { front, back } raw template text, fetched once

const BODY_ZONES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'legs'];

async function loadTemplates() {
  if (svgTemplateCache) return svgTemplateCache;
  const [front, back] = await Promise.all([
    fetch('./js/body-front.svg').then((r) => r.text()),
    fetch('./js/body-back.svg').then((r) => r.text()),
  ]);
  svgTemplateCache = { front, back };
  return svgTemplateCache;
}

function fillTemplate(template, groupCounts) {
  return template
    .replaceAll('__CHEST__', intensityColor(groupCounts.chest || 0))
    .replaceAll('__BACK__', intensityColor(groupCounts.back || 0))
    .replaceAll('__SHOULDERS__', intensityColor(groupCounts.shoulders || 0))
    .replaceAll('__BICEPS__', intensityColor(groupCounts.biceps || 0))
    .replaceAll('__TRICEPS__', intensityColor(groupCounts.triceps || 0))
    .replaceAll('__CORE__', intensityColor(groupCounts.core || 0))
    .replaceAll('__LEGS__', intensityColor(groupCounts.legs || 0))
    .replaceAll('__NEUTRAL__', 'var(--surface-strong)');
}

export async function renderMuscleMap(container, groupCounts, relevantGroups) {
  const { front, back } = await loadTemplates();
  const frontSvg = fillTemplate(front, groupCounts).replace('<svg ', '<svg style="width:100%;max-width:220px;height:auto;display:block;margin:0 auto;" ');
  const backSvg = fillTemplate(back, groupCounts).replace('<svg ', '<svg style="width:100%;max-width:220px;height:auto;display:block;margin:0 auto;" ');

  container.innerHTML = `
    <div class="mmap-viewport">
      <div class="mmap-track" id="mmap-track">
        <div class="mmap-panel">${frontSvg}</div>
        <div class="mmap-panel">${backSvg}</div>
      </div>
    </div>
    <div class="mmap-nav">
      <button class="btn-icon" id="mmap-prev">${chevron('left')}</button>
      <div class="mmap-dots">
        <span class="mmap-dot" data-dot="0"></span>
        <span class="mmap-dot" data-dot="1"></span>
      </div>
      <button class="btn-icon" id="mmap-next">${chevron('right')}</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:7px 14px;margin-top:14px;">
      ${relevantGroups.map((g) => `
        <div style="display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text-dim);">
          <span style="width:10px;height:10px;border-radius:3px;background:${intensityColor(groupCounts[g.id] || 0)};flex-shrink:0;"></span>
          ${g.label}${groupCounts[g.id] ? ` · ${groupCounts[g.id]}` : ''}
        </div>`).join('')}
    </div>
    <p style="color:var(--text-faint);font-size:11px;margin:10px 0 0;line-height:1.5;">
      ${relevantGroups.some((g) => !BODY_ZONES.includes(g.id)) ? 'Някои категории не се открояват отделно на фигурата, но се броят в списъка по-горе. ' : ''}Анатомия: Wikimedia Commons (CC BY-SA 4.0).
    </p>
  `;

  const track = container.querySelector('#mmap-track');
  const viewport = container.querySelector('.mmap-viewport');
  applyTrackPosition(track, false);
  updateDots(container);

  container.querySelector('#mmap-prev').onclick = () => { showBack = false; applyTrackPosition(track, true); updateDots(container); };
  container.querySelector('#mmap-next').onclick = () => { showBack = true; applyTrackPosition(track, true); updateDots(container); };

  armSwipe(viewport, track, container);
}

function updateDots(container) {
  container.querySelectorAll('.mmap-dot').forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.dot) === (showBack ? 1 : 0));
  });
}

function applyTrackPosition(track, animate) {
  track.style.transition = animate ? 'transform 0.25s ease' : 'none';
  track.style.transform = `translateX(${showBack ? '-50%' : '0'})`;
}

function armSwipe(viewportEl, track, container) {
  let startX = 0;
  let dragging = false;

  const onStart = (e) => {
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    dragging = true;
    track.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const deltaX = x - startX;
    const vw = viewportEl.clientWidth || 1;
    const deltaPercentOfTrack = (deltaX / vw) * 50;
    const base = showBack ? -50 : 0;
    const next = Math.max(-50, Math.min(0, base + deltaPercentOfTrack));
    track.style.transform = `translateX(${next}%)`;
  };
  const onEnd = (e) => {
    if (!dragging) return;
    dragging = false;
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const deltaX = x - startX;
    const vw = viewportEl.clientWidth || 1;
    if (Math.abs(deltaX) > vw * 0.18) {
      if (deltaX < 0 && !showBack) showBack = true;
      else if (deltaX > 0 && showBack) showBack = false;
    }
    applyTrackPosition(track, true);
    updateDots(container);
  };

  viewportEl.addEventListener('touchstart', onStart, { passive: true });
  viewportEl.addEventListener('touchmove', onMove, { passive: true });
  viewportEl.addEventListener('touchend', onEnd);
  viewportEl.addEventListener('touchcancel', onEnd);
}

function intensityColor(count) {
  if (!count) return 'var(--surface-strong)';
  const pct = Math.min(count, 3) / 3;
  return `color-mix(in srgb, var(--accent) ${Math.round(15 + pct * 75)}%, var(--surface-strong))`;
}

function chevron(dir) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
