// New Bot 1: original clothing stores, barbershops and a gym for Vice Bay.
// No GTA / San Andreas names, brands or likenesses.
// Wiring (game.js), about 3 lines:
//   import { initStyle, getStamina, sprintMultiplier, getStyleState, setStyleState, resetStyle } from './assets/style.js';
//   // after `player` exists (and ideally after CITIES / addCol):
//   const style = initStyle({ scene, player, showMsg, addCol, onOpen: () => { state.shopOpen = true; }, onClose: () => { state.shopOpen = false; }, isBusy: () => state.shopOpen || state.mission });
//   // in the game loop (e.g. next to tickIncome / propertyAt):
//   style.update(dt);
// Optional: sprint: `input.sprint ? 8 * sprintMultiplier() : 4.2`
// Optional: save/load: include getStyleState() / setStyleState(obj); newGame: resetStyle().
// Stores persist on their own in localStorage (`vicebay_style_v1`) and also via getStyleState/setStyleState.
import * as THREE from 'three';
import { mat, makeMarker } from './models.js';

const KEY = 'vicebay_style_v1';

// World-space storefronts (already warped). Vice Bay core is unwarped; other cities use the
// same rigid 5x site warp as game.js wp(). Triggers sit on mid-block sidewalks, not the road.
const CORE = { minX: -800, maxX: 400, minZ: -800, maxZ: 1550 }, WORLD_X = 5;
const wAxis = (v, lo, hi) => v < lo ? lo + (v - lo) * WORLD_X : v > hi ? hi + (v - hi) * WORLD_X : v;
const cityAt = (cx, cz, dx, dz) => [wAxis(cx, CORE.minX, CORE.maxX) + dx, wAxis(cz, CORE.minZ, CORE.maxZ) + dz];
const [SUN_X, SUN_Z] = cityAt(-150, 4700, 0, 0);
const [PALM_X, PALM_Z] = cityAt(-7000, 850, 0, 0);

export const STYLE_STORES = [
  { id: 'vb-threads', kind: 'clothes', name: 'Bay Threads', city: 'Vice Bay', icon: '👕', x: 30, z: 10, face: Math.PI, color: 0xff5e7e, sign: '#ff5e7e' },
  { id: 'vb-cuts', kind: 'barber', name: 'Sharp Cuts', city: 'Vice Bay', icon: '✂️', x: 10, z: 30, face: Math.PI / 2, color: 0x3ec1d3, sign: '#1a8a99' },
  { id: 'vb-gym', kind: 'gym', name: 'Iron Palm Gym', city: 'Vice Bay', icon: '💪', x: 50, z: 30, face: -Math.PI / 2, color: 0xff7a1a, sign: '#c45a10' },
  { id: 'sun-threads', kind: 'clothes', name: 'Sunrise Clothiers', city: 'Sunrise City', icon: '👕', x: SUN_X + 9, z: SUN_Z + 40, face: Math.PI / 2, color: 0xf6d55c, sign: '#c9a227' },
  { id: 'sun-cuts', kind: 'barber', name: 'Harbor Clip', city: 'Sunrise City', icon: '✂️', x: SUN_X - 9, z: SUN_Z + 40, face: -Math.PI / 2, color: 0x3ec1d3, sign: '#1a8a99' },
  { id: 'palm-threads', kind: 'clothes', name: 'Palm Wardrobe', city: 'Palm Harbor', icon: '👕', x: PALM_X + 9, z: PALM_Z + 40, face: Math.PI / 2, color: 0x9b5de5, sign: '#6b3aa0' },
  { id: 'palm-cuts', kind: 'barber', name: 'Tide Line Barbers', city: 'Palm Harbor', icon: '✂️', x: PALM_X - 9, z: PALM_Z + 40, face: -Math.PI / 2, color: 0x3ec1d3, sign: '#1a8a99' },
];
export const STYLE_PLACES = STYLE_STORES.map(s => ({ name: s.name, x: s.x, z: s.z, icon: s.icon }));

