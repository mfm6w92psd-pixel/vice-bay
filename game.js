// Vice Bay — Stage 1 core gameplay (New Bot). Art/audio by Mika in ./assets.
import * as THREE from 'three';
import * as M from './assets/models.js';
import { GameAudio } from './assets/audio.js';
import * as V from './assets/vehicles.js';
import { buildPortCoral } from './assets/neighborhoods.js';
import { TrafficLights } from './assets/trafficlights.js';
import { buildFreeway } from './assets/freeway.js';
import { buildInterstate } from './assets/interstates.js';
import { buildAirport, buildSmallTown, makeJet } from './assets/districts.js';
import { buildSwamp, buildDowntown, makeAirboat } from './assets/regions.js';
import { buildCity } from './assets/cities.js';
import { setupGraphics } from './assets/graphics.js';
import { createNet } from './net.js';
import { makeNPC, pickNPCType, animateNPC, setNPCPanic } from './assets/npcs.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const $ = id => document.getElementById(id);
const audio = new GameAudio();
const SAVE_KEY = 'vicebay_save_v1', SET_KEY = 'vicebay_settings_v1';
const settings = Object.assign({ quality: 'medium', volume: 0.6, radio: true, station: 0, rain: 'auto', leftHanded: false, btnScale: 1, sens: 1 },
  JSON.parse(localStorage.getItem(SET_KEY) || '{}'));
if (!settings.ultraV1) { settings.quality = 'ultra'; settings.ultraV1 = true; try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {} }
const saveSettings = () => localStorage.setItem(SET_KEY, JSON.stringify(settings));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const fwd = h => [-Math.sin(h), -Math.cos(h)];
const headingOf = (dx, dz) => Math.atan2(-dx, -dz);
let seed = 1337; const srand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 60, 240);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 420);
const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0c0, 2); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
scene.add(sun, sun.target);
// ---------- ULTRA graphics: physical sky, sky reflections, bloom, ACES color, soft shadows, FXAA ----------
// ---------- graphics: Mika's sky/reflections/materials (assets/graphics.js) + ULTRA bloom & FXAA ----------
let gfx = null;
const ULTRA = { on: false, composer: null, bloom: null, fxaa: null };
function ultraSetup() {
  if (ULTRA.composer) return;
  const c = new EffectComposer(renderer); c.addPass(new RenderPass(scene, camera));
  ULTRA.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.45, 0.9); c.addPass(ULTRA.bloom);
  c.addPass(new OutputPass()); ULTRA.fxaa = new ShaderPass(FXAAShader); c.addPass(ULTRA.fxaa); ULTRA.composer = c;
}
function drawFrame() { if (ULTRA.on && ULTRA.composer) ULTRA.composer.render(); else renderer.render(scene, camera); }
function applyQuality() {
  const q = settings.quality, ultra = q === 'ultra', wasUltra = ULTRA.on;
  if (ultra) ultraSetup(); ULTRA.on = ultra;
  renderer.shadowMap.type = (ultra || q === 'high') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.shadow.bias = ultra ? -0.0004 : 0; sun.shadow.normalBias = ultra ? 0.03 : 0;
  Object.assign(sun.shadow.camera, ultra ? { left: -70, right: 70, top: 70, bottom: -70, far: 220 } : { left: -45, right: 45, top: 45, bottom: -45, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
  if (wasUltra !== ultra) { renderer.shadowMap.needsUpdate = true; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1 : q === 'medium' ? 1.5 : q === 'ultra' ? 1.75 : 2));
  const sh = q !== 'low';
  if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  sun.castShadow = sh; sun.shadow.mapSize.setScalar(q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  camera.far = q === 'low' ? 200 : q === 'medium' ? 300 : 420; if (gfx) gfx.sky.scale.setScalar(Math.max(100, camera.far * 0.9)); camera.updateProjectionMatrix();
  baseFogFar = q === 'low' ? 150 : q === 'medium' ? 230 : q === 'ultra' ? 400 : 380;
  resize();
}
let baseFogFar = 230;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  if (ULTRA.composer) { ULTRA.composer.setPixelRatio(renderer.getPixelRatio()); ULTRA.composer.setSize(innerWidth, innerHeight); const pr = renderer.getPixelRatio(); ULTRA.fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); ULTRA.bloom.setSize(innerWidth / 2, innerHeight / 2); }
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  $('rotate').classList.toggle('need', innerHeight > innerWidth);
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 300));

// ---------- world ----------
const N = 6, B = 60, HALF = N * B / 2, RW = 14, LOT = B - RW, LANE = 3.5;
const lines = []; for (let k = 0; k <= N; k++) lines.push(-HALF + k * B);
const SHORE = 222, CAR_MAX_X = 224, FOOT_MAX_X = 320, EDGE = HALF + 16;
const colliders = [];
const addCol = (x, z, w, d, h = 12) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), M.mat(0x7fbf7a));
ground.position.set(-2000, -0.02, 0); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// beach + ocean
const sand = new THREE.Mesh(new THREE.PlaneGeometry(SHORE - HALF + 10, 7250), M.mat(0xf2dca0));
sand.rotation.x = -Math.PI / 2; sand.position.set((HALF + SHORE) / 2 + 2, 0.015, 1975); sand.receiveShadow = true; scene.add(sand);
const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 7250), new THREE.MeshStandardMaterial({ color: 0x1fa3c9, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 }));
water.rotation.x = -Math.PI / 2; water.position.set(SHORE + 300, 0.05, 1975); scene.add(water);

function roadTexture(alongU) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#3a3a40'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  x.fillStyle = '#f5d142'; x.fillStyle = '#f5d142';
  if (alongU) { for (let i = 0; i < 128; i += 32) x.fillRect(i, 62, 18, 4); x.fillStyle = '#ddd'; x.fillRect(0, 6, 128, 3); x.fillRect(0, 119, 128, 3); }
  else { for (let i = 0; i < 128; i += 32) x.fillRect(62, i, 4, 18); x.fillStyle = '#ddd'; x.fillRect(6, 0, 3, 128); x.fillRect(119, 0, 3, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const roadMats = [];
{
  const L = 2 * HALF + RW, reps = L / RW;
  const tu = roadTexture(true); tu.repeat.set(reps, 1);
  const tv = roadTexture(false); tv.repeat.set(1, reps);
  const mu = new THREE.MeshStandardMaterial({ map: tu, roughness: 0.9 }), mv = new THREE.MeshStandardMaterial({ map: tv, roughness: 0.9 });
  roadMats.push(mu, mv);
  for (const v of lines) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(L, RW), mu); h.rotation.x = -Math.PI / 2; h.position.set(0, 0.03, v); h.receiveShadow = true; scene.add(h);
    const vv = new THREE.Mesh(new THREE.PlaneGeometry(RW, L), mv); vv.rotation.x = -Math.PI / 2; vv.position.set(v, 0.035, 0); vv.receiveShadow = true; scene.add(vv);
  }
  // beach road / boardwalk connector already covered by edge lines
}

function makeSign(text, bg = '#ff5e7e') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = 'bold 36px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: t }));
}

const lots = [];
const POI = {};
const SPECIAL = { '1,4': ['hospital', 'HOSPITAL', '#2b6cff', 0xe8f0ff], '4,1': ['spray', 'SPRAY SHOP', '#00a86b', 0xcaffbf], '2,3': ['safe', 'SAFEHOUSE', '#8a5cff', 0xe4c1f9], '3,1': ['police', 'POLICE', '#1d3557', 0xbde0fe] };
const PARKS = new Set(['3,3', '0,1', '5,4']);
const streetLights = [];
const sidewalkMat = M.mat(0xc9c4b8), parkMat = M.mat(0x5fae5a);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const cx = -HALF + (i + 0.5) * B, cz = -HALF + (j + 0.5) * B, key = `${i},${j}`;
  const lot = { i, j, cx, cz }; lots.push(lot);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(LOT, 0.2, LOT), sidewalkMat); sw.position.set(cx, 0.1, cz); sw.receiveShadow = true; scene.add(sw);
  if (PARKS.has(key)) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(LOT - 6, 0.25, LOT - 6), parkMat); g.position.set(cx, 0.12, cz); g.receiveShadow = true; scene.add(g);
    for (let k = 0; k < 9; k++) { const p = M.makePalm(); p.position.set(cx + rand(-17, 17), 0.2, cz + rand(-17, 17)); scene.add(p); }
    lot.park = true;
  } else if (SPECIAL[key]) {
    const [id, label, bg, col] = SPECIAL[key];
    const b = M.makeBuilding(30, 12, 26, col); b.position.set(cx, 0.2, cz - 2); scene.add(b); addCol(cx, cz - 2, 30, 26);
    const s = makeSign(label, bg); s.position.set(cx, 8, cz - 2 + 13.05); scene.add(s);
    POI[id] = { x: cx, z: cz + LOT / 2 + 3, label, color: bg };
  } else {
    const down = 1 - Math.hypot(cx, cz) / 300, beach = i === N - 1;
    for (const ox of [-9.5, 9.5]) for (const oz of [-9.5, 9.5]) {
      if (srand() < 0.12) continue;
      const w = 11 + srand() * 6, d = 11 + srand() * 6;
      const h = beach ? 6 + srand() * 14 : 7 + srand() * 55 * Math.max(0.15, down) + (srand() < 0.15 ? 30 * down : 0);
      const b = M.makeBuilding(w, h, d); b.position.set(cx + ox, 0.2, cz + oz); scene.add(b); addCol(cx + ox, cz + oz, w, d, h + 0.2);
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, 1]]) if (srand() < 0.6) { const p = M.makePalm(); p.position.set(cx + sx * 21.8, 0.2, cz + sz * 21.8); scene.add(p); }
  if (srand() < 0.7) { const l = M.makeStreetLight(); l.position.set(cx + 21.8, 0.2, cz - 21.8); l.rotation.y = Math.PI / 4; scene.add(l); streetLights.push(l); }
}
// beach palms & boardwalk props
for (let z = -HALF; z <= HALF; z += 18) { const p = M.makePalm(); p.position.set(HALF + 20 + rand(-3, 3), 0, z + rand(-4, 4)); scene.add(p); }
// city edge: low hills + trees as soft boundary
for (let k = 0; k < 60; k++) {
  const side = k % 3, t = rand(-HALF - 20, HALF + 20);
  const p = M.makePalm(9 + Math.random() * 4);
  if (side === 0) p.position.set(-HALF - 44 - rand(0, 25), 0, t); else if (side === 1) { if (t > -85 && t < 115) continue; p.position.set(t, 0, -HALF - 22 - rand(0, 30)); } else { if (Math.abs(t) < 24) continue; p.position.set(t, 0, HALF + 82 + rand(0, 30)); }
  scene.add(p);
}
POI.beach = { x: SHORE - 8, z: 30, label: 'BEACH SHACK' };
{ const shack = M.makeBuilding(8, 4, 6, 0xffd6a5); shack.position.set(SHORE - 6, 0, 18); scene.add(shack); addCol(SHORE - 6, 18, 8, 6); }
// ---------- Port Coral (Mika's second neighborhood), north of the city ----------
const port = buildPortCoral(scene, { x: 10, z: -300, addCol });
port.water.position.y = 0.03;
for (const z of [-197, -213]) { const r = M.makeRoad(20, false); r.position.set(0, 0.012, z); scene.add(r); }
const PORT = { minX: -72, maxX: 110, minZ: -385, maxZ: -180 };
const inPort = (x, z) => x >= PORT.minX && x <= PORT.maxX && z >= PORT.minZ && z <= PORT.maxZ;
const inWater = (x, z) => (x > SHORE + 2 && z > -1650 && z < 5600) || inSwampWater(x, z) || (x >= port.waterRect.minX + 5 && x <= port.waterRect.maxX && z >= port.waterRect.minZ && z <= port.waterRect.maxZ);
const allowedAt = (x, z, foot) => inFwZone(x, z) || inIsZone(x, z) || inHw(x, z) || (x >= -EDGE - (foot ? 30 : 0) && x <= (foot ? FOOT_MAX_X : FOOT_MAX_X) && z >= -EDGE - (foot ? 30 : 0) && z <= EDGE + (foot ? 30 : 0)) || inPort(x, z);
POI.garage = { x: port.pois.garage.x, z: port.pois.garage.z, label: 'PORT CORAL CUSTOMS' };
POI.diner = { x: port.pois.diner.x, z: port.pois.diner.z, label: 'CORAL DINER' };
POI.gas = { x: port.pois.gasStation.x, z: port.pois.gasStation.z, label: 'FUEL' };
POI.dock = { x: port.pois.dock.x, z: port.pois.dock.z, label: 'DOCK' };
const HELIPADS = [[-52, -275], [HALF + 26, -120]];
for (const [x, z] of HELIPADS) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(6, 24), M.mat(0x333a44)); pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.03, z); scene.add(pad);
  const hm = makeSign('H', '#333a44'); hm.rotation.x = -Math.PI / 2; hm.scale.set(0.5, 1.6, 1); hm.position.set(x, 0.05, z); scene.add(hm);
}
// ---------- Vice Bay Expressway (Mika's freeway) along the west edge ----------
const FW = { x: -205, z0: -340, z1: 205, W: 18, H: 9 };
const fw = buildFreeway(scene, { x: FW.x, z0: FW.z0, z1: FW.z1, addCol: (x, z, w, d) => addCol(x, z, w, d, w >= FW.W ? 4 : FW.H - 1.6) });
for (const s of [-1, 1]) addCol(FW.x + s * (FW.W / 2 + 1.2), (FW.z0 + FW.z1) / 2, 0.6, FW.z1 - FW.z0 - 20, 99);
{ const am = M.mat(0x3a3a40);
  const n = new THREE.Mesh(new THREE.PlaneGeometry(146, 20), am); n.rotation.x = -Math.PI / 2; n.position.set(-143, 0.013, FW.z0 - 1); n.receiveShadow = true; scene.add(n);
  const so = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), am); so.rotation.x = -Math.PI / 2; so.position.set(-193, 0.013, 200); so.receiveShadow = true; scene.add(so); }
