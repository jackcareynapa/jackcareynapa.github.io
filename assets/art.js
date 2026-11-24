/* Listening Station: illustrated layers.
   Original, hand-built SVG. Interactive controls are HTML (see app.js); this
   file only draws artwork, with ids and classes that app.js animates. */
(function () {
  'use strict';

  const F = {
    wm: "'Michroma', sans-serif",
    lab: "'Barlow Condensed', sans-serif",
    semi: "'Barlow Semi Condensed', sans-serif",
    serif: "'Fraunces', serif",
    mono: "'IBM Plex Mono', monospace",
  };
  let _u = 0;
  const uid = (p) => `${p}${++_u}`;
  const r1 = (n) => Math.round(n * 10) / 10;
  const rad = (d) => (d * Math.PI) / 180;

  /* Geometry shared with app.js (stage units, 1600 x 1000 visible, scene 1600 x 1330). */
  const GEO = {
    stage: { w: 1600, h: 1000, scene: 1330, readShift: 330 },
    deck: { x: 300, y: 386, s: 1, w: 1000, h: 330, ear: 46 },
    rack: { x: 1378, base: 698, cw: 190, step: 58 },
    table: 716,
  };
  GEO.rack.ch = (GEO.rack.cw * 140) / 220;

  function txt(t, x, y, o = {}) {
    const { size = 8, font = F.lab, ls = 0, anchor = 'start', fill = '#222', weight = 400, style = '', extra = '' } = o;
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" letter-spacing="${ls}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${style ? ` font-style="${style}"` : ''} ${extra}>${t}</text>`;
  }
  function engr(t, x, y, o = {}) {
    const { hi = 'rgba(255,255,255,0)', fill = '#1a110a', size = 8 } = o;
    return txt(t, x, r1(y + size * 0.08 + 0.4), { ...o, fill: hi }) + txt(t, x, y, { ...o, fill });
  }

  /* ------------------------------------------------------------ defs */
  function defs() {
    return `<defs>
    <linearGradient id="alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbf9"/><stop offset=".05" stop-color="#e9e8e4"/><stop offset=".5" stop-color="#d4d3cd"/><stop offset=".93" stop-color="#b9b8b0"/><stop offset=".97" stop-color="#8c8b84"/><stop offset="1" stop-color="#4a4945"/></linearGradient>
    <linearGradient id="aluSheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff6df" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="aluDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b8b1"/><stop offset="1" stop-color="#8f8e88"/></linearGradient>
    <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f3ef"/><stop offset=".5" stop-color="#d9d8d2"/><stop offset="1" stop-color="#b3b2ab"/></linearGradient>
    <linearGradient id="smoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14100d" stop-opacity=".62"/><stop offset=".55" stop-color="#1c1612" stop-opacity=".42"/><stop offset="1" stop-color="#0d0b09" stop-opacity=".7"/></linearGradient>
    <radialGradient id="meterIvory" cx=".5" cy="1" r="1"><stop offset="0" stop-color="#fffbea"/><stop offset=".6" stop-color="#fbeac0"/><stop offset="1" stop-color="#efd394"/></radialGradient>
    <radialGradient id="knobCap" cx=".42" cy=".35" r=".75"><stop offset="0" stop-color="#fbfbf8"/><stop offset=".5" stop-color="#cfcec8"/><stop offset="1" stop-color="#8e8d87"/></radialGradient>
    <radialGradient id="amberLamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6dc"/><stop offset=".45" stop-color="#ffbf5a"/><stop offset="1" stop-color="#b36a12" stop-opacity="0"/></radialGradient>
    <linearGradient id="walnutTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f321e"/><stop offset=".35" stop-color="#6e482d"/><stop offset="1" stop-color="#5a3a24"/></linearGradient>
    <linearGradient id="walnutShelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5033"/><stop offset="1" stop-color="#4b2f1c"/></linearGradient>
    <linearGradient id="walnutV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f2817"/><stop offset=".5" stop-color="#5e3d25"/><stop offset="1" stop-color="#3a2415"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d79a"/><stop offset=".5" stop-color="#c49a4c"/><stop offset="1" stop-color="#8a6527"/></linearGradient>
    <linearGradient id="wallIvory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6dbc5"/><stop offset="1" stop-color="#d4c5a8"/></linearGradient>
    <linearGradient id="skyWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ead8ae"/><stop offset=".55" stop-color="#f4dfae"/><stop offset="1" stop-color="#f7e6bf"/></linearGradient>
    <radialGradient id="glowWarm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a6" stop-opacity=".55"/><stop offset="1" stop-color="#ffe2a6" stop-opacity="0"/></radialGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f05" stop-opacity=".18"/><stop offset=".3" stop-color="#1a0f05" stop-opacity="0"/><stop offset=".8" stop-color="#1a0f05" stop-opacity="0"/><stop offset="1" stop-color="#1a0f05" stop-opacity=".28"/></linearGradient>
    <filter id="brushL" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0018 0.8" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.62"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="brushD" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.55" numOctaves="2" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.19  1.6 0 0 0 -0.78"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="grainH" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0035 0.07" numOctaves="4" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  1.9 0 0 0 -0.72"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="grainV" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.07 0.004" numOctaves="4" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  1.9 0 0 0 -0.72"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="plaster" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.022" numOctaves="4" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0 0.14  0.32 0 0 0 -0.11"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 -1 0.32"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="b2"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="b4"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="b8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="b16" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
    <pattern id="graph" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0V8H0" fill="none" stroke="#4f7f78" stroke-width=".4" opacity=".55"/></pattern>
    <pattern id="graphFine" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0V6H0" fill="none" stroke="#7aa3a0" stroke-width=".35"/></pattern>
    <pattern id="airmail" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="16" fill="#a9412a"/><rect x="8" width="4" height="16" fill="#3f6f73"/></pattern>
    ${labelSymbols()}${caseSymbols()}
  </defs>`;
  }

  /* ------------------------------------------------------- meters */
  function vu(x, y, w, h, ch) {
    const id = uid('vu');
    const ink = '#1a110a', red = '#b8401e', bezel = '#1a110a';
    const fx = x + 6, fy = y + 6, fw = w - 12, fh = h - 12;
    const P = { x: x + w / 2, y: fy + fh + fh * 0.2 };
    const R = fh * 0.86;
    const pt = (a, rr = R) => [r1(P.x + rr * Math.sin(rad(a))), r1(P.y - rr * Math.cos(rad(a)))];
    const arc = (a0, a1, rr = R) => { const [x0, y0] = pt(a0, rr); const [x1, y1] = pt(a1, rr); return `M${x0} ${y0}A${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
    const marks = [[-20, -46], [-10, -31], [-7, -22], [-5, -13], [-3, -4], [-2, 2], [-1, 8], [0, 17], [1, 25], [2, 33], [3, 44]];
    const fs = fh * 0.1;
    let s = `<clipPath id="${id}"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="2"/></clipPath>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${bezel}"/>`;
    s += `<g clip-path="url(#${id})"><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" class="t-meter"/><rect class="t-meter-hi" x="${fx}" y="${fy}" width="${fw}" height="${fh * 0.3}"/>`;
    s += `<rect class="meter-dim" x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#2a2116"/>`;
    s += `<path d="${arc(-50, 17)}" fill="none" stroke="${ink}" stroke-width="${fh * 0.012 + 0.5}"/><path d="${arc(17, 50)}" fill="none" stroke="${red}" stroke-width="${fh * 0.05}"/>`;
    s += `<path d="${arc(-50, 50, R - fh * 0.11)}" fill="none" stroke="${ink}" stroke-width=".5" opacity=".7"/>`;
    for (let a = -50; a <= 50; a += 5) { const [a0, b0] = pt(a, R - fh * 0.11); const [a1, b1] = pt(a, R - fh * 0.08); s += `<path d="M${a0} ${b0}L${a1} ${b1}" stroke="${ink}" stroke-width=".5" opacity=".7"/>`; }
    for (const [db, a] of marks) {
      const [a0, b0] = pt(a, R); const [a1, b1] = pt(a, R + fh * ([-20, -10, -5, -3, 0, 3].includes(db) ? 0.07 : 0.045));
      s += `<path d="M${a0} ${b0}L${a1} ${b1}" stroke="${db > 0 ? red : ink}" stroke-width="${fh * 0.012 + 0.4}"/>`;
      if ([-20, -10, -7, -5, -3, 0, 3].includes(db)) { const [lx, ly] = pt(a, R + fh * 0.14); s += txt(db > 0 ? `+${db}` : `${db}`, lx, r1(ly + fs * 0.35), { size: fs, anchor: 'middle', fill: db > 0 ? red : ink, font: F.semi, weight: 500 }); }
    }
    s += txt('VU', P.x, fy + fh * 0.66, { size: fh * 0.17, anchor: 'middle', fill: ink, font: F.semi, weight: 600, ls: 1 });
    s += txt(ch, fx + fw * 0.08, fy + fh * 0.9, { size: fs * 1.1, fill: ink, font: F.semi, weight: 600 });
    s += `<g class="needle" id="needle-${ch}" data-px="${P.x}" data-py="${r1(P.y)}" transform="rotate(-50 ${P.x} ${r1(P.y)})"><line x1="${P.x}" y1="${r1(P.y)}" x2="${P.x}" y2="${r1(P.y - R - fh * 0.05)}" stroke="#151515" stroke-width="${fh * 0.012 + 0.6}" stroke-linecap="round"/></g>`;
    s += `<rect x="${fx}" y="${fy + fh * 0.8}" width="${fw}" height="${fh * 0.2 + 2}" fill="${bezel}"/>`;
    s += `<rect class="meter-glow t-glow" x="${fx}" y="${fy + fh * 0.8 - 3}" width="${fw}" height="3"/>`;
    s += `<path d="M${fx} ${fy}H${fx + fw * 0.55}L${fx + fw * 0.25} ${fy + fh * 0.8}H${fx}Z" fill="#fff" opacity=".07"/></g>`;
    return s;
  }

  function screw(x, y, r = 3.2) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#efece3" stroke="#1a110a" stroke-width="1"/><path d="M${x - r * 0.6} ${y}H${x + r * 0.6}" stroke="#5b5a55" stroke-width=".9" transform="rotate(${(x * 7 + y * 3) % 180} ${x} ${y})"/>`;
  }

  /* ----------------------------------------------------- cassette */
  const TAPES = {
    about: { shell: '#efe7d5', stroke: '#b9ae97', bottom: '#e4dac4', screw: '#a49a86' },
    projects: { shell: '#1f1e1d', stroke: '#000', bottom: '#2a2927', screw: '#77736b' },
    resume: { shell: 'rgba(58,52,46,.78)', stroke: '#2a2622', bottom: 'rgba(40,36,32,.85)', screw: '#8d8579' },
    contact: { shell: '#6f948d', stroke: '#4a6c66', bottom: '#668a83', screw: '#c8d6d0' },
  };
  function hub(cx, cy, cls) {
    let teeth = '';
    for (let i = 0; i < 6; i++) teeth += `<rect x="${cx - 0.7}" y="${cy - 2.6}" width="1.4" height="1.4" fill="#2a2a2a" transform="rotate(${i * 60} ${cx} ${cy})"/>`;
    return `<g class="${cls}" data-cx="${cx}" data-cy="${cy}"><circle cx="${cx}" cy="${cy}" r="5" fill="#f4f1ea" stroke="#9b968c" stroke-width=".3"/><circle cx="${cx}" cy="${cy}" r="2.9" fill="#2a2a2a"/>${teeth}
      <path d="M${cx} ${cy - 5}V${cy - 3.2}M${cx + 4.3} ${cy + 2.5}L${cx + 2.8} ${cy + 1.6}M${cx - 4.3} ${cy + 2.5}L${cx - 2.8} ${cy + 1.6}" stroke="#9b968c" stroke-width=".5"/></g>`;
  }
  /* A cassette in its own 100 x 63.6 space. */
  function cassette(tape) {
    const T = TAPES[tape];
    const id = uid('cw');
    let s = `<clipPath id="${id}"><rect x="21" y="16.5" width="58" height="17" rx="8.5"/></clipPath>`;
    s += `<rect x="0" y="0" width="100" height="63.6" rx="2.6" fill="${T.shell}" stroke="${T.stroke}" stroke-width=".5"/>`;
    s += `<use href="#label-${tape}" x="5" y="4" width="90" height="38"/>`;
    s += `<rect x="21" y="16.5" width="58" height="17" rx="8.5" fill="#2a211b"/>`;
    s += `<g clip-path="url(#${id})"><circle class="pack-l" cx="29" cy="25" r="16" fill="#4b3121"/><circle class="pack-r" cx="71" cy="25" r="9.5" fill="#4b3121"/>
          ${hub(29, 25, 'hub hub-l')}${hub(71, 25, 'hub hub-r')}<rect x="21" y="16.5" width="58" height="17" fill="#fff" opacity=".06"/></g>`;
    s += `<rect x="21" y="16.5" width="58" height="17" rx="8.5" fill="none" stroke="rgba(0,0,0,.45)" stroke-width=".6"/>`;
    s += `<path d="M17 63.6L21.5 47H78.5L83 63.6Z" fill="${T.bottom}" stroke="${T.stroke}" stroke-width=".4"/>`;
    s += `<circle cx="27" cy="56" r="1.8" fill="#1b1b1b"/><circle cx="73" cy="56" r="1.8" fill="#1b1b1b"/><rect x="46.5" y="55" width="7" height="4.5" fill="#1b1b1b"/>`;
    for (const [sx, sy] of [[3.4, 3.4], [96.6, 3.4], [3.4, 60.2], [96.6, 60.2], [50, 51]]) s += `<circle cx="${sx}" cy="${sy}" r="1.1" fill="${T.screw}"/>`;
    s += `<path d="M2 2H98" stroke="#fff" stroke-width=".5" opacity=".35"/>`;
    return s;
  }
  function cassetteSVG(tape, cls = '') {
    return `<svg class="${cls}" viewBox="-1 -1 102 65.6" aria-hidden="true" focusable="false">${cassette(tape)}</svg>`;
  }

  function labelSymbols() {
    const lab = (id, body) => `<symbol id="label-${id}" viewBox="0 0 90 38">${body}</symbol>`;
    return [
      lab('about', `<rect width="90" height="38" fill="#f6efdf"/><rect width="90" height="4" fill="#d4893a"/><rect y="4" width="90" height="2" fill="#b5532f"/><rect y="34" width="90" height="4" fill="#5e8a83"/>
        ${txt('ABOUT ME', 4, 11.5, { size: 4.6, font: F.serif, weight: 600, fill: '#2a2522' })}${txt('A', 86, 11.5, { size: 5, anchor: 'end', font: F.semi, weight: 600, fill: '#b5532f' })}${txt('LINER NOTES · JC-01', 4, 32.6, { size: 2.6, ls: 0.4, fill: '#5a4a3a' })}`),
      lab('projects', `<rect width="90" height="38" fill="#c9a878"/><rect width="90" height="38" fill="url(#graph)" opacity=".6"/>
        ${txt('PROJECTS', 4, 11.5, { size: 4.4, font: F.mono, weight: 600, fill: '#231d16' })}${txt('A', 86, 11.5, { size: 5, anchor: 'end', font: F.mono, weight: 600, fill: '#9b3b2a' })}<rect x="58" y="34.2" width="28" height="3" fill="none" stroke="#9b3b2a" stroke-width=".5"/>${txt('PLAYTEST', 72, 36.6, { size: 2.2, anchor: 'middle', font: F.mono, fill: '#9b3b2a' })}`),
      lab('resume', `<rect width="90" height="38" fill="#f3f1ea"/><rect width="90" height="6" fill="#1f1f1f"/>${txt('SERVICE MANUAL', 4, 4.4, { size: 2.9, ls: 0.8, fill: '#f3f1ea', weight: 600 })}<path d="M78 0H90V12Z" fill="#b23a28"/>
        ${txt('RÉSUMÉ / EXPERIENCE', 4, 12, { size: 3.1, font: F.semi, weight: 600, fill: '#1f1f1f' })}${txt('MODEL JC-04 · SIDE A', 4, 36.4, { size: 2.4, ls: 0.5, fill: '#444' })}`),
      lab('contact', `<rect width="90" height="38" fill="#f4ecdc"/><rect width="90" height="3" fill="url(#airmail)"/><rect y="35" width="90" height="3" fill="url(#airmail)"/>
        ${txt('Contact', 4, 12.5, { size: 5.2, font: F.serif, style: 'italic', weight: 500, fill: '#2b3a3a' })}${txt('A', 86, 12, { size: 5, anchor: 'end', font: F.semi, weight: 600, fill: '#a9412a' })}`),
    ].join('');
  }

  /* -------------------------------------------- J-card art and cases */
  function artAbout() {
    return `<rect width="206" height="130" fill="#efe6d2"/>
      <circle cx="146" cy="64" r="40" fill="#d4893a"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="0" y="${76 + i * 8.4}" width="206" height="5" fill="${['#b5532f', '#e0a542', '#5e8a83', '#2f4a52', '#b5532f', '#e0a542'][i]}"/>`).join('')}
      ${txt('About Me', 12, 34, { size: 24, font: F.serif, weight: 600, fill: '#2a2522', ls: -0.4 })}${txt('LINER NOTES · SIDE A', 13, 48, { size: 7, ls: 2.2, fill: '#6a5643', weight: 500 })}${txt('JC—01', 194, 16, { size: 7, anchor: 'end', ls: 1.5, fill: '#6a5643' })}`;
  }
  function artProjects() {
    const n = [[38, 58], [86, 36], [128, 74], [172, 46]];
    return `<rect width="206" height="130" fill="#c8a675"/><rect x="0" y="22" width="206" height="78" fill="url(#graph)"/>
      <path d="M${n.map((p) => p.join(' ')).join(' L')}" fill="none" stroke="#2f6b64" stroke-width="2.2" stroke-linejoin="round"/>
      ${n.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="#f2ead7" stroke="#1d3d39" stroke-width="1.3"/>${txt(`0${i + 1}`, p[0], p[1] + 2.7, { size: 7, anchor: 'middle', font: F.mono, weight: 600, fill: '#1d3d39' })}`).join('')}
      <g transform="translate(118 18) rotate(-7)" opacity=".88"><rect width="80" height="17" rx="2" fill="none" stroke="#9b3b2a" stroke-width="1.6"/>${txt('PLAYTEST DOSSIER', 40, 11.6, { size: 7.4, anchor: 'middle', font: F.mono, weight: 600, fill: '#9b3b2a', ls: 0.4 })}</g>
      ${txt('PROJECTS', 12, 118, { size: 17, font: F.mono, weight: 600, fill: '#211b14', ls: 1 })}${txt('4 TRACKS · SIDE A', 194, 117, { size: 6.4, anchor: 'end', font: F.mono, fill: '#3b3024' })}${txt('FILE Nº JC-02', 12, 14, { size: 6.4, font: F.mono, fill: '#3b3024' })}`;
  }
  function artResume() {
    return `<rect width="206" height="130" fill="#f3f1ea"/><rect width="206" height="20" fill="#1e1e1e"/>${txt('SERVICE MANUAL', 10, 14, { size: 9, weight: 600, ls: 3, fill: '#f3f1ea' })}<path d="M168 0H206V38Z" fill="#b23a28"/>
      <g fill="none" stroke="#222" stroke-width=".7"><rect x="62" y="34" width="82" height="52" rx="3"/><rect x="80" y="48" width="46" height="14" rx="7"/><circle cx="87" cy="55" r="4.5"/><circle cx="119" cy="55" r="4.5"/><path d="M76 86L80 74H126L130 86"/><rect x="72" y="28" width="82" height="52" rx="3" stroke-dasharray="2 2" opacity=".5"/><path d="M144 42L166 34M144 60L170 64M62 46L40 38M62 74L36 80" stroke-width=".5"/></g>
      ${[[170, 34, 1], [174, 65, 2], [36, 38, 3], [32, 81, 4]].map(([cx, cy, k]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="#f3f1ea" stroke="#222" stroke-width=".6"/>${txt(k, cx, cy + 2.4, { size: 6.5, anchor: 'middle', font: F.semi, weight: 600 })}`).join('')}
      ${txt('RÉSUMÉ / EXPERIENCE', 10, 108, { size: 13, font: F.semi, weight: 600, fill: '#1e1e1e', ls: 0.5 })}<path d="M10 114H196" stroke="#1e1e1e" stroke-width=".6"/>${txt('MODEL JC-04 · OPERATING &amp; SERVICE DATA', 10, 123, { size: 6, ls: 1, fill: '#444' })}`;
  }
  function artContact() {
    let perf = '';
    for (let i = 0; i <= 10; i++) perf += `<circle cx="${150 + i * 4.4}" cy="14" r="1.3" fill="#f4ecdc"/><circle cx="${150 + i * 4.4}" cy="70" r="1.3" fill="#f4ecdc"/>`;
    for (let i = 0; i <= 12; i++) perf += `<circle cx="150" cy="${14 + i * 4.67}" r="1.3" fill="#f4ecdc"/><circle cx="194" cy="${14 + i * 4.67}" r="1.3" fill="#f4ecdc"/>`;
    return `<rect width="206" height="130" fill="url(#airmail)"/><rect x="7" y="7" width="192" height="116" fill="#f4ecdc"/>
      <rect x="150" y="14" width="44" height="56" fill="#3f6f73"/><rect x="154" y="18" width="36" height="34" fill="#e9c98c"/><circle cx="172" cy="44" r="10" fill="#d4893a"/><rect x="154" y="44" width="36" height="8" fill="#5e8a83"/>
      ${txt('JC', 157, 63, { size: 9, font: F.serif, weight: 600, fill: '#f4ecdc' })}${txt('04', 189, 63, { size: 8, anchor: 'end', font: F.semi, weight: 600, fill: '#f4ecdc' })}${perf}
      <g fill="none" stroke="#2b3a3a" stroke-width=".8" opacity=".55"><circle cx="128" cy="40" r="15"/><circle cx="128" cy="40" r="11.5"/><path d="M146 30q8 -4 16 0t16 0t16 0M146 38q8 -4 16 0t16 0t16 0M146 46q8 -4 16 0t16 0t16 0"/></g>
      ${txt('POST', 128, 38.5, { size: 4.6, anchor: 'middle', ls: 1, fill: '#2b3a3a' })}${txt('CARD', 128, 45, { size: 4.6, anchor: 'middle', ls: 1, fill: '#2b3a3a' })}
      ${txt('Contact', 18, 44, { size: 24, font: F.serif, style: 'italic', weight: 500, fill: '#26393a' })}${txt('POSTCARD ENCLOSED · SIDE A', 19, 58, { size: 6.4, ls: 1.8, fill: '#a9412a' })}
      <g stroke="#8a8172" stroke-width=".6">${[84, 98, 112].map((y) => `<path d="M19 ${y}H130"/>`).join('')}</g>${txt('JC—04', 190, 116, { size: 6.4, anchor: 'end', ls: 1.4, fill: '#6a5643' })}`;
  }
  function caseShell(id) {
    return `<rect width="220" height="140" rx="4" fill="#d9dedd" opacity=".25"/><use href="#jcard-${id}" x="7" y="5" width="206" height="130"/>
      <rect width="220" height="140" rx="4" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.2"/><rect x="1.5" y="1.5" width="217" height="137" rx="3" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
      <path d="M0 6H7V134H0" fill="rgba(255,255,255,.22)"/><path d="M30 0L120 0L40 140H0Z" fill="#fff" opacity=".07"/><path d="M150 0L172 0L92 140H70Z" fill="#fff" opacity=".05"/>`;
  }
  function caseSymbols() {
    const arts = { about: artAbout(), projects: artProjects(), resume: artResume(), contact: artContact() };
    return Object.entries(arts).map(([id, a]) => `<symbol id="jcard-${id}" viewBox="0 0 206 130">${a}</symbol><symbol id="case-${id}" viewBox="0 0 220 140">${caseShell(id)}</symbol>`).join('');
  }

  /* ---------------------------------------------------------- deck */
  function deckSVG(model) {
    const D = GEO.deck;
    let s = '';
    for (const ex of [-46, 1000]) {
      s += `<rect x="${ex}" y="0" width="46" height="330" fill="#1a110a"/><rect x="${ex + 2}" y="2" width="42" height="326" fill="#bdb7a8"/><rect x="${ex + 2}" y="2" width="42" height="8" fill="#e9e5da"/><rect x="${ex + 2}" y="318" width="42" height="10" fill="#8e887a"/>`;
      s += `${screw(ex + 23, 22, 4)}${screw(ex + 23, 308, 4)}`;
    }
    s += `<rect x="-2" y="-2" width="1004" height="334" fill="#1a110a"/>
      <rect width="1000" height="330" fill="#d6d1c4"/>
      <path d="M180 0H470L250 330H0V250Z" fill="#e2ded3"/><path d="M520 0H600L380 330H300Z" fill="#dcd8cc"/>
      <rect width="1000" height="10" fill="#f4f1e9"/><rect y="324" width="1000" height="6" fill="#a29c8e"/><rect y="324" width="1000" height="1.5" fill="#7f796c"/>
      <g stroke="#c6c0b2" stroke-width="1">${[24, 92, 148, 232, 262, 300].map((y) => `<path d="M0 ${y}H1000"/>`).join('')}</g>`;
    for (const hx of [-36, 1014]) {
      s += `<rect x="${hx}" y="40" width="22" height="250" rx="11" fill="#f2efe6" stroke="#1a110a" stroke-width="2"/><rect x="${hx + 5}" y="52" width="4" height="226" rx="2" fill="#fff"/><rect x="${hx + 13}" y="52" width="4" height="226" rx="2" fill="#c9c3b5"/>`;
    }
    s += engr('JACK CAREY', 500, 40, { size: 17, font: F.wm, ls: 8, anchor: 'middle', fill: '#0e0f11' });
    s += `<path d="M20 52H980M20 206H330M670 206H980" stroke="#1a110a" stroke-width="1.6"/><path d="M20 54H980M20 208H330M670 208H980" stroke="#f4f1e9" stroke-width="1.2"/>`;
    s += vu(40, 64, 290, 136, 'L') + vu(670, 64, 290, 136, 'R');
    /* door */
    const x = 350, y = 60, w = 300, h = 198, iw = w - 20, ih = h - 30;
    s += `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" fill="#1a110a"/>`;
    s += `<rect x="${x + 10}" y="${y + 10}" width="${iw}" height="${ih}" fill="#1a110a"/><rect x="${x + 12}" y="${y + 12}" width="${iw - 4}" height="${ih - 4}" fill="#2e2117"/>`;
    s += `<path d="M${x + 60} ${y + ih + 2}l8 -10h${iw - 136}l8 10" fill="none" stroke="#4a4038" stroke-width="2"/>`;
    /* The holder sits between the faceplate and the door glass: a tape sliding down passes in front of
       the faceplate above the door, then behind the tinted glass. */
    s += `<g id="door-slide"><g id="door-cassette" transform="translate(381 76) scale(2.38)"></g></g>`;
    s += `<g id="door-front">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bdb7a8" mask="url(#doormask)"/><rect x="${x}" y="${y}" width="${w}" height="6" fill="#ece8de"/>
      <mask id="doormask"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><rect x="${x + 10}" y="${y + 10}" width="${iw}" height="${ih}" rx="3" fill="#000"/></mask>
      <rect x="${x + 10}" y="${y + 10}" width="${iw}" height="${ih}" fill="#1a110a" opacity=".28"/>
      <path d="M${x + 10 + iw * 0.12} ${y + 10}H${x + 10 + iw * 0.34}L${x + 10 + iw * 0.14} ${y + 10 + ih}H${x + 10 - iw * 0.08}Z" fill="#fff" opacity=".1"/>
      <path d="M${x + 10 + iw * 0.4} ${y + 10}H${x + 10 + iw * 0.45}L${x + 10 + iw * 0.25} ${y + 10 + ih}H${x + 10 + iw * 0.2}Z" fill="#fff" opacity=".08"/>
      <rect x="${x + 10}" y="${y + 10}" width="${iw}" height="${ih}" fill="none" stroke="#1a110a" stroke-width="3"/>
      <path d="M${x + 4} ${y + h - 10}H${x + w - 4}" stroke="#1a110a" stroke-width="1.4"/></g>`;
    s += engr(model, 40, 318, { size: 9, font: F.wm, ls: 3 });
    /* solid base rail: the deck sits on the walnut along its whole width */
    s += `<rect x="-46" y="326" width="1092" height="8" fill="#1a110a"/><rect x="-46" y="326" width="1092" height="1.5" fill="#6b6458"/>`;
    /* recesses behind HTML controls */
    s += `<path d="M347 266H653" stroke="#1a110a" stroke-width="1.4"/>`;
    return `<svg class="deck-art" viewBox="-50 -4 1100 342" aria-hidden="true" focusable="false">${s}</svg>`;
  }

  /* --------------------------------------------- room, back + table
     Geometric, high-contrast: flat planes, hard edges, no haze. */
  function roomBack() {
    /* Every colour here is a theme variable (see station.css): the tape in the deck repaints the room. */
    const W = { x: 160, y: 40, w: 1280, h: 590 };
    const vp = { x: 800, y: 336 };
    let rows = '';
    for (let i = 0; i <= 16; i++) { const bx = -480 + i * 160; rows += `<path d="M${vp.x} ${vp.y}L${bx} 640" stroke-width="${2 + Math.abs(i - 8) * 0.35}"/>`; }
    let mull = '';
    for (let i = 1; i < 4; i++) mull += `<rect x="${W.x + i * 320 - 7}" y="${W.y}" width="14" height="${W.h}" fill="#1a110a"/>`;
    for (const y of [236, 432]) mull += `<rect x="${W.x}" y="${y}" width="${W.w}" height="12" fill="#1a110a"/>`;
    let stars = '';
    for (let i = 0; i < 70; i++) { const x = 170 + ((i * 397) % 1260), y = 96 + ((i * 131) % 170); stars += `<rect x="${x}" y="${y}" width="${i % 9 === 0 ? 4 : 2}" height="${i % 9 === 0 ? 4 : 2}"/>`; }
    let grid = '';
    for (let x = 160; x <= 1440; x += 40) grid += `<path d="M${x} 85V300"/>`;
    for (let y = 100; y <= 300; y += 40) grid += `<path d="M160 ${y}H1440"/>`;
    const birds = [[420, 150, 1], [470, 132, 0.8], [520, 160, 0.9], [760, 120, 0.7], [800, 136, 0.6]].map(([x, y, k]) => `<path d="M${x - 14 * k} ${y - 6 * k}L${x} ${y}L${x + 14 * k} ${y - 6 * k}" stroke-width="${3 * k}"/>`).join('');
    return `<svg class="layer-back" viewBox="-1600 0 4800 1330" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
      <clipPath id="win"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}"/></clipPath>
      <rect class="t-wall" x="-1600" width="4800" height="1330"/>
      <rect class="t-band" x="-1600" y="658" width="4800" height="38"/><rect class="t-band-line" x="-1600" y="658" width="4800" height="4"/>
      <rect x="140" y="20" width="1320" height="630" fill="#1a110a"/>
      <g clip-path="url(#win)">
        <rect class="t-sky4" x="${W.x}" y="40" width="${W.w}" height="590"/>
        <rect class="t-sky0" x="${W.x}" y="40" width="${W.w}" height="70"/>
        <rect class="t-sky1" x="${W.x}" y="110" width="${W.w}" height="62"/>
        <rect class="t-sky2" x="${W.x}" y="172" width="${W.w}" height="58"/>
        <rect class="t-sky3" x="${W.x}" y="230" width="${W.w}" height="50"/>
        <g class="t-grid" fill="none" stroke-width="1">${grid}</g>
        <g class="t-stars">${stars}</g>
        <g class="t-sun">
          <circle class="t-ring2" cx="1150" cy="214" r="124" fill="none" stroke-width="4"/>
          <circle class="t-ring1" cx="1150" cy="214" r="94" fill="none" stroke-width="7"/>
          <circle class="t-disc" cx="1150" cy="214" r="62"/>
          <circle class="t-moonshade" cx="1176" cy="200" r="54"/>
        </g>
        <g class="t-birds" fill="none" stroke-linecap="square">${birds}</g>
        <path class="t-hill1" d="M160 300L340 262L520 286L700 248L880 278L1060 238L1240 270L1440 250V640H160Z"/>
        <path class="t-hill2" d="M160 328L420 300L700 320L980 294L1260 316L1440 302V640H160Z"/>
        <path class="t-field" d="M160 340L1440 332V640H160Z"/>
        <g class="t-rows">${rows}</g>
        <rect class="t-blind" x="${W.x}" y="40" width="${W.w}" height="40"/><rect x="${W.x}" y="80" width="${W.w}" height="5" fill="#1a110a"/>
      </g>
      ${mull}
      <rect x="116" y="636" width="1368" height="22" fill="#5a3518"/><rect x="116" y="636" width="1368" height="3" fill="#d39c69"/>
    </svg>`;
  }
  /* Boards run left to right; each is taller than the one behind it (simple perspective). */
  function boards() {
    let g = '', y = 696, hgt = 16, i = 0;
    while (y < 1330) {
      g += `<rect x="-1600" y="${r1(y)}" width="4800" height="${r1(hgt)}" fill="${i % 2 ? '#4f2d17' : '#56331b'}"/><rect x="-1600" y="${r1(y)}" width="4800" height="1.5" fill="#2c180b"/>`;
      y += hgt; hgt *= 1.32; i++;
    }
    return g;
  }
  function roomTable() {
    const R = GEO.rack, ch = R.ch, top = R.base - ch - R.step * 3 - 18;
    return `<svg class="layer-table" viewBox="-1600 0 4800 1330" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
      ${boards()}
      <rect x="-1600" y="694" width="4800" height="4" fill="#c99263"/>


      <rect x="${R.x - 6}" y="${top}" width="${R.cw + 12}" height="${R.base - top}" fill="#2a170b"/>
      <rect x="${R.x - 6}" y="${top}" width="${R.cw + 12}" height="4" fill="#9a6a42"/>
      ${[0, 1, 2, 3].map((i) => { const t = R.base - ch - (3 - i) * R.step - 8; return `<rect x="${R.x - 6}" y="${t + ch - 2}" width="${R.cw + 12}" height="8" fill="#6b4224"/><rect x="${R.x - 6}" y="${t + ch - 2}" width="${R.cw + 12}" height="2" fill="#c08a5a"/>`; }).join('')}
      <rect x="${R.x - 6}" y="${R.base - 6}" width="${R.cw + 12}" height="26" fill="#3a2110"/><rect x="${R.x - 6}" y="${R.base - 6}" width="${R.cw + 12}" height="3" fill="#c08a5a"/>
      <rect x="${R.x + R.cw / 2 - 52}" y="${R.base + 1}" width="104" height="14" fill="#d7b061"/><rect x="${R.x + R.cw / 2 - 52}" y="${R.base + 13}" width="104" height="2" fill="#7a5520"/>${txt('SELECT A TAPE', R.x + R.cw / 2, R.base + 11.5, { size: 8.4, anchor: 'middle', ls: 2.4, weight: 600, fill: '#1e1408' })}
    </svg>`;
  }

  /* ------------------------------------------ project plates (approved subjects) */
  const PLATES = {
    starmap: () => {
      const pts = [[40, 130], [92, 70], [150, 112], [206, 52], [262, 92]];
      let stars = '';
      for (let i = 0; i < 60; i++) stars += `<circle cx="${(i * 53) % 300}" cy="${(i * 37) % 180}" r="${i % 7 === 0 ? 1.3 : 0.6}" fill="#f4ecdc" opacity="${0.4 + (i % 5) * 0.1}"/>`;
      return `<rect width="300" height="180" fill="#1f3236"/>${stars}<circle cx="150" cy="90" r="70" fill="none" stroke="#5e8a83" stroke-dasharray="2 4" opacity=".6"/><circle cx="150" cy="90" r="120" fill="none" stroke="#5e8a83" stroke-dasharray="2 6" opacity=".4"/>
        <path d="M${pts.map((p) => p.join(' ')).join(' L')}" fill="none" stroke="#e0a542" stroke-width="2"/>
        ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 || i === pts.length - 1 ? 6 : 4}" fill="${i === pts.length - 1 ? '#e0a542' : '#f4ecdc'}" stroke="#1f3236" stroke-width="1.5"/>`).join('')}
        ${txt('ORIGIN', 30, 152, { size: 9, font: F.mono, fill: '#f4ecdc', ls: 1 })}${txt('DESTINATION', 262, 76, { size: 9, font: F.mono, fill: '#e0a542', ls: 1, anchor: 'middle' })}
        <path d="M120 150l20 -8l-6 8l6 8z" fill="#f4ecdc" transform="rotate(-30 130 150)"/>`;
    },
    sign: () => `<rect width="300" height="180" fill="#cfd9dc"/><rect width="300" height="180" fill="url(#graphFine)" opacity=".5"/>
      <path d="M0 150H110V160H0Z M170 128H300V138H170Z" fill="#e9e3d6" stroke="#9c958a"/><rect x="128" y="62" width="4" height="66" fill="#4e545c"/>
      <rect x="96" y="34" width="68" height="34" fill="#f4ecdc" stroke="#a9412a" stroke-width="3"/><path d="M146 51H112m10 -9l-10 9l10 9" stroke="#1f1f1f" stroke-width="5" fill="none"/>
      <g transform="translate(206 52) rotate(-10)"><rect x="-18" y="-16" width="36" height="34" rx="4" fill="#cdc8bd" stroke="#8f959b"/><rect x="-14" y="-15" width="28" height="26" rx="3" fill="#f4ecdc"/>${txt('X', 0, 5, { size: 16, anchor: 'middle', font: F.mono, weight: 600, fill: '#1f1f1f' })}</g>
      <g transform="translate(252 74) rotate(9)"><rect x="-18" y="-16" width="36" height="34" rx="4" fill="#7e3321"/><rect x="-14" y="-15" width="28" height="26" rx="3" fill="#a9412a"/>${txt('Z', 0, 5, { size: 16, anchor: 'middle', font: F.mono, weight: 600, fill: '#f4ecdc' })}</g>
      <path d="M218 30q20 -16 36 10" fill="none" stroke="#1f1f1f" stroke-dasharray="3 3"/><path d="M60 150v-22h8v22z" fill="#1f2a30"/><circle cx="64" cy="122" r="5" fill="#1f2a30"/>`,
    proofs: () => [0, 1, 2].map((i) => `<g transform="translate(${18 + i * 92} ${22 + (i % 2) * 8}) rotate(${[-4, 2, -1][i]})"><rect width="80" height="120" fill="#f4efe2"/>
      <rect x="8" y="22" width="64" height="76" fill="${['#c9b48e', '#9fb3b0', '#d6a77a'][i]}"/><rect x="12" y="8" width="56" height="8" fill="#1f1f1f" opacity=".14"/><rect x="12" y="104" width="56" height="8" fill="#1f1f1f" opacity=".14"/>
      ${txt(`0${i + 1}`, 72, 118, { size: 6, font: F.mono, anchor: 'end', fill: '#6a5a48' })}</g>`).join(''),
    mapfold: () => {
      let pins = '';
      [[90, 70, 4], [120, 92, 7], [170, 64, 3], [196, 112, 5], [150, 130, 2]].forEach(([x, y, n]) => { pins += `<circle cx="${x}" cy="${y}" r="${8 + n}" fill="#7a2e22" opacity=".85"/>${txt(n, x, y + 3.5, { size: 10, anchor: 'middle', font: F.semi, weight: 600, fill: '#f4ecdc' })}`; });
      return `<rect width="300" height="180" fill="#e9dfc8"/><path d="M0 0H100V180H0Z" fill="#000" opacity=".04"/><path d="M200 0H300V180H200Z" fill="#000" opacity=".06"/><path d="M100 0V180M200 0V180M0 90H300" stroke="#bfb196"/>
        <path d="M30 170C80 120 70 70 130 40S240 20 280 0" fill="none" stroke="#7fa06f" stroke-width="18" opacity=".45"/><path d="M40 180C90 130 90 80 140 50S250 30 300 6" fill="none" stroke="#9fb3b0" stroke-width="3"/>
        <path d="M60 30h4M64 34h4M210 150h4M214 154h4" stroke="#8a7c62"/>${pins}`;
    },
  };
  function plateSVG(name) {
    return `<svg viewBox="0 0 300 180" role="img" aria-hidden="true" focusable="false">${(PLATES[name] || (() => ''))()}</svg>`;
  }

  window.STATION_ART = { GEO, F, defs, deckSVG, cassette, cassetteSVG, roomBack, roomTable, plateSVG, TAPES };
})();
