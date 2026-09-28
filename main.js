'use strict';
function render() {
  document.querySelectorAll('nav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#app').innerHTML = VIEW[S.tab]();
}
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; save(); render(); return; }
  const t = e.target.closest('[data-act]');
  if (t && ACT[t.dataset.act]) { ACT[t.dataset.act](t); save(); render(); }
});
document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-chg]');
  if (!t || !CHG[t.dataset.chg]) return;
  const r = CHG[t.dataset.chg](t);
  save();
  if (r !== 'keep') render();
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-sub]');
  if (!f) return;
  e.preventDefault();
  SUB[f.dataset.sub](f);
  save(); render();
});
render();

// Установка как приложение: сервис-воркер даёт работу без интернета.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* не критично */ });
}
