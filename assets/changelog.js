// New Bot 1: in-game Version History. Self-contained overlay, no game.js state needed.
// Wiring: import { VERSION, openVersionHistory } from './assets/changelog.js';
//   add a "Version History" button (start menu + pause menu) with onclick = openVersionHistory
//   optional: show `v${VERSION}` small in a corner of the start screen.
// When shipping an update, add a new entry at the TOP of CHANGELOG (VERSION follows automatically).
export const CHANGELOG = [
  { v: '2.0', date: 'Nov 15', title: 'The Big Update', items: ['Red-Eye Run: race over the SR-112 expressway to the airport ($2,000)', 'Sunrise Sprint: race up I-95 under the SR-70 flyover ($3,000)', 'Gulf Coast Courier: long haul on I-40 to Lake Mirage ($4,000)', 'Taxi Shift: repeatable cab job, fares pay more the faster you drive', 'Stunt jumps on the airport runways and the beach (by Mika)', 'Bay Supply Co. shops for health, armor and car repair (by New Bot 1)', '6 buyable properties that earn cash and work as save points (by New Bot 1)', 'Three more interstates: I-8 Southern (Cypress Point to Pine Ridge), I-26 Lakeshore (Sunrise City to Lake Mirage) and I-14 Glades (Gator Glades to the airport)', 'New city: Palm Harbor, west of Lake Mirage on the new I-6', 'I-2 Harbor Ridge links Palm Harbor north to Pine Ridge', 'Route 66 (by Mika) and US-1 Frontier Highway, the first US routes', 'US-41 Tamiami Trail and US-27 Heartland (by Mika)', 'I-16 Central from Pine Ridge to the airport (by Mika)', 'Road signs: distances, speed limits and city welcomes (by Mika)', 'Smoother sharp bends on highways', 'World is now 5x bigger: every city, the airport and the countryside are spread much further apart', 'I-595 Sawgrass and I-22 Suncoast (by New Bot 2)', 'Highways now line up with city streets where they enter a city', 'New city: Pelican Bay, linked to I-20 by I-24 and to I-8 by I-28', 'New city: Coral Springs, linked to I-12 by I-18 and to I-16 by I-32', 'Three new flyover interchanges: SR-50 on I-2, SR-84 on I-26 and SR-92 on Route 66', 'Teleport menu (🌀 button) to every city, the airport and your properties', 'SR-408 Gulf Coast Expressway: raised toll road from Coral Springs to Pelican Bay'] },
  { v: '1.19', date: 'Nov 15', title: 'More interstates', items: ['I-40 Gulf Coast from Sunrise City west to I-4', 'I-20 Northern from Cypress Point to Pine Ridge', 'I-12 from Lake Mirage to the airport', 'Version History screen'] },
  { v: '1.18', date: 'Nov 15', title: 'Airport Expressway', items: ['SR-112 raised toll road from I-295 to the airport ($2 toll)', 'Three more interchanges on I-95, I-75 and I-275'] },
  { v: '1.17', date: 'Nov 15', title: 'Big interchange', items: ['SR-836 flyover crosses I-95 north of the city', 'Four curving ramps and green exit signs'] },
  { v: '1.16', date: 'Nov 15', title: 'Traffic everywhere', items: ['NPC cars, bikes, trucks and buses in all four new cities and Vice Bay Heights'] },
  { v: '1.15', date: 'Nov 15', title: '8 kinds of people', items: ['Tourists, joggers, business people, beachgoers, gang members, workers, retirees and locals', 'Some run, some fight back, some call the cops', 'People drop cash'] },
  { v: '1.14', date: 'Nov 15', title: 'Talking NPCs', items: ['People walk around every new area', 'Walk up to someone and they say a line'] },
  { v: '1.13', date: 'Nov 15', title: 'Multiplayer', items: ['Host a game and share a 4-letter code', 'Friends show up with name tags and map dots'] },
  { v: '1.12', date: 'Nov 15', title: 'Realistic graphics', items: ['Real sky with sun glow and stars', 'Reflections, glossy car paint, wet roads in rain', 'New Ultra ✨ graphics setting'] },
  { v: '1.11', date: 'Nov 15', title: 'World 5x bigger', items: ['Sunrise City, Cypress Point, Lake Mirage and Pine Ridge', 'New I-4 and I-275'] },
  { v: '1.10', date: 'Nov 15', title: 'Better map', items: ['Pan and zoom the big map', 'Tap to drop a waypoint with distance'] },
  { v: '1.9', date: 'Nov 15', title: 'Car radio', items: ['4 stations: Vice FM, Bay Beats, Salsa Caliente, Glades Country', '📻 button in the car'] },
  { v: '1.8', date: 'Nov 15', title: 'Downtown and swamp', items: ['Vice Bay Heights skyscrapers with a helicopter', 'Gator Glades with airboats'] },
  { v: '1.7', date: 'Nov 15', title: 'I-295 bypass', items: ['West bypass links I-10 and I-95 for a full loop'] },
  { v: '1.6', date: 'Nov 15', title: 'Airport and small town', items: ['Vice Bay International with a jet you can taxi', 'Palmetto Springs at the end of I-95'] },
  { v: '1.5', date: 'Nov 15', title: 'Bigger map', items: ['Larger corner map', 'Tap for a full-screen map'] },
  { v: '1.4', date: 'Nov 15', title: 'I-75', items: ['Interstate heading north past Port Coral'] },
  { v: '1.3', date: 'Nov 15', title: 'Interstates', items: ['I-95 south into the countryside', 'I-10 west off the expressway'] },
  { v: '1.2', date: 'Nov 15', title: 'I-395', items: ['Interstate along the south edge of the city'] },
  { v: '1.0', date: 'Nov 15', title: 'Vice Bay launch', items: ['The city, cars, missions, police and the VB-1 Expressway'] },
];
export const VERSION = CHANGELOG[0].v;

export function openVersionHistory() {
  if (document.getElementById('versionHistory')) return;
  const o = document.createElement('div'); o.id = 'versionHistory';
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(8,10,25,.92);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 16px max(16px,env(safe-area-inset-left));';
  const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
  head.innerHTML = `<div style="font-size:22px;font-weight:800"><span style="color:#ff5c8a">VERSION</span> <span style="color:#3cc8ff">HISTORY</span> <span style="font-size:14px;opacity:.7">v${VERSION}</span></div>`;
  const x = document.createElement('button'); x.textContent = '✕';
  x.style.cssText = 'font-size:20px;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff;';
  const close = e => { e && e.stopPropagation(); o.remove(); };
  x.addEventListener('click', close); x.addEventListener('touchend', e => { e.preventDefault(); close(e); });
  head.appendChild(x); o.appendChild(head);
  const list = document.createElement('div'); list.style.cssText = 'overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;';
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  list.innerHTML = CHANGELOG.map((e, i) => `<div style="padding:10px 12px;margin-bottom:8px;border-radius:10px;background:rgba(255,255,255,${i ? .06 : .14});">
    <div style="font-weight:700;font-size:16px">v${esc(e.v)} · ${esc(e.title)}${i ? '' : ' <span style="font-size:11px;background:#ff5c8a;padding:2px 6px;border-radius:6px;margin-left:4px">NEW</span>'}<span style="float:right;font-weight:400;opacity:.6;font-size:13px">${esc(e.date)}</span></div>
    <ul style="margin:6px 0 0 18px;padding:0;font-size:14px;opacity:.9;line-height:1.4">${e.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  // let the list scroll even if the game blocks touchmove globally
  list.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
  o.appendChild(list); document.body.appendChild(o);
}
