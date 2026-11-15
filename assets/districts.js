// Mika: more districts to make the map bigger. Each builder returns { root, vehicles, spawns, pois, streets, streetAt }.
//   buildAirport(scene, { x, z, addCol })    -> "Vice Bay International": 2 runways, terminal, control tower, hangars, parked jets, a plane you can taxi
//   buildSmallTown(scene, { x, z, addCol })  -> "Palmetto Springs": countryside town with a main street, diner, motel, gas station, church, houses
import * as THREE from 'three';
import { mat, makeBuilding, makeRoad, makeStreetLight, makeCar, makePalm, makePerson } from './models.js';
import { makeTruck, makeMotorcycle, makeSportsCar, makeHelicopter, makeBus } from './vehicles.js';

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sign(text, bg, fg = '#fff', w = 6, h = 1.6) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128); x.fillStyle = fg; x.font = 'bold 60px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}
function ground(root, w, d, color, x = 0, z = 0, y = 0.006) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)); g.rotation.x = -Math.PI / 2; g.position.set(x, y, z); g.receiveShadow = true; root.add(g); return g;
}
function finish(out, ox, oz) {
  out.streetAt = (x, z) => (out.streets.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || {}).name || null;
  out.root.updateMatrixWorld(true); return out;
}

// Airliner, faces -Z, about 34 long, 32 wingspan. Taxi only (or fly if you add it).
export function makeJet(livery = 0xff2d6f) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 12), mat(0xf5f5f5, { metalness: 0.3, roughness: 0.4 })); body.rotation.x = Math.PI / 2; body.position.y = 4; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf5f5f5)); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 4, -15); g.add(nose);
  const tailc = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 12), mat(0xf5f5f5)); tailc.rotation.x = Math.PI / 2; tailc.position.set(0, 4, 18); g.add(tailc);
  g.add(box(32, 0.4, 5, 0xdddddd, 0, 3.4, 1));
  g.add(box(11, 0.3, 2.5, 0xdddddd, 0, 4.6, 17.5));
  g.add(box(0.4, 6, 4, livery, 0, 7.5, 18));
  g.add(box(4.02, 0.6, 26, livery, 0, 3.6, 0));
  g.add(box(3.6, 0.5, 0.05, 0x223344, 0, 4.9, -16.4));
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 10), mat(0x999999)); e.rotation.x = Math.PI / 2; e.position.set(s * 7, 2.4, 0); g.add(e); }
  for (const [x, z] of [[0, -11], [-2.5, 2], [2.5, 2]]) g.add(box(0.5, 2, 0.5, 0x333333, x, 1, z), box(0.6, 1, 1, 0x111111, x, 0.5, z));
  g.userData = { type: 'jet', wheels: [], lights: { brakeMat: new THREE.MeshStandardMaterial() }, stats: { speed: 1.8, accel: 0.4, grip: 0.4 }, seatY: 4.5, collider: { w: 6, d: 34 } };
  return g;
}

