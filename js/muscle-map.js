// Swipeable front/back body diagram showing how many times each muscle
// group was trained this week - color intensity grows with the count
// (capped at 3+), no coloring means untouched this week.

let showBack = false;

export function renderMuscleMap(container, groupCounts, relevantGroups) {
  container.innerHTML = `
    <div class="mmap-viewport">
      <div class="mmap-track" id="mmap-track">
        <div class="mmap-panel">${bodySvg('front', groupCounts)}</div>
        <div class="mmap-panel">${bodySvg('back', groupCounts)}</div>
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

function bodySvg(view, groupCounts) {
  const c = (id) => intensityColor(groupCounts[id] || 0);
  const neutral = 'var(--surface-strong)';
  const stroke = 'var(--border-strong)';

  const shoulders = `
    <ellipse cx="34" cy="60" rx="17" ry="15" fill="${c('shoulders')}" stroke="${stroke}"></ellipse>
    <ellipse cx="126" cy="60" rx="17" ry="15" fill="${c('shoulders')}" stroke="${stroke}"></ellipse>`;

  const arms = `
    <rect x="12" y="58" width="24" height="68" rx="12" fill="${c(view === 'front' ? 'biceps' : 'triceps')}" stroke="${stroke}"></rect>
    <rect x="124" y="58" width="24" height="68" rx="12" fill="${c(view === 'front' ? 'biceps' : 'triceps')}" stroke="${stroke}"></rect>
    <rect x="9" y="124" width="20" height="58" rx="10" fill="${neutral}" stroke="${stroke}"></rect>
    <rect x="131" y="124" width="20" height="58" rx="10" fill="${neutral}" stroke="${stroke}"></rect>
    <ellipse cx="19" cy="190" rx="10" ry="12" fill="${neutral}" stroke="${stroke}"></ellipse>
    <ellipse cx="141" cy="190" rx="10" ry="12" fill="${neutral}" stroke="${stroke}"></ellipse>`;

  const torso = view === 'front'
    ? `
    <rect x="46" y="52" width="68" height="45" rx="16" fill="${c('chest')}" stroke="${stroke}"></rect>
    <rect x="50" y="95" width="60" height="55" rx="14" fill="${c('core')}" stroke="${stroke}"></rect>`
    : `
    <rect x="40" y="50" width="80" height="100" rx="18" fill="${c('back')}" stroke="${stroke}"></rect>`;

  const legs = `
    <rect x="48" y="148" width="64" height="22" rx="11" fill="${neutral}" stroke="${stroke}"></rect>
    <rect x="46" y="170" width="30" height="140" rx="15" fill="${c('legs')}" stroke="${stroke}"></rect>
    <rect x="84" y="170" width="30" height="140" rx="15" fill="${c('legs')}" stroke="${stroke}"></rect>
    <ellipse cx="61" cy="318" rx="16" ry="10" fill="${neutral}" stroke="${stroke}"></ellipse>
    <ellipse cx="99" cy="318" rx="16" ry="10" fill="${neutral}" stroke="${stroke}"></ellipse>`;

  return `
    <svg viewBox="0 0 160 340" style="width:100%;max-width:220px;height:auto;display:block;margin:0 auto;">
      <g stroke-width="1.5">
        <circle cx="80" cy="22" r="17" fill="${neutral}" stroke="${stroke}"></circle>
        <rect x="72" y="37" width="16" height="12" rx="4" fill="${neutral}" stroke="${stroke}"></rect>
        ${shoulders}
        ${torso}
        ${arms}
        ${legs}
      </g>
    </svg>`;
}

function chevron(dir) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
}