const inFwZone = (x, z) => (x >= FW.x - FW.W / 2 - 1 && x <= -180 && z >= FW.z0 - 12 && z <= FW.z1 + 12) || (x >= -217 && x <= -66 && z >= FW.z0 - 12 && z <= FW.z0 + 10) || (x >= -217 && x <= -168 && z >= 180 && z <= 216);
// surface height under a thing at (x,z) that is currently at height y (ramp/deck vs. ground underneath)
const surfaceY = (x, z, y = 0) => { if (inRect(SWAMP, x, z) && onSwampRoad(x, z)) return 0.45; const h = fw.heightAt(x, z); return h > 0 && y + 1.6 >= h ? h : 0; };
// ---------- Interstate 395 spur along the south edge (ground level, 4 lanes + median) ----------
const IS = { z: 240, W: 26, x0: -216, x1: 196, cons: [0, 120] };
const isShield = (num) => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(8, 10); g.lineTo(120, 10); g.quadraticCurveTo(124, 70, 64, 122); g.quadraticCurveTo(4, 70, 8, 10); g.fill();
  g.fillStyle = '#1d4fb8'; g.beginPath(); g.moveTo(14, 38); g.lineTo(114, 38); g.quadraticCurveTo(116, 74, 64, 114); g.quadraticCurveTo(12, 74, 14, 38); g.fill();
  g.fillStyle = '#c8102e'; g.fillRect(14, 16, 100, 20); g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('INTERSTATE', 64, 31);
  g.font = `bold ${num.length > 2 ? 38 : 46}px Arial`; g.fillText(num, 64, 92); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const isGreen = (lines) => { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#0b6b3a'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 148); g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 50px Arial'; g.fillText(lines[0], 256, 66); g.font = 'bold 36px Arial'; g.fillText(lines[1], 256, 124); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
{
  const L = IS.x1 - IS.x0 + 16, cx = (IS.x0 + IS.x1) / 2 + 8;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#34343a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#f2c230'; g.fillRect(0, 8, 256, 4); g.fillRect(0, 244, 256, 4);
  g.fillStyle = '#fff'; for (const y of [68, 188]) for (let x = 0; x < 256; x += 64) g.fillRect(x, y - 2, 34, 4);
  g.fillStyle = '#f2c230'; g.fillRect(0, 118, 256, 3); g.fillRect(0, 135, 256, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(L / 26, 1); t.colorSpace = THREE.SRGBColorSpace;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, IS.W), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(cx, 0.02, IS.z); road.receiveShadow = true; scene.add(road);
  const am = M.mat(0x3a3a40);
  const add = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), am); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.016, z); m.receiveShadow = true; scene.add(m); };
  add(24, 36, -205, IS.z - 26);                 // VB-1 south end -> I-95
  for (const x of IS.cons) add(RW, IS.z - IS.W / 2 - 180 + 2, x, (180 + IS.z - IS.W / 2) / 2);   // city on-ramps
  add(34, 34, IS.x1 + 12, IS.z);                 // turnaround by the beach
  // median barrier (gaps at the ends and at each on-ramp so you can U-turn / merge)
  const gaps = [[IS.x0 - 10, IS.x0 + 22], ...IS.cons.map(x => [x - 10, x + 10]), [IS.x1 - 6, IS.x1 + 40]];
  let sx = IS.x0 + 22; for (const [a, b] of gaps.slice(1)) { const w = a - sx; if (w > 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.6), M.mat(0xd2d2d2)); m.position.set(sx + w / 2, 0.45, IS.z); m.castShadow = true; scene.add(m); addCol(sx + w / 2, IS.z, w, 0.6, 0.9); } sx = b; }
  // outer guard rails (south side everywhere, north side except at on-ramps)
  const rail = (x0, x1, z) => { const w = x1 - x0; if (w < 2) return; const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.3), M.mat(0xb8bcc2)); m.position.set((x0 + x1) / 2, 0.55, z); scene.add(m); addCol((x0 + x1) / 2, z, w, 0.4, 1); };
  rail(IS.x0 + 6, -16, IS.z + IS.W / 2 + 0.6); rail(16, IS.x1 + 28, IS.z + IS.W / 2 + 0.6);
  let rx = IS.x0 + 14; for (const x of [...IS.cons, IS.x1 + 30]) { rail(rx, x - RW / 2 - 1, IS.z - IS.W / 2 - 0.6); rx = x + RW / 2 + 1; }
  // shields and overhead signs
  const sm = new THREE.MeshBasicMaterial({ map: isShield('395'), transparent: true, side: THREE.DoubleSide });
  const shieldAt = (x, z, ry) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), M.mat(0x777777)); p.position.set(x, 2, z); scene.add(p); const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), sm); s.position.set(x, 4.6, z); s.rotation.y = ry; scene.add(s); };
  for (const x of IS.cons) { shieldAt(x + RW / 2 + 1.5, 200, 0); shieldAt(x - RW / 2 - 1.5, 200, 0); }
  shieldAt(-190, 214, 0); shieldAt(-120, IS.z + IS.W / 2 + 2, Math.PI); shieldAt(60, IS.z + IS.W / 2 + 2, Math.PI); shieldAt(60, IS.z - IS.W / 2 - 2, 0);
  const gantry = (x, east, west) => {
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), M.mat(0x666666)); p.position.set(x, 4, IS.z + s * (IS.W / 2 + 1)); scene.add(p); addCol(x, IS.z + s * (IS.W / 2 + 1), 0.6, 0.6, 8); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, IS.W + 2), M.mat(0x666666)); beam.position.set(x, 7.8, IS.z); scene.add(beam);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ map: isGreen(east) })); e.position.set(x - 0.3, 6.1, IS.z + IS.W / 4); e.rotation.y = -Math.PI / 2; scene.add(e);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ map: isGreen(west) })); w.position.set(x + 0.3, 6.1, IS.z - IS.W / 4); w.rotation.y = Math.PI / 2; scene.add(w);
  };
  gantry(-150, ['I-395 EAST', 'I-95 South  1 km'], ['I-395 WEST', 'VB-1 North  ↑']);
  gantry(60, ['I-395 EAST', 'Vice Bay Beach'], ['I-395 WEST', 'I-95 South  ←']);
  gantry(170, ['I-395 EAST', 'END  1 km'], ['I-395 WEST', 'I-95 / VB-1']);
}
const inIsZone = (x, z) => (x >= IS.x0 - 2 && x <= IS.x1 + 30 && z >= IS.z - IS.W / 2 - 1 && z <= IS.z + IS.W / 2 + 1) || (x >= IS.x1 - 6 && x <= IS.x1 + 30 && Math.abs(z - IS.z) <= 18) || (x >= -217 && x <= -192 && z >= 196 && z <= IS.z) || IS.cons.some(c => Math.abs(x - c) <= RW / 2 && z >= 180 && z <= IS.z);
// Mika's long-distance interstates out to the countryside
const HWS = [
  buildInterstate(scene, { number: 95, name: 'Vice Bay', points: [[0, IS.z + IS.W / 2], [0, 700], [-150, 1000], [-150, 1700]], addCol }),
  buildInterstate(scene, { number: 75, name: 'Port Coral', points: [[-150, FW.z0 - 11], [-150, -700], [100, -1000], [100, -1700]], addCol, startMile: 20 }),
  buildInterstate(scene, { number: 295, name: 'West Bypass', points: [[-700, FW.z0 - 1], [-700, 850], [-150, 1000]], addCol }),
  buildInterstate(scene, { number: 10, name: 'Vice Bay', points: [[-216, FW.z0 - 1], [-700, FW.z0 - 1], [-1000, -41], [-1700, -41]], addCol }),
];
// Mika's districts at the far ends of I-10 and I-95
const airport = buildAirport(scene, { x: -1970, z: -211, addCol });
const town = buildSmallTown(scene, { x: -150, z: 1850, addCol });
const AIR = { minX: -2232, maxX: -1698, minZ: -393, maxZ: -29 }, TOWN = { minX: -312, maxX: 12, minZ: 1688, maxZ: 2012 };
const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
// Mika's regions: Gator Glades at the top of I-75, Vice Bay Heights downtown west of VB-1
const swamp = buildSwamp(scene, { x: 100, z: -1900, addCol });
const downtown = buildDowntown(scene, { x: -450, z: 0, addCol });
const SWAMP = { minX: -122, maxX: 322, minZ: -2112, maxZ: -1688 }, DT = { minX: -622, maxX: -278, minZ: -172, maxZ: 172 };
const SWROADS = swamp.streets;
const onSwampRoad = (x, z) => SWROADS.some(r => inRect(r, x, z));
function inSwampWater(x, z) { return inRect(SWAMP, x, z) && swamp.waterRects.some(r => inRect(r, x, z)) && !onSwampRoad(x, z); }
// connector roads into Vice Bay Heights
const LINKS = [
  { name: 'Heights Ave', minX: -460, maxX: -440, minZ: -330, maxZ: -165 },
  { name: 'Heights Ave', minX: -460, maxX: -440, minZ: 165, maxZ: 250 },
  { name: 'Heights Blvd', minX: -460, maxX: -214, minZ: 230, maxZ: 250 },
  { name: 'Glades Pkwy', minX: -712, maxX: -615, minZ: -10, maxZ: 10 },
];
for (const r of LINKS) {
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ, along = w > d, t = roadTexture(along); t.repeat.set(along ? w / 20 : 1, along ? 1 : d / 20);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set((r.minX + r.maxX) / 2, 0.025, (r.minZ + r.maxZ) / 2); m.receiveShadow = true; scene.add(m);
}
// 5x world: four satellite cities linked by interstate extensions
const CITIES = [
  buildCity(scene, { name: 'Sunrise City', x: -150, z: 4700, seed: 3, addCol }),
  buildCity(scene, { name: 'Cypress Point', x: 100, z: -4700, seed: 7, addCol }),
  buildCity(scene, { name: 'Lake Mirage', x: -4700, z: 850, seed: 11, addCol }),
  buildCity(scene, { name: 'Pine Ridge', x: -4700, z: -2600, seed: 19, addCol }),
];
const npcLots = [];
// NPC sidewalks for the newer areas: city blocks, downtown blocks, and small stroll loops at district spawn points
for (const c of CITIES) { const L = c.lines; for (let i = 0; i < L.length - 1; i++) for (let j = 0; j < L.length - 1; j++) npcLots.push({ cx: c.center.x + (L[i] + L[i + 1]) / 2, cz: c.center.z + (L[j] + L[j + 1]) / 2, h: (L[i + 1] - L[i] - 14) / 2 - 1.5 }); }
{ const L = [-160, -80, 0, 80, 160]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) npcLots.push({ cx: -450 + (L[i] + L[i + 1]) / 2, cz: (L[j] + L[j + 1]) / 2, h: 28.5 }); }
for (const d of [airport, town, swamp]) for (const q of (d.spawns?.pedestrians || [])) npcLots.push({ cx: q.x, cz: q.z, h: 2 + Math.random() * 2 });
HWS.push(
  buildInterstate(scene, { number: 95, name: 'Sunrise City', points: [[-150, 2000], [-150, 3000], [100, 3600], [-150, 4100], [-150, 4373]], addCol, startMile: 30 }),
  buildInterstate(scene, { number: 75, name: 'Cypress Point', points: [[100, -2100], [100, -3000], [-200, -3600], [100, -4100], [100, -4373]], addCol, startMile: 45 }),
  buildInterstate(scene, { number: 4, name: 'Lake Mirage', points: [[-700, 850], [-1600, 850], [-2400, 1250], [-3500, 1250], [-4000, 850], [-4373, 850]], addCol }),
  buildInterstate(scene, { number: 275, name: 'Pine Ridge', points: [[-4700, 523], [-4700, -500], [-4400, -1300], [-4700, -2000], [-4700, -2273]], addCol }),
);
const inHw = (x, z) => CITIES.some(c => c.inside(x, z)) || inRect(SWAMP, x, z) || inRect(DT, x, z) || LINKS.some(r => inRect(r, x, z)) || inRect(AIR, x, z) || inRect(TOWN, x, z) || HWS.some(h => h.nearest(x, z).dist < h.width / 2 + 2);
const isLanes = [{ z: IS.z + 3.2, dir: 1 }, { z: IS.z + 9, dir: 1 }, { z: IS.z - 3.2, dir: -1 }, { z: IS.z - 9, dir: -1 }];
// ---------- traffic lights at every grid crossing ----------
const tl = new TrafficLights(scene);
for (const ix of lines) for (const iz of lines) if (Math.abs(ix) < HALF && Math.abs(iz) < HALF) tl.addIntersection(ix, iz, RW);
const poiMarkers = {};
for (const [id, p] of Object.entries(POI)) {
  if (['beach', 'gas', 'dock'].includes(id)) continue;
  const m = M.makeMarker(id === 'spray' || id === 'garage' ? 0x2ee59d : id === 'hospital' ? 0x4d8bff : id === 'safe' ? 0xb388ff : id === 'diner' ? 0xff9f1c : 0xff4d4d);
  m.position.set(p.x, 1.5, p.z); m.scale.set(1.4, 0.6, 1.4); scene.add(m); poiMarkers[id] = m;
}

const COLG = { n: -1, map: new Map(), S: 100 };
function colCellsNear(x, z, r) { const S = COLG.S; if (Math.floor((x - r) / S) === Math.floor((x + r) / S) && Math.floor((z - r) / S) === Math.floor((z + r) / S)) return colCell(x, z); const set = new Set(); for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) for (const c of colCell(x + dx, z + dz)) set.add(c); return set; }
function colCell(x, z) {
  if (COLG.n !== colliders.length) { COLG.map.clear(); COLG.n = colliders.length; const S = COLG.S;
    for (const c of colliders) for (let i = Math.floor(c.minX / S); i <= Math.floor(c.maxX / S); i++) for (let j = Math.floor(c.minZ / S); j <= Math.floor(c.maxZ / S); j++) { const k = i * 100000 + j; let a = COLG.map.get(k); if (!a) COLG.map.set(k, a = []); a.push(c); } }
  return COLG.map.get(Math.floor(x / COLG.S) * 100000 + Math.floor(z / COLG.S)) || [];
}
function collideCircle(x, z, r, y = 0) {
  for (const c of (r < 20 ? colCellsNear(x, z, r) : colliders)) {
    if (y > c.h) continue;
    const nx = clamp(x, c.minX, c.maxX), nz = clamp(z, c.minZ, c.maxZ), dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r) {
      if (dx === 0 && dz === 0) { // inside: push out along shortest axis
        const pl = [x - c.minX, c.maxX - x, z - c.minZ, c.maxZ - z], m = Math.min(...pl), k = pl.indexOf(m);
        return { c, px: k === 0 ? -(m + r) : k === 1 ? m + r : 0, pz: k === 2 ? -(m + r) : k === 3 ? m + r : 0 };
      }
      const d = Math.sqrt(dx * dx + dz * dz), p = r - d;
      return { c, px: dx / d * p, pz: dz / d * p };
    }
  }
  return null;
}
function insideAny(x, z, r = 0.5) { return !!collideCircle(x, z, r); }
function roadPointNear(x, z, minD, maxD) {
  for (let tries = 0; tries < 40; tries++) {
    const ax = Math.random() < 0.5 ? 0 : 1, line = pick(lines), s = Math.random() < 0.5 ? 1 : -1;
    const along = rand(-HALF, HALF), cross = line + (ax === 0 ? LANE * s : -LANE * s);
    const px = ax === 0 ? along : cross, pz = ax === 0 ? cross : along, d = Math.hypot(px - x, pz - z);
    if (d >= minD && d <= maxD) return { x: px, z: pz, ax, s };
  }
  return null;
}

// ---------- street names ----------
const AVES = ['Mangrove Ave', 'Coral Way', 'Flamingo Ave', 'Biscayne Blvd', 'Palmetto Ave', 'Neon Ave', 'Ocean Drive']; // north-south roads, west to east
const STREETS = ['1st Street', 'Sunset Street', 'Hibiscus Street', 'Vice Street', 'Marlin Street', 'Pelican Street', 'Harbor Street']; // east-west roads, north to south
function streetSign(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d');
  x.fillStyle = '#0b6e3a'; x.fillRect(0, 0, 256, 48); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 42);
  x.fillStyle = '#fff'; x.font = 'bold 28px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
}
{
  const signCache = {}; const getSign = t => (signCache[t] ||= streetSign(t));
  const postMat = M.mat(0x555555), postGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6);
  lines.forEach((lx, i) => lines.forEach((lz, j) => {
    const px = lx + (i === N ? -8.2 : 8.2), pz = lz + (j === N ? -8.2 : 8.2);
    const post = new THREE.Mesh(postGeo, postMat); post.position.set(px, 1.8, pz); scene.add(post);
    const a = getSign(AVES[i]).clone(); a.position.set(px, 3.4, pz); a.rotation.y = Math.PI / 2; scene.add(a); // readable from the avenue
    const st = getSign(STREETS[j]).clone(); st.position.set(px, 3.0, pz); scene.add(st);
  }));
}
function streetName(x, z) {
  for (const c of CITIES) if (c.inside(x, z)) { const s = c.streetAt(x, z); return s ? s + ', ' + c.name : c.name; }
  if (inRect(DT, x, z)) { const s = downtown.streetAt(x, z); return s ? s + ', Vice Bay Heights' : 'Vice Bay Heights'; }
  if (inRect(SWAMP, x, z)) { const s = swamp.streetAt(x, z); return s ? s + ', Gator Glades' : 'Gator Glades'; }
  for (const r of LINKS) if (inRect(r, x, z)) return r.name;
  if (inRect(AIR, x, z)) { const s = airport.streetAt(x, z); return s ? s + ', Vice Bay Intl' : 'Vice Bay International Airport'; }
  if (inRect(TOWN, x, z)) { const s = town.streetAt(x, z); return s ? s + ', Palmetto Springs' : 'Palmetto Springs'; }
  if (fw.onDeck(x, z) && fw.heightAt(x, z) > 0) return 'Vice Bay Expressway (VB-1 / I-195)';
  if (inFwZone(x, z) && x < -183 && z < 196) return 'VB-1 Ramp';
  for (const h of HWS) if (h.onRoad(x, z)) return `Interstate ${h.number}`;
  if (inIsZone(x, z)) return z > IS.z - IS.W / 2 - 1 ? (x > IS.x1 - 6 ? 'I-395 Turnaround' : 'Interstate 395') : 'I-395 On-Ramp';
  if (z < -EDGE + 4) { const ps = port.streetAt(x, z); if (ps) return ps + ', Port Coral'; if (inWater(x, z)) return 'Port Coral Harbor'; if (z < -222) return 'Port Coral'; return 'Dockside Ave'; }
  let bi = 0, bj = 0; lines.forEach((l, k) => { if (Math.abs(l - x) < Math.abs(lines[bi] - x)) bi = k; if (Math.abs(l - z) < Math.abs(lines[bj] - z)) bj = k; });
  const dx = Math.abs(lines[bi] - x), dz = Math.abs(lines[bj] - z);
  if (x > HALF + 12) return x > SHORE ? 'Vice Bay Beach (water)' : 'Vice Bay Beach';
  if (dx < 9 && dz < 9) return `${AVES[bi]} & ${STREETS[bj]}`;
  if (dx < 9) return AVES[bi]; if (dz < 9) return STREETS[bj];
  return dx < dz ? AVES[bi] : STREETS[bj];
}

