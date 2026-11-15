// Mika: a two-level highway interchange. An elevated cross highway (SR-836) flies over a ground interstate,
// and four curving flyover ramps link the two, one per quadrant. Ground roads continue from both ends.
// Usage:
//   const ic = buildInterchange(scene, { x: -150, z: 1450, addCol });     // centre = where it crosses I-95 (runs N-S)
//   ic.heightAt(x, z, y)  -> road surface height under (x,z) for something currently at height y (0 if none)
//   ic.clampToDeck(v)     -> keeps {x,z,y} inside the parapets while up on the bridge or a ramp
//   ic.inZone(x, z)       -> true anywhere on the interchange roads (for allowedAt / traffic / GPS)
//   ic.roadName(x, z)     -> 'SR-836 Flyover' / 'I-95 / SR-836 Ramp' / null
//   ic.paths              -> [{ points:[[x,z]...], width }] for the minimap
//   ic.lanes              -> [{ points:[Vector3 with y], dir }] lane centre lines for AI traffic (follow in order, use point.y)
import * as THREE from 'three';
import { mat, makePalm } from './models.js';
import { makeShield } from './interstates.js';

const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
let texCache = {};
function roadTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#3a3a40'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 2500; i++) { const v = 40 + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  g.fillStyle = '#eee'; g.fillRect(6, 0, 4, 128); g.fillRect(246, 0, 4, 128);
  if (kind === 'main') { g.fillStyle = '#f5d142'; g.fillRect(122, 0, 3, 128); g.fillRect(131, 0, 3, 128); g.fillStyle = '#eee'; g.fillRect(66, 0, 3, 56); g.fillRect(188, 0, 3, 56); }
  else { g.fillStyle = '#eee'; g.fillRect(127, 0, 3, 56); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[kind] = t);
}
function box(w, h, d, color, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
function greenSign(lines, w, h) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 170; const x = c.getContext('2d');
  x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, 512, 170); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 154);
  x.fillStyle = '#fff'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; lines.forEach((t, i) => x.fillText(t, 256, 70 + i * 56));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })));
  const back = box(w + 0.1, h + 0.1, 0.05, 0x555555, 0, 0, -0.04); g.add(back); return g;
}

// sample a 3D path into evenly spaced points with tangent/right vectors
function samplePath(fn, len, step = 3) {
  const n = Math.max(2, Math.ceil(len / step)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(fn(i / n));
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    return { p, dir: d, right: new THREE.Vector3(-d.z, 0, d.x) };
  });
}
function pathLen(fn) { let L = 0, prev = fn(0); for (let i = 1; i <= 200; i++) { const q = fn(i / 200); L += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; } return L; }


