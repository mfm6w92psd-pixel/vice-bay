// New Bot 1: in-game shop ("Bay Supply Co."). Self-contained overlay; the game passes in the player and a message fn.
// Wiring (game.js):
//   import { openShop, SHOP_ITEMS } from './assets/shop.js';
//   place a shop marker somewhere (e.g. next to the diner or in each city); when the player walks into it on foot:
//     openShop({ player, showMsg, onClose: () => { /* resume input */ } });
//   add new things to sell by pushing to SHOP_ITEMS: { id, icon, name, desc, price, canBuy(p) -> true|'reason', apply(p) }
export const SHOP_ITEMS = [
  { id: 'snack', icon: '🌮', name: "Sunny's Taco", desc: '+25 health', price: 25,
    canBuy: p => p.health < 100 || 'Already at full health', apply: p => { p.health = Math.min(100, p.health + 25); } },
  { id: 'medkit', icon: '❤️', name: 'Med Kit', desc: 'Full health', price: 100,
    canBuy: p => p.health < 100 || 'Already at full health', apply: p => { p.health = 100; } },
  { id: 'vest', icon: '🦺', name: 'Light Vest', desc: '+50 armor', price: 150,
    canBuy: p => p.armor < 100 || 'Armor is full', apply: p => { p.armor = Math.min(100, p.armor + 50); } },
  { id: 'armor', icon: '🛡️', name: 'Heavy Armor', desc: 'Full armor', price: 250,
    canBuy: p => p.armor < 100 || 'Armor is full', apply: p => { p.armor = 100; } },
  { id: 'combo', icon: '💪', name: 'Tough Guy Combo', desc: 'Full health + full armor', price: 300,
    canBuy: p => (p.health < 100 || p.armor < 100) || 'Already maxed out', apply: p => { p.health = 100; p.armor = 100; } },
  { id: 'toolkit', icon: '🔧', name: 'Car Toolkit', desc: 'Fix your last car to 100%', price: 120,
    canBuy: p => (p.lastCar && !p.lastCar.dead && p.lastCar.health < 100) || 'No damaged car nearby', apply: p => { p.lastCar.health = 100; } },
];

const css = `
#shopUI{position:fixed;inset:0;z-index:9998;background:rgba(8,10,25,.9);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;
  padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 14px max(14px,env(safe-area-inset-left));}
#shopUI .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
#shopUI .tt{font-size:22px;font-weight:800}#shopUI .tt b{color:#ffcf3c}#shopUI .cash{color:#3ddc84;font-weight:800;font-size:20px;margin-right:12px}
#shopUI .x{font-size:20px;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff}
#shopUI .grid{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-content:start}
#shopUI .it{background:rgba(255,255,255,.08);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:4px}
#shopUI .ic{font-size:30px}#shopUI .nm{font-weight:700}#shopUI .ds{font-size:13px;opacity:.75;flex:1}
#shopUI .buy{margin-top:6px;height:40px;border-radius:10px;border:0;font-weight:800;font-size:16px;background:#3ddc84;color:#04210f}
#shopUI .buy.no{background:#555;color:#ccc}
#shopUI .toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:#000c;padding:8px 14px;border-radius:10px;font-size:14px;opacity:0;transition:opacity .2s}
#shopUI .toast.on{opacity:1}`;

export function openShop({ player, showMsg = () => {}, onClose = () => {}, items = SHOP_ITEMS, title = 'BAY <b>SUPPLY</b> CO.' }) {
  if (document.getElementById('shopUI')) return;
  if (!document.getElementById('shopCSS')) { const s = document.createElement('style'); s.id = 'shopCSS'; s.textContent = css; document.head.appendChild(s); }
  const o = document.createElement('div'); o.id = 'shopUI';
  o.innerHTML = `<div class="hd"><div class="tt">${title}</div><div><span class="cash"></span><button class="x">✕</button></div></div><div class="grid"></div><div class="toast"></div>`;
  const grid = o.querySelector('.grid'), cash = o.querySelector('.cash'), toast = o.querySelector('.toast');
  let tt = 0; const say = t => { toast.textContent = t; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1400); };
  const tap = (el, fn) => { el.addEventListener('click', e => { e.stopPropagation(); fn(); }); el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  const render = () => {
    cash.textContent = '$' + player.money;
    grid.innerHTML = '';
    for (const it of items) {
      const ok = it.canBuy ? it.canBuy(player) : true, afford = player.money >= it.price;
      const d = document.createElement('div'); d.className = 'it';
      d.innerHTML = `<div class="ic">${it.icon}</div><div class="nm">${it.name}</div><div class="ds">${it.desc}</div><button class="buy${ok === true && afford ? '' : ' no'}">$${it.price}</button>`;
      tap(d.querySelector('.buy'), () => {
        const chk = it.canBuy ? it.canBuy(player) : true;
        if (chk !== true) return say(chk);
        if (player.money < it.price) return say(`Need $${it.price - player.money} more`);
        player.money -= it.price; it.apply(player); say(`Bought ${it.name}`); showMsg(`Bought ${it.name}`, 1.5); render();
      });
      grid.appendChild(d);
    }
  };
  const close = () => { o.remove(); onClose(); };
  tap(o.querySelector('.x'), close);
  grid.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
  document.body.appendChild(o); render();
  return { close, refresh: render };
}
