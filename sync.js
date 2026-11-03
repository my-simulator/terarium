// 作品データ → 3Dシーンの反映（変更のあった素材だけ作り直す）
import * as THREE from 'three';
import { MATERIALS } from '../data/catalog.js';
import * as TR from '../core/terrain.js';
import { buildGlass, buildSoil, buildItem } from './builders.js';

const T = THREE;

function dispose(o) {
  o.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose());
  });
  if (o.parent) o.parent.remove(o);
}

export class Sync {
  constructor(stage) {
    this.stage = stage; this.map = new Map(); this.glass = null; this.soil = null; this.selId = null;
    const ringMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    this.ring = new T.Mesh(new T.RingGeometry(0.92, 1, 72), ringMat); this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 10; this.ring.visible = false;
    this.cursor = new T.LineLoop(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(new Float32Array(64 * 3), 3)), new T.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
    this.cursor.renderOrder = 11; this.cursor.visible = false; this.cursor.raycast = () => { };
    this.pointGroup = new T.Group();
    stage.helpers.add(this.ring, this.cursor, this.pointGroup);
  }
  get quality() { return this.stage.quality; }
  rebuildContainer(work) {
    if (this.glass) dispose(this.glass);
    this.glass = buildGlass(work.container, this.quality); this.stage.world.add(this.glass);
    this.stage.frame(work.container);
  }
  rebuildSoil(work) {
    if (this.soil) dispose(this.soil);
    this.soil = buildSoil(work, this.quality); this.stage.world.add(this.soil); this.stage.dirty = true;
  }
  soilMesh() { return this.soil && this.soil.userData.surface; }
  key(it) {
    const base = [it.mat, it.w, it.d, it.h, it.seed, it.color];
    if (MATERIALS[it.mat].cat === 'moss') base.push(it.x, it.z, it.rot, it.s, TR.terrainVersion);
    return base.join('|');
  }
  // live=true の間は苔の作り直しを保留（ドラッグ中・ブラシ中の負荷を抑える）
  syncItems(work, live = false) {
    const seen = new Set();
    for (const it of work.items) {
      seen.add(it.id);
      let e = this.map.get(it.id); const k = this.key(it);
      const draped = MATERIALS[it.mat].cat === 'moss';
      if (!e || (e.key !== k && !(live && draped))) {
        if (e) dispose(e.obj);
        const obj = buildItem(it, { quality: this.quality });
        this.stage.world.add(obj); e = { obj, key: k }; this.map.set(it.id, e);
      }
      this.applyTransform(it, e.obj);
    }
    for (const [id, e] of this.map) if (!seen.has(id)) { dispose(e.obj); this.map.delete(id); }
    this.updateRing(work); this.stage.dirty = true;
  }
  applyTransform(it, obj) {
    obj.visible = !it.hidden;
    if (obj.userData.draped) { obj.position.set(it.x, 0, it.z); obj.updateMatrixWorld(true); return; }
    obj.position.set(it.x, it.y, it.z); obj.rotation.order = 'YXZ'; obj.rotation.set(it.tilt, it.rot, 0); obj.scale.setScalar(it.s); obj.updateMatrixWorld(true);
  }
  clearAll() { for (const e of this.map.values()) dispose(e.obj); this.map.clear(); }
  pickables(excludeId) {
    const arr = [];
    for (const [id, e] of this.map) { if (id === excludeId || !e.obj.visible) continue; e.obj.traverse(o => { if (o.isMesh && !o.isInstancedMesh) arr.push(o); }); }
    return arr;
  }
  solids(excludeId, work) {
    const arr = [];
    for (const it of work.items) { if (it.id === excludeId || it.hidden || !MATERIALS[it.mat].solid) continue; const e = this.map.get(it.id); if (e) e.obj.traverse(o => { if (o.isMesh) arr.push(o); }); }
    return arr;
  }
  select(id, work) { this.selId = id; this.updateRing(work); }
  updateRing(work) {
    const it = this.selId && work.items.find(i => i.id === this.selId);
    if (!it || it.hidden) { this.ring.visible = false; this.stage.dirty = true; return; }
    const r = Math.max(it.w, it.d) * it.s / 2 + 0.5;
    const y = MATERIALS[it.mat].cat === 'moss' ? TR.heightAt(it.x, it.z) + 0.08 : it.y + 0.06;
    this.ring.position.set(it.x, y, it.z); this.ring.scale.setScalar(r); this.ring.visible = true; this.stage.dirty = true;
  }
  showCursor(x, z, r) {
    const a = this.cursor.geometry.attributes.position;
    for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2, px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r; a.setXYZ(i, px, TR.heightAt(px, pz) + 0.06, pz); }
    a.needsUpdate = true; this.cursor.visible = true; this.stage.dirty = true;
  }
  hideCursor() { if (this.cursor.visible) { this.cursor.visible = false; this.stage.dirty = true; } }
  showPoints(points, selId, visible) {
    const g = this.pointGroup; while (g.children.length) dispose(g.children[0]);
    if (!visible) { this.stage.dirty = true; return; }
    for (const p of points) {
      const m = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), new T.MeshBasicMaterial({ color: p.id === selId ? 0xe9b949 : 0xffffff, depthTest: false }));
      m.position.set(p.x, TR.heightAt(p.x, p.z) + 0.3, p.z); m.renderOrder = 12; m.userData.pointId = p.id; g.add(m);
      if (p.id === selId) {
        const pts = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2, px = p.x + Math.cos(t) * p.r, pz = p.z + Math.sin(t) * p.r; pts.push(px, TR.heightAt(px, pz) + 0.06, pz); }
        const l = new T.LineLoop(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(pts, 3)), new T.LineBasicMaterial({ color: 0xe9b949, depthTest: false }));
        l.renderOrder = 12; l.raycast = () => { }; g.add(l);
      }
    }
    this.stage.dirty = true;
  }
}
