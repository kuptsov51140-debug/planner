'use strict';
// Синхронизация между устройствами через jsonbin.io: одно общее "хранилище"
// (bin), в которое кладётся весь S целиком. Никакой сложной логики слияния —
// последняя отправка побеждает, поэтому кнопки "Отправить" / "Получить" явные.
const SYNC_KEY = 'planner-sync-cfg';
const JB = 'https://api.jsonbin.io/v3/b';

let SC;
try { SC = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { SC = null; }
if (!SC) SC = { apiKey: '', binId: '', auto: true, last: 0, status: '', busy: false };

const saveSC = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(SC)); } catch (e) { /* storage unavailable */ } };
const syncReady = () => !!(SC.apiKey && SC.binId);
const rerenderSync = () => { if (typeof render === 'function' && S.tab === 'sync') render(); };

let pushTimer = null;
function scheduleSync() {
  if (!syncReady() || SC.auto === false) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; syncPush(); }, 1500);
}

async function syncPush() {
  if (!syncReady() || SC.busy) return;
  SC.busy = true; SC.status = 'push'; rerenderSync();
  try {
    const res = await fetch(JB + '/' + SC.binId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': SC.apiKey, 'X-Bin-Versioning': 'false' },
      body: JSON.stringify(S)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    SC.status = 'ok'; SC.last = Date.now();
  } catch (e) {
    SC.status = 'err'; SC.err = String(e.message || e);
  }
  SC.busy = false; saveSC(); rerenderSync();
}

// force=true: кнопка «Подключиться / получить» — всегда берём данные из облака.
// Иначе (авто) берём их только если они новее локальных и у нас нет неотправленных правок;
// если локальные новее — отправляем их.
async function syncPull(force) {
  if (!syncReady() || SC.busy) return;
  SC.busy = true; SC.status = 'pull'; rerenderSync();
  let applied = false, pushAfter = false;
  try {
    const res = await fetch(JB + '/' + SC.binId + '/latest', { headers: { 'X-Master-Key': SC.apiKey } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const remote = data && data.record;
    if (remote && typeof remote === 'object') {
      const localT = S.updatedAt || 0, remoteT = remote.updatedAt || 0;
      if (force || (remoteT > localT && !pushTimer)) {
        S = Object.assign({}, remote, { tab: S.tab, sel: S.sel, y: S.y, m: S.m });
        lastHash = dataHash();
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) { /* storage unavailable */ }
        applied = true;
      } else if (localT > remoteT && !pushTimer) {
        pushAfter = true;
      }
    }
    SC.status = 'ok'; SC.last = Date.now();
  } catch (e) {
    SC.status = 'err'; SC.err = String(e.message || e);
  }
  SC.busy = false; saveSC();
  if (typeof render === 'function' && (applied || S.tab === 'sync')) render();
  if (pushAfter) syncPush();
}

async function syncCreate() {
  if (!SC.apiKey || SC.busy) return;
  SC.busy = true; SC.status = 'push'; rerenderSync();
  try {
    const res = await fetch(JB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': SC.apiKey, 'X-Bin-Name': 'planner', 'X-Bin-Private': 'true' },
      body: JSON.stringify(S)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    SC.binId = (data.metadata && data.metadata.id) || '';
    SC.status = 'ok'; SC.last = Date.now();
  } catch (e) {
    SC.status = 'err'; SC.err = String(e.message || e);
  }
  SC.busy = false; saveSC(); rerenderSync();
}

// Подтягиваем свежие данные при открытии, при возврате на вкладку и раз в 25 секунд.
const autoPull = () => { if (syncReady() && SC.auto !== false && !document.hidden) syncPull(false); };
setInterval(autoPull, 25000);
document.addEventListener('visibilitychange', autoPull);
window.addEventListener('focus', autoPull);
setTimeout(autoPull, 300);

function syncLine() {
  if (SC.busy) return (SC.status === 'pull' ? 'Получение данных…' : 'Отправка данных…');
  const when = SC.last ? new Date(SC.last).toLocaleString('ru-RU') : 'ещё ни разу';
  if (SC.status === 'err') {
    const hint = SC.err === 'HTTP 401' || SC.err === 'HTTP 403' ? ' Проверьте API-ключ.' : SC.err === 'HTTP 404' ? ' Проверьте ID хранилища.' : '';
    return 'Не получилось: ' + esc(SC.err || 'ошибка') + '.' + hint + ' Последняя удачная синхронизация: ' + when + '.';
  }
  if (!syncReady()) return 'Синхронизация не настроена.';
  return 'Последняя синхронизация: ' + when + '.';
}

VIEW.sync = function () {
  const ready = syncReady();
  return `<header><h1>Синхронизация</h1><div class="sub">Общее облачное хранилище на jsonbin.io связывает данные между устройствами. Настройте один раз с одинаковым ключом и ID на каждом устройстве.</div></header>
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
<div style="font-size:12px;color:var(--muted);line-height:1.5">Данные в хранилище не шифруются — их видит любой, у кого есть ваш ключ и ID. Если правите на двух устройствах одновременно, побеждает тот, кто отправил последним — перед этим нажмите «Подключиться / получить».</div>
</div>`;
};

ACT.synccreate = () => { syncCreate(); };
ACT.syncpull = () => { syncPull(true); };
ACT.syncpush = () => { syncPush(); };
CHG.synckey = (t) => { SC.apiKey = t.value.trim(); saveSC(); };
CHG.syncbin = (t) => { SC.binId = t.value.trim(); saveSC(); };
CHG.syncauto = (t) => { SC.auto = t.checked; saveSC(); };
