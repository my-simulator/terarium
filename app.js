// アプリ本体：状態・操作（actions）・画面切り替え
import { CONTAINERS, MATERIALS, CATEGORIES } from './data/catalog.js';
import { newWork, newItem, sampleWork, cloneForSave } from './data/model.js';
import { loadDB, saveDB, exportJSON, importJSON } from './data/storage.js';
import { clamp, r1, r2, uid, newSeed, esc } from './core/util.js';
import * as TR from './core/terrain.js';
import { History } from './edit/history.js';
import { Interaction, groundUnder } from './edit/interaction.js';
import { Stage } from './render/stage.js';
import { Sync } from './render/sync.js';
import { thumbFor, hasThumb } from './render/thumbs.js';
import * as V from './ui/views.js';

const $ = (s, r = document) => r.querySelector(s);
const QKEY = 'moss-studio-quality';

let db = loadDB();
let work = null, stage = null, sync = null, inter = null;
const hist = new History();
const state = {
  screen: 'home', setup: null, sheet: null, lastCat: null, ttool: null, brush: { size: 2.5, strength: 0.5 },
  sel: null, selPoint: null, cform: null, auto: false, outImgs: null,
  quality: (() => { try { return localStorage.getItem(QKEY) || 'high'; } catch (e) { return 'high'; } })(),
};

/* ---------- 共通 ---------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800); }
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.add('on'); }
function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }
let persistT = 0;
function persist(now = false) {
  if (!work) return; work.updated = Date.now();
  const i = db.works.findIndex(w => w.id === work.id);
  if (i < 0) db.works.unshift(work); else db.works[i] = work;
  clearTimeout(persistT);
  if (now) return saveDB(db);
  persistT = setTimeout(() => saveDB(db), 400); return true;
}
function commit() { if (hist.commit(work)) persist(); updateUndo(); }
function updateUndo() { const u = $('#bUndo'), r = $('#bRedo'); if (u) { u.disabled = !hist.canUndo; r.disabled = !hist.canRedo; } }
const sel = () => work && work.items.find(i => i.id === state.sel);
const mode = () => (state.sheet === 'soil' && state.ttool) ? 'terrain' : 'object';

/* ---------- 3D ---------- */
function ensureStage() {
  if (stage) return;
  stage = new Stage($('#host'));
  stage.setQuality(state.quality);
  stage.onAutoChange = on => { state.auto = on; $('#bAuto').classList.toggle('on', on); };
  sync = new Sync(stage);
  inter = new Interaction(stage, sync, {
    work: () => work, mode, terrainTool: () => state.ttool, brush: () => state.brush,
    select: id => selectItem(id),
    selectPoint: id => { state.selPoint = id; refreshPoints(); renderSheet(); },
    addPoint: (x, z) => { const p = { id: uid(), x: r1(x), z: r1(z), h: r1(Math.min(TR.maxSoilH(), TR.heightAt(x, z) + 2)), r: 4 }; work.terrain.points.push(p); state.selPoint = p.id; TR.computeComp(); terrainChanged(false); renderSheet(); return p; },
    itemChanged: (it, live) => { sync.syncItems(work, live); },
    itemDragEnd: () => { sync.syncItems(work, false); if (state.sheet === 'item') renderSheet(); },
    terrainEdited: live => { terrainChanged(live); if (!live) renderSheet(); },
    commit,
  });
}
function terrainChanged(live) {
  for (const it of work.items) if (it.onGround && MATERIALS[it.mat].cat !== 'moss') it.y = r2(groundUnder(it) - it.sink);
  sync.rebuildSoil(work); sync.syncItems(work, live); refreshPoints();
}
function refreshPoints() { if (sync) sync.showPoints(work.terrain.points, state.selPoint, mode() === 'terrain' && state.ttool === 'point'); }
function loadIntoStage() {
  TR.bindWork(work);
  sync.clearAll(); sync.rebuildContainer(work); sync.rebuildSoil(work);
  for (const it of work.items) if (it.onGround && MATERIALS[it.mat].cat !== 'moss') it.y = r2(groundUnder(it) - it.sink);
  sync.syncItems(work); sync.select(null, work); refreshPoints();
}
function selectItem(id) {
  state.sel = id; sync.select(id, work);
  if (id) { if (state.sheet !== 'item' && CATEGORIES.some(c => c.id === state.sheet && c.kind === 'material')) state.lastCat = state.sheet; state.sheet = 'item'; }
  else if (state.sheet === 'item') state.sheet = state.lastCat || null;
  renderSheet();
}