export function buildAirport(scene, { x: ox = -2100, z: oz = 0, addCol = () => {} } = {}) {
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const col = (x, z, w, d) => addCol(ox + x, oz + z, w, d), P = (x, z) => new THREE.Vector3(ox + x, 0, oz + z);
  const out = { root, vehicles: [], spawns: { pedestrians: [], traffic: [] }, pois: {}, streets: [] };
  ground(root, 520, 360, 0x93b97a);
  // Runways (east-west) with markings
  for (const rz of [-110, 110]) {
    ground(root, 460, 30, 0x2f2f33, 0, rz, 0.01);
    for (let x = -210; x <= 210; x += 24) ground(root, 12, 0.8, 0xffffff, x, rz, 0.012);
    for (const ex of [-222, 222]) for (let k = -3; k <= 3; k++) ground(root, 10, 1.4, 0xffffff, ex, rz + k * 3.6, 0.012);
    const num = sign(rz < 0 ? '09L' : '09R', '#2f2f33', '#fff', 14, 4); num.rotation.x = -Math.PI / 2; num.rotation.z = Math.PI / 2; num.position.set(-205, 0.02, rz); root.add(num);
    for (let x = -228; x <= 228; x += 12) for (const s of [-1, 1]) root.add(box(0.4, 0.3, 0.4, 0xffffaa, x, 0.15, rz + s * 16, { emissive: 0xffee88, emissiveIntensity: 0.8 }));
  }
  // Taxiway + apron
  ground(root, 400, 14, 0x3a3a40, 0, -60, 0.009); ground(root, 260, 70, 0x9a9a9e, 0, 0, 0.008);
  for (const x of [-150, 150]) ground(root, 14, 190, 0x3a3a40, x, 0, 0.009);
  // Terminal
  const term = box(180, 16, 26, 0xe8f0ff, 0, 8, 50, { roughness: 0.4 }); root.add(term); col(0, 50, 180, 26);
  root.add(box(182, 1.2, 28, 0xbbbbbb, 0, 16.6, 50));
  for (let x = -85; x <= 85; x += 10) root.add(box(8, 10, 0.2, 0x7fb3d5, x, 7, 36.9, { metalness: 0.8, roughness: 0.1 }));
  const ts = sign('VICE BAY INTERNATIONAL', '#003f87', '#fff', 60, 5); ts.position.set(0, 13, 36.7); root.add(ts);
  // Jet bridges + parked jets
  const liv = [0xff2d6f, 0x19c3ff, 0x2ee59d, 0xffd23f];
  [-60, -20, 20, 60].forEach((x, i) => {
    root.add(box(3, 3, 14, 0xcccccc, x, 5, 30));
    const j = makeJet(liv[i]); j.position.set(x, 0, 6); j.rotation.y = Math.PI; root.add(j); col(x, 6, 30, 6); col(x, 6, 5, 34);
  });
  const taxiJet = makeJet(0x8a5cff); taxiJet.position.set(-150, 0, -60); taxiJet.rotation.y = -Math.PI / 2; root.add(taxiJet); out.vehicles.push(taxiJet);
  // Control tower
  root.add(box(6, 40, 6, 0xdddddd, 120, 20, 40)); root.add(box(12, 6, 12, 0x223344, 120, 43, 40, { metalness: 0.8, roughness: 0.1 })); root.add(box(13, 1, 13, 0xffffff, 120, 46.5, 40)); col(120, 40, 6, 6);
  // Hangars + helipad
  [[-200, 40], [-200, -10]].forEach(([x, z]) => { root.add(box(36, 14, 30, 0xb0b8c0, x, 7, z)); root.add(box(26, 11, 0.2, 0x555b66, x + 18.1, 5.5, z).rotateY(Math.PI / 2)); col(x, z, 36, 30); });
  ground(root, 20, 20, 0x555555, 200, -10, 0.011); const H = sign('H', '#555555', '#ffd23f', 12, 12); H.rotation.x = -Math.PI / 2; H.position.set(200, 0.02, -10); root.add(H);
  const heli = makeHelicopter(0xff7a1a); heli.position.set(200, 0, -10); root.add(heli); out.vehicles.push(heli);
  // Parking lot + access road (to the east, where I-10 arrives)
  ground(root, 120, 60, 0x3a3a40, 0, 110 + 60, 0.009);
  for (let i = 0; i < 12; i++) { const c = makeCar(); c.position.set(-50 + i * 9, 0, 165 + (i % 2) * 12); root.add(c); if (i % 3 === 0) out.vehicles.push(c); }
  for (let x = 140; x <= 260; x += 20) { const r = makeRoad(20, true); r.position.set(x, 0.01, 170); root.add(r); }
  const bus = makeBus(0x003f87); bus.position.set(30, 0, 70); bus.rotation.y = Math.PI / 2; root.add(bus); out.vehicles.push(bus);
  for (let i = 0; i < 20; i++) out.spawns.pedestrians.push(P(-80 + i * 8, 70));
  out.pois = { terminal: P(0, 68), runway: P(-200, -110), hangar: P(-180, 40), helipad: P(200, -10), tower: P(120, 50), entrance: P(260, 170) };
  out.streets = [{ name: 'Airport Blvd', minX: ox + 130, maxX: ox + 270, minZ: oz + 160, maxZ: oz + 180 }, { name: 'Runway 09L', minX: ox - 230, maxX: ox + 230, minZ: oz - 125, maxZ: oz - 95 }, { name: 'Runway 09R', minX: ox - 230, maxX: ox + 230, minZ: oz + 95, maxZ: oz + 125 }];
  return finish(out, ox, oz);
}