// shared core: collision surfaces + meshes + AI lanes for a list of 3D road ribbons
function roadSystem(root, ribbons, addCol, opt = {}) {
  const { pillarGap = 26, avoid = null } = opt;
  // spatial grid of segments so long roads stay cheap to query every frame
  const G = 48, key = (i, j) => i * 100003 + j;
  for (const r of ribbons) { r.grid = new Map(); const m = r.width / 2 + 8;
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i].p, b = r.pts[i + 1].p;
      for (let gx = Math.floor((Math.min(a.x, b.x) - m) / G); gx <= Math.floor((Math.max(a.x, b.x) + m) / G); gx++)
        for (let gz = Math.floor((Math.min(a.z, b.z) - m) / G); gz <= Math.floor((Math.max(a.z, b.z) + m) / G); gz++) { const k = key(gx, gz); let c = r.grid.get(k); if (!c) r.grid.set(k, c = []); c.push(i); } } }
  for (const r of ribbons) { r.min = new THREE.Vector2(Infinity, Infinity); r.max = new THREE.Vector2(-Infinity, -Infinity); for (const s of r.pts) { r.min.x = Math.min(r.min.x, s.p.x); r.min.y = Math.min(r.min.y, s.p.z); r.max.x = Math.max(r.max.x, s.p.x); r.max.y = Math.max(r.max.y, s.p.z); } }
  // nearest point on a ribbon centreline -> { d (lateral), y, s }
  const near = (r, x, z) => {
    const m = r.width / 2 + 1; if (x < r.min.x - m || x > r.max.x + m || z < r.min.y - m || z > r.max.y + m) return null;
    let best = null; const cell = r.grid.get(key(Math.floor(x / G), Math.floor(z / G))); if (!cell) return null;
    for (const i of cell) {
      const a = r.pts[i].p, b = r.pts[i + 1].p, ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2)), px = a.x + ex * t, pz = a.z + ez * t, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { d, y: a.y + (b.y - a.y) * t, cx: px, cz: pz };
    }
    return best;
  };
  const surfaces = (x, z, pad = 0) => { const out = []; for (const r of ribbons) { const n = near(r, x, z); if (n && n.d <= r.width / 2 + pad) out.push({ r, ...n }); } return out; };
  const heightAt = (x, z, y = 0) => { let h = 0; for (const s of surfaces(x, z, 0.3)) if (s.y <= y + 1.6 && s.y > h) h = s.y; return h; };
  const inZone = (x, z) => surfaces(x, z, 2).length > 0;
  const roadName = (x, z) => { const s = surfaces(x, z); return s.length ? s.sort((a, b) => b.y - a.y)[0].r.name : null; };
  const clampToDeck = v => {
    if ((v.y || 0) < 0.5) return v;
    if (surfaces(v.x, v.z, -0.9).some(s => Math.abs(s.y - v.y) < 1.6)) return v;   // still safely inside some deck
    let best = null; for (const r of ribbons) { const n = near(r, v.x, v.z); if (n && Math.abs(n.y - v.y) < 2 && (!best || n.d - r.width / 2 < best.d - best.r.width / 2)) best = { ...n, r }; }
    if (best) { const lim = best.r.width / 2 - 0.9, k = lim / Math.max(best.d, 1e-3); v.x = best.cx + (v.x - best.cx) * k; v.z = best.cz + (v.z - best.cz) * k; }
    return v;
  };

  // ---------- meshes ----------
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.9 });
  for (const r of ribbons) {
    const pos = [], uv = [], idx = [], under = [], wall = [], wallIdx = [], underIdx = [];
    let v = 0;
    r.pts.forEach((s, i) => {
      if (i) v += s.p.distanceTo(r.pts[i - 1].p) / 20;
      const lift = 0.03 + (r.kind === 'ramp' ? 0.02 : 0);
      for (const side of [-1, 1]) { const q = s.p.clone().addScaledVector(s.right, side * r.width / 2); pos.push(q.x, q.y + lift, q.z); uv.push(side < 0 ? 0 : 1, v); under.push(q.x, q.y - 0.9, q.z); }
      if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); underIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const tex = roadTex(r.kind); const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); road.receiveShadow = true; road.userData.road = true; root.add(road);
    if (r.pts.some(s => s.p.y > 0.5)) {   // bridge underside
      const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(under, 3)); ug.setIndex(underIdx); ug.computeVertexNormals();
      const um = new THREE.Mesh(ug, deckMat); um.castShadow = true; root.add(um);
    }
    // parapet walls on elevated parts, with gaps where another road joins at the same height
    for (const side of [-1, 1]) {
      let run = [];
      const flush = () => { if (run.length > 1) { const base = wall.length / 3; run.forEach(q => { wall.push(q.x, q.y - 0.9, q.z, q.x, q.y + 1.0, q.z); }); for (let k = 0; k < run.length - 1; k++) { const b = base + k * 2; wallIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } } run = []; };
      for (const s of r.pts) {
        const q = s.p.clone().addScaledVector(s.right, side * (r.width / 2 - 0.15));
        const joined = surfaces(q.x + s.right.x * side * 0.8, q.z + s.right.z * side * 0.8).some(o => o.r !== r && Math.abs(o.y - s.p.y) < 1.2);
        if (s.p.y > 0.4 && !joined) run.push(q); else flush();
      }
      flush();
    }
    if (wall.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3)); wg.setIndex(wallIdx); wg.computeVertexNormals(); const wm = new THREE.Mesh(wg, wallMat); wm.material.side = THREE.DoubleSide; wm.castShadow = true; root.add(wm); }
    // pillars
    let acc = 0;
    r.pts.forEach((s, i) => {
      if (i) acc += s.p.distanceTo(r.pts[i - 1].p);
      if (acc < pillarGap || s.p.y < 3) return; acc = 0;
      if (avoid && avoid(s.p.x, s.p.z)) return;   // keep pillars off roads we don't own (interstates below)
      const onOther = surfaces(s.p.x, s.p.z, 1).some(o => o.r !== r && o.y < s.p.y - 2);
      if (onOther) return;   // don't plant a pillar in the middle of a road underneath
      const h = s.p.y - 0.9;
      if (r.kind === 'main') { for (const sd of [-1, 1]) { const q = s.p.clone().addScaledVector(s.right, sd * 6); root.add(box(1.6, h, 1.6, 0xbdb8ae, q.x, h / 2, q.z)); addCol(q.x, q.z, 1.8, 1.8, h - 0.3); } const cap = box(r.width - 2, 0.9, 2, 0xbdb8ae, s.p.x, h - 0.45, s.p.z); cap.rotation.y = Math.atan2(s.dir.x, s.dir.z); root.add(cap); }
      else { root.add(box(1.8, h, 1.8, 0xbdb8ae, s.p.x, h / 2, s.p.z)); addCol(s.p.x, s.p.z, 2, 2, h - 0.3); }
    });
  }
  // AI lanes: 2 each way on the mainline (right-hand traffic), 1 each way on ramps
  const lanes = [];
  for (const r of ribbons) {
    const offs = r.kind === 'main' ? [2.6, 7.4] : [2.5];
    for (const o of offs) for (const dir of [1, -1]) { const pts = r.pts.map(s => s.p.clone().addScaledVector(s.right, dir * o)); lanes.push({ points: dir > 0 ? pts : pts.reverse(), dir, road: r.name }); }
  }
  const paths = ribbons.map(r => ({ points: r.pts.map(s => [s.p.x, s.p.z]), width: r.width, name: r.name }));
  return { heightAt, clampToDeck, inZone, roadName, lanes, paths, surfaces };
}

