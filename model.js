// 作品データの形式（バージョン付き）と旧形式からの移行
import { MATERIALS, CONTAINERS } from './catalog.js';
import { uid, r1, newSeed } from '../core/util.js';

export const SCHEMA_VERSION = 2;
export const GRID_N = 64;

export function newWork(type = 'cylinder') {
  return {
    version: SCHEMA_VERSION, id: uid(), name: '新しいテラリウム', created: Date.now(), updated: Date.now(),
    container: Object.assign({ type }, CONTAINERS[type].def),
    soil: { type: 'akadama', base: 3 },
    terrain: { n: GRID_N, data: new Array(GRID_N * GRID_N).fill(0), points: [] },
    items: [],        // オブジェクト配置型の素材
    brushLayers: [],  // 将来：砂・砂利・苔のブラシ配置
    environment: [],  // 将来：水面・滝など
    thumb: null,
  };
}

// 座標系：x=左右、y=上（容器の底=0）、z=手前奥。単位はcm。
export function newItem(matId, x = 0, z = 0) {
  const m = MATERIALS[matId];
  return {
    id: uid(), mat: matId, x, y: 0, z,
    w: m.size.w, d: m.size.d, h: m.size.h, s: 1,
    rot: 0, tilt: 0, sink: r1(m.sink * m.size.h), color: null, seed: newSeed(),
    onGround: true, hidden: false,
  };
}

export function migrate(w) {
  if (!w) return null;
  if (w.version >= 2) {
    w.brushLayers = w.brushLayers || []; w.environment = w.environment || [];
    w.terrain.points = w.terrain.points || [];
    w.items = w.items.filter(it => MATERIALS[it.mat]);
    return w;
  }
  // v1（2D設計版）→ v2
  const n = (w.terrain && w.terrain.n) || 48;
  const nw = newWork((w.container && w.container.type) || 'cylinder');
  Object.assign(nw, {
    id: w.id || uid(), name: w.name || nw.name, created: w.created || Date.now(), updated: w.updated || Date.now(),
    container: w.container || nw.container, soil: w.soil || nw.soil,
    terrain: { n, data: (w.terrain && w.terrain.data) || new Array(n * n).fill(0), points: (w.points || []).map(p => ({ id: p.id || uid(), x: p.x, z: p.y, h: p.h, r: p.r })) },
    items: (w.items || []).filter(it => MATERIALS[it.kind + '.' + it.type]).map(it => ({
      id: it.id || uid(), mat: it.kind + '.' + it.type, x: it.x, y: 0, z: it.y, w: it.w, d: it.d, h: it.h, s: 1,
      rot: -(it.rot || 0), tilt: 0, sink: it.embed || 0, color: null, seed: it.seed || newSeed(), onGround: true, hidden: false,
    })),
    thumb: w.thumb3d || w.thumb || null,
  });
  return nw;
}

export function sampleWork() {
  const w = newWork('cylinder');
  w.name = 'サンプル：苔の小山';
  w.container = { type: 'cylinder', w: 13, d: 13, h: 16, mouth: 13 };
  w.terrain.points = [{ id: uid(), x: -2.2, z: -1.6, h: 6.2, r: 5.5 }, { id: uid(), x: 3.2, z: 2.6, h: 2.4, r: 4 }];
  const add = (mat, x, z, o = {}) => { const it = Object.assign(newItem(mat, x, z), o); w.items.push(it); };
  add('stone.seika', -2.6, -2.2, { rot: -0.4, w: 4.6, d: 3.4, h: 6.2, sink: 0.8 });
  add('stone.lava', 1.6, -3.0, { w: 3.4, d: 2.8, h: 2.4 });
  add('wood.branch', 0.8, 1.2, { rot: 0.5, w: 8.4 });
  add('moss.hosoba', -1.0, -0.2, { w: 4.4, d: 4 });
  add('moss.tama', 3.2, 2.5, { w: 3.2, d: 3 });
  add('moss.hai', -0.6, 3.4, { w: 6, d: 4 });
  add('moss.shinobu', -4.0, 1.2, { w: 3.6, d: 4.4, rot: -0.8 });
  add('plant.fittonia', 3.4, -0.6, { w: 3.6, d: 3.6, h: 4 });
  return w;
}

export function cloneForSave(w) {
  return {
    app: 'MossStudio', version: w.version, name: w.name, container: w.container, soil: w.soil,
    terrain: { n: w.terrain.n, data: w.terrain.data.map(v => Math.round(v * 1000) / 1000), points: w.terrain.points },
    items: w.items, brushLayers: w.brushLayers, environment: w.environment,
  };
}
