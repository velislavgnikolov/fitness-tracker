import { armSheetSwipe } from './sheet.js';
import { getCurrentTheme, saveTheme, resetTheme, DEFAULT_THEME } from './theme.js';

export async function openThemeSettings() {
  let overlay = document.getElementById('theme-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'theme-overlay';
    document.body.appendChild(overlay);
  }

  const theme = { ...getCurrentTheme() };

  function close() {
    overlay.innerHTML = '';
  }

  function draw() {
    overlay.innerHTML = `<div class="modal-overlay"><div class="modal-sheet">
      <div class="modal-handle"></div>
      <h3 style="margin-bottom:4px;">Персонализация</h3>
      <p style="color:var(--text-faint);font-size:12.5px;margin:0 0 18px;">Избери двата основни цвята на приложението.</p>

      ${colorField('silver-input', 'Основен цвят', theme.silver)}
      ${colorField('accent-input', 'Акцентен цвят', theme.accent)}

      <div style="display:flex;gap:10px;margin-top:6px;">
        <button class="btn btn-ghost" id="reset-theme-btn" style="flex:1;">По подразбиране</button>
        <button class="btn btn-primary" id="save-theme-btn" style="flex:1;">Готово</button>
      </div>
    </div></div>`;

    overlay.querySelector('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) close(); };
    armSheetSwipe(overlay, close);

    wireColorField('silver-input', (hex) => { theme.silver = hex; previewLive(); });
    wireColorField('accent-input', (hex) => { theme.accent = hex; previewLive(); });

    overlay.querySelector('#reset-theme-btn').onclick = async () => {
      await resetTheme();
      theme.accent = DEFAULT_THEME.accent;
      theme.silver = DEFAULT_THEME.silver;
      draw();
    };
    overlay.querySelector('#save-theme-btn').onclick = async () => {
      await saveTheme(theme);
      close();
    };
  }

  function previewLive() {
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--silver', theme.silver);
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(theme.accent));
    document.documentElement.style.setProperty('--silver-rgb', hexToRgb(theme.silver));
  }

  function wireColorField(id, onChange) {
    const colorInput = overlay.querySelector(`#${id}`);
    const hexInput = overlay.querySelector(`#${id}-hex`);
    colorInput.oninput = () => {
      hexInput.value = colorInput.value;
      onChange(colorInput.value);
    };
    hexInput.oninput = () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        colorInput.value = v;
        onChange(v);
      }
    };
  }

  draw();
}

function colorField(id, label, value) {
  return `
    <div class="field">
      <label>${label}</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <input type="color" id="${id}" value="${value}" style="width:52px;height:52px;border:none;border-radius:14px;background:none;padding:0;cursor:pointer;">
        <input type="text" id="${id}-hex" value="${value}" style="flex:1;text-transform:uppercase;">
      </div>
    </div>`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const bigint = parseInt(full, 16);
  return `${(bigint >> 16) & 255},${(bigint >> 8) & 255},${bigint & 255}`;
}

function paletteIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a9.5 9.5 0 1 1 0-19c4.5 0 8.5 3 8.5 7 0 2.5-1.5 4-3.5 4h-2a2 2 0 0 0-1.2 3.6c.5.4.8 1 .8 1.6 0 1.2-1 2-2 2Z"></path><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="16.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"></circle></svg>`;
}

export { paletteIcon };
