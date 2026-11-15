// New Bot 1: teleport menu. Self-contained overlay; game.js supplies the places and does the actual move.
// Wiring (game.js):
//   import { buildTeleport } from './assets/teleport.js';
//   const tp = buildTeleport({
//     places: [{ name: 'Sunrise City', x, z, icon: '🏙️' }, ...],   // road-snapped points
//     teleport: (x, z) => { /* move player or their car */ },
//     getOwned: () => PROPERTIES.filter(p => p.owned).map(p => ({ name: p.name, x: p.x, z: p.z, icon: p.icon })),
//     getPos: () => ({ x: player.x, z: player.z }),               // optional: shows distance
//     showMsg, onOpen: () => {/* pause input */}, onClose: () => {/* resume */},
//     button: true,                                                // optional floating 🌀 button (default true)
//     buttonStyle: 'top:60px;left:12px'                            // optional CSS to reposition it
//   });
//   tp.open() / tp.close() / tp.isOpen()
const css = `
#tpUI{position:fixed;inset:0;z-index:9998;background:rgba(8,10,25,.9);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;
  padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 14px max(14px,env(safe-area-inset-left));}
#tpUI .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
#tpUI .tt{font-size:22px;font-weight:800}#tpUI .tt b{color:#a78bfa}
#tpUI .x{font-size:20px;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff}
#tpUI .body{flex:1;touch-action:pan-y;overscroll-behavior:contain;overflow-y:auto;-webkit-overflow-scrolling:touch}
#tpUI .sec{font-size:13px;font-weight:700;opacity:.7;margin:6px 2px;text-transform:uppercase;letter-spacing:.05em}
#tpUI .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:10px}
#tpUI .pl{overflow:hidden;min-width:0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;display:flex;align-items:center;gap:8px;color:#fff;text-align:left;min-height:52px}
#tpUI .pl:active{background:rgba(167,139,250,.35)}#tpUI .ic{font-size:24px}#tpUI .nm{font-weight:700;font-size:14px}#tpUI .ds{font-size:12px;opacity:.65}
#tpUI .none{opacity:.6;font-size:13px;margin:0 2px 10px}
#tpBtn{position:fixed;top:max(60px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));z-index:9000;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.5);background:rgba(20,10,50,.6);color:#fff;font-size:22px}`;

// Tap that ignores scroll gestures: a touch that moved more than 10px is a scroll, not a tap.
const tap = (el, fn) => {
  let sx = 0, sy = 0, moved = false;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) moved = true; }, { passive: true });
  el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); if (!moved) fn(); });
  el.addEventListener('click', e => { e.stopPropagation(); fn(); });
};
const fmt = d => d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';

// The button hides itself whenever a menu screen (.screen without .hidden, e.g. title/pause/settings) is showing; override with canShow().
export function buildTeleport({ places = [], teleport, getOwned = () => [], getPos, showMsg = () => {}, onOpen = () => {}, onClose = () => {}, button = true, buttonStyle = '', canShow }) {
  const allowed = () => canShow ? canShow() : ![...document.querySelectorAll('.screen')].some(e => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
  if (!document.getElementById('tpCSS')) { const s = document.createElement('style'); s.id = 'tpCSS'; s.textContent = css; document.head.appendChild(s); }
  let o = null, btn = null;
  const section = (title, list, empty) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="sec">${title}</div>`;
    if (!list.length) { wrap.innerHTML += `<div class="none">${empty}</div>`; return wrap; }
    const g = document.createElement('div'); g.className = 'grid';
    const pos = getPos && getPos();
    for (const p of list) {
      const b = document.createElement('button'); b.className = 'pl';
      const dist = pos ? fmt(Math.hypot(p.x - pos.x, p.z - pos.z)) : '';
      b.innerHTML = `<span class="ic">${p.icon || '📍'}</span><span><div class="nm">${p.name}</div><div class="ds">${dist}</div></span>`;
      tap(b, () => { close(); teleport(p.x, p.z, p); showMsg(`Teleported to ${p.name}`, 2); });
      g.appendChild(b);
    }
    wrap.appendChild(g); return wrap;
  };
  function open() {
    if (o || !allowed()) return;
    o = document.createElement('div'); o.id = 'tpUI';
    o.innerHTML = `<div class="hd"><div class="tt">🌀 <b>TELEPORT</b></div><button class="x">✕</button></div><div class="body"></div>`;
    const body = o.querySelector('.body');
    body.appendChild(section('Places', places, 'No places yet'));
    body.appendChild(section('My properties', getOwned() || [], 'Buy a property to teleport to it'));
    tap(o.querySelector('.x'), close);
    body.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    document.body.appendChild(o); if (btn) btn.style.display = 'none'; onOpen();
  }
  function close() { if (!o) return; o.remove(); o = null; if (btn) btn.style.display = ''; onClose(); }
  if (button) {
    btn = document.createElement('button'); btn.id = 'tpBtn'; btn.textContent = '🌀';
    if (buttonStyle) btn.style.cssText += buttonStyle;
    tap(btn, open); document.body.appendChild(btn);
    const base = btn.style.left;
    const sync = () => {
      if (!btn || o) return;
      btn.style.display = allowed() ? '' : 'none';
      if (btn.style.display === 'none') return;
      // keep clear of the pause button (it is centred, so it moves between portrait and landscape)
      btn.style.left = base; const p = document.getElementById('btnPause');
      if (p && p.getClientRects().length) {
        const a = btn.getBoundingClientRect(), b = p.getBoundingClientRect();
        if (a.right > b.left - 4 && a.left < b.right + 4 && a.bottom > b.top && a.top < b.bottom) btn.style.left = Math.max(8, b.left - a.width - 10) + 'px';
      }
    };
    sync(); setInterval(sync, 250);
  }
  return { open, close, isOpen: () => !!o, button: btn };
}
