// Mika: Mount Kestrel, an original mountain region: a 300 m peak with a two-lane road
// that spirals 2.6 times around it up to a summit lookout, pine forest on the slopes, snow on top.
// Built by buildStuntJumps for any spot with { mountain: true }, so it rides on the stunts hookup:
//   stunts.heightAt(x, z) returns the slope/road height (cars and the player climb it via surfaceY),
//   stunts.carY pays a one-time "SUMMIT" bonus the first time the player drives onto the top.
import * as THREE from 'three';
import { mat } from './models.js';

export function buildMountain(root, { x: CX, z: CZ, name = 'Mount Kestrel', R = 1000, H = 300, R0 = 930, rEnd = 75, turns = 2.6, a0 = 0 } = {}) {
  const RW = 12, PHI = turns * Math.PI * 2, TAU = Math.PI * 2;
  const prof = d => d >= R ? 0 : H * Math.pow((1 + Math.cos(Math.PI * d / R)) / 2, 1.15);
  const rAt = f => R0 - (R0 - rEnd) * f / PHI;
  const roadH = f => prof(rAt(f));
  const topH = roadH(PHI);
  const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const terrain = (d, th) => { const base = prof(d); const k = Math.sin(Math.PI * Math.min(1, d / R)); return base * (1 + 0.07 * k * Math.sin(5 * th + d * 0.012) + 0.04 * k * Math.sin(11 * th - d * 0.02)); };
  const heightAt = (x, z) => {
    const dx = x - CX, dz = z - CZ; if (Math.abs(dx) > R || Math.abs(dz) > R) return 0;
    const d = Math.hypot(dx, dz); if (d >= R) return 0;
    if (d < rEnd + 14) return topH;                                    // flat summit lookout
    const th = Math.atan2(dz, dx); let h = terrain(d, th);
    if (d > rEnd + 14 && d < rEnd + 40) h = THREE.MathUtils.lerp(topH, h, ss((d - rEnd - 14) / 26));
    const base = (((th - a0) % TAU) + TAU) % TAU;
    for (let n = 0; n <= Math.ceil(turns); n++) {
      const f = base + TAU * n; if (f > PHI + 0.02) break;
      const off = Math.abs(d - rAt(Math.min(f, PHI))); if (off > RW / 2 + 34) continue;
      return THREE.MathUtils.lerp(roadH(Math.min(f, PHI)), h, ss((off - RW / 2 - 3) / 31));
    }
    // lead-in road from the foot of the spiral straight out to the plain
    const ex = CX + Math.cos(a0) * R0, ez = CZ + Math.sin(a0) * R0;
    return h;
  };
  const g = new THREE.Group(); g.name = 'mountain'; root.add(g);
  // terrain mesh
  const N = 250, geo = new THREE.PlaneGeometry(2 * R + 40, 2 * R + 40, N, N); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  const grass = new THREE.Color(0x5f9a45), forest = new THREE.Color(0x3f6e34), rock = new THREE.Color(0x8a7b68), snow = new THREE.Color(0xf4f6fa);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) + CX, z = P.getZ(i) + CZ, d = Math.hypot(x - CX, z - CZ);
    let y = heightAt(x, z); if (d >= R - 4) y = -0.6; else y -= 0.25;
    P.setY(i, y); const t = y / H;
    if (t < 0.25) c.copy(grass).lerp(forest, t / 0.25); else if (t < 0.6) c.copy(forest).lerp(rock, (t - 0.25) / 0.35); else if (t < 0.82) c.copy(rock); else c.copy(rock).lerp(snow, Math.min(1, (t - 0.82) / 0.06));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const tm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); tm.position.set(CX, 0, CZ); tm.receiveShadow = true; g.add(tm);
  // road ribbon with a yellow centre line
  const rc = document.createElement('canvas'); rc.width = 64; rc.height = 128; const x2 = rc.getContext('2d');
  x2.fillStyle = '#3a3a3e'; x2.fillRect(0, 0, 64, 128); x2.fillStyle = '#f0f0f0'; x2.fillRect(2, 0, 3, 128); x2.fillRect(59, 0, 3, 128); x2.fillStyle = '#f2c01e'; x2.fillRect(30, 0, 4, 80);
  const rt = new THREE.CanvasTexture(rc); rt.wrapT = THREE.RepeatWrapping; rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 4;
  const pos = [], uv = [], idx = [], posts = [];
  const pt = (f, side) => { const r = rAt(f) + side * RW / 2, a = a0 + f; return [CX + Math.cos(a) * r, roadH(f) + 0.12, CZ + Math.sin(a) * r]; };
  let v = 0, along = 0, prev = null;
  for (let f = 0; f <= PHI + 1e-6; f += 4 / rAt(f)) {
    const L = pt(f, -1), Rr = pt(f, 1); const mid = [(L[0] + Rr[0]) / 2, (L[2] + Rr[2]) / 2];
    if (prev) along += Math.hypot(mid[0] - prev[0], mid[1] - prev[1]); prev = mid;
    pos.push(...L, ...Rr); uv.push(0, along / 16, 1, along / 16);
    if (v) idx.push(v - 2, v, v - 1, v - 1, v, v + 1); v += 2;
    if (Math.floor(along / 24) !== Math.floor((along - 4) / 24)) posts.push(pt(f, 1.25));
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
  const road = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ map: rt, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); road.receiveShadow = true; g.add(road);
  // white guard posts on the outside edge
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 1, 0.25), mat(0xf2f2f2), posts.length), M4 = new THREE.Matrix4();
  posts.forEach((p, i) => pm.setMatrixAt(i, M4.makeTranslation(p[0], p[1] + 0.4, p[2]))); g.add(pm);
  // pine forest on the lower slopes, kept off the road
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(91);
  const trees = []; for (let k = 0; k < 4000 && trees.length < 900; k++) {
    const d = 120 + rnd() * (R - 140), th = rnd() * TAU, x = CX + Math.cos(th) * d, z = CZ + Math.sin(th) * d, y = heightAt(x, z);
    if (y > H * 0.62) continue; const base = (((th - a0) % TAU) + TAU) % TAU; let ok = true;
    for (let n = 0; n <= 3 && ok; n++) { const f = base + TAU * n; if (f <= PHI && Math.abs(d - rAt(f)) < RW / 2 + 9) ok = false; }
    if (ok) trees.push([x, y, z, 0.7 + rnd() * 0.7]);
  }
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 11, 7), mat(0x2d5a2e), trees.length), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 5), mat(0x5b4030), trees.length);
  const S = new THREE.Vector3(), Q = new THREE.Quaternion(), T = new THREE.Vector3();
  trees.forEach(([x, y, z, s], i) => { S.set(s, s, s); cone.setMatrixAt(i, M4.compose(T.set(x, y + 1.5 * s + 5.5 * s, z), Q, S)); trunk.setMatrixAt(i, M4.compose(T.set(x, y + 1.5 * s - 0.3, z), Q, S)); });
  g.add(cone, trunk);
  // summit lookout: radio mast, flag, name board
  const top = new THREE.Group(); top.position.set(CX, topH, CZ); g.add(top);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 34, 6), mat(0xd94a3a)); mast.position.set(-18, 17, -18); top.add(mast);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); bulb.position.set(-18, 34.5, -18); top.add(bulb);
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 192; const b2 = bc.getContext('2d');
  b2.fillStyle = '#5a3b22'; b2.fillRect(0, 0, 512, 192); b2.strokeStyle = '#e9d7b0'; b2.lineWidth = 8; b2.strokeRect(10, 10, 492, 172);
  b2.fillStyle = '#f3e6c4'; b2.textAlign = 'center'; b2.font = 'bold 64px serif'; b2.fillText(name.toUpperCase(), 256, 92); b2.font = 'bold 40px serif'; b2.fillText(`SUMMIT · ${Math.round(topH)} m`, 256, 152);
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  for (const back of [0, 1]) { const bd = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map: bt })); bd.position.set(14, 4, 14 + (back ? -0.03 : 0.03)); bd.rotation.y = back ? Math.PI : 0; top.add(bd); }
  for (const sx of [-4, 4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), mat(0x4a3220)); p.position.set(14 + sx, 2.5, 14); top.add(p); }
  // foot-of-road sign facing the plain
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 160; const f2 = fc.getContext('2d');
  f2.fillStyle = '#5a3b22'; f2.fillRect(0, 0, 512, 160); f2.fillStyle = '#f3e6c4'; f2.textAlign = 'center'; f2.font = 'bold 56px serif'; f2.fillText(name.toUpperCase(), 256, 72); f2.font = 'bold 36px serif'; f2.fillText('SUMMIT ROAD  ▲', 256, 128);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const fx = CX + Math.cos(a0) * (R0 + 20) - Math.sin(a0) * 14, fz = CZ + Math.sin(a0) * (R0 + 20) + Math.cos(a0) * 14;
  const fs = new THREE.Group(); fs.position.set(fx, heightAt(fx, fz), fz); fs.rotation.y = -a0 + Math.PI / 2; g.add(fs);
  for (const back of [0, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), new THREE.MeshBasicMaterial({ map: ft })); m.position.set(0, 3.2, back ? -0.03 : 0.03); m.rotation.y = back ? Math.PI : 0; fs.add(m); }
  const onSummit = (x, z) => Math.hypot(x - CX, z - CZ) < rEnd + 10;
  return { g, heightAt, onSummit, name, x: CX, z: CZ, topH, foot: { x: CX + Math.cos(a0) * R0, z: CZ + Math.sin(a0) * R0 } };
}