export const SHIRTS = [
  { id: 'pink', name: 'Coral Pink', color: 0xff5e7e, price: 40 },
  { id: 'teal', name: 'Bay Teal', color: 0x3ec1d3, price: 40 },
  { id: 'gold', name: 'Sun Gold', color: 0xf6d55c, price: 40 },
  { id: 'ocean', name: 'Ocean Blue', color: 0x20639b, price: 40 },
  { id: 'white', name: 'Bright White', color: 0xffffff, price: 40 },
  { id: 'violet', name: 'Orchid Violet', color: 0x9b5de5, price: 45 },
  { id: 'green', name: 'Palm Green', color: 0x00bb77, price: 40 },
  { id: 'black', name: 'Night Black', color: 0x1a1a1a, price: 45 },
];
export const PANTS = [
  { id: 'navy', name: 'Harbor Navy', color: 0x1c3d5a, price: 50 },
  { id: 'khaki', name: 'Sand Khaki', color: 0xc2b280, price: 50 },
  { id: 'charcoal', name: 'Charcoal', color: 0x2b2d42, price: 50 },
  { id: 'white', name: 'Clean White', color: 0xefefef, price: 55 },
  { id: 'wine', name: 'Wine', color: 0x6b2748, price: 55 },
  { id: 'teal', name: 'Deep Teal', color: 0x1b6b6b, price: 50 },
];
export const HATS = [
  { id: 'none', name: 'No hat', price: 0 },
  { id: 'cap', name: 'Bay Cap', price: 80 },
  { id: 'bucket', name: 'Shade Bucket', price: 90 },
  { id: 'visor', name: 'Sun Visor', price: 70 },
  { id: 'beanie', name: 'Night Beanie', price: 85 },
];
export const GLASSES = [
  { id: 'none', name: 'No shades', price: 0 },
  { id: 'slim', name: 'Slim Frames', price: 60 },
  { id: 'round', name: 'Round Specs', price: 75 },
  { id: 'bay', name: 'Bay Shades', price: 120 },
];
export const HAIRCUTS = [
  { id: 'none', name: 'Clean Shave', price: 25 },
  { id: 'crop', name: 'Close Crop', price: 35 },
  { id: 'wave', name: 'Wavy Top', price: 45 },
  { id: 'slick', name: 'Slick Back', price: 45 },
  { id: 'sweep', name: 'Long Sweep', price: 55 },
  { id: 'spike', name: 'Spike Ridge', price: 50 },
];
export const HAIR_COLORS = [
  { id: 'ink', name: 'Ink Black', color: 0x1b1b1b, price: 30 },
  { id: 'espresso', name: 'Espresso', color: 0x3b2314, price: 30 },
  { id: 'chestnut', name: 'Chestnut', color: 0x6b4423, price: 30 },
  { id: 'honey', name: 'Honey', color: 0xd8b26e, price: 40 },
  { id: 'copper', name: 'Copper', color: 0xb5502a, price: 40 },
  { id: 'silver', name: 'Silver', color: 0x9a9a9a, price: 45 },
  { id: 'bleach', name: 'Palm Blond', color: 0xf3e6b8, price: 45 },
];

const DEFAULT = { shirt: 'pink', pants: 'navy', hat: 'none', glasses: 'none', hair: 'none', hairColor: 'espresso', stamina: 0, muscle: 0 };

let state = { ...DEFAULT };
let parts = null; // { torso, head, shirtMeshes, pantsMeshes, acc, armGroups }
let gymHold = 0, gymMode = 'cardio', gymReps = 0;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(getStyleState())); } catch { } }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(state, sanitize(s)); } catch { }
}
function sanitize(s = {}) {
  const ok = (list, id, fb) => list.some(i => i.id === id) ? id : fb;
  return {
    shirt: ok(SHIRTS, s.shirt, DEFAULT.shirt),
    pants: ok(PANTS, s.pants, DEFAULT.pants),
    hat: ok(HATS, s.hat, DEFAULT.hat),
    glasses: ok(GLASSES, s.glasses, DEFAULT.glasses),
    hair: ok(HAIRCUTS, s.hair, DEFAULT.hair),
    hairColor: ok(HAIR_COLORS, s.hairColor, DEFAULT.hairColor),
    stamina: clamp(+s.stamina || 0, 0, 100),
    muscle: clamp(+s.muscle || 0, 0, 100),
  };
}

