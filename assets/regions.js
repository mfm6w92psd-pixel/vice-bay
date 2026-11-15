// Mika: two more regions for the 2x map. Each returns { root, vehicles, boats, waterRects, spawns, pois, streets, streetAt, update(dt) }.
//   buildSwamp(scene, { x, z, addCol })    -> "Gator Glades": swamp with water channels, cypress trees, stilt shacks, airboats, gators. Entrance (Glades Rd) at local (0, +200).
//   buildDowntown(scene, { x, z, addCol }) -> "Vice Bay Heights": 4x4 blocks of skyscrapers (60-190 tall), a central plaza, rooftop helipad. 320 x 320, road grid every 80.
import * as THREE from 'three';
import { mat, makeBuilding, makeRoad, makeStreetLight, makeCar, makePalm } from './models.js';
import { makeSportsCar, makeHelicopter, makeBus } from './vehicles.js';

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sign(text, bg, fg = '#fff', w = 8, h = 2) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128); x.fillStyle = fg; x.font = 'bold 56px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })); f.position.z = 0.03; g.add(f);
  const b = f.clone(); b.rotation.y = Math.PI; b.position.z = -0.03; g.add(b); return g;
}
function ground(root, w, d, color, x = 0, z = 0, y = 0) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)); g.rotation.x = -Math.PI / 2; g.position.set(x, y, z); g.receiveShadow = true; root.add(g); return g;
}
function finish(out) {
  out.streetAt = (x, z) => (out.streets.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || {}).name || null;
  out.root.updateMatrixWorld(true); return out;
}

// Airboat: flat hull, raised seat, big caged fan at the back. Faces -Z.
export function makeAirboat(color = 0x2e7d32) {
  const g = new THREE.Group();
  g.add(box(2.6, 0.5, 5.5, color, 0, 0.25, 0), box(2.4, 0.08, 1, 0xdddddd, 0, 0.55, -2.3));
  g.add(box(0.9, 0.9, 0.9, 0x333333, 0, 1.0, 0.8), box(0.8, 0.12, 0.7, 0x8b4513, 0, 1.8, 0.4));
  const cage = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 18), mat(0x999999)); cage.position.set(0, 2.1, 2.4); g.add(cage);
  const fan = new THREE.Group(); fan.position.set(0, 2.1, 2.35);
  for (let i = 0; i < 2; i++) { const b = box(0.2, 2.3, 0.05, 0x222222, 0, 0, 0); b.rotation.z = i * Math.PI / 2; fan.add(b); }
  g.add(fan); g.add(box(0.15, 1.3, 0.15, 0x777777, 0, 1.0, 2.4));
  g.userData = { type: 'airboat', fan, boat: true, wheels: [], lights: { brakeMat: new THREE.MeshStandardMaterial() }, stats: { speed: 1.4, accel: 1.2, grip: 0.5 }, seatY: 2, collider: { w: 2.6, d: 5.5 } };
  return g;
}
function makeGator() {
  const g = new THREE.Group(), c = 0x3d5a2a;
  g.add(box(0.9, 0.35, 3, c, 0, 0.1, 0), box(0.6, 0.3, 1.1, c, 0, 0.1, -1.9), box(0.4, 0.25, 1.6, c, 0, 0.05, 2.2));
  for (const s of [-1, 1]) g.add(box(0.12, 0.12, 0.12, 0xffee55, s * 0.22, 0.32, -1.6, { emissive: 0x554400 }));
  g.userData.type = 'gator'; return g;
}
function cypress(h) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.0, h, 7), mat(0x6b5a45)); t.position.y = h / 2; t.castShadow = true; g.add(t);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(3.2 - i * 0.7, 3, 7), mat(0x4f6b3a)); c.position.y = h - 1 + i * 1.6; c.castShadow = true; g.add(c); }
  for (let i = 0; i < 4; i++) { const m = box(0.3, 2.2, 0.3, 0x9aa38a, Math.cos(i * 1.6) * 2.2, h - 2.4, Math.sin(i * 1.6) * 2.2); g.add(m); } // spanish moss
  return g;
}
function shack(color) {
  const g = new THREE.Group();
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.add(box(0.4, 2.5, 0.4, 0x5a4632, x, 1.25, z));
  g.add(box(8, 0.3, 8, 0x7a6248, 0, 2.6, 0), box(6.5, 3.4, 6, color, 0, 4.45, 0));
  const roof = box(7.5, 0.25, 7.2, 0x6f6f6f, 0, 6.4, 0, { metalness: 0.5 }); roof.rotation.z = 0.12; g.add(roof);
  g.add(box(1.1, 2, 0.1, 0x3b2a1a, 0, 3.75, -3.02)); return g;
}

