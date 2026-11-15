// Mika: online multiplayer for Vice Bay, phone to phone (WebRTC via PeerJS's free public broker; no server of our own).
// Star layout: the host relays everyone's updates. Up to ~8 players.
//
//   import { Net, RemotePlayers } from './assets/net.js';
//   const net = new Net();
//   const code = await net.host('Steven');          // show `code` (e.g. "K7Q2P") to friends
//   await net.join('K7Q2P', 'Alex');                // on a friend's phone
//   net.on('join', p => toast(p.name + ' joined')); net.on('leave', p => ...); net.on('event', (p, e) => ...);
//   net.on('error', msg => toast(msg)); net.on('closed', () => ...);
//   every frame: net.sendState({ x, y, z, heading, speed, car: player.car ? { type, color } : null, moving });  // throttled to 12/s inside
//   one-offs:    net.sendEvent({ type: 'shot', x, z }) / { type: 'horn' } / { type: 'chat', text }
//   net.players -> Map(id -> { id, name, state }); net.leave();
//
//   const remotes = new RemotePlayers(scene, net); remotes.update(dt) every frame  // draws other players with name tags, smoothed
import * as THREE from 'three';
import { makePerson, animatePerson, makeCar, animateCar } from './models.js';

const PREFIX = 'vicebay-v1-';
let peerLib;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerLib) peerLib = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = new URL('../vendor/peerjs.min.js', import.meta.url).href;
    s.onload = () => res(window.Peer); s.onerror = () => rej(new Error('Could not load multiplayer library')); document.head.appendChild(s);
  });
  return peerLib;
}
const code5 = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.random() * 31 | 0]).join('');

export class Net {
  constructor() { this.peer = null; this.isHost = false; this.code = null; this.name = 'Player'; this.players = new Map(); this.conns = new Map(); this.hostConn = null; this.h = {}; this._last = 0; this.id = null; }
  on(ev, fn) { (this.h[ev] ||= []).push(fn); return this; }
  _emit(ev, ...a) { (this.h[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
  get online() { return !!this.peer && (this.isHost || !!this.hostConn?.open); }

  async _open(id) {
    const Peer = await loadPeer();
    return new Promise((res, rej) => {
      const p = new Peer(id, { debug: 0 }); let done = false;
      p.on('open', pid => { done = true; res(p); });
      p.on('error', e => { if (!done) { done = true; rej(e); } else this._emit('error', friendly(e)); });
      p.on('disconnected', () => { if (!p.destroyed) p.reconnect(); });
      setTimeout(() => { if (!done) { done = true; p.destroy(); rej(new Error('timeout')); } }, 12000);
    });
  }

  async host(name = 'Host') {
    this.leave(); this.name = name.slice(0, 16); this.isHost = true;
    for (let tries = 0; tries < 4; tries++) {
      this.code = code5();
      try { this.peer = await this._open(PREFIX + this.code); break; } catch (e) { if (e.type !== 'unavailable-id' || tries === 3) { this.isHost = false; throw new Error(friendly(e)); } }
    }
    this.id = this.peer.id;
    this.peer.on('connection', c => {
      c.on('open', () => {
        if (this.conns.size >= 7) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
        this.conns.set(c.peer, c);
      });
      c.on('data', d => this._hostData(c, d));
      c.on('close', () => this._drop(c.peer)); c.on('error', () => this._drop(c.peer));
    });
    return this.code;
  }

  async join(code, name = 'Player') {
    this.leave(); this.name = name.slice(0, 16); this.isHost = false; this.code = String(code).trim().toUpperCase();
    try { this.peer = await this._open(); } catch (e) { throw new Error(friendly(e)); }
    this.id = this.peer.id;
    return new Promise((res, rej) => {
      const c = this.peer.connect(PREFIX + this.code, { reliable: false, serialization: 'json' }); let ok = false;
      const fail = msg => { if (!ok) { ok = true; this.leave(); rej(new Error(msg)); } };
      this.peer.on('error', e => fail(friendly(e)));
      c.on('open', () => { this.hostConn = c; c.send({ t: 'hello', name: this.name }); });
      c.on('data', d => {
        if (d.t === 'full') return fail('That game is full');
        if (d.t === 'welcome') { ok = true; d.players.forEach(p => this._add(p.id, p.name, p.state)); res(this.code); return; }
        this._clientData(d);
      });
      c.on('close', () => { if (!ok) fail('Could not reach that game'); else { this._clearAll(); this._emit('closed'); } });
      setTimeout(() => fail('No game found with code ' + this.code), 15000);
    });
  }

  leave() {
    try { this.peer?.destroy(); } catch {}
    this.peer = null; this.hostConn = null; this.conns.clear(); this._clearAll(); this.isHost = false; this.code = null;
  }

  sendState(s) {
    if (!this.peer) return; const now = performance.now(); if (now - this._last < 83) return; this._last = now;
    const st = { x: +s.x.toFixed(2), y: +(s.y || 0).toFixed(2), z: +s.z.toFixed(2), h: +(s.heading || 0).toFixed(3), v: +(s.speed || 0).toFixed(2), car: s.car || null, m: s.moving ? 1 : 0 };
    if (this.isHost) this._broadcast({ t: 's', id: this.id, s: st }); else if (this.hostConn?.open) this.hostConn.send({ t: 's', s: st });
  }
  sendEvent(e) {
    if (!this.peer) return;
    if (this.isHost) this._broadcast({ t: 'e', id: this.id, e }); else if (this.hostConn?.open) this.hostConn.send({ t: 'e', e });
  }

  // --- host side ---
  _hostData(c, d) {
    if (d.t === 'hello') {
      const name = String(d.name || 'Player').slice(0, 16);
      const list = [{ id: this.id, name: this.name, state: this._myState || null }, ...[...this.players.values()].map(p => ({ id: p.id, name: p.name, state: p.state }))];
      c.send({ t: 'welcome', players: list });
      this._add(c.peer, name); this._broadcast({ t: 'join', id: c.peer, name }, c.peer);
    } else if (d.t === 's') { const p = this.players.get(c.peer); if (p) { p.state = d.s; p.at = performance.now(); } this._broadcast({ t: 's', id: c.peer, s: d.s }, c.peer); }
    else if (d.t === 'e') { const p = this.players.get(c.peer); if (p) this._emit('event', p, d.e); this._broadcast({ t: 'e', id: c.peer, e: d.e }, c.peer); }
  }
  _broadcast(msg, except) { if (msg.t === 's' && msg.id === this.id) this._myState = msg.s; for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); }
  _drop(id) { this.conns.delete(id); if (this.players.has(id)) { const p = this.players.get(id); this.players.delete(id); this._emit('leave', p); this._broadcast({ t: 'leave', id }); } }

  // --- client side ---
  _clientData(d) {
    if (d.t === 'join') this._add(d.id, d.name);
    else if (d.t === 'leave') { const p = this.players.get(d.id); if (p) { this.players.delete(d.id); this._emit('leave', p); } }
    else if (d.t === 's') { if (d.id === this.id) return; let p = this.players.get(d.id); if (!p) p = this._add(d.id, '?'); p.state = d.s; p.at = performance.now(); }
    else if (d.t === 'e') { const p = this.players.get(d.id); if (p) this._emit('event', p, d.e); }
  }
  _add(id, name, state = null) {
    if (id === this.id) return null; let p = this.players.get(id);
    if (!p) { p = { id, name, state, at: performance.now() }; this.players.set(id, p); this._emit('join', p); } else if (name !== '?') p.name = name;
    return p;
  }
  _clearAll() { for (const p of this.players.values()) this._emit('leave', p); this.players.clear(); }
}

function friendly(e) {
  const t = e?.type || '';
  if (t === 'peer-unavailable') return 'No game found with that code';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || e?.message === 'timeout') return 'Could not reach the multiplayer service. Check your connection.';
  if (t === 'browser-incompatible' || t === 'webrtc') return 'This browser does not support online play';
  return e?.message || 'Multiplayer error';
}

const COLORS = [0xff2d6f, 0x19c3ff, 0xffd23f, 0x7cff6b, 0xb06bff, 0xff8a3d, 0xffffff, 0x3df5d4];
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.roundRect(4, 8, 248, 48, 20); x.fill();
  x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.font = 'bold 32px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(4, 1, 1); s.renderOrder = 10; return s;
}

