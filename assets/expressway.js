// New Bot: generic elevated expressway built from a 2D polyline + height profile (ramps up, flat deck, ramps down).
//   const ex = buildExpressway(scene, { name, points, H, W, up, down, addCol, onRoad, signs: [{ at, lines }], toll: { at } })
//   ex.heightAt(x, z, y), ex.onDeck(x, z), ex.clamp(v), ex.nameAt(x, z, y), ex.pts (minimap), ex.tollPt
import * as THREE from 'three';
import { mat } from './models.js';

function filletPath(pts, R, step = 3) {
  const out = [], P = pts.map(([x, z]) => new THREE.Vector2(x, z));
  out.push(P[0].clone());
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1], d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const t0 = b.clone().addScaledVector(d1, -R), t1 = b.clone().addScaledVector(d2, R);
    out.push(t0); for (let k = 1; k < 16; k++) { const t = k / 16; out.push(t0.clone().lerp(b, t).lerp(b.clone().lerp(t1, t), t)); } out.push(t1);
  }
  out.push(P[P.length - 1].clone());
  const S = []; let carry = 0;
  for (let i = 0; i < out.length - 1; i++) { const a = out[i], b = out[i + 1], L = a.distanceTo(b); let d = carry; while (d < L) { S.push(a.clone().lerp(b, d / L)); d += step; } carry = d - L; }
  S.push(out[out.length - 1].clone()); return S;
}
function signMesh(lines, w, h, bg = '#0b6b3a') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 170; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 170); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 154);
  x.fillStyle = '#fff'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; lines.forEach((t, i) => x.fillText(t, 256, 72 + i * 56));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}

