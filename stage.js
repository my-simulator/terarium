// 3D描画の土台：レンダラー・カメラ・ライト・視点操作・描画ループ
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tableTex } from './textures.js';

const T = THREE;

export class Stage {
  constructor(host) {
    this.host = host;
    const r = this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap;
    host.appendChild(r.domElement);
    const scene = this.scene = new T.Scene();
    scene.background = new T.Color('#e9e6de');
    const pmrem = new T.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const cam = this.camera = new T.PerspectiveCamera(32, 1, 0.1, 1000);
    const ctl = this.controls = new OrbitControls(cam, r.domElement);
    ctl.enableDamping = true; ctl.dampingFactor = 0.09; ctl.maxPolarAngle = Math.PI * 0.53; ctl.minDistance = 4; ctl.maxDistance = 160;
    ctl.screenSpacePanning = true; ctl.autoRotateSpeed = 1.2;
    ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
    ctl.addEventListener('start', () => { if (ctl.autoRotate) { ctl.autoRotate = false; this.onAutoChange && this.onAutoChange(false); } });

    scene.add(new T.HemisphereLight(0xf2f5ff, 0x6a5a48, 0.55));
    const sun = this.sun = new T.DirectionalLight(0xfff1de, 2.4);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-20, 12, -10); scene.add(fill);
    const table = new T.Mesh(new T.CircleGeometry(160, 64), new T.MeshStandardMaterial({ map: tableTex(), roughness: 0.85 }));
    table.rotation.x = -Math.PI / 2; table.receiveShadow = true; table.raycast = () => { }; scene.add(table);

    this.world = new T.Group(); scene.add(this.world);
    this.helpers = new T.Group(); scene.add(this.helpers);
    this.dirty = true; this.size = 15; this.ch = 15; this.quality = 'high'; this.running = false;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1.25 : 2));
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }
  frame(c) {
    this.size = Math.max(c.w, c.type === 'box' ? c.d : c.w, c.h); this.ch = c.h; this.cont = c;
    const s = this.size, sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -s * 1.3; sc.right = sc.top = s * 1.3; sc.near = 1; sc.far = s * 8; sc.updateProjectionMatrix();
    this.sun.position.set(s * 1.2, s * 2.6, s * 1.0); this.dirty = true;
  }
  setView(kind) {
    const c = this.cont || { w: 12, d: 12, h: 15 }, cam = this.camera;
    const R = 0.5 * Math.hypot(c.w, c.type === 'box' ? c.d : c.w, c.h);
    const vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const dist = R / Math.sin(Math.min(vf, hf) / 2) * 0.92;
    const dir = kind === 'top' ? new T.Vector3(0, 1, 0.002) : kind === 'front' ? new T.Vector3(0, 0.12, 1) : new T.Vector3(1.45, 1.55, 2.25);
    this.controls.target.set(0, kind === 'top' ? 0 : this.ch * 0.4, 0);
    cam.position.copy(this.controls.target).addScaledVector(dir.normalize(), dist);
    this.controls.update(); this.dirty = true;
  }
  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low'; this.sun.castShadow = q !== 'low';
    this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    this.resize();
  }
  setAuto(on) { this.controls.autoRotate = on; this.dirty = true; }
  start() {
    if (this.running) return; this.running = true;
    const loop = () => {
      if (!this.running) return;
      const moved = this.controls.update();
      if (moved || this.dirty || this.controls.autoRotate) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; }
  capture(kind) {
    const keep = this.camera.position.clone(), kt = this.controls.target.clone(), hv = this.helpers.visible;
    this.helpers.visible = false;
    if (kind) this.setView(kind);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.helpers.visible = hv;
    if (kind) { this.camera.position.copy(keep); this.controls.target.copy(kt); this.controls.update(); }
    this.dirty = true; return url;
  }
}