// ---------- vehicles ----------
const vehicles = [];
const burnt = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1, flatShading: true });
function addVehicle(type, x, z, heading, opts = {}) {
  const police = type === 'police';
  const mesh = opts.mesh || (police ? M.makePoliceCar() : M.makeCar(opts.color));
  if (opts.sports && !opts.mesh) mesh.scale.set(1.05, 0.85, 1.1);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading; scene.add(mesh);
  const ud = mesh.userData || {}, st = ud.stats || { speed: 1, accel: 1, grip: 1 }, kind = ud.type || 'car';
  const KN = { jet: 'Jetliner', sports: 'Vortex S', bike: 'Zephyr Bike', truck: 'Hauler Truck', bus: 'Metro Bus', boat: 'Wave Runner', heli: 'Skyhopper' };
  if (!opts.name && KN[kind]) opts.name = KN[kind];
  const v = { mesh, type, kind, grip: st.grip, y: 0, vy: 0, x, z, heading, speed: 0, health: kind === 'truck' || kind === 'bus' ? 160 : kind === 'bike' ? 70 : 100,
    maxSpeed: opts.sports ? 46 : police ? 36 : 30 * st.speed, accel: opts.sports ? 20 : 14 * st.accel,
    sports: !!opts.sports, ax: 0, s: 1, plan: null, reverseT: 0, burnT: 0, dead: false, wreckT: 0, color: opts.color, name: opts.name || (police ? 'Police Cruiser' : pick(['Coaster', 'Palmetto', 'Breeze', 'Sunline', 'Marlin', 'Dune'])) };
  vehicles.push(v); return v;
}
function removeVehicle(v) { scene.remove(v.mesh); const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); }
// fixed spawns: Port Coral's parked vehicles + boats, helicopters on helipads, a speedboat at the beach
const portMakers = [() => V.makeTruck(), () => V.makeTruck(0xd62828, 0x264653), () => V.makeBus(), () => V.makeMotorcycle(0xff2d6f), () => V.makeSportsCar(0xffd23f), () => M.makeCar()];
const FIXED = [];
port.vehicles.forEach((m, i) => { const wp = new THREE.Vector3(); m.getWorldPosition(wp); port.root.remove(m); FIXED.push({ x: wp.x, z: wp.z, h: m.rotation.y, make: portMakers[i] || (() => M.makeCar()), first: m, hauler: i === 1 }); });
const distMake = m => { const t = m.userData?.type; return t === 'jet' ? () => makeJet(0x8a5cff) : t === 'heli' ? () => V.makeHelicopter(0xff7a1a) : t === 'bus' ? () => V.makeBus(0x003f87) : t === 'truck' ? () => V.makeTruck(0x2d6a4f, 0xff9f1c) : t === 'bike' ? () => V.makeMotorcycle(0x111111) : t === 'sports' ? () => V.makeSportsCar(0x19c3ff) : () => M.makeCar(); };
for (const c of CITIES) for (const [x, z, h] of c.parking) FIXED.push({ x, z, h, make: () => M.makeCar() });
swamp.boats.forEach(m => { const wp = new THREE.Vector3(); m.getWorldPosition(wp); swamp.root.remove(m); m.userData.type = 'boat'; FIXED.push({ x: wp.x, z: wp.z, h: m.rotation.y, make: () => { const b = makeAirboat(); b.userData.type = 'boat'; return b; }, first: m }); });
for (const m of downtown.vehicles) { const wp = new THREE.Vector3(); m.getWorldPosition(wp); downtown.root.remove(m); const t = m.userData?.type; if (t === 'heli') wp.set(downtown.pois.plaza.x + 14, 0, downtown.pois.plaza.z + 14); FIXED.push({ x: wp.x, z: wp.z, h: m.rotation.y, make: t === 'heli' ? () => V.makeHelicopter() : t === 'bus' ? () => V.makeBus() : t === 'sports' ? () => V.makeSportsCar() : () => M.makeCar(), first: m }); }
for (const d of [swamp, airport, town]) d.vehicles.filter(m => !swamp.boats.includes(m)).forEach(m => { const wp = new THREE.Vector3(); m.getWorldPosition(wp); d.root.remove(m); FIXED.push({ x: wp.x, z: wp.z, h: m.rotation.y, make: distMake(m), first: m }); });
port.boats.forEach((m, i) => { const wp = new THREE.Vector3(); m.getWorldPosition(wp); port.root.remove(m); FIXED.push({ x: wp.x, z: wp.z, h: m.rotation.y + Math.PI, make: () => V.makeBoat(), first: m }); });
FIXED.push({ x: SHORE + 10, z: 40, h: -Math.PI / 2, make: () => V.makeBoat(0xff2d6f, 0x111111) }, { x: SHORE + 10, z: -60, h: -Math.PI / 2, make: () => V.makeBoat(0x2ee59d, 0xffd23f) });
for (const [x, z] of HELIPADS) FIXED.push({ x, z, h: 0, make: () => V.makeHelicopter(0xffd23f) });
function ensureFixed(force) {
  const pc = force ? null : (player.car || player), px = pc ? pc.x : 0, pz = pc ? pc.z : 0;
  for (const f of FIXED) {
    if (f.v && vehicles.includes(f.v) && !f.v.dead && !f.v.burnT) continue;
    if (!force && Math.hypot(f.x - px, f.z - pz) < 90) continue;
    if (f.v && vehicles.includes(f.v) && (force || f.v !== player.car)) removeVehicle(f.v);
    f.v = addVehicle('parked', f.x, f.z, f.h, { mesh: f.first || f.make() }); f.first = null; if (f.y) f.v.y = f.y; if (f.hauler) { f.v.portHauler = true; f.v.name = 'Red Hauler'; }
  }
}
ensureFixed(true);
// traffic grids: the original city plus every newer street grid (cities, downtown)
const MAIN_GRID = { cx: 0, cz: 0, lines, B, half: HALF };
const GRIDS = [...CITIES.map(c => ({ cx: c.center.x, cz: c.center.z, lines: c.lines, B: c.lines[1] - c.lines[0], half: c.lines[c.lines.length - 1] })),
  { cx: -450, cz: 0, lines: [-160, -80, 0, 80, 160], B: 80, half: 160 }];
function gridAt(x, z, m = 0) { return GRIDS.find(G => Math.abs(x - G.cx) < G.half + m && Math.abs(z - G.cz) < G.half + m) || null; }
function gridRoadPointNear(G, x, z, minD, maxD) {
  for (let i = 0; i < 30; i++) {
    const ax = Math.random() < 0.5 ? 0 : 1, s = Math.random() < 0.5 ? 1 : -1, L = pick(G.lines.slice(1, -1).length ? G.lines : G.lines), along = rand(-G.half + 10, G.half - 10);
    const lx = ax === 0 ? along : L + laneOff(ax, s), lz = ax === 0 ? L + laneOff(ax, s) : along, wx = G.cx + lx, wz = G.cz + lz, d = Math.hypot(wx - x, wz - z);
    if (d >= minD && d <= maxD) return { x: wx, z: wz, ax, s };
  }
  return null;
}
function spawnTraffic(near) {
  const G = near ? gridAt(near.x, near.z, 140) : null;
  const p = G ? gridRoadPointNear(G, near.x, near.z, 45, 140) : near ? roadPointNear(near.x, near.z, 45, 140) : roadPointNear(0, 0, 0, 400);
  if (!p) return;
  if (vehicles.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 10)) return;
  const dx = p.ax === 0 ? p.s : 0, dz = p.ax === 1 ? p.s : 0;
  const r = Math.random(), mk = r < 0.07 ? V.makeSportsCar(pick(M.CAR_COLORS)) : r < 0.15 ? V.makeMotorcycle(pick(M.CAR_COLORS)) : r < 0.22 ? V.makeTruck() : r < 0.27 ? V.makeBus() : null;
  const v = addVehicle('traffic', p.x, p.z, headingOf(dx, dz), mk ? { mesh: mk } : {}); v.ax = p.ax; v.s = p.s; v.speed = 8; v.grid = G; if (gfx) gfx.upgrade(v.mesh);
}
const laneOff = (ax, s) => ax === 0 ? LANE * s : -LANE * s;
function updateTraffic(v, dt) {
  const G = v.grid || MAIN_GRID, ox = G.cx, oz = G.cz;
  const pos = [v.x - ox, v.z - oz], along = pos[v.ax], cross = pos[1 - v.ax];
  const [fx, fz] = [v.ax === 0 ? v.s : 0, v.ax === 1 ? v.s : 0];
  // blocked ahead?
  let target = 12;
  const check = (ox, oz, rng) => { const dx = ox - v.x, dz = oz - v.z, a = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); if (a > 0 && a < rng && lat < 2.6) target = Math.min(target, a < 6 ? 0 : 5); };
  for (const o of vehicles) if (o !== v && !o.dead) check(o.x, o.z, 11);
  if (player.mode === 'foot') check(player.x, player.z, 8);
  for (const p of peds) if (p.state !== 'dead') check(p.x, p.z, 6);
  if (G === MAIN_GRID && !tl.canGo(v.x, v.z, fx, fz)) target = 0;
  v.speed += clamp(target - v.speed, -20 * dt, 6 * dt);
  // intersection planning
  const roadC = G.lines.reduce((a, b) => Math.abs(b - (cross - laneOff(v.ax, v.s))) < Math.abs(a - (cross - laneOff(v.ax, v.s))) ? b : a);
  if (!v.plan) {
    let L = null; for (const l of G.lines) if ((l - along) * v.s > 0.5 && (L === null || Math.abs(l - along) < Math.abs(L - along))) L = l;
    if (L !== null && Math.abs(L - along) < 14) {
      const opts = [];
      if (Math.abs(L + v.s * G.B) <= G.half + 1) opts.push({ straight: true, L }, { straight: true, L });
      for (const s2 of [1, -1]) if (Math.abs(roadC + s2 * G.B) <= G.half + 1) opts.push({ s2, L, at: L + laneOff(1 - v.ax, s2) });
      v.plan = opts.length ? pick(opts) : { s2: -v.s, L, at: L };
    } else if (L === null) { v.plan = { uturn: true }; }
  }
  const step = v.speed * dt; let na = along + step * v.s;
  if (v.plan) {
    if (v.plan.uturn) { v.s = -v.s; v.plan = null; const c = roadC + laneOff(v.ax, v.s); if (v.ax === 0) v.z = c + oz; else v.x = c + ox; na = along; }
    else if (v.plan.straight) { if ((na - v.plan.L) * v.s > 8) v.plan = null; }
    else if ((na - v.plan.at) * v.s >= 0) {
      const newCross = v.plan.at; const oldAx = v.ax; v.ax = 1 - oldAx; v.s = v.plan.s2; v.plan = null;
      if (oldAx === 0) { v.x = newCross + ox; } else { v.z = newCross + oz; } na = null; v.speed *= 0.6;
    }
  }
  if (na !== null) { if (v.ax === 0) v.x = na + ox; else v.z = na + oz; }
  const th = headingOf(v.ax === 0 ? v.s : 0, v.ax === 1 ? v.s : 0);
  v.heading += wrapA(th - v.heading) * Math.min(1, dt * 8);
}
function damageVehicle(v, amt) {
  if (v.dead) return; v.health -= amt;
  if (v.health <= 0 && !v.burnT) { v.health = 0; v.burnT = v === player.car ? 4 : 2.5; }
}
function explode(v) {
  v.dead = true; v.speed = 0; v.wreckT = 40; audio.crash(1.6); boom(v.x, v.z);
  v.mesh.traverse(o => { if (o.isMesh) o.material = burnt; });
  if (player.car === v) { exitCar(true); hurt(200, 'explosion'); }
  else if (player.mode === 'foot' && Math.hypot(player.x - v.x, player.z - v.z) < 6) hurt(60);
  for (const p of peds) if (p.state !== 'dead' && Math.hypot(p.x - v.x, p.z - v.z) < 6) killPed(p, false);
  for (const o of vehicles) if (o !== v && !o.dead && Math.hypot(o.x - v.x, o.z - v.z) < 7) damageVehicle(o, 40);
}

// ---------- effects ----------
const fx = [];
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5, depthWrite: false });
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8, depthWrite: false });
const boomMat = new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.9, depthWrite: false });
const puffGeo = new THREE.SphereGeometry(0.5, 6, 4);
function puff(x, y, z, matl, life = 1.2, grow = 2, vy = 2) { if (fx.length > 80) return; const m = new THREE.Mesh(puffGeo, matl.clone()); m.position.set(x, y, z); scene.add(m); fx.push({ m, life, max: life, grow, vy }); }
function boom(x, z) { for (let i = 0; i < 6; i++) puff(x + rand(-1, 1), 1 + rand(0, 1), z + rand(-1, 1), i < 3 ? boomMat : fireMat, 0.7, 7, 3); for (let i = 0; i < 5; i++) puff(x, 2, z, smokeMat, 2.5, 4, 3); flash = 0.6; }
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffee88 });
function tracer(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, tracerMat); scene.add(l); fx.push({ m: l, life: 0.07, max: 0.07, line: true }); }
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt;
    if (!f.line) { f.m.position.y += f.vy * dt; const s = 1 + (1 - f.life / f.max) * f.grow; f.m.scale.setScalar(s); f.m.material.opacity = Math.max(0, f.life / f.max) * 0.7; }
    if (f.life <= 0) { scene.remove(f.m); if (f.line) f.m.geometry.dispose(); else f.m.material.dispose(); fx.splice(i, 1); }
  }
}

// ---------- pedestrians ----------
const peds = [];
const PH = 21.5, PER = 8 * PH;
function perim(s, h = PH) {
  const PER = 8 * h; s = ((s % PER) + PER) % PER;
  if (s < 2 * h) return [-h + s, -h, 1, 0];
  if (s < 4 * h) return [h, -h + (s - 2 * h), 0, 1];
  if (s < 6 * h) return [h - (s - 4 * h), h, -1, 0];
  return [-h, h - (s - 6 * h), 0, -1];
}
function npcArea(x, z) {
  if (inRect(DT, x, z)) return 'downtown'; if (inRect(SWAMP, x, z)) return 'swamp'; if (inRect(TOWN, x, z)) return 'town';
  if (CITIES.some(c => c.inside(x, z)) || inRect(AIR, x, z)) return 'city'; if (x > 150) return 'beach'; return 'city';
}
let callCD = 0;
function dropCash(x, z, amt) {
  if (!amt) return; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: PK.cash[0], emissive: PK.cash[0], emissiveIntensity: 0.6 }));
  m.position.set(x, 1, z); scene.add(m); pickups.push({ m, kind: 'cash', x, z, amount: amt });
}
function spawnPed(lot, far) {
  lot = lot || pick(lots);
  const mesh = makeNPC(pickNPCType(npcArea(lot.cx, lot.cz))), info = mesh.userData.npc || {};
  const p = { mesh, info, lot, s: rand(0, 8 * (lot.h || PH)), dir: Math.random() < 0.5 ? 1 : -1, speed: info.speed || rand(1.2, 1.8), state: 'walk', t: 0, x: 0, z: 0, fallT: 0, callT: 0 };
  if (gfx) gfx.upgrade(mesh);
  scene.add(p.mesh); peds.push(p); placePed(p, 0); return p;
}
function placePed(p, dt) {
  const [lx, lz, dx, dz] = perim(p.s, p.lot.h);
  p.x = p.lot.cx + lx; p.z = p.lot.cz + lz;
  p.mesh.position.set(p.x, 0.2, p.z);
  const h = headingOf(dx * p.dir, dz * p.dir); p.mesh.rotation.y += wrapA(h - p.mesh.rotation.y) * Math.min(1, dt * 10 + (dt === 0 ? 1 : 0));
}
function updatePed(p, dt) {
  if (p.state === 'dead') {
    p.t -= dt; p.fallT = Math.min(1, p.fallT + dt * 4); p.mesh.rotation.x = -Math.PI / 2 * p.fallT; p.mesh.position.y = 0.2 + 0.25 * p.fallT;
    if (p.t <= 0) { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d > 50) { scene.remove(p.mesh); peds.splice(peds.indexOf(p), 1); } }
    return;
  }
  if (p.callT > 0) { p.callT -= dt; if (p.callT <= 0 && callCD <= 0) { callCD = 25; addWanted(1, true); showMsg('📞 Someone called the cops!'); } }
  if (p.state === 'flee') { p.t -= dt; if (p.t <= 0) { p.state = 'walk'; p.speed = p.info.speed || rand(1.2, 1.8); setNPCPanic(p.mesh, false); } }
  if (p.state === 'fight') {
    p.t -= dt; p.hitT = (p.hitT || 0) - dt; const d = Math.hypot(player.x - p.x, player.z - p.z);
    p.mesh.rotation.y += wrapA(headingOf(player.x - p.x, player.z - p.z) - p.mesh.rotation.y) * Math.min(1, dt * 8); animateNPC(p.mesh, d < 1.8 ? 3 : 0, dt);
    if (d < 1.8 && !player.car && p.hitT <= 0) { p.hitT = 1; hurt(6); audio.crash(0.15); }
    if (p.t <= 0 || player.car || d > 30) p.state = 'walk'; return;
  }
  if (p.state === 'talk') { p.t -= dt; p.mesh.rotation.y += wrapA(headingOf(player.x - p.x, player.z - p.z) - p.mesh.rotation.y) * Math.min(1, dt * 8); animateNPC(p.mesh, 0, dt); if (p.t <= 0) p.state = 'walk'; return; }
  if (p.state === 'walk' && !player.car && talkCD <= 0 && !p.talked && Math.abs(p.x - player.x) < 2.4 && Math.abs(p.z - player.z) < 2.4) {
    p.state = 'talk'; p.t = 3; p.talked = true; talkCD = 5; showMsg('🗣️ "' + pick(npcLines(p.x, p.z)) + '"', 3); return;
  }
  p.s += p.speed * p.dir * dt; placePed(p, dt); animateNPC(p.mesh, p.speed, dt);
}
let talkCD = 0;
const NPC_LINES = {
  any: ['Nice day in Vice Bay!', 'Watch where you\'re walking!', 'Have you seen my dog?', 'I swear the traffic gets worse every day.', 'You look like trouble.', 'Try the radio, Vice FM is the best.', 'I\'m late for work!', 'Hey, aren\'t you that guy from the news?', 'Don\'t talk to me, I\'m busy.', 'The cops are everywhere today.'],
  beach: ['Surf\'s up!', 'Don\'t forget sunscreen.', 'The water\'s perfect today.'],
  downtown: ['Rent up here is insane.', 'I work on the 40th floor. Great view!', 'Time is money, buddy.'],
  swamp: ['Watch out for gators!', 'Best airboat rides in Florida, right here.', 'Mosquitoes are huge this year.'],
  airport: ['My flight got delayed again.', 'Which way to Terminal B?', 'Welcome to Vice Bay!'],
  town: ['Everybody knows everybody here.', 'Quiet little town, just how I like it.'],
  city: ['First time in town?', 'The highway back to Vice Bay is that way.', 'This city never sleeps.']
};
function npcLines(x, z) {
  let extra = [];
  if (inRect(DT, x, z)) extra = NPC_LINES.downtown; else if (inRect(SWAMP, x, z)) extra = NPC_LINES.swamp; else if (inRect(AIR, x, z)) extra = NPC_LINES.airport;
  else if (inRect(TOWN, x, z)) extra = NPC_LINES.town; else if (CITIES.some(c => c.inside(x, z))) extra = NPC_LINES.city; else if (x > 150) extra = NPC_LINES.beach;
  return extra.concat(extra, NPC_LINES.any);
}
function scarePeds(x, z, r) {
  for (const p of peds) if (p.state !== 'dead' && Math.hypot(p.x - x, p.z - z) < r) {
    const b = p.info.behavior, d = Math.hypot(p.x - player.x, p.z - player.z);
    if (b === 'fight' && !player.car && d < 8) { p.state = 'fight'; p.t = 10; showMsg(pick(['"You want some?!"', '"Come here!"', '"Big mistake, pal."']), 2); continue; }
    if (b === 'call' && d < 60) p.callT = 3;
    p.state = 'flee'; p.t = 6; p.speed = 5.5; setNPCPanic(p.mesh, true);
    const [, , dx, dz] = perim(p.s, p.lot.h); p.dir = ((p.x - x) * dx + (p.z - z) * dz) * 1 >= 0 ? 1 : -1;
  }
}
function killPed(p, byPlayer = true, crime = 1) {
  if (p.state === 'dead') return; p.state = 'dead'; p.t = 12; p.fallT = 0; p.callT = 0; setNPCPanic(p.mesh, false); if (byPlayer) dropCash(p.x, p.z, p.info.money || 0);
  if (byPlayer) { addWanted(crime, true); scarePeds(p.x, p.z, 25); }
}

