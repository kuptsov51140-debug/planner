'use strict';
const dim = () => new Date(S.y, S.m + 1, 0).getDate();
const ds = (d) => S.y + '-' + pad(S.m + 1) + '-' + pad(d);
const mStart = () => ds(1), mEnd = () => ds(dim());
const key = (b, s, d) => b + ':' + s + ':' + ds(d);
const cnt = (b, s) => { let c = 0; for (let d = 1; d <= dim(); d++) if (S.done[key(b, s, d)]) c++; return c; };
const overlaps = (o) => o.start <= mEnd() && (!o.end || o.end >= mStart());
const inRange = (o, x) => x >= o.start && (!o.end || x <= o.end);
const blk = (id) => S.blocks.find((b) => b.id === id);
const target = (t) => { const b = blk(+t.dataset.b); return t.dataset.s != null ? b.subs.find((s) => s.id === +t.dataset.s) : b; };

function remHtml(o) {
  if (o.start > TODAY) { const n = daysBetween(TODAY, o.start); return `<span class="rem">старт через ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`; }
  if (!o.end) return '<span class="rem">бессрочно</span>';
  const n = daysBetween(TODAY, o.end);
  if (n < 0) return '<span class="rem bad">срок вышел</span>';
  if (n === 0) return '<span class="rem">последний день</span>';
  return `<span class="rem">осталось ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`;
}
function dateEd(o, bid, sid, lbl) {
  const a = `data-b="${bid}"` + (sid != null ? ` data-s="${sid}"` : '');
  return `<div class="dr"><input type="date" value="${o.start}" data-chg="dstart" ${a} aria-label="Дата начала: ${esc(lbl)}"><span>&ndash;</span><input type="date" value="${o.end || ''}" ${o.end ? '' : 'disabled'} data-chg="dend" ${a} aria-label="Дата окончания: ${esc(lbl)}"><label style="display:flex;align-items:center;gap:4px;white-space:nowrap"><input type="checkbox" ${o.end ? '' : 'checked'} data-chg="dopen" ${a}>бессрочно</label></div>`;
}
function newForm(name, ph, btn, cls, endDef) {
  return `<form class="row ${cls}" data-sub="${name}" style="align-items:flex-end;gap:12px"><label class="cap fld">${ph[0]}<input type="text" name="v" placeholder="${ph[1]}" style="width:280px"></label>
<label class="cap fld">Начало<input type="date" name="s" value="${TODAY}"></label>
<label class="cap fld">Окончание<input type="date" name="e" value="${endDef}"></label>
<label style="display:flex;align-items:center;gap:6px;height:44px;font-size:14px"><input type="checkbox" name="o" data-chg="fopen">бессрочно</label>
<button class="btn ${cls === 'b' ? 'ghost' : ''}" type="submit">${btn}</button></form>`;
}

