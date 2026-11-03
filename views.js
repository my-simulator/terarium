// 画面・パネルのHTML（描画処理とは分離）
import { CONTAINERS, SOILS, CATEGORIES, MATERIALS, matsOf } from '../data/catalog.js';
import { esc, r1 } from '../core/util.js';

const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
export const containerLabel = c => CONTAINERS[c.type].name + '・' + (c.type === 'box' ? `${c.w}×${c.d}×${c.h}cm` : `径${c.w}×高${c.h}cm`);

export function homeHTML(db) {
  const list = db.works.map(w => `
    <div class="card" data-action="open" data-id="${w.id}">
      <div class="thumb">${w.thumb ? `<img src="${w.thumb}" alt="">` : ''}</div>
      <div class="cinfo"><div class="cname">${esc(w.name)}</div><div class="cmeta">${containerLabel(w.container)}</div><div class="cmeta">${fmtDate(w.updated)}・素材 ${w.items.length}</div></div>
      <button class="more" data-action="menu" data-id="${w.id}" aria-label="メニュー">⋯</button>
    </div>`).join('');
  return `<div class="screen home">
    <header class="hhead"><div class="brand"><span class="mark"></span>Moss Studio</div><div class="sub">スマホの中で、自分だけの小さな自然をつくる。</div></header>
    <div class="homebody">
      <button class="primary big" data-action="new">＋ 新しい作品をつくる</button>
      <div class="row2"><button class="ghost" data-action="sample">サンプルを開く</button><button class="ghost" data-action="load">読み込む</button></div>
      ${db.works.length ? `<div class="sect">保存した作品</div><div class="cards">${list}</div>` : `<div class="empty">まだ作品がありません。</div>`}
    </div></div>`;
}

const ctrIcon = t => t === 'cylinder' ? `<svg viewBox="0 0 60 60"><ellipse cx="30" cy="12" rx="16" ry="5"/><path d="M14 12v34a16 5 0 0 0 32 0V12"/><path class="soil" d="M14.6 38a16 5 0 0 0 30.8 0v8a16 5 0 0 1-30.8 0z"/></svg>` :
  t === 'bowl' ? `<svg viewBox="0 0 60 60"><ellipse cx="30" cy="12" rx="10" ry="3.5"/><path d="M20 12C6 18 6 44 18 50h24c12-6 12-32-2-38"/><path class="soil" d="M10.5 38c1 5 3.5 9.6 7.5 12h24c4-2.4 6.5-7 7.5-12z"/></svg>` :
  `<svg viewBox="0 0 60 60"><path d="M10 16l12-6h28l-12 6z"/><path d="M10 16v32h28V16M38 48l12-6V10"/><path class="soil" d="M10.5 38h27v9.5h-27z"/></svg>`;

function containerForm(c, prefix) {
  const types = Object.entries(CONTAINERS).map(([k, v]) => `<button class="ctype ${c.type === k ? 'on' : ''}" data-action="${prefix}-type" data-type="${k}">${ctrIcon(k)}<span>${v.name}</span></button>`).join('');
  const num = (f, label) => `<label class="num"><span>${label}</span><input type="number" inputmode="decimal" step="0.5" value="${c[f]}" data-${prefix}="${f}"><em>cm</em></label>`;
  const dims = c.type === 'box' ? num('w', '幅') + num('d', '奥行き') + num('h', '高さ')
    : c.type === 'bowl' ? num('w', '最大径') + num('mouth', '口径') + num('h', '高さ') : num('w', '直径') + num('h', '高さ');
  return `<div class="ctypes">${types}</div><div class="nums">${dims}</div>`;
}
export function setupHTML(s) {
  const soils = Object.entries(SOILS).map(([k, v]) => `<button class="chip ${s.soil.type === k ? 'on' : ''}" data-action="setup-soil" data-type="${k}"><i style="background:rgb(${v.rgb})"></i>${v.name}</button>`).join('');
  return `<div class="screen setup">
    <header class="bar"><button class="ib" data-action="home">←</button><div class="btitle">新しい作品</div><span></span></header>
    <div class="setbody">
      <label class="field"><span>作品名</span><input type="text" value="${esc(s.name)}" data-setup="name" maxlength="30"></label>
      <div class="sect">容器（外寸）</div>${containerForm(s.container, 'setup')}
      <div class="sect">土</div><div class="chips">${soils}</div>
      <label class="num wide"><span>基本の土の厚さ</span><input type="number" inputmode="decimal" step="0.5" value="${s.soil.base}" data-setup="base"><em>cm</em></label>
      <button class="primary big" data-action="setup-done">つくりはじめる</button>
    </div></div>`;
}