// Draws the other players. Pass `makeVehicle(type, color)` to show their exact vehicle model; defaults to a car.
export class RemotePlayers {
  constructor(scene, net, { makeVehicle } = {}) {
    this.scene = scene; this.net = net; this.map = new Map(); this.makeVehicle = makeVehicle || ((type, color) => makeCar(color));
    net.on('leave', p => this._remove(p.id));
  }
  _remove(id) { const r = this.map.get(id); if (r) { this.scene.remove(r.root); this.map.delete(id); } }
  _ensure(p) {
    let r = this.map.get(p.id); if (r) return r;
    const color = COLORS[[...p.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
    const root = new THREE.Group(), person = makePerson({ shirt: color }); root.add(person);
    const tag = nameTag(p.name, color); tag.position.y = 2.6; root.add(tag);
    this.scene.add(root); r = { root, person, tag, color, car: null, carKey: '', pos: new THREE.Vector3(), h: 0, name: p.name, init: false };
    this.map.set(p.id, r); return r;
  }
  update(dt) {
    for (const p of this.net.players.values()) {
      if (!p.state) continue; const r = this._ensure(p), s = p.state;
      if (r.name !== p.name) { r.root.remove(r.tag); r.tag = nameTag(p.name, r.color); r.root.add(r.tag); r.name = p.name; }
      const key = s.car ? s.car.type + ':' + s.car.color : '';
      if (key !== r.carKey) {
        if (r.car) r.root.remove(r.car); r.car = null; r.carKey = key;
        if (s.car) { r.car = this.makeVehicle(s.car.type, s.car.color ?? r.color); r.root.add(r.car); }
        r.person.visible = !s.car; r.tag.position.y = s.car ? 4 : 2.6;
      }
      // dead-reckon a little ahead of the last update, then smooth toward it
      const age = Math.min((performance.now() - p.at) / 1000, 0.25);
      const tx = s.x - Math.sin(s.h) * s.v * age, tz = s.z - Math.cos(s.h) * s.v * age;
      if (!r.init) { r.pos.set(tx, s.y, tz); r.h = s.h; r.init = true; }
      const k = 1 - Math.exp(-dt * 12); r.pos.x += (tx - r.pos.x) * k; r.pos.y += (s.y - r.pos.y) * k; r.pos.z += (tz - r.pos.z) * k;
      let dh = s.h - r.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.h += dh * k;
      r.root.position.copy(r.pos); r.person.rotation.y = r.h; if (r.car) { r.car.rotation.y = r.h; if (r.car.userData.wheels) animateCar(r.car, s.v, dt); }
      if (!s.car) animatePerson(r.person, s.m ? Math.abs(s.v) || 3 : 0, dt);
      r.root.visible = performance.now() - p.at < 5000; // hide if they stopped sending
    }
  }
}
