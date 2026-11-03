// 3D素材の生成（容器・土・石・流木・苔・植物）
// どの生成関数も「素材の足元が y=0、中心が x=z=0」のローカル座標で作る（苔のみ地面に沿わせるため別扱い）。
import * as THREE from 'three';
import { clamp, lerp, mulberry32, vnoise3, fbm3, ringNoise } from '../core/util.js';
import { MATERIALS, SOILS } from '../data/catalog.js';
import * as TR from '../core/terrain.js';
import { soilTex, rockTex, barkTex, mossTex, leafletTex, fittoniaTex, frondTex } from './textures.js';

const T = THREE;
const { GLASS_T, BOTTOM_T } = TR;

class GB {
  constructor() { this.p = []; this.c = []; this.u = []; this.i = []; }
  v(x, y, z, col, u = 0, w = 0) { this.p.push(x, y, z); this.c.push(col.r, col.g, col.b); this.u.push(u, w); return this.p.length / 3 - 1; }
  t(a, b, c) { this.i.push(a, b, c); }
  geo() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i); g.computeVertexNormals(); return g;
  }
}
const colOf = (hex, k = 1) => new T.Color(hex).multiplyScalar(k);
const WHITE = new T.Color(1, 1, 1);
const noRay = () => { };

/* ---------------- ガラス容器 ---------------- */
export function buildGlass(c, quality) {
  const mat = quality === 'low'
    ? new T.MeshPhysicalMaterial({ color: 0xf4fbf8, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 })
    : new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.5, ior: 1.5, specularIntensity: 1, clearcoat: 0.6, clearcoatRoughness: 0.05, attenuationColor: new T.Color('#e4f2ea'), attenuationDistance: 25, side: T.DoubleSide, envMapIntensity: 1.5 });
  const g = new T.Group();
  if (c.type === 'box') {
    const hx = c.w / 2, hz = c.d / 2, t = GLASS_T, s = new T.Shape();
    s.moveTo(-hx, -hz); s.lineTo(hx, -hz); s.lineTo(hx, hz); s.lineTo(-hx, hz); s.closePath();
    const hole = new T.Path(); hole.moveTo(-hx + t, -hz + t); hole.lineTo(-hx + t, hz - t); hole.lineTo(hx - t, hz - t); hole.lineTo(hx - t, -hz + t); hole.closePath(); s.holes.push(hole);
    const wall = new T.ExtrudeGeometry(s, { depth: c.h - BOTTOM_T, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    wall.rotateX(-Math.PI / 2); wall.translate(0, BOTTOM_T, 0);
    const bottom = new T.BoxGeometry(2 * hx, BOTTOM_T, 2 * hz); bottom.translate(0, BOTTOM_T / 2, 0);
    g.add(new T.Mesh(wall, mat), new T.Mesh(bottom, mat));
  } else {
    const pts = [], N = 48;
    if (c.type === 'cylinder') {
      const Ro = c.w / 2, Ri = Ro - GLASS_T, rr = 0.35;
      pts.push(new T.Vector2(0.001, 0), new T.Vector2(Ro - rr, 0), new T.Vector2(Ro - rr * 0.3, rr * 0.3), new T.Vector2(Ro, rr), new T.Vector2(Ro, c.h - 0.08), new T.Vector2(Ro - 0.04, c.h), new T.Vector2(Ri + 0.04, c.h), new T.Vector2(Ri, c.h - 0.08), new T.Vector2(Ri, BOTTOM_T + 0.1), new T.Vector2(Ri - 0.1, BOTTOM_T), new T.Vector2(0.001, BOTTOM_T));
    } else {
      pts.push(new T.Vector2(0.001, 0));
      for (let i = 0; i <= N; i++) { const y = c.h * i / N; pts.push(new T.Vector2(TR.bowlR(y, c, true), y)); }
      for (let i = N; i >= 0; i--) { const y = BOTTOM_T + (c.h - BOTTOM_T) * i / N; pts.push(new T.Vector2(TR.bowlR(y, c), y)); }
      pts.push(new T.Vector2(0.001, BOTTOM_T));
    }
    g.add(new T.Mesh(new T.LatheGeometry(pts, 128), mat));
  }
  g.traverse(o => { if (o.isMesh) { o.raycast = noRay; o.renderOrder = 2; } });
  return g;
}

/* ---------------- 土 ---------------- */
export function buildSoil(work, quality) {
  const c = work.container, gb = new GB(), heightAt = TR.heightAt;
  const tint = y => colOf('#ffffff', clamp(0.6 + y / Math.max(4, work.soil.base * 1.6) * 0.4, 0.55, 1));
  const bottomY = BOTTOM_T + 0.02;
  let area = 0;
  if (c.type !== 'box') {
    const NR = 36, NS = 144, rb = [];
    for (let k = 0; k <= NS; k++) {
      const a = k / NS * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let R = TR.innerR(work.soil.base) - 0.05;
      if (c.type === 'bowl') for (let it = 0; it < 2; it++) { const h = heightAt(R * ca, R * sa); R = TR.innerR(h) - 0.05; }
      rb.push(R);
    }
    area = Math.PI * rb[0] * rb[0];
    const ctr = gb.v(0, heightAt(0, 0), 0, WHITE, 0, 0);
    const idx = (i, k) => 1 + (i - 1) * (NS + 1) + k;
    for (let i = 1; i <= NR; i++) for (let k = 0; k <= NS; k++) {
      const a = k / NS * Math.PI * 2, r = rb[k] * i / NR, x = Math.cos(a) * r, z = Math.sin(a) * r;
      gb.v(x, heightAt(x, z), z, WHITE, x / 6, z / 6);
    }
    for (let k = 0; k < NS; k++) gb.t(ctr, idx(1, k + 1), idx(1, k));
    for (let i = 1; i < NR; i++) for (let k = 0; k < NS; k++) { const a = idx(i, k), b = idx(i, k + 1), cc = idx(i + 1, k), d = idx(i + 1, k + 1); gb.t(a, b, cc); gb.t(b, d, cc); }
    const K = 14, s0 = gb.p.length / 3;
    for (let k = 0; k <= NS; k++) {
      const a = k / NS * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), top = heightAt(rb[k] * ca, rb[k] * sa);
      for (let m = 0; m <= K; m++) { const y = lerp(top, bottomY, m / K), R = m === 0 ? rb[k] : TR.innerR(y) - 0.05; gb.v(ca * R, y, sa * R, tint(y), a * rb[k] / 6, y / 6); }
    }
    for (let k = 0; k < NS; k++) for (let m = 0; m < K; m++) { const a = s0 + k * (K + 1) + m, b = a + K + 1; gb.t(a, b, a + 1); gb.t(b, b + 1, a + 1); }
  } else {
    const e = TR.ext(), ax = e.hx - GLASS_T - 0.05, az = e.hz - GLASS_T - 0.05, NX = 80, NZ = Math.max(12, Math.round(80 * az / ax));
    area = 4 * ax * az;
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) { const x = -ax + 2 * ax * i / NX, z = -az + 2 * az * j / NZ; gb.v(x, heightAt(x, z), z, WHITE, x / 6, z / 6); }
    const id = (i, j) => i * (NZ + 1) + j;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = id(i, j), b = id(i, j + 1), cc = id(i + 1, j), d = id(i + 1, j + 1); gb.t(a, b, cc); gb.t(b, d, cc); }
    const perim = [];
    for (let i = 0; i <= NX; i++) perim.push([-ax + 2 * ax * i / NX, -az]);
    for (let j = 1; j <= NZ; j++) perim.push([ax, -az + 2 * az * j / NZ]);
    for (let i = NX - 1; i >= 0; i--) perim.push([-ax + 2 * ax * i / NX, az]);
    for (let j = NZ - 1; j >= 0; j--) perim.push([-ax, -az + 2 * az * j / NZ]);
    const K = 10, s0 = gb.p.length / 3; let acc = 0;
    perim.forEach((p, k) => { if (k) acc += Math.hypot(p[0] - perim[k - 1][0], p[1] - perim[k - 1][1]); const top = heightAt(p[0], p[1]); for (let m = 0; m <= K; m++) { const y = lerp(top, bottomY, m / K); gb.v(p[0], y, p[1], tint(y), acc / 6, y / 6); } });
    for (let k = 0; k < perim.length - 1; k++) for (let m = 0; m < K; m++) { const a = s0 + k * (K + 1) + m, b = a + K + 1; gb.t(a, a + 1, b); gb.t(b, a + 1, b + 1); }
  }
  const soil = SOILS[work.soil.type];
  const tex = soilTex(work.soil.type, soil.rgb);
  const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 1, metalness: 0, vertexColors: true, side: T.DoubleSide });
  const mesh = new T.Mesh(gb.geo(), mat); mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.isSoil = true;
  const grp = new T.Group(); grp.add(mesh); grp.userData.surface = mesh;
  // 赤玉土の粒（表面に散らす）
  if (soil.grain) {
    const rng = mulberry32(99), count = Math.min(quality === 'low' ? 500 : 1400, Math.round(area * 7));
    const geo = new T.IcosahedronGeometry(0.13, 1), im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.95 }), count);
    const dmy = new T.Object3D(), base = new T.Color(`rgb(${soil.rgb.join(',')})`);
    let n = 0;
    for (let tries = 0; n < count && tries < count * 3; tries++) {
      const e = TR.ext(), x = (rng() * 2 - 1) * e.hx, z = (rng() * 2 - 1) * e.hz;
      if (!TR.inside(x, z, 0.2)) continue;
      const s = 0.5 + rng() * 0.9;
      dmy.position.set(x, heightAt(x, z) + 0.02, z); dmy.rotation.set(rng() * 3, rng() * 3, 0); dmy.scale.set(s, s * 0.8, s); dmy.updateMatrix();
      im.setMatrixAt(n, dmy.matrix); im.setColorAt(n, base.clone().multiplyScalar(0.75 + rng() * 0.5)); n++;
    }
    im.count = n; im.receiveShadow = true; im.raycast = noRay; grp.add(im);
  }
  return grp;
}

