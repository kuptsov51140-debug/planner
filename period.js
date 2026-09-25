'use strict';
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 15) ? c : k === 1 ? a : (k > 1 && k < 5) ? b : c; };
const PRESETS = [['7', '7 дней'], ['14', '14 дней'], ['30', '30 дней'], ['90', '90 дней'], ['365', 'Год'], ['all', 'Всё время'], ['custom', 'Свой']];

function rangeOf(r) {
  if (r.mode === 'all') return { from: '0000-01-01', to: '9999-12-31' };
  if (r.mode === 'custom') return r.from <= r.to ? { from: r.from, to: r.to } : { from: r.to, to: r.from };
  return { from: off(-(+r.mode - 1)), to: TODAY };
}
function periodHtml(scope) {
  const r = S[scope].range;
  const pills = PRESETS.map((p) => `<button type="button" class="pill sm ${r.mode === p[0] ? 'on' : ''}" data-act="per" data-s="${scope}" data-v="${p[0]}" aria-pressed="${r.mode === p[0]}">${p[1]}</button>`).join('');
  const custom = r.mode === 'custom' ? `<div class="row"><label class="cap fld">С<input type="date" value="${r.from}" data-chg="perfrom" data-s="${scope}"></label><label class="cap fld">По<input type="date" value="${r.to}" data-chg="perto" data-s="${scope}"></label></div>` : '';
  return `<div style="display:flex;flex-direction:column;gap:10px"><div class="cap">Период</div><div class="row" role="group" aria-label="Период" style="gap:6px">${pills}</div>${custom}</div>`;
}
ACT.per = (t) => { S[t.dataset.s].range.mode = t.dataset.v; };
CHG.perfrom = (t) => { if (t.value) S[t.dataset.s].range.from = t.value; };
CHG.perto = (t) => { if (t.value) S[t.dataset.s].range.to = t.value; };
