// Mika: second neighborhood, "Port Coral", an original harbor district: container yard, warehouses,
// cranes, docks with boats, a diner, gas station and garage. Self-contained, about 160 x 160 units.
// Usage: const port = buildPortCoral(scene, { x: 300, z: 0, addCol, roadSize: 20 });
//   port.boats, port.vehicles  -> drivable vehicles to register with your vehicle system
//   port.spawns                -> { pedestrians: [...Vector3], traffic: [...{pos, dir}] }
//   port.pois                  -> named points (garage, gasStation, diner, dock) for missions/shops
//   port.waterRect             -> {minX,maxX,minZ,maxZ} where boats may drive
import * as THREE from 'three';
import { mat, makeBuilding, makeRoad, makeStreetLight, makeCar, makePalm } from './models.js';
import { makeTruck, makeBoat, makeBus, makeMotorcycle, makeSportsCar } from './vehicles.js';

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function container(color) {
  const g = new THREE.Group();
  g.add(box(2.6, 2.6, 6, color, 0, 1.3, 0, { roughness: 0.7 }));
  for (let i = -2; i <= 2; i++) g.add(box(2.65, 2.4, 0.08, new THREE.Color(color).multiplyScalar(0.8).getHex(), 0, 1.3, i * 1.2));
  return g;
}
function crane() {
  const g = new THREE.Group(), y = 0xf6c90e;
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) g.add(box(0.8, 22, 0.8, y, x, 11, z));
  g.add(box(9, 1.2, 9, y, 0, 22, 0));
  g.add(box(1.4, 1.2, 34, y, 0, 23.5, -8));
  g.add(box(3, 2.5, 3, 0xffffff, 0, 21, 4));
  g.add(box(0.1, 10, 0.1, 0x222222, 0, 18, -18)); g.add(box(2.6, 0.4, 6, 0x333333, 0, 13, -18));
  return g;
}
function warehouse(w, d, color) {
  const g = new THREE.Group();
  g.add(box(w, 8, d, color, 0, 4, 0, { roughness: 0.9 }));
  for (const sd of [-1, 1]) { const r = box(w / 2 + 0.6, 0.3, d + 0.6, 0x8a8f98, sd * w / 4, 8.9, 0); r.rotation.z = -sd * 0.28; g.add(r); }
  for (let i = -1; i <= 1; i++) g.add(box(4, 5, 0.1, 0x555b66, i * (w / 3.2), 2.5, -d / 2 - 0.05));
  return g;
}
function sign(text, bg, fg = '#fff', w = 6, h = 1.6) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 64); x.fillStyle = fg; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}

