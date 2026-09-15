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