export function buildInterchange(scene, { x: CX = -150, z: CZ = 1450, H = 10, addCol = () => {}, west = [[-650, 1450], [-700, 880]], eastEnd = 300, name = 'SR-836', hwy = 95, northTo = 'Port Coral', southTo = 'Sunrise City', exit = 12, us = false } = {}) {
  const HL = us ? `US-${hwy}` : `I-${hwy}`;
  const root = new THREE.Group(); scene.add(root);
  const ribbons = [];
  const MW = 24, RW = 10, FLAT = 160, RISE = 170;     // mainline width, ramp width, half flat length, ramp-up length
  // main flyover along x at z = CZ
  const x0 = CX - FLAT - RISE - 60, x1 = CX + FLAT + RISE + 40;
  const mainY = x => { const d = Math.abs(x - CX); return H * smooth(1 - (d - FLAT) / RISE); };
  ribbons.push({ name: `${name} Flyover`, kind: 'main', width: MW, pts: samplePath(t => { const x = x0 + (x1 - x0) * t; return new THREE.Vector3(x, mainY(x), CZ); }, x1 - x0) });
  // four flyover connector ramps (quadratic bezier, ground at I-95 shoulder -> deck edge)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const S = new THREE.Vector3(CX + sx * 21, 0, CZ + sz * 210), Q = new THREE.Vector3(CX + sx * 21, 0, CZ + sz * 17), E = new THREE.Vector3(CX + sx * 135, 0, CZ + sz * 17);
    const fn = t => { const u = 1 - t, p = S.clone().multiplyScalar(u * u).addScaledVector(Q, 2 * u * t).addScaledVector(E, t * t); p.y = H * smooth(t * 1.15); return p; };
    ribbons.push({ name: `${HL} / ${name} Ramp`, kind: 'ramp', width: RW, pts: samplePath(fn, pathLen(fn)) });
  }
  // ground continuations (west to the I-295 / I-4 junction, short east spur to an overlook)
  const wpts = [[x0, CZ], ...west];
  for (let i = 0; i < wpts.length - 1; i++) {
    const [ax, az] = wpts[i], [bx, bz] = wpts[i + 1];
    ribbons.push({ name, kind: 'main', width: MW, pts: samplePath(t => new THREE.Vector3(ax + (bx - ax) * t, 0, az + (bz - az) * t), Math.hypot(bx - ax, bz - az)) });
  }
  if (eastEnd > x1) ribbons.push({ name, kind: 'main', width: MW, pts: samplePath(t => new THREE.Vector3(x1 + (eastEnd - x1) * t, 0, CZ), eastEnd - x1) });

  const sys = roadSystem(root, ribbons, addCol); const { heightAt, clampToDeck, inZone, roadName, lanes, paths } = sys;
  // street lights on the flyover
  for (let x = CX - FLAT; x <= CX + FLAT; x += 40) {
    const y = mainY(x);
    for (const sd of [-1, 1]) { root.add(box(0.2, 7, 0.2, 0x666666, x, y + 3.5, CZ + sd * (MW / 2 - 0.4))); const l = box(1.6, 0.18, 0.4, 0xffffcc, x, y + 7, CZ + sd * (MW / 2 - 1.2)); l.material = l.material.clone(); l.material.emissive = new THREE.Color(0xffe08a); l.material.emissiveIntensity = 1.2; root.add(l); }
  }
  // overhead signs: on the flyover approaching I-95, and on I-95 approaching the ramps
  const gantry = (gx, gz, gy, rotY, span, a, b) => {
    const g = new THREE.Group(); g.position.set(gx, gy, gz); g.rotation.y = rotY; root.add(g);
    for (const sd of [-1, 1]) g.add(box(0.4, 8, 0.4, 0x666666, sd * (span / 2 + 0.3), 4, 0));
    g.add(box(span + 1, 0.5, 0.5, 0x666666, 0, 7.8, 0));
    const s1 = greenSign(a, 9, 2.8); s1.position.set(-span / 4, 6.1, 0.3); g.add(s1);
    const s2 = greenSign(b, 9, 2.8); s2.position.set(span / 4, 6.1, 0.3); g.add(s2);
  };
  gantry(CX - FLAT + 20, CZ, H, -Math.PI / 2, MW, [`${HL} NORTH`, northTo], [`${HL} SOUTH`, southTo]);
  gantry(CX + FLAT - 20, CZ, H, Math.PI / 2, MW, [`${HL} SOUTH`, southTo], [`${HL} NORTH`, northTo]);
  gantry(CX, CZ - 300, 0, 0, 32, [`EXIT ${exit}`, `${name} WEST`], [`EXIT ${exit}`, `${name} EAST`]);
  gantry(CX, CZ + 300, 0, Math.PI, 32, [`EXIT ${exit}`, `${name} EAST`], [`EXIT ${exit}`, `${name} WEST`]);
  { const sh = makeShield(hwy, 3); sh.position.set(CX + 1, H + 2.6, CZ - MW / 2 - 1.6); sh.rotation.y = Math.PI; root.add(sh); const sh2 = makeShield(hwy, 3); sh2.position.set(CX - 1, H + 2.6, CZ + MW / 2 + 1.6); root.add(sh2); }
  // landscaping in the four quadrants
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshStandardMaterial({ color: 0x5f9e47 })); g.rotation.x = -Math.PI / 2; g.position.set(CX + sx * 85, 0.012, CZ + sz * 85); g.receiveShadow = true; root.add(g);
    for (let k = 0; k < 5; k++) { const p = makePalm(); p.position.set(CX + sx * (60 + k * 9), 0, CZ + sz * (110 - k * 9)); if (!inZone(p.position.x, p.position.z)) root.add(p); }
  }
  return { root, heightAt, clampToDeck, inZone, roadName, paths, lanes, deckY: H, center: { x: CX, z: CZ } };
}

