/* Listening Station: the music on the tapes.
   Each tape carries its own short lo-fi piece, composed here in code and rendered once with an
   OfflineAudioContext (16 bars, seamless loop). Playback is a looping buffer, so the tape's speed
   (spin-up, fast-forward warble, the slow tape-stop) is just its playbackRate.
   Nothing is created until the app attaches an AudioContext after the visitor's first gesture. */
(function () {
  'use strict';

  const SR = 24000;                       // everything is darker than 7 kHz anyway: far less work
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* one chord per bar, four bars that repeat through the arrangement: [bass, [voicing]] */
  const PRESETS = {
    about: { // golden lamplight: warm Rhodes, swung hats, a soft whistled line
      bpm: 76, swing: 0.6, seed: 11, keys: 'rhodes', snare: 'snare', kickGain: 0.9, lead: 'whistle', leadOct: 0,
      chords: [[41, [57, 60, 64, 67]], [40, [55, 59, 62, 64]], [38, [53, 57, 60, 64]], [36, [52, 55, 59, 62]]],
      scale: [65, 67, 69, 72, 74, 77, 79, 81],
    },
    projects: { // blue hour: cooler, muted plucks over a minor loop
      bpm: 82, swing: 0.56, seed: 23, keys: 'pluck', snare: 'snare', kickGain: 1, lead: 'bell', leadOct: 0,
      chords: [[45, [60, 64, 67, 71]], [41, [57, 60, 64, 71]], [36, [55, 59, 62, 64]], [43, [59, 62, 64, 67]]],
      scale: [69, 72, 74, 76, 79, 81, 84],
    },
    resume: { // clear daylight: brighter, brushed, a little quicker
      bpm: 88, swing: 0.54, seed: 37, keys: 'rhodes', snare: 'brush', kickGain: 0.85, lead: 'bell', leadOct: 0,
      chords: [[38, [54, 57, 61, 64]], [35, [57, 61, 62, 66]], [43, [54, 59, 62, 69]], [45, [57, 61, 64, 66]]],
      scale: [74, 76, 78, 81, 83, 86],
    },
    contact: { // rose dusk: slow and close, rimshots, long chords
      bpm: 70, swing: 0.62, seed: 53, keys: 'rhodes', snare: 'rim', kickGain: 0.75, lead: 'whistle', leadOct: 0,
      chords: [[39, [55, 58, 62, 65]], [36, [51, 55, 58, 62]], [44, [56, 60, 63, 67]], [46, [58, 62, 65, 67]]],
      scale: [75, 77, 79, 82, 84, 87],
    },
  };
  /* the room's own music, under the rain: slow pads, a low drone, a few felt-piano notes, no beat */
  PRESETS.ambient = {
    bpm: 62, ambient: true, seed: 71,
    chords: [[41, [57, 60, 64, 67]], [45, [55, 60, 62, 64]], [38, [53, 57, 60, 64]], [46, [57, 62, 64, 65]]],
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
  };
  const BARS = 16;

  /* ------------------------------------------------------------------ the composer */
  async function render(tape) {
    const P = PRESETS[tape] || PRESETS.about;
    const beat = 60 / P.bpm, bar = beat * 4, L = bar * BARS, TAIL = P.ambient ? 6 : 4;
    const len = Math.ceil((L + TAIL) * SR);
    const ctx = new OfflineAudioContext(2, len, SR);
    const r = rng(P.seed);
    const rr = (a, b) => a + r() * (b - a);

    /* noise */
    const noise = ctx.createBuffer(1, SR * 2, SR);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const pink = ctx.createBuffer(1, SR * 4, SR);
    { const d = pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2; } }

    /* the master chain: saturation, tape lowpass, wow and flutter, glue */
    const sum = ctx.createGain(); sum.gain.value = 0.9;
    const shaper = ctx.createWaveShaper();
    { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } shaper.curve = c; }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6800; lp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38;
    const wow = ctx.createDelay(0.1); wow.delayTime.value = 0.012;
    // LFOs whose cycles fit the loop exactly, so the wobble never jumps at the seam
    const fitted = (f) => Math.max(1, Math.round(f * L)) / L;
    for (const [f, depth] of [[fitted(0.42), 0.00065], [fitted(5.6), 0.00011]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = depth; o.connect(g).connect(wow.delayTime); o.start(0);
    }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = 0.02; comp.release.value = 0.25;
    const outG = ctx.createGain(); outG.gain.value = 0.95;
    sum.connect(shaper).connect(hp).connect(lp).connect(wow).connect(comp).connect(outG).connect(ctx.destination);

    /* a soft room */
    const verb = ctx.createConvolver();
    { const n = Math.floor(SR * (P.ambient ? 2.2 : 1.4)), ir = ctx.createBuffer(2, n, SR); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lpS = 0; for (let i = 0; i < n; i++) { lpS = lpS * 0.82 + (Math.random() * 2 - 1) * 0.18; d[i] = lpS * Math.pow(1 - i / n, 2.6) * 2.4; } } verb.buffer = ir; }
    const verbG = ctx.createGain(); verbG.gain.value = P.ambient ? 0.5 : 0.32; verb.connect(verbG).connect(sum);

    /* buses */
    const bus = (gain, send = 0, pan = 0) => {
      const g = ctx.createGain(); g.gain.value = gain;
      const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(sum);
      if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(verb); }
      return g;
    };
    const keysBus = bus(0.58, 0.55), padBus = bus(0.22, 0.8), bassBus = bus(0.55, 0.05), drumBus = bus(0.46, 0.12), hatBus = bus(0.17, 0.15, 0.18), leadBus = bus(0.22, 0.7, -0.12);
    // the keys sway gently left and right, and every pad/keys swell ducks under the kick
    { const o = ctx.createOscillator(); o.frequency.value = fitted(0.23); const g = ctx.createGain(); g.gain.value = 0.35; const pn = ctx.createStereoPanner(); keysBus.disconnect(); keysBus.connect(pn).connect(sum); o.connect(g).connect(pn.pan); o.start(0); const s = ctx.createGain(); s.gain.value = 0.55; keysBus.connect(s).connect(verb); }
    const duck = ctx.createGain(); padBus.disconnect(); padBus.connect(duck).connect(sum); { const s = ctx.createGain(); s.gain.value = 0.8; duck.connect(s).connect(verb); }
    // a lead echo, three-sixteenths behind
    const echo = ctx.createDelay(2); echo.delayTime.value = beat * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32; const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2400;
    leadBus.connect(echo); echo.connect(echoLp).connect(fb).connect(echo); const echoG = ctx.createGain(); echoG.gain.value = 0.45; echoLp.connect(echoG).connect(sum);
    // the tape's own hiss
    { const s = ctx.createBufferSource(); s.buffer = pink; s.loop = true; const g = ctx.createGain(); g.gain.value = 0.012; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; s.connect(f).connect(g).connect(outG); s.start(0); }

    /* instruments */
    function rhodes(t, m, vel, dur) {
      t = Math.max(0.002, t);
      const f = mtof(m);
      const car = ctx.createOscillator(); car.frequency.value = f;
      const mod = ctx.createOscillator(); mod.frequency.value = f;
      const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.2 * vel, t); mg.gain.exponentialRampToValueAtTime(f * 0.35, t + 0.5);
      const tine = ctx.createOscillator(); tine.frequency.value = f * 14;
      const tg = ctx.createGain(); tg.gain.setValueAtTime(f * 1.4 * vel, t); tg.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      mod.connect(mg).connect(car.frequency); tine.connect(tg).connect(car.frequency);
      const a = ctx.createGain(); const peak = 0.22 * vel;
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(peak, t + 0.006); a.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.6);
      a.gain.setTargetAtTime(peak * 0.25, t + 0.6, dur * 0.6); a.gain.setTargetAtTime(0.0001, t + dur, 0.18);
      car.connect(a).connect(keysBus);
      const end = t + dur + 1.1;
      for (const o of [car, mod, tine]) { o.start(t); o.stop(end); }
    }
    function pluck(t, m, vel, dur) {
      t = Math.max(0.002, t);
      const f = mtof(m);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const mod = ctx.createOscillator(); mod.frequency.value = f * 2; const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.25);
      mod.connect(mg).connect(o.frequency);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 2; flt.frequency.setValueAtTime(3200, t); flt.frequency.exponentialRampToValueAtTime(700, t + 0.35);
      const a = ctx.createGain(); const peak = 0.26 * vel;
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(peak, t + 0.004); a.gain.exponentialRampToValueAtTime(peak * 0.2, t + 0.4); a.gain.setTargetAtTime(0.0001, t + Math.min(dur, 0.9), 0.15);
      o.connect(flt).connect(a).connect(keysBus);
      o.start(t); mod.start(t); o.stop(t + Math.min(dur, 0.9) + 0.9); mod.stop(t + 0.5);
    }
    function pad(t, notes, dur) {
      t = Math.max(0.002, t);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
      const a = ctx.createGain(); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.09, t + dur * 0.35); a.gain.setValueAtTime(0.09, t + dur * 0.7); a.gain.linearRampToValueAtTime(0, t + dur + 0.4);
      f.connect(a).connect(padBus);
      for (const m of notes) for (const d of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.5); }
    }
    function bass(t, m, dur, vel = 1) {
      t = Math.max(0.002, t);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
      const s = ctx.createOscillator(); s.frequency.value = mtof(m);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
      const a = ctx.createGain(); const pk = 0.5 * vel; a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(pk, t + 0.012); a.gain.setTargetAtTime(pk * 0.7, t + 0.05, 0.2); a.gain.setTargetAtTime(0.0001, t + dur, 0.06);
      o.connect(f); s.connect(f); f.connect(a).connect(bassBus);
      o.start(t); s.start(t); o.stop(t + dur + 0.4); s.stop(t + dur + 0.4);
    }
    function kick(t, vel) {
      t = Math.max(0.002, t);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
      const a = ctx.createGain(); const pk = 0.95 * vel * P.kickGain; a.gain.setValueAtTime(pk, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.connect(a).connect(drumBus); o.start(t); o.stop(t + 0.45);
      const c = ctx.createBufferSource(); c.buffer = noise; const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1400; const cg = ctx.createGain(); cg.gain.setValueAtTime(0.18 * vel, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
      c.connect(cf).connect(cg).connect(drumBus); c.start(t, r() * 1.5); c.stop(t + 0.02);
      // the pad breathes out of its way
      duck.gain.setValueAtTime(1, t); duck.gain.linearRampToValueAtTime(0.55, t + 0.02); duck.gain.setTargetAtTime(1, t + 0.05, 0.12);
    }
    function snare(t, vel) {
      t = Math.max(0.002, t);
      const kind = P.snare;
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter();
      const a = ctx.createGain();
      if (kind === 'rim') {
        f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3;
        a.gain.setValueAtTime(0.5 * vel, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 420; const og = ctx.createGain(); og.gain.setValueAtTime(0.35 * vel, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.connect(og).connect(drumBus); o.start(t); o.stop(t + 0.06);
      } else if (kind === 'brush') {
        f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
        a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.32 * vel, t + 0.02); a.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      } else {
        f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.7;
        a.gain.setValueAtTime(0.5 * vel, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08); const og = ctx.createGain(); og.gain.setValueAtTime(0.3 * vel, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(og).connect(drumBus); o.start(t); o.stop(t + 0.12);
      }
      n.connect(f).connect(a).connect(drumBus); n.start(t, r() * 1.5); n.stop(t + 0.4);
    }
    function hat(t, vel, open = false) {
      t = Math.max(0.002, t);
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
      const a = ctx.createGain(); a.gain.setValueAtTime(0.32 * vel, t); a.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.045));
      n.connect(f).connect(a).connect(hatBus); n.start(t, r() * 1.5); n.stop(t + 0.3);
    }
    function lead(t, m, dur, vel) {
      t = Math.max(0.002, t);
      const f = mtof(m + 12 * P.leadOct);
      const a = ctx.createGain();
      if (P.lead === 'bell') {
        const car = ctx.createOscillator(); car.frequency.value = f; const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
        const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
        mod.connect(mg).connect(car.frequency);
        a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.2 * vel, t + 0.005); a.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        car.connect(a).connect(leadBus); car.start(t); mod.start(t); car.stop(t + 1.5); mod.stop(t + 1.5);
      } else {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.008, t + 0.25); vib.connect(vg).connect(o.frequency);
        const br = ctx.createBufferSource(); br.buffer = noise; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f; bf.Q.value = 8; const bg = ctx.createGain(); bg.gain.value = 0.25;
        br.connect(bf).connect(bg).connect(a);
        a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.17 * vel, t + 0.06); a.gain.setTargetAtTime(0.12 * vel, t + 0.08, 0.2); a.gain.setTargetAtTime(0.0001, t + dur, 0.08);
        o.connect(a).connect(leadBus); o.start(t); vib.start(t); br.start(t, r()); const e = t + dur + 0.5; o.stop(e); vib.stop(e); br.stop(e);
      }
    }

    /* the arrangement: A intro (keys, hats, pad), B adds the beat and bass, C adds the lead, D everything with a turnaround */
    const human = () => rr(-0.006, 0.006);
    const stepTime = (b, s) => {
      // 16 steps a bar, swung: the off-eighths land late
      const bt = Math.floor(s / 4), sub = s % 4;
      const pos = sub === 0 ? 0 : sub === 2 ? P.swing : sub === 1 ? P.swing * 0.5 : P.swing + (1 - P.swing) * 0.5;
      return b * bar + (bt + pos) * beat;
    };
    // a two-bar motif for the lead, then varied
    const motif = [];
    { const slots = [0, 2, 3, 6, 8, 10, 11, 14]; let idx = Math.floor(r() * 3) + 2;
      for (let bb = 0; bb < 2; bb++) for (const s of slots) { if (r() < 0.42) continue; idx = Math.max(0, Math.min(P.scale.length - 1, idx + Math.round(rr(-2, 2)))); motif.push({ bb, s, i: idx, d: r() < 0.3 ? 2 : 1 }); } }
    /* felt piano: a soft sine with its octave, quick to speak, slow to fade */
    function felt(t, m, vel) {
      t = Math.max(0.002, t);
      const f = mtof(m), a = ctx.createGain(), lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1800;
      const peak = 0.2 * vel;
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(peak, t + 0.012); a.gain.exponentialRampToValueAtTime(peak * 0.25, t + 0.9); a.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      lpf.connect(a).connect(keysBus);
      for (const [mul, g] of [[1, 1], [2, 0.22]]) { const o = ctx.createOscillator(); o.frequency.value = f * mul; const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(lpf); o.start(t); o.stop(t + 3.3); }
    }
    function drone(t, m, dur) {
      t = Math.max(0.002, t);
      const o = ctx.createOscillator(); o.frequency.value = mtof(m);
      const a = ctx.createGain(); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.16, t + dur * 0.4); a.gain.setValueAtTime(0.16, t + dur * 0.75); a.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      o.connect(a).connect(bassBus); o.start(t); o.stop(t + dur + 0.7);
    }
    function ambientBar(b) {
      const [root, voicing] = P.chords[Math.floor(b / 2) % 4];
      const t0 = b * bar;
      if (b % 2 === 0) { pad(t0, voicing, bar * 2); pad(t0, voicing.map((m) => m - 12), bar * 2); drone(t0, root, bar * 2); }
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const at = t0 + (Math.floor(r() * 8) / 2) * beat + rr(-0.02, 0.02);
        const pick = r() < 0.55 ? voicing[Math.floor(r() * voicing.length)] + 12 : P.scale[Math.floor(r() * P.scale.length)];
        felt(at, pick, rr(0.45, 0.8));
        if (r() < 0.18) felt(at + 0.03, pick - (r() < 0.5 ? 5 : 3), rr(0.3, 0.5));
      }
    }
    function scheduleBar(b) {
      if (P.ambient) { ambientBar(b); return; }
      const sec = Math.floor(b / 4); // 0 A, 1 B, 2 C, 3 D
      const [root, voicing] = P.chords[b % 4];
      const t0 = b * bar;
      // keys: a rolled chord on 1 and a stab on the and-of-2 (or a long wash on the slow tape)
      const roll = (t, vel, dur) => voicing.forEach((m, i) => (P.keys === 'pluck' ? pluck : rhodes)(t + i * 0.014 + human(), m, vel * rr(0.85, 1), dur));
      roll(t0 + 0.004, 0.9, P.bpm < 75 ? bar * 0.9 : beat * 1.4);
      if (P.bpm >= 75 || sec >= 2) roll(stepTime(b, 6), 0.6, beat * 1.1);
      if (P.keys === 'pluck') { roll(stepTime(b, 10), 0.55, beat * 0.6); if (r() < 0.5) roll(stepTime(b, 14), 0.4, beat * 0.4); }
      if (sec === 0 || sec === 3) pad(t0, voicing.map((m) => m - 12), bar);
      // hats everywhere, light in the intro
      for (let s = 0; s < 16; s += 2) { const acc = s % 4 === 0 ? 1 : 0.65; hat(stepTime(b, s) + human(), (sec === 0 ? 0.55 : 1) * acc * rr(0.8, 1), s === 14 && b % 4 === 3); }
      if (sec >= 1) for (let s = 1; s < 16; s += 4) if (r() < 0.25) hat(stepTime(b, s) + human(), 0.35);
      // beat
      if (sec >= 1) {
        const lastBar = b === BARS - 1;
        kick(t0 + human() * 0.3, 1);
        kick(stepTime(b, 10) + human(), 0.85);
        if (r() < 0.45 && !lastBar) kick(stepTime(b, 7) + human(), 0.6);
        snare(stepTime(b, 4) + human() * 0.5 + 0.008, 0.9);
        if (!lastBar) snare(stepTime(b, 12) + human() * 0.5 + 0.008, 0.95);
        else { snare(stepTime(b, 12), 0.6); snare(stepTime(b, 14), 0.75); snare(stepTime(b, 15), 0.9); }
        if (r() < 0.3) snare(stepTime(b, 15) + human(), 0.25);
      }
      // bass: root on 1, fifth or octave on the and-of-3, a passing note into the next bar
      if (sec >= 1) {
        bass(t0 + 0.01, root, beat * 1.6);
        bass(stepTime(b, 10), r() < 0.5 ? root + 7 : root + 12, beat * 0.9, 0.8);
        if (r() < 0.6) bass(stepTime(b, 14), P.chords[(b + 1) % 4][0] + (r() < 0.5 ? -1 : 2), beat * 0.4, 0.6);
      }
      // lead
      if (sec >= 2) for (const n of motif) {
        if (n.bb !== b % 2) continue;
        if (sec === 3 && r() < 0.25) continue;
        const i = Math.max(0, Math.min(P.scale.length - 1, n.i + (sec === 3 && b % 4 >= 2 ? 1 : 0)));
        lead(stepTime(b, n.s) + human(), P.scale[i], beat * 0.5 * n.d, rr(0.75, 1));
      }
    }
    /* only the first two bars go in before rendering starts; every later bar is added one bar ahead of the
       render position, a few milliseconds of work at a time, so building the piece never blocks the page */
    scheduleBar(0); scheduleBar(1);
    const quantum = 128 / SR;
    for (let b = 2; b < BARS; b++) {
      if (typeof ctx.suspend !== 'function') { scheduleBar(b); continue; }
      const at = Math.round(((b - 1) * bar) / quantum) * quantum;
      ctx.suspend(at).then(() => { scheduleBar(b); ctx.resume(); });
    }

    const t0 = performance.now();
    const out = await ctx.startRendering();
    /* fold the tail over the start so the loop has no seam, then master to a steady level (peaks at -1.5 dB);
       one channel per task, so the post-pass never holds the page either */
    const breathe = () => new Promise((res) => setTimeout(res, 0));
    const n = Math.floor(L * SR), tailN = len - n;
    const loop = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: SR });
    let pk = 0;
    for (let ch = 0; ch < 2; ch++) {
      await breathe();
      const src = out.getChannelData(ch), dst = loop.getChannelData(ch);
      dst.set(src.subarray(0, n));
      for (let i = 0; i < tailN && i < n; i++) dst[i] += src[n + i];
      for (let i = 0; i < n; i++) { const a = dst[i] < 0 ? -dst[i] : dst[i]; if (a > pk) pk = a; }
    }
    if (pk > 0) { const k = 0.84 / pk; for (let ch = 0; ch < 2; ch++) { await breathe(); const d = loop.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    MUSIC.renderMs[tape] = Math.round(performance.now() - t0);
    return { buffer: loop, bar, beat, bpm: P.bpm };
  }

  /* ------------------------------------------------------------------ playback */
  const MUSIC = {
    ctx: null, out: null, cache: {}, renderMs: {},
    cur: null,              // { tape, src, gain, filter, startedAt, offset }
    analysers: null,
    attach(ctx, dest) {
      if (this.ctx) return;
      this.ctx = ctx;
      this.out = ctx.createGain(); this.out.gain.value = 0.55;
      this.out.connect(dest);
      this.ambOut = ctx.createGain(); this.ambOut.gain.value = 0; this.ambOut.connect(dest);
      const split = ctx.createChannelSplitter(2);
      this.out.connect(split);
      this.analysers = [0, 1].map((i) => { const a = ctx.createAnalyser(); a.fftSize = 1024; a.smoothingTimeConstant = 0.2; split.connect(a, i); return a; });
      this._buf = new Float32Array(1024);
    },
    supported() { return typeof OfflineAudioContext !== 'undefined'; },
    prepare(tape) {
      if (!this.supported()) return Promise.resolve(null);
      if (!this.cache[tape]) this.cache[tape] = render(tape).catch((e) => { console.warn('music render failed', e); delete this.cache[tape]; return null; });
      return this.cache[tape];
    },
    /* render the other tapes one by one when the page is idle, so every tape plays at once */
    prepareAll(order) {
      if (!this.supported() || this._all) return;
      this._all = true;
      const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 4000 }) : (fn) => setTimeout(fn, 600);
      const next = (i) => { if (i >= order.length) return; idle(() => this.prepare(order[i]).then(() => next(i + 1))); };
      next(0);
    },
    playing() { return !!this.cur; },
    /* start at a section of the loop; the tape comes up to speed over `spin` seconds */
    async start(tape, section = 0, { spin = 0.7 } = {}) {
      if (!this.ctx) return;
      const piece = await this.prepare(tape);
      if (!piece) return;
      this.stop(0.05);
      const ctx = this.ctx, t = ctx.currentTime + 0.02;
      const src = ctx.createBufferSource(); src.buffer = piece.buffer; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 16000;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.out);
      if (spin > 0.02) {
        src.playbackRate.setValueAtTime(0.45, t); src.playbackRate.exponentialRampToValueAtTime(1, t + spin);
        filter.frequency.setValueAtTime(1800, t); filter.frequency.exponentialRampToValueAtTime(16000, t + spin);
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(1, t + spin * 0.8);
      } else { gain.gain.setValueAtTime(1, t); }
      const offset = ((section * 4 * piece.bar) % piece.buffer.duration);
      src.start(t, offset);
      this.cur = { tape, src, gain, filter, piece, paused: false };
    },
    /* fast-forward / rewind: the pitch runs away and comes back */
    search(dir = 1, secs = 0.7) {
      const c = this.cur; if (!c || c.paused) return;
      const ctx = this.ctx, t = ctx.currentTime, r = c.src.playbackRate;
      r.cancelScheduledValues(t); r.setValueAtTime(r.value || 1, t);
      r.linearRampToValueAtTime(dir > 0 ? 2.6 : 0.35, t + secs * 0.35); r.linearRampToValueAtTime(1, t + secs);
      c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t); c.gain.gain.linearRampToValueAtTime(0.35, t + 0.08); c.gain.gain.linearRampToValueAtTime(1, t + secs);
      c.filter.frequency.cancelScheduledValues(t); c.filter.frequency.setValueAtTime(16000, t); c.filter.frequency.exponentialRampToValueAtTime(2200, t + secs * 0.35); c.filter.frequency.exponentialRampToValueAtTime(16000, t + secs);
    },
    pause(on) {
      const c = this.cur; if (!c || c.paused === on) return;
      const t = this.ctx.currentTime, r = c.src.playbackRate;
      c.paused = on;
      r.cancelScheduledValues(t); r.setValueAtTime(Math.max(0.0001, r.value), t);
      c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t);
      if (on) { r.exponentialRampToValueAtTime(0.05, t + 0.18); r.setValueAtTime(0, t + 0.19); c.gain.gain.linearRampToValueAtTime(0, t + 0.18); }
      else { r.setValueAtTime(0.2, t); r.exponentialRampToValueAtTime(1, t + 0.25); c.gain.gain.linearRampToValueAtTime(1, t + 0.2); }
    },
    /* the tape-stop: the pitch sinks, the top end closes, then silence */
    stop(secs = 0.75) {
      const c = this.cur; if (!c) return;
      this.cur = null;
      const t = this.ctx.currentTime, r = c.src.playbackRate;
      r.cancelScheduledValues(t); r.setValueAtTime(Math.max(0.0001, r.value), t);
      c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t);
      if (secs > 0.1 && !c.paused) {
        r.exponentialRampToValueAtTime(0.06, t + secs);
        c.filter.frequency.cancelScheduledValues(t); c.filter.frequency.setValueAtTime(c.filter.frequency.value, t); c.filter.frequency.exponentialRampToValueAtTime(500, t + secs);
        c.gain.gain.setValueAtTime(c.gain.gain.value, t + secs * 0.6); c.gain.gain.linearRampToValueAtTime(0, t + secs);
      } else c.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.03, secs));
      try { c.src.stop(t + Math.max(0.05, secs) + 0.05); } catch (e) { /* already stopped */ }
      setTimeout(() => { try { c.src.disconnect(); c.gain.disconnect(); } catch (e) { /* gone */ } }, (secs + 0.3) * 1000);
    },
    /* left and right levels, 0…1, for the meters */
    levels() {
      if (!this.analysers) return [0, 0];
      return this.analysers.map((a) => { a.getFloatTimeDomainData(this._buf); let s = 0; for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i]; return Math.sqrt(s / this._buf.length); });
    },
    /* the ambient piece: its own loop on its own gain (the meters never see it), fading in and out under the rain */
    ambient(on, fade = 2.5) {
      if (!this.ctx) return;
      this._ambWant = on;
      const t = this.ctx.currentTime;
      if (!on) { this.ambOut.gain.cancelScheduledValues(t); this.ambOut.gain.setTargetAtTime(0, t, fade / 3); return; }
      this.prepare('ambient').then((piece) => {
        if (!piece || !this._ambWant) return;
        if (!this.ambSrc) {
          const src = this.ctx.createBufferSource(); src.buffer = piece.buffer; src.loop = true;
          src.connect(this.ambOut); src.start(this.ctx.currentTime + 0.02, Math.random() * piece.buffer.duration);
          this.ambSrc = src;
        }
        const now = this.ctx.currentTime;
        this.ambOut.gain.cancelScheduledValues(now); this.ambOut.gain.setTargetAtTime(0.22, now, fade / 3);
      });
    },
    setVolume(v) { if (this.out) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08); },
  };
  window.STATION_MUSIC = MUSIC;
})();