export function buildPortCoral(scene, { x: ox = 300, z: oz = 0, addCol = () => {}, roadSize = 20 } = {}) {
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const P = (x, z) => new THREE.Vector3(ox + x, 0, oz + z);
  const col = (x, z, w, d) => addCol(ox + x, oz + z, w, d);
  const out = { root, vehicles: [], boats: [], spawns: { pedestrians: [], traffic: [] }, pois: {} };

  // Ground: concrete yard (west) + water (east)
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(110, 160), mat(0xb8b4aa)); yard.rotation.x = -Math.PI / 2; yard.position.set(-25, 0.005, 0); yard.receiveShadow = true; root.add(yard);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 160), new THREE.MeshStandardMaterial({ color: 0x1f8ab0, metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(55, -0.4, 0); root.add(water);
  out.water = water; out.waterRect = { minX: ox + 33, maxX: ox + 85, minZ: oz - 80, maxZ: oz + 80 };

  // Roads: main north-south avenue + two cross streets
  for (let z = -70; z <= 70; z += roadSize) { const r = makeRoad(roadSize, false); r.position.set(-10, 0.01, z); root.add(r); out.spawns.traffic.push({ pos: P(-13, z), dir: new THREE.Vector3(0, 0, 1) }, { pos: P(-7, z), dir: new THREE.Vector3(0, 0, -1) }); }
  for (const zz of [-40, 40]) for (let x = -70; x <= 30; x += roadSize) { if (x === -10) continue; const r = makeRoad(roadSize, true); r.position.set(x, 0.011, zz); root.add(r); }

  // Street names: green street-name signs at intersections + rects for HUD lookup
  out.streets = [
    { name: 'Dockside Ave', minX: ox - 20, maxX: ox, minZ: oz - 80, maxZ: oz + 80 },
    { name: 'Cargo Street', minX: ox - 80, maxX: ox + 40, minZ: oz - 50, maxZ: oz - 30 },
    { name: 'Lighthouse Street', minX: ox - 80, maxX: ox + 40, minZ: oz + 30, maxZ: oz + 50 },
  ];
  for (const [zz, cross] of [[-40, 'Cargo Street'], [40, 'Lighthouse Street']]) {
    const post = box(0.15, 4, 0.15, 0x555555, -1.5, 2, zz - 11.5); root.add(post);
    const a = sign('Dockside Ave', '#1b7f3b', '#fff', 3.4, 0.6); a.position.set(-1.5, 3.8, zz - 11.4); root.add(a);
    const a2 = a.clone(); a2.rotation.y = Math.PI; a2.position.z = zz - 11.6; root.add(a2);
    const b = sign(cross, '#1b7f3b', '#fff', 3.4, 0.6); b.position.set(-1.6, 3.2, zz - 11.5); b.rotation.y = Math.PI / 2; root.add(b);
    const b2 = b.clone(); b2.rotation.y = -Math.PI / 2; b2.position.x = -1.4; root.add(b2);
  }
  // Helper: which Port Coral street is the player on? Returns name or null.
  out.streetAt = (x, z) => (out.streets.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || {}).name || null;

  // Container yard
  const cc = [0xd62828, 0x2a9d8f, 0x264653, 0xe76f51, 0x457b9d, 0xf4a261];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
    const stack = 1 + ((r * 7 + k * 3) % 3);
    for (let s = 0; s < stack; s++) { const c = container(cc[(r + k + s) % cc.length]); c.position.set(8 + k * 4, s * 2.6, -60 + r * 9); root.add(c); }
    col(8 + k * 4, -60 + r * 9, 2.6, 6);
  }
  const cr = crane(); cr.position.set(28, 0, -45); root.add(cr); for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) col(28 + x, -45 + z, 1, 1);
  const cr2 = crane(); cr2.position.set(28, 0, 20); root.add(cr2); for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) col(28 + x, 20 + z, 1, 1);

  // Warehouses west of the avenue
  [[-45, -60, 0xc9ada7], [-45, -10, 0x9a8c98], [-45, 60, 0xb5838d]].forEach(([x, z, c]) => { const w = warehouse(26, 30, c); w.position.set(x, 0, z); root.add(w); col(x, z, 26, 30); });

  // Dock + piers with boats
  root.add(box(6, 0.6, 150, 0x8b6b4a, 33, 0.1, 0));
  for (const z of [-20, 0, 50]) {
    root.add(box(16, 0.5, 3, 0x8b6b4a, 43, 0.1, z));
    const b = makeBoat([0xffffff, 0xff2d6f, 0x2ee59d][out.boats.length % 3], [0x19c3ff, 0x111111, 0xffd23f][out.boats.length % 3]);
    b.position.set(44, -0.4, z + 4); b.rotation.y = Math.PI / 2; root.add(b); out.boats.push(b);
  }
  out.pois.dock = P(36, 0);

  // Corner businesses on the south cross street: diner, gas station, garage
  const diner = makeBuilding(14, 5, 10, 0x9bf6ff); diner.position.set(-30, 0, 18); root.add(diner); col(-30, 18, 14, 10);
  const ds = sign('CORAL DINER', '#ff5e7e'); ds.position.set(-30, 6, 12.9); root.add(ds); out.pois.diner = P(-30, 10);

  const canopy = box(14, 0.5, 9, 0xffffff, 10, 5, 18); root.add(canopy);
  for (const [x, z] of [[4, 15], [16, 15], [4, 21], [16, 21]]) { root.add(box(0.4, 5, 0.4, 0xdddddd, x, 2.5, z)); }
  for (const x of [7, 13]) { root.add(box(1, 1.8, 0.8, 0xd62828, x, 0.9, 18)); col(x, 18, 1, 0.8); }
  const gs = sign('FUEL', '#2a9d8f', '#fff', 4, 1); gs.position.set(10, 5, 13.4); root.add(gs); out.pois.gasStation = P(10, 18);

  const garage = makeBuilding(16, 7, 12, 0xffd6a5); garage.position.set(-30, 0, -25); root.add(garage); col(-30, -25, 16, 12);
  root.add(box(6, 4.5, 0.1, 0x444444, -30, 2.25, -18.95));
  const gsn = sign('PORT CORAL CUSTOMS', '#1d3557', '#ffd23f', 9, 1.4); gsn.position.set(-30, 5.7, -18.9); root.add(gsn); out.pois.garage = P(-30, -14);

  // Parked drivable vehicles
  const parked = [[makeTruck(), 12, -25, 0], [makeTruck(0xd62828, 0x264653), 20, -25, 0], [makeBus(), -22, 50, Math.PI / 2],
    [makeMotorcycle(0xff2d6f), -24, 10, 0], [makeSportsCar(0xffd23f), -2, 30, Math.PI], [makeCar(), -36, 8, Math.PI / 2]];
  for (const [v, x, z, ry] of parked) { v.position.set(x, 0, z); v.rotation.y = ry; root.add(v); out.vehicles.push(v); }

  // Street furniture
  for (let z = -70; z <= 70; z += 20) { const l = makeStreetLight(); l.position.set(-1, 0, z); l.rotation.y = Math.PI; root.add(l); }
  for (let z = -60; z <= 70; z += 26) { const p = makePalm(); p.position.set(-21, 0, z + 5); root.add(p); }
  for (let i = 0; i < 24; i++) out.spawns.pedestrians.push(P(-24 + (i % 4) * 2, -70 + i * 6));

  // World-space positions for vehicles (they live inside root)
  root.updateMatrixWorld(true);
  return out;
}