/* ---------------- 石 ---------------- */
function normalizeGeo(g, w, h, d) {
  g.computeBoundingBox(); const b = g.boundingBox;
  g.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2);
  g.scale(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), d / (b.max.z - b.min.z));
  return g;
}
function buildStone(it, def) {
  const g = new T.IcosahedronGeometry(1, 5), pos = g.attributes.position, sd = it.seed % 10000, n = pos.count;
  const cols = new Float32Array(n * 3), base = colOf(it.color || def.color), tmp = new T.Color(), v = new T.Vector3(), type = def.type;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1, k = 1;
    const f1 = fbm3(v.x * 1.4 + sd, v.y * 1.4, v.z * 1.4, it.seed, 3);
    if (type === 'lava') {
      r += 0.3 * f1 + 0.07 * fbm3(v.x * 6, v.y * 6, v.z * 6 + sd, it.seed + 1, 2);
      const pore = vnoise3(v.x * 11 + sd, v.y * 11, v.z * 11, it.seed + 2); if (pore > 0.7) { r -= (pore - 0.7) * 0.45; k = 0.45; }
      k *= 0.82 + 0.32 * vnoise3(v.x * 4, v.y * 4, v.z * 4 + sd, it.seed + 3) + (vnoise3(v.x * 2, v.y * 2, v.z * 2, it.seed + 9) > 0.72 ? 0.3 : 0);
    } else if (type === 'seika') {
      const ridged = 1 - Math.abs(fbm3(v.x * 2.2 + sd, v.y * 0.7, v.z * 2.2, it.seed, 3));
      const terr = Math.floor((v.y + 1) * 5 + f1 * 2) / 5;
      r += 0.32 * f1 + 0.2 * ridged + 0.04 * Math.sin(v.y * 34 + f1 * 5) + 0.03 * terr;
      const band = 0.5 + 0.5 * Math.sin(v.y * 22 + f1 * 6); k = 0.6 + band * 0.55 + 0.15 * vnoise3(v.x * 7, v.y * 20, v.z * 7, it.seed + 4);
    } else if (type === 'river') {
      r += 0.1 * fbm3(v.x * 1.1 + sd, v.y * 1.1, v.z * 1.1, it.seed, 2);
      k = 0.86 + 0.22 * vnoise3(v.x * 5, v.y * 5, v.z * 5 + sd, it.seed + 5) + (vnoise3(v.x * 9, v.y * 9, v.z * 9, it.seed + 7) > 0.8 ? 0.15 : 0);
    } else {
      const ang = Math.atan2(v.z, v.x);
      r += 0.22 * f1 + 0.035 * Math.sin(ang * 26 + f1 * 4);
      k = 0.72 + 0.32 * (0.5 + 0.5 * Math.sin(ang * 26 + f1 * 4)) + 0.12 * vnoise3(v.x * 6, v.y * 2, v.z * 6, it.seed + 6);
    }
    if (type === 'river') v.y *= 0.75;
    if (type === 'seika' && v.y < 0) v.y *= 0.6;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    tmp.copy(base).multiplyScalar(k); cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new T.BufferAttribute(cols, 3));
  normalizeGeo(g, it.w, it.h, it.d);
  // 底を少し平らにして据わりを良くする
  const flat = it.h * 0.06; for (let i = 0; i < n; i++) if (pos.getY(i) < flat) pos.setY(i, flat * 0.5 + pos.getY(i) * 0.5);
  normalizeGeo(g, it.w, it.h, it.d); g.computeVertexNormals();
  const bump = rockTex(type);
  const mat = new T.MeshStandardMaterial({ vertexColors: true, bumpMap: bump, bumpScale: type === 'river' ? 0.4 : 1.6, roughness: type === 'river' ? 0.5 : 0.93, metalness: 0 });
  const m = new T.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}

