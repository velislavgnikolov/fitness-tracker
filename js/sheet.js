// Native confirm dialog used before every destructive delete, so a
// mis-tap on a trash icon never silently loses data.
export function confirmDelete(message = 'Сигурен ли си, че искаш да изтриеш това?') {
  return window.confirm(message);
}

// Renders `innerHtml` into container's bottom sheet, reusing the existing
// .modal-sheet DOM node if one is already open (so a quick content update -
// toggling a checkbox, deleting a row - doesn't retrigger the slide-up
// entrance animation or otherwise flicker). Only wires the backdrop-click
// and swipe-to-dismiss handlers once, on first creation.
export function renderSheet(container, innerHtml, onDismiss) {
  const existing = container.querySelector('.modal-sheet');
  if (existing) {
    existing.innerHTML = innerHtml;
    return;
  }
  container.innerHTML = `<div class="modal-overlay"><div class="modal-sheet">${innerHtml}</div></div>`;
  container.querySelector('.modal-overlay').onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) onDismiss();
  };
  armSheetSwipe(container, onDismiss);
}

export function armSheetSwipe(containerEl, onDismiss) {
  const sheet = containerEl.querySelector('.modal-sheet');
  if (!sheet) return;

  let startY = 0;
  let deltaY = 0;
  let dragging = false;

  const onStart = (e) => {
    if (sheet.scrollTop > 0) return;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    dragging = true;
    sheet.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    deltaY = Math.max(0, y - startY);
    sheet.style.transform = `translateY(${deltaY}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = 'transform 0.2s ease';
    if (deltaY > 110) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(onDismiss, 180);
    } else {
      sheet.style.transform = '';
    }
    deltaY = 0;
  };

  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: true });
  sheet.addEventListener('touchend', onEnd);
  sheet.addEventListener('touchcancel', onEnd);
}