// ---------- pickups ----------
const pickups = [];
const PK = { cash: [0x2ee59d, '$'], health: [0xff4d6d, '+'], armor: [0x19c3ff, 'A'] };
function spawnPickup(kind) {
  kind = kind || pick(['cash', 'cash', 'cash', 'health', 'armor']);
  const lot = pick(lots), [lx, lz] = perim(rand(0, PER));
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: PK[kind][0], emissive: PK[kind][0], emissiveIntensity: 0.6 }));
  m.position.set(lot.cx + lx, 1.2, lot.cz + lz); scene.add(m);
  pickups.push({ m, kind, x: m.position.x, z: m.position.z, amount: kind === 'cash' ? Math.round(rand(5, 30)) * 10 : 0 });
}

// ---------- player ----------
const player = { mode: 'foot', car: null, x: 0, z: 0, y: 0, vy: 0, heading: 0, health: 100, armor: 0, money: 500, weapon: 1, shootCD: 0, swim: false,
  mesh: M.makePerson({ shirt: 0xff5e7e, pants: 0x1c3d5a, skin: 0xc68642 }) };
scene.add(player.mesh);
const state = { wanted: 0, unseen: 0, spawnT: 0, bustT: 0, time: 0.4, paused: true, started: false, dead: false, heli: null, weather: 0, weatherT: 120, thunderT: 10,
  mission: null, missionCD: 3, done: [], camYaw: Math.PI, camPitch: 0.32, lastCamInput: -10, now: 0, saveCD: 6 };
let flash = 0;

function hurt(amt, why) {
  if (state.dead) return;
  const a = Math.min(player.armor, amt * 0.7); player.armor -= a; player.health -= amt - a;
  if (player.health <= 0) { player.health = 0; die('WASTED', '#ff4d4d'); }
}
function addWanted(n, crime) {
  const before = state.wanted; state.wanted = clamp(state.wanted + n, 0, 5); state.unseen = 0;
  if (state.wanted > before) audio.wanted();
}
function nearestVehicle(r) {
  let best = null, bd = r;
  for (const v of vehicles) { if (v.dead || v.burnT) continue; const d = Math.hypot(v.x - player.x, v.z - player.z); if (d < bd) { bd = d; best = v; } }
  return best;
}
function enterCar() {
  const v = nearestVehicle(player.swim ? 5.5 : 5); if (!v) return;
  if (v.kind === 'heli' && player.y > 1) return;
  if (v.type === 'traffic' || v.type === 'fwtraffic' || v.type === 'istraffic' || v.type === 'hwtraffic') { const cops = vehicles.some(o => o.type === 'police' && Math.hypot(o.x - v.x, o.z - v.z) < 50); if (cops) addWanted(1); showMsg(`Carjacked a ${v.name}`); spawnFleeingDriver(v); }
  if (v.type === 'police') { addWanted(2); showMsg('Stole a police cruiser!'); }
  v.type = 'player'; v.plan = null; player.car = v; player.mode = 'car'; player.mesh.visible = false;
  audio.startEngine(); audio.station = settings.station || 0; if (settings.radio) { audio.startRadio(); showMsg('📻 ' + audio.stationName, 2); }
  if (state.mission?.onEnter) state.mission.onEnter(v);
}
function spawnFleeingDriver(v) {
  const p = spawnPed(); const near = lots.reduce((a, l) => Math.hypot(l.cx - v.x, l.cz - v.z) < Math.hypot(a.cx - v.x, a.cz - v.z) ? l : a);
  p.lot = near; let best = 0, bd = 1e9; for (let s = 0; s < PER; s += 2) { const [lx, lz] = perim(s), d = Math.hypot(near.cx + lx - v.x, near.cz + lz - v.z); if (d < bd) { bd = d; best = s; } }
  p.s = best; placePed(p, 0); p.state = 'flee'; p.t = 8; p.speed = 5.5;
}
function exitCar(force) {
  const v = player.car; if (!v) return;
  if (!force && Math.abs(v.speed) > 6) { v.speed *= 0.5; }
  const [fx_, fz_] = fwd(v.heading), rx = -fz_, rz = fx_; // right vector
  let ex = v.x - rx * 2.4, ez = v.z - rz * 2.4;
  if (insideAny(ex, ez, 0.5)) { ex = v.x + rx * 2.4; ez = v.z + rz * 2.4; }
  if (insideAny(ex, ez, 0.5)) { ex = v.x + fx_ * 3.5; ez = v.z + fz_ * 3.5; }
  if (v.kind === 'heli' || v.kind === 'boat') { ex = v.x - rx * 3; ez = v.z - rz * 3; }
  player.x = ex; player.z = ez; player.y = v.y || 0; player.vy = 0; player.heading = v.heading;
  v.type = 'parked'; v.speed = force ? v.speed : v.speed; player.car = null; player.mode = 'foot'; player.mesh.visible = true;
  audio.stopEngine(); audio.stopRadio();
}

// ---------- police ----------
function policeCount() { return vehicles.filter(v => v.type === 'police' && !v.dead).length; }
function updatePolice(v, dt) {
  const tx = player.car ? player.car.x : player.x, tz = player.car ? player.car.z : player.z;
  const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
  if (state.wanted === 0) { // drive off
    v.speed += (14 - v.speed) * dt; const [fx_, fz_] = fwd(v.heading); v.x += fx_ * v.speed * dt; v.z += fz_ * v.speed * dt;
    if (d > 110) removeVehicle(v); return;
  }
  let want = headingOf(dx, dz);
  if (v.reverseT > 0) { v.reverseT -= dt; v.speed += (-6 - v.speed) * dt * 3; v.heading -= v.turnDir * 1.6 * dt; }
  else {
    const diff = wrapA(want - v.heading); v.heading += clamp(diff, -2.2 * dt, 2.2 * dt) * (Math.abs(v.speed) > 1 ? 1 : 0.4);
    const close = player.mode === 'foot' ? 5 : 3, maxV = Math.min(v.maxSpeed, 20 + state.wanted * 3);
    const tgt = d < close ? 0 : d < 15 ? 10 : maxV;
    v.speed += clamp(tgt - v.speed, -25 * dt, 13 * dt) * (Math.abs(diff) > 1.2 && d > 10 ? 0.5 : 1);
  }
  moveCar(v, dt, true);
}
function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 5), M.mat(0x1d3557)); g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5), M.mat(0x1d3557)); tail.position.set(0, 0.4, 4.5); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 0.5), M.mat(0x222222)); rotor.position.y = 1.2; g.add(rotor);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = -15; g.add(cone);
  g.userData.rotor = rotor; scene.add(g); return g;
}
function updateWanted(dt) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  if (state.wanted > 0) {
    const desired = [0, 1, 2, 3, 4, 6][state.wanted];
    state.spawnT -= dt;
    if (policeCount() < desired && state.spawnT <= 0) {
      const p = roadPointNear(px, pz, 60, 110);
      if (p) { const dx = p.ax === 0 ? p.s : 0, dz = p.ax === 1 ? p.s : 0; const v = addVehicle('police', p.x, p.z, headingOf(dx, dz)); v.speed = 10; v.turnDir = 1; }
      state.spawnT = 2.5;
    }
    let seen = false, minD = 1e9;
    for (const v of vehicles) if (v.type === 'police' && !v.dead) { const d = Math.hypot(v.x - px, v.z - pz); minD = Math.min(minD, d); if (d < 55 + state.wanted * 8) seen = true; }
    if (state.wanted >= 4) seen = true;
    state.unseen = seen ? 0 : state.unseen + dt;
    if (state.unseen > 7 + state.wanted * 3) { state.wanted = 0; state.unseen = 0; showMsg('You lost the cops'); }
    audio.setSiren(clamp(1 - minD / 90, 0, 1));
    // police fire at 3+ stars
    if (state.wanted >= 3 && minD < 28) {
      if (Math.random() < dt * 3) audio.shot();
      if (player.car) { damageVehicle(player.car, 5 * dt); hurt(1.2 * dt); } else hurt(5 * dt);
    }
    // busted
    let near = false;
    for (const v of vehicles) if (v.type === 'police' && !v.dead && Math.hypot(v.x - px, v.z - pz) < 6 && Math.abs(v.speed) < 4) near = true;
    const slow = !player.car || Math.abs(player.car.speed) < 1.5;
    state.bustT = near && slow ? state.bustT + dt : Math.max(0, state.bustT - dt);
    if (state.bustT > (player.car ? 3 : 1.6)) die('BUSTED', '#4d8bff');
  } else { audio.setSiren(0); state.bustT = 0; }
  // helicopter
  if (state.wanted >= 4 && !state.heli) { state.heli = V.makePoliceHelicopter(); scene.add(state.heli); state.heli.position.set(px + 60, 40, pz); }
  if (state.heli) {
    const h = state.heli, t = state.now;
    const tx = state.wanted >= 4 ? px + Math.cos(t * 0.4) * 14 : px + 200, tz = state.wanted >= 4 ? pz + Math.sin(t * 0.4) * 14 : pz;
    h.position.x += (tx - h.position.x) * dt * 0.8; h.position.z += (tz - h.position.z) * dt * 0.8; h.position.y = 30;
    h.rotation.y = headingOf(px - h.position.x, pz - h.position.z); V.animateHeli(h, dt, 1, state.now);
    if (state.wanted < 4 && Math.hypot(h.position.x - px, h.position.z - pz) > 150) { scene.remove(h); state.heli = null; }
  }
}

// ---------- car physics shared ----------
function moveCar(v, dt, ai) {
  const [fx_, fz_] = fwd(v.heading);
  const ox = v.x, oz = v.z;
  v.x += fx_ * v.speed * dt; v.z += fz_ * v.speed * dt;
  const boat = v.kind === 'boat';
  if (!allowedAt(v.x, v.z, boat) || (boat ? !inWater(v.x, v.z) : inWater(v.x, v.z))) {
    const impact = Math.abs(v.speed); v.x = ox; v.z = oz; v.speed *= -0.3;
    if (impact > 12 && v === player.car) { damageVehicle(v, impact * 0.4); audio.crash(0.4); shake = 0.3; }
    if (ai) { v.reverseT = 0.9; v.turnDir = Math.random() < 0.5 ? 1 : -1; }
    return;
  }
  v.y = surfaceY(v.x, v.z, v.y || 0); if (v.y > 0.5) fw.clampToDeck(v);
  const hit = collideCircle(v.x, v.z, v.kind === 'bike' ? 1.1 : 1.7, v.y || 0);
  if (hit) {
    v.x += hit.px; v.z += hit.pz;
    const impact = Math.abs(v.speed);
    if (impact > 7) { damageVehicle(v, impact * (ai ? 0.6 : 1.4)); if (v === player.car || Math.hypot(v.x - player.x, v.z - player.z) < 40) audio.crash(clamp(impact / 30, 0.3, 1)); if (v === player.car) shake = 0.4; }
    v.speed *= -0.25;
    if (ai) { v.reverseT = 0.9; v.turnDir = Math.random() < 0.5 ? 1 : -1; }
  }
}
function vehicleCollisions() {
  for (let a = 0; a < vehicles.length; a++) for (let b = a + 1; b < vehicles.length; b++) {
    const A = vehicles[a], Bv = vehicles[b], dx = Bv.x - A.x, dz = Bv.z - A.z, d2 = dx * dx + dz * dz;
    if (d2 > 14 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), p = (3.6 - d) / 2; if (p <= 0) continue;
    const nx = dx / d, nz = dz / d;
    const wa = A.type === 'parked' || A.dead ? 0.3 : 1, wb = Bv.type === 'parked' || Bv.dead ? 0.3 : 1;
    A.x -= nx * p * wa; A.z -= nz * p * wa; Bv.x += nx * p * wb; Bv.z += nz * p * wb;
    const rel = Math.abs(A.speed - Bv.speed) + Math.abs(A.speed + Bv.speed) * 0.3;
    if (rel > 6) {
      damageVehicle(A, rel * 0.8); damageVehicle(Bv, rel * 0.8);
      if (A === player.car || Bv === player.car) { audio.crash(clamp(rel / 30, 0.3, 1)); shake = 0.35; const other = A === player.car ? Bv : A; if (other.type === 'police') addWanted(state.wanted ? 0 : 1); }
    }
    A.speed *= 0.6; Bv.speed *= 0.6;
  }
}

// ---------- missions ----------
let shake = 0;
const missionMarkers = [];
const CHECKS = [[lines[3], lines[2]], [lines[4], lines[2]], [lines[4], lines[0]], [lines[1], lines[0]], [lines[1], lines[4]], [lines[3], lines[4]]];
const MISSIONS = [
  { id: 'delivery', name: 'Beach Delivery', reward: 500, at: [lines[2] + 4, lines[3] - 30 + 26],
    intro: [['Lena', 'Rico says this package has to hit the beach shack. Fast.'], ['Lena', 'Grab any car. I don\'t care whose.']],
    start(m) { m.t = 75; m.target = POI.beach; setObjective('Drive the package to the <b>Beach Shack</b>'); },
    update(m, dt) { m.t -= dt; if (m.t <= 0) return fail('Out of time'); if (dist2(m.target) < 5) return pass(); } },
  { id: 'race', name: 'Checkpoint Rush', reward: 1000, at: [lines[3] - 4, lines[3] + 4],
    intro: [['Lena', 'Street race, six checkpoints. Ninety seconds.'], ['Lena', 'You need wheels for this one.']],
    start(m) { m.t = 95; m.k = 0; m.target = { x: CHECKS[0][0], z: CHECKS[0][1] }; m.marker = M.makeMarker(0xff2d6f); m.marker.scale.set(2.4, 2, 2.4); scene.add(m.marker); setObjective('Get in a car and hit the <b>checkpoints</b>'); },
    update(m, dt) {
      if (!player.car) { setObjective('Get in a <b>car</b>'); } else setObjective(`Checkpoint <b>${m.k + 1}/6</b>`);
      if (player.car) m.t -= dt; if (m.t <= 0) return fail('Out of time');
      m.marker.position.set(m.target.x, 2, m.target.z);
      if (player.car && dist2(m.target) < 7) { m.k++; audio.pickup(); if (m.k >= CHECKS.length) return pass(); m.target = { x: CHECKS[m.k][0], z: CHECKS[m.k][1] }; }
    }, end(m) { scene.remove(m.marker); } },
  { id: 'steal', name: 'Hot Wheels', reward: 1500, at: [lines[1] + 4, lines[1] + 26],
    intro: [['Lena', 'There\'s a Vortex GT parked downtown. Collector wants it.'], ['Lena', 'Bring it to the Spray Shop. Try not to wreck it.']],
    start(m) { const p = { x: lines[2] + 3.5, z: lines[4] + 20 }; m.car = addVehicle('parked', p.x, p.z, 0, { color: 0xffd23f, sports: true, name: 'Vortex GT' }); m.target = m.car; setObjective('Steal the <b>Vortex GT</b>'); },
    onEnter(v) { const m = state.mission; if (v === m.car && !m.got) { m.got = true; addWanted(2); m.target = POI.spray; setObjective('Deliver the Vortex GT to the <b>Spray Shop</b>'); } },
    update(m) { if (m.car.dead || m.car.burnT) return fail('The Vortex GT was destroyed'); if (m.got && player.car === m.car && dist2(POI.spray) < 6) return pass(); if (m.got && player.car !== m.car) setObjective('Get back in the <b>Vortex GT</b>'); else if (m.got) setObjective('Deliver the Vortex GT to the <b>Spray Shop</b>'); } },
  { id: 'haul', name: 'Port Haul', reward: 1200, at: [POI.diner.x + 4, POI.diner.z + 3],
    intro: [['Lena', 'A friend at Port Coral has a truck full of... let\'s say coconuts.'], ['Lena', 'Take the red hauler to the beach shack. Two minutes. Don\'t flip it.']],
    start(m) { const t = vehicles.find(v => v.kind === 'truck' && v.portHauler && !v.dead && !v.burnT); m.car = t || addVehicle('parked', 30, -325, 0, { mesh: V.makeTruck(0xd62828, 0x264653), name: 'Red Hauler' }); m.car.name = 'Red Hauler'; m.t = 120; m.target = m.car; setObjective('Get in the <b>Red Hauler</b>'); },
    update(m, dt) { if (m.car.dead || m.car.burnT) return fail('The truck was destroyed'); if (player.car === m.car) { m.target = POI.beach; m.t -= dt; setObjective('Haul the cargo to the <b>Beach Shack</b>'); } else { m.target = m.car; setObjective('Get in the <b>Red Hauler</b>'); } if (m.t <= 0) return fail('Out of time'); if (player.car === m.car && dist2(POI.beach) < 6) return pass(); } },
  { id: 'getaway', name: 'Clean Getaway', reward: 2500, at: [lines[4] + 4, lines[5] - 4],
    intro: [['Lena', 'The cops are onto the crew. They think it\'s you.'], ['Lena', 'Lose them. All of them.']],
    start(m) { state.wanted = 3; audio.wanted(); m.target = null; setObjective('<b>Lose the cops</b>'); },
    update(m) { if (state.wanted === 0) return pass(); } },
];
const dist2 = t => { const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z; return Math.hypot(t.x - px, t.z - pz); };
function refreshMissionMarkers() {
  missionMarkers.forEach(m => scene.remove(m.mesh)); missionMarkers.length = 0;
  for (const ms of MISSIONS) if (!state.done.includes(ms.id)) {
    const mesh = M.makeMarker(0xffd23f); mesh.position.set(ms.at[0], 1.5, ms.at[1]); scene.add(mesh); missionMarkers.push({ mesh, ms });
  }
}
function startMission(ms) {
  state.mission = { def: ms }; cutscene(ms.intro, () => { if (!state.mission) return; ms.start(state.mission); state.mission._started = true; showMsg(ms.name); });
}
function endMission() { const m = state.mission; if (!m) return; m.def.end?.(m); state.mission = null; state.missionCD = 6; setObjective(''); $('timer').textContent = ''; }
function pass() {
  const m = state.mission, ms = m.def; endMission();
  player.money += ms.reward; if (!state.done.includes(ms.id)) state.done.push(ms.id);
  audio.missionPassed(); bigText('MISSION PASSED', '#ffd23f', `+$${ms.reward}`); refreshMissionMarkers(); saveGame(true);
  if (state.done.length === MISSIONS.length) setTimeout(() => showMsg('All Stage 1 missions done. More in the next update!'), 3500);
}
function fail(why) { endMission(); bigText('MISSION FAILED', '#ff4d4d', why); }
let cutT = 0, cutLines = null, cutDone = null;
function cutscene(lns, done) { cutLines = lns.slice(); cutDone = done; cutT = 0; $('letterTop').classList.add('on'); $('letterBot').classList.add('on'); nextLine(); }
function nextLine() {
  if (!cutLines.length) { $('letterTop').classList.remove('on'); $('letterBot').classList.remove('on'); $('caption').innerHTML = ''; const d = cutDone; cutLines = null; d && d(); return; }
  const [who, text] = cutLines.shift(); $('caption').innerHTML = `<b>${who}:</b> ${text}`; cutT = 2.8;
}

