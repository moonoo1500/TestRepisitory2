/* =========================================================
   Звук: полностью синтезируется WebAudio, без внешних файлов
   ========================================================= */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.lastShot = 0;
    this.musicOn = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 8;
    this.master.connect(comp); comp.connect(this.ctx.destination);

    // шумовой буфер
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() { this.ctx?.resume(); }
  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.value = this.enabled ? 0.55 : 0; return this.enabled; }

  now() { return this.ctx.currentTime; }

  noise(dur, filterFreq, gain = 0.3, type = 'lowpass', q = 1) {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = this.ctx.createGain();
    const t = this.now();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  tone(freq, dur, gain = 0.2, type = 'sine', slide = 0, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    const t = this.now() + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shoot(type, dist = 20) {
    if (!this.ctx || !this.enabled) return;
    const t = this.now();
    if (t - this.lastShot < 0.028) return;
    this.lastShot = t;
    const v = Math.max(0.06, Math.min(1, 1 - dist / 160));
    switch (type) {
      case 'bullet':
        this.tone(880, 0.06, 0.09 * v, 'square', -600);
        this.noise(0.07, 2600, 0.10 * v);
        break;
      case 'cannon':
        this.tone(140, 0.24, 0.22 * v, 'sawtooth', -90);
        this.noise(0.3, 900, 0.22 * v, 'lowpass', 0.8);
        break;
      case 'missile':
        this.noise(0.42, 1500, 0.14 * v, 'bandpass', 2.5);
        this.tone(300, 0.4, 0.07 * v, 'sawtooth', 500);
        break;
      case 'laser':
        this.tone(1500, 0.16, 0.10 * v, 'sawtooth', -900);
        this.tone(2100, 0.12, 0.05 * v, 'sine', -1200);
        break;
      case 'bomb':
        this.tone(220, 0.2, 0.13 * v, 'triangle', -120);
        break;
    }
  }

  explosion(dist = 30) {
    if (!this.ctx || !this.enabled) return;
    const v = Math.max(0.1, Math.min(1, 1 - dist / 180));
    this.noise(0.85, 420, 0.5 * v, 'lowpass', 0.6);
    this.tone(70, 0.7, 0.3 * v, 'sine', -40);
    this.noise(0.2, 3200, 0.18 * v, 'highpass', 1);
  }

  build() {
    this.tone(420, 0.1, 0.14, 'square');
    this.tone(630, 0.14, 0.12, 'square', 0, 0.09);
    this.tone(840, 0.22, 0.10, 'square', 0, 0.18);
  }

  ready() {
    this.tone(660, 0.1, 0.13, 'triangle');
    this.tone(990, 0.18, 0.12, 'triangle', 0, 0.1);
  }

  error() { this.tone(180, 0.16, 0.12, 'square', -60); }

  click() { this.tone(1200, 0.03, 0.05, 'square'); }
  select() { this.tone(760, 0.05, 0.06, 'sine'); }

  alarm() {
    this.tone(520, 0.22, 0.16, 'square', -120);
    this.tone(390, 0.28, 0.15, 'square', -100, 0.22);
  }

  victory() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 0.16, 'triangle', 0, i * 0.16));
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 0.16, 'sawtooth', 0, i * 0.22));
  }

  /** Фоновый эмбиент: низкий гул + редкие всплески */
  startAmbient() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.05, this.now() + 4);
    g.connect(this.master);
    this.ambientGain = g;

    [55, 82.4, 110].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.06 + i * 0.03;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.02;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      const og = this.ctx.createGain(); og.gain.value = 0.4 - i * 0.1;
      o.connect(og); og.connect(g);
      o.start(); lfo.start();
    });
  }
}