export function getStyleState() {
  return { shirt: state.shirt, pants: state.pants, hat: state.hat, glasses: state.glasses, hair: state.hair, hairColor: state.hairColor, stamina: state.stamina, muscle: state.muscle };
}
export function setStyleState(obj) {
  if (!obj || typeof obj !== 'object') return getStyleState();
  Object.assign(state, sanitize({ ...state, ...obj }));
  save(); applyLook();
  return getStyleState();
}
export function resetStyle() { Object.assign(state, { ...DEFAULT }); save(); applyLook(); return getStyleState(); }
export function getStamina() { return state.stamina; }
export function sprintMultiplier() { return 1 + state.stamina / 100 * 0.35; }

function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, color, x, y, z, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z); m.castShadow = true; return m;
}

function prepPlayer(player) {
  const g = player.mesh; if (!g || parts) return;
  const torso = g.children[0], head = g.children[1];
  const armGroups = (g.userData && g.userData.arms) || [];
  const legGroups = (g.userData && g.userData.legs) || [];
  const shirtMeshes = [torso, ...armGroups.map(a => a.children[0]).filter(Boolean)];
  const pantsMeshes = legGroups.map(l => l.children[0]).filter(Boolean);
  for (const m of shirtMeshes) if (m && m.material) { m.material = m.material.clone(); m.userData.stylePart = 'shirt'; }
  for (const m of pantsMeshes) if (m && m.material) { m.material = m.material.clone(); m.userData.stylePart = 'pants'; }
  const acc = new THREE.Group(); acc.name = 'styleAcc'; g.add(acc);
  parts = { torso, head, shirtMeshes, pantsMeshes, acc, armGroups };
}

function applyLook() {
  if (!parts) return;
  const shirt = SHIRTS.find(s => s.id === state.shirt) || SHIRTS[0];
  const pants = PANTS.find(s => s.id === state.pants) || PANTS[0];
  const hairC = (HAIR_COLORS.find(s => s.id === state.hairColor) || HAIR_COLORS[1]).color;
  for (const m of parts.shirtMeshes) m.material.color.setHex(shirt.color);
  for (const m of parts.pantsMeshes) m.material.color.setHex(pants.color);
  const mus = 1 + state.muscle / 100 * 0.16;
  parts.torso.scale.set(mus, 1 + state.muscle / 100 * 0.06, 1 + state.muscle / 100 * 0.12);
  for (const a of parts.armGroups) a.scale.set(mus, 1, mus);
  // rebuild accessories at the head
  const acc = parts.acc; while (acc.children.length) acc.remove(acc.children[0]);
  const hy = 1.68;
  if (state.hair !== 'none') {
    if (state.hair === 'crop') {
      acc.add(box(0.38, 0.08, 0.38, hairC, 0, hy + 0.18, 0));
      acc.add(box(0.36, 0.14, 0.08, hairC, 0, hy + 0.04, 0.15));
    } else if (state.hair === 'wave') {
      acc.add(box(0.4, 0.14, 0.4, hairC, 0, hy + 0.22, 0.02));
      acc.add(box(0.38, 0.16, 0.1, hairC, 0, hy + 0.06, 0.16));
    } else if (state.hair === 'slick') {
      acc.add(box(0.36, 0.1, 0.42, hairC, 0, hy + 0.2, -0.04));
      acc.add(box(0.34, 0.18, 0.08, hairC, 0, hy + 0.04, 0.16));
    } else if (state.hair === 'sweep') {
      acc.add(box(0.4, 0.12, 0.4, hairC, 0, hy + 0.2, 0));
      acc.add(box(0.36, 0.36, 0.1, hairC, 0, hy - 0.04, 0.18));
      acc.add(box(0.34, 0.3, 0.08, hairC, 0, hy - 0.1, -0.16));
    } else if (state.hair === 'spike') {
      acc.add(box(0.16, 0.28, 0.16, hairC, 0, hy + 0.3, 0));
      acc.add(box(0.34, 0.1, 0.34, hairC, 0, hy + 0.16, 0));
      acc.add(box(0.34, 0.14, 0.08, hairC, 0, hy + 0.04, 0.15));
    }
  }
  if (state.hat === 'cap') {
    acc.add(cyl(0.24, 0.24, 0.12, 0x1d3557, 0, hy + 0.24, 0, 10));
    acc.add(box(0.22, 0.04, 0.18, 0x1d3557, 0, hy + 0.2, 0.22));
  } else if (state.hat === 'bucket') {
    acc.add(cyl(0.26, 0.22, 0.14, 0x3d5a40, 0, hy + 0.22, 0, 10));
    acc.add(cyl(0.36, 0.36, 0.04, 0x3d5a40, 0, hy + 0.16, 0, 10));
  } else if (state.hat === 'visor') {
    acc.add(cyl(0.24, 0.24, 0.05, 0xff5e7e, 0, hy + 0.22, 0, 10));
    acc.add(box(0.24, 0.03, 0.16, 0xff5e7e, 0, hy + 0.2, 0.22));
  } else if (state.hat === 'beanie') {
    acc.add(cyl(0.23, 0.25, 0.18, 0x2b2d42, 0, hy + 0.24, 0, 10));
  }
  if (state.glasses !== 'none') {
    const gcol = state.glasses === 'bay' ? 0x111111 : 0x222233;
    const lens = state.glasses === 'bay' ? 0x1a1a14 : 0x223344;
    const zw = 0.2;
    if (state.glasses === 'round') {
      const l1 = cyl(0.07, 0.07, 0.03, lens, -0.09, hy + 0.02, zw, 8); l1.rotation.x = Math.PI / 2; acc.add(l1);
      const l2 = cyl(0.07, 0.07, 0.03, lens, 0.09, hy + 0.02, zw, 8); l2.rotation.x = Math.PI / 2; acc.add(l2);
    } else {
      acc.add(box(0.14, 0.06, 0.03, lens, -0.1, hy + 0.02, zw));
      acc.add(box(0.14, 0.06, 0.03, lens, 0.1, hy + 0.02, zw));
    }
    acc.add(box(0.06, 0.02, 0.02, gcol, 0, hy + 0.03, zw));
  }
}