// ---------- HUD helpers ----------
let msgTimer = 0, bigTimer = 0;
function showMsg(t, d = 2.5) { const e = $('msg'); e.textContent = t; e.classList.add('show'); msgTimer = d; }
function bigText(t, color, sub) { const e = $('big'); e.innerHTML = t + (sub ? `<div style="font-size:22px;letter-spacing:1px">${sub}</div>` : ''); e.style.color = color; e.classList.add('show'); bigTimer = 3; }
function setObjective(h) { $('objective').innerHTML = h; }
function die(text, color) {
  if (state.dead) return; state.dead = true; bigText(text, color); if (state.mission) { endMission(); }
  audio.setSiren(0);
  setTimeout(() => {
    if (player.car) exitCar(true);
    const fee = Math.min(player.money, Math.round(100 + player.money * 0.1)); player.money -= fee;
    const p = text === 'BUSTED' ? POI.police : POI.hospital; player.x = p.x; player.z = p.z - 1; player.y = 0;
    player.health = 100; player.armor = 0; state.wanted = 0; state.bustT = 0; state.dead = false;
    vehicles.filter(v => v.type === 'police').forEach(removeVehicle);
    showMsg(`${text === 'BUSTED' ? 'Bail' : 'Hospital bill'}: -$${fee}`, 3);
  }, 3000);
}

// ---------- save / load ----------
function saveGame(quiet) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ money: player.money, health: player.health, armor: player.armor, done: state.done, x: px, z: pz, time: state.time, weapon: player.weapon, at: Date.now() }));
  if (!quiet) showMsg('Game saved'); else showMsg('Progress saved', 1.5);
}
function loadGame() {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!s) { showMsg('No saved game yet'); return false; }
  if (player.car) exitCar(true); endMission();
  Object.assign(player, { money: s.money, health: s.health, armor: s.armor, weapon: s.weapon ?? 1, x: s.x, z: s.z, y: 0 });
  if (insideAny(player.x, player.z, 0.5)) { player.x = POI.safe.x; player.z = POI.safe.z; }
  state.done = s.done || []; state.time = s.time ?? 0.4; state.wanted = 0; vehicles.filter(v => v.type === 'police').forEach(removeVehicle);
  refreshMissionMarkers(); showMsg('Game loaded'); return true;
}
function newGame() {
  if (player.car) exitCar(true); endMission();
  Object.assign(player, { money: 500, health: 100, armor: 0, weapon: 1, x: POI.safe.x + 6, z: POI.safe.z - 4, y: 0 }); state.saveCD = 6;
  state.done = []; state.time = 0.4; state.wanted = 0; vehicles.filter(v => v.type === 'police').forEach(removeVehicle);
  refreshMissionMarkers();
}

// ---------- input ----------
const input = { mx: 0, my: 0, camDX: 0, camDY: 0, shoot: false, jump: false, sprint: false, enterP: false, weaponP: false, hornP: false };
const btnState = {};
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, camT = { id: null, lx: 0, ly: 0 };
function joySide(x) { return settings.leftHanded ? x > innerWidth * 0.5 : x < innerWidth * 0.5; }
function bindBtn(id, key) {
  const el = $(id);
  const down = e => { e.preventDefault(); e.stopPropagation(); btnState[key] = true; el.classList.add('pressed'); if (key === 'enter') input.enterP = true; if (key === 'weapon') input.weaponP = true; if (key === 'horn') input.hornP = true; };
  const up = e => { e.preventDefault(); e.stopPropagation(); btnState[key] = false; el.classList.remove('pressed'); };
  el.addEventListener('touchstart', down, { passive: false }); el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down); el.addEventListener('mouseup', up); el.addEventListener('mouseleave', up);
}
bindBtn('btnShoot', 'shoot'); bindBtn('btnJump', 'jump'); bindBtn('btnSprint', 'sprint'); bindBtn('btnEnter', 'enter'); bindBtn('btnWeapon', 'weapon'); bindBtn('btnHorn', 'horn');
function nextStation() {
  if (!player.car) return; audio.unlock(); audio.station = settings.station || 0;
  if (!settings.radio) { settings.radio = true; audio.startRadio(); }
  else if ((audio.station || 0) + 1 >= GameAudio.STATIONS.length) { settings.radio = false; audio.stopRadio(); settings.station = 0; audio.station = 0; saveSettings(); $('setRadio').value = '0'; showMsg('📻 Radio off', 1.5); return; }
  else audio.nextStation();
  settings.station = audio.station; saveSettings(); $('setRadio').value = '1'; showMsg('📻 ' + audio.stationName, 2);
}
{ const rb = $('btnRadio'); const go = e => { e.preventDefault(); e.stopPropagation(); nextStation(); }; rb.addEventListener('touchstart', go, { passive: false }); rb.addEventListener('mousedown', go); }
addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) nextStation(); });
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); audio.unlock();
  for (const t of e.changedTouches) {
    if (joySide(t.clientX) && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; const b = $('joyBase'); b.style.display = 'block'; b.style.left = t.clientX + 'px'; b.style.top = t.clientY + 'px'; $('joyKnob').style.transform = ''; }
    else if (camT.id === null) { camT.id = t.identifier; camT.lx = t.clientX; camT.ly = t.clientY; }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), R = 55; if (l > R) { dx *= R / l; dy *= R / l; } joy.x = dx / R; joy.y = -dy / R; $('joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
    if (t.identifier === camT.id) { input.camDX += t.clientX - camT.lx; input.camDY += t.clientY - camT.ly; camT.lx = t.clientX; camT.ly = t.clientY; }
  }
}, { passive: false });
const touchEnd = e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joyBase').style.display = 'none'; } if (t.identifier === camT.id) camT.id = null; } };
canvas.addEventListener('touchend', touchEnd); canvas.addEventListener('touchcancel', touchEnd);
document.addEventListener('gesturestart', e => e.preventDefault());
// mouse + keyboard
const keys = {}; let mouseDown = false, mlx = 0, mly = 0;
addEventListener('keydown', e => {
  audio.unlock(); const k = e.key.toLowerCase(); if (keys[k]) return; keys[k] = true;
  if (k === 'f') input.enterP = true; if (k === 'q') input.weaponP = true; if (k === 'h') input.hornP = true;
  if (k === 'escape' || k === 'p') togglePause();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', e => { audio.unlock(); mouseDown = true; mlx = e.clientX; mly = e.clientY; if (e.button === 0 && e.shiftKey === false && e.ctrlKey) btnState.shoot = true; });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', e => { if (mouseDown) { input.camDX += e.clientX - mlx; input.camDY += e.clientY - mly; mlx = e.clientX; mly = e.clientY; } });
let padPrev = {};
function readInput() {
  let mx = joy.x, my = joy.y;
  if (keys['a'] || keys['arrowleft']) mx -= 1; if (keys['d'] || keys['arrowright']) mx += 1;
  if (keys['w'] || keys['arrowup']) my += 1; if (keys['s'] || keys['arrowdown']) my -= 1;
  input.shoot = !!(btnState.shoot || keys['j']); input.jump = !!(btnState.jump || keys[' ']); input.sprint = !!(btnState.sprint || keys['shift']);
  input.throttle = 0; input.brake = 0;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  if (gp) {
    const dz = v => Math.abs(v) < 0.15 ? 0 : v, b = i => gp.buttons[i]?.pressed, bv = i => gp.buttons[i]?.value || 0;
    mx += dz(gp.axes[0]); my -= dz(gp.axes[1]); input.camDX += dz(gp.axes[2]) * 12; input.camDY += dz(gp.axes[3]) * 8;
    if (b(0)) input.jump = true; if (b(1)) input.sprint = true; if (b(7)) input.shoot = true;
    input.throttle = bv(7); input.brake = bv(6);
    const edge = (i, f) => { if (b(i) && !padPrev[i]) f(); padPrev[i] = b(i); };
    edge(3, () => input.enterP = true); edge(2, () => input.weaponP = true); edge(9, () => togglePause()); edge(5, () => input.hornP = true);
  }
  input.mx = clamp(mx, -1, 1); input.my = clamp(my, -1, 1);
}

// ---------- update ----------
function updateFoot(dt) {
  const yaw = state.camYaw, f = [-Math.sin(yaw), -Math.cos(yaw)], r = [Math.cos(yaw), -Math.sin(yaw)];
  let mx = f[0] * input.my + r[0] * input.mx, mz = f[1] * input.my + r[1] * input.mx; const ml = Math.hypot(mx, mz);
  player.swim = inWater(player.x, player.z) && (player.x > SHORE + 4 || player.y < 0.5) && !(player.x > port.waterRect.minX - 1 && player.x < port.waterRect.minX + 2 && player.y >= 0);
  const pox = player.x, poz = player.z;
  const spd = (player.swim ? 2.5 : input.sprint ? 8 : 4.2) * Math.min(1, ml); player.spd = spd;
  if (ml > 0.05) { mx /= ml; mz /= ml; player.heading += wrapA(headingOf(mx, mz) - player.heading) * Math.min(1, dt * 12); }
  const nx = player.x + mx * spd * dt, nz = player.z + mz * spd * dt;
  player.x = nx; player.z = nz;
  const hit = collideCircle(player.x, player.z, 0.45, player.y); if (hit) { player.x += hit.px; player.z += hit.pz; }
  for (const v of vehicles) { const dx = player.x - v.x, dz = player.z - v.z, d = Math.hypot(dx, dz); if (d < 2.2 && d > 0) { player.x = v.x + dx / d * 2.2; player.z = v.z + dz / d * 2.2; } }
  if (!allowedAt(player.x, player.z, true)) { player.x = pox; player.z = poz; }
  const landing = player.vy;
  // jump / gravity
  if (player.y > 0.5) { fw.clampToDeck(player); if (fw.heightAt(player.x, player.z) > 0.5 && player.y > 0.5 && Math.abs(player.x - FW.x) > FW.W / 2 - 1) { player.x = clamp(player.x, FW.x - FW.W / 2 + 1, FW.x + FW.W / 2 - 1); } }
  const groundY = player.swim ? -1.1 : surfaceY(player.x, player.z, player.y);
  if (input.jump && player.y <= groundY + 0.01 && !player.swim) player.vy = 6.5;
  player.vy -= 18 * dt; player.y += player.vy * dt; if (player.y < groundY) { if (player.vy < -14 && !player.swim) hurt((-player.vy - 14) * 6, 'fall'); player.y = groundY; player.vy = 0; }
  player.mesh.position.set(player.x, player.y + (player.swim ? 0 : 0.0), player.z); player.mesh.rotation.y = player.heading;
  M.animatePerson(player.mesh, player.y > groundY + 0.05 ? 0 : spd, dt);
  // attack
  player.shootCD -= dt;
  if (input.shoot && player.shootCD <= 0 && !player.swim) {
    player.heading = state.camYaw; player.mesh.rotation.y = player.heading;
    const [hx, hz] = fwd(player.heading);
    if (player.weapon === 1) {
      player.shootCD = 0.28; audio.shot(); scarePeds(player.x, player.z, 40);
      let best = null, bd = 40;
      const consider = (o, x, z, kind) => { const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz); if (d < 0.5 || d > bd) return; const a = (dx * hx + dz * hz) / d; if (a > 0.93) { best = { o, x, z, kind }; bd = d; } };
      for (const p of peds) if (p.state !== 'dead') consider(p, p.x, p.z, 'ped');
      for (const v of vehicles) if (!v.dead) consider(v, v.x, v.z, 'car');
      const from = new THREE.Vector3(player.x + hx * 0.6, player.y + 1.4, player.z + hz * 0.6);
      if (best) {
        tracer(from, new THREE.Vector3(best.x, 1, best.z));
        if (best.kind === 'ped') killPed(best.o, true, 1);
        else { damageVehicle(best.o, 20); if (best.o.type === 'police') addWanted(state.wanted < 2 ? 2 - state.wanted : 1); else if (Math.random() < 0.3) addWanted(state.wanted ? 0 : 1); }
      } else { tracer(from, new THREE.Vector3(player.x + hx * 40, 1.4, player.z + hz * 40)); if (vehicles.some(o => o.type === 'police' && Math.hypot(o.x - player.x, o.z - player.z) < 40)) addWanted(state.wanted ? 0 : 1); }
    } else {
      player.shootCD = 0.45; audio.click();
      for (const p of peds) if (p.state !== 'dead' && Math.hypot(p.x - (player.x + hx), p.z - (player.z + hz)) < 1.4) { killPed(p, true, 1); audio.crash(0.2); break; }
    }
  }
}
// simple highway traffic on the elevated deck lanes
function updateFwTraffic(dt) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  const near = Math.abs(px - FW.x) < 160;
  const list = vehicles.filter(v => v.type === 'fwtraffic');
  for (const v of list) {
    const lane = v.lane, ahead = vehicles.some(o => o !== v && !o.dead && Math.abs(o.x - v.x) < 2.2 && (o.z - v.z) * lane.dir > 0 && (o.z - v.z) * lane.dir < 14 && Math.abs((o.y || 0) - v.y) < 2);
    v.speed += clamp((ahead ? 0 : v.cruise) - v.speed, -25 * dt, 6 * dt);
    v.z += lane.dir * v.speed * dt; v.x += (lane.x - v.x) * Math.min(1, dt * 2); v.y = fw.heightAt(v.x, v.z);
    if (v.z < FW.z0 + 72 || v.z > FW.z1 - 72 || !near) removeVehicle(v);
  }
  if (near && list.length < 6 && Math.random() < dt * 0.8) {
    const lane = pick(fw.lanes), z = clamp(pz + rand(-120, 120), FW.z0 + 80, FW.z1 - 80);
    if (Math.abs(z - pz) > 40 && !vehicles.some(o => Math.abs(o.x - lane.x) < 3 && Math.abs(o.z - z) < 15)) {
      const r = Math.random(), mk = r < 0.15 ? V.makeTruck() : r < 0.3 ? V.makeSportsCar(pick(M.CAR_COLORS)) : r < 0.4 ? V.makeMotorcycle(pick(M.CAR_COLORS)) : null;
      const v = addVehicle('fwtraffic', lane.x, z, lane.dir > 0 ? Math.PI : 0, mk ? { mesh: mk } : {}); v.lane = lane; v.y = FW.H; v.cruise = rand(22, 30); v.speed = v.cruise;
    }
  }
}
// interstate traffic on I-95 (ground level, east-west)
function updateIsTraffic(dt) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  const near = Math.abs(pz - IS.z) < 150;
  const list = vehicles.filter(v => v.type === 'istraffic');
  for (const v of list) {
    const lane = v.lane, ahead = vehicles.some(o => o !== v && !o.dead && Math.abs(o.z - v.z) < 2.2 && (o.x - v.x) * lane.dir > 0 && (o.x - v.x) * lane.dir < 14) || (!player.car && Math.abs(player.z - v.z) < 2 && (player.x - v.x) * lane.dir > 0 && (player.x - v.x) * lane.dir < 10);
    v.speed += clamp((ahead ? 0 : v.cruise) - v.speed, -25 * dt, 6 * dt);
    v.x += lane.dir * v.speed * dt; v.z += (lane.z - v.z) * Math.min(1, dt * 2); v.y = 0;
    if (v.x < IS.x0 + 20 || v.x > IS.x1 - 10 || !near) removeVehicle(v);
  }
  if (near && list.length < 7 && Math.random() < dt * 0.9) {
    const lane = pick(isLanes), x = clamp(px + rand(-130, 130), IS.x0 + 30, IS.x1 - 20);
    if (Math.abs(x - px) > 40 && !vehicles.some(o => Math.abs(o.z - lane.z) < 3 && Math.abs(o.x - x) < 15)) {
      const r = Math.random(), mk = r < 0.2 ? V.makeTruck() : r < 0.32 ? V.makeSportsCar(pick(M.CAR_COLORS)) : r < 0.4 ? V.makeBus() : r < 0.48 ? V.makeMotorcycle(pick(M.CAR_COLORS)) : null;
      const v = addVehicle('istraffic', x, lane.z, lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2, mk ? { mesh: mk } : {}); v.lane = lane; v.cruise = rand(24, 32); v.speed = v.cruise;
    }
  }
}
// traffic along Mika's interstate lane polylines
function updateHwTraffic(dt) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  const list = vehicles.filter(v => v.type === 'hwtraffic');
  for (const v of list) {
    const pts = v.lane.points; let a = pts[v.i], b = pts[v.i + 1];
    const ahead = vehicles.some(o => o !== v && !o.dead && Math.hypot(o.x - v.x, o.z - v.z) < 14 && ((o.x - v.x) * v.dx + (o.z - v.z) * v.dz) > 2 && Math.abs((o.x - v.x) * v.dz - (o.z - v.z) * v.dx) < 2.2);
    v.speed += clamp((ahead ? 0 : v.cruise) - v.speed, -25 * dt, 6 * dt);
    let step = v.speed * dt;
    while (step > 0 && b) { const rem = Math.hypot(b.x - v.x, b.z - v.z); if (rem > step) { v.x += (b.x - v.x) / rem * step; v.z += (b.z - v.z) / rem * step; step = 0; } else { v.x = b.x; v.z = b.z; step -= rem; v.i++; a = pts[v.i]; b = pts[v.i + 1]; } }
    if (b) { const L = Math.hypot(b.x - a.x, b.z - a.z) || 1; v.dx = (b.x - a.x) / L; v.dz = (b.z - a.z) / L; v.heading = Math.atan2(-v.dx, -v.dz); }
    v.y = 0;
    if (!b || Math.hypot(v.x - px, v.z - pz) > 200) removeVehicle(v);
  }
  if (list.length >= 8 || Math.random() > dt * 1.2) return;
  const h = HWS.find(h => h.nearest(px, pz).dist < 160); if (!h) return;
  const lane = pick(h.lanes), pts = lane.points; let i, a, b, x, z, ok = false;
  for (let k = 0; k < 16 && !ok; k++) { i = Math.floor(Math.random() * (pts.length - 1)); a = pts[i]; b = pts[i + 1]; const t = Math.random(); x = a.x + (b.x - a.x) * t; z = a.z + (b.z - a.z) * t; const d = Math.hypot(x - px, z - pz); ok = d > 45 && d < 160; }
  if (!ok) { const near = h.nearest(px, pz), sg = h.segs[near.segIndex]; const tt = clamp(near.t + rand(-140, 140), 0, sg.len); const lp = lane.dir > 0 ? near.segIndex * 2 : pts.length - 2 - near.segIndex * 2; i = lp; a = pts[i]; b = pts[i + 1]; const L0 = Math.hypot(b.x - a.x, b.z - a.z) || 1, f = lane.dir > 0 ? tt / sg.len : 1 - tt / sg.len; x = a.x + (b.x - a.x) * f; z = a.z + (b.z - a.z) * f; if (Math.hypot(x - px, z - pz) < 45) return; }
  if (vehicles.some(o => Math.hypot(o.x - x, o.z - z) < 15)) return;
  const r = Math.random(), mk = r < 0.2 ? V.makeTruck() : r < 0.32 ? V.makeSportsCar(pick(M.CAR_COLORS)) : r < 0.38 ? V.makeBus() : r < 0.46 ? V.makeMotorcycle(pick(M.CAR_COLORS)) : null;
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1, dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
  const v = addVehicle('hwtraffic', x, z, Math.atan2(-dx, -dz), mk ? { mesh: mk } : {}); Object.assign(v, { lane, i, dx, dz, cruise: rand(26, 34) }); v.speed = v.cruise;
}
function updateHeli(v, dt) {
  const up = input.jump ? 1 : 0, down = input.sprint ? 1 : 0;
  v.vy += ((up - down) * 9 - v.vy) * Math.min(1, dt * 2.5);
  v.y = clamp(v.y + v.vy * dt, 0, 140); if (v.y <= 0 && v.vy < 0) v.vy = 0;
  const air = v.y > 0.6;
  let thr = input.my; if (input.throttle) thr = Math.max(thr, input.throttle); if (input.brake) thr = Math.min(thr, -input.brake);
  if (air) { v.heading -= input.mx * 1.7 * dt; v.speed += (thr * v.maxSpeed - v.speed) * Math.min(1, dt * 1.1); }
  else v.speed *= Math.max(0, 1 - dt * 4);
  const [fx_, fz_] = fwd(v.heading), ox = v.x, oz = v.z;
  v.x += fx_ * v.speed * dt; v.z += fz_ * v.speed * dt;
  if (Math.abs(v.x) > 420 || Math.abs(v.z) > 420) { v.x = ox; v.z = oz; v.speed = 0; showMsg('Turning back to Vice Bay', 1.5); }
  const hit = collideCircle(v.x, v.z, 3, v.y);
  if (hit) { v.x = ox + hit.px * 0.2; v.z = oz + hit.pz * 0.2; const imp = Math.abs(v.speed); if (imp > 6) { damageVehicle(v, imp * 1.2); audio.crash(0.6); shake = 0.4; } v.speed *= -0.3; }
  v.pitch = -clamp(v.speed / v.maxSpeed, -1, 1) * 0.22; v.roll = air ? input.mx * 0.25 : 0;
  V.animateHeli(v.mesh, dt, air || up ? 1 : 0.25, state.now);
  audio.setEngine(clamp(0.35 + (air ? 0.4 : 0) + Math.abs(v.speed) / v.maxSpeed * 0.3, 0, 1), up || Math.abs(thr));
  if (v.health < 40 && Math.random() < dt * 6) puff(v.x, v.y + 1.5, v.z, v.health < 15 ? fireMat : smokeMat, 1, 2, 2);
}
function updatePlayerCar(dt) {
  const v = player.car;
  if (v.kind === 'heli' && !v.burnT) return updateHeli(v, dt);
  if (v.burnT) { v.speed *= (1 - dt); moveCar(v, dt, false); audio.setEngine(0, 0); return; }
  let thr = input.my, steer = input.mx;
  if (input.throttle) thr = Math.max(thr, input.throttle); if (input.brake) thr = Math.min(thr, -input.brake);
  if (input.jump) thr = Math.min(thr, -1);
  const hand = input.sprint; let braking = false;
  if (thr > 0) { v.speed += (v.speed < 0 ? 30 : v.accel * (1 - Math.max(0, v.speed) / v.maxSpeed)) * thr * dt; }
  else if (thr < 0) { if (v.speed > 0.5) { v.speed += 32 * thr * dt; braking = true; } else v.speed = Math.max(-11, v.speed + 9 * thr * dt); }
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 3 * dt);
  if (hand) { v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 9 * dt); braking = true; }
  v.speed -= v.speed * 0.05 * dt;
  const sp = Math.abs(v.speed), grip = clamp(sp / 7, 0, 1) * (1 - 0.35 * clamp(sp / v.maxSpeed, 0, 1));
  v.heading -= steer * 1.9 * grip * (v.grip || 1) * Math.sign(v.speed) * (hand ? 1.6 : 1) * dt;
  v.drift = (v.drift || 0) + ((hand ? steer * 0.35 * clamp(sp / 15, 0, 1) : 0) - (v.drift || 0)) * Math.min(1, dt * 5);
  moveCar(v, dt, false);
  v.braking = braking;
  // run over peds
  if (sp > 4) for (const p of peds) if (p.state !== 'dead' && Math.hypot(p.x - v.x, p.z - v.z) < 2.3) { killPed(p, true, 1); audio.crash(0.3); v.speed *= 0.92; }
  if (sp > 10) scarePeds(v.x, v.z, 12);
  // pickups by car
  audio.setEngine(clamp(sp / v.maxSpeed, 0, 1), Math.abs(thr));
  if (v.health < 40 && Math.random() < dt * (v.health < 15 ? 12 : 5)) puff(v.x, 1.4, v.z, v.health < 15 ? fireMat : smokeMat, 1, 2, 2);
}
const tmpV = new THREE.Vector3();
function updateCamera(dt) {
  const k = 0.005 * settings.sens;
  if (input.camDX || input.camDY) state.lastCamInput = state.now;
  state.camYaw -= input.camDX * k; state.camPitch = clamp(state.camPitch + input.camDY * k * 0.7, -0.1, 1.1); input.camDX = input.camDY = 0;
  let tx, ty, tz, dist, height;
  if (player.car) {
    const v = player.car, big = { truck: 4, bus: 6, heli: 6, boat: 2 }[v.kind] || 0; tx = v.x; tz = v.z; ty = 1.4 + (v.y || 0); dist = 9 + big + Math.abs(v.speed) * 0.08; height = 2.5 + big * 0.3;
    if (state.now - state.lastCamInput > 1.5 && Math.abs(v.speed) > 2) { const behind = v.speed >= 0 ? v.heading : v.heading + Math.PI; state.camYaw += wrapA(behind - state.camYaw) * Math.min(1, dt * 2.5); state.camPitch += (0.25 - state.camPitch) * dt * 1.5; }
  } else { tx = player.x; tz = player.z; ty = player.y + 1.6; dist = 5.5; height = 0.8; }
  const cy = Math.cos(state.camPitch), f = [-Math.sin(state.camYaw), -Math.cos(state.camYaw)];
  // pull camera in if it would sit inside a building
  let d = dist; for (; d > 2; d -= 0.5) { const cx = tx - f[0] * d * cy, cz = tz - f[1] * d * cy; if (!collideCircle(cx, cz, 0.3, ty + height + Math.sin(state.camPitch) * d)) break; }
  tmpV.set(tx - f[0] * d * cy, ty + height + Math.sin(state.camPitch) * d, tz - f[1] * d * cy);
  if (shake > 0) { tmpV.x += rand(-1, 1) * shake * 0.4; tmpV.y += rand(-1, 1) * shake * 0.4; shake -= dt; }
  camera.position.lerp(tmpV, Math.min(1, dt * 12)); camera.lookAt(tx, ty + 0.4, tz);
}