/* ---------- 編集画面の下部シート ---------- */
const head = (title, extra = '') => `<div class="shead"><b>${title}</b><span class="pbtn">${extra}<button class="x" data-action="sheet-close" aria-label="閉じる">閉じる</button></span></div>`;

export function containerSheet(work, form) {
  return head('容器') + containerForm(form, 'cform') + `<p class="hint">いまの容器：${containerLabel(work.container)}${work.container.type === 'bowl' ? `・口径${work.container.mouth}cm` : ''}</p><div class="btns"><button class="primary" data-action="cform-apply">この寸法にする</button></div>`;
}

export const field = (key, label, val, min, max, step, unit) => `<div class="fr"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-f="${key}"><label class="nb"><input type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${val}" data-f="${key}"><em>${unit}</em></label></div>`;

export function soilSheet(work, st, maxH) {
  const soils = Object.entries(SOILS).map(([k, v]) => `<button class="chip ${work.soil.type === k ? 'on' : ''}" data-action="soil-type" data-type="${k}"><i style="background:rgb(${v.rgb})"></i>${v.name}</button>`).join('');
  const tools = [[null, '視点'], ['raise', '盛る'], ['lower', '削る'], ['smooth', 'ならす'], ['point', 'ポイント']].map(([k, l]) => `<button class="${st.ttool === k ? 'on' : ''}" data-action="ttool" data-t="${k || ''}">${l}</button>`).join('');
  let h = head('土') + `<div class="chips">${soils}</div>` + field('base', '基本の厚さ', r1(work.soil.base), 1, Math.min(20, r1(maxH)), 0.1, 'cm');
  h += `<div class="sub2">地形の編集</div><div class="seg">${tools}</div>`;
  if (st.ttool === 'point') {
    const p = work.terrain.points.find(q => q.id === st.selPoint);
    h += p ? field('ph', 'ポイントの高さ', r1(p.h), 0.3, r1(maxH), 0.1, 'cm') + field('pr', '影響の範囲', r1(p.r), 1, 15, 0.1, 'cm') + `<div class="btns"><button class="danger" data-action="pdel">ポイントを削除</button><button data-action="pdesel">選択を外す</button></div>`
      : `<p class="hint">土をタップしてポイントを追加。ポイントの高さに合わせて、まわりがなだらかにつながります。</p>`;
  } else if (st.ttool) {
    h += field('bsize', 'ブラシの大きさ', st.brush.size, 0.5, 8, 0.1, 'cm') + field('bstr', '強さ', st.brush.strength, 0.1, 1, 0.05, '') + `<p class="hint">土の上をなぞって編集します。視点を動かすときは容器の外をドラッグしてください。</p>`;
  } else h += `<p class="hint">「盛る」などを選ぶと、3D画面で直接土を編集できます。</p>`;
  h += `<div class="btns"><button data-action="flatten">地形を平らに戻す</button></div>`;
  return h;
}

export function materialSheet(cat, thumbs) {
  const c = CATEGORIES.find(x => x.id === cat);
  return head(c.label + 'を追加') + `<div class="sitems">${matsOf(cat).map(([id, m]) => `<button class="sitem" data-action="add" data-mat="${id}"><img src="${thumbs(id) || ''}" alt="" data-thumb="${id}"><span class="sn">${m.name}</span><span class="sd">${m.note}</span><span class="ss">${m.size.w}×${m.size.d}×${m.size.h}cm</span></button>`).join('')}</div>`;
}

