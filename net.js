// New Bot: Vice Bay multiplayer. Peer-to-peer through PeerJS (free public broker), host relays to everyone.
// Host gets a 4-letter code; peer id is "vicebay-<code>". Messages: {t:'s', id, n, c, x,y,z,h,k,sp} state; {t:'bye', id}.
const PREFIX = 'vicebay-26-';
const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function createNet({ onState, onLeave, onStatus }) {
  let peer = null, host = false, code = '', conns = [], myId = '', hostConn = null;
  const send = (c, m) => { try { if (c.open) c.send(m); } catch (e) {} };
  function wire(c) {
    c.on('data', m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 's') { c._pid = m.id; onState(m); if (host) conns.forEach(o => o !== c && send(o, m)); }
      else if (m.t === 'bye') { onLeave(m.id); if (host) conns.forEach(o => o !== c && send(o, m)); }
    });
    c.on('close', () => {
      if (c._pid) { onLeave(c._pid); if (host) conns.forEach(o => o !== c && send(o, { t: 'bye', id: c._pid })); }
      conns = conns.filter(o => o !== c);
      if (!host && c === hostConn) { onStatus('Host left the game', 'off'); leave(); }
      else onStatus(status(), 'on');
    });
  }
  const status = () => host ? `Hosting · code ${code} · ${conns.length + 1} player${conns.length ? 's' : ''}` : `Joined ${code}`;
  function hostGame() {
    leave(); host = true; code = Array.from({ length: 4 }, () => LET[Math.random() * LET.length | 0]).join('');
    onStatus('Creating room…', 'busy');
    peer = new window.Peer(PREFIX + code);
    peer.on('open', id => { myId = id; onStatus(status(), 'on'); });
    peer.on('connection', c => { c.on('open', () => { conns.push(c); wire(c); onStatus(status(), 'on'); }); });
    peer.on('error', e => { if (e.type === 'unavailable-id') hostGame(); else onStatus('Network error: ' + e.type, 'off'); });
  }
  function join(c0) {
    leave(); host = false; code = String(c0 || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { onStatus('Codes are 4 letters', 'off'); return; }
    onStatus('Joining ' + code + '…', 'busy');
    peer = new window.Peer();
    peer.on('open', id => {
      myId = id; hostConn = peer.connect(PREFIX + code, { reliable: false });
      hostConn.on('open', () => { conns = [hostConn]; wire(hostConn); onStatus(status(), 'on'); });
      setTimeout(() => { if (peer && !hostConn.open) { onStatus('No game found with code ' + code, 'off'); leave(); } }, 9000);
    });
    peer.on('error', e => { onStatus(e.type === 'peer-unavailable' ? 'No game found with code ' + code : 'Network error: ' + e.type, 'off'); leave(); });
  }
  function leave() {
    if (peer) { conns.forEach(c => send(c, { t: 'bye', id: myId })); setTimeout(((p) => () => { try { p.destroy(); } catch (e) {} })(peer), 200); }
    peer = null; conns = []; hostConn = null; host = false;
  }
  function broadcast(st) { if (!peer || !conns.length) return; st.t = 's'; st.id = myId; conns.forEach(c => send(c, st)); }
  return { hostGame, join, leave, broadcast, get active() { return !!peer; }, get count() { return conns.length + 1; }, get code() { return code; }, get isHost() { return host; } };
}