function makeSign(text, bg, w = 6.4, h = 1.5) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#fff'; x.font = 'bold 52px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}

function buildStore(scene, s, addCol) {
  const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.face ?? 0; g.name = s.id;
  // Small stall set back from the sidewalk trigger so the entrance stays off the road and out of the collider.
  const bx = 0, bz = -3.4;
  if (s.kind === 'gym') {
    g.add(box(7.2, 5.2, 5.2, 0x3a3a40, bx, 2.6, bz));
    g.add(box(7.4, 0.3, 5.4, 0xff7a1a, bx, 5.3, bz));
    // simple weight silhouette out front
    g.add(cyl(0.18, 0.18, 2.2, 0x222, bx - 1.6, 1.2, bz + 2.2, 6)).rotation.z = Math.PI / 2;
    g.add(cyl(0.45, 0.45, 0.3, 0x222, bx - 2.5, 1.2, bz + 2.2, 8));
    g.add(cyl(0.45, 0.45, 0.3, 0x222, bx - 0.7, 1.2, bz + 2.2, 8));
  } else if (s.kind === 'barber') {
    g.add(box(5.6, 4.2, 4.4, 0xf4f1ea, bx, 2.1, bz));
    const pole = cyl(0.12, 0.12, 2.4, 0xffffff, bx + 2.5, 2.0, bz + 2.4, 10);
    g.add(pole);
    g.add(box(0.26, 0.5, 0.26, 0xff3b3b, bx + 2.5, 2.6, bz + 2.4));
    g.add(box(0.26, 0.5, 0.26, 0x3b7bff, bx + 2.5, 1.6, bz + 2.4));
  } else {
    g.add(box(6.2, 4.4, 4.6, s.color, bx, 2.2, bz));
    g.add(box(6.4, 0.2, 1.8, 0xffcf3c, bx, 3.4, bz + 2.0)); // awning
  }
  // door recess
  g.add(box(1.4, 2.2, 0.12, 0x2a1a12, bx, 1.1, bz + 2.25));
  const sign = makeSign(s.name.toUpperCase(), s.sign, s.kind === 'gym' ? 7 : 6.2, 1.35);
  sign.position.set(bx, s.kind === 'gym' ? 5.9 : 4.7, bz + 2.35); g.add(sign);
  const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = bz - 2.35; g.add(back);
  scene.add(g);
  // collider around the stall only (not the trigger). local -Z is world (sin f, -cos f)
  const f = s.face ?? 0, cx = s.x + Math.sin(f) * 3.4, cz = s.z + (-Math.cos(f)) * 3.4;
  const alongRoad = Math.abs(Math.cos(f)) > 0.7; // stall's long axis is world X when facing ±Z
  if (addCol) addCol(cx, cz, alongRoad ? 7.2 : 5.4, alongRoad ? 5.4 : 7.2, 6);
  const mk = makeMarker(s.color); mk.position.set(s.x, 1.5, s.z); mk.scale.set(1.3, 0.55, 1.3); scene.add(mk);
  s.mesh = g; s.marker = mk;
}

