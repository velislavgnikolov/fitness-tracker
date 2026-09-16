import { renderSheet } from './sheet.js';
import { backupNow, restoreFromCloud, fetchCloudBackup, lastBackupAt } from './backup.js';

export async function openBackupPanel() {
  let overlay = document.getElementById('backup-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'backup-overlay';
    document.body.appendChild(overlay);
  }

  function close() {
    overlay.innerHTML = '';
  }

  async function draw(status) {
    const cloud = await fetchCloudBackup();
    const localAt = lastBackupAt();

    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:4px;">Резервно копие</h3>
      <p style="color:var(--text-faint);font-size:12.5px;margin:0 0 16px;">Данните ти се архивират автоматично в облака при всяка промяна.</p>

      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:4px;">Последно архивирано</div>
        <div style="font-size:14.5px;">${cloud?.savedAt ? fmtDate(cloud.savedAt) : 'Все още няма архив в облака'}</div>
      </div>

      ${status ? `<p style="text-align:center;font-size:13px;color:var(--text-faint);margin:0 0 12px;">${status}</p>` : ''}

      <button class="btn btn-primary btn-block" id="backup-now-btn" style="margin-bottom:8px;">Архивирай сега</button>
      <button class="btn btn-ghost btn-block" id="restore-btn" style="color:var(--danger);">Възстанови от облака</button>
    `, close);

    overlay.querySelector('#backup-now-btn').onclick = async () => {
      overlay.querySelector('#backup-now-btn').textContent = 'Архивиране...';
      const ok = await backupNow();
      draw(ok ? 'Архивирано успешно.' : 'Възникна грешка — провери интернета.');
    };

    overlay.querySelector('#restore-btn').onclick = () => confirmRestore();
  }

  function confirmRestore() {
    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:10px;">Сигурен ли си?</h3>
      <p style="color:var(--text-faint);font-size:13.5px;margin:0 0 18px;">Това ще презапише текущите данни на устройството с последното архивирано копие от облака.</p>
      <button class="btn btn-primary btn-block" id="confirm-restore-btn" style="margin-bottom:8px;color:var(--danger);background:none;border:1px solid var(--danger);">Да, възстанови</button>
      <button class="btn btn-ghost btn-block" id="cancel-restore-btn">Отказ</button>
    `, close);

    overlay.querySelector('#cancel-restore-btn').onclick = () => draw();
    overlay.querySelector('#confirm-restore-btn').onclick = async () => {
      overlay.querySelector('#confirm-restore-btn').textContent = 'Възстановяване...';
      const ok = await restoreFromCloud();
      if (ok) {
        location.reload();
      } else {
        draw('Няма намерен архив в облака.');
      }
    };
  }

  draw();
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function backupIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a5 5 0 0 1-1-9.9 6 6 0 0 1 11.6-2A4.5 4.5 0 0 1 17 18H7Z"></path><path d="M12 11v6"></path><path d="m9.5 14.5 2.5-2.5 2.5 2.5"></path></svg>`;
}