/* ---------- 画面 ---------- */
function render() {
  const app = $('#app'), ed = $('#editor');
  if (state.screen === 'editor') { app.innerHTML = ''; app.hidden = true; ed.hidden = false; ensureStage(); stage.start(); renderEditor(); return; }
  ed.hidden = true; app.hidden = false; if (stage) stage.stop();
  if (state.screen === 'home') app.innerHTML = V.homeHTML(db);
  else if (state.screen === 'setup') app.innerHTML = V.setupHTML(state.setup);
  else if (state.screen === 'output') {
    app.innerHTML = V.outputHTML(work, state.outImgs, V.materialRows(work), TR.soilVolume());
  }
}
function renderEditor() {
  $('#edTitle').innerHTML = esc(work.name);
  document.querySelectorAll('.dock [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === state.sheet || (state.sheet === 'item' && sel() && MATERIALS[sel().mat].cat === b.dataset.cat)));
  $('#bAuto').classList.toggle('on', state.auto);
  updateUndo(); renderSheet();
}
function lim() { const e = TR.ext(); return { hx: r1(e.hx - TR.GLASS_T), hz: r1(e.hz - TR.GLASS_T) }; }
function renderSheet() {
  const S = $('#sheet'); if (!S || state.screen !== 'editor') return;
  let h = '';
  const sh = state.sheet;
  if (sh === 'item') { const it = sel(); if (!it) { state.sheet = state.lastCat || null; return renderSheet(); } h = V.itemSheet(it, work, lim()); }
  else if (sh === 'container') h = V.containerSheet(work, state.cform || (state.cform = Object.assign({}, work.container)));
  else if (sh === 'soil') h = V.soilSheet(work, state, TR.maxSoilH());
  else if (sh === 'layers') h = V.layersSheet(work, state.sel);
  else if (sh === 'settings') h = V.settingsSheet(work, state.quality);
  else if (sh) h = V.materialSheet(sh, id => hasThumb(id) ? thumbFor(id) : '');
  S.innerHTML = h; S.classList.toggle('on', !!h);
  document.querySelectorAll('.dock [data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === sh || (sh === 'item' && sel() && MATERIALS[sel().mat].cat === b.dataset.cat)));
  $('#hint').textContent = mode() === 'terrain' ? (state.ttool === 'point' ? '土をタップでポイント追加・ドラッグで移動' : '土の上をなぞって編集') : (state.sel ? '' : '素材をドラッグで移動／何もない所のドラッグで視点を回転');
  if (sh && CATEGORIES.some(c => c.id === sh && c.kind === 'material')) fillThumbs();
  refreshPoints(); if (mode() !== 'terrain') sync && sync.hideCursor();
}
function fillThumbs() {
  const imgs = [...document.querySelectorAll('img[data-thumb]')].filter(i => !i.getAttribute('src'));
  let k = 0; const next = () => { const img = imgs[k++]; if (!img) return; try { img.src = thumbFor(img.dataset.thumb); } catch (e) { } setTimeout(next, 0); }; setTimeout(next, 30);
}

function enterEditor(w) {
  work = w; state.screen = 'editor'; state.sel = null; state.selPoint = null; state.sheet = null; state.ttool = null; state.cform = null; state.auto = false;
  render(); loadIntoStage(); hist.reset(work); stage.setAuto(false); stage.setView('angle'); renderEditor();
}
function leaveEditor() {
  if (!work || !stage) return;
  const w = work; try { const url = stage.capture(); smallImage(url, 320, t => { w.thumb = t; saveDB(db); }); } catch (e) { }
  persist(true);
}
function smallImage(url, w, cb) { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = Math.round(w * img.height / img.width); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cb(cv.toDataURL('image/jpeg', 0.82)); }; img.src = url; }

// 空いている場所を探して追加
function freeSpot(it) {
  const e = TR.ext(), m = Math.min(it.w, it.d) * 0.35; let best = [0, 0], bs = -1e9;
  for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) {
    const x = -e.hx + (i + 0.5) * 2 * e.hx / 13, z = -e.hz + (j + 0.5) * 2 * e.hz / 13; if (!TR.inside(x, z, m + 0.3)) continue;
    let sc = -Math.hypot(x, z) * 0.15; let mn = 1e9;
    for (const o of work.items) if (!o.hidden) mn = Math.min(mn, Math.hypot(x - o.x, z - o.z) - Math.max(o.w, o.d) * o.s / 2);
    sc += Math.min(mn, 6); if (sc > bs) { bs = sc; best = [x, z]; }
  }
  return best;
}
function addItem(matId) {
  const it = newItem(matId);
  [it.x, it.z] = freeSpot(it).map(r1);
  if (matId.startsWith('wood')) it.rot = 0.4;
  work.items.push(it); inter.settle(it); sync.syncItems(work);
  state.lastCat = MATERIALS[matId].cat; selectItem(it.id); commit();
}