/* ---------------- 流木 ---------------- */
export function woodShape(it) {
  const rng = mulberry32(it.seed), w = it.w, d = it.d, h = it.h, br = [];
  if (it.mat === 'wood.branch') {
    const ph = rng() * 6, amp = 0.18 + rng() * 0.15, lift = 0.3 + rng() * 0.4, pts = [], r0 = Math.min(d, h) * 0.2;
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([-w / 2 + w * t, Math.sin(t * Math.PI * 1.3 + ph) * d * amp, r0 + h * lift * Math.sin(t * Math.PI) * (0.6 + t * 0.6) * 0.8]); }
    br.push({ pts, r0, r1: r0 * 0.35 });
    const nb = 2 + (rng() * 3 | 0);
    for (let b = 0; b < nb; b++) {
      const si = 2 + (rng() * 5 | 0), s = pts[si], side = rng() < 0.5 ? -1 : 1, L = w * (0.2 + rng() * 0.22), up = rng() * 0.6;
      const dir = [(rng() - 0.3) * 0.8, side * (0.6 + rng() * 0.4)], q = [];
      for (let i = 0; i <= 4; i++) { const t = i / 4; q.push([s[0] + dir[0] * L * t, clamp(s[1] + dir[1] * L * t * 0.5, -d / 2, d / 2), clamp(s[2] + h * up * t * (1.2 - t * 0.5), r0 * 0.5, h)]); }
      br.push({ pts: q, r0: r0 * 0.55, r1: r0 * 0.12 });
      if (rng() < 0.5) { const s2 = q[2], q2 = []; for (let i = 0; i <= 3; i++) { const t = i / 3; q2.push([s2[0] + L * 0.3 * t, clamp(s2[1] - side * L * 0.25 * t, -d / 2, d / 2), clamp(s2[2] + h * 0.2 * t, 0, h)]); } br.push({ pts: q2, r0: r0 * 0.28, r1: r0 * 0.08 }); }
    }
  } else {
    const r0 = Math.min(d, h) * 0.24, pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([-w * 0.22 + w * 0.6 * t, Math.sin(t * 3 + rng() * 0.4) * d * 0.12, r0 + Math.pow(t, 1.8) * (h - r0 * 1.5)]); }
    br.push({ pts, r0: r0 * 1.1, r1: r0 * 0.4 });
    const nr = 3 + (rng() * 2 | 0);
    for (let b = 0; b < nr; b++) {
      const a = (nr > 1 ? b / (nr - 1) - 0.5 : 0) * 2.8 + (rng() - 0.5) * 0.35, L = w * (0.24 + rng() * 0.12), q = [], s = pts[0];
      for (let i = 0; i <= 4; i++) { const t = i / 4; q.push([clamp(s[0] - Math.cos(a) * L * t, -w / 2, w / 2), clamp(s[1] + Math.sin(a) * L * t * 1.1, -d / 2, d / 2), Math.max(r0 * 0.25, r0 * (1 - t * 0.75))]); }
      br.push({ pts: q, r0: r0 * 0.7, r1: r0 * 0.15 });
    }
    const top = pts[pts.length - 1], q = [];
    for (let i = 0; i <= 3; i++) { const t = i / 3; q.push([top[0] + w * 0.25 * t, top[1] + d * 0.2 * t * (rng() - 0.5), Math.min(h, top[2] + t * 0.4)]); }
    br.push({ pts: q, r0: r0 * 0.4, r1: r0 * 0.12 });
  }
  return br;
}
function tube(gb, pts, r0, r1, radial, colFn, seed) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[2], p[1])));
  const len = curve.getLength(), segs = Math.max(10, Math.round(pts.length * 5 + len * 2)), fr = curve.computeFrenetFrames(segs, false), base = gb.p.length / 3, P = new T.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, P); const N = fr.normals[i], B = fr.binormals[i], r = lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const rr = r * (1 + 0.2 * (vnoise3(t * len * 1.2, ca * 1.5, sa * 1.5, seed) - 0.5) + 0.05 * Math.sin(a * 5 + t * 20));
      gb.v(P.x + (N.x * ca + B.x * sa) * rr, P.y + (N.y * ca + B.y * sa) * rr, P.z + (N.z * ca + B.z * sa) * rr, colFn(t, a), j / radial, t * len / 4);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = base + i * (radial + 1) + j, b = a + radial + 1; gb.t(a, a + 1, b); gb.t(b, a + 1, b + 1); }
  const end = curve.getPointAt(1), ci = gb.v(end.x, end.y, end.z, colFn(1, 0), 0.5, 1), last = base + segs * (radial + 1);
  for (let j = 0; j < radial; j++) gb.t(last + j, last + j + 1, ci);
}
function buildWood(it, def) {
  const gb = new GB(), base = colOf(it.color || def.color);
  woodShape(it).forEach((b, bi) => tube(gb, b.pts, b.r0, b.r1, 12, (t, a) => {
    const g = vnoise3(t * 70, Math.cos(a) * 5, Math.sin(a) * 5 + bi * 10, it.seed);
    const k = 0.55 + 0.35 * vnoise3(t * 12, Math.cos(a) * 2, Math.sin(a) * 2 + bi * 10, it.seed + 3) + (g > 0.62 ? 0.25 : g < 0.3 ? -0.15 : 0) + (t > 0.97 ? 0.35 : 0);
    return base.clone().multiplyScalar(k);
  }, it.seed + bi));
  const bt = barkTex();
  const m = new T.Mesh(gb.geo(), new T.MeshStandardMaterial({ vertexColors: true, map: bt, bumpMap: bt, bumpScale: 2.2, roughness: 0.9, metalness: 0 }));
  m.castShadow = m.receiveShadow = true; return m;
}

