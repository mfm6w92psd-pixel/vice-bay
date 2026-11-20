// Mika: stunt jump ramps + airtime physics for the player's car.
// Usage:
//   const stunts = buildStuntJumps(scene, { addCol });                 // default spots: airport runways + the beach
//   surfaceY: also Math.max(..., stunts.heightAt(x, z, y))             // so cars drive up the ramps
//   player car, instead of `v.y = surfaceY(...)`:
//       const r = stunts.carY(v, dt, surfaceY(v.x, v.z, v.y || 0));    // sets v.y (gravity while airborne), v.pitch for the nose
//       if (r) { player.money += r.reward; showMsg(r.text, 3); }       // r on landing: { dist, height, time, reward, first, text }
//   AI cars keep using surfaceY directly.  stunts.spots -> [{ x, z, name }] for minimap dots.
import * as THREE from 'three';
import { mat } from './models.js';
import { buildMountain } from './mountain.js';

const L = 16, W = 8, HMAX = 3.4;    // ramp length, width, lip height
export const STUNT_SPOTS = [
  { name: 'Runway 09L Jump', x: -2000, z: -321, h: -Math.PI / 2 },   // heads east along 09L
  { name: 'Runway 09R Jump', x: -1930, z: -101, h: Math.PI / 2 },    // heads west along 09R
  { name: 'Beach Jump', x: 211, z: -30, h: 0 },                      // heads north along the sand
  { name: 'Mount Kestrel', x: -1050, z: -1350, mountain: true },      // Mika: 300 m mountain + summit road (mountain.js), open land between Vice Bay and Pelican Bay
];
function chevronTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffcc00'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#111';
  for (let y = -64; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y + 40); g.lineTo(64, y); g.lineTo(128, y + 40); g.lineTo(128, y + 60); g.lineTo(64, y + 20); g.lineTo(0, y + 60); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#ff2d6f'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(text, 128, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildStuntJumps(scene, { spots = STUNT_SPOTS, addCol = () => {} } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const tex = chevronTex(), deck = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), side = mat(0x555a66), sign = new THREE.MeshBasicMaterial({ map: signTex('STUNT JUMP') });
  const done = new Set();
  const MT = spots.filter(s => s.mountain).map(s => buildMountain(root, s));
  const R = spots.filter(s => !s.mountain).map(s => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.h; root.add(g);
    // wedge: local -Z is forward (same as cars). Starts at z=+L/2 (ground), lip at z=-L/2 (HMAX high)
    const shape = new THREE.Shape(); shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, HMAX); shape.lineTo(L / 2 - 0.4, HMAX); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2); geo.rotateY(Math.PI / 2);   // x(len)->-z ... lip ends at -Z
    const m = new THREE.Mesh(geo, [side, deck]); m.castShadow = m.receiveShadow = true; g.add(m);
    // UV fix: put chevrons on the slope by using a separate plane on top
    const slopeLen = Math.hypot(L, HMAX), top = new THREE.Mesh(new THREE.PlaneGeometry(W, slopeLen), deck);
    top.rotation.x = -Math.PI / 2 + Math.atan2(HMAX, L); top.position.set(0, HMAX / 2 + 0.03, 0); g.add(top);
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), mat(0x888888)); p.position.set(sd * (W / 2 + 1.5), 2, L / 2 + 6); g.add(p); }
    for (const back of [0, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, 1.6), sign); sg.position.set(0, 4.2, L / 2 + 6 + (back ? -0.02 : 0.02)); sg.rotation.y = back ? Math.PI : 0; g.add(sg); }
    // landing strip markers
    for (let k = 1; k <= 4; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 8), mat(0xff7a1a)); for (const sd of [-1, 1]) { const c2 = cone.clone(); c2.position.set(sd * (W / 2 + 1), 0.4, -L / 2 - k * 12); g.add(c2); } }
    const inv = new THREE.Matrix4().copy(g.matrixWorld); g.updateMatrixWorld(); inv.copy(g.matrixWorld).invert();
    return { ...s, g, inv };
  });
  const tmp = new THREE.Vector3();
  const local = (r, x, z) => tmp.set(x, 0, z).applyMatrix4(r.inv);
  const rampAt = (x, z) => { for (const r of R) { if (Math.abs(x - r.x) > L && Math.abs(z - r.z) > L) continue; const p = local(r, x, z); if (Math.abs(p.x) <= W / 2 && p.z <= L / 2 && p.z >= -L / 2) return { r, h: HMAX * (L / 2 - p.z) / L }; } return null; };
  const heightAt = (x, z, y = 0) => { const q = rampAt(x, z); let h = q && q.h <= y + 1.6 ? q.h : 0; for (const m of MT) h = Math.max(h, m.heightAt(x, z)); return h; };

  const G = 20;
  const carY = (v, dt, ground) => {
    v.y = v.y || 0;
    for (const m of MT) if (!done.has(m.name) && m.onSummit(v.x, v.z)) { done.add(m.name); v.y = ground; return { dist: 0, height: m.topH, time: 0, reward: 1000, first: true, name: m.name, text: `${m.name.toUpperCase()} SUMMIT! +$1000` }; }
    if (!v.air) {
      const q = rampAt(v.x, v.z);
      if (q) { v._rampR = q.r; v._rampVy = Math.max(0, (ground - v.y) / Math.max(dt, 1e-3)); v.y = ground; v.pitch = Math.atan2(HMAX, L) * Math.sign(v.speed || 0); return null; }
      if (v._rampR && v._rampVy > 1.5 && v.y - ground > 0.4) { v.air = { t: 0, x0: v.x, z0: v.z, vy: v._rampVy * 1.5, top: v.y, r: v._rampR }; v._rampR = null; }
      else { v._rampR = null; v.y = ground; v.pitch = 0; return null; }
    }
    const a = v.air; a.t += dt; a.vy -= G * dt; v.y += a.vy * dt; a.top = Math.max(a.top, v.y);
    v.pitch = Math.max(-0.5, Math.min(0.4, Math.atan2(a.vy, Math.max(4, Math.abs(v.speed || 0))) * 0.8));
    if (v.y > ground) return null;
    v.y = ground; v.air = null; v.pitch = 0;
    const dist = Math.hypot(v.x - a.x0, v.z - a.z0);
    if (a.t < 0.5 || dist < 8) return null;
    const first = !done.has(a.r.name); done.add(a.r.name);
    const reward = Math.round(dist * 3 + a.t * 50 + (first ? 250 : 0));
    return { dist, height: a.top, time: a.t, reward, first, name: a.r.name, text: `${first ? 'UNIQUE ' : ''}STUNT JUMP! ${dist.toFixed(0)} m, ${a.t.toFixed(1)} s  +$${reward}` };
  };
  return { root, heightAt, carY, spots: [...R.map(r => ({ x: r.x, z: r.z, name: r.name })), ...MT.map(m => ({ x: m.x, z: m.z, name: m.name }))], mountains: MT, done };
}
