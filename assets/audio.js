// Mika: original synthesized game audio via Web Audio. No files, no licensing issues.
// iOS Safari needs a user gesture first: call GameAudio.unlock() inside a touchstart/click handler.
export class GameAudio {
  constructor() { this.ctx = null; this.master = null; }
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
    this._noise = this._makeNoise();
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  _makeNoise() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  // Engine: call setEngine(speed01, throttle01) every frame while driving; stopEngine() on exit.
  startEngine() {
    if (!this.ctx || this.engine) return; const c = this.ctx;
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = c.createGain(); g.gain.value = 0.0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o1.start(); o2.start();
    this.engine = { o1, o2, f, g }; g.gain.setTargetAtTime(0.12, c.currentTime, 0.2);
  }
  setEngine(speed = 0, throttle = 0) {
    if (!this.engine) return; const t = this.ctx.currentTime, e = this.engine;
    const gear = (speed * 5) % 1, rpm = 40 + gear * 90 + speed * 60 + throttle * 25;
    e.o1.frequency.setTargetAtTime(rpm, t, 0.05); e.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(400 + throttle * 1400, t, 0.1); e.g.gain.setTargetAtTime(0.08 + throttle * 0.08, t, 0.1);
  }
  stopEngine() {
    if (!this.engine) return; const e = this.engine, t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.15); e.o1.stop(t + 0.6); e.o2.stop(t + 0.6); this.engine = null;
  }
  // Police siren wail; intensity 0..1 (e.g. by distance). setSiren(0) silences.
  setSiren(intensity) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.siren && intensity > 0) {
      const o = c.createOscillator(); o.type = 'triangle';
      const lfo = c.createOscillator(); lfo.frequency.value = 0.35; const lg = c.createGain(); lg.gain.value = 350;
      lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 950;
      const g = c.createGain(); g.gain.value = 0; o.connect(g); g.connect(this.master); o.start(); lfo.start();
      this.siren = { o, lfo, g };
    }
    if (this.siren) this.siren.g.gain.setTargetAtTime(0.09 * intensity, c.currentTime, 0.2);
  }
  horn() { this._tone([[392, 'square'], [494, 'square']], 0.35, 0.12); }
  pickup() { [660, 880, 1320].forEach((f, i) => this._tone([[f, 'sine']], 0.12, 0.15, i * 0.07)); }
  missionPassed() { [523, 659, 784, 1047].forEach((f, i) => this._tone([[f, 'triangle']], 0.35, 0.15, i * 0.14)); }
  wanted() { [880, 660].forEach((f, i) => this._tone([[f, 'square']], 0.15, 0.08, i * 0.15)); }
  click() { this._tone([[1200, 'sine']], 0.04, 0.1); }
  crash(strength = 1) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = c.createGain(), t = c.currentTime;
    g.gain.setValueAtTime(0.5 * strength, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.7);
  }
  shot() {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noise;
    const g = c.createGain(), t = c.currentTime; g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    s.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.2);
  }
  // Looping city ambience (traffic rumble + occasional distant horns). Pass 0..1 for rain to add rain hiss.
  startAmbience() {
    if (!this.ctx || this.amb) return; const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this._noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 250; const g = c.createGain(); g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    const r = c.createBufferSource(); r.buffer = this._noise; r.loop = true;
    const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 3000; const rg = c.createGain(); rg.gain.value = 0;
    r.connect(rf); rf.connect(rg); rg.connect(this.master); r.start();
    this.amb = { g, rg }; this._hornTimer = setInterval(() => { if (Math.random() < 0.3) this._tone([[300 + Math.random() * 200, 'square']], 0.25, 0.02); }, 4000);
  }
  setRain(v) { if (this.amb) this.amb.rg.gain.setTargetAtTime(0.08 * v, this.ctx.currentTime, 0.5); }
  // Radio with 4 original stations. startRadio() plays the current station; nextStation()/prevStation() switch
  // (with a burst of static) and return the new name. GameAudio.STATIONS has { name, genre } for the UI.
  startRadio() {
    if (!this.ctx || this.radio) return; const c = this.ctx, st = this.station || 0, def = GameAudio.STATIONS[st], beat = 60 / def.bpm;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12); let step = 0, next = c.currentTime + 0.1;
    const g = c.createGain(); g.gain.value = 0.25; g.connect(this.master);
    const T = (n, type, dur, vol, lp) => this._tone([[midi(n), type]], dur, vol, next - c.currentTime, g, lp);
    const tick = () => {
      while (next < c.currentTime + 0.3) {
        const s16 = step % 16, bar = Math.floor(step / 16) % 4;
        if (st === 0) { // Vice FM: synthwave
          const bass = [45, 45, 48, 43], ch = [[57, 60, 64], [57, 60, 64], [60, 64, 67], [55, 59, 62]];
          if (step % 2 === 0) T(bass[bar], 'sawtooth', beat * 0.45, 0.25, 500);
          if (s16 === 0) ch[bar].forEach(n => T(n, 'triangle', beat * 3.8, 0.07));
          if (step % 4 === 0) this._kick(next, g); if (step % 8 === 4) this._snare(next, g, 0.2); if (step % 2 === 1) this._hat(next, g, 0.04);
          if (step % 4 === 2) T([69, 72, 76, 74][(step >> 2) % 4] + 12, 'square', beat * 0.4, 0.03, 2500);
        } else if (st === 1) { // Bay Beats: laid-back hip-hop
          const bass = [38, 38, 41, 36];
          if ([0, 6, 10].includes(s16)) this._kick(next, g); if (s16 === 4 || s16 === 12) this._snare(next, g, 0.3);
          if (step % 2 === 0) this._hat(next, g, step % 4 === 2 ? 0.05 : 0.03);
          if (s16 === 0 || s16 === 7) T(bass[bar], 'sine', beat * 1.2, 0.35);
          if (s16 === 0) [62, 65, 69, 72].forEach(n => T(n + (bar === 2 ? 3 : bar === 3 ? -2 : 0), 'triangle', beat * 3.5, 0.04, 1200));
        } else if (st === 2) { // Salsa Caliente: clave, tumbao bass, piano montuno
          if ([0, 3, 6, 10, 12].includes(s16)) this._click(next, g, 2200, 0.12);
          if (s16 === 3 || s16 === 6 || s16 === 11 || s16 === 14) T([43, 48, 50, 43][bar] + (s16 > 8 ? 7 : 0), 'triangle', beat * 0.9, 0.3, 700);
          const chord = [[67, 71, 74], [67, 72, 76], [69, 72, 77], [67, 71, 74]][bar];
          if ([0, 3, 6, 8, 11, 14].includes(s16)) chord.forEach(n => T(n, 'square', beat * 0.35, 0.025, 2000));
          if (s16 % 4 === 2) this._click(next, g, 600, 0.15);
        } else { // Glades Country: train beat, twangy I-IV-V
          const root = [43, 48, 50, 43][bar];
          if (step % 4 === 0) this._kick(next, g); if (step % 4 === 2) this._snare(next, g, 0.15); this._hat(next, g, 0.02);
          if (step % 4 === 0) T(root + ((step >> 2) % 2 ? 7 : 0), 'triangle', beat * 0.8, 0.3, 600);
          if (step % 4 === 2) [root + 24, root + 28, root + 31].forEach(n => T(n, 'sawtooth', beat * 0.5, 0.02, 1800));
          if (s16 % 6 === 0) T(root + 36 + [0, 4, 7, 9, 7, 4][(step / 6 | 0) % 6], 'square', beat * 0.6, 0.025, 3000);
        }
        step++; next += beat / 4;
      }
    };
    this.radio = { g, iv: setInterval(tick, 50) }; tick();
  }
  stopRadio() { if (this.radio) { clearInterval(this.radio.iv); this.radio.g.disconnect(); this.radio = null; } }
  get stationName() { return GameAudio.STATIONS[this.station || 0].name; }
  setStation(i) {
    const n = GameAudio.STATIONS.length; this.station = ((i % n) + n) % n; const was = !!this.radio;
    this._static(); if (was) { this.stopRadio(); setTimeout(() => this.startRadio(), 250); } return this.stationName;
  }
  nextStation() { return this.setStation((this.station || 0) + 1); }
  prevStation() { return this.setStation((this.station || 0) - 1); }
  _static() {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; const g = c.createGain(), t = c.currentTime;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.35);
  }
  _snare(t, out, vol = 0.2) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.2);
  }
  _hat(t, out, vol = 0.04) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  _click(t, out, freq, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
  }
  _kick(t, out) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
  }
  _tone(oscs, dur, vol, delay = 0, out = this.master, lp) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay, g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let dest = g; if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.connect(g); dest = f; }
    g.connect(out);
    for (const [freq, type] of oscs) { const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); }
  }
}
GameAudio.STATIONS = [
  { name: "Vice FM 98.7", genre: "Synthwave", bpm: 104 },
  { name: "Bay Beats 104.1", genre: "Hip-hop", bpm: 88 },
  { name: "Salsa Caliente 101.5", genre: "Latin", bpm: 180 },
  { name: "Glades Country 92.3", genre: "Country", bpm: 112 },
];