/* ---------------- 苔（地面に沿わせる） ---------------- */
const isDome = t => t === 'hosoba' || t === 'tama';
function mossPoint(it, def, r, a, heightAt) {
  const W = it.w * it.s, D = it.d * it.s, H = it.h * it.s, e = 1 + 0.15 * ringNoise(a, it.seed, 1.8);
  const lx = Math.cos(a) * r * e * W / 2, lz = Math.sin(a) * r * e * D / 2, c = Math.cos(it.rot), s = Math.sin(it.rot);
  const x = it.x + lx * c + lz * s, z = it.z - lx * s + lz * c;
  const prof = isDome(def.type) ? Math.pow(Math.max(0, 1 - r * r), 0.55) : (1 - Math.pow(r, 4)) * 0.9 + 0.1;
  const bump = 1 + 0.25 * (vnoise3(lx * 1.6, lz * 1.6, 1, it.seed) - 0.5);
  const lump = isDome(def.type) ? 0 : 0.35 * vnoise3(lx * 2.2, lz * 2.2, 4, it.seed) * Math.max(0.2, H) * (1 - r * r);
  return [x, heightAt(x, z) + (H * prof * bump + lump) * (r >= 1 ? 0.12 : 1) + 0.03, z];
}
function buildMoss(it, def, opt) {
  const heightAt = opt.heightAt || TR.heightAt, low = opt.quality === 'low';
  const grp = new T.Group(), gb = new GB(), colHex = it.color || def.color, base = colOf(colHex);
  const ox = it.x, oz = it.z, NR = 12, NS = 52;
  const tint = (r, a) => base.clone().multiplyScalar(0.74 + 0.34 * vnoise3(Math.cos(a) * r * 3, Math.sin(a) * r * 3, 5, it.seed) + (1 - r) * 0.08);
  const P = (r, a) => { const p = mossPoint(it, def, r, a, heightAt); p[0] -= ox; p[2] -= oz; return p; };
  const c0 = P(0, 0), ctr = gb.v(c0[0], c0[1], c0[2], tint(0, 0), c0[0] / 3, c0[2] / 3);
  for (let i = 1; i <= NR; i++) for (let k = 0; k <= NS; k++) { const a = k / NS * Math.PI * 2, r = i / NR, p = P(r, a); gb.v(p[0], p[1] - (i === NR ? 0.08 : 0), p[2], tint(r, a), p[0] / 3, p[2] / 3); }
  const idx = (i, k) => 1 + (i - 1) * (NS + 1) + k;
  for (let k = 0; k < NS; k++) gb.t(ctr, idx(1, k + 1), idx(1, k));
  for (let i = 1; i < NR; i++) for (let k = 0; k < NS; k++) { const a = idx(i, k), b = idx(i, k + 1), cc = idx(i + 1, k), d = idx(i + 1, k + 1); gb.t(a, b, cc); gb.t(b, d, cc); }
  const mt = mossTex(colHex);
  const patch = new T.Mesh(gb.geo(), new T.MeshStandardMaterial({ map: mt, bumpMap: mt, bumpScale: 1.5, vertexColors: true, roughness: 1, metalness: 0 }));
  patch.receiveShadow = true; patch.castShadow = true; grp.add(patch);

  const W = it.w * it.s, D = it.d * it.s, area = Math.PI * W * D / 4, rng = mulberry32(it.seed + 77), type = def.type, flat = !isDome(type);
  let geo, count, tilt = 0.6;
  const tip = base.clone().lerp(new T.Color('#dfe8cf'), type === 'hosoba' ? 0.18 : 0.08);
  if (type === 'hosoba') { geo = new T.ConeGeometry(0.026, 0.15, 3); geo.translate(0, 0.06, 0); count = area * 135; }
  else if (type === 'tama') { geo = new T.ConeGeometry(0.022, 0.17, 3); geo.translate(0, 0.07, 0); count = area * 135; tilt = 0.75; }
  else if (type === 'shinobu') { geo = new T.PlaneGeometry(0.7, 0.3); geo.rotateX(-Math.PI / 2); geo.translate(0.28, 0, 0); count = area * 34; }
  else { geo = new T.PlaneGeometry(0.5, 0.2); geo.rotateX(-Math.PI / 2); geo.translate(0.2, 0, 0); count = area * 34; }
  count = Math.round(Math.min(flat ? 1800 : 3200, count) * (low ? 0.45 : 1));
  const fm = new T.MeshStandardMaterial({ roughness: 0.95, side: T.DoubleSide, map: flat ? frondTex() : null, alphaTest: flat ? 0.4 : 0 });
  const im = new T.InstancedMesh(geo, fm, count), dmy = new T.Object3D(); dmy.rotation.order = 'YXZ';
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(rng()) * 0.97, a = rng() * Math.PI * 2, p = P(r, a);
    dmy.position.set(p[0], p[1] - 0.04, p[2]);
    if (flat) dmy.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.3) * 0.5);
    else dmy.rotation.set((rng() - 0.5) * tilt, it.rot - a, -r * 0.75 + (rng() - 0.5) * tilt);
    const sc = 0.7 + rng() * 0.6; dmy.scale.set(sc, sc * (flat ? 1 : 0.9 + it.h * it.s * 0.12), sc); dmy.updateMatrix();
    im.setMatrixAt(i, dmy.matrix); im.setColorAt(i, (flat ? base : tip).clone().multiplyScalar(0.72 + rng() * 0.5));
  }
  im.receiveShadow = true; im.raycast = noRay; grp.add(im);
  if (type === 'tama') {
    const nc = Math.min(low ? 50 : 120, Math.round(area * 1.4));
    const cap = new T.SphereGeometry(0.11, 8, 6); cap.translate(0, 0.62, 0);
    const stalk = new T.CylinderGeometry(0.018, 0.022, 0.62, 4); stalk.translate(0, 0.31, 0);
    const ci = new T.InstancedMesh(cap, new T.MeshStandardMaterial({ roughness: 0.55 }), nc), si = new T.InstancedMesh(stalk, new T.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.8 }), nc);
    for (let i = 0; i < nc; i++) {
      const r = Math.sqrt(rng()) * 0.8, a = rng() * Math.PI * 2, p = P(r, a);
      dmy.position.set(p[0], p[1], p[2]); dmy.rotation.set((rng() - 0.5) * 0.5, rng() * 6, (rng() - 0.5) * 0.5); const sc = 0.8 + rng() * 0.5; dmy.scale.set(sc, sc, sc); dmy.updateMatrix();
      ci.setMatrixAt(i, dmy.matrix); si.setMatrixAt(i, dmy.matrix); ci.setColorAt(i, new T.Color(rng() < 0.55 ? '#a9c25c' : '#8b6a3a'));
    }
    ci.castShadow = true; ci.raycast = si.raycast = noRay; grp.add(ci, si);
  }
  grp.userData.draped = true; grp.userData.bx = ox; grp.userData.bz = oz;
  return grp;
}