export function buildSwamp(scene, { x: ox = 250, z: oz = -2000, addCol = () => {} } = {}) {
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const col = (x, z, w, d) => addCol(ox + x, oz + z, w, d), P = (x, z) => new THREE.Vector3(ox + x, 0, oz + z);
  const out = { root, vehicles: [], boats: [], waterRects: [], spawns: { pedestrians: [], traffic: [] }, pois: {}, streets: [], gators: [] };
  ground(root, 440, 420, 0x6e7f4a, 0, 0, -0.06);
  // Water channels (rects so the game can test "in water" easily)
  const water = new THREE.MeshStandardMaterial({ color: 0x3f5a4a, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 });
  for (const [x, z, w, d] of [[-120, -40, 150, 260], [110, -90, 160, 120], [120, 110, 140, 110], [0, -170, 420, 40]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), water); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); root.add(m);
    out.waterRects.push({ minX: ox + x - w / 2, maxX: ox + x + w / 2, minZ: oz + z - d / 2, maxZ: oz + z + d / 2 });
  }
  // Glades Rd: raised causeway N-S through the middle, then Airboat Ln east
  for (let z = -190; z <= 200; z += 20) { const r = makeRoad(20, false); r.position.set(0, 0.6, z); root.add(r); root.add(box(20, 0.6, 20, 0x8a7d63, 0, 0.29, z)); out.spawns.traffic.push({ pos: P(-3, z), dir: new THREE.Vector3(0, 0, -1) }); }
  for (let x = 20; x <= 60; x += 20) { const r = makeRoad(20, true); r.position.set(x, 0.6, 20); root.add(r); root.add(box(20, 0.6, 20, 0x8a7d63, x, 0.29, 20)); }
  out.streets.push({ name: 'Glades Rd', minX: ox - 10, maxX: ox + 10, minZ: oz - 200, maxZ: oz + 210 }, { name: 'Airboat Ln', minX: ox + 10, maxX: ox + 70, minZ: oz + 10, maxZ: oz + 30 });
  for (let z = -180; z <= 190; z += 40) for (const s of [-1, 1]) { const l = makeStreetLight(); l.position.set(s * 11, 0.6, z); l.rotation.y = s > 0 ? Math.PI : 0; root.add(l); }
  // Cypress trees on the land and standing in the water
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * 420, z = (rnd() - 0.5) * 400;
    if (Math.abs(x) < 16 || (x > 0 && x < 90 && Math.abs(z - 20) < 30) || (x > 60 && x < 110 && z > 30 && z < 70)) continue;
    const t = cypress(8 + rnd() * 8); t.position.set(x, 0, z); t.rotation.y = rnd() * 6; root.add(t); col(x, z, 1.6, 1.6);
  }
  // Airboat Tours dock + stilt shacks
  root.add(box(30, 0.4, 10, 0x7a6248, 85, 1.2, 40)); col(85, 40, 30, 10);
  for (let x = 72; x <= 98; x += 6) root.add(box(0.4, 1.4, 0.4, 0x5a4632, x, 0.6, 45));
  const tours = shack(0x2e7d6b); tours.position.set(85, 0, 60); root.add(tours); col(85, 60, 8, 8);
  const ts = sign('GATOR GLADES AIRBOAT TOURS', '#1b5e20', '#ffeb3b', 12, 2.2); ts.position.set(85, 8, 56); root.add(ts);
  [[-60, 120, 0xb08968], [-90, 160, 0x8d6e63], [60, 150, 0x9e9e7e], [-50, -120, 0xa1887f]].forEach(([x, z, c]) => { const s = shack(c); s.position.set(x, 0, z); s.rotation.y = rnd() * 6; root.add(s); col(x, z, 8, 8); });
  // Airboats on the water
  [[85, 52, 0x2e7d32], [78, 52, 0xff6f00], [-120, 0, 0x1565c0]].forEach(([x, z, c], i) => {
    const b = makeAirboat(c); b.position.set(x, 0.05, i < 2 ? z + 6 : z); b.rotation.y = i < 2 ? Math.PI : 0.4; root.add(b); out.boats.push(b); out.vehicles.push(b);
  });
  // Pickup truck at the dock lot
  const car = makeCar(0x6d4c41); car.position.set(40, 0.6, 32); car.rotation.y = Math.PI / 2; root.add(car); out.vehicles.push(car);
  // Gators that slowly swim and turn
  for (let i = 0; i < 8; i++) {
    const wr = out.waterRects[i % 3], g = makeGator();
    g.position.set(wr.minX - ox + 15 + rnd() * (wr.maxX - wr.minX - 30), 0.05, wr.minZ - oz + 15 + rnd() * (wr.maxZ - wr.minZ - 30)); g.rotation.y = rnd() * 6;
    g.userData.rect = wr; root.add(g); out.gators.push(g);
  }
  const ws = sign('WELCOME TO GATOR GLADES', '#33691e', '#fff', 12, 2.6); ws.position.set(-18, 4, 190); root.add(ws, box(0.3, 3, 0.3, 0x5a4632, -24, 1.5, 190), box(0.3, 3, 0.3, 0x5a4632, -12, 1.5, 190));
  for (let i = 0; i < 8; i++) out.spawns.pedestrians.push(P(70 + (i % 4) * 6, 35 + Math.floor(i / 4) * 4));
  Object.assign(out.pois, { entrance: P(0, 200), dock: P(85, 46), tours: P(85, 60), causeway: P(0, 0) });
  let t = 0;
  out.update = (dt) => {
    t += dt;
    for (const b of out.boats) b.userData.fan.rotation.z += dt * 30;
    for (const g of out.gators) {
      g.rotateY(Math.sin(t * 0.3 + g.id) * dt * 0.3); g.translateZ(-dt * 0.8);
      const r = g.userData.rect, wx = g.position.x + ox, wz = g.position.z + oz;
      if (wx < r.minX + 5 || wx > r.maxX - 5 || wz < r.minZ + 5 || wz > r.maxZ - 5) g.rotateY(Math.PI);
    }
  };
  return finish(out);
}