// Elevated expressway along a 2D polyline: ramps up from the ground at both ends, flat at height H in between.
//   const ex = buildExpressway(scene, { name: 'Bayshore Expressway', points: [[x,z],...], H: 9, addCol });
//   same API as buildInterchange: heightAt, clampToDeck, inZone, roadName, paths, lanes
export function buildExpressway(scene, { name = 'Bayshore Expressway', points, H = 9, rampLen = 150, width = 18, addCol = () => {}, lights = true, shield = 'EXPWY', pillarGap = 26, lightGap = 45, avoid = null, dirs = ['NORTH', 'SOUTH'] } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.3);
  const L = curve.getLength();
  const fn = t => { const p = curve.getPointAt(t), d = t * L; p.y = H * smooth(Math.min(d, L - d) / rampLen); return p; };
  const ribbons = [{ name, kind: 'main', width, pts: samplePath(fn, L) }];
  const sys = roadSystem(root, ribbons, addCol, { pillarGap, avoid });
  const pts = ribbons[0].pts;
  if (lights) { let acc = 0; pts.forEach((s, i) => { if (i) acc += s.p.distanceTo(pts[i - 1].p); if (acc < lightGap || s.p.y < H - 0.2) return; acc = 0;
    for (const sd of [-1, 1]) { const q = s.p.clone().addScaledVector(s.right, sd * (width / 2 - 0.4)); root.add(box(0.2, 7, 0.2, 0x666666, q.x, q.y + 3.5, q.z)); const lq = s.p.clone().addScaledVector(s.right, sd * (width / 2 - 1.3)); const l = box(1.6, 0.18, 0.4, 0xffffcc, lq.x, q.y + 7, lq.z); l.material = l.material.clone(); l.material.emissive = new THREE.Color(0xffe08a); l.material.emissiveIntensity = 1.2; root.add(l); } }); }
  // entrance signs at both ends
  for (const [s, flip] of [[pts[Math.min(8, pts.length - 1)], 0], [pts[Math.max(0, pts.length - 9)], 1]]) {
    const sg = greenSign([name.toUpperCase(), flip ? dirs[1] : dirs[0]], 8, 2.6); const q = s.p.clone().addScaledVector(s.right, width / 2 + 2);
    sg.position.set(q.x, q.y + 3.2, q.z); sg.rotation.y = Math.atan2(s.dir.x, s.dir.z) + (flip ? 0 : Math.PI); root.add(sg); root.add(box(0.2, 3, 0.2, 0x888888, q.x, q.y + 1.5, q.z));
  }
  return { root, ...sys, deckY: H, length: L };
}

// Merge several interchanges/expressways into one object with the same API, so game.js can keep a single `ic`.
export function combineRoads(list) {
  return {
    list, root: list.map(r => r.root),
    heightAt: (x, z, y = 0) => Math.max(0, ...list.map(r => r.heightAt(x, z, y))),
    clampToDeck: v => { for (const r of list) r.clampToDeck(v); return v; },
    inZone: (x, z) => list.some(r => r.inZone(x, z)),
    roadName: (x, z) => { for (const r of list) { const n = r.roadName(x, z); if (n) return n; } return null; },
    paths: list.flatMap(r => r.paths), lanes: list.flatMap(r => r.lanes),
  };
}
