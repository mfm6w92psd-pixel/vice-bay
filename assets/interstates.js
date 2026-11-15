// Mika: ground-level divided interstates that leave the city for open countryside.
// Each interstate follows a polyline: 2 lanes each way, grass median with guardrails, red/white/blue
// interstate shields, green exit signs, mile markers, roadside billboards, trees and farm fields.
// Usage:
//   const hw = buildInterstate(scene, { number: 95, name: 'Vice Bay', points: [[0,200],[0,700],[300,1000]], addCol });
//   hw.onRoad(x, z)          -> true if on the carriageway (for speed limits, traffic, GPS)
//   hw.lanes                 -> [{ points:[Vector3...], dir }] lane centre polylines for AI traffic (follow points in order)
//   hw.nearest(x, z)         -> { dist, segIndex, t, point, dir:Vector3 } nearest point on centreline
//   hw.exits                 -> [{ name, pos }] places to join city roads
import * as THREE from 'three';
import { mat, makePalm } from './models.js';

const W = 30, LANE = 3.6, MEDIAN = 6;  // total width, lane width, median width
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function canvasPlane(draw, cw, ch, w, h, side = THREE.DoubleSide) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c.getContext('2d'), cw, ch);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side, transparent: true }));
}
export function makeShield(num, size = 2.4) {
  return canvasPlane((x, w, h) => {
    x.beginPath(); x.moveTo(w * 0.08, h * 0.12); x.quadraticCurveTo(w * 0.5, 0, w * 0.92, h * 0.12);
    x.lineTo(w * 0.92, h * 0.55); x.quadraticCurveTo(w * 0.9, h * 0.9, w * 0.5, h); x.quadraticCurveTo(w * 0.1, h * 0.9, w * 0.08, h * 0.55); x.closePath();
    x.fillStyle = '#fff'; x.fill(); x.save(); x.clip();
    x.fillStyle = '#c8102e'; x.fillRect(0, 0, w, h * 0.3); x.fillStyle = '#003f87'; x.fillRect(0, h * 0.33, w, h);
    x.restore(); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText('INTERSTATE', w / 2, h * 0.24);
    x.font = `bold ${String(num).length > 2 ? 78 : 96}px sans-serif`; x.fillText(String(num), w / 2, h * 0.8);
  }, 256, 256, size, size);
}
function greenSign(lines, w = 9, h = 3, shieldNum) {
  const m = canvasPlane((x, cw, ch) => {
    x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, cw, ch); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(8, 8, cw - 16, ch - 16);
    x.fillStyle = '#fff'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center';
    lines.forEach((t, i) => x.fillText(t, cw / 2 + (shieldNum && i === 0 ? 40 : 0), 70 + i * 56));
    if (shieldNum) { x.fillStyle = '#003f87'; x.fillRect(30, 26, 70, 60); x.fillStyle = '#c8102e'; x.fillRect(30, 26, 70, 16); x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.fillText(String(shieldNum), 65, 80); }
  }, 512, 170, w, h, THREE.FrontSide);
  const g = new THREE.Group(); g.add(m); g.add(box(w + 0.1, h + 0.1, 0.04, 0x555555, 0, 0, -0.03)); return g;
}
const ADS = [['SUNNY\'S TACOS', 'Exit 4 · Open 24h', '#ff7a1a'], ['VICE BAY FM', 'The 80s never ended', '#ff2d6f'], ['GATOR PARK', 'Next exit, 12 km', '#2ee59d'], ['FLAMINGO MOTEL', 'Color TV · Pool', '#f15bb5'], ['MAX DRIVE', 'Insurance? Never heard of it', '#19c3ff']];
function billboard(i) {
  const [a, b, c] = ADS[i % ADS.length], g = new THREE.Group();
  for (const s of [-1, 1]) g.add(box(0.4, 7, 0.4, 0x555555, s * 3.5, 3.5, 0));
  const p = canvasPlane((x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 64px sans-serif'; x.fillText(a, w / 2, 100); x.font = '36px sans-serif'; x.fillText(b, w / 2, 170); }, 512, 220, 10, 4.3, THREE.FrontSide);
  p.position.y = 8; g.add(p);
  const back = p.clone(); back.rotation.y = Math.PI; back.position.z = -0.05; g.add(back);
  g.add(box(10.2, 4.5, 0.04, 0x444444, 0, 8, -0.025)); return g;
}
let roadTex;
function roadTexture() {
  if (roadTex) return roadTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  // across: [shoulder|lane|lane| median |lane|lane|shoulder]  mapped to W
  const px = v => (v / W) * 256, half = W / 2;
  x.fillStyle = '#7fae5a'; x.fillRect(0, 0, 256, 64);
  const carriage = (a, b) => { x.fillStyle = '#38383e'; x.fillRect(px(a), 0, px(b - a), 64); };
  carriage(0, half - MEDIAN / 2); carriage(half + MEDIAN / 2, W);
  x.fillStyle = '#eee'; for (const v of [1.2, half - MEDIAN / 2 - 0.4, half + MEDIAN / 2 + 0.3, W - 1.4]) x.fillRect(px(v), 0, 2, 64);
  x.fillStyle = '#f5d142'; x.fillRect(px(half - MEDIAN / 2 - 0.9), 0, 2, 64); x.fillRect(px(half + MEDIAN / 2 + 0.7), 0, 2, 64);
  x.fillStyle = '#eee'; for (const v of [half - MEDIAN / 2 - 0.65 - LANE, half + MEDIAN / 2 + 0.65 + LANE]) x.fillRect(px(v), 0, 2, 26);
  roadTex = new THREE.CanvasTexture(c); roadTex.wrapT = THREE.RepeatWrapping; roadTex.colorSpace = THREE.SRGBColorSpace; roadTex.anisotropy = 4;
  return roadTex;
}

export function buildInterstate(scene, { number = 95, name = 'Vice Bay', points, addCol = () => {}, scenery = true, startMile = 0 } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const P = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const segs = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], len = a.distanceTo(b), dir = b.clone().sub(a).normalize(), ang = Math.atan2(dir.x, dir.z);
    segs.push({ a, b, len, dir, ang, right: new THREE.Vector3(dir.z, 0, -dir.x) });
    const t = roadTexture().clone(); t.needsUpdate = true; t.repeat.set(1, len / 20);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, len), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = ang + Math.PI; m.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2); m.receiveShadow = true; root.add(m);
  }
  // round joints at bends so the road has no gaps
  for (let i = 1; i < P.length - 1; i++) {
    const j = new THREE.Mesh(new THREE.CircleGeometry(W / 2, 24), mat(0x38383e)); j.rotation.x = -Math.PI / 2; j.position.set(P[i].x, 0.018, P[i].z); j.receiveShadow = true; root.add(j);
  }
  // guardrails, median rails, lamps, mile markers, signs, scenery along each segment
  let mile = startMile, dist = 0, k = 0;
  const at = (s, d, off, y = 0) => s.a.clone().addScaledVector(s.dir, d).addScaledVector(s.right, off).setY(y);
  segs.forEach((s, si) => {
    for (const off of [-W / 2 + 0.3, W / 2 - 0.3, -MEDIAN / 2 + 0.6, MEDIAN / 2 - 0.6]) {
      const p = at(s, s.len / 2, off, 0.55), r = box(0.15, 0.3, s.len - 16, 0xcfcfcf, p.x, p.y, p.z); r.rotation.y = s.ang; root.add(r);
    }
    { // guardrail posts as one InstancedMesh per segment (cheap on phones)
      const n = Math.floor((s.len - 16) / 8) * 4, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), mat(0x888888), Math.max(n, 1)), m4 = new THREE.Matrix4(); let i = 0;
      for (let d = 8; d < s.len - 8 && i < n; d += 8) for (const off of [-W / 2 + 0.3, W / 2 - 0.3, -MEDIAN / 2 + 0.6, MEDIAN / 2 - 0.6]) { const q = at(s, d, off, 0.3); m4.makeTranslation(q.x, q.y, q.z); im.setMatrixAt(i++, m4); }
      im.count = i; root.add(im);
    }
    for (let d = 20; d < s.len - 10; d += 10) {
      dist += 10;
      if (dist % 160 === 0) { mile++; const mm = canvasPlane((x, w, h) => { x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('MILE', w / 2, 40); x.font = 'bold 54px sans-serif'; x.fillText(String(mile), w / 2, 100); }, 128, 128, 0.8, 0.8);
        const p = at(s, d, -(W / 2 + 1.2), 1.3); mm.position.copy(p); mm.rotation.y = s.ang + Math.PI; root.add(mm); root.add(box(0.08, 0.9, 0.08, 0x888888, p.x, 0.45, p.z)); }
      if (dist % 60 === 0) { const p = at(s, d, 0, 0); root.add(box(0.15, 8, 0.15, 0x666666, p.x, 4, p.z));
        for (const sd of [-1, 1]) { const lp = at(s, d, sd * 3, 7.9); const l = box(0.5, 0.15, 0.3, 0xffffcc, lp.x, lp.y, lp.z, { emissive: 0xffe08a, emissiveIntensity: 1.2 }); l.rotation.y = s.ang; root.add(l); } }
      if (scenery && dist % 30 === 0) for (const sd of [-1, 1]) {
        const off = sd * (W / 2 + 8 + ((k * 37) % 25)); const p = at(s, d, off); k++;
        if (k % 9 === 0) { const b = billboard(k); b.position.copy(at(s, d, sd * (W / 2 + 10))); b.rotation.y = s.ang + (sd > 0 ? Math.PI : 0); root.add(b); addCol(b.position.x, b.position.z, 1, 1); }
        else if (k % 3 === 0) { const t = makePalm(); t.position.copy(p); root.add(t); }
        else { const t = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 6), mat(0x3f8f3a)); t.position.set(p.x, 3, p.z); t.castShadow = true; root.add(t); }
      }
    }
    // farm fields on long rural segments
    if (scenery && s.len > 300) for (const sd of [-1, 1]) {
      const p = at(s, s.len / 2, sd * (W / 2 + 70));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(90, s.len * 0.6), new THREE.MeshStandardMaterial({ color: sd > 0 ? 0xd9c36a : 0x6fae4a, side: THREE.DoubleSide })); f.rotation.x = -Math.PI / 2; f.rotation.z = s.ang; f.position.set(p.x, 0.008, p.z); f.receiveShadow = true; root.add(f);
      const barn = box(10, 7, 14, 0xa4161a, p.x + 20 * sd, 3.5, p.z); barn.rotation.y = s.ang; root.add(barn); addCol(barn.position.x, barn.position.z, 12, 12);
    }
  });
  // Shields + overhead exit gantry near the start, shield reassurance signs after each bend
  const s0 = segs[0];
  const g = at(s0, 40, 0);
  for (const sd of [-1, 1]) { const q = at(s0, 40, sd * (W / 2 + 0.5)); root.add(box(0.4, 8, 0.4, 0x666666, q.x, 4, q.z)); }
  const beam = box(W + 1.5, 0.5, 0.5, 0x666666, g.x, 8, g.z); beam.rotation.y = s0.ang; root.add(beam);
  const sA = greenSign([`${dirLabel(s0.dir)}`, `${name} Interstate`], 10, 3.2, number); sA.position.copy(at(s0, 39.7, -W / 4, 6.2)); sA.rotation.y = s0.ang + Math.PI; root.add(sA);
  const sB = greenSign(['EXIT 1', `${name} Downtown`], 10, 3.2); sB.position.copy(at(s0, 40.3, W / 4, 6.2)); sB.rotation.y = s0.ang; root.add(sB);
  segs.forEach(s => { const sh = makeShield(number); sh.position.copy(at(s, 30, -(W / 2 + 2), 3.2)); sh.rotation.y = s.ang + Math.PI; root.add(sh); root.add(box(0.1, 2.2, 0.1, 0x888888, sh.position.x, 1.1, sh.position.z)); });

  // lanes for AI: 2 each direction, offsets from centreline
  const laneOffs = [-(MEDIAN / 2 + 0.65 + LANE / 2), -(MEDIAN / 2 + 0.65 + LANE * 1.5), MEDIAN / 2 + 0.65 + LANE / 2, MEDIAN / 2 + 0.65 + LANE * 1.5];
  const lanes = laneOffs.map((o, i) => {
    const pts = []; segs.forEach(s => { pts.push(at(s, 0, o)); pts.push(at(s, s.len, o)); });
    return i < 2 ? { points: pts, dir: 1 } : { points: pts.reverse(), dir: -1 };   // right-hand traffic
  });
  const nearest = (x, z) => {
    let best = null; const q = new THREE.Vector3(x, 0, z);
    segs.forEach((s, i) => { const t = Math.max(0, Math.min(s.len, q.clone().sub(s.a).dot(s.dir))); const p = s.a.clone().addScaledVector(s.dir, t); const d = p.distanceTo(q); if (!best || d < best.dist) best = { dist: d, segIndex: i, t, point: p, dir: s.dir }; });
    return best;
  };
  const onRoad = (x, z) => nearest(x, z).dist < W / 2;
  const exits = [{ name: `${name} Downtown`, pos: P[0].clone() }, { name: 'Countryside', pos: P[P.length - 1].clone() }];
  return { root, segs, lanes, nearest, onRoad, exits, number, width: W };
}
function dirLabel(d) { return Math.abs(d.z) > Math.abs(d.x) ? (d.z > 0 ? 'SOUTH' : 'NORTH') : (d.x > 0 ? 'EAST' : 'WEST'); }
