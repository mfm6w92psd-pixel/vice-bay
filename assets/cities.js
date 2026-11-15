// New Bot: procedural satellite cities for the 5x world. One InstancedMesh per city for buildings (cheap on phones).
import * as THREE from 'three';

function roadTex(alongU) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#3a3a40'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  x.fillStyle = '#f5d142';
  if (alongU) { for (let i = 0; i < 128; i += 32) x.fillRect(i, 62, 18, 4); x.fillStyle = '#ddd'; x.fillRect(0, 6, 128, 3); x.fillRect(0, 119, 128, 3); }
  else { for (let i = 0; i < 128; i += 32) x.fillRect(62, i, 4, 18); x.fillStyle = '#ddd'; x.fillRect(6, 0, 3, 128); x.fillRect(119, 0, 3, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
let winTex = null;
function windowTex() {
  if (winTex) return winTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = Math.random() < 0.25 ? '#ffe9a8' : '#7f9fb8'; x.fillRect(i * 16 + 3, j * 16 + 4, 10, 9); }
  winTex = new THREE.CanvasTexture(c); winTex.colorSpace = THREE.SRGBColorSpace; winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; return winTex;
}

const AVES = ['Ocean', 'Palm', 'Sunset', 'Harbor', 'Magnolia', 'Coral', 'Bayview', 'Pelican', 'Royal', 'Lime', 'Banyan', 'Seagrape', 'Hibiscus', 'Mango', 'Cypress', 'Flamingo', 'Tarpon', 'Heron'];
const SUF_A = 'Ave', SUF_S = 'St';

export function buildCity(scene, { name = 'New City', x: ox = 0, z: oz = 0, n = 8, B = 80, RW = 14, seed = 1, addCol = () => {}, palette } = {}) {
  let s = seed * 9301 + 49297; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const H = n * B / 2, half = H + RW / 2, lines = []; for (let i = 0; i <= n; i++) lines.push(-H + i * B);
  const out = { name, root, streets: [], parking: [], bounds: { minX: ox - half - 2, maxX: ox + half + 2, minZ: oz - half - 2, maxZ: oz + half + 2 }, center: new THREE.Vector3(ox, 0, oz), lines: lines.map(v => v) };
  // sidewalk/ground slab
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 1 }));
  slab.rotation.x = -Math.PI / 2; slab.position.y = 0.012; slab.receiveShadow = true; root.add(slab);
  // roads
  const L = 2 * half, tu = roadTex(true), tv = roadTex(false); tu.repeat.set(L / RW, 1); tv.repeat.set(1, L / RW);
  const mu = new THREE.MeshStandardMaterial({ map: tu, roughness: 0.9 }), mv = new THREE.MeshStandardMaterial({ map: tv, roughness: 0.9 });
  const names = AVES.slice().sort(() => rnd() - 0.5);
  lines.forEach((v, i) => {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(L, RW), mu); h.rotation.x = -Math.PI / 2; h.position.set(0, 0.03, v); h.receiveShadow = true; root.add(h);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(RW, L), mv); w.rotation.x = -Math.PI / 2; w.position.set(v, 0.035, 0); w.receiveShadow = true; root.add(w);
    out.streets.push({ name: `${names[i % names.length]} ${SUF_S}`, minX: ox - half, maxX: ox + half, minZ: oz + v - RW / 2, maxZ: oz + v + RW / 2 });
    out.streets.push({ name: `${names[(i + n + 1) % names.length]} ${SUF_A}`, minX: ox + v - RW / 2, maxX: ox + v + RW / 2, minZ: oz - half, maxZ: oz + half });
  });
  // blocks
  const pal = palette || [0xf4f1ea, 0xffd6a5, 0xbde0fe, 0xcaffbf, 0xffc8dd, 0xe4c1f9, 0xd9d9d9, 0xa8dadc, 0xfff1c1];
  const boxes = [], trees = [], parks = [];
  const lot = B - RW;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = -H + B * (i + 0.5), cz = -H + B * (j + 0.5), dc = Math.hypot(cx, cz) / H;
    if (rnd() < 0.1) { parks.push([cx, cz]); for (let k = 0; k < 6; k++) trees.push([cx + (rnd() - 0.5) * (lot - 10), cz + (rnd() - 0.5) * (lot - 10)]); continue; }
    const sub = lot / 2 - 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (rnd() < 0.15) continue;
      const w = sub * (0.7 + rnd() * 0.3), d = sub * (0.7 + rnd() * 0.3);
      const hgt = dc < 0.35 ? 30 + rnd() * 70 : dc < 0.7 ? 12 + rnd() * 30 : 6 + rnd() * 12;
      boxes.push({ x: cx + sx * (sub / 2 + 1), z: cz + sz * (sub / 2 + 1), w, d, h: hgt, c: pal[Math.floor(rnd() * pal.length)] });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const bmat = new THREE.MeshStandardMaterial({ map: windowTex(), roughness: 0.7 });
  const im = new THREE.InstancedMesh(geo, bmat, boxes.length); im.castShadow = true; im.receiveShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  boxes.forEach((b, k) => { m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, 0, b.z); im.setMatrixAt(k, m4); im.setColorAt(k, col.setHex(b.c)); addCol(ox + b.x, oz + b.z, b.w, b.d, b.h); });
  root.add(im);
  const pmat = new THREE.MeshStandardMaterial({ color: 0x5fae5a, roughness: 1 });
  for (const [cx, cz] of parks) { const p = new THREE.Mesh(new THREE.PlaneGeometry(lot, lot), pmat); p.rotation.x = -Math.PI / 2; p.position.set(cx, 0.02, cz); p.receiveShadow = true; root.add(p); }
  if (trees.length) {
    const tg = new THREE.ConeGeometry(3, 9, 7); tg.translate(0, 6, 0);
    const ti = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x2d6a4f }), trees.length); ti.castShadow = true;
    trees.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); ti.setMatrixAt(k, m4); }); root.add(ti);
  }
  // city name sign at the middle of each edge entrance
  out.parks = parks.map(([x, z]) => ({ x: ox + x, z: oz + z, s: lot }));
  out.boxes = boxes.map(b => ({ minX: ox + b.x - b.w / 2, maxX: ox + b.x + b.w / 2, minZ: oz + b.z - b.d / 2, maxZ: oz + b.z + b.d / 2 }));
  // parking spots along roads (right side), for parked cars
  for (let k = 0; k < 10; k++) {
    const li = lines[1 + Math.floor(rnd() * (n - 1))], t = -H + B * (Math.floor(rnd() * n) + 0.5) + (rnd() - 0.5) * 20;
    if (rnd() < 0.5) out.parking.push([ox + li + RW / 2 - 2.2, oz + t, 0]); else out.parking.push([ox + t, oz + li + RW / 2 - 2.2, -Math.PI / 2]);
  }
  out.streetAt = (x, z) => (out.streets.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || {}).name || null;
  out.inside = (x, z) => x >= out.bounds.minX && x <= out.bounds.maxX && z >= out.bounds.minZ && z <= out.bounds.maxZ;
  root.updateMatrixWorld(true);
  return out;
}