// ---------- weather / day-night ----------
const RAIN_N = 1200, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { rainPos[i * 3] = rand(-40, 40); rainPos[i * 3 + 1] = rand(0, 30); rainPos[i * 3 + 2] = rand(-40, 40); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false })); rain.visible = false; rain.frustumCulled = false; scene.add(rain);
let gfxT = 0;
function updateEnv(dt) {
  state.time = (state.time + dt / 720) % 1; // 12 real minutes per day
  const t = state.time, sunUp = clamp(Math.sin((t - 0.25) / 0.5 * Math.PI), 0, 1);
  // weather
  if (settings.rain === 'auto') { state.weatherT -= dt; if (state.weatherT <= 0) { state.weatherTarget = state.weatherTarget ? 0 : (Math.random() < 0.5 ? 1 : 0); state.weatherT = rand(90, 200); } }
  else state.weatherTarget = settings.rain === 'rain' ? 1 : 0;
  state.weather += ((state.weatherTarget || 0) - state.weather) * Math.min(1, dt * 0.3);
  const w = state.weather;
  const sky = M.skyColor(t).lerp(new THREE.Color(0x5a6470), w * 0.6 * (0.3 + sunUp));
  scene.background = sky; scene.fog.color.copy(sky); scene.fog.far = baseFogFar * (1 - w * 0.45); scene.fog.near = 40 * (1 - w * 0.5);
  sun.intensity = (0.1 + 2.1 * sunUp) * (1 - w * 0.6); hemi.intensity = (0.45 + 0.65 * sunUp) * (1 - w * 0.3) + flash * 3; flash = Math.max(0, flash - dt * 3);
  const ang = (t - 0.25) * Math.PI * 2, px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  sun.position.set(px + Math.cos(ang) * 60, Math.max(15, Math.sin(ang) * 80), pz + 30); sun.target.position.set(px, 0, pz);
  if (gfx) {
    hemi.intensity *= 0.55;
    gfx.update(dt, { sunDir: new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.45), skyColor: sky, fogColor: sky, wet: w, night: 1 - sunUp });
    gfxT -= dt; if (gfxT <= 0) { gfxT = 2; for (const v of vehicles) if (v.mesh && !v.mesh.userData.gfxDone) { gfx.upgrade(v.mesh); v.mesh.userData.gfxDone = true; } }
  }
  if (ULTRA.on) { ULTRA.bloom.strength = 0.12 + (1 - sunUp) * 0.6; ULTRA.bloom.threshold = 1.0 - (1 - sunUp) * 0.3; }
  const night = 1 - sunUp;
  if (streetLights[0]) streetLights[0].userData.bulb.material.emissiveIntensity = 0.2 + night * 2.5;
  // wet roads
  for (const m of roadMats) { m.roughness = 0.9 - w * 0.6; m.metalness = w * 0.35; }
  rain.visible = w > 0.15; rain.material.opacity = 0.6 * w;
  if (rain.visible) { rain.position.set(camera.position.x, camera.position.y - 15, camera.position.z); const a = rainGeo.attributes.position.array; for (let i = 1; i < a.length; i += 3) { a[i] -= 28 * dt; if (a[i] < 0) a[i] += 30; } rainGeo.attributes.position.needsUpdate = true; }
  audio.setRain(w);
  if (w > 0.7) { state.thunderT -= dt; if (state.thunderT <= 0) { flash = 1; setTimeout(() => audio.crash(0.5), 600); state.thunderT = rand(12, 30); } }
  water.position.y = 0.05 + Math.sin(state.now * 0.8) * 0.05;
}