/* ---------- 項目入力 ---------- */
function applyField(k, v, live) {
  const it = sel();
  if (it && ['x', 'z', 'y', 'rot', 'tilt', 's', 'w', 'd', 'h', 'sink'].includes(k)) {
    if (k === 'x' || k === 'z') { it[k] = v; const [x, z] = TR.clampInside(it.x, it.z, Math.min(it.w, it.d) * it.s * 0.3); it.x = r2(x); it.z = r2(z); inter.settle(it); }
    else if (k === 'y') { it.y = v; it.onGround = false; }
    else if (k === 'rot') { it.rot = v * Math.PI / 180; if (it.onGround) inter.settle(it); }
    else if (k === 'tilt') it.tilt = v * Math.PI / 180;
    else if (k === 's') { it.s = v / 100; if (it.onGround) inter.settle(it); }
    else if (k === 'sink') { const old = it.sink; it.sink = v; if (it.onGround) inter.settle(it); else it.y = r2(it.y + old - v); }
    else { it[k] = v; if (it.onGround) inter.settle(it); }
    sync.syncItems(work, live && MATERIALS[it.mat].cat === 'moss' && (k === 'x' || k === 'z'));
    return;
  }
  if (k === 'base') { work.soil.base = v; TR.computeComp(); terrainChanged(live); }
  else if (k === 'bsize') state.brush.size = v;
  else if (k === 'bstr') state.brush.strength = v;
  else if (k === 'ph' || k === 'pr') { const p = work.terrain.points.find(q => q.id === state.selPoint); if (p) { p[k === 'ph' ? 'h' : 'r'] = v; TR.computeComp(); terrainChanged(live); } }
}

