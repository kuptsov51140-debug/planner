'use strict';
// Синхронизация между устройствами через jsonbin.io: одно общее «хранилище» (bin),
// в которое кладётся весь S целиком.
// Версии считаются счётчиком правок S.rev (а не часами устройств): у каждого устройства
// запоминается SC.base — версия облака, с которой оно последний раз сверялось.
//  - облако не менялось, у нас есть правки   -> отправляем;
//  - облако изменилось, у нас правок нет     -> берём из облака;
//  - изменилось и там, и тут (конфликт)      -> берём облако, а нашу версию сохраняем в копию.
const SYNC_KEY = 'planner-sync-cfg';
const BACKUP_KEY = 'planner-backup';
const JB = 'https://api.jsonbin.io/v3/b';
const PUSH_DELAY = 4000;          // пауза после правки перед отправкой
const POLL_MS = 10 * 60 * 1000;   // фоновая проверка облака раз в 10 минут, пока приложение открыто
const MIN_GAP = 60 * 1000;        // не чаще раза в минуту при возвратах на вкладку
const TIMEOUT_MS = 20000;

let SC;
try { SC = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { SC = null; }
if (!SC) SC = { apiKey: '', binId: '', auto: true, last: 0, status: '', busy: false };
SC.busy = false; SC.status = SC.status === 'err' ? 'err' : '';   // зависший с прошлого запуска запрос не должен блокировать

const saveSC = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(SC)); } catch (e) { /* storage unavailable */ } };
const syncReady = () => !!(SC.apiKey && SC.binId);
const rerenderSync = () => { if (typeof render === 'function' && S.tab === 'sync') render(); };

// ---- запросы: с тайм-аутом и счётчиком (чтобы видеть расход бесплатного лимита) ----
async function jb(path, opts) {
  const ym = new Date().toISOString().slice(0, 7);
  if (!SC.req || SC.req.m !== ym) SC.req = { m: ym, n: 0 };
  SC.req.n++;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(JB + path, Object.assign({}, opts, { signal: ctl.signal }));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally { clearTimeout(timer); }
}
async function getRemote() {
  const res = await jb('/' + SC.binId + '/latest', { headers: { 'X-Master-Key': SC.apiKey } });
  const d = await res.json();
  return d && d.record && typeof d.record === 'object' ? d.record : null;
}
async function putRemote() {
  S.rev = S.rev || 0;
  await jb('/' + SC.binId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': SC.apiKey, 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(S)
  });
  SC.base = S.rev;
}

// ---- данные из облака вместо локальных (локальные настройки экрана не трогаем) ----
function takeData(src) {
  const loc = S;
  S = Object.assign({}, src, { tab: loc.tab, sel: loc.sel, y: loc.y, m: loc.m });
  if (loc.cal && S.cal) S.cal = Object.assign({}, S.cal, { date: loc.cal.date, meal: loc.cal.meal, range: loc.cal.range });
  if (loc.wo && S.wo) S.wo = Object.assign({}, S.wo, { sel: loc.wo.sel, pick: loc.wo.pick, range: loc.wo.range });
  lastHash = dataHash();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}
function backupLocal() {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), data: S })); } catch (e) { /* storage unavailable */ }
}
const validRec = (r) => !!(r && Array.isArray(r.blocks) && r.cal && r.wo);

// что делать после сверки: 'none' | 'push' | 'apply' | 'conflict'
function decide(rec, force) {
  if (!validRec(rec)) { if (force) throw new Error('empty'); return 'push'; }
  if (force) return 'apply';
  const rr = rec.rev || 0, lr = S.rev || 0;
  if (SC.base == null) {                                   // первая сверка после обновления приложения
    const rt = rec.updatedAt || 0, lt = S.updatedAt || 0;
    if (rt > lt) return 'apply';
    if (lt > rt) { S.rev = Math.max(lr, rr) + 1; return 'push'; }
    SC.base = rr; S.rev = Math.max(lr, rr); return 'none';
  }
  if (rr === SC.base) return lr > SC.base ? 'push' : 'none';
  if (rr > SC.base) return lr === SC.base ? 'apply' : 'conflict';
  return 'push';                                           // облако «отстало» (пересоздано): наши данные главнее
}

let pushTimer = null, retryTimer = null, retryN = 0, lastPullAt = 0, again = false;

