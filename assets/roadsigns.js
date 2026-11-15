// Mika: road signs for every highway in HWS.
//  - green distance signs after each bend, both directions: "Lake Mirage 12 / Palm Harbor 18"
//  - white SPEED LIMIT signs (65 on interstates, 55 on US routes), shared textures
//  - "Welcome to <city>" signs where a highway enters a city
// No collision on purpose: thin posts sit outside the guardrail, so they never make invisible walls.
// Usage: buildRoadSigns(scene, { highways: HWS, places: [{ name, x, z }] })
import * as THREE from 'three';

const UNITS_PER_MILE = 160;   // same as buildInterstate's mile markers
const texCache = new Map();
function tex(key, cw, ch, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c.getContext('2d'), cw, ch);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
const postMat = new THREE.MeshBasicMaterial({ color: 0x8a8a8a }), backMat = new THREE.MeshBasicMaterial({ color: 0x5a5a5a });
function panel(t, w, h, y) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, side: THREE.FrontSide }));
  f.position.y = y; g.add(f);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backMat); b.rotation.y = Math.PI; b.position.set(0, y, -0.03); g.add(b);
  for (const sx of (w > 3 ? [-w / 3, w / 3] : [0])) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, y, 0.12), postMat); p.position.set(sx, y / 2 - h / 2 + 0.01, -0.06); g.add(p); }
  return g;
}
function distanceSign(rows) {
  const key = 'd:' + rows.map(r => r.join('|')).join('/');
  const t = tex(key, 256, 40 + rows.length * 40, (x, w, h) => {
    x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(5, 5, w - 10, h - 10);
    x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif';
    rows.forEach(([name, mi], i) => { x.textAlign = 'left'; x.fillText(name, 18, 48 + i * 40); x.textAlign = 'right'; x.fillText(String(mi), w - 18, 48 + i * 40); });
  });
  return panel(t, 5.2, 0.8 + rows.length * 0.8, 3.2);
}
function speedSign(limit) {
  const t = tex('s:' + limit, 128, 160, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#111'; x.lineWidth = 5; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#111'; x.textAlign = 'center'; x.font = 'bold 22px sans-serif'; x.fillText('SPEED', w / 2, 40); x.fillText('LIMIT', w / 2, 64);
    x.font = 'bold 64px sans-serif'; x.fillText(String(limit), w / 2, 135);
  });
  return panel(t, 1.2, 1.5, 2.4);
}
function welcomeSign(name) {
  const t = tex('w:' + name, 256, 128, (x, w, h) => {
    x.fillStyle = '#f4e9c8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#0b6b3a'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#0b6b3a'; x.textAlign = 'center'; x.font = 'italic 22px serif'; x.fillText('Welcome to', w / 2, 46);
    x.font = `bold ${name.length > 11 ? 28 : 34}px serif`; x.fillText(name, w / 2, 94);
  });
  return panel(t, 4, 2, 2.6);
}

