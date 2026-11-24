/* Listening Station: the 3D room.
   A real-time scene, built to the owner's dusk reference: a silver cassette deck on a walnut desk,
   a desk lamp, rain on the window, a mug and four cassettes in their cases.
   Units are centimetres. Every control is real geometry that moves; engraving is printed into the
   faceplate's own textures so the metal lights it. app.js drives it through window.STATION_VIEW. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/three/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/three/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';
import { Reflector } from './vendor/three/jsm/objects/Reflector.js';

const C = window.STATION;
const LOOK = new URLSearchParams(location.search).get('look') === 'lofi' ? 1 : 0;
const BASE = C ? C.site.base : '/';
const D2R = Math.PI / 180;
const TAPE_INK = { about: '#4b3a72', projects: '#c13a1f', resume: '#2c4a40', contact: '#6a4ea3' };
const CASE_LABEL = { about: 'About', projects: 'Projects', resume: 'Experience', contact: 'Contact' };

/* ------------------------------------------------------------------ small utilities */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  back: (k) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

/* ------------------------------------------------------------------ the view */
function createView() {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  if (!gl) return null;

  const host = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x080504, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'deck-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const PERF = { scale: 1, max: 1.5, min: 0.6, acc: 0, n: 0, cool: 0, slow: 0, raisedAt: -99, frame: 0, moving: true, shadowFrames: 4, onScreen: true };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080504);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 2, 700);

  const texFrom = (c, srgb = true, wrap = false) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  };

  /* ---------------------------------------------------------------- shared surfaces */
  function brushed(g, w, h, base, seed, streak = 0.07) {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < h * 3; i++) {
      const y = r() * h, x = r() * w * 0.9 - w * 0.2, len = w * (0.2 + r() * 0.9);
      g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * streak})` : `rgba(0,0,0,${r() * streak * 1.2})`;
      g.fillRect(x, y, len, 1 + (r() < 0.1 ? 1 : 0));
    }
  }
  function brushedRough(g, w, h, seed, lo = 70, hi = 120) {
    const r = rng(seed);
    g.fillStyle = `rgb(255,${(lo + hi) >> 1},255)`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < h * 2; i++) {
      const y = r() * h, x = r() * w - w * 0.2, len = w * (0.2 + r() * 0.8);
      g.fillStyle = `rgba(255,${Math.round(lo + r() * (hi - lo))},255,.6)`;
      g.fillRect(x, y, len, 1);
    }
  }
  function woodCanvas(w, h, seed, dark = '#2a160c', light = '#6b3f22') {
    const [c, g] = canvas(w, h); const r = rng(seed);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, dark); grd.addColorStop(0.5, light); grd.addColorStop(1, dark);
    g.fillStyle = '#4a2a16'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y0 = r() * h, amp = 4 + r() * 18, f = 0.002 + r() * 0.006, ph = r() * 10;
      g.strokeStyle = r() < 0.5 ? `rgba(20,8,2,${0.15 + r() * 0.35})` : `rgba(150,90,50,${0.08 + r() * 0.18})`;
      g.lineWidth = 0.6 + r() * 2.6;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 0.25; g.fillStyle = grd; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    return c;
  }

  const M = {};
  {
    const [c1, g1] = canvas(512, 512); brushed(g1, 512, 512, '#c9c4bb', 3, 0.09);
    const [c2, g2] = canvas(512, 512); brushedRough(g2, 512, 512, 5, 60, 110);
    const alMap = texFrom(c1, true, true), alRough = texFrom(c2, false, true);
    M.alu = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: alMap, metalness: 1, roughness: 1, roughnessMap: alRough, anisotropy: 0.6 });
    M.aluDark = new THREE.MeshPhysicalMaterial({ color: 0x9a948b, map: alMap, metalness: 1, roughness: 1, roughnessMap: alRough, anisotropy: 0.4 });
    M.chrome = new THREE.MeshPhysicalMaterial({ color: 0xe8e4dc, metalness: 1, roughness: 0.12 });
    M.black = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.55 });
    M.cavity = new THREE.MeshStandardMaterial({ color: 0x070504, roughness: 0.9 });
    M.gloss = new THREE.MeshPhysicalMaterial({ color: 0x0d0a09, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    const wood = texFrom(woodCanvas(1024, 512, 11), true, true);
    M.walnut = new THREE.MeshPhysicalMaterial({ map: wood, color: 0xd6b49a, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18 });
    const deskWood = texFrom(woodCanvas(2048, 1024, 21, '#3a1d0e', '#8a4f28'), true, true);
    deskWood.repeat.set(1.4, 1);
    M.desk = new THREE.MeshStandardMaterial({ map: deskWood, color: 0xc08a66, roughness: 0.4, envMapIntensity: 0.6 });
    const wall = texFrom(woodCanvas(1024, 1024, 31, '#140904', '#2e180c'), true, true);
    wall.rotation = Math.PI / 2; wall.repeat.set(3, 2);
    M.wall = new THREE.MeshStandardMaterial({ map: wall, color: 0x8a6a58, roughness: 0.7 });
    M.glassDark = new THREE.MeshPhysicalMaterial({ color: 0x0a0806, transparent: true, opacity: 0.28, roughness: 0.03, metalness: 0, clearcoat: 1, depthWrite: false });
  }
  const mesh = (geo, mat, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; };

  /* ---------------------------------------------------------------- environment (reflections) */
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(400, 400, 400), new THREE.MeshBasicMaterial({ color: 0x120a07, side: THREE.BackSide })));
    const panel = (w, h, color, k, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); env.add(m); };
    panel(120, 90, 0xffc48a, 6, [-110, 140, 40], [0, 0, 0]);      // the lamp
    panel(420, 220, 0xa07a5c, 1.35, [0, 190, -40], [0, 0, 0]);     // warm lamplit ceiling
    panel(300, 110, 0x8a74b8, 1.3, [90, 80, -190], [0, 0, 0]);    // the dusk window
    panel(240, 50, 0xe58a5a, 1.2, [120, 30, -175], [0, 0, 0]);    // the low sunset band
    panel(420, 200, 0x6a4632, 0.7, [0, 60, 220], [0, 0, 0]);      // the room behind the viewer
    panel(300, 300, 0x3a1c0e, 0.6, [0, -150, 0], [0, 0, 0]);      // warm desk bounce
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.035).texture;
    scene.environmentIntensity = 1.15;
  }

  /* ---------------------------------------------------------------- faceplate artwork (printed into the metal) */
  const PU = 60, PW = 46, PH = 23;                        // panel: 46 × 23 cm, 60 px per cm
  const px = (u) => (u + PW / 2) * PU, py = (v) => (PH - v) * PU;
  const [pc, pg] = canvas(PW * PU, PH * PU);
  const [oc, og] = canvas(PW * PU, PH * PU);                // G: roughness, B: metalness
  brushed(pg, pc.width, pc.height, '#aca69d', 7, 0.08);
  brushedRough(og, oc.width, oc.height, 9, 70, 118);
  og.globalCompositeOperation = 'multiply'; og.fillStyle = 'rgb(255,255,214)'; og.fillRect(0, 0, oc.width, oc.height); og.globalCompositeOperation = 'source-over';
  {
    // a soft falloff: the metal darkens a little toward the bottom edge, like the reference
    const gr = pg.createLinearGradient(0, 0, 0, pc.height); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    pg.fillStyle = gr; pg.fillRect(0, 0, pc.width, pc.height);
  }
  const ink = (fn) => { pg.save(); og.save(); fn(pg, '#100c0a'); fn(og, 'rgb(255,235,0)'); pg.restore(); og.restore(); };
  function text(t, u, v, { size = 0.5, font = 'Jost', weight = 600, align = 'center', style = '', color = null, width = null, spacing = 0 } = {}) {
    ink((g, c) => {
      g.fillStyle = color && g === pg ? color : c;
      g.font = `${style} ${weight} ${size * PU}px "${font}"`;
      g.textAlign = align; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = `${spacing * PU}px`;
      if (width) {
        const m = g.measureText(t).width;
        g.save(); g.translate(px(u), py(v)); g.scale((width * PU) / m, 1); g.fillText(t, 0, 0);
        g.strokeStyle = g.fillStyle; g.lineWidth = size * PU * 0.1; g.strokeText(t, 0, 0); g.restore();
      } else { g.fillText(t, px(u), py(v)); if (size >= 0.9) { g.strokeStyle = g.fillStyle; g.lineWidth = size * PU * 0.05; g.strokeText(t, px(u), py(v)); } }
    });
  }
  function arcTicks(cu, cv, r, a0, a1, n, len, labels) {
    ink((g, c) => {
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 0.05 * PU;
      for (let i = 0; i <= n; i++) {
        const a = (a0 + ((a1 - a0) * i) / n) * D2R;
        const x = px(cu) + Math.cos(a) * r * PU, y = py(cv) - Math.sin(a) * r * PU;
        g.beginPath(); g.arc(x, y, 0.06 * PU, 0, Math.PI * 2); g.fill();
        if (labels && labels[i] != null) {
          g.font = `500 ${0.46 * PU}px "Jost"`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(labels[i], px(cu) + Math.cos(a) * (r + len) * PU, py(cv) - Math.sin(a) * (r + len) * PU);
        }
      }
    });
  }

  /* layout, in panel cm: u across (−23…23), v up the slope (0…23) */
  const L = {
    door: [-18.2, 7.6, 0.6, 20.1],
    meters: [1.4, 14.2, 19.4, 20.0],
    counter: [-21.9, 14.15, -18.5, 15.15],
    reset: [-20.2, 11.5],
    phones: [-19.6, 4.1],
    slot: [-16.1, 0.9, 5.2, 6.3],
    small: { bias: [5.6, 9.6], eq: [8.3, 9.6], nr: [11.0, 9.6], limiter: [13.6, 9.6] },
    level: { L: [16.5, 8.9], R: [20.7, 8.9] },
  };
  const KEY_ACTS = ['eject', 'rec', 'prev', 'play', 'next', 'stop', 'pause'];
  const keyU = (i) => L.slot[0] + 0.15 + 1.45 + i * 3.0;

  async function paintPanel() {
    // brand on the left, the model badge on clear metal to the right: nothing sits under a bezel
    text(C ? C.site.manufacturer : 'JACK CAREY', -21.4, 21.15, { size: 1.15, font: 'Michroma', weight: 400, align: 'left', width: 11.6 });
    text('Model', 13.4, 21.05, { size: 1.0, font: 'Pinyon Script', weight: 400, align: 'left' });
    text(C ? C.site.model : 'JC-04', 16.6, 21.05, { size: 0.82, font: 'Fraunces', style: 'italic', weight: 500, align: 'left' });
    text('counter', -20.2, 13.4, { size: 0.46 });
    text('reset', -20.2, 10.25, { size: 0.46 });
    text('phones', -19.6, 5.55, { size: 0.5 });
    text('L', 5.85, 13.15, { size: 0.5 }); text('R', 14.95, 13.15, { size: 0.5 });
    text('stereo cassette deck', 10.4, 12.45, { size: 0.55 });
    // the small knobs: a name above, the two positions below, a detent mark either side
    const sm = [['BIAS', 'NORM  ·  CrO₂', 'bias'], ['EQ', '120  ·  70 μs', 'eq'], ['NR', 'OFF  ·  ON', 'nr'], ['LIMITER', 'OFF  ·  ON', 'limiter']];
    for (const [a, b, k] of sm) {
      const [u, v] = L.small[k];
      text(a, u, v + 1.2, { size: 0.44, weight: 600, spacing: 0.03 });
      text(b, u, v - 1.45, { size: 0.32, weight: 500 });
      ink((g, c) => { g.fillStyle = c; for (const ang of [-40, 40]) { const x = px(u) + Math.sin(ang * D2R) * 0.95 * PU, y = py(v) - Math.cos(ang * D2R) * 0.95 * PU; g.beginPath(); g.arc(x, y, 0.07 * PU, 0, Math.PI * 2); g.fill(); } });
    }
    for (const s of ['L', 'R']) { const [u, v] = L.level[s]; arcTicks(u, v, 1.86, 225, -45, 10, 0.42, ['0', null, null, null, null, '5', null, null, null, null, '10']); }
    text('left — record level — right', 18.6, 5.55, { size: 0.48 });
    // slot surround
    ink((g, c) => { g.strokeStyle = g === pg ? 'rgba(20,16,12,.55)' : 'rgb(255,150,0)'; g.lineWidth = 2; g.strokeRect(px(L.slot[0]) - 6, py(L.slot[3]) - 6, (L.slot[2] - L.slot[0]) * PU + 12, (L.slot[3] - L.slot[1]) * PU + 12); });
  }

  /* ---------------------------------------------------------------- the deck */
  const deck = new THREE.Group();
  deck.position.set(0, 0, 0);
  deck.rotation.y = -11 * D2R;
  scene.add(deck);
  const TILT = 26 * D2R;                                    // panel leans back 26° from vertical
  const panel = new THREE.Group();
  panel.position.set(0, 3.4, 13);
  panel.rotation.x = -TILT;
  deck.add(panel);
  const ids = new Map();                                    // id → object (for picking, focus rings)
  const pickables = [];
  const glowable = (m) => m && m.emissive && m.emissive.getHex() === 0 && !m.transparent;
  const tag = (obj, id) => {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.id = id; pickables.push(o);
      o.material = Array.isArray(o.material) ? o.material.map((m) => (glowable(m) ? m.clone() : m)) : (glowable(o.material) ? o.material.clone() : o.material);
    });
    ids.set(id, obj); return obj;
  };

  const panelTex = texFrom(pc), panelOrm = texFrom(oc, false);
  const panelMat = new THREE.MeshPhysicalMaterial({ map: panelTex, roughnessMap: panelOrm, metalnessMap: panelOrm, metalness: 1, roughness: 1, anisotropy: 0.55 });
  {
    const s = new THREE.Shape();
    s.moveTo(-PW / 2, 0); s.lineTo(PW / 2, 0); s.lineTo(PW / 2, PH); s.lineTo(-PW / 2, PH); s.lineTo(-PW / 2, 0);
    const hole = ([u0, v0, u1, v1]) => { const p = new THREE.Path(); p.moveTo(u0, v0); p.lineTo(u0, v1); p.lineTo(u1, v1); p.lineTo(u1, v0); p.lineTo(u0, v0); s.holes.push(p); };
    hole(L.door); hole(L.meters); hole(L.counter); hole(L.slot);
    const roundHole = (u, v, r) => { const p = new THREE.Path(); p.absarc(u, v, r, 0, Math.PI * 2, true); s.holes.push(p); };
    roundHole(...L.phones, 0.42);
    const geo = new THREE.ShapeGeometry(s, 24);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + PW / 2) / PW, pos.getY(i) / PH);
    panel.add(mesh(geo, panelMat, false, true));
    // a rolled top edge catches the lamp
    const edge = mesh(new THREE.CylinderGeometry(0.28, 0.28, PW, 24), M.aluDark);
    edge.rotation.z = Math.PI / 2; edge.position.set(0, PH - 0.05, -0.32); panel.add(edge);
  }
  function recess([u0, v0, u1, v1], depth, mat, backMat = mat) {
    const g = new THREE.Group(); const w = u1 - u0, h = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    const back = mesh(new THREE.PlaneGeometry(w, h), backMat, false); back.position.set(cu, cv, -depth); g.add(back);
    const top = mesh(new THREE.PlaneGeometry(w, depth), mat, false); top.position.set(cu, v1, -depth / 2); top.rotation.x = Math.PI / 2; g.add(top);
    const bot = mesh(new THREE.PlaneGeometry(w, depth), mat, false); bot.position.set(cu, v0, -depth / 2); bot.rotation.x = -Math.PI / 2; g.add(bot);
    const lf = mesh(new THREE.PlaneGeometry(depth, h), mat, false); lf.position.set(u0, cv, -depth / 2); lf.rotation.y = Math.PI / 2; g.add(lf);
    const rt = mesh(new THREE.PlaneGeometry(depth, h), mat, false); rt.position.set(u1, cv, -depth / 2); rt.rotation.y = -Math.PI / 2; g.add(rt);
    panel.add(g); return g;
  }
  function bezel([u0, v0, u1, v1], t, d, mat) {
    // a raised frame around a window
    const g = new THREE.Group();
    const bar = (w, h, x, y) => { const b = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(t, d) * 0.35), mat); b.position.set(x, y, d / 2 - 0.05); g.add(b); };
    bar(u1 - u0 + 2 * t, t, (u0 + u1) / 2, v1 + t / 2); bar(u1 - u0 + 2 * t, t, (u0 + u1) / 2, v0 - t / 2);
    bar(t, v1 - v0, u0 - t / 2, (v0 + v1) / 2); bar(t, v1 - v0, u1 + t / 2, (v0 + v1) / 2);
    panel.add(g); return g;
  }

  /* body: base, lip, top, walnut cheeks */
  {
    const base = mesh(new THREE.BoxGeometry(PW, 3.4, 30), M.black); base.position.set(0, 1.7, -1.5); deck.add(base);
    const lip = mesh(new RoundedBoxGeometry(PW + 0.2, 3.6, 3.4, 4, 1.1), M.alu); lip.position.set(0, 1.8, 13.9); deck.add(lip);
    const foot = mesh(new THREE.BoxGeometry(PW + 4, 0.5, 31), M.black); foot.position.set(0, 0.25, -1); deck.add(foot);
    const topEnd = panel.localToWorld(new THREE.Vector3(0, PH, 0)); deck.worldToLocal(topEnd);
    const top = mesh(new THREE.BoxGeometry(PW, 0.6, 16.5 - (-topEnd.z) + 0.2), M.aluDark);
    const zBack = -16.5, zFront = topEnd.z;
    top.geometry.dispose(); top.geometry = new THREE.BoxGeometry(PW, 0.6, zFront - zBack);
    top.position.set(0, topEnd.y - 0.3, (zBack + zFront) / 2); deck.add(top);
    const back = mesh(new THREE.BoxGeometry(PW, topEnd.y, 0.6), M.black); back.position.set(0, topEnd.y / 2, zBack); deck.add(back);
    const s = new THREE.Shape();
    const nz = Math.cos(TILT) * 0.8, ny = Math.sin(TILT) * 0.8;
    const slope = (t) => [13 + nz + Math.sin(TILT) * t, 3.4 + ny - Math.cos(TILT) * t];
    const [fz, fy] = slope(3.6);
    s.moveTo(-17, 0); s.lineTo(fz, 0); s.lineTo(fz, Math.max(fy, 0.8)); s.lineTo(topEnd.z + 0.6, topEnd.y + 0.6); s.lineTo(-17, topEnd.y + 0.6); s.lineTo(-17, 0);
    const cheekGeo = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3 });
    cheekGeo.rotateY(-Math.PI / 2);
    for (const side of [-1, 1]) {
      const ch = mesh(cheekGeo, M.walnut);
      ch.position.set(side < 0 ? -PW / 2 : PW / 2 + 2.2, 0, 0); deck.add(ch);
    }
  }

  /* cassette compartment: cavity, door (hinged at the bottom), holder */
  recess(L.door, 4.2, M.cavity);
  bezel(L.door, 0.35, 0.35, M.gloss);
  const [du0, dv0, du1, dv1] = L.door;
  const DW = du1 - du0 - 0.3, DH = dv1 - dv0 - 0.3;
  const door = new THREE.Group();
  door.position.set(du0 + 0.15, dv0 + 0.15, -0.25);
  panel.add(door);
  const makeDoorFace = () => {
    const DP = 60; const [c, g] = canvas(Math.round(DW * DP), Math.round(DH * DP));
    const band1 = 2.45, band2 = 2.75;                 // top and bottom bands (cm)
    g.fillStyle = 'rgba(16,12,10,1)'; g.fillRect(0, 0, c.width, band1 * DP);
    g.fillRect(0, c.height - band2 * DP, c.width, band2 * DP);
    g.fillStyle = 'rgba(10,7,6,.55)'; g.fillRect(0, band1 * DP, c.width, c.height - (band1 + band2) * DP);
    g.strokeStyle = 'rgba(120,100,80,.5)'; g.lineWidth = 2; g.strokeRect(1, band1 * DP, c.width - 2, c.height - (band1 + band2) * DP);
    g.fillStyle = '#d9d2c6'; g.font = `600 ${0.55 * DP}px "Jost"`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('servo control  /  total shut off', c.width / 2, band1 * DP * 0.55);
    g.fillText('super hard permalloy head', c.width / 2, c.height - band2 * DP * 0.45);
    return { c, band1, band2 };
  };
  const doorFace = makeDoorFace();
  const doorMat = new THREE.MeshPhysicalMaterial({ map: texFrom(doorFace.c), transparent: true, roughness: 0.12, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.12, depthWrite: true });
  const doorMesh = mesh(new THREE.PlaneGeometry(DW, DH), doorMat, false, false);
  doorMesh.position.set(DW / 2, DH / 2, 0); doorMesh.renderOrder = 5;
  door.add(doorMesh);
  const holder = new THREE.Group();                        // where the cassette sits, inside the door
  holder.position.set(DW / 2 + 0.2, doorFace.band2 + (DH - doorFace.band1 - doorFace.band2) / 2, -1.2);   // the tape's front sits well behind the glass
  door.add(holder);
  // spindles in the cavity, seen when the door is empty
  for (const sx of [-2.13, 2.13]) {
    const sp = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x8d867c, metalness: 0.6, roughness: 0.4 }));
    sp.rotation.x = Math.PI / 2; sp.position.set(du0 + 0.15 + holder.position.x + sx, dv0 + 0.15 + holder.position.y - 0.1, -3.4); panel.add(sp);
  }

  /* VU meters: lit faces, real needles, glass */
  recess(L.meters, 1.8, M.cavity);
  bezel(L.meters, 0.5, 0.45, M.gloss);
  const needles = {};
  function vuFace() {
    const [c, g] = canvas(1024, 640);
    const gr = g.createRadialGradient(512, 560, 40, 512, 420, 640);
    gr.addColorStop(0, '#3f9cff'); gr.addColorStop(0.3, '#1652c4'); gr.addColorStop(0.7, '#08236a'); gr.addColorStop(1, '#030b24');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 640);
    const cx = 512, cy = 760, R = 560;
    const toA = (k) => (-48 + k * 96) * D2R;          // k 0…1 across the scale
    const pt = (k, r) => [cx + Math.sin(toA(k)) * r, cy - Math.cos(toA(k)) * r];
    g.lineCap = 'round';
    g.strokeStyle = '#bfeaff'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, R - 60, -Math.PI / 2 - 48 * D2R, -Math.PI / 2 + 24 * D2R); g.stroke();
    g.strokeStyle = '#ff4a3a'; g.lineWidth = 22; g.beginPath(); g.arc(cx, cy, R - 56, -Math.PI / 2 + 24 * D2R, -Math.PI / 2 + 48 * D2R); g.stroke();
    const marks = [[0, '20'], [0.15, '10'], [0.26, '7'], [0.36, '5'], [0.47, '3'], [0.6, '1'], [0.7, '0'], [0.79, '1'], [0.88, '3'], [0.95, '5'], [1, '+']];
    g.font = '600 52px "Jost"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= 40; i++) {
      const k = i / 40, red = k > 0.75;
      const [x0, y0] = pt(k, R - 60), [x1, y1] = pt(k, R - (i % 4 === 0 ? 20 : 38));
      g.strokeStyle = red ? '#ff5a48' : '#cdeeff'; g.lineWidth = i % 4 === 0 ? 6 : 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    for (const [k, t] of marks) { const [x, y] = pt(k, R + 18); g.fillStyle = k > 0.75 ? '#ff5a48' : '#d8f2ff'; g.fillText(t, x, y); }
    g.fillStyle = '#9fdcff'; g.font = '600 74px "Jost"'; g.fillText('VU', cx, 392);
    g.strokeStyle = '#7cc8ff'; g.lineWidth = 8; g.beginPath(); g.arc(cx, 640, 70, Math.PI, 0); g.stroke();
    return texFrom(c);
  }
  {
    const face = vuFace();
    const faceMat = new THREE.MeshStandardMaterial({ map: face, emissiveMap: face, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.8 });
    M.meterFace = faceMat;
    const [mu0, mv0, mu1, mv1] = L.meters;
    const mid = (mu0 + mu1) / 2;
    const div = mesh(new THREE.BoxGeometry(0.6, mv1 - mv0, 1.8), M.gloss); div.position.set(mid, (mv0 + mv1) / 2, -0.9); panel.add(div);
    for (const [ch, a, b] of [['L', mu0 + 0.2, mid - 0.3], ['R', mid + 0.3, mu1 - 0.2]]) {
      const w = b - a, h = mv1 - mv0 - 0.4;
      const f = mesh(new THREE.PlaneGeometry(w, h), faceMat, false, false); f.position.set((a + b) / 2, (mv0 + mv1) / 2, -1.6); panel.add(f);
      const pivot = new THREE.Group(); pivot.position.set((a + b) / 2, mv0 - 1.2, -1.45); panel.add(pivot);
      const nd = mesh(new THREE.BoxGeometry(0.06, 6.0, 0.02), new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.6 }), false, false);
      nd.position.y = 3.6; pivot.add(nd);
      const tip = mesh(new THREE.BoxGeometry(0.07, 1.2, 0.025), new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff2a10, emissiveIntensity: 0.4 }), false, false);
      tip.position.y = 6.0; pivot.add(tip);
      needles[ch] = pivot;
      const cap = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32, 1, false, 0, Math.PI), M.gloss); cap.rotation.x = Math.PI / 2; cap.rotation.y = 0; cap.position.set((a + b) / 2, mv0 + 0.2, -1.4); cap.rotation.z = 0; panel.add(cap);
    }
    const glass = mesh(new THREE.PlaneGeometry(mu1 - mu0, mv1 - mv0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.02, clearcoat: 1, depthWrite: false }), false, false);
    glass.position.set(mid, (mv0 + mv1) / 2, -0.15); glass.renderOrder = 4; panel.add(glass);
    const glow = M.meterGlow = new THREE.PointLight(0x4a8cff, 160, 30, 2); glow.position.copy(panel.localToWorld(new THREE.Vector3(mid, (mv0 + mv1) / 2, 4))); deck.worldToLocal(glow.position); deck.add(glow);
  }

  /* tape counter: three drums */
  recess(L.counter, 2.1, M.cavity);
  bezel(L.counter, 0.25, 0.25, M.gloss);
  const drums = [];
  {
    M.drumTexture = () => {
      const [c, g] = canvas(1280, 160);
      g.fillStyle = '#0d0b0a'; g.fillRect(0, 0, 1280, 160);
      g.fillStyle = '#f2ece2'; g.font = '600 112px "Jost"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let d = 0; d < 10; d++) { g.save(); g.translate(d * 128 + 64, 80); g.rotate(Math.PI / 2); g.fillText(String(d), 0, 4); g.restore(); }
      const t = texFrom(c); t.wrapS = THREE.RepeatWrapping; return t;
    };
    const mat = M.drumMat = new THREE.MeshStandardMaterial({ map: M.drumTexture(), roughness: 0.5 });
    const [cu0, cv0, cu1, cv1] = L.counter, cw = (cu1 - cu0 - 0.4) / 3;
    for (let i = 0; i < 3; i++) {
      const drum = mesh(new THREE.CylinderGeometry(0.95, 0.95, cw - 0.12, 40), [mat, M.black, M.black]);
      drum.geometry.groups.length && (drum.material = [mat, M.black, M.black]);
      drum.rotation.z = Math.PI / 2;
      const holderG = new THREE.Group(); holderG.position.set(cu0 + 0.2 + cw * (i + 0.5), (cv0 + cv1) / 2, -1.08); holderG.add(drum); panel.add(holderG);
      drums.push({ g: holderG, drum, a: 0, target: 0, v: 0 });
    }
  }

  /* transport keys: the legend is printed on each key's face, like the reference deck */
  recess(L.slot, 2.4, M.cavity);
  const keys = {};
  const KEY_WORD = { eject: 'EJECT', rec: 'REC', prev: 'REW', play: 'PLAY', next: 'F.FWD', stop: 'STOP', pause: 'PAUSE' };
  function keyFace(act, glow = false) {
    const KP = 100, W = 230, H = 420; const [c, g] = canvas(W, H);
    if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    const ink = glow ? '#fff' : act === 'rec' ? '#b3180e' : '#16110d';
    g.fillStyle = ink; g.strokeStyle = ink;
    const cx = W / 2, cy = 150, u = 0.36 * KP;           // glyph unit
    const tri = (x, y, w, h, dir = 1) => { g.beginPath(); g.moveTo(x - (w / 2) * dir, y - h / 2); g.lineTo(x + (w / 2) * dir, y); g.lineTo(x - (w / 2) * dir, y + h / 2); g.closePath(); g.fill(); };
    if (act === 'eject') { g.beginPath(); g.moveTo(cx - u, cy + u * 0.25); g.lineTo(cx + u, cy + u * 0.25); g.lineTo(cx, cy - u * 0.85); g.closePath(); g.fill(); g.fillRect(cx - u, cy + u * 0.5, u * 2, u * 0.32); }
    if (act === 'rec') { g.beginPath(); g.arc(cx, cy, u * 0.72, 0, Math.PI * 2); g.fill(); }
    if (act === 'prev') { tri(cx - u * 0.45, cy, u * 0.9, u * 1.2, -1); tri(cx + u * 0.45, cy, u * 0.9, u * 1.2, -1); }
    if (act === 'play') tri(cx + u * 0.1, cy, u * 1.15, u * 1.4, 1);
    if (act === 'next') { tri(cx - u * 0.45, cy, u * 0.9, u * 1.2, 1); tri(cx + u * 0.45, cy, u * 0.9, u * 1.2, 1); }
    if (act === 'stop') g.fillRect(cx - u * 0.62, cy - u * 0.62, u * 1.24, u * 1.24);
    if (act === 'pause') { g.fillRect(cx - u * 0.62, cy - u * 0.7, u * 0.42, u * 1.4); g.fillRect(cx + u * 0.2, cy - u * 0.7, u * 0.42, u * 1.4); }
    g.font = '600 40px "Jost"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    g.fillText(KEY_WORD[act], cx + 1.5, 300);
    if (act === 'rec' && !glow) { g.fillStyle = '#b3180e'; g.fillRect(14, 350, W - 28, 30); }
    return texFrom(c);
  }
  const keyFaceMats = {};
  {
    const kGeo = new RoundedBoxGeometry(2.8, 4.7, 2.6, 4, 0.22);
    const faceGeo = new THREE.PlaneGeometry(2.3, 4.2);
    KEY_ACTS.forEach((act, i) => {
      const g = new THREE.Group();
      const km = mesh(kGeo, M.alu.clone()); g.add(km);
      const fm = new THREE.MeshStandardMaterial({ map: keyFace(act), transparent: true, roughness: 0.5, metalness: 0, emissive: 0xffa040, emissiveMap: keyFace(act, true), emissiveIntensity: 0, depthWrite: false });
      fm.userData.glow = false;
      const face = mesh(faceGeo, fm, false, false); face.position.set(0, 0.05, 1.306); g.add(face);
      keyFaceMats[act] = fm;
      const base = new THREE.Vector3(keyU(i), (L.slot[1] + L.slot[3]) / 2 - 0.15, -0.05);
      g.position.copy(base); panel.add(g);
      keys[act] = { g, base, x: 0, v: 0, hold: 0, latched: false, mat: km.material };
      tag(g, `key:${act}`);
    });
  }

  /* knobs */
  function knurlTexture() {
    const [c, g] = canvas(512, 64); g.fillStyle = '#bcb6ad'; g.fillRect(0, 0, 512, 64);
    for (let x = 0; x < 512; x += 8) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 3, 64); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 4, 0, 2, 64); }
    const t = texFrom(c, true, true); return t;
  }
  function spunTexture() {
    const [c, g] = canvas(512, 512); const r = rng(77);
    g.fillStyle = '#cfc9c0'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 400; i++) { g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.12})` : `rgba(0,0,0,${r() * 0.12})`; g.lineWidth = 1; g.beginPath(); g.arc(256, 256, r() * 256, 0, Math.PI * 2); g.stroke(); }
    return texFrom(c);
  }
  const knurl = knurlTexture(), spun = spunTexture();
  const knobSide = new THREE.MeshPhysicalMaterial({ map: knurl, metalness: 0.35, roughness: 0.3, color: 0xfff6ea, clearcoat: 0.4 });
  const knobCap = new THREE.MeshPhysicalMaterial({ map: spun, metalness: 0.25, roughness: 0.2, color: 0xffffff, clearcoat: 0.8 });
  function knob(u, v, r, h, { notch = false } = {}) {
    const g = new THREE.Group(); g.position.set(u, v, 0); panel.add(g);
    const ring = mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.25, 0.25, 48), M.black); ring.rotation.x = Math.PI / 2; ring.position.z = 0.12; g.add(ring);
    const spin = new THREE.Group(); g.add(spin);
    const body = mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 64, 1, false), [knobSide, knobCap, knobCap]); body.rotation.x = Math.PI / 2; body.position.z = h / 2 + 0.2; spin.add(body);
    const cap = mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.08, 64), knobCap); cap.rotation.x = Math.PI / 2; cap.position.z = h + 0.22; spin.add(cap);
    if (notch) { const n = mesh(new THREE.BoxGeometry(0.09, r * 0.62, 0.03), M.black, false); n.position.set(0, r * 0.55, h + 0.27); spin.add(n); }
    return { g, spin };
  }
  const smallKnobs = {};
  for (const k of ['bias', 'eq', 'nr', 'limiter']) { smallKnobs[k] = knob(...L.small[k], 0.5, 1.0, { notch: true }); tag(smallKnobs[k].g, `small:${k}`); }
  const levelKnobs = { L: knob(...L.level.L, 1.35, 1.6, { notch: true }), R: knob(...L.level.R, 1.35, 1.6, { notch: true }) };
  tag(levelKnobs.L.g, 'knob:L'); tag(levelKnobs.R.g, 'knob:R');
  const resetKnob = knob(...L.reset, 0.42, 0.8); tag(resetKnob.g, 'reset');

  /* phones jack + plug */
  const phones = new THREE.Group(); phones.position.set(...L.phones, 0); panel.add(phones);
  { const ring = mesh(new THREE.TorusGeometry(0.55, 0.14, 16, 48), M.chrome); ring.position.z = 0.08; phones.add(ring);
    const hole = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 32), M.cavity, false); hole.rotation.x = Math.PI / 2; hole.position.z = -0.5; phones.add(hole);
    const hit = mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ visible: false }), false, false); hit.position.z = 0.2; phones.add(hit); }
  tag(phones, 'phones');
  const plug = new THREE.Group(); phones.add(plug); plug.visible = false;
  { const body = mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 32), M.chrome); body.rotation.x = Math.PI / 2; body.position.z = 1.3; plug.add(body);
    const boot = mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 24), M.black); boot.rotation.x = Math.PI / 2; boot.position.z = 3.3; plug.add(boot); }
  let cable = null;

  /* ---------------------------------------------------------------- cassettes: four classic shells
     About is a smoked translucent Type I, Projects a black chrome Type II, Experience a Type IV metal tape,
     Contact a white ferric with rainbow stripes. Each label carries the tape's title, written by hand. */
  const SHELL = {
    about: { kind: 'smoked', shell: 0x4a2c18, opacity: 0.6, hub: 0xeee6d6, len: 'C-60', type: 'NORMAL', iec: 'IEC I  ·  TYPE I  ·  120 µs', accent: '#c8922e', ink: '#24180f', spine: 'NORMAL' },
    projects: { kind: 'chrome', shell: 0x0c0c0f, opacity: 1, hub: 0xb9bcc2, len: 'C-90', type: 'CrO₂', iec: 'HIGH BIAS  ·  IEC II  ·  70 µs', accent: '#38a6df', ink: '#0b1726', spine: 'CrO₂ HIGH' },
    resume: { kind: 'metal', shell: 0x101010, opacity: 1, hub: 0x9c9890, len: 'C-60', type: 'METAL', iec: 'IEC IV  ·  TYPE IV  ·  70 µs', accent: '#d3271c', ink: '#101010', spine: 'METAL IV' },
    contact: { kind: 'ferric', shell: 0xeeeae2, opacity: 1, hub: 0xffffff, len: 'C-46', type: 'FERRIC', iec: 'NORMAL BIAS  ·  IEC I  ·  120 µs', accent: '#e05a7c', ink: '#2a2230', spine: 'FERRIC' },
  };
  const RAINBOW = ['#e05a7c', '#f08a3c', '#f2c14a', '#3fb0a0'];
  const CW = 10.2, CH = 6.4, CT = 1.0, WIN = { w: 6.6, h: 1.9, y: 0.15 }, HUBX = 2.13;
  /* the printed label, 200 px per cm; the window is cut out of it */
  function labelTexture(tape) {
    const st = SHELL[tape]; const S = 200, W = Math.round(CW * S), H = Math.round(CH * S);
    const [c, g] = canvas(W, H);
    const X = (u) => (u + CW / 2) * S, Y = (v) => (CH / 2 - v) * S;          // cassette cm → canvas px
    const LW = 8.8, top = 3.0, bot = -1.7;                                    // label: ±4.4 across, from the top edge to above the head area
    const rr = (x0, y0, x1, y1, r) => { g.beginPath(); g.roundRect(X(x0), Y(y0), (x1 - x0) * S, (y0 - y1) * S, r * S); };
    const font = (w, cm, fam) => { g.font = `${w} ${cm * S}px ${fam}`; };
    const brushedFill = (x0, y0, x1, y1, base) => { g.save(); rr(x0, y0, x1, y1, 0.12); g.clip(); g.fillStyle = base; g.fillRect(0, 0, W, H); const r = rng(5); for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.12})` : `rgba(0,0,0,${r() * 0.1})`; g.fillRect(r() * W, r() * H, W * (0.2 + r() * 0.6), 1.5); } g.restore(); };
    if (st.kind === 'smoked') {
      // a sticker above the window and a band below it: the smoked shell shows everywhere else
      rr(-LW / 2, top, LW / 2, 1.2, 0.14); g.fillStyle = '#efe4cc'; g.fill();
      g.fillStyle = st.accent; g.fillRect(X(-LW / 2), Y(1.52), LW * S, 0.26 * S);
      rr(-LW / 2, -1.05, LW / 2, bot, 0.1); g.fillStyle = '#efe4cc'; g.fill();
      g.fillStyle = st.accent; g.fillRect(X(-LW / 2), Y(-1.05), LW * S, 0.14 * S);
    } else if (st.kind === 'chrome') {
      const gr = g.createLinearGradient(X(-LW / 2), Y(top), X(LW / 2), Y(bot)); gr.addColorStop(0, '#d9e3ec'); gr.addColorStop(0.45, '#a9bccd'); gr.addColorStop(0.55, '#c6d4e0'); gr.addColorStop(1, '#8ea3b8');
      rr(-LW / 2, top, LW / 2, bot, 0.14); g.fillStyle = gr; g.fill();
      g.save(); rr(-LW / 2, top, LW / 2, bot, 0.14); g.clip();
      g.fillStyle = '#0e1f33'; g.beginPath(); g.moveTo(X(0.3), Y(top)); g.lineTo(X(1.5), Y(top)); g.lineTo(X(-0.4), Y(bot)); g.lineTo(X(-1.6), Y(bot)); g.fill();
      g.fillStyle = st.accent; g.beginPath(); g.moveTo(X(1.65), Y(top)); g.lineTo(X(2.05), Y(top)); g.lineTo(X(0.15), Y(bot)); g.lineTo(X(-0.25), Y(bot)); g.fill();
      g.fillStyle = '#c9d6e2'; g.fillRect(X(-LW / 2), Y(-1.2), LW * S, 0.42 * S);
      g.restore();
    } else if (st.kind === 'metal') {
      g.save(); rr(-LW / 2, top, LW / 2, bot, 0.14); g.clip();
      g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
      brushedFill(-LW / 2, -0.95, LW / 2, bot, '#b9b6b0');
      g.fillStyle = st.accent; g.fillRect(X(-LW / 2), Y(-0.95), LW * S, 0.1 * S);
      g.restore();
      // the red badge
      rr(2.15, 2.75, 4.15, 2.0, 0.08); g.fillStyle = st.accent; g.fill();
      g.fillStyle = '#fff'; font(400, 0.42, 'Michroma'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('METAL', X(3.15), Y(2.38));
    } else {
      rr(-LW / 2, top, LW / 2, bot, 0.14); g.fillStyle = '#fbf8f2'; g.fill();
      g.save(); rr(-LW / 2, top, LW / 2, bot, 0.14); g.clip();
      RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(X(-LW / 2), Y(-1.0 - i * 0.17), LW * S, 0.17 * S); });
      RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(X(1.15 + i * 0.3), Y(top), 0.19 * S, (top - 1.3) * S); });
      g.restore();
    }
    // writing lines and the title, by hand
    const dark = st.kind === 'metal' ? '#f1ede6' : st.ink;
    g.strokeStyle = st.kind === 'metal' ? 'rgba(255,255,255,.35)' : 'rgba(30,30,40,.28)'; g.lineWidth = 3;
    for (const v of [2.0, 1.25 + (st.kind === 'smoked' ? 0.42 : 0)]) { g.beginPath(); g.moveTo(X(-LW / 2 + 0.45), Y(v)); g.lineTo(X(st.kind === 'metal' ? 1.9 : 2.4), Y(v)); g.stroke(); }
    g.fillStyle = st.kind === 'metal' ? '#f6f2ea' : '#1c1a2a';
    font(700, 0.95, '"Caveat"'); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.save(); g.translate(X(-LW / 2 + 0.55), Y(2.08)); g.rotate(-0.025); g.fillText(CASE_LABEL[tape], 0, 0); g.restore();
    // side letter, length, type
    g.fillStyle = dark; g.textBaseline = 'middle';
    font(400, 0.55, 'Michroma'); g.textAlign = 'center'; if (st.kind === 'smoked') g.fillText('A', X(1.3), Y(2.42)); else g.fillText('A', X(-LW / 2 + 0.5), Y(0.15));
    font(400, 0.5, 'Michroma'); g.textAlign = 'right';
    if (st.kind !== 'metal') g.fillText(st.len, X(LW / 2 - 0.35), Y(2.45));
    else { g.fillStyle = '#f1ede6'; g.fillText(st.len, X(1.9), Y(2.38)); }
    g.fillStyle = st.kind === 'metal' ? '#141414' : dark;
    font(400, 0.26, 'Michroma'); g.textAlign = 'center';
    g.fillText(`${(C && C.site.manufacturer) || 'JACK CAREY'}  ·  ${st.iec}`, X(0), Y(-1.4));
    if (st.kind === 'chrome') { font(400, 0.62, 'Michroma'); g.textAlign = 'right'; g.fillStyle = '#0e1f33'; g.fillText('II', X(LW / 2 - 0.4), Y(1.45)); }
    if (st.kind === 'ferric') { font(400, 0.3, 'Michroma'); g.textAlign = 'right'; g.fillStyle = st.ink; g.fillText('FERRIC', X(LW / 2 - 0.4), Y(1.6)); }
    // the window, cut through
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.roundRect(X(-WIN.w / 2), Y(WIN.y + WIN.h / 2), WIN.w * S, WIN.h * S, (WIN.h / 2) * S); g.fill();
    g.globalCompositeOperation = 'source-over';
    // a printed frame around the window
    g.strokeStyle = st.kind === 'metal' ? 'rgba(255,255,255,.55)' : 'rgba(20,16,12,.55)'; g.lineWidth = 5;
    g.beginPath(); g.roundRect(X(-WIN.w / 2) - 6, Y(WIN.y + WIN.h / 2) - 6, WIN.w * S + 12, WIN.h * S + 12, (WIN.h / 2) * S + 6); g.stroke();
    return texFrom(c);
  }
  /* the clear window carries a printed time scale */
  function windowTexture() {
    const S = 200; const [c, g] = canvas(Math.round(WIN.w * S), Math.round(WIN.h * S));
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.fillStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
    const y = c.height - 22;
    for (let i = 0; i <= 12; i++) { const x = c.width * (0.28 + (0.44 * i) / 12); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - (i % 3 === 0 ? 22 : 12)); g.stroke(); }
    g.font = '500 26px "Jost"'; g.textAlign = 'center';
    ['0', '10', '20', '30'].forEach((t, i) => g.fillText(t, c.width * (0.28 + (0.44 * i) / 3), y - 30));
    const t = texFrom(c); return t;
  }
  const shellShape = (() => {
    const s = new THREE.Shape(); const w = CW / 2, h = CH / 2, r = 0.32;
    s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
    return s;
  })();
  const plateGeo = (() => {
    const s = shellShape.clone(); const hw = WIN.w / 2, hh = WIN.h / 2;
    const p = new THREE.Path(); p.moveTo(-hw + hh, WIN.y - hh); p.lineTo(hw - hh, WIN.y - hh); p.absarc(hw - hh, WIN.y, hh, -Math.PI / 2, Math.PI / 2, false); p.lineTo(-hw + hh, WIN.y + hh); p.absarc(-hw + hh, WIN.y, hh, Math.PI / 2, Math.PI * 1.5, false);
    s.holes = [p];
    return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
  })();
  const rimGeo = (() => {
    const s = shellShape.clone(); const w = CW / 2 - 0.18, h = CH / 2 - 0.18;
    const p = new THREE.Path(); p.moveTo(-w, -h); p.lineTo(-w, h); p.lineTo(w, h); p.lineTo(w, -h); p.lineTo(-w, -h); s.holes = [p];
    return new THREE.ExtrudeGeometry(s, { depth: CT - 0.32, bevelEnabled: false, curveSegments: 12 });
  })();
  const headGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(-3.7, -CH / 2); s.lineTo(3.7, -CH / 2); s.lineTo(2.9, -CH / 2 + 1.1); s.lineTo(-2.9, -CH / 2 + 1.1); s.lineTo(-3.7, -CH / 2);
    for (const x of [-2.1, -0.55, 0.55, 2.1]) { const p = new THREE.Path(); p.absarc(x, -CH / 2 + 0.48, x === -0.55 || x === 0.55 ? 0.18 : 0.26, 0, Math.PI * 2, true); s.holes.push(p); }
    return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  })();
  const hubGeo = (() => {
    const s = new THREE.Shape(); s.absarc(0, 0, 0.62, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, 0.34, 0, Math.PI * 2, true); s.holes.push(h);
    return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 32 });
  })();
  const toothGeo = new THREE.BoxGeometry(0.12, 0.16, 0.5);
  const screwGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20);
  const tapeMatBase = new THREE.MeshStandardMaterial({ color: 0x2e1c12, roughness: 0.42, metalness: 0.25 });
  const winTex = windowTexture();
  const cassettes = {};
  function makeCassette(tape) {
    const st = SHELL[tape];
    const g = new THREE.Group();
    const smoked = st.kind === 'smoked';
    const tapeMat = tapeMatBase.clone(), screwMat = M.chrome.clone();
    const shell = new THREE.MeshPhysicalMaterial({ color: st.shell, roughness: smoked ? 0.12 : 0.32, clearcoat: smoked ? 1 : 0.6, clearcoatRoughness: 0.15,
      transparent: smoked, opacity: st.opacity, depthWrite: !smoked, metalness: 0 });
    const front = mesh(plateGeo, shell); front.position.z = CT / 2 - 0.16; g.add(front);
    const back = mesh(plateGeo, shell); back.position.z = -CT / 2; g.add(back);
    const rim = mesh(rimGeo, shell); rim.position.z = -CT / 2 + 0.16; g.add(rim);
    const head = mesh(headGeo, shell); head.position.z = CT / 2; g.add(head);
    if (smoked) { front.renderOrder = rim.renderOrder = back.renderOrder = head.renderOrder = 2; }
    const labelMat = new THREE.MeshPhysicalMaterial({ map: labelTexture(tape), alphaTest: 0.5, roughness: st.kind === 'chrome' || st.kind === 'metal' ? 0.32 : 0.62, metalness: st.kind === 'chrome' ? 0.2 : st.kind === 'metal' ? 0.3 : 0, clearcoat: 0.25 });
    labelMat.userData.print = 'label';
    const label = mesh(new THREE.PlaneGeometry(CW, CH), labelMat, false); label.position.z = CT / 2 + 0.035; g.add(label);
    const win = mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), new THREE.MeshPhysicalMaterial({ map: winTex, color: 0xffffff, transparent: true, opacity: 0.9, roughness: 0.03, clearcoat: 1, depthWrite: false }), false, false);
    win.material.userData.glow = false;
    win.position.set(0, WIN.y, CT / 2 - 0.08); win.renderOrder = 3; g.add(win);
    for (const [x, y] of [[-4.72, 2.88], [4.72, 2.88], [-4.72, -2.88], [4.72, -2.88], [0, -1.92]]) {
      const sc = mesh(screwGeo, screwMat, false); sc.rotation.x = Math.PI / 2; sc.position.set(x, y, CT / 2 + (x === 0 ? 0.13 : 0.02)); g.add(sc);
    }
    // guide rollers and a felt pad at the head opening, the tape running across them
    for (const x of [-3.15, 3.15]) { const rl = mesh(new THREE.CylinderGeometry(0.22, 0.22, CT - 0.34, 16), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.5 }), false); rl.rotation.x = Math.PI / 2; rl.position.set(x, -CH / 2 + 0.55, 0); g.add(rl); }
    const run = mesh(new THREE.BoxGeometry(6.3, 0.04, 0.5), tapeMat, false); run.position.set(0, -CH / 2 + 0.3, 0); g.add(run);
    const pad = mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1 }), false); pad.position.set(0, -CH / 2 + 0.5, 0); g.add(pad);
    const packs = [], hubs = [];
    const hubMat = new THREE.MeshStandardMaterial({ color: st.hub, roughness: 0.45 });
    for (const x of [-HUBX, HUBX]) {
      const pack = mesh(new THREE.CylinderGeometry(1, 1, 0.5, 48), tapeMat, false); pack.rotation.x = Math.PI / 2; pack.position.set(x, WIN.y, -0.05); g.add(pack); packs.push(pack);
      const hub = new THREE.Group(); hub.position.set(x, WIN.y, -0.2);
      hub.add(mesh(hubGeo, hubMat, false));
      for (let k = 0; k < 6; k++) { const t = mesh(toothGeo, hubMat, false); const a = (k / 6) * Math.PI * 2; t.position.set(Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.25); t.rotation.z = a + Math.PI / 2; hub.add(t); }
      g.add(hub); hubs.push(hub);
    }
    // the leader runs from each pack to its roller (seen through the smoked shell)
    for (const sx of [-1, 1]) { const lead = mesh(new THREE.BoxGeometry(0.03, 2.3, 0.5), tapeMat, false); lead.position.set(sx * 3.35, -1.2, -0.05); lead.rotation.z = sx * 0.28; g.add(lead); }
    g.userData = { tape, packs, hubs, label };
    tag(g, `tape:${tape}`);
    // every material this tape owns, with its own colour and reflection strength, so the deck's well can shade it
    const mats = new Set(); g.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) mats.add(m); });
    g.userData.shade = [...mats].map((m) => ({ m, color: m.color ? m.color.clone() : null, env: m.envMapIntensity ?? 1 }));
    return g;
  }

  /* cases: clear Norelco boxes. The lid carries the printed insert (cover and spine) and hinges at the back */
  function insertTexture(tape) {
    const st = SHELL[tape]; const [c, g] = canvas(1040, 680);
    const bg = st.kind === 'metal' ? '#141414' : st.kind === 'chrome' ? '#0e1a2b' : st.kind === 'ferric' ? '#f7f3ea' : '#efe3c8';
    g.fillStyle = bg; g.fillRect(0, 0, 1040, 680);
    const fg = st.kind === 'metal' || st.kind === 'chrome' ? '#eef0f2' : st.ink;
    if (st.kind === 'ferric') RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, 430 + i * 34, 1040, 34); });
    if (st.kind === 'smoked') { g.fillStyle = st.accent; g.fillRect(0, 470, 1040, 26); g.fillRect(0, 512, 1040, 8); }
    if (st.kind === 'chrome') { g.fillStyle = st.accent; g.beginPath(); g.moveTo(640, 0); g.lineTo(720, 0); g.lineTo(520, 680); g.lineTo(440, 680); g.fill(); }
    if (st.kind === 'metal') { const gr = g.createLinearGradient(0, 440, 0, 680); gr.addColorStop(0, '#d0ccc4'); gr.addColorStop(1, '#8e8a84'); g.fillStyle = gr; g.fillRect(0, 440, 1040, 240); g.fillStyle = st.accent; g.fillRect(0, 432, 1040, 10); }
    g.fillStyle = fg; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '400 30px Michroma'; g.fillText((C && C.site.manufacturer) || 'JACK CAREY', 56, 90);
    g.font = '700 118px "Caveat"'; g.fillText(CASE_LABEL[tape], 52, 250);
    g.font = '400 28px Michroma'; g.fillText(`${st.type}  ·  ${st.len}`, 58, 320);
    g.font = '400 24px Michroma'; g.globalAlpha = 0.75; g.fillText('SIDE A', 58, 372); g.globalAlpha = 1;
    if (st.kind === 'metal') { g.fillStyle = '#141414'; g.font = '400 26px Michroma'; g.fillText(st.iec, 58, 600); }
    return texFrom(c);
  }
  /* the inside of the insert, seen when the lid stands open: the track list, written in */
  function insideTexture(tape) {
    const st = SHELL[tape]; const [c, g] = canvas(1040, 680);
    g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, 1040, 680);
    g.strokeStyle = 'rgba(60,80,120,.22)'; g.lineWidth = 2;
    for (let y = 200; y < 660; y += 62) { g.beginPath(); g.moveTo(50, y); g.lineTo(990, y); g.stroke(); }
    g.fillStyle = st.kind === 'ferric' ? RAINBOW[0] : st.accent; g.fillRect(0, 0, 1040, 16);
    g.fillStyle = '#2a2420'; g.font = '400 30px Michroma'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText('SIDE A', 56, 96);
    g.textAlign = 'right'; g.fillText(st.len, 984, 96);
    const chs = C && C.sections[tape] ? C.sections[tape].chapters : [];
    g.textAlign = 'left'; g.fillStyle = '#1c1a2a'; g.font = '700 54px "Caveat"';
    chs.slice(0, 7).forEach((ch, i) => g.fillText(`${i + 1}.  ${ch.short || ch.title}`, 64, 188 + i * 62));
    return texFrom(c);
  }
  function spineTexture(tape) {
    const st = SHELL[tape]; const [c, g] = canvas(1060, 150);
    const bg = st.kind === 'metal' ? '#161616' : st.kind === 'chrome' ? '#0e1a2b' : st.kind === 'ferric' ? '#f7f3ea' : '#efe3c8';
    g.fillStyle = bg; g.fillRect(0, 0, 1060, 150);
    const gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(0,0,0,.1)'); g.fillStyle = gr; g.fillRect(0, 0, 1060, 150);
    if (st.kind === 'ferric') RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(760 + i * 60, 0, 60, 150); });
    else { g.fillStyle = st.accent; g.beginPath(); g.moveTo(790, 150); g.lineTo(850, 0); g.lineTo(1060, 0); g.lineTo(1060, 150); g.fill(); }
    const fg = st.kind === 'metal' || st.kind === 'chrome' ? '#eef0f2' : st.ink;
    g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = '400 58px Michroma'; g.fillText(CASE_LABEL[tape].toUpperCase(), 48, 80);
    g.font = '400 26px Michroma'; g.textAlign = 'right'; g.fillStyle = st.kind === 'ferric' ? st.ink : '#ffffff'; g.fillText(st.spine, 1030, 80);
    return texFrom(c);
  }
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0.17, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  caseMat.userData.glow = false;
  const cases = {};
  const CASE = { w: 11.2, h: 1.75, d: 7.2 };
  // each half is an open box: the face where tray and lid meet is not drawn, so it never slices a tape inside
  const halfGeo = new THREE.BoxGeometry(CASE.w, CASE.h / 2, CASE.d);
  const noFace = new THREE.MeshBasicMaterial({ visible: false });
  const trayMats = [caseMat, caseMat, noFace, caseMat, caseMat, caseMat];   // +x −x +y −y +z −z: no top
  const lidMats = [caseMat, caseMat, caseMat, noFace, caseMat, caseMat];    // no bottom
  function makeCase(tape) {
    const g = new THREE.Group();
    const tray = mesh(halfGeo, trayMats, false, false); tray.position.y = -CASE.h / 4; tray.renderOrder = 3; g.add(tray);
    const hinge = new THREE.Group(); hinge.position.set(0, 0, -CASE.d / 2); g.add(hinge);
    const lid = mesh(halfGeo, lidMats, false, false); lid.position.set(0, CASE.h / 4, CASE.d / 2); lid.renderOrder = 3; hinge.add(lid);
    const coverMat = new THREE.MeshStandardMaterial({ map: insertTexture(tape), roughness: 0.6 });
    const cover = mesh(new THREE.PlaneGeometry(CASE.w - 0.7, CASE.d - 0.5), coverMat, false); cover.rotation.x = -Math.PI / 2; cover.position.set(0, CASE.h / 2 - 0.06, CASE.d / 2); hinge.add(cover);
    // the back of the insert, seen from below when the lid stands open
    const insideMat = new THREE.MeshStandardMaterial({ map: insideTexture(tape), roughness: 0.75 });
    const coverBack = mesh(new THREE.PlaneGeometry(CASE.w - 0.7, CASE.d - 0.5), insideMat, false); coverBack.rotation.x = Math.PI / 2; coverBack.position.set(0, CASE.h / 2 - 0.065, CASE.d / 2); hinge.add(coverBack);
    const spineMat = new THREE.MeshStandardMaterial({ map: spineTexture(tape), roughness: 0.6 });
    const spine = mesh(new THREE.PlaneGeometry(CASE.w - 0.7, CASE.h - 0.3), spineMat, false); spine.position.set(0, 0, CASE.d - 0.06); hinge.add(spine);
    const slot = new THREE.Group(); slot.position.set(0, -CASE.h / 2 + 0.1 + 0.53, 0); slot.rotation.x = -Math.PI / 2; g.add(slot);
    const glow = mesh(new RoundedBoxGeometry(CASE.w + 0.3, CASE.h + 0.25, CASE.d + 0.3, 2, 0.25), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false }), false, false);
    glow.renderOrder = 6; glow.material.userData.glow = false; g.add(glow);
    g.userData = { tape, slot, glow, hinge, cover: coverMat, spine: spineMat, inside: insideMat };
    tag(g, `case:${tape}`);
    return g;
  }

  /* ---------------------------------------------------------------- room: desk, wall, window, rain */
  {
    const desk = mesh(new THREE.BoxGeometry(260, 4, 200), M.desk, false, true); desk.position.set(10, -2, 20); scene.add(desk);
    if (!LOOK) {
      const mirror = new Reflector(new THREE.PlaneGeometry(260, 200), { textureWidth: 640, textureHeight: 400, clipBias: 0.003, shader: DESK_MIRROR });
      const reflect = mirror.onBeforeRender; let mf = 0;
      mirror.onBeforeRender = function (...args) { if ((mf++ % (PERF.backdrop ? 8 : PERF.moving ? 2 : 4)) === 0) reflect.apply(this, args); };
      mirror.rotation.x = -Math.PI / 2; mirror.position.set(10, 0.02, 20); mirror.material.transparent = true; mirror.material.depthWrite = false;
      mirror.renderOrder = 1; scene.add(mirror); M.mirror = mirror;
    }
    const wall = new THREE.Shape(); wall.moveTo(-200, -4); wall.lineTo(240, -4); wall.lineTo(240, 200); wall.lineTo(-200, 200); wall.lineTo(-200, -4);
    const win = new THREE.Path(); win.moveTo(-14, 20); win.lineTo(-14, 92); win.lineTo(190, 92); win.lineTo(190, 20); win.lineTo(-14, 20); wall.holes.push(win);
    const wm = mesh(new THREE.ExtrudeGeometry(wall, { depth: 6, bevelEnabled: false }), M.wall, false, true); wm.position.set(0, 0, -84); scene.add(wm);
    const frame = (w, h, d, x, y, z) => { const b = mesh(new THREE.BoxGeometry(w, h, d), M.walnut, true, true); b.position.set(x, y, z); scene.add(b); };
    frame(8, 76, 10, -14, 56, -78); frame(6, 76, 8, 46, 56, -79); frame(208, 7, 10, 88, 92, -78);
    frame(220, 4, 18, 88, 18, -72); frame(220, 12, 6, 88, 10, -76);
    // the rain glass shows the dusk view, refracted through animated drops
    const bg = new THREE.TextureLoader().load(BASE + 'assets/scene/backdrop.webp');
    bg.colorSpace = THREE.SRGBColorSpace; bg.generateMipmaps = true; bg.minFilter = THREE.LinearMipmapLinearFilter; bg.anisotropy = 4;
    const rain = new THREE.ShaderMaterial({
      uniforms: { bg: { value: bg }, time: { value: 0 }, shift: { value: new THREE.Vector2() }, amount: { value: 1 }, gain: { value: 1.6 }, tint: { value: new THREE.Color(1, 1, 1) }, sat: { value: 1 }, flash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: RAIN_FRAG,
    });
    const glass = mesh(new THREE.PlaneGeometry(204, 74), rain, false, false); glass.position.set(88, 57, -80); scene.add(glass);
    M.rain = rain;
  }

  /* lamp */
  const lamp = new THREE.Group(); lamp.position.set(-22, 37, -8); lamp.scale.setScalar(0.8); scene.add(lamp);
  const lampLight = new THREE.SpotLight(0xffb36b, 150, 0, 1.25, 1, 1);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(2.3, 32, 16), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 3.2 }));
  const lampInner = new THREE.MeshStandardMaterial({ color: 0x9a7a58, emissive: 0xffc58a, emissiveMap: (() => { const [c, g] = canvas(4, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#8a6a50'); gr.addColorStop(1, '#2a1c12'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return texFrom(c); })(), emissiveIntensity: 0.7, side: THREE.BackSide, roughness: 0.55 });
  {
    const shadeGeo = new THREE.LatheGeometry([new THREE.Vector2(3.2, 6), new THREE.Vector2(4, 4.5), new THREE.Vector2(8, 0), new THREE.Vector2(14, -6.5), new THREE.Vector2(14.3, -7)], 64);
    const shadeOut = new THREE.MeshPhysicalMaterial({ color: 0xa8714a, metalness: 1, roughness: 0.26, envMapIntensity: 0.5, side: THREE.FrontSide });
    const head = new THREE.Group(); head.rotation.set(-0.25, 0, 0.35); lamp.add(head);
    head.add(mesh(shadeGeo, shadeOut, true, false));
    head.add(mesh(shadeGeo, lampInner, false, false));
    lampBulb.position.set(0, -1.5, 0); head.add(lampBulb);
    const arm = mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16), M.black); arm.position.set(-2, 30, -4); arm.rotation.z = 0.35; lamp.add(arm);
    // the light is aimed at the deck on its own, so the shade can sit at its best angle
    lampLight.position.set(-19, 33, -4);
    lampLight.target.position.set(6, 2, 8);
    scene.add(lampLight); scene.add(lampLight.target);
    lampLight.castShadow = true; lampLight.shadow.mapSize.set(2048, 2048); lampLight.shadow.bias = -0.0004; lampLight.shadow.normalBias = 0.04; lampLight.shadow.camera.near = 4; lampLight.shadow.camera.far = 220; lampLight.shadow.radius = 4;
    M.lampHead = head;
  }
  tag(lamp, 'lamp');

  /* dusk light through the window, and the room's dim fill */
  const sky = new THREE.DirectionalLight(0x9a86d0, 0.18); sky.position.set(70, 90, -120); scene.add(sky);
  const sunset = new THREE.DirectionalLight(0xff9a62, 0.45); sunset.position.set(120, 25, -60); scene.add(sunset);
  const hemi = new THREE.HemisphereLight(0x5a4440, 0x1c0f07, 0.55); scene.add(hemi);
  const warmFill = new THREE.DirectionalLight(0xffc28a, 2.1); warmFill.position.set(60, 40, 90); scene.add(warmFill);

  /* mug */
  {
    const prof = [];
    for (const [r, y] of [[0, 0.2], [3.9, 0], [4.15, 0.4], [4.3, 9.2], [4.45, 9.6], [4.05, 9.6], [3.85, 9.1], [3.7, 0.8], [0, 0.8]]) prof.push(new THREE.Vector2(r, y));
    const [c, g] = canvas(64, 512);
    g.fillStyle = '#ddd3c4'; g.fillRect(0, 0, 64, 512);
    g.fillStyle = '#7a4a2a'; for (const [y, h] of [[372, 26], [408, 10], [250, 14]]) g.fillRect(0, y, 64, h);
    const mug = mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ map: texFrom(c), roughness: 0.32, clearcoat: 0.7 }));
    const mugG = M.mug = new THREE.Group(); mugG.position.set(-21.5, 0, 28); scene.add(mugG);
    mug.position.set(0, 0, 0); mugG.add(mug);
    const handle = mesh(new THREE.TorusGeometry(2.6, 0.55, 16, 40, Math.PI * 1.15), new THREE.MeshPhysicalMaterial({ color: 0xddd3c4, roughness: 0.32, clearcoat: 0.7 }));
    handle.position.set(4.4, 5, 0); handle.rotation.z = -Math.PI * 0.575; mugG.add(handle);
  }

  /* dust drifting through the lamp beam */
  const dust = (() => {
    const N = 260, r = rng(41);
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    const apex = new THREE.Vector3(), dir = new THREE.Vector3();
    M.lampHead.updateWorldMatrix(true, true); lampLight.getWorldPosition(apex); lampLight.target.getWorldPosition(dir); dir.sub(apex).normalize();
    const side = new THREE.Vector3(1, 0, 0).cross(dir).normalize(), up = dir.clone().cross(side).normalize();
    for (let i = 0; i < N; i++) {
      const d = 6 + r() * 36, rad = Math.sqrt(r()) * d * 0.55, a = r() * Math.PI * 2;
      const p = apex.clone().addScaledVector(dir, d).addScaledVector(side, Math.cos(a) * rad).addScaledVector(up, Math.sin(a) * rad);
      pos.set([p.x, p.y, p.z], i * 3); seed[i] = r();
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, k: { value: 1 }, color: { value: new THREE.Color(1, 0.82, 0.58) } },
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return mat;
  })();

  /* place cases and cassettes. On a wide screen the cases stand in a stack to the right of the deck, and a picked
     case slides out onto the desk in front of the stack to open; on a tall screen they lie in a row in front of
     the deck and open where they lie. */
  const TAPES = C ? C.tapes.map((t) => t.id) : ['about', 'projects', 'resume', 'contact'];
  const STACK_ORDER = ['contact', 'resume', 'projects', 'about'];          // bottom → top: About on top
  const stack = new THREE.Group(); stack.position.set(30.5, 0, 11); stack.rotation.y = -14 * D2R; scene.add(stack);
  const row = new THREE.Group(); row.position.set(1.5, 0, 27); scene.add(row);
  const spotAnchor = new THREE.Object3D(); spotAnchor.position.set(14.5, CASE.h / 2, 25); spotAnchor.rotation.y = -4 * D2R; scene.add(spotAnchor);
  const homes = {}, CS = {};
  for (const t of TAPES) {
    cases[t] = makeCase(t); cassettes[t] = makeCassette(t);
    homes[t] = new THREE.Object3D(); CS[t] = { out: false, lid: 0 };
    scene.add(cases[t]);
    cases[t].userData.slot.add(cassettes[t]);
  }
  const layout = { mode: null };
  function placeHomes() {
    const atHome = STACK_ORDER.filter((t) => !CS[t].out);
    for (const t of STACK_ORDER) {
      const a = homes[t];
      if (layout.mode === 'stack') {
        const list = CS[t].out ? STACK_ORDER.filter((x) => !CS[x].out || x === t) : atHome;
        const i = list.indexOf(t);
        stack.add(a); a.position.set(i * 0.22, CASE.h / 2 + i * (CASE.h + 0.03), -i * 0.18); a.rotation.set(0, (i % 2 ? 1.4 : -0.9) * D2R, 0);
      } else {
        const i = TAPES.indexOf(t);
        row.add(a); a.position.set((i - 1.5) * 11.9, CASE.h / 2, 0); a.rotation.set(0, 0, 0);
      }
    }
  }
  const spotOf = (t) => (layout.mode === 'stack' ? spotAnchor : homes[t]);
  const setLid = (t, k) => { CS[t].lid = k; cases[t].userData.hinge.rotation.x = -k * 104 * D2R; };
  function snapCase(t) { const p = poseOf(CS[t].out ? spotOf(t) : homes[t]); scene.attach(cases[t]); cases[t].position.copy(p.p); cases[t].quaternion.copy(p.q); }
  function setLayout(mode) {
    if (mode === layout.mode) return;
    layout.mode = mode; placeHomes();
    // on a tall screen the cases lie where the mug stood: the mug steps back beside the deck
    if (M.mug) M.mug.position.set(...(mode === 'row' ? [-30, 0, 4] : [-21.5, 0, 28]));
    PERF.shadowFrames = 4;
    for (const t of TAPES) snapCase(t);
  }
  /* the cases left at home close ranks (or make room) */
  function settle(dur = 320, except = null) {
    const moves = TAPES.filter((t) => t !== except && !CS[t].out).map((t) => ({ c: cases[t], a: poseOf(cases[t]), b: poseOf(homes[t]) }));
    if (!moves.length) return Promise.resolve();
    return tween(dur, (k) => { for (const m of moves) { m.c.position.lerpVectors(m.a.p, m.b.p, k); m.c.quaternion.slerpQuaternions(m.a.q, m.b.q, k); } });
  }

  /* ---------------------------------------------------------------- per-tape light */
  const c3 = (h) => new THREE.Color(h);
  const THEMES = {
    about: { name: 'golden lamplight', lampK: 1, lampColor: c3(0xffb36b), fill: c3(0xffc28a), fillK: 2.1, sky: c3(0x9a86d0), skyK: 0.18, sunset: c3(0xff9a62), sunsetK: 0.45,
      hemiSky: c3(0x5a4440), hemiGround: c3(0x1c0f07), hemiK: 0.55, winTint: c3(0xffffff), winSat: 1, winGain: 1.6, exposure: 0.98, env: 1.15, meterK: 0.95, meterTint: c3(0xffffff),
      lift: new THREE.Vector3(0.012, 0.004, -0.004), gain: new THREE.Vector3(1.04, 1.0, 0.94), sat: 1.04 },
    projects: { name: 'blue hour', lampK: 0.72, lampColor: c3(0xffb877), fill: c3(0x8ea4d8), fillK: 1.1, sky: c3(0x5a78c8), skyK: 0.45, sunset: c3(0x3d5aa8), sunsetK: 0.15,
      hemiSky: c3(0x2c3c60), hemiGround: c3(0x0a0b14), hemiK: 0.55, winTint: c3(0x5a74c8), winSat: 0.55, winGain: 1.05, exposure: 0.94, env: 0.85, meterK: 1.15, meterTint: c3(0x9ff0e8),
      lift: new THREE.Vector3(-0.004, 0.006, 0.02), gain: new THREE.Vector3(0.92, 0.98, 1.08), sat: 0.96 },
    resume: { name: 'clear daylight', lampK: 0.3, lampColor: c3(0xfff0dd), fill: c3(0xfff5ea), fillK: 3.2, sky: c3(0xe2eaf6), skyK: 1.3, sunset: c3(0xffffff), sunsetK: 0.35,
      hemiSky: c3(0xd9dfe8), hemiGround: c3(0x3a2a20), hemiK: 1.05, winTint: c3(0xf2f6ff), winSat: 0.35, winGain: 2.5, exposure: 1.0, env: 1.45, meterK: 0.7, meterTint: c3(0xffffff),
      lift: new THREE.Vector3(0.01, 0.01, 0.012), gain: new THREE.Vector3(1.0, 1.0, 1.02), sat: 0.92 },
    contact: { name: 'rose dusk', lampK: 0.82, lampColor: c3(0xffa880), fill: c3(0xff9c8c), fillK: 2.2, sky: c3(0xc27aa2), skyK: 0.42, sunset: c3(0xff6a58), sunsetK: 1.1,
      hemiSky: c3(0x6a3a4c), hemiGround: c3(0x200a10), hemiK: 0.62, winTint: c3(0xffb0b8), winSat: 1.15, winGain: 1.75, exposure: 1.0, env: 1.1, meterK: 0.95, meterTint: c3(0xffd8e8),
      lift: new THREE.Vector3(0.018, 0.0, 0.008), gain: new THREE.Vector3(1.06, 0.96, 0.98), sat: 1.06 },
  };
  const cloneTheme = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v && v.clone ? v.clone() : v]));
  const TH = cloneTheme(THEMES.about);
  let thFrom = cloneTheme(THEMES.about), thTo = THEMES.about, thK = 1;
  function applyTheme(tape, instant) {
    const to = THEMES[tape]; if (!to) return;
    thFrom = cloneTheme(TH); thTo = to; thK = instant ? 1 : 0;
    if (instant) Object.assign(TH, cloneTheme(to));
  }
  function stepTheme(dt) {
    if (thK < 1) thK = Math.min(1, thK + dt / 1.6);
    const e = ease.inOut(thK);
    for (const k of Object.keys(TH)) {
      const a = thFrom[k], b = thTo[k];
      if (typeof b === 'number') TH[k] = a + (b - a) * e;
      else if (b && b.isColor) TH[k].copy(a).lerp(b, e);
      else if (b && b.isVector3) TH[k].copy(a).lerp(b, e);
    }
    warmFill.color.copy(TH.fill); warmFill.intensity = TH.fillK;
    sky.color.copy(TH.sky); sunset.color.copy(TH.sunset); sunset.intensity = TH.sunsetK;
    hemi.color.copy(TH.hemiSky); hemi.groundColor.copy(TH.hemiGround);
    scene.environmentIntensity = TH.env;
  }

  /* ---------------------------------------------------------------- camera framing
     Wide screens see the deck from the front with the case stack to the right; tall screens look down a little
     more steeply, at the deck with the four cases in a row before it. */
  const cam = { w: 1, h: 1, target: new THREE.Vector3(5, 11.2, 7), dir: new THREE.Vector3(-3, 3.4, 52).normalize(), dist: 56, portrait: false };
  function frame() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    const aspect = w / h;
    cam.w = w; cam.h = h;
    camera.aspect = aspect;
    cam.portrait = aspect < 0.95;
    setLayout(cam.portrait ? 'row' : 'stack');
    if (cam.portrait) {
      camera.fov = 46;
      const ht = Math.tan((camera.fov * D2R) / 2) * aspect;
      cam.target.set(2, 8.5, 15); cam.dir.set(0, 0.74, 1).normalize();
      cam.dist = 28 / ht;
    } else {
      camera.fov = 38;
      cam.target.set(6.5, 10.6, 8); cam.dir.set(-3, 3.6, 52).normalize();
      cam.dist = 57 * clamp((16 / 9) / aspect, 1, 1.45);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer && composer.setSize(w, h);
    if (lens) lens.uniforms.res.value.set(w, h);
  }
  function placeCamera() {
    camera.position.copy(cam.target).addScaledVector(cam.dir, cam.dist); camera.lookAt(cam.target);
  }

  /* ---------------------------------------------------------------- post: bloom, then a light lens (grade, vignette, grain)
     No depth of field: everything on the desk stays sharp. Only the ?look=lofi preview reads depth, for its outlines. */
  let composer = null, lens = null, bloom = null;
  function buildPost() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    if (LOOK) rt.depthTexture = new THREE.DepthTexture(1, 1);
    composer = new EffectComposer(renderer, rt);
    if (LOOK) composer.renderTarget2.depthTexture = new THREE.DepthTexture(1, 1);
    composer.renderTarget1.samples = composer.renderTarget2.samples = 2;
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.55, 0.93);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    lens = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 },
        near: { value: camera.near }, far: { value: camera.far },
        lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1 }, ca: { value: 0.35 }, lofi: { value: LOOK },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: LENS_FRAG,
    });
    composer.addPass(lens);
  }

  /* ---------------------------------------------------------------- animation core */
  const tweens = new Set();
  const V = { speed: 1, instant: false };
  function tween(dur, fn, e = ease.inOut) {
    return new Promise((res) => {
      if (V.instant || dur <= 1) { fn(1); res(); return; }
      tweens.add({ t: 0, dur, fn, e, res });
    });
  }
  function stepTweens(dt) {
    for (const tw of tweens) {
      tw.t += dt * 1000 * V.speed;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(k));
      if (k >= 1) { tweens.delete(tw); tw.res(); }
    }
  }
  /* springs integrate in fixed 1/240 s steps: stable however long a frame takes, so a key can never overshoot and stick */
  const spring = (s, target, dt, k = 900, z = 0.5) => {
    const c = 2 * Math.sqrt(k) * z;
    for (let t = dt; t > 1e-6; t -= 1 / 240) { const h = Math.min(t, 1 / 240); s.v += (-k * (s.x - target) - c * s.v) * h; s.x += s.v * h; }
  };

  /* hover glow belongs to whatever is under the pointer: anything that moves away takes none with it */
  function clearGlow(obj) {
    obj.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m.userData.glowing) { m.emissive.setRGB(0, 0, 0); m.userData.glowing = false; } });
  }
  /* inside the deck the tape sits in a shaded well behind smoked glass */
  function shadeTape(tape, k) {
    for (const s of cassettes[tape].userData.shade) { if (s.color) s.m.color.copy(s.color).multiplyScalar(k); s.m.envMapIntensity = s.env * k; }
  }
  /* world pose helpers for flights */
  function poseOf(obj) { obj.updateWorldMatrix(true, false); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); obj.matrixWorld.decompose(p, q, s); return { p, q }; }
  function setLocal(obj, parent, pos = [0, 0, 0], rot = [0, 0, 0]) { parent.add(obj); obj.position.set(...pos); obj.rotation.set(...rot); }
  const raisedPose = () => { const o = new THREE.Object3D(); holder.add(o); o.position.set(0, 7.6, -0.1); const pz = poseOf(o); holder.remove(o); return pz; };
  async function flight(obj, to, dur = 520, lift = 8) {
    const a = poseOf(obj);
    const b = to;
    scene.attach(obj);
    const mid = a.p.clone().lerp(b.p, 0.5); mid.y += lift + a.p.distanceTo(b.p) * 0.18; mid.z += lift * 0.5;
    const q = new THREE.Quaternion();
    await tween(dur, (k) => {
      const u = 1 - k;
      obj.position.set(u * u * a.p.x + 2 * u * k * mid.x + k * k * b.p.x, u * u * a.p.y + 2 * u * k * mid.y + k * k * b.p.y, u * u * a.p.z + 2 * u * k * mid.z + k * k * b.p.z);
      q.slerpQuaternions(a.q, b.q, ease.inOut(k)); obj.quaternion.copy(q);
    }, ease.inOut);
  }

  /* ---------------------------------------------------------------- state the app drives */
  const S = { loaded: null, doorAngle: 0, needles: { L: -50, R: -50 }, hubs: [0, 0], packs: 0.5, volume: 6, lamp: true, sound: false, hover: null, focus: null, playReady: false, pulse: 0 };
  const knobState = { L: { x: 0, v: 0 }, R: { x: 0, v: 0 } };
  const resetState = { x: 0, v: 0, hold: 0 };
  // the decorative knobs click between two detents
  const detents = { bias: { on: false, x: -40 * D2R, v: 0 }, eq: { on: true, x: 40 * D2R, v: 0 }, nr: { on: true, x: 40 * D2R, v: 0 }, limiter: { on: false, x: -40 * D2R, v: 0 } };

  function setDoor(a) { S.doorAngle = a; door.rotation.x = a * 27 * D2R; }

  const View = {
    ok: true,
    speed(k) { V.speed = k; }, instant(on) { V.instant = on; },
    /* the starting picture, with no animation: which tape is in the deck (its case out and open) */
    setInitial(tape) {
      for (const t of TAPES) { CS[t].out = t === tape; setLid(t, t === tape ? 1 : 0); setLocal(cassettes[t], cases[t].userData.slot); }
      placeHomes(); for (const t of TAPES) snapCase(t);
      for (const t of TAPES) { clearGlow(cases[t]); shadeTape(t, t === tape ? 0.58 : 1); }
      if (tape) setLocal(cassettes[tape], holder);
      S.loaded = tape;
    },
    async doorOpen() { if (S.doorAngle > 0.99) return; const a0 = S.doorAngle; await tween(320, (k) => setDoor(a0 + (1 - a0) * k), ease.back); },
    async doorClose() { if (S.doorAngle < 0.01) return; const a0 = S.doorAngle; await tween(260, (k) => setDoor(a0 * (1 - k)), ease.in); setDoor(0); },
    /* a case leaves the stack for the desk (or, in a row, just lifts a little) */
    async caseOut(tape) {
      if (CS[tape].out) return;
      CS[tape].out = true; placeHomes(); clearGlow(cases[tape]);
      if (layout.mode === 'stack') await Promise.all([flight(cases[tape], poseOf(spotAnchor), 560, 4), settle(340, tape)]);
      else { const c = cases[tape], y0 = c.position.y; await tween(160, (k) => { c.position.y = y0 + Math.sin(k * Math.PI) * 0.8; }); }
    },
    async caseHome(tape) {
      if (!CS[tape].out) return;
      CS[tape].out = false; placeHomes(); clearGlow(cases[tape]);
      if (layout.mode === 'stack') { await settle(260, tape); await flight(cases[tape], poseOf(homes[tape]), 520, 4); }
      snapCase(tape);
    },
    async lidOpen(tape) { const l0 = CS[tape].lid; if (l0 > 0.99) return; await tween(440, (k) => setLid(tape, l0 + (1 - l0) * k), ease.back); },
    async lidClose(tape) { const l0 = CS[tape].lid; if (l0 < 0.01) return; await tween(300, (k) => setLid(tape, l0 * (1 - k)), ease.in); setLid(tape, 0); },
    /* the cassette rises out of its open case and flies up over the open door */
    async fromCase(tape) {
      const c = cassettes[tape];
      clearGlow(c);
      setLocal(c, cases[tape].userData.slot);
      await tween(220, (k) => { c.position.z = 2.2 * k; }, ease.out);
      await flight(c, raisedPose(), 600);
      setLocal(c, holder, [0, 7.6, -0.1]);
    },
    /* the tape drops into the holder (never toward the glass) and into the well's shade */
    async lowerIn(tape) { const c = cassettes[tape]; setLocal(c, holder, [0, 7.6, -0.1]); await tween(380, (k) => { c.position.y = 7.6 * (1 - k); c.position.z = -0.1 * (1 - k); shadeTape(tape, 1 - 0.42 * k); }, ease.inOut); setLocal(c, holder); shadeTape(tape, 0.58); S.loaded = tape; },
    async ejectUp(tape) { const c = cassettes[tape]; clearGlow(c); setLocal(c, holder); S.loaded = null; await tween(300, (k) => { c.position.y = 7.6 * k; c.position.z = -0.1 * k; shadeTape(tape, 0.58 + 0.42 * k); }, ease.out); shadeTape(tape, 1); },
    async toCase(tape) {
      const c = cassettes[tape], slot = cases[tape].userData.slot;
      clearGlow(c);
      const above = new THREE.Object3D(); slot.add(above); above.position.set(0, 0, 2.2); const pz = poseOf(above); slot.remove(above);
      await flight(c, pz, 600);
      setLocal(c, slot, [0, 0, 2.2]);
      await tween(200, (k) => { c.position.z = 2.2 * (1 - k); }, ease.in);
      setLocal(c, slot);
    },
    setCounter(str) { [...str].forEach((d, i) => { if (drums[i]) drums[i].target = Number(d); }); },
    setNeedle(ch, a) { S.needles[ch] = a; },
    setHubs(aL, aR) { S.hubs = [aL, aR]; },
    setPacks(p) { S.packs = p; },
    press(act) { const k = keys[act]; if (k) k.hold = 0.11; if (act === 'reset') resetState.hold = 0.12; },
    setLatched(act, on) { const k = keys[act]; if (k) k.latched = on; },
    setPlayReady(on) { S.playReady = on; },
    setVolume(v) { S.volume = v; },
    setLamp(on) { S.lamp = on; },
    setPlug(on) {
      S.sound = on; plug.visible = on;
      if (on && !cable) {
        scene.updateMatrixWorld(true);
        const a = phones.localToWorld(new THREE.Vector3(0, 0, 4.1));
        const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(-0.4, -1.6, 2.2)), new THREE.Vector3(a.x - 1.5, 0.5, 18.5), new THREE.Vector3(a.x - 9, 0.35, 21), new THREE.Vector3(-40, 0.35, 23)]);
        cable = mesh(new THREE.TubeGeometry(curve, 64, 0.32, 10), M.black); scene.add(cable);
      }
      if (cable) cable.visible = on;
    },
    setTheme(tape, instant) { applyTheme(tape, instant || V.instant); },
    _flash() { nextFlash = time; },
    setFocus(id) { S.focus = id; },
    setBackdrop(on) { PERF.backdrop = on; if (!on) PERF.shadowFrames = 2; },
    portrait() { return cam.portrait; },
    screenRect(id) {
      const o = ids.get(id); if (!o) return null;
      const box = new THREE.Box3().setFromObject(o); if (box.isEmpty()) return null;
      const r = renderer.domElement.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height;
        x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },
    setQuality(lite) {
      V.lite = lite;
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      PERF.max = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5, Math.sqrt((lite ? 1.1e6 : 2.3e6) / (w * h)));
      PERF.min = Math.max(0.5, PERF.max * 0.55);
      PERF.scale = PERF.max;
      renderer.setPixelRatio(PERF.scale); if (composer) composer.setPixelRatio(PERF.scale);
      renderer.shadowMap.enabled = !lite; lampLight.castShadow = !lite; if (M.mirror) M.mirror.visible = !lite; if (bloom) bloom.enabled = !lite;
      frame();
    },
    on: {},
  };

  /* ---------------------------------------------------------------- picking */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false).find((h) => h.object.visible !== false);
    return hit || null;
  }
  /* a cassette sitting in its case stands for the case; the one in the deck is not a target */
  function idOf(hit) {
    let id = hit ? hit.object.userData.id : null;
    if (id && id.startsWith('tape:')) { const t = id.slice(5); id = cassettes[t].parent === cases[t].userData.slot && !CS[t].out ? `case:${t}` : null; }
    if (id && id.startsWith('case:') && CS[id.slice(5)].out) id = null;
    return id;
  }
  let drag = null;
  const el = renderer.domElement;
  el.addEventListener('pointermove', (ev) => {
    if (drag) { const dv = Math.round(drag.v + ((drag.y - ev.clientY) + (ev.clientX - drag.x)) / 12); View.on.volume && View.on.volume(clamp(dv, 0, 10)); return; }
    if (ev.pointerType !== 'mouse') return;
    const id = idOf(pick(ev));
    S.hover = id; el.style.cursor = id ? (id.startsWith('knob') ? 'grab' : 'pointer') : '';
  });
  el.addEventListener('pointerleave', () => { S.hover = null; });
  el.addEventListener('pointerdown', (ev) => {
    const id = idOf(pick(ev)); if (!id) return;
    if (ev.pointerType !== 'mouse') { S.hover = id; setTimeout(() => { if (S.hover === id) S.hover = null; }, 260); }
    if (id.startsWith('knob')) { drag = { x: ev.clientX, y: ev.clientY, v: S.volume }; el.setPointerCapture(ev.pointerId); el.style.cursor = 'grabbing'; }
  });
  el.addEventListener('pointerup', () => { if (drag) { drag = null; el.style.cursor = 'grab'; } });
  el.addEventListener('click', (ev) => {
    const id = idOf(pick(ev)); if (!id) return;
    const on = View.on;
    if (id.startsWith('key:')) return on.act && on.act(id.slice(4));
    if (id.startsWith('case:')) { S.hover = null; glowLevel.set(id, 0); clearGlow(ids.get(id)); return on.tape && on.tape(id.slice(5)); }
    if (id.startsWith('small:')) { const d = detents[id.slice(6)]; d.on = !d.on; return on.act && on.act('knob'); }
    const map = { reset: 'reset', phones: 'sound', lamp: 'lamp' };
    if (map[id]) return on.act && on.act(map[id]);
  });
  el.addEventListener('wheel', (ev) => { const id = idOf(pick(ev)); if (id && id.startsWith('knob')) { ev.preventDefault(); View.on.volume && View.on.volume(clamp(S.volume + (ev.deltaY < 0 ? 1 : -1), 0, 10)); } }, { passive: false });

  /* ---------------------------------------------------------------- per-frame */
  let last = performance.now(), time = 0, raf = 0;
  const lampOn = { x: 1, v: 0 };
  const glowLevel = new Map(), GLOW = new THREE.Color(1, 0.6, 0.26);
  let nextFlash = 12 + Math.random() * 10, flashAt = -10;
  const LR = ['L', 'R'], DETENTS = Object.keys(detents);
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.1, rawDt); last = now;
    if (!PERF.onScreen) return;
    time += dt; PERF.frame++;
    PERF.moving = tweens.size > 0 || !!drag;
    stepTweens(dt);
    // keys: springs toward pressed / latched / rest
    for (const act of KEY_ACTS) {
      // a press always shows: the hold runs down by at most two frames' worth per frame
      const k = keys[act]; k.hold = Math.max(0, k.hold - Math.min(dt, 0.034));
      const target = k.hold > 0 ? 1 : k.latched ? 0.6 : 0;
      if (V.instant) { k.x = target; k.v = 0; } else spring(k, target, dt, 1600, 0.68);
      k.x = clamp(k.x, -0.05, 1.03);
      if (Math.abs(k.v) > 0.002 || Math.abs(k.x - target) > 0.002) PERF.moving = true;
      k.g.position.set(k.base.x, k.base.y - k.x * 0.08, k.base.z - k.x * 0.5);
    }
    // Play breathes, warm, while a tape waits to be played
    { const want = S.playReady ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 3.3)) : 0; S.pulse += (want - S.pulse) * (1 - Math.exp(-dt * 10)); keyFaceMats.play.emissiveIntensity = S.pulse * 2.2; keys.play.mat.emissive.setRGB(0.5 * S.pulse * 0.18, 0.28 * S.pulse * 0.18, 0.1 * S.pulse * 0.18); }
    // knobs
    { const r = resetState; r.hold = Math.max(0, r.hold - dt); V.instant ? (r.x = r.hold > 0 ? 1 : 0) : spring(r, r.hold > 0 ? 1 : 0, dt, 1600, 0.7); resetKnob.spin.position.z = -r.x * 0.35; if (Math.abs(r.v) > 0.002) PERF.moving = true; }
    const volA = (-135 + S.volume * 27) * D2R;
    for (const s of LR) { const st = knobState[s]; V.instant ? (st.x = volA) : spring(st, volA, dt, 220, 0.8); levelKnobs[s].spin.rotation.z = -st.x; if (Math.abs(st.v) > 0.01) PERF.moving = true; }
    for (const k of DETENTS) { const d = detents[k]; const tA = (d.on ? 40 : -40) * D2R; V.instant ? (d.x = tA) : spring(d, tA, dt, 420, 0.5); smallKnobs[k].spin.rotation.z = -d.x; if (Math.abs(d.v) > 0.01) PERF.moving = true; }
    // counter drums roll
    for (const d of drums) {
      let diff = d.target - d.a; if (diff > 5) diff -= 10; if (diff < -5) diff += 10;
      d.a += diff * (V.instant ? 1 : 1 - Math.exp(-dt * 9));
      d.drum.rotation.x = ((d.a + 0.5) / 10) * Math.PI * 2;
    }
    // needles + reels
    for (const ch of LR) { const a = S.needles[ch]; const t = clamp((a + 50) / 80, -0.03, 1.05); needles[ch].rotation.z = -(-46 + t * 92) * D2R; }
    if (S.loaded) {
      const u = cassettes[S.loaded].userData;
      u.hubs[0].rotation.z = -S.hubs[0] * D2R; u.hubs[1].rotation.z = -S.hubs[1] * D2R;
      const p = clamp(S.packs, 0, 1);
      u.packs[0].scale.set(0.95 + 1.15 * (1 - p), 1, 0.95 + 1.15 * (1 - p)); u.packs[1].scale.set(0.95 + 1.15 * p, 1, 0.95 + 1.15 * p);
    }
    // hover / keyboard focus: the part glows warm (no labels)
    for (const id of ids.keys()) {
      const want = S.hover === id || S.focus === id ? 1 : 0;
      const cur = glowLevel.get(id) || 0;
      const nxt = cur + (want - cur) * (1 - Math.exp(-dt * 14));
      if (Math.abs(nxt - cur) < 1e-4 && nxt < 1e-3) { if (cur) { glowLevel.set(id, 0); clearGlow(ids.get(id)); } continue; }
      glowLevel.set(id, nxt);
      ids.get(id).traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.userData.glow !== false && m.emissive && (m.userData.glow || m.emissive.getHex() === 0 || m.userData.glowing)) { m.userData.glowing = true; m.emissive.copy(GLOW).multiplyScalar(nxt * (m.map ? 0.14 : 0.24)); } });
    }
    for (const t of TAPES) {
      const gl = cases[t].userData.glow.material;
      gl.opacity = (glowLevel.get(`case:${t}`) || 0) * 0.08;
    }
    // per-tape light, blending toward the current theme
    stepTheme(dt);
    // lightning, now and then
    let flash = 0;
    if (!V.instant && !V.lite) {
      if (time > nextFlash) { flashAt = time; nextFlash = time + 16 + Math.random() * 26; View.on.flash && View.on.flash(); }
      const ft = time - flashAt;
      if (ft >= 0 && ft < 0.6) flash = Math.exp(-ft * 18) + 0.7 * Math.exp(-Math.pow((ft - 0.22) * 22, 2));
    }
    // meters glow with the signal
    const sig = (clamp((S.needles.L + 50) / 80, 0, 1) + clamp((S.needles.R + 50) / 80, 0, 1)) / 2;
    M.meterFace.emissiveIntensity = TH.meterK * (0.8 + sig * 0.45); M.meterGlow.intensity = 160 * TH.meterK * (0.75 + sig * 0.6);
    M.meterFace.emissive.copy(TH.meterTint);
    if (lens) { lens.uniforms.lift.value.copy(TH.lift); lens.uniforms.gain.value.copy(TH.gain); lens.uniforms.sat.value = TH.sat; lens.uniforms.time.value = time; }
    dust.uniforms.time.value = time; dust.uniforms.k.value = (V.lite ? 0 : 1) * clamp(lampOn.x, 0, 1) * TH.lampK;
    // lamp
    spring(lampOn, S.lamp ? 1 : 0, dt, 60, 1);
    const L1 = clamp(lampOn.x, 0, 1.2);
    const LK = L1 * TH.lampK;
    lampLight.intensity = 150 * LK; lampBulb.material.emissiveIntensity = 2.6 * LK + 0.05; lampInner.emissiveIntensity = 0.62 * LK + 0.01;
    lampLight.color.copy(TH.lampColor);
    renderer.toneMappingExposure = TH.exposure - (1 - L1) * 0.15;
    sky.intensity = TH.skyK + flash * 2.6; hemi.intensity = TH.hemiK + flash * 0.9;
    if (M.rain) { M.rain.uniforms.flash.value = flash; M.rain.uniforms.tint.value.copy(TH.winTint); M.rain.uniforms.sat.value = TH.winSat; M.rain.uniforms.gain.value = TH.winGain; M.rain.uniforms.time.value = V.lite ? 3 : time; }
    placeCamera();
    camera.updateMatrixWorld();
    if (PERF.moving) PERF.shadowFrames = 2;
    if (PERF.shadowFrames > 0 && !PERF.backdrop && (!PERF.moving || (PERF.frame & 1) === 0)) { renderer.shadowMap.needsUpdate = true; if (!PERF.moving) PERF.shadowFrames--; }
    // behind the display the room is mostly covered: half the frames are enough, and the GPU goes to the reading
    const skip = PERF.backdrop && !PERF.moving && (PERF.frame & 1) === 1;
    if (!skip) {
      if (composer) { if (LOOK) lens.uniforms.tDepth.value = composer.readBuffer.depthTexture; composer.render(); } else renderer.render(scene, camera);
    }
    govern(rawDt);
    if (GOV.pending && !PERF.moving) applyGovernor();
  }
  /* keep the frame rate up, calmly: render resolution follows the median frame time against the screen's own
     refresh rate, and only ever changes while nothing is moving (a resize reallocates every render target) */
  const GOV = { calib: [], refresh: 1 / 60, win: [], acc: 0, slow: 0, liteWins: 0, okSince: 0, lastChange: -99, raises: 0, raisedFrom: 0, pending: 0, pendingLite: false, changes: 0 };
  function govern(rawDt) {
    if (rawDt > 0.25 || rawDt <= 0) return;
    if (GOV.calib.length < 40) {
      GOV.calib.push(rawDt);
      if (GOV.calib.length === 40) { const c = GOV.calib.slice().sort((a, b) => a - b); GOV.refresh = clamp(c[20], 1 / 144, 1 / 24); GOV.okSince = performance.now() / 1000; }
      return;
    }
    GOV.win.push(rawDt); GOV.acc += rawDt;
    if (GOV.acc < 1) return;
    const w = GOV.win.sort((a, b) => a - b), med = w[w.length >> 1];
    GOV.win.length = 0; GOV.acc = 0;
    const now = performance.now() / 1000, budget = GOV.refresh * 1.12;
    if (med > budget) { GOV.slow++; GOV.okSince = now; } else GOV.slow = 0;
    GOV.liteWins = med > GOV.refresh * 1.6 && PERF.scale <= PERF.min + 0.01 ? GOV.liteWins + 1 : 0;
    if (GOV.liteWins >= 3 && !V.lite) { GOV.pendingLite = true; GOV.pending = -1; return; }
    if (GOV.slow >= 2 && PERF.scale > PERF.min + 0.01 && now - GOV.lastChange > 6) {
      // a raise that cost frames sets the ceiling, so it never bounces between two sizes
      if (GOV.raisedFrom && now - GOV.lastChange < 12) PERF.max = Math.max(PERF.min, GOV.raisedFrom);
      GOV.pending = Math.max(PERF.min, PERF.scale * (med > budget * 1.5 ? 0.8 : 0.9)); GOV.raisedFrom = 0;
    } else if (med < GOV.refresh * 1.04 && now - GOV.okSince > 8 && now - GOV.lastChange > 8 && GOV.raises < 2 && PERF.scale < PERF.max - 0.01) {
      GOV.raisedFrom = PERF.scale; GOV.raises++;
      GOV.pending = Math.min(PERF.max, PERF.scale * 1.1);
    }
  }
  function applyGovernor() {
    if (GOV.pendingLite) { GOV.pendingLite = false; GOV.pending = 0; View.setQuality(true); return; }
    const k = GOV.pending; GOV.pending = 0;
    if (Math.abs(k - PERF.scale) < 0.01) return;
    GOV.lastChange = performance.now() / 1000; GOV.changes++; GOV.slow = 0;
    setScale(k);
  }
  function setScale(k) {
    PERF.scale = k;
    renderer.setPixelRatio(k);
    if (composer) composer.setPixelRatio(k);
    frame();
  }

  const ready = (async () => {
    const fonts = ['400 40px Michroma', '400 40px "Pinyon Script"', 'italic 500 40px Fraunces', '600 40px Jost', '500 40px Jost', '700 40px Caveat'];
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]);
    await paintPanel();
    panelTex.needsUpdate = true; panelOrm.needsUpdate = true;
    doorMat.map.dispose(); doorMat.map = texFrom(makeDoorFace().c); doorMat.needsUpdate = true;
    { const f = vuFace(); M.meterFace.map.dispose(); M.meterFace.map = f; M.meterFace.emissiveMap = f; M.meterFace.needsUpdate = true; }
    M.drumMat.map.dispose(); M.drumMat.map = M.drumTexture(); M.drumMat.needsUpdate = true;
    // textures drawn before fonts arrived are redrawn now
    const swap = (mat, key, tex) => { if (mat[key]) mat[key].dispose(); mat[key] = tex; mat.needsUpdate = true; };
    for (const t of TAPES) {
      swap(cassettes[t].userData.label.material, 'map', labelTexture(t));
      swap(cases[t].userData.cover, 'map', insertTexture(t));
      swap(cases[t].userData.spine, 'map', spineTexture(t));
      swap(cases[t].userData.inside, 'map', insideTexture(t));
    }
    for (const act of KEY_ACTS) { swap(keyFaceMats[act], 'map', keyFace(act)); swap(keyFaceMats[act], 'emissiveMap', keyFace(act, true)); }
    { const wt = windowTexture(); for (const t of TAPES) cassettes[t].traverse((o) => { if (o.material && o.material.map === winTex) o.material.map = wt; }); }
    buildPost();
    frame();
    View.setQuality(false);
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* compiles on first use instead */ }
    // the first full frame (shadows, mirror, bloom chain) is the slow one: draw it now, while the still still covers the room
    placeCamera(); camera.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true;
    if (composer) composer.render(); else renderer.render(scene, camera);
    await new Promise((r) => requestAnimationFrame(() => r()));
    new IntersectionObserver((entries) => { PERF.onScreen = entries.some((en) => en.isIntersecting); }).observe(renderer.domElement);
    new ResizeObserver(frame).observe(host);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } });
    raf = requestAnimationFrame(loop);
    return true;
  })();
  View.ready = ready;
  View._debug = { PERF, GOV, scene, camera, cam, lamp, cases, cassettes, stack, keys, CS, THREE, get lens() { return lens; }, get composer() { return composer; } };
  return View;
}

/* ------------------------------------------------------------------ shaders */
const RAIN_FRAG = /* glsl */`
precision highp float;
uniform sampler2D bg; uniform float time; uniform vec2 shift; uniform float gain; uniform vec3 tint; uniform float sat; uniform float flash;
varying vec2 vUv;
#define S(a,b,t) smoothstep(a,b,t)
vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787)); p3 += dot(p3, p3.yzx + 19.19); return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x)); }
float N(float t){ return fract(sin(t*12345.564)*7658.76); }
float Saw(float b, float t){ return S(0., b, t)*S(1., b, t); }
vec2 DropLayer(vec2 uv, float t){
  vec2 UV = uv;
  uv.y += t*0.75;
  vec2 a = vec2(6., 1.);
  vec2 grid = a*2.;
  vec2 id = floor(uv*grid);
  float colShift = N(id.x);
  uv.y += colShift;
  id = floor(uv*grid);
  vec3 n = N13(id.x*35.2+id.y*2376.1);
  vec2 st = fract(uv*grid)-vec2(.5, 0.);
  float x = n.x-.5;
  float y = UV.y*20.;
  float wiggle = sin(y+sin(y));
  x += wiggle*(.5-abs(x))*(n.z-.5);
  x *= .7;
  float ti = fract(t+n.z);
  y = (Saw(.85, ti)-.5)*.9+.5;
  vec2 p = vec2(x, y);
  float d = length((st-p)*a.yx);
  float mainDrop = S(.4, .0, d);
  float r = sqrt(S(1., y, st.y));
  float cd = abs(st.x-x);
  float trail = S(.23*r, .15*r*r, cd);
  float trailFront = S(-.02, .02, st.y-y);
  trail *= trailFront*r*r;
  y = UV.y;
  y = fract(y*10.)+(st.y-.5);
  float dd = length(st-vec2(x, y));
  float droplets = S(.3, 0., dd);
  float m = mainDrop+droplets*r*trailFront;
  return vec2(m, trail);
}
float StaticDrops(vec2 uv, float t){
  uv *= 22.;
  vec2 id = floor(uv);
  uv = fract(uv)-.5;
  vec3 n = N13(id.x*107.45+id.y*3543.654);
  vec2 p = (n.xy-.5)*.7;
  float d = length(uv-p);
  float fade = Saw(.025, fract(t+n.z));
  return S(.3, 0., d)*fract(n.z*10.)*fade;
}
vec2 Drops(vec2 uv, float t){
  float s = StaticDrops(uv, t);
  vec2 m1 = DropLayer(uv, t);
  vec2 m2 = DropLayer(uv*1.85, t);
  float c = s+m1.x+m2.x;
  c = S(.3, 1., c);
  return vec2(c, max(m1.y, m2.y));
}
void main(){
  vec2 uv = (vUv - .5) * vec2(2.75, 1.) * 1.05;
  float T = time * .18;
  vec2 c = Drops(uv, T);
  // smooth normals from two more samples (screen-space derivatives would outline every drop in 2x2 blocks)
  vec2 e = vec2(.0016, 0.);
  vec2 n = vec2(Drops(uv + e, T).x - c.x, Drops(uv + e.yx, T).x - c.x) * .55;
  vec2 buv = vec2(.18 + vUv.x * .64, min(.99, vUv.y / .56)) + shift;
  float focus = mix(3.3 - c.y * 1.8, 1.2, S(.1, .2, c.x));
  vec3 col = textureLod(bg, buv + n, focus).rgb;
  // streaks of rain falling outside
  float sx = vUv.x * 260. + vUv.y * 40.;
  float streak = S(.97, 1., sin(sx) ) * S(.6, 1., fract(vUv.y * 3. + time * 2.4 + N(floor(sx / 6.28)) ));
  col += streak * .025;
  float lum = dot(col, vec3(.2126, .7152, .0722));
  col = mix(vec3(lum), col, sat) * tint * gain;
  col += vec3(.75, .82, 1.) * flash * (.6 + lum * 2.);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const LENS_FRAG = /* glsl */`
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 res; uniform float time;
uniform float near; uniform float far; uniform float sat; uniform float ca; uniform float lofi;
uniform vec3 lift; uniform vec3 gain;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float viewDist(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near * far) / (far - d * (far - near)); }
vec3 sampleCA(vec2 uv, float amt){
  vec2 o = (uv - .5) * amt / res * 2.;
  return vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b);
}
float bayer4(vec2 p){
  p = mod(p, 4.);
  int i = int(p.x) + int(p.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i] / 16. - .5;
}
void main(){
  vec2 grid = vec2(floor(res.x / res.y * 300.), 300.);
  vec2 uv = lofi > .5 ? (floor(vUv * grid) + .5) / grid : vUv;
  float edge = length(vUv - .5) * 2.;
  // a whisper of lateral colour toward the corners only
  vec3 col = sampleCA(uv, ca * edge * edge * 2.2 * (1. - lofi));
  // grade (display space): lift the shadows, tint the highlights, set saturation
  col = col * gain + lift * (1. - col);
  float l = dot(col, vec3(.2126, .7152, .0722));
  col = mix(vec3(l), col, sat);
  if (lofi > .5) {
    // a low-resolution, outlined, banded look: depth edges, distance haze, few tones with ordered dither
    vec2 px = 1. / grid;
    float dc = viewDist(uv);
    float dx = abs(viewDist(uv + vec2(px.x, 0.)) - dc) + abs(viewDist(uv - vec2(px.x, 0.)) - dc);
    float dy = abs(viewDist(uv + vec2(0., px.y)) - dc) + abs(viewDist(uv - vec2(0., px.y)) - dc);
    float ed = smoothstep(.04, .16, (dx + dy) / max(dc, 1.));
    col *= 1. - ed * .8;
    col = mix(col, vec3(.045, .05, .055), smoothstep(70., 170., dc) * .55);
    col = pow(max(col, 0.), vec3(1.15)) * 1.12;
    float levels = 6.;
    col = floor(col * levels + .5 + bayer4(floor(uv * grid)) * .9) / levels;
  }
  float v = smoothstep(1.25, .3, length((vUv - .5) * vec2(1.1, 1.)));
  col *= mix(lofi > .5 ? .3 : .62, 1., v);
  col += (hash(vUv * res + fract(time) * 100.) - .5) * (lofi > .5 ? .05 : .014);
  gl_FragColor = vec4(col, 1.);
}`;

const DESK_MIRROR = {
  name: 'DeskMirror',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */`
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vWorld;
void main(){
  vUv = textureMatrix * vec4(position, 1.);
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: /* glsl */`
uniform vec3 color; uniform sampler2D tDiffuse;
varying vec4 vUv;
varying vec3 vWorld;
void main(){
  vec2 uv = vUv.xy / vUv.w;
  vec3 acc = vec3(0.); float tot = 0.;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec2 o = vec2(float(i), float(j)) * vec2(.0024, .0034);
    float w = 1. - length(vec2(float(i), float(j))) / 3.2;
    acc += texture2D(tDiffuse, uv + o).rgb * w; tot += w;
  }
  vec3 c = acc / tot;
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = .06 + .34 * pow(1. - clamp(V.y, 0., 1.), 4.);
  gl_FragColor = vec4(c * vec3(1., .8, .64), fres);
}`,
};

const DUST_VERT = /* glsl */`
uniform float time; attribute float seed; varying float vA;
void main(){
  vec3 p = position; float t = time * .14 + seed * 40.;
  p += vec3(sin(t * 1.3 + seed * 6.) * 1.3, sin(t * .7 + seed * 9.) * 1.8, cos(t * 1.1 + seed * 5.) * 1.3);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (.8 + seed * 1.5) * (240. / -mv.z);
  vA = (.3 + .7 * fract(seed * 7.31)) * (.6 + .4 * sin(time * (.6 + seed) + seed * 20.));
}`;
const DUST_FRAG = /* glsl */`
uniform float k; uniform vec3 color; varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .0, d) * vA * k;
  gl_FragColor = vec4(color * a * .6, a);
}`;

let view = null;
try { view = createView(); } catch (e) { console.error(e); view = null; }
window.STATION_VIEW = view;
window.dispatchEvent(new Event('station-view'));
