'use strict';
// Редактор списка упражнений: скрыть ненужные встроенные, добавить и убрать свои.
// Список хранится в данных пользователя (S.wo.hidden и S.wo.catalog), то есть
// у каждого посетителя сайта он свой и синхронизируется только с его облаком.
let exEdit = false;

const exHidden = () => new Set((S.wo && S.wo.hidden) || []);
const setHidden = (set) => { S.wo.hidden = [...set]; };

function exEditHtml() {
  if (!exEdit) return '';
  const hid = exHidden();
  const own = (S.wo.catalog || []).filter((o) => !EX_BUILTIN.has(o));
  const hiddenBuiltin = [...hid].filter((n) => EX_BUILTIN.has(n)).length;
  const shown = EX_BUILTIN.size - hiddenBuiltin + own.length;
  const chip = (n) => {
    const on = !hid.has(n);
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-act="extog" data-n="${esc(n)}" aria-pressed="${on}">${esc(n)}</button>`;
  };
  const groups = EX_GROUPS.map((g, gi) => `<div class="exg"><div class="exgh"><b>${g[0]}</b><span><button type="button" class="txt" data-act="exgrp" data-g="${gi}" data-v="show">все</button><button type="button" class="txt" data-act="exgrp" data-g="${gi}" data-v="hide">никакие</button></span></div><div class="chips">${g[1].map(chip).join('')}</div></div>`).join('');
  const ownHtml = own.length
    ? `<div class="exg"><div class="exgh"><b>Свои</b></div><div class="chips">${own.map((n) => `<span class="chip on own"><span>${esc(n)}</span><button type="button" data-act="exdel" data-n="${esc(n)}" aria-label="Удалить из списка: ${esc(n)}">&times;</button></span>`).join('')}</div></div>`
    : '';
  return `<section class="card exed" aria-label="Редактирование списка упражнений">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h2 style="font-size:22px">Мой список упражнений</h2>
<div class="sub" style="margin:4px 0 0">Нажмите на упражнение, чтобы скрыть его из выпадающего списка. Уже записанные тренировки не меняются. В списке: <b class="mono" style="color:var(--ink)">${shown}</b> из ${EX_BUILTIN.size + own.length}.</div></div>
<div class="row"><button type="button" class="btn ghost" data-act="exreset">Показать все</button><button type="button" class="btn" data-act="exedit">Готово</button></div></div>
<form class="row" data-sub="addtolist" style="flex-wrap:nowrap"><input type="text" name="n" placeholder="Новое упражнение в список" aria-label="Новое упражнение в список" style="flex:1;min-width:0"><button class="btn ghost" type="submit">В список</button></form>
${ownHtml}${groups}</section>`;
}

ACT.exedit = () => { exEdit = !exEdit; };
ACT.extog = (t) => { const h = exHidden(), n = t.dataset.n; if (h.has(n)) h.delete(n); else h.add(n); setHidden(h); };
ACT.exgrp = (t) => {
  const h = exHidden(), names = EX_GROUPS[+t.dataset.g][1];
  names.forEach((n) => { if (t.dataset.v === 'hide') h.add(n); else h.delete(n); });
  setHidden(h);
};
ACT.exreset = () => { S.wo.hidden = []; };
ACT.exdel = (t) => {
  const n = t.dataset.n;
  S.wo.catalog = (S.wo.catalog || []).filter((o) => o !== n);
};
SUB.addtolist = (f) => {
  const n = f.n.value.trim(); if (!n) return;
  const h = exHidden();
  if (EX_BUILTIN.has(n)) { h.delete(n); setHidden(h); return; }
  const c = S.wo.catalog = S.wo.catalog || [];
  if (!c.includes(n)) c.push(n);
};