VIEW.goals = function () {
  const N = dim();
  const vis = S.blocks.filter(overlaps);
  const b = vis.find((x) => x.id === S.sel) || vis[0];
  const cards = vis.map((bl) => {
    let dn = 0, tg = 0;
    const subs = bl.subs.filter(overlaps);
    subs.forEach((s) => { dn += Math.min(cnt(bl.id, s.id), s.t); tg += s.t; });
    const p = tg ? Math.round(dn / tg * 100) : 0;
    return `<div class="bw"><button class="blk ${b && bl.id === b.id ? 'on' : ''}" data-act="sel" data-id="${bl.id}"><span>${esc(bl.name)}</span>
<span style="display:flex;justify-content:space-between;width:100%;align-items:baseline"><b>${p}%</b><span class="cap" style="text-transform:none">${subs.length} подцел.</span></span>
<span class="bar" style="width:100%"><i style="width:${p}%"></i></span>${remHtml(bl)}</button>
<button class="bx" data-act="delblock" data-id="${bl.id}" aria-label="Удалить цель ${esc(bl.name)}">&times;</button></div>`;
  }).join('');
  const cols = `grid-template-columns:repeat(${N},minmax(0,1fr))`;
  const head = Array.from({ length: N }, (_, i) => {
    const d = i + 1, w = new Date(S.y, S.m, d).getDay();
    return `<div class="dh ${w === 0 || w === 6 ? 'we' : ''} ${ds(d) === TODAY ? 'td' : ''}">${WD[w]}<span>${d}</span></div>`;
  }).join('');
  let tracker = '<section class="card"><div style="display:flex;align-items:center;gap:8px"><button class="x" data-act="mon" data-i="-1" aria-label="Предыдущий месяц">&lsaquo;</button><b>' + MONTHS[S.m] + ' ' + S.y + '</b><button class="x" data-act="mon" data-i="1" aria-label="Следующий месяц">&rsaquo;</button></div><div class="sub" style="margin:0">В этом месяце нет активных целей: у всех срок закончился или ещё не начался.</div></section>';
  if (b) {
    const subs = b.subs.filter(overlaps);
    const rows = subs.map((s) => {
      const dn = cnt(b.id, s.id);
      const cells = Array.from({ length: N }, (_, i) => {
        const d = i + 1, k = key(b.id, s.id, d), x = ds(d);
        const out = !inRange(s, x), f = x > TODAY, on = !!S.done[k];
        const st = out ? 'вне срока' : f ? 'впереди' : on ? 'сделано' : 'пропущено';
        return `<button class="c ${out ? 'o' : f ? 'f' : ''} ${on ? 'd' : ''} ${x === TODAY ? 't' : ''}" ${out || f ? 'disabled' : ''} data-act="cell" data-k="${k}" aria-pressed="${on}" aria-label="${esc(s.n)}, ${d} ${MON[S.m]}: ${st}"></button>`;
      }).join('');
      return `<div class="grid"><div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;align-items:center;gap:4px"><span style="flex:1">${esc(s.n)}</span><button class="x" style="font-size:16px;width:32px;height:32px" data-act="delsub" data-b="${b.id}" data-s="${s.id}" aria-label="Удалить подцель ${esc(s.n)}">&times;</button></div>${dateEd(s, b.id, s.id, s.n)}</div>
<div class="days" style="${cols}">${cells}</div>
<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end"><span class="mono" style="font-size:13px">${dn} / <input type="number" min="1" value="${s.t}" data-chg="plan" data-b="${b.id}" data-s="${s.id}" aria-label="План на месяц: ${esc(s.n)}" style="width:52px;height:28px;padding:0 4px;font-family:var(--mono);font-size:13px"></span>
<span class="bar" style="width:100%;height:4px"><i style="width:${Math.min(100, Math.round(dn / s.t * 100))}%"></i></span>${remHtml(s)}</div></div>`;
    }).join('');
    const tot = Array.from({ length: N }, (_, i) => {
      const d = i + 1; let c = 0;
      subs.forEach((s) => { if (S.done[key(b.id, s.id, d)]) c++; });
      return `<div class="mono" style="text-align:center;font-size:12px">${ds(d) > TODAY ? '' : c}</div>`;
    }).join('');
    tracker = `<section class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px"><div style="display:flex;flex-direction:column;gap:6px"><h2>${esc(b.name)}</h2>
<div class="row"><span class="cap">Срок цели</span>${dateEd(b, b.id, null, b.name)}${remHtml(b)}</div>
<div class="row"><button class="x" data-act="mon" data-i="-1" aria-label="Предыдущий месяц">&lsaquo;</button><b>${MONTHS[S.m]} ${S.y}</b><button class="x" data-act="mon" data-i="1" aria-label="Следующий месяц">&rsaquo;</button></div></div>
<div class="row" style="gap:16px;font-size:13px;color:var(--muted)"><span>&#9632; <span style="color:var(--green)">сделано</span></span><span>&#9632; <span style="color:#D9B8A8">пропущено</span></span><span>&#9633; впереди</span><span>&#9632; <span style="color:#D6CEB9">вне срока</span></span></div></div>
<div class="scroll"><div style="min-width:1000px;display:flex;flex-direction:column;gap:10px">
<div class="grid" style="border-bottom:1px solid var(--line);padding-bottom:6px;align-items:end"><span class="cap">Подцель и срок</span><div class="days" style="${cols}">${head}</div><span class="cap" style="text-align:right">План</span></div>
${rows || '<div class="sub" style="margin:0">В этом месяце у цели нет активных подцелей.</div>'}
<div class="grid" style="border-top:1px solid var(--line);padding-top:10px"><span style="font-size:13px;color:var(--muted)">Выполнено за день</span><div class="days" style="${cols}">${tot}</div><span></span></div></div></div>
${newForm('addsub', ['Новая подцель', 'Например «Зарядка»'], 'Добавить подцель', 's', addDays(TODAY, 30))}</section>`;
  }
  const yd = Math.round((NOW - new Date(NOW.getFullYear(), 0, 1)) / 864e5) + 1;
  const yp = Math.round(yd / 365 * 100);
  return `<header style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap"><div><h1>Цели на ${S.y} год</h1><div class="sub">Блоки целей → подцели → отметки по дням. Цель и подцель показываются в тех месяцах, куда попадает их срок.</div></div>
<div style="width:300px"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted)"><span>Прошло ${yd} из 365 дней</span><b class="mono" style="color:var(--ink)">${yp}%</b></div><div class="bar" style="margin-top:8px"><i style="width:${yp}%;background:var(--ink)"></i></div></div></header>
<section class="blocks">${cards}</section>
${newForm('addblock', ['Новая цель', 'Название блока'], 'Добавить цель', 'b', NOW.getFullYear() + '-12-31')}
${tracker}`;
};

