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
    <ellipse cx="46" cy="78" rx="17" ry="15" fill="${c('shoulders')}" stroke="${stroke}"></ellipse>
    <ellipse cx="154" cy="78" rx="17" ry="15" fill="${c('shoulders')}" stroke="${stroke}"></ellipse>`;

  const armColor = c(view === 'front' ? 'biceps' : 'triceps');
  const arms = `
    <path d="M32,80 C22,95 18,118 20,142 L44,146 C46,120 48,98 54,84 C46,76 38,76 32,80 Z" fill="${armColor}" stroke="${stroke}"></path>
    <path d="M168,80 C178,95 182,118 180,142 L156,146 C154,120 152,98 146,84 C154,76 162,76 168,80 Z" fill="${armColor}" stroke="${stroke}"></path>
    <path d="M20,142 C17,165 19,188 26,208 L42,210 C44,188 45,165 44,146 Z" fill="${neutral}" stroke="${stroke}"></path>
    <path d="M180,142 C183,165 181,188 174,208 L158,210 C156,188 155,165 156,146 Z" fill="${neutral}" stroke="${stroke}"></path>
    <ellipse cx="32" cy="222" rx="11" ry="14" fill="${neutral}" stroke="${stroke}"></ellipse>
    <ellipse cx="168" cy="222" rx="11" ry="14" fill="${neutral}" stroke="${stroke}"></ellipse>`;

  const torso = view === 'front'
    ? `
    <path d="M50,70 C40,85 38,105 44,122 L156,122 C162,105 160,85 150,70 C130,58 70,58 50,70 Z" fill="${c('chest')}" stroke="${stroke}"></path>
    <path d="M44,122 L156,122 C160,145 156,168 146,188 C130,198 70,198 54,188 C44,168 40,145 44,122 Z" fill="${c('core')}" stroke="${stroke}"></path>`
    : `
    <path d="M42,68 C32,90 30,115 36,140 C34,165 38,185 50,200 L150,200 C162,185 166,165 164,140 C170,115 168,90 158,68 C140,56 60,56 42,68 Z" fill="${c('back')}" stroke="${stroke}"></path>`;

  const legs = `
    <path d="M54,188 L146,188 C148,196 148,204 146,210 L54,210 C52,204 52,196 54,188 Z" fill="${neutral}" stroke="${stroke}"></path>
    <path d="M56,210 C48,230 46,255 50,278 L92,278 C94,255 92,230 88,210 Z" fill="${c('legs')}" stroke="${stroke}"></path>
    <path d="M144,210 C152,230 154,255 150,278 L108,278 C106,255 108,230 112,210 Z" fill="${c('legs')}" stroke="${stroke}"></path>
    <path d="M50,278 C47,305 48,332 54,355 L88,355 C92,332 93,305 92,278 Z" fill="${neutral}" stroke="${stroke}"></path>
    <path d="M150,278 C153,305 152,332 146,355 L112,355 C108,332 107,305 108,278 Z" fill="${neutral}" stroke="${stroke}"></path>
    <ellipse cx="68" cy="368" rx="20" ry="10" fill="${neutral}" stroke="${stroke}"></ellipse>
    <ellipse cx="132" cy="368" rx="20" ry="10" fill="${neutral}" stroke="${stroke}"></ellipse>`;

  return `
    <svg viewBox="0 0 200 400" style="width:100%;max-width:220px;height:auto;display:block;margin:0 auto;">
      <g stroke-width="1.5">
        <ellipse cx="100" cy="28" rx="19" ry="23" fill="${neutral}" stroke="${stroke}"></ellipse>
        <path d="M88,48 L112,48 L107,64 L93,64 Z" fill="${neutral}" stroke="${stroke}"></path>
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
