import { DB } from './db.js';

export const DEFAULT_THEME = { accent: '#dc2430', silver: '#c0c6c8' };

let current = { ...DEFAULT_THEME };

export function getCurrentTheme() {
  return current;
}

export async function loadTheme() {
  const saved = await DB.get('settings', 'theme');
  current = saved ? { accent: saved.accent, silver: saved.silver } : { ...DEFAULT_THEME };
  applyThemeToDOM(current);
  return current;
}

export async function saveTheme(theme) {
  current = { ...theme };
  await DB.put('settings', { id: 'theme', accent: theme.accent, silver: theme.silver });
  applyThemeToDOM(current);
}

export function resetTheme() {
  return saveTheme({ ...DEFAULT_THEME });
}

function applyThemeToDOM(theme) {
  const style = document.documentElement.style;
  style.setProperty('--accent', theme.accent);
  style.setProperty('--accent-rgb', hexToRgbString(theme.accent));
  style.setProperty('--silver', theme.silver);
  style.setProperty('--silver-rgb', hexToRgbString(theme.silver));
}

export function hexToRgbString(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `${r},${g},${b}`;
}