const css = `
#styleUI{position:fixed;inset:0;z-index:9998;background:rgba(8,10,25,.9);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;
  padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 12px max(12px,env(safe-area-inset-left));}
#styleUI .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}
#styleUI .tt{font-size:20px;font-weight:800}#styleUI .tt b{color:#ffcf3c}
#styleUI .cash{color:#3ddc84;font-weight:800;font-size:18px;margin-right:10px}
#styleUI .x{font-size:20px;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff}
#styleUI .tabs{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
#styleUI .tab{height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-weight:700;font-size:13px}
#styleUI .tab.on{background:#ffcf3c;color:#1a1400;border-color:#ffcf3c}
#styleUI .body{flex:1;touch-action:pan-y;overscroll-behavior:contain;overflow-y:auto;-webkit-overflow-scrolling:touch}
#styleUI .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px;align-content:start}
#styleUI .it{background:rgba(255,255,255,.08);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:3px;min-height:84px;border:2px solid transparent}
#styleUI .it.on{border-color:#ffcf3c}
#styleUI .sw{width:28px;height:28px;border-radius:6px;border:1px solid #fff6}
#styleUI .nm{font-weight:700;font-size:14px}#styleUI .ds{font-size:12px;opacity:.7;flex:1}
#styleUI .buy{margin-top:4px;height:38px;border-radius:10px;border:0;font-weight:800;font-size:14px;background:#3ddc84;color:#04210f}
#styleUI .buy.no{background:#555;color:#ccc}#styleUI .buy.have{background:#3cc8ff;color:#021a24}
#styleUI .toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#000c;padding:8px 14px;border-radius:10px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}
#styleUI .toast.on{opacity:1}
#styleUI .gym{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:100%;padding:2px 0}
#styleUI .stat{display:flex;gap:14px;font-size:14px}#styleUI .stat b{color:#ffcf3c}
#styleUI .bar{width:min(420px,80vw);height:12px;background:#0008;border-radius:8px;overflow:hidden;border:1px solid #fff3}
#styleUI .bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3ddc84,#ffcf3c)}
#styleUI .hold{width:min(260px,70vw);height:64px;border-radius:14px;border:0;font-weight:800;font-size:18px;background:#ff7a1a;color:#fff;flex:none}
#styleUI .hold:active,#styleUI .hold.down{background:#ffcf3c;color:#1a1400}
#styleUI .hint{font-size:12px;opacity:.75;text-align:center;max-width:70vw}`;

const tap = (el, fn) => {
  let sx = 0, sy = 0, moved = false;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) moved = true; }, { passive: true });
  el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); if (!moved) fn(e); });
  el.addEventListener('click', e => { e.stopPropagation(); fn(e); });
};

