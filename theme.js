'use strict';
// Тема оформления хранится на каждом устройстве отдельно (в данные для синхронизации не попадает).
const THEMES = [
  { id: 'light', name: 'Светлая', bg: '#F5F1E8', fg: '#1E2320', ac: '#2E6B4E', meta: '#1E2320' },
  { id: 'dark', name: 'Тёмная «Графит»', bg: '#121413', fg: '#ECEFEC', ac: '#34D399', meta: '#0B0D0C' },
  { id: 'oled', name: 'Чёрная (OLED)', bg: '#000000', fg: '#F5F5F5', ac: '#2DD4BF', meta: '#000000' }
];
const THEME_KEY = 'planner-theme';
function getTheme() {
  let t = 'light';
  try { t = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* storage unavailable */ }
  return THEMES.some((x) => x.id === t) ? t : 'light';
}
function applyTheme(id) {
  const th = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.setAttribute('data-theme', th.id);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', th.meta);
}
function setTheme(id) {
  try { localStorage.setItem(THEME_KEY, id); } catch (e) { /* storage unavailable */ }
  applyTheme(id);
}
applyTheme(getTheme());