export function buildRoadSigns(scene, { highways, places = [], cityRadius = 450 } = {}) {
  const root = new THREE.Group(); root.name = 'roadsigns'; scene.add(root);
  const near = (p, r = cityRadius) => { let best = null, bd = r; for (const c of places) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } } return best; };
  const nearestAny = p => near(p, Infinity);
  let count = 0;
  for (const h of highways) {
    const segs = h.segs; if (!segs?.length) continue;
    const W = h.width || 30, side = W / 2 + 3, limit = h.us ? 55 : 65;
    const total = segs.reduce((a, s) => a + s.len, 0);
    const start = segs[0].a, end = segs[segs.length - 1].b;
    const endCity = nearestAny(end), startCity = nearestAny(start);
    // places passed along the way (for a second row), in travel order
    const along = places.map(c => { const n = h.nearest(c.x, c.z); let acc = 0; for (let i = 0; i < n.segIndex; i++) acc += segs[i].len; return { c, dist: n.dist, pos: acc + n.t }; })
      .filter(o => o.dist < cityRadius);
    const at = (s, d, off) => s.a.clone().addScaledVector(s.dir, d).addScaledVector(s.right, off);
    const put = (obj, p, ang) => { obj.position.set(p.x, 0, p.z); obj.rotation.y = ang; root.add(obj); count++; };
    let acc = 0;
    segs.forEach((s, i) => {
      if (s.len > 260) {
        // forward traffic drives on the -right side (see buildInterstate lanes); signs face it
        const fd = 95, posF = acc + fd;
        const ahead = along.filter(o => o.pos > posF + 200).sort((a, b) => a.pos - b.pos).map(o => [o.c.name, Math.max(1, Math.round((o.pos - posF) / UNITS_PER_MILE))]);
        if (!ahead.length && endCity) ahead.push([endCity.name, Math.max(1, Math.round((total - posF) / UNITS_PER_MILE))]);
        if (ahead.length) put(distanceSign(ahead.slice(0, 2)), at(s, fd, -side), s.ang + Math.PI);
        const bd = s.len - 95, posB = acc + bd;
        const behind = along.filter(o => o.pos < posB - 200).sort((a, b) => b.pos - a.pos).map(o => [o.c.name, Math.max(1, Math.round((posB - o.pos) / UNITS_PER_MILE))]);
        if (!behind.length && startCity) behind.push([startCity.name, Math.max(1, Math.round(posB / UNITS_PER_MILE))]);
        if (behind.length) put(distanceSign(behind.slice(0, 2)), at(s, bd, side), s.ang);
        put(speedSign(limit), at(s, s.len * 0.5, -side), s.ang + Math.PI);
        put(speedSign(limit), at(s, s.len * 0.5 + 20, side), s.ang);
      }
      acc += s.len;
    });
    // welcome signs just before each end that lands in a city
    const last = segs[segs.length - 1], first = segs[0], ce = near(end), cs = near(start);
    if (ce && last.len > 120) put(welcomeSign(ce.name), at(last, last.len - 70, -side), last.ang + Math.PI);
    if (cs && first.len > 120) put(welcomeSign(cs.name), at(first, 70, side), first.ang);
  }
  return { root, count };
}

// ---------- EXIT signs ----------
// Advance green signs before every highway junction (where another highway starts/ends on this one)
// and before every flyover interchange, both directions:  [EXIT 42] / I-36 WEST / Palm Harbor / 2 MILES
// plus a small "EXIT 42 ↗" gore sign right at the split.
function exitSign(num, lines, dist) {
  const rows = [...lines, dist].filter(Boolean);
  const key = 'x:' + num + '|' + rows.join('|');
  const t = tex(key, 320, 70 + rows.length * 44, (x, w, h) => {
    x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
    // yellow-on-green EXIT tab at the top right, like real US signs
    x.fillStyle = '#ffd200'; x.fillRect(w - 150, 12, 136, 38); x.fillStyle = '#0b6b3a'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText('EXIT ' + num, w - 82, 41);
    x.fillStyle = '#fff'; x.textAlign = 'left';
    rows.forEach((r, i) => { const last = i === rows.length - 1 && dist; x.font = `bold ${last ? 24 : (i === 0 ? 30 : 27)}px sans-serif`; x.fillText(r, 18, 92 + i * 44); });
  });
  return panel(t, 6, (70 + rows.length * 44) / 320 * 6, 4.2);
}
function goreSign(num, left) {
  const t = tex('g:' + num + (left ? 'L' : ''), 160, 110, (x, w, h) => {
    x.fillStyle = '#0b6b3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold 26px sans-serif'; x.fillText('EXIT', w / 2, 38); x.fillText(String(num), w / 2 + (left ? 14 : -14), 80);
    x.font = 'bold 40px sans-serif'; x.fillText(left ? '↖' : '↗', w / 2 + (left ? -38 : 38), 84);
  });
  return panel(t, 1.8, 1.25, 2.4);
}
const cardinal = (dx, dz) => Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'EAST' : 'WEST') : (dz < 0 ? 'NORTH' : 'SOUTH');
const label = h => (h.us ? 'US-' : 'I-') + h.number;

