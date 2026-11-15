// Mika: varied NPCs for Vice Bay. Drop-in for makePerson(): same userData.legs/arms/phase, so animatePerson() still works.
//   makeNPC(type?)            -> THREE.Group; type is one of NPC_TYPES (random if omitted). userData.npc = { type, label, speed, behavior, money }
//       behavior: 'flee' (runs away from gunfire/crashes), 'fight' (gang: punches back / chases you if hit), 'call' (phones the cops -> +1 wanted after a few s)
//   pickNPCType(area)         -> weighted random type for 'downtown' | 'beach' | 'port' | 'town' | 'swamp' | 'city' (default)
//   animateNPC(p, speed, dt)  -> walk/run cycle (+ idle pose when speed≈0: phone, smoking, looking around); use instead of animatePerson for nicer idles
//   setNPCPanic(p, on)        -> arms up while fleeing
import * as THREE from 'three';
import { mat } from './models.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = true; return m;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a1e, 0xa66b3d];
const HAIR = [0x1b1b1b, 0x3b2314, 0x6b4423, 0xd8b26e, 0xb5502a, 0x888888];
const BRIGHT = [0xff5e7e, 0x3ec1d3, 0xf6d55c, 0x9b5de5, 0xf15bb5, 0x00bb77, 0xff9f1c, 0xffffff];

export const NPC_TYPES = {
  tourist:  { label: 'Tourist',       speed: [1.0, 1.4], behavior: 'flee',  money: [20, 80] },
  business: { label: 'Business',      speed: [1.5, 1.9], behavior: 'call',  money: [40, 150] },
  jogger:   { label: 'Jogger',        speed: [3.2, 4.0], behavior: 'flee',  money: [0, 10] },
  beach:    { label: 'Beachgoer',     speed: [0.9, 1.3], behavior: 'flee',  money: [5, 30] },
  gang:     { label: 'Gang member',   speed: [1.2, 1.6], behavior: 'fight', money: [30, 120] },
  elderly:  { label: 'Retiree',       speed: [0.6, 0.9], behavior: 'call',  money: [10, 60] },
  worker:   { label: 'Construction',  speed: [1.3, 1.6], behavior: 'fight', money: [10, 40] },
  local:    { label: 'Local',         speed: [1.2, 1.7], behavior: 'flee',  money: [10, 50] },
};
const AREA_W = {
  city:     { local: 5, tourist: 2, business: 2, jogger: 1, gang: 1, elderly: 1, worker: 1 },
  downtown: { business: 6, local: 3, tourist: 1, jogger: 1, worker: 2 },
  beach:    { beach: 6, tourist: 4, jogger: 3, local: 1, elderly: 1 },
  port:     { worker: 5, gang: 3, local: 2 },
  town:     { local: 5, elderly: 4, worker: 2, tourist: 1 },
  swamp:    { local: 4, tourist: 3, gang: 1, elderly: 1 },
};
export function pickNPCType(area = 'city') {
  const w = AREA_W[area] || AREA_W.city; let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) <= 0) return k; return 'local';
}

