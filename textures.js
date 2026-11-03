// 手続き的に描くテクスチャ（外部画像なし）
import * as THREE from 'three';
import { mulberry32, rgbs, hex2rgb, vnoise3 } from '../core/util.js';

const cache = new Map();
function make(key, w, h, fn, { repeat = true, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; cache.set(key, t); return t;
}

export function tableTex() {
  const t = make('table', 512, 512, (c, w, h) => {
    c.fillStyle = '#d8cab4'; c.fillRect(0, 0, w, h); const r = mulberry32(7);
    for (let i = 0; i < 160; i++) { const y = r() * h; c.strokeStyle = `rgba(${140 + r() * 30},${110 + r() * 25},${80 + r() * 20},${0.03 + r() * 0.05})`; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.012 + i) * 3); c.stroke(); }
  });
  t.repeat.set(3, 3); return t;
}

export function soilTex(type, rgb) {
  return make('soil-' + type, 512, 512, (c, w, h) => {
    c.fillStyle = rgbs(rgb, 0.78); c.fillRect(0, 0, w, h); const r = mulberry32(type === 'akadama' ? 11 : 23);
    if (type === 'akadama') {
      for (let i = 0; i < 3000; i++) {
        const x = r() * w, y = r() * h, rr = 2.5 + r() * 6, k = 0.72 + r() * 0.5;
        const g = c.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr); g.addColorStop(0, rgbs(rgb, k * 1.25)); g.addColorStop(1, rgbs(rgb, k * 0.66));
        c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
      }
    } else {
      for (let i = 0; i < 20000; i++) { const x = r() * w, y = r() * h; c.fillStyle = rgbs(rgb, 0.55 + r() * 0.95, 0.9); c.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2.5); }
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(200,190,170,${0.15 + r() * 0.2})`; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
    }
  });
}

export function rockTex(type) {
  // バンプ用のグレースケール（凹凸の細部）
  return make('rock-' + type, 512, 256, (c, w, h) => {
    const img = c.createImageData(w, h), D = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / w * 24, v = j / h * 12; let g;
      if (type === 'lava') { const n = vnoise3(u, v, 0, 3) * 0.6 + vnoise3(u * 3, v * 3, 1, 4) * 0.4; const pore = vnoise3(u * 2.2, v * 2.2, 5, 9); g = n * 200 + 30; if (pore > 0.66) g *= 0.25; }
      else if (type === 'seika') { const n = vnoise3(u * 0.6, v * 4, 2, 5); g = 90 + 110 * (0.5 + 0.5 * Math.sin(v * 9 + n * 6)) + vnoise3(u * 4, v * 4, 3, 6) * 50; }
      else if (type === 'mokka') { const n = vnoise3(u * 3, v * 0.3, 2, 7); g = 80 + 140 * (0.5 + 0.5 * Math.sin(u * 7 + n * 5)) + vnoise3(u * 5, v * 5, 1, 8) * 30; }
      else { g = 120 + vnoise3(u, v, 0, 2) * 60 + vnoise3(u * 6, v * 6, 4, 3) * 40; }
      const o = (j * w + i) * 4; D[o] = D[o + 1] = D[o + 2] = Math.min(255, g); D[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { srgb: false });
}

export function barkTex() {
  const t = make('bark', 256, 512, (c, w, h) => {
    c.fillStyle = '#c4bcb0'; c.fillRect(0, 0, w, h); const r = mulberry32(31);
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, L = 30 + r() * 140, k = r();
      c.strokeStyle = k < 0.55 ? `rgba(55,40,28,${0.18 + r() * 0.35})` : `rgba(255,248,235,${0.1 + r() * 0.25})`;
      c.lineWidth = 0.6 + r() * 2.4; c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + (r() - .5) * 8, y + L / 3, x + (r() - .5) * 8, y + L * 2 / 3, x + (r() - .5) * 5, y + L); c.stroke();
    }
    for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(50,36,24,.35)'; c.beginPath(); c.ellipse(r() * w, r() * h, 3 + r() * 5, 6 + r() * 10, 0, 0, 7); c.fill(); }
  });
  t.repeat.set(1, 2); return t;
}

export function mossTex(hex) {
  const col = hex2rgb(hex);
  return make('moss-' + hex, 256, 256, (c, w, h) => {
    c.fillStyle = rgbs(col, 0.72); c.fillRect(0, 0, w, h); const r = mulberry32(5);
    for (let i = 0; i < 6500; i++) {
      const x = r() * w, y = r() * h, a = r() * 6.28, L = 2 + r() * 4;
      c.strokeStyle = rgbs(col, 0.5 + r() * 0.85, 0.9); c.lineWidth = 0.8 + r();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
    }
  });
}

export function leafletTex() {
  return make('leaflet', 128, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3c6528'); g.addColorStop(1, '#6f9a45');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, h / 2); c.quadraticCurveTo(w * 0.45, 2, w, h / 2); c.quadraticCurveTo(w * 0.45, h - 2, 0, h / 2); c.fill();
    c.strokeStyle = 'rgba(40,70,25,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  }, { repeat: false });
}
export function fittoniaTex() {
  return make('fit', 256, 256, (c, w, h) => {
    const leaf = () => { c.beginPath(); c.moveTo(w * 0.02, h / 2); c.bezierCurveTo(w * 0.2, h * 0.08, w * 0.85, h * 0.12, w * 0.98, h / 2); c.bezierCurveTo(w * 0.85, h * 0.88, w * 0.2, h * 0.92, w * 0.02, h / 2); };
    leaf(); c.fillStyle = '#3a6631'; c.fill(); c.save(); leaf(); c.clip();
    c.strokeStyle = 'rgba(236,240,226,.95)'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    c.lineWidth = 2.5; for (let i = 0; i < 7; i++) { const x = w * (0.12 + i * 0.12); c.beginPath(); c.moveTo(x, h / 2); c.quadraticCurveTo(x + w * 0.08, h * 0.32, x + w * 0.14, h * 0.12); c.moveTo(x, h / 2); c.quadraticCurveTo(x + w * 0.08, h * 0.68, x + w * 0.14, h * 0.88); c.stroke(); }
    c.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const x = w * (0.1 + i * 0.033); c.beginPath(); c.moveTo(x, h * 0.2); c.lineTo(x + w * 0.04, h * 0.8); c.stroke(); }
    c.restore();
  }, { repeat: false });
}
export function frondTex() {
  return make('frond', 128, 64, (c, w, h) => {
    c.strokeStyle = '#4c6e2e'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    for (let i = 0; i < 9; i++) { const x = i * w / 9, L = h * 0.45 * (1 - i / 11); c.beginPath(); c.moveTo(x, h / 2); c.lineTo(x + 8, h / 2 - L); c.moveTo(x, h / 2); c.lineTo(x + 8, h / 2 + L); c.stroke(); }
  }, { repeat: false });
}
