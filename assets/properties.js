// New Bot 1: buyable properties. Each one earns cash into its own safe over time (collect it by visiting),
// and works as a save point once owned. Ownership + safes persist in localStorage on their own.
// Wiring (game.js):
//   import { PROPERTIES, resolveProperties, openProperty, tickIncome, propertyAt, resetProperties } from './assets/properties.js';
//   resolveProperties(POI);                 // once, after POI is built (fills in x/z for entries that use `poi`)
//   tickIncome(dt);                          // every frame (pass real seconds; 60 s = 2 in-game hours)
//   on foot, each frame: const p = propertyAt(player.x, player.z); if (p && !shopOpen) openProperty({ property: p, player, showMsg, onSave: saveGame, onClose });
//     (open only on entering the circle, not every frame; radius is 4 m)
//   minimap: PROPERTIES.forEach(p => dot(p.x, p.z, p.owned ? '#3ddc84' : '#ffcf3c', 7, '🏠'))   // or any glyph
//   markers: M.makeMarker(...) at each p.x, p.z (green when owned, yellow when for sale)
//   New Game: resetProperties();
// Positions are approximate city centres; nudge x/z to a sidewalk spot if one lands inside a building.
const KEY = 'vicebay_properties_v1';
export const PROPERTIES = [
  { id: 'beachbar', name: 'Sandbar Beach Bar', icon: '🍹', price: 2000, income: 120, poi: 'beach', dx: 0, dz: 12, area: 'Vice Bay Beach' },
  { id: 'carlot', name: 'Heights Auto Lot', icon: '🚗', price: 4500, income: 260, x: -450, z: 20, area: 'Vice Bay Heights' },
  { id: 'hangar', name: 'Hangar 7', icon: '✈️', price: 8000, income: 450, x: -1970, z: -170, area: 'Vice Bay International' },
  { id: 'club', name: 'Club Neon', icon: '🪩', price: 12000, income: 700, x: -150, z: 4700, area: 'Sunrise City' },
  { id: 'motel', name: 'Lakeside Motel', icon: '🏨', price: 6000, income: 340, x: -4700, z: 850, area: 'Lake Mirage' },
  { id: 'cabin', name: 'Pine Ridge Lodge', icon: '🌲', price: 3500, income: 200, x: -4700, z: -2600, area: 'Pine Ridge' },
  { id: 'marina', name: 'Palm Harbor Marina', icon: '⛵', price: 10000, income: 580, x: -7000, z: 850, area: 'Palm Harbor' },
];
const PAY_EVERY = 60;          // real seconds between payouts (= 2 in-game hours at 12 min/day)
const SAFE_CAP = 10;           // safe holds at most 10 payouts

function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const p of PROPERTIES) { const r = s[p.id]; p.owned = !!(r && r.owned); p.safe = (r && r.safe) || 0; p._t = 0; } } catch { } }
function save() { const s = {}; for (const p of PROPERTIES) s[p.id] = { owned: p.owned, safe: Math.floor(p.safe) }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { } }
load();

// scale: multiply fixed x/z by this (e.g. 5 for a 5x world). POI-based spots follow POI. Optional overrides: { id: {x, z} }.
export function resolveProperties(POI, scale = 1, overrides = {}) {
  for (const p of PROPERTIES) {
    if (p.bx === undefined && !p.poi) { p.bx = p.x; p.bz = p.z; }
    if (overrides[p.id]) { p.x = overrides[p.id].x; p.z = overrides[p.id].z; }
    else if (p.poi && POI[p.poi]) { p.x = POI[p.poi].x + (p.dx || 0); p.z = POI[p.poi].z + (p.dz || 0); }
    else if (!p.poi) { p.x = p.bx * scale; p.z = p.bz * scale; }
  }
}
export function resetProperties() { for (const p of PROPERTIES) { p.owned = false; p.safe = 0; p._t = 0; } save(); }
export function ownedCount() { return PROPERTIES.filter(p => p.owned).length; }

let saveT = 0;
export function tickIncome(dt) {
  let changed = false;
  for (const p of PROPERTIES) {
    if (!p.owned) continue; p._t += dt;
    while (p._t >= PAY_EVERY) { p._t -= PAY_EVERY; p.safe = Math.min(p.income * SAFE_CAP, p.safe + p.income); changed = true; }
  }
  saveT -= dt; if (changed && saveT <= 0) { save(); saveT = 5; }
}
let inside = null;
// Returns a property only on the frame the player first steps into its circle (so the menu doesn't reopen in a loop).
export function propertyAt(x, z, r = 4) {
  const hit = PROPERTIES.find(p => p.x != null && Math.hypot(p.x - x, p.z - z) < r) || null;
  const fresh = hit && hit !== inside ? hit : null; inside = hit; return fresh;
}