export function buildDowntown(scene, { x: ox = 0, z: oz = 0, addCol = () => {} } = {}) {
  const root = new THREE.Group(); root.position.set(ox, 0, oz); scene.add(root);
  const col = (x, z, w, d) => addCol(ox + x, oz + z, w, d), P = (x, z) => new THREE.Vector3(ox + x, 0, oz + z);
  const out = { root, vehicles: [], boats: [], waterRects: [], spawns: { pedestrians: [], traffic: [] }, pois: {}, streets: [] };
  ground(root, 340, 340, 0xb5b5b0, 0, 0, -0.06);
  const AVES = ['Tower Ave', 'Skyline Ave', 'Biscayne Ave', 'Gold Coast Ave', 'Neon Ave'], STS = ['1st Street', 'Bayview Street', 'Commerce Street', 'Luxe Street', 'Harbor Street'];
  const lines = [-160, -80, 0, 80, 160];
  lines.forEach((x, i) => {
    for (let z = -160; z <= 160; z += 20) { const r = makeRoad(20, false); r.position.set(x, 0.02, z); root.add(r); }
    out.streets.push({ name: AVES[i], minX: ox + x - 10, maxX: ox + x + 10, minZ: oz - 170, maxZ: oz + 170 });
    out.spawns.traffic.push({ pos: P(x - 3, -150), dir: new THREE.Vector3(0, 0, 1) }, { pos: P(x + 3, 150), dir: new THREE.Vector3(0, 0, -1) });
  });
  lines.forEach((z, i) => {
    for (let x = -160; x <= 160; x += 20) { if (lines.includes(x)) continue; const r = makeRoad(20, true); r.position.set(x, 0.03, z); root.add(r); }
    out.streets.push({ name: STS[i], minX: ox - 170, maxX: ox + 170, minZ: oz + z - 10, maxZ: oz + z + 10 });
  });
  const glass = [0x5a7fa8, 0x2f4f6f, 0x6aa9c9, 0x9fb7c9, 0x40566b, 0xc9b38a, 0x8899aa];
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let bi = 0; bi < 4; bi++) for (let bj = 0; bj < 4; bj++) {
    const cx = -120 + bi * 80, cz = -120 + bj * 80;
    if (bi === 1 && bj === 1) { // plaza
      ground(root, 60, 60, 0xd8cfc0, cx, cz, 0.01);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1.2, 20), mat(0xeeeeee)); f.position.set(cx, 0.6, cz); root.add(f); col(cx, cz, 18, 18);
      const wtr = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 0.2, 20), mat(0x4fc3f7, { emissive: 0x0d47a1, emissiveIntensity: 0.3 })); wtr.position.set(cx, 1.15, cz); root.add(wtr);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 6, 8), mat(0xb3e5fc, { transparent: true, opacity: 0.7 })); sp.position.set(cx, 4, cz); root.add(sp);
      for (let k = 0; k < 8; k++) { const p = makePalm(); const a = k / 8 * Math.PI * 2; p.position.set(cx + Math.cos(a) * 22, 0, cz + Math.sin(a) * 22); root.add(p); }
      for (let k = 0; k < 10; k++) out.spawns.pedestrians.push(P(cx - 20 + rnd() * 40, cz - 20 + rnd() * 40));
      out.pois.plaza = P(cx, cz); continue;
    }
    const tall = (bi === 2 && bj === 2);
    for (const [dx, dz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
      const w = 22 + rnd() * 4, d = 22 + rnd() * 4, h = tall && dx > 0 && dz < 0 ? 190 : 60 + rnd() * 110;
      const b = makeBuilding(w, h, d, glass[Math.floor(rnd() * glass.length)]); b.position.set(cx + dx, 0, cz + dz); root.add(b); col(cx + dx, cz + dz, w, d);
      if (rnd() < 0.5) root.add(box(w * 0.6, 8, d * 0.6, 0xcfd8dc, cx + dx, h + 4, cz + dz));
      if (rnd() < 0.4) root.add(box(0.5, 14, 0.5, 0xb0bec5, cx + dx, h + 7, cz + dz), box(0.8, 0.8, 0.8, 0xff1744, cx + dx, h + 14.5, cz + dz, { emissive: 0xff1744, emissiveIntensity: 1 }));
      if (tall && dx > 0 && dz < 0) { // landmark tower with helipad
        root.add(box(w, 1, d, 0x37474f, cx + dx, h + 0.5, cz + dz));
        const H = sign('H', '#37474f', '#ffeb3b', 10, 10); H.rotation.x = -Math.PI / 2; H.position.set(cx + dx, h + 1.1, cz + dz); root.add(H);
        const heli = makeHelicopter(); heli.position.set(cx + dx, h + 1.1, cz + dz); root.add(heli); out.vehicles.push(heli);
        const ts = sign('VICE TOWER', '#000000', '#ff2d6f', 20, 5); ts.position.set(cx + dx, h - 10, cz + dz - d / 2 - 0.3); root.add(ts);
        out.pois.tower = P(cx + dx, cz + dz); out.pois.helipad = new THREE.Vector3(ox + cx + dx, h + 1.1, oz + cz + dz);
      }
    }
  }
  for (const x of lines) for (let z = -150; z <= 150; z += 40) { const l = makeStreetLight(); l.position.set(x + 9, 0, z); l.rotation.y = Math.PI; root.add(l); }
  [[-163, -60, makeSportsCar(0xff2d6f)], [83, 40, makeSportsCar(0x19c3ff)], [-3, 100, makeBus()], [157, -100, makeCar(0xffffff)], [-83, 130, makeCar(0x222222)]].forEach(([x, z, v]) => { v.position.set(x, 0, z); root.add(v); out.vehicles.push(v); });
  const ws = sign('VICE BAY HEIGHTS', '#111', '#19c3ff', 16, 3); ws.position.set(0, 6, 172); root.add(ws, box(0.4, 5, 0.4, 0x333333, -7, 2.5, 172), box(0.4, 5, 0.4, 0x333333, 7, 2.5, 172));
  Object.assign(out.pois, { entranceSouth: P(0, 170), entranceNorth: P(0, -170), entranceWest: P(-170, 0), entranceEast: P(170, 0) });
  out.update = () => {};
  return finish(out);
}
