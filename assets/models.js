// Mika: original low-poly procedural models. No external files, loads instantly.
// Requires an importmap mapping "three" (e.g. https://unpkg.com/three@0.160.0/build/three.module.js).
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts }));
  return matCache.get(key);
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

export const CAR_COLORS = [0xff2d6f, 0x19c3ff, 0xffd23f, 0x2ee59d, 0xffffff, 0x1c1c24, 0xff7a1a, 0x8a5cff];

// Car about 2 x 1.4 x 4.2 units, facing -Z. Returns group with .userData.wheels, .lights
export function makeCar(color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], { police = false } = {}) {
  const g = new THREE.Group();
  const body = police ? 0xffffff : color;
  g.add(box(2, 0.6, 4.2, body, 0, 0.55, 0, { metalness: 0.6, roughness: 0.3 }));
  g.add(box(1.7, 0.55, 2.1, police ? 0x111111 : body, 0, 1.1, 0.2, { metalness: 0.6, roughness: 0.3 }));
  g.add(box(1.6, 0.45, 0.05, 0x223344, 0, 1.1, -0.86, { metalness: 0.9, roughness: 0.1 })); // windshield
  g.add(box(1.6, 0.45, 0.05, 0x223344, 0, 1.1, 1.26, { metalness: 0.9, roughness: 0.1 }));
  if (police) { g.add(box(2.02, 0.25, 1.6, 0x111111, 0, 0.6, 0)); }
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10); wGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1, -1.35], [1, -1.35], [-1, 1.35], [1, 1.35]]) {
    const w = new THREE.Mesh(wGeo, mat(0x111111)); w.position.set(x, 0.38, z); w.castShadow = true; g.add(w); wheels.push(w);
  }
  const head = box(0.4, 0.15, 0.05, 0xffffee, 0, 0.6, -2.11, { emissive: 0xffffcc, emissiveIntensity: 1 });
  const head2 = head.clone(); head.position.x = -0.65; head2.position.x = 0.65; g.add(head, head2);
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.2 });
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), brakeMat); tl.position.set(-0.65, 0.65, 2.11);
  const tr = tl.clone(); tr.position.x = 0.65; g.add(tl, tr);
  const lights = { brakeMat };
  if (police) {
    const red = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 1 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), red); r.position.set(-0.35, 1.47, 0.2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), blue); b.position.set(0.35, 1.47, 0.2);
    g.add(r, b); lights.red = red; lights.blue = blue;
  }
  g.userData = { wheels, lights, police };
  return g;
}
export const makePoliceCar = () => makeCar(0xffffff, { police: true });

// Call each frame: spins wheels, flashes police lights, brake lights.
export function animateCar(car, speed, dt, braking = false, t = performance.now() / 1000) {
  for (const w of car.userData.wheels) w.rotation.x -= speed * dt / 0.38;
  car.userData.lights.brakeMat.emissiveIntensity = braking ? 1.5 : 0.2;
  if (car.userData.police) {
    const on = Math.floor(t * 6) % 2 === 0;
    car.userData.lights.red.emissiveIntensity = on ? 2 : 0.1;
    car.userData.lights.blue.emissiveIntensity = on ? 0.1 : 2;
  }
}

// Person about 1.8 tall. .userData.legs/arms for walk animation.
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a1e];
const SHIRT = [0xff5e7e, 0x3ec1d3, 0xf6d55c, 0x20639b, 0xffffff, 0x9b5de5, 0xf15bb5, 0x00bb77];
const pick = a => a[Math.floor(Math.random() * a.length)];
export function makePerson({ skin = pick(SKIN), shirt = pick(SHIRT), pants = 0x2b2d42, police = false } = {}) {
  const g = new THREE.Group();
  if (police) { shirt = 0x1d3557; pants = 0x10182b; }
  const torso = box(0.55, 0.65, 0.3, shirt, 0, 1.15, 0); g.add(torso);
  g.add(box(0.36, 0.36, 0.36, skin, 0, 1.68, 0));
  if (police) g.add(box(0.42, 0.12, 0.42, 0x10182b, 0, 1.9, 0));
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.14 * s, 0.82, 0);
    leg.add(box(0.2, 0.8, 0.22, pants, 0, -0.4, 0)); g.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(0.37 * s, 1.42, 0);
    arm.add(box(0.16, 0.6, 0.18, shirt, 0, -0.3, 0)); g.add(arm); arms.push(arm);
  }
  g.userData = { legs, arms, phase: Math.random() * 6 };
  return g;
}
export function animatePerson(p, speed, dt) {
  const u = p.userData; u.phase += speed * dt * 2.2;
  const a = Math.min(speed / 3, 1) * 0.7 * Math.sin(u.phase);
  u.legs[0].rotation.x = a; u.legs[1].rotation.x = -a; u.arms[0].rotation.x = -a; u.arms[1].rotation.x = a;
}

