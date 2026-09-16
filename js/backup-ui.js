import { renderSheet } from './sheet.js';
import { backupNow, restoreWithCode, fetchOwnCloudBackup, getBackupCode, lastBackupAt } from './backup.js';

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
    const code = getBackupCode();
    const cloud = await fetchOwnCloudBackup();

    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:4px;">Резервно копие</h3>
      <p style="color:var(--text-faint);font-size:12.5px;margin:0 0 16px;">Данните ти се архивират автоматично в облака при всяка промяна.</p>

      <div class="card" style="margin-bottom:12px;">
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:6px;">Твоят код за възстановяване</div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:600;letter-spacing:0.04em;">${code}</div>
        <p style="color:var(--text-faint);font-size:12px;margin:8px 0 0;">Запази го някъде извън приложението (напр. в Notes) — ще ти трябва само ако изтриеш и добавиш иконата наново. Всеки друг човек, който отвори линка, получава свой собствен код и празен профил — твоите данни остават само твои.</p>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div style="font-size:13px;color:var(--text-dim);margin-bottom:4px;">Последно архивирано</div>
        <div style="font-size:14.5px;">${cloud?.savedAt ? fmtDate(cloud.savedAt) : 'Все още няма архив в облака'}</div>
      </div>

      ${status ? `<p style="text-align:center;font-size:13px;color:var(--text-faint);margin:0 0 12px;">${status}</p>` : ''}

      <button class="btn btn-primary btn-block" id="backup-now-btn" style="margin-bottom:8px;">Архивирай сега</button>
      <button class="btn btn-ghost btn-block" id="restore-btn">Възстанови с код</button>
    `, close);

    overlay.querySelector('#backup-now-btn').onclick = async () => {
      overlay.querySelector('#backup-now-btn').textContent = 'Архивиране...';
      const ok = await backupNow();
      draw(ok ? 'Архивирано успешно.' : 'Възникна грешка — провери интернета.');
    };

    overlay.querySelector('#restore-btn').onclick = () => drawRestoreForm();
  }

  function drawRestoreForm() {
    renderSheet(overlay, `
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:10px;">Възстанови с код</h3>
      <p style="color:var(--text-faint);font-size:13px;margin:0 0 14px;">Въведи запазен код от друго устройство или от преди преинсталиране. Това ще презапише текущите данни на устройството.</p>
      <div class="field">
        <input type="text" id="restore-code-input" placeholder="XXXX-XXXX" style="text-align:center;font-size:18px;letter-spacing:0.05em;text-transform:uppercase;">
      </div>
      <button class="btn btn-primary btn-block" id="confirm-restore-btn" style="margin-bottom:8px;">Възстанови</button>
      <button class="btn btn-ghost btn-block" id="cancel-restore-btn">Отказ</button>
    `, close);

    overlay.querySelector('#cancel-restore-btn').onclick = () => draw();
    overlay.querySelector('#confirm-restore-btn').onclick = async () => {
      const input = overlay.querySelector('#restore-code-input');
      const code = input.value.trim();
      if (!code) return;
      const btn = overlay.querySelector('#confirm-restore-btn');
      btn.textContent = 'Възстановяване...';
      const ok = await restoreWithCode(code);
      if (ok) {
        location.reload();
      } else {
        btn.textContent = 'Възстанови';
        input.style.borderColor = 'var(--danger)';
        const err = document.createElement('p');
        err.style.cssText = 'color:var(--danger);font-size:13px;text-align:center;margin:0 0 10px;';
        err.textContent = 'Няма архив с този код.';
        btn.parentElement.insertBefore(err, btn);
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
