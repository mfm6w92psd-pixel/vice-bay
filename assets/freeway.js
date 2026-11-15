// Mika: original elevated freeway, "Route 95 Express"-style but fictional: "Vice Bay Expressway (VB-1)".
// A straight elevated 4-lane deck (2 each way) with ramps down to ground level at both ends,
// concrete pillars, jersey barriers, lane markings, overhead green signs and lamp posts.
// Usage:
//   const fw = buildFreeway(scene, { x: -205, z0: -380, z1: 220, addCol });
//   fw.heightAt(x, z)      -> road surface height (0 off the freeway). Set vehicle y each frame.
//   fw.onDeck(x, z)        -> true if (x,z) is on the drivable freeway/ramps
//   fw.clampToDeck(v)      -> keeps a vehicle {x,z} inside the barriers while on the deck/ramps
//   fw.lanes               -> [{x, dir}] lane centres (dir +1 = south/+Z, -1 = north/-Z) for traffic
//   fw.entries             -> ground-level ramp ends, connect these to city roads
import * as THREE from 'three';
import { mat } from './models.js';

function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sign(lines, w = 10, h = 3) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(8, 8, 496, 144);
  x.fillStyle = '#fff'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center';
  lines.forEach((t, i) => x.fillText(t, 256, 66 + i * 54));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}
let deckTex;
function deckTexture() {
  if (deckTex) return deckTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#34343a'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#eee'; x.fillRect(6, 0, 4, 64); x.fillRect(246, 0, 4, 64);           // edge lines
  x.fillStyle = '#f5d142'; x.fillRect(124, 0, 3, 64); x.fillRect(130, 0, 3, 64);       // double yellow
  x.fillStyle = '#eee'; for (const lx of [66, 188]) x.fillRect(lx, 0, 3, 28);           // dashed lane lines
  deckTex = new THREE.CanvasTexture(c); deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.colorSpace = THREE.SRGBColorSpace;
  return deckTex;
}