// mode: 'auto' — сверка и, если нужно, отправка; 'pull' — кнопка «получить»; 'push' — кнопка «отправить»
async function syncCycle(mode) {
  if (!syncReady()) return;
  if (SC.busy) { if (mode === 'auto') again = true; return; }
  clearTimeout(retryTimer);
  SC.busy = true; SC.status = mode === 'push' ? 'push' : 'pull'; rerenderSync();
  let applied = false;
  try {
    if (mode === 'push') {
      await putRemote();
    } else {
      const rec = await getRemote();
      lastPullAt = Date.now();
      const act = decide(rec, mode === 'pull');
      if (act === 'apply' || act === 'conflict') {
        if (act === 'conflict' || mode === 'pull') backupLocal();
        if (act === 'conflict') SC.conflict = Date.now();
        takeData(rec); SC.base = S.rev || 0; applied = true;
      } else if (act === 'push') {
        await putRemote();
      }
    }
    SC.status = 'ok'; SC.err = ''; SC.last = Date.now(); retryN = 0;
  } catch (e) {
    SC.status = 'err'; SC.err = String((e && e.message) || e);
    scheduleRetry();
  }
  SC.busy = false; saveSC();
  if (typeof render === 'function' && (applied || S.tab === 'sync')) render();
  if (again) { again = false; scheduleSync(); }
}

function scheduleSync() {
  if (!syncReady() || SC.auto === false) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; syncCycle('auto'); }, PUSH_DELAY);
}
function scheduleRetry() {
  if (/HTTP (401|403|404)/.test(SC.err)) return;           // ключ или ID неверны — повтор не поможет
  const delay = /HTTP 429/.test(SC.err) ? 10 * 60 * 1000 : Math.min(5 * 60 * 1000, 30000 * Math.pow(2, retryN++));
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => syncCycle('auto'), delay);
}
async function syncCreate() {
  if (!SC.apiKey || SC.busy) return;
  SC.busy = true; SC.status = 'push'; rerenderSync();
  try {
    S.rev = S.rev || 0;
    const res = await jb('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': SC.apiKey, 'X-Bin-Name': 'planner', 'X-Bin-Private': 'true' },
      body: JSON.stringify(S)
    });
    const data = await res.json();
    SC.binId = (data.metadata && data.metadata.id) || '';
    SC.base = S.rev; SC.status = 'ok'; SC.err = ''; SC.last = Date.now();
  } catch (e) {
    SC.status = 'err'; SC.err = String((e && e.message) || e);
  }
  SC.busy = false; saveSC(); rerenderSync();
}

// Проверка облака: при открытии, при возврате в приложение и раз в 10 минут.
const autoPull = () => {
  if (!syncReady() || SC.auto === false || document.hidden) return;
  if (Date.now() - lastPullAt < MIN_GAP) return;
  syncCycle('auto');
};
setInterval(autoPull, POLL_MS);
document.addEventListener('visibilitychange', autoPull);
window.addEventListener('focus', autoPull);
setTimeout(autoPull, 300);

function syncLine() {
  if (SC.busy) return SC.status === 'pull' ? 'Получение данных…' : 'Отправка данных…';
  const when = SC.last ? new Date(SC.last).toLocaleString('ru-RU') : 'ещё ни разу';
  const used = SC.req && SC.req.m === new Date().toISOString().slice(0, 7) ? ' Запросов к облаку с этого устройства в этом месяце: ' + SC.req.n + '.' : '';
  if (SC.status === 'err') {
    const e = SC.err || '';
    const hint = /HTTP 429/.test(e) ? ' Превышен лимит запросов бесплатного тарифа JSONBin: подождите или проверьте лимит в аккаунте jsonbin.io.'
      : /HTTP (401|403)/.test(e) ? ' Проверьте API-ключ (или лимит/доступ аккаунта).'
      : /HTTP 404/.test(e) ? ' Проверьте ID хранилища.'
      : e === 'empty' ? ' В этом хранилище ещё нет данных приложения: сначала нажмите «Отправить сейчас» на устройстве с данными.'
      : /timeout|Failed to fetch|NetworkError|Load failed/i.test(e) ? ' Нет связи с облаком, проверьте интернет: приложение повторит попытку само.'
      : '';
    return 'Не получилось: ' + esc(e || 'ошибка') + '.' + hint + ' Последняя удачная синхронизация: ' + when + '.' + used;
  }
  if (!syncReady()) return 'Синхронизация не настроена.';
  return 'Последняя синхронизация: ' + when + '.' + used;
}

function conflictCardHtml() {
  if (!SC.conflict) return '';
  return `<div class="card" style="max-width:680px;border-color:var(--red)"><b>Правки на двух устройствах пересеклись</b>
<div class="sub" style="margin:0">${new Date(SC.conflict).toLocaleString('ru-RU')}: пока это устройство было без связи, данные изменились на другом. Приложение взяло более свежую версию из облака, а ваши несинхронизированные правки с этого устройства сохранены в копии.</div>
<div class="row"><button type="button" class="btn ghost" data-act="restorebackup">Вернуть мою версию (правки с другого устройства будут заменены)</button><button type="button" class="btn ghost" data-act="dismissconf">Закрыть</button></div></div>`;
}