// Miami-style pastel buildings with window strips.
const PASTEL = [0xffc8dd, 0xbde0fe, 0xfff1c1, 0xcaffbf, 0xffd6a5, 0xe4c1f9, 0xf5f5f5, 0x9bf6ff];
let winTex, winRough;
function windowTexture() {
  if (winTex) return winTex;
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S * 2; const x = c.getContext('2d');
  const r = document.createElement('canvas'); r.width = S; r.height = S * 2; const rx = r.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, S * 2); rx.fillStyle = '#00e600'; rx.fillRect(0, 0, S, S * 2); // walls: rough, not metal (G=rough, B=metal)
  for (let i = 0; i < 4000; i++) { const v = 235 + Math.random() * 20; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * S, Math.random() * S * 2, 2, 2); } // plaster grain
  for (let row = 0; row < 8; row++) for (let k = 0; k < 4; k++) {
    const X = 16 + k * 60, Y = 16 + row * 64, lit = Math.random() < 0.25;
    x.fillStyle = '#d0d0d0'; x.fillRect(X - 3, Y - 3, 46, 46); // frame
    const gr = x.createLinearGradient(X, Y, X + 40, Y + 40); gr.addColorStop(0, lit ? '#fff2b8' : '#7f9fbf'); gr.addColorStop(1, lit ? '#ffd56a' : '#2c4560');
    x.fillStyle = gr; x.fillRect(X, Y, 40, 40); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(X, Y, 40, 6);
    x.fillStyle = '#c8c8c8'; x.fillRect(X - 4, Y + 42, 48, 4); // sill
    rx.fillStyle = lit ? '#004000' : '#0a1a80'; rx.fillRect(X, Y, 40, 40); // glass: smooth + a bit metallic so it reflects the sky
  }
  winTex = new THREE.CanvasTexture(c); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.colorSpace = THREE.SRGBColorSpace; winTex.anisotropy = 4;
  winRough = new THREE.CanvasTexture(r); winRough.wrapS = winRough.wrapT = THREE.RepeatWrapping;
  return winTex;
}
export function makeBuilding(w = 12, h = 20, d = 12, color = pick(PASTEL)) {
  const g = new THREE.Group();
  const t = windowTexture().clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 12)));
  const rt = winRough.clone(); rt.needsUpdate = true; rt.repeat.copy(t.repeat);
  const side = new THREE.MeshStandardMaterial({ color, map: t, roughnessMap: rt, metalnessMap: rt, roughness: 1, metalness: 1 }); side.userData.facade = true;
  const roof = mat(0xd9d9d9);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  g.add(box(w * 0.3, 1.5, d * 0.3, 0xbbbbbb, w * 0.2, h + 0.75, 0)); // roof unit
  g.userData = { collider: { w, d } };
  return g;
}

export function makePalm(h = 7 + Math.random() * 3) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), mat(0x8b6b4a)); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 4), mat(0x2f9e44));
    leaf.position.set(0, h, 0); leaf.rotation.set(Math.PI / 2.3, (i / 7) * Math.PI * 2, 0, 'YXZ'); leaf.translateY(1.4);
    leaf.castShadow = true; g.add(leaf);
  }
  return g;
}

export function makeStreetLight() {
  const g = new THREE.Group();
  g.add(box(0.15, 6, 0.15, 0x444444, 0, 3, 0));
  g.add(box(1.4, 0.12, 0.2, 0x444444, 0.6, 6, 0));
  const bulb = box(0.4, 0.15, 0.3, 0xffffcc, 1.2, 5.9, 0, { emissive: 0xffe08a, emissiveIntensity: 1 }); g.add(bulb);
  g.userData.bulb = bulb; return g;
}

// Road tile (size x size) with lane markings; lay on y=0.01.
let roadTex, roadMat;
export function makeRoad(size = 20, horizontal = true) {
  if (!roadTex) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#3a3a40'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 40; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); } // aggregate
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(20,20,22,0.25)'; x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 10 + Math.random() * 25, 6 + Math.random() * 12, Math.random() * 3, 0, 7); x.fill(); } // patches/oil
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(S * 0.2, 0, S * 0.12, S); x.fillRect(S * 0.68, 0, S * 0.12, S); // tire tracks
    x.fillStyle = '#f2cf45'; for (let i = 0; i < S; i += 64) x.fillRect(S / 2 - 4, i + 4, 8, 36);
    x.fillStyle = '#e6e6e6'; x.fillRect(8, 0, 6, S); x.fillRect(S - 14, 0, 6, S);
    roadTex = new THREE.CanvasTexture(c); roadTex.colorSpace = THREE.SRGBColorSpace; roadTex.anisotropy = 8;
    roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }); roadMat.userData.road = true;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), roadMat);
  m.rotation.x = -Math.PI / 2; if (horizontal) m.rotation.z = Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true; return m;
}

// Glowing mission marker cylinder; animate with marker.rotation.y += dt.
export function makeMarker(color = 0xffd23f) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  m.position.y = 1.5; return m;
}

// Sunset/day/night sky colors for a day-night cycle. t in [0,1), 0 = midnight.
export function skyColor(t) {
  const stops = [[0, 0x0b1026], [0.22, 0x1b2a55], [0.28, 0xff9a76], [0.35, 0x87ceeb], [0.7, 0x87ceeb], [0.77, 0xff6f61], [0.83, 0x2b2d6e], [1, 0x0b1026]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i];
    return new THREE.Color(ca).lerp(new THREE.Color(cb), (t - a) / (b - a));
  }
  return new THREE.Color(stops[0][1]);
}