export function buildFreeway(scene, { x = -205, z0 = -380, z1 = 220, H = 9, W = 18, ramp = 70, addCol = () => {} } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const zA = z0 + ramp, zB = z1 - ramp;               // elevated section between zA..zB, ramps z0..zA and zB..z1
  const heightAt = (px, pz) => {
    if (Math.abs(px - x) > W / 2 || pz < z0 || pz > z1) return 0;
    if (pz < zA) return H * (pz - z0) / ramp;
    if (pz > zB) return H * (z1 - pz) / ramp;
    return H;
  };
  const deckMat = len => { const t = deckTexture().clone(); t.needsUpdate = true; t.repeat.set(1, len / 16); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); };

  // Main deck
  const L = zB - zA;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, L), [mat(0xa9a9a9), mat(0xa9a9a9), deckMat(L), mat(0x8c8c8c), mat(0xa9a9a9), mat(0xa9a9a9)]);
  deck.material[2].map.rotation = 0; deck.position.set(x, H - 0.4, (zA + zB) / 2); deck.castShadow = deck.receiveShadow = true; root.add(deck);
  // fix texture orientation for top face (lines run along Z)
  

  // Ramps (sloped boxes)
  const rampLen = Math.hypot(ramp, H);
  for (const [zs, ze, sgn] of [[z0, zA, 1], [zB, z1, -1]]) {
    const t = deckTexture().clone(); t.needsUpdate = true; t.repeat.set(1, rampLen / 16);
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, rampLen), [mat(0xa9a9a9), mat(0xa9a9a9), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), mat(0x8c8c8c), mat(0xa9a9a9), mat(0xa9a9a9)]);
    m.position.set(x, H / 2 - 0.4, (zs + ze) / 2); m.rotation.x = -sgn * Math.atan2(H, ramp); m.castShadow = m.receiveShadow = true; root.add(m);
    // solid side walls under ramp so nobody drives underneath into the slope
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(ramp, 0); shape.lineTo(sgn > 0 ? ramp : 0, H); shape.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }); g.rotateY(-Math.PI / 2);
      const wall = new THREE.Mesh(g, mat(0xb5b5b5)); wall.position.set(x + s * (W / 2 - 0.25) + 0.25, -0.4, zs); wall.castShadow = true; root.add(wall);
    }
  }

  // Jersey barriers along both edges, full length (follow height)
  const segs = Math.ceil((z1 - z0) / 6);
  for (let i = 0; i < segs; i++) {
    const zc = z0 + (i + 0.5) * (z1 - z0) / segs, y = heightAt(x, zc);
    for (const s of [-1, 1]) root.add(box(0.5, 1.0, (z1 - z0) / segs + 0.05, 0xd6d6d6, x + s * (W / 2 - 0.25), y + 0.5, zc));
    if (y > H - 0.01) root.add(box(0.35, 0.8, (z1 - z0) / segs + 0.05, 0xd6d6d6, x, y + 0.4, zc)); // median barrier on the elevated part
  }

  // Pillars every 24 units under the elevated deck (colliders so cars can't pass through)
  for (let z = zA + 6; z <= zB - 6; z += 24) {
    root.add(box(W + 1, 1.4, 2.2, 0x9a9a9a, x, H - 1.4, z));
    for (const s of [-1, 1]) { root.add(box(1.6, H - 1.4, 1.6, 0xa0a0a0, x + s * 5, (H - 1.4) / 2, z)); addCol(x + s * 5, z, 1.6, 1.6); }
  }
  // Ramp footprints are solid at ground level
  addCol(x, (z0 + zA) / 2 + ramp * 0.25, W, ramp * 0.5); addCol(x, (zB + z1) / 2 - ramp * 0.25, W, ramp * 0.5);

  // Lamp posts on the median, overhead signs
  for (let z = zA + 20; z < zB; z += 40) {
    root.add(box(0.15, 6, 0.15, 0x555555, x, H + 3.8, z));
    for (const s of [-1, 1]) { root.add(box(2.4, 0.12, 0.15, 0x555555, x + s * 1.2, H + 6.8, z)); root.add(box(0.6, 0.15, 0.3, 0xffffcc, x + s * 2.4, H + 6.7, z, { emissive: 0xffe08a, emissiveIntensity: 1.2 })); }
  }
  const gantry = (z, linesN, linesS) => {
    for (const s of [-1, 1]) root.add(box(0.4, 7, 0.4, 0x666666, x + s * (W / 2 + 0.2), heightAt(x, z) + 3.5, z));
    root.add(box(W + 1, 0.4, 0.4, 0x666666, x, heightAt(x, z) + 7, z));
    const a = sign(linesN, 8, 2.4); a.position.set(x - W / 4, heightAt(x, z) + 5.6, z + 0.25); root.add(a);
    const b = sign(linesS, 8, 2.4); b.position.set(x + W / 4, heightAt(x, z) + 5.6, z - 0.25); b.rotation.y = Math.PI; root.add(b);
  };
  gantry(zA + 30, ['VB-1 NORTH', 'Port Coral  ↑'], ['VB-1 SOUTH', 'Downtown  ↓']);
  gantry(zB - 30, ['VB-1 NORTH', 'Next exit 2 km'], ['VB-1 SOUTH', 'Ocean Drive  ↓']);
  gantry(zA + 4, ['EXPRESSWAY', 'Speed limit 100'], ['EXIT', 'Port Coral']);

  const laneOff = [-W * 0.375, -W * 0.125, W * 0.125, W * 0.375];
  const lanes = laneOff.map((o, i) => ({ x: x + o, dir: i < 2 ? -1 : 1 }));   // west lanes northbound, east lanes southbound
  const onDeck = (px, pz) => Math.abs(px - x) <= W / 2 && pz >= z0 && pz <= z1;
  const clampToDeck = v => { const lim = W / 2 - 0.9; if (onDeck(v.x, v.z) && heightAt(v.x, v.z) > 0.5) v.x = Math.max(x - lim, Math.min(x + lim, v.x)); return v; };
  const entries = [{ x, z: z0, side: 'north' }, { x, z: z1, side: 'south' }];
  return { root, heightAt, onDeck, clampToDeck, lanes, entries, deckY: H, bounds: { x, z0, z1, W } };
}
