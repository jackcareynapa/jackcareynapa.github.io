/* Listening Station: behaviour.
   Pick a cassette: it comes out of its case and goes into the deck. Press Play: the deck engages, the reels
   come up to speed, the tape's music starts, and the amber display shows that tape's content.
   One state object (S) is the truth. The mechanism (M) animates the deck toward it, and a newer request
   always wins: animations speed up and retarget, never queue. The deck is the 3D room in deck3d.js
   (window.STATION_VIEW); every control that matters also exists here as a real, keyboard-operable element. */
(function () {
  'use strict';

  const C = window.STATION;
  const ART = window.STATION_ART;
  const MUSIC = window.STATION_MUSIC || null;
  if (!C || !ART) return;
  const BASE = C.site.base;
  const TAPES = C.tapes;
  const TAPE = Object.fromEntries(TAPES.map((t) => [t.id, t]));
  const chaptersOf = (id) => C.sections[id].chapters;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (tag, attrs = {}, html = '') => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; el.setAttribute(k, v === true ? '' : v); } if (html) el.innerHTML = html; return el; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;

  const CASE_LABEL = { about: 'About', projects: 'Projects', resume: 'Experience', contact: 'Contact' };

  /* the 3D view, or a stand-in that settles instantly when WebGL is unavailable */
  const NULL_VIEW = new Proxy({ ok: false, ready: Promise.resolve(false), on: {} }, {
    get(t, k) { if (k in t) return t[k]; return () => Promise.resolve(null); },
  });
  const VIEW = window.STATION_VIEW || NULL_VIEW;
  if (!VIEW.ok) html.classList.add('no3d');

  /* ------------------------------------------------ preferences */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('jc-station:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('jc-station:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqCoarse = matchMedia('(pointer: coarse)');
  const prefs = { sound: store.get('sound3', true), volume: store.get('volume', 6), lamp: true };
  const reduced = () => mqReduce.matches;
  let lastInput = 'pointer';

  /* ------------------------------------------------ state
     S.deck: which tape should be in the deck (null: none). S.transport: what it should be doing.
     M.deck: which tape is in the deck now. M.run: off | cue (getting ready) | on | pause | wait (open, waiting for
     the visitor's first gesture before any sound may play). */
  const S = { deck: null, chapter: 0, transport: 'stop' };
  const M = { deck: null, busy: false, rush: false, doorOpen: false, run: 'off', gen: 0, shown: false, counter: 0, played: 0, since: 0 };

  /* ------------------------------------------------ routing: / (no tape), /?tape=id (in the deck), /id/track/ (playing) */
  function parseLocation(loc = location) {
    let path = loc.pathname;
    if (path.startsWith(BASE)) path = path.slice(BASE.length);
    path = path.replace(/index\.html$/, '').replace(/^\/+|\/+$/g, '');
    const parts = path ? path.split('/') : [];
    const q = new URLSearchParams(loc.search);
    if (!parts.length || parts[0] === '404.html') {
      const t = q.get('tape');
      return { tape: TAPE[t] ? t : null, chapter: 0, open: false, notFound: parts[0] === '404.html' };
    }
    if (!TAPE[parts[0]]) return { tape: null, chapter: 0, open: false, notFound: true };
    const chs = chaptersOf(parts[0]);
    let idx = 0, notFound = false;
    if (parts[1]) { idx = chs.findIndex((c) => c.slug === parts[1]); if (idx < 0) { idx = 0; notFound = true; } }
    return { tape: parts[0], chapter: idx, open: true, notFound };
  }
  function urlFor() {
    if (!S.deck) return BASE;
    if (S.transport === 'stop') return `${BASE}?tape=${S.deck}`;
    return `${BASE}${S.deck}/${chaptersOf(S.deck)[S.chapter].slug}/`;
  }
  function titleFor() {
    if (!S.deck) return C.site.title;
    const t = TAPE[S.deck];
    if (S.transport === 'stop') return `${t.title} · ${C.site.owner}`;
    return `${chaptersOf(S.deck)[S.chapter].title} · ${t.title} · ${C.site.owner}`;
  }
  function commit(push) {
    const url = urlFor();
    const here = location.pathname + location.search;
    const snapshot = { deck: S.deck, chapter: S.chapter, transport: S.transport };
    if (url !== here) history[push ? 'pushState' : 'replaceState'](snapshot, '', url);
    else history.replaceState(snapshot, '', url);
    document.title = titleFor();
  }

  /* ------------------------------------------------ announcements */
  let annTimer = 0;
  function announce(msg) {
    const el = $('#announcer');
    el.textContent = '';
    clearTimeout(annTimer);
    annTimer = setTimeout(() => { el.textContent = msg; }, 60);
  }

  /* ------------------------------------------------ sound
     Foley is a sprite of real recordings (assets/audio, CC0); anything missing falls back to a synthesized
     stand-in. The music comes from music.js. Nothing plays until the visitor's first click or key press. */
  const Sound = {
    ctx: null, out: null, fx: null, amb: null, musicBus: null, unlocked: false, bufs: {}, loops: {},
    sprite: null, cues: null, shift: 0, wantMotor: false, lastKey: 0,
    ensure() {
      if (this.ctx) return true;
      if (!prefs.sound || !this.unlocked) return false;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3; comp.connect(ctx.destination);
      this.out = ctx.createGain(); this.out.connect(comp);
      this.fx = ctx.createGain(); this.fx.connect(this.out);
      this.amb = ctx.createGain(); this.amb.gain.value = 0; this.amb.connect(this.out);
      this.musicBus = ctx.createGain(); this.musicBus.connect(this.out);
      // a small wooden room, kept low
      const verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 0.45), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * (i < 60 ? i / 60 : 1); }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.1; verb.connect(wet).connect(this.out);
      this.fx.connect(verb);
      const mk = (kind) => {
        const n = ctx.sampleRate, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, last = 0;
        for (let i = 0; i < n; i++) {
          const w = Math.random() * 2 - 1;
          if (kind === 'white') d[i] = w;
          else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
          else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        }
        return buf;
      };
      this.bufs = { white: mk('white'), pink: mk('pink') };
      Object.defineProperty(this.bufs, 'brown', { configurable: true, get() { const b = mk('brown'); Object.defineProperty(this, 'brown', { value: b }); return b; } });
      this.setVolume();
      (window.requestIdleCallback || ((fn) => setTimeout(fn, 300)))(() => this.ambience(true));
      this.loadSprite();
      if (MUSIC && MUSIC.supported()) {
        MUSIC.attach(ctx, this.musicBus);
        if (M.deck) MUSIC.prepare(M.deck);
        // the room's own quiet music, under the rain, whenever no tape is playing
        (window.requestIdleCallback || ((fn) => setTimeout(fn, 400)))(() => { if (M.run === 'off') MUSIC.ambient(true); else MUSIC.prepare('ambient'); });
      }
      return true;
    },
    async loadSprite() {
      try {
        const [buf, meta] = await Promise.all([
          fetch(`${BASE}assets/audio/foley.m4a`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
          fetch(`${BASE}assets/audio/foley.json`).then((r) => r.json()),
        ]);
        const audio = await this.ctx.decodeAudioData(buf);
        // a click sits at a known time: wherever the decoder put it, every cue moves with it
        const d = audio.getChannelData(0), sr = audio.sampleRate;
        let at = meta.calib;
        for (let i = 0; i < Math.min(d.length, sr * 0.4); i++) if (Math.abs(d[i]) > 0.3) { at = i / sr; break; }
        this.shift = at - meta.calib; this.sprite = audio; this.cues = meta.cues;
        if (this.wantMotor) { this.motor(false); this.motor(true); }
      } catch (e) { /* the synthesized stand-ins play instead */ }
    },
    setVolume() {
      if (!this.out) return;
      this.out.gain.setTargetAtTime(prefs.sound ? 0.3 + (prefs.volume / 10) * 0.7 : 0, this.ctx.currentTime, 0.05);
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    pick(base) {
      if (!this.cues) return null;
      const list = Object.keys(this.cues).filter((k) => k === base || (k.startsWith(base) && /\d$/.test(k) && k.slice(0, -1) === base));
      return list.length ? list[Math.floor(Math.random() * list.length)] : null;
    },
    slice(cue, { gain = 1, rate = 1, at = 0, to = this.fx } = {}) {
      const c = this.cues && this.cues[cue]; if (!c || !this.sprite) return false;
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.sprite; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain; src.connect(g).connect(to);
      src.start(ctx.currentTime + 0.004 + at, Math.max(0, c.at + this.shift - 0.004), c.dur + 0.05);
      return true;
    },
    play(name, { at = 0, gain = 1 } = {}) {
      if (!prefs.sound || !this.ensure()) return;
      this.resume();
      const GAIN = { 'key-down': 0.7, 'key-up': 0.4, latch: 0.75, stop: 0.55, 'door-open': 0.5, 'door-close': 0.55, 'case-open': 0.55, 'case-close': 0.6, lift: 0.35, seat: 0.5, insert: 0.95, tick: 0.35, switch: 0.5, spinup: 0.22 };
      if (name === 'key-down') { if (this.ctx.currentTime - this.lastKey < 0.05) return; this.lastKey = this.ctx.currentTime; }
      const cue = this.pick(name);
      if (cue && this.slice(cue, { gain: (GAIN[name] || 0.6) * gain * (0.85 + Math.random() * 0.3), rate: 0.97 + Math.random() * 0.06, at })) return;
      this.synth(name, this.ctx.currentTime + 0.005 + at);
    },
    /* building blocks for the stand-ins, the thunder and the phones plug */
    burst(t, { type = 'white', f = 3000, q = 1, dur = 0.01, gain = 0.5, hp = 0, attack = 0.0005, to = this.fx, sweep = 0 } = {}) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.bufs[type]; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); bp.Q.value = q;
      if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = src.connect(bp);
      if (hp) { const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp; node = node.connect(hpf); }
      node.connect(g).connect(to);
      src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.05);
    },
    thump(t, { f0 = 140, f1 = 60, dur = 0.08, gain = 0.5, type = 'sine' } = {}) {
      const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + dur + 0.02);
    },
    synth(name, t) {
      switch (name) {
        case 'key-down': this.burst(t, { f: 3300, q: 1.4, dur: 0.008, gain: 0.5 }); this.thump(t, { f0: 170, f1: 70, dur: 0.07, gain: 0.5 }); break;
        case 'key-up': this.burst(t, { f: 2400, q: 1.6, dur: 0.006, gain: 0.25 }); this.thump(t, { f0: 120, f1: 70, dur: 0.05, gain: 0.2 }); break;
        case 'latch': this.burst(t, { f: 4200, q: 3, dur: 0.006, gain: 0.35 }); this.thump(t, { f0: 260, f1: 110, dur: 0.06, gain: 0.4 }); break;
        case 'stop': this.thump(t, { f0: 150, f1: 60, dur: 0.1, gain: 0.5 }); this.burst(t, { f: 2600, q: 2, dur: 0.01, gain: 0.35 }); break;
        case 'door-open': this.burst(t, { type: 'pink', f: 700, q: 2, dur: 0.28, gain: 0.3, sweep: 260 }); this.thump(t + 0.02, { f0: 95, f1: 48, dur: 0.18, gain: 0.5 }); break;
        case 'door-close': this.thump(t, { f0: 120, f1: 50, dur: 0.14, gain: 0.6 }); this.burst(t, { f: 3000, q: 1.5, dur: 0.012, gain: 0.4 }); break;
        case 'case-open': case 'case-close': this.burst(t, { f: 1900, q: 3, dur: 0.012, gain: 0.4 }); this.thump(t, { f0: 380, f1: 220, dur: 0.035, gain: 0.25, type: 'triangle' }); break;
        case 'lift': this.burst(t, { type: 'pink', f: 1400, q: 1.2, dur: 0.22, gain: 0.14, attack: 0.04, sweep: 2200 }); break;
        case 'seat': case 'insert': this.burst(t, { f: 3200, q: 2.5, dur: 0.008, gain: 0.45 }); this.burst(t + 0.06, { f: 2600, q: 2.5, dur: 0.008, gain: 0.35 }); this.thump(t + 0.06, { f0: 210, f1: 110, dur: 0.04, gain: 0.3 }); break;
        case 'tick': this.burst(t, { f: 5200, q: 4, dur: 0.004, gain: 0.3 }); break;
        case 'switch': this.burst(t, { f: 3400, q: 2, dur: 0.006, gain: 0.5 }); this.thump(t, { f0: 240, f1: 120, dur: 0.035, gain: 0.3 }); break;
        case 'plug': this.burst(t, { f: 6000, q: 2, dur: 0.05, gain: 0.25, sweep: 3500 }); this.burst(t + 0.05, { f: 2800, q: 3, dur: 0.008, gain: 0.4 }); this.thump(t + 0.05, { f0: 300, f1: 160, dur: 0.03, gain: 0.25 }); break;
        case 'thunder': {
          const d = 0.9 + Math.random() * 1.3;
          this.burst(t + d, { type: 'brown', f: 90, q: 0.5, dur: 3.2, gain: 0.28, attack: 0.25, to: this.amb });
          this.burst(t + d + 0.15, { type: 'brown', f: 160, q: 0.6, dur: 1.6, gain: 0.15, attack: 0.05, to: this.amb });
          break;
        }
        default: break;
      }
    },
    /* looping beds: the motor while the tape runs, the whir of a fast wind */
    loop(key, on, make) {
      if (on && !this.loops[key] && this.ctx) this.loops[key] = make();
      if (!on && this.loops[key]) { const l = this.loops[key]; l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); setTimeout(() => l.src.forEach((x) => { try { x.stop(); } catch (e) { /* stopped */ } }), 500); delete this.loops[key]; }
    },
    spriteLoop(cue, gain, rise = 0.25) {
      const c = this.cues[cue], ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.sprite; src.loop = true;
      src.loopStart = c.at + this.shift; src.loopEnd = c.at + this.shift + c.dur;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, ctx.currentTime, rise);
      src.connect(g).connect(this.fx); src.start(ctx.currentTime, src.loopStart);
      return { g, src: [src] };
    },
    motor(on) {
      this.wantMotor = on;
      if (!this.ctx) { if (on) this.ensure(); if (!this.ctx) return; }
      this.loop('motor', on && prefs.sound, () => {
        if (this.cues && this.cues.motor) return this.spriteLoop('motor', 0.55, 0.3);
        const ctx = this.ctx, o = ctx.createOscillator(); o.frequency.value = 55;
        const og = ctx.createGain(); og.gain.value = 0.015;
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
        o.connect(og).connect(g).connect(this.fx); o.start();
        return { g, src: [o] };
      });
    },
    wind(on) {
      if (!this.ctx) return;
      this.loop('wind', on && prefs.sound, () => {
        if (this.cues && this.cues.wind) return this.spriteLoop('wind', 0.5, 0.06);
        const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.bufs.pink; src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.12, ctx.currentTime, 0.05);
        src.connect(bp).connect(g).connect(this.fx); src.start();
        return { g, src: [src] };
      });
    },
    /* the rain, quietly, and a few drips on the sill */
    ambience(on) {
      if (!this.ctx) return;
      this.amb.gain.setTargetAtTime(on ? (M.run === 'on' ? 0.5 : 1) : 0, this.ctx.currentTime, 0.6);
      this.loop('rain', on, () => {
        const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.bufs.pink; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
        const g = ctx.createGain(); g.gain.value = 0.035;
        src.connect(hp).connect(lp).connect(g).connect(this.amb); src.start();
        return { g, src: [src] };
      });
      clearInterval(this.dripT);
      if (on) this.dripT = setInterval(() => { if (this.ctx && prefs.sound && !document.hidden && Math.random() < 0.6) this.burst(this.ctx.currentTime, { f: 3000 + Math.random() * 3000, q: 6, dur: 0.02, gain: 0.012 + Math.random() * 0.018, to: this.amb }); }, 160);
    },
    /* the rain steps back while the music plays */
    duck(on) { if (this.ctx) this.amb.gain.setTargetAtTime(on ? 0.5 : 1, this.ctx.currentTime, 0.6); },
  };
  const music = {
    ok: () => !!(MUSIC && Sound.ctx && prefs.sound),
    prepare(t) { if (this.ok()) MUSIC.prepare(t); },
  };

  /* ------------------------------------------------ DOM build */
  const GLYPHS = {
    eject: '<path d="M6 2.2L10.6 7.2H1.4Z"/><rect x="1.4" y="8.4" width="9.2" height="1.6"/>',
    rec: '<circle cx="6" cy="6" r="3.6"/>',
    prev: '<path d="M6 2.5L1.5 6L6 9.5Z M10.5 2.5L6 6L10.5 9.5Z"/>',
    play: '<path d="M3.5 2L10.5 6L3.5 10Z"/>',
    next: '<path d="M1.5 2.5L6 6L1.5 9.5Z M6 2.5L10.5 6L6 9.5Z"/>',
    stop: '<rect x="3" y="3" width="6" height="6"/>',
    pause: '<rect x="3" y="2.2" width="2.3" height="7.6"/><rect x="6.7" y="2.2" width="2.3" height="7.6"/>',
  };
  const KEY_SET = new Set(['eject', 'rec', 'prev', 'play', 'next', 'stop', 'pause']);
  const A11Y_KEYS = [['eject', 'Eject'], ['prev', 'Rewind: previous track'], ['play', 'Play'], ['next', 'Fast forward: next track'], ['stop', 'Stop'], ['pause', 'Pause']];
  const el = {};
  const D = {};

  function build() {
    const defsHost = h('div', { class: 'defs', 'aria-hidden': 'true' });
    defsHost.innerHTML = `<svg width="0" height="0" focusable="false">${ART.defs()}</svg>`;
    document.body.prepend(defsHost);
    const scene = $('#scene');
    if (!VIEW.ok) scene.append(h('img', { class: 'static-scene', src: `${BASE}assets/og.jpg`, alt: '' }));

    /* the deck's working controls as real elements: hidden until focused, then outlined on the 3D part */
    const hw = h('div', { class: 'hw-a11y', role: 'group', 'aria-label': `${C.site.manufacturer} ${C.site.model} stereo cassette deck` });
    const rack = h('ul', { class: 'hw-rack', 'aria-label': 'Cassettes: pick one to put it in the deck' });
    for (const t of TAPES) { const li = h('li'); li.append(h('button', { type: 'button', class: 'hw-item case', 'data-tape': t.id, 'data-view': `case:${t.id}`, 'aria-label': `${t.title} cassette` })); rack.append(li); }
    const transport = h('div', { class: 'hw-keys', role: 'group', 'aria-label': 'Transport keys' });
    for (const [act, label] of A11Y_KEYS) transport.append(h('button', { type: 'button', class: `hw-item key-${act}`, 'data-act': act, 'data-view': `key:${act}`, 'aria-label': label }));
    const knobs = ['L', 'R'].map((s) => h('div', { class: 'hw-item hw-knob', role: 'slider', tabindex: '0', 'data-view': `knob:${s}`, 'aria-label': `Record level ${s === 'L' ? 'left' : 'right'}: volume`, 'aria-valuemin': '0', 'aria-valuemax': '10' }));
    const phones = h('button', { type: 'button', class: 'hw-item', role: 'switch', 'data-act': 'sound', 'data-view': 'phones', 'aria-label': 'Phones: sound' });
    const lamp = h('button', { type: 'button', class: 'hw-item', 'data-act': 'lamp', 'data-view': 'lamp', 'aria-label': 'Desk lamp', 'aria-pressed': 'true' });
    hw.append(rack, transport, ...knobs, phones, lamp);
    scene.after(hw);

    /* without WebGL: the four tapes as plain buttons */
    if (!VIEW.ok) {
      const shelf = h('ul', { class: 'flat-shelf', 'aria-label': 'Cassettes' });
      for (const t of TAPES) { const li = h('li'); li.innerHTML = `<button type="button" class="case flat-case" data-tape="${t.id}"><span>${esc(CASE_LABEL[t.id])}</span></button>`; shelf.append(li); }
      $('#stage').append(shelf);
    }

    /* on a touch screen the Play key is small: a big button stands in while a tape waits */
    const hint = h('button', { type: 'button', class: 'play-hint', 'data-act': 'play', hidden: true }, `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${GLYPHS.play}</svg><span>Play</span>`);
    document.body.append(hint);

    buildDisplay();
    Object.assign(el, { scene, knobs, hw, hint });
    buildIndex();
    wire();
  }

  /* ------------------------------------------------ text index dialog */
  function buildIndex() {
    const d = $('#index-dialog');
    let s = `<div class="index-inner"><h2 id="index-title">Index</h2><p class="index-lede">Every tape and track, as plain links. The same places the deck goes.</p>`;
    for (const t of TAPES) {
      s += `<h3><a href="${BASE}${t.id}/${chaptersOf(t.id)[0].slug}/" data-route>${esc(t.title)}</a></h3><ol>`;
      chaptersOf(t.id).forEach((c, i) => { s += `<li><a href="${BASE}${t.id}/${c.slug}/" data-route>${pad2(i + 1)} ${esc(c.title)}</a></li>`; });
      s += '</ol>';
    }
    s += `<p><a href="${BASE}text/">Read everything as plain text</a> · <a href="${BASE}${C.site.resumePdf}">Résumé (PDF)</a></p><form method="dialog"><button class="index-close" type="submit">Close index</button></form></div>`;
    d.innerHTML = s;
  }

  /* ------------------------------------------------ content blocks */
  function href(hrefRaw) {
    if (hrefRaw === '@pdf') return BASE + C.site.resumePdf;
    if (hrefRaw.startsWith('@text')) return BASE + 'text/' + hrefRaw.slice(5);
    return hrefRaw;
  }
  const extAttrs = (u) => (u.startsWith('https://') ? ' target="_blank" rel="noopener"' : '');
  function block(b) {
    switch (b.t) {
      case 'kicker': return `<p class="kicker">${esc(b.text)}</p>`;
      case 'h': return `<h3 class="headline">${esc(b.text)}</h3>`;
      case 'p': return `<p>${esc(b.text)}</p>`;
      case 'note': return `<p class="note">${esc(b.text)}</p>`;
      case 'credit': return `<p class="credit">${esc(b.text)}</p>`;
      case 'placeholder': return `<div class="placeholder"><span>Placeholder</span><p>${esc(b.text)}</p></div>`;
      case 'list': return `<ul class="list">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      case 'steps': return `<ol class="steps">${b.items.map((i) => `<li><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></li>`).join('')}</ol>`;
      case 'lies': return `<ol class="lies">${b.items.map((i) => `<li><del>${esc(i.text)}</del><span class="fix">${esc(i.fix)}</span></li>`).join('')}</ol>`;
      case 'meta': return `<dl class="meta">${b.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
      case 'diagram': return `<figure class="diagram"><ol>${b.nodes.map((n) => `<li><strong>${esc(n.label)}</strong><span>${esc(n.sub)}</span></li>`).join('')}</ol>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
      case 'plate': return `<figure class="plate">${ART.plateSVG(b.art)}</figure>`;
      case 'actions': return `<p class="actions">${b.items.map((a) => { const u = href(a.href); return `<a class="act act-${a.kind || 'secondary'}" href="${esc(u)}"${extAttrs(u)}>${esc(a.label)}${u.startsWith('https://') ? '<span aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span>' : ''}</a>`; }).join('')}</p>`;
      case 'entries': return b.items.map((i) => `<section class="entry"><h4>${esc(i.title)}</h4><p class="entry-meta">${esc(i.org)} · ${esc(i.where)} · <time>${esc(i.when)}</time></p><ul>${i.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('');
      case 'courses': return `<table class="courses"><thead><tr><th scope="col">Code</th><th scope="col">Course</th><th scope="col">Where</th></tr></thead><tbody>${b.items.map((c) => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table>`;
      case 'log': return `<ul class="log">${b.items.map((i) => `<li><a href="${BASE}${i.track}/" data-route>${esc(i.title)}</a><span>${esc(i.text)}</span></li>`).join('')}</ul>`;
      case 'email': return `<div class="email"><a class="email-addr" href="mailto:${esc(C.site.email)}">${esc(C.site.email)}</a><button type="button" class="act act-secondary" data-act="copy-email">Copy address</button><span class="copy-status" role="status"></span></div>`;
      case 'links': return `<ul class="links">${C.site.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener"><strong>${esc(l.label)}</strong><span>${esc(l.handle)}</span><span class="sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul>`;
      default: return '';
    }
  }

  /* ------------------------------------------------ the display: an amber readout that powers on over the room */
  function buildDisplay() {
    const d = $('#display');
    const seg = '<b></b>'.repeat(14);
    const key = (a, label, short) => `<button type="button" class="dsp-key key-${a}" data-act="${a}" aria-label="${esc(label)}"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${GLYPHS[a]}</svg><span aria-hidden="true">${short}</span></button>`;
    d.innerHTML = `<div class="dsp-frame">
      <header class="dsp-head">
        <p class="dsp-status"><i class="dsp-led" aria-hidden="true"></i><span class="dsp-state">Playing</span><span class="dsp-tape"></span></p>
        <p class="dsp-trk"></p>
        <p class="dsp-time" aria-hidden="true">0:00</p>
        <div class="dsp-meter" aria-hidden="true"><span>L</span><i class="dsp-bar">${seg}</i><span>R</span><i class="dsp-bar">${seg}</i></div>
        <button type="button" class="dsp-x" data-act="stop"><span aria-hidden="true">✕</span><span class="sr-only">Stop the tape and close the display</span></button>
      </header>
      <nav class="dsp-tracks" aria-label="Tracks on this tape"></nav>
      <div class="dsp-body" tabindex="-1"><div class="dsp-scroll"></div><p class="dsp-search" aria-hidden="true"></p></div>
      <footer class="dsp-foot">
        <div class="dsp-keys" role="group" aria-label="Transport">${key('prev', 'Rewind: previous track', 'Rew')}${key('next', 'Fast forward: next track', 'F.Fwd')}${key('pause', 'Pause', 'Pause')}${key('stop', 'Stop', 'Stop')}${key('eject', 'Eject the tape', 'Eject')}</div>
        <button type="button" class="dsp-sound" data-act="sound" role="switch" aria-checked="true"><i class="dsp-led" aria-hidden="true"></i>Sound</button>
      </footer>
    </div>`;
    Object.assign(D, {
      el: d, state: $('.dsp-state', d), tape: $('.dsp-tape', d), trk: $('.dsp-trk', d), time: $('.dsp-time', d), bars: $$('.dsp-bar', d).map((b) => [...b.children]),
      tracks: $('.dsp-tracks', d), body: $('.dsp-body', d), scroll: $('.dsp-scroll', d), search: $('.dsp-search', d),
    });
  }
  function fillDisplay() {
    const t = TAPE[S.deck], chs = chaptersOf(S.deck), ch = chs[S.chapter];
    D.tape.textContent = CASE_LABEL[S.deck];
    D.trk.innerHTML = `<span class="lbl">Trk</span> ${pad2(S.chapter + 1)}<span class="of">/${pad2(chs.length)}</span> <span class="ttl">${esc(ch.short || ch.title)}</span>`;
    D.tracks.hidden = chs.length < 2;
    D.tracks.innerHTML = chs.length > 1 ? chs.map((c, i) => `<a href="${BASE}${S.deck}/${c.slug}/" data-track="${i}"${i === S.chapter ? ' aria-current="page"' : ''}><span class="n">${pad2(i + 1)}</span>${esc(c.short || c.title)}</a>`).join('') : '';
    D.scroll.innerHTML = ch.pages.map((pg, i) => `<section class="dsp-page" aria-label="${esc(ch.title)}${ch.pages.length > 1 ? `, part ${i + 1}` : ''}">${pg.blocks.map(block).join('')}</section>`).join('');
    D.body.setAttribute('aria-label', `${t.title}, track ${S.chapter + 1}: ${ch.title}`);
    D.el.setAttribute('aria-label', `Now playing: ${t.title}`);
    D.body.scrollTop = 0;
    reveal();
  }
  /* the writing arrives: blocks come up line by line, headlines type on */
  function reveal() {
    if (reduced()) return;
    let n = 0;
    for (const page of $$('.dsp-page', D.scroll)) {
      for (const b of page.children) {
        if (n > 14) break;
        b.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 120 + n * 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
        n++;
      }
    }
    $$('.headline', D.scroll).slice(0, 2).forEach((hl, k) => {
      const text = hl.textContent;
      hl.setAttribute('aria-label', text);
      hl.innerHTML = `${[...text].map((ch) => `<span class="ink" aria-hidden="true">${ch === ' ' ? ' ' : esc(ch)}</span>`).join('')}${k === 0 ? '<span class="cursor" aria-hidden="true"></span>' : ''}`;
      [...hl.querySelectorAll('.ink')].forEach((s, i) => s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 40, delay: 160 + i * 18, fill: 'backwards' }));
    });
  }
  async function showDisplay(focus) {
    if (M.shown) { fillDisplay(); return; }
    M.shown = true;
    fillDisplay();
    D.el.hidden = false; D.el.classList.remove('off');
    void D.el.offsetWidth;
    D.el.classList.add('on'); html.classList.add('display-open');
    VIEW.setBackdrop(true);
    if (focus) D.body.focus({ preventScroll: true });
    await wait(reduced() ? 0 : 480);
  }
  async function hideDisplay() {
    if (!M.shown) return;
    M.shown = false;
    D.el.classList.remove('on'); D.el.classList.add('off'); html.classList.remove('display-open');
    VIEW.setBackdrop(false);
    await wait(reduced() ? 0 : 380);
    if (!M.shown) { D.el.hidden = true; D.el.classList.remove('off'); D.scroll.innerHTML = ''; }
  }

  /* ------------------------------------------------ deck visuals: pushed to the view */
  const acts = (a) => $$(`[data-act="${a}"]`);
  function syncUI() {
    const has = !!M.deck;
    const running = M.run === 'on' || M.run === 'cue' || M.run === 'wait';
    $$('.case').forEach((b) => {
      const t = b.dataset.tape;
      const inDeck = t === M.deck || t === S.deck;
      if (inDeck) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', `${TAPE[t].title} cassette${inDeck ? ' (in the deck)' : ''}`);
    });
    const set = (k, disabled, label) => acts(k).forEach((b) => { b.setAttribute('aria-disabled', disabled ? 'true' : 'false'); if (b.classList.contains('hw-item')) b.setAttribute('aria-label', label); });
    const chs = S.deck ? chaptersOf(S.deck) : [];
    set('eject', !has && !S.deck, has ? `Eject the ${TAPE[M.deck].title} tape` : 'Eject (no tape in the deck)');
    set('play', !S.deck, S.deck ? `Play ${TAPE[S.deck].title}` : 'Play (pick a tape first)');
    set('pause', M.run !== 'on' && M.run !== 'pause', 'Pause');
    set('stop', M.run === 'off', 'Stop');
    set('prev', !S.deck || S.chapter === 0, 'Rewind: previous track');
    set('next', !S.deck || S.chapter >= chs.length - 1, 'Fast forward: next track');
    acts('play').forEach((b) => b.setAttribute('aria-pressed', String(running)));
    acts('pause').forEach((b) => b.setAttribute('aria-pressed', String(M.run === 'pause')));
    VIEW.setLatched('play', running || M.run === 'pause'); VIEW.setLatched('pause', M.run === 'pause');
    const ready = has && !M.busy && M.run === 'off';
    VIEW.setPlayReady(ready);
    el.hint.hidden = !(ready && (mqCoarse.matches || !VIEW.ok));
    acts('sound').forEach((b) => b.setAttribute('aria-checked', String(prefs.sound)));
    acts('lamp').forEach((b) => b.setAttribute('aria-pressed', String(prefs.lamp)));
    VIEW.setPlug(prefs.sound); VIEW.setLamp(prefs.lamp); VIEW.setVolume(prefs.volume);
    VIEW.instant(reduced());
    html.classList.toggle('lamp-off', !prefs.lamp);
    html.classList.toggle('is-playing', M.run === 'on');
    html.classList.toggle('is-paused', M.run === 'pause');
    el.knobs.forEach((k) => {
      k.setAttribute('aria-valuenow', String(prefs.volume));
      k.setAttribute('aria-valuetext', `${prefs.volume} of 10${prefs.sound ? '' : ' (sound is off)'}`);
    });
    if (D.el && M.shown) {
      D.state.textContent = M.run === 'pause' ? 'Paused' : M.run === 'wait' ? 'Ready' : 'Playing';
      D.el.classList.toggle('paused', M.run === 'pause');
    }
    ensureLoop();
  }

  /* ------------------------------------------------ the mechanism: the tape travels to wherever S says */
  function rush() { M.rush = true; VIEW.speed(3.2); }
  const door = {
    async open() { if (M.doorOpen) return; M.doorOpen = true; Sound.play('door-open'); await VIEW.doorOpen(); },
    async close() { if (!M.doorOpen) return; M.doorOpen = false; await VIEW.doorClose(); Sound.play('door-close'); },
  };
  async function runMechanism() {
    if (M.busy) { rush(); return; }
    M.busy = true;
    syncUI();
    try {
      for (let guard = 0; guard < 10; guard++) {
        const target = S.deck;
        if (M.deck === target) break;
        if (M.deck) {
          // the tape in the deck goes home first: out of the deck, into its case, the case closed and put away
          const leaving = M.deck;
          stopTransport(true);
          await door.open();
          await VIEW.ejectUp(leaving);
          M.deck = null; syncUI();
          Sound.play('lift');
          await VIEW.toCase(leaving);
          Sound.play('seat');
          Sound.play('case-close', { at: 0.12 });
          await VIEW.lidClose(leaving);
          await VIEW.caseHome(leaving);
          continue;
        }
        // the new tape: its case comes out and opens, the cassette rises out and drops into the deck
        const t = target;
        music.prepare(t);
        Sound.play('lift', { gain: 0.6 });
        await VIEW.caseOut(t);
        Sound.play('case-open');
        await Promise.all([VIEW.lidOpen(t), door.open()]);
        if (S.deck !== t) { Sound.play('case-close'); await VIEW.lidClose(t); await VIEW.caseHome(t); continue; }
        Sound.play('lift');
        VIEW.setTheme(t);
        await VIEW.fromCase(t);
        Sound.play('insert', { at: 0.18 });
        await VIEW.lowerIn(t);
        M.deck = t; M.counter = 0;
        await door.close();
        if (S.deck === t && S.transport !== 'play') announce(`${TAPE[t].title} is in the deck. Press Play.`);
        syncUI();
      }
    } finally {
      M.busy = false; M.rush = false; VIEW.speed(1);
    }
    if (!M.deck) await door.close();
    syncUI();
    if (M.deck && M.deck === S.deck && S.transport === 'play' && M.run === 'off') cue();
  }

  /* ------------------------------------------------ the transport */
  /* Play: the key latches, the pinch roller engages, the motor comes up, then the music and the display */
  async function cue() {
    if (M.run !== 'off' || !M.deck) return;
    const gen = ++M.gen, tape = M.deck, fast = reduced();
    M.run = 'cue'; syncUI();
    if (MUSIC) MUSIC.ambient(false, 1.2);
    Sound.play('latch');
    music.prepare(tape);
    await wait(fast ? 40 : 200); if (gen !== M.gen) return;
    Sound.play('spinup'); Sound.motor(true);
    L.target.L = L.target.R = -36;
    await wait(fast ? 40 : 1250); if (gen !== M.gen) return;
    startMusic(gen, tape, fast ? 0.05 : 0.75);
    M.run = 'on'; M.since = performance.now(); M.played = 0;
    if (music.ok()) setTimeout(() => MUSIC.prepareAll(TAPES.map((x) => x.id)), 6000);
    announce(`Playing ${TAPE[tape].title}, track ${S.chapter + 1}: ${chaptersOf(tape)[S.chapter].title}.`);
    syncUI();
    await wait(fast ? 0 : 420); if (gen !== M.gen) return;
    await showDisplay(lastInput === 'key');
    syncUI();
  }
  /* the music joins as soon as its tape is rendered; never after the tape has stopped */
  function startMusic(gen, tape, spin) {
    if (!music.ok()) return;
    MUSIC.prepare(tape).then((piece) => {
      if (!piece || gen !== M.gen || M.deck !== tape || (M.run !== 'on' && M.run !== 'cue')) return;
      MUSIC.start(tape, S.chapter, { spin });
      Sound.duck(true);
    });
  }
  /* a deep link opens the display at once; the sound waits for the visitor's first touch */
  function startFromWait() {
    if (M.run !== 'wait' || !M.deck) return;
    const gen = ++M.gen;
    if (MUSIC) MUSIC.ambient(false, 1.2);
    Sound.play('latch'); Sound.motor(true);
    M.run = 'on';
    startMusic(gen, M.deck, 0.75); M.since = performance.now(); M.played = 0;
    syncUI();
  }
  /* the tape-stop: the pitch sinks, the reels coast, the display powers down */
  function stopTransport(withSound = true) {
    if (M.run === 'off') return;
    M.gen++;
    const was = M.run; M.run = 'off';
    if (withSound) Sound.play('stop');
    if (MUSIC && MUSIC.playing()) MUSIC.stop(was === 'pause' || was === 'wait' ? 0.05 : 0.75);
    Sound.motor(false); Sound.wind(false); Sound.duck(false);
    if (MUSIC) setTimeout(() => { if (M.run === 'off' && prefs.sound) MUSIC.ambient(true); }, 1500);
    hideDisplay();
    syncUI();
  }
  function elapsed() { return M.played + (M.run === 'on' ? (performance.now() - M.since) / 1000 : 0); }
  /* fast-forward or rewind to another track: the music warbles, the reels race, the display searches */
  let windKick = 0, searchGen = 0;
  async function goTrack(i, { push = true } = {}) {
    const chs = chaptersOf(S.deck);
    if (i < 0 || i >= chs.length) { announce(i < 0 ? 'Already at the first track.' : 'That was the last track on this side.'); return; }
    if (i === S.chapter) return;
    const dir = i > S.chapter ? 1 : -1;
    S.chapter = i;
    if (push) commit(true); else document.title = titleFor();
    announce(`Track ${i + 1}: ${chs[i].title}.`);
    windKick = 5 * dir; Sound.wind(true); setTimeout(() => Sound.wind(false), 620);
    if (MUSIC && MUSIC.playing() && M.run === 'on') MUSIC.search(dir, 0.75);
    syncUI();
    if (!M.shown) return;
    const g = ++searchGen;
    D.search.textContent = dir > 0 ? '▶▶  Searching' : '◀◀  Searching';
    D.body.classList.add('searching');
    await wait(reduced() ? 0 : 600);
    if (g !== searchGen) return;
    D.body.classList.remove('searching');
    fillDisplay();
  }

  /* ------------------------------------------------ actions */
  const Act = {
    selectTape(id) {
      if (S.deck === id && M.deck === id && !M.busy) { if (M.run === 'off') Act.play(); return; }
      S.deck = id; S.chapter = 0; S.transport = VIEW.ok ? 'stop' : 'play';
      commit(true);
      runMechanism();
    },
    play() {
      if (!S.deck) { announce('Pick a tape from the cases first.'); return; }
      if (M.run === 'pause') { Act.pause(); return; }
      if (M.run === 'wait') { startFromWait(); return; }
      if (M.run !== 'off') return;
      S.transport = 'play'; commit(true);
      // mid-load, the mechanism plays the tape when it lands: no need to hurry it
      if (M.busy) return;
      if (M.deck === S.deck) cue(); else runMechanism();
    },
    pause() {
      if (M.run === 'on') { M.played = elapsed(); M.run = 'pause'; if (MUSIC) MUSIC.pause(true); Sound.motor(false); announce('Paused.'); }
      else if (M.run === 'pause') { M.since = performance.now(); M.run = 'on'; if (MUSIC && MUSIC.playing()) MUSIC.pause(false); else startMusic(M.gen, M.deck, 0.3); Sound.motor(true); announce('Playing.'); }
      syncUI();
    },
    stop() {
      if (S.transport === 'stop' && M.run === 'off') return;
      S.transport = 'stop'; commit(true);
      stopTransport(true);
      announce('Stopped. The tape is still in the deck.');
      if (lastInput === 'key') { const p = $('.hw-keys .key-play'); if (p) p.focus({ preventScroll: true }); }
    },
    eject() {
      if (!S.deck && !M.deck) { announce('No tape in the deck.'); return; }
      S.deck = null; S.transport = 'stop'; commit(true);
      runMechanism();
    },
    step(dir) {
      if (!S.deck) return;
      if (M.run !== 'off') { goTrack(S.chapter + dir); return; }
      // stopped: the reels just wind for a moment, for the feel of it
      windKick = 4 * dir; Sound.wind(true); setTimeout(() => Sound.wind(false), 420); ensureLoop();
    },
    track(i) {
      if (!S.deck) return;
      if (M.run !== 'off') { goTrack(i); return; }
      S.chapter = i; Act.play();
    },
    reset() { M.counter = 0; Sound.play('tick'); syncUI(); },
    knob() { Sound.play('tick'); Sound.play('tick', { at: 0.05, gain: 0.6 }); },
    sound() {
      Sound.play('plug');
      prefs.sound = !prefs.sound; store.set('sound3', prefs.sound);
      if (prefs.sound) {
        Sound.ensure(); Sound.setVolume(); Sound.ambience(true); Sound.play('plug');
        if (M.run === 'on' && MUSIC && !MUSIC.playing()) { startMusic(M.gen, M.deck, 0.4); Sound.motor(true); }
      } else setTimeout(() => Sound.setVolume(), 120);
      announce(prefs.sound ? 'Sound on.' : 'Sound off.'); syncUI();
    },
    lamp() { prefs.lamp = !prefs.lamp; Sound.play('switch'); announce(prefs.lamp ? 'Lamp on.' : 'Lamp off.'); syncUI(); },
    volume(v) {
      const nv = Math.max(0, Math.min(10, v)); if (nv !== prefs.volume) Sound.play('tick');
      prefs.volume = nv; store.set('volume', prefs.volume); Sound.setVolume(); syncUI();
    },
    async copyEmail(btn) {
      const status = btn.parentElement.querySelector('.copy-status');
      let ok = false;
      try { await navigator.clipboard.writeText(C.site.email); ok = true; } catch (e) {
        const ta = h('textarea', { 'aria-hidden': 'true' }); ta.value = C.site.email; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove();
      }
      status.textContent = ok ? 'Copied.' : `Copy failed. The address is ${C.site.email}`;
    },
  };

  function applyRoute(r, { fromPop = false } = {}) {
    const sameTape = r.tape === S.deck && M.deck === r.tape;
    if (sameTape && r.open && M.run !== 'off' && r.chapter !== S.chapter) {
      S.transport = 'play';
      goTrack(r.chapter, { push: !fromPop });
      return;
    }
    S.deck = r.tape; S.chapter = r.chapter;
    S.transport = r.open && r.tape ? 'play' : 'stop';
    if (!fromPop) commit(true); else document.title = titleFor();
    syncUI();
    if (M.deck !== S.deck || M.busy) { runMechanism(); return; }
    if (S.transport === 'stop') stopTransport(true);
    else if (M.run === 'off') cue();
    else if (M.shown) fillDisplay();
  }

  /* ------------------------------------------------ wiring */
  function dispatch(a, b) {
    if (KEY_SET.has(a)) {
      VIEW.press(a);
      Sound.play('key-down');
      if (a !== 'play' && a !== 'pause') setTimeout(() => Sound.play('key-up'), 120);
    }
    if (a === 'reset') VIEW.press('reset');
    void b;
    ({
      play: Act.play, pause: Act.pause, stop: Act.stop, eject: Act.eject, rec: () => {}, reset: Act.reset, knob: Act.knob,
      prev: () => Act.step(-1), next: () => Act.step(1), sound: Act.sound, lamp: Act.lamp,
      'copy-email': () => b && Act.copyEmail(b),
    }[a] || (() => {}))();
  }
  function wire() {
    /* browsers only allow audio after a gesture: never try before one */
    const unlock = () => {
      Sound.unlocked = true; Sound.ensure(); ensureLoop();
      setTimeout(() => { if (M.run === 'wait' && S.transport === 'play') startFromWait(); }, 150);
    };
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', (ev) => { if (!['Tab', 'Shift', 'Alt', 'Meta', 'Control'].includes(ev.key)) unlock(); }, { once: true, capture: true });
    document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
    document.addEventListener('keydown', () => { lastInput = 'key'; }, true);
    document.addEventListener('click', (ev) => {
      const route = ev.target.closest('a[data-route], a[data-track]');
      if (route && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.button === 0) {
        ev.preventDefault();
        const dlg = $('#index-dialog'); if (dlg.open) dlg.close();
        if (route.dataset.track) { Sound.play('key-down'); Act.track(Number(route.dataset.track)); return; }
        applyRoute(parseLocation(new URL(route.href, location.href)));
        return;
      }
      const c = ev.target.closest('.case');
      if (c) { Act.selectTape(c.dataset.tape); return; }
      const b = ev.target.closest('[data-act]');
      if (b) dispatch(b.dataset.act, b);
    });
    /* the 3D deck reports what was pressed */
    Object.assign(VIEW.on, {
      act: (a) => dispatch(a, null),
      tape: (id) => Act.selectTape(id),
      volume: (v) => Act.volume(v),
      flash: () => Sound.play('thunder'),
    });
    for (const k of el.knobs) {
      k.addEventListener('keydown', (ev) => {
        const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 };
        if (ev.key in map) { ev.preventDefault(); Act.volume(prefs.volume + map[ev.key]); }
        if (ev.key === 'Home') { ev.preventDefault(); Act.volume(0); }
        if (ev.key === 'End') { ev.preventDefault(); Act.volume(10); }
      });
    }

    /* keyboard focus on a deck control: outline the real 3D part it stands for */
    let focusRaf = 0;
    const follow = () => {
      const ae = document.activeElement;
      const f = ae && ae.closest && ae.closest('.hw-a11y [data-view]');
      $$('.hw-a11y .is-focused').forEach((n) => { if (n !== f) n.classList.remove('is-focused'); });
      if (!f || !VIEW.ok || !ae.matches(':focus-visible')) { VIEW.setFocus(null); focusRaf = 0; return; }
      const r = VIEW.screenRect(f.dataset.view);
      if (r) { f.classList.add('is-focused'); Object.assign(f.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` }); }
      VIEW.setFocus(f.dataset.view);
      focusRaf = requestAnimationFrame(follow);
    };
    document.addEventListener('focusin', () => { if (!focusRaf) focusRaf = requestAnimationFrame(follow); });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && M.shown && !$('#index-dialog').open) { ev.preventDefault(); dispatch('stop', null); return; }
      if (M.shown && D.el.contains(document.activeElement) && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        if (ev.key === 'ArrowRight') { ev.preventDefault(); dispatch('next', null); }
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); dispatch('prev', null); }
      }
    });
    /* swipe across the display to change track on touch */
    let sx = null;
    D.el.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') sx = { x: ev.clientX, y: ev.clientY }; });
    D.el.addEventListener('pointerup', (ev) => {
      if (!sx) return; const dx = ev.clientX - sx.x, dy = ev.clientY - sx.y; sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) dispatch(dx < 0 ? 'next' : 'prev', null);
    });

    $('#index-open').addEventListener('click', () => { $('#index-dialog').showModal(); });
    window.addEventListener('popstate', () => applyRoute(parseLocation(), { fromPop: true }));
    mqReduce.addEventListener('change', syncUI);
    mqCoarse.addEventListener('change', syncUI);
    document.addEventListener('visibilitychange', () => {
      if (!Sound.ctx) return;
      if (document.hidden) Sound.ctx.suspend(); else Sound.ctx.resume();
      ensureLoop();
    });
  }

  /* ------------------------------------------------ reels, needles, counter and the display's meters */
  const L = { raf: 0, last: 0, speed: 0, aL: 0, aR: 0, needle: { L: -50, R: -50 }, target: { L: -50, R: -50 }, nextJitter: 0, lv: [0, 0], sec: -1, barsAt: 0 };
  const CHS = [[0, 'L'], [1, 'R']];
  function wantsMotion() {
    if (document.hidden) return false;
    return M.run !== 'off' || M.shown || Math.abs(L.speed) > 0.01 || Math.abs(windKick) > 0.01 || Math.abs(L.needle.L - L.target.L) > 0.3 || Math.abs(L.needle.R - L.target.R) > 0.3;
  }
  function ensureLoop() {
    if (!L.raf && wantsMotion()) { L.last = performance.now(); L.raf = requestAnimationFrame(tick); }
    if (!L.raf) staticPose();
  }
  function staticPose() {
    for (const ch of ['L', 'R']) VIEW.setNeedle(ch, L.needle[ch]);
    setPacks(0);
    VIEW.setCounter(String(Math.floor(M.counter) % 1000).padStart(3, '0'));
  }
  function setPacks(extra) {
    if (!S.deck) return;
    const n = chaptersOf(S.deck).length;
    VIEW.setPacks(Math.min(0.98, (S.chapter + 0.35 + extra) / (n + 0.4)));
  }
  const dbOf = (rms) => 20 * Math.log10(rms + 1e-5);
  function tick(t) {
    const dt = Math.min(0.05, (t - L.last) / 1000); L.last = t;
    const running = M.run === 'on', spinning = running || M.run === 'cue';
    L.speed += ((spinning ? 1 : 0) - L.speed) * Math.min(1, dt * (M.run === 'cue' ? 1.6 : M.run === 'pause' ? 30 : 4));
    windKick *= Math.pow(0.14, dt);
    if (Math.abs(windKick) < 0.01) windKick = 0;
    const v = (M.run === 'pause' ? 0 : L.speed) + windKick;
    L.aL += v * 150 * dt; L.aR += v * 115 * dt;
    VIEW.setHubs(L.aL % 360, L.aR % 360);
    M.counter = (M.counter + v * 1.4 * dt + 1000) % 1000;
    VIEW.setCounter(String(Math.floor(M.counter)).padStart(3, '0'));
    // the meters read the music when there is music; otherwise they dance on their own
    const levels = running && MUSIC && MUSIC.playing() ? MUSIC.levels() : null;
    if (levels) {
      for (const [i, ch] of CHS) L.target[ch] = Math.max(-50, Math.min(28, -50 + (dbOf(levels[i]) + 34) * 2.7));
    } else if (running) {
      if (t > L.nextJitter) {
        L.nextJitter = t + 70 + Math.random() * 120;
        const base = -20 + Math.random() * 14 + Math.sin(t / 240) * 6 + Math.sin(t / 97) * 4 + (Math.random() < 0.07 ? 18 : 0);
        L.target.L = Math.min(26, base + (Math.random() - 0.5) * 7); L.target.R = Math.min(26, base + (Math.random() - 0.5) * 7);
      }
    } else if (M.run === 'pause') { L.target.L = L.needle.L; L.target.R = L.needle.R; }
    else if (M.run !== 'cue') { L.target.L = L.target.R = -50; }
    for (const [, ch] of CHS) {
      const up = L.target[ch] > L.needle[ch];
      L.needle[ch] += (L.target[ch] - L.needle[ch]) * Math.min(1, dt * (running ? (up ? 16 : 6) : 4));
      VIEW.setNeedle(ch, L.needle[ch]);
    }
    setPacks(running ? Math.min(0.6, elapsed() / 300) : 0);
    // the display's own clock and level bars
    if (M.shown) {
      const s = Math.floor(elapsed());
      if (s !== L.sec) { L.sec = s; D.time.textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`; }
    }
    if (M.shown && t - L.barsAt > 50) {
      L.barsAt = t;
      for (const [i, ch] of CHS) {
        const k = Math.max(0, Math.min(1, (L.needle[ch] + 50) / 78));
        const lit = Math.round(k * 14);
        if (L.lv[i] !== lit) { L.lv[i] = lit; D.bars[i].forEach((b, j) => b.classList.toggle('on', j < lit)); }
      }
    }
    if (wantsMotion()) L.raf = requestAnimationFrame(tick); else { L.raf = 0; staticPose(); }
  }

  /* ------------------------------------------------ start */
  function start() {
    const nav = navigator;
    const lite = (nav.connection && nav.connection.saveData) || (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2);
    if (lite) html.classList.add('lite');
    build();
    const r = parseLocation();
    if (r.tape) { S.deck = r.tape; S.chapter = r.chapter; S.transport = r.open ? 'play' : 'stop'; M.deck = r.tape; }
    VIEW.setInitial(M.deck);
    if (M.deck) VIEW.setTheme(M.deck, true);
    commit(false);
    if (r.notFound) announce('That address is not on any tape. Here is the station instead.');
    VIEW.instant(true); syncUI(); VIEW.instant(reduced());
    Promise.resolve(VIEW.ready).then(() => {
      if (lite) VIEW.setQuality(true);
      html.classList.add('ready');
      if (S.transport === 'play' && M.deck) { M.run = 'wait'; showDisplay(false); }
      syncUI();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