export function makeNPC(type = pick(Object.keys(NPC_TYPES))) {
  const T = NPC_TYPES[type] || NPC_TYPES.local, g = new THREE.Group();
  const skin = pick(SKIN), hair = pick(HAIR), elderly = type === 'elderly';
  let shirt = pick(BRIGHT), pants = 0x2b2d42, shoes = 0x222222, shorts = false, sleeves = true, tall = 0.9 + Math.random() * 0.2;
  const extras = [];
  switch (type) {
    case 'tourist': shirt = pick([0xff6f61, 0x2ec4b6, 0xffbf69]); pants = 0xd8c3a5; shorts = true; shoes = 0xffffff; break;
    case 'business': shirt = pick([0x1f2a44, 0x333333, 0x4a4e69]); pants = shirt; shoes = 0x111111; break;
    case 'jogger': shirt = pick([0xff2d6f, 0x19c3ff, 0x7cff6b]); pants = 0x111111; shorts = true; sleeves = false; shoes = 0xff9f1c; break;
    case 'beach': shirt = skin; pants = pick([0xff2d6f, 0x19c3ff, 0xffd23f]); shorts = true; sleeves = false; shoes = skin; break;
    case 'gang': shirt = 0xffffff; pants = pick([0x1d3557, 0x2b2d42]); sleeves = false; shoes = 0xffffff; break;
    case 'elderly': shirt = pick([0xb7d3e8, 0xe8d7b7, 0xd8e2dc]); pants = 0x8d99ae; break;
    case 'worker': shirt = 0xff7b00; pants = 0x3d5a80; shoes = 0x5a3e2b; break;
  }
  const body = new THREE.Group(); body.scale.setScalar(tall); g.add(body);
  const torso = box(0.55, 0.65, 0.3, shirt, 0, 1.15, 0); body.add(torso);
  if (type === 'beach' && Math.random() < 0.5) body.add(box(0.56, 0.18, 0.31, pants, 0, 1.3, 0)); // bikini top
  const head = new THREE.Group(); head.position.set(0, 1.68, 0); body.add(head);
  head.add(box(0.36, 0.36, 0.36, skin));
  head.add(box(0.38, 0.1, 0.38, elderly ? 0xdddddd : hair, 0, 0.17, 0.0), box(0.38, 0.2, 0.08, elderly ? 0xdddddd : hair, 0, 0.06, 0.16)); // hair top + back
  for (const s of [-1, 1]) head.add(box(0.05, 0.05, 0.02, 0x111111, s * 0.08, 0.04, -0.185)); // eyes
  // outfit details
  if (type === 'tourist') { head.add(box(0.5, 0.05, 0.5, 0xf4e1b5, 0, 0.24, 0), box(0.3, 0.14, 0.3, 0xf4e1b5, 0, 0.3, 0)); body.add(box(0.2, 0.14, 0.1, 0x222222, 0, 1.12, -0.2)); for (let i = 0; i < 4; i++) body.add(box(0.1, 0.1, 0.02, 0xffffff, -0.18 + i * 0.12, 1.25 - (i % 2) * 0.22, -0.16)); }
  if (type === 'business') { body.add(box(0.12, 0.5, 0.02, 0xffffff, 0, 1.2, -0.16), box(0.06, 0.42, 0.02, pick([0xc1121f, 0x2a9d8f, 0xe9c46a]), 0, 1.2, -0.17)); }
  if (type === 'jogger') { head.add(box(0.39, 0.07, 0.39, 0xffffff, 0, 0.1, 0)); }
  if (type === 'beach' && Math.random() < 0.6) head.add(box(0.3, 0.06, 0.02, 0x111111, 0, 0.05, -0.19)); // sunglasses
  if (type === 'gang') { head.add(box(0.39, 0.12, 0.39, pick([0xc1121f, 0x1d4ed8]), 0, 0.15, 0)); body.add(box(0.3, 0.04, 0.02, 0xffd23f, 0, 1.38, -0.16)); }
  if (type === 'elderly') { body.rotation.x = 0.12; body.position.z = 0.05; }
  if (type === 'worker') { head.add(box(0.42, 0.14, 0.42, 0xffd23f, 0, 0.22, 0), box(0.46, 0.03, 0.5, 0xffd23f, 0, 0.16, -0.04)); body.add(box(0.56, 0.06, 0.31, 0xdddddd, 0, 1.25, 0), box(0.56, 0.06, 0.31, 0xdddddd, 0, 1.0, 0)); }
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.14 * s, 0.82, 0);
    if (shorts) { leg.add(box(0.21, 0.32, 0.23, pants, 0, -0.16, 0), box(0.17, 0.48, 0.19, skin, 0, -0.56, 0)); } else leg.add(box(0.2, 0.8, 0.22, pants, 0, -0.4, 0));
    leg.add(box(0.21, 0.1, 0.3, shoes, 0, -0.78, -0.04)); body.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(0.37 * s, 1.42, 0);
    if (sleeves) { arm.add(box(0.16, 0.42, 0.18, shirt, 0, -0.21, 0), box(0.13, 0.2, 0.15, skin, 0, -0.52, 0)); } else arm.add(box(0.14, 0.6, 0.16, skin, 0, -0.3, 0));
    body.add(arm); arms.push(arm);
  }
  // hand props
  let prop = null;
  if (type === 'business') { prop = box(0.1, 0.3, 0.42, 0x3b2314, 0, -0.72, 0); arms[1].add(prop); }
  if (type === 'elderly') { prop = box(0.05, 0.9, 0.05, 0x5a3e2b, 0, -0.95, -0.1); arms[1].add(prop); }
  if (type === 'beach') { prop = box(0.5, 0.06, 0.25, pick([0xff5e7e, 0x3ec1d3, 0xffd23f]), 0, -0.6, 0); prop.rotation.z = 1.2; arms[0].add(prop); }
  if (type === 'worker') { prop = box(0.06, 0.06, 0.5, 0x777777, 0, -0.62, -0.1); arms[1].add(prop); }
  const phone = box(0.07, 0.13, 0.02, 0x111111, 0, -0.62, -0.08); phone.visible = false; arms[0].add(phone);
  const [s0, s1] = T.speed, [m0, m1] = T.money;
  g.userData = { legs, arms, head, phone, phase: Math.random() * 6, idle: pick(['phone', 'look', 'still', 'phone']),
    npc: { type, label: T.label, speed: s0 + Math.random() * (s1 - s0), behavior: T.behavior, money: Math.round(m0 + Math.random() * (m1 - m0)) }, panic: false, t: Math.random() * 10 };
  return g;
}

export function setNPCPanic(p, on) { p.userData.panic = on; }

export function animateNPC(p, speed, dt) {
  const u = p.userData; u.t += dt;
  const run = speed > 2.5, k = Math.min(speed / 3, 1);
  u.phase += speed * dt * (run ? 2.6 : 2.2);
  const a = k * (run ? 1.0 : 0.7) * Math.sin(u.phase);
  u.legs[0].rotation.x = a; u.legs[1].rotation.x = -a;
  if (u.panic) { u.arms[0].rotation.set(0, 0, -2.6); u.arms[1].rotation.set(0, 0, 2.6); u.phone.visible = false; }
  else if (speed > 0.2) { u.arms[0].rotation.set(-a * (run ? 1.2 : 1), 0, 0); u.arms[1].rotation.set(a * (run ? 1.2 : 1), 0, 0); u.phone.visible = false; u.head.rotation.y = 0; }
  else { // idle
    if (u.idle === 'phone') { u.phone.visible = true; u.arms[0].rotation.set(-2.2, 0, 0.25); u.head.rotation.x = 0.25; }
    else if (u.idle === 'look') { u.head.rotation.y = Math.sin(u.t * 0.7) * 0.8; u.arms[0].rotation.set(0, 0, 0); }
    else { u.arms[0].rotation.set(0, 0, 0); }
    u.arms[1].rotation.set(0, 0, 0); u.legs[0].rotation.x = u.legs[1].rotation.x = 0;
  }
  p.position.y = run && speed > 0.2 ? Math.abs(Math.sin(u.phase)) * 0.06 : 0;
}
