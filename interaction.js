// 3D空間上の操作：素材の選択・移動・積み重ね・2本指の回転拡大、地形ブラシ、ポイント編集
// 素材や土に触れた指はこちらで処理し、何もない所の操作は視点操作（OrbitControls）に渡す。
import * as THREE from 'three';
import { MATERIALS } from '../data/catalog.js';
import * as TR from '../core/terrain.js';
import { clamp, r1, r2, lerp } from '../core/util.js';

const T = THREE;
const UP = new T.Vector3(0, 1, 0), DOWN = new T.Vector3(0, -1, 0);

// 素材の下の地面の高さ（数点の平均と最低点の間）
export function groundUnder(it) {
  const c = Math.cos(it.rot), s = Math.sin(it.rot), w = it.w * it.s, d = it.d * it.s;
  const pts = [[0, 0], [w * 0.3, 0], [-w * 0.3, 0], [0, d * 0.3], [0, -d * 0.3]];
  let sum = 0, mn = 1e9;
  for (const [lx, lz] of pts) { const h = TR.heightAt(it.x + lx * c + lz * s, it.z - lx * s + lz * c); sum += h; mn = Math.min(mn, h); }
  return lerp(mn, sum / pts.length, 0.6);
}

export class Interaction {
  constructor(stage, sync, app) {
    this.stage = stage; this.sync = sync; this.app = app;
    this.ray = new T.Raycaster(); this.pointers = new Map(); this.drag = null; this.pinch = null; this.down = null;
    const h = stage.host;
    h.addEventListener('pointerdown', e => this.onDown(e), true);
    h.addEventListener('pointermove', e => this.onMove(e), true);
    h.addEventListener('pointerup', e => this.onUp(e), true);
    h.addEventListener('pointercancel', e => this.onUp(e), true);
    h.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !this.drag) this.sync.hideCursor(); });
  }
  ptr(e) { const r = this.stage.host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }
  setRay(p) { this.ray.setFromCamera(new T.Vector2(p.x / p.w * 2 - 1, -(p.y / p.h) * 2 + 1), this.stage.camera); }
  hitSoil(p) { this.setRay(p); const m = this.sync.soilMesh(); if (!m) return null; const h = this.ray.intersectObject(m, false)[0]; return h ? h.point : null; }

  // 素材を真下の面（土 or 石・流木）に載せる
  settle(it) {
    if (MATERIALS[it.mat].cat === 'moss') return;
    const work = this.app.work(), soil = this.sync.soilMesh();
    this.ray.set(new T.Vector3(it.x, work.container.h + 20, it.z), DOWN);
    const hits = this.ray.intersectObjects([soil, ...this.sync.solids(it.id, work)], false);
    const h = hits[0];
    if (!h || h.object === soil) { it.onGround = true; it.y = r2(groundUnder(it) - it.sink); }
    else { it.onGround = false; it.y = r2(h.point.y - it.sink); }
  }

  onDown(e) {
    const p = this.ptr(e); this.pointers.set(e.pointerId, p);
    const work = this.app.work(); if (!work) return;
    if (this.drag && this.drag.type === 'item' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()], it = this.drag.it;
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s: it.s, rot: it.rot };
      this.stage.host.setPointerCapture(e.pointerId); e.stopPropagation(); return;
    }
    if (this.pointers.size > 1) return;
    this.down = { x: p.x, y: p.y, t: performance.now(), hitItem: false };
    const mode = this.app.mode();
    if (mode === 'terrain') {
      const tool = this.app.terrainTool(); if (!tool) return;
      if (tool === 'point') {
        this.setRay(p);
        const ph = this.ray.intersectObjects(this.sync.pointGroup.children.filter(o => o.userData.pointId), false)[0];
        if (ph) { const pt = work.terrain.points.find(q => q.id === ph.object.userData.pointId); this.app.selectPoint(pt.id); this.drag = { type: 'point', pt }; }
        else { const sp = this.hitSoil(p); if (sp) { const pt = this.app.addPoint(sp.x, sp.z); this.drag = { type: 'point', pt }; } }
      } else {
        const sp = this.hitSoil(p);
        if (sp) { this.drag = { type: 'brush', last: sp.clone(), acc: 0 }; this.brushAt(sp.x, sp.z); this.app.terrainEdited(true); }
      }
    } else {
      this.setRay(p);
      const hit = this.ray.intersectObjects(this.sync.pickables(), false)[0];
      if (hit) {
        const it = work.items.find(i => i.id === hit.object.userData.itemId);
        if (it) {
          this.down.hitItem = true; this.app.select(it.id);
          const py = MATERIALS[it.mat].cat === 'moss' ? TR.heightAt(it.x, it.z) : it.y;
          const plane = new T.Plane(UP, -py), hp = new T.Vector3();
          if (this.ray.ray.intersectPlane(plane, hp)) this.drag = { type: 'item', it, plane, ox: it.x - hp.x, oz: it.z - hp.z, moved: false };
        }
      }
    }
    if (this.drag) { this.stage.host.setPointerCapture(e.pointerId); e.stopPropagation(); }
  }
  brushAt(x, z) {
    const b = this.app.brush();
    TR.applyBrush(x, z, this.app.terrainTool(), b.size, b.strength); TR.computeComp();
    this.sync.showCursor(x, z, b.size);
  }
  onMove(e) {
    const p = this.ptr(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (!this.drag) {
      const tool = this.app.mode() === 'terrain' && this.app.terrainTool();
      if (e.pointerType === 'mouse' && tool && tool !== 'point') { const sp = this.hitSoil(p); if (sp) this.sync.showCursor(sp.x, sp.z, this.app.brush().size); else this.sync.hideCursor(); }
      return;
    }
    e.stopPropagation();
    const d = this.drag;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinch.d0), da = Math.atan2(b.y - a.y, b.x - a.x) - this.pinch.a0;
      d.it.s = r2(clamp(this.pinch.s * k, 0.2, 4)); d.it.rot = this.pinch.rot - da; d.moved = true;
      this.settle(d.it); this.app.itemChanged(d.it, true); return;
    }
    if (d.type === 'item') {
      this.setRay(p); const hp = new T.Vector3();
      if (!this.ray.ray.intersectPlane(d.plane, hp)) return;
      const it = d.it, m = Math.min(it.w, it.d) * it.s * 0.3;
      const [x, z] = TR.clampInside(hp.x + d.ox, hp.z + d.oz, m);
      it.x = r2(x); it.z = r2(z); d.moved = true; this.settle(it); this.app.itemChanged(it, true);
    } else if (d.type === 'brush') {
      const sp = this.hitSoil(p); if (!sp) return;
      const step = Math.max(0.15, this.app.brush().size * 0.25), dist = Math.hypot(sp.x - d.last.x, sp.z - d.last.z);
      d.acc += dist;
      if (d.acc >= step) {
        const n = Math.floor(d.acc / step);
        for (let i = 1; i <= n; i++) this.brushAt(lerp(d.last.x, sp.x, i / n), lerp(d.last.z, sp.z, i / n));
        d.acc -= n * step; d.last.copy(sp); this.app.terrainEdited(true);
      } else this.sync.showCursor(sp.x, sp.z, this.app.brush().size);
    } else if (d.type === 'point') {
      const sp = this.hitSoil(p); if (!sp) return;
      const [x, z] = TR.clampInside(sp.x, sp.z); d.pt.x = r1(x); d.pt.z = r1(z); d.moved = true;
      TR.computeComp(); this.app.terrainEdited(true);
    }
  }
  onUp(e) {
    const p = this.ptr(e); this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) { this.pinch = null; } e.stopPropagation(); if (this.pointers.size > 0) return; }
    const d = this.drag;
    if (d) {
      e.stopPropagation(); this.drag = null;
      if (d.type === 'item') this.app.itemDragEnd(d.it);
      else if (d.type === 'brush') { this.app.terrainEdited(false); if (e.pointerType !== 'mouse') this.sync.hideCursor(); }
      else if (d.type === 'point') this.app.terrainEdited(false);
      this.app.commit(); return;
    }
    const dn = this.down; this.down = null;
    if (dn && this.app.mode() === 'object' && !dn.hitItem && Math.hypot(p.x - dn.x, p.y - dn.y) < 6 && performance.now() - dn.t < 500) this.app.select(null);
  }
}