export function buildExitSigns(scene, { highways, interchanges = [], places = [], advance = [640, 220] } = {}) {
  const root = new THREE.Group(); root.name = 'exitsigns'; scene.add(root);
  const nearestPlace = (x, z) => { let b = null, bd = Infinity; for (const c of places) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c; } } return b; };
  let count = 0;
  const posOf = (h, n) => { let acc = 0; for (let i = 0; i < n.segIndex; i++) acc += h.segs[i].len; return acc + n.t; };
  const pointAt = (h, pos) => { let acc = 0; for (const s of h.segs) { if (pos <= acc + s.len || s === h.segs[h.segs.length - 1]) return { s, d: Math.max(0, Math.min(s.len, pos - acc)) }; acc += s.len; } };
  for (const h of highways) {
    if (!h.segs?.length) continue;
    const total = h.segs.reduce((a, s) => a + s.len, 0), side = (h.width || 30) / 2 + 3.5;
    const exits = [];
    // junctions: another highway's end sits on this one's centreline, away from this one's own ends
    for (const g of highways) {
      if (g === h || !g.segs?.length) continue;
      const gs = g.segs, ends = [[gs[0].a, gs[gs.length - 1].b], [gs[gs.length - 1].b, gs[0].a]];
      for (const [e, far] of ends) {
        const n = h.nearest(e.x, e.z); if (n.dist > (h.width || 30)) continue;
        const pos = posOf(h, n); if (pos < 300 || pos > total - 300) continue;
        // direction g heads away from the junction (use its first 300 units, not the far end)
        const ref = e === gs[0].a ? gs[0].a.clone().addScaledVector(gs[0].dir, Math.min(300, gs[0].len)) : gs[gs.length - 1].b.clone().addScaledVector(gs[gs.length - 1].dir, -Math.min(300, gs[gs.length - 1].len));
        const pl = nearestPlace(far.x, far.z);
        const hs = pointAt(h, pos).s, sideG = Math.sign((ref.x - e.x) * hs.right.x + (ref.z - e.z) * hs.right.z);
        exits.push({ pos, sideG, lines: [`${label(g)} ${cardinal(ref.x - e.x, ref.z - e.z)}`, pl?.name] });
      }
    }
    // flyover interchanges on this highway
    for (const ic of interchanges) {
      if (!ic.center) continue; const n = h.nearest(ic.center.x, ic.center.z); if (n.dist > 40) continue;
      exits.push({ pos: posOf(h, n), num: ic.exit, lines: [`${ic.name}`, 'EAST / WEST'], ic: true });
    }
    exits.sort((a, b) => a.pos - b.pos);
    const base = h.startMile || 0;
    for (const x of exits) {
      const num = x.num ?? Math.max(1, base + Math.round(x.pos / UNITS_PER_MILE));
      for (const dir of [1, -1]) {               // 1 = forward traffic (drives on -right side), -1 = reverse
        const dists = x.ic ? [advance[0] + 300] : advance;   // interchanges already have their own EXIT gantry at 300
        for (const ad of dists) {
          const pp = x.pos - dir * ad; if (pp < 40 || pp > total - 40) continue;
          if (exits.some(o => o !== x && (o.pos - pp) * dir > 0 && (x.pos - o.pos) * dir > 0)) continue;   // another exit in between: skip, avoids clutter
          const { s, d } = pointAt(h, pp), p = s.a.clone().addScaledVector(s.dir, d).addScaledVector(s.right, -dir * side);
          const mi = ad / UNITS_PER_MILE, txt = mi >= 1.5 ? `${Math.round(mi)} MILES` : '1 MILE';
          const sg = exitSign(num, x.lines.filter(Boolean), txt); sg.position.set(p.x, 0, p.z); sg.rotation.y = s.ang + (dir === 1 ? Math.PI : 0); root.add(sg); count++;
        }
        if (!x.ic) {
          const pp = x.pos - dir * 45; if (pp < 20 || pp > total - 20) continue;
          const { s, d } = pointAt(h, pp), p = s.a.clone().addScaledVector(s.dir, d).addScaledVector(s.right, -dir * side);
          const gs = goreSign(num, x.sideG * dir > 0);   // +right is the traveller's left for forward traffic gs.position.set(p.x, 0, p.z); gs.rotation.y = s.ang + (dir === 1 ? Math.PI : 0); root.add(gs); count++;
        }
      }
    }
  }
  return { root, count };
}
