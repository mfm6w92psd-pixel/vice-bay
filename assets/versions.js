// Mika: Version History screen. Self-contained overlay (works on iPhone Safari), newest first.
// Usage:  import { showVersionHistory, VERSION } from './assets/versions.js';
//         someButton.onclick = () => showVersionHistory();       // VERSION -> current version string for the HUD/pause menu
// To add a release: put a new entry at the TOP of VERSIONS.
export const VERSIONS = [
  { v: '1.7', date: 'Nov 15, 2026', title: 'Interchange', notes: ['SR-836 flyover over I-95 with four curving ramps', 'Green exit signs, streetlights and pillars'] },
  { v: '1.6', date: 'Nov 15, 2026', title: 'Traffic everywhere', notes: ['NPC traffic in all four new cities and Vice Bay Heights', 'Cars, sports cars, motorbikes, trucks and buses'] },
  { v: '1.5', date: 'Nov 15, 2026', title: 'People', notes: ['8 kinds of NPCs: tourists, business people, joggers, beachgoers, gang members, retirees, workers, locals', 'NPCs talk when you walk up', 'Panic, fight back, call the cops and drop cash'] },
  { v: '1.4', date: 'Nov 15, 2026', title: 'Multiplayer', notes: ['Host or join with a 4-letter code', 'Other players with name tags and map dots'] },
  { v: '1.3', date: 'Nov 15, 2026', title: 'Graphics upgrade', notes: ['New sky, reflections and clear-coat car paint', 'Wet roads', 'Ultra mode with bloom and FXAA'] },
  { v: '1.2', date: 'Nov 15, 2026', title: '5x bigger world', notes: ['Sunrise City, Cypress Point, Lake Mirage and Pine Ridge', 'I-4, I-275 and longer I-95 / I-75'] },
  { v: '1.1', date: 'Nov 15, 2026', title: 'Better map and radio', notes: ['Pan and zoom the big map, set waypoints', 'Radio with 4 stations (R key)'] },
  { v: '1.0', date: 'Nov 15, 2026', title: 'New places', notes: ['Vice Bay Heights downtown and Gator Glades swamp', 'Vice Bay International airport and Palmetto Springs', 'I-295 West Bypass'] },
  { v: '0.9', date: 'Nov 15, 2026', title: 'Interstates', notes: ['I-95, I-10 and I-75 out of the city', 'Bigger minimap and full-screen map'] },
  { v: '0.1', date: 'Nov 15, 2026', title: 'First release', notes: ['Vice Bay: drive, explore, missions, wanted level'] },
];
export const VERSION = 'v' + VERSIONS[0].v;

export function showVersionHistory(parent = document.body) {
  document.getElementById('versionHistory')?.remove();
  const o = document.createElement('div'); o.id = 'versionHistory';
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,8,20,.88);display:flex;align-items:center;justify-content:center;font-family:-apple-system,system-ui,sans-serif;padding:env(safe-area-inset-top) 12px env(safe-area-inset-bottom)';
  const card = document.createElement('div');
  card.style.cssText = 'width:min(520px,100%);max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(160deg,#2a1240,#10142a);border:2px solid #ff2d6f;border-radius:16px;color:#fff;padding:18px 18px 10px;box-shadow:0 0 30px #ff2d6f55';
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:22px;font-weight:800;color:#ff7ab0;letter-spacing:1px">VERSION HISTORY</div>
      <button id="vhClose" style="font-size:20px;background:#ff2d6f;color:#fff;border:0;border-radius:10px;width:40px;height:40px">✕</button></div>` +
    VERSIONS.map((r, i) => `<div style="padding:10px 0;border-top:1px solid #ffffff22">
      <div style="display:flex;gap:8px;align-items:baseline"><span style="font-weight:800;color:${i ? '#19c3ff' : '#2ee59d'}">v${esc(r.v)}</span>
      <span style="font-weight:700">${esc(r.title)}</span>${i ? '' : '<span style="font-size:11px;background:#2ee59d;color:#000;border-radius:6px;padding:1px 6px">NEW</span>'}
      <span style="margin-left:auto;font-size:12px;opacity:.6">${esc(r.date)}</span></div>
      <ul style="margin:6px 0 0 18px;padding:0;font-size:14px;line-height:1.45;opacity:.9">${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('');
  o.appendChild(card); parent.appendChild(o);
  const close = () => o.remove();
  card.querySelector('#vhClose').onclick = close; o.addEventListener('click', e => { if (e.target === o) close(); });
  for (const ev of ['touchstart', 'touchmove', 'keydown']) o.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  return close;
}