const css = `
#propUI{position:fixed;inset:0;z-index:9998;background:rgba(8,10,25,.9);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;
  padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 14px max(14px,env(safe-area-inset-left))}
#propUI .card{background:rgba(255,255,255,.08);border-radius:16px;padding:16px 18px;width:min(460px,100%);position:relative}
#propUI .ic{font-size:40px;line-height:1}#propUI .nm{font-size:22px;font-weight:800;margin-top:4px}#propUI .ar{opacity:.7;font-size:13px}
#propUI .row{display:flex;justify-content:space-between;margin-top:8px;font-size:15px}#propUI .row b{color:#3ddc84}
#propUI .btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
#propUI button{flex:1;min-width:110px;height:44px;border-radius:10px;border:0;font-weight:800;font-size:15px}
#propUI .go{background:#3ddc84;color:#04210f}#propUI .alt{background:#3cc8ff;color:#021a24}#propUI .no{background:#555;color:#ccc}
#propUI .x{position:absolute;top:10px;right:10px;flex:none;min-width:0;width:40px;height:40px;border-radius:20px;background:rgba(255,255,255,.12);color:#fff;font-size:18px}
#propUI .msg{min-height:20px;margin-top:10px;font-size:14px;color:#ffcf3c;text-align:center}`;

export function openProperty({ property: p, player, showMsg = () => {}, onSave = () => {}, onClose = () => {} }) {
  if (document.getElementById('propUI')) return;
  if (!document.getElementById('propCSS')) { const s = document.createElement('style'); s.id = 'propCSS'; s.textContent = css; document.head.appendChild(s); }
  const o = document.createElement('div'); o.id = 'propUI'; document.body.appendChild(o);
  const tap = (el, fn) => { el.addEventListener('click', e => { e.stopPropagation(); fn(); }); el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  let note = '';
  const close = () => { o.remove(); onClose(); };
  const render = () => {
    const mins = Math.ceil((PAY_EVERY - p._t) / 60 * 2 * 60); // in-game minutes until next payout
    o.innerHTML = `<div class="card"><button class="x">✕</button><div class="ic">${p.icon}</div><div class="nm">${p.name}</div><div class="ar">${p.area}</div>
      ${p.owned
        ? `<div class="row"><span>Safe</span><b>$${Math.floor(p.safe)}</b></div><div class="row"><span>Earns</span><span>$${p.income} every 2 hours (next in ${mins} min)</span></div>`
        : `<div class="row"><span>Price</span><b>$${p.price}</b></div><div class="row"><span>Earns</span><span>$${p.income} every 2 hours</span></div><div class="row"><span>Your cash</span><span>$${player.money}</span></div>`}
      <div class="btns">${p.owned
        ? `<button class="go" data-a="collect">Collect $${Math.floor(p.safe)}</button><button class="alt" data-a="save">💾 Save game</button>`
        : `<button class="${player.money >= p.price ? 'go' : 'no'}" data-a="buy">Buy for $${p.price}</button>`}</div>
      <div class="msg">${note}</div></div>`;
    tap(o.querySelector('.x'), close);
    o.querySelectorAll('[data-a]').forEach(b => tap(b, () => act(b.dataset.a)));
  };
  const act = a => {
    if (a === 'buy') {
      if (player.money < p.price) { note = `You need $${p.price - player.money} more`; return render(); }
      player.money -= p.price; p.owned = true; p.safe = 0; p._t = 0; save();
      note = `You own ${p.name}! It's now a save point.`; showMsg(`Bought ${p.name}`, 2.5);
    } else if (a === 'collect') {
      const c = Math.floor(p.safe); if (!c) { note = 'The safe is empty. Come back later.'; return render(); }
      player.money += c; p.safe -= c; save(); note = `Collected $${c}`; showMsg(`+$${c}`, 1.5);
    } else if (a === 'save') { onSave(); save(); note = 'Game saved'; showMsg('Game saved', 1.5); }
    render();
  };
  render();
  return { close };
}
