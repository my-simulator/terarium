// 容器の内寸と土の地形（高さデータ）。座標は x / z（cm）、高さ y。
import { clamp, lerp } from './util.js';

export const GLASS_T = 0.3, BOTTOM_T = 0.4;
let W = null;
let comp = null, compN = 0;
export let terrainVersion = 0;

export function bindWork(w) { W = w; computeComp(); }

export function ext(c = W.container) { return c.type === 'box' ? { hx: c.w / 2, hz: c.d / 2 } : { hx: c.w / 2, hz: c.w / 2 }; }
export function bowlR(y, c = W.container, outer = false) {
  const t = outer ? 0 : GLASS_T;
  const R = c.w / 2 - t, m = Math.min(c.mouth, c.w - 0.5) / 2 - t;
  const s = Math.sqrt(Math.max(0, R * R - m * m));
  const cy = c.h - s;
  let r = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
  if (y < cy) r = Math.max(r, R * 0.42);
  return r;
}
export function innerR(y, c = W.container) { return c.type === 'bowl' ? bowlR(y, c) : c.w / 2 - GLASS_T; }
export function soilR() { const c = W.container; return c.type === 'bowl' ? bowlR(W.soil.base) - 0.15 : c.w / 2 - GLASS_T - 0.05; }
export function inside(x, z, m = 0) {
  const c = W.container;
  if (c.type === 'box') { const e = ext(); return Math.abs(x) <= e.hx - GLASS_T - m && Math.abs(z) <= e.hz - GLASS_T - m; }
  const R = soilR() - m; return x * x + z * z <= R * R;
}
export function clampInside(x, z, m = 0) {
  const c = W.container;
  if (c.type === 'box') { const e = ext(); const ax = Math.max(0, e.hx - GLASS_T - m), az = Math.max(0, e.hz - GLASS_T - m); return [clamp(x, -ax, ax), clamp(z, -az, az)]; }
  const R = Math.max(0, soilR() - m), d = Math.hypot(x, z); if (d <= R) return [x, z]; return [x / d * R, z / d * R];
}
export const maxSoilH = () => Math.max(1, W.container.h - 1.5);

export function computeComp() {
  const t = W.terrain, n = t.n, data = t.data, e = ext(), base = W.soil.base, mx = maxSoilH();
  if (!comp || compN !== n) { comp = new Float32Array(n * n); compN = n; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -e.hx + 2 * e.hx * i / (n - 1), z = -e.hz + 2 * e.hz * j / (n - 1);
    let h = base + data[j * n + i];
    for (const p of t.points) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) { const s = 1 - d / p.r, w = s * s * (3 - 2 * s); h += (p.h - h) * w; }
    }
    comp[j * n + i] = clamp(h, 0.2, mx);
  }
  terrainVersion++;
}
function cr(p0, p1, p2, p3, t) { return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))); }
export function heightAt(x, z) {
  const n = compN, e = ext();
  const gx = clamp((x + e.hx) / (2 * e.hx) * (n - 1), 0, n - 1.0001), gz = clamp((z + e.hz) / (2 * e.hz) * (n - 1), 0, n - 1.0001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const at = (a, b) => comp[clamp(b, 0, n - 1) * n + clamp(a, 0, n - 1)];
  const row = b => cr(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), fx);
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), fz);
}

// ブラシ：tool = raise | lower | smooth
export function applyBrush(px, pz, tool, size, strength) {
  const t = W.terrain, n = t.n, data = t.data, e = ext(), R = size, base = W.soil.base, mx = maxSoilH();
  const gi = v => (v + e.hx) / (2 * e.hx) * (n - 1), gj = v => (v + e.hz) / (2 * e.hz) * (n - 1);
  const i0 = Math.max(0, Math.floor(gi(px - R))), i1 = Math.min(n - 1, Math.ceil(gi(px + R)));
  const j0 = Math.max(0, Math.floor(gj(pz - R))), j1 = Math.min(n - 1, Math.ceil(gj(pz + R)));
  const copy = tool === 'smooth' ? data.slice() : null;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -e.hx + 2 * e.hx * i / (n - 1), z = -e.hz + 2 * e.hz * j / (n - 1), d = Math.hypot(x - px, z - pz);
    if (d > R) continue; const s = 1 - d / R, f = s * s * (3 - 2 * s), k = j * n + i;
    if (tool === 'raise') data[k] += strength * 0.35 * f;
    else if (tool === 'lower') data[k] -= strength * 0.35 * f;
    else {
      let sum = 0, c = 0;
      for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; sum += copy[jj * n + ii]; c++; }
      data[k] = lerp(data[k], sum / c, clamp(strength * f * 0.6, 0, 1));
    }
    data[k] = clamp(data[k], 0.2 - base, mx - base);
  }
}

export function soilVolume() {
  const e = ext(), N = 90; let v = 0; const dx = 2 * e.hx / N, dz = 2 * e.hz / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -e.hx + (i + 0.5) * dx, z = -e.hz + (j + 0.5) * dz;
    if (inside(x, z)) v += heightAt(x, z) * dx * dz;
  }
  return v; // cm3
}