// ---------- minimap ----------
const mmEl = $('minimap'), mm = mmEl.getContext('2d'); let MMS = 280, MMR = 170, mmBig = false; // canvas px, world range radius in units
const mmView = { cx: 0, cz: 0, R: 800 }, MM_ZOOMS = [300, 600, 1200, 2400];
function playerXZ() { return player.car ? [player.car.x, player.car.z] : [player.x, player.z]; }
function toggleBigMap(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); } mmBig = !mmBig; mmEl.classList.toggle('big', mmBig); MMS = mmBig ? 720 : 280; MMR = mmBig ? mmView.R : 170; mmEl.width = mmEl.height = MMS;
  if (mmBig) { const [x, z] = playerXZ(); mmView.cx = x; mmView.cz = z; }
  $('mmhint').style.display = $('mmctl').style.display = mmBig ? 'flex' : 'none';
}
function mmZoom(f) { mmView.R = clamp(mmView.R * f, 150, 6000); MMR = mmView.R; }
function mmToWorld(cxp, cyp) { const r = mmEl.getBoundingClientRect(), u = (cxp - r.left) / r.width * MMS, v = (cyp - r.top) / r.height * MMS, sc = MMS / 2 / MMR; return [mmView.cx + (u - MMS / 2) / sc, mmView.cz + (v - MMS / 2) / sc]; }
function setWaypoint(x, z) {
  const w = state.waypoint; if (w && Math.hypot(w.x - x, w.z - z) < MMR * 0.06) { state.waypoint = null; showMsg('Waypoint cleared', 1.5); return; }
  state.waypoint = { x, z }; audio.pickup?.(); showMsg(allowedAt(x, z) ? '📍 Waypoint set: ' + streetName(x, z) : '📍 Waypoint set', 2);
}
{
  const ptrs = new Map(); let drag = null, pinch = null;
  mmEl.style.touchAction = 'none';
  mmEl.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); if (!mmBig) { toggleBigMap(); return; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); mmEl.setPointerCapture?.(e.pointerId);
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: mmView.cx, cz: mmView.cz, moved: false };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), R: mmView.R }; if (drag) drag.moved = true; }
  });
  mmEl.addEventListener('pointermove', e => {
    if (!mmBig || !ptrs.has(e.pointerId)) return; e.preventDefault(); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); mmView.R = clamp(pinch.R * pinch.d / Math.max(20, d), 150, 6000); MMR = mmView.R; return; }
    if (drag) { const r = mmEl.getBoundingClientRect(), k = (MMR * 2) / r.width, dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 8) drag.moved = true; if (drag.moved) { mmView.cx = drag.cx - dx * k; mmView.cz = drag.cz - dy * k; } }
  });
  const up = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (ptrs.size === 0 && drag) { if (!drag.moved && mmBig) setWaypoint(...mmToWorld(e.clientX, e.clientY)); drag = null; } };
  mmEl.addEventListener('pointerup', up); mmEl.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
  mmEl.addEventListener('wheel', e => { if (!mmBig) return; e.preventDefault(); mmZoom(e.deltaY > 0 ? 1.25 : 0.8); }, { passive: false });
  const btn = (id, fn) => { const el = $(id); const go = e => { e.preventDefault(); e.stopPropagation(); fn(); }; el.addEventListener('touchstart', go, { passive: false }); el.addEventListener('mousedown', go); };
  btn('mmClose', () => { if (mmBig) toggleBigMap(); }); btn('mmIn', () => mmZoom(0.6)); btn('mmOut', () => mmZoom(1.6));
  btn('mmMe', () => { const [x, z] = playerXZ(); mmView.cx = x; mmView.cz = z; }); btn('mmClear', () => { state.waypoint = null; showMsg('Waypoint cleared', 1.5); });
}
addEventListener('keydown', e => { if (e.code === 'KeyM') toggleBigMap(); if (mmBig && (e.key === '+' || e.key === '=')) mmZoom(0.7); if (mmBig && e.key === '-') mmZoom(1.4); });
function route(fx, fz, tx, tz) { // BFS on road grid
  const near = (x, z) => [clamp(Math.round((x + HALF) / B), 0, N), clamp(Math.round((z + HALF) / B), 0, N)];
  const [si, sj] = near(fx, fz), [ti, tj] = near(tx, tz);
  const prev = new Map(), q = [[si, sj]], key = (i, j) => i * 10 + j; prev.set(key(si, sj), null);
  while (q.length) { const [i, j] = q.shift(); if (i === ti && j === tj) break; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a > N || b > N || prev.has(key(a, b))) continue; prev.set(key(a, b), [i, j]); q.push([a, b]); } }
  const pts = [[tx, tz]]; let c = [ti, tj]; while (c) { pts.push([lines[c[0]], lines[c[1]]]); c = prev.get(key(c[0], c[1])); }
  pts.push([fx, fz]); return pts.reverse();
}
function drawMinimap() {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z, sc = MMS / 2 / MMR;
  const ccx = mmBig ? mmView.cx : px, ccz = mmBig ? mmView.cz : pz;
  const X = x => MMS / 2 + (x - ccx) * sc, Z = z => MMS / 2 + (z - ccz) * sc;
  mm.fillStyle = '#4c7a4a'; mm.fillRect(0, 0, MMS, MMS);
  { const top = Math.max(0, Z(-1650)), hh = Math.min(MMS, Z(5600)) - top; mm.fillStyle = '#e9d59a'; mm.fillRect(X(HALF + 8), top, (SHORE - HALF) * sc, hh); mm.fillStyle = '#1f7fb0'; mm.fillRect(X(SHORE), top, MMS, hh); }
  mm.fillStyle = '#b8b4aa'; mm.fillRect(X(-70), Z(-380), 110 * sc, 160 * sc);
  mm.fillStyle = '#1f7fb0'; mm.fillRect(X(port.waterRect.minX), Z(port.waterRect.minZ), (port.waterRect.maxX - port.waterRect.minX + 18) * sc, 160 * sc);
  mm.fillStyle = '#555'; mm.fillRect(X(-10), Z(-380), 20 * sc, 200 * sc); for (const zz of [-340, -260]) mm.fillRect(X(-70), Z(zz - 10), 110 * sc, 20 * sc);
  mm.fillStyle = '#6b6b72'; mm.fillRect(X(FW.x - FW.W / 2), Z(FW.z0), FW.W * sc, (FW.z1 - FW.z0) * sc); mm.fillRect(X(-215), Z(FW.z0 - 11), 150 * sc, 20 * sc); mm.fillRect(X(-215), Z(185), 47 * sc, 30 * sc);
  mm.fillStyle = '#4a5a8a'; mm.fillRect(X(IS.x0), Z(IS.z - IS.W / 2), (IS.x1 - IS.x0 + 28) * sc, IS.W * sc); mm.fillRect(X(-217), Z(196), 25 * sc, (IS.z - 196) * sc); for (const c of IS.cons) mm.fillRect(X(c - RW / 2), Z(180), RW * sc, (IS.z - 180) * sc);
  mm.strokeStyle = '#4a5a8a'; mm.lineCap = 'round'; for (const h of HWS) { mm.lineWidth = h.width * sc; mm.beginPath(); h.segs.forEach((g, i) => { if (!i) mm.moveTo(X(g.a.x), Z(g.a.z)); mm.lineTo(X(g.b.x), Z(g.b.z)); }); mm.stroke(); }
  mm.fillStyle = '#8a8a90'; for (const rz of [-110, 110]) mm.fillRect(X(-1970 - 230), Z(-211 + rz - 15), 460 * sc, 30 * sc); mm.fillRect(X(-1970 - 130), Z(-211 - 35), 260 * sc, 70 * sc); mm.fillRect(X(-1840), Z(-51), 140 * sc, 20 * sc);
  for (const r of [...LINKS, ...downtown.streets, ...SWROADS]) mm.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * sc, (r.maxZ - r.minZ) * sc);
  mm.fillStyle = '#3f6a5a'; for (const r of swamp.waterRects) mm.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * sc, (r.maxZ - r.minZ) * sc); mm.fillStyle = '#8a8a90';
  mm.fillRect(X(-160), Z(1700), 20 * sc, 300 * sc); mm.fillRect(X(-300), Z(1840), 300 * sc, 20 * sc);
  mm.fillStyle = '#999'; for (const l of lots) mm.fillRect(X(l.cx - LOT / 2), Z(l.cz - LOT / 2), LOT * sc, LOT * sc);
  mm.fillStyle = '#5fae5a'; for (const l of lots) if (l.park) mm.fillRect(X(l.cx - LOT / 2 + 3), Z(l.cz - LOT / 2 + 3), (LOT - 6) * sc, (LOT - 6) * sc);
  for (const c of CITIES) { const b = c.bounds; if (X(b.maxX) < 0 || X(b.minX) > MMS || Z(b.maxZ) < 0 || Z(b.minZ) > MMS) continue; mm.fillStyle = '#999'; mm.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * sc, (b.maxZ - b.minZ) * sc); mm.fillStyle = '#5fae5a'; for (const p of c.parks) mm.fillRect(X(p.x - p.s / 2), Z(p.z - p.s / 2), p.s * sc, p.s * sc); mm.fillStyle = '#555'; for (const r of c.streets) mm.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * sc, (r.maxZ - r.minZ) * sc); }
  const vx0 = ccx - MMR - 5, vx1 = ccx + MMR + 5, vz0 = ccz - MMR - 5, vz1 = ccz + MMR + 5;
  mm.fillStyle = '#d8d8d8'; for (const c of colliders) if (c.maxX > vx0 && c.minX < vx1 && c.maxZ > vz0 && c.minZ < vz1) mm.fillRect(X(c.minX), Z(c.minZ), (c.maxX - c.minX) * sc, (c.maxZ - c.minZ) * sc);
  { const lab = (x, z, t) => { const lx = X(x), lz = Z(z); if (lx < 10 || lz < 10 || lx > MMS - 10 || lz > MMS - 10) return; const f = mmBig ? 15 : 10; mm.font = `bold ${f}px Arial`; mm.textAlign = 'center'; const w = mm.measureText(t).width + 8; mm.fillStyle = '#1d4fb8'; mm.fillRect(lx - w / 2, lz - f * 0.8, w, f * 1.4); mm.strokeStyle = '#fff'; mm.lineWidth = 1.5; mm.strokeRect(lx - w / 2, lz - f * 0.8, w, f * 1.4); mm.fillStyle = '#fff'; mm.fillText(t, lx, lz + f * 0.35); };
    for (const h of HWS) { const sp = mmBig ? MMR * 0.5 : 160; let acc = -sp / 2; for (const g of h.segs) { let t0 = 0; while (acc + g.len * (1 - t0) >= 0) { const need = -acc; const t = t0 + need / g.len; if (t > 1) break; lab(g.a.x + (g.b.x - g.a.x) * t, g.a.z + (g.b.z - g.a.z) * t, 'I-' + h.number); t0 = t; acc = -sp; } acc += g.len * (1 - t0); } }
    if (MMR < 1500) { lab((IS.x0 + IS.x1) / 2 - 40, IS.z, 'I-395'); lab(FW.x, -60, 'VB-1'); }
    if (mmBig) { mm.font = 'bold 18px Arial'; mm.fillStyle = '#fff'; mm.textAlign = 'center'; mm.fillText('VICE BAY', X(0), Z(0)); mm.fillText('PORT CORAL', X(20), Z(-300)); mm.fillText('VICE BAY INTL ✈', X(-1970), Z(-260)); mm.fillText('PALMETTO SPRINGS', X(-150), Z(1830)); mm.fillText('VICE BAY HEIGHTS', X(-450), Z(-185)); mm.fillText('GATOR GLADES', X(100), Z(-2125)); for (const c of CITIES) mm.fillText(c.name.toUpperCase(), X(c.center.x), Z(c.bounds.minZ - 14)); } }
  const dot = (x, z, col, r = 5, txt) => { if (mmBig) r *= 1.3; mm.fillStyle = col; mm.beginPath(); mm.arc(clamp(X(x), 8, MMS - 8), clamp(Z(z), 8, MMS - 8), r, 0, 7); mm.fill(); if (txt) { mm.fillStyle = '#fff'; mm.font = 'bold 11px Arial'; mm.textAlign = 'center'; mm.fillText(txt, clamp(X(x), 8, MMS - 8), clamp(Z(z), 8, MMS - 8) + 4); } };
  const tgt = state.mission?.target;
  if (tgt) { const r = route(px, pz, tgt.x, tgt.z); if (tgt.z < -EDGE || pz < -EDGE) { r.length = 0; if (pz < -EDGE && tgt.z > -EDGE) { r.push([px, pz], [0, pz], [0, -180], ...route(0, -180, tgt.x, tgt.z)); } else if (tgt.z < -EDGE && pz > -EDGE) { r.push(...route(px, pz, 0, -180), [0, -180], [0, tgt.z], [tgt.x, tgt.z]); } else r.push([px, pz], [0, pz], [0, tgt.z], [tgt.x, tgt.z]); } mm.strokeStyle = '#ff5e7e'; mm.lineWidth = 5; mm.beginPath(); r.forEach(([x, z], i) => i ? mm.lineTo(X(x), Z(z)) : mm.moveTo(X(x), Z(z))); mm.stroke(); }
  dot(POI.spray.x, POI.spray.z, '#00a86b', 8, '$'); dot(POI.hospital.x, POI.hospital.z, '#2b6cff', 8, 'H'); dot(POI.safe.x, POI.safe.z, '#8a5cff', 8, 'S'); dot(POI.police.x, POI.police.z, '#c0392b', 8, 'P'); dot(POI.garage.x, POI.garage.z, '#00a86b', 7, 'C'); dot(POI.diner.x, POI.diner.z, '#ff9f1c', 7, 'D'); for (const [x, z] of HELIPADS) dot(x, z, '#333a44', 6, 'H');
  if (!state.mission) for (const m of missionMarkers) dot(m.mesh.position.x, m.mesh.position.z, '#ffd23f', 8, '!');
  for (const p of pickups) dot(p.x, p.z, '#' + PK[p.kind][0].toString(16).padStart(6, '0'), 3);
  for (const v of vehicles) if (v.type === 'police' && !v.dead) dot(v.x, v.z, Math.floor(state.now * 6) % 2 ? '#ff2d2d' : '#2d6bff', 5);
  if (tgt) dot(tgt.x, tgt.z, '#ff5e7e', 7);
  const wp = state.waypoint;
  if (wp) {
    mm.save(); mm.setLineDash([8, 6]); mm.strokeStyle = '#ff2d9a'; mm.lineWidth = mmBig ? 4 : 3; mm.beginPath(); mm.moveTo(X(px), Z(pz)); mm.lineTo(X(wp.x), Z(wp.z)); mm.stroke(); mm.restore();
    const wx = clamp(X(wp.x), 10, MMS - 10), wz = clamp(Z(wp.z), 10, MMS - 10), k = mmBig ? 1.6 : 1;
    mm.fillStyle = '#ff2d9a'; mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.beginPath(); mm.arc(wx, wz - 10 * k, 7 * k, Math.PI * 0.85, Math.PI * 2.15); mm.lineTo(wx, wz); mm.closePath(); mm.fill(); mm.stroke();
    mm.fillStyle = '#fff'; mm.beginPath(); mm.arc(wx, wz - 10 * k, 2.6 * k, 0, 7); mm.fill();
  }
  // other players
  for (const r of remotes.values()) {
    const rx = X(r.x), rz = Z(r.z); mm.fillStyle = '#' + r.color.toString(16).padStart(6, '0'); mm.strokeStyle = '#fff'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(rx, rz, mmBig ? 8 : 6, 0, Math.PI * 2); mm.fill(); mm.stroke();
    if (mmBig) { mm.fillStyle = '#fff'; mm.font = 'bold 13px sans-serif'; mm.textAlign = 'center'; mm.fillText(r.name, rx, rz - 12); }
  }
  // player arrow
  const h = player.car ? player.car.heading : player.heading;
  mm.save(); mm.translate(X(px), Z(pz)); mm.rotate(-h); if (mmBig) mm.scale(1.5, 1.5); mm.fillStyle = '#fff'; mm.strokeStyle = '#000'; mm.lineWidth = 2;
  mm.beginPath(); mm.moveTo(0, -11); mm.lineTo(8, 9); mm.lineTo(0, 4); mm.lineTo(-8, 9); mm.closePath(); mm.fill(); mm.stroke(); mm.restore();
}

