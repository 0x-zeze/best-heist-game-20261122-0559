// LOUD QUIET — sound, synthesised in code with WebAudio. One file, one job:
// every beep, click and siren the game makes, with no audio files at all.
export function createAudio() {
  let ctx = null;
  let sirenNodes = null;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { /* no audio in this browser: stay silent */ }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, seconds, type, gainValue, when = 0) {
    const audio = ensure();
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, audio.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + when + seconds);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + when);
    osc.stop(audio.currentTime + when + seconds);
  }

  return {
    // Called on the first user gesture so the browser unlocks audio.
    unlock() { ensure(); },
    step(running) {
      tone(running ? 190 : 140, 0.05, 'triangle', running ? 0.05 : 0.025);
    },
    crackClick() { tone(1200, 0.04, 'square', 0.04); },
    vaultOpen() {
      tone(523, 0.12, 'sine', 0.09);
      tone(659, 0.12, 'sine', 0.09, 0.1);
      tone(784, 0.22, 'sine', 0.09, 0.2);
    },
    loot() { tone(880, 0.1, 'sine', 0.08); tone(1320, 0.14, 'sine', 0.06, 0.07); },
    cameraOff() { tone(300, 0.15, 'sawtooth', 0.05); tone(180, 0.2, 'sawtooth', 0.05, 0.12); },
    spotted() { tone(980, 0.12, 'square', 0.05); tone(980, 0.12, 'square', 0.05, 0.16); },
    caught() {
      tone(220, 0.3, 'sawtooth', 0.09);
      tone(165, 0.4, 'sawtooth', 0.09, 0.25);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.12));
    },
    // The two-tone lockdown siren while the alarm sits at 100.
    sirenStart() {
      const audio = ensure();
      if (!audio || sirenNodes) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const lfo = audio.createOscillator();
      const lfoGain = audio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 620;
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0.035;
      osc.connect(gain).connect(audio.destination);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    },
    sirenStop() {
      if (!sirenNodes) return;
      try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
      sirenNodes = null;
    },
  };
}
