// Mika: extra original low-poly vehicles. All face -Z and work with M.animateCar (userData.wheels + lights.brakeMat).
import * as THREE from 'three';
import { mat } from './models.js';

function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function wheel(r, w, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, w, 10); g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(0x111111)); m.position.set(x, y, z); m.castShadow = true; return m;
}
function lights(g, width, y, front, back, brakeMat) {
  for (const s of [-1, 1]) {
    g.add(box(0.35, 0.14, 0.05, 0xffffee, s * width, y, front, { emissive: 0xffffcc, emissiveIntensity: 1 }));
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.05), brakeMat); t.position.set(s * width, y, back); g.add(t);
  }
}
const brake = () => new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.2 });
const metal = { metalness: 0.6, roughness: 0.3 };
const glass = { metalness: 0.9, roughness: 0.1 };

// Low wide sports car with a spoiler. Suggested stats: topSpeed 1.5x, accel 1.4x, grip 1.2x.
export function makeSportsCar(color = 0xff2d6f) {
  const g = new THREE.Group(), bm = brake(), wheels = [];
  g.add(box(2.1, 0.5, 4.4, color, 0, 0.45, 0, metal));
  g.add(box(1.7, 0.4, 1.7, color, 0, 0.88, 0.35, metal));
  g.add(box(1.6, 0.36, 0.05, 0x223344, 0, 0.88, -0.52, glass));
  g.add(box(2.0, 0.08, 0.4, 0x111111, 0, 1.1, 2.0)); g.add(box(0.1, 0.35, 0.1, 0x111111, -0.8, 0.85, 2.0)); g.add(box(0.1, 0.35, 0.1, 0x111111, 0.8, 0.85, 2.0));
  for (const [x, z] of [[-1.02, -1.4], [1.02, -1.4], [-1.02, 1.4], [1.02, 1.4]]) { const w = wheel(0.36, 0.34, x, 0.36, z); g.add(w); wheels.push(w); }
  lights(g, 0.7, 0.5, -2.21, 2.21, bm);
  g.userData = { wheels, lights: { brakeMat: bm }, police: false, type: 'sports', stats: { speed: 1.5, accel: 1.4, grip: 1.2 }, seatY: 0.6 };
  return g;
}

// Motorcycle. Lean it with bike.rotation.z = -steer * 0.4 while turning.
export function makeMotorcycle(color = 0x19c3ff) {
  const g = new THREE.Group(), bm = brake(), wheels = [];
  for (const z of [-0.85, 0.85]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.11, 6, 12), mat(0x111111)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.42, z); w.castShadow = true; g.add(w); wheels.push(w);
  }
  g.add(box(0.35, 0.35, 1.3, color, 0, 0.75, 0, metal));
  g.add(box(0.3, 0.12, 0.7, 0x111111, 0, 0.98, 0.25));
  g.add(box(0.08, 0.6, 0.08, 0x777777, 0, 0.85, -0.75)); g.add(box(0.8, 0.06, 0.06, 0x333333, 0, 1.15, -0.72));
  g.add(box(0.2, 0.14, 0.05, 0xffffee, 0, 0.95, -0.82, { emissive: 0xffffcc, emissiveIntensity: 1 }));
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), bm); t.position.set(0, 0.85, 0.85); g.add(t);
  g.userData = { wheels, lights: { brakeMat: bm }, police: false, type: 'bike', stats: { speed: 1.3, accel: 1.6, grip: 0.9 }, seatY: 1.0, collider: { w: 0.8, d: 2.0 } };
  return g;
}

// Box delivery truck (about 2.6 x 3.4 x 7.5). Slow and heavy.
export function makeTruck(cab = 0xffffff, cargo = 0xf6d55c) {
  const g = new THREE.Group(), bm = brake(), wheels = [];
  g.add(box(2.4, 1.6, 2.2, cab, 0, 1.3, -2.5, metal));
  g.add(box(2.2, 0.6, 0.05, 0x223344, 0, 1.7, -3.61, glass));
  g.add(box(2.6, 2.8, 5.0, cargo, 0, 2.0, 1.1));
  g.add(box(2.4, 0.3, 7.4, 0x333333, 0, 0.55, 0));
  for (const [x, z] of [[-1.2, -2.6], [1.2, -2.6], [-1.2, 1.4], [1.2, 1.4], [-1.2, 2.7], [1.2, 2.7]]) { const w = wheel(0.5, 0.4, x, 0.5, z); g.add(w); wheels.push(w); }
  lights(g, 0.9, 0.9, -3.61, 3.61, bm);
  g.userData = { wheels, lights: { brakeMat: bm }, police: false, type: 'truck', stats: { speed: 0.7, accel: 0.5, grip: 1.0 }, seatY: 1.6, collider: { w: 2.6, d: 7.5 } };
  return g;
}