export function itemSheet(it, work, lim) {
  const m = MATERIALS[it.mat], E = new Set(m.edit), deg = v => Math.round(((v * 180 / Math.PI) % 360 + 360) % 360);
  let h = head(`${m.name}`, `<button class="x" data-action="sheet" data-cat="${m.cat}">＋追加</button>`);
  if (E.has('pos')) h += field('x', '左右（X）', r1(it.x), -lim.hx, lim.hx, 0.1, 'cm') + field('z', '前後（Z）', r1(it.z), -lim.hz, lim.hz, 0.1, 'cm');
  if (E.has('y')) h += field('y', '高さ位置（Y）', r1(it.y), -2, r1(work.container.h), 0.1, 'cm');
  if (E.has('rot')) h += field('rot', '回転', deg(it.rot), 0, 359, 1, '°');
  if (E.has('tilt')) h += field('tilt', '傾き', Math.round(it.tilt * 180 / Math.PI), -60, 60, 1, '°');
  if (E.has('scale')) h += field('s', '大きさ', Math.round(it.s * 100), 20, 300, 1, '%');
  if (E.has('dims')) h += field('w', '幅', r1(it.w), 0.5, 30, 0.1, 'cm') + field('d', '奥行き', r1(it.d), 0.5, 30, 0.1, 'cm') + field('h', m.cat === 'moss' ? '厚み' : '高さ', r1(it.h), 0.2, m.cat === 'moss' ? 5 : 30, 0.1, 'cm');
  if (E.has('sink')) h += field('sink', '埋め込み', r1(it.sink), 0, Math.max(0.5, r1(it.h * 0.8)), 0.1, 'cm');
  if (E.has('color') && m.colors.length) h += `<div class="fr"><span>色</span><div class="swatches">${m.colors.map(c => `<button class="swc ${(it.color || m.color) === c ? 'on' : ''}" style="background:${c}" data-action="color" data-c="${c}" aria-label="${c}"></button>`).join('')}</div><span></span></div>`;
  h += `<div class="btns">${m.cat !== 'moss' ? `<button data-action="ground">${it.onGround ? '地面に置き直す' : '下の面に置く'}</button>` : ''}<button data-action="reroll">形を変える</button><button data-action="dup">複製</button><button class="danger" data-action="del">削除</button></div>`;
  h += `<p class="hint">${it.onGround ? '地面に置いています。' : '石や流木の上に載っています。'}ドラッグで移動、2本指（素材に触れたまま）で回転・拡大縮小。</p>`;
  return h;
}

export function layersSheet(work, selId) {
  const cnt = {};
  const rows = work.items.map(it => {
    const m = MATERIALS[it.mat]; cnt[it.mat] = (cnt[it.mat] || 0) + 1;
    return `<div class="lrow ${it.id === selId ? 'on' : ''} ${it.hidden ? 'off' : ''}"><button class="lname" data-action="layer-select" data-id="${it.id}"><span class="sw sw-${m.cat}"></span>${m.name} ${cnt[it.mat]}</button><button class="lb" data-action="layer-hide" data-id="${it.id}">${it.hidden ? '表示' : '隠す'}</button><button class="lb danger" data-action="layer-del" data-id="${it.id}">削除</button></div>`;
  }).reverse().join('');
  return head('レイヤー') + `<div class="layers">${rows}<div class="lrow"><button class="lname" data-action="sheet" data-cat="soil"><span class="sw" style="background:rgb(${SOILS[work.soil.type].rgb})"></span>土（${SOILS[work.soil.type].name}）</button></div><div class="lrow"><button class="lname" data-action="sheet" data-cat="container"><span class="sw sw-glass"></span>容器（${CONTAINERS[work.container.type].name}）</button></div></div>`;
}

