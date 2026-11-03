// 素材一覧のサムネイル（実際の3D生成処理で小さく描く）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { newItem } from '../data/model.js';
import { buildItem } from './builders.js';

const T = THREE;
const cache = new Map();
let R = null;
function init() {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160, false); renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene(), pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  scene.add(new T.HemisphereLight(0xffffff, 0x665544, 0.8));
  const sun = new T.DirectionalLight(0xfff1de, 2.2); sun.position.set(5, 10, 6); scene.add(sun);
  R = { renderer, scene, cam: new T.PerspectiveCamera(30, 1, 0.1, 200) };
}
export function thumbFor(matId) {
  if (cache.has(matId)) return cache.get(matId);
  if (!R) init();
  const it = newItem(matId, 0, 0); it.seed = 4242; it.rot = matId.startsWith('wood') ? 0.5 : 0.3;
  const obj = buildItem(it, { heightAt: () => 0, quality: 'low' });
  if (!obj.userData.draped) { obj.rotation.y = it.rot; }
  R.scene.add(obj);
  const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), s = box.getSize(new T.Vector3()).length();
  R.cam.position.set(c.x + s * 0.9, c.y + s * 1.0, c.z + s * 1.6); R.cam.lookAt(c);
  R.renderer.render(R.scene, R.cam);
  const url = R.renderer.domElement.toDataURL('image/png');
  R.scene.remove(obj); obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  cache.set(matId, url); return url;
}
export const hasThumb = id => cache.has(id);