function busyDom() {
  return !!(document.getElementById('styleUI') || document.getElementById('shopUI') || document.getElementById('propUI') || document.getElementById('tpUI')
    || document.getElementById('versionHistory') || [...document.querySelectorAll('.screen')].some(e => e.getClientRects().length && getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden') && e.id !== 'hud'));
}

function openMenu({ store, player, showMsg = () => {}, onClose = () => {} }) {
  if (document.getElementById('styleUI')) return;
  if (!document.getElementById('styleCSS')) { const s = document.createElement('style'); s.id = 'styleCSS'; s.textContent = css; document.head.appendChild(s); }
  const o = document.createElement('div'); o.id = 'styleUI';
  const kinds = store.kind === 'clothes' ? [['shirt', 'Shirts'], ['pants', 'Pants'], ['hat', 'Hats'], ['glasses', 'Shades']]
    : store.kind === 'barber' ? [['hair', 'Cuts'], ['hairColor', 'Color']] : [['gym', 'Workout']];
  let tab = kinds[0][0], toastT = 0, holding = false;
  o.innerHTML = `<div class="hd"><div class="tt">${store.icon} <b>${store.name.toUpperCase()}</b></div><div><span class="cash"></span><button class="x">✕</button></div></div>
    <div class="tabs"></div><div class="body"></div><div class="toast"></div>`;
  const body = o.querySelector('.body'), cash = o.querySelector('.cash'), toast = o.querySelector('.toast'), tabs = o.querySelector('.tabs');
  const say = t => { toast.textContent = t; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 1400); };
  const close = () => { holding = false; o.remove(); onClose(); };
  tap(o.querySelector('.x'), close);
  body.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

  const lists = { shirt: SHIRTS, pants: PANTS, hat: HATS, glasses: GLASSES, hair: HAIRCUTS, hairColor: HAIR_COLORS };
  const keyOf = t => t;

  function buy(list, item, key) {
    const wearing = state[key] === item.id;
    if (wearing && item.price === 0) return say('Already off');
    if (wearing) return say('Already wearing this');
    if (item.price > 0 && player.money < item.price) return say(`Need $${item.price - player.money} more`);
    if (item.price > 0) player.money -= item.price;
    state[key] = item.id; save(); applyLook();
    say(item.price ? `Got ${item.name}  -$${item.price}` : `Took off`);
    showMsg(item.price ? `${item.name}  -$${item.price}` : item.name, 1.4);
    render();
  }

  function renderGym() {
    body.innerHTML = `<div class="gym">
      <div class="tabs" style="margin:0"><button class="tab${gymMode === 'cardio' ? ' on' : ''}" data-m="cardio">Cardio · Stamina</button><button class="tab${gymMode === 'weights' ? ' on' : ''}" data-m="weights">Weights · Muscle</button></div>
      <div class="stat">Stamina <b id="stSt">${Math.round(state.stamina)}</b> · Muscle <b id="stMu">${Math.round(state.muscle)}</b> · Sprint <b>${sprintMultiplier().toFixed(2)}×</b></div>
      <div class="hint">${gymMode === 'cardio' ? 'Hold the pad to run in place. Each rep raises Stamina (faster sprint once hooked up).' : 'Hold the pad through a lift. Each rep adds a little Muscle and fills out your torso and arms.'}</div>
      <div class="bar"><i id="stBar"></i></div>
      <button class="hold" id="stHold">${gymMode === 'cardio' ? 'HOLD TO SPRINT' : 'HOLD TO LIFT'}</button>
      <div class="hint">Free to use · ${gymReps} reps this visit</div>
    </div>`;
    body.querySelectorAll('[data-m]').forEach(b => tap(b, () => { gymMode = b.dataset.m; gymHold = 0; render(); }));
    const btn = body.querySelector('#stHold'), bar = body.querySelector('#stBar');
    const down = e => { e.preventDefault(); e.stopPropagation(); holding = true; btn.classList.add('down'); };
    const up = e => { e && e.preventDefault(); holding = false; btn.classList.remove('down'); };
    btn.addEventListener('mousedown', down); btn.addEventListener('mouseup', up); btn.addEventListener('mouseleave', up);
    btn.addEventListener('touchstart', down, { passive: false }); btn.addEventListener('touchend', up, { passive: false }); btn.addEventListener('touchcancel', up, { passive: false });
    o._gymTick = dt => {
      if (!holding) { gymHold = Math.max(0, gymHold - dt * 1.6); }
      else {
        gymHold += dt * 0.9;
        if (gymHold >= 1) {
          gymHold = 0; gymReps++;
          if (gymMode === 'cardio') state.stamina = clamp(state.stamina + 4, 0, 100);
          else { state.muscle = clamp(state.muscle + 4, 0, 100); applyLook(); }
          save();
          const st = body.querySelector('#stSt'), mu = body.querySelector('#stMu');
          if (st) st.textContent = Math.round(state.stamina);
          if (mu) mu.textContent = Math.round(state.muscle);
          const spr = body.querySelector('.stat'); if (spr) spr.lastElementChild && null;
          const bolds = body.querySelectorAll('.stat b');
          if (bolds[2]) bolds[2].textContent = sprintMultiplier().toFixed(2) + '×';
          say(gymMode === 'cardio' ? 'Stamina up!' : 'Muscle up!');
        }
      }
      if (bar) bar.style.width = (clamp(gymHold, 0, 1) * 100) + '%';
    };
  }

  function render() {
    cash.textContent = '$' + (player.money | 0);
    tabs.innerHTML = '';
    for (const [id, label] of kinds) {
      const b = document.createElement('button'); b.className = 'tab' + (tab === id ? ' on' : ''); b.textContent = label;
      tap(b, () => { tab = id; render(); }); tabs.appendChild(b);
    }
    if (tab === 'gym') return renderGym();
    o._gymTick = null;
    const list = lists[tab] || [];
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const it of list) {
      const on = state[keyOf(tab)] === it.id;
      const afford = it.price <= 0 || player.money >= it.price;
      const d = document.createElement('div'); d.className = 'it' + (on ? ' on' : '');
      const sw = it.color != null ? `<div class="sw" style="background:#${it.color.toString(16).padStart(6, '0')}"></div>` : '';
      d.innerHTML = `${sw}<div class="nm">${it.name}</div><div class="ds">${on ? 'Wearing' : (it.price ? '$' + it.price : 'Free')}</div>
        <button class="buy${on ? ' have' : afford ? '' : ' no'}">${on ? (it.price ? 'Wearing' : 'Off') : (it.price ? '$' + it.price : 'Take off')}</button>`;
      tap(d.querySelector('.buy'), () => buy(list, it, tab));
      grid.appendChild(d);
    }
    body.innerHTML = ''; body.appendChild(grid);
  }
  document.body.appendChild(o); render();
  return { close, tick: dt => o._gymTick && o._gymTick(dt) };
}