// Speedboat: drive on water only (y = water level). Pass userData.wake to scale with speed.
export function makeBoat(color = 0xffffff, stripe = 0x19c3ff) {
  const g = new THREE.Group();
  const hullGeo = new THREE.CylinderGeometry(1.2, 0.6, 5.5, 4, 1); hullGeo.rotateX(Math.PI / 2); hullGeo.rotateZ(Math.PI / 4); hullGeo.scale(1, 0.45, 1);
  const hull = new THREE.Mesh(hullGeo, mat(color, metal)); hull.position.y = 0.35; hull.castShadow = true; g.add(hull);
  g.add(box(1.7, 0.12, 4.2, stripe, 0, 0.62, 0.3));
  g.add(box(1.2, 0.6, 0.1, 0x223344, 0, 1.0, -0.6, glass));
  g.add(box(0.5, 0.5, 0.5, 0xcccccc, -0.3, 0.9, 0.3)); g.add(box(0.4, 0.5, 0.4, 0x222222, 0, 0.6, 2.85));
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.05, 4.8); g.add(wake);
  g.userData = { wheels: [], lights: { brakeMat: brake() }, police: false, type: 'boat', water: true, wake, stats: { speed: 1.2, accel: 0.9, grip: 0.5 }, seatY: 0.9, collider: { w: 2.4, d: 5.5 } };
  return g;
}

// Helicopter. Call animateHeli(h, dt, power01) each frame. Flies: up/down + move like a car.
export function makeHelicopter(color = 0x1d3557, { police = false } = {}) {
  const g = new THREE.Group(), body = police ? 0x10182b : color;
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), mat(body, metal)); cabin.scale.set(1, 0.9, 1.4); cabin.position.y = 1.5; cabin.castShadow = true; g.add(cabin);
  g.add(box(1.6, 0.8, 0.1, 0x223344, 0, 1.7, -1.8, glass));
  g.add(box(0.35, 0.35, 4.5, body, 0, 1.8, 3.2));
  g.add(box(0.08, 1.0, 0.6, body, 0, 2.3, 5.3));
  for (const s of [-1, 1]) g.add(box(0.12, 0.12, 3.2, 0x333333, s * 0.9, 0.1, 0));
  const rotor = new THREE.Group(); rotor.position.y = 3.0;
  rotor.add(box(8, 0.06, 0.3, 0x222222)); rotor.add(box(0.3, 0.06, 8, 0x222222)); g.add(rotor);
  const tail = new THREE.Group(); tail.position.set(0.25, 2.3, 5.3); tail.add(box(0.05, 1.6, 0.18, 0x222222)); g.add(tail);
  const lightsObj = { brakeMat: brake() };
  if (police) {
    const spot = new THREE.SpotLight(0xffffff, 0, 80, 0.3, 0.5); spot.position.set(0, 0.5, -1); spot.target.position.set(0, -20, -6);
    g.add(spot, spot.target); lightsObj.spot = spot;
    const red = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), red); r.position.set(0, 2.85, 0); g.add(r); lightsObj.red = red;
  }
  g.userData = { wheels: [], rotor, tail, lights: lightsObj, police, type: 'heli', flying: true, stats: { speed: 1.4, accel: 0.8, grip: 1 }, seatY: 1.4, collider: { w: 3, d: 6 } };
  return g;
}
export const makePoliceHelicopter = () => makeHelicopter(0x10182b, { police: true });
export function animateHeli(h, dt, power = 1, t = performance.now() / 1000) {
  const u = h.userData; u.rotor.rotation.y += dt * (8 + 30 * power); u.tail.rotation.x += dt * (12 + 40 * power);
  if (u.police) { u.lights.red.emissiveIntensity = Math.floor(t * 3) % 2 ? 2 : 0.1; u.lights.spot.intensity = 400; }
}

// Bus (city transit) about 2.6 x 3.2 x 10.
export function makeBus(color = 0xff7a1a) {
  const g = new THREE.Group(), bm = brake(), wheels = [];
  g.add(box(2.6, 2.6, 10, color, 0, 1.75, 0, metal));
  for (const s of [-1, 1]) g.add(box(0.05, 0.9, 8.4, 0x223344, s * 1.31, 2.3, 0.3, glass));
  g.add(box(2.4, 1.0, 0.05, 0x223344, 0, 2.2, -5.01, glass));
  for (const [x, z] of [[-1.25, -3.4], [1.25, -3.4], [-1.25, 3.4], [1.25, 3.4]]) { const w = wheel(0.55, 0.4, x, 0.55, z); g.add(w); wheels.push(w); }
  lights(g, 0.95, 0.9, -5.01, 5.01, bm);
  g.userData = { wheels, lights: { brakeMat: bm }, police: false, type: 'bus', stats: { speed: 0.65, accel: 0.45, grip: 0.9 }, seatY: 1.8, collider: { w: 2.6, d: 10 } };
  return g;
}