// ---------- HUD ----------
let lastHud = 0;
function updateHud() {
  { const w = state.waypoint, el = $('wpdist'); if (w) { const [x, z] = playerXZ(), d = Math.hypot(w.x - x, w.z - z); if (d < 18) { state.waypoint = null; showMsg('📍 You have arrived', 2); el.style.display = 'none'; } else { el.style.display = 'block'; el.textContent = '📍 ' + (d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'); } } else el.style.display = 'none'; }
  $('money').textContent = '$' + Math.floor(player.money).toLocaleString('en-US');
  const st = $('stars'); [...st.children].forEach((s, i) => s.classList.toggle('on', i < state.wanted)); st.classList.toggle('blink', state.wanted > 0 && state.unseen > 0);
  const mins = Math.floor(state.time * 1440), hh = String(Math.floor(mins / 60)).padStart(2, '0'), mn = String(mins % 60).padStart(2, '0');
  $('clock').textContent = `${hh}:${mn}${state.weather > 0.5 ? ' 🌧' : ''}`;
  $('hpBar').style.width = player.health + '%'; $('armorBar').style.width = player.armor + '%';
  $('weaponName').textContent = player.car ? `${player.car.name} · ${Math.round(Math.abs(player.car.speed) * 3.6 * 0.62)} mph · ${player.car.kind === 'heli' ? Math.round(player.car.y * 3.3) + ' ft · ' : ''}${Math.round(player.car.health)}%` : (player.weapon === 1 ? 'Pistol' : 'Fists');
  $('btnShoot').textContent = player.weapon === 1 ? '🔫' : '👊';
  $('btnEnter').textContent = player.car ? 'EXIT' : 'CAR';
  const hk = player.car?.kind === 'heli'; $('btnJump').textContent = hk ? 'UP' : player.car ? 'BRAKE' : 'JUMP'; $('btnSprint').textContent = hk ? 'DOWN' : player.car ? 'DRIFT' : 'RUN';
  $('btnHorn').style.display = player.car ? '' : 'none'; $('btnRadio').style.display = player.car ? '' : 'none'; $('btnWeapon').style.display = player.car ? 'none' : ''; $('btnShoot').style.display = player.car ? 'none' : '';
  const m = state.mission; $('timer').textContent = m && m.t != null && m.t > 0 ? `${Math.floor(m.t / 60)}:${String(Math.floor(m.t % 60)).padStart(2, '0')}` : '';
  // context prompt
  let pr = '';
  if (!player.car && !state.mission) { const v = nearestVehicle(player.swim ? 5.5 : 5); if (v) pr = `CAR: ${v.type === 'traffic' ? 'steal' : v.kind === 'heli' ? 'fly' : v.kind === 'boat' ? 'board' : 'enter'} ${v.name}`; }
  const sn = streetName(player.car ? player.car.x : player.x, player.car ? player.car.z : player.z), se = $('street');
  if (se.textContent !== sn) { se.textContent = sn; se.classList.remove('fade'); void se.offsetWidth; se.classList.add('fade'); }
  const pe = $('prompt'); pe.textContent = pr; pe.style.display = pr ? 'block' : 'none';
}

// ---------- interactions ----------
function updateInteractions(dt) {
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  state.saveCD -= dt;
  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.m.rotation.y += dt * 2; p.m.position.y = 1.2 + Math.sin(state.now * 3 + i) * 0.2;
    if (Math.hypot(p.x - px, p.z - pz) < (player.car ? 2.5 : 1.4)) {
      if (p.kind === 'cash') { player.money += p.amount; showMsg(`+$${p.amount}`, 1.2); }
      else if (p.kind === 'health') { if (player.health >= 100) continue; player.health = Math.min(100, player.health + 50); showMsg('Health +50', 1.2); }
      else { if (player.armor >= 100) continue; player.armor = Math.min(100, player.armor + 50); showMsg('Armor +50', 1.2); }
      audio.pickup(); scene.remove(p.m); pickups.splice(i, 1); setTimeout(() => spawnPickup(), 45000);
    }
  }
  // POIs
  if (player.car && Math.hypot(POI.spray.x - px, POI.spray.z - pz) < 4 && state.saveCD <= 0 && !state.mission) {
    state.saveCD = 6;
    if (player.money < 100) showMsg('Spray Shop: $100 needed');
    else {
      const v = player.car, seen = state.wanted > 0 && state.unseen === 0 && vehicles.some(o => o.type === 'police' && Math.hypot(o.x - px, o.z - pz) < 30);
      if (seen) showMsg('Not with cops watching!');
      else {
        player.money -= 100; const nc = pick(M.CAR_COLORS.filter(c => c !== v.color)); const old = v.mesh;
        v.mesh = v.kind === 'car' ? M.makeCar(nc) : old; if (v.kind !== 'car') old.traverse(o => { if (o.isMesh && o.material?.color && o.material.metalness >= 0.5 && o.material.metalness < 0.9) o.material.color.setHex(nc); }); if (v.sports) v.mesh.scale.copy(old.scale); v.mesh.position.copy(old.position); scene.remove(old); scene.add(v.mesh); v.color = nc;
        v.health = 100; v.burnT = 0; state.wanted = 0; audio.pickup(); showMsg('New paint, fixed up. Cops lost track of you. -$100', 3);
        vehicles.filter(o => o.type === 'police').forEach(o => o.speed = 0);
      }
    }
  }
  if (!player.car && Math.hypot(POI.safe.x - px, POI.safe.z - pz) < 3 && state.saveCD <= 0) { state.saveCD = 8; if (state.wanted) showMsg('Lose the cops before saving'); else saveGame(); }
  if (!player.car && Math.hypot(POI.hospital.x - px, POI.hospital.z - pz) < 3 && state.saveCD <= 0 && player.health < 100) { state.saveCD = 5; const c = Math.min(player.money, 50); player.money -= c; player.health = 100; showMsg(`Patched up at the hospital. -$${c}`); }
  if (player.car && player.car.kind !== 'heli' && player.car.kind !== 'boat' && Math.hypot(POI.garage.x - px, POI.garage.z - pz) < 5 && state.saveCD <= 0) {
    state.saveCD = 6; const v = player.car;
    if (v.tuned >= 3) showMsg('Port Coral Customs: fully tuned already');
    else if (player.money < 400) showMsg('Port Coral Customs: $400 per upgrade');
    else { player.money -= 400; v.tuned = (v.tuned || 0) + 1; v.maxSpeed *= 1.1; v.accel *= 1.15; v.grip = (v.grip || 1) * 1.08; v.health = Math.max(v.health, 100); audio.pickup(); showMsg(`Engine + tires upgraded (level ${v.tuned}/3). -$400`, 3); }
  }
  if (!player.car && Math.hypot(POI.diner.x - px, POI.diner.z - pz) < 3 && state.saveCD <= 0 && player.health < 100) { state.saveCD = 5; const c = Math.min(player.money, 20); player.money -= c; player.health = Math.min(100, player.health + 60); audio.pickup(); showMsg(`Coral Diner burger. Health +60. -$${c}`); }
  if (player.car && player.car.kind !== 'heli' && player.car.kind !== 'boat' && Math.hypot(POI.gas.x - px, POI.gas.z - pz) < 5 && state.saveCD <= 0 && player.car.health < 100) { state.saveCD = 6; const c = Math.min(player.money, 30); player.money -= c; player.car.health = Math.min(100, player.car.health + 40); showMsg(`Quick tune-up at the pumps. -$${c}`); }
  // mission start
  state.missionCD = (state.missionCD || 0) - dt;
  if (!state.mission && !state.dead && !cutLines && state.missionCD <= 0) for (const m of missionMarkers) if (Math.hypot(m.mesh.position.x - px, m.mesh.position.z - pz) < 3) {
    if (state.wanted) { if (state.saveCD <= 0) { showMsg('Lose the cops first'); state.saveCD = 3; } }
    else { startMission(m.ms); break; }
  }
  for (const m of missionMarkers) m.mesh.rotation.y += dt;
  for (const m of Object.values(poiMarkers)) m.rotation.y += dt;
}

// ---------- main loop ----------
let last = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
  if (state.paused || !state.started) { drawFrame(); return; }
  state.now += dt; readInput();
  state.fixedT = (state.fixedT || 0) - dt; if (state.fixedT <= 0) { state.fixedT = 15; ensureFixed(); }
  if (cutLines) { cutT -= dt; if (cutT <= 0 || input.enterP) nextLine(); input.enterP = false; input.mx = input.my = 0; input.shoot = input.jump = false; }
  if (input.weaponP) { player.weapon = 1 - player.weapon; audio.click(); } input.weaponP = false;
  if (input.hornP && player.car) { audio.horn(); scarePeds(player.car.x, player.car.z, 15); } input.hornP = false;
  if (input.enterP && !state.dead) { if (player.car) exitCar(); else enterCar(); } input.enterP = false;
  if (!state.dead) { if (player.car) updatePlayerCar(dt); else updateFoot(dt); }
  else if (player.car) audio.setEngine(0, 0);
  for (const v of [...vehicles]) {
    if (v.dead) { v.wreckT -= dt; if (v.wreckT <= 0 && Math.hypot(v.x - player.x, v.z - player.z) > 60) removeVehicle(v); }
    else {
      if (v.burnT) { v.burnT -= dt; if (Math.random() < dt * 15) puff(v.x, 1.3, v.z, Math.random() < 0.5 ? fireMat : smokeMat, 1, 2, 2.5); if (v.burnT <= 0) explode(v); }
      if (v.type === 'traffic') updateTraffic(v, dt); else if (v.type === 'police') updatePolice(v, dt);
      else if (v.type === 'parked') { v.speed *= Math.max(0, 1 - dt * 2); if (Math.abs(v.speed) > 0.1) moveCar(v, dt, false); }
    }
    if (v.kind === 'heli') {
      if (v !== player.car) { v.vy = -6; v.y = Math.max(0, v.y - 6 * dt); v.speed *= Math.max(0, 1 - dt); if (v.y > 0) { const [a, b] = fwd(v.heading); v.x += a * v.speed * dt; v.z += b * v.speed * dt; } else if (!v.dead) V.animateHeli(v.mesh, dt, 0.05, state.now); }
      v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.set(v.pitch || 0, v.heading, v.roll || 0, 'YXZ');
    } else if (v.kind === 'boat') {
      v.mesh.position.set(v.x, -0.3 + Math.sin(state.now * 2 + v.x) * 0.08, v.z); v.mesh.rotation.set(-clamp(v.speed / 60, -0.1, 0.12), v.heading, Math.sin(state.now * 1.6 + v.z) * 0.04, 'YXZ');
      if (v.mesh.userData.wake) v.mesh.userData.wake.visible = Math.abs(v.speed) > 3;
    } else {
      v.mesh.position.set(v.x, v.y || 0, v.z); v.mesh.rotation.y = v.heading + (v.drift || 0);
      if (!v.dead && v.mesh.userData.wheels?.length) M.animateCar(v.mesh, v.speed, dt, v.braking || (v.type === 'traffic' && v.speed < 3), state.now);
    }
  }
  vehicleCollisions();
  talkCD -= dt; callCD -= dt; for (const p of [...peds]) updatePed(p, dt);
  // keep population near player
  const px = player.car ? player.car.x : player.x, pz = player.car ? player.car.z : player.z;
  for (const v of [...vehicles]) if (v.type === 'traffic' && Math.hypot(v.x - px, v.z - pz) > 170) removeVehicle(v);
  const trafficN = settings.quality === 'low' ? 12 : 18, pedN = settings.quality === 'low' ? 18 : 28;
  if (vehicles.filter(v => v.type === 'traffic').length < trafficN) spawnTraffic({ x: px, z: pz });
  for (const p of [...peds]) if (p.state !== 'dead' && Math.hypot(p.x - px, p.z - pz) > 130) { scene.remove(p.mesh); peds.splice(peds.indexOf(p), 1); }
  if (peds.filter(p => p.state !== 'dead').length < pedN) { const nearLots = lots.concat(npcLots).filter(l => { const d = Math.hypot(l.cx - px, l.cz - pz); return d > 40 && d < 110; }); if (nearLots.length) spawnPed(pick(nearLots)); }
  updateWanted(dt);
  tl.update(dt); swamp.update(dt); downtown.update(dt);
  if (player.car && player.car.kind !== 'heli' && player.car.kind !== 'boat' && !(player.car.y > 0.5)) {
    const c = player.car, [hx, hz] = fwd(c.heading); state.redCD = (state.redCD || 0) - dt;
    if (state.redCD <= 0 && tl.ranRed(c.x, c.z, hx, hz, Math.abs(c.speed))) { state.redCD = 4; const cop = vehicles.some(o => o.type === 'police' && !o.dead && Math.hypot(o.x - c.x, o.z - c.z) < 45); if (cop && state.wanted === 0) { addWanted(1); showMsg('A cop saw you run a red light!'); } }
  }
  updateFwTraffic(dt); updateIsTraffic(dt); updateHwTraffic(dt);
  if (state.mission && state.mission._started && !cutLines) state.mission.def.update(state.mission, dt);
  updateInteractions(dt); updateRemotes(dt); updateEnv(dt); updateFx(dt); updateCamera(dt);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('msg').classList.remove('show'); }
  if (bigTimer > 0) { bigTimer -= dt; if (bigTimer <= 0) $('big').classList.remove('show'); }
  if (state.now - lastHud > 0.1) { lastHud = state.now; updateHud(); drawMinimap(); }
  drawFrame();
}

// ---------- menus ----------
function show(id) { for (const s of ['pause', 'settings', 'help', 'missionList', 'mp']) $(s).classList.toggle('hidden', s !== id); }
function togglePause(force) {
  if (!state.started) return;
  state.paused = force ?? !state.paused; show(state.paused ? 'pause' : null);
  if (state.paused) { audio.setSiren(0); audio.stopRadio(); if (audio.ctx) audio.ctx.suspend(); }
  else { audio.unlock(); if (player.car && settings.radio) audio.startRadio(); last = performance.now(); }
}
$('btnPause').addEventListener('click', () => { audio.click(); togglePause(); });
$('btnPause').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); togglePause(); }, { passive: false });
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  audio.click(); const a = b.dataset.act;
  if (a === 'resume') togglePause(false);
  else if (a === 'save') { if (state.wanted) showMsg('Lose the cops before saving'); else saveGame(); togglePause(false); }
  else if (a === 'load') { if (loadGame()) togglePause(false); }
  else if (a === 'settings') { syncSettingsUI(); show('settings'); }
  else if (a === 'help') show('help');
  else if (a === 'missions') { $('missionItems').innerHTML = MISSIONS.map(m => `<p>${state.done.includes(m.id) ? '✅' : '⭕'} <b>${m.name}</b> — $${m.reward}</p>`).join('') + '<p style="opacity:.7">Yellow markers on the map start missions.</p>'; show('missionList'); }
  else if (a === 'restart') { if (confirm('Start a new game? Unsaved progress is lost.')) { newGame(); togglePause(false); } }
  else if (a === 'back') show('pause');
  else if (a === 'mp') { $('mpName').value = settings.mpName || ''; if (state.started) show('mp'); else $('mp').classList.remove('hidden'); }
}));
function syncSettingsUI() {
  $('setQuality').value = settings.quality; $('setVolume').value = settings.volume; $('setRadio').value = settings.radio ? '1' : '0';
  $('setRain').value = settings.rain; $('setHand').value = settings.leftHanded ? '1' : '0'; $('setBtn').value = settings.btnScale; $('setSens').value = settings.sens;
}
function applyControls() { $('buttons').classList.toggle('left', settings.leftHanded); $('buttons').style.transform = `scale(${settings.btnScale})`; }
$('setQuality').onchange = e => { settings.quality = e.target.value; applyQuality(); saveSettings(); };
$('setVolume').oninput = e => { settings.volume = +e.target.value; audio.setVolume(settings.volume); saveSettings(); };
$('setRadio').onchange = e => { settings.radio = e.target.value === '1'; saveSettings(); };
$('setRain').onchange = e => { settings.rain = e.target.value; saveSettings(); };
$('setHand').onchange = e => { settings.leftHanded = e.target.value === '1'; applyControls(); saveSettings(); };
$('setBtn').oninput = e => { settings.btnScale = +e.target.value; applyControls(); saveSettings(); };
$('setSens').oninput = e => { settings.sens = +e.target.value; saveSettings(); };
addEventListener('visibilitychange', () => { if (document.hidden && state.started && !state.paused) togglePause(true); });

// ---------- boot ----------
function begin(cont) {
  audio.unlock(); audio.setVolume(settings.volume); audio.startAmbience();
  if (!(cont && loadGame())) newGame();
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
  state.started = true; state.paused = false; last = performance.now();
  state.camYaw = Math.PI; showMsg('Yellow markers start missions. Tap ❚❚ for controls.', 4);
}
$('btnNew').addEventListener('click', () => begin(false));
$('btnContinue').addEventListener('click', () => begin(true));
if (!localStorage.getItem(SAVE_KEY)) $('btnContinue').style.display = 'none';
for (let i = 0; i < 14; i++) spawnPickup();
for (let i = 0; i < 16; i++) spawnTraffic(null);
for (let i = 0; i < 24; i++) spawnPed();
player.x = POI.safe.x; player.z = POI.safe.z - 1;
// ---------- multiplayer (net.js) ----------
const remotes = new Map();
const MP_COLORS = [0xff2d6f, 0x19c3ff, 0xffd23f, 0x2ee59d, 0x8a5cff, 0xff7a1a];
function mpMakeMesh(kind, color) {
  let m;
  if (kind === 'foot') m = M.makePerson({ shirt: color });
  else if (kind === 'sports') m = V.makeSportsCar(color); else if (kind === 'bike') m = V.makeMotorcycle(color);
  else if (kind === 'truck') m = V.makeTruck(color); else if (kind === 'bus') m = V.makeBus(color);
  else if (kind === 'boat') m = V.makeBoat(color); else if (kind === 'heli') m = V.makeHelicopter(color);
  else if (kind === 'jet') m = makeJet(color); else m = M.makeCar(color);
  if (gfx) gfx.upgrade(m); return m;
}
function mpLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = '#000'; g.strokeText(text, 128, 46);
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillText(text, 128, 46);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, fog: false })); sp.scale.set(4, 1, 1); sp.renderOrder = 10; return sp;
}
function mpOnState(m) {
  if (typeof m.x !== 'number' || typeof m.z !== 'number') return;
  let r = remotes.get(m.id);
  const name = String(m.n || 'Player').slice(0, 12), color = MP_COLORS[(m.c | 0) % MP_COLORS.length], kind = String(m.k || 'foot');
  if (!r) { r = { x: m.x, z: m.z, y: m.y || 0, h: m.h || 0, name, color, kind: null, mesh: null, label: mpLabel(name, color) }; scene.add(r.label); remotes.set(m.id, r); showMsg('👋 ' + name + ' joined'); }
  if (r.kind !== kind) { if (r.mesh) scene.remove(r.mesh); r.kind = kind; r.mesh = mpMakeMesh(kind, color); scene.add(r.mesh); }
  r.tx = m.x; r.tz = m.z; r.ty = m.y || 0; r.th = m.h || 0; r.sp = m.sp || 0; r.last = performance.now();
}
function mpRemove(id) { const r = remotes.get(id); if (!r) return; scene.remove(r.label); if (r.mesh) scene.remove(r.mesh); remotes.delete(id); showMsg('👋 ' + r.name + ' left'); }
function updateRemotes(dt) {
  const now = performance.now(), k = Math.min(1, dt * 10);
  for (const [id, r] of remotes) {
    if (now - r.last > 8000) { mpRemove(id); continue; }
    r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; r.y += (r.ty - r.y) * k;
    let d = r.th - r.h; d = Math.atan2(Math.sin(d), Math.cos(d)); r.h += d * k;
    r.mesh.position.set(r.x, r.y, r.z); r.mesh.rotation.y = r.h;
    if (r.kind === 'foot') M.animatePerson(r.mesh, r.sp, dt);
    r.label.position.set(r.x, r.y + (r.kind === 'foot' ? 2.6 : r.kind === 'bus' || r.kind === 'truck' || r.kind === 'jet' ? 5.5 : 3.2), r.z);
  }
}
const net = createNet({ onState: mpOnState, onLeave: mpRemove, onStatus: (t, st) => { $('mpStatus').textContent = t; $('mpStatus').className = st; $('mpLeave').style.display = net && net.active ? '' : 'none'; } });
let mpColor = Math.random() * MP_COLORS.length | 0;
setInterval(() => {
  if (!net.active || !state.started) return;
  const v = player.car;
  net.broadcast({ n: settings.mpName || 'Player', c: mpColor, x: +(v ? v.x : player.x).toFixed(2), z: +(v ? v.z : player.z).toFixed(2), y: +(v ? v.y || 0 : player.y || 0).toFixed(2),
    h: +(v ? v.heading : player.heading).toFixed(3), k: v ? v.kind : 'foot', sp: +(v ? Math.abs(v.speed) : (player.spd || 0)).toFixed(1) });
}, 100);
const mpSaveName = () => { settings.mpName = $('mpName').value.trim().slice(0, 12); saveSettings(); };
$('mpHost').onclick = () => { audio.click(); mpSaveName(); net.hostGame(); };
$('mpJoin').onclick = () => { audio.click(); mpSaveName(); net.join($('mpCode').value); };
$('mpCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('mpLeave').onclick = () => { audio.click(); net.leave(); for (const id of [...remotes.keys()]) mpRemove(id); $('mpStatus').textContent = 'Not connected'; $('mpLeave').style.display = 'none'; };
$('mpBack').onclick = () => { audio.click(); if (state.started) show('pause'); else $('mp').classList.add('hidden'); };
$('mpLeave').style.display = 'none';
addEventListener('pagehide', () => net.leave());
window.__mp = { net, remotes };

refreshMissionMarkers(); applyQuality(); applyControls();
gfx = setupGraphics(renderer, scene, camera, { quality: settings.quality === 'ultra' ? 'high' : settings.quality }); gfx.upgrade(scene); applyQuality();
camera.position.set(player.x + 30, 40, player.z + 50); camera.lookAt(player.x, 0, player.z);
window.__game = { state, player, vehicles, peds, settings, enterCar, exitCar, addWanted, MISSIONS, startMission, POI, HWS };
requestAnimationFrame(frame);