ACT.sel = (t) => { S.sel = +t.dataset.id; };
ACT.cell = (t) => { const k = t.dataset.k; if (S.done[k]) delete S.done[k]; else S.done[k] = 1; };
ACT.mon = (t) => { const d = new Date(S.y, S.m + (+t.dataset.i), 1); S.y = d.getFullYear(); S.m = d.getMonth(); };
const dropDone = (prefix) => Object.keys(S.done).forEach((k) => { if (k.startsWith(prefix)) delete S.done[k]; });
ACT.delblock = (t) => {
  const b = blk(+t.dataset.id);
  if (!confirm('Удалить цель «' + b.name + '» вместе с подцелями и отметками?')) return;
  S.blocks = S.blocks.filter((x) => x.id !== b.id); dropDone(b.id + ':');
};
ACT.delsub = (t) => {
  const b = blk(+t.dataset.b), s = b.subs.find((x) => x.id === +t.dataset.s);
  if (!confirm('Удалить подцель «' + s.n + '» вместе с отметками?')) return;
  b.subs = b.subs.filter((x) => x.id !== s.id); dropDone(b.id + ':' + s.id + ':');
};
CHG.plan = (t) => { const v = parseInt(t.value, 10); if (v > 0) target(t).t = v; };
CHG.dstart = (t) => { const o = target(t); if (!t.value) return; o.start = t.value; if (o.end && o.end < o.start) o.end = o.start; };
CHG.dend = (t) => { const o = target(t); if (!t.value) return; o.end = t.value < o.start ? o.start : t.value; };
CHG.dopen = (t) => { const o = target(t); o.end = t.checked ? null : addDays(o.start > TODAY ? o.start : TODAY, 30); };
CHG.fopen = (t) => { t.form.e.disabled = t.checked; return 'keep'; };
const goTo = (o) => { if (!overlaps(o)) { const d = new Date(o.start + 'T00:00:00'); S.y = d.getFullYear(); S.m = d.getMonth(); } };
const readDates = (f) => {
  const s = f.s.value || TODAY;
  const e = f.o.checked ? null : (f.e.value && f.e.value >= s ? f.e.value : s);
  return { start: s, end: e };
};
SUB.addblock = (f) => {
  const v = f.v.value.trim(); if (!v) return;
  const id = S.nb++;
  S.blocks.push({ id, name: v, subs: [], ns: 0, ...readDates(f) });
  S.sel = id; goTo(S.blocks[S.blocks.length - 1]);
};
SUB.addsub = (f) => {
  const v = f.v.value.trim(); if (!v) return;
  const vis = S.blocks.filter(overlaps), b = vis.find((x) => x.id === S.sel) || vis[0]; if (!b) return;
  const o = { id: b.ns++, n: v, t: 20, ...readDates(f) };
  b.subs.push(o); goTo(o);
};
