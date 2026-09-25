'use strict';
const MEALS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
const dayTotal = (d) => (S.cal.days[d] || []).reduce((a, e) => a + e.kcal, 0);

VIEW.cal = function () {
  const C = S.cal, list = C.days[C.date] || [];
  const total = dayTotal(C.date), over = total > C.norm;
  const pct = C.norm > 0 ? Math.min(100, Math.round(total / C.norm * 100)) : 0;
  const groups = MEALS.map((m) => {
    const items = list.map((e, i) => ({ e, i })).filter((x) => x.e.meal === m);
    const sum = items.reduce((a, x) => a + x.e.kcal, 0);
    return `<div><div class="gh"><span class="cap">${m}</span><span class="mono" style="font-size:13px;color:var(--muted)">${fmt(sum)} ккал</span></div>
${items.length ? items.map((x) => `<div class="list"><span class="g">${esc(x.e.name)}</span><span class="mono">${fmt(x.e.kcal)}</span><button class="x" data-act="delcal" data-i="${x.i}" aria-label="Удалить ${esc(x.e.name)}">&times;</button></div>`).join('') : '<div style="padding:12px 0;font-size:14px;color:var(--muted)">Пока пусто</div>'}</div>`;
  }).join('');
  const pills = MEALS.map((m) => `<button type="button" class="pill ${m === C.meal ? 'on' : ''}" data-act="meal" data-v="${m}" aria-pressed="${m === C.meal}">${m}</button>`).join('');
  const { from, to } = rangeOf(C.range);
  const filled = Object.keys(C.days).filter((d) => d >= from && d <= to && C.days[d].length).sort();
  const span = C.range.mode === 'all' ? 1e9 : daysBetween(from, to) + 1;
  let hist = filled;
  if (span <= 31) { hist = []; for (let i = 0; i < span; i++) hist.push(addDays(from, i)); }
  hist = hist.slice().reverse();
  const sumAll = filled.reduce((a, d) => a + dayTotal(d), 0);
  const avg = filled.length ? Math.round(sumAll / filled.length) : 0;
  const overDays = filled.filter((d) => dayTotal(d) > C.norm).length;
  const rows = hist.map((d) => {
    const k = dayTotal(d), has = (S.cal.days[d] || []).length, diff = k - C.norm;
    return `<div class="hist"><span style="${d === C.date ? 'font-weight:600' : 'color:var(--muted)'}">${dlabel(d)}</span>
<div class="hb">${has ? `<i style="width:${Math.min(100, k / 30)}%;background:${diff > 0 ? 'var(--red)' : 'var(--green)'}"></i>` : ''}<u style="left:${Math.min(100, C.norm / 30)}%"></u></div>
<span class="mono" style="text-align:right">${has ? fmt(k) : '&mdash;'}</span><span class="mono ${diff > 0 ? 'over' : 'ok'}" style="text-align:right;font-size:12px">${has ? (diff > 0 ? '+' : diff < 0 ? '−' : '') + Math.abs(diff) : ''}</span></div>`;
  }).join('');
  return `<header><h1>Калории</h1><div class="sub">Записывайте всё съеденное за день. Норма и дату можно менять.</div></header>
<div class="two"><section class="card"><div class="row" style="justify-content:space-between"><h2>Съедено за день</h2><input type="date" value="${C.date}" data-chg="caldate" aria-label="Дата"></div>
<div style="display:flex;flex-direction:column;gap:18px">${groups}</div>
<form data-sub="addcal" style="display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);padding-top:20px"><div class="row">${pills}</div>
<div class="row" style="flex-wrap:nowrap"><input type="text" name="n" placeholder="Что съели" aria-label="Название блюда" style="flex:1;min-width:0"><input type="number" name="k" min="0" placeholder="ккал" aria-label="Калорийность, ккал" style="width:130px;font-family:var(--mono)"><button class="btn" type="submit">Добавить</button></div></form></section>
<aside style="display:flex;flex-direction:column;gap:28px"><section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px"><div><div class="cap">Съедено</div><div class="big">${fmt(total)}</div></div>
<label class="cap" style="display:flex;flex-direction:column;gap:6px;width:130px">Норма, ккал<input type="number" min="1" value="${C.norm}" data-chg="norm" class="mono" style="font-size:16px"></label></div>
<div class="bar" style="height:10px;border-radius:5px"><i style="width:${pct}%;background:${over ? 'var(--red)' : 'var(--green)'}"></i></div>
<div class="${over ? 'over' : 'ok'}" style="font-weight:500">${over ? 'Превышение на ' + fmt(total - C.norm) : 'Осталось ' + fmt(C.norm - total)} ккал</div></section>
<section class="card"><h2 style="font-size:20px">История</h2>${periodHtml('cal')}
<div class="kpi"><div><span class="cap">Среднее в день</span><b>${fmt(avg)}</b></div><div><span class="cap">Дней с записями</span><b>${filled.length}</b></div><div><span class="cap">Выше нормы</span><b class="${overDays ? 'over' : ''}">${overDays}</b></div></div>
<div class="scr">${rows || '<div class="sub" style="margin:0">В этом периоде записей нет.</div>'}</div><div style="font-size:12px;color:var(--muted)">| — норма дня${span > 31 ? ' · показаны только дни с записями' : ''}</div></section></aside></div>`;
};

ACT.meal = (t) => { S.cal.meal = t.dataset.v; };
ACT.delcal = (t) => { S.cal.days[S.cal.date].splice(+t.dataset.i, 1); };
CHG.caldate = (t) => { if (t.value) S.cal.date = t.value; };
CHG.norm = (t) => { const v = parseInt(t.value, 10); if (v > 0) S.cal.norm = v; };
SUB.addcal = (f) => {
  const n = f.n.value.trim(), k = parseInt(f.k.value, 10);
  if (!n || !(k >= 0)) return;
  (S.cal.days[S.cal.date] = S.cal.days[S.cal.date] || []).push({ meal: S.cal.meal, name: n, kcal: k });
};