/* ---------- actions ---------- */
const actions = {
  new() { state.setup = { name: '新しいテラリウム', container: Object.assign({ type: 'cylinder' }, CONTAINERS.cylinder.def), soil: { type: 'akadama', base: 3 } }; state.screen = 'setup'; render(); },
  sample() { const w = sampleWork(); db.works.unshift(w); saveDB(db); enterEditor(w); },
  open(el) { const w = db.works.find(x => x.id === el.dataset.id); if (!w) return; closeModal(); if (state.screen === 'editor') leaveEditor(); enterEditor(w); },
  menu(el, ev) {
    ev.stopPropagation(); const w = db.works.find(x => x.id === el.dataset.id); if (!w) return;
    openModal(`<div class="mhead"><b>${esc(w.name)}</b><button class="x" data-action="close-modal">閉じる</button></div><div class="btns col"><button data-action="open" data-id="${w.id}">編集する</button><button data-action="dupwork" data-id="${w.id}">複製する</button><button class="danger" data-action="delwork-ask" data-id="${w.id}">削除する</button></div>`);
  },
  dupwork(el) { const w = db.works.find(x => x.id === el.dataset.id); if (!w) return; const c = JSON.parse(JSON.stringify(w)); c.id = uid(); c.name = w.name + 'のコピー'; c.updated = Date.now(); db.works.unshift(c); saveDB(db); closeModal(); render(); },
  'delwork-ask'(el) { openModal(`<div class="mhead"><b>この作品を削除しますか？</b></div><p class="hint">削除すると元に戻せません。</p><div class="btns"><button data-action="close-modal">やめる</button><button class="danger" data-action="delwork" data-id="${el.dataset.id}">削除する</button></div>`); },
  delwork(el) { db.works = db.works.filter(w => w.id !== el.dataset.id); saveDB(db); closeModal(); render(); },
  'close-modal'() { closeModal(); },
  home() { if (state.screen === 'editor') leaveEditor(); closeModal(); work = null; state.screen = 'home'; render(); },
  'setup-type'(el) { const t = el.dataset.type; state.setup.container = Object.assign({ type: t }, CONTAINERS[t].def); render(); },
  'setup-soil'(el) { state.setup.soil.type = el.dataset.type; render(); },
  'setup-done'() {
    const s = state.setup, c = normContainer(s.container);
    const w = newWork(c.type); w.name = s.name.trim() || w.name; w.container = c; w.soil = { type: s.soil.type, base: clamp(+s.soil.base || 3, 1, Math.max(1, c.h - 2)) };
    db.works.unshift(w); saveDB(db); enterEditor(w);
  },
  // 編集画面
  save() { commit(); const ok = persist(true); toast(ok ? '端末に保存しました' : '保存に失敗しました'); },
  load() { openModal(V.loadModal(db, work && work.id)); },
  'import-json'() { const t = $('[data-import-text]'); if (!t || !t.value.trim()) { toast('JSONを貼り付けてください'); return; } doImport(t.value); },
  settings() { state.sheet = state.sheet === 'settings' ? null : 'settings'; renderSheet(); },
  rename() { state.sheet = 'settings'; renderSheet(); const i = $('[data-rename]'); if (i) i.focus(); },
  quality(el) { state.quality = el.dataset.q; try { localStorage.setItem(QKEY, state.quality); } catch (e) { } stage.setQuality(state.quality); loadIntoStage(); sync.select(state.sel, work); renderSheet(); },
  undo() { const s = hist.undo(); if (s) restore(s); },
  redo() { const s = hist.redo(); if (s) restore(s); },
  view(el) { stage.setView(el.dataset.v); },
  auto() { state.auto = !state.auto; stage.setAuto(state.auto); $('#bAuto').classList.toggle('on', state.auto); },
  sheet(el) {
    const c = el.dataset.cat;
    if (state.sheet === c) { state.sheet = null; } else { state.sheet = c; if (c === 'container') state.cform = Object.assign({}, work.container); }
    if (state.sel && state.sheet !== 'item') { state.sel = null; sync.select(null, work); }
    if (state.sheet !== 'soil') state.ttool = null;
    renderSheet();
  },
  'sheet-close'() { if (state.sheet === 'item') { selectItem(null); state.sheet = null; } else state.sheet = null; state.ttool = null; renderSheet(); },
  add(el) { addItem(el.dataset.mat); },
  dup() { const it = sel(); if (!it) return; const c = Object.assign({}, it, { id: uid(), seed: newSeed() }); const [x, z] = TR.clampInside(it.x + 1.5, it.z + 1.5); c.x = r2(x); c.z = r2(z); work.items.push(c); inter.settle(c); sync.syncItems(work); selectItem(c.id); commit(); },
  del() { work.items = work.items.filter(i => i.id !== state.sel); state.sel = null; sync.syncItems(work); selectItem(null); commit(); },
  reroll() { const it = sel(); if (!it) return; it.seed = newSeed(); sync.syncItems(work); commit(); },
  ground() { const it = sel(); if (!it) return; inter.settle(it); sync.syncItems(work); commit(); renderSheet(); },
  color(el) { const it = sel(); if (!it) return; const m = MATERIALS[it.mat]; it.color = el.dataset.c === m.color ? null : el.dataset.c; sync.syncItems(work); commit(); renderSheet(); },
  'layer-select'(el) { selectItem(el.dataset.id); },
  'layer-hide'(el) { const it = work.items.find(i => i.id === el.dataset.id); if (!it) return; it.hidden = !it.hidden; sync.syncItems(work); commit(); renderSheet(); },
  'layer-del'(el) { work.items = work.items.filter(i => i.id !== el.dataset.id); if (state.sel === el.dataset.id) { state.sel = null; sync.select(null, work); } sync.syncItems(work); commit(); renderSheet(); },
  'soil-type'(el) { work.soil.type = el.dataset.type; sync.rebuildSoil(work); commit(); renderSheet(); },
  ttool(el) { state.ttool = el.dataset.t || null; if (state.ttool !== 'point') state.selPoint = null; if (state.sel) { state.sel = null; sync.select(null, work); } renderSheet(); },
  pdel() { work.terrain.points = work.terrain.points.filter(p => p.id !== state.selPoint); state.selPoint = null; TR.computeComp(); terrainChanged(false); commit(); renderSheet(); },
  pdesel() { state.selPoint = null; renderSheet(); },
  flatten() { work.terrain.data = new Array(work.terrain.n * work.terrain.n).fill(0); work.terrain.points = []; state.selPoint = null; TR.computeComp(); terrainChanged(false); commit(); renderSheet(); toast('地形を平らに戻しました'); },
  'cform-type'(el) { const t = el.dataset.type; state.cform = t === work.container.type ? Object.assign({}, work.container) : Object.assign({ type: t }, CONTAINERS[t].def); renderSheet(); },
  'cform-apply'() {
    work.container = normContainer(state.cform); work.soil.base = clamp(work.soil.base, 1, Math.max(1, work.container.h - 2));
    TR.computeComp();
    for (const it of work.items) { const [x, z] = TR.clampInside(it.x, it.z, Math.min(it.w, it.d) * it.s * 0.3); it.x = r2(x); it.z = r2(z); }
    sync.rebuildContainer(work); sync.rebuildSoil(work); for (const it of work.items) inter.settle(it); sync.syncItems(work); stage.setView('angle');
    state.cform = Object.assign({}, work.container); commit(); renderSheet(); toast('容器を変更しました');
  },
  // 出力
  output() {
    state.outImgs = { angle: stage.capture(), top: stage.capture('top') };
    leaveEditor(); state.screen = 'output'; render();
  },
  showimg(el) { const u = state.outImgs[el.dataset.k]; openModal(`<div class="mhead"><b>画像</b><button class="x" data-action="close-modal">閉じる</button></div><img class="mimg" src="${u}" alt=""><p class="hint">長押し（右クリック）で保存できます。</p><div class="btns"><a class="btnlink" href="${u}" download="${esc(work.name)}.png">ダウンロード</a></div>`); },
  'back-editor'() { state.screen = 'editor'; render(); },
  json() { openModal(`<div class="mhead"><b>設計データ（JSON）</b><button class="x" data-action="close-modal">閉じる</button></div><textarea class="json" readonly>${esc(exportJSON(work))}</textarea><div class="btns"><button data-action="copyjson">コピー</button></div><p class="hint">コピーして保存しておくと、別の端末の「読み込み」から復元できます。</p>`); },
  copyjson() { const t = $('.json'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('コピーしました'), () => { try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('テキストを選択してコピーしてください'); } }); },
};
function normContainer(c0) {
  const c = Object.assign({}, c0);
  c.w = clamp(+c.w || 10, 5, 60); c.h = clamp(+c.h || 10, 5, 60); c.d = c.type === 'box' ? clamp(+c.d || 10, 5, 60) : c.w;
  c.mouth = c.type === 'bowl' ? clamp(+c.mouth || c.w * 0.6, 3, c.w - 1) : c.w; return c;
}
function restore(s) {
  Object.assign(work, s);
  if (state.sel && !work.items.find(i => i.id === state.sel)) state.sel = null;
  if (state.selPoint && !work.terrain.points.find(p => p.id === state.selPoint)) state.selPoint = null;
  TR.computeComp(); sync.clearAll(); sync.rebuildContainer(work); sync.rebuildSoil(work); sync.syncItems(work); sync.select(state.sel, work);
  persist(); updateUndo(); renderSheet();
}
function doImport(text) {
  try { const w = importJSON(text); db.works.unshift(w); saveDB(db); closeModal(); if (state.screen === 'editor') leaveEditor(); enterEditor(w); toast('読み込みました'); }
  catch (e) { toast('読み込めませんでした：' + e.message); }
}