export function buildExpressway(scene, { name = 'Expressway', points, H = 10, W = 18, up = 150, down = 150, R = 80, addCol = () => {}, onRoad = () => false, signs = [], toll = null } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const S = filletPath(points, R); let tot = 0; const dist = [0];
  for (let i = 1; i < S.length; i++) { tot += S[i].distanceTo(S[i - 1]); dist.push(tot); }
  const prof = d => { const s = Math.max(0, Math.min(1, d / up, (tot - d) / down)); return H * s * s * (3 - 2 * s); };
  const pts = S.map((p, i) => ({ x: p.x, z: p.y, h: prof(dist[i]), d: dist[i] }));
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; pts[i].ux = (b.x - a.x) / l; pts[i].uz = (b.z - a.z) / l; }
  const at = d => pts[Math.min(pts.length - 1, Math.max(0, Math.round(d / 3)))];
  const N = pts.length - 1, o = new THREE.Object3D(); o.rotation.order = 'YXZ';
  const deck = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4a4c52, roughness: 0.85 }), N);
  const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xd8d4cc), N * 2);
  const white = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }), N * 4);
  const yellow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf5d142, roughness: 0.6 }), N * 2);
  let nr = 0, nw = 0, ny = 0; const pillars = [], lamps = []; let sinceP = 999, sinceL = 0;
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, dh = b.h - a.h, hl = Math.hypot(dx, dz), L = Math.hypot(hl, dh);
    const yaw = Math.atan2(dx, dz), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, mh = (a.h + b.h) / 2, nx = Math.cos(yaw), nz = -Math.sin(yaw);
    o.rotation.set(-Math.atan2(dh, hl), yaw, 0);
    const put = (im, off, y, sw, sh, len) => { o.position.set(mx + nx * off, mh + y, mz + nz * off); o.scale.set(sw, sh, len); o.updateMatrix(); im.setMatrixAt(im === rail ? nr++ : im === white ? nw++ : ny++, o.matrix); };
    o.position.set(mx, mh - 0.38, mz); o.scale.set(W, 0.8, L + 0.3); o.updateMatrix(); deck.setMatrixAt(i, o.matrix);
    for (const sd of [-1, 1]) {
      put(rail, sd * (W / 2 - 0.25), 0.45, 0.4, 0.9, L + 0.3);
      put(white, sd * (W / 2 - 1.2), 0.04, 0.25, 0.05, L + 0.1);
      put(white, sd * (W / 4), 0.04, 0.2, 0.05, (i % 4 < 2) ? L : 0.01); // dashed lane divider
      put(yellow, sd * 0.3, 0.04, 0.2, 0.05, L + 0.1);
    }
    sinceP += hl; sinceL += hl;
    if (sinceP > 24 && mh > 3) { sinceP = 0; for (const sd of [-1, 1]) { const px = mx + nx * sd * (W / 2 - 3), pz = mz + nz * sd * (W / 2 - 3); if (!onRoad(px, pz)) pillars.push([px, pz, mh - 0.8]); } }
    if (sinceL > 45) { sinceL = 0; lamps.push([mx, mz, mh]); }
  }
  deck.castShadow = deck.receiveShadow = true; rail.castShadow = true;
  [deck, rail, white, yellow].forEach(m => { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; root.add(m); });
  if (pillars.length) {
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.3, 1, 10), mat(0xbdb8ae), pillars.length);
    pillars.forEach(([x, z, h], i) => { o.rotation.set(0, 0, 0); o.position.set(x, h / 2, z); o.scale.set(1, h, 1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); addCol(x, z, 2.4, 2.4, h - 0.3); });
    pm.castShadow = true; pm.frustumCulled = false; root.add(pm);
  }
  const poleMat = mat(0x8a8d92), lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
  for (const [x, z, h] of lamps) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), poleMat); p.position.set(x, h + 3.5, z); root.add(p); const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.6), lampMat); l.position.set(x, h + 7, z); root.add(l); }
  const gantry = (d, lines, bg) => {
    const p = at(d), nx = p.uz, nz = -p.ux, yaw = Math.atan2(p.ux, p.uz), g = new THREE.Group();
    for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), poleMat); post.position.set(nx * sd * (W / 2 - 0.3), 3.5, nz * sd * (W / 2 - 0.3)); g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.5), poleMat); beam.rotation.y = yaw + Math.PI / 2; beam.position.y = 7; g.add(beam);
    const s = signMesh(lines, 9, 3, bg); s.rotation.y = yaw; s.position.set(0, 5.6, -0.3 * 0); g.add(s);
    g.position.set(p.x, p.h, p.z); root.add(g);
  };
  for (const s of signs) gantry(s.at < 0 ? tot + s.at : s.at, s.lines);
  let tollPt = null; if (toll) { const p = at(toll.at < 0 ? tot + toll.at : toll.at); tollPt = { x: p.x, z: p.z, h: p.h, cost: toll.cost || 2 }; gantry(p.d, ['TOLL $' + tollPt.cost, 'SunPass Only'], '#6b2f0b'); }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  function nearest(x, z) {
    if (x < minX - W || x > maxX + W || z < minZ - W || z > maxZ + W) return null;
    let bi = 0, bd = 1e18; for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
    return { p: pts[bi], d: Math.sqrt(bd) };
  }
  const heightAt = (x, z, y = 0) => { const q = nearest(x, z); return q && q.d < W / 2 && q.p.h > 0.05 && y + 1.6 >= q.p.h ? q.p.h : 0; };
  const onDeck = (x, z) => { const q = nearest(x, z); return !!q && q.d < W / 2; };
  function clamp(v) {
    const y = v.y || 0; if (y < 0.5) return v; const q = nearest(v.x, v.z); if (!q || q.d > W / 2 + 1.5 || Math.abs(q.p.h - y) > 1.2) return v;
    const p = q.p, lat = (v.x - p.x) * -p.uz + (v.z - p.z) * p.ux, lim = W / 2 - 0.9;
    if (Math.abs(lat) > lim) { const fix = lat - Math.sign(lat) * lim; v.x -= -p.uz * fix; v.z -= p.ux * fix; if (v.speed) v.speed *= 0.97; }
    return v;
  }
  const nameAt = (x, z) => onDeck(x, z) ? name : null;
  return { root, heightAt, onDeck, clamp, nameAt, pts, width: W, tollPt, name };
}
