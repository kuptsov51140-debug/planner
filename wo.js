'use strict';
const curSession = () => S.wo.sessions.find((s) => s.date === S.wo.sel);
const findEx = (id) => { const s = curSession(); return s && s.ex.find((e) => e.id === id); };

function avgOf(sets) {
  let ws = 0, wn = 0, rs = 0, rn = 0;
  sets.forEach((st) => {
    const w = num(st.w), r = num(st.r);
    if (isFinite(w) && w > 0) { ws += w; wn++; }
    if (isFinite(r)) { rs += r; rn++; }
  });
  return { ws, wn, rs, rn };
}
const dayAvgText = (sets) => { const a = avgOf(sets); return a.rn ? (a.wn ? fmt1(a.ws / a.wn) + ' кг' : 'своё') + ' × ' + fmt1(a.rs / a.rn) : '—'; };

const inPeriod = () => { const { from, to } = rangeOf(S.wo.range); return S.wo.sessions.filter((s) => s.date >= from && s.date <= to); };

function statsHtml() {
  const agg = {};
  inPeriod().forEach((ss) => ss.ex.forEach((ex) => {
    const a = agg[ex.name] || (agg[ex.name] = { n: 0, ws: 0, wn: 0, rs: 0, rn: 0 });
    const v = avgOf(ex.sets);
    a.ws += v.ws; a.wn += v.wn; a.rs += v.rs; a.rn += v.rn; a.n += v.rn;
  }));
  return Object.keys(agg).sort().map((k) => {
    const a = agg[k];
    return `<div class="st"><span>${esc(k)}</span><span style="color:var(--muted)">${a.n}</span><span style="font-weight:500">${a.wn ? fmt1(a.ws / a.wn) : a.n ? 'своё' : '—'}</span><span style="font-weight:500">${a.rn ? fmt1(a.rs / a.rn) : '—'}</span></div>`;
  }).join('') || '<div class="sub" style="margin:12px 0">В этом периоде тренировок нет.</div>';
}
function refreshStats() {
  const el = $('#stats'); if (el) el.innerHTML = statsHtml();
  const s = curSession();
  if (s) s.ex.forEach((ex) => { const e = $('#avg' + ex.id); if (e) e.textContent = dayAvgText(ex.sets); });
}

VIEW.wo = function () {
  const W = S.wo, cur = curSession() || { ex: [] };
  const chips = W.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1).map((s) => `<button class="pill ${s.date === W.sel ? 'on' : ''}" data-act="wsel" data-v="${s.date}" aria-pressed="${s.date === W.sel}">${dlabel(s.date)}</button>`).join('');
  const blocks = cur.ex.map((ex) => `<div class="card" style="padding:20px 24px;gap:8px">
<div class="eh" style="display:flex;justify-content:space-between;align-items:center;gap:8px 16px"><h2 style="font-size:22px">${esc(ex.name)}</h2>
<div class="row" style="gap:16px"><span style="font-size:13px;color:var(--muted)">за день: <span class="mono" style="color:var(--ink)" id="avg${ex.id}">${dayAvgText(ex.sets)}</span></span><button class="txt" data-act="delex" data-id="${ex.id}">Убрать</button></div></div>
<div class="sets cap" style="border-bottom:1px solid var(--line);padding-bottom:6px"><span>№</span><span>Вес, кг</span><span>Повторы</span><span></span></div>
${ex.sets.map((st, i) => `<div class="sets"><span class="mono" style="color:var(--muted)">${i + 1}</span>
<input type="text" inputmode="decimal" value="${esc(st.w)}" data-chg="setw" data-id="${ex.id}" data-i="${i}" aria-label="${esc(ex.name)}, подход ${i + 1}: вес, кг">
<input type="text" inputmode="numeric" value="${esc(st.r)}" data-chg="setr" data-id="${ex.id}" data-i="${i}" aria-label="${esc(ex.name)}, подход ${i + 1}: повторы">
<button class="x" data-act="delset" data-id="${ex.id}" data-i="${i}" aria-label="Удалить подход ${i + 1}">&times;</button></div>`).join('')}
<div><button class="btn ghost" style="border-style:dashed;border-color:var(--green);color:var(--green)" data-act="addset" data-id="${ex.id}">+ подход</button></div></div>`).join('');
  return `<header><h1>Тренировки</h1><div class="sub">Выберите дату, впишите вес и повторения по подходам — средние справа пересчитаются. Тексты полей сохраняются при выходе из поля (Tab или Enter).</div></header>
<div class="two"><section style="display:flex;flex-direction:column;gap:20px">
<div class="row" style="justify-content:space-between"><div class="row">${chips}</div>
<form class="row" data-sub="addsess" style="flex-wrap:nowrap"><input type="date" name="d" aria-label="Дата новой тренировки"><button class="btn ghost" type="submit">Новая тренировка</button></form></div>
${cur.ex.length ? blocks : '<div style="padding:28px;border:1px dashed #B9AF98;border-radius:8px;color:var(--muted)">В этот день упражнений пока нет — добавьте первое ниже.</div>'}
<form data-sub="addex" class="card" style="flex-direction:row;align-items:flex-end;padding:20px 24px"><label class="cap" style="flex:1;display:flex;flex-direction:column;gap:6px">Упражнение из списка<select name="e" style="text-transform:none;letter-spacing:0">${W.catalog.map((o) => `<option ${o === W.pick ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label><button class="btn" type="submit">Добавить упражнение</button></form>
<div class="sub" style="margin:0">Полный список упражнений можно дописать в массив <code>catalog</code> в файле app.js.</div></section>
<aside class="card"><div><h2>Средние показатели</h2></div>${periodHtml('wo')}<div class="kpi"><div><span class="cap">Тренировок</span><b>${inPeriod().filter((s) => s.ex.length).length}</b></div><div><span class="cap">Упражнений</span><b>${new Set(inPeriod().flatMap((s) => s.ex.map((e) => e.name))).size}</b></div></div>
<div class="st cap" style="min-height:0;padding-bottom:6px;border-bottom:1px solid var(--line)"><span>Упражнение</span><span>Подх.</span><span>Ср. вес</span><span>Ср. повт.</span></div>
<div id="stats">${statsHtml()}</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Средний вес считается по подходам с весом больше нуля; «своё» — упражнения с собственным весом.</div></aside></div>`;
};

ACT.wsel = (t) => { S.wo.sel = t.dataset.v; };
ACT.delex = (t) => { const s = curSession(); s.ex = s.ex.filter((e) => e.id !== +t.dataset.id); };
ACT.delset = (t) => { findEx(+t.dataset.id).sets.splice(+t.dataset.i, 1); };
ACT.addset = (t) => { const e = findEx(+t.dataset.id), l = e.sets[e.sets.length - 1] || { w: '', r: '' }; e.sets.push({ w: l.w, r: l.r }); };
CHG.setw = (t) => { findEx(+t.dataset.id).sets[+t.dataset.i].w = t.value; refreshStats(); return 'keep'; };
CHG.setr = (t) => { findEx(+t.dataset.id).sets[+t.dataset.i].r = t.value; refreshStats(); return 'keep'; };
SUB.addsess = (f) => {
  const d = f.d.value; if (!d) return;
  if (!S.wo.sessions.some((s) => s.date === d)) S.wo.sessions.push({ date: d, ex: [] });
  S.wo.sel = d;
};
SUB.addex = (f) => { S.wo.pick = f.e.value; const s = curSession(); if (s) s.ex.push({ id: S.wo.nid++, name: f.e.value, sets: [{ w: '', r: '' }] }); };