function house(color, roof) {
  const g = new THREE.Group();
  g.add(box(10, 5, 8, color, 0, 2.5, 0));
  const r = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3.5, 4), mat(roof)); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.8); r.position.y = 6.75; r.castShadow = true; g.add(r);
  g.add(box(1.6, 3, 0.1, 0x6b4226, 0, 1.5, -4.05)); g.add(box(2, 1.4, 0.1, 0x9ec9e2, -3, 3, -4.05)); g.add(box(2, 1.4, 0.1, 0x9ec9e2, 3, 3, -4.05));
  return g;
}

export function buildSmallTown(scene, { x: ox = -150, z: oz = 1900, addCol = () => {} } = {}) {
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const col = (x, z, w, d) => addCol(ox + x, oz + z, w, d), P = (x, z) => new THREE.Vector3(ox + x, 0, oz + z);
  const out = { root, vehicles: [], spawns: { pedestrians: [], traffic: [] }, pois: {}, streets: [] };
  ground(root, 320, 320, 0x8fc77a);
  // Main Street (N-S) + Orange Grove Rd (E-W)
  for (let z = -140; z <= 140; z += 20) { const r = makeRoad(20, false); r.position.set(0, 0.01, z); root.add(r); out.spawns.traffic.push({ pos: P(-3, z), dir: new THREE.Vector3(0, 0, 1) }); }
  for (let x = -140; x <= 140; x += 20) { if (x === 0) continue; const r = makeRoad(20, true); r.position.set(x, 0.011, 0); root.add(r); }
  // Main street shops
  const shops = [['DOTTIE\'S DINER', 0xff5e7e, '#ff5e7e', -24, -30, 'diner'], ['PALMETTO GENERAL', 0xffd6a5, '#a4161a', -24, -60, 'store'], ['SUNSET MOTEL', 0x9bf6ff, '#8a5cff', 26, -45, 'motel'], ['BAIT & TACKLE', 0xcaffbf, '#264653', -24, 30, 'bait'], ['SHERIFF', 0xbde0fe, '#1d3557', 26, 30, 'sheriff']];
  for (const [name, c, sc, x, z, key] of shops) {
    const w = key === 'motel' ? 22 : 16, b = makeBuilding(w, key === 'motel' ? 7 : 6, 14, c); b.position.set(x, 0, z); root.add(b); col(x, z, w, 14);
    const s = sign(name, sc, '#fff', 12, 2.2); s.position.set(x + (x < 0 ? 8.1 : -11.1 * (w / 22)), 5, z); s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; root.add(s);
    out.pois[key] = P(x + (x < 0 ? 12 : -14), z);
  }
  // Gas station
  root.add(box(16, 0.5, 10, 0xffffff, 30, 5, 70)); for (const [x, z] of [[23, 66], [37, 66], [23, 74], [37, 74]]) root.add(box(0.4, 5, 0.4, 0xdddddd, x, 2.5, z));
  for (const z of [67, 73]) { root.add(box(1, 1.8, 0.8, 0xd62828, 30, 0.9, z)); col(30, z, 1, 0.8); }
  const gs = sign('GAS', '#2a9d8f', '#fff', 4, 1.2); gs.position.set(21.8, 5, 70); gs.rotation.y = -Math.PI / 2; root.add(gs); out.pois.gasStation = P(18, 70);
  // Church + water tower
  root.add(box(14, 9, 22, 0xffffff, -70, 4.5, -60)); const st = new THREE.Mesh(new THREE.ConeGeometry(3, 10, 4), mat(0x5c3a1e)); st.position.set(-70, 17, -68); root.add(st); root.add(box(5, 8, 5, 0xffffff, -70, 8, -68)); col(-70, -60, 14, 22);
  root.add(box(0.6, 18, 0.6, 0x888888, 70, 9, -90)); root.add(box(0.6, 18, 0.6, 0x888888, 76, 9, -90)); const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 14), mat(0xa8dadc)); tank.position.set(73, 21, -90); root.add(tank);
  const tw = sign('PALMETTO SPRINGS', '#a8dadc', '#1d3557', 11, 1.6); tw.position.set(73, 21, -96.05); root.add(tw);
  // Houses along Orange Grove Rd
  const hc = [0xffc8dd, 0xfff1c1, 0xcaffbf, 0xbde0fe, 0xffd6a5, 0xe4c1f9];
  for (let i = 0; i < 10; i++) {
    const x = -130 + (i % 5) * 22 + (i % 5 >= 3 ? 150 : 0), z = i < 5 ? -20 : 20; if (Math.abs(x) < 20) continue;
    const h = house(hc[i % hc.length], i % 2 ? 0x8d3b2a : 0x5c5c66); h.position.set(x, 0, z); if (z > 0) h.rotation.y = Math.PI; root.add(h); col(x, z, 10, 8);
    const t = makePalm(); t.position.set(x + 7, 0, z * 1.4); root.add(t);
  }
  // Orange grove
  for (let i = 0; i < 40; i++) { const x = 60 + (i % 8) * 9, z = 40 + Math.floor(i / 8) * 9; const t = new THREE.Mesh(new THREE.SphereGeometry(2.4, 7, 5), mat(0x2d6a4f)); t.position.set(x, 3, z); t.castShadow = true; root.add(t); root.add(box(0.5, 2, 0.5, 0x6b4226, x, 1, z)); for (let k = 0; k < 3; k++) root.add(box(0.4, 0.4, 0.4, 0xff9f1c, x + Math.cos(k * 2) * 2.1, 3 + Math.sin(k) * 0.8, z + Math.sin(k * 2) * 2.1)); }
  // Welcome sign + lamps + parked vehicles
  root.add(box(14, 4, 0.5, 0x6b4226, 14, 2.5, -150)); const wl = sign('WELCOME TO PALMETTO SPRINGS', '#2d6a4f', '#fff', 13, 3); wl.position.set(14, 2.7, -150.3); root.add(wl);
  for (let z = -130; z <= 130; z += 26) { const l = makeStreetLight(); l.position.set(11, 0, z); l.rotation.y = Math.PI; root.add(l); }
  const parked = [[makeTruck(0x2d6a4f, 0xff9f1c), -15, 70, 0], [makeMotorcycle(0x111111), -12, -30, 0], [makeSportsCar(0x19c3ff), 14, -45, Math.PI], [makeCar(0xd62828), -14, -60, 0]];
  for (const [v, x, z, ry] of parked) { v.position.set(x, 0, z); v.rotation.y = ry; root.add(v); out.vehicles.push(v); }
  for (let i = 0; i < 16; i++) out.spawns.pedestrians.push(P(-14 + (i % 2) * 28, -80 + i * 10));
  out.streets = [{ name: 'Main Street', minX: ox - 10, maxX: ox + 10, minZ: oz - 150, maxZ: oz + 150 }, { name: 'Orange Grove Rd', minX: ox - 150, maxX: ox + 150, minZ: oz - 10, maxZ: oz + 10 }];
  out.pois.entranceNorth = P(0, -150);
  return finish(out, ox, oz);
}
