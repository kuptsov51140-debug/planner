'use strict';
const KEY = 'planner-v1';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NOW = new Date();
const TODAY = iso(NOW);
const off = (n) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return iso(d); };
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmt1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const num = (v) => parseFloat(String(v).replace(',', '.'));
const dlabel = (s) => { const p = s.split('-'); return WD[new Date(s + 'T00:00:00').getDay()] + ' ' + +p[2] + ' ' + MON[+p[1] - 1]; };

function seed() {
  const set = (w, r) => ({ w: String(w), r: String(r) });
  const blocks = [
    { name: 'Английский до B2', subs: [['Урок в приложении', 22], ['20 новых слов', 20], ['Подкаст на английском', 16], ['Разговорная практика', 8]] },
    { name: 'Запуск проекта', subs: [['1 час работы над проектом', 22], ['Разбор задач на неделю', 4], ['Пост о прогрессе', 8]] },
    { name: 'Финансы', subs: [['Записать траты дня', 28], ['Отложить в накопления', 10], ['Проверка бюджета', 4]] },
    { name: 'Чтение', subs: [['20 страниц книги', 24], ['Заметки по прочитанному', 8]] },
    { name: 'Здоровье', subs: [['Сон до 23:00', 24], ['10 000 шагов', 20], ['2 литра воды', 26], ['Без сладкого', 20]] }
  ].map((b) => ({ name: b.name, subs: b.subs.map((s) => ({ n: s[0], t: s[1] })) }));
  const done = {};
  const ym = TODAY.slice(0, 7);
  blocks.forEach((b, bi) => b.subs.forEach((s, si) => {
    for (let d = 1; d <= NOW.getDate(); d++) if (((bi * 7 + si * 13 + d * 5 + bi * si * 3) % 10) < 6) done[bi + ':' + si + ':' + ym + '-' + pad(d)] = 1;
  }));
  const days = {};
  days[TODAY] = [['Завтрак', 'Овсянка с бананом', 320], ['Завтрак', 'Кофе с молоком', 60], ['Обед', 'Курица с рисом', 540], ['Обед', 'Овощной салат', 120], ['Ужин', 'Творог с ягодами', 260], ['Перекус', 'Яблоко', 80]].map((e) => ({ meal: e[0], name: e[1], kcal: e[2] }));
  [2140, 2310, 1980, 2260, 2050, 2480, 2190, 1920, 2230, 2100].forEach((k, i) => { days[off(-10 + i)] = [{ meal: 'Обед', name: 'Итого за день (пример)', kcal: k }]; });
  return {
    tab: 'goals', sel: 4, y: NOW.getFullYear(), m: NOW.getMonth(), blocks, done,
    cal: { norm: 2200, meal: 'Обед', date: TODAY, days },
    wo: {
      sel: TODAY, pick: 'Жим лёжа', nid: 100,
      catalog: ['Жим лёжа', 'Приседания', 'Тяга штанги', 'Жим стоя', 'Подтягивания', 'Становая тяга'],
      sessions: [
        { date: off(-7), ex: [{ id: 1, name: 'Жим лёжа', sets: [set(60, 10), set(60, 8), set(65, 6)] }, { id: 2, name: 'Приседания', sets: [set(80, 8), set(80, 8), set(85, 6)] }] },
        { date: off(-5), ex: [{ id: 3, name: 'Тяга штанги', sets: [set(70, 10), set(70, 8), set(75, 6)] }, { id: 4, name: 'Подтягивания', sets: [set(0, 8), set(0, 7), set(0, 6)] }] },
        { date: off(-3), ex: [{ id: 5, name: 'Приседания', sets: [set(82.5, 8), set(82.5, 8), set(85, 6)] }, { id: 6, name: 'Жим лёжа', sets: [set(62.5, 8), set(62.5, 8), set(65, 6)] }] },
        { date: TODAY, ex: [{ id: 7, name: 'Жим лёжа', sets: [set(65, 8), set(65, 7), set(65, 6), set(65, 5)] }, { id: 8, name: 'Тяга штанги', sets: [set(72.5, 8), set(72.5, 8), set(75, 6)] }] }
      ]
    }
  };
}

let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S) S = seed();
const save = () => {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
  if (typeof scheduleSync === 'function') scheduleSync();
};

const ACT = {}, CHG = {}, SUB = {}, VIEW = {};

// Доводит сохранённые ранее данные до текущего формата (id, даты, периоды).
(function migrate() {
  const y = NOW.getFullYear();
  S.cal.range = S.cal.range || { mode: '14', from: off(-30), to: TODAY };
  S.wo.range = S.wo.range || { mode: '30', from: off(-30), to: TODAY };
  let nb = 0;
  S.blocks.forEach((b, bi) => {
    if (b.id == null) b.id = bi;
    if (b.start === undefined) b.start = y + '-01-01';
    if (b.end === undefined) b.end = y + '-12-31';
    let ns = 0;
    b.subs.forEach((s, si) => {
      if (s.id == null) s.id = si;
      if (s.start === undefined) s.start = y + '-01-01';
      if (s.end === undefined) s.end = null;
      ns = Math.max(ns, s.id + 1);
    });
    if (b.ns == null || b.ns < ns) b.ns = ns;
    nb = Math.max(nb, b.id + 1);
  });
  if (S.nb == null || S.nb < nb) S.nb = nb;
})();