load();

export function initStyle(ctx = {}) {
  const { scene, player, showMsg = () => {}, addCol = () => {}, onOpen = () => {}, onClose = () => {}, isBusy } = ctx;
  if (!scene || !player) throw new Error('initStyle needs { scene, player }');
  prepPlayer(player);
  applyLook();
  for (const s of STYLE_STORES) buildStore(scene, s, addCol);
  let ui = null, inside = null;
  const busy = () => (isBusy && isBusy()) || busyDom();
  function update(dt) {
    if (ui && ui.tick) ui.tick(dt);
    if (!player || player.car || ui) return;
    const px = player.x, pz = player.z;
    const hit = STYLE_STORES.find(s => Math.hypot(s.x - px, s.z - pz) < 3.2) || null;
    const fresh = hit && hit !== inside;
    inside = hit;
    if (!fresh || busy()) return;
    onOpen();
    ui = openMenu({
      store: hit, player, showMsg,
      onClose: () => { ui = null; onClose(); },
    });
  }
  const api = {
    update,
    stores: STYLE_STORES,
    open: (id) => {
      const s = STYLE_STORES.find(t => t.id === id || t.name === id); if (!s || ui) return;
      onOpen(); ui = openMenu({ store: s, player, showMsg, onClose: () => { ui = null; onClose(); } });
    },
    close: () => { if (ui && ui.close) ui.close(); },
  };
  if (typeof window !== 'undefined') window.__vbStyle = api;
  return api;
}
