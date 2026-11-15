// Mika: original traffic lights. One pole per intersection corner, heads facing both directions.
// Usage:
//   const tl = new TrafficLights(scene);
//   tl.addIntersection(x, z, roadWidth)   // call for every intersection
//   tl.update(dt)                         // every frame
//   tl.canGo(x, z, dirX, dirZ)            // for AI cars: false = stop at the line (red/yellow for that axis)
//   tl.stateAt(x, z) -> { ns: 'green'|'yellow'|'red', ew: ... } or null
// Cycle: N-S green 8s, yellow 2s, all-red 1s, E-W green 8s, yellow 2s, all-red 1s. Offsets per intersection make a green wave.
import * as THREE from 'three';
import { mat } from './models.js';

const C = { red: 0xff2020, yellow: 0xffc000, green: 0x20ff60 };
const PHASES = [['green', 'red', 8], ['yellow', 'red', 2], ['red', 'red', 1], ['red', 'green', 8], ['red', 'yellow', 2], ['red', 'red', 1]];
const CYCLE = PHASES.reduce((a, p) => a + p[2], 0);

function lamp(color) {
  const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0.05 });
  return { m, color };
}
function head(lamps) {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), mat(0x1a1a1a)); housing.castShadow = true; g.add(housing);
  const geo = new THREE.CircleGeometry(0.15, 12);
  ['red', 'yellow', 'green'].forEach((k, i) => { const l = new THREE.Mesh(geo, lamps[k].m); l.position.set(0, 0.42 - i * 0.42, -0.21); l.rotation.y = Math.PI; g.add(l); });
  return g;
}

export class TrafficLights {
  constructor(scene) { this.scene = scene; this.list = []; this.t = 0; }
  addIntersection(x, z, rw = 14, offset = null) {
    const ns = { red: lamp(C.red), yellow: lamp(C.yellow), green: lamp(C.green) };
    const ew = { red: lamp(C.red), yellow: lamp(C.yellow), green: lamp(C.green) };
    const h = rw / 2 + 0.8;
    // corner poles: [px, pz, which axis this head controls, rotation]
    for (const [px, pz, set, ry] of [[-h, -h, ns, Math.PI], [h, h, ns, 0], [h, -h, ew, -Math.PI / 2], [-h, h, ew, Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(x + px, 0, z + pz);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), mat(0x333333)); pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3), mat(0x333333)); arm.position.set(0, 4.9, 1.5); g.add(arm);
      const hd = head(set); hd.position.set(0, 4.2, 2.8); g.add(hd);
      g.rotation.y = ry; this.scene.add(g);
    }
    const off = offset ?? ((Math.abs(Math.round(x / rw)) * 1.5 + Math.abs(Math.round(z / rw)) * 0.7) % CYCLE);
    const it = { x, z, rw, ns, ew, off, state: { ns: 'red', ew: 'red' } };
    this.list.push(it); this._apply(it); return it;
  }
  _phase(it) {
    let t = (this.t + it.off) % CYCLE;
    for (const [n, e, d] of PHASES) { if (t < d) return { ns: n, ew: e }; t -= d; }
    return { ns: 'red', ew: 'red' };
  }
  _apply(it) {
    const s = this._phase(it); it.state = s;
    for (const [set, st] of [[it.ns, s.ns], [it.ew, s.ew]])
      for (const k of ['red', 'yellow', 'green']) { set[k].m.emissiveIntensity = k === st ? 2.5 : 0.05; set[k].m.color.setHex(k === st ? set[k].color : 0x222222); }
  }
  update(dt) { this.t += dt; for (const it of this.list) this._apply(it); }
  nearest(x, z, range = 30) {
    let best = null, bd = range * range;
    for (const it of this.list) { const d = (it.x - x) ** 2 + (it.z - z) ** 2; if (d < bd) { bd = d; best = it; } }
    return best;
  }
  stateAt(x, z) { const it = this.nearest(x, z); return it ? it.state : null; }
  // AI helper: is a car at (x,z) heading (dirX,dirZ) allowed to enter the next intersection?
  canGo(x, z, dirX, dirZ) {
    const it = this.nearest(x, z, 30); if (!it) return true;
    const dx = it.x - x, dz = it.z - z, ahead = dx * dirX + dz * dirZ;
    const stopLine = it.rw / 2 + 1.5;
    if (ahead < stopLine || ahead > stopLine + 8) return true; // already inside, or not close yet
    const axisNS = Math.abs(dirZ) > Math.abs(dirX);
    return (axisNS ? it.state.ns : it.state.ew) === 'green';
  }
  // Player ran a red light? Use to add a wanted star if a cop sees it.
  ranRed(x, z, dirX, dirZ, speed) {
    const it = this.nearest(x, z, 12); if (!it || speed < 3) return false;
    const inside = Math.abs(it.x - x) < it.rw / 2 && Math.abs(it.z - z) < it.rw / 2; if (!inside) return false;
    const axisNS = Math.abs(dirZ) > Math.abs(dirX);
    return (axisNS ? it.state.ns : it.state.ew) === 'red';
  }
}
