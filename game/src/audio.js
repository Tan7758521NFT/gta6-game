// SOLMARINA — every sound is synthesized with WebAudio: engine hum,
// sirens, gunshots, pickups and a looping original melody. One job:
// make noise, with no audio files at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A small original loop in A minor: bass roots with a bright lead line.
  // (Chords: Am – F – C – G, lead notes walk the A minor pentatonic.)
  const BASS = [55, 43.65, 65.41, 49];
  const LEAD = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 196, 220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
  const STEP_MS = 190;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc || sirenGain.gain.value <= 0) return;
        sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 700 : 950;
      }, 420);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function musicTick() {
    if (!ctx || muted) return;
    const bar = Math.floor(musicStep / 4) % 4;
    const inBar = musicStep % 4;
    const bass = BASS[bar];
    if (inBar === 0) tone(bass, 0.7, 'triangle', 0.16);
    if (inBar === 2) tone(bass * 1.5, 0.4, 'triangle', 0.1);
    const lead = LEAD[musicStep % LEAD.length];
    tone(lead, 0.22, 'square', 0.045);
    musicStep += 1;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx && !musicTimer) {
        musicTimer = window.setInterval(musicTick, STEP_MS);
      }
    },
    engine(amount) {
      if (!ctx || muted) return;
      engineGain.gain.value = amount * 0.06;
      engineOsc.frequency.value = 48 + amount * 130;
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.value = on && !muted ? 0.035 : 0;
    },
    gunshot() {
      noiseBurst(0.12, 0.5, 1800);
      tone(180, 0.08, 'square', 0.2);
    },
    punch() {
      noiseBurst(0.08, 0.3, 700);
    },
    hurt() {
      tone(140, 0.25, 'sawtooth', 0.2);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.25);
      tone(880, 0.14, 'sine', 0.25, 0.09);
    },
    door() {
      noiseBurst(0.07, 0.25, 900);
      tone(220, 0.06, 'square', 0.12);
    },
    missionStart() {
      tone(392, 0.16, 'triangle', 0.25);
      tone(523.25, 0.2, 'triangle', 0.25, 0.14);
    },
    missionDone() {
      tone(523.25, 0.14, 'triangle', 0.25);
      tone(659.25, 0.14, 'triangle', 0.25, 0.12);
      tone(783.99, 0.3, 'triangle', 0.28, 0.24);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}

// A silent stand-in for screenshot mode, where no sound is wanted.
export function createNullAudio() {
  const noop = () => {};
  return {
    unlock: noop, engine: noop, siren: noop, gunshot: noop, punch: noop,
    hurt: noop, pickup: noop, door: noop, missionStart: noop, missionDone: noop,
    toggleMute: () => false,
    get muted() { return true; },
  };
}