/* ---------- イベント ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const a = actions[el.dataset.action]; if (a && !el.disabled) a(el, ev);
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.setup) { const k = t.dataset.setup, s = state.setup; if (k === 'name') s.name = t.value; else if (k === 'base') s.soil.base = t.value; else s.container[k] = t.value; return; }
  if (t.dataset.cform) { state.cform[t.dataset.cform] = t.value; return; }
  if (t.hasAttribute('data-rename')) { work.name = t.value; $('#edTitle').textContent = work.name; persist(); return; }
  const k = t.dataset.f; if (!k) return;
  const v = +t.value; if (!isFinite(v)) return;
  document.querySelectorAll(`[data-f="${k}"]`).forEach(o => { if (o !== t) o.value = v; });
  applyField(k, v, true);
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.hasAttribute('data-import-file') && t.files[0]) { const f = new FileReader(); f.onload = () => doImport(f.result); f.readAsText(t.files[0]); return; }
  const k = t.dataset.f; if (!k) return;
  if (t.type === 'number') applyField(k, +t.value, false);
  if (['bsize', 'bstr'].includes(k)) return;
  const it = sel(); if (it && MATERIALS[it.mat].cat === 'moss') sync.syncItems(work, false);
  if (k === 'base' || k === 'ph' || k === 'pr') terrainChanged(false);
  commit(); if (['h', 'sink', 'y', 'x', 'z'].includes(k) && state.sheet === 'item') renderSheet();
});
document.addEventListener('keydown', e => {
  if (state.screen !== 'editor' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? actions.redo() : actions.undo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) actions.del();
  else if (e.key === 'Escape') selectItem(null);
});
window.addEventListener('pagehide', () => { if (state.screen === 'editor') leaveEditor(); });

// 動作確認用
window.__moss = { state, get work() { return work; }, get stage() { return stage; }, get sync() { return sync; }, actions, TR };
render();
