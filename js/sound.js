export class GameSound {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.ensureContext();
  }

  ensureContext() {
    if (!this.enabled) return null;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return null;
    this.context ||= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  tone(frequency, duration, type = 'sine', delay = 0, volume = 0.05) {
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  shoot() {
    this.tone(260, 0.11, 'square', 0, 0.035);
    this.tone(520, 0.1, 'sine', 0.05, 0.03);
  }

  pop() {
    this.tone(120, 0.12, 'triangle', 0, 0.06);
  }

  correct() {
    [523, 659, 784].forEach((note, index) => this.tone(note, 0.2, 'sine', index * 0.09, 0.045));
  }

  victory() {
    [523, 659, 784, 1047].forEach((note, index) => this.tone(note, 0.28, 'triangle', index * 0.11, 0.05));
  }
}
