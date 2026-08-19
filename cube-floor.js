/* ═══════════════════════════════════════════════════════════════════════
   The press floor.

   An isometric field of ink dots. The wave physics are unchanged from the
   original cube grid — spatial buckets, smoothstep falloff, footprint
   occlusion — but `elevation` no longer means height. It means ink
   coverage: how wide each diamond opens. Push the pointer across the sheet
   and the screen gains, exactly the way a cheap duplicator does. Where type
   sits, the ink is knocked out.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const canvas = document.getElementById('cube-floor');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const lowQuality = isSafari || coarsePointer;

  if (lowQuality) {
    document.documentElement.classList.add('reduced-fx');
  }

  const TILE_W = 38;
  const TILE_H = 19;
  const WAVE_RADIUS_PX = 170;
  const FOOTPRINT_PAD = 2;
  const FEATHER = 60;       // how far a block's hold-back reaches
  const PAD = 4;            // breathing room around the type itself
  const UNDER_TEXT = 0.34;  // ink still laid down beneath type
  const KNOCK_SCALE = 0.4;  // the hold-back buffer is low-res; it is only blur
  const KNOCK_BLUR = 17;
  const MAX_LIFT = reducedMotion ? 0 : 10;   // peak coverage, in arbitrary units
  const LERP = reducedMotion ? 1 : 0.16;
  const GRID_MARGIN = lowQuality ? 1.1 : 1.2;
  const BUCKET_SIZE = TILE_W;

  /* Ink. Coverage is carried by dot size, not alpha, so each pass is a
     single path and a single fill. */
  const REST_COVER = 0.24;
  /* Capped well below 1 so neighbouring dots never touch. A halftone that
     floods to solid stops being a halftone and starts being a blob. */
  const MAX_COVER = 0.58;
  const KNOCKOUT = 0.34;   // ink left under a block of type
  const INK_ALPHA = 0.22;
  const PINK_ALPHA = 0.14;  // a fringe, not a second colour
  const MISREG_X = 3;
  const MISREG_Y = -2.5;
  const JITTER = 2.6;      // the screen was not laid out by a machine

  let STOCK = '#DEDAD0';
  let BLUE = '#2440C4';
  let PINK = '#FF4FA3';
  let tiles = [];
  let spatialBuckets = new Map();
  let offsetX = 0;
  let offsetY = 0;
  let pointerX = -1;
  let pointerY = -1;
  let animating = false;
  let lastWaveTiles = [];
  let activeTiles = new Set();
  let footprintRects = new Float64Array(0);
  let visibleRects = new Float64Array(0);
  let visibleCount = 0;
  let fieldCanvas = null;
  let fieldCtx = null;
  const knockCanvas = document.createElement('canvas');
  const knockCtx = knockCanvas.getContext('2d');
  const canBlur = typeof ctx.filter === 'string';

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight,
    };
  }

  function readColorsFromCss() {
    const styles = getComputedStyle(document.documentElement);
    STOCK = styles.getPropertyValue('--stock').trim() || STOCK;
    BLUE = styles.getPropertyValue('--blue').trim() || BLUE;
    PINK = styles.getPropertyValue('--pink').trim() || PINK;
  }

  function hash(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function noise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function tileCenter(col, row) {
    return {
      x: offsetX + (col - row) * (TILE_W / 2),
      y: offsetY + (col + row) * (TILE_H / 2),
    };
  }

  function coverageIntensity(elevation) {
    return MAX_LIFT > 0 ? Math.min(1, elevation / MAX_LIFT) : 0;
  }

  /* Rest coverage varies with the noise field so the screen looks bitten,
     not machine-perfect. */
  function restScale(tile) {
    return REST_COVER * (0.25 + tile.baseShade * 1.5);
  }

  function tileScale(tile, intensity) {
    const rest = restScale(tile);
    return rest + (MAX_COVER - rest) * intensity;
  }

  function waveFalloff(normalizedDist) {
    if (normalizedDist >= 1) return 0;
    const t = 1 - normalizedDist;
    return t * t * (3 - 2 * t);
  }

  /* Measured once per layout change and stored in *document* space, so a
     scroll costs no getBoundingClientRect at all — only a subtraction. */
  function refreshFootprints() {
    const sy = window.scrollY;
    const els = document.querySelectorAll('.occludes');
    footprintRects = new Float64Array(els.length * 4);
    visibleRects = new Float64Array(els.length * 4);
    let i = 0;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      footprintRects[i++] = r.left - FOOTPRINT_PAD;
      footprintRects[i++] = r.top + sy - FOOTPRINT_PAD;
      footprintRects[i++] = r.right + FOOTPRINT_PAD;
      footprintRects[i++] = r.bottom + sy + FOOTPRINT_PAD;
    });
  }

  /* Everything off screen is irrelevant to this frame. */
  function collectVisibleRects(topDoc, bottomDoc) {
    visibleCount = 0;
    for (let i = 0; i < footprintRects.length; i += 4) {
      if (footprintRects[i + 3] < topDoc || footprintRects[i + 1] > bottomDoc) continue;
      visibleRects[visibleCount++] = footprintRects[i];
      visibleRects[visibleCount++] = footprintRects[i + 1];
      visibleRects[visibleCount++] = footprintRects[i + 2];
      visibleRects[visibleCount++] = footprintRects[i + 3];
    }
  }

  /* Ink is not knocked out from under type — it runs underneath and is held
     back by painting stock over it, blurred so there is no edge to see.

     The hold-back is composed on its own buffer first: drawn straight onto
     the sheet, two text blocks near each other would each apply their own
     alpha and the overlap would wash out to bare stock. Opaque rects on a
     scratch buffer union instead of compounding. */
  function drawKnockback(sy, w, h) {
    if (!visibleCount) return;

    const kw = Math.max(1, Math.round(w * KNOCK_SCALE));
    const kh = Math.max(1, Math.round(h * KNOCK_SCALE));
    if (knockCanvas.width !== kw) knockCanvas.width = kw;
    if (knockCanvas.height !== kh) knockCanvas.height = kh;

    knockCtx.setTransform(KNOCK_SCALE, 0, 0, KNOCK_SCALE, 0, 0);
    knockCtx.clearRect(0, 0, w, h);
    knockCtx.fillStyle = STOCK;
    for (let i = 0; i < visibleCount; i += 4) {
      knockCtx.fillRect(
        visibleRects[i] - PAD,
        visibleRects[i + 1] - sy - PAD,
        visibleRects[i + 2] - visibleRects[i] + PAD * 2,
        visibleRects[i + 3] - visibleRects[i + 1] + PAD * 2
      );
    }

    ctx.save();
    if (canBlur) ctx.filter = `blur(${KNOCK_BLUR}px)`;
    ctx.globalAlpha = 1 - UNDER_TEXT;
    ctx.drawImage(knockCanvas, 0, 0, w, h);
    ctx.restore();
  }

  function buildSpatialIndex() {
    spatialBuckets.clear();
    for (const tile of tiles) {
      const { x, y } = tileCenter(tile.col, tile.row);
      const key = `${Math.floor(x / BUCKET_SIZE)},${Math.floor(y / BUCKET_SIZE)}`;
      if (!spatialBuckets.has(key)) spatialBuckets.set(key, []);
      spatialBuckets.get(key).push(tile);
    }
  }

  function applyWaveAt(originX, originY, radiusPx, outTiles) {
    const radiusSq = radiusPx * radiusPx;
    const minBx = Math.floor((originX - radiusPx) / BUCKET_SIZE);
    const maxBx = Math.floor((originX + radiusPx) / BUCKET_SIZE);
    const minBy = Math.floor((originY - radiusPx) / BUCKET_SIZE);
    const maxBy = Math.floor((originY + radiusPx) / BUCKET_SIZE);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        const bucket = spatialBuckets.get(`${bx},${by}`);
        if (!bucket) continue;
        for (const tile of bucket) {
          const { x, y } = tileCenter(tile.col, tile.row);
          const dx = originX - x;
          const dy = originY - y;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;
          const lift = MAX_LIFT * waveFalloff(Math.sqrt(distSq) / radiusPx);
          if (lift > tile.targetElevation) {
            tile.targetElevation = lift;
            outTiles.push(tile);
          }
        }
      }
    }
  }

  function addDiamondTo(target, cx, cy, scale) {
    const hw = (TILE_W / 2) * scale;
    const hh = TILE_H * scale;
    target.moveTo(cx, cy - hh);
    target.lineTo(cx + hw, cy);
    target.lineTo(cx, cy + hh);
    target.lineTo(cx - hw, cy);
  }

  function computeExtent(w, h) {
    const reachX = (w / 2 + TILE_W) / (TILE_W / 2);
    const reachY = (h / 2 + TILE_H * 3) / (TILE_H / 2);
    return Math.ceil(Math.max(reachX, reachY) * GRID_MARGIN);
  }

  function buildGrid() {
    readColorsFromCss();
    let dpr = window.devicePixelRatio || 1;
    if (lowQuality) dpr = Math.min(dpr, 2);
    const { w, h } = viewportSize();

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const extent = computeExtent(w, h);
    offsetX = w / 2;
    offsetY = h / 2 + TILE_H;

    tiles = [];
    lastWaveTiles = [];
    activeTiles.clear();
    for (let r = -extent; r <= extent; r++) {
      for (let c = -extent; c <= extent; c++) {
        tiles.push({
          col: c,
          row: r,
          baseShade: noise2D(c * 0.35, r * 0.35),
          jx: (hash(c, r) - 0.5) * JITTER,
          jy: (hash(r, c) - 0.5) * JITTER * 0.6,
          elevation: 0,
          targetElevation: 0,
        });
      }
    }
    buildSpatialIndex();
    refreshFootprints();
    buildField();
  }

  function updateHover() {
    for (const tile of lastWaveTiles) {
      tile.targetElevation = 0;
      activeTiles.add(tile);
    }
    lastWaveTiles = [];

    if (pointerX < 0 || MAX_LIFT <= 0) return;

    applyWaveAt(pointerX, pointerY, WAVE_RADIUS_PX, lastWaveTiles);

    for (const tile of lastWaveTiles) {
      activeTiles.add(tile);
    }
  }

  function tickAnimations() {
    let needsFrame = false;
    const settled = [];

    for (const tile of activeTiles) {
      const diff = tile.targetElevation - tile.elevation;
      if (Math.abs(diff) > 0.1) {
        tile.elevation += diff * LERP;
        needsFrame = true;
      } else if (tile.elevation !== tile.targetElevation) {
        tile.elevation = tile.targetElevation;
        needsFrame = true;
      }
      if (tile.elevation < 0.05 && tile.targetElevation < 0.05) {
        settled.push(tile);
      }
    }

    for (const tile of settled) {
      activeTiles.delete(tile);
    }

    return needsFrame;
  }

  /* The resting screen never changes between resizes, so it is rasterised
     once and blitted. Building its path costs ~18k canvas calls; doing that
     every frame was the whole cost of the animation. */
  function buildField() {
    const { w, h } = viewportSize();
    let dpr = window.devicePixelRatio || 1;
    if (lowQuality) dpr = Math.min(dpr, 2);

    if (!fieldCanvas) {
      fieldCanvas = document.createElement('canvas');
      fieldCtx = fieldCanvas.getContext('2d');
    }
    fieldCanvas.width = w * dpr;
    fieldCanvas.height = h * dpr;
    fieldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fieldCtx.clearRect(0, 0, w, h);

    const padX = TILE_W;
    const padY = TILE_H * 2;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    fieldCtx.globalAlpha = INK_ALPHA;
    fieldCtx.fillStyle = BLUE;
    fieldCtx.beginPath();
    for (const tile of tiles) {
      const x = offsetX + (tile.col - tile.row) * hw;
      if (x < -padX || x > w + padX) continue;
      const y = offsetY + (tile.col + tile.row) * hh;
      if (y < -padY || y > h + padY) continue;
      addDiamondTo(fieldCtx, x + tile.jx, y + tile.jy, restScale(tile));
    }
    fieldCtx.fill();
    fieldCtx.globalAlpha = 1;
  }

  function render() {
    const { w, h } = viewportSize();
    const sy = window.scrollY;

    ctx.globalAlpha = 1;
    ctx.fillStyle = STOCK;
    ctx.fillRect(0, 0, w, h);
    if (fieldCanvas) ctx.drawImage(fieldCanvas, 0, 0, w, h);

    collectVisibleRects(sy - FEATHER, sy + h + FEATHER);

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    /* Only disturbed tiles are path-drawn — a few hundred inside the wave
       radius rather than every dot on screen. */
    if (activeTiles.size) {
      ctx.globalAlpha = INK_ALPHA;
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      for (const tile of activeTiles) {
        const intensity = coverageIntensity(tile.elevation);
        if (intensity < 0.02) continue;
        const x = offsetX + (tile.col - tile.row) * hw;
        const y = offsetY + (tile.col + tile.row) * hh;
        addDiamondTo(ctx, x + tile.jx, y + tile.jy, tileScale(tile, intensity));
      }
      ctx.fill();

      // Second impression: pink, off register.
      ctx.globalAlpha = PINK_ALPHA;
      ctx.fillStyle = PINK;
      ctx.beginPath();
      for (const tile of activeTiles) {
        const intensity = coverageIntensity(tile.elevation);
        if (intensity < 0.06) continue;
        const x = offsetX + (tile.col - tile.row) * hw;
        const y = offsetY + (tile.col + tile.row) * hh;
        addDiamondTo(ctx, x + tile.jx + MISREG_X, y + tile.jy + MISREG_Y,
          tileScale(tile, intensity) * 0.7);
      }
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    drawKnockback(sy, w, h);
  }

  function frame() {
    updateHover();
    const moving = tickAnimations();

    if (moving) {
      render();
      requestAnimationFrame(frame);
    } else {
      animating = false;
    }
  }

  function requestFrame() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(frame);
    }
  }

  function onPointerMove(e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
    requestFrame();
  }

  function onPointerLeave() {
    pointerX = -1;
    pointerY = -1;
    requestFrame();
  }

  function onTouchStart(e) {
    if (!e.touches.length) return;
    pointerX = e.touches[0].clientX;
    pointerY = e.touches[0].clientY;
    requestFrame();
  }

  /* Footprints are already in document space, so a scroll only needs a
     repaint — no re-measure, no layout flush. */
  function onScroll() {
    render();
    requestFrame();
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildGrid();
      render();
      requestFrame();
    }, 150);
  }

  readColorsFromCss();
  buildGrid();
  render();

  // Web fonts land after first paint and reflow the type, which moves every
  // knockout. Re-measure once the sheet has settled.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      refreshFootprints();
      render();
    });
  }

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseleave', onPointerLeave);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onPointerLeave, { passive: true });
  window.addEventListener('touchcancel', onPointerLeave, { passive: true });
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  window.CubeFloor = { refreshFootprints, onScroll, render };
})();