export function settingsSheet(work, quality) {
  return head('設定') + `<label class="field"><span>作品名</span><input type="text" value="${esc(work.name)}" data-rename maxlength="30"></label>
    <div class="sub2">画質</div><div class="seg two"><button class="${quality === 'high' ? 'on' : ''}" data-action="quality" data-q="high">きれい</button><button class="${quality === 'low' ? 'on' : ''}" data-action="quality" data-q="low">軽さ優先</button></div>
    <p class="hint">「軽さ優先」は影・ガラスの屈折・苔の細かさを控えめにします。動きが重いときに。</p>
    <div class="btns col"><button data-action="output">画像・素材一覧を出力</button><button data-action="json">設計データ（JSON）を書き出す</button></div>`;
}

export function loadModal(db, curId) {
  const list = db.works.filter(w => w.id !== curId).map(w => `<button class="lw" data-action="open" data-id="${w.id}">${w.thumb ? `<img src="${w.thumb}" alt="">` : '<i></i>'}<span>${esc(w.name)}<small>${containerLabel(w.container)}</small></span></button>`).join('');
  return `<div class="mhead"><b>読み込み</b><button class="x" data-action="close-modal">閉じる</button></div>
    ${list ? `<div class="sub2">保存した作品</div><div class="lws">${list}</div>` : ''}
    <div class="sub2">設計データ（JSON）から</div>
    <label class="filebtn">ファイルを選ぶ<input type="file" accept=".json,application/json,text/plain" data-import-file></label>
    <textarea class="json" placeholder="JSONを貼り付け" data-import-text></textarea>
    <div class="btns"><button class="primary" data-action="import-json">貼り付けた内容で読み込む</button></div>`;
}

export function outputHTML(work, imgs, rows, vol) {
  const soil = SOILS[work.soil.type];
  return `<div class="screen output">
    <header class="bar"><button class="ib" data-action="back-editor">←</button><div class="btitle">出力</div><span></span></header>
    <div class="setbody">
      <div class="outimgs"><img src="${imgs.angle}" alt="" data-action="showimg" data-k="angle"><img src="${imgs.top}" alt="" data-action="showimg" data-k="top"></div>
      <p class="hint">画像をタップすると大きく表示します（長押しで保存）。</p>
      <div class="sect">使用素材</div>
      <table class="mt"><thead><tr><th>素材</th><th>数</th><th>サイズ（cm）</th></tr></thead><tbody>
        <tr><td><span class="sw" style="background:rgb(${soil.rgb})"></span>${soil.name}</td><td>—</td><td>約 ${(vol / 1000).toFixed(2)} L（${Math.round(vol)} cm³）</td></tr>
        ${rows || '<tr><td colspan="3" class="muted">素材はまだありません</td></tr>'}
      </tbody></table>
      <p class="hint">容器：${containerLabel(work.container)}${work.container.type === 'bowl' ? `・口径${work.container.mouth}cm` : ''}。土の量は地形の高さから計算した目安です（底石・水はけ層は含みません）。実物の素材には個体差があります。</p>
    </div></div>`;
}
export function materialRows(work) {
  const g = {};
  for (const it of work.items) (g[it.mat] = g[it.mat] || []).push(it);
  return Object.entries(g).map(([id, arr]) => {
    const m = MATERIALS[id];
    const sizes = arr.map(i => m.cat === 'moss' ? `${r1(i.w * i.s)}×${r1(i.d * i.s)}` : `${r1(i.w * i.s)}×${r1(i.d * i.s)}×${r1(i.h * i.s)}`).join('、');
    const area = m.cat === 'moss' ? `（計 約${Math.round(arr.reduce((a, i) => a + Math.PI * i.w * i.d * i.s * i.s / 4, 0))}cm²）` : '';
    return `<tr><td><span class="sw sw-${m.cat}"></span>${m.name}</td><td>${arr.length}</td><td>${sizes}${area}</td></tr>`;
  }).join('');
}
