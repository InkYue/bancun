const noteMap = new Map([
  ['D4', 293.66],
  ['E4', 329.63],
  ['G3', 196],
  ['A4', 440],
  ['B4', 493.88],
  ['C5', 523.25],
  ['D5', 587.33],
  ['D#5', 622.25],
  ['E5', 659.25],
  ['F5', 698.46],
  ['F#5', 739.99],
  ['G4', 392],
  ['G5', 783.99],
  ['A5', 880],
  ['A#5', 932.33],
  ['B5', 987.77],
  ['C6', 1046.5],
  ['D6', 1174.66],
  ['E6', 1318.51],
  ['F6', 1396.91],
  ['G6', 1567.98]
]);

class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.bgmNodes = [];
    this.bgmEnabled = false;
    this.bgmAudio = null;
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported by this browser.');
      }

      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.58;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  async toggleBgm(sourceUrl = '') {
    if (this.bgmEnabled) {
      this.stopBgm();
      return false;
    }

    if (sourceUrl) {
      await this.startAudioBgm(sourceUrl);
      return true;
    }

    await this.ensureContext();
    this.startBgm();
    return true;
  }

  async startAudioBgm(sourceUrl) {
    this.stopBgm();
    this.bgmAudio = new Audio(sourceUrl);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.42;
    await this.bgmAudio.play();
    this.bgmEnabled = true;
  }

  startBgm() {
    if (!this.context || !this.masterGain || this.bgmEnabled) {
      return;
    }

    const now = this.context.currentTime;
    const padGain = this.context.createGain();
    const shimmerGain = this.context.createGain();
    const lowOsc = this.context.createOscillator();
    const highOsc = this.context.createOscillator();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();

    lowOsc.type = 'sine';
    lowOsc.frequency.value = 130.81;
    highOsc.type = 'triangle';
    highOsc.frequency.value = 523.25;
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    padGain.gain.setValueAtTime(0.0001, now);
    padGain.gain.exponentialRampToValueAtTime(0.08, now + 1.6);
    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.025, now + 2.2);
    lfoGain.gain.value = 10;

    lfo.connect(lfoGain);
    lfoGain.connect(highOsc.frequency);
    lowOsc.connect(padGain);
    highOsc.connect(shimmerGain);
    padGain.connect(this.masterGain);
    shimmerGain.connect(this.masterGain);

    lowOsc.start(now);
    highOsc.start(now + 0.2);
    lfo.start(now);

    this.bgmNodes = [lowOsc, highOsc, lfo, padGain, shimmerGain, lfoGain];
    this.bgmEnabled = true;
  }

  stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio = null;
    }

    if (!this.context) {
      this.bgmNodes = [];
      this.bgmEnabled = false;
      return;
    }

    const now = this.context.currentTime;
    this.bgmNodes.forEach((node) => {
      if ('gain' in node) {
        node.gain.cancelScheduledValues(now);
        node.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      }
      if ('stop' in node) {
        node.stop(now + 0.4);
      }
    });
    this.bgmNodes = [];
    this.bgmEnabled = false;
  }

  async playGift(sound) {
    if (sound?.url) {
      const audio = new Audio(sound.url);
      audio.volume = 0.86;
      await audio.play();
      return;
    }

    const context = await this.ensureContext();
    if (!this.masterGain) {
      return;
    }

    const notes = Array.isArray(sound.notes) && sound.notes.length > 0 ? sound.notes : [];
    const baseFrequency = Number.isFinite(sound.frequency) ? sound.frequency : 440;

    notes.forEach((note, index) => {
      const frequency = noteMap.get(note) || baseFrequency + index * 72;
      const startAt = context.currentTime + index * 0.13;
      this.playBellTone(context, frequency, startAt, index);
    });
  }

  playBellTone(context, frequency, startAt, index) {
    if (!this.masterGain) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const sparkle = context.createOscillator();
    const sparkleGain = context.createGain();

    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.015, startAt + 0.18);
    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(frequency * 2.01, startAt);

    panner.pan.value = (index - 1) * 0.22;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.62);
    sparkleGain.gain.setValueAtTime(0.0001, startAt);
    sparkleGain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.04);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.36);

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(this.masterGain);

    oscillator.start(startAt);
    sparkle.start(startAt + 0.01);
    oscillator.stop(startAt + 0.7);
    sparkle.stop(startAt + 0.42);
  }
}

export const audioEngine = new AudioEngine();