/* ---------------- 植物 ---------------- */
function buildPlant(it, def) {
  const grp = new T.Group(), rng = mulberry32(it.seed);
  if (def.type === 'fern') {
    const leaf = new GB(), stem = new GB(), n = 10 + (rng() * 4 | 0), sc = colOf('#5b6b2e');
    for (let f = 0; f < n; f++) {
      const a = f / n * Math.PI * 2 + rng() * 0.4, ca = Math.cos(a), sa = Math.sin(a), reach = it.w / 2 * (0.65 + rng() * 0.3), hk = it.h * (0.75 + rng() * 0.3);
      const Pt = t => [ca * reach * t, hk * (1.6 * t - 1.25 * t * t) * 1.15 + 0.1, sa * reach * t];
      const sp = []; for (let i = 0; i <= 8; i++) { const p = Pt(i / 8); sp.push([p[0], p[2], p[1]]); }
      tube(stem, sp, 0.07, 0.02, 4, () => sc, it.seed + f);
      for (let t = 0.14; t < 0.98; t += 0.05) {
        const p = Pt(t), q = Pt(t + 0.01), dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], dl = Math.hypot(dx, dy, dz);
        const tx = dx / dl, ty = dy / dl, tz = dz / dl, L = it.w * 0.11 * (1 - t * 0.7) * (0.8 + rng() * 0.3), wd = L * 0.32;
        for (const sd of [-1, 1]) {
          const px = -sa * sd, pz = ca * sd;
          const ex = px * 0.9 + tx * 0.35, ey = -0.2 - t * 0.15, ez = pz * 0.9 + tz * 0.35, el = Math.hypot(ex, ey, ez);
          const ux = ex / el * L, uy = ey / el * L, uz = ez / el * L, wx = tx * wd * 0.5, wy = ty * wd * 0.5, wz = tz * wd * 0.5;
          const cc = WHITE.clone().multiplyScalar(0.78 + rng() * 0.35), b = leaf.p.length / 3;
          leaf.v(p[0] - wx, p[1] - wy, p[2] - wz, cc, 0, 0); leaf.v(p[0] + wx, p[1] + wy, p[2] + wz, cc, 0, 1);
          leaf.v(p[0] + ux - wx, p[1] + uy - wy, p[2] + uz - wz, cc, 1, 0); leaf.v(p[0] + ux + wx, p[1] + uy + wy, p[2] + uz + wz, cc, 1, 1);
          leaf.t(b, b + 2, b + 1); leaf.t(b + 1, b + 2, b + 3);
        }
      }
    }
    const lm = new T.Mesh(leaf.geo(), new T.MeshStandardMaterial({ map: leafletTex(), vertexColors: true, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.7 }));
    const sm = new T.Mesh(stem.geo(), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    lm.castShadow = sm.castShadow = true; lm.receiveShadow = true; grp.add(lm, sm);
  } else {
    const leaf = new GB(), stem = new GB(), n = 18 + (rng() * 6 | 0), sc = colOf('#5d7a3e');
    for (let f = 0; f < n; f++) {
      const a = f * 2.4 + rng() * 0.5, ca = Math.cos(a), sa = Math.sin(a), lay = f / n, rr = it.w / 2 * (0.08 + (1 - lay) * 0.3 + rng() * 0.08), hh = it.h * (0.25 + lay * 0.6 + rng() * 0.1);
      const top = [ca * rr, hh, sa * rr];
      tube(stem, [[0, 0, 0], [ca * rr * 0.4, sa * rr * 0.4, hh * 0.5], [top[0], top[2], top[1]]], 0.06, 0.04, 4, () => sc, it.seed + f);
      const L = Math.min(it.w, it.d) * (0.22 + (1 - lay) * 0.08 + rng() * 0.06), Wd = L * 0.72, up = 0.1 + lay * 0.5 + rng() * 0.2;
      const dx = ca * Math.cos(up), dy = Math.sin(up), dz = sa * Math.cos(up), px = -sa, pz = ca;
      const b = leaf.p.length / 3, cc = WHITE.clone().multiplyScalar(0.85 + rng() * 0.25), NU = 4, NV = 2;
      for (let u = 0; u <= NU; u++) for (let v = 0; v <= NV; v++) {
        const tu = u / NU, tv = v / NV - 0.5, curl = -Math.abs(tv) * Wd * 0.14 - tu * tu * L * 0.2;
        leaf.v(top[0] + dx * L * tu + px * tv * Wd, top[1] + dy * L * tu + curl, top[2] + dz * L * tu + pz * tv * Wd, cc, tu, v / NV);
      }
      for (let u = 0; u < NU; u++) for (let v = 0; v < NV; v++) { const a0 = b + u * (NV + 1) + v; leaf.t(a0, a0 + NV + 1, a0 + 1); leaf.t(a0 + 1, a0 + NV + 1, a0 + NV + 2); }
    }
    const lm = new T.Mesh(leaf.geo(), new T.MeshStandardMaterial({ map: fittoniaTex(), vertexColors: true, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.55 }));
    const sm = new T.Mesh(stem.geo(), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    lm.castShadow = sm.castShadow = true; lm.receiveShadow = true; grp.add(lm, sm);
  }
  return grp;
}

// 素材カテゴリ → 生成関数（GLBモデル対応時はここで def.model を読み込む分岐を足す）
export const BUILDERS = { stone: buildStone, wood: buildWood, moss: buildMoss, plant: buildPlant };

export function buildItem(it, opt = {}) {
  const def = MATERIALS[it.mat];
  const obj = BUILDERS[def.cat](it, def, opt);
  obj.traverse(o => { o.userData.itemId = it.id; });
  return obj;
}