VIEW.sync = function () {
  const ready = syncReady();
  return `<header><h1>Синхронизация</h1><div class="sub">Общее облачное хранилище на jsonbin.io связывает данные между устройствами. Настройте один раз с одинаковым ключом и ID на каждом устройстве.</div></header>
${themeCardHtml()}
${conflictCardHtml()}
<div class="card" style="max-width:680px">
<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--muted)">
<li>Откройте <b style="color:var(--ink)">jsonbin.io</b> и заведите бесплатный аккаунт.</li>
<li>В разделе <b style="color:var(--ink)">API Keys</b> скопируйте свой <b style="color:var(--ink)">X-MASTER-KEY</b>.</li>
<li>Вставьте ключ ниже и на ПЕРВОМ устройстве нажмите «Создать хранилище».</li>
<li>Скопируйте появившийся ID хранилища и на ВТОРОМ устройстве вставьте тот же ключ и этот ID, затем нажмите «Подключиться».</li>
</ol>
<div class="row" style="margin-top:4px">
<label class="cap fld" style="flex:1;min-width:240px">API-ключ (X-Master-Key)<input type="text" spellcheck="false" value="${esc(SC.apiKey)}" placeholder="$2a$10$…" data-chg="synckey" aria-label="API-ключ"></label>
<label class="cap fld" style="flex:1;min-width:240px">ID хранилища<input type="text" spellcheck="false" value="${esc(SC.binId)}" placeholder="появится после создания" data-chg="syncbin" aria-label="ID хранилища"></label>
</div>
<div class="row">
<button type="button" class="btn ghost" data-act="synccreate" ${SC.apiKey && !SC.busy ? '' : 'disabled'}>Создать хранилище</button>
<button type="button" class="btn ghost" data-act="syncpull" ${ready && !SC.busy ? '' : 'disabled'}>Подключиться / получить</button>
<button type="button" class="btn" data-act="syncpush" ${ready && !SC.busy ? '' : 'disabled'}>Отправить сейчас</button>
<label style="display:flex;align-items:center;gap:6px;height:44px;font-size:14px"><input type="checkbox" ${SC.auto !== false ? 'checked' : ''} data-chg="syncauto">автосинхронизация при изменениях</label>
</div>
<div class="sub" style="margin:0">${syncLine()}</div>
<div style="font-size:12px;color:var(--muted);line-height:1.5">Данные в хранилище не шифруются — их видит любой, у кого есть ваш ключ и ID. Изменения отправляются через несколько секунд после правки, а свежие данные с другого устройства подтягиваются при открытии приложения и раз в 10 минут. Чтобы увидеть их сразу, нажмите «Подключиться / получить».</div>
</div>`;
};

function themeCardHtml() {
  const cur = getTheme();
  const opts = THEMES.map((t) => `<button type="button" class="thm ${t.id === cur ? 'on' : ''}" data-act="theme" data-v="${t.id}" aria-pressed="${t.id === cur}">
<span class="sw" style="background:${t.bg};border-color:${t.ac}"><i style="background:${t.ac}"></i><b style="background:${t.fg}"></b></span><span>${t.name}</span></button>`).join('');
  return `<div class="card" style="max-width:680px"><h2 style="font-size:20px">Тема оформления</h2>
<div class="row" role="group" aria-label="Тема оформления" style="gap:10px">${opts}</div>
<div class="sub" style="margin:0;font-size:12px">Тема запоминается отдельно на каждом устройстве.</div></div>`;
}
ACT.theme = (t) => { setTheme(t.dataset.v); };
ACT.synccreate = () => { syncCreate(); };
ACT.syncpull = () => { syncCycle('pull'); };
ACT.syncpush = () => { syncCycle('push'); };
ACT.dismissconf = () => { SC.conflict = 0; saveSC(); };
ACT.restorebackup = () => {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch (e) { b = null; }
  if (!b || !validRec(b.data)) { SC.conflict = 0; saveSC(); return; }
  takeData(b.data);
  lastHash = null;                              // следующий save() увидит правку: версия вырастет и данные уйдут в облако
  S.rev = Math.max(S.rev || 0, SC.base || 0);
  SC.conflict = 0; saveSC();
};
CHG.synckey = (t) => { SC.apiKey = t.value.trim(); saveSC(); };
CHG.syncbin = (t) => { SC.binId = t.value.trim(); saveSC(); };
CHG.syncauto = (t) => { SC.auto = t.checked; saveSC(); };
